const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const sharp = require('sharp');
const { collectImages, galleryErrors, sourcePath, prepareImage, cacheValid, prepareImages, articleImages } = require('../../../scripts/prepare-images.cjs');

/** 每例使用独立资源目录，防止测试改写网站真实图片。 */
async function directory(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'myblog-images-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('读取渲染后图片的原地址，忽略代码示例并保留逐图替代文字检查', () => {
  const images = collectImages('<p><img src="/one.png" alt="说明"></p><pre><code><img src="/example.png"></code></pre><img src="/generated.webp" data-original-src="https://example.com/a.png" alt="">', 'post.md');
  assert.deepEqual(images, [
    { src: '/one.png', alt: '说明', source: 'post.md' },
    { src: 'https://example.com/a.png', alt: '', source: 'post.md' },
  ]);
});

test('适配图保持比例、不放大小图，原始URL仍可用于查看细节', async t => {
  const sourceDir = await directory(t);
  const input = await sharp({ create: { width: 1000, height: 1400, channels: 3, background: '#123456' } }).png().toBuffer();
  const entry = await prepareImage('https://example.com/large.png', input, sourceDir);
  assert.deepEqual(entry.variants.map(item => item.width), [480, 760, 1000]);
  assert.equal(entry.original, 'https://example.com/large.png');
  assert.equal(await cacheValid(entry, sourceDir), true);
  const small = await sharp({ create: { width: 320, height: 40, channels: 3, background: '#fff' } }).png().toBuffer();
  const smallEntry = await prepareImage('/assets/small.png', small, sourceDir);
  assert.deepEqual(smallEntry.variants.map(item => item.width), [320]);
  assert.equal((await sharp(sourcePath(sourceDir, smallEntry.src)).metadata()).height, 40);
  // JPEG 快速缩小可能把长图高度舍入两次；资源的真实比例必须通过同一缓存校验。
  const tall = await sharp({ create: { width: 1541, height: 4096, channels: 3, background: '#fff' } }).jpeg().toBuffer();
  assert.equal(await cacheValid(await prepareImage('/assets/tall.jpg', tall, sourceDir), sourceDir), true);
});

test('GIF以原字节保存，所有帧、播放速度和循环设置都保持不变', async t => {
  const sourceDir = await directory(t);
  const frame = color => ({ create: { width: 10, height: 20, channels: 3, background: color } });
  const input = await sharp([frame('red'), frame('blue')], { join: { animated: true } }).gif({ loop: 0, delay: [100, 200] }).toBuffer();
  const entry = await prepareImage('/assets/animated.gif', input, sourceDir);
  assert.equal(entry.animated, true);
  assert.deepEqual(entry.variants, []);
  assert.deepEqual(await fs.readFile(sourcePath(sourceDir, entry.src)), input);
  assert.equal((await sharp(input).metadata()).pages, 2);
  assert.equal(await cacheValid(entry, sourceDir), true);
});

test('有效缓存不联网；检查模式拒绝缺文件且不偷偷下载', async t => {
  const sourceDir = await directory(t);
  const input = await sharp({ create: { width: 20, height: 30, channels: 3, background: 'blue' } }).png().toBuffer();
  const url = 'https://example.com/image.png';
  const manifest = { [url]: await prepareImage(url, input, sourceDir) };
  const images = [{ src: url, alt: '小图', source: 'post.md' }];
  const load = () => { throw new Error('不应联网'); };
  assert.deepEqual((await prepareImages(images, manifest, { sourceDir, load })).errors, []);
  await fs.unlink(sourcePath(sourceDir, manifest[url].src));
  const result = await prepareImages(images, manifest, { sourceDir, checkOnly: true, load });
  assert.equal(result.prepared, 0);
  assert.match(result.errors[0], /适配文件缺失/);
});

test('缺少alt和坏图均阻止发布，但不丢弃同批成功准备的资源', async t => {
  const sourceDir = await directory(t);
  const input = await sharp({ create: { width: 20, height: 30, channels: 3, background: 'blue' } }).png().toBuffer();
  const manifest = {};
  const images = [{ src: '/assets/ok.png', alt: '', source: 'post.md' }, { src: '/assets/bad.png', alt: '坏图', source: 'post.md' }];
  const result = await prepareImages(images, manifest, { sourceDir, log() {}, load: async url => url.endsWith('ok.png') ? input : Buffer.from('not an image') });
  assert.equal(result.prepared, 1);
  assert.equal(result.errors.length, 2);
  assert.match(result.errors[0], /缺少替代文字/);
  assert.equal(await cacheValid(manifest['/assets/ok.png'], sourceDir), true);
  assert.equal(manifest['/assets/bad.png'], undefined);
});

test('本地资源读取不能越过网站source目录', () => {
  assert.throws(() => sourcePath('/site/source', '/%2e%2e/private.png'), /越出/);
  assert.throws(() => sourcePath('/site/source', '//example.com/image.png'), /站点根路径/);
  assert.throws(() => sourcePath('/site/source', 'file:///etc/passwd'), /站点根路径/);
});

test('图组不能藏入正文，手写图片style会成为发布错误', async t => {
  const figure = '<figure><img src="/a.png" alt="说明"><figcaption>图 1：说明</figcaption></figure>';
  assert.equal(galleryErrors(`<div class="article-gallery">${figure}${figure}</div>`, 'post.md').length, 0);
  assert.equal(galleryErrors(`<div class="article-gallery">${figure}<p>应保留的正文</p></div>`, 'post.md').length, 1);
  assert.deepEqual(galleryErrors('<pre><code><div class="article-gallery">示例</div></code></pre>', 'post.md'), []);
  const sourceDir = await directory(t);
  const result = await prepareImages(collectImages('<img src="/a.png" alt="说明" style="width:123px">', 'post.md'), {}, { sourceDir, checkOnly: true });
  assert.match(result.errors[0], /不能手写 style/);
});

test('扫描文章使用独立Hexo数据库，不改变现有构建缓存', async t => {
  const root = await directory(t);
  await fs.mkdir(path.join(root, 'source/_posts'), { recursive: true });
  await fs.symlink(path.resolve(__dirname, '../../../node_modules'), path.join(root, 'node_modules'), 'dir');
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ hexo: { version: '6.0.0' }, dependencies: { 'hexo-renderer-marked': '*' } }));
  await fs.writeFile(path.join(root, '_config.yml'), 'title: 测试\ntheme: false\n');
  await fs.writeFile(path.join(root, 'source/_posts/example.md'), '---\ntitle: 测试\ndate: 2020-01-01\n---\n![说明](/assets/new.png)');
  const before = Buffer.from('现有缓存不能被图片扫描改写');
  await fs.writeFile(path.join(root, 'db.json'), before);
  const { images, errors } = await articleImages(root);
  const after = await fs.readFile(path.join(root, 'db.json'));
  assert.equal(images.length, 1);
  assert.equal(images[0].src, '/assets/new.png');
  assert.deepEqual(errors, []);
  assert.deepEqual(after, before);
});
