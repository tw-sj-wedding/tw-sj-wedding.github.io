// HTML 오버레이 (HUD·버튼·패널). 캔버스가 아니라 HTML이라 확대해도 선명하다.
// 사용자 문자열은 textContent 로만 넣는다.

const pad = (n) => String(Math.max(0, n | 0)).padStart(5, '0');

export function createScreens(root) {
  const $ = (sel) => root.querySelector(sel);
  const el = {
    hud: $('#hud'),
    controls: $('#controls'),
    hint: $('#hint'),
    score: $('#score'),
    hi: $('#hi'),
    count: $('#count'),
    finalScore: $('#final-score'),
    best: $('#best'),
    newRecord: $('#new-record'),
    panels: root.querySelectorAll('[data-panel]'),
    overButtons: root.querySelectorAll('[data-over-btn]'),
    needsApi: root.querySelectorAll('[data-needs-api]'),
    picks: root.querySelectorAll('[data-action="pick"]'),
  };

  let handler = () => {};
  let lastScoreText = '';

  root.addEventListener('click', (e) => {
    const target = e.target.closest?.('[data-action]');
    if (!target || target.disabled) return;
    e.preventDefault();
    handler(target.dataset.action, target.dataset);
  });

  function show(mode) {
    const panel = mode === 'playing' ? null : mode;
    for (const p of el.panels) p.hidden = p.dataset.panel !== panel;
    el.hud.hidden = !(mode === 'playing' || mode === 'countdown');
    el.controls.hidden = !(mode === 'playing' || mode === 'countdown');
  }

  function setScore(n) {
    const t = pad(n);
    if (t !== lastScoreText) { el.score.textContent = t; lastScoreText = t; }
  }

  function flash() {
    el.score.classList.remove('is-flash');
    void el.score.offsetWidth;          // 애니메이션 다시 시작
    el.score.classList.add('is-flash');
  }

  return {
    show,
    setScore,
    flash,
    setHi(n) { el.hi.textContent = pad(n); },
    setCountdown(n) { el.count.textContent = String(n); },
    setOver({ score, hi, newRecord }) {
      el.finalScore.textContent = String(score);
      el.best.textContent = `HI ${pad(hi)}`;
      el.newRecord.hidden = !newRecord;
    },
    enableOverButtons(on) { for (const b of el.overButtons) b.disabled = !on; },
    showHint(on) { el.hint.hidden = !on; },
    setApiAvailable(on) { for (const n of el.needsApi) n.hidden = !on; },
    setLastCharacter(c) { for (const p of el.picks) p.classList.toggle('is-last', p.dataset.character === c); },
    portraits: () => [...root.querySelectorAll('[data-portrait]')],
    onAction(fn) { handler = fn; },
  };
}
