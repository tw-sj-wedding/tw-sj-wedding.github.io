import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '../game/src/input.js';

// 브라우저 없이 쓰는 가짜 버튼 요소
function fakeEl() {
  const el = new EventTarget();
  const classes = new Set();
  el.classList = {
    add: (c) => classes.add(c),
    remove: (c) => classes.delete(c),
    toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    contains: (c) => classes.has(c),
  };
  el.setPointerCapture = () => {};
  el.releasePointerCapture = () => {};
  return el;
}

function fire(target, type, props = {}) {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, props);
  target.dispatchEvent(e);
  return e;
}

function setup() {
  const jumpEl = fakeEl(), duckEl = fakeEl(), keyTarget = new EventTarget();
  const input = createInput({ jumpEl, duckEl, keyTarget });
  input.attach();
  return { input, jumpEl, duckEl, keyTarget };
}

test('점프 버튼을 한 번 누르면 점프는 한 틱에만 전달된다', () => {
  const { input, jumpEl } = setup();
  fire(jumpEl, 'pointerdown', { pointerId: 1 });
  assert.equal(input.consume().jump, true);
  assert.equal(input.consume().jump, false);
});

test('점프 버튼은 누르는 순간 반응하고 눌린 모양이 된다', () => {
  const { jumpEl } = setup();
  const e = fire(jumpEl, 'pointerdown', { pointerId: 1 });
  assert.equal(e.defaultPrevented, true);
  assert.equal(jumpEl.classList.contains('is-pressed'), true);
  fire(jumpEl, 'pointerup', { pointerId: 1 });
  assert.equal(jumpEl.classList.contains('is-pressed'), false);
});

test('숙이기는 누르고 있는 동안만 유지된다', () => {
  const { input, duckEl } = setup();
  fire(duckEl, 'pointerdown', { pointerId: 3 });
  assert.equal(input.consume().duck, true);
  assert.equal(input.consume().duck, true);
  fire(duckEl, 'pointerup', { pointerId: 3 });
  assert.equal(input.consume().duck, false);
});

test('손가락이 취소되거나 캡처를 잃으면 숙이기가 풀린다', () => {
  // 전화가 오거나 시스템 제스처가 끼어들면 pointerup 없이 cancel 만 온다
  for (const type of ['pointercancel', 'lostpointercapture']) {
    const { input, duckEl } = setup();
    fire(duckEl, 'pointerdown', { pointerId: 5 });
    fire(duckEl, type, { pointerId: 5 });
    assert.equal(input.consume().duck, false, `${type} 후에도 숙이기 유지`);
    assert.equal(duckEl.classList.contains('is-pressed'), false);
  }
});

test('두 버튼을 동시에 누를 수 있다', () => {
  const { input, jumpEl, duckEl } = setup();
  fire(duckEl, 'pointerdown', { pointerId: 1 });
  fire(jumpEl, 'pointerdown', { pointerId: 2 });
  assert.deepEqual(input.consume(), { jump: true, duck: true });
});

test('숙이기를 두 손가락으로 누르다 하나만 떼면 계속 숙인다', () => {
  const { input, duckEl } = setup();
  fire(duckEl, 'pointerdown', { pointerId: 1 });
  fire(duckEl, 'pointerdown', { pointerId: 2 });
  fire(duckEl, 'pointerup', { pointerId: 1 });
  assert.equal(input.consume().duck, true);
});

test('reset 은 눌린 상태를 전부 푼다', () => {
  const { input, jumpEl, duckEl } = setup();
  fire(duckEl, 'pointerdown', { pointerId: 1 });
  fire(jumpEl, 'pointerdown', { pointerId: 2 });
  input.reset();
  assert.deepEqual(input.consume(), { jump: false, duck: false });
  assert.equal(duckEl.classList.contains('is-pressed'), false);
});

test('키보드: ↑·스페이스 점프(자동 반복 무시), ↓ 숙이기', () => {
  const { input, keyTarget } = setup();
  fire(keyTarget, 'keydown', { code: 'ArrowUp', repeat: false });
  assert.equal(input.consume().jump, true);
  fire(keyTarget, 'keydown', { code: 'Space', repeat: true });
  assert.equal(input.consume().jump, false);
  fire(keyTarget, 'keydown', { code: 'ArrowDown', repeat: false });
  assert.equal(input.consume().duck, true);
  fire(keyTarget, 'keyup', { code: 'ArrowDown' });
  assert.equal(input.consume().duck, false);
});

test('길게 눌러도 컨텍스트 메뉴가 뜨지 않는다', () => {
  const { duckEl } = setup();
  assert.equal(fire(duckEl, 'contextmenu').defaultPrevented, true);
});
