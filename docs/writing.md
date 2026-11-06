# 写作与资源管理

[返回 README](../README.md)

## 创建与命名

```sh
npx hexo new "event-loop-part-2"
```

文章保存在 `source/_posts/`，文件名使用 `YYYY-MM-DD-短标题.md`：

- 日期取 Front Matter 的 `date`，文章更新不改原发布日期。
- 短标题描述主题，不复制完整标题，也不包含分类。
- 使用中文、英文小写、数字和单个连字符；不用空格、下划线、Emoji 或其他标点。技术术语保留英文小写。
- 系列文章以 `part-N` 结尾，例如 `2024-03-07-event-loop-part-1.md`。

命名规则由 [`_config.yml`](../_config.yml) 的 `new_post_name` 指定，模板位于 [`scaffolds/post.md`](../scaffolds/post.md)。

## 分类、标签与链接

现有分类为「随笔、前端开发、后端开发、AI」；标签另有 JavaScript、Go。分类和标签是独立的文章集合，同名不代表同一批文章。
导航顺序在 [`topic-order.js`](../themes/victor-preview/scripts/topic-order.js) 中固定，新增分类或标签会保留入口并排在后面。

文章永久链接使用 `/post/<url_slug>/`，在 Front Matter 中显式填写 `url_slug`（小写英文、数字和连字符，例如 `go-worker-pool`），不要使用 Hexo 会从文件名覆盖的 `slug` 字段。`hexo new` 会以传入的短标题初始化 `url_slug`；发布前检查它有效且不重复。

已发布文章保持 `date`、`url_slug` 和 `abbrlink` 不变。旧 `/post/<abbrlink>.html` 不再提供文章访问或跳转，仅作为评论和阅读量的固定标识，不随公开 URL 改变。
发布前本地检查标题、日期、分类标签、代码、图片和链接；发布步骤见 [README](../README.md#验证与发布)。

## 图片、视频与附件

- 新增或更新资源后，将**原始文件**同步到 [blog-asset 备份仓库](https://github.com/yyxTheOracle/blog-asset)，按文章或用途整理。压缩、转码后的文件不能替代原件备份。
- 图片优先使用 ImgURL 图床（现有域名 `s3.bmp.ovh`）或公司 OSS（`r.kezaihui.com`）；现有公司 OSS 链接可继续使用。
- 上传后使用可直接访问的图片链接，检查页面显示，并记录备份文件与在线链接的对应关系；不要只保存外链。
- 视频和其他附件不必放到图片图床。当前天工演示视频、日志样例在 [`source/assets/electron-tiangong/`](../source/assets/electron-tiangong/)，随网站发布，同时保留原件备份。
- 头像和 favicon 可以继续随网站发布。
- 文章媒体的真实像素尺寸记录在 [`media-dimensions.json`](../themes/victor-preview/media-dimensions.json)，构建时自动补齐 `width` / `height`，保留手写显示宽度。新增或替换图片、视频后同步更新此清单（值为 `[宽, 高]`），或在 HTML 标签中填写准确尺寸；构建不会请求图床测量。已知尺寸的图片默认首张立即加载、后续懒加载。
- Mermaid 占位使用 [`diagram-dimensions.json`](../themes/victor-preview/diagram-dimensions.json) 中的源码哈希和实测 SVG 宽高。修改图表后，按渲染结果的 `viewBox` 更新对应记录；未命中的新图仍正常绘制，但不猜测占位比例。调整构建滤镜后先运行 `npm run clean` 再构建。
