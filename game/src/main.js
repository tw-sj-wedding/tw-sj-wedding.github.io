// 부트와 상태 머신. 고정 60Hz 틱 + accumulator (60Hz·120Hz 화면에서 속도가 같다).
// 모드: title → playing ⇄ paused → countdown → playing → over → (retry | title)

import { TICK_HZ, MAX_CATCHUP_TICKS, SCORE, ANIM, GAME_VERSION, API_BASE } from './config.js';
import { createRun, step, isOver, getScore, poseOf } from './sim/runner.js';
import { createRenderer } from './render/renderer.js';
import { loadSprites, drawPortrait } from './render/sprites.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createScreens } from './ui/screens.js';
import { createStorage } from './storage.js';
import { createApi, resolveApiBase } from './net/api.js';
import { createLeaderboard } from './ui/leaderboard.js';

const MS_PER_TICK = 1000 / TICK_HZ;
const IDLE_SPEED = 70;   // 타이틀 화면에서 배경이 흐르는 속도 (px/s)

const stage = document.getElementById('stage');
const canvas = document.getElementById('cv');
const renderer = createRenderer(canvas, stage);
const screens = createScreens(stage);
const storage = createStorage();
const audio = createAudio();
const api = createApi(resolveApiBase(API_BASE, location.search));
const input = createInput({
  jumpEl: document.getElementById('btn-jump'),
  duckEl: document.getElementById('btn-duck'),
  keyTarget: window,
});

let mode = 'title';
let character = storage.getCharacter() ?? 'groom';
let sim = null;
let prev = { distance: 0, playerY: 0 };
let acc = 0;
let last = performance.now();
let idleDistance = 0;
let clock = 0;            // 연출용 시간(초). 시뮬에는 쓰지 않는다
let lastFlashStep = 0;
let hintTimer = 0;
let overTimers = [];
let countdownTimer = 0;
let guardArmed = false;
let run = null;            // 이번 판의 리더보드 등록 정보 { tokenP, character, score, durationTicks, registered }
// 다음 판용 토큰을 미리 받아 둔다 — 판 시작 전에 발급된 토큰이어야 서버 시간 검사가 넉넉하다
let nextToken = api.enabled ? api.getToken() : null;

function layout() {
  const { groundCss } = renderer.resize();
  stage.style.setProperty('--ground-css', `${groundCss}px`);
}

function setMode(next) {
  mode = next;
  screens.show(next);
}

const leaderboard = createLeaderboard({ root: stage, api, storage, setMode });

function newSeed() {
  // 시뮬 밖이므로 Date/random 을 써도 된다. 시뮬은 이 seed 만 받는다.
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

// Android 뒤로가기·iOS 엣지 스와이프를 한 번 받아 이탈 대신 일시정지가 되게 한다
function armBackGuard() {
  if (guardArmed) return;
  history.pushState({ snowRun: true }, '');
  guardArmed = true;
}

function clearOverTimers() {
  for (const t of overTimers) clearTimeout(t);
  overTimers = [];
}

function startRun(c = character) {
  character = c;
  storage.setCharacter(c);
  audio.unlock();
  clearOverTimers();
  clearTimeout(countdownTimer);
  sim = createRun(newSeed());
  run = { tokenP: nextToken ?? (api.enabled ? api.getToken() : Promise.resolve(null)), character: c, score: 0, durationTicks: 0, registered: false };
  nextToken = api.enabled ? api.getToken() : null;
  prev = { distance: 0, playerY: 0 };
  input.reset();
  acc = 0;
  last = performance.now();
  lastFlashStep = 0;
  screens.setScore(0);
  screens.setHi(storage.getHi());
  armBackGuard();
  setMode('playing');

  if (!storage.hintSeen()) {
    screens.showHint(true);
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => screens.showHint(false), 5000);
  }
}

function gameOver() {
  const score = getScore(sim);
  const prevHi = storage.getHi();
  const hi = storage.setHi(score);
  input.reset();
  screens.showHint(false);
  storage.markHintSeen();
  screens.setOver({ score, hi, newRecord: score > prevHi && score > 0 });
  run.score = score;
  run.durationTicks = sim.tick;
  leaderboard.resetForRun(run);
  screens.setHi(hi);
  mode = 'over';
  // 넘어진 모습을 잠깐 보여 주고, 점프 버튼을 연타하던 손가락이 "다시 하기"를 바로 누르지 않게
  // 패널은 늦게 띄우고 버튼은 그보다 더 늦게 켠다.
  screens.enableOverButtons(false);
  overTimers.push(setTimeout(() => { if (mode === 'over') screens.show('over'); }, ANIM.overDelayMs));
  overTimers.push(setTimeout(() => screens.enableOverButtons(true), ANIM.overDelayMs + 350));
  screens.show('crashed');   // 패널 없이 HUD·버튼만 숨긴 상태
}

function pause() {
  if (mode === 'countdown') clearTimeout(countdownTimer);
  if (mode !== 'playing' && mode !== 'countdown') return;
  input.reset();
  setMode('paused');
}

function resume() {
  if (mode !== 'paused') return;
  input.reset();
  setMode('countdown');
  let n = 3;
  screens.setCountdown(n);
  const tick = () => {
    n -= 1;
    if (mode !== 'countdown') return;
    if (n > 0) {
      screens.setCountdown(n);
      countdownTimer = setTimeout(tick, ANIM.countdownMs);
    } else {
      last = performance.now();
      acc = 0;
      setMode('playing');
    }
  };
  countdownTimer = setTimeout(tick, ANIM.countdownMs);
}

function toTitle() {
  clearOverTimers();
  clearTimeout(countdownTimer);
  sim = null;
  input.reset();
  screens.setLastCharacter(storage.getCharacter());
  setMode('title');
}

function view(alpha) {
  if (!sim) {
    return {
      distance: idleDistance, playerY: 0, pose: 'run', animTick: Math.floor(clock * TICK_HZ),
      obstacles: [], character, timeSec: clock,
    };
  }
  return {
    distance: prev.distance + (sim.distance - prev.distance) * alpha,
    playerY: prev.playerY + (sim.playerY - prev.playerY) * alpha,
    pose: poseOf(sim),
    animTick: sim.tick,
    obstacles: sim.obstacles,
    character,
    timeSec: clock,
  };
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;

  if (mode === 'title') {
    clock += dt / 1000;
    idleDistance += (IDLE_SPEED * dt) / 1000;
    renderer.draw(view(0));
    return;
  }
  if (mode !== 'playing' || !sim) return;

  clock += dt / 1000;
  acc += dt;
  let steps = 0;
  while (acc >= MS_PER_TICK && steps < MAX_CATCHUP_TICKS && !isOver(sim)) {
    prev = { distance: sim.distance, playerY: sim.playerY };
    const inp = input.consume();
    if (inp.jump && !storage.hintSeen()) { storage.markHintSeen(); screens.showHint(false); }
    step(sim, inp);
    acc -= MS_PER_TICK;
    steps++;
  }
  if (steps === MAX_CATCHUP_TICKS) acc = 0;   // 따라잡기 포기 (느린 기기 보호)

  const score = getScore(sim);
  screens.setScore(score);
  const flashStep = Math.floor(score / SCORE.flashEvery);
  if (flashStep > lastFlashStep) { lastFlashStep = flashStep; screens.flash(); }

  if (isOver(sim)) {
    renderer.draw(view(1));
    gameOver();
    return;
  }
  renderer.draw(view(Math.min(1, acc / MS_PER_TICK)));
}

screens.onAction((action, data) => {
  if (action === 'pick') startRun(data.character === 'bride' ? 'bride' : 'groom');
  else if (action === 'retry') startRun();
  else if (action === 'pause') pause();
  else if (action === 'resume') resume();
  else if (action === 'change') toTitle();
  else if (action === 'register') leaderboard.openRegister();
  else if (action === 'register-cancel') leaderboard.cancelRegister();
  else if (action === 'board') leaderboard.openBoard('title');
  else if (action === 'board-close') leaderboard.close();
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
window.addEventListener('blur', pause);
window.addEventListener('popstate', () => {
  guardArmed = false;
  if (mode === 'playing' || mode === 'countdown') {
    pause();
    armBackGuard();
  } else if (mode === 'register' || mode === 'board') {
    // 등록·순위표에서 뒤로가기는 패널만 닫는다
    if (mode === 'register') leaderboard.cancelRegister(); else leaderboard.close();
    armBackGuard();
  } else {
    history.back();   // 게임 중이 아니면 뒤로가기는 그대로 이탈
  }
});
window.addEventListener('resize', () => { layout(); if (mode !== 'playing') renderer.draw(view(1)); });

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

layout();
input.attach();
screens.setApiAvailable(api.enabled);
screens.setLastCharacter(storage.getCharacter());
screens.setHi(storage.getHi());
setMode('title');
requestAnimationFrame(frame);

loadSprites('assets/').then((atlas) => {
  renderer.setAtlas(atlas);
  for (const c of screens.portraits()) drawPortrait(c, atlas, c.dataset.portrait);
});
