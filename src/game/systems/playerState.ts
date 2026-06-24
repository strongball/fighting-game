import { PLAYER_RADIUS, MANA_REGEN, ULT_MAX, ULT_REGEN, COOLDOWN_MULTIPLIER, difficultyMult } from '../constants.js';
import { addFx } from '../entities/fx.ts';
import { getTalentHooks } from '../characters/talents/registry';
import type { GameState, Player } from '../types';

const COOLDOWN_SLOTS = ['basic', 'skill1', 'skill2', 'ultimate', 'evade'];

export function tickSummonLife(state: GameState, p: Player, dt: number): boolean {
  if (!(p.summonLife > 0)) return false;
  p.summonLife -= dt;
  if (p.summonLife > 0) return false;
  p.alive = false;
  addFx(state, { type: 'death', x: p.x, y: p.y, color: '#9b8cff', life: 0.4, radius: PLAYER_RADIUS * 1.6 });
  return true;
}

export function tickCharacterTimers(state: GameState, p: Player, character: any, talent: any, dt: number) {
  if (character.ultimate && character.ultimate.rewindSelf) {
    if (!p._chronoHist) p._chronoHist = [];
    p._chronoHist.push({ x: p.x, y: p.y, hp: p.hp });
    if (p._chronoHist.length > 130) p._chronoHist.shift();
  }
  getTalentHooks(talent?.id)?.onTimers?.(state, p, dt, talent); // 例：iaido 計時累積
  if (typeof character.tick === 'function') character.tick(state, p, dt);
}

export function tickCooldowns(state: GameState, p: Player, talent: any, dt: number) {
  let cdRate = 1;
  const cooldownRate = getTalentHooks(talent?.id)?.cooldownRate; // 例：bloodlust 失血加速
  if (cooldownRate) cdRate = cooldownRate(state, p, talent);
  cdRate /= COOLDOWN_MULTIPLIER;
  cdRate /= difficultyMult(state.flags.difficulty ?? 0.5).playerCd;
  for (const slot of COOLDOWN_SLOTS) {
    let rate = cdRate;
    if (slot === 'basic' && p.effects.overdrive && p.effects.overdrive.atkSpeed) {
      rate *= p.effects.overdrive.atkSpeed;
    }
    p.cd[slot] = Math.max(0, p.cd[slot] - dt * rate);
  }
  if (state.flags && state.flags.noCooldown && !p.isBoss) {
    for (const slot of COOLDOWN_SLOTS) p.cd[slot] = 0;
  }
}

export function tickPassiveRecovery(state: GameState, p: Player, talent: any, dt: number) {
  if (p.comboTimer > 0) {
    p.comboTimer -= dt;
    if (p.comboTimer <= 0) p.combo = 0;
  }
  getTalentHooks(talent?.id)?.onRecovery?.(state, p, dt, talent); // 例：lifebloom 持續回血

  if (p.shieldTime > 0) {
    p.shieldTime -= dt;
    if (p.shieldTime <= 0) p.shield = 0;
  }

  if (p.alive && p.hp < p.maxHp && !p.isBoss && !p.isPart) {
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.02 * dt);
  }

  p.mana = Math.min(p.maxMana, p.mana + MANA_REGEN * dt);
  p.ult = Math.min(ULT_MAX, (p.ult || 0) + ULT_REGEN * dt);
  if (state.flags && state.flags.freeMana && !p.isBoss) {
    p.mana = p.maxMana;
    p.ult = ULT_MAX;
  }
}
