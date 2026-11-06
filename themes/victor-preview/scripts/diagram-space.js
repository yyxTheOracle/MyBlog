'use strict';

const { createHash } = require('node:crypto');
const { Parser } = require('htmlparser2');
const dimensions = require('../diagram-dimensions.json');

/** 和浏览器取源码一致：保留节点中的换行标签，解码 HTML 实体。 */
function diagramSource(html) {
  let source = '';
  new Parser({
    onopentag(name) { if (name === 'br') source += '<br/>'; },
    ontext(text) { source += text; },
  }, { decodeEntities: true }).end(html);
  return source;
}

/** 用内容而非文章序号关联尺寸，插图增删或调序不会套用另一张图的占位。 */
function diagramKey(source) {
  return createHash('sha256').update(source.replace(/\r\n/g, '\n').replace(/<br\s*\/?\s*>/gi, '<br/>').trim()).digest('hex');
}

/** 仅为实测过的图表预留绘图区，外层继续沿用主题原有边距与横向滚动。 */
function reserveDiagramSpace(html, sizes = dimensions) {
  return html.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (original, attributes, content) => {
    const classes = attributes.match(/\bclass\s*=\s*(["'])(.*?)\1/i);
    if (!classes || !classes[2].split(/\s+/).includes('mermaid') || content.includes('class="mermaid-source"')) return original;
    const size = sizes[diagramKey(diagramSource(content))];
    // shortcut: 新图或修改后的图暂不预留固定比例，发布前补录真实 SVG 尺寸。
    if (!size || ![size.width, size.height].every(value => Number.isFinite(value) && value > 0)) return original;
    const minWidth = Number.isFinite(size.minWidth) && size.minWidth > 0 ? size.minWidth : 0;
    return `<pre${attributes}><span class="mermaid-source">${content}</span><span class="diagram-placeholder" aria-hidden="true" style="width:100%;max-width:${size.width}px;min-width:${minWidth}px;aspect-ratio:${size.width}/${size.height}"></span></pre>`;
  });
}

if (typeof hexo !== 'undefined') {
  hexo.extend.filter.register('after_post_render', function(data) {
    if (data.layout === 'post') data.content = reserveDiagramSpace(data.content || '');
    return data;
  });
}

module.exports = { diagramKey, diagramSource, reserveDiagramSpace };
