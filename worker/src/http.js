// 응답·CORS 도우미. CORS 는 브라우저 제한일 뿐 보안 수단이 아니다 (검증은 서버가 따로 한다).

export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const list = String(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes('*') || list.includes(origin) ? origin : null;
}

function corsHeaders(origin) {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
  });
}

export function preflight(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export class HttpError extends Error {
  constructor(status, error, extra = {}) {
    super(error);
    this.status = status;
    this.body = { error, ...extra };
  }
}
