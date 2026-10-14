import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, randRange } from '../game/src/sim/rng.js';

test('같은 seed는 같은 수열을 낸다', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 50 }, () => a());
  const seqB = Array.from({ length: 50 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('다른 seed는 다른 수열을 낸다', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notDeepEqual(
    Array.from({ length: 20 }, () => a()),
    Array.from({ length: 20 }, () => b()),
  );
});

test('출력은 항상 부호 없는 32bit 정수다', () => {
  const rng = mulberry32(777);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(Number.isInteger(v), `정수가 아님: ${v}`);
    assert.ok(v >= 0 && v <= 0xffffffff, `범위 밖: ${v}`);
  }
});

test('randInt는 0 이상 n 미만이고 전 구간을 쓴다', () => {
  const rng = mulberry32(42);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = randInt(rng, 6);
    assert.ok(v >= 0 && v < 6, `범위 밖: ${v}`);
    seen.add(v);
  }
  assert.equal(seen.size, 6);
});

test('randRange는 양 끝값을 포함한다', () => {
  const rng = mulberry32(99);
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const v = randRange(rng, 44, 72);
    assert.ok(v >= 44 && v <= 72, `범위 밖: ${v}`);
    seen.add(v);
  }
  assert.ok(seen.has(44), '하한 44가 한 번도 안 나옴');
  assert.ok(seen.has(72), '상한 72가 한 번도 안 나옴');
});
