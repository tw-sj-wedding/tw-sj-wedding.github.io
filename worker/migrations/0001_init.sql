-- 하객 리더보드. playerId(폰에 저장된 익명 ID)당 최고 기록 1개.
CREATE TABLE IF NOT EXISTS scores (
  player_id      TEXT PRIMARY KEY,
  nickname       TEXT NOT NULL,
  score          INTEGER NOT NULL,
  character      TEXT NOT NULL,          -- 'groom' | 'bride'
  duration_ticks INTEGER NOT NULL,
  client_version TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_rank ON scores (score DESC, updated_at ASC);

-- 세션 토큰 1회 사용 기록
CREATE TABLE IF NOT EXISTS used_nonces (
  nonce   TEXT PRIMARY KEY,
  used_at INTEGER NOT NULL
);

-- 등록 시도 횟수 제한 (IP 는 salt 해시로만 남긴다)
CREATE TABLE IF NOT EXISTS submissions (
  ip_hash TEXT NOT NULL,
  at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_submissions ON submissions (ip_hash, at);
