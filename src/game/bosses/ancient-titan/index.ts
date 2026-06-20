import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel } from './model.ts';

const data = {
    id: 104, round: 5, name: '廢墟古代巨兵', subtitle: '機關核心',
    color: '#95a5a6', shape: 'square', maxHp: 6000, maxMana: 999, speed: 90,
    baseHp: 6000,
    appearance: {
      size: '極巨大 (約玩家 3 倍，全場最大)',
      style: '石與金屬構成的遠古守護巨像，覆滿苔蘚與廢墟碎石，胸口符文核心發藍光。左臂為藍光雷射砲、右臂為火星四濺的旋轉巨鋸。配色：石灰 #95a5a6 + 金屬銅 #b08d57 + 符文藍 #49d0ff。',
      weapon: '左臂雷射砲 (藍) + 右臂旋轉巨鋸 (橙火星)',
      telegraph: '雷射臂藍光由弱漸強並投出直線警示後發射；鋸臂火星旋轉提速後橫掃。核心踏地前微微下沉蓄力。',
    },
    ai: 'ancient_titan',
    mechanic: {
      parts: [
        { id: 'arm_left', baseHp: 2000, disablesSlot: 'skill1', offset: { x: -70, y: 0 } },
        { id: 'arm_right', baseHp: 2000, disablesSlot: 'skill2', offset: { x: 70, y: 0 } },
      ],
      coreArmorUntilPartsDown: 0.6, // 雙臂未破時核心減傷 60%
    },
    hint: '先打掉牠左右兩隻手臂！雙臂沒破時，本體會減傷 60%',
    environment: { pillars: { count: 5, hp: 360, r: 34, color: '#7d8c95' } },
    tags: [
      { icon: '🦾', text: '先破壞左右雙臂' },
      { icon: '🛡️', text: '雙臂未破·本體減傷 60%' },
      { icon: '⚡', text: '破臂後可關掉牠的招' },
    ],
    hazardText: '⚠️ 站在攻擊範圍裡！快閃開',
    hazardColor: '#ffa83a',
    theme: {
      sky: 0x2a2622, fog: 0x3a3228, fogNear: 800, fogFar: 2400,
      floor: 0x7d7066, ring: 0x49d0ff,
      wallStone: 0x6b6660, wallTrim: 0x49d0ff,
      hemiSky: 0xc8b8a0, hemiGround: 0x2a2218, hemiInt: 0.4,
      sunColor: 0xffd8a0, sunInt: 1.8, rimColor: 0xb0a070, rimInt: 0.3,
      decorations: ['pillar', 'rock'],
      pillar: { count: 14, color: 0x8a7060 },
      rock: { count: 18, color: 0x6b5e4e },
      atmosphere: { kind: 'ash', rate: 14 },
      floorDecal: { kind: 'hex', color: '#49d0ff', opacity: 0.3, glow: 0.25 },
    },

    phases: [
      { hpPct: 0.66, name: '核心過載', sub: '機關失序', color: '#49d0ff', dmgMult: 1.25, cdMult: 0.65,
        tagsOverride: [
          { icon: '⚡', text: '出招間隔大幅縮短' },
          { icon: '🦾', text: '雷射 / 巨鋸更頻繁' },
        ] },
      { hpPct: 0.33, name: '終末迴路', sub: '核心暴走', color: '#ff5a1f', dmgMult: 1.55, cdMult: 0.4,
        tagsOverride: [
          { icon: '💥', text: '攻擊大幅強化 +55%' },
          { icon: '⚡', text: '冷卻幾乎清零' },
        ] },
    ],

    basic: { name: '踏地震波', type: 'zone', range: 0, radius: 160, dmg: 36, lifetime: 0.4, tick: 0.4, knockback: 220, cd: 2.0, windup: 0.7, telegraph: 'circle', color: '#b0a99f', effect: STUN(0.4), vfx: 'boss_titan_stomp' },
    skill1: { name: '殲滅雷射', type: 'zone', range: 110, radius: 90, dmg: 50, lifetime: 1.6, tick: 0.3, delay: 1.0, moving: 200, requiresPart: 'arm_left', cd: 7, windup: 1.0, telegraph: 'line', color: '#49d0ff', vfx: 'boss_titan_laser' },
    skill2: { name: '旋轉巨鋸', type: 'zone', range: 100, radius: 150, dmg: 30, lifetime: 2.2, tick: 0.25, moving: 280, requiresPart: 'arm_right', cd: 8, windup: 0.8, telegraph: 'line', color: '#ff7043', effect: BURN(6, 2), vfx: 'boss_titan_saw' },
    ultimate: { name: '核心過載', type: 'zone', range: 0, radius: 260, dmg: 70, lifetime: 0.6, tick: 0.6, delay: 1.2, knockback: 300, effect: STUN(0.6), requiresPartsDown: true, cd: 18, windup: 1.2, telegraph: 'circle', color: '#9fe8ff', vfx: 'boss_titan_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel });
