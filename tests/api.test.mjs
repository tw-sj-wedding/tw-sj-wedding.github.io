import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, resolveApiBase } from '../game/src/net/api.js';

const reply = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const never = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
const boom = async () => { throw new TypeError('Failed to fetch'); };

test('주소가 없으면 꺼져 있고 네트워크를 쓰지 않는다', async () => {
  let called = false;
  const api = createApi('', { fetchImpl: async () => { called = true; } });
  assert.equal(api.enabled, false);
  assert.equal(await api.getToken(), null);
  assert.deepEqual(await api.submit({}), { ok: false, error: 'disabled' });
  assert.equal(await api.board('x'), null);
  assert.equal(called, false);
});

test('토큰을 받는다 (주소 끝 슬래시는 정리)', async () => {
  let seen;
  const api = createApi('https://lb.example/', { fetchImpl: async (url, init) => { seen = { url, method: init.method }; return reply(200, { token: 'abc.def' })(); } });
  assert.equal(await api.getToken(), 'abc.def');
  assert.deepEqual(seen, { url: 'https://lb.example/api/session', method: 'POST' });
});

test('서버가 응답하지 않으면 시간 제한 뒤 null / network', async () => {
  const api = createApi('https://lb.example', { fetchImpl: never, timeoutMs: 30 });
  assert.equal(await api.getToken(), null);
  assert.deepEqual(await api.submit({ a: 1 }), { ok: false, error: 'network' });
  assert.equal(await api.board('x'), null);
});

test('네트워크 예외는 network 로 바뀐다', async () => {
  const api = createApi('https://lb.example', { fetchImpl: boom });
  assert.equal(await api.getToken(), null);
  assert.deepEqual(await api.submit({}), { ok: false, error: 'network' });
});

test('서버 오류 코드와 사유를 그대로 전달한다', async () => {
  const api = createApi('https://lb.example', { fetchImpl: reply(400, { error: 'bad_nickname', reason: 'reserved' }) });
  assert.deepEqual(await api.submit({}), { ok: false, error: 'bad_nickname', reason: 'reserved' });
});

test('등록 성공과 순위표', async () => {
  const ok = createApi('https://lb.example', { fetchImpl: reply(200, { rank: 3, best: 120, improved: true }) });
  assert.deepEqual(await ok.submit({}), { ok: true, rank: 3, best: 120, improved: true });
  const board = createApi('https://lb.example', { fetchImpl: reply(200, { top: [{ rank: 1 }], me: null }) });
  assert.deepEqual(await board.board('0123456789abcdef'), { top: [{ rank: 1 }], me: null });
});

test('?api= 덮어쓰기는 로컬 주소만 받는다', () => {
  assert.equal(resolveApiBase('', '?api=http://localhost:8787'), 'http://localhost:8787');
  assert.equal(resolveApiBase('', '?api=http://192.168.0.12:8787'), 'http://192.168.0.12:8787');
  assert.equal(resolveApiBase('https://lb.example', '?api=https://evil.example'), 'https://lb.example');
  assert.equal(resolveApiBase('https://lb.example', ''), 'https://lb.example');
});
