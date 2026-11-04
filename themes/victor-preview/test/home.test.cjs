const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');
const { stripHTML, truncate } = require('hexo-util');

test('精选摘要去掉小标题，保留正文里的“背景”和行内技术词', () => {
  const post = {
    abbrlink: '12e2a8de', title: 'Worker Pool', path: 'post/12e2a8de.html',
    excerpt: '<h1 id="背景"><a class="headerlink"></a>背景</h1>' +
      '<p>背景任务用 <code>Channel</code> 传递数据。</p><h2>前言</h2><p>这是原文。</p>',
    content: '', tags: { toArray: () => [] },
  };
  const html = ejs.render(readFileSync(require.resolve('../layout/index.ejs'), 'utf8'), {
    page: { current: 1 }, site: { posts: { sort: () => ({ toArray: () => [post] }) } },
    partial: () => '', url_for: value => value, date: () => '2026.01.11',
    min2read: () => 8, strip_html: stripHTML, truncate,
  });
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelector('.post-summary').textContent,
    '背景任务用 Channel 传递数据。这是原文。');
  assert.match(dom.window.document.querySelector('.featured-post .post-meta').textContent,
    /预计阅读 8 分钟/);
  dom.window.close();
});
