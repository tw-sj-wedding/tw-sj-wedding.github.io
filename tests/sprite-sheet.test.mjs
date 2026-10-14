import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodePng } from '../scripts/lib/png.mjs';
import {
  detectGrid, toCells, quantize, splitFrames, packFrame, buildSheet, FRAME_NAMES,
} from '../scripts/lib/sprite-sheet.mjs';

// ---------- 합성 이미지 ----------
// 원본 격자 40x24 를 칸 3.75px·오프셋 1.3px 로 확대하고, Gemini처럼 칸 경계를 흐리게 섞는다.
const NATIVE_W = 40, NATIVE_H = 24, PITCH = 3.75, OFF = 1.3;
const MAGENTA = [255, 0, 255];
const A_COLORS = [[30, 30, 80], [240, 240, 240], [90, 60, 40]];

function nativeGrid() {
  const g = Array.from({ length: NATIVE_H }, () => Array(NATIVE_W).fill(null));
  // 덩어리 A: 무늬가 있어 칸 경계가 많다 (격자 검출의 재료)
  for (let y = 4; y < 16; y++) for (let x = 3; x < 11; x++) g[y][x] = A_COLORS[(x + 2 * y) % 3];
  // 덩어리 B: 회색 몸통 + 아래 두 줄은 넓은 보드
  for (let y = 6; y < 14; y++) for (let x = 18; x < 23; x++) g[y][x] = [150, 150, 150];
  for (let y = 14; y < 16; y++) for (let x = 16; x < 26; x++) g[y][x] = [20, 120, 40];
  // 잡티(워터마크 흉내): 2칸, 프레임에서 8칸보다 멀리 떨어짐
  g[21][38] = [250, 220, 250];
  g[22][38] = [250, 220, 250];
  return g;
}

function synthImage(g, blur = 0.4) {
  const width = Math.ceil(OFF + NATIVE_W * PITCH) + 2;
  const height = Math.ceil(OFF + NATIVE_H * PITCH) + 2;
  const data = new Uint8Array(width * height * 4);
  const cellAt = (cx, cy) => (cx < 0 || cy < 0 || cx >= NATIVE_W || cy >= NATIVE_H ? null : g[cy][cx]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5 - OFF) / PITCH, fy = (y + 0.5 - OFF) / PITCH;
      const cx = Math.floor(fx), cy = Math.floor(fy);
      let c = cellAt(cx, cy) ?? MAGENTA;
      // 경계 blur px 안쪽이면 이웃 칸과 50:50 으로 섞는다
      const nearX = (fx - cx) * PITCH < blur ? -1 : (cx + 1 - fx) * PITCH < blur ? 1 : 0;
      const nearY = (fy - cy) * PITCH < blur ? -1 : (cy + 1 - fy) * PITCH < blur ? 1 : 0;
      if (nearX || nearY) {
        const n = cellAt(cx + nearX, cy + nearY) ?? MAGENTA;
        c = c.map((v, i) => (v + n[i]) >> 1);
      }
      data.set([...c, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

const g = nativeGrid();
const img = synthImage(g);

test('격자 칸 크기와 오프셋을 찾는다', () => {
  const grid = detectGrid(img);
  assert.ok(Math.abs(grid.pitchX - PITCH) < 0.01, `pitchX ${grid.pitchX}`);
  assert.ok(Math.abs(grid.pitchY - PITCH) < 0.01, `pitchY ${grid.pitchY}`);
  assert.ok(Math.abs(grid.offX - OFF) < 0.3, `offX ${grid.offX}`);
  assert.ok(Math.abs(grid.offY - OFF) < 0.3, `offY ${grid.offY}`);
});

test('원본 격자를 칸 단위로 정확히 복원한다', () => {
  const cells = toCells(img, detectGrid(img));
  assert.ok(cells.w >= NATIVE_W && cells.h >= NATIVE_H, `격자 ${cells.w}x${cells.h}`);
  for (let y = 0; y < NATIVE_H; y++) {
    for (let x = 0; x < NATIVE_W; x++) {
      const i = (y * cells.w + x) * 4;
      const got = [...cells.data.slice(i, i + 4)];
      const want = g[y][x] ? [...g[y][x], 255] : null;
      if (want) assert.deepEqual(got, want, `칸 (${x},${y})`);
      else assert.equal(got[3], 0, `칸 (${x},${y}) 는 투명이어야 함, 실제 ${got}`);
    }
  }
});

test('경계의 분홍 번짐이 결과에 남지 않는다', () => {
  const cells = toCells(img, detectGrid(img));
  for (let i = 0; i < cells.data.length; i += 4) {
    if (cells.data[i + 3] === 0) continue;
    const [r, gg, b] = cells.data.slice(i, i + 3);
    const pinkish = r - gg > 60 && b - gg > 60 && !(r > 240 && gg > 200 && b > 240);
    assert.ok(!pinkish, `분홍 칸 발견: ${r},${gg},${b}`);
  }
});

test('넓은 번짐(0.9px)에도 마젠타 기운이 도는 칸이 남지 않는다', () => {
  // 실제 Gemini 출력은 경계가 1px 가까이 흐리다. 어두운 외곽선 + 마젠타 = 보라색 칸이 생기면 안 된다.
  // 격자 검출은 위 테스트가 본다. 여기서는 색 분류만 보려고 정답 격자를 준다
  // (대칭으로 0.9px 흐린 합성 이미지는 경계가 반 칸 간격 이중선이 되어 검출 재료로는 비현실적이다).
  const wide = synthImage(g, 0.9);
  const cells = toCells(wide, { pitchX: PITCH, offX: OFF, pitchY: PITCH, offY: OFF });
  for (let i = 0; i < cells.data.length; i += 4) {
    if (cells.data[i + 3] === 0) continue;
    const [r, gg, b] = cells.data.slice(i, i + 3);
    assert.ok(!(Math.min(r, b) - gg > 45 && Math.abs(r - b) < 70), `보라·분홍 칸: ${r},${gg},${b} @${(i / 4) % cells.w},${Math.floor(i / 4 / cells.w)}`);
  }
  // 외곽선이 깎여 나가지 않는다 — 덩어리 A의 왼쪽 위 모서리 칸이 살아 있다
  assert.equal(cells.data[(4 * cells.w + 3) * 4 + 3], 255);
});

test('색은 maxColors 이하로 줄어든다', () => {
  const cells = toCells(img, detectGrid(img));
  const q = quantize(cells, 3);
  const colors = new Set();
  for (let i = 0; i < q.data.length; i += 4) if (q.data[i + 3]) colors.add(q.data.slice(i, i + 3).join());
  assert.ok(colors.size <= 3, `색 ${colors.size}개`);
});

test('프레임을 x순으로 나누고 잡티는 버린다', () => {
  const frames = splitFrames(toCells(img, detectGrid(img)), 2);
  assert.equal(frames.length, 2);
  assert.deepEqual([frames[0].x, frames[0].w, frames[0].h], [3, 8, 12]);
  assert.deepEqual([frames[1].x, frames[1].w, frames[1].h], [16, 10, 10]);
});

test('보드 끝이 맞닿은 두 프레임은 가장 얇은 열에서 자른다', () => {
  // Gemini가 이웃 프레임의 보드 끝을 붙여 그리는 경우가 실제로 있다 (신부 숙이기 1·2)
  const touching = nativeGrid().map((row) => [...row]);
  for (let x = 1; x <= 12; x++) touching[15][x] = [20, 120, 40];   // A 아래에 보드
  for (let x = 13; x < 16; x++) touching[15][x] = [20, 120, 40];   // B 보드를 왼쪽으로 늘려 맞닿게
  const t = synthImage(touching);
  const frames = splitFrames(toCells(t, detectGrid(t)), 2);
  assert.equal(frames.length, 2);
  assert.ok(frames[0].x <= 3 && frames[0].x + frames[0].w <= 16, `왼쪽 프레임 ${frames[0].x}+${frames[0].w}`);
  assert.ok(frames[1].x >= 11 && frames[1].x + frames[1].w === 26, `오른쪽 프레임 ${frames[1].x}+${frames[1].w}`);
  assert.equal(frames.splits.length, 1, '자른 기록이 남아야 함');
});

test('프레임 개수가 기대와 다르면 진단과 함께 실패한다', () => {
  assert.throws(() => splitFrames(toCells(img, detectGrid(img)), 3), /프레임/);
});

test('프레임은 64칸 바닥에 붙고, 보드 기준이면 보드가 가운데다', () => {
  const [, b] = splitFrames(toCells(img, detectGrid(img)), 2);
  const { data } = packFrame(b, 64, 'board');
  const opaque = (x, y) => data[(y * 64 + x) * 4 + 3] > 0;
  const bottom = [...Array(64).keys()].filter((x) => opaque(x, 63));
  assert.ok(bottom.length > 0, '맨 아래 줄이 비어 있음');
  const center = (bottom[0] + bottom.at(-1) + 1) / 2;
  assert.ok(Math.abs(center - 32) <= 0.5, `보드 중심 ${center}`);
});

test('64칸보다 큰 프레임은 실패한다', () => {
  const big = { x: 0, y: 0, w: 65, h: 10, data: new Uint8Array(65 * 10 * 4) };
  assert.throws(() => packFrame(big, 64, 'bbox'), /64/);
});

// ---------- 실제 Gemini 원본 ----------
let cached;
const getReal = () => cached ??= buildSheet([
  { name: 'groom', img: decodePng(readFileSync('game/assets/src/groom.png')) },
  { name: 'bride', img: decodePng(readFileSync('game/assets/src/bride.png')) },
]);

test('실제 원본: 캐릭터마다 프레임 6개, 모두 64칸 안', () => {
  assert.deepEqual(FRAME_NAMES, ['run1', 'run2', 'jump', 'duck1', 'duck2', 'crash']);
  for (const r of getReal().report) {
    assert.equal(r.frames.length, 6, `${r.name} 프레임 ${r.frames.length}개`);
    for (const f of r.frames) assert.ok(f.w <= 64 && f.h <= 64, `${r.name} ${f.name} ${f.w}x${f.h}`);
  }
});

test('실제 원본: 칸 크기 3.75±0.1, 서 있는 키 50~60, 숙이면 8칸 이상 낮다', () => {
  for (const r of getReal().report) {
    assert.ok(Math.abs(r.pitch - 3.75) <= 0.1, `${r.name} 칸 ${r.pitch}`);
    const [run1, , , duck1] = r.frames;
    assert.ok(run1.h >= 50 && run1.h <= 60, `${r.name} 서 있는 키 ${run1.h}`);
    assert.ok(duck1.h <= run1.h - 8, `${r.name} 숙인 키 ${duck1.h} vs ${run1.h}`);
  }
});

test('실제 원본: 시트는 384x128 이고 JSON이 행과 프레임을 설명한다', () => {
  const real = getReal();
  const sheet = decodePng(real.png);
  assert.equal(sheet.width, 384);
  assert.equal(sheet.height, 128);
  assert.deepEqual(real.json.rows, { groom: 0, bride: 1 });
  assert.equal(real.json.frame, 64);
  assert.deepEqual(real.json.frames, FRAME_NAMES);
});
