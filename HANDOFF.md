# 청첩장 미니게임 Handoff (Claude Code용)

> 작성: 2026-09-12 · 대상: Claude Code (맥미니 로컬 터미널) · 요청자: 김태웅(신랑)
> 이 문서는 채팅에서 합의한 기획·제약·설계를 정리한 것이다. 착수 전에 끝까지 읽을 것.

---

## 0. 작업 원칙

- 사용자는 구현 세부를 전부 위임한다. **§11 "결정 필요" 항목만** 해당 마일스톤 착수 전에 질문하고, 나머지는 합리적인 기본값으로 진행한 뒤 `docs/DECISIONS.md`에 한 줄씩 기록한다.
- 기존 청첩장 페이지는 **게임 진입 버튼 추가 외에는 수정하지 않는다.**
- 저장소는 공개 저장소이고 GitHub Pages가 저장소 전체를 서빙한다. **토큰·시크릿·`.dev.vars`·`.env`는 절대 커밋하지 않는다.**
- 착수 시 §3(타깃 환경), §6(결정론 규칙), §9(보안)를 요약해 `CLAUDE.md`에 반영한다 (부록 B 초안 사용).
- 마일스톤 단위로 커밋하고, 각 마일스톤 끝에 사용자가 실기기에서 확인할 항목을 짧게 제시한다.

---

## 1. 프로젝트 개요

- 청첩장: 김태웅 ♡ 박수진 · 2027-01-30(토) 11:00 · 상록아트홀
- 배포: https://tw-sj-wedding.github.io/ (저장소 `tw-sj-wedding/tw-sj-wedding.github.io`, 루트 서빙). 게임은 `/game/`
  - 2026-09-12 확인: 전용 계정으로 이전 완료. 문서 최초 작성 시의 `twoongg.github.io/mobile-wedding-invitation/`은 더 이상 쓰지 않는다.
- 현재 구조: 정적 HTML/CSS/JS, 빌드 과정 없음
- 추가 범위: 픽셀아트 스노보드 미니게임 2개 스테이지 + Stage 2 하객 리더보드
- 주 사용자: 청첩장 링크를 카카오톡에서 여는 하객 (연령대 넓음, 대부분 폰)

---

## 2. 확정된 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 렌더링 | Vanilla JS + Canvas 2D, 게임 엔진 미사용 | 용량 최소화, 결정론적 시뮬레이션 직접 제어 |
| 해상도 | 논리 180×300 픽셀아트, 확대 + `image-rendering: pixelated` | 저사양 성능, 에셋 일관성·용량 |
| 방향 | 세로 전용 | 인앱 브라우저는 가로 고정·전체화면 불가 |
| 조작 | 좌우 **상대 드래그** 1개 입력, 점프는 점프대 자동 | 설명 없이 누구나 가능 |
| 금지 조작 | 기울기 센서, 가상 조이스틱, 다중 버튼 | iOS 권한·인앱 불안정, 오조작 |
| 배치 | 저장소 `/game/` 하위, 청첩장에서 링크로 진입 | 청첩장 로딩에 영향 없음 |
| 리더보드 | Stage 2만. 기본안 Cloudflare Workers + D1 (§8) | 무료, 상시 가동, 서버측 검증 가능 |
| Stage 1 점수 | 없음. 서사 구간으로만 | 점수가 붙으면 도입부가 경쟁 구간으로 읽힘 (2026-09-12 변경) |
| 에셋 | 코드로 그린 플레이스홀더로 먼저 완성, 후반에 교체 | 조작감·난이도 우선 확정 |

---

## 3. 타깃 환경 (하드 제약)

주 접속 환경은 **카카오톡 인앱 브라우저**다. Android는 Android System WebView(Chromium), iOS는 WKWebView(Safari 계열)로 엔진이 다르다.

**레이아웃·입력**
- 높이는 `100dvh` 또는 `window.innerHeight` 기반 (`100vh` 금지). 노치는 `env(safe-area-inset-*)`.
- 게임 영역: `touch-action: none; overscroll-behavior: none; user-select: none; -webkit-touch-callout: none;` 더블탭 확대 방지.
- Fullscreen API, 화면 방향 고정 사용하지 않음.
- iOS는 화면 왼쪽 끝 스와이프가 뒤로가기로 먹힐 수 있음 → 플레이 중 이탈 시 일시정지, 필요하면 이탈 확인.
- Android는 뒤로가기 버튼·제스처로 이탈하기 쉬움 → 동일하게 처리.

**오디오**
- 첫 탭(시작 버튼)에서 오디오 unlock.
- iOS 무음 스위치가 켜져 있으면 소리가 안 날 수 있음 → **소리 없이도 게임이 성립**해야 함.
- 게임 진입 시 청첩장 BGM과 겹치지 않게.

**성능**
- 성능 기준 기기는 보급형 갤럭시.
- 캔버스 `devicePixelRatio`는 최대 2로 제한, 스프라이트는 오프스크린 캐시, 프레임당 객체 할당 최소화.
- 60Hz·120Hz 기기에서 게임 속도 동일 (고정 틱, §6).
- `visibilitychange` / `pagehide` 시 자동 일시정지.
- 진동(`navigator.vibrate`)은 Android만 지원 → 있으면 쓰는 보너스로만.

**배포·디버깅**
- 카톡 인앱은 캐시가 강함 → 릴리즈 JS/CSS/에셋은 해시 파일명 (§7).
- `?debug=1`일 때만 vConsole 로드 (카톡 웹뷰는 PC 원격 디버깅이 사실상 불가).
- UA에 `KAKAOTALK` 포함 시 보조 "외부 브라우저로 열기" 링크 (`kakaotalk://web/openExternal?url=`). 기기·버전별로 동작이 달라 기본 경로가 아닌 보험.
- 게임 초기 로드 총량 3MB 이내 목표.
- localStorage는 사용하되, 인앱에서 초기화될 수 있다고 전제.

**닉네임 입력 (키보드)**
- iOS는 키보드가 화면을 덮으며 밀리고, Android는 뷰포트 높이가 줄어듦 → 입력창은 결과 화면 상단에 배치하고 두 방식 모두 테스트.

---

## 4. Stage 1 — "신부에게 가는 길"

**목표:** 스토리 도입부. 난이도 easy, 대부분 클리어.
**점수 없음** (2026-09-12 변경). 신랑이 꽃다발과 반지를 들고 신부에게 도착한다 — 이것만 남긴다.
수집품·점수 표시·기록은 전부 Stage 1에서 제외하고, 점수와 리더보드는 Stage 2에만 존재한다.

**규칙**
- 신랑(꽃다발·반지 소지)이 설원을 내려가며 장애물을 피해 결승점의 신부에게 도착.
- 전진 방향은 화면 아래. 신랑은 화면 상단(y≈70)에 있고 장애물이 아래에서 올라옴.
- 목숨 3개. 점프대를 밟으면 자동 점프(체공 중 충돌 무시).
  - 하트는 **수집품이 아니라 남은 목숨 표시 아이콘**으로만 쓴다.
- 진행도는 화면 상단의 **눈금 없는 진행 바**(끝에 신부 실루엣)로만 보여준다. 남은 거리를 숫자로 쓰지 않는다 — 숫자가 다시 점수처럼 읽힌다.
- 도착 직전 스폰 중지 → 버진로드·꽃 아치·신부 등장 → 신랑 자동 중앙 정렬 → 클리어.

**초기 파라미터** (`config.js`, 튜닝 대상)
- 목표 거리 800m (1m = 4 논리 px)
- 스크롤 속도 62 px/s에서 시작, 거리에 비례해 증가, 최대 118 px/s
- 피격 시 무적 1.3초, 속도 ×0.55
- 점프대 체공 0.8초
- 장애물: 나무·바위·눈사람. 한 줄에 1~2개(거리에 따라 2개 확률 증가), 같은 줄 최소 간격 46px, 줄 간격 44~72px
- 점프대: 줄당 20% (하트가 차지하던 몫은 점프대 확률 증가와 빈 줄로 재분배)
- 도착 80m 전부터 스폰 중지
- 목표 플레이 시간 30~40초

**흐름**
- 클리어 → 짧은 연출(꽃다발·반지 전달) → Stage 2 해금(localStorage 저장) → 타이틀에 "Stage 2 바로 하기" 노출.
- 결과 화면에 점수·기록을 표시하지 않는다. 클리어 연출과 다음 행동(Stage 2로 가기 / 청첩장으로 돌아가기)만.
- 실패 → 즉시 재도전. **"건너뛰기"는 실패 횟수와 무관하게 항상 노출** (2026-09-12 결정, §11-3).

**참고 구현:** 없음. 부록 A의 `prototype-stage1.html`은 저장소로 넘어오지 않았다.
위 파라미터와 부록 A의 스프라이트 크기 표만 기준으로 §6·§7 구조에 맞춰 새로 작성한다 (2026-09-12 결정).

---

## 5. Stage 2 — "둘이 함께" (endless, 리더보드)

### 컨셉
신랑은 **알파인보더**(빠르지만 둔함), 신부는 **프리보더**(느리지만 민첩). 입력은 하나로 신랑만 조작하고, 신부는 AI가 신랑의 라인을 따라온다. 둘의 속도 차이를 관리하는 것이 핵심 전략이다.

### 에이전트 모델 (초기값, 튜닝 대상)
**신랑 (플레이어)**
- 전진속도 vG ∈ [70, 135] px/s
- 횡속도가 작으면(직활강) 가속 +25 px/s², 횡속도에 비례해 감속(카빙)
- 횡가속 한계 낮음 → 묵직하게 돌아감

**신부 (AI 추종)**
- 전진속도 vB = 95 px/s에서 시작, 거리에 따라 완만히 증가, 상한 115
- 신랑 경로를 **진행도(progress) 기준**으로 path buffer에 기록
- 목표 x = path buffer에서 `신부 progress + lookahead 24px` 지점의 신랑 x (단, 신랑 progress를 넘지 않게 clamp) → 코너 안쪽으로 잘라 들어옴
- 횡가속 한계 높음 → 민첩
- 정적 장애물에 한해 짧은 회피 보정. 성공률은 높지만 완벽하지 않게 (신랑이 장애물 근처에서 급하게 꺾으면 실패할 수 있음 → 부드러운 라인을 유도)

**간격과 카메라**
- gap = 신랑 progress − 신부 progress
- 신부는 신랑을 추월할 수 없음 (gap ≥ 16px 유지하도록 신부 감속)
- 카메라는 신부를 화면 y=70에 고정, 신랑은 y=70+gap에 그림
  - 신랑이 앞서 나갈수록 화면 아래로 내려가 **앞을 볼 수 있는 거리가 줄어듦** → 치고 나가는 것 자체가 페널티
- gap > 140px부터 경고 표시, gap > 200px이면 종료 ("신부를 놓쳤어요")

### 장애물 (거리에 따라 밀도·속도 증가)
- **정적:** 나무, 바위, 눈사람
- **동적 (핵심):** 가로질러 가는 스키어(vx 30~70), 느리고 폭 넓은 제설차(폭 약 40px, vx 15~25)
  - 목적: 신랑은 통과했지만 1~2초 뒤 신부가 도착할 때 경로가 막히는 상황을 만든다. 이것이 멀티에이전트 긴장감의 원천.
- 스폰은 **seed 기반 PRNG만** 사용
- 정적 장애물 기준으로 통과 가능한 경로가 최소 1개 있도록 보장

### 종료와 점수
- 신랑 또는 신부 충돌, 또는 gap 초과 시 즉시 종료 (목숨 없음)
- **점수 = 신부 기준 진행 거리 (m, 정수).** 동점이면 먼저 달성한 기록 우선
- 하트·아이템 없음 → 점수가 순수 거리라 서버 검증이 단순함

### 하드 모드 (선택, 후순위)
좌우 반쪽 화면으로 신랑·신부를 각각 조작. 포함 여부와 리더보드 분리 여부는 §11.

---

## 6. 시뮬레이션 구조 (결정론)

Stage 2는 서버 리플레이 검증이 가능하도록 **처음부터 결정론적으로** 작성한다.

- `game/src/sim/stage2.js`는 순수 모듈: DOM·`Date`·`performance`·`Math.random` 의존 금지
  - 인터페이스 예: `createSim(seed)`, `step(state, input)` (1틱), `isOver(state)`, `getScore(state)`
- **고정 틱 60Hz** + accumulator, 렌더는 틱 사이 보간. 한 프레임 최대 5틱까지만 따라잡기.
- PRNG: mulberry32 등 32bit 정수 연산 기반. **시뮬용 RNG와 연출용 RNG(파티클 등)는 분리.**
- 수치: 정수 고정소수점 권장 (예: 1px = 256 단위). 시뮬 내부에서는 사칙연산, `Math.imul`, 비트 연산, `Math.floor/abs/min/max`만 사용.
  - `Math.sin/cos/exp/pow` 같은 초월함수는 JS 엔진(V8 vs JavaScriptCore)마다 결과가 미세하게 다를 수 있으므로 금지. 필요하면 정수 룩업 테이블.
- 입력 기록: 틱별 조향 목표 x를 정수로 양자화(0~719, 1/4px 단위)하고, 값이 바뀐 틱만 `[tick, value]` 배열로 저장.
- 테스트 (`node --test`)
  - 같은 seed + inputLog → 같은 종료 틱과 점수
  - 실제 폰(카톡 iOS·Android)에서 기록한 리플레이를 fixture로 저장해 Node에서 재생 시 일치
- 난이도 튜닝용 스크립트 (선택): 단순 봇으로 seed 1000개를 돌려 거리 분포 출력
- Stage 1은 결정론이 필수는 아니지만 같은 틱 구조를 공유

---

## 7. 파일 구조 (제안)

착수 시 기존 저장소 구조를 확인하고 조정한다.

```
/                          기존 청첩장 (진입 버튼만 추가)
game/
  index.html
  src/
    main.js                부트, 상태 머신(title/stage1/stage2/result)
    config.js              튜닝 파라미터, API base URL, 버전
    input.js               상대 드래그, 키보드(개발용)
    audio.js
    api.js                 리더보드 통신
    sim/rng.js
    sim/stage1.js
    sim/stage2.js          결정론 순수 모듈 (worker와 공유)
    render/renderer.js
    render/sprites.js
    ui/screens.js          HTML 오버레이 (타이틀·결과)
    ui/leaderboard.js
    ui/nickname.js
  assets/                  sprites.png, sprites.json, sfx/
  dist/                    릴리즈 번들 (커밋함)
worker/                    리더보드 API (wrangler 프로젝트)
  src/index.js             ../game/src/sim/stage2.js를 import해 검증에 재사용
  migrations/0001_init.sql
  wrangler.toml
scripts/build-game.mjs     esbuild 번들 → 해시 파일명 → game/index.html 참조 치환
tests/sim.test.mjs
docs/DECISIONS.md
docs/QA.md
```

- 개발 중에는 ES modules를 직접 로드하고, 릴리즈 시 esbuild로 `game.[hash].js` 단일 번들을 만들어 커밋한다 (GitHub Pages는 빌드 없이 서빙).
- UI 텍스트(점수, 닉네임, 랭킹)는 캔버스가 아닌 **HTML 오버레이**로 그려 선명하게 유지한다.
- `.gitignore`에 `worker/.dev.vars`, `.env*`, `node_modules/`, `.wrangler/` 포함.
- 청첩장 `index.html`에는 "미니게임" 카드를 추가하고 `./game/`으로 연결한다. 위치는 hero(`#area1`) 바로 아래, 인사말(`#area2`) 앞 (§11-4 결정). 스타일은 `css/aesthetic.css`의 기존 토큰을 쓰고 새 블록만 추가한다.

---

## 8. 리더보드 백엔드

### 기본안: Cloudflare Workers + D1

**무료 플랜 제약** (착수 시 공식 문서로 최신값 재확인)
- Workers: 요청당 CPU 10ms, 일 10만 요청
- D1: 일 500만 row read / 10만 row write, 저장 5GB
- 2026-09-01부터 D1 무료 한도 초과 시 UTC 자정까지 쿼리가 거부됨 → 랭킹 조회는 캐시로 read 절약
- **CPU 10ms 제약 때문에 서버에서 리플레이 전체를 재실행하는 검증(Level 2)은 무료 플랜에서 초과 위험이 크다** → §9

**API**
- `POST /api/session` → `{ token, seed }`
  - token = `seed | issuedAt | nonce`를 HMAC-SHA256으로 서명한 값. DB 쓰기 없음. 유효기간 30분.
- `POST /api/score`
  - body: `{ token, playerId, nickname, distance, endTick, inputLog, clientVersion }`
  - 처리: 서명·만료 확인 → nonce 1회성 확인(`used_nonces`) → 검증(§9) → 1인 최고 기록 upsert
  - 응답: `{ rank, best }`
- `GET /api/leaderboard?limit=20&playerId=...`
  - 응답: `{ top: [{ rank, nickname, distance }], me: { rank, distance } | null }`
  - `top`은 Cache API로 30초 캐시, `me`는 별도 계산
- CORS: `https://tw-sj-wedding.github.io`만 허용 (브라우저 제한일 뿐 보안 수단 아님)
- 시크릿: `wrangler secret put HMAC_SECRET`
- 관리(삭제·수정)용 공개 엔드포인트는 만들지 않는다. `wrangler d1 execute`로만 처리.

**D1 스키마 (초안)**
```sql
CREATE TABLE scores (
  player_id      TEXT PRIMARY KEY,
  nickname       TEXT NOT NULL,
  distance       INTEGER NOT NULL,
  end_tick       INTEGER NOT NULL,
  verified       INTEGER NOT NULL DEFAULT 0,
  client_version TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX idx_scores_rank ON scores (distance DESC, updated_at ASC);

CREATE TABLE used_nonces (
  nonce   TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);

-- Level 2 검증을 쓸 경우
CREATE TABLE replays (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id  TEXT NOT NULL,
  seed       TEXT NOT NULL,
  distance   INTEGER NOT NULL,
  input_log  TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | verified | rejected
  created_at INTEGER NOT NULL
);
```

### 대안: 개인 맥미니 (기본안 아님)
- API 서버로는 비권장: 몇 달간 상시 가동 필요(잠자기·업데이트 재부팅·정전·공유기 재시작), 개인 머신이 인터넷에 노출됨.
- 그래도 쓴다면: Docker 격리, 전용 사용자 계정, 포트포워딩 없이 Cloudflare Tunnel로 API 포트만 공개.
- **절충안 (검토 가치 있음): 맥미니를 비동기 리플레이 검증기로만 사용**
  - Worker는 점수를 `pending`으로 받아 랭킹에 반영
  - 맥미니가 주기적으로 인증된 요청으로 pending 리플레이를 가져와 재시뮬 → `verified` 또는 `rejected` 반영
  - 맥미니는 아웃바운드 요청만 하므로 인바운드 포트가 없고, 맥미니가 꺼져 있어도 랭킹은 계속 동작

---

## 9. 보안 요구사항

### 점수 위조 방어 (단계적)
**Level 1 — M4에서 필수**
- 서명된 세션 토큰, nonce 1회 사용
- `endTick / 60 ≤ (now − issuedAt) + 5초`
- `distance ≤ 이론 최대속도 × endTick`
- inputLog 형식·길이 검증, `clientVersion` 허용 목록

**Level 2 — 방식은 §11에서 결정**
- 서버가 seed + inputLog로 재시뮬해 점수가 일치할 때만 `verified`
- 방식 후보: (a) Workers Paid 플랜 (CPU 기본 30초) (b) 맥미니 비동기 검증기 (c) Level 1 유지
- inputLog 크기 상한 (예: 64KB)
- 경품을 걸 경우 Level 2 필수

### 입력과 출력
- 닉네임: 2~10자, 한글·영문·숫자, NFC 정규화, 서버측 욕설 필터, 예약어 차단(신랑, 신부, 태웅, 수진, 관리자, admin 등)
- 사용자 문자열 출력은 **`textContent`만** 사용 (`innerHTML` 금지)
- SQL은 prepared statement만

### 남용 방지
- IP 기준 rate limit (session·score 각각, 예: 분당 10회). IP 원문은 저장하지 않음 (필요하면 salt 해시).
- playerId(localStorage UUID)당 최고 기록 1개. 인앱 storage 초기화로 중복이 생기는 것은 허용.
- 요청 body 크기 제한.

### 개인정보와 운영
- 수집 항목은 닉네임, 익명 playerId, 기록만. 실명·연락처 요구 금지.
- 결과 화면에 "기록은 결혼식 후 삭제됩니다" 안내 (시점은 §11).
- 서버 오류·네트워크 끊김 시에도 게임은 계속 가능하고, 랭킹 등록만 실패 안내.

---

## 10. 마일스톤

| # | 내용 | 완료 기준 |
|---|---|---|
| M0 | 저장소 구조 파악, `CLAUDE.md`, `docs/DECISIONS.md`, 로컬 실행법 정리 | 문서 커밋 |
| M1 | Stage 1 MVP: 프로토타입을 §6·§7 구조로 이식, 플레이스홀더 에셋, 빌드 스크립트(해시 파일명), `?debug=1` vConsole | Pages 배포 후 카톡 iOS·Android 실기기에서 스크롤·확대 없이 끝까지 플레이, 체감 끊김 없음 |
| M2 | 청첩장 연결: 진입 버튼, 복귀 동선, 외부 브라우저 폴백 | 청첩장 → 게임 → 청첩장 왕복 정상 |
| M3 | Stage 2 오프라인: 결정론 sim, 렌더, 리플레이 기록 | `node --test` 통과, 실기기 리플레이 fixture 일치, 실기기 플레이 |
| M4 | 리더보드 Level 1: Worker + D1 + 닉네임·랭킹 UI | 실기기 등록·조회 성공, curl로 보낸 조작 점수 거부 |
| M5 | 보안 마무리: rate limit, 닉네임 필터, Level 2 (결정에 따라) | §9 항목 전부 확인 |
| M6 | 에셋·사운드·연출 교체 | 초기 로드 3MB 이내 유지 |
| M7 | QA와 운영 준비 | `docs/QA.md` 전체 통과, 기록 조회·삭제 명령을 담은 운영 메모 |

---

## 11. 결정 필요 (해당 시점 전에 사용자에게 질문)

| # | 항목 | 기본값 | 질문 시점 |
|---|---|---|---|
| 1 | 리더보드 백엔드 최종 선택 | Workers + D1 | M4 전 |
| 2 | 점수 검증 Level 2 방식 | Level 1로 시작 후 결정 | M5 전 |
| 3 | ~~Stage 1 실패 시 건너뛰기 허용~~ | **결정: 항상 노출** (2026-09-12) | 완료 |
| 4 | ~~청첩장 내 게임 진입 버튼 위치~~ | **결정: 최상단 — hero(`#area1`) 바로 아래, 인사말(`#area2`) 앞** (2026-09-12) | 완료 |
| 5 | 랭킹 운영 기간, 삭제 시점, 경품 여부 | 결혼식 1개월 후 삭제, 경품 없음 | M4 전 |
| 6 | 하드 모드(2인 개별 조작) 포함 여부 | 제외 | M3 이후 |
| 7 | 캐릭터 에셋 제작 방식 | 두 사람 사진 기반 픽셀아트 | M6 전 |
| 8 | 사운드 범위 | 효과음만, BGM 없음 | M6 전 |

---

## 12. QA 체크리스트 (`docs/QA.md` 초안)

- [ ] 카톡 인앱 iOS(최신 아이폰) + Android(보급형 갤럭시)에서 전체 흐름 완주
- [ ] 드래그 중 페이지 스크롤, 당겨서 새로고침, 확대가 일어나지 않음
- [ ] iOS 왼쪽 가장자리 드래그로 뒤로가기 이탈하지 않음 (또는 이탈 시 일시정지)
- [ ] 120Hz 기기와 60Hz 기기에서 게임 속도 동일
- [ ] 백그라운드 전환 후 복귀 시 일시정지 상태
- [ ] 무음 모드에서도 게임 진행 이상 없음
- [ ] 닉네임 입력 시 키보드가 입력창을 가리지 않음 (iOS·Android)
- [ ] 재배포 후 카톡에서 새 버전이 로드됨
- [ ] 서버 오류·오프라인에서도 게임 가능, 랭킹만 실패 안내
- [ ] curl로 조작한 점수 전송이 거부됨
- [ ] 닉네임에 `<img src=x onerror=alert(1)>` 입력 시 텍스트로만 표시되거나 거부됨
- [ ] 카톡 공유 미리보기 정상 (필요 시 카카오 공유 디버거로 캐시 초기화)

---

## 부록 A. 프로토타입

`prototype-stage1.html`: 채팅에서 만든 Stage 1 동작 초안 (단일 파일, 코드로 그린 도트 스프라이트, 예시 랭킹 데이터).
조작감·파라미터·스프라이트 크기의 기준으로 참고하고, 코드 구조는 §6·§7에 맞춰 새로 작성한다. 프로토타입은 가변 dt 기반이므로 고정 틱으로 바꿔야 한다.

스프라이트 크기(px): 신랑 14×17, 신부 14×16(+외곽선 1px), 나무 12×13, 바위 10×6, 눈사람 10×13(+외곽선 1px), 하트 7×6, 점프대 16×4

---

## 부록 B. CLAUDE.md 초안

```markdown
# 청첩장 미니게임

- 전체 스펙: HANDOFF.md. 결정 기록: docs/DECISIONS.md
- GitHub Pages 정적 사이트, 공개 저장소. 시크릿 커밋 금지.
- 게임은 /game 에만 작성. 청첩장 페이지는 진입 버튼 외 수정 금지.
- 타깃: 카카오톡 인앱 브라우저 (iOS WKWebView / Android WebView), 세로, 터치.
  100dvh, touch-action:none, overscroll-behavior:none, 오디오는 첫 탭에서 unlock, 소리 없이도 성립.
- Canvas 2D, 논리 180x300 픽셀아트, 게임 엔진 미사용. UI 텍스트는 HTML 오버레이.
- 고정 60Hz 틱. game/src/sim/stage2.js 는 결정론 유지:
  Math.random/Date/DOM 금지, 초월함수 금지, 정수 고정소수점, 시뮬 RNG와 연출 RNG 분리.
- 리더보드: /worker (Cloudflare Workers + D1). 사용자 문자열은 textContent로만 출력, SQL은 prepared statement.
- 릴리즈 에셋은 해시 파일명 (카톡 캐시 대응).
```
