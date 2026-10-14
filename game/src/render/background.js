// 하늘·먼 산·가까운 언덕·눈밭 + 내리는 눈. 전부 코드로 그린다.
// drawSky 는 수평, drawLand 는 렌더러가 슬로프 각도만큼 기울인 좌표계에서 부른다 —
// 기울이면 화면 밖이 드러나므로 땅·산 띠는 화면보다 넓게 그린다 (OVERSCAN).
// 지형은 고정 seed 의 연출용 RNG로 만든다 — 시뮬 RNG와 섞지 않는다.

import { mulberry32, randInt } from '../sim/rng.js';
import { LIFT, VIEW } from '../config.js';

const TILE = 800;   // 산·언덕 띠의 반복 폭
const OVERSCAN = 80;   // 기울인 좌표계에서 화면 오른쪽·아래를 덮으려고 더 그리는 폭
const SKY_TOP = [196, 217, 234], SKY_BOTTOM = [240, 246, 251], SKY_BANDS = 16;
const MOUNTAIN = { body: '#a7b9ca', shade: '#97aabc', cap: '#f4f8fb' };
const HILL = { body: '#cbd8e4', line: '#bccbd8' };
const GROUND = { snow: '#f8fbfd', line: '#c9d6e1', mark: '#e4ecf3' };
const LIFT_C = { tower: '#a3b1bf', towerDark: '#8e9dac', cable: '#6f7d8b' };

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

  const marks = Array.from({ length: 26 }, () => ({
    x: randInt(rng, W + OVERSCAN), y: 6 + randInt(rng, 34), w: 2 + randInt(rng, 6),
  }));

  const flakes = Array.from({ length: 46 }, () => ({
    x: randInt(rng, W), y: randInt(rng, groundY), s: 1 + randInt(rng, 2), v: 10 + randInt(rng, 14),
  }));

  const wrap = (v, m) => ((v % m) + m) % m;

  function scroll(ctx, img, factor, distance, y) {
    const off = wrap(Math.round(distance * factor), TILE);
    for (let x = -off - TILE; x < W + OVERSCAN; x += TILE) ctx.drawImage(img, x, y);   // 왼쪽도 한 장 더 (기울이면 드러난다)
  }

  function drawSky(ctx) {
    ctx.fillStyle = `rgb(${SKY_BOTTOM.join(',')})`;
    ctx.fillRect(0, groundY, W, H - groundY);   // 기울인 땅이 덮지만, 틈이 생겨도 하늘색이 보이게
    ctx.drawImage(sky.c, 0, 0);
  }

  function drawLand(ctx, distance, timeSec) {
    scroll(ctx, mountains.c, 0.08, distance, groundY - 26 - mH);
    scroll(ctx, hills.c, 0.25, distance, groundY - hH);
    ctx.fillStyle = GROUND.snow;
    ctx.fillRect(-OVERSCAN, groundY, W + OVERSCAN * 2, H);
    ctx.fillStyle = GROUND.line;
    ctx.fillRect(-OVERSCAN, groundY, W + OVERSCAN * 2, 2);

    // 눈밭 자국은 지면과 같은 속도로 흐른다 (속도감의 주 단서)
    ctx.fillStyle = GROUND.mark;
    for (const m of marks) ctx.fillRect(wrap(m.x - distance, W + OVERSCAN) - 10, groundY + m.y, m.w, 1);

    // 리프트: 기둥은 슬로프 옆에 선 배경이라 옅게, 지면과 같은 속도로 흐른다. 줄은 경사면과 나란히 늘 머리 위.
    // 기둥은 슬로프만큼 되돌려 화면 기준으로 똑바로 세운다 (중력 방향). 그만큼 길어져야 줄에 닿는다
    const slope = (VIEW.SLOPE_DEG * Math.PI) / 180;
    const towerLen = Math.ceil(LIFT.cableH / Math.cos(slope)) + 4;
    const first = Math.floor((distance - OVERSCAN) / LIFT.towerEvery) * LIFT.towerEvery + LIFT.towerEvery / 2;
    for (let wx = first; wx - distance < W + OVERSCAN; wx += LIFT.towerEvery) {
      ctx.save();
      ctx.translate(Math.round(wx - distance), groundY);
      ctx.rotate(-slope);
      ctx.fillStyle = LIFT_C.tower;
      ctx.fillRect(-1, -towerLen, 3, towerLen);   // 기둥
      ctx.fillRect(-8, -towerLen - 1, 17, 2);      // 위 가로대
      ctx.fillStyle = LIFT_C.towerDark;
      ctx.fillRect(-3, -2, 7, 3);                  // 받침
      ctx.fillRect(1, -towerLen, 1, towerLen - 2); // 그늘
      ctx.restore();
    }
    ctx.fillStyle = LIFT_C.cable;
    ctx.fillRect(-OVERSCAN, groundY - LIFT.cableH, W + OVERSCAN * 2, 1);

    ctx.fillStyle = '#ffffff';
    for (const f of flakes) {
      const x = wrap(f.x - distance * 0.4 - timeSec * 8, W);
      const y = wrap(f.y + timeSec * f.v, groundY);
      ctx.fillRect(Math.round(x), Math.round(y), f.s, f.s);
    }
  }

  return { drawSky, drawLand };
}
