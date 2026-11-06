const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');

const layout = readFileSync(require.resolve('../layout/layout.ejs'), 'utf8');

test('只有首页首屏提前下载标题必需的字体，分页和其他页面仍按需加载', () => {
  for (const [home, current, path, type] of [
    [true, 1, '', ''], [true, undefined, '', ''], [true, 2, 'page/2/', ''],
    [false, undefined, 'archives/', ''], [false, undefined, 'about/', 'about'],
    [false, undefined, 'post/example.html', ''],
  ]) {
    // 通过真实模板验证页面范围，避免把首页字体也强制下载到文章阅读页。
    const dom = new JSDOM(ejs.render(layout, {
      body: '', page: { path, current, type }, config: { title: '博客', description: '' },
      is_home: () => home, is_post: () => false, is_archive: () => path === 'archives/',
      is_category: () => false, is_tag: () => false, open_graph: () => '', date: () => '2026',
    }));
    try {
      const links = [...dom.window.document.querySelectorAll('link[rel="preload"][as="font"]')];
      const expected = home && current !== 2 ? ['093', '095', '096', '097'] : [];
      assert.deepEqual(links.map(link => link.getAttribute('href')),
        expected.map(id => `/fonts/noto-serif-sc-v36-700-${id}.woff2`));
      const css = readFileSync(require.resolve('../source/css/fonts.css'), 'utf8');
      for (const link of links) {
        const href = link.getAttribute('href');
        assert.equal(link.getAttribute('type'), 'font/woff2');
        assert.ok(link.hasAttribute('crossorigin'), '预加载必须与实际字体请求使用相同的 CORS 模式');
        assert.ok(existsSync(resolve(__dirname, '../source', href.slice(1))));
        assert.ok(css.includes(`url(${href})`), '预加载与 CSS 复用同一 URL，避免重复下载');
        assert.ok(layout.indexOf(href) < layout.indexOf('href="/css/site.css"'));
      }
    } finally {
      dom.window.close();
    }
  }
});
