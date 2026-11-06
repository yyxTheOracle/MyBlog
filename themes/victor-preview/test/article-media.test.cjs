const assert = require('node:assert/strict');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const prepareArticleMedia = require('../scripts/article-media');

const sizes = { '/photo.png': [800, 600], '/demo.mp4': [2560, 1550] };

test('补齐真实尺寸并保留手写宽度；只有首张图默认立即加载', () => {
  const html = prepareArticleMedia('<img src="/photo.png"><img src="/photo.png" width=256><img src="/photo.png" height="150"><img src="/photo.png" width="10" height="20" loading="eager">', sizes);
  const images = new JSDOM(html).window.document.querySelectorAll('img');
  assert.deepEqual([...images].map(image => [image.width, image.height]), [[800, 600], [256, 192], [200, 150], [10, 20]]);
  assert.deepEqual([...images].map(image => image.getAttribute('loading')), ['eager', 'lazy', 'lazy', 'eager']);
  assert.ok([...images].every(image => image.getAttribute('decoding') === 'async'));
  assert.equal(images[1].getAttribute('width'), '256', '保留旧 HTML 的显示尺寸语义');
});

test('Markdown 独立图片形成合法 figure，显式图注与替代文字分离且转义', () => {
  const html = prepareArticleMedia('<p>正文</p><p><img src="/photo.png" alt="替代文字" title="图注 &lt;示例&gt;"></p>', sizes, {});
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll('figure.article-image').length, 1);
  assert.equal(document.querySelector('p').textContent, '正文');
  assert.equal(document.querySelector('figcaption').textContent, '图注 <示例>');
  assert.equal(document.querySelector('img').alt, '替代文字');
  assert.equal(document.querySelector('img').hasAttribute('title'), false);
  assert.equal(prepareArticleMedia(html, sizes, {}), html);
});

test('原图地址与正文适配版分离，紧凑图片使用自己的响应式宽度', () => {
  const assets = { '/photo.png': { width: 800, height: 600, src: '/assets/photo-760.webp', variants: [{ src: '/assets/photo-480.webp', width: 480 }, { src: '/assets/photo-760.webp', width: 760 }] } };
  const html = prepareArticleMedia('<div data-image-size="compact"><p><img src="/photo.png" alt="照片"></p></div>', {}, assets);
  const image = new JSDOM(html).window.document.querySelector('img');
  assert.equal(image.getAttribute('src'), '/assets/photo-760.webp');
  assert.equal(image.getAttribute('data-original-src'), '/photo.png');
  assert.equal(image.getAttribute('data-original-width'), '800');
  assert.equal(image.getAttribute('srcset'), '/assets/photo-480.webp 480w, /assets/photo-760.webp 760w');
  assert.match(image.getAttribute('sizes'), /480px$/);
  assert.equal(image.getAttribute('loading'), 'eager');
});

test('图组编号尊重顺序，保留已有图注、链接图片及行内正文', () => {
  const html = prepareArticleMedia('<div class="article-gallery"><p><img src="/a.gif" alt="动画"></p><p><img src="/photo.png" alt="截图" title="审核通过"></p></div><figure><img src="/photo.png" alt="旧图"><figcaption>作者的说明</figcaption></figure><p>查看 <a href="/detail"><img src="/photo.png" alt="链接图" title="链接说明"></a> 了解详情</p>', sizes, {});
  const document = new JSDOM(html).window.document;
  assert.deepEqual([...document.querySelectorAll('.article-gallery figcaption')].map(node => node.textContent), ['图 1：动画', '图 2：审核通过']);
  assert.equal(document.querySelectorAll('figcaption')[2].textContent, '作者的说明');
  assert.equal(document.querySelector('a').getAttribute('href'), '/detail');
  assert.match(document.querySelector('a').closest('p').textContent, /^查看 .*了解详情$/);
  assert.equal(document.querySelector('.article-image-caption').textContent, '链接说明');
  assert.equal(document.querySelector('.article-gallery img').getAttribute('src'), '/a.gif');
});

test('嵌套行内图片不拆开段落，picture 的 source 与 img 保持直接相邻', () => {
  const html = prepareArticleMedia('<p>文字 <strong><img src="/photo.png" alt="截图" title="说明"></strong> 结尾</p><p><picture><source srcset="/alternate.webp" type="image/webp"><img src="/photo.png" alt="响应图"></picture></p>', sizes, {});
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelectorAll('p').length, 1);
  assert.equal(document.querySelector('p').textContent, '文字 说明 结尾');
  assert.ok(document.querySelector('p strong img'));
  assert.ok(document.querySelector('figure > picture > source'));
  assert.ok(document.querySelector('figure > picture > img'));
});

test('动画使用持久原件并保留来源，避免大图重复下载同一GIF', () => {
  const html = prepareArticleMedia('<p><img src="https://example.com/a.gif" alt="动态效果"></p>', {}, {
    'https://example.com/a.gif': { src: '/assets/article-images/a.gif', width: 320, height: 240, animated: true, variants: [] },
  });
  const image = new JSDOM(html).window.document.querySelector('img');
  assert.equal(image.getAttribute('data-original-src'), 'https://example.com/a.gif');
  assert.equal(image.getAttribute('data-media-animated'), 'true');
  assert.equal(image.getAttribute('src'), '/assets/article-images/a.gif');
  assert.equal(image.hasAttribute('srcset'), false);
});

test('支持 video 子 source；不改写代码、样式和媒体之外的 HTML', () => {
  const prefix = '<p class="intro">正文 &amp; 内容</p><pre><code><img src="/photo.png"></code></pre><style>.x { color: red; }</style>';
  const html = prepareArticleMedia(prefix + '<video controls style="width:100%;height:auto"><source src="/demo.mp4" type="video/mp4"></video>', sizes);
  assert.ok(html.startsWith(prefix));
  const video = new JSDOM(html).window.document.querySelector('video');
  assert.equal(video.width, 2560);
  assert.equal(video.height, 1550);
  assert.equal(video.getAttribute('style'), 'width:100%;height:auto');
  assert.ok(video.hasAttribute('controls'));
});

test('未知媒体不猜比例，显式显示属性与解码设置保留，重复处理不重复添加', () => {
  const html = prepareArticleMedia('<img src="/missing.png"><img src="/photo.png" width="100%" decoding="sync"><video src="/missing.mp4"></video>', sizes);
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('img').hasAttribute('width'), false);
  assert.equal(document.querySelector('img').hasAttribute('loading'), false);
  assert.equal(document.querySelectorAll('img')[1].getAttribute('width'), '100%');
  assert.equal(document.querySelectorAll('img')[1].getAttribute('decoding'), 'sync');
  assert.equal(document.querySelector('video').hasAttribute('height'), false);
  assert.equal(prepareArticleMedia(html, sizes), html);
});
