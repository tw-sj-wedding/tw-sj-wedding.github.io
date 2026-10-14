// Cloudflare D1 의 API 모양을 node:sqlite 위에 흉내 낸다.
// Worker 코드를 고치지 않고 테스트와 로컬 실행(scripts/dev-api.mjs)에서 실제 SQL로 돌리기 위해서다.
// 쓰는 범위: prepare(sql).bind(...).first()/all()/run(), exec(sql).

import { DatabaseSync } from 'node:sqlite';

function statement(db, sql, args) {
  return {
    bind: (...next) => statement(db, sql, next),
    async first(column) {
      const row = db.prepare(sql).get(...args);
      if (row === undefined) return null;
      return column ? row[column] : { ...row };
    },
    async all() {
      return { results: db.prepare(sql).all(...args).map((r) => ({ ...r })), success: true };
    },
    async run() {
      const info = db.prepare(sql).run(...args);
      return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
    },
  };
}

export function createD1(path = ':memory:') {
  const db = new DatabaseSync(path);
  return {
    prepare: (sql) => statement(db, sql, []),
    exec: (sql) => { db.exec(sql); },
  };
}
