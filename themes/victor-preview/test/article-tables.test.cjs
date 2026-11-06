const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/site.js'), 'utf8');

// 只模拟浏览器布局宽度；执行真实脚本验证提示、焦点和表格内容的保留。
function page({ width = 320, observe = true } = {}) {
  const dom = new JSDOM('<article id="article-content"><table id="data"><caption>IPC 通信</caption><tr><th>方向</th><th>API</th></tr><tr><td>Renderer → Main</td><td><code>ipcRenderer.invoke</code></td></tr></table><figure><table id="nested"><tr><td>嵌套表格</td></tr></table></figure></article>', {
    url: 'https://example.com/post/test.html', runScripts: 'outside-only',
  });
  const { window } = dom;
  const observers = [];
  window.matchMedia = () => ({ matches: false, addEventListener() {} });
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return width; } });
  Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', { get() { return 600; } });
  if (observe) window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
  };
  const table = window.document.querySelector('#data');
  window.eval(script);
  return { window, table, observers, setWidth(value) { width = value; }, close() { window.close(); } };
}

test('仅增强正文直接表格，溢出时提示并允许键盘聚焦，放宽视口后撤掉提示', () => {
  const p = page();
  const { document } = p.window;
  const scroll = document.querySelector('.article-table-scroll');
  const hint = document.querySelector('.article-table-hint');
  assert.equal(scroll.firstElementChild, p.table, '不重建表格，保留内容与语义');
  assert.equal(document.querySelectorAll('.article-table-scroll').length, 1);
  assert.equal(document.querySelector('#nested').parentElement.tagName, 'FIGURE');
  assert.equal(hint.hidden, false);
  assert.equal(scroll.tabIndex, 0);
  assert.equal(scroll.getAttribute('aria-label'), 'IPC 通信');
  assert.equal(scroll.getAttribute('aria-describedby'), hint.id);
  const observer = p.observers.find(item => item.targets.includes(scroll));
  assert.ok(observer.targets.includes(p.table), '字体改变表格宽度时也重新判断');

  p.setWidth(800);
  observer.callback();
  assert.equal(hint.hidden, true);
  assert.equal(scroll.hasAttribute('tabindex'), false);
  assert.equal(scroll.hasAttribute('aria-describedby'), false);
  assert.equal(scroll.hasAttribute('role'), false);
  p.close();
});

test('不支持 ResizeObserver 时，窗口变窄仍更新提示和焦点', () => {
  const p = page({ width: 800, observe: false });
  const scroll = p.window.document.querySelector('.article-table-scroll');
  const hint = p.window.document.querySelector('.article-table-hint');
  assert.equal(hint.hidden, true);
  p.setWidth(320);
  p.window.dispatchEvent(new p.window.Event('resize'));
  assert.equal(hint.hidden, false);
  assert.equal(scroll.tabIndex, 0);
  p.close();
});
