const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/site.js'), 'utf8');
const layout = readFileSync(require.resolve('../layout/layout.ejs'), 'utf8');
const theme = layout.match(/<fieldset class="theme-picker">[\s\S]*?<\/fieldset>/)[0];
const hero = ejs.render(readFileSync(require.resolve('../layout/_partial/hero-title.ejs'), 'utf8'));
const search = '<button data-open-search>搜索</button><dialog id="search-dialog"><button data-close-search>关闭</button><input id="site-search"><div id="search-results"></div></dialog>';

// 用浏览器 DOM 执行真实脚本；只模拟系统主题、网络和浏览器权限边界。
function page(body = '', configure = () => {}) {
  const dom = new JSDOM(theme + body, { url: 'https://example.com/post/test.html', runScripts: 'outside-only' });
  const { window } = dom;
  const media = { matches: false, addEventListener: (_, callback) => { media.change = callback; } };
  window.matchMedia = () => media;
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new window.Event('close'));
  };
  configure(window, media);
  window.eval(script);
  return { window, document: window.document, media, close: () => window.close() };
}

// 等待当前 Promise 链完成，不依赖人为延时或真实外部服务。
async function settle() {
  await new Promise(setImmediate);
}

test('主题偏好持久化，system 跟随系统，禁止存储时仍能工作', () => {
  const p = page();
  assert.deepEqual([...p.document.querySelectorAll('input[name="theme-mode"]')].map((input) => input.value), ['light', 'dark', 'system']);
  assert.equal(p.document.querySelector('legend').textContent, '配色模式');
  assert.equal(p.document.querySelectorAll('.theme-option svg[aria-hidden="true"]').length, 3);
  assert.equal(p.document.documentElement.dataset.theme, 'light');
  assert.equal(p.document.querySelector('input[name="theme-mode"]:checked').value, 'system');
  p.media.matches = true;
  p.media.change();
  assert.equal(p.document.documentElement.dataset.theme, 'dark');
  p.document.querySelector('input[value="light"]').click();
  assert.equal(p.window.localStorage.getItem('victor-theme'), 'light');
  p.media.change();
  assert.equal(p.document.documentElement.dataset.theme, 'light');
  p.document.querySelector('input[value="system"]').click();
  assert.equal(p.document.documentElement.dataset.theme, 'dark');
  assert.equal(p.window.localStorage.getItem('victor-theme'), 'system');
  assert.equal(p.document.querySelectorAll('script[src*="mermaid"]').length, 0);
  p.close();
  const blocked = page('', (window) => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
  });
  assert.equal(blocked.document.documentElement.dataset.theme, 'light');
  blocked.close();
  const saved = page('', (window) => window.localStorage.setItem('victor-theme', 'dark'));
  assert.equal(saved.document.documentElement.dataset.theme, 'dark');
  assert.equal(saved.document.querySelector('input[name="theme-mode"]:checked').value, 'dark');
  saved.close();
});

test('标题按 1200ms 停留和 400ms 翻转轮换，离屏/后台/减少动态效果时停用计时器', () => {
  const timers = new Map();
  let timerId = 0;
  let observe;
  let hidden = false;
  const reducedMotion = { matches: false, addEventListener: (_, callback) => { reducedMotion.change = callback; } };
  const p = page(hero, (window, media) => {
    window.matchMedia = (query) => query.includes('reduced-motion') ? reducedMotion : media;
    Object.defineProperty(window.document, 'hidden', { get: () => hidden });
    window.setTimeout = (callback, delay) => {
      timers.set(++timerId, { callback, delay });
      return timerId;
    };
    window.clearTimeout = (id) => timers.delete(id);
    window.IntersectionObserver = class {
      constructor(callback) { observe = callback; }
      observe() {}
    };
  });
  const word = p.document.querySelector('#hero-word');
  const current = word.querySelector('.hero-word-current');
  const stableTitle = p.document.querySelector('#home-title .sr-only');

  // 手动推进唯一计时器，校验节奏而不等待真实时间。
  function advance(delay) {
    assert.equal(timers.size, 1);
    const [id, timer] = [...timers][0];
    assert.equal(timer.delay, delay);
    timers.delete(id);
    timer.callback();
  }

  assert.equal(timers.size, 0, '尚未进入视口时不计时');
  assert.equal(current.textContent, '生活');
  assert.ok(word.closest('[aria-hidden="true"]'));
  observe([{ isIntersecting: true }]);
  for (const expected of ['想法', '日常', '生活']) {
    advance(1200);
    assert.ok(word.classList.contains('is-flipping'));
    assert.equal(word.querySelector('.hero-word-next').textContent, expected);
    advance(400);
    assert.equal(current.textContent, expected);
    assert.equal(word.classList.contains('is-flipping'), false);
    assert.equal(stableTitle.textContent, '写代码，也记录生活。');
  }
  observe([{ isIntersecting: false }]);
  assert.equal(timers.size, 0);
  observe([{ isIntersecting: true }]);
  hidden = true;
  p.document.dispatchEvent(new p.window.Event('visibilitychange'));
  assert.equal(timers.size, 0);
  hidden = false;
  p.document.dispatchEvent(new p.window.Event('visibilitychange'));
  advance(1200);
  reducedMotion.matches = true;
  reducedMotion.change();
  assert.equal(timers.size, 0, '翻转中开启减少动态效果也应取消提交计时器');
  assert.equal(word.classList.contains('is-flipping'), false);
  assert.equal(current.textContent, '生活');
  reducedMotion.matches = false;
  reducedMotion.change();
  assert.equal([...timers.values()][0].delay, 1200);
  observe([{ isIntersecting: false }]);
  p.document.dispatchEvent(new p.window.Event('visibilitychange'));
  assert.equal(timers.size, 0, '页面回到前台但标题仍离屏时不恢复动画');
  p.close();
});

test('搜索正文与章节、保留锚点，并转义 HTML 和正则特殊字符', async () => {
  let fetches = 0;
  const p = page(search, (window) => {
    window.fetch = async () => {
      fetches++;
      return { ok: true, json: async () => [
        { title: 'C++ 与前端', heading: '线程池', text: 'Worker pool 实践 <img src=x onerror=alert(1)>', url: '/post/a.html#线程池' },
        { title: 'C++ 不安全链接', heading: '', text: 'worker', url: 'javascript:alert(1)' },
        { title: 'C++ 站外链接', heading: '', text: 'worker', url: 'https://other.example/' },
      ] };
    };
  });
  const trigger = p.document.querySelector('[data-open-search]');
  trigger.click();
  const input = p.document.querySelector('#site-search');
  input.value = 'C++ WORKER';
  input.dispatchEvent(new p.window.Event('input'));
  await settle();
  const result = p.document.querySelector('#search-results');
  assert.equal(result.querySelectorAll('a').length, 1);
  assert.equal(result.querySelector('a').getAttribute('href'), '/post/a.html#线程池');
  assert.equal(result.querySelectorAll('img').length, 0);
  assert.ok(result.textContent.includes('<img src=x onerror=alert(1)>'));
  assert.deepEqual([...result.querySelectorAll('mark')].map((mark) => mark.textContent), ['C++', 'Worker']);
  input.value = '线程池';
  input.dispatchEvent(new p.window.Event('input'));
  await settle();
  assert.ok(result.textContent.includes('找到 1 处'));
  assert.equal(fetches, 1);
  p.document.querySelector('[data-close-search]').click();
  assert.equal(p.document.activeElement, trigger);
  p.document.dispatchEvent(new p.window.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
  assert.equal(p.document.querySelector('dialog').open, true);
  await settle();
  result.querySelector('a').addEventListener('click', (event) => event.preventDefault());
  result.querySelector('a').click();
  assert.equal(p.document.querySelector('dialog').open, false);
  p.close();
});

test('较慢查询不会覆盖新输入，加载失败后可以重试', async () => {
  let resolveFetch;
  const p = page(search, (window) => {
    window.fetch = () => new Promise((resolve) => { resolveFetch = resolve; });
  });
  const input = p.document.querySelector('#site-search');
  input.value = '旧查询';
  input.dispatchEvent(new p.window.Event('input'));
  input.value = '';
  input.dispatchEvent(new p.window.Event('input'));
  resolveFetch({ ok: false });
  await settle();
  assert.ok(p.document.querySelector('#search-results').textContent.startsWith('输入关键词'));
  p.window.fetch = async () => ({ ok: true, json: async () => [] });
  input.value = '新查询';
  input.dispatchEvent(new p.window.Event('input'));
  await settle();
  assert.ok(p.document.querySelector('#search-results').textContent.includes('没有找到'));
  p.close();
});

test('复制保留换行和缩进、排除行号，长代码可折叠并报告权限失败', async () => {
  const lines = Array.from({ length: 17 }, (_, index) => `<span class="line">  line ${index + 1}</span><br>`).join('');
  let copied;
  const p = page(`<article id="article-content"><figure class="highlight js"><table><tr><td class="gutter">123</td><td class="code"><pre>${lines}</pre></td></tr></table></figure></article>`, (window) => {
    window.navigator.clipboard = { writeText: async (text) => { copied = text; } };
  });
  const figure = p.document.querySelector('figure');
  const toggle = p.document.querySelector('.code-toggle');
  assert.ok(figure.classList.contains('is-collapsed'));
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.ok(!figure.classList.contains('is-collapsed'));
  const copy = p.document.querySelector('.code-copy');
  copy.click();
  await settle();
  assert.equal(copied, Array.from({ length: 17 }, (_, index) => `  line ${index + 1}`).join('\n'));
  assert.equal(copy.textContent, '已复制');
  p.window.navigator.clipboard.writeText = async () => { throw new Error('permission denied'); };
  copy.click();
  await settle();
  assert.ok(copy.textContent.includes('复制失败'));
  assert.equal(copy.disabled, false);
  p.close();
});

test('桌面与手机目录同步高亮，点击手机目录会收起', () => {
  let observe;
  const p = page('<a class="toc-link" href="#第二节">桌面目录</a><details class="mobile-toc" open><a class="toc-link" href="#第二节">手机目录</a></details><article id="article-content"><h2 id="第一节">一</h2><h2 id="第二节">二</h2></article>', (window) => {
    window.IntersectionObserver = class {
      constructor(callback) { observe = callback; }
      observe() {}
    };
    window.document.querySelector('#第一节').getBoundingClientRect = () => ({ top: -200 });
    window.document.querySelector('#第二节').getBoundingClientRect = () => ({ top: 100 });
  });
  observe();
  assert.equal(p.document.querySelectorAll('[aria-current="location"]').length, 2);
  p.document.querySelector('details a').click();
  assert.equal(p.document.querySelector('details').open, false);
  p.close();
});

test('Mermaid 切换主题时丢弃过期渲染，保留原始图表源', async () => {
  let releaseFirst;
  let renders = 0;
  const themes = [];
  const sources = [];
  const p = page('<pre class="mermaid">graph LR\nA[第一行<br/>第二行] --> B</pre>', (window) => {
    window.mermaid = {
      initialize: (config) => { themes.push(config.theme); },
      render: async (id, source) => {
        sources.push(source);
        renders++;
        if (renders === 1) await new Promise((resolve) => { releaseFirst = resolve; });
        return { svg: `<svg data-render="${id}"></svg>` };
      },
    };
  });
  await settle();
  p.document.querySelector('input[value="dark"]').click();
  releaseFirst();
  await settle();
  assert.deepEqual(themes, ['default', 'dark']);
  assert.equal(p.document.querySelector('.mermaid svg').dataset.render, 'diagram-2-0');
  assert.equal(sources[0], sources[1]);
  assert.ok(sources[0].includes('<br/>'));
  p.close();
});

test('初始 hash 等绘图与布局帧完成后仅校准一次', async () => {
  const frames = [];
  const scrolls = [];
  let finishDiagram;
  const p = page('<article id="article-content"><pre class="mermaid">graph LR; A --> B</pre><h2 id="常见问题">FAQ</h2></article>', (window) => {
    window.history.replaceState(null, '', '#常见问题');
    window.requestAnimationFrame = (callback) => frames.push(callback);
    window.document.querySelector('h2').scrollIntoView = (options) => scrolls.push(options);
    window.mermaid = {
      initialize() {},
      render: () => new Promise((resolve) => { finishDiagram = () => resolve({ svg: '<svg></svg>' }); }),
    };
  });
  await settle();
  assert.equal(frames.length, 0);
  assert.equal(scrolls.length, 0);
  finishDiagram();
  await settle();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(scrolls.length, 0);
  frames.shift()();
  assert.equal(scrolls.length, 1);
  assert.equal(scrolls[0].behavior, 'instant');
  assert.equal(scrolls[0].block, 'start');
  p.window.dispatchEvent(new p.window.Event('load'));
  await settle();
  assert.equal(scrolls.length, 1);
  p.close();
});

test('读者已操作或 hash 已改变时，不抢回初始章节位置', async () => {
  for (const interaction of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'hashchange', 'changed-hash']) {
    const frames = [];
    let scrolls = 0;
    const p = page('<article id="article-content"><pre class="mermaid">graph LR; A --> B</pre><h2 id="faq">FAQ</h2></article>', (window) => {
      window.history.replaceState(null, '', '#faq');
      window.requestAnimationFrame = (callback) => frames.push(callback);
      window.document.querySelector('h2').scrollIntoView = () => scrolls++;
      window.mermaid = { initialize() {}, render: async () => ({ svg: '<svg></svg>' }) };
    });
    await settle();
    if (interaction === 'changed-hash') p.window.history.replaceState(null, '', '#another-section');
    else p.window.dispatchEvent(new p.window.Event(interaction));
    while (frames.length) frames.shift()();
    assert.equal(scrolls, 0, interaction);
    p.close();
  }
});

test('留言深链接也在正文绘图后校准，页脚锚点不受影响', async () => {
  for (const target of ['article-comments-title', 'footer']) {
    const frames = [];
    let scrolls = 0;
    const p = page('<article class="reading-article"><div id="article-content"><pre class="mermaid">graph LR; A --> B</pre></div><h2 id="article-comments-title">留言</h2></article><footer id="footer">页脚</footer>', (window) => {
      window.history.replaceState(null, '', `#${target}`);
      window.requestAnimationFrame = (callback) => frames.push(callback);
      window.document.getElementById(target).scrollIntoView = () => scrolls++;
      window.mermaid = { initialize() {}, render: async () => ({ svg: '<svg></svg>' }) };
    });
    await settle();
    while (frames.length) frames.shift()();
    assert.equal(scrolls, target === 'article-comments-title' ? 1 : 0);
    p.close();
  }
});
