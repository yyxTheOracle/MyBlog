'use strict';

const { Parser } = require('htmlparser2');
const dimensions = require('../media-dimensions.json');

/** 在浏览器下载媒体前给出真实比例，同时保留作者指定的显示宽度。 */
function mediaAttributes(attributes, size) {
  if (!size) return '';
  const [width, height] = size;
  const suppliedWidth = Number(attributes.width);
  const suppliedHeight = Number(attributes.height);
  if (attributes.width && attributes.height) return '';
  if (attributes.width) return suppliedWidth > 0 ? ` height="${Math.round(suppliedWidth * height / width)}"` : '';
  if (attributes.height) return suppliedHeight > 0 ? ` width="${Math.round(suppliedHeight * width / height)}"` : '';
  return ` width="${width}" height="${height}"`;
}

/** 只补写媒体起始标签，保留代码示例、HTML 排版和原有属性的原始文本。 */
function prepareArticleMedia(html, sizes = dimensions) {
  const media = [];
  let ignoredDepth = 0;
  let video;
  let imageIndex = 0;
  const parser = new Parser({
    onopentag(name, attributes) {
      if (ignoredDepth || ['pre', 'code', 'script', 'style'].includes(name)) {
        ignoredDepth++;
        return;
      }
      if (name === 'img' || name === 'video') {
        const item = { name, attributes, src: attributes.src, start: parser.startIndex, end: parser.endIndex };
        if (name === 'img') item.index = imageIndex++;
        else video = item;
        media.push(item);
      } else if (name === 'source' && video && !video.src) {
        video.src = attributes.src;
      }
    },
    onclosetag(name) {
      if (ignoredDepth) ignoredDepth--;
      else if (name === 'video') video = undefined;
    },
  });
  parser.end(html);

  // 从后往前替换，前一个标签的原始字符位置不会被新增属性推移。
  for (const item of media.reverse()) {
    const size = sizes[item.src];
    let extra = mediaAttributes(item.attributes, size);
    if (item.name === 'img') {
      if (!item.attributes.decoding) extra += ' decoding="async"';
      // 未知尺寸不主动懒加载，避免进入视口后才撑开正文；手写 loading 始终优先。
      if (!item.attributes.loading && (size || (item.attributes.width && item.attributes.height))) {
        extra += ` loading="${item.index === 0 ? 'eager' : 'lazy'}"`;
      }
    }
    if (extra) {
      const tag = html.slice(item.start, item.end + 1).replace(/\s*\/?\>$/, ending => extra + ending);
      html = html.slice(0, item.start) + tag + html.slice(item.end + 1);
    }
  }
  return html;
}

if (typeof hexo !== 'undefined') {
  hexo.extend.filter.register('after_post_render', (data) => {
    if (data.layout === 'post') data.content = prepareArticleMedia(data.content);
    return data;
  }, 20);
}

module.exports = prepareArticleMedia;
