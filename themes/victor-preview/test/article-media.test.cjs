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
  assert.ok(html.includes('width=256'), '不重写已有属性的格式');
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
