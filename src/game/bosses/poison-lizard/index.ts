import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import { arena } from './arena.ts';

const data = {
    id: 101, round: 2, name: '劇毒飛蜥', subtitle: '沼澤潛伏者',
    color: '#7fbf3f', shape: 'triangle', maxHp: 4500, maxMana: 999, speed: 175,
    baseHp: 4500,
    deathVfx: 'boss_lizard_death',
    appearance: {
      size: '等身偏大 (約玩家 1.8 倍)，低伏敏捷',
      style: '四足毒蜥，紫綠交雜的鱗甲、背脊滴落綠色毒液、口器外露毒牙。配色：毒綠 #7fbf3f + 暗紫 #6a3d9a + 螢光毒滴。',
      weapon: '毒牙利爪 + 毒液吐息',
      telegraph: '吐毒前口部鼓脹發綠光並噴氣、飛撲前後肢蹲伏冒紫煙。',
    },
    ai: 'lizard',
    mechanic: { poisonFloor: true }, // 招式在地面留毒池
    hint: '別踩地上的綠色毒沼 —— 會持續中毒掉血！',
    tags: [
      { icon: '☠️', text: '地面毒沼別久站' },
      { icon: '🧪', text: '攻擊附帶中毒' },
      { icon: '🦎', text: '高機動·會飛撲' },
    ],
    hazardText: '☠️ 中毒中！快離開毒沼',
    hazardColor: '#8ee03a',
    // 場地（陰天毒沼祭壇主題 + 蛇紋石王座基座碰撞）定義於 ./arena.ts
    colliders: arena.colliders,
    theme: arena.theme,

    phases: [
      { hpPct: 0.5, name: '劇毒沸騰', sub: '瘴氣翻湧', color: '#7fff00', dmgMult: 1.1, speedMult: 1.15, cdMult: 0.75,
        tagsOverride: [
          { icon: '☠️', text: '毒沼範圍變大' },
          { icon: '⚡', text: '攻擊強化 +30%' },
          { icon: '🐍', text: '飛撲更頻繁' },
        ] },
    ],

    basic: { name: '毒爪', type: 'melee', dmg: 30, range: 210, arc: 1.1, knockback: 120, cd: 1.0, windup: 0.35, telegraph: 'arc', color: '#9acd32', effect: BURN(6, 2), vfx: 'boss_lizard_claw' },
    skill1: { name: '腐蝕毒吐', type: 'projectile', dmg: 22, speed: 680, radius: 16, lifetime: 1.1, count: 4, spread: 0.35, knockback: 40, cd: 6.0, windup: 0.4, telegraph: 'line', color: '#7fff00', effect: BURN(10, 3), leaveZone: { radius: 150, dmgPct: 0.025, lifetime: 4, tick: 0.5, effect: BURN(10, 2), color: '#5a8f2f', vfx: 'boss_lizard_pool' }, vfx: 'boss_lizard_spit' },
    skill2: { name: '毒沼飛撲', type: 'leap', range: 460, dur: 0.5, dmg: 60, radius: 180, knockback: 160, cd: 7.5, windup: 0.35, telegraph: 'circle', color: '#6a3d9a', effect: BURN(8, 2), leaveZone: { radius: 170, dmgPct: 0.025, lifetime: 5, tick: 0.5, effect: BURN(12, 2), color: '#4e7a2f', vfx: 'boss_lizard_pool' }, vfx: 'boss_lizard_pounce' },
    ultimate: { name: '瘴氣風暴', type: 'zone', range: 240, radius: 200, dmg: 35, lifetime: 6, tick: 0.5, delay: 0.8, count: 8, scatter: 400, stagger: 0.16, effect: BURN(14, 3), cd: 14.3, windup: 0.6, telegraph: 'circle', color: '#6abf2f', vfx: 'boss_lizard_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
