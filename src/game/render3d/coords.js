// 世界座標 (模擬) <-> three.js 場景座標 對應
//
// 模擬世界： wx ∈ [0, ARENA.width], wy ∈ [0, ARENA.height]，wy 越大越靠近鏡頭(畫面下方)
// 場景座標： X 向右、Y 向上(高度)、Z 越大越靠近鏡頭
//   sceneX = wx - HALF_W
//   sceneZ = wy - HALF_H
//   sceneY = 高度 h (站在地面 = 0)
// 1 世界單位 = 1 three 單位

import { ARENA, PLAYER_RADIUS } from '../constants.js';

export const HALF_W = ARENA.width / 2;   // 1200
export const HALF_H = ARENA.height / 2;  // 800
export { PLAYER_RADIUS, ARENA };

// 投射物/特效的飛行高度 (場景單位)
export const PROJECTILE_Y = 26;
// 角色模型約略高度 (供 HUD 名牌錨點)
export const BODY_TOP = 52;

export function sceneX(wx) { return wx - HALF_W; }
export function sceneZ(wy) { return wy - HALF_H; }

// 把世界座標寫入既有的 THREE.Vector3，避免每幀配置物件
export function setVecFromWorld(v, wx, wy, h = 0) {
  v.set(wx - HALF_W, h, wy - HALF_H);
  return v;
}
