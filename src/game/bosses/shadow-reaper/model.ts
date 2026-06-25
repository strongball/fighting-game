// @ts-nocheck
import * as THREE from 'three';
import { createWeaponKit } from '../../render3d/weaponKit.js';

export const modelConfig = { bulk: 2.5, weapon: 'none', scale: 1.5, head: 'triangle', emissiveCore: '#d8b3ff', translucent: true };

const SHADOW = '#1a0033', PURPLE = '#aa33ff', GLOW = '#d8b3ff';

function makeShadowDagger(bladeMat, hiltMat) {
  const g = new THREE.Group();
  // 雙刃暗影短刀
  const blade = new THREE.Mesh(new THREE.ConeGeometry(1.8, 20, 4), bladeMat);
  blade.position.y = 12;
  g.add(blade);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(6, 1.5, 2.0), hiltMat);
  guard.position.y = 1.0;
  g.add(guard);

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 6), hiltMat);
  hilt.position.y = -2.0;
  g.add(hilt);

  return g;
}

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const shadowMat = reg(mat(SHADOW, { rough: 0.5, metal: 0.1, emissive: new THREE.Color('#0a0014') }));
  const purpleMat = reg(mat(PURPLE, { rough: 0.3, metal: 0.3, emissive: new THREE.Color('#4a0082'), env: 1.1 }));
  const glowMat = reg(mat(GLOW, { emissive: new THREE.Color(GLOW), ei: 2.2, rough: 0.2 }));
  const bladeMat = reg(mat('#9933ff', { rough: 0.2, metal: 0.5, emissive: new THREE.Color('#7a1fdd'), ei: 1.8 }));

  // --- 軀幹：暗影兜帽風衣長袍 ---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoD * 0.3, torsoD * 0.55, torsoH * 1.3, 8), shadowMat);
  torso.castShadow = true;

  // 兜帽前沿裝飾
  const hoodTrim = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.25, torsoH * 0.1, torsoD * 0.15), purpleMat);
  hoodTrim.position.set(torsoD * 0.35, torsoH * 0.45, 0);
  torso.add(hoodTrim);

  // --- 頭：兜帽深處的無面陰影 + 亮紫雙眼 ---
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(6.0 * bulk, 0), shadowMat);
  head.scale.set(0.9, 1.2, 0.9);
  head.castShadow = true;

  // 兜帽左右護甲
  for (const sz of [-1, 1]) {
    const sideHood = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7 * bulk, 4), purpleMat);
    sideHood.position.set(0, 1 * bulk, sz * 3.8 * bulk);
    sideHood.rotation.x = sz * 0.8;
    head.add(sideHood);
  }

  // 亮紫裂縫雙眼
  const eyeGeo = new THREE.BoxGeometry(1.0, 1.2 * bulk, 2.2 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, glowMat);
  face.eyeL.position.set(frontX * 0.82, 0.3, -2.0 * bulk);
  face.eyeL.rotation.x = 0.25;

  face.eyeR = new THREE.Mesh(eyeGeo, glowMat);
  face.eyeR.position.set(frontX * 0.82, 0.3, 2.0 * bulk);
  face.eyeR.rotation.x = -0.25;

  faceGroup.add(face.eyeL);
  faceGroup.add(face.eyeR);

  // --- 肩甲 ---
  for (const sz of [-1, 1]) {
    const paul = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.18, 0), purpleMat);
    paul.position.set(0, shoulderY + 1.2, sz * torsoW * 0.45);
    paul.scale.set(0.9, 0.8, 1.2);
    addAccent(paul);
  }

  // --- 四肢：暗影材質 ---
  const armW = 2.8 * bulk, legW = 3.2 * bulk;
  const armL = mkLimb(0, -shoulderX, true, shadowMat, purpleMat, GLOW, armW, 15);
  const armR = mkLimb(0, shoulderX, true, shadowMat, purpleMat, GLOW, armW, 15);
  const legL = mkLimb(0, -shoulderX * 0.8, false, shadowMat, purpleMat, GLOW, legW, 15);
  const legR = mkLimb(0, shoulderX * 0.8, false, shadowMat, purpleMat, GLOW, legW, 15);

  // --- 左手暗影匕首（右手由 buildWeapon 處理）---
  const handL = new THREE.Group();
  handL.position.y = -armLen;
  armL.add(handL);
  const leftDagger = makeShadowDagger(bladeMat, purpleMat);
  leftDagger.position.set(2, 0, 0);
  handL.add(leftDagger);

  // --- 背部散發的暗影披風碎片 ---
  for (let i = 0; i < 5; i++) {
    const capePart = new THREE.Mesh(new THREE.ConeGeometry(2.0, 15 + Math.random() * 8, 3), shadowMat);
    capePart.position.set(-torsoD * 0.65 - Math.random() * 5, torsoH * (0.1 + Math.random() * 0.7), (Math.random() - 0.5) * torsoW * 0.8);
    capePart.rotation.z = 0.5 + Math.random() * 0.5;
    capePart.rotation.y = (Math.random() - 0.5) * 0.5;
    torso.add(capePart);
  }

  return { torso, head, armL, armR, legL, legR };
}

// 右手暗影匕首
export function buildWeapon(hand, ctx) {
  const { reg, mat } = createWeaponKit(hand, ctx);
  const bladeMat = reg(mat('#9933ff', { rough: 0.2, metal: 0.5, emissive: new THREE.Color('#7a1fdd'), ei: 1.8 }));
  const hiltMat = reg(mat(PURPLE, { rough: 0.3, metal: 0.3, emissive: new THREE.Color('#4a0082') }));
  const dagger = makeShadowDagger(bladeMat, hiltMat);
  dagger.position.set(2, 0, 0);
  hand.add(dagger);
}
