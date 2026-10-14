// Gemini가 만든 "픽셀아트처럼 보이는 큰 그림"을 진짜 픽셀아트 시트로 바꾼다.
//
// Gemini 출력은 원본 픽셀 한 칸이 정수가 아닌 크기(지금은 3.75px)로 확대돼 있고 칸 경계가 흐리다.
// 그래서 (1) 칸 크기·위치를 재고 (2) 칸마다 대표색 하나를 뽑아 원본 격자를 되살린 뒤
// (3) 프레임별로 잘라 64x64 칸에 맞춘다. 그림 자체는 절대 손대지 않는다 — 어색하면 원본을 다시 뽑는다.

import { encodePng } from './png.mjs';

export const FRAME_NAMES = ['run1', 'run2', 'jump', 'duck1', 'duck2', 'crash'];
// 달리기·숙이기는 보드 중심으로 맞춰야 두 프레임을 번갈아 그릴 때 몸이 떨리지 않는다.
// 점프(기울어진 보드)와 넘어짐(누운 자세)은 보드 기준이 없어 경계상자 중심을 쓴다.
const FRAME_ANCHORS = ['board', 'board', 'bbox', 'board', 'board', 'bbox'];
export const FRAME_SIZE = 64;

const EDGE_DIFF = 60;          // 이웃 픽셀 RGB 차이 합이 이보다 크면 경계로 본다
const MAX_EDGES = 8000;        // 칸 크기 탐색에 쓰는 경계 표본 상한 (속도)
const SAMPLE_MARGIN = 0.6;     // 칸 경계에서 이만큼(px) 떨어진 픽셀만 표본 — 흐린 경계를 피한다
const ATTACH_GAP = 8;          // 이 칸 수 이내의 작은 덩어리는 가까운 프레임에 붙이고, 더 멀면 버린다

const isMagenta = (r, g, b) => r > 180 && b > 180 && g < 90;
// 마젠타가 섞여 든 경계 픽셀 (어두운 외곽선 + 마젠타 = 보라, 밝은 색 + 마젠타 = 분홍).
// 대표색 표본에서 빼야 외곽선에 보라 점이 남지 않는다.
const isTinted = (r, g, b) => Math.min(r, b) - g > 45 && Math.abs(r - b) < 70;

// ---------- 격자 검출 ----------

function collectEdges(img, axis) {
  const { width, height, data } = img;
  const edges = [];
  const diff = (i, j) =>
    Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[j + 1]) + Math.abs(data[i + 2] - data[j + 2]);
  if (axis === 'x') {
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const i = (y * width + x) * 4;
        if (diff(i, i - 4) > EDGE_DIFF) edges.push(x);
      }
    }
  } else {
    for (let x = 0; x < width; x++) {
      for (let y = 1; y < height; y++) {
        const i = (y * width + x) * 4;
        if (diff(i, i - width * 4) > EDGE_DIFF) edges.push(y);
      }
    }
  }
  if (edges.length <= MAX_EDGES) return edges;
  const stride = edges.length / MAX_EDGES;
  return Array.from({ length: MAX_EDGES }, (_, k) => edges[Math.floor(k * stride)]);
}

// 경계 위치들이 주기 p 의 격자에 얼마나 잘 맞는가 (0~1). 위상각이 곧 오프셋이다.
function coherence(edges, p) {
  let c = 0, s = 0;
  const w = (2 * Math.PI) / p;
  for (const e of edges) { c += Math.cos(w * e); s += Math.sin(w * e); }
  return { r: Math.hypot(c, s) / edges.length, phase: Math.atan2(s, c) };
}

function detectAxis(edges, span) {
  if (edges.length < 20) throw new Error('경계가 너무 적어 격자를 찾을 수 없습니다');
  // 탐색 간격은 이미지 폭에서 위상이 1/4바퀴 어긋나는 정도로 — 봉우리를 건너뛰지 않게
  const scan = [];
  for (let p = 2.5; p <= 8; p += (p * p) / (4 * span)) scan.push({ p, r: coherence(edges, p).r });
  const best = Math.max(...scan.map((s) => s.r));
  // p 의 약수(p/2, p/3 …)도 똑같이 잘 맞는다. 충분히 높은 봉우리 중 가장 큰 칸 크기를 고른다.
  let pick = null;
  for (let i = 1; i < scan.length - 1; i++) {
    const s = scan[i];
    if (s.r >= scan[i - 1].r && s.r >= scan[i + 1].r && s.r >= best * 0.85) pick = s;
  }
  pick ??= scan.find((s) => s.r === best);
  // 정밀 탐색
  const step = (pick.p * pick.p) / (4 * span);
  let fine = { p: pick.p, ...coherence(edges, pick.p) };
  for (let p = pick.p - step; p <= pick.p + step; p += step / 20) {
    const c = coherence(edges, p);
    if (c.r > fine.r) fine = { p, ...c };
  }
  const off = (((fine.phase / (2 * Math.PI)) * fine.p) % fine.p + fine.p) % fine.p;
  return { pitch: fine.p, off, strength: fine.r };
}

export function detectGrid(img) {
  const x = detectAxis(collectEdges(img, 'x'), img.width);
  const y = detectAxis(collectEdges(img, 'y'), img.height);
  return { pitchX: x.pitch, offX: x.off, pitchY: y.pitch, offY: y.off, strength: Math.min(x.strength, y.strength) };
}

// ---------- 원본 격자 복원 ----------

function samplePositions(start, pitch, limit) {
  const out = [];
  for (let p = Math.ceil(start + SAMPLE_MARGIN - 0.5); p + 0.5 <= start + pitch - SAMPLE_MARGIN; p++) {
    if (p >= 0 && p < limit) out.push(p);
  }
  if (out.length === 0) {
    const mid = Math.floor(start + pitch / 2);
    if (mid >= 0 && mid < limit) out.push(mid);
  }
  return out;
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
};

export function toCells(img, grid) {
  const w = Math.floor((img.width - grid.offX) / grid.pitchX);
  const h = Math.floor((img.height - grid.offY) / grid.pitchY);
  const data = new Uint8Array(w * h * 4);
  const xs = Array.from({ length: w }, (_, i) => samplePositions(grid.offX + i * grid.pitchX, grid.pitchX, img.width));
  const ys = Array.from({ length: h }, (_, j) => samplePositions(grid.offY + j * grid.pitchY, grid.pitchY, img.height));

  for (let cy = 0; cy < h; cy++) {
    for (let cx = 0; cx < w; cx++) {
      const rs = [], gs = [], bs = [];
      let total = 0, magenta = 0;
      for (const py of ys[cy]) {
        for (const px of xs[cx]) {
          const i = (py * img.width + px) * 4;
          const r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
          total++;
          if (isMagenta(r, g, b)) { magenta++; continue; }
          if (isTinted(r, g, b)) continue;
          rs.push(r); gs.push(g); bs.push(b);
        }
      }
      // 마젠타가 절반 이상이거나, 섞인 픽셀뿐이면 경계 바깥으로 보고 투명
      if (total === 0 || magenta * 2 >= total || rs.length === 0) continue;
      const o = (cy * w + cx) * 4;
      data[o] = median(rs); data[o + 1] = median(gs); data[o + 2] = median(bs); data[o + 3] = 255;
    }
  }
  return { w, h, data };
}

// ---------- 색 정리 ----------

export function quantize(cells, maxColors = 32) {
  const freq = new Map();
  for (let i = 0; i < cells.data.length; i += 4) {
    if (!cells.data[i + 3]) continue;
    const key = (cells.data[i] << 16) | (cells.data[i + 1] << 8) | cells.data[i + 2];
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const colors = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([k]) => k);
  const rgb = (k) => [(k >> 16) & 255, (k >> 8) & 255, k & 255];
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

  let map;
  for (let d = 10; ; d += 4) {
    const palette = [];
    map = new Map();
    for (const k of colors) {
      const c = rgb(k);
      const hit = palette.find((p) => dist2(p, c) <= d * d);
      if (hit) map.set(k, hit);
      else { palette.push(c); map.set(k, c); }
    }
    if (palette.length <= maxColors) break;
  }

  const data = new Uint8Array(cells.data);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const c = map.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2];
  }
  return { w: cells.w, h: cells.h, data };
}

// ---------- 프레임 분리 ----------

function components(cells) {
  const { w, h, data } = cells;
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let start = 0; start < w * h; start++) {
    if (!data[start * 4 + 3] || label[start] !== -1) continue;
    const comp = { cells: [], x0: w, y0: h, x1: -1, y1: -1 };
    const stack = [start];
    label[start] = comps.length;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      comp.cells.push(i);
      if (x < comp.x0) comp.x0 = x; if (x > comp.x1) comp.x1 = x;
      if (y < comp.y0) comp.y0 = y; if (y > comp.y1) comp.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (data[j * 4 + 3] && label[j] === -1) { label[j] = comps.length; stack.push(j); }
        }
      }
    }
    comps.push(comp);
  }
  return comps;
}

const bboxGap = (a, b) => Math.max(0, a.x0 - b.x1 - 1, b.x0 - a.x1 - 1, a.y0 - b.y1 - 1, b.y0 - a.y1 - 1);
const isFrameSized = (c, largest) => c.cells.length * 4 >= largest;

function compFrom(cellList, w) {
  const c = { cells: cellList, x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
  for (const i of cellList) {
    const x = i % w, y = (i - x) / w;
    if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
    if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
  }
  return c;
}

// Gemini는 이웃 프레임의 보드 끝을 맞닿게 그리기도 한다 (신부 숙이기 1·2가 실제로 그렇다).
// 프레임 크기 덩어리가 모자라면, 다른 프레임보다 눈에 띄게 넓은 덩어리를 가운데 구간에서
// 가장 얇은 열(점유 칸이 가장 적은 열)로 자른다. 그림을 고치는 게 아니라 경계를 정하는 것이다.
function splitTouching(comps, w, expected, splits) {
  for (;;) {
    const largest = Math.max(...comps.map((c) => c.cells.length));
    const big = comps.filter((c) => isFrameSized(c, largest));
    if (big.length >= expected) return comps;
    const width = (c) => c.x1 - c.x0 + 1;
    const widest = big.reduce((a, b) => (width(b) > width(a) ? b : a));
    const others = big.filter((c) => c !== widest).map(width).sort((a, b) => a - b);
    if (others.length && width(widest) < others[others.length >> 1] * 1.5) return comps;

    const occ = new Array(width(widest)).fill(0);
    for (const i of widest.cells) occ[(i % w) - widest.x0]++;
    const lo = Math.floor(occ.length * 0.25), hi = Math.ceil(occ.length * 0.75);
    let cut = lo;
    for (let k = lo; k < hi; k++) {
      const closer = Math.abs(k - occ.length / 2) < Math.abs(cut - occ.length / 2);
      if (occ[k] < occ[cut] || (occ[k] === occ[cut] && closer)) cut = k;
    }
    const cutX = widest.x0 + cut;
    const left = widest.cells.filter((i) => i % w <= cutX);
    const right = widest.cells.filter((i) => i % w > cutX);
    splits.push({ x: cutX, cellsInCut: occ[cut] });
    comps = comps.filter((c) => c !== widest).concat([compFrom(left, w), compFrom(right, w)]);
  }
}

export function splitFrames(cells, expected = FRAME_NAMES.length) {
  const splits = [];
  const comps = splitTouching(components(cells), cells.w, expected, splits)
    .sort((a, b) => b.cells.length - a.cells.length);
  const describe = () => comps.slice(0, expected + 3)
    .map((c) => `${c.cells.length}칸@(${c.x0},${c.y0} ${c.x1 - c.x0 + 1}x${c.y1 - c.y0 + 1})`).join(', ');
  if (comps.length < expected) {
    throw new Error(`프레임 ${expected}개를 기대했지만 덩어리가 ${comps.length}개뿐입니다: ${describe()}`);
  }
  const seeds = comps.slice(0, expected);
  const smallest = seeds.at(-1).cells.length;
  if (smallest * 4 < seeds[0].cells.length) {
    throw new Error(`프레임 ${expected}개를 기대했지만 ${expected}번째 덩어리가 너무 작습니다 ` +
      `(프레임끼리 붙어 있거나 프레임 수가 다름): ${describe()}`);
  }

  const dropped = [];
  for (const c of comps.slice(expected)) {
    let best = null, bestGap = Infinity;
    for (const s of seeds) {
      const gap = bboxGap(s, c);
      if (gap < bestGap) { bestGap = gap; best = s; }
    }
    if (bestGap > ATTACH_GAP) { dropped.push({ size: c.cells.length, x: c.x0, y: c.y0 }); continue; }
    best.cells.push(...c.cells);
    best.x0 = Math.min(best.x0, c.x0); best.x1 = Math.max(best.x1, c.x1);
    best.y0 = Math.min(best.y0, c.y0); best.y1 = Math.max(best.y1, c.y1);
  }

  const frames = seeds
    .sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1))
    .map((s) => {
      const fw = s.x1 - s.x0 + 1, fh = s.y1 - s.y0 + 1;
      const data = new Uint8Array(fw * fh * 4);
      for (const i of s.cells) {
        const x = i % cells.w, y = (i - x) / cells.w;
        data.set(cells.data.subarray(i * 4, i * 4 + 4), ((y - s.y0) * fw + (x - s.x0)) * 4);
      }
      return { x: s.x0, y: s.y0, w: fw, h: fh, data };
    });
  frames.dropped = dropped;
  frames.splits = splits;
  return frames;
}

// ---------- 64칸 정렬 ----------

export function packFrame(frame, size = FRAME_SIZE, anchor = 'bbox') {
  if (frame.w > size || frame.h > size) {
    throw new Error(`프레임이 ${size}칸보다 큽니다: ${frame.w}x${frame.h}`);
  }
  let dx = Math.floor((size - frame.w) / 2);
  if (anchor === 'board') {
    let min = frame.w, max = -1;
    for (let y = Math.max(0, frame.h - 2); y < frame.h; y++) {
      for (let x = 0; x < frame.w; x++) {
        if (frame.data[(y * frame.w + x) * 4 + 3]) { if (x < min) min = x; if (x > max) max = x; }
      }
    }
    if (max >= 0) dx = Math.round(size / 2 - (min + max + 1) / 2);
    dx = Math.max(0, Math.min(size - frame.w, dx));
  }
  const dy = size - frame.h;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < frame.h; y++) {
    data.set(frame.data.subarray(y * frame.w * 4, (y + 1) * frame.w * 4), ((y + dy) * size + dx) * 4);
  }
  return { data, dx, dy };
}

// ---------- 시트 ----------

export function buildSheet(sources) {
  const size = FRAME_SIZE;
  const sheetW = size * FRAME_NAMES.length, sheetH = size * sources.length;
  const sheet = new Uint8Array(sheetW * sheetH * 4);
  const report = [];
  const rows = {}, pitch = {};

  sources.forEach(({ name, img }, row) => {
    const grid = detectGrid(img);
    const frames = splitFrames(quantize(toCells(img, grid)), FRAME_NAMES.length);
    frames.forEach((f, col) => {
      const { data } = packFrame(f, size, FRAME_ANCHORS[col]);
      for (let y = 0; y < size; y++) {
        sheet.set(data.subarray(y * size * 4, (y + 1) * size * 4), ((row * size + y) * sheetW + col * size) * 4);
      }
    });
    rows[name] = row;
    pitch[name] = Number(((grid.pitchX + grid.pitchY) / 2).toFixed(4));
    report.push({
      name,
      pitch: pitch[name],
      strength: Number(grid.strength.toFixed(3)),
      frames: frames.map((f, i) => ({ name: FRAME_NAMES[i], w: f.w, h: f.h })),
      dropped: frames.dropped,
      splits: frames.splits,
    });
  });

  const json = { frame: size, frames: FRAME_NAMES, rows, pitch };
  return { png: encodePng({ width: sheetW, height: sheetH, data: sheet }), json, report, sheet: { width: sheetW, height: sheetH, data: sheet } };
}

// ---------- 장애물 ----------

// 원본 격자 기준 정수 배 축소. 블록마다 가장 많은 색을 고르고(새 색을 만들지 않는다),
// 블록의 절반 이상이 비어 있으면 투명. Gemini 그림의 픽셀 밀도를 캐릭터에 맞추는 용도 —
// 보간(흐릿한 축소)이 아니라 블록 단위로 다시 찍는 것이라 픽셀아트로 남는다.
export function downscaleFrame(frame, factor) {
  const w = Math.ceil(frame.w / factor), h = Math.ceil(frame.h / factor);
  const data = new Uint8Array(w * h * 4);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      const counts = new Map();
      let total = 0, opaque = 0;
      for (let y = by * factor; y < Math.min(frame.h, (by + 1) * factor); y++) {
        for (let x = bx * factor; x < Math.min(frame.w, (bx + 1) * factor); x++) {
          total++;
          const i = (y * frame.w + x) * 4;
          if (!frame.data[i + 3]) continue;
          opaque++;
          const key = (frame.data[i] << 16) | (frame.data[i + 1] << 8) | frame.data[i + 2];
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
      if (opaque * 2 <= total) continue;
      let best = -1, bestN = 0;
      for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
      data.set([(best >> 16) & 255, (best >> 8) & 255, best & 255, 255], (by * w + bx) * 4);
    }
  }
  return trimFrame({ x: 0, y: 0, w, h, data });
}

// 축소 뒤 가장자리에 생긴 빈 줄·열을 잘라 낸다
function trimFrame(f) {
  let x0 = f.w, y0 = f.h, x1 = -1, y1 = -1;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      if (!f.data[(y * f.w + x) * 4 + 3]) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return f;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) data.set(f.data.subarray(((y + y0) * f.w + x0) * 4, ((y + y0) * f.w + x0 + w) * 4), y * w * 4);
  return { x: 0, y: 0, w, h, data };
}

// sources: [{ type, img, frames(개수), scale(정수 축소 배율) }]
// 시트에는 프레임을 가로로 자기 크기대로 늘어놓고(바닥 정렬), JSON 에 위치를 적는다.
export function buildObstacleSheet(sources) {
  const placed = [];
  const report = [];
  for (const { type, img, frames: count, scale = 1 } of sources) {
    const grid = detectGrid(img);
    const frames = splitFrames(quantize(toCells(img, grid)), count)
      .map((f) => (scale > 1 ? downscaleFrame(f, scale) : f));
    for (const f of frames) placed.push({ type, f });
    report.push({
      type,
      pitch: Number(((grid.pitchX + grid.pitchY) / 2).toFixed(4)),
      scale,
      frames: frames.map((f) => ({ w: f.w, h: f.h })),
    });
  }
  const gap = 1;
  const width = placed.reduce((s, p) => s + p.f.w + gap, 0) - gap;
  const height = Math.max(...placed.map((p) => p.f.h));
  const sheet = new Uint8Array(width * height * 4);
  const types = {};
  let cx = 0;
  for (const { type, f } of placed) {
    const y = height - f.h;
    for (let r = 0; r < f.h; r++) sheet.set(f.data.subarray(r * f.w * 4, (r + 1) * f.w * 4), ((y + r) * width + cx) * 4);
    (types[type] ??= []).push({ x: cx, y, w: f.w, h: f.h });
    cx += f.w + gap;
  }
  return {
    png: encodePng({ width, height, data: sheet }),
    json: { types },
    report,
    sheet: { width, height, data: sheet },
  };
}
