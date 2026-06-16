// @ts-nocheck
import { bodyR } from '../actions/combat.ts';

export function resolveCollisions(state) {
  const arr = Object.values(state.players).filter((p) => p.alive);
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i];
      const b = arr[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = bodyR(a) + bodyR(b);
      if (d >= minD) continue;

      const nx = d > 0.0001 ? dx / d : 1;
      const ny = d > 0.0001 ? dy / d : 0;
      const overlap = minD - d;
      const aHeavy = a.isBoss || a.isPart;
      const bHeavy = b.isBoss || b.isPart;
      if (aHeavy && bHeavy) continue;
      if (aHeavy) {
        b.x += nx * overlap;
        b.y += ny * overlap;
      } else if (bHeavy) {
        a.x -= nx * overlap;
        a.y -= ny * overlap;
      } else {
        const push = overlap / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
  }
}
