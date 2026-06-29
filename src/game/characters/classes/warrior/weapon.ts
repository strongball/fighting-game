// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildWarriorWeapon(hand, ctx) {
  const { THREE, hand: weaponHand, base, reg, mat, shade, steel, dark, gold, accent, add } = createWeaponKit(hand, ctx);
  // 戰士：巨型光束大劍 (Giant Beam Saber)
  hand.rotation.set(0, 0, -0.85);
  hand.position.x += 3.5;
  hand.position.y -= 1.5;
  
  // 刀刃群組 (會被動態拉伸)
  const bladeGroup = new THREE.Group();
  bladeGroup.name = 'blade-group';

  // 巨大發光光束刃
  const mainBlade = new THREE.Mesh(new THREE.BoxGeometry(4.5, 48, 1.6), accent);
  mainBlade.position.set(4, 12, 0);
  mainBlade.castShadow = true;
  bladeGroup.add(mainBlade);

  // 劍身側翼裝甲 (鋼製)
  const sideArmor = new THREE.Mesh(new THREE.BoxGeometry(5.2, 10, 0.8), steel);
  sideArmor.position.set(4, 2, 0);
  sideArmor.castShadow = true;
  bladeGroup.add(sideArmor);

  hand.add(bladeGroup);

  // 金色裝甲護手、重型劍柄與配重核心 (保持原樣不拉伸)
  add(new THREE.Mesh(new THREE.BoxGeometry(10, 4.5, 10), gold), 4, -12.5, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 16, 8), dark), 4, -22.5, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), accent), 4, -31, 0);
}
