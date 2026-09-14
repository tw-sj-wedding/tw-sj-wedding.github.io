import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, hashState } from '../game/src/sim/stage1.js';
import { FP, VIEW, STAGE1, OBSTACLES, TARGET_Q_CENTER } from '../game/src/config.js';

const hold = { targetXQ: TARGET_Q_CENTER };

function collectRows(seed) {
  const s = createSim(seed);
  const seen = new Map();
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    for (const r of s.rows) if (!seen.has(r.worldYFp)) seen.set(r.worldYFp, r);
    step(s, hold);
    t++;
  }
  return [...seen.values()];
}

// 목숨이 1개면 첫 충돌에 끝나 표본이 안 모인다. 스폰 관찰용으로만 목숨을 늘린다.
function collectRowsSurviving(seed) {
  const s = createSim(seed);
  s.lives = 99;
  const seen = new Map();
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    for (const r of s.rows) if (!seen.has(r.worldYFp)) seen.set(r.worldYFp, r);
    step(s, hold);
    t++;
  }
  return [...seen.values()];
}

test('스키어가 생성된다', () => {
  let found = 0;
  for (let seed = 1; seed <= 20; seed++) {
    found += collectRowsSurviving(seed).filter((r) => r.items.some((i) => i.type === 'skier')).length;
  }
  assert.ok(found > 0, '스키어가 한 번도 안 나옴');
});

test('스키어 줄에는 다른 장애물이 없다', () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const r of collectRowsSurviving(seed)) {
      if (r.items.some((i) => i.type === 'skier')) assert.equal(r.items.length, 1);
    }
  }
});

test('스키어는 실제로 가로로 움직인다', () => {
  const s = createSim(1);
  s.lives = 99;
  s.nextRowYFp = 1 << 30;
  const def = OBSTACLES.skier;
  s.rows = [{
    worldYFp: 200 * FP,
    items: [{
      type: 'skier', xFp: 40 * FP, w: def.w, h: def.h,
      vxFp: ((50 * FP) / 60) | 0, hit: false, used: false,
    }],
  }];
  const x0 = s.rows[0].items[0].xFp;
  for (let i = 0; i < 30; i++) step(s, hold);
  assert.notEqual(s.rows[0].items[0].xFp, x0, '스키어가 제자리에 있음');
});

test('스키어는 화면 밖으로 나가지 않는다 (벽에서 되돌아온다)', () => {
  const def = OBSTACLES.skier;
  for (const vx of [70, -70]) {
    const s = createSim(1);
    s.lives = 99;
    s.nextRowYFp = 1 << 30;
    s.rows = [{
      worldYFp: 400 * FP,
      items: [{
        type: 'skier', xFp: 90 * FP, w: def.w, h: def.h,
        vxFp: ((vx * FP) / 60) | 0, hit: false, used: false,
      }],
    }];
    for (let i = 0; i < 600; i++) {
      step(s, hold);
      if (!s.rows.length) break;
      const x = s.rows[0].items[0].xFp / FP;
      assert.ok(x >= 0, `왼쪽으로 벗어남: ${x}`);
      assert.ok(x + def.w <= VIEW.W, `오른쪽으로 벗어남: ${x + def.w}`);
    }
  }
});

test('스키어 속도는 설정 범위 안이다', () => {
  const maxFp = ((STAGE1.skierMaxPxS * FP) / 60) | 0;
  const minFp = ((STAGE1.skierMinPxS * FP) / 60) | 0;
  for (let seed = 1; seed <= 20; seed++) {
    for (const r of collectRowsSurviving(seed)) {
      for (const i of r.items) {
        if (i.type !== 'skier') continue;
        const v = Math.abs(i.vxFp);
        assert.ok(v >= minFp && v <= maxFp, `스키어 속도 ${v} (허용 ${minFp}~${maxFp})`);
      }
    }
  }
});

test('스키어에 부딪히면 게임이 끝난다 (목숨 1개)', () => {
  const s = createSim(1);
  s.nextRowYFp = 1 << 30;
  const def = OBSTACLES.skier;
  const x = Math.round(s.playerXFp / FP + STAGE1.playerW / 2 - def.w / 2);
  s.rows = [{
    worldYFp: 30 * FP,
    items: [{ type: 'skier', xFp: x * FP, w: def.w, h: def.h, vxFp: 0, hit: false, used: false }],
  }];
  for (let i = 0; i < 60; i++) step(s, hold);
  assert.equal(s.outcome, 'failed');
});

test('스키어가 있어도 결정론이 유지된다', () => {
  const run = (seed) => {
    const s = createSim(seed);
    let t = 0;
    while (!isOver(s) && t < 60 * 120) { step(s, hold); t++; }
    return { tick: s.tick, hash: hashState(s) };
  };
  for (const seed of [1, 42, 1337]) {
    assert.deepEqual(run(seed), run(seed), `seed ${seed} 재현 실패`);
  }
});

test('vxFp가 없는 장애물이 NaN으로 망가지지 않는다', () => {
  // moveDynamic이 undefined를 더하면 xFp가 NaN이 되고, NaN 비교는 전부 false라
  // AABB 검사의 continue가 안 걸려 그 장애물이 화면 전체와 충돌하게 된다.
  const s = createSim(1);
  s.lives = 99;
  s.nextRowYFp = 1 << 30;
  const def = OBSTACLES.tree;
  s.rows = [{
    worldYFp: 30 * FP,
    items: [{ type: 'tree', xFp: 0, w: def.w, h: def.h, hit: false, used: false }],  // vxFp 없음
  }];
  s.playerXFp = (VIEW.W - STAGE1.playerW) * FP;   // 정반대편 끝
  s.targetXQ = (VIEW.W - STAGE1.playerW) * 4;
  for (let i = 0; i < 60; i++) step(s, { targetXQ: s.targetXQ });
  assert.ok(Number.isFinite(s.rows[0]?.items[0].xFp ?? 0), 'xFp가 NaN이 됨');
  assert.equal(s.lives, 99, '반대편 끝에 있는데 충돌 처리됨');
});
