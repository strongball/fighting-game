import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts';

const data = {
    id: 109, round: 10, name: '另一個自己', subtitle: '終焉之神',
    color: '#e8e8f0', shape: 'circle', maxHp: 12000, maxMana: 999, speed: 180,
    baseHp: 12000,
    deathVfx: 'boss_doppel_death',
    appearance: {
      size: '巨大 (約玩家 3 倍)，會隨階段變形',
      style: '一具不斷流動、變形的「另一個自己」剪影，由虛空與星光構成的軀體，表面裂開流瀉白光，頭頂懸浮王者光環，外型會模仿並扭曲玩家的姿態。配色：虛空黑 + 星光白 #e8e8f0 + 裂縫白光 + 階段染色。',
      weapon: '隨階段化形 (複製玩家武器 / 凝聚虛空)',
      telegraph: '複製前周身泛起鏡面波紋、變階段時軀體裂開迸光；施放玩家大招前手勢與該角色一致。',
    },
    ai: 'doppelganger',
    mechanic: { mirrorPlayers: true, phases: 3 }, // 複製全體玩家成鏡像；多階段
    hint: '牠會複製全體玩家、還會偷學你們的大招 —— 牠出的招跟你們一樣，預判它！',
    tags: [
      { icon: '🪞', text: '複製全體玩家' },
      { icon: '🎭', text: '會偷用你們的大招' },
      { icon: '💠', text: '多階段·會變形' },
    ],
    hazardText: '💥 站在終焉領域裡！快離開',
    hazardColor: '#c9c0ff',
    theme: {
      sky: 0x050510, fog: 0x101025, fogNear: 600, fogFar: 2400,
      floor: 0x18182a, ring: 0xffffff,
      wallStone: 0x1a1a2a, wallTrim: 0xc9c0ff,
      hemiSky: 0xc9c0ff, hemiGround: 0x050510, hemiInt: 0.35,
      sunColor: 0xe0e0ff, sunInt: 1.5, rimColor: 0xc9c0ff, rimInt: 0.7,
      decorations: ['crystal', 'pillar'],
      crystal: { count: 26, color: 0xe8e8f0, glow: 0xc9c0ff, glowInt: 1.0 },
      pillar: { count: 10, color: 0x2a2a3a },
      atmosphere: { kind: 'stardust', color: '#e8e8f0', rate: 32 },
      floorDecal: { kind: 'hex', color: '#c9c0ff', opacity: 0.4, glow: 0.55 },
    },

    phases: [
      { hpPct: 0.66, name: '鏡像進化', sub: '虛空覺醒', color: '#cfcfff', dmgMult: 1.0, speedMult: 1.1, cdMult: 0.85,
        tagsOverride: [
          { icon: '🪞', text: '鏡像更頻繁出現' },
          { icon: '🎭', text: '更常使用你的大招' },
          { icon: '⚡', text: '攻擊強化 +20%' },
        ] },
      { hpPct: 0.33, name: '終焉之姿', sub: '萬象崩解', color: '#ffffff', dmgMult: 1.25, speedMult: 1.3, cdMult: 0.5,
        tagsOverride: [
          { icon: '💥', text: '攻擊大幅強化 +55%' },
          { icon: '⚡', text: '出招幾乎無冷卻' },
          { icon: '🌌', text: '終焉領域常駐' },
        ] },
    ],

    basic: { name: '虛空裂斬', type: 'melee', dmg: 44, range: 320, arc: 1.3, knockback: 200, cd: 1.1, windup: 0.35, telegraph: 'arc', color: '#ffffff', vfx: 'boss_doppel_slash' },
    skill1: { name: '鏡像複製', type: 'mirror_players', cd: 18, once: true, windup: 0.6, telegraph: 'self', color: '#cfcfff', vfx: 'boss_doppel_mirror' },
    skill2: { name: '竊取絕技', type: 'steal_ultimate', cd: 9.0, windup: 0.5, telegraph: 'self', color: '#b0b0ff', vfx: 'boss_doppel_steal' },
    ultimate: { name: '終焉之刻', type: 'zone', range: 0, radius: 400, dmg: 60, lifetime: 1.2, tick: 0.3, delay: 1.4, knockback: 350, effect: STUN(1.0), cd: 16.5, windup: 0.7, telegraph: 'circle', color: '#ffffff', vfx: 'boss_doppel_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
