// @ts-nocheck
import { addFx } from './fx.ts';
import { recordHeal } from './stats.ts';

const POPUP_THRESHOLD = 4;

export function applyHeal(state, p, amount, opts = {}) {
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
