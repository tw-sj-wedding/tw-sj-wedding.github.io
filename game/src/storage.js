// localStorage 래퍼. 카톡 인앱·사생활 모드에서는 접근 자체가 throw 할 수 있으므로
// 모든 접근을 감싸고, 실패하면 이번 세션 메모리에만 둔다. 저장이 안 된다고 게임이 멈추면 안 된다.

const PREFIX = 'twsj.run.';
const CHARACTERS = ['groom', 'bride'];

function defaultBackend() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function newId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createStorage(backend = defaultBackend()) {
  const memory = new Map();

  const get = (key) => {
    if (memory.has(key)) return memory.get(key);
    try { return backend?.getItem(PREFIX + key) ?? null; } catch { return null; }
  };
  const set = (key, value) => {
    memory.set(key, String(value));
    try { backend?.setItem(PREFIX + key, String(value)); } catch { /* 메모리에만 남는다 */ }
  };

  return {
    getHi() {
      const n = Number.parseInt(get('hi') ?? '', 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    setHi(score) {
      const hi = Math.max(this.getHi(), score | 0);
      set('hi', hi);
      return hi;
    },
    getCharacter() {
      const c = get('character');
      return CHARACTERS.includes(c) ? c : null;
    },
    setCharacter(c) { if (CHARACTERS.includes(c)) set('character', c); },
    getNickname: () => get('nickname') ?? '',
    setNickname: (name) => set('nickname', name),
    getPlayerId() {
      let id = get('playerId');
      if (!id || !/^[0-9a-f-]{16,64}$/.test(id)) {
        id = newId();
        set('playerId', id);
      }
      return id;
    },
    hintSeen: () => get('hintSeen') === '1',
    markHintSeen: () => set('hintSeen', '1'),
  };
}
