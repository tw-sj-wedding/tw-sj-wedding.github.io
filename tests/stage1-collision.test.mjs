import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, getOutcome } from '../game/src/sim/stage1.js';
import { FP, VIEW, STAGE1, OBSTACLES } from '../game/src/config.js';

const LIVES = 3;   // 이 파일이 세우는 시뮬의 목숨 (config.lives와 무관)

// 신랑 바로 앞(아래)에 지정한 장애물 하나만 놓은 시뮬을 만든다.
function simWithItem(type, opts = {}) {
  const s = createSim(1);
  s.nextRowYFp = 1 << 30;          // 자동 스폰 정지
  // 충돌·무적·점프 판정 자체를 보는 파일이다. config의 목숨 수가 바뀌어도
  // 이 테스트들이 흔들리지 않도록 여기서 목숨을 고정한다.
  s.lives = opts.lives ?? 3;
  const def = OBSTACLES[type];
  const playerXPx = s.playerXFp / FP;
  const x = opts.x ?? Math.round(playerXPx + STAGE1.playerW / 2 - def.w / 2);
  s.rows = [{
    worldYFp: (opts.aheadPx ?? 30) * FP,
    items: [{ type, xFp: x * FP, w: def.w, h: def.h, hit: false, used: false }],
  }];
  return s;
}

const hold = (s) => ({ targetXQ: s.targetXQ });

function runTicks(s, n) { for (let i = 0; i < n; i++) step(s, hold(s)); }

test('정면 충돌하면 목숨이 하나 줄고 무적이 걸린다', () => {
  const s = simWithItem('tree');
  runTicks(s, 60);
  assert.equal(s.lives, LIVES - 1);
  assert.ok(s.invincibleTicks > 0, '무적이 안 걸림');
});

test('같은 장애물에 두 번 맞지 않는다', () => {
  const s = simWithItem('tree');
  runTicks(s, 120);
  assert.equal(s.lives, LIVES - 1);
});

test('무적 중에는 다른 장애물에도 안 맞는다', () => {
  const s = simWithItem('tree');
  runTicks(s, 60);
  assert.equal(s.lives, LIVES - 1);
  const def = OBSTACLES.rock;
  const x = Math.round(s.playerXFp / FP + STAGE1.playerW / 2 - def.w / 2);
  // 무적이 남아 있는 동안만 검사한다. 피격 감속(x0.55) 때문에 멀리 두면
  // 도달하기 전에 무적이 풀려서, 테스트가 무적이 아니라 거리를 재게 된다.
  assert.ok(s.invincibleTicks > 20, `남은 무적이 ${s.invincibleTicks}틱뿐`);
  s.rows.push({
    worldYFp: s.progressFp + 4 * FP,
    items: [{ type: 'rock', xFp: x * FP, w: def.w, h: def.h, hit: false, used: false }],
  });
  runTicks(s, 20);
  assert.equal(s.lives, LIVES - 1, '무적 중에 또 맞음');
});

test('옆으로 비켜 있으면 안 맞는다', () => {
  const s = simWithItem('tree', { x: 0 });
  s.playerXFp = (VIEW.W - STAGE1.playerW) * FP;
  s.targetXQ = (VIEW.W - STAGE1.playerW) * 4;
  runTicks(s, 60);
  assert.equal(s.lives, LIVES);
});

test('점프대를 밟으면 체공 상태가 된다', () => {
  // 고정 틱 수로 확인하면 안 된다 — 스크롤이 빨라지면 그 틱에는 이미 착지해 있다.
  // 점프가 걸리는 순간을 기다렸다가 본다.
  const s = simWithItem('jumppad');
  let triggered = false;
  for (let i = 0; i < 120 && !triggered; i++) {
    step(s, hold(s));
    if (s.airborneTicks > 0) triggered = true;
  }
  assert.ok(triggered, '점프가 안 걸림');
  assert.equal(s.lives, LIVES, '점프대에 맞아서 목숨이 줄었음');
});

test('체공 중에는 장애물 충돌이 무시된다', () => {
  const s = simWithItem('jumppad', { aheadPx: 20 });
  const def = OBSTACLES.tree;
  const x = Math.round(s.playerXFp / FP + STAGE1.playerW / 2 - def.w / 2);
  // 나무의 충돌 구간(worldY-playerH ~ worldY+h)이 체공 구간 안에 통째로 들어가야 한다.
  // 점프는 0.8초, 초기 속도로 약 49px를 난다.
  s.rows.push({
    worldYFp: 35 * FP,
    items: [{ type: 'tree', xFp: x * FP, w: def.w, h: def.h, hit: false, used: false }],
  });
  runTicks(s, 60);
  assert.equal(s.lives, LIVES, '체공 중에 맞았음');
});

test('목숨이 0이 되면 failed로 끝난다', () => {
  const s = createSim(1);
  s.nextRowYFp = 1 << 30;
  s.lives = 1;
  const def = OBSTACLES.snowman;
  const x = Math.round(s.playerXFp / FP + STAGE1.playerW / 2 - def.w / 2);
  s.rows = [{
    worldYFp: 30 * FP,
    items: [{ type: 'snowman', xFp: x * FP, w: def.w, h: def.h, hit: false, used: false }],
  }];
  runTicks(s, 60);
  assert.equal(getOutcome(s), 'failed');
  assert.equal(s.lives, 0);
});

test('무적 중에는 전진 속도가 느려진다', () => {
  const fast = createSim(1);
  fast.nextRowYFp = 1 << 30;
  step(fast, hold(fast));
  const normal = fast.progressFp;

  const slow = createSim(1);
  slow.nextRowYFp = 1 << 30;
  slow.invincibleTicks = 60;
  const before = slow.progressFp;
  step(slow, hold(slow));
  assert.ok(slow.progressFp - before < normal, '무적 중인데 감속이 안 됨');
});
