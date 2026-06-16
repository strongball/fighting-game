import { PLAYER_RADIUS } from '../../../constants.js';
import { addFx } from '../../../entities/fx.ts';
import type { ActionContext } from '../../../types';

export function channel(ctx: ActionContext) {
  const { state, caster, action, silent } = ctx;
  caster.channel = {
    kind: 'drain',
    remaining: action.duration || 3,
    tick: action.tick || 0.4,
    tickTimer: 0,
    range: action.range || 320,
    dmg: action.dmg || 0,
    heal: action.heal || 0,
    effect: action.effect || null,
    color: action.color,
    vfx: action.vfx,
  };
  if (!silent) {
    addFx(state, {
      type: 'buff',
      x: caster.x,
      y: caster.y,
      color: action.color,
      life: 0.3,
      radius: PLAYER_RADIUS * 2,
      range: action.range,
      vfx: action.vfx
    });
  }
}

export const handlers = { channel };
