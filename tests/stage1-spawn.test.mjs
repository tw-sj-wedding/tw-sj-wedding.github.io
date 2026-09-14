import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver } from '../game/src/sim/stage1.js';
import { FP, VIEW, STAGE1, SPAWN_STOP_PX, TARGET_Q_CENTER } from '../game/src/config.js';

const hold = { targetXQ: TARGET_Q_CENTER };

// 스폰된 모든 줄을 종료까지 모아본다 (제거되기 전에 기록)
function collectRows(seed) {
  const s = createSim(seed);
  s.lives = 99;   // 스폰 배치를 끝까지 관찰하려면 중간에 죽으면 안 된다
  const seen = new Map();
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    for (const r of s.rows) if (!seen.has(r.worldYFp)) seen.set(r.worldYFp, r);
    step(s, hold);
    t++;
  }
  return [...seen.values()].sort((a, b) => a.worldYFp - b.worldYFp);
}

test('줄이 생성된다', () => {
  assert.ok(collectRows(1).length > 20, '장애물 줄이 너무 적음');
});

test('줄 간격은 44~72px이다', () => {
  const rows = collectRows(7);
  for (let i = 1; i < rows.length; i++) {
    const gapPx = (rows[i].worldYFp - rows[i - 1].worldYFp) / FP;
    assert.ok(gapPx >= STAGE1.rowGapMin && gapPx <= STAGE1.rowGapMax, `줄 간격 ${gapPx}px`);
  }
});

test('장애물은 화면 가로 안에 들어간다', () => {
  for (const r of collectRows(3)) {
    for (const it of r.items) {
      const x = it.xFp / FP;
      assert.ok(x >= 0, `x가 음수: ${x}`);
      assert.ok(x + it.w <= VIEW.W, `오른쪽으로 삐져나감: ${x} + ${it.w}`);
    }
  }
});

test('같은 줄 장애물은 46px 이상 떨어져 있다', () => {
  for (const r of collectRows(11)) {
    if (r.items.length < 2) continue;
    const xs = r.items.map((it) => it.xFp / FP).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i] - xs[i - 1] >= STAGE1.sameRowMinGap, `같은 줄 간격 ${xs[i] - xs[i - 1]}px`);
    }
  }
});

test('한 줄에 장애물은 최대 2개다', () => {
  for (const r of collectRows(5)) assert.ok(r.items.length <= 2, `한 줄 ${r.items.length}개`);
});

test('점프대가 있는 줄에는 다른 장애물이 없다', () => {
  for (const r of collectRows(13)) {
    if (r.items.some((it) => it.type === 'jumppad')) assert.equal(r.items.length, 1);
  }
});

test('도착 80m 전부터는 새 줄이 생기지 않는다', () => {
  for (const r of collectRows(2)) {
    assert.ok(r.worldYFp / FP < SPAWN_STOP_PX, `스폰 중지 구간에 줄이 생김: ${r.worldYFp / FP}px`);
  }
});

test('통과 가능한 빈틈이 항상 신랑 폭보다 넓다', () => {
  for (const r of collectRows(17)) {
    const solids = r.items.filter((it) => it.type !== 'jumppad')
      .map((it) => [it.xFp / FP, it.xFp / FP + it.w]).sort((a, b) => a[0] - b[0]);
    let widest = 0;
    let cursor = 0;
    for (const [l, rr] of solids) { widest = Math.max(widest, l - cursor); cursor = Math.max(cursor, rr); }
    widest = Math.max(widest, VIEW.W - cursor);
    if (solids.length) assert.ok(widest >= STAGE1.playerW, `통과 가능한 빈틈이 ${widest}px 뿐`);
  }
});

test('지나간 줄은 제거된다 (rows가 무한히 자라지 않음)', () => {
  const s = createSim(1);
  s.lives = 99;
  let max = 0;
  let t = 0;
  while (!isOver(s) && t < 60 * 120) { step(s, hold); max = Math.max(max, s.rows.length); t++; }
  assert.ok(max < 20, `동시 보유 줄이 ${max}개까지 늘어남`);
});

test('같은 seed는 같은 스폰 배치를 만든다', () => {
  const a = JSON.stringify(collectRows(1234));
  const b = JSON.stringify(collectRows(1234));
  assert.equal(a, b);
});
