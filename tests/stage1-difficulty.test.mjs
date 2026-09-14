import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, getOutcome } from '../game/src/sim/stage1.js';
import { botInput } from './helpers/bot.mjs';

function play(seed) {
  const s = createSim(seed);
  let t = 0;
  while (!isOver(s) && t < 60 * 120) { step(s, botInput(s)); t++; }
  return { outcome: getOutcome(s), lives: s.lives, ticks: s.tick };
}

function runAll() {
  const runs = [];
  for (let seed = 1; seed <= 300; seed++) runs.push(play(seed));
  return runs;
}

// 이 파일은 "난이도가 얼마여야 하는가"를 정하지 않는다 — 그건 docs/DECISIONS.md 의
// 튜닝 결정이다. 여기서 막는 것은 파라미터를 건드리다 게임이 조용히 망가지는 경우다:
// 아무도 못 깨거나(0%에 수렴), 아무 일도 안 일어나거나(100%), 끝나지 않는 경우.
test('봇 클리어율이 붕괴 구간에 있지 않다', () => {
  const runs = runAll();
  const cleared = runs.filter((r) => r.outcome === 'cleared').length;
  const rate = cleared / runs.length;
  const failed = runs.filter((r) => r.outcome === 'failed');
  const avgFailSec = failed.reduce((a, r) => a + r.ticks / 60, 0) / (failed.length || 1);
  console.log(`클리어율 ${(rate * 100).toFixed(1)}% (${cleared}/300), 실패까지 평균 ${avgFailSec.toFixed(1)}초`);

  assert.ok(rate >= 0.2, `클리어율 ${(rate * 100).toFixed(1)}% — 너무 어려워 하객이 못 넘어간다`);
  assert.ok(rate <= 0.95, `클리어율 ${(rate * 100).toFixed(1)}% — 장애물이 사실상 없는 것과 같다`);
});

// 실패가 빨라야 재도전이 부담스럽지 않다. 목숨이 1개라 대부분 중간에 끝나는데,
// 한 판이 길면 "다시 하기"를 누를 마음이 사라진다.
test('실패한 판은 평균 25초 안에 끝난다', () => {
  const failed = runAll().filter((r) => r.outcome === 'failed');
  const avgSec = failed.reduce((a, r) => a + r.ticks / 60, 0) / (failed.length || 1);
  assert.ok(avgSec <= 25, `실패까지 평균 ${avgSec.toFixed(1)}초 — 재도전 부담이 크다`);
});

test('모든 seed가 120초 안에 끝난다 (교착 없음)', () => {
  for (const [i, r] of runAll().entries()) {
    assert.ok(r.outcome !== null, `seed ${i + 1}: 끝나지 않음`);
  }
});
