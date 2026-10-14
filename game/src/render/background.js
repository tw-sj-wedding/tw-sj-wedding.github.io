// 하늘·먼 산·가까운 언덕·눈밭 + 내리는 눈. 전부 코드로 그린다.
// 지형은 고정 seed 의 연출용 RNG로 만든다 — 시뮬 RNG와 섞지 않는다.

import { mulberry32, randInt } from '../sim/rng.js';

const TILE = 800;   // 산·언덕 띠의 반복 폭
const SKY_TOP = [196, 217, 234], SKY_BOTTOM = [240, 246, 251], SKY_BANDS = 16;
const MOUNTAIN = { body: '#a7b9ca', shade: '#97aabc', cap: '#f4f8fb' };
const HILL = { body: '#cbd8e4', line: '#bccbd8' };
const GROUND = { snow: '#f8fbfd', line: '#c9d6e1', mark: '#e4ecf3' };

function layer(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return { c, ctx: c.getContext('2d') };
}

// 꺾은선 능선 → 열마다 높이와 사면 방향. 열 단위 fillRect 라 경계가 선명하다.
function ridge(rng, width, minH, maxH, peaks) {
  const pts = [];
  for (let i = 0; i <= peaks; i++) pts.push(minH + randInt(rng, maxH - minH + 1));
  pts[peaks] = pts[0];                       // 이어 붙였을 때 끊기지 않게
  const heights = new Array(width), falling = new Array(width);
  for (let x = 0; x < width; x++) {
    const f = (x / width) * peaks;
    const i = Math.floor(f), t = f - i;
    heights[x] = Math.round(pts[i] + (pts[i + 1] - pts[i]) * t);
    falling[x] = pts[i + 1] < pts[i];
  }
  return { heights, falling };
}

export function createBackground(W, H, groundY) {
  const rng = mulberry32(0x5eed5);

  const sky = layer(W, groundY);
  const band = Math.ceil(groundY / SKY_BANDS);
  for (let i = 0; i < SKY_BANDS; i++) {
    const t = i / (SKY_BANDS - 1);
    const [r, g, b] = SKY_TOP.map((v, j) => Math.round(v + (SKY_BOTTOM[j] - v) * t));
    sky.ctx.fillStyle = `rgb(${r},${g},${b})`;
    sky.ctx.fillRect(0, i * band, W, band);
  }

  const mH = 120;
  const mountains = layer(TILE, mH);
  const m = ridge(rng, TILE, 40, mH - 4, 9);
  m.heights.forEach((h, x) => {
    // 내려가는 사면(오른쪽 면)만 그늘 — 빛이 왼쪽 위에서 온다
    mountains.ctx.fillStyle = m.falling[x] ? MOUNTAIN.shade : MOUNTAIN.body;
    mountains.ctx.fillRect(x, mH - h, 1, h);
    if (h > 70) {
      mountains.ctx.fillStyle = MOUNTAIN.cap;
      mountains.ctx.fillRect(x, mH - h, 1, Math.min(h - 70, 14));
    }
  });

  const hH = 60;
  const hills = layer(TILE, hH);
  ridge(rng, TILE, 14, hH - 6, 14).heights.forEach((h, x) => {
    hills.ctx.fillStyle = HILL.body;
    hills.ctx.fillRect(x, hH - h, 1, h);
    hills.ctx.fillStyle = HILL.line;
    hills.ctx.fillRect(x, hH - h, 1, 1);
  });

  const ground = layer(W, H - groundY);
  ground.ctx.fillStyle = GROUND.snow;
  ground.ctx.fillRect(0, 0, W, H - groundY);
  ground.ctx.fillStyle = GROUND.line;
  ground.ctx.fillRect(0, 0, W, 2);
  const marks = Array.from({ length: 26 }, () => ({
    x: randInt(rng, W), y: 6 + randInt(rng, 34), w: 2 + randInt(rng, 6),
  }));

  const flakes = Array.from({ length: 46 }, () => ({
    x: randInt(rng, W), y: randInt(rng, groundY), s: 1 + randInt(rng, 2), v: 10 + randInt(rng, 14),
  }));

  const wrap = (v, m) => ((v % m) + m) % m;

  function scroll(ctx, img, factor, distance, y) {
    const off = wrap(Math.round(distance * factor), TILE);
    for (let x = -off; x < W; x += TILE) ctx.drawImage(img, x, y);
  }

  function draw(ctx, distance, timeSec) {
    ctx.drawImage(sky.c, 0, 0);
    scroll(ctx, mountains.c, 0.08, distance, groundY - 26 - mH);
    scroll(ctx, hills.c, 0.25, distance, groundY - hH);
    ctx.drawImage(ground.c, 0, groundY);

    // 눈밭 자국은 지면과 같은 속도로 흐른다 (속도감의 주 단서)
    ctx.fillStyle = GROUND.mark;
    for (const m of marks) ctx.fillRect(wrap(m.x - distance, W + 20) - 10, groundY + m.y, m.w, 1);

    ctx.fillStyle = '#ffffff';
    for (const f of flakes) {
      const x = wrap(f.x - distance * 0.4 - timeSec * 8, W);
      const y = wrap(f.y + timeSec * f.v, groundY);
      ctx.fillRect(Math.round(x), Math.round(y), f.s, f.s);
    }
  }

  return { draw };
}
