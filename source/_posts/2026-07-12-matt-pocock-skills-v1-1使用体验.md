---
title: Matt Pocock Skills v1.1 使用体验
tag:
  - AI
categories:
  - AI
article_type: 0
no_word_count: false
no_toc: false
no_date: false
no_declare: false
no_reward: false
no_comments: false
no_share: false
no_footer: false
mathjax: false
abbrlink: db62fe35
date: 2026-07-12 19:58:37
top:
---

　　因为 GPT-5.6 的发布，前两天每天都会有一次额度重置，这两次重置是到点直接重置的，没法存到 reset bank 里，加上台风天没法出门，于是我开着 5.6 Sol xHigh/Ultra 疯狂蹬，蹬掉了 7.5 亿 Token。<!-- more -->

<div style="text-align:center; margin:24px 0;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/01-gpt-5-6-reset.jpg" alt="GPT-5.6 Sol 额度重置与 Token 使用记录" style="width:100%; max-width:480px; height:auto;">
</div>

　　正好最近爆火的 Matt Pocock Skills 也更新到了 v1.1，于是蹬的时候尝试了他的 grill-with-docs -> to-spec -> to-tickets -> implement -> code-review 工作流，效果非常棒，尤其是最热门的 grill-with-docs / grill-me，会顺着你的想法一路往下挖，通过多轮的追问，把没说清楚的规则、没意识到的分支和藏在脑子里的隐含判断一个个拷打出来并收敛成一份 spec 文档，这个过程实在值得记录一下。

<div style="text-align:center; margin:24px 0;">
  <img src="https://s3.bmp.ovh/2026/11/04/RJILqpE0.jpg" alt="Matt Pocock Skills v1.1" style="width:100%; max-width:520px; height:auto;">
</div>

#  不是模型能力不行，而是需求根本没对齐

　　Matt 说他的 Skills 解决了一些软件开发中的常见痛点，作为灵魂的 grill-with-docs / grill-me 解决了下面两个最大的问题：

<ol>
  <li>
    <strong>The Agent Didn't Do What I Want.</strong>
    <ul>
      <li>你以为自己已经说清楚了，Agent 也以为自己听懂了，但看到结果才发现双方对目标的理解根本没有对齐，因为 “No-one knows exactly what they want.” ——《The Pragmatic Programmer》</li>
    </ul>
    <div style="text-align:center; margin:16px 0 24px;">
      <img src="https://s3.bmp.ovh/2026/11/04/42QeynfT.png" alt="The Agent Didn't Do What I Want" style="width:100%; max-width:560px; height:auto;">
    </div>
  </li>
  <li>
    <strong>The Agent Is Way Too Verbose.</strong>
    <ul>
      <li>开发和业务对同一个概念的口径可能不一致 & Agent 经常要在代码库中面对很多“黑话”，这两点会导致它的输出晦涩、冗余、漂移</li>
    </ul>
    <div style="text-align:center; margin:16px 0 24px;">
      <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/04-shared-language.png" alt="The Agent Is Way Too Verbose" style="width:100%; max-width:560px; height:auto;">
    </div>
  </li>
</ol>

# 先别急着写代码，让 AI 把需求问清楚

　　对于第一个痛点，Matt 的解决方法就是开启一个 grilling session，疯狂地拷打你。我看到一个比喻非常形象：只需要提供一根树干，grilling 会顺着它不断追问，让原本模糊的想法慢慢长出树枝和树叶。

　　我用下来的感受是：结合 5.6 Sol 这样的 SOTA 模型，真的可以扫清 99% 的边缘情况 & 细枝末节逻辑。

　　这两天正好有两个不同类型的需求，第一个是公司的业务需求，已经做过需求评审了，有一份详尽的 PRD（树干、树枝和树叶都有了）；另一个是我自己的需求，只有一个简单的想法（就是一根光秃秃的树干）。

　　对两个需求分别 grill-with-docs 后，前者补足了很多边缘情况，并把 PRD 里一些模糊的点逐个敲定，让这棵树更加完美；对于后者，它从头开始追问，把我的简单想法落地成了一个包含详细逻辑规则的具体实施方案，让一棵光秃秃的树干长出了树枝和树叶。

# 有了详细 PRD，AI 还能问出什么？

　　公司的需求大概是在某个中间节点增加一道审批，复杂点在于它会联动前面的订单数据和后续的入选履约流程，还要正确处理各种审批状态。

<div style="text-align:center; margin:24px 0;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/05-company-requirement-grilling.png" alt="公司需求的 Grilling Session" style="width:100%; max-width:680px; height:auto;">
</div>

　　整个 grilling session 加上我的几次 challenge，一共进行了 20 多轮，我的感受是：提出的这些问题都切在非常关键的节点，要么关系到核心流程，要么藏在细节里但迟早会在开发或上线后暴露出来，并且 90% 以上的 case，给出的推荐方案就是我心中的最优想法，我直接确认就好了。

　　即使是那 90% 我直接确认的 case，那些问题也非常有价值，因为 grilling 的价值并不只在于发现分歧，也在于确认共识。很多细节不可能全部体现在 PRD 中，如果不被主动问出来，就只能以隐含假设的形式存在。把它们逐一说清楚，再带到技术评审中和 PM 确认，可以显著减少开发过程中的理解偏差。

<div style="display:grid; gap:16px; max-width:560px; margin:24px auto;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/06-approval-status-grilling.png" alt="审批状态问题" style="width:100%; height:auto;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/07-selection-rules-grilling.png" alt="入选规则问题" style="width:100%; height:auto;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/08-context-md-created.png" alt="Grilling Session 创建 CONTEXT.md" style="width:100%; height:auto;">
</div>

# 一个 CONTEXT.md，解决业务和代码的口径差异

　　在第三张图中可以看到，Agent 创建了一个 `CONTEXT.md`，这正好对应 Matt 提到的第二个痛点：The Agent Is Way Too Verbose. 这里的“啰嗦”不只是话多，更深一层的原因是口径没有统一。业务、研发和代码库可能用不同的词指向同一个概念。Agent 一旦在这些口径之间来回切换，输出就容易变得晦涩、冗余，甚至逐渐漂移。

　　拿这个需求来说，「商单」有时会被称为「订单」或「合同」；业务口中的「产品明细」，到了研发语境里，又可能变成 Product 字段或接口。名称不同，指向的却是同一个底层概念。

　　`CONTEXT.md` 做的事情很简单：为这些业务术语下定义，并约定后续统一使用哪种表达。这样，Agent 不必每次都用一大段话重新解释，业务语言与代码之间也有了一套稳定的映射。

　　我的体感是，真的不要小看这个 Markdown 文件。在随后的 grilling 和各种输出中，阅读负担明显降低了很多，读起来非常的舒服且轻松。而且它位于项目根目录，也可以作为项目级上下文被后续 session 持续复用。

　　难怪 Matt 会说：It's hard to explain how powerful this is. It might be the single coolest technique in this repo. Try it, and see. 统一语言的价值很难在第一次看到 `CONTEXT.md` 时感受到，但只要经历过几轮 chat，就很难再回到没有它的时候。

<div style="text-align:center; margin:24px 0;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/09-context-md-glossary.png" alt="CONTEXT.md 业务术语定义" style="width:100%; max-width:680px; height:auto;">
</div>

# 只有一句“监控机票”，AI 能问出什么？

　　我自己的需求只有一句非常模糊的描述：“我想监控机票价格。” Grilling 随后用 15 个问题，一步步拆出了监控范围、触发条件、通知机制和筛选标准，甚至把我自己都无法准确描述的“合适机票”，变成了一组可以实现和验证的规则。

<div style="display:grid; gap:16px; max-width:560px; margin:24px auto;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/10-flight-monitor-grilling.png" alt="监控机票价格的 Grilling Session" style="width:100%; height:auto;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/11-flight-rules.png" alt="机票监控规则" style="width:100%; height:auto;">
  <img src="https://r.kezaihui.com/client/2026-08-09/image/yyx/12-flight-feedback.png" alt="机票筛选反馈" style="width:100%; height:auto;">
</div>

# The End

　　`grilling` 负责把需求问清楚，`CONTEXT.md` 负责让大家说同一种语言，后续的 spec、ticket、implement 和 review 再把这些东西变成一条可以执行、可以验证的链路。

　　前面这些事情做对了，代码反而只是最后自然长出来的结果。
