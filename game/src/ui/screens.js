// 화면 텍스트는 캔버스가 아니라 HTML로 그린다 (확대해도 선명하게).
// 사용자 문자열을 다루지 않지만, 원칙대로 textContent만 쓴다.

import { STAGE1 } from '../config.js';

export function createScreens(root) {
  const el = {
    hud: root.querySelector('#hud'),
    barFill: root.querySelector('#bar-fill'),
    lives: root.querySelector('#lives'),
    panels: root.querySelectorAll('[data-panel]'),
  };

  let handler = () => {};

  root.addEventListener('click', (e) => {
    const action = e.target?.dataset?.action;
    if (!action) return;
    e.preventDefault();
    handler(action);
  });

  function show(name) {
    for (const p of el.panels) p.hidden = p.dataset.panel !== name;
    el.hud.hidden = name !== 'hud';
  }

  function hide() {
    for (const p of el.panels) p.hidden = true;
    el.hud.hidden = true;
  }

  function setProgress(ratio) {
    const pct = Math.max(0, Math.min(1, ratio)) * 100;
    el.barFill.style.width = `${pct}%`;
  }

  function setLives(n) {
    // 하트는 수집품이 아니라 남은 목숨 표시다.
    while (el.lives.children.length < STAGE1.lives) {
      const s = document.createElement('span');
      s.className = 'heart';
      el.lives.appendChild(s);
    }
    [...el.lives.children].forEach((c, i) => {
      c.classList.toggle('heart--off', i >= n);
    });
  }

  function onAction(fn) { handler = fn; }

  return { show, hide, setProgress, setLives, onAction };
}
