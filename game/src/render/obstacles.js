// 장애물 임시 그림. 크기는 config 의 충돌 상자와 똑같다 — 보이는 것이 곧 맞는 것.
// Gemini 장애물 그림이 오면 같은 변환 도구로 시트를 만들어 이 파일만 바꾼다.

import { OBSTACLES } from '../config.js';

const C = {
  rockFill: '#8b97a3', rockShade: '#6f7b87', rockLight: '#b4bec7', rockLine: '#4d5763',
  snow: '#ffffff', snowShade: '#dfe7ee', snowLine: '#8a9cad',
  hat: '#2f3440', carrot: '#e58a3a', coal: '#2f3440', scarf: '#c2836f',
  bird: '#3f4a5a', birdLight: '#6c7a8c', beak: '#e8a33d',
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

let cache = null;

function build() {
  const o = OBSTACLES;
  return {
    rock1: rocks(o.rock1.w, o.rock1.h, 1),
    rock2: rocks(o.rock2.w, o.rock2.h, 2),
    rock3: rocks(o.rock3.w, o.rock3.h, 3),
    snowman: snowman(o.snowman.w, o.snowman.h),
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
