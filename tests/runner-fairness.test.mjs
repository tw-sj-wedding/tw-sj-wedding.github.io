import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, isOver, getScore } from '../game/src/sim/runner.js';
import { TICK_HZ } from '../game/src/config.js';
import { botInput } from './helpers/bot.mjs';

// 피할 수 없는 배치가 하나도 없어야 한다. 반응 지연 없는 봇이 seed 300개를 5분씩 버틴다.
// 실패하면 생성 규칙(최소 간격, 종류 조합)이나 봇 중 하나가 틀린 것 — 메시지의 seed로 재현한다.
test('봇이 seed 300개 × 5분을 전부 버틴다', () => {
  const LIMIT = 5 * 60 * TICK_HZ;
  const deaths = [];
  for (let seed = 1; seed <= 300; seed++) {
    const s = createRun(seed);
    while (s.tick < LIMIT && !isOver(s)) step(s, botInput(s));
    if (isOver(s)) deaths.push(`seed ${seed}: ${s.tick}틱 ${getScore(s)}점 ${s.hitType}`);
  }
  assert.deepEqual(deaths, []);
});
