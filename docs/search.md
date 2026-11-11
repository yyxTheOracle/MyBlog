# 搜索引擎维护

正式地址使用 [www.victoryeah.com](https://www.victoryeah.com/)。
本文记录仓库配置与日常操作；收录数量、额度和申请结果以搜索引擎后台为准。
## 当前结果（更新于 2026-11-11）

本次复查两篇新地址的 Google 收录和三篇文章的标题搜索，并核对百度提交回执。

| 项目 | 已确认结果 |
| --- | --- |
| Google 文章收录 | 15 篇新地址均已确认收录。此前 13 篇见已收录清单，11 月 11 日通过网址检查确认 Electron 和 Go Worker Pool 已编入索引。 |
| Google 标题搜索 | 11 月 11 日按完整标题抽查 Electron、Go Worker Pool 和小程序 E2E Test，第一页均出现正文新地址。上海国拍在 11 月 10 日的检查中也命中新地址。 |
| Google Sitemap | 最近一次读取于 11 月 10 日成功，发现 33 个页面。 |
| Google 标签页告警 | JavaScript 标签页已补齐 canonical，实际网址测试通过。重复页面告警仍显示修复前 11 月 4 日的抓取结果。Skills 已合并到 AI，旧入口保留跳转和 noindex，两份 Sitemap 均排除了旧入口。 |
| 百度文章提交 | 11 月 11 日手动提交成功 10/15 条文章新地址，包括 Electron、Go Worker Pool 和小程序 E2E Test。最后 5 条触发当日提交上限，待补交。 |
| 百度实际收录 | 截至 11 月 10 日，站点索引量仍为 3。11 月 11 日抽查 Electron 和小程序 E2E Test 的完整标题，第一页均未见正文链接，E2E 仅命中博客首页。已提交的 10 条新地址待核对实际收录。 |
| 百度 Sitemap | 11 月 11 日提交上限和余额均为 0，尚未登记。 |
| 百度 API 推送 | 未启用。 |

### 待办

- 百度手动提交额度恢复后，补交剩余 5 条新地址：[人生 setback](https://www.victoryeah.com/post/graduation-setback/)、[antd 样式覆盖](https://www.victoryeah.com/post/antd-style-overrides/)、[antd Table 组件外全选](https://www.victoryeah.com/post/antd-table-external-selection/)、[上海国拍](https://www.victoryeah.com/post/shanghai-plate-payment-pitfalls/)、[东詹与西詹](https://www.victoryeah.com/post/two-james-two-fates/)。
- 继续核对百度已提交文章的实际收录和标题搜索结果。
- 百度 Sitemap 额度开放后登记 `baidusitemap.xml`，并核对抓取结果。
- 等待 Google 重新抓取 JavaScript 标签页后，复查重复页面告警。

## 当前文章地址

15 篇文章统一使用 `/post/<url_slug>/`。仓库现有迁移记录说明旧 `/post/<abbrlink>.html` 地址返回 404，不保留跳转；站内链接、canonical、Open Graph、RSS、两份 Sitemap 和百度 URL 清单均使用新地址。

后续提交与检查应使用新地址，例如 [小程序 E2E Test](https://www.victoryeah.com/post/codex-computer-use-e2e/) 和 [上海国拍付款](https://www.victoryeah.com/post/shanghai-plate-payment-pitfalls/)。迁移前的提交及收录记录不能视为新地址已收录；本次未重新核验旧地址 HTTP 状态。

## 站点配置

[`_config.yml`](../_config.yml) 的 `url` 统一配置公开地址，Open Graph、RSS 和站点地图使用这个域名，
并与 [`source/robots.txt`](../source/robots.txt) 中的声明保持一致。

| 产物 | 用途 |
| --- | --- |
| [sitemap.xml](https://www.victoryeah.com/sitemap.xml) | 常规站点地图 |
| [baidusitemap.xml](https://www.victoryeah.com/baidusitemap.xml) | 百度使用的文章 `urlset` |
| [baidu_urls.txt](https://www.victoryeah.com/baidu_urls.txt) | 构建时生成的全量文章链接清单 |

构建会更新这些文件。当前 `baidu_url_submit.token` 为空，部署配置只有 Git，
**生成链接清单不代表调用百度 API 提交**。以后若启用主动推送，只提交本次新增链接；
凭证留在本地私有配置中，不提交到 Git。

## 后台入口

- [Google Search Console](https://search.google.com/search-console)：查看 Sitemap、网址检查和实际索引状态。
- [百度普通收录](https://ziyuan.baidu.com/linksubmit)：查看验证、Sitemap 登记、提交额度和处理结果。

提交被接收、页面被抓取、实际收录和搜索排名是不同结果，应分别记录。
完整标题或 `site:` 查询可以辅助观察，但不能替代后台索引结果。

## 保留所有权验证

以下信息沿用既有验证记录，此次文档整理没有重新查询 DNS 或验证后台：

- Google 使用 DNSPod 的独立子域 CNAME：主机记录 `7t2wjykjtu7g`，
  记录值 `gv-krzaixrabqune4.dv.googlehosted.com`，TTL `600`。
  保留该记录，不要为重新验证在 `@` 上添加 TXT，影响现有 CNAME。
- 百度验证文件为 [`source/baidu_verify_codeva-x0BqP1JVjT.html`](../source/baidu_verify_codeva-x0BqP1JVjT.html)。
  构建时会复制到网站根目录，验证后仍需保留。

## 日常发布与排查

1. 按 [README 的发布流程](../README.md) 更新静态网站。只推送 `MyBlog` 源码不会更新正式站点。
2. 确认新文章返回 HTTP 200，并出现在两份线上 Sitemap 中；检查标题、页面公开地址与 robots 规则。
3. 在后台检查 Sitemap 是否已登记、能否抓取。Google 已登记；
   百度应登记 `baidusitemap.xml`，不要把 Sitemap 索引当成文章 `urlset`。
4. 少量重要页面可申请抓取，保留回执并后续核对实际收录；不要对已成功的申请反复提交。
5. 遇到额度限制，先查当前额度与成功记录；单批条数限制不等于每日剩余额度，不能据此保证次日恢复。
6. 验证失败时检查 DNS 和验证文件；Sitemap 抓取失败时检查 HTTP 状态、XML、域名及 robots。

## 参考

- [Google Sitemap 重抓规则](https://support.google.com/webmasters/answer/7451001)
- [Google 请求重新抓取](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [百度普通收录与配额](https://ziyuan.baidu.com/college/courseinfo?id=267&page=2)
