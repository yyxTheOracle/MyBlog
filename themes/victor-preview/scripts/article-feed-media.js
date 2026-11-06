'use strict';

const { Parser } = require('htmlparser2');
const IMAGE_PREFIX = '/assets/article-images/';

/** Feed 阅读器没有网页的基准地址，只把生成图片的地址转为正式站点绝对地址。 */
function absoluteImageHtml(html, siteUrl) {
  const edits = [];
  let tag;
  let ignoredDepth = 0;
  const parser = new Parser({
    onopentagname(name) { tag = name; },
    onattribute(name, value) {
      if (ignoredDepth || tag !== 'img' || !['src', 'srcset'].includes(name)) return;
      const absolute = name === 'src'
        ? value.startsWith(IMAGE_PREFIX) ? new URL(value, siteUrl).href : value
        : value.replace(/(^|[\s,])(\/assets\/article-images\/[^\s,]+)/g, (_, separator, url) => separator + new URL(url, siteUrl).href);
      if (absolute === value) return;
      const escaped = absolute.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      edits.push({ start: parser.startIndex, end: parser.endIndex, replacement: `${name}="${escaped}"` });
    },
    onopentag(name) {
      if (ignoredDepth || ['pre', 'code', 'script', 'style'].includes(name)) ignoredDepth++;
    },
    onclosetag() { if (ignoredDepth) ignoredDepth--; },
  });
  parser.end(html);
  // 仅修改目标属性，保留代码、图注以及其他 HTML 的原始文本。
  for (const edit of edits.reverse()) html = html.slice(0, edit.start) + edit.replacement + html.slice(edit.end + 1);
  return html;
}

/** Atom content 与 RSS content:encoded 共用 CDATA，不重写 XML 的其余部分。 */
function absoluteFeedImages(xml, siteUrl) {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, html) => `<![CDATA[${absoluteImageHtml(html, siteUrl)}]]>`);
}

/** 生成后仅更新配置中的 Feed 路由，网页继续使用可供本地预览的相对资源地址。 */
async function updateFeedRoutes(context) {
  const paths = context.config.feed?.path;
  for (const routePath of Array.isArray(paths) ? paths : [paths]) {
    if (typeof routePath !== 'string') continue;
    const stream = context.route.get(routePath);
    if (!stream) continue;
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const original = Buffer.concat(chunks).toString('utf8');
    const updated = absoluteFeedImages(original, context.config.url);
    if (updated !== original) context.route.set(routePath, updated);
  }
}

if (typeof hexo !== 'undefined') {
  hexo.extend.filter.register('after_generate', () => updateFeedRoutes(hexo));
}

module.exports = { absoluteFeedImages, updateFeedRoutes };
