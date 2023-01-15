---
title: 拼音输入法的神奇 API丨onCompositionStart & onCompositionEnd
tag:
  - 前端开发
  - JavaScript
categories:
  - 前端开发
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
abbrlink: 11426bbe
date: 2022-12-08 14:17:45
top:
---

# 前言
　　最近开发遇到了一个很 tricky 的问题，直接上 gif，看了就明白了：<!-- more -->

![bug复现](https://s3.bmp.ovh/imgs/2023/01/01/9815a1854c8bffa4.gif)

　　可以明显看到，在搜狗拼音输入法**还没有完成输入的时候**就已经触发搜索了，此时根据拼音内容(一些英文)去搜索，会搜索不到任何结果，导致 Table 内显示空信息。

　　这明显不是我们想要的效果，我们所希望的应该是在**输入法完成输入（按下空格或回车）**后，再去触发搜索框的搜索。

# 解决方案
> onCompositionStart & onCompositionEnd

　　[这两个事件](https://developer.mozilla.org/en-US/docs/Web/API/CompositionEvent)确实第一次接触，以 `compositionstart event` 为例：
<div align=center>
  <img src="https://s3.bmp.ovh/imgs/2023/01/01/577af882fddac58b.jpg" />
</div>
<center style="color:#C0C0C0;">MDN 对 compositionstart event 的解释</center>

　　简单来说，搜狗拼音输入法就是图中所说的 `IME(Input Method Editor)` ，当开启一段 `composition session` 的时候就会触发这个事件，至于什么是 `composition session` 呢~

<div align=center>
  <img src="https://s3.bmp.ovh/imgs/2023/01/01/a4202af698e488f7.jpg" />
</div>  
&nbsp;

　　知道有这个 event 之后，一切也就豁然开朗了，我们可以引入一个 `lock` 变量，通过 `onCompositionStart` & `onCompositionEnd` 来维护；当且仅当 `lock` 为 `false` 的时候才触发搜索~

# （伪）代码
```jsx
  <Input
    onChange={e => setInputVal(e.target.value)}
    onCompositionStart={() => setLock(true)}
    onCompositionEnd={() => setLock(false)}
  />
```
```js
  useEffect(() => {
    // 输入拼音的情况下，选择了文字才搜索，正在输入拼音时不触发搜索
    !lock && triggerSearch(inputVal);
  }, [lock, inputVal]);
```

# 最终效果
![最终效果](https://s3.bmp.ovh/imgs/2023/01/01/4e3fad241e7bdbe7.gif)

# 总结
　　之前我一直以为这不是个前端范畴的问题，是系统层面的，事实证明还是认知局限呀🤣今后还是要多多学习，多多记录。
