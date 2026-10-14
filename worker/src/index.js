// 하객 리더보드 Worker (Cloudflare Workers + D1).
//
//   POST /api/session      → { token }                     판 시작 전에 받아 둔다. DB 쓰기 없음
//   POST /api/score        → { rank, best, improved }      게임오버 후 하객이 원할 때만
//   GET  /api/leaderboard  → { top: [...20], me }
//
// 검증은 기본 수준(경품 없음, DECISIONS #32): 서명·만료·1회 사용, 토큰 발급 후 흐른 시간 대비
// 플레이 시간, 그 시간으로 낼 수 있는 최대 점수. 작정한 조작까지 막지는 않는다 — 수상한 기록은
// `wrangler d1 execute` 로 지운다. 관리용 공개 엔드포인트는 만들지 않는다.

import { scoreAtTick } from '../../game/src/shared/scoring.js';
import { validateNickname } from '../../game/src/shared/nickname.js';
import { signToken, verifyToken, newNonce, hashIp } from './token.js';
import { allowedOrigin, json, preflight, HttpError } from './http.js';

const TOKEN_TTL_MS = 3 * 3600_000;
const TIME_SLACK_SEC = 5;
const TICK_HZ = 60;
const MAX_BODY = 2048;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
const TOP_N = 20;
const CACHE_KEY = 'https://leaderboard.cache/top';
const CACHE_SEC = 30;
const CHARACTERS = ['groom', 'bride'];
const PLAYER_ID = /^[0-9a-f-]{16,64}$/;

const isInt = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max;
const edgeCache = () => (typeof caches !== 'undefined' && caches.default ? caches.default : null);

async function readJson(request) {
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > MAX_BODY) throw new HttpError(413, 'too_large');
  const text = await request.text();
  if (text.length > MAX_BODY) throw new HttpError(413, 'too_large');
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object') throw new Error();
    return body;
  } catch {
    throw new HttpError(400, 'bad_request');
  }
}

async function rateLimit(env, request, now) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const ipHash = await hashIp(env.HMAC_SECRET, ip);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS c FROM submissions WHERE ip_hash = ? AND at > ?')
    .bind(ipHash, now - RATE_WINDOW_MS).first('c');
  if (recent >= RATE_MAX) throw new HttpError(429, 'rate_limited');
  await env.DB.prepare('INSERT INTO submissions (ip_hash, at) VALUES (?, ?)').bind(ipHash, now).run();
  await env.DB.prepare('DELETE FROM submissions WHERE at < ?').bind(now - 3600_000).run();
}

async function rankOf(env, score, updatedAt) {
  const above = await env.DB.prepare(
    'SELECT COUNT(*) AS c FROM scores WHERE score > ?1 OR (score = ?1 AND updated_at < ?2)',
  ).bind(score, updatedAt).first('c');
  return above + 1;
}

async function handleSession(env, now) {
  return { token: await signToken(env.HMAC_SECRET, { iat: now, n: newNonce() }) };
}

async function handleScore(env, request, now) {
  await rateLimit(env, request, now);
  const b = await readJson(request);

  if (typeof b.token !== 'string' || !PLAYER_ID.test(b.playerId ?? '') || !CHARACTERS.includes(b.character)
    || !isInt(b.durationTicks, 1, (TOKEN_TTL_MS / 1000) * TICK_HZ) || !isInt(b.score, 0, 10_000_000)
    || typeof b.clientVersion !== 'string') {
    throw new HttpError(400, 'bad_request');
  }

  const token = await verifyToken(env.HMAC_SECRET, b.token);
  if (!token) throw new HttpError(400, 'bad_token');
  if (now - token.iat > TOKEN_TTL_MS || token.iat > now + 60_000) throw new HttpError(400, 'expired');

  const versions = String(env.CLIENT_VERSIONS ?? '').split(',').map((s) => s.trim());
  if (!versions.includes(b.clientVersion)) throw new HttpError(400, 'old_client');

  if (b.durationTicks / TICK_HZ > (now - token.iat) / 1000 + TIME_SLACK_SEC) throw new HttpError(400, 'too_fast');
  if (b.score > scoreAtTick(b.durationTicks)) throw new HttpError(400, 'impossible');

  const nick = validateNickname(b.nickname);
  if (!nick.ok) throw new HttpError(400, 'bad_nickname', { reason: nick.reason });

  // 모든 검증을 통과한 뒤에만 토큰을 소모한다 — 닉네임이 거부돼도 고쳐서 다시 낼 수 있게
  const used = await env.DB.prepare('INSERT OR IGNORE INTO used_nonces (nonce, used_at) VALUES (?, ?)')
    .bind(token.n, now).run();
  if (used.meta.changes === 0) throw new HttpError(409, 'replayed');

  const upsert = await env.DB.prepare(`
    INSERT INTO scores (player_id, nickname, score, character, duration_ticks, client_version, created_at, updated_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
    ON CONFLICT(player_id) DO UPDATE SET
      nickname = excluded.nickname, score = excluded.score, character = excluded.character,
      duration_ticks = excluded.duration_ticks, client_version = excluded.client_version,
      updated_at = excluded.updated_at
    WHERE excluded.score > scores.score
  `).bind(b.playerId, nick.value, b.score, b.character, b.durationTicks, b.clientVersion, now).run();
  const improved = upsert.meta.changes > 0;
  if (improved) await edgeCache()?.delete(CACHE_KEY);

  const best = await env.DB.prepare('SELECT score, updated_at FROM scores WHERE player_id = ?').bind(b.playerId).first();
  return { rank: await rankOf(env, best.score, best.updated_at), best: best.score, improved };
}

async function topRows(env) {
  const cache = edgeCache();
  const hit = await cache?.match(CACHE_KEY);
  if (hit) return hit.json();
  const { results } = await env.DB.prepare(
    'SELECT nickname, score, character FROM scores ORDER BY score DESC, updated_at ASC LIMIT ?',
  ).bind(TOP_N).all();
  const top = results.map((r, i) => ({ rank: i + 1, nickname: r.nickname, score: r.score, character: r.character }));
  await cache?.put(CACHE_KEY, new Response(JSON.stringify(top), { headers: { 'Cache-Control': `max-age=${CACHE_SEC}` } }));
  return top;
}

async function handleLeaderboard(env, url) {
  const top = await topRows(env);
  const playerId = url.searchParams.get('playerId') ?? '';
  let me = null;
  if (PLAYER_ID.test(playerId)) {
    const row = await env.DB.prepare('SELECT score, updated_at FROM scores WHERE player_id = ?').bind(playerId).first();
    if (row) me = { rank: await rankOf(env, row.score, row.updated_at), score: row.score };
  }
  return { top, me };
}

export function createHandler({ now = () => Date.now() } = {}) {
  return {
    async fetch(request, env) {
      const origin = allowedOrigin(request, env);
      const url = new URL(request.url);
      if (request.method === 'OPTIONS') return preflight(origin);
      // 서명 키 없이 배포되면 "undefined" 로 서명돼 누구나 토큰을 위조할 수 있다 — 열지 말고 닫는다
      if (typeof env.HMAC_SECRET !== 'string' || env.HMAC_SECRET.length < 16) {
        console.error('HMAC_SECRET 이 없거나 너무 짧습니다: npx wrangler secret put HMAC_SECRET');
        return json({ error: 'misconfigured' }, 500, origin);
      }
      try {
        const t = now();
        if (url.pathname === '/api/session' && request.method === 'POST') return json(await handleSession(env, t), 200, origin);
        if (url.pathname === '/api/score' && request.method === 'POST') return json(await handleScore(env, request, t), 200, origin);
        if (url.pathname === '/api/leaderboard' && request.method === 'GET') return json(await handleLeaderboard(env, url), 200, origin);
        return json({ error: 'not_found' }, 404, origin);
      } catch (e) {
        if (e instanceof HttpError) return json(e.body, e.status, origin);
        console.error(e);
        return json({ error: 'server' }, 500, origin);
      }
    },
  };
}

export default createHandler();
