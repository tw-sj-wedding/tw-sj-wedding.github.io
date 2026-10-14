import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { decodePng, encodePng } from '../scripts/lib/png.mjs';

test('인코드한 RGBA를 디코드하면 바이트가 그대로다', () => {
  const data = Uint8Array.from([
    255, 0, 255, 255,   0, 0, 0, 0,        12, 34, 56, 78,
    1, 2, 3, 4,         200, 100, 50, 255, 9, 9, 9, 128,
  ]);
  const out = decodePng(encodePng({ width: 3, height: 2, data }));
  assert.equal(out.width, 3);
  assert.equal(out.height, 2);
  assert.deepEqual([...out.data], [...data]);
});

// 직접 조립한 PNG — 컬러타입·필터를 우리가 고른다
function rawPng(width, height, colorType, rows) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(tb));
    return Buffer.concat([len, tb, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows.map((r) => Buffer.from(r))))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('RGB(컬러타입 2)는 불투명 RGBA로 디코드된다', () => {
  const png = rawPng(2, 1, 2, [[0, 10, 20, 30, 40, 50, 60]]);
  const out = decodePng(png);
  assert.deepEqual([...out.data], [10, 20, 30, 255, 40, 50, 60, 255]);
});

test('Sub·Up·Average·Paeth 필터를 되돌린다', () => {
  // 2x4 RGB. 각 줄의 필터 바이트가 다르다. 기대값은 손으로 계산했다.
  const png = rawPng(2, 4, 2, [
    [1, 10, 20, 30, 5, 5, 5],          // Sub: 두 번째 픽셀 = 첫 픽셀 + 5
    [2, 1, 1, 1, 2, 2, 2],             // Up: 윗줄 + 값
    [3, 10, 10, 10, 0, 0, 0],          // Average: floor((왼쪽 + 위)/2) + 값
    [4, 0, 0, 0, 0, 0, 0],             // Paeth: 예측값 그대로
  ]);
  const px = (x, y) => [...decodePng(png).data.slice((y * 2 + x) * 4, (y * 2 + x) * 4 + 3)];
  assert.deepEqual(px(0, 0), [10, 20, 30]);
  assert.deepEqual(px(1, 0), [15, 25, 35]);
  assert.deepEqual(px(0, 1), [11, 21, 31]);
  assert.deepEqual(px(1, 1), [17, 27, 37]);
  assert.deepEqual(px(0, 2), [15, 20, 25]);          // floor((0 + 11)/2) + 10 등
  assert.deepEqual(px(1, 2), [16, 23, 31]);          // floor((15 + 17)/2), floor((20 + 27)/2) …
  assert.deepEqual(px(0, 3), [15, 20, 25]);          // Paeth(0, 15, 0) = 15
  assert.deepEqual(px(1, 3), [16, 23, 31]);          // Paeth(왼 15, 위 16, 왼위 15) = 위
});

test('실제 Gemini 원본을 읽는다', () => {
  const out = decodePng(readFileSync('game/assets/src/groom.png'));
  assert.equal(out.width, 896);
  assert.equal(out.height, 1195);
  // 왼쪽 위 모서리는 마젠타 배경이다
  const [r, g, b, a] = out.data.slice(0, 4);
  assert.ok(r > 200 && g < 60 && b > 200 && a === 255, `모서리 색 ${r},${g},${b},${a}`);
});
