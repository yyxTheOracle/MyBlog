const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

// JSDOM 不执行布局与真实输入模式，只模拟浏览器返回的几何和伪类状态。
function page(kind) {
  const dom = new JSDOM(`<div class="${kind}-list"><div class="${kind}-marker"></div><a class="${kind}-row" data-browse-row href="/a">甲</a><a class="${kind}-row" data-browse-row href="/b">乙</a></div>`, { runScripts: 'outside-only' });
  const { window } = dom;
  const document = window.document;
  const list = document.querySelector('div');
  const rows = [...document.querySelectorAll('a')];
  const state = { hover: null, keyboard: false, height: 80, top: 100 };
  const nativeMatches = window.Element.prototype.matches;
  window.Element.prototype.matches = function (selector) {
    if (selector === ':hover') return state.hover === this;
    if (selector === ':focus-visible') return state.keyboard && document.activeElement === this;
    return nativeMatches.call(this, selector);
  };
  let resized;
  window.ResizeObserver = class { constructor(callback) { resized = callback; } observe() {} };
  document.fonts = { ready: Promise.resolve() };
  rows.forEach((row, index) => {
    Object.defineProperty(row, 'offsetTop', { get: () => index * state.top });
    Object.defineProperty(row, 'offsetHeight', { get: () => state.height });
  });
  window.eval(readFileSync(require.resolve('../source/js/article-list.js'), 'utf8'));
  return {
    window, document, rows, list, state, resize: () => resized(), close: () => window.close(),
    pointer(row, type, pointerType = 'mouse') {
      state.hover = type === 'pointerenter' && pointerType !== 'touch' ? row : null;
      const event = new window.Event(type);
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      row.dispatchEvent(event);
    },
  };
}

test('两种文章列表默认不高亮，鼠标离开和普通点击焦点不会留下 hover', async () => {
  for (const kind of ['cursor', 'browse']) {
    const p = page(kind);
    assert.equal(p.document.querySelector('.is-active'), null);
    p.pointer(p.rows[1], 'pointerenter');
    assert.equal(p.document.querySelector('.is-active'), p.rows[1]);
    assert.equal(p.list.style.getPropertyValue('--marker-y'), '100px');
    assert.equal(p.list.style.getPropertyValue('--marker-height'), '80px');
    p.rows[1].focus();
    p.pointer(p.rows[1], 'pointerleave');
    assert.equal(p.document.activeElement, p.rows[1]);
    assert.equal(p.document.querySelector('.is-active'), null);
    assert.equal(p.list.style.getPropertyValue('--marker-opacity'), '0');
    p.resize();
    await Promise.resolve();
    assert.equal(p.document.querySelector('.is-active'), null, '字体或布局更新不能恢复已离开的高亮');
    p.rows[0].focus();
    assert.equal(p.document.querySelector('.is-active'), null, '普通脚本或鼠标 focus 不等于键盘焦点');
    p.close();
  }
});

test('键盘焦点在鼠标离开后恢复，尺寸变化重新对齐；触屏不模拟 hover', async () => {
  for (const kind of ['cursor', 'browse']) {
    const p = page(kind);
    p.pointer(p.rows[1], 'pointerenter', 'touch');
    assert.equal(p.document.querySelector('.is-active'), null);
    p.state.keyboard = true;
    p.rows[0].focus();
    assert.equal(p.document.querySelector('.is-active'), p.rows[0]);
    p.pointer(p.rows[1], 'pointerenter');
    p.state.height = 130;
    p.state.top = 160;
    p.resize();
    assert.equal(p.list.style.getPropertyValue('--marker-y'), '160px');
    assert.equal(p.list.style.getPropertyValue('--marker-height'), '130px');
    p.pointer(p.rows[1], 'pointerleave');
    assert.equal(p.document.querySelector('.is-active'), p.rows[0]);
    p.rows[0].blur();
    assert.equal(p.document.querySelector('.is-active'), null);
    await Promise.resolve();
    assert.equal(p.list.style.getPropertyValue('--marker-opacity'), '0');
    p.close();
  }
});
