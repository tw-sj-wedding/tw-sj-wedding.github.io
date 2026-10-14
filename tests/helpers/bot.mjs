// 테스트용 봇. 사람처럼 반응 지연 없이, 다가오는 장애물 종류에 맞춰 점프하거나 숙인다.
// 이 봇이 죽는 배치는 "피할 수 없는 배치"이거나 봇이 틀린 것이다 — 둘 다 조사 대상.

import { VIEW, HITBOX, JUMP, TICK_HZ } from '../../game/src/config.js';

export function botInput(state) {
  const px0 = VIEW.PLAYER_X - HITBOX.stand.w / 2;
  const px1 = px0 + HITBOX.stand.w;
  let next = null, nextX = Infinity;
  for (const o of state.obstacles) {
    const sx = o.x - state.distance;
    if (sx + o.w > px0 && sx < nextX) { next = o; nextX = sx; }
  }
  if (!next) return { jump: false, duck: false };

  const v = state.speed / TICK_HZ;   // 틱당 px
  if (next.type === 'birdHigh') {
    return { jump: false, duck: (nextX - px1) / v < 20 };
  }
  // 장애물 중심이 신랑 중심을 지날 때 정점에 오도록 뛴다
  const ticksToCenter = (nextX + next.w / 2 - VIEW.PLAYER_X) / v;
  return { jump: state.airTick < 0 && ticksToCenter <= JUMP.airTicks / 2, duck: false };
}
