import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig } from './model.ts';
import { loadVfx } from './vfx.ts';

const data = {
    id: 101, round: 2, name: '劇毒飛蜥', subtitle: '沼澤潛伏者',
    color: '#7fbf3f', shape: 'triangle', maxHp: 4500, maxMana: 999, speed: 175,
    baseHp: 4500,
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

    basic: { name: '毒爪', type: 'melee', dmg: 30, range: 80, arc: 1.1, knockback: 120, cd: 0.9, windup: 0.4, telegraph: 'arc', color: '#9acd32', effect: BURN(6, 2), vfx: 'boss_lizard_claw' },
    skill1: { name: '腐蝕毒吐', type: 'projectile', dmg: 22, speed: 460, radius: 16, lifetime: 1.1, count: 3, spread: 0.28, knockback: 40, cd: 6, windup: 0.6, telegraph: 'line', color: '#7fff00', effect: BURN(10, 3), leaveZone: { radius: 90, dmg: 16, lifetime: 4, tick: 0.5, effect: BURN(10, 2), color: '#5a8f2f', vfx: 'boss_lizard_pool' }, vfx: 'boss_lizard_spit' },
    skill2: { name: '毒沼飛撲', type: 'leap', range: 280, dur: 0.5, dmg: 60, radius: 120, knockback: 160, cd: 8, windup: 0.5, telegraph: 'circle', color: '#6a3d9a', effect: BURN(8, 2), leaveZone: { radius: 110, dmg: 18, lifetime: 5, tick: 0.5, effect: BURN(12, 2), color: '#4e7a2f', vfx: 'boss_lizard_pool' }, vfx: 'boss_lizard_pounce' },
    ultimate: { name: '瘴氣風暴', type: 'zone', range: 140, radius: 120, dmg: 30, lifetime: 5, tick: 0.5, delay: 0.8, count: 6, scatter: 260, stagger: 0.16, effect: BURN(14, 3), cd: 16, windup: 1.0, telegraph: 'circle', color: '#6abf2f', vfx: 'boss_lizard_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, loadVfx });
