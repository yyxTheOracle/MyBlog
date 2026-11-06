const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/media-viewer.js'), 'utf8');
const template = readFileSync(require.resolve('../layout/_partial/media-viewer.ejs'), 'utf8');

// 在真实 DOM 上操作弹层，仅替代 jsdom 不提供的窗口尺寸与原生 dialog。
function page(content) {
  const dom = new JSDOM(`<div id="article-content">${content}</div>${template}`, {
    url: 'https://example.com/post/test.html', runScripts: 'outside-only',
  });
  const { window } = dom;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  const blobs = [];
  const revoked = [];
  window.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:diagram'; };
  window.URL.revokeObjectURL = url => revoked.push(url);
  const viewport = window.document.querySelector('.media-viewer-viewport');
  Object.defineProperties(viewport, {
    clientWidth: { value: 832 }, clientHeight: { value: 632 },
    scrollWidth: { get() { return Math.max(832, parseFloat(window.document.querySelector('.media-viewer-canvas img')?.style.width) + 32 || 0); } },
    scrollHeight: { get() { return Math.max(632, parseFloat(window.document.querySelector('.media-viewer-canvas img')?.style.height) + 32 || 0); } },
  });
  window.eval(script);
  return { window, document: window.document, blobs, revoked, close: () => window.close() };
}

test('键盘打开图片、缩放和关闭后回到原焦点，正文媒体大小保持不变', () => {
  const p = page('<img src="/sample.png" width="1600" height="1200" alt="示例截图">');
  const image = p.document.querySelector('#article-content img');
  image.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const viewer = p.document.querySelector('#media-viewer');
  const enlarged = viewer.querySelector('img');
  assert.equal(viewer.open, true);
  assert.equal(enlarged.style.width, '800px');
  p.document.querySelector('[data-media-zoom="in"]').click();
  assert.equal(enlarged.style.width, '1200px');
  p.document.querySelector('[data-media-zoom="fit"]').click();
  assert.equal(enlarged.style.width, '800px');
  assert.equal(image.getAttribute('width'), '1600');
  assert.equal(image.style.width, '');
  let restored;
  image.focus = options => { restored = options.preventScroll; };
  p.document.querySelector('[data-media-close]').click();
  assert.equal(viewer.open, false);
  assert.equal(restored, true);
  assert.equal(p.document.documentElement.classList.contains('media-viewer-open'), false);
  assert.equal(viewer.querySelector('img'), null);
  p.close();
});

test('图表以独立SVG打开并释放资源，尚未绘制的图不打开空弹层', () => {
  const p = page('<pre class="mermaid">未绘制</pre><pre class="mermaid"><svg viewBox="-8 -8 1000 500"><rect id="node" width="10" height="10"/></svg></pre>');
  const diagrams = p.document.querySelectorAll('.mermaid');
  diagrams[0].click();
  assert.equal(p.document.querySelector('#media-viewer').open, false);
  diagrams[1].click();
  assert.equal(p.document.querySelector('#media-viewer').open, true);
  assert.equal(p.document.querySelector('#media-viewer img').src, 'blob:diagram');
  assert.equal(p.document.querySelectorAll('#node').length, 1, '弹层不复制到正文SVG id空间');
  assert.equal(p.blobs[0].type, 'image/svg+xml');
  p.document.querySelector('#media-viewer').close();
  assert.deepEqual(p.revoked, ['blob:diagram']);
  p.close();
});

test('保留图片链接，加载失败时给出可关闭的提示', () => {
  const p = page('<a href="/detail"><img src="/linked.png"></a><img src="/missing.png" width="800" height="600" alt="丢失图片">');
  assert.equal(p.document.querySelector('a img').hasAttribute('role'), false);
  p.document.querySelector('img[alt]').click();
  p.document.querySelector('#media-viewer img').dispatchEvent(new p.window.Event('error'));
  assert.match(p.document.querySelector('.media-viewer-caption').textContent, /无法加载/);
  p.document.querySelector('[data-media-close]').click();
  assert.equal(p.document.querySelector('#media-viewer').open, false);
  p.close();
});

test('独立图表保留正文的暗色节点覆盖样式', async () => {
  const p = page('<style>.mermaid .node>rect { fill:rgb(27, 43, 57); stroke:rgb(132, 195, 239); }</style><pre class="mermaid"><svg viewBox="0 0 800 400"><g class="node"><rect fill="yellow"/></g></svg></pre>');
  p.document.querySelector('.mermaid').click();
  const xml = await new Promise(resolve => {
    const reader = new p.window.FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(p.blobs[0]);
  });
  const shape = new p.window.DOMParser().parseFromString(xml, 'image/svg+xml').querySelector('rect');
  assert.equal(shape.style.fill, 'rgb(27, 43, 57)');
  assert.equal(shape.style.stroke, 'rgb(132, 195, 239)');
  p.close();
});
