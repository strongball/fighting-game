// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildFighterWeapon(hand, ctx) {
  const { THREE, base, reg, mat, shade, add } = createWeaponKit(hand, ctx);
  // 武僧繃帶拳：纏繞繃帶的拳 + 金色氣勁護指。
  const wrap = reg(mat(0xeae0cf, { rough: 0.8, metal: 0.02 }));
  const wrapDark = reg(mat(0xcbbfa6, { rough: 0.85, metal: 0.02 }));
  const qi = reg(mat(shade(base, 0.3), { emissive: new THREE.Color(base), ei: 1.9, metal: 0.5, rough: 0.3 }));

  // 拳
  add(new THREE.Mesh(new THREE.BoxGeometry(9, 9, 9), wrap), 3, -1, 0);
  // 繃帶纏繞紋（深淺交錯）
  for (let i = -1; i <= 1; i++) {
    add(new THREE.Mesh(new THREE.BoxGeometry(9.4, 1.5, 9.4), wrapDark), 3, -1 + i * 2.7, 0);
  }
  // 金色氣勁護指（拳面三道）
  for (let i = -1; i <= 1; i++) {
    add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 2.6), qi), 7.7, 0.4, i * 2.7);
  }
}
