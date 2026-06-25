import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import { applyEffect } from '../../entities/effects.ts';
import { addFx } from '../../entities/fx.ts';
import { teamPlayers } from '../lifecycle.ts';

const burnNearby = (radius = 360, dmg = 8, duration = 4) => (state: any, boss: any) => {
  for (const p of teamPlayers(state)) {
    if (!p.alive) continue;
    const dx = p.x - boss.x, dy = p.y - boss.y;
    if (dx * dx + dy * dy > radius * radius) continue;
    applyEffect(p, 'burn', { duration, dmg, tick: 0.5, color: '#ff5a1f' }, boss.id);
    addFx(state, { type: 'hit', x: p.x, y: p.y, color: '#ff5a1f', life: 0.45, radius: 70, vfx: 'boss_juggernaut_quake' });
    addFx(state, { type: 'popup', x: p.x, y: p.y, color: '#ffcf6b', life: 0.9, text: '灼燒', kind: 'damage' });
  }
  addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, facing: boss.facing, color: '#ff5a1f', life: 0.6, radius: radius });
};

const data = {
    id: 102, round: 3, name: '熔岩鐵衛', subtitle: '烈焰重裝兵',
    lavaBurn: true, // HUD：被此 Boss 的燃燒灼傷時顯示「熔岩灼燒中」警示（取代硬編 charId）
    color: '#c0392b', shape: 'square', maxHp: 5500, maxMana: 999, speed: 140,
    baseHp: 5500,
    deathVfx: 'boss_juggernaut_death',
    appearance: {
      size: '巨大 (約玩家 2.2 倍)，厚重',
      style: '黑鐵全身重甲，甲縫間透出熔岩裂縫的橘紅光，左手巨盾、右手熔岩大劍。配色：玄鐵黑 #2b2b30 + 熔岩橘 #ff5a1f + 餘燼紅。',
      weapon: '熔岩巨劍 + 鐵塔盾',
      telegraph: '衝鋒前身體發紅後仰、腳下噴煙與火星、地面浮現直線瞄準指示；揮劍前劍刃熾紅。',
    },
    ai: 'juggernaut',
    mechanic: { frontArmor: 0.45, chargeWallStun: 2.2 }, // 正面前弧減傷 45%；衝鋒撞牆自暈 2.2s
    talent: { id: 'boss_frontarmor', name: '熔岩重甲', desc: '正面前方受到的傷害減免 45%，背後無防護。', frontArmor: 0.45, arc: 1.6 },
    hint: '正面有厚甲擋傷 —— 繞到背後打！閃過衝鋒，誘導撞石柱會自暈',
    environment: { pillars: { count: 6, hp: 240, r: 30, color: '#5a3a26' } },
    tags: [
      { icon: '🛡️', text: '正面減傷·打背後' },
      { icon: '💥', text: '衝鋒撞牆會自暈' },
      { icon: '🔥', text: '攻擊附帶燃燒' },
    ],
    hazardText: '🔥 站在烈焰上！快離開',
    hazardColor: '#ff5a2a',
    theme: {
      sky: 0x2a0c0a, fog: 0x3a1408, fogNear: 700, fogFar: 2200,
      floor: 0x4a2a1f, ring: 0xff5a1f,
      wallStone: 0x2b1b14, wallTrim: 0xff5a1f,
      hemiSky: 0xff7043, hemiGround: 0x2a0a06, hemiInt: 0.55,
      sunColor: 0xffb070, sunInt: 2.4, rimColor: 0xff3010, rimInt: 0.45,
      decorations: ['rock', 'brazier'],
      rock: { count: 18, color: 0x3a2218 },
      brazier: { count: 10, flame: 0xff7a3d, flameGlow: 0xff3010 },
      atmosphere: { kind: 'embers', rate: 28 },
      floorDecal: { kind: 'flame', color: '#ff7a3d', opacity: 0.5, glow: 0.6 },
    },

    phases: [
      { hpPct: 0.5, name: '熔岩沸騰', sub: '裝甲剝落', color: '#ff5a1f', dmgMult: 1.15, speedMult: 1.2, cdMult: 0.8,
        onEnter: burnNearby(360, 8, 4),
        tagsOverride: [
          { icon: '🔥', text: '熔岩四溢 — 進入後燃燒' },
          { icon: '⚔️', text: '攻擊強化 +40%' },
          { icon: '💢', text: '衝鋒更頻繁' },
        ] },
    ],

    basic: { name: '熔岩劈斬', type: 'melee', dmg: 50, range: 300, arc: 1.2, knockback: 200, cd: 1.4, windup: 0.5, telegraph: 'arc', color: '#ff7043', effect: BURN(8, 2), vfx: 'boss_juggernaut_slash' },
    skill1: { name: '烈焰衝鋒', type: 'charge', speed: 900, range: 740, dmg: 80, hitRadius: 130, knockback: 320, stopOnHit: true, effect: STUN(1.0), cd: 7.5, windup: 0.5, telegraph: 'line', color: '#ff5a1f', wallStun: 2.2, vfx: 'boss_juggernaut_charge' },
    skill2: { name: '震地烈焰', type: 'zone', range: 220, radius: 240, dmgPct: 0.035, lifetime: 2.4, tick: 0.5, delay: 0.8, moving: 0, effect: BURN(12, 3), cd: 9.0, windup: 0.5, telegraph: 'circle', color: '#e74c3c', vfx: 'boss_juggernaut_quake' },
    ultimate: { name: '熔岩噴發', type: 'zone', range: 220, radius: 200, dmg: 60, lifetime: 4, tick: 0.5, delay: 0.9, count: 10, scatter: 450, stagger: 0.12, effect: BURN(14, 3), cd: 14.3, windup: 0.6, telegraph: 'circle', color: '#ff5a1f', vfx: 'boss_juggernaut_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
