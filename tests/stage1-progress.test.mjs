import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, getOutcome } from '../game/src/sim/stage1.js';
import { TOTAL_PX, FP, TARGET_Q_CENTER } from '../game/src/config.js';

const hold = { targetXQ: TARGET_Q_CENTER };

function runToEnd(seed, maxTicks = 60 * 120) {
  const s = createSim(seed);
  let t = 0;
  while (!isOver(s) && t < maxTicks) { step(s, hold); t++; }
  return s;
}

test('시작 상태에는 점수 관련 필드가 없다', () => {
  const s = createSim(1);
  for (const banned of ['score', 'points', 'hearts', 'combo', 'best']) {
    assert.ok(!(banned in s), `금지된 필드가 있음: ${banned}`);
  }
});

test('진행 거리는 매 틱 증가한다', () => {
  const s = createSim(1);
  let prev = s.progressFp;
  for (let i = 0; i < 100; i++) {
    step(s, hold);
    assert.ok(s.progressFp > prev, `틱 ${i}에서 진행이 멈춤`);
    prev = s.progressFp;
  }
});

test('스크롤 속도는 거리에 따라 증가하고 상한을 넘지 않는다', () => {
  const s = createSim(1);
  step(s, hold);
  const early = s.progressFp;
  while (s.progressFp < (TOTAL_PX * FP * 3) / 4 && !isOver(s)) step(s, hold);
  const before = s.progressFp;
  step(s, hold);
  const late = s.progressFp - before;
  assert.ok(late > early, '후반 속도가 초반보다 빠르지 않음');
  assert.ok(late <= (118 * FP) / 60 + 1, '속도 상한 118px/s 초과');
});

test('장애물을 맞지 않으면 800m에서 cleared로 끝난다', () => {
  const s = runToEnd(1);
  assert.equal(getOutcome(s), 'cleared');
  assert.ok(s.progressFp >= TOTAL_PX * FP, '목표 거리 미달인데 클리어');
});

test('목표 플레이 시간은 30~40초 범위다', () => {
  const s = runToEnd(1);
  const seconds = s.tick / 60;
  assert.ok(seconds >= 30 && seconds <= 40, `플레이 시간 ${seconds.toFixed(1)}초`);
});

test('끝난 뒤에는 step을 더 불러도 상태가 변하지 않는다', () => {
  const s = runToEnd(1);
  const snapshot = JSON.stringify({ t: s.tick, p: s.progressFp, o: s.outcome });
  step(s, hold);
  step(s, hold);
  assert.equal(JSON.stringify({ t: s.tick, p: s.progressFp, o: s.outcome }), snapshot);
});

test('결과 객체에 점수가 없다', () => {
  const s = runToEnd(1);
  assert.equal(typeof getOutcome(s), 'string');
  assert.deepEqual(Object.keys(s).filter((k) => /score|point|heart/i.test(k)), []);
});
