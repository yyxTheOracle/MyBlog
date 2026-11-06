# Victor 的自留地

[www.victoryeah.com](https://www.victoryeah.com/) 的源码仓库，记录前后端开发、AI Coding、踩坑复盘与生活随笔。

基于 **Hexo 6**，当前主题为 [`victor-preview`](themes/victor-preview/)。支持深浅配色、全文与章节搜索、年份归档、分类标签、代码复制与折叠、Mermaid 图表和 Waline 评论。

## 本地开发

安装 Node.js 和 npm 后：

```sh
git clone https://github.com/yyxTheOracle/MyBlog.git
cd MyBlog
npm ci
npm run server
```

打开 <http://localhost:4000/>。文章位于 `source/_posts/`，页面和样式位于 `themes/victor-preview/`。

本地预览不增加正式阅读量，但提交评论仍会写入正式评论服务。

## 写文章

```sh
npx hexo new "event-loop-part-2"
```

文件名自动带上日期，例如 `2026-11-05-event-loop-part-2.md`。编辑 Front Matter 中的标题、日期、分类和标签，再编写正文。

已发布文章保持 `date`、`url_slug` 和 `abbrlink` 不变；公开链接为 `/post/<url_slug>/`，评论和阅读量继续按旧 `/post/<abbrlink>.html` 标识关联。
图片、视频和附件保留原件备份。完整规则见 [写作与资源管理](docs/writing.md)。

## 验证与发布

源码与网站产物分开保存。**只推送 MyBlog 源码不会更新网站**：

```mermaid
flowchart LR
    A["MyBlog / main<br/>源码与文章"] -->|"npm run build"| B["public/<br/>静态产物"]
    B -->|"npm run deploy"| C["yyxTheOracle.github.io / main"]
    C -->|"Vercel 自动部署"| D["www.victoryeah.com"]
```

在仓库根目录执行测试和构建：

```sh
node --test themes/victor-preview/test/*.test.*
npm run clean
npm run build
```

检查本地页面与 Git diff，提交本次修改并推送源码，然后发布构建产物：

```sh
git status
git add <本次修改的文件>
git commit -m "<commit message>"
git push origin main
npm run deploy
```

`deploy` 目标由 [`_config.yml`](_config.yml) 指定，会推送 `public/` 到静态仓库，并可能强制更新其 `main`；不要直接修改产物仓库。
在 [Vercel 博客项目](https://vercel.com/yyxtheoracles-projects/yyx-the-oracle-github-io-g1lc) 确认 production deployment 为 `READY`，再检查正式网站。

## 目录速查

| 路径 | 用途 |
| --- | --- |
| [`source/_posts/`](source/_posts/) | 文章 Markdown |
| [`source/assets/`](source/assets/) | 随站发布的视频、图片和附件 |
| [`themes/victor-preview/`](themes/victor-preview/) | 当前主题的模板、样式、脚本与测试 |
| [`_config.yml`](_config.yml) | Hexo、永久链接、站点地图与部署配置 |
| [`themes/victor-preview/_config.yml`](themes/victor-preview/_config.yml) | 当前主题的评论配置 |
| `public/` | 构建生成的静态文件，不手工编辑 |

## 维护文档

| 文档 | 内容 |
| --- | --- |
| [写作与资源管理](docs/writing.md) | 文件命名、分类标签、永久链接、图床与原件备份 |
| [评论与阅读量](docs/waline.md) | Waline 配置、服务入口、数据归属与备份恢复 |
| [搜索引擎维护](docs/search.md) | Sitemap、站点验证与发布后的维护步骤 |
| [2026-11-04 收录记录](docs/history/2026-11-04-search-indexing.md) | 带日期的历史快照，不代表实时状态 |

旧版主题来源于 [Yilia](https://github.com/litten/hexo-theme-yilia) 与 [new-yilia](https://github.com/jackhanyuan/hexo-theme-new-yilia)，实现保留在 `themes/new-yilia/` 供历史参考。
