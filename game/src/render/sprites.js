// 캐릭터 스프라이트 시트(assets/sprites.png + .json) 로더.
// 시트는 scripts/build-sprites.mjs 가 Gemini 원본에서 만든다. 여기서는 읽어서 그리기만 한다.
// 시트를 못 읽으면 예외 대신 null — 임시 도형으로 계속 간다 (그림 때문에 게임이 멈추면 안 된다).

import { HITBOX } from '../config.js';

const POSE_FRAMES = { run: [0, 1], jump: [2], duck: [3, 4], crash: [5] };
const FALLBACK = {
  groom: { body: '#2b3256', board: '#3f9b4c' },
  bride: { body: '#8d939c', board: '#b9c0c8' },
};

export async function loadSprites(base) {
  try {
    const meta = await fetch(`${base}sprites.json`).then((r) => (r.ok ? r.json() : null));
    if (!meta || meta.frame !== 64 || !meta.rows || !Array.isArray(meta.frames)) return null;
    const img = new Image();
    img.decoding = 'async';
    img.src = `${base}sprites.png`;
    await img.decode();
    return { img, meta };
  } catch {
    return null;
  }
}

export function frameIndex(pose, animFrame) {
  const frames = POSE_FRAMES[pose] ?? POSE_FRAMES.run;
  return frames[animFrame % frames.length];
}

// (x, y) = 64x64 프레임의 왼쪽 위. 프레임 바닥이 발(보드 밑면), 가로 가운데가 충돌 상자 중심이다.
export function drawCharacter(ctx, atlas, character, pose, animFrame, x, y) {
  const size = 64;
  if (atlas && character in atlas.meta.rows) {
    const col = frameIndex(pose, animFrame);
    const row = atlas.meta.rows[character];
    ctx.drawImage(atlas.img, col * size, row * size, size, size, x, y, size, size);
    return;
  }
  // 임시 도형: 충돌 상자 크기의 몸통 + 보드
  const colors = FALLBACK[character] ?? FALLBACK.groom;
  const box = pose === 'duck' ? HITBOX.duck : HITBOX.stand;
  const cx = x + size / 2;
  if (pose === 'crash') {
    ctx.fillStyle = colors.body;
    ctx.fillRect(cx - box.h / 2, y + size - 14, box.h, 12);
    return;
  }
  ctx.fillStyle = colors.body;
  ctx.fillRect(cx - box.w / 2, y + size - box.h, box.w, box.h - 3);
  ctx.fillStyle = colors.board;
  ctx.fillRect(cx - 20, y + size - 3, 40, 3);
}

// 타이틀 화면 캐릭터 카드용
export function drawPortrait(canvas, atlas, character) {
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  drawCharacter(ctx, atlas, character, 'run', 0, 0, 0);
}
