const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ejs = require('ejs');
const yaml = require('js-yaml');
const { JSDOM } = require('jsdom');

const template = readFileSync(path.join(__dirname, '../layout/_partial/waline.ejs'), 'utf8');
const postTemplate = readFileSync(path.join(__dirname, '../layout/post.ejs'), 'utf8');
const theme = yaml.load(readFileSync(path.join(__dirname, '../_config.yml'), 'utf8'));

// 只渲染预览模板，不启动 Hexo 构建或访问真实评论服务。
function render(waline = theme.waline, post = { path: 'post/12e2a8de.html' }) {
  return ejs.render(template, { theme: { waline }, post });
}

// 连同标题里的阅读量一起渲染，避免只测评论 partial 而漏掉首次显示状态。
function renderPost(waline = theme.waline, post = {}) {
  return ejs.render(postTemplate, {
    theme: { waline },
    page: { path: 'post/12e2a8de.html', slug: 'example', title: '测试文章', date: '', content: '', tags: { each() {} }, ...post },
    toc: () => '', date: () => '', wordcount: () => 0, min2read: () => 0,
    partial: (_, { post }) => render(waline, post),
  });
}

// 仅替换模块加载边界，用真实生成的脚本检查 init 参数和失败反馈。
async function execute(html, loadWaline, url = 'http://localhost:4302/preview/post/12e2a8de.html') {
  const dom = new JSDOM(html, { url });
  const script = dom.window.document.querySelector('script[type="module"]').textContent;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const run = new AsyncFunction('document', 'location', 'loadWaline', script.replace(
    "import('https://unpkg.com/@waline/client@v3/dist/waline.js')", 'loadWaline()'
  ));
  await run(dom.window.document, dom.window.location, loadWaline);
  return dom;
}

test('预览沿用文章评论路径与主站设置，且不触发阅读量统计', async () => {
  let options;
  // 故意传入主站的 pageview:true，确认预览仍锁定为 false。
  const dom = await execute(render({ ...theme.waline, pageview: true }), async () => ({ init(value) { options = value; } }));
  assert.equal(options.serverURL, 'https://victor-waline.vercel.app');
  assert.equal(options.path, '/post/12e2a8de.html');
  assert.equal(options.pageview, false);
  assert.equal(options.dark, 'html[data-theme="dark"]');
  assert.equal(options.login, 'enable');
  assert.equal(options.lang, 'zh-CN');
  assert.equal(options.imageUploader, false);
  assert.deepEqual(options.requiredMeta, ['nick']);
  assert.equal(options.locale.placeholder, '写下你的想法…');
  assert.equal(options.locale.sofa, '还没有留言，欢迎第一个参与。');
  assert.equal(dom.window.document.querySelectorAll('#waline').length, 1);
  assert.equal(dom.window.document.querySelector('.waline-pageview-count'), null);
  dom.window.close();
});

test('关闭全站或单篇留言时不输出挂载节点、资源和初始化脚本', () => {
  assert.equal(render({ ...theme.waline, enable: false }).trim(), '');
  assert.equal(render(theme.waline, { path: 'post/12e2a8de.html', no_comments: true }).trim(), '');
  assert.equal(render(null).trim(), '');
});

test('Waline 模块加载失败时显示简短提示，不重复初始化', async () => {
  const dom = await execute(render(), async () => { throw new Error('CDN unavailable'); });
  assert.equal(dom.window.document.querySelector('#waline').textContent, '评论加载失败，请刷新重试。');
  dom.window.close();
});

// 上线后恢复已有的阅读量统计，预览仍使用上面的隔离检查。
test('正式域名启用阅读量统计', async () => {
  let options;
  const dom = await execute(render(), async () => ({ init(value) { options = value; } }), 'https://www.victoryeah.com/post/12e2a8de.html');
  assert.equal(options.pageview, true);
  dom.window.close();
});

test('阅读量首次显示 loading，15 秒无结果才显示占位，成功的 0 和非零读数保留', () => {
  const html = renderPost();
  assert.ok(html.indexOf('setTimeout') >= 0);
  assert.ok(html.indexOf('setTimeout') < html.indexOf('dist/waline.css'), 'CDN 样式阻塞前就开始超时计时');
  for (const value of [null, '0', '58']) {
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const { document } = dom.window;
    const count = document.querySelector('.waline-pageview-count');
    assert.equal(count.dataset.path, '/post/12e2a8de.html');
    assert.equal(count.getAttribute('aria-live'), 'polite');
    assert.ok(count.querySelector('.pageview-loading[role="status"][aria-label="阅读量加载中"]'));
    assert.equal(count.textContent, '');
    let timeout;
    dom.window.setTimeout = (callback, delay) => {
      assert.equal(delay, 15000);
      timeout = callback;
    };
    dom.window.eval(document.querySelector('script:not([type])').textContent);
    assert.ok(count.querySelector('.pageview-loading'), '计时开始后仍保留 loading');
    // Waline 用 textContent 写入读数，成功后会同时移除 spinner。
    if (value !== null) count.textContent = value;
    timeout();
    assert.equal(count.textContent, value === null ? '—' : value);
    dom.window.close();
  }
});

test('关闭评论的文章也保留阅读量超时兜底，全站禁用时不输出计数和计时器', () => {
  assert.match(renderPost(theme.waline, { no_comments: true }), /setTimeout/);
  const disabled = renderPost({ ...theme.waline, enable: false });
  assert.doesNotMatch(disabled, /waline-pageview-count|pageview-loading|setTimeout/);
});
