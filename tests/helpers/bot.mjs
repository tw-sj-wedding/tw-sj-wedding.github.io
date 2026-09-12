// 난이도 확인용 단순 봇. 앞에 있는 가장 가까운 줄에서 가장 넓은 빈틈의 한가운데로 향한다.
// 사람보다 못하게 만드는 것이 목적이 아니라, 클리어율의 하한을 재는 것이 목적이다.
import { FP, VIEW, STAGE1, TARGET_Q_MAX } from '../../game/src/config.js';

export function botInput(state) {
  const pTop = state.progressFp;
  let best = null;
  for (const row of state.rows) {
    const dy = row.worldYFp - pTop;
    if (dy < 0 || dy > 120 * FP) continue;
    if (!row.items.some((it) => it.type !== 'jumppad')) continue;
    if (best === null || dy < best.dy) best = { dy, row };
  }
  if (best === null) return { targetXQ: state.targetXQ };

  const solids = best.row.items
    .filter((it) => it.type !== 'jumppad')
    .map((it) => [it.xFp / FP, it.xFp / FP + it.w])
    .sort((a, b) => a[0] - b[0]);

  let cursor = 0;
  let widest = -1;
  let center = VIEW.W / 2;
  for (const [l, r] of solids) {
    if (l - cursor > widest) { widest = l - cursor; center = (cursor + l) / 2; }
    cursor = Math.max(cursor, r);
  }
  if (VIEW.W - cursor > widest) center = (cursor + VIEW.W) / 2;

  let q = Math.round((center - STAGE1.playerW / 2) * 4);
  if (q < 0) q = 0;
  else if (q > TARGET_Q_MAX) q = TARGET_Q_MAX;
  return { targetXQ: q };
}
