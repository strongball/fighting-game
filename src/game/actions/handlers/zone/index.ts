// @ts-nocheck
import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp } from '../../../entities/math.ts';
import { makeZone } from '../../../entities/factories.ts';

export function zone(ctx) {
  const { state, caster, action, cos, sin } = ctx;
  const baseX = clamp(caster.x + cos * (action.range || 0), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  const baseY = clamp(caster.y + sin * (action.range || 0), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
  const n = action.count || 1;
  if (n <= 1) {
    const zopt = action.moving ? { ...action, vx: cos * action.moving, vy: sin * action.moving } : action;
    state.zones.push(makeZone(caster.id, baseX, baseY, zopt));
  } else {
    const scatter = action.scatter || 120;
    for (let i = 0; i < n; i++) {
      let zx = baseX;
      let zy = baseY;
      if (i > 0) {
        const ang = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * scatter;
        zx = clamp(baseX + Math.cos(ang) * rr, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
        zy = clamp(baseY + Math.sin(ang) * rr, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      }
      const z = makeZone(caster.id, zx, zy, action);
      if (action.delay) z.delay += i * (action.stagger || 0.16);
      state.zones.push(z);
    }
  }
  if (action.recoil) {
    caster.kvx -= cos * action.recoil;
    caster.kvy -= sin * action.recoil;
  }
}

export const handlers = { zone };
