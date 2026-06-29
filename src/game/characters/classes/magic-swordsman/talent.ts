import { registerTalent } from '../../talents/registry';
import { addFx } from '../../../entities/fx.ts';
import type { Player } from '../../../types';

const MAX_SE = 5;
const REGEN_TIME = 8.0;
const DR_PER = 0.03;
const MANA_PER_HIT = 5;
const MANA_RATIO = 0.08;

function se(p: Player) {
  if (!p.magicSwordsman) p.magicSwordsman = { swordEnergy: 5, regenTimer: 0, enhanced: false, enhancedTimer: 0 };
  return p.magicSwordsman;
}

registerTalent('arcane_contract', {
  // 雙消耗：劍氣不足則無法施放
  canCast(_state, p, slot, _talent) {
    if (slot === 'skill1' && se(p).swordEnergy < 1) return false;
    if (slot === 'skill2' && se(p).swordEnergy < 2) return false;
    if (slot === 'ultimate' && se(p).swordEnergy < 3) return false;
    return true;
  },

  // 魔力比例轉化為額外魔法傷害 + 魔刃強化 / 劍氣波強化 / 大絕劍氣增傷
  modifyOutgoing({ attacker, dmg }) {
    let bonus = dmg;
    const manaBonus = attacker.mana * MANA_RATIO;
    if (manaBonus > 0) bonus += manaBonus;
    const s = se(attacker);
    if (s.enhanced) bonus += dmg * 1.0;
    if (attacker._waveEnhancedTimer > 0) bonus += dmg * 0.5;
    if (attacker._ultStacks > 0) {
      bonus += dmg * 0.3 * attacker._ultStacks;
      attacker._ultStacks = 0;
    }
    return bonus;
  },

  // 劍氣層數提供減傷
  modifyIncoming({ target, dmg }) {
    const stacks = se(target).swordEnergy;
    if (stacks > 0) return dmg * (1 - stacks * DR_PER);
    return dmg;
  },

  // 命中回魔 + 疊劍氣
  onDealt({ attacker }) {
    if (!attacker.alive) return;
    const s = se(attacker);
    s.swordEnergy = Math.min(MAX_SE, s.swordEnergy + 1);
    s.regenTimer = 0;
    attacker.mana = Math.min(attacker.maxMana, attacker.mana + MANA_PER_HIT);
  },

  // 技能施放後：處理劍氣消耗與專屬效果
  onCastResolved(state, p, _action, slot, _talent) {
    const s = se(p);
    if (slot === 'skill1' && s.swordEnergy >= 1) {
      s.swordEnergy -= 1;
      s.regenTimer = 0;
      p._waveEnhancedTimer = 0.5;
      addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#00d2ff', life: 0.3, radius: 60, vfx: 'magic_swordsman_decay' });
      return;
    }
    if (slot === 'skill2' && s.swordEnergy >= 2) {
      s.swordEnergy -= 2;
      s.regenTimer = 0;
      s.enhanced = true;
      s.enhancedTimer = 5.0;
      addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#ffd700', life: 0.6, radius: 120, vfx: 'magic_swordsman_enhance' });
      return;
    }
    if (slot === 'ultimate') {
      const manaSpent = p.mana;
      p.mana = 0;
      const heal = (manaSpent / 10) * 6;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const consume = Math.min(s.swordEnergy, 5);
      if (consume >= 3) {
        s.swordEnergy -= consume;
        s.regenTimer = 0;
        p._ultStacks = consume;
      }
    }
  },
});

export function tickMagicSwordsman(state: any, p: Player, dt: number) {
  const s = se(p);
  if (s.swordEnergy < MAX_SE) {
    s.regenTimer += dt;
    while (s.regenTimer >= REGEN_TIME && s.swordEnergy < MAX_SE) {
      s.regenTimer -= REGEN_TIME;
      s.swordEnergy += 1;
      addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#00d2ff', life: 0.2, radius: 36, vfx: 'magic_swordsman_decay' });
    }
  } else {
    s.regenTimer = 0;
  }
  if (s.enhanced) {
    s.enhancedTimer -= dt;
    if (s.enhancedTimer <= 0) { s.enhanced = false; s.enhancedTimer = 0; }
  }
  if (p._waveEnhancedTimer > 0) {
    p._waveEnhancedTimer -= dt;
    if (p._waveEnhancedTimer <= 0) p._waveEnhancedTimer = 0;
  }
}
