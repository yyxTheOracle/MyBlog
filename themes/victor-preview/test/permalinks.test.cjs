const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { parse } = require('hexo-front-matter');
const yaml = require('js-yaml');
const moment = require('moment');
const permalink = require('hexo/lib/plugins/filter/post_permalink');

const root = resolve(__dirname, '../../..');
const config = yaml.load(readFileSync(resolve(root, '_config.yml'), 'utf8'));
const posts = readdirSync(resolve(root, 'source/_posts')).filter(name => name.endsWith('.md'))
  .map(name => ({ ...parse(readFileSync(resolve(root, 'source/_posts', name), 'utf8')), filename: name }));

// 用真实文章和 Hexo 原生过滤器验证，不自行拼接一个看似正确的生成结果。
function postPath(post, overrides = {}) {
  return permalink.call({ config }, {
    ...post, slug: post.filename.replace(/\.md$/, ''), date: moment(post.date),
    categories: { length: 0 }, ...overrides,
  });
}

test('文章链接名和评论标识有效且唯一，改标题或文件名不改变公开链接', () => {
  const slugs = new Set();
  const ids = new Set();
  for (const post of posts) {
    assert.match(post.url_slug || '', /^[a-z0-9]+(?:-[a-z0-9]+)*$/, post.filename);
    assert.ok(post.abbrlink != null && post.abbrlink !== '', post.filename);
    assert.ok(!slugs.has(post.url_slug), `重复链接：${post.url_slug}`);
    assert.ok(!ids.has(String(post.abbrlink)), `重复评论标识：${post.abbrlink}`);
    slugs.add(post.url_slug);
    ids.add(String(post.abbrlink));
    const expected = `post/${post.url_slug}/`;
    assert.equal(postPath(post), expected);
    assert.equal(postPath(post, { title: '改过的标题', slug: 'renamed-file' }), expected);
  }
});
