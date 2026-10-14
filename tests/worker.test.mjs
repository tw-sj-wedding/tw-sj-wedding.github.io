import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHandler } from '../worker/src/index.js';
import { createD1 } from '../scripts/lib/d1-sqlite.mjs';
import { scoreAtTick } from '../game/src/shared/scoring.js';
import { GAME_VERSION } from '../game/src/config.js';

const ORIGIN = 'https://tw-sj-wedding.github.io';
const T0 = Date.UTC(2026, 10, 1, 3, 0, 0);

function setup() {
  const db = createD1(':memory:');
  db.exec(readFileSync('worker/migrations/0001_init.sql', 'utf8'));
  let now = T0;
  const clock = { advance: (ms) => { now += ms; }, now: () => now };
  const env = {
    DB: db, HMAC_SECRET: 'test-secret-0123456789', ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8123`, CLIENT_VERSIONS: GAME_VERSION,
  };
  const handler = createHandler({ now: clock.now });
  async function call(method, path, body, headers = {}) {
    const res = await handler.fetch(new Request(`https://api.test${path}`, {
      method,
      headers: { Origin: ORIGIN, 'CF-Connecting-IP': '10.0.0.1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }), env);
    const text = await res.text();
    return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : null };
  }
  const token = async () => (await call('POST', '/api/session')).json.token;
  const entry = (tok, over = {}) => ({
    token: tok, playerId: '0123456789abcdef', nickname: '하객1', score: scoreAtTick(1800),
    durationTicks: 1800, character: 'bride', clientVersion: GAME_VERSION, ...over,
  });
  return { call, token, entry, clock, env };
}

test('세션 토큰을 발급한다', async () => {
  const { call } = setup();
  const r = await call('POST', '/api/session');
  assert.equal(r.status, 200);
  assert.match(r.json.token, /^[\w-]+\.[\w-]+$/);
});

test('정상 기록을 등록하면 순위와 최고 기록을 돌려준다', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  const r = await call('POST', '/api/score', entry(tok));
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json, { rank: 1, best: scoreAtTick(1800), improved: true });
});

test('서명을 바꾼 토큰은 bad_token', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  const forged = tok.slice(0, -2) + (tok.endsWith('AA') ? 'BB' : 'AA');
  const r = await call('POST', '/api/score', entry(forged));
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'bad_token');
});

test('3시간이 지난 토큰은 expired', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(3 * 3600_000 + 1000);
  const r = await call('POST', '/api/score', entry(tok));
  assert.equal(r.json.error, 'expired');
});

test('같은 토큰을 두 번 쓰면 replayed', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  assert.equal((await call('POST', '/api/score', entry(tok))).status, 200);
  const again = await call('POST', '/api/score', entry(tok));
  assert.equal(again.status, 409);
  assert.equal(again.json.error, 'replayed');
});

test('닉네임이 거부되면 같은 토큰으로 고쳐서 다시 낼 수 있다', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  const bad = await call('POST', '/api/score', entry(tok, { nickname: '신랑' }));
  assert.deepEqual(bad.json, { error: 'bad_nickname', reason: 'reserved' });
  // 게임 쪽 검사를 건너뛰고 직접 보내도 서버가 같은 규칙으로 막는다
  const rude = await call('POST', '/api/score', entry(tok, { nickname: '씨1발' }));
  assert.deepEqual(rude.json, { error: 'bad_nickname', reason: 'profanity' });
  assert.equal((await call('POST', '/api/score', entry(tok, { nickname: '하객2' }))).status, 200);
});

test('토큰 발급 후 흐른 시간보다 긴 플레이는 too_fast (여유 5초)', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(24_000);                       // 30초 플레이를 24초 만에 → 거부
  assert.equal((await call('POST', '/api/score', entry(tok))).json.error, 'too_fast');
  clock.advance(2_000);                        // 26초 + 여유 5초 >= 30초 → 통과
  assert.equal((await call('POST', '/api/score', entry(tok))).status, 200);
});

test('플레이 시간으로 낼 수 없는 점수는 impossible', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  const r = await call('POST', '/api/score', entry(tok, { score: scoreAtTick(1800) + 1 }));
  assert.equal(r.json.error, 'impossible');
});

test('기존보다 낮은 점수는 저장하지 않고 기존 최고 기록을 돌려준다', async () => {
  const { call, token, entry, clock } = setup();
  const t1 = await token();
  clock.advance(61_000);
  await call('POST', '/api/score', entry(t1, { durationTicks: 3600, score: scoreAtTick(3600) }));
  const t2 = await token();
  clock.advance(31_000);
  const r = await call('POST', '/api/score', entry(t2));
  assert.deepEqual(r.json, { rank: 1, best: scoreAtTick(3600), improved: false });
});

test('순위: 점수 내림차순, 동점이면 먼저 등록한 쪽이 위', async () => {
  const { call, token, entry, clock } = setup();
  const submit = async (playerId, ticks) => {
    const tok = await token();
    clock.advance(ticks * 20);
    return (await call('POST', '/api/score', entry(tok, { playerId, durationTicks: ticks, score: scoreAtTick(ticks) }))).json;
  };
  assert.equal((await submit('aaaaaaaaaaaaaaaa', 1200)).rank, 1);
  assert.equal((await submit('bbbbbbbbbbbbbbbb', 1200)).rank, 2);   // 동점, 나중
  assert.equal((await submit('cccccccccccccccc', 2400)).rank, 1);
});

test('리더보드: 상위 20명과 내 순위', async () => {
  const { call, token, entry, clock } = setup();
  for (let i = 0; i < 25; i++) {
    const tok = await token();
    clock.advance(40_000);
    const ticks = 600 + i * 60;
    await call('POST', '/api/score', entry(tok, {
      playerId: i.toString(16).padStart(16, '0'), nickname: `하객${i}`, durationTicks: ticks, score: scoreAtTick(ticks),
      character: i % 2 ? 'groom' : 'bride',
    }));
  }
  const r = await call('GET', '/api/leaderboard?playerId=0000000000000000');
  assert.equal(r.status, 200);
  assert.equal(r.json.top.length, 20);
  assert.deepEqual(Object.keys(r.json.top[0]).sort(), ['character', 'nickname', 'rank', 'score']);
  assert.equal(r.json.top[0].nickname, '하객24');
  assert.equal(r.json.top[0].rank, 1);
  assert.ok(r.json.top.every((row, i, a) => i === 0 || a[i - 1].score >= row.score));
  assert.deepEqual(r.json.me, { rank: 25, score: scoreAtTick(600) });
  const stranger = await call('GET', '/api/leaderboard?playerId=ffffffffffffffff');
  assert.equal(stranger.json.me, null);
});

test('CORS: 허용 오리진에만 ACAO, OPTIONS 는 204', async () => {
  const { call } = setup();
  const ok = await call('POST', '/api/session');
  assert.equal(ok.headers.get('access-control-allow-origin'), ORIGIN);
  const evil = await call('POST', '/api/session', undefined, { Origin: 'https://evil.example' });
  assert.equal(evil.headers.get('access-control-allow-origin'), null);
  const pre = await call('OPTIONS', '/api/score', undefined, { 'Access-Control-Request-Method': 'POST' });
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-methods') ?? '', /POST/);
});

test('같은 IP에서 분당 10번을 넘으면 429, 다른 IP는 영향 없음', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  for (let i = 0; i < 10; i++) {
    const r = await call('POST', '/api/score', entry(tok, { nickname: '신랑' }));   // 실패해도 횟수에 든다
    assert.notEqual(r.status, 429, `${i + 1}번째에 막힘`);
  }
  const blocked = await call('POST', '/api/score', entry(tok));
  assert.equal(blocked.status, 429);
  assert.equal(blocked.json.error, 'rate_limited');
  const other = await call('POST', '/api/score', entry(tok), { 'CF-Connecting-IP': '10.0.0.2' });
  assert.equal(other.status, 200);
  clock.advance(61_000);
  const t2 = await token();
  clock.advance(31_000);
  assert.notEqual((await call('POST', '/api/score', entry(t2))).status, 429, '1분 뒤에도 막힘');
});

test('입력 형식이 틀리면 bad_request, 너무 크면 too_large', async () => {
  const { call, token, entry, clock } = setup();
  assert.equal((await call('POST', '/api/score', '{not json')).json.error, 'bad_request');
  const tok = await token();
  clock.advance(31_000);
  for (const over of [{ durationTicks: 1.5 }, { score: -1 }, { character: 'dino' }, { playerId: 'x' }]) {
    assert.equal((await call('POST', '/api/score', entry(tok, over))).json.error, 'bad_request', JSON.stringify(over));
  }
  const big = await call('POST', '/api/score', JSON.stringify({ pad: 'x'.repeat(5000) }));
  assert.equal(big.status, 413);
});

test('허용되지 않은 클라이언트 버전은 old_client', async () => {
  const { call, token, entry, clock } = setup();
  const tok = await token();
  clock.advance(31_000);
  assert.equal((await call('POST', '/api/score', entry(tok, { clientVersion: '1.0.0' }))).json.error, 'old_client');
});

test('없는 경로는 404', async () => {
  const { call } = setup();
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('서명 키가 설정되지 않았으면 토큰을 발급하지 않는다 (fail closed)', async () => {
  // `wrangler secret put HMAC_SECRET` 을 빼먹고 배포하면 "undefined" 로 서명돼 누구나 위조할 수 있다
  for (const secret of [undefined, '', 'short']) {
    const { call, env } = setup();
    env.HMAC_SECRET = secret;
    const r = await call('POST', '/api/session');
    assert.equal(r.status, 500, `secret=${secret}`);
    assert.equal(r.json.error, 'misconfigured');
    assert.equal(r.json.token, undefined);
  }
});
