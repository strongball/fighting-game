import { addFx } from './fx.ts';
import { recordHeal } from './stats.ts';
import type { GameState, Player } from '../types';

const POPUP_THRESHOLD = 4;

// 回血並批次顯示飄字（小額累積到門檻才顯示，避免治療飄字洗版）。回傳實際回血量。
export function applyHeal(state: GameState, p: Player, amount: number, opts: { burst?: boolean } = {}): number {
  if (!p || !p.alive || amount <= 0 || p.hp >= p.maxHp) return 0;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  const healed = p.hp - before;
  if (healed <= 0) return 0;
  recordHeal(state, p, healed);
  if (opts.burst || healed >= POPUP_THRESHOLD) {
    addFx(state, { type: 'popup', x: p.x, y: p.y, color: '#5cffa6', life: 0.7, text: `+${Math.round(healed)}`, kind: 'heal' });
  } else {
    p._healAccum = (p._healAccum || 0) + healed;
    if (p._healAccum >= POPUP_THRESHOLD) {
      addFx(state, { type: 'popup', x: p.x, y: p.y, color: '#5cffa6', life: 0.7, text: `+${Math.round(p._healAccum)}`, kind: 'heal' });
      p._healAccum = 0;
    }
  }
  return healed;
}
