const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Readable } = require('node:stream');
const { absoluteFeedImages, updateFeedRoutes } = require('../scripts/article-feed-media');

test('Feed只改真实img的生成资源属性，保留其他地址和代码示例', () => {
  const unchanged = '<pre><code><img src="/assets/article-images/example.webp"></code></pre>'
    + '<p>&lt;img src="/assets/article-images/example.webp"&gt;</p>'
    + '<script>const x = \'<img src="/assets/article-images/code.webp">\';</script>'
    + '<img src="https://example.com/external.png"><img src="/assets/other.png">';
  const xml = '<feed><content><![CDATA[' + unchanged
    + '<img class="photo" src=\'/assets/article-images/a.webp\' srcset="/assets/article-images/a.webp 480w, /assets/article-images/b.webp 760w, https://example.com/c.webp 1520w" alt="图 &amp; 说明" data-original-src="/assets/article-images/original.webp">'
    + ']]></content><link href="/assets/article-images/unchanged.webp"/></feed>';
  const result = absoluteFeedImages(xml, 'https://www.victoryeah.com/');
  assert.ok(result.includes(unchanged));
  assert.ok(result.includes('src="https://www.victoryeah.com/assets/article-images/a.webp"'));
  assert.ok(result.includes('srcset="https://www.victoryeah.com/assets/article-images/a.webp 480w, https://www.victoryeah.com/assets/article-images/b.webp 760w, https://example.com/c.webp 1520w"'));
  assert.ok(result.includes('alt="图 &amp; 说明" data-original-src="/assets/article-images/original.webp"'));
  assert.ok(result.endsWith('<link href="/assets/article-images/unchanged.webp"/></feed>'));
  assert.equal(absoluteFeedImages(result, 'https://www.victoryeah.com/'), result);
});

test('读取Feed流时保留UTF-8文本，只更新配置中的Atom/RSS路由', async () => {
  const xml = '<content:encoded><![CDATA[<p>中文说明</p><img src="/assets/article-images/a.webp">]]></content:encoded>';
  const routes = new Map([['atom.xml', xml], ['rss.xml', xml], ['post/test/index.html', xml], ['other.xml', xml]]);
  const updated = [];
  const context = {
    config: { url: 'https://www.victoryeah.com/', feed: { path: ['atom.xml', 'rss.xml'] } },
    route: {
      get(file) {
        const buffer = Buffer.from(routes.get(file));
        // 刻意在中文字符的UTF-8字节之间切开，不能逐块直接转字符串。
        const split = buffer.indexOf(Buffer.from('中')) + 1;
        return Readable.from([buffer.subarray(0, split), buffer.subarray(split)]);
      },
      set(file, content) { routes.set(file, content); updated.push(file); },
    },
  };
  await updateFeedRoutes(context);
  assert.deepEqual(updated, ['atom.xml', 'rss.xml']);
  assert.ok(routes.get('atom.xml').includes('中文说明'));
  assert.ok(routes.get('rss.xml').includes('src="https://www.victoryeah.com/assets/article-images/a.webp"'));
  assert.equal(routes.get('post/test/index.html'), xml);
  assert.equal(routes.get('other.xml'), xml);
});
