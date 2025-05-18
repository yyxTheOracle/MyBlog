---
title: 究竟什么是 Event Loop丨总结 Philip Roberts 在 JSConf 的演讲
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
abbrlink: 2a798ab5
date: 2024-03-07 23:04:15
top:
---
  [26 分钟的视频](https://www.youtube.com/watch?v=8aGhZQkoFbQ&list=PLI-Ik-cyh3JN2usTBFpZAVVPezC2I-8gM&index=5)深入浅出地讲解了什么是 Event Loop 以及它与浏览器渲染的关系。<!-- more -->

  ## 对 JavaScript Runtime 的正确认识
  对于 JavaScript，我们常说 JS 有一个调用栈 (call stack)、有一个事件循环机制 (Event Loop)、有一个任务/回调队列 (task/callback queue) 以及一些 WebAPI，但这等价于 V8 也拥有以上这些东西吗？

  答案是：并非如此。 

  以 V8 为例，简单来看，它其实只包含一个堆 (heap) 和一个调用栈 (call stack)。
  
  如果 clone 一下 V8 的源码，会发现 setTimeout、DOM、HTTP Request 这些东西都是不在 V8 的源码中的。

  也就是说，V8 并不包括 Event Loop、callback queue 和其他的 WebAPIs。

  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/7848a596d0d408bb.jpg" />
  </div>

  由上图可以看出，JS 的浏览器运行环境包含三部分: 
  * V8 (JavaScript Runtime)
  * 浏览器提供的 WebAPIs (DOM、AJAX、setTimeout...) 
  * callback queue 
  
  这三者互相配合，共同实现了 Event Loop。

  ## The call stack
  `one thread === one call stack === one thing at a time`

  JavaScript 是一门单线程语言，也就是只有一个调用栈，即一次只能做一件事。

  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/9dffbb458ecfd50d.jpg" />
  </div>
  <center style="color:#C0C0C0;">抛错后的 stack trace</center>


  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/245adf7cc4cfe99e.jpg" />
  </div>
  <center style="color:#C0C0C0;">爆栈的报错</center>

  ## blocking 阻塞
  `What happens when things are slow?`

  慢的东西会阻塞调用栈

  什么是慢的/快的东西？以下是一些直观的理解：
  * console.log 不慢
  * 从 0 到 100亿 做一个 while 循环是慢的
  * 网络请求是慢的 

  假设所有的 network request 都是同步（串行）的，那我们要等待每一个请求都结束之后，才能运行其他的代码。

## Why is this a problem? because, browsers.
  blocking 会成为一个问题的一大原因，就是因为我们是在浏览器里运行代码。

  而阻塞性的代码，会卡住 call stack，从而**阻塞页面的渲染**。

## the solution? asynchronous callbacks
  `Here's a function. Call me maybe?`

  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/78ace090e55544cc.jpg" />
  </div>

  以这段简单的代码为例，执行到 setTimeOut 时，其中的 callback 就好像从 call stack 消失了一样。然后 5s 之后，又神奇地回到了 call stack 中，并被执行，其中到底有什么奥秘呢？


## Concurrency & the Event Loop
  `One thing at a time, except not really?`

  JavaScript Runtime 确实一次只能做一件事。但浏览器，并不只有 JavaScript Runtime。

  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/7848a596d0d408bb.jpg" />
  </div>
  <center style="color:#C0C0C0;">还记得这张图吗~</center>

  还是以 setTimeout 为例，正如上文提到的，setTimeout 并不存在于 runtime 中，而是由浏览器的提供的 WebAPI。

  setTimeout 接收一个 callback 和一个 delay，当执行到 setTimeout 时，便由 WebAPI 接管了（上文提到过，setTimeout 并不存在于 V8 源码中），在 WebAPI 接管后，setTimeout 本身会 pop 出 call stack。

  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/1c8358013ed2daa1.jpg" />
  </div>
  
  WebAPI 提供了计时器的功能，当 delay 的时间到了之后，WebAPI 并不会直接把 callback 塞到 call stack 中（如果真是如此的话，那 callback 很可能会突然地出现在正在执行的代码里，这肯定是不对的）。

  事实是，浏览器还提供了一个任务队列（回调队列），当倒计时结束后，这个 callback 将会进入这个队列中，等待进入 call stack。

  <div align=center>
    <img src="https://s3.bmp.ovh/imgs/2024/05/19/8b6b9225900c089f.jpg" />
  </div>

  这个时候，也就是 Event Loop 正式出场的时候。

  Event Loop 做的事情非常简单：看一眼 call stack，如果空了，那就从任务队列中取出第一个任务，塞到 call stack 中去执行。

  这个时候就得提到经典的 setTimeout(callback, 0) 了，通过上面的介绍，我们可以了解到这样写的目的，就是为了在 call stack 被清空的时候，才去执行 callback。

  AJAX 也是同理，AJAX 并不存在于 V8 中，而是由浏览器提供。请求的过程由 WebAPI 接手，因此并不会阻塞 call stack。即使这个请求永远不结束，也不会阻塞其他代码的执行 & 浏览器的渲染。

  Event Listener 也是同理。以 $.on('button', 'click', callback) 为例。WebAPIs 将会接手 click 事件的注册，当 click 发生时，WebAPIs 将会向任务队列中推入一个 callback。

  ## Event Loop 是如何配合浏览器渲染的？
  在 call stack 不为空时，浏览器是无法渲染的。
  
  可以把 render 也看作是一个 callback，有一个专门的 render queue，它的优先级比 task queue 更高。

  以 60 帧为例，每 16.6ms，浏览器就会把一个 render 加到 render queue （优先级更高的队列）中，但要等到 call stack 清空时，再进行 render。

  我们常说的“不要阻塞事件循环”，就是指不要在栈上执行又臭又长的同步代码，因为这样一来，浏览器就无法渲染了。








