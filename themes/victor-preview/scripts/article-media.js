'use strict';

const { Parser, parseDocument } = require('htmlparser2');
const { getElementsByTagName, appendChild } = require('domutils');
const serialize = require('dom-serializer').default;
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const dimensions = require('../media-dimensions.json');

/** 属性与图注均视为普通文本，避免 Markdown title 中的符号变成 HTML。 */
function escapeText(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

/** 返回最近的匹配祖先，用于保留链接、代码示例与作者写好的 figure。 */
function ancestor(node, matches) {
  for (let parent = node.parent; parent; parent = parent.parent) if (matches(parent)) return parent;
}

/** 每次渲染读取清单，开发服务器可立即使用刚准备好的图片资源。 */
function readAssets() {
  const file = path.join(__dirname, '../image-assets.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}

/** 仅替换图片所在的小块 HTML，代码和正文其余部分保留原始文本。 */
function formatArticleImages(html, assets) {
  const document = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  const edits = new Map();
  const groupCounts = new Map();
  for (const image of getElementsByTagName('img', document.children, true)) {
    if (ancestor(image, node => ['pre', 'code', 'script', 'style'].includes(node.name))) continue;
    const attributes = image.attribs;
    if ('data-article-image' in attributes) continue;
    const original = attributes['data-original-src'] || attributes.src;
    const asset = assets[original];
    attributes['data-article-image'] = '';
    if (original) attributes['data-original-src'] = original;
    if (asset) {
      attributes.src = asset.src;
      attributes.width = String(asset.width);
      attributes.height = String(asset.height);
      attributes['data-original-width'] = String(asset.width);
      attributes['data-original-height'] = String(asset.height);
      if (asset.animated) attributes['data-media-animated'] = 'true';
      if (asset.variants?.length) {
        attributes.srcset = asset.variants.map(item => `${item.src} ${item.width}w`).join(', ');
        const compact = ancestor(image, node => node.attribs?.['data-image-size'] === 'compact');
        attributes.sizes = `(max-width: 800px) calc(100vw - 48px), ${compact ? 480 : 760}px`;
      }
    }
    const group = ancestor(image, node => node.attribs?.class?.split(/\s+/).includes('article-gallery'));
    let caption = attributes.title || '';
    if (group) {
      const number = (groupCounts.get(group) || 0) + 1;
      groupCounts.set(group, number);
      caption = `图 ${number}：${caption || attributes.alt || '图片'}`;
    }
    // title 作为显式图注，不再重复显示浏览器悬浮提示。
    if (attributes.title) delete attributes.title;
    if (caption) attributes['data-caption'] = caption;
    const figure = ancestor(image, node => node.name === 'figure');
    if (figure) {
      figure.attribs.class = [...new Set((figure.attribs.class || '').split(/\s+/).filter(Boolean).concat('article-image'))].join(' ');
      if (caption && !getElementsByTagName('figcaption', figure.children, true).length) {
        appendChild(figure, parseDocument(`<figcaption>${escapeText(caption)}</figcaption>`).children[0]);
      }
      edits.set(figure, () => serialize(figure));
      continue;
    }
    // picture 的 source 必须继续与 img 相邻；行内 strong/span 也不能被 figure 打断。
    let content = image.parent?.name === 'picture' ? image.parent : image;
    if (content.parent?.name === 'a') content = content.parent;
    const paragraph = ancestor(content, node => node.name === 'p');
    const standalone = paragraph
      ? content.parent === paragraph && paragraph.children.every(node => node === content || (node.type === 'text' && !node.data.trim()))
      : content.parent?.type === 'root' || ['div', 'li', 'section', 'article', 'blockquote', 'dd', 'td'].includes(content.parent?.name);
    if (standalone) {
      const target = paragraph || content;
      edits.set(target, () => `<figure class="article-image">${serialize(content)}${caption ? `<figcaption>${escapeText(caption)}</figcaption>` : ''}</figure>`);
    } else {
      // 行内图片保留所在段落；有图注时用合法的行内容器，避免 figure 打断 p。
      edits.set(content, () => caption
        ? `<span class="article-image-inline">${serialize(content)}<span class="article-image-caption">${escapeText(caption)}</span></span>`
        : serialize(content));
    }
  }
  for (const [node, render] of [...edits].sort((a, b) => b[0].startIndex - a[0].startIndex)) {
    html = html.slice(0, node.startIndex) + render() + html.slice(node.endIndex + 1);
  }
  return html;
}

/** 在浏览器下载媒体前给出真实比例，同时保留作者指定的显示宽度。 */
function mediaAttributes(attributes, size) {
  if (!size) return '';
  const [width, height] = size;
  const suppliedWidth = Number(attributes.width);
  const suppliedHeight = Number(attributes.height);
  if (attributes.width && attributes.height) return '';
  if (attributes.width) return suppliedWidth > 0 ? ` height="${Math.round(suppliedWidth * height / width)}"` : '';
  if (attributes.height) return suppliedHeight > 0 ? ` width="${Math.round(suppliedHeight * width / height)}"` : '';
  return ` width="${width}" height="${height}"`;
}

/** 只补写媒体起始标签，保留代码示例、HTML 排版和原有属性的原始文本。 */
function prepareArticleMedia(html, sizes = dimensions, assets = readAssets()) {
  const media = [];
  let ignoredDepth = 0;
  let video;
  let imageIndex = 0;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (ignoredDepth || ['pre', 'code', 'script', 'style'].includes(name)) {
        ignoredDepth++;
        return;
      }
      if (name === 'img' || name === 'video') {
        const item = { name, attributes, src: attributes.src, start: parser.startIndex, end: parser.endIndex };
        if (name === 'img') item.index = imageIndex++;
        else video = item;
        media.push(item);
      } else if (name === 'source' && video && !video.src) {
        video.src = attributes.src;
      }
    },
    onclosetag(name) {
      if (ignoredDepth) ignoredDepth--;
      else if (name === 'video') video = undefined;
    },
  });
  parser.end(html);

  // 从后往前替换，前一个标签的原始字符位置不会被新增属性推移。
  for (const item of media.reverse()) {
    const asset = assets[item.attributes['data-original-src'] || item.src];
    const size = asset ? [asset.width, asset.height] : sizes[item.src];
    let extra = mediaAttributes(item.attributes, size);
    if (item.name === 'img') {
      if (!item.attributes.decoding) extra += ' decoding="async"';
      // 未知尺寸不主动懒加载，避免进入视口后才撑开正文；手写 loading 始终优先。
      if (!item.attributes.loading && (size || (item.attributes.width && item.attributes.height))) {
        extra += ` loading="${item.index === 0 ? 'eager' : 'lazy'}"`;
      }
    }
    if (extra) {
      const tag = html.slice(item.start, item.end + 1).replace(/\s*\/?\>$/, ending => extra + ending);
      html = html.slice(0, item.start) + tag + html.slice(item.end + 1);
    }
  }
  return formatArticleImages(html, assets);
}

if (typeof hexo !== 'undefined') {
  // 特殊排版只包一层短标签，内部继续使用普通 Markdown 图片语法。
  hexo.extend.tag.register('compact', function(args, content) {
    if (args.length) throw new Error('compact 标签无需参数；普通图片直接写 Markdown。');
    return `<div data-image-size="compact">${hexo.render.renderSync({ text: content, engine: 'markdown' })}</div>`;
  }, { ends: true });
  hexo.extend.tag.register('gallery', function(args, content) {
    return `<div class="article-gallery" aria-label="${escapeText(args.join(' ') || '文章图组')}">${hexo.render.renderSync({ text: content, engine: 'markdown' })}</div>`;
  }, { ends: true });
  hexo.extend.filter.register('after_post_render', (data) => {
    if (data.layout === 'post') data.content = prepareArticleMedia(data.content);
    return data;
  }, 20);
}

module.exports = prepareArticleMedia;
