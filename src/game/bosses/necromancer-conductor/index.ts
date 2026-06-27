import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts';

const data = {
    id: 105, round: 6, name: '死靈樂章', subtitle: '幽冥引路人',
    color: '#7d5fff', shape: 'circle', maxHp: 6500, maxMana: 999, speed: 130,
    baseHp: 6500,
    deathVfx: 'boss_necro_death',
    appearance: {
      size: '等身偏大 (約玩家 2 倍)，漂浮',
      style: '漂浮的幽靈指揮 / 巫妖，破舊暗袍隨幽風飄動，雙眼與雙手燃綠靈火，手持斷裂指揮棒兼死神鐮。身周籠罩半透明護盾泡。配色：幽紫 #7d5fff + 靈綠 #39ff88 + 屍袍灰。',
      weapon: '靈魂指揮棒 / 鐮刃',
      telegraph: '召喚前高舉指揮棒、地面綻開綠色法陣；護盾隨存活小怪數脈動發亮。',
    },
    ai: 'necromancer',
    mechanic: { minionShield: { perMinion: 0.18, max: 0.72 } }, // 每隻存活小怪給魔王減傷，清空才露破綻
    hint: '牠會召喚小怪 —— 每隻活著的小怪都讓牠減傷，先清掉小怪再打本體！',
    tags: [
      { icon: '💀', text: '會召喚小怪' },
      { icon: '🛡️', text: '每隻小怪給魔王減傷（最多 72%）' },
      { icon: '🎯', text: '清光小怪才打得動本體' },
    ],
    hazardText: '☠️ 站在亡靈領域裡！快離開',
    hazardColor: '#46f0a0',
    theme: {
      sky: 0x1a1430, fog: 0x2a2050, fogNear: 700, fogFar: 2200,
      floor: 0x2a2440, ring: 0x39ff88,
      wallStone: 0x2a1f3a, wallTrim: 0x7d5fff,
      hemiSky: 0xb39dff, hemiGround: 0x18102a, hemiInt: 0.4,
      sunColor: 0x9080d0, sunInt: 1.4, rimColor: 0x39ff88, rimInt: 0.5,
      decorations: ['pillar', 'crystal'],
      pillar: { count: 12, color: 0x4a3a5a },
      crystal: { count: 14, color: 0x46f0a0, glow: 0x2db870, glowInt: 0.7 },
      atmosphere: { kind: 'stardust', color: '#7d5fff', rate: 22 },
      floorDecal: { kind: 'arcane', color: '#39ff88', opacity: 0.4, glow: 0.4 },
    },

    phases: [
      { hpPct: 0.5, name: '亡者大進行曲', sub: '亡魂奔流', color: '#7d5fff', dmgMult: 1.1, cdMult: 0.8,
        tagsOverride: [
          { icon: '💀', text: '召喚速度加快' },
          { icon: '💥', text: '亡靈爆破更頻繁' },
          { icon: '🎵', text: '攻擊強化 +30%' },
        ] },
    ],

    basic: { name: '靈魂彈', type: 'projectile', dmg: 26, speed: 700, radius: 12, lifetime: 1.6, count: 3, spread: 0.25, knockback: 40, cd: 1.1, windup: 0.35, telegraph: 'line', color: '#39ff88', vfx: 'boss_necro_bolt' },
    skill1: { name: '亡者召集', type: 'summon_minions', count: 3, minionHp: 180, minionCharId: -2, minionName: '亡者殘影', cap: 5, cd: 15, windup: 0.5, telegraph: 'self', color: '#7d5fff', vfx: 'boss_necro_summon' },
    skill2: { name: '亡靈爆破', type: 'necro_burst', dmg: 55, radius: 240, knockback: 200, shield: 150, shieldPerMinion: 60, duration: 4, cd: 10, windup: 0.4, telegraph: 'self', color: '#39ff88', vfx: 'boss_necro_burst' },
    ultimate: { name: '安魂彌撒', type: 'zone', range: 0, radius: 320, dmg: 30, lifetime: 4, tick: 0.5, follow: true, healPerMinion: 60, effect: { kind: 'slow', duration: 0.6, factor: 0.8 }, cd: 15.0, windup: 0.6, telegraph: 'circle', color: '#9d7dff', vfx: 'boss_necro_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
