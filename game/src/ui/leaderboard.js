// 리더보드 등록·순위표 화면과 하단 TOP 5. 등록은 게임오버 후 하객이 원할 때만 한다.
// 닉네임은 서버로 보내기 전에 같은 규칙(shared/nickname.js)으로 먼저 안내하고, 최종 판정은 서버가 한다.
// 사용자 문자열(닉네임)은 textContent 로만 넣는다.

import { validateNickname } from '../shared/nickname.js';
import { GAME_VERSION } from '../config.js';

const MESSAGES = {
  length: '닉네임은 2~10자로 적어 주세요',
  chars: '한글·영문·숫자만, 띄어쓰기 없이 적어 주세요',
  reserved: '쓸 수 없는 닉네임이에요',
  profanity: '다른 닉네임을 적어 주세요',
  no_token: '서버에 연결하지 못해 이번 판은 등록할 수 없어요',
  network: '서버에 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요',
  rate_limited: '잠시 뒤 다시 눌러 주세요',
  replayed: '이미 등록한 기록이에요',
  expired: '시간이 너무 지나 등록할 수 없어요. 한 판 더 해 주세요',
  old_client: '새 버전이 있어요. 페이지를 새로고침해 주세요',
};

// 화려하게 보여 줄 닉네임 → 배지. 예약어(shared/nickname.js)라 하객은 못 쓰고 관리자가 D1 에서만 붙인다
const VIP = new Map([['김태웅', '신랑']]);

const MINI_TOP = 5;
const MINI_MIN_INTERVAL_MS = 15_000;   // 금방 넘어지고 다시 하는 판마다 서버를 부르지 않게

export function messageFor(error, reason) {
  if (error === 'bad_nickname') return MESSAGES[reason] ?? MESSAGES.reserved;
  return MESSAGES[error] ?? '기록을 등록하지 못했어요';
}

export function createLeaderboard({ root, api, storage, setMode }) {
  const $ = (sel) => root.querySelector(sel);
  const el = {
    form: $('#reg-form'), name: $('#reg-name'), error: $('#reg-error'), submit: $('#reg-submit'),
    score: $('#reg-score'), list: $('#board-list'), me: $('#board-me'), status: $('#board-status'),
    registerBtn: $('[data-action="register"]'),
    miniList: $('#mini-list'), miniStatus: $('#mini-status'),
  };
  let run = null;
  let returnTo = 'title';
  let busy = false;
  let miniFetchedAt = -Infinity;
  let miniPending = null;

  function showError(msg) {
    el.error.textContent = msg;
    el.error.hidden = !msg;
  }

  // 게임오버마다 등록 버튼 상태를 새 판에 맞춘다
  function resetForRun(nextRun) {
    run = nextRun;
    el.registerBtn.textContent = '리더보드에 등록';
    el.registerBtn.dataset.done = '';
    el.registerBtn.hidden = !api.enabled;
    el.registerBtn.toggleAttribute('data-blocked', !(run && run.score > 0));
    el.registerBtn.disabled = true;   // 게임오버 패널이 버튼을 켤 때 data-blocked 를 본다
  }

  function openRegister() {
    if (!run || run.registered || run.score <= 0) return;
    el.score.textContent = String(run.score);
    el.name.value = storage.getNickname();
    showError('');
    el.submit.disabled = false;
    setMode('register');
    try { el.name.focus({ preventScroll: true }); } catch { /* 일부 웹뷰는 옵션 미지원 */ }
  }

  async function submit() {
    if (busy || !run) return;
    const nick = validateNickname(el.name.value);
    if (!nick.ok) { showError(messageFor('bad_nickname', nick.reason)); return; }
    busy = true;
    el.submit.disabled = true;
    showError('');
    try {
      const token = await run.tokenP;
      if (!token) { showError(MESSAGES.no_token); return; }
      const r = await api.submit({
        token,
        playerId: storage.getPlayerId(),
        nickname: nick.value,
        score: run.score,
        durationTicks: run.durationTicks,
        character: run.character,
        clientVersion: GAME_VERSION,
      });
      if (!r.ok) { showError(messageFor(r.error, r.reason)); return; }
      storage.setNickname(nick.value);
      run.registered = true;
      el.registerBtn.textContent = '등록했어요';
      el.registerBtn.toggleAttribute('data-blocked', true);
      el.registerBtn.disabled = true;
      el.name.blur();
      openBoard('over', r.improved ? r.rank : null);
    } finally {
      busy = false;
      el.submit.disabled = false;
    }
  }

  function span(cls, text) {
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function row({ rank, nickname, score, character }, isMe) {
    const vip = VIP.get(nickname);
    const li = document.createElement('li');
    li.className = `board__row${isMe ? ' is-me' : ''}${vip ? ' is-vip' : ''}`;
    li.append(
      span('board__rank', String(rank)),
      span(`board__who board__who--${character === 'bride' ? 'bride' : 'groom'}`, ''),
      span('board__name', vip ? '' : nickname),
      span('board__score', String(score)),
    );
    if (vip) {
      const crown = span('vip__crown', '👑');
      crown.setAttribute('aria-hidden', 'true');
      li.children[2].append(crown, span('vip__name', nickname), span('vip__badge', vip));
    }
    return li;
  }

  async function openBoard(from, highlightRank = null) {
    returnTo = from;
    el.list.replaceChildren();
    el.me.hidden = true;
    el.status.textContent = '불러오는 중…';
    el.status.hidden = false;
    setMode('board');
    const data = await api.board(storage.getPlayerId());
    if (!data) { el.status.textContent = '순위표를 불러오지 못했어요'; return; }
    renderMini(data);
    const myRank = data.me?.rank ?? highlightRank;
    if (data.top.length === 0) el.status.textContent = '아직 등록한 하객이 없어요. 첫 번째가 되어 보세요!';
    else el.status.hidden = true;
    for (const r of data.top) el.list.appendChild(row(r, r.rank === myRank));
    if (data.me && data.me.rank > data.top.length) {
      el.me.textContent = `내 순위 ${data.me.rank}위 · ${data.me.score}점`;
      el.me.hidden = false;
    }
  }

  function renderMini(data) {
    miniFetchedAt = performance.now();
    const top = data.top.slice(0, MINI_TOP);
    el.miniList.replaceChildren(...top.map((r) => row(r, r.rank === data.me?.rank)));
    el.miniStatus.textContent = top.length === 0 ? '아직 등록한 하객이 없어요. 첫 번째가 되어 보세요!' : '';
    el.miniStatus.hidden = top.length > 0;
  }

  // 하단 TOP 5 갱신. 최근에 받았으면 건너뛴다. 실패하면 이전 목록을 그대로 둔다
  function refreshMini() {
    if (!api.enabled || miniPending || performance.now() - miniFetchedAt < MINI_MIN_INTERVAL_MS) return;
    if (miniFetchedAt === -Infinity) { el.miniStatus.textContent = '불러오는 중…'; el.miniStatus.hidden = false; }
    miniPending = api.board(storage.getPlayerId()).then((data) => {
      if (data) renderMini(data);
      else if (miniFetchedAt === -Infinity) el.miniStatus.textContent = '순위표를 불러오지 못했어요';
    }).finally(() => { miniPending = null; });
  }

  el.form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  return {
    resetForRun,
    openRegister,
    openBoard,
    refreshMini,
    close() { setMode(returnTo); },
    cancelRegister() { el.name.blur(); setMode('over'); },
  };
}
