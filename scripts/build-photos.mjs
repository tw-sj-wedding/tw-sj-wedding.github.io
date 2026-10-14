// 캐릭터 선택 카드의 실사 인물 사진: Gemini 누끼 원본(game/assets/src/photos/*.png) → game/assets/photos/*.png
// Gemini 는 투명 배경을 못 내서 분홍 단색 배경으로 준다. 그 색을 빼 투명하게 만들고, 인물만 남겨 잘라 줄인다.
// 사진을 손으로 고치지 않는다 — 어색하면 원본을 다시 뽑는다 (그림과 같은 원칙, DECISIONS #30).
//
//   node scripts/build-photos.mjs       → 결과와 미리보기(눈밭 배경 합성) 경로 출력

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { decodePng, encodePng } from './lib/png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = ['groom', 'bride'];
const KEY_CLEAR = 40;     // 배경색과의 거리가 이보다 가까우면 완전히 투명
const KEY_SOLID = 100;    // 이보다 멀면 완전히 불투명. 사이는 반투명(가장자리)
const MAX_PERSON_H = 400; // 인물 키(px). 카드에서 약 120px × 화면 배율 3 남짓. 원본이 더 작으면 키우지 않는다
const MARGIN = 6;

const dist = (r, g, b, k) => Math.hypot(r - k[0], g - k[1], b - k[2]);

// 가장자리 픽셀의 중앙값 = 배경색
function backgroundColor({ width, height, data }) {
  const ch = [[], [], []];
  const take = (x, y) => { const i = (y * width + x) * 4; for (let c = 0; c < 3; c++) ch[c].push(data[i + c]); };
  for (let x = 0; x < width; x += 4) { take(x, 0); take(x, height - 1); }
  for (let y = 0; y < height; y += 4) { take(0, y); take(width - 1, y); }
  return ch.map((v) => v.sort((a, b) => a - b)[v.length >> 1]);
}

// 배경색을 빼서 알파를 만들고, 반투명 가장자리는 배경색이 섞인 만큼 걷어 낸다 (분홍 테두리 제거)
function keyOut(img, key) {
  const { width, height, data } = img;
  const out = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const i = p * 4;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const a = Math.min(1, Math.max(0, (dist(r, g, b, key) - KEY_CLEAR) / (KEY_SOLID - KEY_CLEAR)));
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) {
      out[i + c] = Math.min(255, Math.max(0, Math.round((data[i + c] - (1 - a) * key[c]) / a)));
    }
    out[i + 3] = Math.round(a * 255);
  }
  return { width, height, data: out };
}

// 가장 큰 덩어리(인물)만 남긴다 — 워터마크(✦)·눈송이 점은 지워진다. 가장자리 반투명은 2px 만큼 살린다
function keepLargest(img) {
  const { width, height, data } = img;
  const label = new Int32Array(width * height).fill(-1);
  let best = { id: -1, size: 0 };
  const stack = [];
  for (let s = 0; s < width * height; s++) {
    if (label[s] !== -1 || data[s * 4 + 3] < 128) continue;
    let size = 0;
    label[s] = s;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      size++;
      const x = p % width, y = (p / width) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (label[q] === -1 && data[q * 4 + 3] >= 128) { label[q] = s; stack.push(q); }
      }
    }
    if (size > best.size) best = { id: s, size };
  }
  const keep = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) {
    if (label[p] !== best.id) continue;
    const x = p % width, y = (p / width) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) keep[ny * width + nx] = 1;
    }
  }
  const out = new Uint8Array(data);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let p = 0; p < width * height; p++) {
    if (!keep[p]) { out.fill(0, p * 4, p * 4 + 4); continue; }
    if (!out[p * 4 + 3]) continue;
    const x = p % width, y = (p / width) | 0;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { img: { width, height, data: out }, box: { x0, y0, x1, y1 } };
}

// 가장자리(투명한 곳에서 EDGE_PX 안쪽) 픽셀의 분홍 기운을 걷는다: R·B 가 둘 다 G 보다 높은 만큼 깎는다.
// 안쪽은 건드리지 않는다 — 신부 장갑 같은 진짜 분홍까지 바뀌지 않게
const EDGE_PX = 2;
function despillEdges(img) {
  const { width, height, data } = img;
  const out = new Uint8Array(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!data[i + 3]) continue;
      let edge = false;
      for (let dy = -EDGE_PX; dy <= EDGE_PX && !edge; dy++) {
        for (let dx = -EDGE_PX; dx <= EDGE_PX; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || data[(ny * width + nx) * 4 + 3] < 128) { edge = true; break; }
        }
      }
      if (!edge) continue;
      const spill = Math.min(data[i], data[i + 2]) - data[i + 1];
      if (spill > 0) { out[i] -= spill; out[i + 2] -= spill; }
    }
  }
  return { width, height, data: out };
}

function crop({ width, data }, x0, y0, w, h) {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 + x, sy = y0 + y;
      if (sx < 0 || sy < 0 || sx >= width) continue;
      const si = (sy * width + sx) * 4;
      if (si + 3 < data.length) out.set(data.subarray(si, si + 4), (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data: out };
}

// 면적 평균 축소 (알파 곱한 채로 섞어 투명한 곳의 색이 번지지 않게)
function downscale(img, scale) {
  if (scale >= 1) return img;
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const out = new Uint8Array(w * h * 4);
  const fx = img.width / w, fy = img.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      let area = 0;
      for (let sy = Math.floor(y * fy); sy < Math.ceil((y + 1) * fy); sy++) {
        const wy = Math.min(sy + 1, (y + 1) * fy) - Math.max(sy, y * fy);
        for (let sx = Math.floor(x * fx); sx < Math.ceil((x + 1) * fx); sx++) {
          const wx = Math.min(sx + 1, (x + 1) * fx) - Math.max(sx, x * fx);
          const i = (sy * img.width + sx) * 4, wgt = wx * wy, a = img.data[i + 3] / 255;
          for (let c = 0; c < 3; c++) acc[c] += img.data[i + c] * a * wgt;
          acc[3] += a * wgt;
          area += wgt;
        }
      }
      const o = (y * w + x) * 4, a = acc[3] / area;
      if (a > 0) for (let c = 0; c < 3; c++) out[o + c] = Math.round(acc[c] / acc[3]);
      out[o + 3] = Math.round(a * 255);
    }
  }
  return { width: w, height: h, data: out };
}

// 미리보기: 눈밭 색 위에 합성해 테두리에 분홍이 남았는지 본다 (2배 확대)
function preview(imgs) {
  const S = 2, gap = 16;
  const W = imgs.reduce((s, i) => s + i.width * S + gap, gap), H = Math.max(...imgs.map((i) => i.height * S)) + gap * 2;
  const out = new Uint8Array(W * H * 4);
  for (let p = 0; p < W * H; p++) out.set([214, 228, 240, 255], p * 4);
  let ox = gap;
  for (const img of imgs) {
    for (let y = 0; y < img.height * S; y++) {
      for (let x = 0; x < img.width * S; x++) {
        const i = (((y / S) | 0) * img.width + ((x / S) | 0)) * 4, a = img.data[i + 3] / 255;
        const o = ((gap + y) * W + ox + x) * 4;
        for (let c = 0; c < 3; c++) out[o + c] = Math.round(img.data[i + c] * a + out[o + c] * (1 - a));
      }
    }
    ox += img.width * S + gap;
  }
  return { width: W, height: H, data: out };
}

export function buildPhoto(src) {
  const key = backgroundColor(src);
  const { img, box } = keepLargest(keyOut(src, key));
  const cut = crop(despillEdges(img), box.x0 - MARGIN, box.y0 - MARGIN, box.x1 - box.x0 + 1 + MARGIN * 2, box.y1 - box.y0 + 1 + MARGIN * 2);
  const personH = box.y1 - box.y0 + 1;
  return { out: downscale(cut, Math.min(1, MAX_PERSON_H / personH)), key, personH };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(path.join(ROOT, 'game/assets/photos'), { recursive: true });
  const outs = [];
  for (const name of NAMES) {
    const src = decodePng(readFileSync(path.join(ROOT, `game/assets/src/photos/${name}.png`)));
    const { out, key, personH } = buildPhoto(src);
    const file = path.join(ROOT, `game/assets/photos/${name}.png`);
    const png = encodePng(out);
    writeFileSync(file, png);
    console.log(`${name}: 배경 rgb(${key.join(',')}), 인물 키 ${personH}px → ${out.width}x${out.height}, ${(png.length / 1024).toFixed(0)}KB`);
    outs.push(out);
  }
  const previewPath = path.join(tmpdir(), 'photos-preview.png');
  writeFileSync(previewPath, encodePng(preview(outs)));
  console.log(`미리보기: ${previewPath}`);
}
