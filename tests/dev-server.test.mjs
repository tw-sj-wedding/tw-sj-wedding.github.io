import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevServer } from '../scripts/dev-server.mjs';

async function withServer(fn) {
  const server = createDevServer();
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { await new Promise((res) => server.close(res)); }
}

test('모든 응답에 no-store가 붙는다', async () => {
  // 개발 서버가 캐시를 허용하면 ES 모듈의 옛 사본이 재사용되어
  // 편집이 반영되지 않고, 존재하지 않는 버그를 쫓게 된다.
  await withServer(async (base) => {
    for (const path of ['/game/dev.html', '/game/src/main.js', '/game/src/sim/stage1.js']) {
      const res = await fetch(base + path);
      assert.equal(res.status, 200, `${path} 가 200이 아님`);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/, `${path} 에 no-store 없음`);
    }
  });
});

test('자바스크립트 모듈을 올바른 MIME으로 준다', async () => {
  // text/javascript가 아니면 브라우저가 type="module" 로드를 거부한다.
  await withServer(async (base) => {
    const res = await fetch(base + '/game/src/main.js');
    assert.match(res.headers.get('content-type') ?? '', /javascript/);
  });
});

test('없는 경로는 404를 준다', async () => {
  await withServer(async (base) => {
    assert.equal((await fetch(base + '/game/없는파일.js')).status, 404);
  });
});

test('저장소 밖 경로를 읽을 수 없다', async () => {
  await withServer(async (base) => {
    const res = await fetch(base + '/../../../etc/passwd', { redirect: 'manual' });
    assert.ok(res.status >= 400, `저장소 밖이 ${res.status}로 열림`);
  });
});
