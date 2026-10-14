// 엔드리스 러너 시뮬레이션. 순수 모듈 — DOM·Date·performance·Math.random 금지.
// 같은 seed + 같은 입력이면 항상 같은 결과가 나와야 한다 (테스트 봇이 그것에 기댄다).
//
// 좌표: x 는 월드 거리(px). 화면 x = 월드 x − distance. 신랑은 화면 x = PLAYER_X 에 고정.
//       y 는 지면에서 위로 잰 높이(px).

import { VIEW, JUMP, HITBOX, SPAWN, OBSTACLES, TICK_HZ, SPEED } from '../config.js';
import { speedAtTick, distanceAtTick, scoreAtTick } from '../shared/scoring.js';
import { mulberry32, randInt } from './rng.js';

const AIR_SEC = JUMP.airTicks / TICK_HZ;
const GROUND_TOTAL = SPAWN.ground.reduce((sum, [, w]) => sum + w, 0);

// 장애물이 생성 지점에서 신랑까지 오는 동안 속도가 오르므로, 도착 시점 속도로 최소 간격을 잡는다.
export function minGapAt(tick, speed) {
  const travelTicks = Math.ceil(((VIEW.SPAWN_X - VIEW.PLAYER_X) / speed) * TICK_HZ);
  const arrival = speedAtTick(tick + travelTicks);
  return Math.ceil(arrival * (AIR_SEC + SPAWN.reactionSec));
}

export function createRun(seed) {
  return {
    seed: seed >>> 0,
    rng: mulberry32(seed),
    tick: 0,
    distance: 0,
    speed: SPEED.start,
    playerY: 0,
    airTick: -1,          // -1 = 지상
    ducking: false,
    obstacles: [],
    nextSpawnX: VIEW.SPAWN_X + Math.ceil(SPEED.start * SPAWN.firstGapSec),
    over: false,
    hitType: null,
  };
}

function pickType(state) {
  if (scoreAtTick(state.tick) >= SPAWN.liftFromScore && randInt(state.rng, 100) < SPAWN.liftPct) return 'lift';
  let roll = randInt(state.rng, GROUND_TOTAL);
  for (const [type, weight] of SPAWN.ground) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return SPAWN.ground[0][0];
}

function spawn(state) {
  const type = pickType(state);
  const o = OBSTACLES[type];
  state.obstacles.push({ type, x: state.nextSpawnX, y: o.y, w: o.w, h: o.h });
  const minGap = minGapAt(state.tick, state.speed);
  const extra = randInt(state.rng, Math.floor(minGap * SPAWN.extraGapRatio) + 1);
  state.nextSpawnX += o.w + minGap + extra;
}

export function playerBox(state) {
  const box = state.ducking ? HITBOX.duck : HITBOX.stand;
  return { x: VIEW.PLAYER_X - box.w / 2, y: state.playerY, w: box.w, h: box.h };
}

function movePlayer(state, input) {
  if (state.airTick < 0) {
    if (input.jump) {
      state.airTick = 0;
      state.ducking = false;
    } else {
      state.ducking = !!input.duck;   // 지상에서만 숙인다 (공중 급강하 없음)
      return;
    }
  }
  state.airTick++;
  if (state.airTick >= JUMP.airTicks) {
    state.airTick = -1;
    state.playerY = 0;
    state.ducking = !!input.duck;     // 누른 채 착지하면 그때부터 숙인다
  } else {
    const t = state.airTick / JUMP.airTicks;
    state.playerY = 4 * JUMP.apex * t * (1 - t);
  }
}

function collide(state) {
  const p = playerBox(state);
  for (const o of state.obstacles) {
    const ox = o.x - state.distance;
    if (ox < p.x + p.w && ox + o.w > p.x && o.y < p.y + p.h && o.y + o.h > p.y) {
      state.over = true;
      state.hitType = o.type;
      return;
    }
  }
}

export function step(state, input) {
  if (state.over) return;
  state.tick++;
  state.speed = speedAtTick(state.tick);
  state.distance = distanceAtTick(state.tick);

  movePlayer(state, input);

  while (state.nextSpawnX - state.distance <= VIEW.SPAWN_X) spawn(state);
  if (state.obstacles.length && state.obstacles[0].x + state.obstacles[0].w - state.distance < -20) {
    state.obstacles = state.obstacles.filter((o) => o.x + o.w - state.distance >= -20);
  }

  collide(state);
}

export const isOver = (state) => state.over;
export const getScore = (state) => scoreAtTick(state.tick);

export function poseOf(state) {
  if (state.over) return 'crash';
  if (state.airTick >= 0) return 'jump';
  return state.ducking ? 'duck' : 'run';
}
