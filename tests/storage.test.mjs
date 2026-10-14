import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../game/src/storage.js';

function memoryBackend() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    raw: m,
  };
}

const throwing = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); },
};

test('저장소가 막혀 있어도 예외 없이 기본값으로 동작한다', () => {
  // 카톡 인앱·사생활 모드에서 localStorage 접근이 throw 하는 경우
  const s = createStorage(throwing);
  assert.equal(s.getHi(), 0);
  assert.doesNotThrow(() => s.setHi(120));
  assert.equal(s.getCharacter(), null);
  assert.equal(s.getNickname(), '');
  assert.equal(s.hintSeen(), false);
  assert.doesNotThrow(() => s.markHintSeen());
});

test('저장소가 막혀 있어도 playerId는 세션 동안 같다', () => {
  const s = createStorage(throwing);
  const id = s.getPlayerId();
  assert.match(id, /^[0-9a-f-]{16,}$/);
  assert.equal(s.getPlayerId(), id);
});

test('저장소가 아예 없어도(null) 동작한다', () => {
  const s = createStorage(null);
  assert.equal(s.setHi(10), 10);
  assert.equal(s.getHi(), 10);
});

test('HI는 더 클 때만 갱신된다', () => {
  const s = createStorage(memoryBackend());
  assert.equal(s.setHi(50), 50);
  assert.equal(s.setHi(30), 50);
  assert.equal(s.getHi(), 50);
});

test('playerId는 한 번 만들면 다음 방문에도 같다', () => {
  const backend = memoryBackend();
  const first = createStorage(backend).getPlayerId();
  assert.equal(createStorage(backend).getPlayerId(), first);
});

test('깨진 값은 무시한다', () => {
  const backend = memoryBackend();
  backend.setItem('twsj.run.hi', 'abc');
  backend.setItem('twsj.run.character', 'dinosaur');
  const s = createStorage(backend);
  assert.equal(s.getHi(), 0);
  assert.equal(s.getCharacter(), null);
});

test('캐릭터·닉네임·안내 확인을 기억한다', () => {
  const backend = memoryBackend();
  const s = createStorage(backend);
  s.setCharacter('bride');
  s.setNickname('하객1');
  s.markHintSeen();
  const again = createStorage(backend);
  assert.equal(again.getCharacter(), 'bride');
  assert.equal(again.getNickname(), '하객1');
  assert.equal(again.hintSeen(), true);
});
