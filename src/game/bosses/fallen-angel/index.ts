import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts';
import { addFx } from '../../entities/fx.ts';
import { teamPlayers } from '../lifecycle.ts';

const tetherAllPairs = (opts: any = {}) => (state: any, boss: any) => {
  if (!state.tethers) state.tethers = [];
  const humans = teamPlayers(state).filter((p: any) => p.alive);
  for (let i = 0; i + 1 < humans.length; i += 2) {
    state.tethers.push({
      a: humans[i].id, b: humans[i + 1].id,
      minGap: opts.minGap || 220, dmg: opts.dmg || 18, tick: 0.5, tickTimer: 0.5,
      remaining: opts.duration || 12,
    });
  }
  addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, facing: boss.facing, color: '#f5d76e', life: 0.7, radius: 220 });
};

const data = {
    id: 108, round: 9, name: '審判之翼', subtitle: '墮落天使',
    color: '#f5d76e', shape: 'triangle', maxHp: 9000, maxMana: 999, speed: 160,
    baseHp: 9000,
    deathVfx: 'boss_angel_death',
    appearance: {
      size: '巨大 (約玩家 2.6 倍)，雙翼展開更寬',
      style: '墮落的天使，一側純白羽翼、一側焦黑墮翼，黑化的光環與聖痕，手持聖墮交織的審判巨劍，自身延伸出發光的束縛鎖鏈。配色：聖金 #f5d76e + 墮黑 #2c2c34 + 神聖白光 / 暗影紫。',
      weapon: '審判巨劍 + 靈魂鎖鏈',
      telegraph: '靈魂綁定前鎖鏈從魔王延伸連向目標 (明確連線)；審判光柱前展翼上升、地面投出光柱警示。Phase 2 全身光環轉為暗紫。',
    },
    ai: 'fallen_angel',
    mechanic: { soulBind: { count: 2, minGap: 200, dmg: 18, tick: 0.5 }, phases: 2 }, // 隨機綁定 2 人，過近雙扣
    hint: '牠會用鎖鏈把兩名玩家綁在一起 —— 被綁就和隊友拉開距離，否則一起扣血！',
    tags: [
      { icon: '🔗', text: '會綁定兩名玩家' },
      { icon: '↔️', text: '被綁要和隊友拉開' },
      { icon: '⚔️', text: '第二階段更兇' },
    ],
    hazardText: '☀️ 站在審判光柱下！快離開',
    hazardColor: '#ffd24a',
    theme: {
      sky: 0x2a1f3a, fog: 0x3a2a4a, fogNear: 800, fogFar: 2400,
      floor: 0x5a4a55, ring: 0xfff2b0,
      wallStone: 0x3a2c40, wallTrim: 0xfff2b0,
      hemiSky: 0xfff7d6, hemiGround: 0x2a1a30, hemiInt: 0.5,
      sunColor: 0xfff2b0, sunInt: 2.2, rimColor: 0xd8b3ff, rimInt: 0.5,
      decorations: ['pillar', 'brazier'],
      pillar: { count: 12, color: 0x7a6a70 },
      brazier: { count: 8, flame: 0xfff2b0, flameGlow: 0xffd166 },
      atmosphere: { kind: 'petals', color: '#fff2b0', rate: 12 },
      floorDecal: { kind: 'rings', color: '#fff2b0', opacity: 0.5, glow: 0.45 },
    },

    phases: [
      { hpPct: 0.6, name: '光明之翼', sub: '聖光綻放', color: '#fff2b0', dmgMult: 1.0, cdMult: 0.8,
        tagsOverride: [
          { icon: '✨', text: '出招更頻繁' },
          { icon: '🔗', text: '綁定範圍變大' },
        ] },
      { hpPct: 0.3, name: '審判降臨', sub: '靈魂審判', color: '#d8b3ff', dmgMult: 1.2, cdMult: 0.55,
        onEnter: tetherAllPairs({ minGap: 240, dmg: 14, duration: 16 }),
        tagsOverride: [
          { icon: '🔗', text: '全員兩兩自動綁定' },
          { icon: '⚔️', text: '攻擊大幅強化 +50%' },
        ] },
    ],

    basic: { name: '聖劍光弧', type: 'melee', dmg: 40, range: 310, arc: 1.4, knockback: 180, cd: 1.2, windup: 0.35, telegraph: 'arc', color: '#fff2b0', vfx: 'boss_angel_slash' },
    skill1: { name: '靈魂綁定', type: 'soul_bind', count: 2, minGap: 200, dmg: 22, duration: 6, cd: 11.3, windup: 0.5, telegraph: 'self', color: '#d8b3ff', vfx: 'boss_angel_bind' },
    skill2: { name: '審判光柱', type: 'zone', range: 300, radius: 200, dmg: 60, lifetime: 0.5, tick: 0.5, delay: 1.0, count: 4, scatter: 360, stagger: 0.2, cd: 8.0, windup: 0.6, telegraph: 'circle', color: '#fff7d6', vfx: 'boss_angel_judgment' },
    ultimate: { name: '光暗審判', type: 'light_dark', dmg: 80, radius: 1200, cd: 15.8, windup: 0.7, telegraph: 'self', color: '#ffe9a8', vfx: 'boss_angel_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
