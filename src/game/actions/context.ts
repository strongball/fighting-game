// @ts-nocheck
import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { clamp, dist } from '../entities/math.ts';
import { applyEffect } from '../entities/effects.ts';
import { addFx } from '../entities/fx.ts';
import { isAlly } from '../entities/team.ts';

export function createActionContext(state, caster, action, opts, executeAction) {
  return {
    state,
    caster,
    action,
    opts,
    executeAction,
    silent: !!opts.silent,
    damageMultiplier: opts.chargeFactor || 1,
    chargeRatio: opts.chargeRatio || 0,
    cos: Math.cos(caster.facing),
    sin: Math.sin(caster.facing),
  };
}

export function applySelfBuff(caster, self) {
  if (!self) return;
  if (self.cleanse) applyEffect(caster, 'cleanse');
  if (self.heal) applyEffect(caster, 'heal', { amount: self.heal });
  if (self.shield) applyEffect(caster, 'shield', { amount: self.shield, duration: self.duration || 5 });
  if (self.effect) applyEffect(caster, self.effect.kind, self.effect, caster.id);
  if (self.effects) for (const effect of self.effects) applyEffect(caster, effect.kind, effect, caster.id);
}

export function applyAllyBuff(state, caster, ally) {
  if (!ally) return;
  const radius = ally.radius || 1e9;
  for (const target of Object.values(state.players)) {
    if (!isAlly(state, caster.id, target)) continue;
    if (dist(caster.x, caster.y, target.x, target.y) > radius) continue;
    if (ally.cleanse) applyEffect(target, 'cleanse');
    if (ally.heal) applyEffect(target, 'heal', { amount: ally.heal });
    if (ally.shield) applyEffect(target, 'shield', { amount: ally.shield, duration: ally.duration || 5 });
    if (ally.effect) applyEffect(target, ally.effect.kind, ally.effect, caster.id);
    if (ally.effects) for (const effect of ally.effects) applyEffect(target, effect.kind, effect, caster.id);
  }
}

export function chronoRewindSelf(state, caster, action) {
  const back = Math.round(((action.rewindSelf && action.rewindSelf.seconds) || 3) * 30);
  const history = caster._chronoHist;
  if (!history || !history.length) return;
  const past = history[Math.max(0, history.length - back)];
  caster.x = clamp(past.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  caster.y = clamp(past.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
  caster.hp = Math.max(caster.hp, Math.min(caster.maxHp, past.hp));
  addFx(state, { type: 'blink', x: caster.x, y: caster.y, color: action.color, life: 0.45, radius: 80, vfx: action.vfx });
}

export function runPostActionEffects(ctx) {
  const { state, caster, action } = ctx;
  if (action.rewindSelf) chronoRewindSelf(state, caster, action);
  if (action.self) applySelfBuff(caster, action.self);
  if (action.ally) applyAllyBuff(state, caster, action.ally);
}
