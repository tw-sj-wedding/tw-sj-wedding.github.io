# 엔드리스 스노보드 미니게임 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> 사용자가 "알아서 다 구현"을 지시해 작성자가 같은 세션에서 바로 실행한다. 그래서 단계마다 구현 코드를
> 계획에 전부 옮겨 적지 않고, **인터페이스·상수·테스트 항목을 구체적으로** 적는 데 집중했다.

**Goal:** 청첩장 최상단 카드로 들어오는 옆 화면 엔드리스 스노보드 러너(신랑·신부 선택)와, 원할 때 점수를 올리는 하객 리더보드.

**Architecture:** 정적 GitHub Pages에 Canvas 2D 게임(`/game/`, 해시 번들). 시뮬은 고정 60Hz 순수 모듈, 렌더·UI는 분리.
리더보드는 Cloudflare Worker + D1이며, 로컬에서는 같은 핸들러를 Node(`node:sqlite`)로 돌려 끝까지 검증한다.

**Tech Stack:** Vanilla JS(ES modules), Canvas 2D, esbuild(번들만), Node 24 `node --test`, `node:sqlite`, WebCrypto, Cloudflare Workers/D1.

**Spec:** `docs/superpowers/specs/2026-10-14-endless-snowboard-design.md`

## Global Constraints

- 하객 경로는 카카오톡 인앱 브라우저, 세로, 터치. `100dvh`(100vh 금지), `touch-action:none`, `overscroll-behavior:none`, 확대 금지.
- 무음에서도 게임 성립. `audio.js`는 unlock 배관만.
- `game/src/sim/`·`game/src/shared/`는 DOM·`Date`·`performance`·`Math.random` 금지.
- 튜닝 수치는 `game/src/config.js` 한 곳.
- 그림은 손으로 고치지 않는다. `scripts/build-sprites.mjs` 변환만.
- 사용자 문자열은 `textContent`로만 출력. SQL은 prepared statement만.
- 시크릿·`.dev.vars`·`.env` 커밋 금지. 공개 저장소.
- 청첩장(`index.html`, `css/aesthetic.css`)은 진입 카드 블록 외 수정 금지.
- 테스트 실행은 `npm test` (glob). 디렉터리 인자 금지.
- 기능 단위 GitHub 이슈 → 커밋 본문 `Closes #N`.
- 배포(main push, Cloudflare deploy)는 사용자 확인 후.

## 스펙 대비 구현 시 확정한 것 (DECISIONS에 기록)

- **보이는 가로를 400으로 고정한다.** 캔버스 내부 해상도는 `400 × k`(`k = ceil(물리폭/400)`, 정수)로 그리고
  CSS로 화면 폭에 맞춰 약간 축소한다. 스펙의 "기기마다 360~430" 안은 DPR 1.5 같은 기기에서 보이는 폭이
  540까지 벌어져 리더보드 공정성이 깨지므로 버린다. 축소 비율은 (k−1)/k 초과라 픽셀 두께 차이는 1물리px.
- **장애물 생성 x = 460** (화면 오른쪽 끝 400 밖). 스펙의 420은 유지해도 되지만 여유를 둔다.
- **점수는 경과 틱만의 함수다.** 속도가 플레이어와 무관하므로 `distance = distanceAtTick(tick)`을
  시뮬과 서버가 같은 함수로 계산한다. 누적 합산을 쓰면 부동소수 오차로 서버 상한 검사가 정상 점수를
  거부할 수 있다.
- **토큰은 미리 받아 둔다.** 페이지 로드 시와 매 판 시작 시 다음 판용 토큰을 받는다. 판 시작에 토큰이 없으면
  그때 요청해 붙인다(서버 시간 검사의 +5초 여유 안이면 통과). 유효기간 3시간.
- **`API_BASE`가 비면 리더보드 UI를 숨긴다.** Worker 배포 전에도 게임은 완전하게 동작한다.

## Review Focus

1. **점프 버튼 연타 중 게임오버** — 오버 패널이 뜨자마자 "다시 하기"가 눌리면 안 된다 → 패널 버튼은 0.7초 뒤 활성화. Task 3에서 브라우저 확인.
2. **숙이기 버튼을 누른 채 손가락이 버튼 밖으로 나감 / 전화가 옴** — 숙이기가 영원히 눌린 상태로 남으면 안 된다 → `pointercancel`·`lostpointercapture`·일시정지 시 해제. Task 3 `input` 테스트(가짜 이벤트)로 고정.
3. **localStorage 차단(인앱 사생활 모드)** — 예외 없이 HI 0으로 동작 → Task 3 `storage` 테스트.
4. **리더보드 서버 다운·느림** — 게임은 그대로, 등록만 실패 안내. 5초 타임아웃 → Task 6 `api` 테스트(가짜 fetch).
5. **같은 판을 두 번 등록(더블탭)** — 두 번째는 `replayed`, UI는 성공 후 버튼 비활성 → Task 5 Worker 테스트 + Task 6 UI.

---

### Task 1: 1차 코드 정리 + 그림 변환 도구 + 스프라이트 생성

**Files:**
- Delete: `game/src/sim/stage1.js`, `game/src/render/sprites.js`, `game/src/input.js`, `tests/stage1-*.test.mjs`, `tests/input-math.test.mjs`, `tests/helpers/bot.mjs`, `game/Gemini_Generated_Image_5zej…png`, `game/Gemini_Generated_Image_n0vr…png`
- Move: `game/Gemini_Generated_Image_n1k0…png` → `game/assets/src/groom.png`, `…c4r9…png` → `game/assets/src/bride.png`
- Create: `scripts/lib/png.mjs`, `scripts/lib/sprite-sheet.mjs`, `scripts/build-sprites.mjs`, `game/assets/sprites.png`, `game/assets/sprites.json`
- Test: `tests/png.test.mjs`, `tests/sprite-sheet.test.mjs`

**Interfaces (Produces):**
- `decodePng(buf) → { width, height, data: Uint8Array(RGBA) }` (8bit RGB/RGBA, 비인터레이스), `encodePng({ width, height, data }) → Buffer`
- `detectGrid(img) → { pitchX, offX, pitchY, offY }`
- `toCells(img, grid) → { w, h, data }` (원본 격자 RGBA, 투명=alpha 0)
- `quantize(cells, maxColors = 32) → cells`
- `splitFrames(cells, expected = 6) → [{ x, y, w, h, data }]` (x순 정렬)
- `packFrame(frame, size = 64, anchor: 'board'|'bbox') → { data(64×64 RGBA) }`
- `buildSheet(sources: [{ name, img }]) → { png: Buffer, json, report }`
- `sprites.json`: `{ "frame": 64, "frames": ["run1","run2","jump","duck1","duck2","crash"], "rows": { "groom": 0, "bride": 1 }, "pitch": { "groom": n, "bride": n } }`

- [ ] **Step 1: 테스트 작성**
  - png: 인코드→디코드 왕복이 바이트 단위로 같음(3×2 RGBA), RGB(컬러타입 2) 디코드, 필터 1~4가 섞인 PNG 디코드(원본 Gemini 파일 1장의 크기·첫 픽셀 확인).
  - sprite-sheet(합성 이미지: 원본 격자 30×20, 칸 3.75px·오프셋 1.3px로 확대, 마젠타 배경, 덩어리 2개 + 2칸짜리 잡티):
    - `detectGrid` 칸 크기 3.75±0.01, 오프셋 ±0.3
    - `toCells`가 원본 격자를 픽셀 단위로 정확히 복원
    - 분홍 번짐(마젠타와 남색 50:50) 칸은 투명 또는 원래 색 — 분홍색이 결과에 남지 않음
    - `splitFrames(…, 2)` 덩어리 2개를 x순으로, 잡티는 버림. 기대 개수와 다르면 진단 메시지와 함께 throw
    - `packFrame` 결과 맨 아래 줄에 불투명 픽셀이 있음, 64 초과 프레임은 throw
    - `quantize` 결과 색 수 ≤ maxColors
  - 실제 원본: `groom.png`, `bride.png` 각각 프레임 6개, 모두 64×64 이내, 칸 크기 3.75±0.1, 서 있는 프레임 키 50~60, 숙인 프레임 키 < 서 있는 키 − 8
- [ ] **Step 2: 실패 확인** — `node --test tests/png.test.mjs tests/sprite-sheet.test.mjs`
- [ ] **Step 3: 구현** — 격자는 경계 위치의 위상 일관성(합성 벡터 길이)으로 칸 크기를 2.5~8 거친 탐색 후 정밀 탐색, 오프셋은 위상각. 칸 안쪽(경계에서 0.6px 이상 떨어진 픽셀)만 표본. 마젠타 ≥50% → 투명, 분홍 번짐 픽셀은 표본에서 제외. 연결 성분(8방향) 중 큰 것 6개를 씨앗으로, 나머지 성분은 가장 가까운 씨앗에 붙이고 8칸보다 멀면 버림. 달리기·숙이기는 보드(맨 아래 2줄) 중심, 점프·넘어짐은 경계상자 중심으로 가운데 정렬.
- [ ] **Step 4: 실행** — `node scripts/build-sprites.mjs` → 시트·JSON 생성, 미리보기(4배, 충돌 상자 표시)는 OS 임시 폴더. 미리보기를 직접 열어 확인.
- [ ] **Step 5: 테스트 통과 확인 + 커밋**

### Task 2: 점수 공식 + 러너 시뮬

**Files:**
- Rewrite: `game/src/config.js`
- Create: `game/src/shared/scoring.js`, `game/src/sim/runner.js`, `tests/helpers/bot.mjs`
- Keep: `game/src/sim/rng.js`, `tests/rng.test.mjs`
- Test: `tests/scoring.test.mjs`, `tests/runner.test.mjs`, `tests/runner-fairness.test.mjs`

**config.js (초기값)**
```js
export const GAME_VERSION = '2.0.0';
export const TICK_HZ = 60;
export const MAX_CATCHUP_TICKS = 5;
export const VIEW = { W: 400, PLAYER_X: 60, SPAWN_X: 460, GROUND_RATIO: 0.6 };
export const SPEED = { start: 240, accel: 2.4, max: 520 };            // px/s, px/s²
export const SCORE = { pxPerPoint: 24, flashEvery: 100 };
export const JUMP = { apex: 70, airTicks: 36 };                        // 0.6초
export const HITBOX = { stand: { w: 20, h: 48 }, duck: { w: 20, h: 34 } };
export const SPAWN = { firstGapSec: 1.6, reactionSec: 0.25, extraGapRatio: 0.8, birdFromScore: 300 };
export const OBSTACLES = {
  rock1:    { w: 14, h: 12, y: 0 },  rock2: { w: 26, h: 12, y: 0 },  rock3: { w: 38, h: 12, y: 0 },
  snowman:  { w: 20, h: 30, y: 0 },
  birdLow:  { w: 22, h: 14, y: 6 },  birdHigh: { w: 22, h: 14, y: 46 },
};
export const API_BASE = '';   // Worker 배포 후 주소. 비면 리더보드 UI 숨김
```

**Interfaces (Produces):**
- `speedAtTick(n)`, `distanceAtTick(n)`(= Σ_{i=1..n} speedAtTick(i)/60, 닫힌 식), `scoreAtTick(n)` = `floor(distanceAtTick(n)/24)` — 모두 `scoring.js`, 인자는 config에서 받지 않고 상수 객체를 인자로 받는 순수 함수 + config 기본값 바인딩 export
- `createRun(seed) → state`: `{ tick, distance, speed, playerY, airTick(-1=지상), ducking, obstacles: [{ type, x(월드), y, w, h }], nextSpawnX, over, rng }`
- `step(state, { jump: bool, duck: bool })`, `isOver(state)`, `getScore(state)`, `playerBox(state) → { x, y, w, h }`(화면 x 기준)

- [ ] **Step 1: 테스트 작성**
  - scoring: 0틱 → 0, 속도 상한 전후 경계에서 닫힌 식 = 루프 합, `scoreAtTick`가 단조 증가, 2분(7200틱) 근처에서 속도 상한 도달
  - runner 단위: 점프 정점 70±0.5(18틱째), 36틱 후 착지, 공중 점프 무시, 공중 숙이기 무시(공중 히트박스 유지), 숙인 채 착지하면 숙임, 숙인 상태에서 점프가 우선, 숙이면 `birdHigh` 통과·서 있으면 충돌, 지상 장애물 충돌 → over, over 후 step은 상태 불변, 300점 전 새 없음, 점수 = `scoreAtTick(tick)`
  - 생성 규칙: 연속 장애물 간격 ≥ 도착 시점 속도 × (0.6 + 0.25), 첫 장애물은 1.6초 이상 뒤, 지나간 장애물 제거
  - 결정론: 같은 seed + 같은 입력 → 같은 종료 틱·점수, 다른 seed → 다른 배치
  - fairness: 봇(다가오는 장애물에 맞춰 점프/숙이기) seed 300개 × 최대 5분 → 전부 생존(피할 수 없는 배치 0건)
- [ ] **Step 2: 실패 확인 → Step 3: 구현 → Step 4: 통과 → Step 5: 커밋**

### Task 3: 플레이 가능한 게임 (입력·렌더·화면·루프)

**Files:**
- Create: `game/src/storage.js`, `game/src/input.js`, `game/src/render/sprites.js`, `game/src/render/obstacles.js`, `game/src/render/background.js`
- Rewrite: `game/src/render/renderer.js`, `game/src/ui/screens.js`, `game/src/main.js`, `game/dev.html`
- Modify: `tests/dev-server.test.mjs` (stage1 경로 → runner)
- Test: `tests/storage.test.mjs`, `tests/input.test.mjs`

**Interfaces:**
- `createStorage(backend = globalThis.localStorage) → { getHi, setHi, getCharacter, setCharacter, getNickname, setNickname, getPlayerId, hintSeen, markHintSeen }` — 모든 접근 try/catch, backend가 throw해도 기본값
- `createInput({ jumpEl, duckEl, keyTarget }) → { attach, consume() → { jump, duck }, reset }` — jump는 눌린 순간 큐, duck은 눌린 포인터 집합 + 키
- `loadSprites(url) → Promise<atlas | null>`, `drawCharacter(ctx, atlas, character, pose, frameIdx, x, y)` — atlas null이면 임시 도형
- `createRenderer(canvas, container) → { resize() → { H, groundY, groundCss }, draw(view) }`, `view = { distance, playerY, pose, animTick, obstacles, character }`
- `createScreens(root) → { show(name), setScore(n), setHi(n), flash(), setOver({ score, hi, newRecord }), onAction(fn), showHint(bool), setRegisterEnabled(bool) }`

- [ ] **Step 1: 테스트 작성** — storage: backend가 throw → 기본값·예외 없음, playerId 한 번 만들면 유지, HI는 더 클 때만 갱신. input(가짜 EventTarget): 점프 pointerdown 1회 → consume 1번만 jump true, 숙이기 down→cancel → duck false, lostpointercapture → duck false, 두 포인터 동시(숙이기+점프) → 둘 다 true, reset → 전부 해제, keydown repeat 무시
- [ ] **Step 2: 실패 확인 → Step 3: 구현** — 화면: title(캐릭터 카드 2장, 리더보드 보기, 청첩장으로, 외부 브라우저), hud(⏸, HI, 점수), controls(숙이기·점프), paused, countdown(3·2·1), over(0.7초 뒤 버튼 활성). 뒤로가기 가드 1회 push, 플레이 중 popstate → 일시정지 후 재무장, 그 외 popstate → `history.back()`
- [ ] **Step 4: 브라우저 확인** (`npm run dev`, Chrome) — 캐릭터 선택→플레이→점프/숙이기→충돌→오버→다시 하기, 일시정지·카운트다운, 390×844·360×800·375×667 크기, 콘솔 에러 없음
- [ ] **Step 5: 통과 + 커밋**

### Task 4: 릴리즈 빌드 + 청첩장 진입 카드

**Files:**
- Create: `scripts/build-game.mjs`, `tests/build.test.mjs`, `tests/invitation.test.mjs`
- Generated: `game/index.html`, `game/dist/game.<hash>.js`
- Modify: `index.html`(`</header>` 직후 블록), `css/aesthetic.css`(끝에 블록)

**Interfaces:** `buildGame({ distDir, outHtml } = 기본값) → { file, hash }`

- [ ] **Step 1: 테스트** — build(임시 폴더로): 해시 파일명 형식, index가 번들 참조·모듈 태그 없음, 옛 번들 정리, 본문이 dev.html과 같음, 재현 가능. invitation: `./game/` 링크 1개, hero 뒤·인사말 앞, `.minigame` 스타일 존재
- [ ] **Step 2~4: 실패 → 구현 → 통과** — 실제 `npm run build`로 `game/index.html` 생성, `/game/`을 브라우저로 열어 번들 동작 확인, 청첩장 카드 → 게임 → 청첩장 왕복
- [ ] **Step 5: 커밋**

### Task 5: 리더보드 Worker (+ 로컬 실행기)

**Files:**
- Create: `game/src/shared/nickname.js`, `worker/wrangler.toml`, `worker/migrations/0001_init.sql`, `worker/src/index.js`, `worker/src/token.js`, `worker/src/http.js`, `worker/README.md`, `scripts/lib/d1-sqlite.mjs`, `scripts/dev-api.mjs`
- Test: `tests/nickname.test.mjs`, `tests/worker.test.mjs`

**Interfaces:**
- `validateNickname(raw) → { ok: true, value } | { ok: false, reason: 'length'|'chars'|'reserved'|'profanity' }` (NFC, 2~10자, `[가-힣a-zA-Z0-9]`)
- `signToken(secret, { iat, n })`, `verifyToken(secret, token) → payload | null`
- Worker `fetch(request, env)`; env: `DB`, `HMAC_SECRET`, `ALLOWED_ORIGINS`, `CLIENT_VERSIONS`
- `POST /api/session → { token }` · `POST /api/score → { rank, best, improved } | 4xx { error }` · `GET /api/leaderboard?playerId= → { top, me }`
- 오류 코드: `bad_request`, `bad_token`, `expired`, `old_client`, `too_fast`, `impossible`, `bad_nickname`(+`reason`), `replayed`, `rate_limited`(429)
- `createD1(path = ':memory:')` — D1의 `prepare().bind().first()/all()/run()`, `exec()` 호환

- [ ] **Step 1: 테스트** — nickname: 정상/길이/문자/예약어/욕설/NFC. worker(실제 SQLite): 토큰 발급·검증, 위조 서명 거부, 만료, 같은 토큰 재사용 → replayed, 시간보다 긴 플레이 → too_fast, 상한 초과 점수 → impossible, 낮은 점수는 기존 유지(improved false), 순위 계산(동점은 먼저 등록한 쪽), top 20 + me, 허용 안 된 Origin에 ACAO 없음, OPTIONS 204, 분당 11번째 → 429, 큰 body 거부
- [ ] **Step 2~4: 실패 → 구현 → 통과** — `scripts/dev-api.mjs`(포트 8787)로 curl 실측: 정상 등록, 조작 점수 거부
- [ ] **Step 5: 커밋**

### Task 6: 게임 쪽 리더보드 UI

**Files:**
- Create: `game/src/net/api.js`, `game/src/ui/leaderboard.js`, `tests/api.test.mjs`
- Modify: `game/src/main.js`, `game/dev.html`, `game/src/config.js`(개발용 `?api=` 덮어쓰기)

**Interfaces:** `createApi(base, { fetchImpl, timeoutMs = 5000 }) → { enabled, getToken() → string|null, submit(payload) → { ok, rank, best, improved } | { ok:false, error, reason }, board(playerId) → { top, me } | null }`

- [ ] **Step 1: 테스트** — 가짜 fetch: base 없으면 enabled false·호출 안 함, 타임아웃 → null/`network`, 4xx 오류 코드 전달, 네트워크 예외 → `network`
- [ ] **Step 2~4: 실패 → 구현 → 통과** — 오버 → 등록(닉네임 미리 채움, 클라 검증, 삭제일 안내) → 순위표(내 순위 강조), 타이틀 → 순위표. `dev-api`와 브라우저로 끝까지 확인. 서버 끈 상태에서 등록 실패 안내·게임 정상
- [ ] **Step 5: 커밋**

### Task 7: 문서·마무리

- [ ] `CLAUDE.md` 개발·배포 절차(그림 재생성, dev-api, 빌드 필수), `worker/README.md` 배포 절차(계정→`wrangler d1 create`→`secret put`→`deploy`→`API_BASE` 설정→빌드), `docs/DECISIONS.md` 구현 확정 사항, 스펙의 해상도 문단 갱신
- [ ] `npm test` 전체, `npm run build` 최신 확인, 커밋
- [ ] 1차 이슈(#1~#17) 재설계로 대체 표시 후 닫기
- [ ] 배포는 사용자 확인 후: main 머지·push(GitHub Pages), Cloudflare 배포
