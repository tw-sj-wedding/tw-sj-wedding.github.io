import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, getOutcome, hashState, replay } from '../game/src/sim/stage1.js';
import { TARGET_Q_MAX, TARGET_Q_CENTER, SPAWN_STOP_PX, FP } from '../game/src/config.js';
import { botInput } from './helpers/bot.mjs';

// 봇을 돌리면서 값이 바뀐 틱만 [tick, value]로 기록한다 (실기기 입력 기록과 같은 형식)
function recordBotRun(seed) {
  const s = createSim(seed);
  const log = [];
  let last = -1;
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    const q = botInput(s).targetXQ;
    if (q !== last) { log.push([s.tick, q]); last = q; }
    step(s, { targetXQ: q });
    t++;
  }
  return { log, endTick: s.tick, outcome: getOutcome(s), hash: hashState(s) };
}

test('같은 seed + 같은 inputLog는 같은 종료 틱과 결과를 낸다', () => {
  for (const seed of [1, 42, 1337, 90210]) {
    const a = recordBotRun(seed);
    const b = replay(seed, a.log);
    assert.equal(b.tick, a.endTick, `seed ${seed}: 종료 틱 불일치`);
    assert.equal(getOutcome(b), a.outcome, `seed ${seed}: 결과 불일치`);
    assert.equal(hashState(b), a.hash, `seed ${seed}: 상태 해시 불일치`);
  }
});

test('리플레이를 두 번 돌려도 같다', () => {
  const a = recordBotRun(555);
  assert.equal(hashState(replay(555, a.log)), hashState(replay(555, a.log)));
});

test('입력이 다르면 결과도 달라진다 (해시가 입력을 실제로 반영한다)', () => {
  const a = replay(7, [[0, 0]]);
  const b = replay(7, [[0, TARGET_Q_MAX]]);
  assert.notEqual(hashState(a), hashState(b));
});

test('도착 80m 전부터 finale이 켜지고 입력이 무시된다', () => {
  const s = createSim(3);
  s.nextRowYFp = 1 << 30;   // 도착 연출만 본다
  let t = 0;
  while (!isOver(s) && t < 60 * 120) { step(s, { targetXQ: 0 }); t++; }
  assert.equal(getOutcome(s), 'cleared');
  assert.ok(s.finale, 'finale이 안 켜짐');
  const centerFp = TARGET_Q_CENTER * (FP / 4);
  assert.ok(Math.abs(s.playerXFp - centerFp) <= FP, '신랑이 중앙으로 정렬되지 않음');
});

test('스폰 중지 구간을 20px 지난 뒤로는 목숨이 줄지 않는다', () => {
  // 마지막으로 스폰된 줄은 worldY < SPAWN_STOP_PX 이지만 충돌 구간이 worldY + 높이까지
  // 이어지므로, 스폰 중지 지점 직후 몇 px 동안은 아직 그 줄과 겹칠 수 있다.
  // 장애물 높이 최대 13px보다 넉넉한 20px를 지난 뒤부터 검사한다.
  const s = createSim(3);
  let t = 0;
  while (!isOver(s) && s.progressFp / FP < SPAWN_STOP_PX + 20 && t < 60 * 120) {
    step(s, botInput(s)); t++;
  }
  const livesAfterLastObstacle = s.lives;
  while (!isOver(s) && t < 60 * 120) { step(s, { targetXQ: 0 }); t++; }
  assert.equal(s.lives, livesAfterLastObstacle);
  assert.ok(s.finale, 'finale이 안 켜짐');
});
