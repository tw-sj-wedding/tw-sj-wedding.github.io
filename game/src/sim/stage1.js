// Stage 1 시뮬레이션 — 순수·결정론 모듈.
// 금지: Math.random, Date, performance, DOM, Math.sin/cos/exp/pow.
// 허용: 사칙연산, Math.imul, 비트 연산, Math.floor/abs/min/max.
// 좌표는 전부 정수 고정소수점(FP=256). x는 스프라이트 좌상단 기준.
// 월드 y는 "출발점에서 내려온 거리"이고, 화면 y = VIEW.PLAYER_Y + (worldY - progress).

import { mulberry32 } from './rng.js';
import { FP, TICK_HZ, VIEW, STAGE1, TOTAL_PX, TARGET_Q_CENTER, TARGET_Q_MAX } from '../config.js';

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

// 한 틱. 순서를 바꾸면 리플레이 호환이 깨진다:
// 카운터 감소 → 목표 x 확정 → 전진 → 횡이동 → (스폰/제거) → (충돌) → 종료 판정
export function step(state, input) {
  if (state.outcome !== null) return;

  state.tick++;
  if (state.invincibleTicks > 0) state.invincibleTicks--;
  if (state.airborneTicks > 0) state.airborneTicks--;

  let q = input.targetXQ | 0;
  if (q < 0) q = 0;
  else if (q > TARGET_Q_MAX) q = TARGET_Q_MAX;
  state.targetXQ = q;

  state.progressFp += advanceFp(state);
  moveLaterally(state);

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
      mix(it.w);
      mix(it.h);
      mix(it.hit ? 1 : 0);
      mix(it.used ? 1 : 0);
    }
  }
  return h >>> 0;
}
