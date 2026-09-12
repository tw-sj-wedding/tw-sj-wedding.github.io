// 튜닝 상수는 전부 여기 모은다. 다른 파일에 숫자 리터럴을 두지 않는다.

export const GAME_VERSION = '1.0.0';

export const FP = 256;      // 1 논리 px = 256 고정소수점 단위
export const TICK_HZ = 60;
export const MAX_CATCHUP_TICKS = 5;

export const VIEW = {
  W: 180,        // 논리 가로
  H: 300,        // 논리 세로
  PLAYER_Y: 70,  // 신랑이 그려지는 화면 y (고정)
};

export const STAGE1 = {
  goalM: 800,
  pxPerM: 4,

  scrollStartPxS: 62,
  scrollMaxPxS: 118,

  lives: 3,
  hitInvincibleTicks: 78,   // 1.3초
  hitSlowNum: 55,           // 무적 중 속도 x0.55
  hitSlowDen: 100,
  jumpTicks: 48,            // 점프 체공 0.8초

  latMaxPxS: 130,           // 횡이동 최대 속도
  playerW: 14,
  playerH: 17,

  rowGapMin: 44,
  rowGapMax: 72,
  sameRowMinGap: 46,        // 같은 줄 두 장애물의 x 최소 간격
  sameRowTries: 8,          // 간격 확보 재시도 횟수 (초과 시 1개만 배치)
  twoItemPctStart: 15,      // 한 줄에 2개일 확률 (시작)
  twoItemPctEnd: 55,        // 한 줄에 2개일 확률 (끝)
  jumpPadPct: 20,           // 줄당 점프대 확률

  spawnStopBeforeM: 80,     // 도착 80m 전부터 스폰 중지
  spawnAheadPx: 240,        // 화면 아래로 이만큼 앞서 생성
  despawnBehindPx: 90,      // 화면 위로 이만큼 지나가면 제거
};

export const OBSTACLES = {
  tree:    { w: 12, h: 13 },
  rock:    { w: 10, h: 6 },
  snowman: { w: 10, h: 13 },
  jumppad: { w: 16, h: 4 },
};

export const OBSTACLE_TYPES = ['tree', 'rock', 'snowman'];

// 파생값
export const TOTAL_PX = STAGE1.goalM * STAGE1.pxPerM;                            // 3200
export const SPAWN_STOP_PX = TOTAL_PX - STAGE1.spawnStopBeforeM * STAGE1.pxPerM; // 2880
export const TARGET_Q_MAX = (VIEW.W - STAGE1.playerW) * 4;                       // 664
export const TARGET_Q_CENTER = TARGET_Q_MAX >> 1;                                // 332
