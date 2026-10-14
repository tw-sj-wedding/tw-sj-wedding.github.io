// 세션 토큰: base64url(JSON {iat, n}) + "." + base64url(HMAC-SHA256).
// DB 쓰기 없이 발급하고, 서명으로 위조를 막는다. 1회 사용은 used_nonces 가 막는다.

const enc = new TextEncoder();

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

const keyCache = new Map();
async function hmacKey(secret) {
  if (!keyCache.has(secret)) {
    keyCache.set(secret, crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']));
  }
  return keyCache.get(secret);
}

export function newNonce() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

export async function signToken(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken(secret, token) {
  if (typeof token !== 'string' || token.length > 300) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(parts[1]), enc.encode(parts[0]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    if (!Number.isSafeInteger(payload.iat) || typeof payload.n !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashIp(secret, ip) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${secret}:${ip}`));
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
