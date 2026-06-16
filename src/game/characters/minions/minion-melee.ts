// @ts-nocheck
// 近戰小兵模板 (id: -1)
//
// 專供召喚系統使用，不進入 CHARACTERS 角色選擇陣列。
// 設計：脆弱的近戰雜兵 —— 低血、低傷、只有普攻 (無 skill1/skill2/ultimate)，
// 在 `minion` AI profile 下只會逼近並揮擊，碰一下就死。
// 用於：召喚師 skill1 戰靈、死靈法師 ultimate 亡靈、魔王召喚的近戰小怪。

export const meleeMinion = {
  id: -1,
  name: '小兵',
  color: '#8d9aa8',
  shape: 'circle',
  maxHp: 60, maxMana: 0, speed: 120,
  // 程序化建模參數：纖細身形 + 小短劍，外觀偏雜兵
  modelConfig: { bulk: 0.95, weapon: 'sword', skinKind: 'metal' },
  // 只有普攻 —— 簡單近戰打擊，低傷低擊退，起手短
  basic: { name: '揮擊', type: 'melee', dmg: 8, range: 78, arc: 1.5, cd: 0.85, windup: 0.28, knockback: 36, color: '#aebccb' },
};

export default meleeMinion;
