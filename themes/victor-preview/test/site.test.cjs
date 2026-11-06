const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/site.js'), 'utf8');
const layout = readFileSync(require.resolve('../layout/layout.ejs'), 'utf8');
const postTemplate = readFileSync(require.resolve('../layout/post.ejs'), 'utf8');
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

// 渲染真实文章入口，避免测试 fixture 与按钮模板各自变化后仍误通过。
function renderPost(overrides = {}, tocContent = '') {
  return ejs.render(postTemplate, {
    page: {
      slug: 'reading-test', title: '测试文章', path: 'post/reading-test.html',
      content: '<p>正文内容</p>', tags: { each() {} }, ...overrides,
    },
    theme: {}, toc: () => tocContent, partial: () => '',
    date: () => '2026.11.05', min2read: () => 3, wordcount: () => 800, url_for: value => value,
  });
}

test('回顶入口独立于文章目录，保留可见文字，首页不输出入口', () => {
  const toc = '<ol class="toc"><li><a class="toc-link" href="#section">章节</a></li></ol>';
  for (const [options, contents] of [[{}, toc], [{}, ''], [{ no_toc: true }, toc]]) {
    const dom = new JSDOM(renderPost(options, contents));
    const buttons = dom.window.document.querySelectorAll('.back-top');
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].tagName, 'BUTTON');
    assert.equal(buttons[0].type, 'button');
    assert.equal(buttons[0].closest('.desktop-toc, .mobile-toc'), null);
    assert.equal(buttons[0].textContent.trim(), '回到顶部');
    assert.ok(buttons[0].querySelector('.back-top-icon'));
    dom.window.close();
  }
  const body = ejs.render(readFileSync(require.resolve('../layout/index.ejs'), 'utf8'), {
    page: { current: 1 }, site: { posts: { sort: () => ({ toArray: () => [] }) } }, partial: () => '',
  });
  const dom = new JSDOM(ejs.render(layout, {
    body, page: { path: '' }, config: { title: '博客', description: '博客介绍' },
    is_home: () => true, is_post: () => false, is_archive: () => false,
    is_category: () => false, is_tag: () => false, open_graph: () => '', date: () => '2026',
  }));
  assert.equal(dom.window.document.querySelector('.back-top'), null);
  dom.window.close();
});

test('回顶始终保留，滚动时进度只计正文并限制在 0% 到 100%', () => {
  let articleTop = 300;
  const p = page(renderPost(), (window) => {
    window.innerHeight = 800;
    window.document.querySelector('#article-content').getBoundingClientRect = () => ({
      top: articleTop, height: 2400, bottom: articleTop + 2400,
    });
  });
  const button = p.document.querySelector('.back-top');
  assert.equal(button.style.getPropertyValue('--reading-progress'), '0%');

  // 使用可见正文位置作为事实，页面标题与评论区的长度不能影响阅读进度。
  for (const [top, expected] of [[100, '0%'], [-800, '50%'], [-1600, '100%'], [-3000, '100%']]) {
    articleTop = top;
    p.window.dispatchEvent(new p.window.Event('scroll'));
    assert.equal(button.style.getPropertyValue('--reading-progress'), expected);
  }
  p.window.scrollY = 0;
  articleTop = 300;
  p.window.dispatchEvent(new p.window.Event('scroll'));
  assert.equal(button.style.getPropertyValue('--reading-progress'), '0%');
  p.close();
});

test('窗口和正文尺寸变化刷新进度，短文仅在全文进入视口后完成', () => {
  let rect = { top: -800, height: 2400, bottom: 1600 };
  let resized;
  const observed = [];
  const p = page(renderPost(), (window) => {
    window.scrollY = 900;
    window.innerHeight = 800;
    window.document.querySelector('#article-content').getBoundingClientRect = () => rect;
    window.ResizeObserver = class {
      constructor(callback) { resized = callback; }
      observe(element) { observed.push(element); }
    };
  });
  const button = p.document.querySelector('.back-top');
  assert.equal(button.style.getPropertyValue('--reading-progress'), '50%');
  assert.ok(observed.includes(p.document.querySelector('#article-content')));
  p.window.innerHeight = 1600;
  p.window.dispatchEvent(new p.window.Event('resize'));
  assert.equal(button.style.getPropertyValue('--reading-progress'), '100%');
  p.window.innerHeight = 800;
  rect = { top: -800, height: 4000, bottom: 3200 };
  resized();
  assert.equal(button.style.getPropertyValue('--reading-progress'), '25%', '图片加载撑高正文后更新圆环');
  for (const [bottom, expected] of [[900, '0%'], [800, '100%'], [-100, '100%']]) {
    rect = { top: bottom - 500, height: 500, bottom };
    resized();
    assert.equal(button.style.getPropertyValue('--reading-progress'), expected);
  }
  p.close();
});

test('回顶到页面起点，并尊重减少动态效果设置', () => {
  const scrolls = [];
  const reducedMotion = { matches: false };
  const p = page(renderPost(), (window, media) => {
    window.matchMedia = query => query.includes('reduced-motion') ? reducedMotion : media;
    window.scrollTo = options => scrolls.push({ top: options.top, behavior: options.behavior });
  });
  p.document.querySelector('.back-top').click();
  reducedMotion.matches = true;
  p.document.querySelector('.back-top').click();
  assert.deepEqual(scrolls, [{ top: 0, behavior: 'smooth' }, { top: 0, behavior: 'instant' }]);
  p.close();
});

test('没有回顶入口时不注册相关滚动监听或尺寸观察', () => {
  for (const body of ['', '<div id="article-content">普通页面正文</div>']) {
    const events = [];
    let observers = 0;
    const p = page(body, (window) => {
      const listen = window.addEventListener.bind(window);
      window.addEventListener = (type, ...args) => { events.push(type); listen(type, ...args); };
      window.ResizeObserver = class { constructor() { observers++; } observe() {} };
    });
    assert.equal(events.includes('scroll'), false);
    assert.equal(events.includes('resize'), false);
    assert.equal(observers, 0);
    p.close();
  }
});

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
  const timers = new Map();
  let timerId = 0;
  const p = page(`<article id="article-content"><figure class="highlight js"><table><tr><td class="gutter">123</td><td class="code"><pre>${lines}</pre></td></tr></table></figure></article>`, (window) => {
    window.navigator.clipboard = { writeText: async (text) => { copied = text; } };
    window.setTimeout = (callback) => { timers.set(++timerId, callback); return timerId; };
    window.clearTimeout = id => timers.delete(id);
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
  assert.equal(timers.size, 1, '重复操作取消旧反馈计时，不能提前清掉新提示');
  [...timers.values()][0]();
  assert.equal(copy.textContent, '复制代码');
  p.close();
});

test('收起长代码只在开头已离屏时回到代码块，保留键盘滚动入口', () => {
  const lines = Array.from({ length: 60 }, () => 'const value = 1;').join('<br>');
  const p = page(`<article id="article-content"><figure class="highlight js"><table><tr><td class="code"><pre>${lines}</pre></td></tr></table></figure></article>`);
  const figure = p.document.querySelector('figure');
  const toggle = p.document.querySelector('.code-toggle');
  const scrolls = [];
  let top = 40;
  figure.getBoundingClientRect = () => ({ top });
  figure.scrollIntoView = options => scrolls.push({ behavior: options.behavior, block: options.block });
  assert.equal(p.document.querySelector('.code-content').tabIndex, 0);
  toggle.click();
  toggle.click();
  assert.equal(scrolls.length, 0, '代码块开头仍在屏幕内时不额外滚动');
  toggle.click();
  top = -900;
  toggle.click();
  assert.deepEqual(scrolls, [{ behavior: 'instant', block: 'start' }]);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  p.close();
});

test('桌面与手机目录同步高亮，滚动落点跨过判定线时无需新的交叉事件', () => {
  const frames = [];
  let secondTop = 140;
  const p = page('<a class="toc-link" href="#第二节">桌面目录</a><details class="mobile-toc" open><a class="toc-link" href="#第二节">手机目录</a></details><article id="article-content"><h2 id="第一节">一</h2><h2 id="第二节">二</h2></article>', (window) => {
    window.requestAnimationFrame = callback => frames.push(callback);
    window.document.querySelector('#第一节').getBoundingClientRect = () => ({ top: -200 });
    window.document.querySelector('#第二节').getBoundingClientRect = () => ({ top: secondTop });
  });
  assert.equal(p.document.querySelectorAll('[aria-current="location"]').length, 0);
  secondTop = 76;
  p.window.dispatchEvent(new p.window.Event('scroll'));
  p.window.dispatchEvent(new p.window.Event('scroll'));
  assert.equal(frames.length, 1, '同一帧的滚动事件只计算一次');
  frames.shift()();
  assert.equal(p.document.querySelectorAll('[aria-current="location"]').length, 2);
  p.document.querySelector('details a').click();
  assert.equal(p.document.querySelector('details').open, false);
  p.close();
});

test('当前目录项越界时只移动目录自身，已经可见时保持不动', () => {
  const frames = [];
  let secondTop = 140;
  const p = page('<aside class="desktop-toc"><a class="toc-link" href="#one">一</a><a class="toc-link" href="#two">二</a></aside><article id="article-content"><h2 id="one">一</h2><h2 id="two">二</h2></article>', (window) => {
    window.requestAnimationFrame = callback => frames.push(callback);
    window.scrollTo = () => assert.fail('目录跟随不应滚动正文');
    window.HTMLElement.prototype.scrollIntoView = () => assert.fail('不能通过 scrollIntoView 拉动正文');
    window.document.querySelector('#one').getBoundingClientRect = () => ({ top: -100 });
    window.document.querySelector('#two').getBoundingClientRect = () => ({ top: secondTop });
    window.document.querySelector('aside').getBoundingClientRect = () => ({ top: 32, bottom: 500, height: 468 });
    window.document.querySelector('[href="#one"]').getBoundingClientRect = () => ({ top: 90, bottom: 120 });
    window.document.querySelector('[href="#two"]').getBoundingClientRect = () => ({ top: 540, bottom: 570 });
  });
  const toc = p.document.querySelector('aside');
  assert.equal(toc.scrollTop, 0);
  secondTop = 76;
  p.window.dispatchEvent(new p.window.Event('scroll'));
  frames.shift()();
  assert.equal(toc.scrollTop, 78);
  p.window.dispatchEvent(new p.window.Event('scroll'));
  frames.shift()();
  assert.equal(toc.scrollTop, 78, '同一章节不重复拉动目录');
  p.close();
});

test('手机目录复用原有列表，关闭和选章保留背景位置并返回触发入口', () => {
  const toc = '<ol class="toc"><li><a class="toc-link" href="#section">章节</a></li></ol>';
  const p = page(renderPost({ content: '<h2 id="section">章节</h2>' }, toc), (window) => {
    window.requestAnimationFrame = () => {};
    window.scrollTo = () => assert.fail('打开或关闭目录不应滚动正文');
    window.scrollY = 1600;
  });
  const dialog = p.document.querySelector('#mobile-toc-dialog');
  const trigger = p.document.querySelector('.mobile-toc-trigger');
  const summary = p.document.querySelector('.mobile-toc summary');
  assert.equal(p.document.querySelector('.mobile-toc nav'), null);
  assert.equal(p.document.querySelectorAll('.toc-link').length, 2, '只有桌面和手机各一份列表');
  trigger.click();
  assert.equal(dialog.open, true);
  assert.ok(p.document.documentElement.classList.contains('toc-open'));
  p.document.querySelector('[data-close-toc]').click();
  assert.equal(dialog.open, false);
  assert.equal(p.document.activeElement, trigger);
  assert.ok(!p.document.documentElement.classList.contains('toc-open'));
  assert.equal(p.window.scrollY, 1600);
  summary.click();
  assert.equal(dialog.open, true);
  assert.equal(summary.parentElement.open, false);
  dialog.querySelector('a').click();
  assert.equal(dialog.open, false);
  assert.equal(p.document.activeElement, summary);
  p.close();
});

test('无目录文章不输出入口，缺少原生弹层支持时保留页首 details', () => {
  const toc = '<ol class="toc"><li><a class="toc-link" href="#section">章节</a></li></ol>';
  for (const [options, contents] of [[{}, ''], [{ no_toc: true }, toc]]) {
    const p = page(renderPost(options, contents));
    assert.equal(p.document.querySelector('.mobile-toc-trigger'), null);
    assert.equal(p.document.querySelector('#mobile-toc-dialog'), null);
    p.close();
  }
  const p = page(renderPost({}, toc), (window) => {
    window.HTMLDialogElement.prototype.showModal = undefined;
  });
  assert.ok(p.document.querySelector('.mobile-toc nav'));
  assert.ok(!p.document.documentElement.classList.contains('mobile-toc-ready'));
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

// 模拟导航换行后的实际高度，确认锚点偏移随布局更新。
test('吸顶导航将初始高度和换行后的高度同步到滚动偏移', () => {
  let resizeHeader;
  let height = 91;
  const p = page('<header class="site-header"></header>', (window) => {
    window.document.querySelector('.site-header').getBoundingClientRect = () => ({ height });
    window.ResizeObserver = class {
      constructor(callback) { resizeHeader = callback; }
      observe() {}
    };
  });
  assert.equal(p.document.documentElement.style.getPropertyValue('--header-height'), '91px');
  height = 160;
  resizeHeader();
  assert.equal(p.document.documentElement.style.getPropertyValue('--header-height'), '160px');
  p.close();
});
