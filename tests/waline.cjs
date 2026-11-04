const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const themePath = path.join(root, 'themes/new-yilia');
const theme = yaml.load(fs.readFileSync(path.join(themePath, '_config.yml'), 'utf8'));
const template = (name) => fs.readFileSync(path.join(themePath, 'layout/_partial', `${name}.ejs`), 'utf8');

// 渲染真实文章模板，只省略与 Waline 无关的 partial，检查开关组合是否重复计数。
function renderArticle({ index = false, noComments = false, waline = {} } = {}) {
  const locals = {
    theme: { ...theme, waline: { ...theme.waline, ...waline } },
    post: { title: '测试文章', path: 'post/example.html', content: '', no_comments: noComments },
    config: {},
    index,
    date: () => '',
    date_xml: () => '',
    url_for: (value) => value,
  };
  locals.partial = (name, values) => ['post/date', 'post/waline'].includes(name)
    ? ejs.render(template(name), { ...locals, ...values })
    : '';
  return ejs.render(template('article'), locals);
}

const article = renderArticle();
assert.equal((article.match(/\binit\(\{/g) || []).length, 1);
assert.match(article, /<div id="waline"><\/div>/);
assert.match(article, /type="module"/);
assert.match(article, /@waline\/client@v3\/dist\/waline\.js/);
assert.match(article, /waline-pageview-count" data-path="\/post\/example\.html" aria-live="polite"><i class="fa fa-spinner fa-spin" role="status" aria-label="阅读量加载中"><\/i><\/span>/);
assert.ok(article.indexOf('setTimeout') < article.indexOf('dist/waline.css'), 'CDN 样式加载受阻时也能开始超时计时');

// 在隔离 DOM 中推进超时，验证失败结束加载，同时不覆盖已成功的 0 或非零读数。
function checkPageviewTimeout(value) {
  let callback;
  const count = {
    textContent: value,
    querySelector: () => count.textContent === '' ? {} : null,
  };
  const watchdog = article.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(watchdog, {
    document: { querySelector: () => count },
    setTimeout: (fn, delay) => {
      assert.equal(delay, 15000);
      callback = fn;
    },
  });
  assert.equal(count.textContent, value, '请求完成前保留原来的加载状态');
  callback();
  assert.equal(count.textContent, value === '' ? '—' : value);
}

for (const value of ['', '0', '58']) checkPageviewTimeout(value);

for (const options of [{ noComments: true }, { waline: { enable: false } }]) {
  const pageviewOnly = renderArticle(options);
  assert.equal((pageviewOnly.match(/\binit\(\{/g) || []).length, 1);
  assert.match(pageviewOnly, /el: null/);
  assert.match(pageviewOnly, /pageview: true/);
  assert.doesNotMatch(pageviewOnly, /<div id="waline">/);
}

for (const options of [{ index: true }, { waline: { server_url: '' } }, { waline: { enable: false, pageview: false } }]) {
  const disabled = renderArticle(options);
  assert.doesNotMatch(disabled, /@waline\/client|waline-pageview-count/);
}

const commentsOnly = renderArticle({ waline: { pageview: false } });
assert.match(commentsOnly, /<div id="waline">/);
assert.match(commentsOnly, /pageview: false/);
assert.doesNotMatch(commentsOnly, /waline-pageview-count/);
assert.doesNotMatch(commentsOnly, /setTimeout/);
console.log('Waline template checks passed.');
