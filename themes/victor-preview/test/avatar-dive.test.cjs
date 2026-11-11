const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/avatar-dive.js'), 'utf8');

// JSDOM 只补素材解码、视口坐标和动画调度；真实触屏与返航观感由浏览器检查。
function page({ reduced = false, failedAsset = '' } = {}) {
  const dom = new JSDOM(`<header class="site-header"></header>
    <figure data-avatar-dive data-diver-src="/img/avatar-diver-v1.webp">
      <button data-avatar-dive-trigger disabled><img data-avatar-photo src="/img/avatar.jpg" style="border:7px solid black"><img data-avatar-seabed src="/img/avatar-seabed-v1.webp"></button>
    </figure>`, { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const document = window.document;
  const figure = document.querySelector('figure');
  const trigger = document.querySelector('button');
  const photo = document.querySelector('[data-avatar-photo]');
  const frames = new Map();
  const animations = new Set();
  const scrollTo = [];
  let now = 0;
  let frameId = 0;
  let hidden = false;
  let captured;
  const media = new window.EventTarget();
  media.matches = reduced;
  window.matchMedia = () => media;
  window.innerWidth = 1200;
  window.innerHeight = 800;
  window.performance.now = () => now;
  window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  window.cancelAnimationFrame = id => frames.delete(id);
  window.scrollBy = ({ top }) => { window.scrollY = Math.max(0, window.scrollY + top); };
  window.scrollTo = options => scrollTo.push(options);
  Object.defineProperty(document, 'hidden', { get: () => hidden });
  Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', { get: () => 871 });
  window.HTMLImageElement.prototype.decode = function () {
    return failedAsset && this.src.includes(failedAsset) ? Promise.reject(new Error('图片解码失败')) : Promise.resolve();
  };
  Object.defineProperties(photo, { offsetWidth: { value: 244 }, offsetHeight: { value: 260 } });
  photo.getBoundingClientRect = () => ({ left: 650, top: 180 - window.scrollY, width: 244, height: 260 });
  document.querySelector('header').getBoundingClientRect = () => ({ bottom: 80 });
  trigger.setPointerCapture = id => { captured = id; };
  trigger.hasPointerCapture = id => captured === id;
  trigger.releasePointerCapture = () => { captured = undefined; };
  window.Element.prototype.animate = function () {
    const animation = { onfinish: null, cancel() { animations.delete(animation); }, finish() { animations.delete(animation); animation.onfinish?.(); } };
    animations.add(animation);
    return animation;
  };
  window.eval(script);
  return {
    window, document, figure, trigger, photo, frames, animations, scrollTo,
    settle: () => new Promise(setImmediate),
    tick(milliseconds = 16.67) {
      now += milliseconds;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(callback => callback(now));
    },
    pointer(type, x = 772, y = 310) {
      const event = new window.Event(type);
      Object.assign(event, { button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y });
      trigger.dispatchEvent(event);
    },
    hidden(value) { hidden = value; document.dispatchEvent(new window.Event('visibilitychange')); },
    close: () => window.close(),
  };
}

test('两层素材解码完成才开放交互，任意一层失败都保留静态原照', async t => {
  for (const failedAsset of ['', 'avatar-diver', 'avatar-seabed']) {
    const p = page({ failedAsset });
    t.after(p.close);
    assert.equal(p.trigger.disabled, true);
    assert.equal(p.document.querySelector('.avatar-dive-float'), null);
    await p.settle();
    assert.equal(p.trigger.disabled, Boolean(failedAsset));
    assert.equal(p.figure.classList.contains('is-ready'), !failedAsset);
    if (failedAsset) {
      p.pointer('pointerdown');
      assert.equal(p.figure.classList.contains('is-diving'), false);
      assert.equal(p.frames.size, 0);
      assert.equal(p.document.querySelector('.avatar-dive-float'), null);
      assert.equal(p.photo.getAttribute('src'), '/img/avatar.jpg');
    }
  }
});

test('取消、Escape、切后台和窗口失焦立即停止滚页与气泡，恢复原照', async t => {
  const cancel = [
    p => p.pointer('pointercancel'),
    p => p.document.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'Escape' })),
    p => p.hidden(true),
    p => p.window.dispatchEvent(new p.window.Event('blur')),
  ];
  for (const stop of cancel) {
    const p = page();
    t.after(p.close);
    await p.settle();
    p.pointer('pointerdown');
    p.pointer('pointermove', 300, 780);
    p.tick();
    assert.equal(p.figure.classList.contains('is-diving'), true);
    assert.ok(p.window.scrollY > 0, '实际拖到下边缘后才开始滚页');
    assert.ok(p.animations.size > 0, '先确认气泡已出现，再检查中断清理');
    stop(p);
    const stoppedAt = p.window.scrollY;
    p.tick(1000);
    assert.equal(p.frames.size, 0);
    assert.equal(p.animations.size, 0);
    assert.equal(p.window.scrollY, stoppedAt);
    assert.equal(p.figure.classList.contains('is-diving'), false);
    assert.equal(p.document.querySelector('.avatar-dive-float').hidden, true);
    assert.equal(p.document.querySelector('.avatar-dive-bubbles').children.length, 0);
    assert.deepEqual(p.scrollTo, []);
  }
});

test('拖动取消后的键盘点击仍能触发示范，不被上次手势吞掉', async t => {
  const p = page();
  t.after(p.close);
  await p.settle();
  p.pointer('pointerdown');
  p.pointer('pointercancel');
  p.trigger.dispatchEvent(new p.window.MouseEvent('click', { detail: 0 }));
  assert.equal(p.figure.classList.contains('is-diving'), true);
  assert.equal(p.frames.size, 1);
});

test('松手保留读者的滚动位置，返航跟踪相框最新位置', async t => {
  const p = page();
  t.after(p.close);
  await p.settle();
  p.pointer('pointerdown');
  p.tick();
  assert.equal(p.window.scrollY, 0, '仅按住不移动不会自动滚页');
  p.pointer('pointermove', 300, 780);
  p.tick();
  p.pointer('pointerup');
  // 返航中继续阅读，终点必须跟随新的 scrollY，而非释放瞬间的旧位置。
  p.window.scrollY = 260;
  p.tick(700);
  const diver = p.document.querySelector('.avatar-dive-float');
  const finalY = Number(diver.style.transform.match(/translate3d\([^,]+,\s*([-\d.]+)px/)[1]);
  const rect = p.photo.getBoundingClientRect();
  assert.ok(Math.abs(finalY - (rect.top + rect.height / 2)) < 0.001);
  assert.equal(diver.hidden, true);
  assert.equal(p.window.scrollY, 260);
  assert.deepEqual(p.scrollTo, []);
  assert.equal(p.frames.size, 0);
});

test('减少动态效果时拖动不持续冒泡，键盘示范仅保留一次透明度反馈', async t => {
  const p = page({ reduced: true });
  t.after(p.close);
  await p.settle();
  p.pointer('pointerdown');
  p.pointer('pointermove', 300, 600);
  for (let i = 0; i < 8; i++) p.tick(200);
  assert.equal(p.animations.size, 0);
  assert.equal(p.document.querySelector('.avatar-dive-bubbles').children.length, 0);
  p.pointer('pointerup');
  assert.equal(p.frames.size, 0);
  p.trigger.dispatchEvent(new p.window.MouseEvent('click', { detail: 0 }));
  assert.equal(p.animations.size, 1);
  assert.equal(p.frames.size, 0, '键盘示范不启动自动飞行');
  [...p.animations][0].finish();
  assert.equal(p.figure.classList.contains('is-diving'), false);
  assert.equal(p.animations.size, 0);
});
