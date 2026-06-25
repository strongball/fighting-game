// @ts-nocheck
// 召喚師戰靈模板 (id: -3) —— 玩家專用，不與魔王共用 -1/-2，故可放心調強而不影響關卡平衡。
//
// 設計：耐打的近戰打手。比雜兵 (-1) 更壯、更快、揮擊更痛，作為召喚師「數量優勢」的主力肉牆。
// 仍受「玩家召喚物傷害 ×0.55」衰減 (damage.ts)，故帳面傷害看似偏高，實際入帳仍受規範約束。
// 用於：召喚師 skill1 召喚戰靈。

export const bruiserMinion = {
  id: -3,
  name: '戰靈',
  color: '#1abc9c',
  shape: 'circle',
  maxHp: 90, maxMana: 0, speed: 140,
  aiProfile: { range: 64, slots: ['basic'], pickTarget: 'nearestTarget' },
  // 程序化建模：較壯身形 + 劍，外觀比雜兵厚實
  modelConfig: { bulk: 1.12, weapon: 'sword', skinKind: 'metal' },
  // 重揮 —— 比雜兵高傷、稍長前搖、較強擊退
  basic: { name: '靈刃揮砍', type: 'melee', dmg: 16, range: 86, arc: 1.6, cd: 0.75, windup: 0.2, knockback: 44, color: '#48d8b8' },
};

export default bruiserMinion;
