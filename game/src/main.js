import { FP, TICK_HZ, MAX_CATCHUP_TICKS, TOTAL_PX, GAME_VERSION } from './config.js';
import { createSim, step, isOver, getOutcome } from './sim/stage1.js';
import { createRenderer } from './render/renderer.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createScreens } from './ui/screens.js';

const MS_PER_TICK = 1000 / TICK_HZ;
const UNLOCK_KEY = 'twsj.stage2Unlocked';

const root = document.getElementById('app');
const canvas = document.getElementById('cv');
const stage = document.getElementById('stage');

const renderer = createRenderer(canvas);
const input = createInput(stage);
const audio = createAudio();
const screens = createScreens(root);

let sim = null;
let prev = { progressFp: 0, playerXFp: 0 };
let acc = 0;
let last = 0;
let mode = 'title';   // title | playing | paused | cleared | failed

function setMode(next) {
  mode = next;
  screens.show(next === 'playing' ? 'hud' : next);
}

function newSeed() {
  // 시뮬 밖이므로 Date/random을 써도 된다. 시뮬은 이 seed만 받는다.
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

function startRun() {
  audio.unlock();
  sim = createSim(newSeed());
  prev = { progressFp: sim.progressFp, playerXFp: sim.playerXFp };
  input.reset();
  acc = 0;
  last = performance.now();
  screens.setLives(sim.lives);
  screens.setProgress(0);
  setMode('playing');
  // Android 뒤로가기를 한 번 삼켜서 이탈 대신 일시정지가 되게 한다
  history.pushState({ game: 'playing' }, '');
}

function finish(outcome) {
  if (outcome === 'cleared') {
    try { localStorage.setItem(UNLOCK_KEY, '1'); } catch { /* 인앱에서 막힐 수 있다 */ }
  }
  setMode(outcome);
}

function pause() {
  if (mode !== 'playing') return;
  setMode('paused');
}

function resume() {
  if (mode !== 'paused') return;
  last = performance.now();
  acc = 0;
  setMode('playing');
}

function goHome() {
  window.location.href = '../';
}

function frame(now) {
  requestAnimationFrame(frame);

  if (mode !== 'playing' || sim === null) { last = now; return; }

  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;
  acc += dt;

  let steps = 0;
  while (acc >= MS_PER_TICK && steps < MAX_CATCHUP_TICKS && !isOver(sim)) {
    prev = { progressFp: sim.progressFp, playerXFp: sim.playerXFp };
    input.pumpKeyboard();
    step(sim, { targetXQ: input.targetXQ });
    acc -= MS_PER_TICK;
    steps++;
  }
  if (steps === MAX_CATCHUP_TICKS) acc = 0;   // 따라잡기 포기 (느린 기기 보호)

  screens.setProgress(sim.progressFp / FP / TOTAL_PX);
  screens.setLives(sim.lives);
  renderer.draw(sim, prev, Math.min(1, acc / MS_PER_TICK));

  if (isOver(sim)) finish(getOutcome(sim));
}

screens.onAction((action) => {
  if (action === 'start' || action === 'retry') startRun();
  else if (action === 'skip') { audio.unlock(); finish('cleared'); }
  else if (action === 'resume') resume();
  else if (action === 'home') goHome();
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
window.addEventListener('blur', pause);
window.addEventListener('popstate', () => { if (mode === 'playing') pause(); });
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => renderer.resize());

// 카톡 인앱이면 외부 브라우저 링크를 보험으로 노출한다 (기본 경로는 아니다)
if (/KAKAOTALK/i.test(navigator.userAgent)) {
  const a = document.getElementById('ext');
  if (a) {
    a.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
    a.hidden = false;
  }
}

// ?debug=1 일 때만 vConsole (카톡 웹뷰는 원격 디버깅이 사실상 불가)
if (new URLSearchParams(location.search).get('debug') === '1') {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/vconsole@3.15.1/dist/vconsole.min.js';
  s.onload = () => { new window.VConsole(); console.log('game version', GAME_VERSION); };
  document.head.appendChild(s);
}

input.attach();
setMode('title');
requestAnimationFrame(frame);
