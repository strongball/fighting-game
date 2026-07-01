// @ts-nocheck
import { castGlassRay } from './actions/glass-ray/index.ts';
import { outMult } from '../../../actions/combat.ts';

export function tickGlassBeam(state, caster, dt) {
  const beam = caster.glassBeam;
  if (!beam) return;
  beam.remaining -= dt;
  beam.tickTimer -= dt;
  if (beam.remaining <= 0) {
    caster.glassBeam = null;
    return;
  }
  if (beam.tickTimer > 0) return;
  beam.tickTimer += beam.tick || 0.25;

  const action = beam.action;
  const m = outMult(caster, action);
  const ctx = {
    state,
    caster,
    action,
    opts: { source: beam.srcSlot },
    executeAction: null,
    silent: false,
    damageMultiplier: 1,
    chargeRatio: 0,
    cos: Math.cos(caster.facing),
    sin: Math.sin(caster.facing),
    source: beam.srcSlot,
  };
  const count = Math.max(1, action.directionCount || 1);
  for (let i = 0; i < count; i++) {
    const angle = caster.facing + (i / count) * Math.PI * 2;
    castGlassRay(ctx, { x: caster.x, y: caster.y }, { x: Math.cos(angle), y: Math.sin(angle) }, {
      damage: (action.pulseDmg || action.dmg || 12) * m,
      range: action.range || 760,
      width: action.width || 18,
      maxReflects: action.maxReflects || 1,
    });
  }
}
