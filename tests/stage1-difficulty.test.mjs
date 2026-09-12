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

test('단순 봇 기준 클리어율이 80% 이상이다 (난이도 easy)', () => {
  const runs = [];
  for (let seed = 1; seed <= 300; seed++) runs.push(play(seed));
  const cleared = runs.filter((r) => r.outcome === 'cleared').length;
  const rate = cleared / runs.length;
  console.log(`클리어율 ${(rate * 100).toFixed(1)}% (${cleared}/300)`);
  assert.ok(rate >= 0.8, `클리어율 ${(rate * 100).toFixed(1)}% — config.js 난이도를 낮춰야 함`);
});

test('모든 seed가 120초 안에 끝난다 (교착 없음)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = play(seed);
    assert.ok(r.outcome !== null, `seed ${seed}: 끝나지 않음`);
  }
});
