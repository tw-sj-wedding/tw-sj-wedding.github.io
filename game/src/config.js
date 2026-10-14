// 튜닝 수치는 전부 여기에 둔다. 실기기에서 해보고 이 파일만 고친다.
// 시뮬·서버 검증이 이 값을 함께 쓰므로, 점수에 영향을 주는 값(SPEED, SCORE, TICK_HZ)을 바꾸면
// GAME_VERSION 도 올리고 Worker 의 CLIENT_VERSIONS 를 갱신해야 한다.

export const GAME_VERSION = '2.1.0';   // 2.1.0: 가속 3, 최고 속도 상한 제거 (#27)

export const TICK_HZ = 60;
export const MAX_CATCHUP_TICKS = 5;

// 보이는 가로는 항상 400 (리더보드 공정성). 세로는 화면 비율에 맞춰 늘어난다.
export const VIEW = { W: 400, PLAYER_X: 60, SPAWN_X: 460, GROUND_RATIO: 0.6 };

// 속도(t) = min(max, start + accel × t). max 가 Infinity 면 끝없이 빨라진다 (1분 420, 3분 780, 5분 1140 px/s)
export const SPEED = { start: 240, accel: 3, max: Infinity };   // px/s, px/s²
export const SCORE = { pxPerPoint: 24, flashEvery: 100 };

// 점프는 높이 고정 포물선. 18틱째 정점 70px, 36틱(0.6초)에 착지.
export const JUMP = { apex: 70, airTicks: 36 };

// 그림보다 작게 잡아 억울한 판정을 줄인다. 숙인 그림의 머리는 약 43px — 높은 새 밑면(46)보다 낮다.
export const HITBOX = { stand: { w: 20, h: 48 }, duck: { w: 20, h: 34 } };

export const SPAWN = {
  firstGapSec: 1.6,      // 시작 후 이 시간 동안은 화면에 장애물이 들어오지 않는다
  reactionSec: 0.25,     // 장애물 사이 최소 간격 = 도착 시점 속도 × (체공 + 이 값)
  extraGapRatio: 0.8,    // 최소 간격 위로 최대 이 비율만큼 무작위로 더 벌린다
  birdFromScore: 150,
  birdPct: 20,
  ground: [['rock1', 26], ['rock2', 20], ['rock3', 12], ['snowman', 28], ['skierDown', 14]],
};

export const OBSTACLES = {
  rock1:    { w: 14, h: 12, y: 0 },
  rock2:    { w: 26, h: 12, y: 0 },
  rock3:    { w: 38, h: 12, y: 0 },
  snowman:  { w: 20, h: 30, y: 0 },
  skierDown: { w: 34, h: 14, y: 0 },   // 넘어진 스키어 — 낮고 넓다, 점프로 넘는다
  birdLow:  { w: 22, h: 14, y: 6 },    // 점프로 넘는다
  birdHigh: { w: 22, h: 14, y: 46 },   // 숙여서 피한다
};

// 애니메이션 (렌더 전용)
export const ANIM = { frameTicks: 8, overDelayMs: 700, countdownMs: 700 };

// 리더보드 Worker 주소. 비어 있으면 리더보드 UI를 숨긴다 (Worker 배포 전에도 게임은 완전히 동작).
export const API_BASE = '';
