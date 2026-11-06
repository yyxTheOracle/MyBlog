const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');
const { diagramKey, diagramSource, reserveDiagramSpace } = require('../scripts/diagram-space');
const script = readFileSync(require.resolve('../source/js/site.js'), 'utf8');

test('图表按规范化源码匹配实测尺寸，保留 HTML 换行与实体', () => {
  const source = 'graph LR\n A[甲<br/>乙 & 丙] --> B';
  const html = '<pre class="mermaid">graph LR\n A[甲<br>乙 &amp; 丙] --> B</pre>';
  const sizes = { [diagramKey(source)]: { width: 1000, height: 500, minWidth: 900 } };
  const result = reserveDiagramSpace(html, sizes);
  const dom = new JSDOM(result);
  const placeholder = dom.window.document.querySelector('.diagram-placeholder');
  assert.ok(placeholder);
  assert.equal(placeholder.style.width, '100%');
  assert.equal(placeholder.style.maxWidth, '1000px');
  assert.equal(placeholder.style.minWidth, '900px');
  // 项目现有 jsdom 尚不解析 aspect-ratio，比例属性交由真实浏览器检查布局效果。
  assert.match(placeholder.getAttribute('style'), /aspect-ratio:1000\/500/);
  assert.equal(diagramSource(dom.window.document.querySelector('.mermaid-source').innerHTML), source);
  assert.equal(reserveDiagramSpace(result, sizes), result, '重复构建不嵌套占位');
  assert.equal(diagramKey(source.replace('\n', '\r\n')), diagramKey(source));
  dom.window.close();
});

test('未知、已修改或非 Mermaid 内容不猜测比例，非法尺寸不输出', () => {
  const html = '<pre class="mermaid">graph LR; A --> B</pre>';
  const key = diagramKey('graph LR; A --> B');
  assert.equal(reserveDiagramSpace(html, {}), html);
  assert.equal(reserveDiagramSpace(html, { [key]: { width: 1000, height: 0 } }), html);
  const ordinary = '<pre class="mermaid-source">graph LR; A --> B</pre>';
  assert.equal(reserveDiagramSpace(ordinary, { [key]: { width: 1000, height: 500 } }), ordinary);
});

test('渲染只读取源码，成功替换占位，失败恢复源码', async () => {
  const source = 'graph LR; A[甲<br/>乙] --> B';
  const html = reserveDiagramSpace(`<pre class="mermaid">${source}</pre>`, {
    [diagramKey(source)]: { width: 500, height: 250 },
  });
  for (const fails of [false, true, 'cdn']) {
    const dom = new JSDOM(html, { url: 'https://example.com/post/test.html', runScripts: 'outside-only' });
    const { window } = dom;
    window.matchMedia = () => ({ matches: false, addEventListener() {} });
    if (fails !== 'cdn') window.mermaid = {
      initialize() {},
      async render(id, actual) {
        assert.equal(actual, source);
        if (fails) throw new Error('render failed');
        return { svg: '<svg viewBox="0 0 500 250"></svg>' };
      },
    };
    window.eval(script);
    await new Promise(setImmediate);
    if (fails === 'cdn') {
      window.document.querySelector('script[src*="mermaid"]').dispatchEvent(new window.Event('error'));
      await new Promise(setImmediate);
    }
    const diagram = window.document.querySelector('.mermaid');
    assert.equal(diagram.querySelector('.diagram-placeholder'), null);
    if (fails) {
      assert.equal(diagram.textContent, source);
      assert.ok(diagram.hasAttribute('data-render-error'));
    } else assert.ok(diagram.querySelector('svg'));
    window.close();
  }
});
