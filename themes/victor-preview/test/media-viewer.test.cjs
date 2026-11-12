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

// jsdom 不加载图像，模拟浏览器已经选中并加载了正文适配图。
function loadedImage(image, currentSrc = image.src) {
  Object.defineProperties(image, {
    currentSrc: { value: currentSrc },
    complete: { value: true },
    naturalWidth: { value: image.width || 800 },
  });
}

// 由测试决定原图何时解码完成，模拟慢网和图床失败。
function deferImageDecodes(window) {
  const decodes = [];
  window.HTMLImageElement.prototype.decode = function () {
    return new Promise((resolve, reject) => decodes.push({ image: this, resolve, reject }));
  };
  return decodes;
}

test('键盘打开图片、双击或按 Z 缩放和关闭后回到原焦点，正文媒体大小保持不变', () => {
  const p = page('<img src="/sample.png" width="1600" height="1200" alt="示例截图">');
  const image = p.document.querySelector('#article-content img');
  image.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const viewer = p.document.querySelector('#media-viewer');
  const viewport = viewer.querySelector('.media-viewer-viewport');
  const frame = viewer.querySelector('.media-viewer-frame');
  const enlarged = viewer.querySelector('img');
  assert.equal(viewer.open, true);
  assert.equal(p.document.activeElement, viewport, '开屏不强行聚焦关闭按钮');
  assert.equal(enlarged.style.width, '800px');
  frame.dispatchEvent(new p.window.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  assert.equal(enlarged.style.width, '1600px');
  viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
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

test('图表以独立SVG打开并垫干净底板、释放资源，尚未绘制的图不打开空弹层', () => {
  const p = page('<pre class="mermaid">未绘制</pre><pre class="mermaid"><svg viewBox="-8 -8 1000 500"><rect id="node" width="10" height="10"/></svg></pre>');
  const diagrams = p.document.querySelectorAll('.mermaid');
  diagrams[0].click();
  assert.equal(p.document.querySelector('#media-viewer').open, false);
  diagrams[1].click();
  assert.equal(p.document.querySelector('#media-viewer').open, true);
  assert.equal(p.document.querySelector('.media-viewer-frame').classList.contains('is-diagram'), true);
  assert.equal(p.document.querySelector('#media-viewer img').src, 'blob:diagram');
  assert.equal(p.document.querySelectorAll('#node').length, 1, '弹层不复制到正文SVG id空间');
  assert.equal(p.blobs[0].type, 'image/svg+xml');
  p.document.querySelector('#media-viewer').close();
  assert.equal(p.document.querySelector('.media-viewer-frame').classList.contains('is-diagram'), false);
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

test('整篇图库按正文顺序跨图组切换，默认显示胶片条并支持点击跳转，保持最初触发焦点', () => {
  const p = page('<a href="/linked"><img src="/linked.png"></a><pre><code><img src="/example.png"></code></pre><img src="/one-preview.webp" data-original-src="/one.png" data-original-width="1600" data-original-height="1200" alt="第一张"><div class="article-gallery"><figure class="article-image"><img src="/two.png" width="800" height="600" alt="第二张"><figcaption>图 1：审批状态</figcaption></figure><figure class="article-image"><img src="/three.gif" width="400" height="800" alt="第三张"><figcaption>图 2：演示动画</figcaption></figure></div>');
  deferImageDecodes(p.window);
  const origin = p.document.querySelector('img[alt="第一张"]');
  loadedImage(origin);
  let restored;
  origin.focus = options => { restored = options.preventScroll; };
  origin.click();
  const counter = p.document.querySelector('.media-viewer-counter');
  const previous = p.document.querySelector('[data-media-step="-1"]');
  const next = p.document.querySelector('[data-media-step="1"]');
  const filmstrip = p.document.querySelector('.media-viewer-filmstrip');
  const thumbs = filmstrip.querySelectorAll('.media-viewer-thumb');
  assert.equal(counter.textContent, '01 / 03', '链接、代码与图组缩略图均不加入图库');
  assert.equal(filmstrip.hidden, false);
  assert.equal(p.document.querySelector('[data-media-strip-toggle]'), null);
  assert.equal(thumbs.length, 3);
  assert.equal(thumbs[0].getAttribute('aria-current'), 'true');
  assert.equal(p.document.querySelector('#media-viewer img').src, origin.src);
  assert.equal(previous.disabled, true);
  next.click();
  assert.equal(counter.textContent, '02 / 03');
  assert.equal(p.document.querySelector('.media-viewer-caption').textContent, '图 1：审批状态');
  thumbs[2].click();
  assert.equal(counter.textContent, '03 / 03');
  assert.equal(p.document.querySelector('.media-viewer-viewport').dataset.fitted, 'true');
  assert.equal(p.document.querySelector('#media-viewer img').getAttribute('src'), 'https://example.com/three.gif');
  assert.equal(next.disabled, true);
  next.click();
  assert.equal(counter.textContent, '03 / 03');
  p.document.querySelector('[data-media-close]').click();
  assert.equal(restored, true);
  p.close();
});

test('图组切换只重置阅读区，保留选图焦点且不滚动整页', () => {
  const p = page('<div class="article-gallery"><figure class="article-image"><img src="/first.png" width="800" height="600" alt="第一步"></figure><figure class="article-image"><img src="/second.gif" width="400" height="800" alt="第二步"></figure></div><img src="/outside.png" alt="普通连续图片">');
  const figures = p.document.querySelectorAll('.article-gallery figure');
  const buttons = p.document.querySelectorAll('.article-gallery-thumbnail');
  const readers = p.document.querySelectorAll('.article-gallery-scroll');
  assert.equal(readers.length, 2);
  assert.equal(readers[1].tabIndex, 0, '阅读区支持键盘滚动');
  assert.equal(figures[0].hidden, false);
  assert.equal(figures[1].hidden, true);
  assert.equal(buttons.length, 2);
  assert.equal(buttons[1].querySelector('img').getAttribute('src'), 'https://example.com/second.gif');
  assert.match(buttons[1].textContent, /图 2：第二步/);
  let scroll;
  figures[1].scrollIntoView = options => { scroll = options; };
  readers[1].scrollTop = 240;
  buttons[1].focus();
  buttons[1].click();
  assert.equal(figures[0].hidden, true);
  assert.equal(figures[1].hidden, false);
  assert.equal(buttons[0].getAttribute('aria-pressed'), 'false');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true');
  assert.equal(scroll, undefined, '切图不触发整页滚动');
  assert.equal(readers[1].scrollTop, 0, '从新图顶部开始阅读');
  assert.equal(p.document.activeElement, buttons[1], '可继续使用键盘选择图片');
  assert.match(p.document.querySelector('.article-gallery-status').textContent, /2 \/ 2/);
  assert.equal(p.document.querySelector('img[alt="普通连续图片"]').hidden, false);
  p.close();
});

test('图组阅读区保留 picture、链接和图注，单图不套阅读器', () => {
  const p = page('<div class="article-gallery" aria-label="操作截图"><figure class="article-image"><a href="/detail"><picture><source srcset="/wide.webp"><img src="/first.png" alt="链接图"></picture></a><figcaption>原始图注</figcaption></figure><figure class="article-image"><img src="/second.png" alt="第二张"></figure></div><div class="article-gallery"><figure class="article-image"><img src="/single.png" alt="单图"></figure></div>');
  const groups = p.document.querySelectorAll('.article-gallery');
  assert.equal(groups[0].querySelector('.article-gallery-scroll a picture source').getAttribute('srcset'), '/wide.webp');
  assert.equal(groups[0].querySelector('.article-gallery-scroll a').getAttribute('href'), '/detail');
  assert.equal(groups[0].querySelector('a img').hasAttribute('role'), false);
  assert.equal(groups[0].querySelector('figcaption').parentElement.tagName, 'FIGURE');
  assert.equal(groups[0].querySelector('figcaption').textContent, '原始图注');
  assert.equal(groups[0].querySelector('.article-gallery-heading strong').textContent, '操作截图');
  assert.equal(groups[1].querySelector('.article-gallery-scroll'), null);
  assert.equal(groups[1].querySelector('figure').hidden, false);
  p.close();
});

test('方向键在适应窗口时切图，放大后只平移，图表不串入整篇图片', () => {
  const p = page('<img src="/one.png" width="1600" height="1200"><img src="/two.png" width="1600" height="1200"><pre class="mermaid"><svg viewBox="0 0 1000 500"></svg></pre>');
  const viewer = p.document.querySelector('#media-viewer');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  const press = key => viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  p.document.querySelector('#article-content img').click();
  press('ArrowRight');
  assert.equal(p.document.querySelector('.media-viewer-counter').textContent, '02 / 02');
  press('z');
  const left = viewport.scrollLeft;
  press('ArrowLeft');
  assert.equal(p.document.querySelector('.media-viewer-counter').textContent, '02 / 02');
  assert.equal(viewport.scrollLeft, left - 80);
  press('z');
  press('ArrowLeft');
  assert.equal(p.document.querySelector('.media-viewer-counter').textContent, '01 / 02');
  viewer.close();
  p.document.querySelector('.mermaid').click();
  press('ArrowRight');
  assert.equal(viewer.querySelector('img').src, 'blob:diagram');
  assert.equal(p.document.querySelector('[data-media-step="-1"]').hidden, true);
  assert.equal(p.document.querySelector('.media-viewer-filmstrip').hidden, true);
  assert.equal(p.document.querySelector('.media-viewer-counter').hidden, true);
  p.close();
});

test('超长图默认按宽度顶部对齐阅读，可切换适应全貌与继续放大，换图重置视口', () => {
  const p = page('<img src="/long-preview.webp" width="400" height="4000" data-original-src="/long.png" data-original-width="1000" data-original-height="10000"><img src="/next.png" width="1600" height="1200">');
  const viewer = p.document.querySelector('#media-viewer');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  p.document.querySelector('#article-content img').click();
  const enlarged = p.document.querySelector('#media-viewer img');
  assert.equal(enlarged.style.width, '800px');
  assert.equal(enlarged.style.height, '8000px');
  assert.equal(viewport.dataset.alignTop, 'true');
  viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  assert.equal(enlarged.style.width, '60px');
  viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  assert.equal(enlarged.style.width, '800px');
  const wheelZoom = new p.window.WheelEvent('wheel', { deltaY: -120, ctrlKey: true, bubbles: true, cancelable: true });
  viewport.dispatchEvent(wheelZoom);
  assert.ok(parseFloat(enlarged.style.width) > 800);
  viewport.scrollTop = 4000;
  p.document.querySelector('[data-media-step="1"]').click();
  assert.equal(viewport.scrollTop, 0);
  assert.equal(p.document.querySelector('#media-viewer img').style.width, '800px');
  enlarged.dispatchEvent(new p.window.Event('error'));
  assert.doesNotMatch(p.document.querySelector('.media-viewer-caption').textContent, /无法加载/, '已切走图片的错误不能覆盖当前说明');
  p.close();
});

test('单指横滑仅在无横向溢出时切图，竖滑、双指与放大后手势不切图', () => {
  const p = page('<img src="/one.png" width="1600" height="1200"><img src="/two.png" width="1600" height="1200">');
  const viewer = p.document.querySelector('#media-viewer');
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
  assert.equal(counter.textContent, '02 / 02');
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 170, 300);
  assert.equal(counter.textContent, '02 / 02');
  pointer('pointerdown', 100, 100);
  pointer('pointerdown', 200, 100, false);
  pointer('pointerup', 200, 100);
  assert.equal(counter.textContent, '02 / 02');
  viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 200, 100);
  assert.equal(counter.textContent, '02 / 02');
  viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  pointer('pointerdown', 100, 100);
  pointer('pointerup', 200, 100);
  assert.equal(counter.textContent, '01 / 02');
  p.close();
});

test('行内图片优先使用独立图注，单张图片隐藏侧边切图与胶片条', () => {
  const p = page('<p>正文<img src="/inline.png" width="800" height="600" alt="按钮的界面截图" data-caption="点击提交后出现确认提示"></p>');
  p.document.querySelector('#article-content img').click();
  assert.equal(p.document.querySelector('.media-viewer-caption').textContent, '点击提交后出现确认提示');
  assert.equal(p.document.querySelector('[data-media-step="-1"]').hidden, true);
  assert.equal(p.document.querySelector('[data-media-step="1"]').hidden, true);
  assert.equal(p.document.querySelector('.media-viewer-filmstrip').hidden, true);
  assert.equal(p.document.querySelector('.media-viewer-counter').hidden, true);
  p.close();
});

test('点击画布留白处关闭，放大拖拽松手不误关', () => {
  const p = page('<img src="/sample.png" width="1600" height="1200" alt="示例截图">');
  const viewer = p.document.querySelector('#media-viewer');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  p.document.querySelector('#article-content img').click();
  viewer.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'z', bubbles: true, cancelable: true }));
  const down = new p.window.Event('pointerdown', { bubbles: true });
  Object.assign(down, { pointerType: 'mouse', button: 0, clientX: 200, clientY: 200 });
  viewport.dispatchEvent(down);
  const move = new p.window.Event('pointermove', { bubbles: true });
  Object.assign(move, { pointerType: 'mouse', clientX: 120, clientY: 200 });
  viewport.dispatchEvent(move);
  const up = new p.window.Event('pointerup', { bubbles: true });
  Object.assign(up, { pointerType: 'mouse', clientX: 120, clientY: 200 });
  viewport.dispatchEvent(up);
  viewport.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
  assert.equal(viewer.open, true, '拖拽后的 click 不能误关预览');
  viewport.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true }));
  assert.equal(viewer.open, false);
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

test('动画大图复用本地完整动画资源', () => {
  const p = page('<img src="/assets/animation.gif" data-original-src="https://images.example/remote.gif" data-media-animated="true" width="400" height="300" alt="动画演示">');
  p.document.querySelector('#article-content img').click();
  assert.equal(p.document.querySelector('#media-viewer img').src, 'https://example.com/assets/animation.gif');
  p.close();
});

test('静态图立即显示正文已加载的适配图，原图解码后保留缩放和长图阅读位置', async (t) => {
  const p = page('<img src="/photo-760.webp" width="760" height="3040" data-original-src="https://images.example/original.png" data-original-width="1600" data-original-height="6400" alt="操作长图">');
  t.after(p.close);
  const decodes = deferImageDecodes(p.window);
  const origin = p.document.querySelector('#article-content img');
  const viewport = p.document.querySelector('.media-viewer-viewport');
  loadedImage(origin, 'https://example.com/photo-480.webp');
  origin.click();
  const preview = viewport.querySelector('img');
  assert.equal(preview.src, 'https://example.com/photo-480.webp');
  assert.equal(decodes[0].image.src, 'https://images.example/original.png');
  viewport.dispatchEvent(new p.window.WheelEvent('wheel', { deltaY: -120, ctrlKey: true, cancelable: true }));
  const zoomedWidth = preview.style.width;
  viewport.scrollTop = 1600;
  decodes[0].resolve();
  await new Promise(setImmediate);
  const original = viewport.querySelector('img');
  assert.equal(original.src, 'https://images.example/original.png');
  assert.equal(original.alt, '操作长图');
  assert.equal(original.style.width, zoomedWidth);
  assert.equal(viewport.scrollTop, 1600);
  assert.equal(p.document.activeElement, viewport);
});

test('图床原件的宽高比变化时按实际比例显示', async (t) => {
  const p = page('<img src="/preview.webp" width="800" height="600" data-original-src="/original.png">');
  t.after(p.close);
  const decodes = deferImageDecodes(p.window);
  const body = p.document.querySelector('#article-content img');
  loadedImage(body);
  body.click();
  Object.defineProperties(decodes[0].image, {
    naturalWidth: { value: 600 }, naturalHeight: { value: 800 },
  });
  decodes[0].resolve();
  await new Promise(setImmediate);
  const original = p.document.querySelector('#media-viewer img');
  assert.equal(parseFloat(original.style.width) / parseFloat(original.style.height), 600 / 800);
});

test('原图失败保留适配图，切走再返回时忽略上一次解码结果', async (t) => {
  const p = page('<img src="/preview.webp" data-original-src="https://images.example/original.png" alt="第一张"><img src="/next-preview.webp" data-original-src="/next.png" alt="第二张">');
  t.after(p.close);
  const decodes = deferImageDecodes(p.window);
  const origin = p.document.querySelector('#article-content img');
  const frame = p.document.querySelector('.media-viewer-frame');
  loadedImage(origin);
  origin.click();
  assert.equal(frame.querySelector('img').src, origin.src);
  decodes[0].reject(new Error('图床无法访问'));
  await new Promise(setImmediate);
  assert.equal(frame.querySelector('img').src, origin.src);
  assert.equal(p.document.querySelector('.media-viewer-caption').textContent, '第一张');

  p.document.querySelector('#media-viewer').close();
  origin.click();
  p.document.querySelector('[data-media-step="1"]').click();
  assert.equal(frame.querySelector('img').src, 'https://example.com/next.png', '正文未加载的图片直接取原图');
  p.document.querySelector('[data-media-step="-1"]').click();
  decodes[1].resolve();
  await new Promise(setImmediate);
  assert.equal(frame.querySelector('img').src, origin.src);
  assert.equal(p.document.querySelector('.media-viewer-caption').textContent, '第一张');
});
