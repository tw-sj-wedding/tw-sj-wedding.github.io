// Stage 1 시뮬레이션 — 순수·결정론 모듈.
// 금지: Math.random, Date, performance, DOM, Math.sin/cos/exp/pow.
// 허용: 사칙연산, Math.imul, 비트 연산, Math.floor/abs/min/max.
// 좌표는 전부 정수 고정소수점(FP=256). x는 스프라이트 좌상단 기준.
// 월드 y는 "출발점에서 내려온 거리"이고, 화면 y = VIEW.PLAYER_Y + (worldY - progress).

import { mulberry32, randInt, randRange } from './rng.js';
import {
  FP, TICK_HZ, VIEW, STAGE1, OBSTACLES, OBSTACLE_TYPES,
  TOTAL_PX, SPAWN_STOP_PX, TARGET_Q_CENTER, TARGET_Q_MAX,
} from '../config.js';

const TOTAL_FP = TOTAL_PX * FP;
const PLAYER_X_MAX_FP = (VIEW.W - STAGE1.playerW) * FP;
const LAT_STEP_FP = ((STAGE1.latMaxPxS * FP) / TICK_HZ) | 0;

export function createSim(seed) {
  return {
    seed: seed >>> 0,
    rng: mulberry32(seed),
    tick: 0,
    progressFp: 0,
    playerXFp: TARGET_Q_CENTER * (FP / 4),
    targetXQ: TARGET_Q_CENTER,
    lives: STAGE1.lives,
    invincibleTicks: 0,
    airborneTicks: 0,
    rows: [],
    nextRowYFp: VIEW.H * FP,
    finale: false,
    outcome: null,
  };
}

export function isOver(state) {
  return state.outcome !== null;
}

export function getOutcome(state) {
  return state.outcome;
}

// 틱당 진행량(FP). 거리에 비례해 선형 증가, 무적 중에는 감속.
function advanceFp(state) {
  const progressPx = (state.progressFp / FP) | 0;
  const t = progressPx > TOTAL_PX ? TOTAL_PX : progressPx;
  const span = STAGE1.scrollMaxPxS - STAGE1.scrollStartPxS;
  let vPxS = STAGE1.scrollStartPxS + (((span * t) / TOTAL_PX) | 0);
  if (state.invincibleTicks > 0) {
    vPxS = ((vPxS * STAGE1.hitSlowNum) / STAGE1.hitSlowDen) | 0;
  }
  return ((vPxS * FP) / TICK_HZ) | 0;
}

function moveLaterally(state) {
  const targetFp = state.targetXQ * (FP / 4);
  let d = targetFp - state.playerXFp;
  if (d > LAT_STEP_FP) d = LAT_STEP_FP;
  else if (d < -LAT_STEP_FP) d = -LAT_STEP_FP;
  let x = state.playerXFp + d;
  if (x < 0) x = 0;
  else if (x > PLAYER_X_MAX_FP) x = PLAYER_X_MAX_FP;
  state.playerXFp = x;
}

function makeItem(type, xPx, vxFp = 0) {
  const def = OBSTACLES[type];
  return { type, xFp: xPx * FP, w: def.w, h: def.h, vxFp, hit: false, used: false };
}

// 스키어는 화면을 가로지르는 동적 장애물이다. 정적 장애물처럼 자리를 외워 피할 수
// 없어서 긴장의 대부분을 만든다. 속도·방향은 시뮬 RNG로만 정해 결정론을 지킨다.
function makeSkier(rng) {
  const def = OBSTACLES.skier;
  const speedPxS = randRange(rng, STAGE1.skierMinPxS, STAGE1.skierMaxPxS);
  const vxFp = ((speedPxS * FP) / TICK_HZ) | 0;
  const dir = randInt(rng, 2) === 0 ? -1 : 1;
  return makeItem('skier', randInt(rng, VIEW.W - def.w + 1), vxFp * dir);
}

function spawnRow(state) {
  const items = [];
  const rng = state.rng;

  const roll = randInt(rng, 100);
  if (roll < STAGE1.jumpPadPct) {
    const w = OBSTACLES.jumppad.w;
    items.push(makeItem('jumppad', randInt(rng, VIEW.W - w + 1)));
  } else if (roll < STAGE1.jumpPadPct + STAGE1.skierPct) {
    items.push(makeSkier(rng));
  } else {
    const progressPx = (state.progressFp / FP) | 0;
    const span = STAGE1.twoItemPctEnd - STAGE1.twoItemPctStart;
    const twoPct = STAGE1.twoItemPctStart + (((span * progressPx) / TOTAL_PX) | 0);
    const want = randInt(rng, 100) < twoPct ? 2 : 1;

    const firstType = OBSTACLE_TYPES[randInt(rng, OBSTACLE_TYPES.length)];
    const firstX = randInt(rng, VIEW.W - OBSTACLES[firstType].w + 1);
    items.push(makeItem(firstType, firstX));

    if (want === 2) {
      // 같은 줄 최소 간격을 확보할 때까지 정해진 횟수만 재시도한다.
      // 실패하면 1개만 둔다 — 재시도 횟수가 고정이라 결정론이 유지된다.
      for (let i = 0; i < STAGE1.sameRowTries; i++) {
        const type = OBSTACLE_TYPES[randInt(rng, OBSTACLE_TYPES.length)];
        const x = randInt(rng, VIEW.W - OBSTACLES[type].w + 1);
        if (Math.abs(x - firstX) >= STAGE1.sameRowMinGap) { items.push(makeItem(type, x)); break; }
      }
    }
  }

  state.rows.push({ worldYFp: state.nextRowYFp, items });
}

// 스키어를 움직인다. 화면 밖으로 나가면 다시 못 돌아와 위협이 사라지므로
// 양쪽 벽에서 되돌린다 — 슬로프를 가로질러 왕복하는 것처럼 읽힌다.
function moveDynamic(state) {
  const maxXFp = (VIEW.W - OBSTACLES.skier.w) * FP;
  for (let i = 0; i < state.rows.length; i++) {
    const items = state.rows[i].items;
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      // 0 뿐 아니라 undefined/NaN 도 걸러야 한다. vxFp가 없는 항목을 더하면 xFp가 NaN이
      // 되고, NaN 비교는 전부 false라 AABB 검사의 continue가 안 걸려 그 장애물이
      // 화면 전체와 충돌하게 된다.
      if (!it.vxFp) continue;
      let x = it.xFp + it.vxFp;
      if (x < 0) { x = -x; it.vxFp = -it.vxFp; }
      else if (x > maxXFp) { x = maxXFp - (x - maxXFp); it.vxFp = -it.vxFp; }
      if (x < 0) x = 0;
      else if (x > maxXFp) x = maxXFp;
      it.xFp = x;
    }
  }
}

function updateRows(state) {
  const aheadFp = state.progressFp + STAGE1.spawnAheadPx * FP;
  const stopFp = SPAWN_STOP_PX * FP;
  while (state.nextRowYFp < aheadFp && state.nextRowYFp < stopFp) {
    spawnRow(state);
    state.nextRowYFp += randRange(state.rng, STAGE1.rowGapMin, STAGE1.rowGapMax) * FP;
  }

  const cutFp = state.progressFp - STAGE1.despawnBehindPx * FP;
  let keep = 0;
  for (let i = 0; i < state.rows.length; i++) {
    if (state.rows[i].worldYFp >= cutFp) state.rows[keep++] = state.rows[i];
  }
  state.rows.length = keep;
}

// 신랑과 장애물의 AABB 겹침 판정. 월드 좌표에서 본다.
// 신랑의 월드 y 범위는 [progress, progress + playerH].
function resolveCollisions(state) {
  const pTop = state.progressFp;
  const pBot = pTop + STAGE1.playerH * FP;
  const pL = state.playerXFp;
  const pR = pL + STAGE1.playerW * FP;

  for (let i = 0; i < state.rows.length; i++) {
    const row = state.rows[i];
    const oTop = row.worldYFp;
    for (let j = 0; j < row.items.length; j++) {
      const it = row.items[j];
      const oBot = oTop + it.h * FP;
      if (pBot <= oTop || pTop >= oBot) continue;
      const oL = it.xFp;
      const oR = oL + it.w * FP;
      if (pR <= oL || pL >= oR) continue;

      if (it.type === 'jumppad') {
        if (!it.used) {
          it.used = true;
          state.airborneTicks = STAGE1.jumpTicks;
        }
      } else if (state.airborneTicks === 0 && state.invincibleTicks === 0 && !it.hit) {
        it.hit = true;
        state.lives--;
        state.invincibleTicks = STAGE1.hitInvincibleTicks;
        if (state.lives <= 0) {
          state.lives = 0;
          state.outcome = 'failed';
          return;
        }
      }
    }
  }
}

// 한 틱. 순서를 바꾸면 리플레이 호환이 깨진다:
// 카운터 감소 → 목표 x 확정 → 전진 → 횡이동 → (스폰/제거) → (충돌) → 종료 판정
export function step(state, input) {
  if (state.outcome !== null) return;

  state.tick++;
  if (state.invincibleTicks > 0) state.invincibleTicks--;
  if (state.airborneTicks > 0) state.airborneTicks--;

  // 도착 80m 전부터는 입력을 받지 않고 신랑을 중앙으로 정렬한다 (도착 연출)
  const progressPx = (state.progressFp / FP) | 0;
  if (progressPx >= SPAWN_STOP_PX) state.finale = true;

  if (state.finale) {
    state.targetXQ = TARGET_Q_CENTER;
  } else {
    let q = input.targetXQ | 0;
    if (q < 0) q = 0;
    else if (q > TARGET_Q_MAX) q = TARGET_Q_MAX;
    state.targetXQ = q;
  }

  state.progressFp += advanceFp(state);
  moveLaterally(state);
  updateRows(state);
  moveDynamic(state);
  resolveCollisions(state);
  if (state.outcome !== null) return;

  if (state.progressFp >= TOTAL_FP) {
    state.progressFp = TOTAL_FP;
    state.outcome = 'cleared';
  }
}

// 결정론 테스트용 상태 해시 (FNV-1a 변형)
export function hashState(state) {
  let h = 2166136261 >>> 0;
  const mix = (v) => { h = Math.imul(h ^ (v >>> 0), 16777619) >>> 0; };
  mix(state.tick);
  mix(state.progressFp);
  mix(state.playerXFp);
  mix(state.lives);
  mix(state.invincibleTicks);
  mix(state.airborneTicks);
  mix(state.rows.length);
  for (let i = 0; i < state.rows.length; i++) {
    const r = state.rows[i];
    mix(r.worldYFp);
    for (let j = 0; j < r.items.length; j++) {
      const it = r.items[j];
      mix(it.xFp);
      mix(it.vxFp);
      mix(it.w);
      mix(it.h);
      mix(it.hit ? 1 : 0);
      mix(it.used ? 1 : 0);
    }
  }
  return h >>> 0;
}

// inputLog는 값이 바뀐 틱만 담은 [tick, targetXQ] 배열이다.
export function replay(seed, inputLog) {
  const state = createSim(seed);
  let cursor = 0;
  let q = TARGET_Q_CENTER;
  const guard = TICK_HZ * 180;   // 무한 루프 방지
  while (!isOver(state) && state.tick < guard) {
    while (cursor < inputLog.length && inputLog[cursor][0] <= state.tick) {
      q = inputLog[cursor][1];
      cursor++;
    }
    step(state, { targetXQ: q });
  }
  return state;
}
