// 개발용 정적 서버. 존재 이유는 단 하나 — 캐시를 끄는 것이다.
//
// python3 -m http.server 는 Cache-Control을 보내지 않아서, Chrome이 Last-Modified만 보고
// 휴리스틱 캐시를 적용해 ES 모듈의 옛 사본을 재사용한다. 모듈 일부만 옛 것이면
// 이벤트 핸들러가 붙지 않아 버튼이 죽고, 콘솔에는 아무 에러도 남지 않는다.
// 프로덕션은 해시 파일명이 막아주지만 개발 중에는 이 서버를 쓴다.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

export function createDevServer() {
  return createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      return send(res, 400, '400 Bad Request');
    }

    if (pathname.endsWith('/')) pathname += 'index.html';

    // 저장소 밖으로 나가는 경로는 거부한다
    const filePath = path.join(ROOT, pathname);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      return send(res, 403, '403 Forbidden');
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      return send(res, 404, '404 Not Found');
    }
    if (info.isDirectory()) return send(res, 404, '404 Not Found');

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(res);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8123;
  createDevServer().listen(port, () => {
    console.log(`개발 서버: http://localhost:${port}/game/dev.html  (캐시 없음)`);
    console.log(`청첩장:    http://localhost:${port}/`);
  });
}
