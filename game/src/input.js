// 조작은 지면선 아래 버튼 두 개뿐이다: 왼쪽 숙이기(누르는 동안), 오른쪽 점프(누르는 순간).
// 버튼은 pointerdown 에서 바로 반응한다 — 손을 뗄 때 반응하면 체감 지연이 생긴다.
// 멀티터치를 받으려고 포인터마다 따로 추적한다. 키보드는 개발용.

const PRESSED = 'is-pressed';
const JUMP_KEYS = new Set(['ArrowUp', 'Space', 'KeyW']);
const DUCK_KEYS = new Set(['ArrowDown', 'KeyS']);

export function createInput({ jumpEl, duckEl, keyTarget }) {
  let jumpQueued = false;
  let duckKey = false;
  const duckPointers = new Set();
  const jumpPointers = new Set();

  const capture = (el, e) => {
    try { el.setPointerCapture?.(e.pointerId); } catch { /* 이미 끝난 포인터 */ }
  };

  function onJumpDown(e) {
    e.preventDefault();
    jumpQueued = true;
    jumpPointers.add(e.pointerId);
    jumpEl.classList.add(PRESSED);
    capture(jumpEl, e);
  }
  function onJumpUp(e) {
    jumpPointers.delete(e.pointerId);
    if (jumpPointers.size === 0) jumpEl.classList.remove(PRESSED);
  }
  function onDuckDown(e) {
    e.preventDefault();
    duckPointers.add(e.pointerId);
    duckEl.classList.add(PRESSED);
    capture(duckEl, e);
  }
  function onDuckUp(e) {
    // pointercancel·lostpointercapture 도 여기로 온다 — 전화·시스템 제스처가 끼어들어도
    // 숙이기가 눌린 채로 남지 않게 한다
    duckPointers.delete(e.pointerId);
    if (duckPointers.size === 0) duckEl.classList.remove(PRESSED);
  }
  function onKeyDown(e) {
    if (e.repeat) return;
    if (JUMP_KEYS.has(e.code)) { e.preventDefault?.(); jumpQueued = true; }
    else if (DUCK_KEYS.has(e.code)) { e.preventDefault?.(); duckKey = true; }
  }
  function onKeyUp(e) {
    if (DUCK_KEYS.has(e.code)) duckKey = false;
  }
  const noMenu = (e) => e.preventDefault();

  function attach() {
    jumpEl.addEventListener('pointerdown', onJumpDown);
    duckEl.addEventListener('pointerdown', onDuckDown);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      jumpEl.addEventListener(type, onJumpUp);
      duckEl.addEventListener(type, onDuckUp);
    }
    jumpEl.addEventListener('contextmenu', noMenu);
    duckEl.addEventListener('contextmenu', noMenu);
    keyTarget.addEventListener('keydown', onKeyDown);
    keyTarget.addEventListener('keyup', onKeyUp);
  }

  function consume() {
    const out = { jump: jumpQueued, duck: duckPointers.size > 0 || duckKey };
    jumpQueued = false;
    return out;
  }

  function reset() {
    jumpQueued = false;
    duckKey = false;
    duckPointers.clear();
    jumpPointers.clear();
    jumpEl.classList.remove(PRESSED);
    duckEl.classList.remove(PRESSED);
  }

  return { attach, consume, reset };
}
