const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/project-video.js'), 'utf8');

// 只模拟媒体播放和可见性边界，不读取视频文件或访问网络。
function player({ reduced = false, observer = true, playResult = () => Promise.resolve() } = {}) {
  const dom = new JSDOM('<video id="project-demo" muted loop playsinline controls preload="none"></video>', {
    url: 'http://localhost:4302/', runScripts: 'outside-only',
  });
  const { window } = dom;
  const video = window.document.querySelector('video');
  const state = { paused: true, hidden: false, plays: 0 };
  let observe;
  const media = { matches: reduced, addEventListener: (_, callback) => { media.change = callback; } };
  window.matchMedia = () => media;
  Object.defineProperty(window.document, 'hidden', { get: () => state.hidden });
  Object.defineProperty(video, 'paused', { get: () => state.paused });
  video.play = () => {
    state.plays++;
    state.paused = false;
    video.dispatchEvent(new window.Event('play'));
    return playResult();
  };
  video.pause = () => {
    if (state.paused) return;
    state.paused = true;
    video.dispatchEvent(new window.Event('pause'));
  };
  if (observer) {
    window.IntersectionObserver = class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
    };
  }
  window.eval(script);
  return {
    video, state, media,
    visible(ratio) { observe([{ isIntersecting: ratio > 0, intersectionRatio: ratio }]); },
    hidden(value) {
      state.hidden = value;
      window.document.dispatchEvent(new window.Event('visibilitychange'));
    },
    close() { window.close(); },
  };
}

// 等待播放 Promise 的结果处理，不使用真实播放时长。
async function settle() {
  await new Promise(setImmediate);
}

test('没有 IntersectionObserver 时保留原生 controls 兜底', () => {
  const p = player({ observer: false });
  assert.equal(p.video.controls, true);
  assert.equal(p.state.plays, 0);
  p.close();
});

test('进入视口即静音循环播放，离屏和后台暂停，回来后恢复', async () => {
  const p = player();
  assert.equal(p.video.controls, false);
  p.visible(0.01);
  await settle();
  assert.equal(p.video.muted, true);
  assert.equal(p.video.loop, true);
  assert.equal(p.video.paused, false);
  p.visible(0);
  assert.equal(p.video.paused, true);
  p.visible(1);
  await settle();
  p.hidden(true);
  assert.equal(p.video.paused, true);
  p.hidden(false);
  await settle();
  assert.equal(p.video.paused, false);
  assert.equal(p.state.plays, 3);
  p.close();
});

test('未完成的播放晚返回，也不能让离屏或后台视频继续播放', async () => {
  for (const leave of [p => p.visible(0), p => p.hidden(true)]) {
    let complete;
    const p = player({ playResult: () => new Promise(resolve => { complete = resolve; }) });
    p.visible(1);
    leave(p);
    assert.equal(p.video.paused, true);
    // 模拟底层播放晚完成，媒体状态被旧请求改回播放。
    p.state.paused = false;
    complete();
    await settle();
    assert.equal(p.video.paused, true);
    p.close();
  }
});

test('减少动态效果时默认静止并保留原生操作，偏好变化立即生效', async () => {
  const p = player({ reduced: true });
  p.visible(0.1);
  assert.equal(p.state.plays, 0);
  assert.equal(p.video.controls, true);
  await p.video.play();
  assert.equal(p.video.paused, false, '减少动态效果不阻止用户通过原生控件主动播放');
  p.visible(0);
  assert.equal(p.video.paused, true);
  p.visible(1);
  assert.equal(p.state.plays, 1, '减少动态效果时回到视口仍不自动播放');
  p.media.matches = false;
  p.media.change();
  await settle();
  assert.equal(p.video.controls, false);
  assert.equal(p.video.paused, false);
  p.media.matches = true;
  p.media.change();
  assert.equal(p.video.controls, true);
  assert.equal(p.video.paused, true);
  p.close();
});

test('自动播放拒绝后保留原生操作，不随进入视口反复重试', async () => {
  let reject = true;
  const p = player({ playResult: () => reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve() });
  p.visible(1);
  await settle();
  assert.equal(p.video.paused, true);
  assert.equal(p.video.controls, true);
  p.visible(0);
  p.visible(1);
  assert.equal(p.state.plays, 1);
  reject = false;
  await p.video.play();
  assert.equal(p.video.paused, false);
  assert.equal(p.state.plays, 2);
  p.close();
});

test('旧播放请求晚失败，不影响重新进入视口后的正常播放', async () => {
  let reject;
  let calls = 0;
  const p = player({ playResult: () => calls++ === 0 ? new Promise((_, fail) => { reject = fail; }) : Promise.resolve() });
  p.visible(1);
  p.visible(0);
  p.visible(1);
  await settle();
  reject(new Error('AbortError'));
  await settle();
  assert.equal(p.video.paused, false);
  assert.equal(p.video.controls, false);
  p.close();
});
