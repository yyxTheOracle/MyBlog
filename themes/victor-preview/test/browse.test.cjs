const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const ejs = require('ejs');
const moment = require('moment');
const { JSDOM } = require('jsdom');

// 仅模拟 Hexo Query 接口；模板仍从真实文件逐层渲染。
function collection(items) {
  return {
    length: items.length,
    toArray: () => [...items],
    each: callback => items.forEach(callback),
    sort: (key, direction) => collection([...items].sort((a, b) => (a[key] - b[key]) * direction)),
  };
}

const dates = ['2026-10-17', '2026-10-12', '2026-09-01', '2026-08-01', '2026-07-01', '2026-06-01', '2026-05-01', '2026-04-01', '2026-03-01', '2026-02-01', '2026-01-11', '2026-01-01', '2025-09-14', '2024-03-07', '2019-05-26'];
const posts = dates.map((value, index) => ({
  title: index === 0 ? '标题中的 <标签> & 字符' : `文章 ${index}`,
  path: `post/${index}.html`, date: moment(value), tags: collection([{ name: 'AI' }]),
}));
const categories = collection([['随笔', 5], ['前端开发', 7], ['后端开发', 1], ['AI', 2]].map(([name, length]) => ({ name, length, path: `categories/${name}/` })));
const tags = collection([['随笔', 5], ['前端开发', 7], ['JavaScript', 6], ['AI', 3], ['后端开发', 1], ['Go', 1]].map(([name, length]) => ({ name, length, path: `tags/${name}/` })));

// 局部模板继承页面数据，保留真实的分类、标签和分页调用链。
function render(template, page) {
  const layout = path.resolve(__dirname, '../layout');
  const locals = {
    site: { posts: collection([...posts].reverse()), categories, tags }, page,
    url_for: value => '/' + value.replace(/^\/+/, ''),
    date: (value, format) => value.format(format),
    paginator: () => '<a href="page/2/">下一页</a>',
  };
  function partial(file, data) {
    return ejs.render(readFileSync(file, 'utf8'), {
      ...data,
      partial: (name, args = {}) => partial(path.resolve(name.startsWith('_partial/') ? layout : path.dirname(file), name + '.ejs'), { ...data, ...args }),
    });
  }
  return new JSDOM(partial(path.join(layout, template + '.ejs'), locals));
}

test('归档入口读取全部文章并按年份导航，不受生成器分页截断', () => {
  for (const template of ['archive', 'page']) {
    const dom = render(template, { path: 'archives/index.html', current: 1, total: 2, posts: collection(posts.slice(0, 10)) });
    const document = dom.window.document;
    assert.deepEqual([...document.querySelectorAll('.browse-row')].map(row => row.getAttribute('href')), posts.map(post => '/' + post.path));
    assert.equal(document.querySelector('.browse-row h3').textContent, posts[0].title, '标题必须转义而不是注入 HTML');
    for (const year of ['2026', '2025', '2024', '2019']) {
      const group = document.querySelector('#archive-year-' + year);
      assert.equal(group.querySelectorAll('.browse-row').length, posts.filter(post => post.date.format('YYYY') === year).length);
      assert.ok(document.querySelector(`.archive-years a[href="#archive-year-${year}"]`));
    }
    assert.equal(document.querySelector('.pagination'), null);
    assert.equal(document.querySelector('.browse-heading p'), null);
    assert.doesNotMatch(document.body.textContent, /15 篇文章，记录想法与实践。|本地预览|查看原版/);
    dom.window.close();
  }
});

test('年份、月份和日期归档仅显示指定日期范围，仍不受页大小影响', () => {
  for (const [range, expected] of [[{ year: 2026 }, posts.slice(0, 12)], [{ year: 2026, month: 10 }, posts.slice(0, 2)], [{ year: 2026, month: 10, day: 17 }, posts.slice(0, 1)]]) {
    const dom = render('archive', { path: 'archives/2026/', posts: collection([]), ...range });
    assert.deepEqual([...dom.window.document.querySelectorAll('.browse-row')].map(row => row.getAttribute('href')), expected.map(post => '/' + post.path));
    dom.window.close();
  }
});

test('分类轻卡片仅保留四类六标签及各自篇数，不展示文章和概览说明', () => {
  const dom = render('page', { type: 'categories', path: 'categories/index.html' });
  const document = dom.window.document;
  assert.deepEqual([...document.querySelectorAll('.category-link')].map(link => [link.querySelector('h2').textContent, link.querySelector('.category-count').textContent.trim()]), categories.toArray().map(item => [item.name, `${item.length} 篇文章`]));
  assert.deepEqual([...document.querySelectorAll('.category-tag-links a')].map(link => link.getAttribute('href')), tags.toArray().map(tag => '/' + tag.path));
  assert.equal(document.querySelector('a[href^="/post/"]'), null);
  assert.equal(document.querySelector('.browse-heading p'), null);
  assert.doesNotMatch(document.body.textContent, /4 个分类，6 个标签。|本地预览|查看原版/);
  dom.window.close();
});

test('同名分类与标签保留各自集合和总数，分页只列当前页并保留返回入口', () => {
  for (const [template, field, expectedCount] of [['category', 'category', 2], ['tag', 'tag', 3]]) {
    const dom = render(template, { path: `${field}/AI/`, [field]: 'AI', posts: collection([posts[0]]), total: 2 });
    const document = dom.window.document;
    assert.equal(document.querySelector('h1').textContent, 'AI');
    assert.match(document.querySelector('.browse-heading').textContent, new RegExp(`${expectedCount} 篇`));
    assert.deepEqual([...document.querySelectorAll('.browse-row')].map(row => row.getAttribute('href')), ['/post/0.html']);
    assert.equal(document.querySelector('.browse-breadcrumb a').getAttribute('href'), '/categories/');
    assert.equal(document.querySelector('.browse-topic-links [aria-current="page"]').getAttribute('href'), `/${field === 'category' ? 'categories' : 'tags'}/AI/`);
    assert.ok(document.querySelector('.pagination a'));
    assert.equal(document.querySelector('a[href*="browse-preview"]'), null);
    dom.window.close();
  }
});
