import test from 'node:test';
import assert from 'node:assert/strict';
import { dragToQ } from '../game/src/input.js';
import { TARGET_Q_MAX, TARGET_Q_CENTER } from '../game/src/config.js';

test('움직이지 않으면 기준값 그대로다', () => {
  assert.equal(dragToQ(TARGET_Q_CENTER, 0, 360), TARGET_Q_CENTER);
});

test('오른쪽으로 끌면 값이 커지고 왼쪽이면 작아진다', () => {
  assert.ok(dragToQ(TARGET_Q_CENTER, 40, 360) > TARGET_Q_CENTER);
  assert.ok(dragToQ(TARGET_Q_CENTER, -40, 360) < TARGET_Q_CENTER);
});

test('화면 폭의 절반을 끌면 논리 폭의 절반만큼 이동한다', () => {
  const moved = dragToQ(0, 180, 360) - 0;
  assert.ok(Math.abs(moved - 360) <= 2, `이동량 ${moved}, 기대 360 근처`);
});

test('결과는 항상 정수이고 0~TARGET_Q_MAX 범위다', () => {
  for (const dx of [-9999, -500, -1, 0, 1, 500, 9999]) {
    const q = dragToQ(TARGET_Q_CENTER, dx, 360);
    assert.ok(Number.isInteger(q), `정수가 아님: ${q}`);
    assert.ok(q >= 0 && q <= TARGET_Q_MAX, `범위 밖: ${q}`);
  }
});

test('cssWidth가 0이어도 터지지 않는다', () => {
  const q = dragToQ(TARGET_Q_CENTER, 100, 0);
  assert.ok(Number.isInteger(q) && q >= 0 && q <= TARGET_Q_MAX);
});
