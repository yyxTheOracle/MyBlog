const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const ejs = require('ejs');
const { JSDOM } = require('jsdom');
const { stripHTML } = require('hexo-util');
const imageAssets = require('../image-assets.json');

test('精选摘要去掉小标题，保留正文里的“背景”和行内技术词', () => {
  const post = {
    abbrlink: 'db62fe35', title: 'Matt Pocock Skills v1.1 使用体验', path: 'post/matt-pocock-skills-v1-1/',
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

test('精选展示校庆随笔配图并保留完整摘要，项目视频独立于文章链接', () => {
  const workerSummary = '最近有个业务需求，需要去小红书开放平台对接一些报表数据接口，通过定时任务，在每天特定的时间点拉取效果数据并落库。';
  const essaySummary = '十年前的 2016 年 10 月 16 日，是进才的 20 周年校庆。那个时候我 16 岁，高二刚开学。在中央大楼前的草坪上，我拍下了这张照片。';
  const essayImage = 'https://s3.bmp.ovh/2026/11/08/ndhMW23N.jpg';
  const essayImageAlt = '2016 年进才中学二十周年校庆，中央大楼前的舞台与观众';
  const skillsExcerpt = '因为 GPT-5.6 的发布，前两天每天都会有一次额度重置，这两次重置是到点直接重置的，没法存到 reset bank 里，加上台风天没法出门，于是我开着 5.6 Sol xHigh/Ultra 疯狂蹬，蹬掉了 7.5 亿 Token。';
  // 保留旧候选，确认 Go 和 Event Loop 确实退出精选，而不是因 fixture 缺失误通过。
  const posts = [
    { abbrlink: '2733f88e', url_slug: 'electron-workflow-automation', title: '给运营支持团队做提效工具，做着做着，这个团队没了', excerpt: '<p>天工桌面自动化工具的开发过程。</p>' },
    { abbrlink: '310ea7d9', url_slug: 'jincai-30th-anniversary', title: '雅典园的 20 周年和 30 周年丨我的 16 岁和 26 岁', excerpt: `<p>${essaySummary}</p>` },
    { abbrlink: '12e2a8de', url_slug: 'go-worker-pool', title: '对接小红书海量数据丨Go 并发利器 Worker Pool 实践', excerpt: `<h1>背景</h1><p>${workerSummary}</p>` },
    { abbrlink: 'db62fe35', url_slug: 'matt-pocock-skills-v1-1', title: 'Matt Pocock Skills v1.1 使用体验', excerpt: `<p>${skillsExcerpt}</p>` },
    { abbrlink: '2a798ab5', url_slug: 'philip-roberts-event-loop', title: '究竟什么是 Event Loop丨总结 Philip Roberts 在 JSConf 的演讲', excerpt: '<p>Event Loop 与浏览器渲染的关系。</p>' },
  ].map(post => ({ ...post, path: `/post/${post.url_slug}/`, content: '', tags: { toArray: () => [] } }));
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
      '/post/electron-workflow-automation/', '/post/jincai-30th-anniversary/', '/post/matt-pocock-skills-v1-1/',
    ]);
    assert.equal(document.querySelector('.project-section'), null);
    assert.doesNotMatch(document.body.textContent, /项目手记/);
    assert.deepEqual(links.map(link => link.querySelector('.post-summary').textContent), [
      '当效率被提到了极致，最先被优化的，恰恰是原本需要被减负的人。',
      essaySummary,
      skillsExcerpt,
    ]);
    for (const link of links) {
      assert.match(link.querySelector('.post-meta').textContent, /约 2\.3k 字/);
      assert.match(link.querySelector('.post-meta').textContent, /预计阅读 8 分钟/);
    }

    const essay = links[1];
    assert.ok(essay.querySelector('.featured-essay-content'));
    assert.match(essay.querySelector('.post-summary').textContent, /我拍下了这张照片/);
    const photo = essay.querySelector('img.featured-essay-photo');
    assert.ok(photo);
    assert.equal(photo.getAttribute('alt'), essayImageAlt);
    assert.equal(photo.getAttribute('src'), imageAssets[essayImage].variants.find(variant => variant.width === 480).src);
    assert.match(photo.getAttribute('src'), /^\/assets\/article-images\//);
    assert.ok(Number(photo.getAttribute('width')) > 0);
    assert.ok(Number(photo.getAttribute('height')) > 0);
    assert.equal(Number(photo.getAttribute('width')) / Number(photo.getAttribute('height')), 4 / 3);
    assert.equal(featured.querySelectorAll('img.featured-essay-photo').length, 1);
    for (const link of [links[0], links[2]]) assert.equal(link.querySelector('.featured-essay-photo'), null);

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
