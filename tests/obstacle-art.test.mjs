import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickFrame, framePlacement } from '../game/src/render/obstacles.js';
import { OBSTACLES } from '../game/src/config.js';

const frames = [{ x: 0, y: 8, w: 40, h: 19 }, { x: 41, y: 0, w: 37, h: 27 }];

test('그림은 충돌 상자 가로 가운데, 바닥에 맞춰 그린다', () => {
  const o = { type: 'skierDown', x: 1000, y: 0, w: 34, h: 14 };
  assert.deepEqual(framePlacement(o, frames[0]), { dx: -3, dy: -19 });   // (34-40)/2, 바닥 위로 19
  assert.deepEqual(framePlacement(o, frames[1]), { dx: -2, dy: -27 });   // floor((34-37)/2) = -1.5 → -2 (내림)
});

test('한 장애물은 지나가는 동안 같은 그림이고, 장애물마다 그림이 섞인다', () => {
  const at = (x) => pickFrame(frames, { x });
  assert.equal(at(1000), at(1000));
  const seen = new Set([1000, 1001, 1002, 1003].map((x) => at(x)));
  assert.equal(seen.size, 2);
});

test('그림 시트에 있는 장애물은 충돌 상자보다 그림이 작지 않다 (허공에 맞는 일 없음)', () => {
  const json = JSON.parse(readFileSync('game/assets/obstacles.json', 'utf8'));
  for (const [type, list] of Object.entries(json.types)) {
    const box = OBSTACLES[type];
    assert.ok(box, `config 에 없는 장애물 ${type}`);
    for (const f of list) assert.ok(f.w >= box.w && f.h >= box.h, `${type} 그림 ${f.w}x${f.h} < 상자 ${box.w}x${box.h}`);
  }
});
