import { makeZone } from '../../../../../entities/factories.ts';
import { addFx } from '../../../../../entities/fx.ts';
import { clampArenaPoint, trimMirrors } from '../../geometry.ts';
import type { ActionContext } from '../../../../../types';

export function glass_mirror(ctx: ActionContext) {
  const { state, caster, action, cos, sin } = ctx;
  const pos = clampArenaPoint({
    x: caster.x + cos * (action.range || 180),
    y: caster.y + sin * (action.range || 180),
  });
  const mirror = Object.assign(makeZone(caster.id, pos.x, pos.y, {
    radius: 0,
    dmg: 0,
    lifetime: action.lifetime || 7,
    tick: 999,
    color: action.color,
    vfx: action.vfx,
  }), {
    kind: 'glass_mirror',
    angle: caster.facing + (action.angleOffset ?? Math.PI / 3),
    length: action.length || 190,
    thickness: action.thickness || 18,
    charges: action.charges || 3,
    createdAt: state.time,
    srcSlot: ctx.source,
  });

  state.zones.push(mirror);
  trimMirrors(state, caster.id, action.maxMirrors || 2);
  addFx(state, { type: 'buff', x: mirror.x, y: mirror.y, facing: mirror.angle, color: action.color, life: 0.35, radius: mirror.length * 0.5, vfx: action.vfx });
}

export const handlers = { glass_mirror };
