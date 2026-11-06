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

test('整篇图库按正文顺序跨图组切换，首尾停止并保持最初触发焦点', () => {
  const p = page('<a href="/linked"><img src="/linked.png"></a><pre><code><img src="/example.png"></code></pre><img src="/one-preview.webp" data-original-src="/one.png" data-original-width="1600" data-original-height="1200" alt="第一张"><div class="article-gallery"><figure class="article-image"><img src="/two.png" width="800" height="600" alt="第二张"><figcaption>图 1：审批状态</figcaption></figure><figure class="article-image"><img src="/three.gif" width="400" height="800" alt="第三张"><figcaption>图 2：演示动画</figcaption></figure></div>');
  const origin = p.document.querySelector('img[alt="第一张"]');
  let restored;
  origin.focus = options => { restored = options.preventScroll; };
  origin.click();
  const counter = p.document.querySelector('.media-viewer-counter');
  const previous = p.document.querySelector('[data-media-step="-1"]');
  const next = p.document.querySelector('[data-media-step="1"]');
  assert.equal(counter.textContent, '1 / 3', '链接、代码与缩略图均不加入图库');
  assert.equal(p.document.querySelector('#media-viewer img').getAttribute('src'), '/one.png');
  assert.equal(previous.disabled, true);
  next.click();
  assert.equal(counter.textContent, '2 / 3');
  assert.match(p.document.querySelector('.media-viewer-caption').textContent, /图 1：审批状态/);
  p.document.querySelector('[data-media-zoom="in"]').click();
  next.click();
  assert.equal(counter.textContent, '3 / 3');
  assert.equal(p.document.querySelector('.media-viewer-viewport').dataset.fitted, 'true');
  assert.equal(p.document.querySelector('#media-viewer img').getAttribute('src'), 'https://example.com/three.gif');
  assert.equal(next.disabled, true);
  next.click();
  assert.equal(counter.textContent, '3 / 3');
  p.document.querySelector('[data-media-close]').click();
  assert.equal(restored, true);
  p.close();
});

test('显式图组只显示选中主图，缩略图保留动画与编号并把新主图顶部带入视口', () => {
  const p = page('<div class="article-gallery"><figure class="article-image"><img src="/first.png" width="800" height="600" alt="第一步"></figure><figure class="article-image"><img src="/second.gif" width="400" height="800" alt="第二步"></figure></div><img src="/outside.png" alt="普通连续图片">');
  const figures = p.document.querySelectorAll('.article-gallery figure');
  const buttons = p.document.querySelectorAll('.article-gallery-thumbnail');
  assert.equal(figures[0].hidden, false);
  assert.equal(figures[1].hidden, true);
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].querySelector('img').getAttribute('src'), 'https://example.com/second.gif');
  assert.match(buttons[1].textContent, /图 2：第二步/);
  let scroll;
  figures[1].scrollIntoView = options => { scroll = options; };
  buttons[1].click();
  assert.equal(figures[0].hidden, true);
  assert.equal(figures[1].hidden, false);
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(scroll.block, 'start');
  assert.equal(p.document.activeElement, figures[1].querySelector('img'), '切换后焦点跟随可见主图，键盘可以继续打开大图');
  assert.equal(p.document.querySelector('img[alt="普通连续图片"]').hidden, false);
  p.close();
});

test('方向键在适应窗口时切图，放大后只平移，图表不串入整篇图片', () => {
  const p = page('<img src="/one.png" width="1600" height="1200"><img src="/two.png" width="1600" height="1200"><pre class="mermaid"><svg viewBox="0 0 1000 500"></svg></pre>');
  const viewer = p.document.querySelector('#media-viewer');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  const press = key => viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  p.document.querySelector('#article-content img').click();
  press('ArrowRight');
  assert.equal(p.document.querySelector('.media-viewer-counter').textContent, '2 / 2');
  p.document.querySelector('[data-media-zoom="in"]').click();
  const left = viewport.scrollLeft;
  press('ArrowLeft');
  assert.equal(p.document.querySelector('.media-viewer-counter').textContent, '2 / 2');
  assert.equal(viewport.scrollLeft, left - 80);
  p.document.querySelector('[data-media-zoom="fit"]').click();
  press('ArrowLeft');
  assert.equal(p.document.querySelector('.media-viewer-counter').textContent, '1 / 2');
  viewer.close();
  p.document.querySelector('.mermaid').click();
  press('ArrowRight');
  assert.equal(viewer.querySelector('img').src, 'blob:diagram');
  assert.equal(p.document.querySelector('.media-viewer-navigation').hidden, true);
  p.close();
});

test('长图可按宽度阅读并继续放到原始像素，换图重置视口与缩放', () => {
  const p = page('<img src="/long-preview.webp" width="400" height="4000" data-original-src="/long.png" data-original-width="1000" data-original-height="10000"><img src="/next.png" width="1600" height="1200">');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  p.document.querySelector('#article-content img').click();
  const enlarged = p.document.querySelector('#media-viewer img');
  assert.equal(enlarged.style.width, '60px');
  p.document.querySelector('[data-media-zoom="width"]').click();
  assert.equal(enlarged.style.width, '800px');
  assert.equal(enlarged.style.height, '8000px');
  p.document.querySelector('[data-media-zoom="in"]').click();
  assert.ok(Math.abs(parseFloat(enlarged.style.width) - 1000) < 0.001);
  assert.equal(p.document.querySelector('[data-media-zoom="in"]').disabled, true);
  viewport.scrollTop = 4000;
  p.document.querySelector('[data-media-step="1"]').click();
  assert.equal(viewport.scrollTop, 0);
  assert.equal(p.document.querySelector('#media-viewer img').style.width, '800px');
  enlarged.dispatchEvent(new p.window.Event('error'));
  assert.doesNotMatch(p.document.querySelector('.media-viewer-caption').textContent, /无法加载/, '已切走图片的错误不能覆盖当前说明');
  p.close();
});

test('单指横滑仅在适应窗口切图，竖滑、双指与放大后手势不切图', () => {
  const p = page('<img src="/one.png" width="1600" height="1200"><img src="/two.png" width="1600" height="1200">');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  const counter = p.document.querySelector('.media-viewer-counter');
  const pointer = (type, x, y, primary = true) => {
    const event = new p.window.Event(type, { bubbles: true });
    Object.assign(event, { pointerType: 'touch', isPrimary: primary, clientX: x, clientY: y });
    viewport.dispatchEvent(event);
  };
  p.document.querySelector('#article-content img').click();
  pointer('pointerdown', 200, 100);
  pointer('pointerup', 120, 110);
  assert.equal(counter.textContent, '2 / 2');
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 170, 300);
  assert.equal(counter.textContent, '2 / 2');
  pointer('pointerdown', 100, 100);
  pointer('pointerdown', 200, 100, false);
  pointer('pointerup', 200, 100);
  assert.equal(counter.textContent, '2 / 2');
  p.document.querySelector('[data-media-zoom="in"]').click();
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 200, 100);
  assert.equal(counter.textContent, '2 / 2');
  p.document.querySelector('[data-media-zoom="fit"]').click();
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 200, 100);
  assert.equal(counter.textContent, '1 / 2');
  p.close();
});

test('行内图片优先使用独立图注，单张图片不展示无效切图导航', () => {
  const p = page('<p>正文<img src="/inline.png" width="800" height="600" alt="按钮的界面截图" data-caption="点击提交后出现确认提示"></p>');
  p.document.querySelector('#article-content img').click();
  assert.match(p.document.querySelector('.media-viewer-caption').textContent, /点击提交后出现确认提示/);
  assert.equal(p.document.querySelector('.media-viewer-navigation').hidden, true);
  p.close();
});

test('不支持原生弹层时保留图组全部原图和图注', () => {
  const dom = new JSDOM(`<div id="article-content"><div class="article-gallery"><figure class="article-image"><img src="/a.png"><figcaption>第一张</figcaption></figure><figure class="article-image"><img src="/b.png"><figcaption>第二张</figcaption></figure></div></div>${template}`, { runScripts: 'outside-only' });
  dom.window.HTMLDialogElement.prototype.showModal = undefined;
  dom.window.eval(script);
  assert.equal(dom.window.document.querySelectorAll('.article-gallery figure:not([hidden])').length, 2);
  assert.equal(dom.window.document.querySelectorAll('.article-gallery-thumbnail').length, 0);
  dom.window.close();
});

test('动画大图复用本地完整动画资源，静态图仍读取原件', () => {
  const p = page('<img src="/assets/animation.gif" data-original-src="https://images.example/remote.gif" data-media-animated="true" width="400" height="300" alt="动画演示"><img src="/assets/photo.webp" data-original-src="https://images.example/original.png" width="800" height="600" alt="静态截图">');
  p.document.querySelector('#article-content img').click();
  assert.equal(p.document.querySelector('#media-viewer img').src, 'https://example.com/assets/animation.gif');
  p.document.querySelector('[data-media-step="1"]').click();
  assert.equal(p.document.querySelector('#media-viewer img').src, 'https://images.example/original.png');
  p.close();
});
