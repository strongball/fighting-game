// @ts-nocheck
// 召喚師元素精魂模板 (id: -4) —— 玩家專用 (不與魔王共用)，可放心調強。
//
// 設計：會風箏走位的遠程施法靈體。比遠程雜兵 (-2) 血厚、彈速快、傷害高，
// 作為召喚師大招的遠程火力組成。仍受「玩家召喚物傷害 ×0.55」衰減。
// 用於：召喚師 ultimate 大召喚術。

export const casterMinion = {
  id: -4,
  name: '元素精魂',
  color: '#2ee6c0',
  shape: 'triangle',
  maxHp: 55, maxMana: 0, speed: 115,
  aiProfile: { range: 460, slots: ['basic'], pickTarget: 'nearestTarget', kite: 340 },
  // 程序化建模：袍裝 + 法杖 + 兜帽，外觀偏靈體施法者
  modelConfig: { bulk: 0.9, weapon: 'staff', robe: true, skinKind: 'cloth', headgear: 'hood' },
  // 元素彈 —— 比雜兵彈速快、傷害高、冷卻短
  basic: { name: '元素彈', type: 'projectile', dmg: 12, speed: 440, radius: 11, lifetime: 1.6, knockback: 14, cd: 1.0, windup: 0.28, color: '#7ef0d6' },
};

export default casterMinion;
