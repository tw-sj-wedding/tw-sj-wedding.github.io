// 점수 공식. 게임 시뮬과 리더보드 Worker가 이 파일을 함께 쓴다.
//
// 속도는 플레이어와 무관하게 경과 틱만으로 정해지므로, 거리와 점수도 틱만의 함수다.
// 시뮬은 거리를 누적하지 않고 매 틱 distanceAtTick() 을 그대로 쓴다 — 누적 합산을 쓰면
// 부동소수 오차로 서버의 상한 검사(scoreAtTick)가 정상 점수를 1점 차로 거부할 수 있다.
// DOM·Date·Math.random 을 쓰지 않는다.

import { SPEED, SCORE, TICK_HZ } from '../config.js';

export function makeScoring({ start, accel, max }, tickHz, pxPerPoint) {
  // 이 틱까지는 상한에 닿지 않는다 (start + accel*i/tickHz <= max)
  const rampTicks = Math.floor(((max - start) * tickHz) / accel);

  const speedAtTick = (n) => Math.min(max, start + (accel * n) / tickHz);

  // Σ_{i=1..n} speedAtTick(i) / tickHz
  const distanceAtTick = (n) => {
    const m = Math.min(n, rampTicks);
    let d = (m * start + (accel / tickHz) * ((m * (m + 1)) / 2)) / tickHz;
    if (n > rampTicks) d += ((n - rampTicks) * max) / tickHz;
    return d;
  };

  const scoreAtTick = (n) => Math.floor(distanceAtTick(n) / pxPerPoint);

  return { speedAtTick, distanceAtTick, scoreAtTick };
}

export const { speedAtTick, distanceAtTick, scoreAtTick } = makeScoring(SPEED, TICK_HZ, SCORE.pxPerPoint);
