// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildFalconerWeapon(hand, ctx) {
  const { THREE, base, reg, mat, steel, gold, accent, add } = createWeaponKit(hand, ctx);
  // 鳥獵：輕量速射複合弓（比弓箭手機甲巨弓更纖細，強調快射）
  const bow = new THREE.Group();

  // 上下弓臂（細長弧形）
  for (const sz of [-1, 1]) {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 22, 6), steel);
    limb.position.set(-6, sz * 10, 0);
    limb.rotation.z = sz * -0.55;
    bow.add(limb);
    // 弓臂末端的鷹羽飾
    const tip = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), reg(mat(base, { emissive: base, ei: 2.2, transparent: true, opacity: 0.9 })));
    tip.position.set(-11, sz * 18, 0);
    tip.rotation.z = sz * -0.6;
    bow.add(tip);
  }

  // 金色握把
  const grip = new THREE.Mesh(new THREE.BoxGeometry(3, 8, 3), gold);
  grip.position.set(-13, 0, 0);
  bow.add(grip);

  // 發光弓弦
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 40, 4), accent);
  string.position.set(-3, 0, 0);
  bow.add(string);

  // 搭弦的速射光箭
  const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 32, 4), accent);
  arrow.rotation.z = Math.PI / 2;
  arrow.position.set(-2, 0, 0);
  bow.add(arrow);

  add(bow, 4, -4, 0, 0, Math.PI / 2, 0);
}
