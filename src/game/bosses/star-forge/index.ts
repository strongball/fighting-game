import { BaseBoss } from '../BaseBoss.ts';
import { SLOW } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';

const data = {
  id: 111, round: 12, name: '阿斯特里昂', subtitle: '星爐鑄神',
  color: '#e69a38', shape: 'square', maxHp: 17500, baseHp: 17500, maxMana: 999, speed: 165,
  deathVfx: 'boss_star_forge_death',
  appearance: {
    size: '極巨大（約玩家 3.2 倍）',
    style: '黑曜石與暗金構成的星界巨神，胸腔是一座旋轉恆星熔爐；甲縫流淌熔金，背後懸浮青色冷卻環。',
    weapon: '右手星鐵巨錘、左臂引力鍛鉗',
    telegraph: '巨錘落下前由橙轉白；引力啟動前左臂與地面星塵向內收縮；翻轉熔爐時半場分別染成熔金與冷卻青。',
  },
  ai: 'star_forge',
  hint: '看清熔爐翻面的青色安全半場！躲過翻面後靠近輸出，再閃開緊接而來的巨錘。',
  tags: [
    { icon: '❄️', text: '青色半場安全' },
    { icon: '☄️', text: '隕星會錯開墜落' },
    { icon: '🔨', text: '翻面後必接巨錘' },
  ],
  hazardText: '🔥 熔爐翻面！立刻進入青色半場',
  hazardColor: '#ffb347',
  theme: {
    sky: 0x050711, fog: 0x16121d, fogNear: 650, fogFar: 2400,
    floor: 0x241b1c, ring: 0xffb347,
    wallStone: 0x17151c, wallTrim: 0x69e8ff,
    hemiSky: 0xffb347, hemiGround: 0x050711, hemiInt: 0.42,
    sunColor: 0xffd39a, sunInt: 1.35, rimColor: 0x69e8ff, rimInt: 0.55,
    decorations: ['crystal', 'pillar'],
    crystal: { count: 24, color: 0x69e8ff, glow: 0xff8a3d, glowInt: 0.75 },
    pillar: { count: 12, color: 0x30262b },
    atmosphere: { kind: 'stardust', color: '#ffb347', rate: 38 },
    floorDecal: { kind: 'rings', color: '#ffb347', opacity: 0.38, glow: 0.45 },
  },
  phases: [
    { hpPct: 0.7, name: '星火淬鍊', sub: '群星落入熔爐', color: '#ffb347', dmgMult: 1.25, speedMult: 1.05, cdMult: 0.8,
      tagsOverride: [
        { icon: '☄️', text: '星鐵雨增加至 6 顆' },
        { icon: '🔥', text: '攻擊強化 +25%' },
        { icon: '🔨', text: '翻面後必接巨錘' },
      ] },
    { hpPct: 0.35, name: '超新星爐心', sub: '萬物皆為鍛材', color: '#fff2c2', dmgMult: 1.55, speedMult: 1.15, cdMult: 0.65,
      tagsOverride: [
        { icon: '☄️', text: '星鐵雨增加至 7 顆' },
        { icon: '⏱️', text: '安全半場預警縮短' },
        { icon: '🔥', text: '20% 將進入限界狂暴' },
      ] },
  ],
  basic: { name: '鑄星錘', type: 'melee', dmg: 60, range: 250, arc: 1.65, knockback: 260, cd: 1.35, windup: 0.8, telegraph: 'arc', color: '#e69a38', vfx: 'boss_star_hammer' },
  skill1: { name: '引力熔流', type: 'zone', range: 180, radius: 250, dmg: 22, lifetime: 2.6, tick: 0.4, delay: 0.7, pull: 420, effect: SLOW(1.0, 0.55), cd: 10.5, windup: 1.1, telegraph: 'circle', color: '#58cfe0', vfx: 'boss_star_gravity' },
  skill2: { name: '星鐵雨', type: 'zone', range: 260, radius: 120, dmg: 68, lifetime: 0.45, tick: 0.45, delay: 0.9, count: 4, phaseCount: [4, 6, 7], scatter: 390, stagger: 0.16, cd: 8.5, windup: 1.2, telegraph: 'circle', color: '#e87332', vfx: 'boss_star_rain' },
  ultimate: { name: '熔爐翻面', type: 'light_dark', dmg: 110, radius: 1200, cd: 19, windup: 1.8, finalPhaseWindup: 1.3, telegraph: 'self', telegraphColor: '#58cfe0', dangerLevel: 'lethal', color: '#e69a38', vfx: 'boss_star_flip',
    chain: [{ slot: 'basic', windup: 1.0, delay: 0.45 }] },
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
