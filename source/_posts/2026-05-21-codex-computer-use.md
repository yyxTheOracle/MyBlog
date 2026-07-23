---
title: Codex 的 Computer Use 真的好强...
tag:
  - AI
  - Codex
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
abbrlink: 2979ee1c
date: 2026-05-21 22:47:36
top:
---

两个月前还在调一套基于 Playwright 的 E2E Test Skill，没想到 Codex 的 Computer Use 直接就把端到端测试给解决了。<!-- more -->

<div style="text-align:center; margin:24px 0;">
  <img src="/images/2026-05-21/e2e_prompt.jpg" alt="Playwright E2E Agent Prompt Template" style="width:75%; max-width:760px;">
</div>

想起 4 月底 OpenAI 出的 [GPT-5.5 提示词指南](https://developers.openai.com/api/docs/guides/prompt-guidance?model=gpt-5.5) 有个很明显的转向：对于 5.5 这个级别的强推理模型，不用再像以前那样面向过程一步步告诉它怎么做，最佳实践反而是提示词越简单越好，只需要给 Expected Outcome、Constraints 和 Success Criteria，让模型自己去选择实现路径。

<div style="text-align:center; margin:24px 0;">
  <img src="/images/2026-05-21/GPT-5.5-prompt-guidance.png" alt="GPT-5.5 prompting guide" style="width:85%; max-width:900px;">
</div>

就像这个视频一样，我把原视频丢给 Codex，Prompt 就一句话：给我生成一个 16 倍速版本。Codex 直接用一段 Swift 脚本解决了。

<div style="position:relative; padding-bottom:56.25%; width:100%; height:0; margin:24px 0;">
  <iframe
    src="https://player.bilibili.com/player.html?bvid=BV1GhLh67EcH&page=1"
    scrolling="no"
    border="0"
    frameborder="no"
    framespacing="0"
    allowfullscreen="true"
    style="position:absolute; inset:0; width:100%; height:100%;">
  </iframe>
</div>

足够强的 Reasoning Capability，加上 Codex 最近出的 Computer Use 和 Chrome 插件，给目标 -> 开发 -> 验证 -> 修复 -> 再验证的 Goal-Driven Development Loop，感觉已经完全闭环了。
