---
title: '修改 antd 组件默认样式的坑丨:global 关键字'
tag:
  - antd
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
abbrlink: 30ad5bee
date: 2022-04-25 14:43:55
top:
---

# 前言
　　今天做一个 Modal 的时候，需要修改 antd Form 的一些默认样式。一开始感觉没啥问题，用 Chrome DevTools 在页面上找到 antd 组件内相应的元素，修改对应的 class 达到效果后复制到了 VSCode 里，但是，**页面完全没有变化！！！！！！！** <!-- more -->

<div align=center>
  <img src="https://s3.bmp.ovh/imgs/2023/01/02/3b7d499d006810f0.jpg" />
</div>
<center style="color:#C0C0C0;"> less 代码</center>

　　钻了 20 分钟没解决，赶紧去问 mentor, 津铭哥笑着和我说需要在外层加一个 `:global` 才能生效，试了下还真是！赶紧去补了下这个关键字的知识，在这里做一个记录。

# 坑
>　　在 React 项目中使用 scss/less，如果想让样式仅作用在某个组件，而不影响全局，一般都会把样式文件进行**模块化**，即打包后每个 class 名都会被自动**加上一串唯一的序列号**。

举个例子：

```css
    .main {
         width: 100px;
    }
```
&nbsp;
模块化后打包的结果会是：
```css
    .main__3D0Xe{ width: 100px; }
```
&nbsp;
　　而我们公司的框架自动做了样式的模块化，因此正是这串序列号导致无法正确选中 antd 组件内部元素的 class🤣。
# 解决方法
　　如果不想要这串序列号，那么在最外层套上一层 `:global` 即可～

<div align=center>
  <img src="https://s3.bmp.ovh/imgs/2023/01/02/63710433b803b78f.jpg" />
</div>
