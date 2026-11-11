# Victor 的自留地

[www.victoryeah.com](https://www.victoryeah.com/) 的源码仓库，记录前后端开发、AI Coding、踩坑复盘与生活随笔。

基于 **Hexo 6**，当前主题为 [`victor-preview`](themes/victor-preview/)。支持深浅配色、全文与章节搜索、年份归档、分类标签、代码复制与折叠、图片图组与全篇大图浏览、Mermaid 图表和 Waline 评论。

## 本地开发

安装 Node.js **20.9 或更新版本**和 npm 后（当前在 Node.js 22 验证）：

```sh
git clone https://github.com/yyxTheOracle/MyBlog.git
cd MyBlog
npm ci
npm run server
```

打开 <http://localhost:4000/>。文章位于 `source/_posts/`，页面和样式位于 `themes/victor-preview/`。

本地预览不增加正式阅读量，但提交评论仍会写入正式评论服务。
新增图片尚未准备时，预览会提示缺项；运行 `npm run images:prepare` 后重启预览即可使用适配资源。

## 写文章

```sh
npx hexo new "event-loop-part-2"
```

文件名自动带上日期，`url_slug` 初始化为 `event-loop-part-2`。编辑 Front Matter 中的标题、日期、分类和标签，再编写正文；首次构建会自动生成 `abbrlink`，不要复制其他文章的编号。

已发布文章保持 `date`、`url_slug` 和 `abbrlink` 不变；公开链接为 `/post/<url_slug>/`，新旧文章的评论和阅读量都按 `/post/<abbrlink>.html` 标识关联。这个标识不要求有对应网页；旧 hash 地址不保留跳转。
图片、视频和附件保留原件备份。完整规则见 [写作与资源管理](docs/writing.md)。
普通图片继续写 Markdown，紧凑图使用 `compact` 标签，同组图片使用 `gallery` 标签；具体示例见 [文章图片规范](docs/images.md)。构建会自动准备尺寸与正文适配图，GIF 保留动画；生成的图片资源和清单需要随文章一起提交。

## 验证与发布

源码与网站产物分开保存。**只推送 MyBlog 源码不会更新网站**：

```mermaid
flowchart LR
    A["MyBlog / main<br/>源码、文章与图片资源"] -->|"npm run build<br/>准备图片并校验"| B["public/<br/>静态产物"]
    B -->|"npm run deploy"| C["yyxTheOracle.github.io / main"]
    C -->|"Vercel 自动部署"| D["www.victoryeah.com"]
```

在仓库根目录先构建、再校验：首次构建会为新文章写入 `abbrlink`，检查该字段并随文章一并提交；随后测试检查链接名和评论标识是否有效、是否重复。

```sh
npm run clean
npm run build
node --test themes/victor-preview/test/*.test.*
```

`build` 会自动读取新图片、生成适配版并检查说明；缓存完整时不会重复请求图床。缺少替代文字、资源读取失败或图组不合规会阻止构建。只想离线检查已准备资源时，运行 `npm run images:check`。

检查本地页面与 Git diff，提交本次修改并推送源码，然后发布构建产物：

```sh
git status
git add <本次修改的文件>
git commit -m "<commit message>"
git push origin main
npm run deploy
```

`npm run deploy` 会重新准备图片、构建并复核资源，再执行发布；请使用这个入口，直接执行 `hexo deploy` 会绕过 npm 的发布前检查。新增的 `source/assets/article-images/` 和 `themes/victor-preview/image-assets.json` 要在推送源码前一起提交。
`deploy` 目标由 [`_config.yml`](_config.yml) 指定，会推送 `public/` 到静态仓库，并可能强制更新其 `main`；不要直接修改产物仓库。
在 [Vercel 博客项目](https://vercel.com/yyxtheoracles-projects/yyx-the-oracle-github-io-g1lc) 确认 production deployment 为 `READY`，再检查正式网站。

## 目录速查

| 路径 | 用途 |
| --- | --- |
| [`source/_posts/`](source/_posts/) | 文章 Markdown |
| [`source/assets/`](source/assets/) | 随站发布的视频、图片和附件 |
| [`source/assets/article-images/`](source/assets/article-images/) | 自动生成并持久保存的正文适配图与完整动画 |
| [`scripts/prepare-images.cjs`](scripts/prepare-images.cjs) | 图片准备与发布检查入口 |
| [`themes/victor-preview/`](themes/victor-preview/) | 当前主题的模板、样式、脚本与测试 |
| [`_config.yml`](_config.yml) | Hexo、永久链接、站点地图与部署配置 |
| [`themes/victor-preview/_config.yml`](themes/victor-preview/_config.yml) | 当前主题的评论配置 |
| `public/` | 构建生成的静态文件，不手工编辑 |

## 维护文档

| 文档 | 内容 |
| --- | --- |
| [写作与资源管理](docs/writing.md) | 文件命名、分类标签、永久链接、图床与原件备份 |
| [文章图片规范](docs/images.md) | 图片尺寸、图注、图组、大图浏览与自动准备流程 |
| [首页潜水头像](docs/avatar-dive.md) | 人物出框、气泡轨迹、滚动位置保留与分层素材 |
| [评论与阅读量](docs/waline.md) | Waline 配置、服务入口、数据归属与备份恢复 |
| [搜索引擎维护](docs/search.md) | 最新收录结果与待办（2026-11-11）、Sitemap 与日常维护 |

旧版主题来源于 [Yilia](https://github.com/litten/hexo-theme-yilia) 与 [new-yilia](https://github.com/jackhanyuan/hexo-theme-new-yilia)，实现保留在 `themes/new-yilia/` 供历史参考。
