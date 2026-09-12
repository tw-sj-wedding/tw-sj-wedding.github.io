// 조작은 상대 드래그 하나뿐이다. 기울기 센서·가상 조이스틱·다중 버튼은 쓰지 않는다.
// targetXQ 단위는 1/4 논리 px (0 ~ TARGET_Q_MAX).

import { VIEW, TARGET_Q_MAX, TARGET_Q_CENTER } from './config.js';

const KEY_STEP_Q = 24;

function clampQ(q) {
  if (!Number.isFinite(q)) return TARGET_Q_CENTER;
  q = Math.round(q);
  if (q < 0) return 0;
  if (q > TARGET_Q_MAX) return TARGET_Q_MAX;
  return q;
}

export function dragToQ(baseQ, dxCss, cssWidth) {
  if (!cssWidth) return clampQ(baseQ);
  const dq = Math.round((dxCss / cssWidth) * VIEW.W * 4);
  return clampQ(baseQ + dq);
}

export function createInput(el) {
  const api = {
    targetXQ: TARGET_Q_CENTER,
    attach,
    detach,
    reset,
    pumpKeyboard,
  };

  let pointerId = null;
  let startX = 0;
  let baseQ = TARGET_Q_CENTER;
  const keys = { left: false, right: false };

  function onPointerDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    baseQ = api.targetXQ;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId) return;
    api.targetXQ = dragToQ(baseQ, e.clientX - startX, el.clientWidth);
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    el.releasePointerCapture?.(e.pointerId);
  }

  // 개발용. 실기기 조작에는 쓰이지 않는다.
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') keys.left = true;
    else if (e.key === 'ArrowRight') keys.right = true;
    else return;
    e.preventDefault();
  }

  function onKeyUp(e) {
    if (e.key === 'ArrowLeft') keys.left = false;
    else if (e.key === 'ArrowRight') keys.right = false;
  }

  // main.js가 매 틱 부른다 (키보드 누적용)
  function pumpKeyboard() {
    if (keys.left === keys.right) return;
    api.targetXQ = clampQ(api.targetXQ + (keys.right ? KEY_STEP_Q : -KEY_STEP_Q));
  }

  function attach() {
    el.addEventListener('pointerdown', onPointerDown, { passive: false });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  function detach() {
    el.removeEventListener('pointerdown', onPointerDown);
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  function reset() {
    pointerId = null;
    keys.left = false;
    keys.right = false;
    api.targetXQ = TARGET_Q_CENTER;
  }

  return api;
}
