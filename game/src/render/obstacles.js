// 장애물 그림. Gemini 그림이 있는 종류는 시트(assets/obstacles.png, scripts/build-sprites.mjs 가 만든다)를
// 쓰고, 없는 종류는 여기서 코드로 그린 임시 그림(크기 = 충돌 상자)을 쓴다.
// 시트 그림은 충돌 상자보다 작지 않게 만든다 — 허공에 맞는 일이 없도록 (tests/obstacle-art.test.mjs).

import { OBSTACLES, VIEW, LIFT } from '../config.js';

const C = {
  rockFill: '#8b97a3', rockShade: '#6f7b87', rockLight: '#b4bec7', rockLine: '#4d5763',
  snow: '#ffffff', snowShade: '#dfe7ee', snowLine: '#8a9cad',
  hat: '#2f3440', carrot: '#e58a3a', coal: '#2f3440', scarf: '#c2836f',
  jacket: '#d4553f', jacketDark: '#a63d2c', pants: '#2f3440', helmet: '#f2f4f6', goggle: '#2a3140',
  ski: '#3a7bd5', pole: '#8a96a3', line: '#3b2f2b',
  seat: '#555c64', seatDark: '#363b41', seatLight: '#a3acb5', metal: '#3f4750',   // 의자는 산(회청색)에 묻히지 않게 진한 회색 + 밝은 테
  cabin: '#f2c230', cabinDark: '#c99716', cabinLine: '#6e520c', glass: '#bfe0f2', glassLight: '#e8f5fc',
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

// 리프트 의자 (옆모습, 오르막 = 왼쪽을 본다). 걸이는 drawLiftCar 가 줄까지 잇는다.
// 그림은 충돌 상자(아래 14줄)보다 위로만 크다 — 등받이는 상자 위로 솟고, 상자 아래로는 나가지 않아
// 숙인 캐릭터가 그림에 닿아 보이는데 안 걸리는 일은 없다
const CHAIR_H = 32;
const CHAIR_HANGER_X = 17;   // 그림 왼쪽에서 걸이까지
function chair(w) {
  const { c, ctx } = canvas(w, CHAIR_H);
  ctx.fillStyle = C.metal;
  ctx.fillRect(CHAIR_HANGER_X, 0, 1, 3);          // 걸이가 등받이로 이어지는 부분
  ctx.fillRect(5, 15, 11, 1);                      // 팔걸이
  ctx.fillRect(5, 16, 1, 4);
  ctx.fillRect(3, 25, 1, 5);                       // 발판 지지대
  ctx.fillRect(0, 30, 8, 2);                       // 발판 (그림 맨 아래 = 상자 밑변)
  ctx.fillStyle = C.seat;
  ctx.fillRect(15, 3, 4, 19);                      // 등받이 (좌석 위로 높게)
  ctx.fillRect(3, 20, 16, 4);                      // 좌석
  ctx.fillStyle = C.seatDark;
  ctx.fillRect(3, 24, 16, 1);                      // 좌석 밑면
  ctx.fillRect(18, 3, 1, 19);                      // 등받이 뒷면
  ctx.fillStyle = C.seatLight;
  ctx.fillRect(15, 3, 3, 1);                       // 등받이 윗면 빛
  ctx.fillRect(15, 4, 1, 16);                      // 등받이 앞면 빛
  ctx.fillRect(3, 20, 12, 1);                      // 좌석 윗면 빛
  return [c];
}

// 곤돌라 캐빈 (옆모습). 판정 상자와 같은 너비, 위로만 높다 — 의자와 같은 이유로 상자 아래·옆으로 나가지 않는다
const GONDOLA_H = 30;
const GONDOLA_HANGER_X = 11;
function gondola(w) {
  const { c, ctx } = canvas(w, GONDOLA_H);
  const px = (x, y, wd, ht, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, wd, ht); };
  px(GONDOLA_HANGER_X - 1, 0, 3, 2, C.metal);       // 지붕 위 걸이 고정쇠
  px(2, 2, w - 4, 1, C.cabinLine);                  // 지붕 (모서리 둥글게)
  px(1, 3, w - 2, 1, C.cabinLine);
  px(0, 4, w, GONDOLA_H - 6, C.cabinLine);          // 외곽선
  px(1, 4, w - 2, GONDOLA_H - 7, C.cabin);          // 몸통
  px(2, 7, 8, 10, C.glass);                         // 창 두 칸
  px(12, 7, 8, 10, C.glass);
  px(3, 8, 2, 4, C.glassLight);                     // 유리 반사
  px(13, 8, 2, 4, C.glassLight);
  px(1, 19, w - 2, 1, C.cabinDark);                 // 허리 줄
  px(1, GONDOLA_H - 5, w - 2, 2, C.cabinDark);      // 아랫단 그늘
  px(1, GONDOLA_H - 2, w - 2, 1, C.cabinLine);      // 바닥 (둥글게)
  px(3, GONDOLA_H - 1, w - 6, 1, C.cabinLine);
  return [c];
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
let atlas = null;   // { img, types: { skierDown: [{x,y,w,h}, …] } }

export async function loadObstacleAtlas(base) {
  try {
    const meta = await fetch(`${base}obstacles.json`).then((r) => (r.ok ? r.json() : null));
    if (!meta?.types) return null;
    const img = new Image();
    img.src = `${base}obstacles.png`;
    await img.decode();
    atlas = { img, types: meta.types };
  } catch {
    atlas = null;   // 그림이 없어도 임시 그림으로 계속 간다
  }
  return atlas;
}

// 같은 장애물은 지나가는 동안 같은 그림, 장애물마다는 섞이게 — 월드 x 로 고른다 (시뮬은 모른다)
export const pickFrame = (frames, o) => frames[Math.abs(Math.floor(o.x)) % frames.length];

// 그림을 충돌 상자 가로 가운데, 바닥에 맞춘다. 반환값은 상자 왼쪽 아래 기준 오프셋
export const framePlacement = (o, f) => ({ dx: Math.floor((o.w - f.w) / 2), dy: -f.h });

function build() {
  const o = OBSTACLES;
  return {
    rock1: rocks(o.rock1.w, o.rock1.h, 1),
    rock2: rocks(o.rock2.w, o.rock2.h, 2),
    rock3: rocks(o.rock3.w, o.rock3.h, 3),
    snowman: snowman(o.snowman.w, o.snowman.h),
    skierDown: skierDown(o.skierDown.w, o.skierDown.h),
    lift: [...chair(o.lift.w), ...gondola(o.lift.w)],   // drawLiftCar 가 LIFT_CARS 순서로 고른다
  };
}

// (x, bottomY) = 장애물 충돌 상자의 왼쪽 아래 (화면 좌표)
export function drawObstacle(ctx, o, x, bottomY, animTick) {
  const art = atlas?.types[o.type];
  if (art) {
    const f = pickFrame(art, o);
    const { dx, dy } = framePlacement(o, f);
    ctx.drawImage(atlas.img, f.x, f.y, f.w, f.h, x + dx, bottomY + dy, f.w, f.h);
    return;
  }
  cache ??= build();
  const frames = cache[o.type];
  if (!frames) return;
  if (o.type === 'lift') { drawLiftCar(ctx, o, frames, x, bottomY); return; }
  ctx.drawImage(frames[Math.floor(animTick / 10) % frames.length], x, bottomY - o.h);
}

// 리프트 의자·곤돌라는 줄에 매달려 있으니 슬로프만큼 되돌려 화면 기준으로 똑바로 세운다 (픽셀도 돌지 않아 또렷하다).
// 상자 가운데를 축으로 돌리고, 걸이를 위로 줄 높이까지 늘인다. 어느 쪽을 그릴지는 월드 x 로 (시뮬은 모른다)
const LIFT_CARS = [{ h: CHAIR_H, hangerX: CHAIR_HANGER_X }, { h: GONDOLA_H, hangerX: GONDOLA_HANGER_X }];
function drawLiftCar(ctx, o, frames, x, bottomY) {
  const i = Math.abs(Math.floor(o.x)) % LIFT_CARS.length;
  const img = frames[i], { h: artH, hangerX } = LIFT_CARS[i];
  const slope = (VIEW.SLOPE_DEG * Math.PI) / 180;
  const hanger = Math.ceil((LIFT.cableH - o.y - artH) / Math.cos(slope)) + 2;
  ctx.save();
  ctx.translate(x + o.w / 2, bottomY - o.h / 2);
  ctx.rotate(-slope);
  const left = -Math.floor(o.w / 2), top = Math.ceil(o.h / 2) - artH;   // 그림 밑변 = 상자 밑변
  ctx.fillStyle = C.metal;
  ctx.fillRect(left + hangerX, top - hanger, 1, hanger);
  ctx.fillRect(left + hangerX - 1, top - hanger, 3, 3);   // 줄을 잡는 집게
  ctx.drawImage(img, left, top);
  ctx.restore();
}
