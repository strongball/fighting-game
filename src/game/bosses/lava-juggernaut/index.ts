import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig } from './model.ts';
import { burnNearby } from '../phaseHooks.ts';

const data = {
    id: 102, round: 3, name: '熔岩鐵衛', subtitle: '烈焰重裝兵',
    color: '#c0392b', shape: 'square', maxHp: 5500, maxMana: 999, speed: 140,
    baseHp: 5500,
    appearance: {
      size: '巨大 (約玩家 2.2 倍)，厚重',
      style: '黑鐵全身重甲，甲縫間透出熔岩裂縫的橘紅光，左手巨盾、右手熔岩大劍。配色：玄鐵黑 #2b2b30 + 熔岩橘 #ff5a1f + 餘燼紅。',
      weapon: '熔岩巨劍 + 鐵塔盾',
      telegraph: '衝鋒前身體發紅後仰、腳下噴煙與火星、地面浮現直線瞄準指示；揮劍前劍刃熾紅。',
    },
    ai: 'juggernaut',
    mechanic: { frontArmor: 0.45, chargeWallStun: 2.2 }, // 正面前弧減傷 45%；衝鋒撞牆自暈 2.2s
    talent: { id: 'boss_frontarmor', name: '熔岩重甲', desc: '正面前方受到的傷害減免 45%，背後無防護。', frontArmor: 0.45, arc: 1.6 },
    hint: '正面有厚甲擋傷 —— 繞到背後打！閃過衝鋒，牠撞牆會自己暈',
    tags: [
      { icon: '🛡️', text: '正面減傷·打背後' },
      { icon: '💥', text: '衝鋒撞牆會自暈' },
      { icon: '🔥', text: '攻擊附帶燃燒' },
    ],
    hazardText: '🔥 站在烈焰上！快離開',
    hazardColor: '#ff5a2a',

    phases: [
      { hpPct: 0.5, name: '熔岩沸騰', sub: '裝甲剝落', color: '#ff5a1f', dmgMult: 1.4, speedMult: 1.2, cdMult: 0.8,
        onEnter: burnNearby(360, 8, 4),
        tagsOverride: [
          { icon: '🔥', text: '熔岩四溢 — 進入後燃燒' },
          { icon: '⚔️', text: '攻擊強化 +40%' },
          { icon: '💢', text: '衝鋒更頻繁' },
        ] },
    ],

    basic: { name: '熔岩劈斬', type: 'melee', dmg: 50, range: 120, arc: 1.2, knockback: 200, cd: 1.4, windup: 0.7, telegraph: 'arc', color: '#ff7043', effect: BURN(8, 2), vfx: 'boss_juggernaut_slash' },
    skill1: { name: '烈焰衝鋒', type: 'charge', speed: 900, range: 520, dmg: 80, hitRadius: 70, knockback: 320, stopOnHit: true, effect: STUN(1.0), cd: 8, windup: 0.9, telegraph: 'line', color: '#ff5a1f', wallStun: 2.2, vfx: 'boss_juggernaut_charge' },
    skill2: { name: '震地烈焰', type: 'zone', range: 90, radius: 150, dmg: 40, lifetime: 2.4, tick: 0.5, delay: 0.8, moving: 0, effect: BURN(12, 3), cd: 10, windup: 0.8, telegraph: 'circle', color: '#e74c3c', vfx: 'boss_juggernaut_quake' },
    ultimate: { name: '熔岩噴發', type: 'zone', range: 130, radius: 120, dmg: 55, lifetime: 4, tick: 0.5, delay: 0.9, count: 7, scatter: 280, stagger: 0.12, effect: BURN(14, 3), cd: 16, windup: 1.0, telegraph: 'circle', color: '#ff5a1f', vfx: 'boss_juggernaut_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig });