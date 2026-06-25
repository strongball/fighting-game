// @ts-nocheck
import * as THREE from 'three';
import { buildFalconerWeapon } from './weapon.ts';

export const modelConfig = { bulk: 1.85, weapon: 'bow', skinKind: 'leather', headgear: 'hood' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat,
    torsoW, torsoD, torsoH, shoulderX, shoulderY, hipX, frontX,
    defaultBodyMat, defaultHeadMat, defaultArmMat, defaultBootMat,
    darkMat, darkHelmMat, accentHelmMat,
    faceGroup, helmAddons, mkLimb, addAccent,
  } = ctx;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), defaultBodyMat);

  // 胸前皮帶 / 護心
  const guard = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.5, torsoH * 0.5, 3), darkMat);
  guard.position.set(0, torsoH * 0.05, torsoD * 0.5 + 1.6); torso.add(guard);

  // 輕量羽翼披風（收合，不展開）— 暖琥珀發光
  const wingMat = reg(mat(base, { transparent: true, opacity: 0.8, emissive: base, ei: 1.8 }));
  for (const sz of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 16, 9), wingMat);
    wing.position.set(-torsoD * 0.5 - 3.4, torsoH * 0.18, sz * (torsoW * 0.5));
    wing.rotation.y = sz * (Math.PI / 4 + 0.18); wing.rotation.x = sz * 0.18; addAccent(wing);
  }

  // 鷹隼夥伴：棲於肩上的大老鷹（身體＋頭＋鉤喙＋展開雙翼＋尾羽）。
  // 掛在 player group（非 torso）→ 可在攻擊時獨立「飛出俯衝」(見 models.js animateModel)。
  // 模型一律面向 +X（前方），故鷹建構時即朝 +X（頭在 +X、尾在 -X）。
  const falcon = new THREE.Group();
  const falconBody = reg(mat(base, { emissive: base, ei: 1.6, roughness: 0.45 }));
  const featherDark = reg(mat(0x8a5a18, { emissive: base, ei: 0.8, roughness: 0.6 }));
  const fb = new THREE.Mesh(new THREE.SphereGeometry(5.2, 14, 12), falconBody);
  fb.scale.set(1.6, 0.9, 1); falcon.add(fb);
  const fHead = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 10), falconBody);
  fHead.position.set(5.2, 3.8, 0); falcon.add(fHead);
  // 鉤喙（朝前 +X）
  const beak = new THREE.Mesh(new THREE.ConeGeometry(1.3, 3.6, 6), accentHelmMat);
  beak.rotation.z = -Math.PI / 2.2; beak.position.set(8.4, 3.2, 0); falcon.add(beak);
  // 銳利雙眼（發光）
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), reg(mat(0xfff2a0, { emissive: 0xffd34d, ei: 3.0 })));
    eye.position.set(6.6, 4.6, sz * 1.5); falcon.add(eye);
  }
  // 展開的大翅膀（多片羽，向兩側 ±Z 張開）— 存入 userData 以便拍動。
  const wings = [];
  for (const sz of [-1, 1]) {
    const wing = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const fw = new THREE.Mesh(new THREE.BoxGeometry(7 + i * 2, 0.8, 2.2), i === 1 ? falconBody : featherDark);
      fw.position.set(-1 - i * 0.8, 0.6 - i * 0.3, sz * (4 + i * 2.2));
      wing.add(fw);
    }
    wing.position.set(0, 0, 0);
    wing.userData.side = sz;
    falcon.add(wing);
    wings.push(wing);
  }
  // 尾羽（朝後 -X）
  const tail = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 4), featherDark);
  tail.rotation.z = Math.PI / 2.4; tail.position.set(-6, -0.4, 0); falcon.add(tail);

  // 棲位（group 空間）：右肩上方。記錄於 userData 供 animateModel 飛行起降。
  const restX = frontX * 0.2, restY = shoulderY + 7, restZ = shoulderX * 0.95;
  falcon.position.set(restX, restY, restZ);
  falcon.scale.setScalar(1.2 * bulk);
  falcon.userData.rest = { x: restX, y: restY, z: restZ };
  falcon.userData.baseScale = 1.2 * bulk;
  falcon.userData.wings = wings;

  const head = new THREE.Mesh(new THREE.SphereGeometry(7.5 * bulk, 16, 12), defaultHeadMat);

  // 銳利鷹眼面甲（單眼瞄準片）
  const visor = new THREE.Mesh(new THREE.BoxGeometry(3.2 * bulk, 1.4 * bulk, 1.0), accentHelmMat);
  visor.position.set(frontX + 0.6, 1.6 * bulk, 1.6 * bulk); faceGroup.add(visor);
  const aim = new THREE.Mesh(new THREE.RingGeometry(1.2 * bulk, 1.7 * bulk, 12), reg(mat(0xffd34d, { emissive: 0xffd34d, ei: 2.6 })));
  aim.position.set(frontX + 2.4, 1.6 * bulk, 2.0 * bulk); faceGroup.add(aim);

  // 頭頂三根鷹羽冠飾
  for (let i = -1; i <= 1; i++) {
    const plume = new THREE.Mesh(new THREE.ConeGeometry(1.0 * bulk, 11 * bulk, 4), wingMat);
    plume.position.set(-2.5 * bulk, 8.5 * bulk, i * 2.4 * bulk);
    plume.rotation.z = -0.5 - Math.abs(i) * 0.1; plume.rotation.x = i * 0.25;
    helmAddons.add(plume);
  }

  const armL = mkLimb(0, -shoulderX, true, defaultArmMat, defaultBootMat, base);
  const armR = mkLimb(0, shoulderX, true, defaultArmMat, defaultBootMat, base);
  const legL = mkLimb(0, -hipX, false, defaultBodyMat, defaultBootMat, base);
  const legR = mkLimb(0, hipX, false, defaultBodyMat, defaultBootMat, base);

  return { torso, head, armL, armR, legL, legR, falcon };
}

export const buildWeapon = buildFalconerWeapon;

export { attachSkinGear } from './gear.ts';
