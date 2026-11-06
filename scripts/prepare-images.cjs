'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { Parser, parseDocument } = require('htmlparser2');
const { findAll, getElementsByTagName, textContent } = require('domutils');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'themes/victor-preview/image-assets.json');
const ASSET_PREFIX = '/assets/article-images/';
const MAX_BYTES = 64 * 1024 * 1024;

/** 读取实际渲染的图片，代码示例里的 img 不属于文章媒体。 */
function collectImages(html, source) {
  const images = [];
  let ignoredDepth = 0;
  new Parser({
    onopentag(name, attributes) {
      if (ignoredDepth || ['pre', 'code', 'script', 'style', 'svg'].includes(name)) {
        ignoredDepth++;
      } else if (name === 'img') {
        const image = { src: attributes['data-original-src'] || attributes.src || '', alt: (attributes.alt || '').trim(), source };
        if (attributes.style?.trim()) image.style = attributes.style;
        images.push(image);
      }
    },
    onclosetag() { if (ignoredDepth) ignoredDepth--; },
  }).end(html);
  return images;
}

/** 图组只能承载有说明的插图，正文段落留在图组之外，避免增强后被隐藏。 */
function galleryErrors(html, source) {
  const document = parseDocument(html);
  const galleries = findAll(node => {
    if (!node.attribs?.class?.split(/\s+/).includes('article-gallery')) return false;
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (['pre', 'code', 'script', 'style'].includes(parent.name)) return false;
    }
    return true;
  }, document.children);
  return galleries.flatMap((gallery, index) => {
    const children = gallery.children.filter(node => node.type !== 'comment' && !(node.type === 'text' && !node.data.trim()));
    const valid = children.length >= 2 && children.every(node => node.name === 'figure'
      && getElementsByTagName('img', node.children, true).length === 1
      && getElementsByTagName('figcaption', node.children, true).some(caption => /^图\s*\d+\s*：.+/.test(textContent(caption).trim())));
    return valid ? [] : [`${source}：第 ${index + 1} 个图组必须只包含至少两张图片，每张有编号说明；正文请放到图组外。`];
  });
}

/** 本地图片只从网站 source 目录读取，避免路径越界。 */
function sourcePath(sourceDir, url) {
  if (!url.startsWith('/') || url.startsWith('//')) throw new Error('本地图片请使用 /assets/... 站点根路径');
  const file = path.resolve(sourceDir, '.' + decodeURIComponent(url.split(/[?#]/)[0]));
  if (!file.startsWith(path.resolve(sourceDir) + path.sep)) throw new Error('图片路径越出 source 目录');
  return file;
}

/** 新图下载有超时和大小上限；缓存命中时不经过这里。 */
async function readSource(url, sourceDir) {
  if (!/^https?:\/\//i.test(url)) return fs.readFile(sourcePath(sourceDir, url));
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`下载失败：HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('原图超过 64 MiB，请先准备合适的展示文件');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw new Error('原图超过 64 MiB，请先准备合适的展示文件');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/** 只按宽度等比缩小；动画直接复制原件，避免丢帧或改变循环设置。 */
async function prepareImage(url, input, sourceDir) {
  const metadata = await sharp(input).metadata();
  const animated = metadata.format === 'gif' || metadata.pages > 1;
  let width = metadata.width;
  let height = metadata.pageHeight || metadata.height;
  if (!animated && metadata.orientation >= 5) [width, height] = [height, width];
  if (!(width > 0 && height > 0)) throw new Error('无法读取真实像素尺寸');
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 20);
  const folder = path.join(sourceDir, ASSET_PREFIX);
  await fs.mkdir(folder, { recursive: true });
  const entry = { width, height, src: '', variants: [], original: url, animated };
  if (animated || metadata.format === 'svg') {
    entry.src = `${ASSET_PREFIX}${hash}.${metadata.format}`;
    await fs.writeFile(sourcePath(sourceDir, entry.src), input);
  } else {
    const widths = [...new Set([480, 760, 1520].map(size => Math.min(size, width)))];
    for (const size of widths) {
      const src = `${ASSET_PREFIX}${hash}-${size}.webp`;
      await sharp(input).autoOrient().resize({ width: size, withoutEnlargement: true, fastShrinkOnLoad: false }).webp({ quality: 90 }).toFile(sourcePath(sourceDir, src));
      entry.variants.push({ src, width: size });
    }
    entry.src = (entry.variants.find(item => item.width >= 760) || entry.variants.at(-1)).src;
  }
  return entry;
}

/** 发布前核对落盘文件和真实比例，损坏或缺失的缓存不能被当作成功。 */
async function cacheValid(entry, sourceDir) {
  if (!entry || !(entry.width > 0 && entry.height > 0) || !Array.isArray(entry.variants)) return false;
  const files = entry.variants.length ? entry.variants : [{ src: entry.src, width: entry.width }];
  if (!files.some(file => file.src === entry.src)) return false;
  try {
    for (const file of files) {
      if (!file.src?.startsWith(ASSET_PREFIX) || !(file.width > 0 && file.width <= entry.width)) return false;
      const metadata = await sharp(sourcePath(sourceDir, file.src)).metadata();
      const height = metadata.pageHeight || metadata.height;
      if (metadata.width !== file.width || Math.abs(height - entry.height * file.width / entry.width) > 1) return false;
      if (entry.animated && metadata.format !== 'gif' && !(metadata.pages > 1)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** 一张图失败不掩盖其他问题；成功的资源保留，下次只重试缺失项。 */
async function prepareImages(images, manifest, { sourceDir, checkOnly = false, refresh, load = readSource, log = console.log }) {
  const errors = [];
  let prepared = 0;
  const unique = new Map();
  for (const image of images) {
    if (!image.alt) errors.push(`${image.source}：图片缺少替代文字：${image.src || '(无地址)'}`);
    if (image.style) errors.push(`${image.source}：图片不能手写 style，请使用普通图片或 compact 标记：${image.src}`);
    if (!image.src) errors.push(`${image.source}：图片缺少 src`);
    else unique.set(image.src, image);
  }
  for (const [url, image] of unique) {
    try {
      if (url !== refresh && await cacheValid(manifest[url], sourceDir)) continue;
      if (checkOnly) throw new Error('尚未准备，或适配文件缺失；运行 npm run images:prepare');
      manifest[url] = await prepareImage(url, await load(url, sourceDir), sourceDir);
      prepared++;
      log(`已准备图片 ${prepared}：${url}`);
    } catch (error) {
      errors.push(`${image.source}：${url}：${error.message}`);
    }
  }
  return { errors, prepared, total: unique.size };
}

/** 与 Hexo 共用解析结果，因此 Markdown、HTML 和图组标签都走同一检查。 */
async function articleImages(root) {
  const Hexo = require('hexo');
  // 独立数据库让扫描始终读取当前文章，也不把旧 manifest 渲染结果写回构建缓存。
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'myblog-images-'));
  const hexo = new Hexo(root, { silent: true, output: scratch });
  try {
    await hexo.init();
    await hexo.load();
    const posts = hexo.locals.get('posts').toArray();
    return {
      images: posts.flatMap(post => collectImages(post.content, post.source)),
      errors: posts.flatMap(post => galleryErrors(post.content, post.source)),
    };
  } finally {
    await hexo.exit();
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

/** 预览只报告问题，构建和发布必须拿到完整资源后才能继续。 */
async function main(args) {
  const preview = args.includes('--preview');
  const checkOnly = preview || args.includes('--check');
  const refreshIndex = args.indexOf('--refresh');
  const refresh = refreshIndex === -1 ? undefined : args[refreshIndex + 1];
  if (refreshIndex !== -1 && (!refresh || refresh.startsWith('--'))) throw new Error('--refresh 后必须给出要刷新的图片 URL');
  const { images, errors } = await articleImages(ROOT);
  let manifest = {};
  try { manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await prepareImages(images, manifest, { sourceDir: path.join(ROOT, 'source'), checkOnly, refresh });
  result.errors.unshift(...errors);
  if (!checkOnly) {
    const ordered = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    const content = JSON.stringify(ordered, null, 2) + '\n';
    // 原子替换避免中途退出留下半份清单，已有文章仍可使用之前的适配资源。
    await fs.writeFile(MANIFEST + '.tmp', content);
    await fs.rename(MANIFEST + '.tmp', MANIFEST);
    // 新适配资源改变 src/srcset，下一次构建须重新渲染曾经只有外链的文章。
    if (result.prepared) await fs.rm(path.join(ROOT, 'db.json'), { force: true });
  }
  console.log(`图片检查：${images.length} 处展示，${result.total} 个来源，本次准备 ${result.prepared} 张。`);
  for (const error of result.errors) console.error(error);
  if (result.errors.length && !preview) process.exitCode = 1;
  if (result.errors.length && preview) console.log('预览继续；发布前请修复以上图片问题。');
}

module.exports = { collectImages, galleryErrors, sourcePath, readSource, prepareImage, cacheValid, prepareImages, articleImages };
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
