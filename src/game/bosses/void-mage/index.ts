import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import { applyEffect } from '../../entities/effects.ts';
import { addFx } from '../../entities/fx.ts';
import { teamPlayers } from '../lifecycle.ts';
import './action.ts';

const scrambleAll = (duration = 4) => (state: any, boss: any) => {
  for (const p of teamPlayers(state)) {
    if (!p.alive) continue;
    applyEffect(p, 'scramble', { duration, color: '#b14fd8' }, boss.id);
    addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#b14fd8', life: 0.4, radius: 40 });
  }
};

const data = {
    id: 107, round: 8, name: '虛空大魔導', subtitle: '時空扭曲者',
    color: '#8e44ad', shape: 'circle', maxHp: 7500, maxMana: 999, speed: 150,
    baseHp: 7500,
    deathVfx: 'boss_void_death',
    appearance: {
      size: '等身 (約玩家 1.8 倍)，漂浮',
      style: '漂浮的宇宙魔導，紫黑星空長袍內流動星雲，周身環繞旋轉符文環，雙手凝聚扭曲空間的紫光。配色：虛空紫 #8e44ad + 星雲靛 #3d2b8e + 符文金光。',
      weapon: '空間扭曲術 (雙手施法)',
      telegraph: '扭曲前地面與目標身上浮現旋轉符文圈、畫面邊緣出現空間漣漪微光。',
    },
    ai: 'void_mage',
    mechanic: { rewind: true }, // 大招倒流玩家位置
    hint: '符咒會打亂你的移動、黑洞會把你吸進去、大招把你拉回幾秒前 —— 看到預警快閃開！',
    tags: [
      { icon: '🌀', text: '符咒會打亂你的操作' },
      { icon: '🕳️', text: '黑洞會吸入·別靠近' },
      { icon: '⏪', text: '大招會倒流你的位置' },
    ],
    hazardText: '🕳️ 被黑洞吸住了！快脫離',
    hazardColor: '#a06cff',
    theme: {
      sky: 0x0a0820, fog: 0x180e30, fogNear: 600, fogFar: 2200,
      floor: 0x261a45, ring: 0xa06cff,
      wallStone: 0x1f1535, wallTrim: 0xa06cff,
      hemiSky: 0xa06cff, hemiGround: 0x10081a, hemiInt: 0.45,
      sunColor: 0x9870e0, sunInt: 1.4, rimColor: 0xa06cff, rimInt: 0.6,
      decorations: ['crystal', 'pillar'],
      crystal: { count: 22, color: 0xc39bff, glow: 0x8e44ad, glowInt: 0.8 },
      pillar: { count: 8, color: 0x3a2a55 },
      atmosphere: { kind: 'stardust', color: '#c39bff', rate: 28 },
      floorDecal: { kind: 'arcane', color: '#c39bff', opacity: 0.45, glow: 0.5 },
    },

    phases: [
      { hpPct: 0.5, name: '規則崩壞', sub: '時空紊亂', color: '#b14fd8', dmgMult: 1.05, cdMult: 0.7,
        onEnter: scrambleAll(4),
        tagsOverride: [
          { icon: '🌀', text: '所有人操作被打亂' },
          { icon: '⏪', text: '時空扭曲頻率提高' },
          { icon: '🕳️', text: '黑洞範圍變大' },
        ] },
    ],

    basic: { name: '虛空彈', type: 'projectile', dmg: 28, speed: 760, radius: 14, lifetime: 1.6, count: 5, spread: 0.5, knockback: 50, cd: 1.1, windup: 0.35, telegraph: 'line', color: '#c39bff', vfx: 'boss_void_bolt' },
    skill1: { name: '混沌符咒', type: 'apply_scramble', radius: 480, duration: 2.4, cd: 8.3, windup: 0.5, telegraph: 'circle', color: '#b14fd8', vfx: 'boss_void_scramble' },
    skill2: { name: '奇點黑洞', type: 'zone', range: 280, radius: 300, dmg: 30, lifetime: 2.4, tick: 0.4, delay: 0.6, pull: 500, effect: SLOW(1.0, 0.5), cd: 9.8, windup: 0.5, telegraph: 'circle', color: '#5b2c8e', swapHit: true, vfx: 'boss_void_blackhole' },
    ultimate: { name: '時光倒流', type: 'time_rewind', rewindSeconds: 5.0, dmg: 90, radius: 220, cd: 15.0, windup: 0.6, telegraph: 'circle', color: '#a06cff', vfx: 'boss_void_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
