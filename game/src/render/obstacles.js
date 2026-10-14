// 장애물 임시 그림. 크기는 config 의 충돌 상자와 똑같다 — 보이는 것이 곧 맞는 것.
// Gemini 장애물 그림이 오면 같은 변환 도구로 시트를 만들어 이 파일만 바꾼다.

import { OBSTACLES } from '../config.js';

const C = {
  rockFill: '#8b97a3', rockShade: '#6f7b87', rockLight: '#b4bec7', rockLine: '#4d5763',
  snow: '#ffffff', snowShade: '#dfe7ee', snowLine: '#8a9cad',
  hat: '#2f3440', carrot: '#e58a3a', coal: '#2f3440', scarf: '#c2836f',
  bird: '#3f4a5a', birdLight: '#6c7a8c', beak: '#e8a33d',
  jacket: '#d4553f', jacketDark: '#a63d2c', pants: '#2f3440', helmet: '#f2f4f6', goggle: '#2a3140',
  ski: '#3a7bd5', pole: '#8a96a3', line: '#3b2f2b',
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  return { c, ctx };
}

// 픽셀 단위 타원 (경로 채우기는 경계가 흐려져 픽셀아트와 안 어울린다)
function blob(ctx, cx, cy, rx, ry, fill, shade, light, line) {
  const inside = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = Math.floor(cy - ry); y < cy + ry; y++) {
    for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      ctx.fillStyle = edge ? line : dx + dy > 0.55 ? shade : dx + dy < -0.6 ? light : fill;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function rocks(w, h, count) {
  const { c, ctx } = canvas(w, h);
  const each = w / count;
  for (let i = 0; i < count; i++) {
    const rh = i % 2 === 0 ? h : h - 3;          // 높이를 번갈아 달리해 덩어리처럼
    blob(ctx, each * i + each / 2, h - rh / 2, each / 2 + (count > 1 ? 1 : 0), rh / 2,
      C.rockFill, C.rockShade, C.rockLight, C.rockLine);
  }
  return [c];
}

function snowman(w, h) {
  const { c, ctx } = canvas(w, h);
  blob(ctx, w / 2, h - 9, 9, 9, C.snow, C.snowShade, C.snow, C.snowLine);
  blob(ctx, w / 2, h - 21, 6.5, 6, C.snow, C.snowShade, C.snow, C.snowLine);
  ctx.fillStyle = C.hat;
  ctx.fillRect(w / 2 - 5, h - 28, 10, 1);
  ctx.fillRect(w / 2 - 3, h - 30, 6, 2);
  ctx.fillStyle = C.coal;
  ctx.fillRect(w / 2 - 3, h - 23, 1, 1);
  ctx.fillRect(w / 2 + 1, h - 23, 1, 1);
  ctx.fillStyle = C.carrot;
  ctx.fillRect(w / 2 - 5, h - 21, 4, 1);          // 신랑 쪽(왼쪽)을 본다
  ctx.fillStyle = C.scarf;
  ctx.fillRect(w / 2 - 5, h - 16, 10, 2);
  return [c];
}

function bird(w, h) {
  const frames = [];
  for (const wingsUp of [true, false]) {
    const { c, ctx } = canvas(w, h);
    const cy = Math.floor(h / 2) + 1;
    blob(ctx, w / 2 + 1, cy, 6, 3, C.birdLight, C.bird, C.birdLight, C.bird);
    ctx.fillStyle = C.bird;
    for (let i = 0; i < 6; i++) {                    // 날개: 위로 / 아래로 뻗은 삼각형
      const y = wingsUp ? cy - 1 - i : cy + 1 + i;
      ctx.fillRect(w / 2 - 2 + Math.floor(i / 2), y, 6 - i, 1);
    }
    ctx.fillRect(3, cy - 2, 3, 3);                   // 머리 (왼쪽 = 진행 방향)
    ctx.fillRect(w - 5, cy - 1, 4, 2);               // 꼬리 깃
    ctx.fillStyle = C.beak;
    ctx.fillRect(1, cy - 1, 2, 1);
    frames.push(c);
  }
  return frames;
}

// 1px 직선 (브레즌햄) — 스키·폴처럼 비스듬한 막대
function line(ctx, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) return;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// 넘어진 스키어: 등을 대고 누워 있고, 스키 한 짝은 눈에 박혀 비스듬히 서 있다
function skierDown(w, h) {
  const { c, ctx } = canvas(w, h);
  ctx.fillStyle = C.ski;                         // 바닥에 깔린 스키
  ctx.fillRect(14, h - 2, w - 14, 1);
  ctx.fillRect(w - 2, h - 3, 2, 1);              // 스키 앞코가 살짝 들림
  line(ctx, 26, h - 4, w - 3, 1);                // 박혀 선 스키
  ctx.fillStyle = C.pole;
  line(ctx, 9, h - 7, 14, 0);                    // 하늘로 뻗은 폴
  ctx.fillStyle = C.pants;                       // 다리
  ctx.fillRect(20, h - 6, 8, 3);
  ctx.fillStyle = C.jacket;                      // 몸통
  ctx.fillRect(7, h - 8, 14, 5);
  ctx.fillStyle = C.jacketDark;
  ctx.fillRect(7, h - 4, 14, 1);
  ctx.fillRect(11, h - 9, 3, 2);                 // 위로 든 팔
  blob(ctx, 4.5, h - 6.5, 3.5, 3.5, C.helmet, '#d5dbe1', C.helmet, C.line);   // 헬멧
  ctx.fillStyle = C.goggle;
  ctx.fillRect(5, h - 8, 3, 2);
  ctx.fillStyle = C.snow;                        // 넘어지며 튄 눈
  ctx.fillRect(0, h - 1, 3, 1);
  ctx.fillRect(18, h - 1, 2, 1);
  return [c];
}

let cache = null;

function build() {
  const o = OBSTACLES;
  return {
    rock1: rocks(o.rock1.w, o.rock1.h, 1),
    rock2: rocks(o.rock2.w, o.rock2.h, 2),
    rock3: rocks(o.rock3.w, o.rock3.h, 3),
    snowman: snowman(o.snowman.w, o.snowman.h),
    skierDown: skierDown(o.skierDown.w, o.skierDown.h),
    birdLow: bird(o.birdLow.w, o.birdLow.h),
    birdHigh: bird(o.birdHigh.w, o.birdHigh.h),
  };
}

// (x, y) = 장애물 충돌 상자의 왼쪽 위 (화면 좌표)
export function drawObstacle(ctx, type, x, y, animTick) {
  cache ??= build();
  const frames = cache[type];
  if (!frames) return;
  ctx.drawImage(frames[Math.floor(animTick / 10) % frames.length], x, y);
}
