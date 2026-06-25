// @ts-nocheck
// 死靈法師亡靈僕從模板 (id: -5) —— 玩家專用 (不與魔王共用)，可放心調強。
//
// 設計：揮爪附帶流血的近戰亡者。契合死靈「持續壓血」主題：每次命中疊一層流血，
// 讓亡靈大軍不只是肉牆，還能替主人鋪 DoT。仍受「玩家召喚物傷害 ×0.55」衰減。
// 用於：死靈法師 ultimate 亡靈大軍。

export const revenantMinion = {
  id: -5,
  name: '亡靈僕從',
  color: '#27ae60',
  shape: 'triangle',
  maxHp: 95, maxMana: 0, speed: 130,
  aiProfile: { range: 64, slots: ['basic'], pickTarget: 'nearestTarget' },
  // 程序化建模：偏瘦的亡者身形 + 劍 + 兜帽
  modelConfig: { bulk: 1.0, weapon: 'sword', skinKind: 'cloth', headgear: 'hood' },
  // 腐蝕爪 —— 命中附帶流血 (DoT)，貼合死靈主題
  basic: {
    name: '腐蝕爪', type: 'melee', dmg: 11, range: 80, arc: 1.5, cd: 0.85, windup: 0.25, knockback: 30, color: '#6ab04c',
    effect: { kind: 'bleed', duration: 3, tick: 0.5, dmg: 5, moveMult: 1.0 },
  },
};

export default revenantMinion;
