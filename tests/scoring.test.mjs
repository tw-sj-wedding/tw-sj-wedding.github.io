import test from 'node:test';
import assert from 'node:assert/strict';
import { speedAtTick, distanceAtTick, scoreAtTick } from '../game/src/shared/scoring.js';
import { readFileSync } from 'node:fs';
import { SPEED, SCORE, TICK_HZ, GAME_VERSION } from '../game/src/config.js';

const loopDistance = (n) => {
  let d = 0;
  for (let i = 1; i <= n; i++) d += Math.min(SPEED.max, SPEED.start + (SPEED.accel * i) / TICK_HZ) / TICK_HZ;
  return d;
};

test('0틱이면 거리·점수 0, 속도는 출발 속도', () => {
  assert.equal(distanceAtTick(0), 0);
  assert.equal(scoreAtTick(0), 0);
  assert.equal(speedAtTick(0), SPEED.start);
});

test('닫힌 식 거리는 틱별 누적 합과 같다', () => {
  for (const n of [1, 2, 100, 6999, 7000, 7001, 20000, 60000]) {
    assert.ok(Math.abs(distanceAtTick(n) - loopDistance(n)) < 1e-6, `${n}틱: ${distanceAtTick(n)} vs ${loopDistance(n)}`);
  }
});

test('속도는 240에서 1초에 3씩, 상한 없이 계속 오른다 (#27)', () => {
  assert.equal(speedAtTick(TICK_HZ), 243);
  assert.equal(speedAtTick(60 * TICK_HZ), 420);          // 1분
  assert.equal(speedAtTick(600 * TICK_HZ), 2040);        // 10분 — 상한 없음
  for (const n of [7000, 7001, 50000]) assert.ok(speedAtTick(n + 1) > speedAtTick(n), `${n}틱 이후 멈춤`);
});

test('점수 공식이 바뀌면 Worker 허용 버전에도 현재 버전이 있어야 한다', () => {
  // 빠뜨리면 배포된 서버가 새 게임의 등록을 old_client 로 전부 거부한다
  const toml = readFileSync('worker/wrangler.toml', 'utf8');
  const allowed = (toml.match(/^CLIENT_VERSIONS\s*=\s*"([^"]*)"/m)?.[1] ?? '').split(',').map((v) => v.trim());
  assert.ok(allowed.includes(GAME_VERSION), `wrangler.toml CLIENT_VERSIONS(${allowed}) 에 ${GAME_VERSION} 없음`);
  assert.notEqual(GAME_VERSION, '2.0.0', '점수 공식이 바뀌었는데 버전을 안 올림');
});

test('점수 = 거리 / 24 내림, 단조 증가', () => {
  let prev = 0;
  for (let n = 0; n <= 30000; n++) {
    const s = scoreAtTick(n);
    assert.equal(s, Math.floor(distanceAtTick(n) / SCORE.pxPerPoint));
    assert.ok(s >= prev, `${n}틱에서 점수가 줄어듦`);
    prev = s;
  }
});

test('처음엔 1초에 약 10점', () => {
  const s = scoreAtTick(TICK_HZ);
  assert.ok(s >= 9 && s <= 11, `1초 점수 ${s}`);
});
