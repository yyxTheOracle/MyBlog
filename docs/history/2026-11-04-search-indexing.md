# 2026-11-04 搜索收录快照

本页归档旧 README 中的站点验证与收录检查记录。
**以下均为截至 2026-11-04 约 14:58（北京时间）的历史结果，不代表当前状态。**
此次整理未重新查询搜索引擎后台；日常操作见 [搜索引擎维护](../search.md)。

## Google

当时 `victoryeah.com` 网域验证成功，[sitemap.xml](https://www.victoryeah.com/sitemap.xml)
提交成功，后台发现 39 个页面。该数字包含文章之外的页面，不等于 39 篇文章已收录。
15 篇文章分为以下三个互不重复的集合。

### 已收录：7 篇

14:38–14:43 的网址检查确认：

- [东詹与西詹](https://www.victoryeah.com/post/6308cf93.html)
- [上海国拍付款](https://www.victoryeah.com/post/47e794c4.html)
- [antd Table 全选](https://www.victoryeah.com/post/d87f7e0c.html)
- [antd global 样式](https://www.victoryeah.com/post/30ad5bee.html)
- [人生低谷](https://www.victoryeah.com/post/7709adb1.html)
- [Matt Pocock Skills](https://www.victoryeah.com/post/db62fe35.html)
- [雅典园校庆](https://www.victoryeah.com/post/310ea7d9.html)

除上海国拍外，其余 6 篇在完整标题查询第一页命中。
上海国拍虽已收录，当次标题搜索第一页未见目标文章。

### 申请成功，实际收录待核验：7 篇

- [Electron / 天工](https://www.victoryeah.com/post/2733f88e.html)：约 14:25 重试成功。
- [技术博客与演讲](https://www.victoryeah.com/post/435e2644.html)
- [提前转正复盘](https://www.victoryeah.com/post/ba9d0ab6.html)
- [拼音输入法 API](https://www.victoryeah.com/post/11426bbe.html)
- [验证码倒计时](https://www.victoryeah.com/post/9e1be607.html)
- [Event Loop](https://www.victoryeah.com/post/2a798ab5.html)
- [Go Worker Pool](https://www.victoryeah.com/post/12e2a8de.html)

后 6 篇在 14:48–14:56 申请成功。后台提示已加入优先抓取队列，
只证明申请被接收，未确认它们已经收录。

### 申请未成功：1 篇

[小程序 E2E Test](https://www.victoryeah.com/post/2979ee1c.html)
约 14:58 被“超出了每日配额”拒绝，页面提示明天再试。
当时待办是待 2026-11-05 配额恢复后重新申请，并核对前述 7 篇的实际索引与标题搜索结果；
**本页没有记录这些待办后来是否完成，也不保证配额已经恢复。**

## 百度

| 项目 | 当时记录 |
| --- | --- |
| 网站验证 | 文件验证成功 |
| 普通收录 | Electron 单条提交成功提示由用户确认；另外 14 篇因日上限提交失败 |
| 后台索引量 | 显示“数据计算中，请耐心等待”，不能据此认定为 0 |
| [baidusitemap.xml](https://www.victoryeah.com/baidusitemap.xml) | HTTP 200，标准 `urlset`，含 15 篇文章；[robots.txt](https://www.victoryeah.com/robots.txt) 已声明，后台尚未登记 |
| 提交额度 | 每日上限 / 余额为 **0 / 0**；存量文件上限 / 余额为 **1 / 1** |
| API 推送 | token 未配置，自动推送未启用；[baidu_urls.txt](https://www.victoryeah.com/baidu_urls.txt) 仅为全量文章链接清单 |

Electron 的 PC UA 抓取诊断在 14:25 成功。14:36–14:43 查询另外 14 篇的完整标题，
第一页均未见对应独立文章，个别查询只命中博客首页。抓取成功不等于收录，单条提交成功也只证明请求被接收。

当时待办包括等待额度开放后登记 `baidusitemap.xml`；API 未启用，不能把全量链接清单当成提交成功记录。
“存量余额 1”表示还能保存一个 Sitemap 文件，不能抵扣每日提交额度。
“每次最多 20 条”只是当时看到的单批限制；14 篇提交失败不能证明已消耗了成功提交额度。
原记录没有依据保证次日恢复额度，或办理备案即可解决限制。

## 查询方法与结论边界

- 当时全部 15 篇的公开 HTTP 200、canonical、标题 / H1、robots、Sitemap 覆盖和摘要均通过技术检查；这不能替代索引结果。
- 完整标题查询未加 `site:` 或引号，只检查第一页；排序可能受时间和个性化影响。
- `site:` 结果与页面估算数量不是全量索引统计，也不能证明已有收录由这次配置产生，或通用关键词排名提升。
- Google 的“实时测试可编入索引”、索引申请成功、实际已收录分别记录；即使已收录，也不保证完整标题搜索第一页命中。
