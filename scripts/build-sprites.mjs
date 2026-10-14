// Gemini 원본(game/assets/src/*.png) → 게임용 스프라이트 시트(game/assets/sprites.png + .json).
// 그림을 바꾸려면 원본을 Gemini에서 다시 뽑아 같은 이름으로 덮어쓰고 이 스크립트를 다시 돌린다.
// 그림을 손으로 고치지 않는다 — 그 길로 들어가면 끝이 없다 (DECISIONS #30).
//
//   node scripts/build-sprites.mjs            시트 생성 + 미리보기(4배, 충돌 상자 표시) 경로 출력

import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng, encodePng } from './lib/png.mjs';
import { buildSheet, FRAME_NAMES, FRAME_SIZE } from './lib/sprite-sheet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHARACTERS = ['groom', 'bride'];
const PITCH_REF = 3.75;      // 첫 생성본의 칸 크기. 다른 그림도 이 밀도여야 한 화면에서 어울린다
const PITCH_TOLERANCE = 0.1;

function preview(sheet, hitbox, birdHighY) {
  const S = 4;
  const W = sheet.width * S, H = sheet.height * S;
  const out = new Uint8Array(W * H * 4);
  const put = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    out.set([r, g, b, 255], (y * W + x) * 4);
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (Math.floor(y / S) * sheet.width + Math.floor(x / S)) * 4;
      put(x, y, sheet.data[i + 3] ? [sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]] : [223, 234, 243]);
    }
  }
  const rect = (x0, y0, x1, y1, color) => {
    for (let x = x0; x <= x1; x++) { put(x, y0, color); put(x, y1, color); }
    for (let y = y0; y <= y1; y++) { put(x0, y, color); put(x1, y, color); }
  };
  for (let row = 0; row < sheet.height / FRAME_SIZE; row++) {
    FRAME_NAMES.forEach((name, col) => {
      const fx = col * FRAME_SIZE * S, fy = row * FRAME_SIZE * S;
      rect(fx, fy, fx + FRAME_SIZE * S - 1, fy + FRAME_SIZE * S - 1, [170, 180, 190]);
      if (!hitbox) return;
      const box = name.startsWith('duck') ? hitbox.duck : hitbox.stand;
      // 게임은 프레임 가운데(x=32)가 충돌 상자 중심, 프레임 바닥이 발이다
      const bx0 = fx + (FRAME_SIZE / 2 - box.w / 2) * S, bx1 = bx0 + box.w * S - 1;
      const by1 = fy + FRAME_SIZE * S - 1, by0 = by1 - box.h * S + 1;
      rect(bx0, by0, bx1, by1, [220, 40, 40]);
      if (name.startsWith('duck') && birdHighY != null) {
        const ly = fy + (FRAME_SIZE - birdHighY) * S;
        for (let x = fx; x < fx + FRAME_SIZE * S; x += 2) put(x, ly, [40, 90, 220]);
      }
    });
  }
  return encodePng({ width: W, height: H, data: out });
}

async function main() {
  const sources = CHARACTERS.map((name) => ({
    name,
    img: decodePng(readFileSync(path.join(ROOT, `game/assets/src/${name}.png`))),
  }));
  const { png, json, report, sheet } = buildSheet(sources);

  writeFileSync(path.join(ROOT, 'game/assets/sprites.png'), png);
  writeFileSync(path.join(ROOT, 'game/assets/sprites.json'), `${JSON.stringify(json, null, 2)}\n`);

  let hitbox = null, birdHighY = null;
  try {
    const config = await import('../game/src/config.js');
    hitbox = config.HITBOX ?? null;
    birdHighY = config.OBSTACLES?.birdHigh?.y ?? null;
  } catch { /* 설정이 없어도 시트는 만든다 */ }
  const previewPath = path.join(tmpdir(), 'tw-sj-sprites-preview.png');
  writeFileSync(previewPath, preview(sheet, hitbox, birdHighY));

  let warned = false;
  for (const r of report) {
    console.log(`${r.name}: 칸 ${r.pitch}px (선명도 ${r.strength}) · ` +
      r.frames.map((f) => `${f.name} ${f.w}x${f.h}`).join(', '));
    if (Math.abs(r.pitch - PITCH_REF) > PITCH_TOLERANCE) {
      console.warn(`  ⚠ 칸 크기가 기준 ${PITCH_REF}±${PITCH_TOLERANCE} 밖입니다. 다른 그림과 픽셀 밀도가 달라 보입니다.`);
      warned = true;
    }
    for (const s of r.splits) console.warn(`  · 맞닿은 프레임을 x=${s.x} 열에서 나눔 (그 열 ${s.cellsInCut}칸)`);
    for (const d of r.dropped) console.warn(`  · 프레임과 먼 덩어리 버림: ${d.size}칸 @(${d.x},${d.y}) — 워터마크로 추정`);
  }
  console.log(`\n시트: game/assets/sprites.png (${sheet.width}x${sheet.height})`);
  console.log(`미리보기: ${previewPath}`);
  if (warned) process.exitCode = 1;
}

await main();
