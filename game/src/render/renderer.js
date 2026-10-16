// 캔버스 배율과 그리기. 보이는 가로는 항상 논리 400 (리더보드 공정성 — 기기마다 앞이 보이는 거리가 같다).
// 내부 해상도는 400 x k (k = ceil(물리폭 / 400), 정수)로 그리고 CSS 로 화면 폭에 맞춰 약간 줄인다.
// 축소 비율이 (k-1)/k 보다 커서 픽셀 두께 차이는 최대 1물리px — 눈으로는 구분되지 않는다.

import { VIEW, ANIM, TICK_HZ } from '../config.js';
import { createBackground } from './background.js';
import { drawObstacle } from './obstacles.js';
import { drawCharacter } from './sprites.js';
import { drawSpeedLines, drawSpray } from './effects.js';

export function createRenderer(canvas, container) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let k = 1, H = 700, groundY = 420, cssPerUnit = 1;
  let bg = null;
  let atlas = null;

  function resize() {
    const cssW = Math.max(1, container.clientWidth);
    const cssH = Math.max(1, container.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    k = Math.max(1, Math.ceil((cssW * dpr) / VIEW.W));
    H = Math.max(320, Math.round((VIEW.W * cssH) / cssW));
    groundY = Math.round(H * VIEW.GROUND_RATIO);
    cssPerUnit = cssW / VIEW.W;
    canvas.width = VIEW.W * k;
    canvas.height = H * k;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${(H * cssW) / VIEW.W}px`;
    bg = createBackground(VIEW.W, H, groundY);
    return { H, groundY, groundCss: groundY * cssPerUnit };
  }

  function setAtlas(a) { atlas = a; }

  // view = { distance, playerY, pose, animTick, obstacles, character, timeSec, speed }
  function draw(view) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.imageSmoothingEnabled = false;
    bg.drawFar(ctx, view.distance);   // 하늘·먼 산은 수평

    // 여기부터는 내리막: 신랑 발밑을 축으로 기울인 좌표계. 판정은 수평 시뮬이 하므로 그림만 돈다
    ctx.translate(VIEW.PLAYER_X, groundY);
    ctx.rotate((VIEW.SLOPE_DEG * Math.PI) / 180);
    ctx.translate(-VIEW.PLAYER_X, -groundY);
    const timeSec = view.timeSec ?? view.animTick / TICK_HZ;
    const speed = view.speed ?? 0;
    bg.drawLand(ctx, view.distance, timeSec);
    drawSpeedLines(ctx, groundY, speed, view.distance);   // 장애물 뒤 — 장애물을 가리지 않게

    for (const o of view.obstacles) {
      const x = Math.round(o.x - view.distance);
      if (x > VIEW.W + 40 || x + o.w < -8) continue;   // 그림이 상자보다 몇 px 넓을 수 있다. 기울이면 오른쪽이 조금 더 보인다
      drawObstacle(ctx, o, x, groundY - o.y, view.animTick);
    }

    const y = Math.round(groundY - view.playerY - 64);
    if (view.playerY > 2) {
      // 공중이면 지면에 그림자 — 높이감
      const w = Math.max(10, 28 - Math.round(view.playerY / 6));
      ctx.fillStyle = 'rgba(80, 100, 120, 0.18)';
      ctx.fillRect(VIEW.PLAYER_X - w / 2, groundY - 2, w, 2);
    }
    if (view.playerY <= 2 && view.pose !== 'crash') drawSpray(ctx, groundY, speed, timeSec);
    const animFrame = Math.floor(view.animTick / ANIM.frameTicks);
    drawCharacter(ctx, atlas, view.character, view.pose, animFrame, VIEW.PLAYER_X - 32, y);
  }

  return { resize, draw, setAtlas, get groundY() { return groundY; } };
}
