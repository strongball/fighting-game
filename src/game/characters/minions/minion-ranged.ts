// @ts-nocheck
// 遠程小兵模板 (id: -2)
//
// 專供召喚系統使用，不進入 CHARACTERS 角色選擇陣列。
// 設計：會進行風箏走位的遠程雜兵 —— speed: 100 讓它有位移能力，
// 只有普攻 (遠程彈幕)，極低血、低傷，是必須清掉的靈體施法者。
// 用於：召喚師 ultimate 精魂、魔王死靈樂章召喚的遠程小怪。

export const rangedMinion = {
  id: -2,
  name: '小兵',
  color: '#9b7fd4',
  shape: 'triangle',
  maxHp: 40, maxMana: 0, speed: 100, // speed 100 → 遠程走位與風箏
  aiProfile: { range: 480, slots: ['basic'], pickTarget: 'nearestTarget', kite: 360 },
  // 程序化建模參數：袍裝 + 法杖，外觀偏靈體施法者
  modelConfig: { bulk: 0.85, weapon: 'staff', robe: true, skinKind: 'cloth', headgear: 'hood' },
  // 只有普攻 —— 慢速彈幕，低傷，冷卻較長
  basic: { name: '靈射', type: 'projectile', dmg: 6, speed: 350, radius: 10, lifetime: 1.7, knockback: 12, cd: 1.2, windup: 0.35, color: '#c9b3ff' },
};

export default rangedMinion;
