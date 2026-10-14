# 하객 리더보드 Worker

Cloudflare Workers + D1 (무료 플랜). 게임은 이 Worker 없이도 완전히 동작하고,
`game/src/config.js` 의 `API_BASE` 가 비어 있으면 리더보드 버튼이 숨겨진다.

## 로컬에서 돌리기 (Cloudflare 계정 불필요)

```bash
npm run dev:api      # http://localhost:8787 — 같은 Worker 코드를 node:sqlite 위에서 실행
npm run dev          # http://localhost:8123
# 게임: http://localhost:8123/game/dev.html?api=http://localhost:8787
```

배포됨: https://tw-sj-wedding-leaderboard.tw-sj-wedding.workers.dev (2026-10-14).

## 처음 배포 (한 번만, 이미 끝남 — 기록용)

1. Cloudflare 계정을 만들고 **가입 이메일을 인증한다** (안 하면 `wrangler deploy` 가 code 10034 로
   거부). 무료, 카드 불필요. 착수 시 무료 한도를 공식 문서로 다시 확인한다.
   - 새 계정엔 `workers.dev` 서브도메인이 없다. 대시보드 Workers 화면을 처음 열면 자동으로 만들어지는데
     이름이 마음대로 정해지므로, 그 전에 API 로 정했다 (`PUT /accounts/{id}/workers/subdomain`,
     `{"subdomain":"tw-sj-wedding"}`, 인증은 `npx wrangler auth token`).
2. 로그인과 DB 생성:
   ```bash
   cd worker
   npx wrangler login
   npx wrangler d1 create tw-sj-wedding-leaderboard
   ```
   출력된 `database_id` 를 `wrangler.toml` 에 붙여 넣는다 (공개돼도 괜찮은 값).
3. 스키마 적용과 서명 키 등록:
   ```bash
   npx wrangler d1 migrations apply tw-sj-wedding-leaderboard --remote
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))" | npx wrangler secret put HMAC_SECRET
   ```
   서명 키는 저장소에 절대 남기지 않는다 (공개 저장소).
4. 배포: `npx wrangler deploy` → `https://tw-sj-wedding-leaderboard.tw-sj-wedding.workers.dev`.
   서명 키를 넣기 전에는 모든 요청에 `500 misconfigured` 로 닫혀 있다.
5. 게임에 연결: `game/src/config.js` 의 `API_BASE` 에 그 주소를 넣고 저장소 루트에서
   `npm test && npm run build` 후 커밋·푸시.

## 점수 공식을 바꿀 때

`SPEED`·`SCORE`·`TICK_HZ` 를 바꾸면 서버의 상한 검사도 같이 바뀌어야 한다.
`GAME_VERSION` 을 올리고, `wrangler.toml` 의 `CLIENT_VERSIONS` 에 새 버전을 넣어 다시 배포한다
(옛 버전을 지우면 캐시된 옛 게임으로 플레이한 하객의 등록이 `old_client` 로 거부된다).

## 운영 명령

```bash
cd worker
# 순위 보기
npx wrangler d1 execute tw-sj-wedding-leaderboard --remote --command \
  "SELECT nickname, score, character, datetime(updated_at/1000,'unixepoch','+9 hours') AS kst FROM scores ORDER BY score DESC LIMIT 30"
# 수상한 기록 지우기 (닉네임으로)
npx wrangler d1 execute tw-sj-wedding-leaderboard --remote --command "DELETE FROM scores WHERE nickname = '닉네임'"
# 결혼식 1개월 후(2027-03-01) 전체 삭제 — 등록 화면에 안내한 약속
npx wrangler d1 execute tw-sj-wedding-leaderboard --remote --command "DELETE FROM scores; DELETE FROM used_nonces; DELETE FROM submissions"
```

관리용 공개 API 는 만들지 않는다. 수정·삭제는 위 명령으로만 한다.

## 검증 수준

경품이 없어서 기본 수준만 한다 (DECISIONS #32): 서명 토큰·1회 사용, 토큰 발급 후 흐른 시간 대비
플레이 시간(+5초), 그 시간으로 낼 수 있는 최대 점수, 닉네임 규칙, IP 당 분당 10회.
콘솔로 점수를 마구 보내는 건 막지만, 토큰을 받고 오래 기다렸다가 긴 플레이를 주장하는 식의
작정한 조작은 막지 못한다 — 순위표를 보고 위 명령으로 지운다.
