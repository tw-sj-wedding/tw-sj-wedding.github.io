import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step, isOver, getScore, playerBox, poseOf, minGapAt } from '../game/src/sim/runner.js';
import { scoreAtTick } from '../game/src/shared/scoring.js';
import { VIEW, JUMP, HITBOX, OBSTACLES, SPAWN, TICK_HZ } from '../game/src/config.js';
import { mulberry32, randInt } from '../game/src/sim/rng.js';
import { botInput } from './helpers/bot.mjs';

const IDLE = { jump: false, duck: false };
const JUMP_IN = { jump: true, duck: false };
const DUCK_IN = { jump: false, duck: true };

// 장애물 생성을 끄고 원하는 장애물만 놓는다 (충돌 판정만 보려고)
function bare(seed = 1) {
  const s = createRun(seed);
  s.obstacles = [];
  s.nextSpawnX = Infinity;
  return s;
}
// 신랑 바로 앞(화면 x = PLAYER_X + dx)에 장애물 하나
function place(s, type, dx = 0) {
  const o = OBSTACLES[type];
  s.obstacles.push({ type, x: s.distance + VIEW.PLAYER_X + dx, y: o.y, w: o.w, h: o.h });
}

// ---------- 점프·숙이기 ----------

test('점프는 18틱째 정점 70px, 36틱 뒤 착지한다', () => {
  const s = bare();
  step(s, JUMP_IN);
  for (let i = 1; i < 18; i++) step(s, IDLE);
  assert.ok(Math.abs(s.playerY - JUMP.apex) < 0.5, `정점 ${s.playerY}`);
  for (let i = 18; i < 36; i++) step(s, IDLE);
  assert.equal(s.playerY, 0);
  assert.equal(s.airTick, -1);
});

test('공중에서 누른 점프는 무시된다', () => {
  const s = bare();
  step(s, JUMP_IN);
  for (let i = 1; i < 10; i++) step(s, IDLE);
  const before = s.airTick;
  step(s, JUMP_IN);
  assert.equal(s.airTick, before + 1, '공중 점프가 체공을 다시 시작함');
});

test('공중에서 누른 숙이기는 무시되고 서 있는 충돌 상자를 유지한다', () => {
  const s = bare();
  step(s, JUMP_IN);
  step(s, DUCK_IN);
  assert.equal(s.ducking, false);
  assert.equal(playerBox(s).h, HITBOX.stand.h);
  assert.ok(s.airTick > 0, '숙이기가 빨리 떨어뜨림');
});

test('숙이기를 누른 채 착지하면 그때부터 숙인다', () => {
  const s = bare();
  step(s, JUMP_IN);
  for (let i = 1; i < JUMP.airTicks; i++) step(s, DUCK_IN);
  assert.equal(s.airTick, -1);
  assert.equal(s.ducking, true);
  assert.equal(playerBox(s).h, HITBOX.duck.h);
});

test('숙인 상태에서 점프를 누르면 점프가 우선한다', () => {
  const s = bare();
  step(s, DUCK_IN);
  assert.equal(s.ducking, true);
  step(s, { jump: true, duck: true });
  assert.equal(s.ducking, false);
  assert.ok(s.airTick > 0);
});

test('숙이기를 떼면 바로 선다', () => {
  const s = bare();
  step(s, DUCK_IN);
  step(s, IDLE);
  assert.equal(s.ducking, false);
});

// ---------- 충돌 ----------

test('서 있으면 높은 새에 부딪히고, 숙이면 지나간다', () => {
  const standing = bare();
  place(standing, 'birdHigh');
  step(standing, IDLE);
  assert.ok(isOver(standing), '서 있는데 높은 새를 통과함');

  const ducking = bare();
  place(ducking, 'birdHigh');
  step(ducking, DUCK_IN);
  assert.ok(!isOver(ducking), '숙였는데 높은 새에 부딪힘');
});

test('숙여도 낮은 새와 지상 장애물에는 부딪힌다', () => {
  for (const type of ['birdLow', 'rock1', 'snowman', 'skierDown']) {
    const s = bare();
    place(s, type);
    step(s, DUCK_IN);
    assert.ok(isOver(s), `숙여서 ${type} 를 통과함`);
  }
});

test('넘어진 스키어는 제때 뛰면 넘을 수 있다', () => {
  const s = bare();
  const o = OBSTACLES.skierDown;
  // 정점(18틱)에 장애물 중심이 신랑 중심을 지나도록 놓는다
  const dx = Math.round((s.speed / TICK_HZ) * (JUMP.airTicks / 2) - o.w / 2);
  place(s, 'skierDown', dx);
  step(s, JUMP_IN);
  for (let i = 0; i < JUMP.airTicks + 10; i++) step(s, IDLE);
  assert.ok(!isOver(s), '제때 뛰었는데 넘어진 스키어에 걸림');
});

test('지상 장애물에 부딪히면 게임오버, 이후 step은 상태를 바꾸지 않는다', () => {
  const s = bare();
  place(s, 'rock2');
  step(s, IDLE);
  assert.ok(isOver(s));
  assert.equal(poseOf(s), 'crash');
  const snapshot = JSON.stringify({ tick: s.tick, d: s.distance, y: s.playerY });
  step(s, JUMP_IN);
  assert.equal(JSON.stringify({ tick: s.tick, d: s.distance, y: s.playerY }), snapshot);
});

test('충돌 상자는 신랑 중심 기준이고 그림보다 좁다', () => {
  const box = playerBox(bare());
  assert.equal(box.x + box.w / 2, VIEW.PLAYER_X);
  assert.equal(box.y, 0);
});

test('점수는 경과 틱만으로 정해진다', () => {
  const s = bare();
  for (let i = 0; i < 600; i++) step(s, IDLE);
  assert.equal(getScore(s), scoreAtTick(600));
});

test('자세: 달리기 / 점프 / 숙이기', () => {
  const s = bare();
  assert.equal(poseOf(s), 'run');
  step(s, DUCK_IN);
  assert.equal(poseOf(s), 'duck');
  step(s, JUMP_IN);
  assert.equal(poseOf(s), 'jump');
});

// ---------- 생성 규칙 ----------

function runWithBot(seed, ticks, onTick) {
  const s = createRun(seed);
  const seen = new Set();
  for (let t = 0; t < ticks && !isOver(s); t++) {
    step(s, botInput(s));
    for (const o of s.obstacles) {
      if (!seen.has(o)) { seen.add(o); onTick?.('spawn', s, o); }
    }
    onTick?.('tick', s);
  }
  return s;
}

test('시작 후 1.6초 동안은 화면 안에 장애물이 없다', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = createRun(seed);
    for (let t = 0; t < SPAWN.firstGapSec * TICK_HZ; t++) {
      step(s, IDLE);
      for (const o of s.obstacles) assert.ok(o.x - s.distance >= VIEW.W, `seed ${seed} ${t}틱에 장애물이 보임`);
    }
  }
});

test('연속 장애물 간격은 항상 도착 시점 기준 최소 간격 이상이다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    let last = null;
    runWithBot(seed, 3 * 60 * TICK_HZ, (kind, s, o) => {
      if (kind !== 'spawn') return;
      if (last) {
        const gap = o.x - (last.o.x + last.o.w);
        const need = minGapAt(last.tick, last.speed);
        assert.ok(gap >= need, `seed ${seed}: 간격 ${gap} < 최소 ${need}`);
      }
      last = { o, tick: s.tick, speed: s.speed };
    });
  }
});

test('새는 150점부터 나온다', () => {
  // 처음 몇 판에서 새를 일찍 보여 주려고 300 → 150점으로 앞당겼다 (#24)
  let earliest = Infinity;
  for (let seed = 1; seed <= 30; seed++) {
    runWithBot(seed, 60 * TICK_HZ, (kind, s, o) => {
      if (kind === 'spawn' && o.type.startsWith('bird')) earliest = Math.min(earliest, getScore(s));
    });
  }
  assert.ok(earliest >= 150 && earliest < 300, `가장 이른 새가 ${earliest}점`);
});

test('등장 점수 전에는 새가 나오지 않는다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    runWithBot(seed, 60 * TICK_HZ, (kind, s, o) => {
      if (kind === 'spawn' && o.type.startsWith('bird')) {
        assert.ok(getScore(s) >= SPAWN.birdFromScore, `seed ${seed}: ${getScore(s)}점에 새`);
      }
    });
  }
});

test('지나간 장애물은 제거된다', () => {
  let maxLen = 0;
  runWithBot(7, 3 * 60 * TICK_HZ, (kind, s) => { if (kind === 'tick') maxLen = Math.max(maxLen, s.obstacles.length); });
  assert.ok(maxLen <= 6, `장애물 목록이 ${maxLen}개까지 커짐`);
});

test('모든 장애물 종류가 실제로 나온다', () => {
  const types = new Set();
  for (let seed = 1; seed <= 10; seed++) runWithBot(seed, 3 * 60 * TICK_HZ, (kind, s, o) => { if (kind === 'spawn') types.add(o.type); });
  assert.deepEqual([...types].sort(), Object.keys(OBSTACLES).sort());
});

// ---------- 결정론 ----------

function scriptedRun(seed, inputSeed, ticks) {
  const s = createRun(seed);
  const rng = mulberry32(inputSeed);
  for (let t = 0; t < ticks && !isOver(s); t++) {
    const r = randInt(rng, 100);
    step(s, { jump: r < 4, duck: r >= 90 });
  }
  return { tick: s.tick, score: getScore(s), over: isOver(s), y: s.playerY };
}

test('같은 seed + 같은 입력이면 같은 결과', () => {
  for (const seed of [1, 42, 9999]) {
    assert.deepEqual(scriptedRun(seed, 7, 20000), scriptedRun(seed, 7, 20000));
  }
});

test('seed가 다르면 장애물 배치가 다르다', () => {
  // 장애물 생성은 플레이어 행동과 무관하다 — 생성 순서만 비교한다
  const layout = (seed) => {
    const s = createRun(seed);
    const seen = new Set(), out = [];
    for (let t = 0; t < 1200; t++) {
      step(s, IDLE);
      s.over = false;   // 부딪혀도 계속 굴려 배치만 본다
      for (const o of s.obstacles) if (!seen.has(o)) { seen.add(o); out.push(`${o.type}@${Math.round(o.x)}`); }
    }
    return out.join();
  };
  const all = new Set([1, 2, 3, 4, 5].map(layout));
  assert.equal(all.size, 5);
});
