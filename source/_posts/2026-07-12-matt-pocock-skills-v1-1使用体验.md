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
url_slug: matt-pocock-skills-v1-1
date: 2026-07-12 19:58:37
top:
---

　　由于 GPT-5.6 的发布，前两天每天都会有一次额度重置，这两次重置是到点直接硬重置的，没法存到 reset bank 里，加上台风天没法出门，于是我开着 5.6 Sol xHigh/Ultra 疯狂蹬，蹬掉了 7.5 亿 Token。<!-- more -->

{% compact %}
![GPT-5.6 Sol 额度重置与 Token 使用记录](https://s3.bmp.ovh/2026/11/05/ivNjuZze.webp)
{% endcompact %}

　　正好最近爆火的 Matt Pocock Skills 也更新到了 v1.1，于是蹬的时候尝试了他的 grill-with-docs -> to-spec -> to-tickets -> implement -> code-review 工作流，效果非常棒，尤其是最热门的 grill-with-docs / grill-me，会顺着你的想法一路往下挖，通过多轮的追问，把没说清楚的规则、没意识到的分支和藏在脑子里的隐含判断一个个拷打出来并收敛成一份 spec 文档，这个过程实在值得记录一下。

![Matt Pocock Skills v1.1](https://s3.bmp.ovh/2026/11/04/RJILqpE0.jpg)

# 和 Agent 协作的两大核心痛点

　　Matt 说他的 Skills 解决了一些软件开发中的常见痛点，作为灵魂的 grill-with-docs / grill-me 解决了下面两个最大的问题：

<ol>
  <li>
    <strong>The Agent Didn't Do What I Want.</strong>
    <ul>
      <li>你以为自己已经说清楚了，Agent 也以为自己听懂了，但看到结果才发现双方对目标的理解根本没有对齐，因为 “No-one knows exactly what they want.” ——《The Pragmatic Programmer》</li>
    </ul>
    <img src="https://s3.bmp.ovh/2026/11/04/42QeynfT.png" alt="The Agent Didn&#x27;t Do What I Want">
  </li>
  <li>
    <strong>The Agent Is Way Too Verbose.</strong>
    <ul>
      <li>开发和业务对同一个概念的口径可能不一致 & Agent 经常要在代码库中面对很多“黑话”，这两点会导致它的输出晦涩、冗余、漂移</li>
    </ul>
    <img src="https://s3.bmp.ovh/2026/11/05/KTapt8Hg.png" alt="The Agent Is Way Too Verbose">
  </li>
</ol>

　　对于第一个痛点，Matt 的解决方法就是开启一个 grilling session，疯狂地拷打你。我看到一个比喻非常形象：只需要提供一根树干，grilling 会顺着它不断追问，让原本模糊的想法慢慢长出树枝和树叶。

　　我用下来的感受是：结合 5.6 Sol 这样的 SOTA 模型，真的可以扫清 99% 的边缘情况 & 细枝末节逻辑。

　　这两天正好有两个不同类型的需求，第一个是公司的业务需求，已经做过需求评审了，有一份详尽的 PRD（树干、树枝和树叶都有了）；另一个是我自己的需求，只有一个简单的想法（就是一根光秃秃的树干）。

　　对两个需求分别 grill-with-docs 后，前者补足了很多边缘情况，并把 PRD 里一些模糊的点逐个敲定，让这棵树更加完美；对于后者，它从头开始追问，把我的简单想法落地成了一个包含详细逻辑规则的具体实施方案，让一棵光秃秃的树干长出了树枝和树叶。

# Case 1：给 PRD 查漏补缺 & 确定边界情况处理

　　公司的需求大概是在某个中间节点增加一道审批，复杂点在于它会联动前面的订单数据和后续的入选履约流程，还要正确处理各种审批状态。

![公司需求的 grilling session](https://s3.bmp.ovh/2026/11/05/BMRea65e.png)

　　整个 grilling session 加上我的几次 challenge，一共进行了 20 多轮，我的感受是：提出的这些问题都切在非常关键的节点，要么关系到核心流程，要么藏在细节里但迟早会在开发或上线后暴露出来，并且 90% 以上的 case，给出的推荐方案就是我心中的最优想法，我直接确认就好了。

　　即使是那 90% 我直接确认的 case，那些问题也非常有价值，因为 grilling 的价值并不只在于发现分歧，也在于确认共识。很多细节不可能全部体现在 PRD 中，如果不被主动问出来，就只能以隐含假设的形式存在。把它们逐一说清楚，再带到技术评审中和 PM 确认，可以显著减少开发过程中的理解偏差。

{% gallery 审批流程截图 %}
![审批状态问题](https://s3.bmp.ovh/2026/11/05/sGdyN3R4.png "审批状态问题")

![入选规则问题](https://s3.bmp.ovh/2026/11/05/FFbvnPfo.png "入选规则问题")

![grilling session 创建 CONTEXT.md](https://s3.bmp.ovh/2026/11/05/y4GvsqYK.png "grilling session 创建 CONTEXT.md")
{% endgallery %}

　　在第三张图中可以看到，Agent 创建了一个 `CONTEXT.md`，这正好对应 Matt 提到的第二个痛点：The Agent Is Way Too Verbose. 这里的“啰嗦”不只是话多，更深一层的原因是口径没有统一。业务、研发和代码库可能用不同的词指向同一个概念。Agent 一旦在这些口径之间来回切换，输出就容易变得晦涩、冗余，甚至逐渐漂移。

　　拿这个需求来说，「商单」有时会被称为「订单」或「合同」；业务口中的「产品明细」，到了研发语境里，又可能变成 Product 字段或接口。名称不同，指向的却是同一个底层概念。

　　`CONTEXT.md` 做的事情很简单：为这些业务术语下定义，并约定后续统一使用哪种表达。这样，Agent 不必每次都用一大段话重新解释，业务语言与代码之间也有了一套稳定的映射。

　　我的体感是，真的不要小看这个 Markdown 文件。在随后的 grilling 和各种输出中，阅读负担明显降低了很多，读起来非常的舒服且轻松。而且它位于项目根目录，也可以作为项目级上下文被后续 session 持续复用。

　　难怪 Matt 会说：It's hard to explain how powerful this is. It might be the single coolest technique in this repo. Try it, and see. 统一语言的价值很难在第一次看到 `CONTEXT.md` 时感受到，但只要经历过几轮 chat，就很难再回到没有它的时候。

![CONTEXT.md 业务术语定义](https://s3.bmp.ovh/2026/11/05/PRdGU6hO.png)

# Case 2：把模糊的想法梳理成具体的实施规则

　　我自己的需求只有一句非常模糊的描述：“我想监控机票价格。” grilling 随后用 15 个问题，一步步拆出了监控范围、触发条件、通知机制和筛选标准，甚至把我自己都无法准确描述的“合适机票”，变成了一组可以实现和验证的规则。

{% gallery 机票监控截图 %}
![监控机票价格的 grilling session](https://s3.bmp.ovh/2026/11/05/Jetl2QG0.png "监控机票价格的 grilling session")

![机票监控规则](https://s3.bmp.ovh/2026/11/05/YwjvufxF.png "机票监控规则")

![机票筛选反馈](https://s3.bmp.ovh/2026/11/05/v6HrUGMq.png "机票筛选反馈")
{% endgallery %}

# The End

　　平时大家用 AI 写代码，总觉得它写得不对是因为“代码能力不行”，但其实很多时候是因为从一开始就没有把需求真正聊明白。

　　通过 Matt 的 skills，在前期花个半小时，让 `grilling` 把脑子里那些模糊的边界和逻辑漏洞一个个问出来，用 `CONTEXT.md` 约定好口径，看似多花了一些时间，但可以让输入和上下文更干净，让后续的任务拆解和开发更轻松，省下的是后期更多的来回 debug 和反复对齐的时间～


