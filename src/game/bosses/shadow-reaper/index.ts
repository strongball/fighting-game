// @ts-nocheck
import { BaseBoss } from '../BaseBoss.ts';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import { triggerShadowExplosion, spawnUltZones } from './action.ts';
import { makeZone } from '../../entities/factories.ts';
import { dealDamage } from '../../entities/damage.ts';
import { applyEffect } from '../../entities/effects.ts';
import { clamp } from '../../entities/math.ts';
import { PLAYER_RADIUS, ARENA } from '../../constants.js';

function updateBossCrosses(state: any, ent: any, dt: number) {
  if (ent._ultCrossRemaining !== undefined && ent._ultCrossRemaining > 0) {
    ent._ultCrossTimer -= dt;
    if (ent._ultCrossTimer <= 0) {
      ent._ultCrossTimer += 3.0;
      ent._ultCrossRemaining--;

      const target = state.players[ent._ultSlamTargetId];
      if (target && target.alive) {
        const patternIndex = 2 - ent._ultCrossRemaining;
        spawnUltZones(state, ent.id, target.x, target.y, patternIndex);
      }
    }
  }
}

const data = {
  id: 115,
  name: '幽冥影刃',
  subtitle: '影之支配者',
  color: '#aa33ff',
  shape: 'circle',
  maxHp: 5000,
  baseHp: 5000,
  maxMana: 999,
  speed: 200,
  ai: 'shadow_reaper',

  appearance: {
    size: '等身 (約玩家 1.5 倍)，飄逸神祕',
    style: '身披幽暗長袍與兜帽的影之刺客，周身環繞暗紫霧氣。配色：深紫 #aa33ff + 暗影黑 #1a0033。',
    weapon: '雙暗影匕首',
    telegraph: '施法時雙手影刃發出亮紫色光芒；瞬移前原地留下紫色殘影；大招釋放時全身化為虛無消失。',
  },

  hint: '當心牠的「隱影突襲」！如果被牠從背後刺殺，會受到雙倍傷害並被暈眩。多利用牠召喚的分身來分擔傷害。',
  tags: [
    { icon: '👥', text: '召喚分身並共享位移' },
    { icon: '🗡️', text: '背刺會造成雙倍傷害' },
    { icon: '👻', text: '隱影突襲會完全隱身' },
  ],

  hazardText: '🌚 一片漆黑！你被致盲了！',
  hazardColor: '#aa33ff',

  theme: {
    sky: 0x0c001a, fog: 0x1f0033, fogNear: 600, fogFar: 2000,
    floor: 0x140026, ring: 0xaa33ff,
    wallStone: 0x220a3a, wallTrim: 0xaa33ff,
    hemiSky: 0x5a189a, hemiGround: 0x100020, hemiInt: 0.5,
    sunColor: 0xbb86fc, sunInt: 1.2, rimColor: 0xaa33ff, rimInt: 0.6,
    decorations: ['crystal'],
    crystal: { count: 30, color: 0xaa33ff, glow: 0xd8b3ff, glowInt: 0.9 },
    atmosphere: { kind: 'snow', rate: 10 }, // 暗影塵埃
    floorDecal: { kind: 'cracks', color: '#aa33ff', opacity: 0.35, glow: 0.2 },
  },

  phases: [
    {
      hpPct: 0.5,
      name: '無盡暗影',
      sub: '攻速提升與分身自爆',
      color: '#aa33ff',
      dmgMult: 1.2,
      speedMult: 1.2,
      cdMult: 0.75,
      tagsOverride: [
        { icon: '👥', text: '影鏡互換冷卻減半' },
        { icon: '💥', text: '分身死亡時會產生暗影爆炸' },
        { icon: '⚡', text: '速度與傷害提升' },
      ],
    },
  ],

  basic: {
    name: '影刃飛擲',
    type: 'projectile',
    dmg: 25,
    speed: 650,
    spread: 0.15,
    count: 3,
    radius: 12,
    lifetime: 1.5,
    color: '#aa33ff',
    vfx: 'boss_shadow_shuriken',
    effect: { kind: 'blind', duration: 1.5 },
    cd: 0.4,
    windup: 0.2
  },
  skill1: {
    name: '影步瞬斬',
    type: 'shadow_blink_slash',
    dmg: 70,
    radius: 150,
    cd: 7.0,
    windup: 1.0,
    color: '#aa33ff'
  },
  skill2: {
    name: '影鏡互換',
    type: 'summon_shadow_clone',
    cd: 9.0,
    windup: 0.4,
    color: '#bb66ff',
    vfx: 'boss_shadow_swap'
  },
  ultimate: {
    name: '萬影千殺陣',
    type: 'shadow_execution',
    cd: 30.0,
    windup: 1.5,
    color: '#8800ff',
    vfx: 'boss_shadow_ult',
    suppressWindupTelegraph: true
  },

  tick(state: any, boss: any, dt: number) {
    if (boss.isFake) return;

    if (boss._lastHp === undefined) {
      boss._lastHp = boss.hp;
    }

    // 尋找所有活著的分身
    const clones: any[] = [];
    for (const p of Object.values(state.players) as any[]) {
      if (p.alive && p.ownerId === boss.id && p.isFake && p.charId === boss.charId) {
        clones.push(p);
      }
    }

    // 0. 更新分身存活時間 (若大絕招沒有啟動)
    const isUltActive = boss.isUltDisappeared || (boss._ultSlamTimer !== undefined && boss._ultSlamTimer > 0);
    clones.forEach((clone) => {
      if (clone.lifetime !== undefined && !isUltActive) {
        clone.lifetime -= dt;
        if (clone.lifetime <= 0) {
          clone.alive = false;
          // 在二階段觸發死亡自爆
          if (boss.phaseIdx >= 1) {
            triggerShadowExplosion(state, clone);
          }
          delete state.players[clone.id];
        }
      }
    });

    // 重新過濾剩餘活著的分身以進行後續互換
    const activeClones = clones.filter(c => c.alive);

    // 2. 受到傷害時自動與分身交換位置以躲避傷害
    if (boss.hp < boss._lastHp) {
      const clone = activeClones[0];
      if (clone && (!boss._swapCd || boss._swapCd <= 0)) {
        const bx = boss.x, by = boss.y;
        boss.x = clone.x; boss.y = clone.y;
        clone.x = bx; clone.y = by;

        // 冷卻時間：二階段 2 秒，一階段 4 秒
        boss._swapCd = boss.phaseIdx >= 1 ? 2.0 : 4.0;

        // 交換特效
        state.fx.push({ type: 'blink', x: boss.x, y: boss.y, color: '#aa33ff', life: 0.4, radius: 60 });
        state.fx.push({ type: 'blink', x: clone.x, y: clone.y, color: '#aa33ff', life: 0.4, radius: 60 });
      }
    }

    if (boss._swapCd > 0) boss._swapCd -= dt;
    boss._lastHp = boss.hp;

    // 更新大絕招十字預警
    updateBossCrosses(state, boss, dt);
    clones.forEach((clone) => {
      updateBossCrosses(state, clone, dt);
    });

    // 3. 針對每個分身的大絕招重擊落下計時器
    clones.forEach((clone) => {
      if (clone._ultSlamTimer !== undefined && clone._ultSlamTimer > 0) {
        clone._ultSlamTimer -= dt;
        if (clone._ultSlamTimer <= 0) {
          clone._ultSlamTimer = 0;
          clone.isUltDisappeared = false;

          const target = state.players[clone._ultSlamTargetId];
          if (target && target.alive) {
            const distBehind = 60;
            const targetFacing = target.facing || 0;
            clone.x = clamp(target.x - Math.cos(targetFacing) * distBehind, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
            clone.y = clamp(target.y - Math.sin(targetFacing) * distBehind, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
            clone.facing = targetFacing;
          }

          state.fx.push({ type: 'hit', x: clone.x, y: clone.y, color: '#8800ff', life: 0.5, radius: 180, vfx: 'boss_shadow_ult_warning' });

          state.zones.push(makeZone(clone.id, clone.x, clone.y, {
            radius: 180,
            dmg: 50,
            lifetime: 0.5,
            tick: 0.5,
            delay: 1.2,
            color: '#aa33ff',
            vfx: 'boss_shadow_ult_slam',
            srcSlot: 'ultimate'
          }));
        }
      }
    });

    // 終極大招重擊落下計時器（先降下預警，再延遲現身）
    if (boss._ultSlamTimer !== undefined && boss._ultSlamTimer > 0) {
      boss._ultSlamTimer -= dt;
      if (boss._ultSlamTimer <= 0) {
        boss._ultSlamTimer = 0;

        // 瞬移至目標背後（保持消失狀態）
        const target = state.players[boss._ultSlamTargetId];
        if (target && target.alive) {
          const distBehind = 60;
          const targetFacing = target.facing || 0;
          boss.x = clamp(target.x - Math.cos(targetFacing) * distBehind, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
          boss.y = clamp(target.y - Math.sin(targetFacing) * distBehind, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
          boss.facing = targetFacing;
        }

        // 預警特效 + 延遲傷害區域（地面預警圈 1.2s）
        state.fx.push({ type: 'hit', x: boss.x, y: boss.y, color: '#8800ff', life: 0.5, radius: 180, vfx: 'boss_shadow_ult_warning' });

        state.zones.push(makeZone(boss.id, boss.x, boss.y, {
          radius: 180,
          dmg: 50,
          lifetime: 0.5,
          tick: 0.5,
          delay: 1.2,
          color: '#aa33ff',
          vfx: 'boss_shadow_ult_slam',
          srcSlot: 'ultimate'
        }));

        // 延遲現身計時器（配合炸地板時間）
        boss._ultSlamAppearTimer = 1.2;
      }
    }

    // Boss 延遲現身：與 slam 震波同步
    if (boss._ultSlamAppearTimer !== undefined && boss._ultSlamAppearTimer > 0) {
      boss._ultSlamAppearTimer -= dt;
      if (boss._ultSlamAppearTimer <= 0) {
        boss._ultSlamAppearTimer = 0;
        boss.isUltDisappeared = false;

        // 分身同時現身並散開
        const currentClones: any[] = [];
        for (const p of Object.values(state.players) as any[]) {
          if (p.alive && p.ownerId === boss.id && p.isFake && p.charId === boss.charId) {
            currentClones.push(p);
          }
        }
        currentClones.forEach((clone) => {
          clone.isUltDisappeared = false;
          const ang = Math.random() * Math.PI * 2;
          clone.x = Math.max(80, Math.min(1600 - 80, boss.x + Math.cos(ang) * 280));
          clone.y = Math.max(80, Math.min(1200 - 80, boss.y + Math.sin(ang) * 280));
        });
      }
    }
  },

  cleanup(state: any) {
    // 清理分身
    for (const key of Object.keys(state.players)) {
      const o = state.players[key];
      if (o.ownerId === data.id && o.isFake) {
        o.alive = false;
        delete state.players[key];
      }
    }
  }
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
