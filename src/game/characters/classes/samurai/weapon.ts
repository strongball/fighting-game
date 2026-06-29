// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildSamuraiWeapon(hand, ctx) {
  const { THREE, reg, mat, add } = createWeaponKit(hand, ctx);
  hand.rotation.set(0, 0, -1.22);
  hand.position.x += 2.5;
  const steel = reg(mat('#f2f0dc', { emissive: new THREE.Color('#766f58'), ei: 0.7, rough: 0.22, metal: 0.92 }));
  const red = reg(mat('#d94343', { emissive: new THREE.Color('#d94343'), ei: 1.2, rough: 0.35, metal: 0.45 }));
  const wrap = reg(mat('#171111', { rough: 0.82, metal: 0.25 }));

  // 刀刃群組 (會被動態拉伸)
  const bladeGroup = new THREE.Group();
  bladeGroup.name = 'blade-group';

  // 刀刃主體
  const bladeMain = new THREE.Mesh(new THREE.BoxGeometry(3.4, 58, 1.8), steel);
  bladeMain.position.set(3.5, 20, 0);
  bladeMain.castShadow = true;
  bladeGroup.add(bladeMain);

  // 刀尖
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(2.5, 9, 4), steel);
  bladeTip.position.set(3.5, 53, 0);
  bladeTip.castShadow = true;
  bladeGroup.add(bladeTip);

  hand.add(bladeGroup);

  // 護手與刀柄 (保持原樣不拉伸)
  add(new THREE.Mesh(new THREE.BoxGeometry(15, 2.6, 4.5), red), 3.5, -9, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 17, 8), wrap), 3.5, -20, 0);
}
