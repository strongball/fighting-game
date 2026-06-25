// @ts-nocheck
// 召喚物 (小兵) 模板註冊表。
//
// 這些模板「不」進入 CHARACTERS 角色選擇陣列，僅供召喚系統以負數 charId 查找。
// getCharacter / getCharacterModelDef 偵測到負數 id 時改查此表。
import meleeMinion from './minion-melee.ts';
import rangedMinion from './minion-ranged.ts';
import bubbleMinion from '../../bosses/tidal-siren/bubble.ts';
import bruiserMinion from './minion-bruiser.ts';
import casterMinion from './minion-caster.ts';
import revenantMinion from './minion-revenant.ts';
import pylonMinion from '../../bosses/mecha-god/pylon.ts';

export const MINIONS = {
  // -1/-2：通用雜兵，玩家與魔王共用（調整會影響關卡平衡，勿輕動）。
  '-1': meleeMinion,
  '-2': rangedMinion,
  '-3': bubbleMinion,
  // -4/-5/-6：玩家專用召喚物（召喚師戰靈/精魂、死靈亡靈），可獨立調整不影響魔王。
  '-4': bruiserMinion,
  '-5': casterMinion,
  '-6': revenantMinion,
  // -7：魔王能量共振柱
  '-7': pylonMinion,
};

export function getMinion(id) {
  return MINIONS[id] || null;
}
