'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const Hexo = require('hexo');
const { parse } = require('hexo-front-matter');
const buildSearchIndex = require('../scripts/search');

test('章节索引保留正文和代码，过滤样式、脚本、行号及未发布内容', () => {
  const config = { url: 'https://example.com/blog/', root: '/blog/' };
  const index = buildSearchIndex([
    {
      title: 'Go &amp; Electron', path: 'post/demo.html',
      content: '<p>首段 &#x7F13;&#x51B2;&#x533A;</p><style>.private-css{color:red}</style>' +
        '<script>privateScript()</script><h2 id="章节 &amp; code">章节 <code>code</code></h2>' +
        '<p>第一段</p><p>第二段</p><table><tr><td class="gutter"><pre>999</pre></td>' +
        '<td class="code"><pre><span>const</span> count = 1 &lt; 2;</pre></td></tr></table>'
    },
    { title: '只有标题', path: 'post/title.html', content: '' },
    { title: '未发布', path: 'post/private.html', published: false, content: 'secret' },
    { title: '草稿', path: 'post/draft.html', draft: true, content: 'secret' }
  ], config);

  assert.equal(index.length, 3);
  assert.deepEqual(index[0], {
    title: 'Go & Electron', heading: '', url: '/blog/post/demo.html', text: '首段 缓冲区'
  });
  assert.equal(index[1].heading, '章节 code');
  assert.equal(index[1].url, `/blog/post/demo.html#${encodeURIComponent('章节 & code')}`);
  assert.equal(index[1].text, '第一段 第二段 const count = 1 < 2;');
  assert.equal(index[2].title, '只有标题');
  assert.equal(index[2].text, '');
  assert.doesNotMatch(JSON.stringify(index), /private-css|privateScript|999|secret/);
});

test('真实 Go 和 Electron 文章经 Hexo 6 渲染后可搜索，并定位正文锚点', async () => {
  const root = path.resolve(__dirname, '../../..');
  const hexo = new Hexo(root, { silent: true });
  // 只装载渲染所需插件，不执行 init/generate，避免测试写 package、缓存或 public。
  require('hexo/lib/plugins/filter')(hexo);
  require('hexo/lib/plugins/tag')(hexo);
  await hexo.loadPlugin(require.resolve('hexo-renderer-marked'));
  await hexo.loadPlugin(path.resolve(__dirname, '../scripts/search.js'));

  /** 使用仓库原文和真实渲染器，检验高亮 span 与中文标题的兼容性。 */
  async function renderPost(filename) {
    const source = path.join(root, 'source/_posts', filename);
    const post = parse(readFileSync(source, 'utf8'));
    return hexo.post.render(source, {
      ...post, content: post._content, path: `post/${post.abbrlink}.html`
    });
  }

  const go = await renderPost('2026-01-11-go-worker-pool实践.md');
  const electron = await renderPost('2025-09-14-electron-tiangong.md');
  const generator = hexo.extend.generator.get('victor-search');
  const result = await generator.call(hexo, { posts: [go, electron] });
  assert.equal(result.path, 'search-index.json');
  assert.ok(!result.data.includes('<'), '独立 JSON 应安全序列化 HTML 特殊字符');
  const index = JSON.parse(result.data);

  const goMatch = index.find(entry => entry.title === go.title && entry.text.includes('缓冲区'));
  assert.ok(goMatch && goMatch.url.includes('#'), '正文缓冲区应命中带章节锚点的 Go 文章');
  const anchor = decodeURIComponent(new URL(goMatch.url, 'https://example.com').hash.slice(1));
  assert.ok(go.content.includes(`id="${anchor}"`), '搜索 hash 必须对应已渲染的真实标题 id');
  assert.ok(index.some(entry => entry.title === electron.title && entry.text.includes('webContentsId')));
  assert.ok(index.some(entry => entry.title === electron.title && entry.text.includes('partition:')));
  assert.doesNotMatch(result.data, /word-break: normal|overflow-x: auto|min-width: 900px/);
});
