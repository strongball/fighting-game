// @ts-nocheck
// 召喚物 (小兵) 模板註冊表。
//
// 這些模板「不」進入 CHARACTERS 角色選擇陣列，僅供召喚系統以負數 charId 查找。
// getCharacter / getCharacterModelDef 偵測到負數 id 時改查此表。
import meleeMinion from './minion-melee.ts';
import rangedMinion from './minion-ranged.ts';
import bubbleMinion from '../../bosses/tidal-siren/bubble.ts';

export const MINIONS = {
  '-1': meleeMinion,
  '-2': rangedMinion,
  '-3': bubbleMinion,
};

export function getMinion(id) {
  return MINIONS[id] || null;
}
