# Stage 1 미니게임 + 청첩장 진입 버튼 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하객이 청첩장 최상단 카드를 눌러 게임에 들어가고, 신랑이 꽃다발과 반지를 들고 설원을 내려가 신부에게 도착한 뒤 청첩장으로 돌아온다. 점수 없음, 서버 없음.

**Architecture:** 시뮬레이션(`game/src/sim/`)은 DOM을 모르는 순수 정수 모듈이고, 렌더·입력·UI가 그 위에 얹힌다. 고정 60Hz 틱 + accumulator로 돌리고 렌더만 틱 사이를 보간한다. 개발은 ES module을 직접 로드하는 `game/dev.html`로, 배포는 esbuild가 만든 해시 번들을 참조하는 `game/index.html`로 한다.

**Tech Stack:** Vanilla JS (ES2019 타깃), Canvas 2D, `node --test` (Node 24), esbuild. 프레임워크·게임엔진 없음.

**Spec:** `docs/superpowers/specs/2026-09-12-stage1-and-entry-design.md`
(상위 스펙 `HANDOFF.md`, 결정 기록 `docs/DECISIONS.md`)

## Global Constraints

모든 태스크의 요구사항에 아래가 암묵적으로 포함된다.

- **점수 개념 금지.** Stage 1의 시뮬 상태·결과 객체·UI 어디에도 점수, 수집품, 기록 필드를 만들지 않는다. 하트는 남은 목숨 표시 아이콘으로만 쓴다.
- **진행도는 눈금 없는 진행 바로만.** 남은 거리·경과 시간을 숫자로 표시하지 않는다.
- **`game/src/sim/` 아래는 순수 모듈.** `Math.random`, `Date`, `performance`, DOM, `Math.sin/cos/exp/pow` 등 초월함수 금지. 허용: 사칙연산, `Math.imul`, 비트 연산, `Math.floor/abs/min/max`.
- **정수 고정소수점 `FP = 256`** (1 논리 px = 256 단위). 시뮬 내부 위치·속도는 전부 정수.
- **고정 틱 60Hz**, 한 프레임 최대 5틱까지만 따라잡기.
- 논리 해상도 **180×300**, `devicePixelRatio`는 최대 2, 정수 배율, `image-rendering: pixelated`.
- 높이는 `100dvh` 또는 `window.innerHeight` 기준. **`100vh` 금지.** 노치는 `env(safe-area-inset-*)`.
- 게임 캔버스 컨테이너에 `touch-action: none; overscroll-behavior: none; user-select: none; -webkit-touch-callout: none;`
- 사용자 문자열 출력은 `textContent`만. `innerHTML` 금지.
- 청첩장 `index.html`과 `css/aesthetic.css`는 **Task 11에서 추가하는 블록 외에는 수정하지 않는다.**
- 시크릿·토큰·`.env`·`.dev.vars`는 절대 커밋하지 않는다 (공개 저장소).
- **기능 단위마다 GitHub 이슈를 남긴다.** 각 태스크는 대응하는 이슈 번호를 커밋 메시지 본문에
  `Closes #N` 으로 적어 닫는다. 계획에 없던 작업(버그, 실기기에서 나온 튜닝, 범위 추가)이
  생기면 손대기 전에 `gh issue create` 로 이슈부터 만든다 — 나중에 무엇을 왜 했는지
  되짚을 수 있는 유일한 기록이다.
- 커밋 메시지 말미에 아래 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
  ```

## File Structure

| 파일 | 책임 |
|---|---|
| `CLAUDE.md` | 저장소 규칙 요약 (HANDOFF 부록 B + 실제 주소·빌드 필수 단계) |
| `package.json` | `type: module`, `test`/`build` 스크립트, esbuild devDependency |
| `game/src/config.js` | 튜닝 상수 전부. 다른 파일에 숫자 리터럴을 두지 않는다 |
| `game/src/sim/rng.js` | mulberry32 정수 PRNG |
| `game/src/sim/stage1.js` | Stage 1 규칙 전부. 순수·결정론 |
| `game/src/render/sprites.js` | 코드로 그린 스프라이트를 오프스크린 캔버스에 1회 캐시 |
| `game/src/render/renderer.js` | 캔버스 스케일링 + 한 프레임 그리기 (보간 포함) |
| `game/src/input.js` | 상대 드래그 → `targetXQ`. 키보드는 개발용 |
| `game/src/audio.js` | 첫 탭 unlock 배관만. 소리 없이도 성립 |
| `game/src/ui/screens.js` | HTML 오버레이 (타이틀·진행 바·목숨·클리어·실패·일시정지) |
| `game/src/main.js` | 부트, 고정 틱 루프, 상태 머신 |
| `game/dev.html` | 개발 진입점 (모듈 직접 로드) |
| `game/index.html` | 릴리즈 진입점 (해시 번들만 참조) |
| `scripts/build-game.mjs` | esbuild 번들 → 해시 파일명 → `game/index.html` 치환 → 옛 번들 정리 |
| `tests/*.test.mjs` | 시뮬 결정론·규칙·난이도, 빌드, 청첩장 마크업 회귀 |

---

### Task 1: 프로젝트 뼈대 + 결정론 RNG

**Issue:** #1
**Files:**
- Create: `package.json`, `CLAUDE.md`, `game/src/sim/rng.js`
- Modify: `.gitignore`
- Test: `tests/rng.test.mjs`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `mulberry32(seed: int) -> (() => uint32)`
  - `randInt(rng, n: int) -> int` (0 이상 n 미만)
  - `randRange(rng, lo: int, hi: int) -> int` (lo 이상 hi 이하)

- [ ] **Step 1: `.gitignore`에 항목 추가**

기존 내용(`.DS_Store`, `_preview.html`) 아래에 이어 붙인다:

```
node_modules/
.env
.env.*
.wrangler/
worker/.dev.vars
```

- [ ] **Step 2: `package.json` 생성**

```json
{
  "name": "tw-sj-wedding-game",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test \"tests/**/*.test.mjs\"",
    "build": "node scripts/build-game.mjs"
  },
  "devDependencies": {
    "esbuild": "^0.28.2"
  }
}
```

- [ ] **Step 3: 실패하는 테스트 작성 — `tests/rng.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt, randRange } from '../game/src/sim/rng.js';

test('같은 seed는 같은 수열을 낸다', () => {
  const a = mulberry32(12345);
  const b = mulberry32(12345);
  const seqA = Array.from({ length: 50 }, () => a());
  const seqB = Array.from({ length: 50 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test('다른 seed는 다른 수열을 낸다', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notDeepEqual(
    Array.from({ length: 20 }, () => a()),
    Array.from({ length: 20 }, () => b()),
  );
});

test('출력은 항상 부호 없는 32bit 정수다', () => {
  const rng = mulberry32(777);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(Number.isInteger(v), `정수가 아님: ${v}`);
    assert.ok(v >= 0 && v <= 0xffffffff, `범위 밖: ${v}`);
  }
});

test('randInt는 0 이상 n 미만이고 전 구간을 쓴다', () => {
  const rng = mulberry32(42);
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const v = randInt(rng, 6);
    assert.ok(v >= 0 && v < 6, `범위 밖: ${v}`);
    seen.add(v);
  }
  assert.equal(seen.size, 6);
});

test('randRange는 양 끝값을 포함한다', () => {
  const rng = mulberry32(99);
  const seen = new Set();
  for (let i = 0; i < 3000; i++) {
    const v = randRange(rng, 44, 72);
    assert.ok(v >= 44 && v <= 72, `범위 밖: ${v}`);
    seen.add(v);
  }
  assert.ok(seen.has(44), '하한 44가 한 번도 안 나옴');
  assert.ok(seen.has(72), '상한 72가 한 번도 안 나옴');
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module '../game/src/sim/rng.js'`

- [ ] **Step 5: `game/src/sim/rng.js` 구현**

표준 mulberry32는 0~1 실수를 돌려주지만, 여기서는 부동소수 연산을 시뮬에 들이지 않으려고 **uint32를 그대로 돌려준다.**

```js
// 결정론 PRNG. 부동소수 연산을 쓰지 않으려고 0~1 실수 대신 uint32를 돌려준다.
// 시뮬용 RNG와 연출(파티클)용 RNG는 반드시 별도 인스턴스를 만들어 쓴다.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return (t ^ (t >>> 14)) >>> 0;
  };
}

// 0 이상 n 미만
export function randInt(rng, n) {
  return (rng() % n) >>> 0;
}

// lo 이상 hi 이하
export function randRange(rng, lo, hi) {
  return lo + randInt(rng, hi - lo + 1);
}
```

- [ ] **Step 6: 의존성 설치 후 테스트 통과 확인**

Run: `npm install && npm test`
Expected: PASS — rng 테스트 5개 통과

주의: `node --test tests/` 처럼 디렉터리를 넘기면 Node 24가 그것을 모듈 경로로 해석해
`MODULE_NOT_FOUND`로 죽는다. 러너는 glob(`tests/**/*.test.mjs`)이나 파일 경로만 받는다.

- [ ] **Step 7: `CLAUDE.md` 작성**

```markdown
# 청첩장 미니게임

- 전체 스펙: `HANDOFF.md` · 결정 기록: `docs/DECISIONS.md` · 현재 범위 설계: `docs/superpowers/specs/2026-09-12-stage1-and-entry-design.md`
- 배포: https://tw-sj-wedding.github.io/ (저장소 루트 서빙, GitHub Pages). 게임은 `/game/`.
- 공개 저장소다. 토큰·시크릿·`.env`·`.dev.vars`를 커밋하지 않는다.
- 게임 코드는 `/game` 에만 쓴다. 청첩장 페이지는 진입 카드 블록 외에 수정하지 않는다.

## 타깃

카카오톡 인앱 브라우저 (iOS WKWebView / Android WebView), 세로 전용, 터치.
`100dvh`(`100vh` 금지), `touch-action:none`, `overscroll-behavior:none`,
오디오는 첫 탭에서 unlock하고 **소리 없이도 게임이 성립**해야 한다.
성능 기준 기기는 보급형 갤럭시.

## 게임 규칙

- Canvas 2D, 논리 180x300 픽셀아트, 게임 엔진 없음. UI 텍스트는 HTML 오버레이.
- **Stage 1에 점수는 없다.** 수집품·점수 공식·기록 표시를 만들지 않는다.
  진행도는 눈금 없는 진행 바로만 보여준다. 점수와 리더보드는 Stage 2 전용.
- 고정 60Hz 틱. `game/src/sim/` 아래는 결정론 순수 모듈:
  `Math.random`/`Date`/`performance`/DOM/초월함수 금지, 정수 고정소수점(FP=256),
  시뮬 RNG와 연출 RNG 분리.
- 튜닝 숫자는 전부 `game/src/config.js`에 둔다.

## 작업 기록

- **기능 단위마다 GitHub 이슈를 남긴다.** 저장소는 `tw-sj-wedding/tw-sj-wedding.github.io`,
  `gh` CLI는 `twoongg` 계정으로 인증돼 있다.
- 새 기능·버그·튜닝에 손대기 전에 `gh issue create --title ... --body ...` 로 이슈를 먼저 만든다.
- 커밋 메시지 본문에 `Closes #N` 을 적어 이슈를 닫는다. 여러 커밋에 걸치는 기능이면
  마지막 커밋에서만 닫는다.
- 이슈 라벨: `game`(게임 본체), `invitation`(청첩장 페이지), `infra`(빌드·배포·테스트),
  `qa`(실기기 확인에서 나온 것).
- 마일스톤은 `HANDOFF.md` §10의 M0~M7을 그대로 쓴다.

## 개발과 배포

- 개발: `python3 -m http.server 8000` 후 `http://localhost:8000/game/dev.html`
  (모듈을 직접 로드하므로 빌드 불필요)
- 테스트: `npm test`
- **배포 전 `npm run build`는 필수다.** 카톡 인앱 캐시가 강해서 해시 파일명이
  유일한 무효화 수단이고, `game/index.html`은 빌드가 만든 번들만 참조한다.
  빌드를 빼먹으면 하객에게 옛 버전이 계속 나간다.
- `?debug=1`일 때만 vConsole을 로드한다 (카톡 웹뷰는 원격 디버깅이 사실상 불가).
```

- [ ] **Step 8: 커밋**

```bash
git add .gitignore package.json package-lock.json CLAUDE.md game/src/sim/rng.js tests/rng.test.mjs
git commit -m "$(cat <<'MSG'
feat(game): 프로젝트 뼈대와 결정론 PRNG

Closes #1

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 2: 튜닝 상수 + 시뮬 골격 (진행·속도 램프·클리어)

**Issue:** #2
장애물도 입력도 없이, 신랑이 800m를 내려가 `cleared`가 되는 데까지만 만든다.

**Files:**
- Create: `game/src/config.js`, `game/src/sim/stage1.js`
- Test: `tests/stage1-progress.test.mjs`

**Interfaces:**
- Consumes: `mulberry32` (Task 1)
- Produces:
  - `FP = 256`, `TICK_HZ = 60`, `VIEW`, `STAGE1`, `OBSTACLES`, `GAME_VERSION` — `game/src/config.js`
  - `createSim(seed: int) -> State`
  - `step(state: State, input: {targetXQ: int}) -> void`
  - `isOver(state) -> boolean`
  - `getOutcome(state) -> 'cleared' | 'failed' | null`
  - `hashState(state) -> uint32`
  - State 필드: `tick, progressFp, playerXFp, targetXQ, lives, invincibleTicks, airborneTicks, rows, nextRowYFp, finale, outcome`

- [ ] **Step 1: `game/src/config.js` 작성**

```js
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
export const TOTAL_PX = STAGE1.goalM * STAGE1.pxPerM;                        // 3200
export const SPAWN_STOP_PX = TOTAL_PX - STAGE1.spawnStopBeforeM * STAGE1.pxPerM; // 2880
export const TARGET_Q_MAX = (VIEW.W - STAGE1.playerW) * 4;                   // 664
export const TARGET_Q_CENTER = TARGET_Q_MAX >> 1;                            // 332
```

- [ ] **Step 2: 실패하는 테스트 작성 — `tests/stage1-progress.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, getOutcome } from '../game/src/sim/stage1.js';
import { TOTAL_PX, FP, TARGET_Q_CENTER } from '../game/src/config.js';

const hold = { targetXQ: TARGET_Q_CENTER };

function runToEnd(seed, maxTicks = 60 * 120) {
  const s = createSim(seed);
  let t = 0;
  while (!isOver(s) && t < maxTicks) { step(s, hold); t++; }
  return s;
}

test('시작 상태에는 점수 관련 필드가 없다', () => {
  const s = createSim(1);
  for (const banned of ['score', 'points', 'hearts', 'combo', 'best']) {
    assert.ok(!(banned in s), `금지된 필드가 있음: ${banned}`);
  }
});

test('진행 거리는 매 틱 증가한다', () => {
  const s = createSim(1);
  let prev = s.progressFp;
  for (let i = 0; i < 100; i++) {
    step(s, hold);
    assert.ok(s.progressFp > prev, `틱 ${i}에서 진행이 멈춤`);
    prev = s.progressFp;
  }
});

test('스크롤 속도는 거리에 따라 증가하고 상한을 넘지 않는다', () => {
  const s = createSim(1);
  step(s, hold);
  const early = s.progressFp;
  while (s.progressFp < (TOTAL_PX * FP * 3) / 4 && !isOver(s)) step(s, hold);
  const before = s.progressFp;
  step(s, hold);
  const late = s.progressFp - before;
  assert.ok(late > early, '후반 속도가 초반보다 빠르지 않음');
  assert.ok(late <= (118 * FP) / 60 + 1, '속도 상한 118px/s 초과');
});

test('장애물을 맞지 않으면 800m에서 cleared로 끝난다', () => {
  const s = runToEnd(1);
  assert.equal(getOutcome(s), 'cleared');
  assert.ok(s.progressFp >= TOTAL_PX * FP, '목표 거리 미달인데 클리어');
});

test('목표 플레이 시간은 30~40초 범위다', () => {
  const s = runToEnd(1);
  const seconds = s.tick / 60;
  assert.ok(seconds >= 30 && seconds <= 40, `플레이 시간 ${seconds.toFixed(1)}초`);
});

test('끝난 뒤에는 step을 더 불러도 상태가 변하지 않는다', () => {
  const s = runToEnd(1);
  const snapshot = JSON.stringify({ t: s.tick, p: s.progressFp, o: s.outcome });
  step(s, hold);
  step(s, hold);
  assert.equal(JSON.stringify({ t: s.tick, p: s.progressFp, o: s.outcome }), snapshot);
});

test('결과 객체에 점수가 없다', () => {
  const s = runToEnd(1);
  assert.equal(typeof getOutcome(s), 'string');
  assert.deepEqual(Object.keys(s).filter((k) => /score|point|heart/i.test(k)), []);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `node --test tests/stage1-progress.test.mjs`
Expected: FAIL — `Cannot find module '../game/src/sim/stage1.js'`

- [ ] **Step 4: `game/src/sim/stage1.js` 최소 구현**

장애물·충돌은 아직 넣지 않는다. `rows`/`nextRowYFp`는 다음 태스크가 채울 자리로 비워둔다.

```js
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
    nextRowYFp: 0,
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/stage1-progress.test.mjs`
Expected: PASS — 7개 통과.
만약 "목표 플레이 시간 30~40초" 테스트만 실패하면 `config.js`의 `scrollStartPxS`/`scrollMaxPxS`를 조정한다. 다른 파일은 건드리지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add game/src/config.js game/src/sim/stage1.js tests/stage1-progress.test.mjs
git commit -m "$(cat <<'MSG'
feat(game): Stage 1 시뮬 골격 — 진행, 속도 램프, 클리어 판정

Closes #2

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 3: 장애물 스폰 (결정론 PRNG)

**Issue:** #3
**Files:**
- Modify: `game/src/sim/stage1.js`
- Test: `tests/stage1-spawn.test.mjs`

**Interfaces:**
- Consumes: `createSim`, `step`, `isOver` (Task 2); `randInt`, `randRange` (Task 1)
- Produces: State의 `rows` 채워짐.
  - row 형태: `{ worldYFp: int, items: Item[] }`
  - Item 형태: `{ type: 'tree'|'rock'|'snowman'|'jumppad', xFp: int, w: int, h: int, hit: false, used: false }`

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/stage1-spawn.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver } from '../game/src/sim/stage1.js';
import { FP, VIEW, STAGE1, SPAWN_STOP_PX, TARGET_Q_CENTER } from '../game/src/config.js';

const hold = { targetXQ: TARGET_Q_CENTER };

// 스폰된 모든 줄을 종료까지 모아본다 (제거되기 전에 기록)
function collectRows(seed) {
  const s = createSim(seed);
  const seen = new Map();
  let t = 0;
  while (!isOver(s) && t < 60 * 120) {
    for (const r of s.rows) if (!seen.has(r.worldYFp)) seen.set(r.worldYFp, r);
    step(s, hold);
    t++;
  }
  return [...seen.values()].sort((a, b) => a.worldYFp - b.worldYFp);
}

test('줄이 생성된다', () => {
  assert.ok(collectRows(1).length > 20, '장애물 줄이 너무 적음');
});

test('줄 간격은 44~72px이다', () => {
  const rows = collectRows(7);
  for (let i = 1; i < rows.length; i++) {
    const gapPx = (rows[i].worldYFp - rows[i - 1].worldYFp) / FP;
    assert.ok(gapPx >= STAGE1.rowGapMin && gapPx <= STAGE1.rowGapMax, `줄 간격 ${gapPx}px`);
  }
});

test('장애물은 화면 가로 안에 들어간다', () => {
  for (const r of collectRows(3)) {
    for (const it of r.items) {
      const x = it.xFp / FP;
      assert.ok(x >= 0, `x가 음수: ${x}`);
      assert.ok(x + it.w <= VIEW.W, `오른쪽으로 삐져나감: ${x} + ${it.w}`);
    }
  }
});

test('같은 줄 장애물은 46px 이상 떨어져 있다', () => {
  for (const r of collectRows(11)) {
    if (r.items.length < 2) continue;
    const xs = r.items.map((it) => it.xFp / FP).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      assert.ok(xs[i] - xs[i - 1] >= STAGE1.sameRowMinGap, `같은 줄 간격 ${xs[i] - xs[i - 1]}px`);
    }
  }
});

test('한 줄에 장애물은 최대 2개다', () => {
  for (const r of collectRows(5)) assert.ok(r.items.length <= 2, `한 줄 ${r.items.length}개`);
});

test('점프대가 있는 줄에는 다른 장애물이 없다', () => {
  for (const r of collectRows(13)) {
    if (r.items.some((it) => it.type === 'jumppad')) assert.equal(r.items.length, 1);
  }
});

test('도착 80m 전부터는 새 줄이 생기지 않는다', () => {
  for (const r of collectRows(2)) {
    assert.ok(r.worldYFp / FP < SPAWN_STOP_PX, `스폰 중지 구간에 줄이 생김: ${r.worldYFp / FP}px`);
  }
});

test('통과 가능한 빈틈이 항상 신랑 폭보다 넓다', () => {
  for (const r of collectRows(17)) {
    const solids = r.items.filter((it) => it.type !== 'jumppad')
      .map((it) => [it.xFp / FP, it.xFp / FP + it.w]).sort((a, b) => a[0] - b[0]);
    let widest = 0;
    let cursor = 0;
    for (const [l, rr] of solids) { widest = Math.max(widest, l - cursor); cursor = Math.max(cursor, rr); }
    widest = Math.max(widest, VIEW.W - cursor);
    if (solids.length) assert.ok(widest >= STAGE1.playerW, `통과 가능한 빈틈이 ${widest}px 뿐`);
  }
});

test('지나간 줄은 제거된다 (rows가 무한히 자라지 않음)', () => {
  const s = createSim(1);
  let max = 0;
  let t = 0;
  while (!isOver(s) && t < 60 * 120) { step(s, hold); max = Math.max(max, s.rows.length); t++; }
  assert.ok(max < 20, `동시 보유 줄이 ${max}개까지 늘어남`);
});

test('같은 seed는 같은 스폰 배치를 만든다', () => {
  const a = JSON.stringify(collectRows(1234));
  const b = JSON.stringify(collectRows(1234));
  assert.equal(a, b);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/stage1-spawn.test.mjs`
Expected: FAIL — "장애물 줄이 너무 적음" (`rows`가 계속 빈 배열)

- [ ] **Step 3: `game/src/sim/stage1.js`에 스폰 구현**

import에 `randInt`, `randRange`, `OBSTACLES`, `OBSTACLE_TYPES`, `SPAWN_STOP_PX`를 추가하고 아래를 넣는다.

```js
function makeItem(type, xPx) {
  const def = OBSTACLES[type];
  return { type, xFp: xPx * FP, w: def.w, h: def.h, hit: false, used: false };
}

function spawnRow(state) {
  const items = [];
  const rng = state.rng;

  if (randInt(rng, 100) < STAGE1.jumpPadPct) {
    const w = OBSTACLES.jumppad.w;
    items.push(makeItem('jumppad', randInt(rng, VIEW.W - w + 1)));
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
```

`createSim`의 `nextRowYFp` 초기값을 첫 줄이 화면 아래에서 시작하도록 바꾼다:

```js
    nextRowYFp: VIEW.H * FP,
```

`step`에서 횡이동 다음에 호출한다:

```js
  moveLaterally(state);
  updateRows(state);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — Task 1~3 테스트 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add game/src/sim/stage1.js tests/stage1-spawn.test.mjs
git commit -m "$(cat <<'MSG'
feat(game): 결정론 PRNG 기반 장애물 스폰

Closes #3

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 4: 충돌·목숨·무적·점프대

**Issue:** #4
**Files:**
- Modify: `game/src/sim/stage1.js`
- Test: `tests/stage1-collision.test.mjs`

**Interfaces:**
- Consumes: Task 3의 `rows`/Item 구조
- Produces: `getOutcome(state) -> 'failed'` 경로, `state.lives` 감소, `state.invincibleTicks`/`state.airborneTicks` 세팅

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/stage1-collision.test.mjs`**

`rows`를 직접 심어서 판정만 떼어 검사한다. 스폰 RNG에 의존하지 않으므로 튜닝값이 바뀌어도 이 테스트는 안 깨진다.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, getOutcome } from '../game/src/sim/stage1.js';
import { FP, VIEW, STAGE1, OBSTACLES } from '../game/src/config.js';

// 신랑 바로 앞(아래)에 지정한 장애물 하나만 놓은 시뮬을 만든다.
function simWithItem(type, opts = {}) {
  const s = createSim(1);
  s.nextRowYFp = 1 << 30;          // 자동 스폰 정지
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
  assert.equal(s.lives, STAGE1.lives - 1);
  assert.ok(s.invincibleTicks > 0, '무적이 안 걸림');
});

test('같은 장애물에 두 번 맞지 않는다', () => {
  const s = simWithItem('tree');
  runTicks(s, 120);
  assert.equal(s.lives, STAGE1.lives - 1);
});

test('무적 중에는 다른 장애물에도 안 맞는다', () => {
  const s = simWithItem('tree');
  runTicks(s, 60);
  assert.equal(s.lives, STAGE1.lives - 1);
  const def = OBSTACLES.rock;
  const x = Math.round(s.playerXFp / FP + STAGE1.playerW / 2 - def.w / 2);
  s.rows.push({
    worldYFp: s.progressFp + 20 * FP,
    items: [{ type: 'rock', xFp: x * FP, w: def.w, h: def.h, hit: false, used: false }],
  });
  runTicks(s, 40);
  assert.equal(s.lives, STAGE1.lives - 1, '무적 중에 또 맞음');
});

test('옆으로 비켜 있으면 안 맞는다', () => {
  const s = simWithItem('tree', { x: 0 });
  s.playerXFp = (VIEW.W - STAGE1.playerW) * FP;
  s.targetXQ = (VIEW.W - STAGE1.playerW) * 4;
  runTicks(s, 60);
  assert.equal(s.lives, STAGE1.lives);
});

test('점프대를 밟으면 체공 상태가 된다', () => {
  const s = simWithItem('jumppad');
  runTicks(s, 60);
  assert.ok(s.airborneTicks > 0, '점프가 안 걸림');
  assert.equal(s.lives, STAGE1.lives, '점프대에 맞아서 목숨이 줄었음');
});

test('체공 중에는 장애물 충돌이 무시된다', () => {
  const s = simWithItem('jumppad', { aheadPx: 20 });
  const def = OBSTACLES.tree;
  const x = Math.round(s.playerXFp / FP + STAGE1.playerW / 2 - def.w / 2);
  s.rows.push({
    worldYFp: 45 * FP,
    items: [{ type: 'tree', xFp: x * FP, w: def.w, h: def.h, hit: false, used: false }],
  });
  runTicks(s, 60);
  assert.equal(s.lives, STAGE1.lives, '체공 중에 맞았음');
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/stage1-collision.test.mjs`
Expected: FAIL — "무적이 안 걸림" (충돌 판정이 아직 없음)

- [ ] **Step 3: `game/src/sim/stage1.js`에 충돌 판정 구현**

```js
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
```

`step`에서 `updateRows(state)` 다음, 클리어 판정 앞에 넣는다:

```js
  updateRows(state);
  resolveCollisions(state);
  if (state.outcome !== null) return;

  if (state.progressFp >= TOTAL_FP) { ... }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — Task 1~4 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add game/src/sim/stage1.js tests/stage1-collision.test.mjs
git commit -m "$(cat <<'MSG'
feat(game): 충돌 판정, 목숨, 무적, 점프대

Closes #4

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 5: 도착 연출 상태 + 결정론 리플레이 + 난이도 분포

**Issue:** #5
시뮬을 완성하고, 이 계획에서 가장 중요한 안전망 두 개(리플레이 재현, 클리어율)를 건다.

**Files:**
- Modify: `game/src/sim/stage1.js`
- Create: `tests/helpers/bot.mjs`
- Test: `tests/stage1-determinism.test.mjs`, `tests/stage1-difficulty.test.mjs`

**Interfaces:**
- Consumes: Task 2~4 전부
- Produces:
  - `state.finale: boolean` — 도착 80m 전부터 true, 이 구간에서는 입력이 무시되고 신랑이 중앙으로 자동 정렬된다
  - `replay(seed, inputLog) -> State` — `[tick, targetXQ]` 배열을 재생
  - `tests/helpers/bot.mjs`: `botInput(state) -> {targetXQ}` — 가장 넓은 빈틈으로 향하는 단순 봇

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/stage1-determinism.test.mjs`**

```js
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
  // 왼쪽 끝으로 붙인 채 끝까지 간다
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
```

- [ ] **Step 2: `tests/helpers/bot.mjs` 작성**

```js
// 난이도 확인용 단순 봇. 앞에 있는 가장 가까운 줄에서 가장 넓은 빈틈의 한가운데로 향한다.
// 사람보다 못하게 만드는 것이 목적이 아니라, 클리어율의 하한을 재는 것이 목적이다.
import { FP, VIEW, STAGE1, TARGET_Q_MAX } from '../../game/src/config.js';

export function botInput(state) {
  const pTop = state.progressFp;
  let best = null;
  for (const row of state.rows) {
    const dy = row.worldYFp - pTop;
    if (dy < 0 || dy > 120 * FP) continue;
    if (!row.items.some((it) => it.type !== 'jumppad')) continue;
    if (best === null || dy < best.dy) best = { dy, row };
  }
  if (best === null) return { targetXQ: state.targetXQ };

  const solids = best.row.items
    .filter((it) => it.type !== 'jumppad')
    .map((it) => [it.xFp / FP, it.xFp / FP + it.w])
    .sort((a, b) => a[0] - b[0]);

  let cursor = 0;
  let widest = -1;
  let center = VIEW.W / 2;
  for (const [l, r] of solids) {
    if (l - cursor > widest) { widest = l - cursor; center = (cursor + l) / 2; }
    cursor = Math.max(cursor, r);
  }
  if (VIEW.W - cursor > widest) center = (cursor + VIEW.W) / 2;

  let q = Math.round((center - STAGE1.playerW / 2) * 4);
  if (q < 0) q = 0;
  else if (q > TARGET_Q_MAX) q = TARGET_Q_MAX;
  return { targetXQ: q };
}
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `node --test tests/stage1-determinism.test.mjs`
Expected: FAIL — `replay is not a function`

- [ ] **Step 4: finale과 `replay`를 `game/src/sim/stage1.js`에 구현**

`step`에서 목표 x를 확정하는 부분을 아래로 바꾼다:

```js
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
```

파일 끝에 리플레이를 추가한다:

```js
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test tests/stage1-determinism.test.mjs`
Expected: PASS — 5개 통과

- [ ] **Step 6: 난이도 분포 테스트 작성 — `tests/stage1-difficulty.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, step, isOver, getOutcome } from '../game/src/sim/stage1.js';
import { botInput } from './helpers/bot.mjs';

function play(seed) {
  const s = createSim(seed);
  let t = 0;
  while (!isOver(s) && t < 60 * 120) { step(s, botInput(s)); t++; }
  return { outcome: getOutcome(s), lives: s.lives, ticks: s.tick };
}

test('단순 봇 기준 클리어율이 80% 이상이다 (난이도 easy)', () => {
  const runs = [];
  for (let seed = 1; seed <= 300; seed++) runs.push(play(seed));
  const cleared = runs.filter((r) => r.outcome === 'cleared').length;
  const rate = cleared / runs.length;
  console.log(`클리어율 ${(rate * 100).toFixed(1)}% (${cleared}/300)`);
  assert.ok(rate >= 0.8, `클리어율 ${(rate * 100).toFixed(1)}% — config.js 난이도를 낮춰야 함`);
});

test('모든 seed가 120초 안에 끝난다 (교착 없음)', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const r = play(seed);
    assert.ok(r.outcome !== null, `seed ${seed}: 끝나지 않음`);
  }
});
```

- [ ] **Step 7: 난이도 테스트 실행**

Run: `node --test tests/stage1-difficulty.test.mjs`
Expected: PASS. 클리어율이 80% 미만이면 `config.js`에서 이 순서로 낮춘다 —
`twoItemPctEnd` ↓ → `rowGapMin`/`rowGapMax` ↑ → `scrollMaxPxS` ↓.
**`config.js` 외의 파일은 고치지 않는다.** 조정했으면 최종 클리어율을 `docs/DECISIONS.md`에 한 줄 남긴다.

- [ ] **Step 8: 커밋**

```bash
git add game/src/sim/stage1.js tests/helpers/bot.mjs tests/stage1-determinism.test.mjs tests/stage1-difficulty.test.mjs docs/DECISIONS.md
git commit -m "$(cat <<'MSG'
feat(game): 도착 연출 구간, 리플레이 재생, 결정론·난이도 테스트

Closes #5

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 6: 스프라이트 + 렌더러

**Issue:** #6
**Files:**
- Create: `game/src/render/sprites.js`, `game/src/render/renderer.js`
- Test: 없음 (자동 테스트 대상 아님 — Task 8의 `dev.html`에서 눈으로 확인)

**Interfaces:**
- Consumes: `VIEW`, `STAGE1`, `FP`, `OBSTACLES`, `TOTAL_PX`, `SPAWN_STOP_PX` (config)
- Produces:
  - `getSprite(name) -> HTMLCanvasElement` — `'groom' | 'bride' | 'tree' | 'rock' | 'snowman' | 'jumppad' | 'arch'`
  - `createRenderer(canvas) -> { resize(), draw(state, prev, alpha) }`
  - `prev` 형태: `{ progressFp: int, playerXFp: int }`

- [ ] **Step 1: `game/src/render/sprites.js` 작성**

스프라이트는 `[x, y, w, h, color]` 사각형 목록으로 정의하고 오프스크린 캔버스에 한 번만 굽는다. 매 프레임 `fillRect`를 반복하지 않는 것이 보급형 기기 성능의 핵심이다.

```js
// 코드로 그린 플레이스홀더 스프라이트. M6에서 실제 픽셀아트로 교체한다.
// 크기는 HANDOFF 부록 A 표를 따른다.

const P = {
  ink:   '#2f2a27',
  hair:  '#3b2a20',
  skin:  '#f0c8a0',
  suit:  '#3a3f52',
  shirt: '#ffffff',
  rose:  '#c2836f',
  petal: '#e6b6a5',
  gold:  '#e8c46a',
  leaf:  '#4a7a55',
  wood:  '#6b4b36',
  snow:  '#eef2f5',
  shade: '#c9d3db',
  veil:  '#fbf7f4',
  board: '#8a5c48',
};

// [x, y, w, h, color]
const DEFS = {
  groom: { w: 14, h: 17, rects: [
    [4, 0, 6, 4, P.hair],
    [5, 2, 4, 3, P.skin],
    [4, 5, 6, 6, P.suit],
    [6, 5, 2, 4, P.shirt],
    [6, 6, 2, 1, P.rose],
    [2, 6, 2, 5, P.suit],
    [10, 6, 2, 5, P.suit],
    [1, 10, 3, 3, P.petal],
    [1, 12, 3, 1, P.leaf],
    [11, 10, 2, 2, P.gold],
    [5, 11, 4, 3, P.suit],
    [3, 14, 8, 2, P.board],
    [3, 16, 8, 1, P.ink],
  ]},
  bride: { w: 14, h: 16, rects: [
    [4, 0, 6, 3, P.hair],
    [5, 2, 4, 3, P.skin],
    [3, 0, 8, 2, P.veil],
    [4, 5, 6, 5, P.veil],
    [3, 9, 8, 5, P.shirt],
    [2, 13, 10, 1, P.veil],
    [6, 6, 2, 2, P.petal],
    [4, 14, 6, 1, P.ink],
  ]},
  tree: { w: 12, h: 13, rects: [
    [5, 9, 2, 4, P.wood],
    [4, 6, 4, 4, P.leaf],
    [2, 3, 8, 4, P.leaf],
    [3, 0, 6, 4, P.leaf],
    [4, 0, 4, 2, '#3d6647'],
  ]},
  rock: { w: 10, h: 6, rects: [
    [1, 3, 8, 3, '#8d8781'],
    [2, 1, 6, 3, '#a8a29c'],
    [3, 0, 4, 2, '#bdb7b1'],
  ]},
  snowman: { w: 10, h: 13, rects: [
    [1, 7, 8, 6, P.shirt],
    [2, 2, 6, 6, P.shirt],
    [3, 4, 1, 1, P.ink],
    [6, 4, 1, 1, P.ink],
    [4, 6, 2, 1, P.rose],
    [2, 1, 6, 1, P.ink],
    [3, 0, 4, 1, P.ink],
    [0, 9, 1, 1, P.wood],
    [9, 9, 1, 1, P.wood],
  ]},
  jumppad: { w: 16, h: 4, rects: [
    [0, 1, 16, 3, P.rose],
    [1, 0, 14, 1, P.petal],
  ]},
  // 결승선 꽃 아치 (연출 전용, 크기는 자유)
  arch: { w: 60, h: 34, rects: [
    [4, 8, 4, 26, P.leaf],
    [52, 8, 4, 26, P.leaf],
    [4, 4, 52, 5, P.leaf],
    [2, 2, 8, 5, P.petal],
    [50, 2, 8, 5, P.petal],
    [16, 1, 6, 5, P.petal],
    [38, 1, 6, 5, P.petal],
    [27, 0, 6, 5, P.rose],
    [6, 14, 3, 3, P.petal],
    [51, 14, 3, 3, P.petal],
    [6, 24, 3, 3, P.rose],
    [51, 24, 3, 3, P.rose],
  ]},
};

const cache = new Map();

export function getSprite(name) {
  const hit = cache.get(name);
  if (hit) return hit;

  const def = DEFS[name];
  if (!def) throw new Error(`알 수 없는 스프라이트: ${name}`);

  const cv = document.createElement('canvas');
  cv.width = def.w;
  cv.height = def.h;
  const ctx = cv.getContext('2d');
  for (const [x, y, w, h, color] of def.rects) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  cache.set(name, cv);
  return cv;
}

export function spriteSize(name) {
  const def = DEFS[name];
  return { w: def.w, h: def.h };
}

export const PALETTE = P;
```

- [ ] **Step 2: `game/src/render/renderer.js` 작성**

```js
import { FP, VIEW, STAGE1, TOTAL_PX, SPAWN_STOP_PX } from '../config.js';
import { getSprite, spriteSize, PALETTE } from './sprites.js';
import { mulberry32, randInt } from '../sim/rng.js';

// 점프 궤적 룩업 테이블. 렌더 전용이라 초월함수 제약을 받지 않지만,
// 시뮬이 이 값을 읽지 않도록 렌더 모듈 안에만 둔다.
const JUMP_LUT = (() => {
  const n = STAGE1.jumpTicks;
  const peak = 10;
  const out = new Int16Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out[i] = Math.round(peak * 4 * t * (1 - t));
  }
  return out;
})();

// 배경 눈 결정. 연출용 RNG는 시뮬 RNG와 완전히 분리한다.
const FX_RNG = mulberry32(0xc0ffee);
const FLECKS = Array.from({ length: 60 }, () => ({
  x: randInt(FX_RNG, VIEW.W),
  y: randInt(FX_RNG, 600),
  s: 1 + randInt(FX_RNG, 2),
}));

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let scale = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const availW = canvas.parentElement.clientWidth;
    const availH = canvas.parentElement.clientHeight;
    const s = Math.max(1, Math.min(
      Math.floor((availW * dpr) / VIEW.W),
      Math.floor((availH * dpr) / VIEW.H),
    ));
    scale = s;
    canvas.width = VIEW.W * s;
    canvas.height = VIEW.H * s;
    canvas.style.width = `${(VIEW.W * s) / dpr}px`;
    canvas.style.height = `${(VIEW.H * s) / dpr}px`;
    ctx.imageSmoothingEnabled = false;
  }

  // 월드 y → 화면 y
  const screenY = (worldYFp, camFp) => VIEW.PLAYER_Y + (worldYFp - camFp) / FP;

  function drawBackground(camFp) {
    ctx.fillStyle = PALETTE.snow;
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);

    ctx.fillStyle = PALETTE.shade;
    const camPx = camFp / FP;
    for (const f of FLECKS) {
      const y = ((f.y - camPx) % 600 + 600) % 600 - 150;
      if (y < -4 || y > VIEW.H) continue;
      ctx.fillRect(f.x, y, f.s, f.s);
    }
  }

  function drawFinale(camFp) {
    const roadTopFp = SPAWN_STOP_PX * FP;
    const y = screenY(roadTopFp, camFp);
    if (y > VIEW.H) return;

    // 버진로드
    ctx.fillStyle = '#f6e7e1';
    ctx.fillRect(VIEW.W / 2 - 26, y, 52, VIEW.H - y);
    ctx.fillStyle = PALETTE.petal;
    ctx.fillRect(VIEW.W / 2 - 27, y, 1, VIEW.H - y);
    ctx.fillRect(VIEW.W / 2 + 26, y, 1, VIEW.H - y);

    // 꽃 아치와 신부는 결승선(TOTAL_PX)에 선다
    const goalY = screenY(TOTAL_PX * FP, camFp);
    const arch = getSprite('arch');
    ctx.drawImage(arch, VIEW.W / 2 - arch.width / 2, goalY - 6);
    const bride = getSprite('bride');
    ctx.drawImage(bride, VIEW.W / 2 - bride.width / 2, goalY + 12);
  }

  function drawObstacles(state, camFp) {
    for (const row of state.rows) {
      const y = screenY(row.worldYFp, camFp);
      if (y < -20 || y > VIEW.H + 20) continue;
      for (const it of row.items) {
        if (it.hit) continue;
        ctx.drawImage(getSprite(it.type), Math.round(it.xFp / FP), Math.round(y));
      }
    }
  }

  function drawPlayer(state, xFp) {
    // 무적 중에는 4틱 주기로 깜빡인다
    if (state.invincibleTicks > 0 && ((state.invincibleTicks >> 2) & 1) === 1) return;

    const lift = state.airborneTicks > 0
      ? JUMP_LUT[STAGE1.jumpTicks - state.airborneTicks]
      : 0;
    const groom = getSprite('groom');
    const x = Math.round(xFp / FP);
    const y = VIEW.PLAYER_Y - lift;

    if (lift > 0) {
      ctx.fillStyle = 'rgba(47,42,39,.16)';
      ctx.fillRect(x + 3, VIEW.PLAYER_Y + STAGE1.playerH - 2, 8, 2);
    }
    ctx.drawImage(groom, x, y);
  }

  function draw(state, prev, alpha) {
    // 보간은 렌더에만 쓴다. 시뮬 상태는 절대 건드리지 않는다.
    const camFp = prev.progressFp + ((state.progressFp - prev.progressFp) * alpha) | 0;
    const xFp = prev.playerXFp + ((state.playerXFp - prev.playerXFp) * alpha) | 0;

    ctx.save();
    ctx.scale(scale, scale);
    drawBackground(camFp);
    drawFinale(camFp);
    drawObstacles(state, camFp);
    drawPlayer(state, xFp);
    ctx.restore();
  }

  resize();
  return { resize, draw };
}
```

- [ ] **Step 3: 커밋**

```bash
git add game/src/render/sprites.js game/src/render/renderer.js
git commit -m "$(cat <<'MSG'
feat(game): 플레이스홀더 스프라이트와 캔버스 렌더러

Closes #6

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 7: 입력 (상대 드래그)

**Issue:** #7
**Files:**
- Create: `game/src/input.js`
- Test: `tests/input-math.test.mjs`

**Interfaces:**
- Consumes: `TARGET_Q_MAX`, `TARGET_Q_CENTER`, `VIEW` (config)
- Produces:
  - `dragToQ(baseQ: int, dxCss: number, cssWidth: number) -> int` — 순수 함수 (테스트 대상)
  - `createInput(el) -> { targetXQ, attach(), detach(), reset(), pumpKeyboard() }`
    (`pumpKeyboard`는 main.js가 매 틱 부른다 — 키보드 누적용, 개발 전용)

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/input-math.test.mjs`**

`dragToQ`만 순수 함수로 떼어내 테스트한다. 포인터 이벤트 자체는 실기기 확인 영역이다.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { dragToQ } from '../game/src/input.js';
import { TARGET_Q_MAX, TARGET_Q_CENTER } from '../game/src/config.js';

test('움직이지 않으면 기준값 그대로다', () => {
  assert.equal(dragToQ(TARGET_Q_CENTER, 0, 360), TARGET_Q_CENTER);
});

test('오른쪽으로 끌면 값이 커지고 왼쪽이면 작아진다', () => {
  assert.ok(dragToQ(TARGET_Q_CENTER, 40, 360) > TARGET_Q_CENTER);
  assert.ok(dragToQ(TARGET_Q_CENTER, -40, 360) < TARGET_Q_CENTER);
});

test('화면 폭의 절반을 끌면 논리 폭의 절반만큼 이동한다', () => {
  const moved = dragToQ(0, 180, 360) - 0;
  assert.ok(Math.abs(moved - 360) <= 2, `이동량 ${moved}, 기대 360 근처`);
});

test('결과는 항상 정수이고 0~TARGET_Q_MAX 범위다', () => {
  for (const dx of [-9999, -500, -1, 0, 1, 500, 9999]) {
    const q = dragToQ(TARGET_Q_CENTER, dx, 360);
    assert.ok(Number.isInteger(q), `정수가 아님: ${q}`);
    assert.ok(q >= 0 && q <= TARGET_Q_MAX, `범위 밖: ${q}`);
  }
});

test('cssWidth가 0이어도 터지지 않는다', () => {
  const q = dragToQ(TARGET_Q_CENTER, 100, 0);
  assert.ok(Number.isInteger(q) && q >= 0 && q <= TARGET_Q_MAX);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/input-math.test.mjs`
Expected: FAIL — `Cannot find module '../game/src/input.js'`

- [ ] **Step 3: `game/src/input.js` 구현**

```js
// 조작은 상대 드래그 하나뿐이다. 기울기 센서·가상 조이스틱·다중 버튼은 쓰지 않는다.
// targetXQ 단위는 1/4 논리 px (0 ~ TARGET_Q_MAX).

import { VIEW, TARGET_Q_MAX, TARGET_Q_CENTER } from './config.js';

const KEY_STEP_Q = 24;

export function dragToQ(baseQ, dxCss, cssWidth) {
  if (!cssWidth) return clampQ(baseQ);
  const dq = Math.round((dxCss / cssWidth) * VIEW.W * 4);
  return clampQ(baseQ + dq);
}

function clampQ(q) {
  if (!Number.isFinite(q)) return TARGET_Q_CENTER;
  q = Math.round(q);
  if (q < 0) return 0;
  if (q > TARGET_Q_MAX) return TARGET_Q_MAX;
  return q;
}

export function createInput(el) {
  const api = {
    targetXQ: TARGET_Q_CENTER,
    attach,
    detach,
    reset,
  };

  let pointerId = null;
  let startX = 0;
  let baseQ = TARGET_Q_CENTER;
  const keys = { left: false, right: false };

  function onPointerDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    baseQ = api.targetXQ;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId) return;
    api.targetXQ = dragToQ(baseQ, e.clientX - startX, el.clientWidth);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    el.releasePointerCapture?.(e.pointerId);
  }

  // 개발용. 실기기 조작에는 쓰이지 않는다.
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') keys.left = true;
    else if (e.key === 'ArrowRight') keys.right = true;
    else return;
    e.preventDefault();
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowLeft') keys.left = false;
    else if (e.key === 'ArrowRight') keys.right = false;
  }

  // main.js가 매 프레임 부른다 (키보드 누적용)
  api.pumpKeyboard = function pumpKeyboard() {
    if (keys.left === keys.right) return;
    api.targetXQ = clampQ(api.targetXQ + (keys.right ? KEY_STEP_Q : -KEY_STEP_Q));
  };

  function attach() {
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function detach() {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  function reset() {
    pointerId = null;
    keys.left = false;
    keys.right = false;
    api.targetXQ = TARGET_Q_CENTER;
  }

  return api;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 전체 통과

- [ ] **Step 5: 커밋**

```bash
git add game/src/input.js tests/input-math.test.mjs
git commit -m "$(cat <<'MSG'
feat(game): 상대 드래그 입력

Closes #7

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 8: 상태 머신 + HTML 오버레이 + 오디오 배관 + 개발 진입점

**Issue:** #8
여기서 처음으로 실제로 플레이 가능한 것이 나온다.

**Files:**
- Create: `game/src/audio.js`, `game/src/ui/screens.js`, `game/src/main.js`, `game/dev.html`
- Test: 없음 (Step 8의 수동 확인이 검증)

**Interfaces:**
- Consumes: Task 2~7 전부
- Produces:
  - `createAudio() -> { unlock(), enabled }`
  - `createScreens(root) -> { show(name), hide(), onAction(fn), setProgress(ratio), setLives(n) }`
    - `name`: `'title' | 'hud' | 'cleared' | 'failed' | 'paused'`
    - action 이름: `'start' | 'skip' | 'retry' | 'resume' | 'home'`
  - `game/dev.html` — 빌드 없이 여는 개발 진입점. **Task 9의 빌드가 이 파일을 원본으로 삼아 `game/index.html`을 생성한다.**

- [ ] **Step 1: `game/src/audio.js` 작성**

```js
// 지금은 unlock 배관만 둔다. 효과음은 M6에서 얹는다.
// iOS 무음 스위치가 켜져 있으면 소리가 안 나므로, 소리 없이도 게임이 성립해야 한다.
// 이 모듈은 절대 예외를 밖으로 던지지 않는다 — 오디오 실패가 게임을 막으면 안 된다.

export function createAudio() {
  let ctx = null;

  function unlock() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      // 무음 버퍼 1개를 재생해 컨텍스트를 깨운다
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume?.();
    } catch {
      ctx = null;
    }
  }

  return {
    unlock,
    get enabled() { return ctx !== null && ctx.state === 'running'; },
  };
}
```

- [ ] **Step 2: `game/src/ui/screens.js` 작성**

```js
// 화면 텍스트는 캔버스가 아니라 HTML로 그린다 (확대해도 선명하게).
// 사용자 문자열을 다루지 않지만, 원칙대로 textContent만 쓴다.

import { STAGE1 } from '../config.js';

export function createScreens(root) {
  const el = {
    hud: root.querySelector('#hud'),
    barFill: root.querySelector('#bar-fill'),
    lives: root.querySelector('#lives'),
    panels: root.querySelectorAll('[data-panel]'),
  };

  let handler = () => {};

  root.addEventListener('click', (e) => {
    const action = e.target?.dataset?.action;
    if (action) handler(action);
  });

  function show(name) {
    for (const p of el.panels) p.hidden = p.dataset.panel !== name;
    el.hud.hidden = name !== 'hud';
  }

  function hide() {
    for (const p of el.panels) p.hidden = true;
    el.hud.hidden = true;
  }

  function setProgress(ratio) {
    const pct = Math.max(0, Math.min(1, ratio)) * 100;
    el.barFill.style.width = `${pct}%`;
  }

  function setLives(n) {
    // 하트는 수집품이 아니라 남은 목숨 표시다.
    while (el.lives.children.length < STAGE1.lives) {
      const s = document.createElement('span');
      s.className = 'heart';
      el.lives.appendChild(s);
    }
    [...el.lives.children].forEach((c, i) => {
      c.classList.toggle('heart--off', i >= n);
    });
  }

  function onAction(fn) { handler = fn; }

  return { show, hide, setProgress, setLives, onAction };
}
```

- [ ] **Step 3: `game/src/main.js` 작성**

```js
import { FP, TICK_HZ, MAX_CATCHUP_TICKS, TOTAL_PX, GAME_VERSION } from './config.js';
import { createSim, step, isOver, getOutcome } from './sim/stage1.js';
import { createRenderer } from './render/renderer.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createScreens } from './ui/screens.js';

const MS_PER_TICK = 1000 / TICK_HZ;
const UNLOCK_KEY = 'twsj.stage2Unlocked';

const root = document.getElementById('app');
const canvas = document.getElementById('cv');
const stage = document.getElementById('stage');

const renderer = createRenderer(canvas);
const input = createInput(stage);
const audio = createAudio();
const screens = createScreens(root);

let sim = null;
let prev = { progressFp: 0, playerXFp: 0 };
let acc = 0;
let last = 0;
let mode = 'title';   // title | playing | paused | cleared | failed
let rafId = 0;

function setMode(next) {
  mode = next;
  screens.show(next === 'playing' ? 'hud' : next);
}

function newSeed() {
  // 시뮬 밖이므로 Date/random을 써도 된다. 시뮬은 이 seed만 받는다.
  return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
}

function startRun() {
  audio.unlock();
  sim = createSim(newSeed());
  prev = { progressFp: sim.progressFp, playerXFp: sim.playerXFp };
  input.reset();
  acc = 0;
  last = performance.now();
  screens.setLives(sim.lives);
  screens.setProgress(0);
  setMode('playing');
  // Android 뒤로가기를 한 번 삼켜서 이탈 대신 일시정지가 되게 한다
  history.pushState({ game: 'playing' }, '');
}

function finish(outcome) {
  if (outcome === 'cleared') {
    try { localStorage.setItem(UNLOCK_KEY, '1'); } catch { /* 인앱에서 막힐 수 있다 */ }
  }
  setMode(outcome);
}

function pause() {
  if (mode !== 'playing') return;
  setMode('paused');
}

function resume() {
  if (mode !== 'paused') return;
  last = performance.now();
  acc = 0;
  setMode('playing');
}

function goHome() {
  window.location.href = '../';
}

function frame(now) {
  rafId = requestAnimationFrame(frame);

  if (mode !== 'playing' || sim === null) { last = now; return; }

  let dt = now - last;
  last = now;
  if (dt > 250) dt = 250;
  acc += dt;

  let steps = 0;
  while (acc >= MS_PER_TICK && steps < MAX_CATCHUP_TICKS && !isOver(sim)) {
    prev = { progressFp: sim.progressFp, playerXFp: sim.playerXFp };
    input.pumpKeyboard();
    step(sim, { targetXQ: input.targetXQ });
    acc -= MS_PER_TICK;
    steps++;
  }
  if (steps === MAX_CATCHUP_TICKS) acc = 0;   // 따라잡기 포기 (느린 기기 보호)

  screens.setProgress(sim.progressFp / FP / TOTAL_PX);
  screens.setLives(sim.lives);
  renderer.draw(sim, prev, Math.min(1, acc / MS_PER_TICK));

  if (isOver(sim)) finish(getOutcome(sim));
}

screens.onAction((action) => {
  if (action === 'start' || action === 'retry') startRun();
  else if (action === 'skip') { audio.unlock(); finish('cleared'); }
  else if (action === 'resume') resume();
  else if (action === 'home') goHome();
});

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', pause);
window.addEventListener('blur', pause);
window.addEventListener('popstate', () => { if (mode === 'playing') pause(); });
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => renderer.resize());

// 카톡 인앱이면 외부 브라우저 링크를 보험으로 노출한다 (기본 경로는 아니다)
if (/KAKAOTALK/i.test(navigator.userAgent)) {
  const a = document.getElementById('ext');
  if (a) {
    a.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(location.href)}`;
    a.hidden = false;
  }
}

// ?debug=1 일 때만 vConsole (카톡 웹뷰는 원격 디버깅이 사실상 불가)
if (new URLSearchParams(location.search).get('debug') === '1') {
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/vconsole@3.15.1/dist/vconsole.min.js';
  s.onload = () => { new window.VConsole(); console.log('game version', GAME_VERSION); };
  document.head.appendChild(s);
}

input.attach();
setMode('title');
rafId = requestAnimationFrame(frame);
```

- [ ] **Step 4: `game/dev.html` 작성**

**중요:** Task 9의 빌드 스크립트가 이 파일을 읽어 `game/index.html`을 생성한다.
마크업과 스타일은 여기에만 쓰고, `game/index.html`을 직접 고치지 않는다.

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="color-scheme" content="light only">
<title>신부에게 가는 길</title>
<style>
  :root {
    --paper-warm: #fdf6f3;
    --ink: #2f2a27;
    --ink-soft: #8b807a;
    --accent: #c2836f;
    --accent-soft: #e6b6a5;
    --font-kr: 'Gowun Batang', 'Nanum Myeongjo', serif;
    --font-ui: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    height: 100%;
    background: var(--paper-warm);
    color: var(--ink);
    font-family: var(--font-ui);
    -webkit-text-size-adjust: 100%;
  }
  #app {
    position: relative;
    width: 100%;
    height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
  #stage {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    overscroll-behavior: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  #cv { image-rendering: pixelated; display: block; }

  /* HUD */
  #hud {
    position: absolute; top: 0; left: 0; right: 0;
    padding: 14px 16px 0;
    pointer-events: none;
  }
  #bar {
    position: relative;
    height: 4px;
    border-radius: 999px;
    background: rgba(47, 42, 39, .12);
    overflow: visible;
  }
  #bar-fill {
    height: 100%; width: 0%;
    border-radius: 999px;
    background: var(--accent);
    transition: width .08s linear;
  }
  #bar-bride {
    position: absolute; right: -3px; top: -5px;
    width: 10px; height: 14px;
    border-radius: 50% 50% 40% 40%;
    background: #fff;
    box-shadow: 0 0 0 1px rgba(47, 42, 39, .22);
  }
  #lives { display: flex; gap: 5px; margin-top: 10px; }
  .heart {
    width: 11px; height: 10px;
    background: var(--accent);
    clip-path: path('M5.5 10 1 5.6A2.9 2.9 0 0 1 5.5 1.9 2.9 2.9 0 0 1 10 5.6z');
    transition: opacity .2s;
  }
  .heart--off { opacity: .18; }

  /* 패널 */
  [data-panel] {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 14px;
    padding: 32px 26px;
    text-align: center;
    background: rgba(253, 246, 243, .94);
  }
  [data-panel][hidden] { display: none; }
  h1 { font-family: var(--font-kr); font-size: 22px; font-weight: 400; margin: 0; letter-spacing: .02em; }
  p  { font-family: var(--font-kr); font-size: 14px; line-height: 1.8; color: var(--ink-soft); margin: 0; }
  button {
    font-family: var(--font-ui); font-size: 15px;
    padding: 13px 30px;
    border: 0; border-radius: 999px;
    background: var(--accent); color: #fff;
    letter-spacing: .04em;
    cursor: pointer;
  }
  button.ghost { background: transparent; color: var(--ink-soft); border: 1px solid rgba(47,42,39,.16); }
  .links { display: flex; flex-direction: column; gap: 9px; align-items: center; }
  a { font-size: 13px; color: var(--ink-soft); text-decoration: none; border-bottom: 1px solid rgba(47,42,39,.16); padding-bottom: 1px; }
</style>
</head>
<body>
<div id="app">
  <div id="stage">
    <canvas id="cv"></canvas>

    <div id="hud" hidden>
      <div id="bar"><div id="bar-fill"></div><span id="bar-bride"></span></div>
      <div id="lives"></div>
    </div>

    <section data-panel="title">
      <h1>신부에게 가는 길</h1>
      <p>화면을 좌우로 쓸어<br>신랑을 움직여 주세요.<br>꽃다발과 반지를 들고 신부에게 갑니다.</p>
      <button data-action="start">시작하기</button>
      <div class="links">
        <a href="#" data-action="skip">건너뛰기</a>
        <a href="../">청첩장으로 돌아가기</a>
        <a id="ext" href="#" hidden>외부 브라우저로 열기</a>
      </div>
    </section>

    <section data-panel="paused" hidden>
      <h1>잠시 멈췄어요</h1>
      <button data-action="resume">이어하기</button>
      <div class="links"><a href="../">청첩장으로 돌아가기</a></div>
    </section>

    <section data-panel="cleared" hidden>
      <h1>도착했습니다</h1>
      <p>신랑이 꽃다발과 반지를<br>신부에게 무사히 전했어요.</p>
      <button data-action="home">청첩장으로 돌아가기</button>
      <div class="links"><a href="#" data-action="retry">다시 하기</a></div>
    </section>

    <section data-panel="failed" hidden>
      <h1>넘어졌어요</h1>
      <p>신부가 기다리고 있어요.<br>다시 내려가 볼까요?</p>
      <button data-action="retry">다시 하기</button>
      <div class="links">
        <a href="#" data-action="skip">건너뛰기</a>
        <a href="../">청첩장으로 돌아가기</a>
      </div>
    </section>
  </div>
</div>
<script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 5: 로컬 서버로 열어 확인**

```bash
python3 -m http.server 8000
```
브라우저에서 `http://localhost:8000/game/dev.html` — 개발자도구 기기 모드(iPhone SE 등 세로)로 확인한다.

- [ ] **Step 6: 눈으로 확인할 것**

- [ ] 타이틀 → 시작 → 설원이 아래에서 위로 흐르고 신랑이 보인다
- [ ] 좌우 드래그로 신랑이 따라 움직인다 (드래그를 놓아도 제자리 유지)
- [ ] 장애물에 부딪히면 하트가 하나 꺼지고 신랑이 깜빡이며 잠깐 느려진다
- [ ] 점프대를 밟으면 신랑이 살짝 떠오르고 그동안 장애물을 통과한다
- [ ] 상단 진행 바가 차오르고 **숫자는 어디에도 없다**
- [ ] 끝까지 가면 버진로드·꽃 아치·신부가 나오고 신랑이 중앙으로 정렬된 뒤 "도착했습니다"
- [ ] 하트 3개를 다 잃으면 "넘어졌어요"
- [ ] 다른 탭으로 갔다 오면 "잠시 멈췄어요"
- [ ] 타이틀·실패 화면에 "건너뛰기"가 항상 보인다

- [ ] **Step 7: 커밋**

```bash
git add game/src/audio.js game/src/ui/screens.js game/src/main.js game/dev.html
git commit -m "$(cat <<'MSG'
feat(game): 상태 머신, HTML 오버레이, 오디오 unlock 배관, 개발 진입점

Closes #8

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 9: 빌드 스크립트 + 릴리즈 진입점

**Issue:** #9
**Files:**
- Create: `scripts/build-game.mjs`
- Generated: `game/index.html`, `game/dist/game.<hash>.js`
- Test: `tests/build.test.mjs`

**Interfaces:**
- Consumes: `game/dev.html`, `game/src/main.js`
- Produces:
  - `game/index.html` — `dev.html`에서 생성된다. **직접 편집 금지.**
  - `game/dist/game.<hash>.js` — 커밋 대상
  - `buildGame() -> { file: string, hash: string }` — 테스트에서 import해 부를 수 있게 export한다

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/build.test.mjs`**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { buildGame } from '../scripts/build-game.mjs';

test('빌드는 해시 파일명 번들을 만들고 index.html이 그것을 참조한다', async () => {
  const { file, hash } = await buildGame();

  assert.ok(existsSync(`game/dist/${file}`), `번들이 없음: ${file}`);
  assert.match(file, /^game\.[0-9a-f]{10}\.js$/, `파일명 형식이 다름: ${file}`);
  assert.equal(hash.length, 10);

  const html = readFileSync('game/index.html', 'utf8');
  assert.ok(html.includes(`dist/${file}`), 'index.html이 새 번들을 참조하지 않음');
  assert.ok(!html.includes('type="module"'), 'index.html에 모듈 스크립트가 남아 있음');
  assert.ok(!html.includes('src/main.js'), 'index.html이 소스를 직접 참조함');
});

test('옛 번들은 정리된다', async () => {
  const { file } = await buildGame();
  const bundles = readdirSync('game/dist').filter((f) => f.endsWith('.js'));
  assert.deepEqual(bundles, [file], `옛 번들이 남음: ${bundles.join(', ')}`);
});

test('index.html의 본문은 dev.html과 같다 (스크립트 태그만 다름)', async () => {
  await buildGame();
  const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  assert.equal(strip(readFileSync('game/index.html', 'utf8')), strip(readFileSync('game/dev.html', 'utf8')));
});

test('번들이 같으면 해시도 같다 (재현 가능)', async () => {
  const a = await buildGame();
  const b = await buildGame();
  assert.equal(a.hash, b.hash);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/build.test.mjs`
Expected: FAIL — `Cannot find module '../scripts/build-game.mjs'`

- [ ] **Step 3: `scripts/build-game.mjs` 구현**

```js
// game/dev.html 을 원본으로 삼아 릴리즈용 game/index.html 을 생성한다.
// 마크업은 dev.html 한 곳에만 두어 두 진입점이 어긋나지 않게 한다.
//
// 카톡 인앱 브라우저는 캐시가 강해서 해시 파일명이 사실상 유일한 무효화 수단이다.
// 배포 전에 반드시 이 스크립트를 돌려야 한다.

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'game/dist');
const DEV_HTML = path.join(ROOT, 'game/dev.html');
const OUT_HTML = path.join(ROOT, 'game/index.html');

const BANNER = '<!-- 생성된 파일입니다. game/dev.html 을 고치고 `npm run build` 를 돌리세요. -->';

export async function buildGame() {
  const result = await build({
    entryPoints: [path.join(ROOT, 'game/src/main.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2019'],
    legalComments: 'none',
    write: false,
  });

  const code = result.outputFiles[0].text;
  const hash = createHash('sha256').update(code).digest('hex').slice(0, 10);
  const file = `game.${hash}.js`;

  mkdirSync(DIST, { recursive: true });
  for (const f of readdirSync(DIST)) {
    if (f.endsWith('.js') && f !== file) rmSync(path.join(DIST, f));
  }
  writeFileSync(path.join(DIST, file), code);

  const html = readFileSync(DEV_HTML, 'utf8')
    .replace(
      /<script type="module" src="src\/main\.js"><\/script>/,
      `<script src="dist/${file}" defer></script>`,
    );

  if (!html.includes(`dist/${file}`)) {
    throw new Error('dev.html의 모듈 스크립트 태그를 찾지 못했습니다. 태그를 바꿨다면 이 스크립트도 함께 고치세요.');
  }

  writeFileSync(OUT_HTML, `${BANNER}\n${html}`);
  return { file, hash };
}

// 직접 실행했을 때만 돈다 (테스트에서 import할 때는 안 돈다)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { file } = await buildGame();
  console.log(`빌드 완료: game/dist/${file}`);
}
```

- [ ] **Step 4: 빌드 실행 후 테스트 통과 확인**

Run: `npm run build && npm test`
Expected: 빌드 로그 `빌드 완료: game/dist/game.<hash>.js` 후 전체 테스트 PASS

- [ ] **Step 5: 릴리즈 진입점을 브라우저로 확인**

`http://localhost:8000/game/` 를 열어 Task 8 Step 6의 체크리스트를 그대로 다시 확인한다.
번들이 모듈 버전과 똑같이 동작해야 한다.

- [ ] **Step 6: 커밋**

```bash
git add scripts/build-game.mjs tests/build.test.mjs game/index.html game/dist
git commit -m "$(cat <<'MSG'
build(game): esbuild 해시 번들과 릴리즈 진입점 생성

Closes #9

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

### Task 10: 청첩장 진입 카드 + 복귀 동선 (M2)

**Issue:** #10
**Files:**
- Modify: `index.html` (hero `</header>` 직후에 블록 추가), `css/aesthetic.css` (파일 끝에 블록 추가)
- Test: `tests/invitation.test.mjs`

**Interfaces:**
- Consumes: `game/index.html` (Task 9)
- Produces: 청첩장 → 게임 링크. 게임 → 청첩장 복귀는 Task 8에서 이미 있음

- [ ] **Step 1: 실패하는 테스트 작성 — `tests/invitation.test.mjs`**

청첩장 본문은 손으로 고치는 파일이라, 나중에 실수로 지우거나 위치가 밀리는 것을 막는 회귀 테스트를 건다.

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');

test('게임 진입 링크가 하나 있다', () => {
  const matches = html.match(/href="\.\/game\/"/g) ?? [];
  assert.equal(matches.length, 1, `./game/ 링크가 ${matches.length}개`);
});

test('진입 카드는 hero 다음, 인사말 앞에 있다', () => {
  const heroEnd = html.indexOf('</header>');
  const greeting = html.indexOf('id="area2"');
  const card = html.indexOf('class="minigame"');
  assert.ok(heroEnd > 0 && greeting > 0 && card > 0, '기준 마크업을 찾지 못함');
  assert.ok(card > heroEnd, '진입 카드가 hero 안에 있음');
  assert.ok(card < greeting, '진입 카드가 인사말 뒤로 밀림');
});

test('진입 카드에 스타일이 정의돼 있다', () => {
  const css = readFileSync('css/aesthetic.css', 'utf8');
  assert.ok(css.includes('.minigame'), 'aesthetic.css에 .minigame 스타일이 없음');
});

test('청첩장 본문에 점수·랭킹 문구가 없다', () => {
  const card = html.slice(html.indexOf('class="minigame"'), html.indexOf('id="area2"'));
  for (const banned of ['점수', '랭킹', '순위', '기록']) {
    assert.ok(!card.includes(banned), `진입 카드에 금지 문구: ${banned}`);
  }
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test tests/invitation.test.mjs`
Expected: FAIL — "./game/ 링크가 0개"

- [ ] **Step 3: `index.html`의 `</header>` 직후에 진입 카드 추가**

`</header>` 와 `<!-- 인사말` 주석 사이에 넣는다. **다른 줄은 건드리지 않는다.**

```html
    <!-- 미니게임 진입 (게임 본체는 /game, 청첩장 로딩에 영향 없음) -->
    <section class="minigame reveal" data-stagger="0.1">
        <a class="minigame__card" href="./game/">
            <span class="minigame__label">MINI GAME</span>
            <span class="minigame__title">신부에게 가는 길</span>
            <span class="minigame__desc">신랑이 꽃다발과 반지를 들고<br>눈 덮인 언덕을 내려갑니다</span>
            <span class="minigame__go">시작하기</span>
        </a>
    </section>
```

- [ ] **Step 4: `css/aesthetic.css` 맨 끝에 스타일 추가**

기존 토큰만 쓰고 새 토큰을 만들지 않는다.

```css

/* ============================================================
   10. 미니게임 진입 카드
   ============================================================ */
.minigame {
    padding: 34px var(--gut) 0;
}
.minigame__card {
    display: block;
    padding: 26px 22px 24px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--paper-warm);
    text-align: center;
    text-decoration: none;
    transition: transform .35s var(--ease), box-shadow .35s var(--ease);
}
.minigame__card:active {
    transform: scale(.985);
    box-shadow: 0 4px 18px rgba(60, 40, 32, .10);
}
.minigame__label {
    display: block;
    font-family: var(--font-en);
    font-size: 11px;
    letter-spacing: .28em;
    color: var(--ink-faint);
    margin-bottom: 9px;
}
.minigame__title {
    display: block;
    font-family: var(--font-kr);
    font-size: 19px;
    color: var(--ink);
    letter-spacing: .02em;
}
.minigame__desc {
    display: block;
    margin-top: 10px;
    font-family: var(--font-kr);
    font-size: 13px;
    line-height: 1.75;
    color: var(--ink-soft);
}
.minigame__go {
    display: inline-block;
    margin-top: 17px;
    padding: 9px 24px;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-ui);
    font-size: 13px;
    letter-spacing: .06em;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — 전체 통과

- [ ] **Step 6: 왕복 동선을 브라우저로 확인**

`http://localhost:8000/` 에서:
- [ ] 메인 사진 바로 아래에 카드가 보이고 스크롤 등장 애니메이션이 다른 섹션과 같게 걸린다
- [ ] 카드를 누르면 게임으로 들어간다
- [ ] 게임 타이틀·클리어·실패 화면에서 "청첩장으로 돌아가기"가 청첩장으로 돌아온다
- [ ] 좁은 화면(320px)과 넓은 화면(560px 이상)에서 카드가 깨지지 않는다

- [ ] **Step 7: 커밋**

```bash
git add index.html css/aesthetic.css tests/invitation.test.mjs
git commit -m "$(cat <<'MSG'
feat(invitation): 최상단에 미니게임 진입 카드 추가

Closes #10

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E6qJiu7kxCirysJpArtjff
MSG
)"
```

---

## 마무리: 배포와 실기기 확인

계획의 모든 태스크가 끝난 뒤 한 번 수행한다.

- [ ] `npm test` 전체 통과
- [ ] `npm run build` 실행 (**빼먹으면 하객에게 옛 버전이 나간다**)
- [ ] 빌드 산출물까지 커밋하고 `git push`
- [ ] GitHub Pages 반영 후 실기기 확인 — **이것만은 자동화할 수 없다:**
  - [ ] 카카오톡으로 링크를 보내 **인앱 브라우저에서** 연다 (iOS·Android 각각)
  - [ ] 드래그 중 페이지 스크롤·당겨서 새로고침·확대가 일어나지 않는다
  - [ ] iOS 왼쪽 가장자리 드래그로 이탈하지 않거나, 이탈 시 일시정지된다
  - [ ] Android 뒤로가기가 게임을 일시정지시킨다
  - [ ] 60Hz 기기와 120Hz 기기에서 체감 속도가 같다
  - [ ] 백그라운드 다녀오면 일시정지 상태다
  - [ ] 무음 모드에서 정상 진행된다
  - [ ] 보급형 갤럭시에서 끊김이 없다
  - [ ] 재배포 후 카톡에서 새 버전이 로드된다 (해시 파일명 변경 확인)
- [ ] 실기기에서 발견한 조작감 문제는 `game/src/config.js`만 고쳐 대응하고, 바꾼 값과 이유를 `docs/DECISIONS.md`에 남긴다
