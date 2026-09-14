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
  // 간격의 실체는 스폰 커서(nextRowYFp)다. 줄의 현재 위치로 재면 안 된다 —
  // 스키어 줄은 스폰 뒤에도 내려가고, 그 줄을 빼고 재면 그 자리만큼 벌어져 보인다.
  const s = createSim(7);
  s.lives = 99;
  const cursors = [];
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    if (cursors[cursors.length - 1] !== s.nextRowYFp) cursors.push(s.nextRowYFp);
    step(s, hold);
    t++;
  }
  assert.ok(cursors.length > 20, `스폰이 ${cursors.length}번뿐`);
  for (let i = 1; i < cursors.length; i++) {
    const gapPx = (cursors[i] - cursors[i - 1]) / FP;
    assert.ok(
      gapPx >= STAGE1.rowGapMin && gapPx <= STAGE1.rowGapMax,
      `줄 간격 ${gapPx}px (허용 ${STAGE1.rowGapMin}~${STAGE1.rowGapMax})`,
    );
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
  // 위치가 아니라 "새로 추가되는가"를 본다. 스키어 줄은 스폰 뒤에도 내려가므로
  // 위치로 판정하면 중지선을 넘어간 것처럼 보인다.
  const s = createSim(2);
  s.lives = 99;
  const known = new Set();
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    for (const r of s.rows) {
      if (known.has(r)) continue;
      known.add(r);
      assert.ok(
        s.progressFp / FP < SPAWN_STOP_PX,
        `스폰 중지 구간(${SPAWN_STOP_PX}px)을 지난 ${(s.progressFp / FP).toFixed(0)}px 에서 새 줄이 생김`,
      );
    }
    step(s, hold);
    t++;
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
