# 청첩장 미니게임

- 설계: `docs/superpowers/specs/2026-10-14-endless-snowboard-design.md` · 결정 기록: `docs/DECISIONS.md`
  - `HANDOFF.md`와 2026-09-12 스펙·계획은 이 설계로 **대체됨** (이력 보존용)
- 배포: https://tw-sj-wedding.github.io/ (저장소 루트 서빙, GitHub Pages). 게임은 `/game/`.
- 공개 저장소다. 토큰·시크릿·`.env`·`.dev.vars`를 커밋하지 않는다.
- 게임 코드는 `/game` 에만 쓴다. 청첩장 페이지는 진입 카드 블록 외에 수정하지 않는다.

## 타깃

카카오톡 인앱 브라우저 (iOS WKWebView / Android WebView), 세로 전용, 터치.
`100dvh`(`100vh` 금지), `touch-action:none`, `overscroll-behavior:none`,
오디오는 첫 탭에서 unlock하고 **소리 없이도 게임이 성립**해야 한다.
성능 기준 기기는 보급형 갤럭시.

## 게임 규칙

- 옆에서 보는 엔드리스 스노보드 러너 (크롬 공룡 게임 형식). 점프·숙이기 버튼 2개.
- Canvas 2D, 논리 가로 400 픽셀아트(정수 배율), 게임 엔진 없음. UI·버튼은 HTML 오버레이.
- **그림은 손으로 고치지 않는다.** Gemini 원본(`game/assets/src/`)을 `scripts/build-sprites.mjs`로
  변환만 한다. 어색하면 원본을 다시 뽑는다.
- 고정 60Hz 틱. `game/src/sim/` 아래는 순수 모듈: `Math.random`/`Date`/`performance`/DOM 금지,
  seed 기반 RNG만 사용 (테스트 봇 재현용).
- 튜닝 숫자는 전부 `game/src/config.js`에 둔다.

## 작업 기록

- **기능 단위마다 GitHub 이슈를 남긴다.** 저장소는 `tw-sj-wedding/tw-sj-wedding.github.io`,
  `gh` CLI는 `twoongg` 계정으로 인증돼 있다.
- 새 기능·버그·튜닝에 손대기 전에 `gh issue create` 로 이슈를 먼저 만든다.
- 커밋 메시지 본문에 `Closes #N` 을 적어 이슈를 닫는다. 여러 커밋에 걸치는 기능이면
  마지막 커밋에서만 닫는다.
- 라벨: `game`(게임 본체), `invitation`(청첩장 페이지), `infra`(빌드·배포·테스트),
  `qa`(실기기 확인에서 나온 것). 마일스톤은 `HANDOFF.md` §10의 M0~M7.

## 개발과 배포

- 개발: `npm run dev` 후 `http://localhost:8123/game/dev.html`
  (모듈을 직접 로드하므로 빌드 불필요)
  - **`python3 -m http.server` 를 쓰지 않는다.** 캐시 헤더를 보내지 않아 Chrome이
    ES 모듈의 옛 사본을 재사용한다. 모듈 일부만 옛 것이면 이벤트 핸들러가 붙지 않아
    버튼이 죽는데 콘솔에는 아무 에러도 안 남아서, 없는 버그를 쫓게 된다.
    `scripts/dev-server.mjs` 는 모든 응답에 `Cache-Control: no-store` 를 붙인다.
- 테스트 전체: `npm test`
  - 한 파일만: `node --test tests/stage1-spawn.test.mjs`
  - `node --test tests/` 처럼 디렉터리를 넘기면 Node 24가 이를 모듈 경로로 해석해
    `MODULE_NOT_FOUND`로 죽는다. 반드시 glob(`tests/**/*.test.mjs`)이나 파일 경로를 쓴다.
- **배포 전 `npm run build`는 필수다.** 카톡 인앱 캐시가 강해서 해시 파일명이
  유일한 무효화 수단이고, `game/index.html`은 빌드가 만든 번들만 참조한다.
  빌드를 빼먹으면 하객에게 옛 버전이 계속 나간다.
- `game/index.html`은 `game/dev.html`에서 **생성**된다. 직접 고치지 않는다.
- `?debug=1`일 때만 vConsole을 로드한다 (카톡 웹뷰는 원격 디버깅이 사실상 불가).
