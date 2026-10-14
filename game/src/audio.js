// 지금은 unlock 배관만 둔다. 효과음은 M6에서 얹는다.
// iOS 무음 스위치가 켜져 있으면 소리가 안 나므로, 소리 없이도 게임이 성립해야 한다.
// 이 모듈은 절대 예외를 밖으로 던지지 않는다 — 오디오 실패가 게임을 막으면 안 된다.

export function createAudio() {
  let ctx = null;

  function unlock() {
    if (ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      // 무음 버퍼 1개를 재생해 컨텍스트를 깨운다
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume?.();
    } catch {
      ctx = null;
    }
  }

  return {
    unlock,
    get enabled() { return ctx !== null && ctx.state === 'running'; },
  };
}
