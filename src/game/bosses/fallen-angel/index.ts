import { BaseBoss } from '../BaseBoss.ts';
import { BURN, STUN, SLOW, ROOT, CHILL } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig } from './model.ts';
import './action.ts';

const data = {
    id: 108, round: 9, name: '審判之翼', subtitle: '墮落天使',
    color: '#f5d76e', shape: 'triangle', maxHp: 9000, maxMana: 999, speed: 160,
    baseHp: 9000,
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

    basic: { name: '聖劍光弧', type: 'melee', dmg: 40, range: 140, arc: 1.4, knockback: 180, cd: 1.2, windup: 0.5, telegraph: 'arc', color: '#fff2b0', vfx: 'boss_angel_slash' },
    skill1: { name: '靈魂綁定', type: 'soul_bind', count: 2, minGap: 200, dmg: 18, duration: 6, cd: 13, windup: 0.9, telegraph: 'self', color: '#d8b3ff', vfx: 'boss_angel_bind' },
    skill2: { name: '審判光柱', type: 'zone', range: 150, radius: 110, dmg: 60, lifetime: 0.5, tick: 0.5, delay: 1.0, count: 3, scatter: 240, stagger: 0.2, cd: 10, windup: 1.0, telegraph: 'circle', color: '#fff7d6', vfx: 'boss_angel_judgment' },
    ultimate: { name: '光暗審判', type: 'light_dark', dmg: 80, radius: 1200, cd: 19, windup: 1.4, telegraph: 'self', color: '#ffe9a8', vfx: 'boss_angel_ult' },
  };

export default new BaseBoss(data, { aiProfile, modelConfig });
