# 搜索引擎维护

正式地址使用 [www.victoryeah.com](https://www.victoryeah.com/)。
本文记录仓库配置与日常操作；收录数量、额度和申请结果以搜索引擎后台为准。
原 README 的逐篇查询结果保存在 [2026-11-04 收录快照](history/2026-11-04-search-indexing.md)。

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
3. 在后台检查 Sitemap 是否已登记、能否抓取。Google 已有登记记录见历史快照；
   百度应登记 `baidusitemap.xml`，不要把 Sitemap 索引当成文章 `urlset`。
4. 少量重要页面可申请抓取，保留回执并后续核对实际收录；不要对已成功的申请反复提交。
5. 遇到额度限制，先查当前额度与成功记录；单批条数限制不等于每日剩余额度，不能据此保证次日恢复。
6. 验证失败时检查 DNS 和验证文件；Sitemap 抓取失败时检查 HTTP 状态、XML、域名及 robots。

## 参考

- [Google Sitemap 重抓规则](https://support.google.com/webmasters/answer/7451001)
- [Google 请求重新抓取](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)
- [百度普通收录与配额](https://ziyuan.baidu.com/college/courseinfo?id=267&page=2)
