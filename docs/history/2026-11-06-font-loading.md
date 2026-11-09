# 2026-11-06 字体加载研究

针对首页“先显示一种字体，再切换为最终字体”的体验问题。资料核验日期为 2026-11-06；下列建议尚未实施，不代表线上优化结果。

## 第一手资料确认的事实

- **现代浏览器优先使用 WOFF2，只交付需要的字重。** 本站的 WOFF2、700 字重方向合理；自托管可省去第三方连接，但效果还取决于 CDN、HTTP/2 或 HTTP/3 与缓存，不能只凭“本地文件”断定更快。[Google：Optimize web fonts](https://web.dev/learn/performance/optimize-web-fonts)
- **中文字体尤其适合分片与子集。** `unicode-range` 让浏览器仅请求当前文字涉及的分片；它不会自动缩小二进制文件，实际字体也需裁剪。固定标题可以额外制作小子集，动态文章不能只保留今天出现的字。[Google：Reduce web font size](https://web.dev/articles/reduce-webfont-size)、[Google Fonts：text 参数](https://developers.google.com/fonts/docs/getting_started#optimizing_your_font_requests)
- **preload 只用于确定会使用的关键字体。** 它提前发现资源，但绕过 `unicode-range` 的按需选择；预载全部分片可能挤占图片与 CSS 带宽。字体 preload 即使同源也要 `crossorigin`，且不能保证任意网络条件下首屏就绪。[Google：Best practices for fonts](https://web.dev/articles/font-best-practices)、[Google：Optimize WebFont loading and rendering](https://web.dev/articles/optimize-webfont-loading)
- **内嵌字体声明与内嵌字体文件是两回事。** 少量关键 `@font-face` CSS 可以内嵌；Google 明确不推荐把字体二进制转成 base64 塞入 HTML/CSS：编码增加体积，还可能延迟主文档及后续关键资源发现。因此，把“首屏字体内嵌 HTML”作为默认最佳实践的建议过强，应纠正。[Google：Optimize web fonts](https://web.dev/learn/performance/optimize-web-fonts#inline_font-face_declarations)
- **缓存优化主要帮助重复访问。** 独立字体资源可以跨页面复用 HTTP 缓存；长期 `max-age` / `immutable` 应配合内容指纹或版本化 URL，更新内容就更换 URL。它们不能解决首次访问尚未下载的问题。[Google：HTTP Cache](https://web.dev/articles/http-cache)、[Chrome：Use efficient cache lifetimes](https://developer.chrome.com/docs/performance/insights/cache)

`font-display` 是产品取舍，不存在一项同时保证“立即显示、必为指定字体、任何网络都不切换”的设置：[W3C CSS Fonts 4](https://www.w3.org/TR/css-fonts-4/#font-display-desc)。

| 策略 | 字体未及时下载时的行为 | 代价 |
| --- | --- | --- |
| `swap` | 先显示备用字体，下载后替换 | 可见换字，尺寸不同时可能移动布局 |
| `optional` | 首次绘制用备用字体后，本次页面不再迟到替换 | 不保证本次访问显示指定字体；不同分片可能采用不同结果 |
| `block` | 先隐字等待，超时后显示备用字体，下载完成仍可替换 | 可能出现空白与后续切换，不适合作为通用默认 |
| 系统字体 | 直接使用设备已有字体 | 无网络字库等待，但设备间外观不同 |

## 当前博客的证据

- [fonts.css](../../themes/victor-preview/source/css/fonts.css) 的 101 个本地 Noto Serif SC 700 分片全部使用 `swap`；[layout.ejs](../../themes/victor-preview/layout/layout.ejs) 在首页、归档、分类、标签、关于页加载字体样式，目前没有字体 preload。
- [hero 标题](../../themes/victor-preview/layout/_partial/hero-title.ejs) 的“写代码，也记录生活想法日常。”按现有 CSS 范围命中 `093 / 095 / 096 / 097` 四个分片；本地文件大小分别为 39,024、35,916、31,496、55,384 bytes，合计 **161,820 bytes**。这是字形范围和文件大小核对，不是网络耗时实测。
- 当日对 [093 分片](https://www.victoryeah.com/fonts/noto-serif-sc-700-093.woff2) 执行 `curl -I`，收到 `HTTP/2 200`、`cache-control: public, max-age=0, must-revalidate`、`etag: "109940b2ce1dee0c40fb53d1f0604c90"`、`x-vercel-cache: HIT`、`content-length: 39024`。
- 上述响应表明 CDN 命中，不能称作“没有缓存”；浏览器缓存副本在过期后仍需验证，亦不能把 CDN 命中当成浏览器可长期免请求复用。[HTTP 缓存语义](https://web.dev/articles/http-cache)

## 针对本站的建议（工程判断）

1. 保留当前字体外观、WOFF2 自托管与完整分片兜底，正文继续使用系统字体；不新增字重，也不全量 preload。
2. 优先缩小首屏必须下载的字形集合。可以先测现有四分片的 preload；若体积仍是瓶颈，为固定 hero 文案制作独立小子集，并覆盖轮换词。子集继续作为外部 WOFF2，不默认塞进 HTML。
3. 为字体资源使用内容指纹或版本化 URL，再配置长效浏览器缓存；不要直接对可能原路径覆盖的资源承诺永久不变。
4. 根据目标选显示策略：优先消除迟到换字则选 `optional`，并接受慢网首访采用备用字体；若必须保留本次访问最终 Noto 效果，则继续围绕小字库、提前加载和接近的备用字体优化，不能宣称彻底无切换。
5. 验证需覆盖冷缓存、重复访问、慢网、失败请求和移动视口；比较首屏文字出现时间、实际字体、布局移动及头像/图片加载，不能只看“字体请求变快”。

本次仅研究资料、检查源文件和记录一个线上响应头；未修改应用代码、未运行浏览器验收、未部署。收益与字体显示策略仍需实际对比确认。

## 同日后续：本地实现与验证

- 首页首屏新增四个关键分片的 preload；101 个字体文件名加入 `v36`，二进制 SHA-256 均未变化，CSS 引用同步更新，继续使用 `swap`。
- 新增 `source/vercel.json`，只为版本化字体配置一年 `immutable` 缓存。官方 Vercel schema 与路由转换检查通过；Hexo 生成的 `public/vercel.json` 结构一致，101 个字体均匹配，HTML、CSS 和旧字体等路径不匹配。
- Chromium 对照中人为延迟字体 CSS 400ms：关键字体请求从约 435ms 开始变为约 19ms 开始；首页仍只请求 10 个分片、383,744 bytes 字体内容，没有新增或重复下载。该数字是本地对照结果，不是线上提速承诺。
- 本地静态服务器模拟上述缓存头，再次导航的字体传输量为 0；浏览器实际渲染字体仍为 Noto Serif SC，移动视口无横向溢出。
- Hexo 构建、26 项相关测试通过。完整测试执行时 48 项中 47 项通过，另一个同时进行的图表改动有 1 项 `diagram-space.test.cjs` 失败；本次未修改它。
- 该实现与测试已于 commit `5e51cbc`（2026-11-06）正式提交入库并发布上线；慢网首次访问仍可能发生字体切换。
