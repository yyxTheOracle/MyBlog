'use strict';

const { Parser } = require('htmlparser2');
const { decodeHTML } = require('entities');
const { url_for } = require('hexo-util');

/** 按渲染后的章节建立索引，沿用真实标题 id，避免搜索跳转和正文锚点不一致。 */
function buildSearchIndex(posts, config) {
  const entries = [];

  posts.forEach(post => {
    // 即使预览开启了草稿，也不把未发布内容写入可公开下载的索引。
    if (post.published === false || post.draft === true) return;

    const title = decodeHTML(post.title || '');
    const url = url_for.call({ config }, post.path, { relative: false });
    let section = { title, heading: '', url, text: '' };
    let headingTag = '';
    let ignoredDepth = 0;
    entries.push(section);

    new Parser({
      onopentag(name, attributes) {
        // 高亮器的 gutter 只有行号；代码正文仍然保留，方便搜索 API 和变量名。
        if (ignoredDepth || name === 'script' || name === 'style' ||
            (attributes.class || '').split(/\s+/).includes('gutter')) {
          ignoredDepth++;
          return;
        }

        if (/^h[1-6]$/.test(name)) {
          section = {
            title,
            heading: '',
            url: attributes.id ? `${url}#${encodeURIComponent(attributes.id)}` : url,
            text: ''
          };
          entries.push(section);
          headingTag = name;
        }
      },
      ontext(text) {
        if (ignoredDepth) return;
        if (headingTag) section.heading += text;
        else section.text += text;
      },
      onclosetag(name) {
        if (ignoredDepth) {
          ignoredDepth--;
          return;
        }
        if (name === headingTag) headingTag = '';
        // 只在块级边界分词，避免把中文或高亮 span 拆成无法命中的碎片。
        if (/^(p|div|li|br|pre|tr|td|th|blockquote|h[1-6])$/.test(name)) {
          section.text += ' ';
        }
      }
    }, { decodeEntities: true }).end(post.content || '');
  });

  return entries.map(entry => ({
    ...entry,
    heading: entry.heading.replace(/\s+/g, ' ').trim(),
    text: entry.text.replace(/\s+/g, ' ').trim()
  }));
}

// 独立 JSON 资源不经过模板插值；转义 < 也避免未来内嵌时出现闭合标签。
if (typeof hexo !== 'undefined') {
  hexo.extend.generator.register('victor-search', function(locals) {
    return {
      path: 'search-index.json',
      data: JSON.stringify(buildSearchIndex(locals.posts, this.config)).replace(/</g, '\\u003c')
    };
  });
}

module.exports = buildSearchIndex;
