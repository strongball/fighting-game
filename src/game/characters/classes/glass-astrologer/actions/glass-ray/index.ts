import { dealDamage } from '../../../../../entities/damage.ts';
import { applyEffect } from '../../../../../entities/effects.ts';
import { addFx } from '../../../../../entities/fx.ts';
import { isEnemy } from '../../../../../entities/team.ts';
import { bodyR, outMult } from '../../../../../actions/combat.ts';
import {
  clampArenaPoint,
  consumeMirror,
  findFirstMirrorHit,
  markBonus,
  norm,
  pointSegmentDistance,
  reflectDir,
  type Vec2,
} from '../../geometry.ts';
import type { ActionContext, Player } from '../../../../../types';

export function hitSegment(ctx: ActionContext, from: Vec2, to: Vec2, reflected: number, width: number, damage: number) {
  const { state, caster, action, source } = ctx;
  for (const target of Object.values(state.players) as Player[]) {
    if (!target.alive || !isEnemy(state, caster.id, target)) continue;
    if (pointSegmentDistance(target.x, target.y, from.x, from.y, to.x, to.y) > width + bodyR(target)) continue;
    const bonus = reflected > 0 ? markBonus(target, caster.id, action.markBonusPerStack || 8) : 0;
    dealDamage(state, target, damage + bonus, caster.id, { source });
    if (reflected > 0 && target.alive) {
      applyEffect(target, 'glassmark', { duration: 6, stacks: 1, max: 3, srcSlot: source }, caster.id);
    }
    addFx(state, { type: 'hit', x: target.x, y: target.y, color: action.color, life: 0.22, radius: 32 + reflected * 8, vfx: reflected > 0 ? 'glass_astrologer_refract' : action.vfx });
  }
  addFx(state, { type: 'hit', x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, color: action.color, life: 0.22, radius: width * 2.2, vfx: action.vfx, ray: true, x1: from.x, y1: from.y, x2: to.x, y2: to.y, width });
}

export function castGlassRay(ctx: ActionContext, origin: Vec2, dir: Vec2, opt: { damage: number; range: number; width: number; maxReflects: number; startReflected?: number; skipMirrorId?: any }) {
  const { state, caster, action } = ctx;
  let from = origin;
  let direction = norm(dir);
  let reflected = opt.startReflected || 0;
  let skipMirrorId = opt.skipMirrorId ?? null;

  for (let i = reflected; i <= opt.maxReflects; i++) {
    const far = clampArenaPoint({ x: from.x + direction.x * opt.range, y: from.y + direction.y * opt.range });
    const mirrorHit = reflected < opt.maxReflects ? findFirstMirrorHit(state, caster.id, from, far, skipMirrorId) : null;
    const to = mirrorHit ? { x: mirrorHit.hit.x, y: mirrorHit.hit.y } : far;
    const damage = opt.damage * (1 + reflected * (action.reflectBonus || 0.35));
    const width = opt.width + reflected * (action.widthPerReflect || 6);
    hitSegment(ctx, from, to, reflected, width, damage);

    if (!mirrorHit) break;
    consumeMirror(mirrorHit.mirror);
    addFx(state, { type: 'hit', x: to.x, y: to.y, color: action.color, life: 0.25, radius: 42, vfx: 'glass_astrologer_refract' });
    direction = reflectDir(direction, mirrorHit.mirror);
    from = { x: to.x + direction.x * 2, y: to.y + direction.y * 2 };
    skipMirrorId = mirrorHit.mirror.id;
    reflected++;
  }
}

export function glass_ray(ctx: ActionContext) {
  const { caster, action, cos, sin } = ctx;
  const m = outMult(caster, action);
  castGlassRay(ctx, { x: caster.x, y: caster.y }, { x: cos, y: sin }, {
    damage: (action.dmg || 42) * m,
    range: action.range || 720,
    width: action.width || 18,
    maxReflects: action.maxReflects || 2,
  });
}

export const handlers = { glass_ray };
