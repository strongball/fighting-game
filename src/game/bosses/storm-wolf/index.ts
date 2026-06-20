import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';

const data = {
    id: 106, round: 7, name: '風暴巨狼', subtitle: '狂暴之爪',
    color: '#4a6fa5', shape: 'triangle', maxHp: 7000, maxMana: 999, speed: 250,
    baseHp: 7000,
    appearance: {
      size: '等身偏大 (約玩家 2.2 倍)，低伏蓄勢',
      style: '籠罩雷暴的巨狼，深灰鬃毛間奔竄藍白電弧，雙眼發藍光，利爪帶電。奔跑時拖出殘影與雷光。配色：暴雲灰 #4a6fa5 + 雷電藍白 #aee3ff + 怒目藍。',
      weapon: '雷電利爪 + 撕咬',
      telegraph: '撲擊前壓低身軀、爪下迸放電火並投出衝刺線、雙眼閃光；起手極短，考驗反應。',
    },
    ai: 'storm_wolf',
    mechanic: { targetLowest: true, enrageBelow: 0.4, enrageHaste: 1.4 }, // 鎖最低血玩家；殘血暴怒加速
    hint: '牠專咬血最少的人 —— 被盯上就拉開距離！誘導撲擊撞石柱可暈眩 0.6s',
    environment: { pillars: { count: 7, hp: 200, r: 26, color: '#3a4a5c' } },
    theme: {
      sky: 0x1a2030, fog: 0x2a3040, fogNear: 700, fogFar: 2200,
      floor: 0x3a4658, ring: 0x7ec8ff,
      wallStone: 0x2a3242, wallTrim: 0xaee3ff,
      hemiSky: 0xaee3ff, hemiGround: 0x1a2230, hemiInt: 0.5,
      sunColor: 0xc0d6f0, sunInt: 1.6, rimColor: 0x7ec8ff, rimInt: 0.55,
      decorations: ['rock', 'crystal'],
      rock: { count: 18, color: 0x4a5266 },
      crystal: { count: 12, color: 0xaee3ff, glow: 0x7ec8ff, glowInt: 0.7 },
      atmosphere: { kind: 'ash', color: '#a0b0c8', rate: 10 },
      floorDecal: { kind: 'cracks', color: '#7ec8ff', opacity: 0.35, glow: 0.3 },
    },
    tags: [
      { icon: '🎯', text: '鎖定血最少的隊友' },
      { icon: '⚡', text: '起手極短·撲擊要快閃' },
      { icon: '🔴', text: '殘血會暴怒加速' },
    ],

    phases: [
      { hpPct: 0.6, name: '雷霆奔流', sub: '速度暴漲', color: '#7ec8ff', speedMult: 1.3, dmgMult: 1.2, cdMult: 0.8,
        tagsOverride: [
          { icon: '⚡', text: '速度大幅提升' },
          { icon: '🎯', text: '撲擊更頻繁' },
        ] },
      { hpPct: 0.3, name: '狂雷狼神', sub: '撕咬之怒', color: '#aef5ff', speedMult: 1.7, cdMult: 0.45, dmgMult: 1.4,
        tagsOverride: [
          { icon: '🔥', text: '極致暴怒 — 攻擊 +40%' },
          { icon: '⚡', text: '冷卻幾乎清零' },
          { icon: '🐺', text: '無視距離鎖定最低血' },
        ] },
    ],

    basic: { name: '雷爪連擊', type: 'melee', dmg: 28, range: 90, arc: 1.0, knockback: 100, cd: 0.5, windup: 0.2, telegraph: 'arc', color: '#aee3ff', vfx: 'boss_wolf_claw' },
    skill1: { name: '迅雷撲擊', type: 'leap', range: 360, dur: 0.35, dmg: 70, radius: 110, knockback: 200, effect: STUN(0.4), cd: 5, windup: 0.3, telegraph: 'line', color: '#7ec8ff', targetLowest: true, vfx: 'boss_wolf_pounce',
      chain: [{ slot: 'basic', windup: 0.15, delay: 0.2 }, { slot: 'basic', windup: 0.15, delay: 0.2 }] },
    skill2: { name: '暴風咆哮', type: 'buff', radius: 260, duration: 6, effect: { kind: 'rage', duration: 6, speed: 1.5, dmg: 1.4 }, cd: 12, windup: 0.5, telegraph: 'self', color: '#cfe8ff', knockbackAura: 260, vfx: 'boss_wolf_howl' },
    ultimate: { name: '雷霆亂舞', type: 'multiblink', count: 5, dmg: 60, knockback: 160, effect: STUN(0.3), cd: 16, windup: 0.6, telegraph: 'self', color: '#aee3ff', targetLowest: true, vfx: 'boss_wolf_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon });