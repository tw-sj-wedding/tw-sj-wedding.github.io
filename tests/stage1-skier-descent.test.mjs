import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, baseScrollPxS } from '../game/src/sim/stage1.js';
import { FP, VIEW, STAGE1, TARGET_Q_CENTER } from '../game/src/config.js';

const hold = { targetXQ: TARGET_Q_CENTER };

function skierRows(state) {
  return state.rows.filter((r) => r.items.some((i) => i.type === 'skier'));
}

test('스키어 줄은 하강 속도를 가진다', () => {
  let seen = 0;
  for (let seed = 1; seed <= 15 && seen === 0; seed++) {
    const s = createSim(seed);
    s.lives = 99;
    for (let t = 0; t < 60 * 60 && !isOver(s); t++) {
      step(s, hold);
      for (const r of skierRows(s)) { assert.ok(r.vyFp > 0, `스키어 줄의 vyFp가 ${r.vyFp}`); seen++; }
      if (seen) break;
    }
  }
  assert.ok(seen > 0, '스키어가 한 번도 안 나옴');
});

test('스키어는 실제로 내려간다', () => {
  const s = createSim(1);
  s.lives = 99;
  s.nextRowYFp = 1 << 30;
  s.rows = [{ worldYFp: 200 * FP, vyFp: 100, items: [
    { type: 'skier', xFp: 80 * FP, w: 12, h: 14, vxFp: 0, hit: false, used: false },
  ] }];
  const y0 = s.rows[0].worldYFp;
  for (let i = 0; i < 30; i++) step(s, hold);
  assert.ok(s.rows[0].worldYFp > y0, '스키어가 내려가지 않음');
});

// 기준 속도(피격 감속 제외)와 비교한다. 감속은 일시적인 벌점이고, 목숨이 1개인
// 실제 게임에서는 피격이 곧 종료라 감속 구간 자체가 존재하지 않는다.
test('스키어 하강 속도는 항상 신랑보다 느리다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = createSim(seed);
    s.lives = 99;
    for (let t = 0; t < 60 * 90 && !isOver(s); t++) {
      step(s, hold);
      const playerFp = ((baseScrollPxS(s) * FP) / 60) | 0;
      for (const r of skierRows(s)) {
        assert.ok(r.vyFp < playerFp, `seed ${seed}: 스키어 ${r.vyFp} >= 신랑 ${playerFp}`);
      }
    }
  }
});

test('스키어는 결국 전부 추월당한다 (화면에 눌러앉지 않는다)', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = createSim(seed);
    s.lives = 99;
    const firstSeen = new Map();
    let t = 0;
    while (!isOver(s) && t < 60 * 90) {
      step(s, hold);
      t++;
      for (const r of skierRows(s)) if (!firstSeen.has(r)) firstSeen.set(r, t);
      // 추월 = 스키어 줄이 신랑 뒤로 넘어감
      for (const [r, born] of firstSeen) {
        if (s.rows.includes(r) && r.worldYFp < s.progressFp) firstSeen.delete(r);
        else if (!s.rows.includes(r)) firstSeen.delete(r);
        else assert.ok(t - born < 60 * 20, `seed ${seed}: 스키어가 ${((t - born) / 60).toFixed(1)}초째 안 추월됨`);
      }
    }
  }
});

test('스키어는 화면 가로 밖으로 나가지 않는다', () => {
  for (let seed = 1; seed <= 15; seed++) {
    const s = createSim(seed);
    s.lives = 99;
    for (let t = 0; t < 60 * 60 && !isOver(s); t++) {
      step(s, hold);
      for (const r of skierRows(s)) {
        for (const i of r.items) {
          const x = i.xFp / FP;
          assert.ok(x >= 0 && x + i.w <= VIEW.W, `스키어 x=${x}`);
        }
      }
    }
  }
});
