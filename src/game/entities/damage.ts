import { PLAYER_RADIUS, ULT_MAX, ULT_GAIN_DEAL, ULT_GAIN_TAKE, difficultyMult } from '../constants.js';
import { getCharacter } from '../characters.js';
import { getTalentHooks, type TalentCtx } from '../characters/talents/registry';
import { prepareBossAction } from '../bosses/actions.ts';
import { applyBossDamageModifiers } from '../bosses/damage.ts';
import { getBoss } from '../bosses.js';
import { addFx } from './fx.ts';
import { applyHeal } from './heal.ts';
import { applyEffect } from './effects.ts';
import { recordDamage, recordKill, recordDeath } from './stats.ts';
import { isAlly, isEnemy } from './team.ts';
import { spawnDropFromMinion } from '../systems/items.ts';
import type { GameState, Player, EntityId } from '../types';

// ── 天賦（被動）系統導覽 ────────────────────────────────────────────
// 天賦「資料」定義於各角色 characters/classes/<slug>/index.ts 的 talent:{id,...}。
//
// 傷害管線的天賦邏輯已改為「與角色 co-located 的 hook registry」（characters/talents/registry.ts）：
// 各角色 classes/<slug>/talent.ts 內 registerTalent('<id>', { modifyOutgoing/modifyIncoming/
// onDealt/onAttacked })，本檔在 hot-path 依序查 registry 後呼叫，順序與原內聯一致。
//   - talentDamageMods(): target.modifyIncoming → attacker.modifyOutgoing →（warsong aura 仍內聯）
//   - dealDamage onAttacked 區: retribution（受擊反傷）
//   - dealDamage onDealt 區: 造成傷害後副作用（arcane_flow/bloodlust/momentum/suppress…）
// 新增「會影響傷害」的天賦＝加一個 talent.ts 註冊 hook，不必再改本檔。
//
// 生命週期 hook（playerState / casting）也走 registry：cooldownRate(bloodlust 攻速) /
// onTimers(iaido 計時) / onRecovery(lifebloom 回血) / onCastResolved(timeprism)。
//
// 仍內聯、尚未納入 registry 的天賦邏輯（aura / 跨實體 / 與施放序列緊密耦合）：
//   • entities/damage.ts   warsongFor()(warsong aura) / spreadCurse()(plague 死亡傳染) /
//                          summonbond 召喚物命中回主（owner 經召喚物，非攻擊方天賦）
//   • systems/effects.ts      undeath(DoT 汲取回血，見 dotLifesteal)
//   • actions/combat.ts       pyromancy(強化 burn) ；actions/casting.ts iaido 居合就緒判定
// 註：bulwark（坦克 鋼鐵壁壘）已實作於 classes/tank/talent.ts（modifyIncoming 減傷＋怒氣引擎）。
//     unbreakable 目前仍僅有資料定義，未見對應減傷邏輯（疑為待補）。
// ──────────────────────────────────────────────────────────────────

// 建立傳給天賦 hook 的情境（注入副作用 helper，避免 talent.ts 反向匯入 entities/* 造成循環）。
function talentCtx(state: GameState, attacker: Player, target: Player, dmg: number, talent: any): TalentCtx {
  return { state, attacker, target, dmg, talent, applyHeal, addFx };
}

function warsongFor(state: GameState, attacker: Player): number {
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

function spreadCurse(state: GameState, corpse: Player) {
  let hexer: Player | null = null;
  for (const other of Object.values(state.players)) {
    if (!other.alive) continue;
    const talent = getCharacter(other.charId).talent;
    if (talent && talent.id === 'plague') { hexer = other; break; }
  }
  if (!hexer) return;
  const weaken = corpse.effects.weaken;
  if (!weaken) return;
  const radius = (getCharacter(hexer.charId).talent.radius) || 200;
  for (const other of Object.values(state.players)) {
    if (other.id === corpse.id || !isEnemy(state, hexer.id, other)) continue;
    if (Math.hypot(other.x - corpse.x, other.y - corpse.y) <= radius) applyEffect(other, 'weaken', { duration: weaken.remaining, factor: weaken.factor });
  }
  addFx(state, { type: 'buff', x: corpse.x, y: corpse.y, color: '#bb6bd9', life: 0.4, radius, vfx: 'hexer_field' });
}

// 孵化寄生引爆：對宿主與半徑內敵人造成累積爆傷，並把弱化寄生擴散到附近敵人。
// 由「時間到 (systems/effects) / 再補一箭 (combat.applyEffectFrom) / 宿主死亡 (本檔死亡區)」呼叫。
// 進入時先移除寄生，避免「爆傷致死 → 死亡引爆 → 再次引爆」的遞迴。
export function hatchParasite(state: GameState, host: Player) {
  const par = host.effects && host.effects.parasite;
  if (!par) return;
  delete host.effects.parasite;
  const burst = Math.min(par.burstCap || 250, (par.stored || 0) * (par.burstMult || 1));
  const radius = par.burstRadius || 150;
  const srcId = par.srcId;
  addFx(state, { type: 'hit', x: host.x, y: host.y, color: '#1abc9c', life: 0.4, radius, vfx: 'archer_parasite' });
  for (const o of Object.values(state.players)) {
    if (!o.alive) continue;
    if (srcId != null && o.id === srcId) continue; // 不打施法者
    const isHost = o.id === host.id;
    if (!isHost && (!isEnemy(state, srcId, o) || Math.hypot(o.x - host.x, o.y - host.y) > radius)) continue;
    if (burst > 0) dealDamage(state, o, burst, srcId, { dot: true, source: par.srcSlot });
    // 擴散弱化寄生（只由主寄生 store>0 觸發；擴散出的 store=0 不再二次擴散）。
    if (!isHost && par.store > 0 && o.alive) {
      applyEffect(o, 'parasite', {
        duration: par.spreadDur || 3, tick: par.tick, dmg: par.dmg,
        vuln: par.vuln, vulnStep: 0, vulnMax: par.vulnMax,
        store: 0, burstMult: par.burstMult, burstCap: par.burstCap,
        burstRadius: radius, spreadDur: 0,
      }, srcId);
    }
  }
}

function talentDamageMods(state: GameState, attacker: Player, target: Player, amount: number): number {
  let dmg = amount;
  if (target && target.alive) {
    const dt = getCharacter(target.charId).talent;
    const th = dt && getTalentHooks(dt.id);
    if (th?.modifyIncoming) dmg = th.modifyIncoming(talentCtx(state, attacker, target, dmg, dt));
  }
  if (attacker && attacker.alive) {
    const at = getCharacter(attacker.charId).talent;
    const ah = at && getTalentHooks(at.id);
    if (ah?.modifyOutgoing) dmg = ah.modifyOutgoing(talentCtx(state, attacker, target, dmg, at));
    // warsong 為 aura（掃描友方 bard），非攻擊方自身天賦，暫留內聯。
    const warsong = warsongFor(state, attacker);
    if (warsong > 0) dmg *= 1 + warsong;
  }
  return dmg;
}

export function dealDamage(
  state: GameState,
  target: Player,
  amount: number,
  attackerId: EntityId,
  opts: { noTalent?: boolean; noReflect?: boolean; meleeHit?: boolean; dot?: boolean; source?: string | null } = {},
) {
  // Invulnerable entities do not take damage
  if (target.invulnerable) return;

  if (!target.alive || amount <= 0) return;
  if (target.effects && target.effects.evading) return;

  // 闖關登場動畫期間：全場無敵
  if (state.mode === 'boss' && state.roundPhase !== 'fighting') return;
  // 階段轉換 i-frame：Boss 短暫無敵
  if (target.isBoss && (target.phaseIframe || 0) > 0) return;
  // Boss 限界突破鎖血期間無敵
  if (target.isBoss && target.ultLockInvincible) return;

  const attacker = state.players[attackerId];
  const hostile = attacker && attacker.id !== target.id && attacker.alive;
  if (hostile) attacker.ult = Math.min(ULT_MAX, (attacker.ult || 0) + amount * ULT_GAIN_DEAL);
  if (state.flags && state.flags.noDamage && !target.isBoss) return;

  let dmg = amount;
  // 闖關模式：玩家召喚物對魔王傷害的承受衰減，讓召喚物能在魔王的高傷/AoE 下存活、
  // 作為吸引仇恨的肉牆（召喚流在打王模式的核心價值）。0.20 ≈ 有效血量 ×5。
  if (state.mode === 'boss' && (target.isMinion || target.isSummon) && target.ownerId) {
    const owner = state.players[target.ownerId];
    if (owner && !owner.isBoss) dmg *= 0.20;
  }
  if (hostile && attacker && (attacker.isMinion || attacker.isSummon) && attacker.ownerId) {
    const owner = state.players[attacker.ownerId];
    if (owner && !owner.isBoss) dmg *= 0.55;
  }
  if (!opts.noTalent && hostile) dmg = talentDamageMods(state, attacker, target, dmg);
  // Boss 階段傷害倍率 (含部位攻擊歸屬 Boss 本體時)。
  // ownerId 可能為 null，先安全取出 phaseOwner（行為等價於原本的內聯 state.players[ownerId]）。
  const phaseOwner = attacker && attacker.ownerId != null ? state.players[attacker.ownerId] : null;
  if (hostile && attacker && (attacker.isBoss || (attacker.isPart && attacker.ownerId)) && (attacker.phaseDmgMult || (phaseOwner && phaseOwner.phaseDmgMult))) {
    let mult = attacker.isBoss ? (attacker.phaseDmgMult || 1) : (phaseOwner?.phaseDmgMult || 1);
    mult *= difficultyMult(state.flags.difficulty ?? 0.5).bossDmg;
    dmg *= mult;
  }
  if (hostile && attacker.effects && attacker.effects.dmg_reduce) dmg *= 1 - (attacker.effects.dmg_reduce.factor || 0);
  if (hostile && attacker.damageDealtMult !== undefined) {
    dmg *= attacker.damageDealtMult;
  }
  if (target.isBoss) dmg = applyBossDamageModifiers(state, target, attacker, dmg);
  if (target.effects && target.effects.mark) dmg *= 1 + target.effects.mark.bonus;
  if (target.effects && target.effects.parasite) dmg *= 1 + (target.effects.parasite.vuln || 0);
  // 破綻窗口：Boss / 部位 (含 owner Boss 的破綻) 收招期間受傷 +30% (重招破綻 +45%)
  if (hostile && target.isBoss && (target.recoverWindow || 0) > 0) {
    dmg *= target.recoverHeavy ? 1.45 : 1.3;
  }
  if (hostile && target.isPart && target.ownerId) {
    const owner = state.players[target.ownerId];
    if (owner && (owner.recoverWindow || 0) > 0) dmg *= owner.recoverHeavy ? 1.45 : 1.3;
  }
  if (target.effects && target.effects.weaken) dmg *= 1 + (target.effects.weaken.factor || 0);
  if (target.effects && target.effects.protect) dmg *= 1 - (target.effects.protect.factor || 0);
  // 近戰減傷：近戰角色受傷 ×0.85 (補生存)
  if (hostile && !target.isBoss && !target.ownerId) {
    const tc = getCharacter(target.charId);
    if (tc.meleeRole) dmg *= 0.85;
  }

  if (!opts.noReflect && hostile && target.effects && target.effects.reflect) {
    const reflectDamage = dmg * (target.effects.reflect.factor || 0);
    if (reflectDamage > 0) dealDamage(state, attacker, reflectDamage, target.id, { noReflect: true, noTalent: true, source: 'reflect' });
  }
  if (!opts.noReflect && hostile) {
    const tt = getCharacter(target.charId).talent;
    const th = tt && getTalentHooks(tt.id);
    if (th?.onAttacked) {
      const reflectDamage = th.onAttacked(talentCtx(state, attacker, target, dmg, tt));
      if (reflectDamage && reflectDamage > 0) dealDamage(state, attacker, reflectDamage, target.id, { noReflect: true, noTalent: true, source: 'reflect' });
    }
  }

  let shieldAbsorbed = 0;
  if (target.shield > 0) {
    shieldAbsorbed = Math.min(target.shield, dmg);
    target.shield -= shieldAbsorbed;
    dmg -= shieldAbsorbed;
  }
  if (shieldAbsorbed > 0) {
    addFx(state, { type: 'popup', x: target.x, y: target.y, color: '#f7fbff', life: 0.75, text: Math.round(shieldAbsorbed), kind: 'shield' });
  }
  if (dmg <= 0) return;
  target.ult = Math.min(ULT_MAX, (target.ult || 0) + dmg * ULT_GAIN_TAKE);

  // 20% Health-lock forced ultimate cast mechanism for bosses
  if (target.isBoss && !target.ultLockTriggered) {
    const threshold = target.maxHp * 0.2;
    if (target.hp - dmg <= threshold) {
      dmg = Math.max(0, target.hp - threshold);
      target.ultLockTriggered = true;
      target.ultLockInvincible = true;
      target.ultLockInvincibleTimer = 5;
      target.isCastingLockHpUlt = true;
      target.desperation = true;

      // Cleanse all status effects/debuffs
      applyEffect(target, 'cleanse');

      // Clear charge state if any
      target.chargeState = null;

      // Setup the forced ultimate cast in the AI
      const character = getCharacter(target.charId);
      const action = character.ultimate;
      if (action) {
        // Clear CD of ultimate
        target.cd.ultimate = 0;

        // Force the AI state
        const s = target.aiState || (target.aiState = {});
        s.mode = 'windup';
        s.slot = 'ultimate';

        const rawWindup = target.phaseIdx >= 2 && action.finalPhaseWindup != null
          ? action.finalPhaseWindup
          : (action.windup != null ? action.windup : 0.5);
        s.windupT = Math.max(1.0, rawWindup);
        s.totalWindupT = s.windupT;
        s.chainQueue = null;
        s.precalculatedZones = null;
        s.preselectedSoulBindPairs = null;
        s.stolenUltimate = null;
        s.safeLeft = null;

        // Custom boss mechanics (such as Round 11 time anchors) must also be
        // prepared when the global 20% lock forces an ultimate directly.
        prepareBossAction(state, target, action, {} as any);

        // Aim at the nearest player/enemy
        const enemies = [];
        for (const o of Object.values(state.players) as any[]) {
          if (o.alive && isEnemy(state, target.id, o)) enemies.push(o);
        }
        if (enemies.length > 0) {
          let closest = null, bd = Infinity;
          for (const o of enemies) {
            const d = Math.hypot(o.x - target.x, o.y - target.y);
            if (d < bd) { bd = d; closest = o; }
          }
          if (closest) {
            s.aimAng = Math.atan2(closest.y - target.y, closest.x - target.x);
            s.lastTargetX = closest.x;
            s.lastTargetY = closest.y;
          } else {
            s.aimAng = target.facing;
          }
        } else {
          s.aimAng = target.facing;
        }
      }

      // Show screen banner and ultimate visual effect
      state.banner = {
        text: '奧義·限界突破',
        sub: `${target.name} 進入無敵狀態，釋放終極大招！`,
        life: 2.0,
        kind: 'phase',
        color: '#ff3333'
      };

      addFx(state, {
        type: 'ultimate',
        x: target.x, y: target.y, facing: target.facing,
        color: '#ff3333',
        life: 1.2, radius: 400,
        isBoss: true
      });
      addFx(state, {
        type: 'ultimate',
        x: target.x, y: target.y, facing: target.facing,
        color: '#ffffff',
        life: 0.8, radius: 250,
        isBoss: true
      });
    }
  }

  target.hp -= dmg;

  // 孵化寄生：弓箭手命中被寄生目標 → 餵食（累積待引爆傷害）+ 疊加易傷。排除 DoT/引爆自身觸發。
  if (hostile && !opts.dot && target.effects && target.effects.parasite && target.effects.parasite.srcId === attacker.id) {
    const par = target.effects.parasite;
    par.stored += dmg * (par.store || 0);
    par.vuln = Math.min(par.vulnMax || 0.36, (par.vuln || 0) + (par.vulnStep || 0));
  }

  const isCrit = dmg >= amount * 1.35 || dmg >= 30;
  addFx(state, { type: 'popup', x: target.x, y: target.y, color: isCrit ? '#ffd166' : '#ff5050', life: 0.85, text: Math.round(dmg), kind: isCrit ? 'crit' : 'damage' });
  // DPS 歸因來源：召喚物傷害一律歸 'summon'；否則優先用明確 opts.source（deferred 實體標籤），
  // 其次同步施放期的 attacker._srcSlot（executor 設定），最後 DoT→'dot'、不明→'other'。
  let dmgSource: string;
  if (attacker && (attacker.isMinion || attacker.isSummon)) dmgSource = 'summon';
  else if (opts.source != null) dmgSource = opts.source;
  else if (attacker && attacker._srcSlot != null) dmgSource = attacker._srcSlot;
  else dmgSource = opts.dot ? 'dot' : 'other';
  recordDamage(state, attackerId, target, dmg, { isCrit, source: dmgSource });

  if (hostile && attacker.effects && attacker.effects.lifesteal) {
    const lifesteal = dmg * (attacker.effects.lifesteal.factor || 0);
    if (lifesteal > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + lifesteal);
      addFx(state, { type: 'popup', x: attacker.x, y: attacker.y, color: '#5cffa6', life: 0.7, text: `+${Math.round(lifesteal)}`, kind: 'heal' });
    }
  }
  // 近戰命中回血：近戰角色普攻 / 近戰技命中目標回 4% 傷害
  if (hostile && attacker && !attacker.isBoss && !attacker.ownerId && opts.meleeHit) {
    const ac = getCharacter(attacker.charId);
    if (ac.meleeRole && attacker.alive && attacker.hp < attacker.maxHp) {
      const heal = dmg * 0.04;
      if (heal >= 0.5) {
        attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      }
    }
  }
  if (!opts.noTalent && hostile) {
    const at = getCharacter(attacker.charId).talent;
    const ah = at && getTalentHooks(at.id);
    if (ah?.onDealt) ah.onDealt(talentCtx(state, attacker, target, dmg, at));
  }
  // summonbond：召喚物命中敵人時回血給主人（owner 經召喚物觸發，非攻擊方自身天賦，暫留內聯）。
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
    if (target.effects && target.effects.parasite) hatchParasite(state, target);
    const bossDeathVfx = target.isBoss && state.mode === 'boss' ? getBoss(target.charId as number)?.data?.deathVfx : null;
    if (!bossDeathVfx) {
      addFx(state, { type: 'death', x: target.x, y: target.y, color: '#ffffff', life: 0.5, radius: PLAYER_RADIUS * 2 });
    }
    if (state.mode === 'boss' && (target.isMinion || target.isSummon)) {
      spawnDropFromMinion(state, target.x, target.y);
    }
    if (target.isBoss && state.mode === 'boss') {
      state.timeFreeze = { scale: 0.3, remaining: 0.8 };
      state.banner = { text: 'BOSS DOWN', sub: target.name || '', life: 1.0, kind: 'phase', color: '#ffd166' };
      if (bossDeathVfx) {
        addFx(state, { type: 'death', x: target.x, y: target.y, facing: target.facing, color: target.color || '#ffd166', life: 1.4, radius: 360, vfx: bossDeathVfx });
      } else {
        addFx(state, { type: 'ultimate', x: target.x, y: target.y, facing: target.facing, color: '#ffd166', life: 1.0, radius: 320 });
        addFx(state, { type: 'ultimate', x: target.x, y: target.y, facing: target.facing, color: '#ffffff', life: 0.6, radius: 180 });
      }
    }
  }
}
