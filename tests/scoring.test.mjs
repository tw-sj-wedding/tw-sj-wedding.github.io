import test from 'node:test';
import assert from 'node:assert/strict';
import { speedAtTick, distanceAtTick, scoreAtTick } from '../game/src/shared/scoring.js';
import { SPEED, SCORE, TICK_HZ } from '../game/src/config.js';

const loopDistance = (n) => {
  let d = 0;
  for (let i = 1; i <= n; i++) d += Math.min(SPEED.max, SPEED.start + (SPEED.accel * i) / TICK_HZ) / TICK_HZ;
  return d;
};

test('0틱이면 거리·점수 0, 속도는 출발 속도', () => {
  assert.equal(distanceAtTick(0), 0);
  assert.equal(scoreAtTick(0), 0);
  assert.equal(speedAtTick(0), SPEED.start);
});

test('닫힌 식 거리는 틱별 누적 합과 같다 (속도 상한 경계 포함)', () => {
  for (const n of [1, 2, 100, 6999, 7000, 7001, 7002, 20000]) {
    assert.ok(Math.abs(distanceAtTick(n) - loopDistance(n)) < 1e-6, `${n}틱: ${distanceAtTick(n)} vs ${loopDistance(n)}`);
  }
});

test('속도는 약 2분(7000틱)에 상한에 닿고 넘지 않는다', () => {
  assert.ok(speedAtTick(6990) < SPEED.max);
  assert.equal(speedAtTick(7000), SPEED.max);
  assert.equal(speedAtTick(100000), SPEED.max);
});

test('점수 = 거리 / 24 내림, 단조 증가', () => {
  let prev = 0;
  for (let n = 0; n <= 30000; n++) {
    const s = scoreAtTick(n);
    assert.equal(s, Math.floor(distanceAtTick(n) / SCORE.pxPerPoint));
    assert.ok(s >= prev, `${n}틱에서 점수가 줄어듦`);
    prev = s;
  }
});

test('처음엔 1초에 약 10점', () => {
  const s = scoreAtTick(TICK_HZ);
  assert.ok(s >= 9 && s <= 11, `1초 점수 ${s}`);
});
