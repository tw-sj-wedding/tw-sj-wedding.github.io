// 리더보드 Worker 호출. 실패는 전부 값으로 돌려준다 (예외 없음) —
// 서버가 죽거나 느려도 게임은 그대로 하고 등록만 실패를 안내한다.

const LOCAL_API = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

// 개발용 ?api=http://localhost:8787 덮어쓰기. 남의 서버로 닉네임이 새지 않게 로컬 주소만 받는다.
export function resolveApiBase(configured, search) {
  const override = new URLSearchParams(search).get('api');
  return override && LOCAL_API.test(override) ? override : configured;
}

export function createApi(base, { fetchImpl = (...a) => fetch(...a), timeoutMs = 5000 } = {}) {
  const root = String(base ?? '').replace(/\/+$/, '');
  const enabled = root.length > 0;

  async function request(path, init = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${root}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      });
      let body = null;
      try { body = await res.json(); } catch { /* 본문 없음 */ }
      return { status: res.status, body };
    } catch {
      return { status: 0, body: null };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    enabled,

    async getToken() {
      if (!enabled) return null;
      const r = await request('/api/session', { method: 'POST' });
      return r.status === 200 && typeof r.body?.token === 'string' ? r.body.token : null;
    },

    async submit(payload) {
      if (!enabled) return { ok: false, error: 'disabled' };
      const r = await request('/api/score', { method: 'POST', body: JSON.stringify(payload) });
      if (r.status === 200 && r.body) return { ok: true, rank: r.body.rank, best: r.body.best, improved: r.body.improved };
      if (r.status === 0) return { ok: false, error: 'network' };
      const out = { ok: false, error: r.body?.error ?? 'server' };
      if (r.body?.reason) out.reason = r.body.reason;
      return out;
    },

    async board(playerId) {
      if (!enabled) return null;
      const r = await request(`/api/leaderboard?playerId=${encodeURIComponent(playerId)}`, { method: 'GET' });
      return r.status === 200 && Array.isArray(r.body?.top) ? { top: r.body.top, me: r.body.me ?? null } : null;
    },
  };
}
