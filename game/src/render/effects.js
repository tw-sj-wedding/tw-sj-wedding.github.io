// 속도감 연출: 보드 뒤 눈보라와 바람 줄기 (#62). 그림 전용 — 시뮬·판정과 무관하다.
// 둘 다 상태 없이 (시간·거리·속도)만으로 그린다. 입자마다 고정 seed 로 위상·방향을 정해 두고 매 프레임 계산한다.
// 렌더러가 슬로프 각도만큼 기울인 좌표계에서 부르므로 줄기는 경사면과 나란하다.

import { mulberry32 } from '../sim/rng.js';
import { EFFECTS, VIEW } from '../config.js';

const SPRAY_C = ['#ffffff', '#ffffff', '#dbe5ee', '#b4c5d5'];   // 흰 눈 + 그늘 — 하늘(밝음)·언덕(어두움) 어디서나 보이게
const LINE_C = 'rgba(255, 255, 255, ALPHA)';
const BOARD_TAIL = 17;   // 신랑 발밑(VIEW.PLAYER_X)에서 보드 뒤끝까지

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t) => t * t * (3 - 2 * t);   // 처음엔 천천히, 가운데서 빠르게
const strength = (speed, { from, full }) => smooth(clamp01((speed - from) / (full - from)));
const wrap = (v, m) => ((v % m) + m) % m;

const next = mulberry32(0x5a7a5);
const rng = () => next() / 2 ** 32;   // 0 이상 1 미만
const particles = Array.from({ length: EFFECTS.spray.count }, () => ({
  phase: rng(), back: 0.5 + rng() * 0.5, up: 0.4 + rng() * 0.6, color: SPRAY_C[Math.floor(rng() * SPRAY_C.length)],
}));
const LINE_SPAN = VIEW.W + 160;
const streaks = Array.from({ length: EFFECTS.lines.count }, () => ({
  x: rng() * LINE_SPAN, y: rng(), len: 0.5 + rng() * 0.5, rel: rng(), thick: rng() < 0.3,
}));

export function drawSpeedLines(ctx, groundY, speed, distance) {
  const L = EFFECTS.lines;
  const s = strength(speed, L);
  if (s <= 0) return;
  const n = Math.round(L.count * s);
  ctx.fillStyle = LINE_C.replace('ALPHA', (0.45 + 0.45 * s).toFixed(2));
  for (let i = 0; i < n; i++) {
    const k = streaks[i];
    const len = Math.round((L.minLen + (L.maxLen - L.minLen) * s) * k.len);
    const rel = L.rel[0] + (L.rel[1] - L.rel[0]) * k.rel;
    const x = wrap(k.x - distance * rel, LINE_SPAN) - 80;
    const y = groundY - L.bottom - Math.round(k.y * (L.top - L.bottom));
    ctx.fillRect(Math.round(x), y, len, k.thick && s > 0.5 ? 2 : 1);   // 세지면 몇 줄은 굵게
  }
}

export function drawSpray(ctx, groundY, speed, timeSec) {
  const S = EFFECTS.spray;
  const s = strength(speed, S);
  const n = Math.round(S.count * (S.base + (1 - S.base) * s));
  const back = 80 + speed * 0.35;  // px/s, 보드 뒤로 날아가는 속도
  const up = 70 + 90 * s;          // px/s, 처음 솟는 속도
  const g = 600;                   // px/s², 다시 떨어지게
  const ox = VIEW.PLAYER_X - BOARD_TAIL, oy = groundY - 1;
  for (let i = 0; i < n; i++) {
    const p = particles[i];
    const age = wrap(timeSec / S.lifeSec + p.phase, 1);   // 0 → 1
    const t = age * S.lifeSec;
    const x = ox - t * back * p.back;
    const y = Math.min(oy, oy - (t * up * p.up - 0.5 * g * t * t));
    const size = age < 0.3 ? 3 : age < 0.65 ? 2 : 1;   // 날아가며 작아진다
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(x), Math.round(y) - size + 1, size, size);
  }
}
