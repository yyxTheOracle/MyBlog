const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { JSDOM } = require('jsdom');

const script = readFileSync(require.resolve('../source/js/project-video.js'), 'utf8');

// 只模拟媒体播放和可见性边界，不读取视频文件或访问网络。
function player({ reduced = false, observer = true, playResult = () => Promise.resolve() } = {}) {
  const dom = new JSDOM('<video id="project-demo" muted loop playsinline controls preload="none"></video><button id="project-demo-toggle" hidden aria-controls="project-demo">播放演示</button>', {
    url: 'http://localhost:4302/', runScripts: 'outside-only',
  });
  const { window } = dom;
  const video = window.document.querySelector('video');
  const button = window.document.querySelector('button');
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
      constructor(callback, options) {
        observe = callback;
        assert.deepEqual([...options.threshold], [0, 0.25]);
      }
      observe() {}
    };
  }
  window.eval(script);
  return {
    video, button, state, media,
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
  assert.equal(p.button.hidden, true);
  assert.equal(p.state.plays, 0);
  p.close();
});

test('达到 25% 才静音自动播放，离屏和后台暂停，回来后恢复', async () => {
  const p = player();
  assert.equal(p.video.controls, false);
  assert.equal(p.button.hidden, false);
  p.visible(0.24);
  assert.equal(p.state.plays, 0);
  p.visible(0.25);
  await settle();
  assert.equal(p.video.muted, true);
  assert.equal(p.video.paused, false);
  assert.equal(p.button.textContent, '暂停演示');
  assert.equal(p.button.getAttribute('aria-label'), '暂停演示');
  p.visible(0);
  assert.equal(p.video.paused, true);
  assert.equal(p.button.textContent, '播放演示');
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

test('用户暂停覆盖未完成的播放请求，重新进入视口也不恢复', async () => {
  let complete;
  const p = player({ playResult: () => new Promise((resolve) => { complete = resolve; }) });
  p.visible(1);
  p.button.click();
  assert.equal(p.video.paused, true);
  // 模拟播放请求很晚才完成，且媒体状态已被它改回播放。
  p.state.paused = false;
  complete();
  await settle();
  assert.equal(p.video.paused, true);
  assert.equal(p.button.textContent, '播放演示');
  p.visible(0);
  p.visible(1);
  p.hidden(true);
  p.hidden(false);
  assert.equal(p.state.plays, 1);
  p.button.click();
  complete();
  await settle();
  assert.equal(p.state.plays, 2);
  assert.equal(p.video.paused, false);
  p.close();
});

test('减少动态效果时默认静止，手动播放仍可用', async () => {
  const p = player({ reduced: true });
  p.visible(0.1);
  assert.equal(p.state.plays, 0);
  p.button.click();
  await settle();
  assert.equal(p.video.paused, false, '用户点击播放不受自动播放的 25% 阈值限制');
  p.visible(0);
  assert.equal(p.video.paused, true);
  p.visible(1);
  await settle();
  assert.equal(p.video.paused, false, '用户已主动选择播放，回到视口可续播');
  p.button.click();
  p.visible(0);
  p.visible(1);
  assert.equal(p.video.paused, true);
  p.close();
});

test('自动播放拒绝后显示手动入口，不随进入视口反复重试', async () => {
  let reject = true;
  const p = player({ playResult: () => reject ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve() });
  p.visible(1);
  await settle();
  assert.equal(p.video.paused, true);
  assert.equal(p.button.textContent, '播放演示');
  assert.equal(p.button.getAttribute('aria-label'), '播放演示');
  p.visible(0);
  p.visible(1);
  assert.equal(p.state.plays, 1);
  reject = false;
  p.button.click();
  await settle();
  assert.equal(p.video.paused, false);
  assert.equal(p.state.plays, 2);
  p.close();
});
