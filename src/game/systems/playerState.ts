// @ts-nocheck
import { PLAYER_RADIUS, MANA_REGEN, ULT_MAX, ULT_REGEN, COOLDOWN_MULTIPLIER } from '../constants.js';
import { missingHp } from '../entities/math.ts';
import { applyHeal } from '../entities/heal.ts';
import { addFx } from '../entities/fx.ts';

const COOLDOWN_SLOTS = ['basic', 'skill1', 'skill2', 'ultimate', 'evade'];

export function tickSummonLife(state, p, dt) {
  if (!(p.summonLife > 0)) return false;
  p.summonLife -= dt;
  if (p.summonLife > 0) return false;
  p.alive = false;
  addFx(state, { type: 'death', x: p.x, y: p.y, color: '#9b8cff', life: 0.4, radius: PLAYER_RADIUS * 1.6 });
  return true;
}

export function tickCharacterTimers(p, character, talent, dt) {
  if (character.ultimate && character.ultimate.rewindSelf) {
    if (!p._chronoHist) p._chronoHist = [];
    p._chronoHist.push({ x: p.x, y: p.y, hp: p.hp });
    if (p._chronoHist.length > 130) p._chronoHist.shift();
  }
  if (talent && talent.id === 'iaido') p.iaiTimer = (p.iaiTimer || 0) + dt;
}

export function tickCooldowns(state, p, talent, dt) {
  let cdRate = 1;
  if (talent && talent.id === 'bloodlust') cdRate = 1 + (talent.haste || 0.6) * missingHp(p);
  cdRate /= COOLDOWN_MULTIPLIER;
  for (const slot of COOLDOWN_SLOTS) {
    let rate = cdRate;
    if (slot === 'basic' && p.effects.overdrive && p.effects.overdrive.atkSpeed) {
      rate *= p.effects.overdrive.atkSpeed;
    }
    p.cd[slot] = Math.max(0, p.cd[slot] - dt * rate);
  }
  if (state.flags && state.flags.noCooldown) {
    for (const slot of COOLDOWN_SLOTS) p.cd[slot] = 0;
  }
}

export function tickPassiveRecovery(state, p, talent, dt) {
  if (p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) p.combo = 0;
  }
  if (talent && talent.id === 'lifebloom') applyHeal(state, p, (talent.regen || 6) * dt);

  if (p.shieldTime > 0) {
    p.shieldTime -= dt;
    if (p.shieldTime <= 0) p.shield = 0;
  }

  p.mana = Math.min(p.maxMana, p.mana + MANA_REGEN * dt);
  p.ult = Math.min(ULT_MAX, (p.ult || 0) + ULT_REGEN * dt);
  if (state.flags && state.flags.freeMana) {
    p.mana = p.maxMana;
    p.ult = ULT_MAX;
  }
}
