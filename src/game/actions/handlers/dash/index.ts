// @ts-nocheck
import { addFx } from '../../../entities/fx.ts';
import { meleeHit } from '../../combat.ts';

export function dash(ctx) {
  const { state, caster, action, cos, sin, silent } = ctx;
  caster.kvx += cos * action.impulse;
  caster.kvy += sin * action.impulse;
  if (action.dmg) meleeHit(state, caster, action, true);
  if (!silent) addFx(state, { type: 'dash', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.25, vfx: action.vfx });
}

export const handlers = { dash };
