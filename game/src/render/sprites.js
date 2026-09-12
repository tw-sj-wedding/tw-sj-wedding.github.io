// 코드로 그린 플레이스홀더 스프라이트. M6에서 실제 픽셀아트로 교체한다.
// 크기는 HANDOFF 부록 A 표를 따른다.

const P = {
  ink:   '#2f2a27',
  hair:  '#3b2a20',
  skin:  '#f0c8a0',
  suit:  '#3a3f52',
  shirt: '#ffffff',
  rose:  '#c2836f',
  petal: '#e6b6a5',
  gold:  '#e8c46a',
  leaf:  '#4a7a55',
  wood:  '#6b4b36',
  snow:  '#eef2f5',
  shade: '#c9d3db',
  veil:  '#fbf7f4',
  board: '#8a5c48',
};

// [x, y, w, h, color]
const DEFS = {
  groom: { w: 14, h: 17, rects: [
    [4, 0, 6, 4, P.hair],
    [5, 2, 4, 3, P.skin],
    [4, 5, 6, 6, P.suit],
    [6, 5, 2, 4, P.shirt],
    [6, 6, 2, 1, P.rose],
    [2, 6, 2, 5, P.suit],
    [10, 6, 2, 5, P.suit],
    [1, 10, 3, 3, P.petal],
    [1, 12, 3, 1, P.leaf],
    [11, 10, 2, 2, P.gold],
    [5, 11, 4, 3, P.suit],
    [3, 14, 8, 2, P.board],
    [3, 16, 8, 1, P.ink],
  ] },
  bride: { w: 14, h: 16, rects: [
    [4, 0, 6, 3, P.hair],
    [5, 2, 4, 3, P.skin],
    [3, 0, 8, 2, P.veil],
    [4, 5, 6, 5, P.veil],
    [3, 9, 8, 5, P.shirt],
    [2, 13, 10, 1, P.veil],
    [6, 6, 2, 2, P.petal],
    [4, 14, 6, 1, P.ink],
  ] },
  tree: { w: 12, h: 13, rects: [
    [5, 9, 2, 4, P.wood],
    [4, 6, 4, 4, P.leaf],
    [2, 3, 8, 4, P.leaf],
    [3, 0, 6, 4, P.leaf],
    [4, 0, 4, 2, '#3d6647'],
  ] },
  rock: { w: 10, h: 6, rects: [
    [1, 3, 8, 3, '#8d8781'],
    [2, 1, 6, 3, '#a8a29c'],
    [3, 0, 4, 2, '#bdb7b1'],
  ] },
  snowman: { w: 10, h: 13, rects: [
    [1, 7, 8, 6, P.shirt],
    [2, 2, 6, 6, P.shirt],
    [3, 4, 1, 1, P.ink],
    [6, 4, 1, 1, P.ink],
    [4, 6, 2, 1, P.rose],
    [2, 1, 6, 1, P.ink],
    [3, 0, 4, 1, P.ink],
    [0, 9, 1, 1, P.wood],
    [9, 9, 1, 1, P.wood],
  ] },
  jumppad: { w: 16, h: 4, rects: [
    [0, 1, 16, 3, P.rose],
    [1, 0, 14, 1, P.petal],
  ] },
  // 결승선 꽃 아치 (연출 전용, 크기는 자유)
  arch: { w: 60, h: 34, rects: [
    [4, 8, 4, 26, P.leaf],
    [52, 8, 4, 26, P.leaf],
    [4, 4, 52, 5, P.leaf],
    [2, 2, 8, 5, P.petal],
    [50, 2, 8, 5, P.petal],
    [16, 1, 6, 5, P.petal],
    [38, 1, 6, 5, P.petal],
    [27, 0, 6, 5, P.rose],
    [6, 14, 3, 3, P.petal],
    [51, 14, 3, 3, P.petal],
    [6, 24, 3, 3, P.rose],
    [51, 24, 3, 3, P.rose],
  ] },
};

const cache = new Map();

export function getSprite(name) {
  const hit = cache.get(name);
  if (hit) return hit;

  const def = DEFS[name];
  if (!def) throw new Error(`알 수 없는 스프라이트: ${name}`);

  const cv = document.createElement('canvas');
  cv.width = def.w;
  cv.height = def.h;
  const ctx = cv.getContext('2d');
  for (const [x, y, w, h, color] of def.rects) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  cache.set(name, cv);
  return cv;
}

export function spriteSize(name) {
  const def = DEFS[name];
  return { w: def.w, h: def.h };
}

export const PALETTE = P;
