'use strict';

// 保留已发布标签页的入口；合并标签后，旧书签仍能找到对应的大类文章。
hexo.extend.generator.register('legacy-tag-redirects', function() {
  const mergedTags = {
    antd: '前端开发',
    Electron: '前端开发',
    Puppeteer: '前端开发',
    'AI-Coding': 'AI',
    Codex: 'AI',
    Skills: 'AI',
    NBA: '随笔'
  };

  return Object.entries(mergedTags).map(([oldTag, target]) => {
    const destination = `/tags/${encodeURIComponent(target)}/`;
    return {
      path: `tags/${oldTag}/index.html`,
      data: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>标签已合并</title><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${destination}"><link rel="canonical" href="${this.config.url.replace(/\/$/, '')}${destination}"></head><body><p>标签已合并至 <a href="${destination}">${target}</a>。</p></body></html>`
    };
  });
});
