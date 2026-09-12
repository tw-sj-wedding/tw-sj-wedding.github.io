import { FP, VIEW, STAGE1, TOTAL_PX, SPAWN_STOP_PX } from '../config.js';
import { getSprite, PALETTE } from './sprites.js';
import { mulberry32, randInt } from '../sim/rng.js';

// 점프 궤적 룩업 테이블. 렌더 전용이라 초월함수 제약을 받지 않지만,
// 시뮬이 이 값을 읽지 않도록 렌더 모듈 안에만 둔다.
const JUMP_LUT = (() => {
  const n = STAGE1.jumpTicks;
  const peak = 10;
  const out = new Int16Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out[i] = Math.round(peak * 4 * t * (1 - t));
  }
  return out;
})();

// 배경 눈 결정. 연출용 RNG는 시뮬 RNG와 완전히 분리한다.
const FX_RNG = mulberry32(0xc0ffee);
const FLECKS = Array.from({ length: 60 }, () => ({
  x: randInt(FX_RNG, VIEW.W),
  y: randInt(FX_RNG, 600),
  s: 1 + randInt(FX_RNG, 2),
}));

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let scale = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = canvas.parentElement.clientWidth;
    const availH = canvas.parentElement.clientHeight;
    const s = Math.max(1, Math.min(
      Math.floor((availW * dpr) / VIEW.W),
      Math.floor((availH * dpr) / VIEW.H),
    ));
    scale = s;
    canvas.width = VIEW.W * s;
    canvas.height = VIEW.H * s;
    canvas.style.width = `${(VIEW.W * s) / dpr}px`;
    canvas.style.height = `${(VIEW.H * s) / dpr}px`;
    ctx.imageSmoothingEnabled = false;
  }

  // 월드 y → 화면 y
  const screenY = (worldYFp, camFp) => VIEW.PLAYER_Y + (worldYFp - camFp) / FP;

  function drawBackground(camFp) {
    ctx.fillStyle = PALETTE.snow;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);

    ctx.fillStyle = PALETTE.shade;
    const camPx = camFp / FP;
    for (const f of FLECKS) {
      const y = (((f.y - camPx) % 600) + 600) % 600 - 150;
      if (y < -4 || y > VIEW.H) continue;
      ctx.fillRect(f.x, y, f.s, f.s);
    }
  }

  function drawFinale(camFp) {
    const y = screenY(SPAWN_STOP_PX * FP, camFp);
    if (y > VIEW.H) return;

    // 버진로드
    ctx.fillStyle = '#f6e7e1';
    ctx.fillRect(VIEW.W / 2 - 26, y, 52, VIEW.H - y);
    ctx.fillStyle = PALETTE.petal;
    ctx.fillRect(VIEW.W / 2 - 27, y, 1, VIEW.H - y);
    ctx.fillRect(VIEW.W / 2 + 26, y, 1, VIEW.H - y);

    // 꽃 아치와 신부는 결승선(TOTAL_PX)에 선다
    const goalY = screenY(TOTAL_PX * FP, camFp);
    const arch = getSprite('arch');
    ctx.drawImage(arch, VIEW.W / 2 - arch.width / 2, goalY - 6);
    const bride = getSprite('bride');
    ctx.drawImage(bride, VIEW.W / 2 - bride.width / 2, goalY + 12);
  }

  function drawObstacles(state, camFp) {
    for (const row of state.rows) {
      const y = screenY(row.worldYFp, camFp);
      if (y < -20 || y > VIEW.H + 20) continue;
      for (const it of row.items) {
        if (it.hit) continue;
        ctx.drawImage(getSprite(it.type), Math.round(it.xFp / FP), Math.round(y));
      }
    }
  }

  function drawPlayer(state, xFp) {
    // 무적 중에는 4틱 주기로 깜빡인다
    if (state.invincibleTicks > 0 && ((state.invincibleTicks >> 2) & 1) === 1) return;

    const lift = state.airborneTicks > 0
      ? JUMP_LUT[STAGE1.jumpTicks - state.airborneTicks]
      : 0;
    const groom = getSprite('groom');
    const x = Math.round(xFp / FP);
    const y = VIEW.PLAYER_Y - lift;

    if (lift > 0) {
      ctx.fillStyle = 'rgba(47,42,39,.16)';
      ctx.fillRect(x + 3, VIEW.PLAYER_Y + STAGE1.playerH - 2, 8, 2);
    }
    ctx.drawImage(groom, x, y);
  }

  function draw(state, prev, alpha) {
    // 보간은 렌더에만 쓴다. 시뮬 상태는 절대 건드리지 않는다.
    const camFp = prev.progressFp + (((state.progressFp - prev.progressFp) * alpha) | 0);
    const xFp = prev.playerXFp + (((state.playerXFp - prev.playerXFp) * alpha) | 0);

    ctx.save();
    ctx.scale(scale, scale);
    drawBackground(camFp);
    drawFinale(camFp);
    drawObstacles(state, camFp);
    drawPlayer(state, xFp);
    ctx.restore();
  }

  resize();
  return { resize, draw };
}
