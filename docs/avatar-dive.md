# 首页潜水头像

首页第一屏支持把潜水员拖出相框，移动时留下气泡。鼠标和触屏共用 Pointer Events；点按或键盘 Enter / Space 播放一次短示范，Escape 结束。

- 开始拖动并靠近屏幕上下边缘时才滚页，单纯按住不滚动。
- 松手保留当前滚动位置，人物按相框的实时位置返航，即使相框已在视口外。
- 切到后台、失焦或手势取消时立即恢复原照并清理动画。
- 系统开启“减少动态效果”时仍可直接拖动，但不持续冒泡、不自动飞行。
- 分层素材下载或解码失败时保留原有静态头像。

实现位于 `themes/victor-preview/source/js/avatar-dive.js` 和 `source/css/avatar-dive.css`，由 `layout/layout.ejs` 只在首页第一页加载。原照 `source/img/avatar.jpg` 保持默认展示；`avatar-diver-v1.webp` 与 `avatar-seabed-v1.webp` 是从已确认原型的透明人物和补全海底素材压缩的 600 × 600 图层，总计约 80 KiB。更换照片时需要同步制作这两层，并更新模板中的资源地址。

回归检查：

```sh
node --test themes/victor-preview/test/avatar-dive.test.cjs
```

浏览器验收重点：拖到下边缘让页面滚动，再松手，人物返航后 `scrollY` 应与松手时一致；返航途中继续滚页也应落回相框。手机上确认头像外仍能正常滑动页面、头像保留原来的小尺寸，取消手势后可以再次拖动。
