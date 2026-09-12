# Stage 1 + 청첩장 진입 버튼 설계 (M0~M2)

> 2026-09-12 · 상위 스펙: `HANDOFF.md` · 결정 기록: `docs/DECISIONS.md`
> 이 문서는 `HANDOFF.md` 전체 스펙 중 **M0~M2만** 다룬다. Stage 2·리더보드·Worker는 범위 밖이다.

## 1. 목표

하객이 청첩장 최상단의 카드를 눌러 게임에 들어가고, 신랑이 꽃다발과 반지를 들고
설원을 내려가 신부에게 도착한 뒤, 청첩장으로 돌아온다. 서버는 쓰지 않는다.

완료 시점에 배포 가능한 상태가 되며, 카카오톡 인앱 브라우저 실기기에서
스크롤·확대 없이 처음부터 끝까지 플레이된다.

**점수는 없다.** 수집품, 점수 공식, 기록 표시는 Stage 1에 존재하지 않는다.

## 2. 범위 밖

Stage 2, 리더보드, 닉네임 입력, Cloudflare Worker·D1, 실제 픽셀아트 에셋, 효과음.
에셋은 코드로 그린 플레이스홀더로 진행하고 M6에서 교체한다.
`audio.js`는 unlock 배관만 두고 소리는 내지 않는다 — 소리 없이 게임이 성립해야 하므로
나중에 파일만 얹으면 되는 구조로 남긴다.

## 3. 파일 구조

```
CLAUDE.md                        HANDOFF 부록 B + 실제 주소·구조
docs/DECISIONS.md                결정 기록
game/dev.html                    개발용: ES module 직접 로드
game/index.html                  릴리즈: dist/game.<hash>.js 만 참조
game/src/main.js                 부트, 상태 머신 (title / playing / cleared / failed)
game/src/config.js               튜닝 파라미터, 버전
game/src/input.js                상대 드래그 + 키보드(개발용)
game/src/audio.js                unlock 배관만 (무음 안전)
game/src/sim/rng.js              mulberry32, 시뮬 RNG와 연출 RNG 분리
game/src/sim/stage1.js           결정론 순수 모듈
game/src/render/renderer.js      캔버스 스케일링, 보간 렌더
game/src/render/sprites.js       코드로 그린 스프라이트 → 오프스크린 캐시
game/src/ui/screens.js           HTML 오버레이 (타이틀·진행 바·목숨·결과)
game/dist/game.<hash>.js         커밋함
scripts/build-game.mjs           esbuild → 해시 → game/index.html 참조 치환
tests/sim.test.mjs               node --test
index.html                       진입 카드 블록만 추가
css/aesthetic.css                진입 카드 스타일만 추가
.gitignore                       node_modules/, .env*, .wrangler/, worker/.dev.vars 추가
```

## 4. 시뮬레이션 (`game/src/sim/stage1.js`)

순수 모듈. DOM·`Date`·`performance`·`Math.random`·초월함수를 쓰지 않는다.

**인터페이스**

```js
createSim(seed)          // → state
step(state, input)       // 1틱 진행. input = { targetX: int }  (0~719, 1/4px 단위)
isOver(state)            // → boolean
getOutcome(state)        // → 'cleared' | 'failed' | null    ※ 점수 없음
```

**수치**: 정수 고정소수점, `1px = 256`. 시뮬 내부는 사칙연산, `Math.imul`,
비트 연산, `Math.floor/abs/min/max`만 사용. 점프 궤적은 정수 룩업 테이블.

**틱**: 고정 60Hz + accumulator. 한 프레임 최대 5틱까지만 따라잡기. 렌더는 틱 사이 보간.

**상태**: 신랑 x·횡속도·무적 잔여 틱·체공 잔여 틱, 남은 목숨, 진행 거리,
장애물 줄 목록, 스폰 커서, 종료 플래그.

**규칙** (파라미터는 전부 `config.js`)
- 목표 거리 800m (1m = 4 논리 px). 스크롤 62 → 최대 118 px/s, 거리 비례 증가
- 피격: 목숨 −1, 무적 1.3초, 속도 ×0.55. 목숨 0이면 `failed`
- 점프대 접촉: 체공 0.8초, 체공 중 충돌 무시
- 장애물 나무·바위·눈사람. 한 줄 1~2개(거리에 따라 2개 확률 증가),
  같은 줄 최소 간격 46px, 줄 간격 44~72px. 점프대 줄당 20%
- 도착 80m 전부터 스폰 중지 → 도착 연출 → `cleared`
- **수집품 없음, 점수 없음**

## 5. 렌더·입력

- 논리 해상도 180×300. `devicePixelRatio` 최대 2, 정수 배율, `image-rendering: pixelated`
- 높이는 `100dvh` / `window.innerHeight` 기준. 노치는 `env(safe-area-inset-*)`
- 캔버스 컨테이너: `touch-action: none; overscroll-behavior: none; user-select: none;
  -webkit-touch-callout: none;`
- 입력은 **상대 드래그 하나**. 포인터 이동량을 누적해 목표 x로 만들고 틱마다 양자화한다.
  기울기 센서·가상 조이스틱·다중 버튼은 쓰지 않는다. 키보드 좌우는 개발용으로만
- 스프라이트는 코드로 그려 오프스크린 캔버스에 1회 캐시. 프레임당 객체 할당 최소화
- 스프라이트 크기(px): 신랑 14×17, 신부 14×16(+외곽선 1), 나무 12×13, 바위 10×6,
  눈사람 10×13(+외곽선 1), 점프대 16×4

## 6. UI (HTML 오버레이)

캔버스가 아닌 HTML로 그려 선명하게 유지한다.

- **타이틀**: 시작 버튼(첫 탭에서 오디오 unlock), "건너뛰기", "청첩장으로 돌아가기"
- **플레이 중**: 상단에 눈금 없는 진행 바(끝에 신부 실루엣), 남은 목숨 하트 3개.
  숫자는 표시하지 않는다
- **클리어**: 꽃다발·반지 전달 연출 → "청첩장으로 돌아가기".
  Stage 2 해금 플래그를 localStorage에 저장하되, 이번 범위에서는 Stage 2가 없으므로
  타이틀에 노출하지 않는다
- **실패**: "다시 하기" / "건너뛰기" / "청첩장으로 돌아가기"
- 일시정지: `visibilitychange`, `pagehide`, iOS 엣지 스와이프, Android 뒤로가기

## 7. 청첩장 진입 (M2)

- `index.html`의 hero(`#area1`) 바로 아래, 인사말(`#area2`) 앞에 카드 블록 추가.
  이 블록 외에는 청첩장 본문을 수정하지 않는다
- 스타일은 `css/aesthetic.css` 하단에 새 블록으로만 추가하고 기존 토큰
  (`--accent`, `--paper-warm`, `--sec-pad`, `--gut`)을 쓴다
- 링크는 `./game/`. 게임에서 청첩장 복귀는 `../`
- UA에 `KAKAOTALK`이 있으면 게임 화면 하단에 "외부 브라우저로 열기"
  (`kakaotalk://web/openExternal?url=`) 보조 링크. 기본 경로가 아니라 보험

## 8. 빌드와 캐시

- 개발: `game/dev.html`이 `src/main.js`를 모듈로 직접 로드. 빌드 불필요
- 릴리즈: `node scripts/build-game.mjs` → esbuild로 `game/dist/game.<hash>.js` 생성 →
  `game/index.html`의 스크립트 참조를 치환. 번들은 커밋한다
- 카톡 인앱 캐시가 강하므로 해시 파일명이 유일한 무효화 수단이다.
  **배포 전 빌드는 선택이 아니라 필수 단계** — CLAUDE.md에 명시
- `?debug=1`일 때만 vConsole을 CDN에서 동적 로드
- 초기 로드 3MB 이내 (플레이스홀더 단계에서는 수십 KB)

## 9. 테스트

`node --test tests/sim.test.mjs`

1. **결정론**: 같은 seed + 같은 inputLog → 같은 종료 틱, 같은 결과(`cleared`/`failed`),
   같은 최종 상태 해시
2. **단위**: 충돌 판정, 무적 중 무피해, 체공 중 충돌 무시, 목숨 0 → `failed`,
   800m 도달 → `cleared`, 도착 80m 전 스폰 중지
3. **난이도 분포**: 단순 봇(가장 가까운 빈 공간으로 이동)으로 seed 300개를 돌려
   클리어율이 80% 이상인지 확인. 미달이면 `config.js`를 조정한다
4. **점수 부재 회귀**: 시뮬 상태와 결과 객체에 점수 필드가 없음을 확인

렌더·입력·레이아웃은 자동 테스트 대상이 아니다 — §10 실기기 확인으로 검증한다.

## 10. 완료 기준

- `node --test` 전부 통과
- 로컬 정적 서버에서 청첩장 → 게임 → 클리어 → 청첩장 왕복
- 카카오톡 인앱(iOS·Android) 실기기에서: 스크롤·당겨서 새로고침·확대가 일어나지 않음,
  끝까지 플레이 가능, 체감 끊김 없음, 백그라운드 복귀 시 일시정지,
  무음 모드에서 정상, 60Hz·120Hz에서 속도 동일
- 재배포 후 카톡에서 새 버전이 로드됨 (해시 파일명 확인)
