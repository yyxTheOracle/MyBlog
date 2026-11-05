const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');
const { stripHTML } = require('hexo-util');

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
    min2read: () => 8, wordcount: () => '2.3k', strip_html: stripHTML,
  });
  const dom = new JSDOM(html);
  assert.equal(dom.window.document.querySelector('.post-summary').textContent,
    '背景任务用 Channel 传递数据。这是原文。');
  assert.match(dom.window.document.querySelector('.featured-post .post-meta').textContent,
    /预计阅读 8 分钟/);
  dom.window.close();
});

test('精选完整保留摘要和字数，视频不显示外置按钮且独立于文章链接', () => {
  const workerSummary = '最近有个业务需求，需要去小红书开放平台对接一些报表数据接口，通过定时任务，在每天特定的时间点拉取效果数据并落库。';
  const skillsExcerpt = '因为 GPT-5.6 的发布，前两天每天都会有一次额度重置，这两次重置是到点直接重置的，没法存到 reset bank 里，加上台风天没法出门，于是我开着 5.6 Sol xHigh/Ultra 疯狂蹬，蹬掉了 7.5 亿 Token。';
  // 放入四篇真实候选，确认 Event Loop 只退出精选，不会因 fixture 缺失而误通过。
  const posts = [
    { abbrlink: '2733f88e', title: '给运营支持团队做提效工具，做着做着，这个团队没了', excerpt: '<p>天工桌面自动化工具的开发过程。</p>' },
    { abbrlink: '12e2a8de', title: '对接小红书海量数据丨Go 并发利器 Worker Pool 实践', excerpt: `<h1>背景</h1><p>${workerSummary}</p>` },
    { abbrlink: 'db62fe35', title: 'Matt Pocock Skills v1.1 使用体验', excerpt: `<p>${skillsExcerpt}</p>` },
    { abbrlink: '2a798ab5', title: '究竟什么是 Event Loop丨总结 Philip Roberts 在 JSConf 的演讲', excerpt: '<p>Event Loop 与浏览器渲染的关系。</p>' },
  ].map(post => ({ ...post, path: `/post/${post.abbrlink}.html`, content: '', tags: { toArray: () => [] } }));
  const html = ejs.render(readFileSync(require.resolve('../layout/index.ejs'), 'utf8'), {
    page: { current: 1 }, site: { posts: { sort: () => ({ toArray: () => posts }) } },
    partial: () => '', url_for: value => value, date: () => '2026.01.11',
    min2read: () => 8, wordcount: () => '2.3k', strip_html: stripHTML,
  });
  const dom = new JSDOM(html);
  const document = dom.window.document;
  try {
    const sections = document.querySelectorAll('section[aria-labelledby="featured-title"]');
    assert.equal(sections.length, 1);
    const featured = sections[0];
    const links = [...featured.querySelectorAll('a[href^="/post/"]')];
    assert.deepEqual(links.map(link => link.getAttribute('href')), [
      '/post/2733f88e.html', '/post/12e2a8de.html', '/post/db62fe35.html',
    ]);
    assert.equal(document.querySelector('.project-section'), null);
    assert.doesNotMatch(document.body.textContent, /项目手记/);
    assert.deepEqual(links.map(link => link.querySelector('.post-summary').textContent), [
      '当效率被提到了极致，最先被优化的，恰恰是原本需要被减负的人。',
      workerSummary,
      skillsExcerpt,
    ]);
    for (const link of links) {
      assert.match(link.querySelector('.post-meta').textContent, /约 2\.3k 字/);
      assert.match(link.querySelector('.post-meta').textContent, /预计阅读 8 分钟/);
    }

    // 移除外置按钮后，未执行增强脚本时仍可通过视频原生控件播放。
    const video = featured.querySelector('#project-demo');
    const button = featured.querySelector('#project-demo-toggle');
    assert.ok(video);
    assert.equal(button, null);
    assert.equal(video.closest('a'), null);
    for (const attribute of ['controls', 'muted', 'loop', 'playsinline']) {
      assert.equal(video.hasAttribute(attribute), true, `保留视频 ${attribute} 属性`);
    }
    assert.equal(video.getAttribute('preload'), 'none');
    assert.equal(video.querySelector('source').getAttribute('src'), '/assets/electron-tiangong/reply-demo.mp4');
    assert.equal(document.querySelectorAll('script[src="/js/project-video.js"]').length, 1);
  } finally {
    dom.window.close();
  }
});
