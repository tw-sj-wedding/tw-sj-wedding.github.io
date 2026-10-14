// 리더보드 Worker 를 Cloudflare 없이 로컬에서 돌린다 (node:sqlite 로 D1 흉내).
// Worker 코드는 그대로 쓴다 — 여기서 확인한 동작이 배포 후 동작과 같다.
//
//   npm run dev:api                      http://localhost:8787 (메모리 DB, 끄면 사라짐)
//   DB_PATH=/tmp/lb.db npm run dev:api   파일 DB
//
// 게임 쪽은 http://localhost:8123/game/dev.html?api=http://localhost:8787 로 연다.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worker from '../worker/src/index.js';
import { createD1 } from './lib/d1-sqlite.mjs';
import { GAME_VERSION } from '../game/src/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createDevApi({ dbPath = ':memory:' } = {}) {
  const db = createD1(dbPath);
  db.exec(readFileSync(path.join(ROOT, 'worker/migrations/0001_init.sql'), 'utf8'));
  const env = { DB: db, HMAC_SECRET: 'dev-secret-not-for-production', ALLOWED_ORIGINS: '*', CLIENT_VERSIONS: GAME_VERSION };

  return createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    headers.set('CF-Connecting-IP', req.socket.remoteAddress ?? 'local');
    const body = chunks.length && req.method !== 'GET' && req.method !== 'HEAD' ? Buffer.concat(chunks) : undefined;
    const response = await worker.fetch(new Request(`http://localhost${req.url}`, { method: req.method, headers, body }), env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8787;
  createDevApi({ dbPath: process.env.DB_PATH ?? ':memory:' }).listen(port, () => {
    console.log(`\n  리더보드 로컬 API  http://localhost:${port}`);
    console.log(`  게임에서 쓰기      http://localhost:8123/game/dev.html?api=http://localhost:${port}\n`);
  });
}
