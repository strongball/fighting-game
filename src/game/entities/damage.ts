// @ts-nocheck
import { PLAYER_RADIUS, ULT_MAX, ULT_GAIN_DEAL, ULT_GAIN_TAKE } from '../constants.js';
import { getCharacter } from '../characters.js';
import { applyBossDamageModifiers } from '../bosses/damage.ts';
import { angleDiff, missingHp } from './math.ts';
import { addFx } from './fx.ts';
import { applyHeal } from './heal.ts';
import { applyEffect } from './effects.ts';
import { recordDamage, recordKill, recordDeath } from './stats.ts';
import { isAlly, isEnemy } from './team.ts';

function warsongFor(state, attacker) {
  let best = 0;
  for (const bard of Object.values(state.players)) {
    if (!bard.alive) continue;
    const talent = getCharacter(bard.charId).talent;
    if (!talent || talent.id !== 'warsong') continue;
    if (!(bard.id === attacker.id || isAlly(state, bard.id, attacker))) continue;
    const radius = talent.radius || 250;
    if (Math.hypot(bard.x - attacker.x, bard.y - attacker.y) > radius) continue;
    let allies = 0;
    for (const other of Object.values(state.players)) {
      if (!other.alive) continue;
      if (!(other.id === bard.id || isAlly(state, bard.id, other))) continue;
      if (Math.hypot(bard.x - other.x, bard.y - other.y) <= radius) allies++;
    }
    best = Math.max(best, Math.min(talent.maxAllies || 3, Math.max(0, allies - 1)) * (talent.perAlly || 0.05));
  }
  return best;
}

function spreadCurse(state, corpse) {
  let hexer = null;
  for (const other of Object.values(state.players)) {
    if (!other.alive) continue;
    const talent = getCharacter(other.charId).talent;
    if (talent && talent.id === 'plague') { hexer = other; break; }
  }
  if (!hexer) return;
  const weaken = corpse.effects.weaken;
  const radius = (getCharacter(hexer.charId).talent.radius) || 200;
  for (const other of Object.values(state.players)) {
    if (other.id === corpse.id || !isEnemy(state, hexer.id, other)) continue;
    if (Math.hypot(other.x - corpse.x, other.y - corpse.y) <= radius) applyEffect(other, 'weaken', { duration: weaken.remaining, factor: weaken.factor });
  }
  addFx(state, { type: 'buff', x: corpse.x, y: corpse.y, color: '#bb6bd9', life: 0.4, radius, vfx: 'hexer_field' });
}

function talentDamageMods(state, attacker, target, amount) {
  let dmg = amount;
  if (target && target.alive) {
    const dt = getCharacter(target.charId).talent;
    if (dt && dt.id === 'summonbond') {
      let n = 0;
      for (const other of Object.values(state.players)) if (other.isMinion && other.ownerId === target.id && other.alive) n++;
      if (n > 0) dmg *= 1 - Math.min(dt.maxStacks || 3, n) * (dt.dr || 0.1);
    }
  }
  if (attacker && attacker.alive) {
    const at = getCharacter(attacker.charId).talent;
    if (at) {
      if (at.id === 'deadeye') {
        const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
        dmg *= 1 + (at.bonus || 0.5) * Math.min(1, d / (at.range || 520));
      } else if (at.id === 'lethal') {
        const behind = Math.abs(angleDiff(Math.atan2(attacker.y - target.y, attacker.x - target.x), target.facing)) > Math.PI - (at.arc || 1.2);
        if ((attacker.effects && attacker.effects.invis) || behind) dmg *= 1 + (at.bonus || 0.6);
      } else if (at.id === 'momentum') {
        const stacks = Math.min(at.maxStacks || 5, attacker.combo || 0);
        if (stacks > 0) dmg *= 1 + stacks * (at.perStack || 0.1);
      } else if (at.id === 'shadowstrike') {
        const effects = target.effects || {};
        if (effects.stun || effects.root || effects.slow || effects.chill || effects.frozen) dmg *= 1 + (at.bonus || 0.35);
      } else if (at.id === 'suppress') {
        if (attacker.suppressTarget === target.id) {
          const stacks = Math.min(at.maxStacks || 5, attacker.suppressStacks || 0);
          if (stacks > 0) dmg *= 1 + stacks * (at.perStack || 0.08);
        }
      }
    }
    const warsong = warsongFor(state, attacker);
    if (warsong > 0) dmg *= 1 + warsong;
  }
  return dmg;
}

export function dealDamage(state, target, amount, attackerId, opts = {}) {
  if (!target.alive || amount <= 0) return;
  if (target.effects && target.effects.evading) return;
  // 闖關登場動畫期間：全場無敵
  if (state.mode === 'boss' && state.roundPhase !== 'fighting') return;
  // 階段轉換 i-frame：Boss 短暫無敵
  if (target.isBoss && (target.phaseIframe || 0) > 0) return;

  const attacker = state.players[attackerId];
  const hostile = attacker && attacker.id !== target.id && attacker.alive;
  if (hostile) attacker.ult = Math.min(ULT_MAX, (attacker.ult || 0) + amount * ULT_GAIN_DEAL);
  if (state.flags && state.flags.noDamage) return;

  let dmg = amount;
  if (state.mode === 'boss' && (target.isMinion || target.isSummon) && target.ownerId) {
    const owner = state.players[target.ownerId];
    if (owner && !owner.isBoss) dmg *= 0.2;
  }
  if (hostile && attacker && (attacker.isMinion || attacker.isSummon) && attacker.ownerId) {
    const owner = state.players[attacker.ownerId];
    if (owner && !owner.isBoss) dmg *= 0.55;
  }
  if (!opts.noTalent && hostile) dmg = talentDamageMods(state, attacker, target, dmg);
  // Boss 階段傷害倍率 (含部位攻擊歸屬 Boss 本體時)
  if (hostile && attacker && (attacker.isBoss || (attacker.isPart && attacker.ownerId)) && (attacker.phaseDmgMult || (state.players[attacker.ownerId] && state.players[attacker.ownerId].phaseDmgMult))) {
    const mult = attacker.isBoss ? (attacker.phaseDmgMult || 1) : (state.players[attacker.ownerId].phaseDmgMult || 1);
    dmg *= mult;
  }
  if (hostile && attacker.effects && attacker.effects.dmg_reduce) dmg *= 1 - (attacker.effects.dmg_reduce.factor || 0);
  if (target.isBoss) dmg = applyBossDamageModifiers(state, target, attacker, dmg);
  if (target.effects && target.effects.mark) dmg *= 1 + target.effects.mark.bonus;
  if (target.effects && target.effects.weaken) dmg *= 1 + (target.effects.weaken.factor || 0);
  if (target.effects && target.effects.protect) dmg *= 1 - (target.effects.protect.factor || 0);

  if (!opts.noReflect && hostile && target.effects && target.effects.reflect) {
    const reflectDamage = dmg * (target.effects.reflect.factor || 0);
    if (reflectDamage > 0) dealDamage(state, attacker, reflectDamage, target.id, { noReflect: true, noTalent: true });
  }
  if (!opts.noReflect && hostile) {
    const targetTalent = getCharacter(target.charId).talent;
    if (targetTalent && targetTalent.id === 'retribution') {
      const reflectDamage = dmg * (targetTalent.factor || 0.15);
      if (reflectDamage > 0) dealDamage(state, attacker, reflectDamage, target.id, { noReflect: true, noTalent: true });
    }
  }

  let shieldAbsorbed = 0;
  if (target.shield > 0) {
    shieldAbsorbed = Math.min(target.shield, dmg);
    target.shield -= shieldAbsorbed;
    dmg -= shieldAbsorbed;
  }
  if (shieldAbsorbed > 0) {
    addFx(state, { type: 'popup', x: target.x, y: target.y, color: '#7ad8ff', life: 0.75, text: Math.round(shieldAbsorbed), kind: 'shield' });
  }
  if (dmg <= 0) return;
  target.ult = Math.min(ULT_MAX, (target.ult || 0) + dmg * ULT_GAIN_TAKE);
  target.hp -= dmg;

  const isCrit = dmg >= amount * 1.35 || dmg >= 30;
  addFx(state, { type: 'popup', x: target.x, y: target.y, color: isCrit ? '#ffd166' : '#ff5050', life: 0.85, text: Math.round(dmg), kind: isCrit ? 'crit' : 'damage' });
  recordDamage(state, attackerId, target, dmg, { isCrit });

  if (hostile && attacker.effects && attacker.effects.lifesteal) {
    const lifesteal = dmg * (attacker.effects.lifesteal.factor || 0);
    if (lifesteal > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
      addFx(state, { type: 'popup', x: attacker.x, y: attacker.y, color: '#5cffa6', life: 0.7, text: `+${Math.round(lifesteal)}`, kind: 'heal' });
    }
  }
  if (!opts.noTalent && hostile) {
    const at = getCharacter(attacker.charId).talent;
    if (at) {
      if (at.id === 'arcane_flow') attacker.mana = Math.min(attacker.maxMana, attacker.mana + (at.mana || 8));
      else if (at.id === 'bloodlust') {
        const lifesteal = dmg * (at.lifesteal || 0.25) * (0.4 + missingHp(attacker));
        if (lifesteal > 0) {
          attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
          addFx(state, { type: 'popup', x: attacker.x, y: attacker.y, color: '#5cffa6', life: 0.7, text: `+${Math.round(lifesteal)}`, kind: 'heal' });
        }
      } else if (at.id === 'momentum') {
        attacker.combo = Math.min(at.maxStacks || 5, (attacker.combo || 0) + 1);
        attacker.comboTimer = at.window || 2.2;
      } else if (at.id === 'suppress') {
        if (attacker.suppressTarget === target.id) attacker.suppressStacks = Math.min(at.maxStacks || 5, (attacker.suppressStacks || 0) + 1);
        else { attacker.suppressTarget = target.id; attacker.suppressStacks = 1; }
      }
    }
  }
  if (hostile && attacker.isMinion && attacker.ownerId) {
    const owner = state.players[attacker.ownerId];
    if (owner && owner.alive) {
      const ownerTalent = getCharacter(owner.charId).talent;
      if (ownerTalent && ownerTalent.id === 'summonbond') applyHeal(state, owner, ownerTalent.heal || 5);
    }
  }

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    const killer = state.players[attackerId];
    // 小兵/召喚物/分身/魔王部位 不計入擊殺數；若擊殺者本身是召喚物，擊殺歸功於召喚者
    const targetCounts = !target.isSummon && !target.isMinion && !target.isFake && !target.isPart;
    if (killer && killer.id !== target.id && targetCounts) {
      const owner = (killer.isMinion || killer.isSummon) && killer.ownerId ? state.players[killer.ownerId] : null;
      (owner || killer).kills++;
    }
    recordKill(state, attackerId, target);
    recordDeath(state, target);
    if (target.effects && target.effects.weaken) spreadCurse(state, target);
    addFx(state, { type: 'death', x: target.x, y: target.y, color: '#ffffff', life: 0.5, radius: PLAYER_RADIUS * 2 });
    // 闖關 Boss 擊破：全場慢動作 + 巨型爆閃 + 「BOSS DOWN」橫幅
    if (target.isBoss && state.mode === 'boss') {
      state.timeFreeze = { scale: 0.3, remaining: 0.8 };
      state.banner = { text: 'BOSS DOWN', sub: target.name || '', life: 1.0, kind: 'phase', color: '#ffd166' };
      addFx(state, { type: 'ultimate', x: target.x, y: target.y, facing: target.facing, color: '#ffd166', life: 1.0, radius: 320 });
      addFx(state, { type: 'ultimate', x: target.x, y: target.y, facing: target.facing, color: '#ffffff', life: 0.6, radius: 180 });
    }
  }
}
