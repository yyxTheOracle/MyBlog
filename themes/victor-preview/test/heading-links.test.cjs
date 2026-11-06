const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/site.js'), 'utf8');
const article = `<article id="article-content">
  <h2 id="章节"><a class="headerlink" href="#章节" title="章节"></a>章节</h2>
  <h3 id="next"><a class="headerlink" href="#next" title="Next"></a>Next</h3>
</article>`;

// 执行真实脚本，只替换剪贴板权限与计时边界，避免等待真实提示时长。
function page({ writeText, hash = '', reducedMotion = false } = {}) {
  const dom = new JSDOM(article, { url: `https://example.com/post/test.html${hash}`, runScripts: 'outside-only' });
  const { window } = dom;
  const timers = new Map();
  let timerId = 0;
  let now = 0;
  window.matchMedia = (query) => ({ matches: query.includes('reduced-motion') && reducedMotion, addEventListener() {} });
  window.setTimeout = (callback, delay) => { timers.set(++timerId, { callback, delay, due: now + delay }); return timerId; };
  window.clearTimeout = (id) => timers.delete(id);
  if (writeText) window.navigator.clipboard = { writeText };
  window.eval(script);
  return {
    window, document: window.document, timers, close: () => window.close(),
    // 推进相对时间，让多次复制的提示按真实先后顺序到期。
    advance(ms) {
      now += ms;
      for (const [id, timer] of timers) {
        if (timer.due > now) continue;
        timers.delete(id);
        timer.callback();
      }
    },
  };
}

// Promise 完成后再断言剪贴板反馈，不依赖操作系统剪贴板。
async function settle() {
  await new Promise(setImmediate);
}

test('章节复制保留原始 hash，反馈结束后恢复入口且不滚动页面', async () => {
  const copied = [];
  const p = page({ writeText: async text => copied.push(text) });
  const link = p.document.querySelector('.headerlink');
  const originalHref = link.getAttribute('href');
  link.click();
  await settle();
  assert.deepEqual(copied, ['https://example.com/post/test.html#%E7%AB%A0%E8%8A%82']);
  assert.equal(link.getAttribute('href'), originalHref);
  assert.equal(link.getAttribute('aria-label'), '复制章节链接：章节');
  assert.equal(p.window.location.hash, '');
  assert.equal(link.dataset.feedback, '本节链接已复制');
  assert.equal(p.document.querySelector('[role="status"]').textContent, '本节链接已复制');
  p.advance(3000);
  assert.equal(link.hasAttribute('data-feedback'), false);
  assert.equal(p.document.querySelector('[role="status"]').textContent, '');
  p.close();
});

test('快速复制不同章节时，旧入口到期不清除最新读屏反馈', async () => {
  const p = page({ writeText: async () => {} });
  const [first, next] = p.document.querySelectorAll('.headerlink');
  const status = p.document.querySelector('[role="status"]');
  first.click();
  await settle();
  p.advance(1500);
  next.click();
  await settle();
  p.advance(1500);
  assert.equal(first.hasAttribute('data-feedback'), false);
  assert.equal(next.dataset.feedback, '本节链接已复制');
  assert.equal(status.textContent, '本节链接已复制', '首个提示到期后仍保留最近一次操作的读屏反馈');
  p.advance(1500);
  assert.equal(next.hasAttribute('data-feedback'), false);
  assert.equal(status.textContent, '');
  p.close();
});

test('修饰键保留原生链接行为，不拦截新标签打开或调用剪贴板', () => {
  let copies = 0;
  const p = page({ writeText: async () => copies++ });
  const link = p.document.querySelector('.headerlink');
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    const event = new p.window.MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true });
    link.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  assert.equal(copies, 0);
  p.close();
});

test('剪贴板拒绝时更新章节地址，提示手动复制而不报告成功', async () => {
  const p = page({ writeText: async () => { throw new Error('denied'); } });
  const link = p.document.querySelector('.headerlink');
  link.click();
  await settle();
  assert.equal(decodeURIComponent(p.window.location.hash), '#章节');
  assert.equal(link.dataset.feedback, '复制失败，请从地址栏复制');
  p.close();
});

test('没有 Clipboard API 时保留锚点默认动作和手动复制提示', () => {
  const p = page();
  const link = p.document.querySelector('.headerlink');
  const event = new p.window.MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(link.dataset.feedback, '请从地址栏复制本节链接');
  p.close();
});

test('初始与后续 hash 只短暂提示对应标题，减少动态效果下也不调用滚动', () => {
  const p = page({ hash: '#%E7%AB%A0%E8%8A%82', reducedMotion: true });
  const first = p.document.getElementById('章节');
  const next = p.document.getElementById('next');
  assert.equal(first.classList.contains('is-chapter-target'), true);
  p.window.history.replaceState(null, '', '#next');
  p.window.dispatchEvent(new p.window.HashChangeEvent('hashchange'));
  assert.equal(first.classList.contains('is-chapter-target'), false);
  assert.equal(next.classList.contains('is-chapter-target'), true);
  assert.equal(p.timers.size, 1, '新的目标取消旧提示计时器');
  [...p.timers.values()][0].callback();
  assert.equal(next.classList.contains('is-chapter-target'), false);
  p.window.history.replaceState(null, '', '#missing');
  p.window.dispatchEvent(new p.window.HashChangeEvent('hashchange'));
  assert.equal(p.document.querySelector('.is-chapter-target'), null);
  p.close();
});
