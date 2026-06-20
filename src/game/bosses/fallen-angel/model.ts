// @ts-nocheck
// R9 審判之翼：墮落天使（巨大、雙翼展開）。一側純白羽翼、一側焦黑墮翼，黑化光環與聖痕，
// 半聖半墮的身軀，手持聖墮交織審判巨劍，垂落發光束縛鎖鏈。
// 配色：聖金 #f5d76e + 墮黑 #2c2c34 + 神聖白光 #fff2b0 + 暗影紫 #6a4a8e。
import * as THREE from 'three';
import { createWeaponKit } from '../../render3d/weaponKit.js';

export const modelConfig = { bulk: 5.0, weapon: 'none', scale: 2.6, head: 'triangle', wings: true, emissiveCore: '#fff2b0' };

const GOLD = '#f5d76e', DARK = '#2c2c34', LIGHT = '#fff2b0', SHADOW = '#6a4a8e';
const _UP = new THREE.Vector3(0, 1, 0);

// 羽翼：沿弧線扇形排列的羽毛（charred=焦黑殘破，有缺羽）
function buildWing(dirZ, featherMat, edgeMat, charred, torsoD, torsoW, shoulderY) {
  const wing = new THREE.Group();
  const rootX = -torsoD * 0.22, rootY = shoulderY + 4, rootZ = dirZ * torsoW * 0.3;
  for (let i = 0; i < 9; i++) {
    if (charred && i % 3 === 1) continue; // 殘破缺羽
    const t = i / 8;
    const a = -0.2 + t * 1.45;
    const span = 16 + t * 30;
    const len = 18 + t * 26;
    const dir = new THREE.Vector3(-0.28, Math.sin(a), dirZ * Math.cos(a)).normalize();
    const f = new THREE.Mesh(new THREE.ConeGeometry(3.4, len, 4), featherMat);
    f.scale.set(0.4, 1, 1.6); f.castShadow = true;
    f.quaternion.setFromUnitVectors(_UP, dir);
    f.position.set(rootX + dir.x * span, rootY + dir.y * span, rootZ + dir.z * span);
    wing.add(f);
  }
  // 翼骨前緣
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.4, torsoW * 0.9, 6), edgeMat);
  const bdir = new THREE.Vector3(-0.28, 0.7, dirZ * 0.66).normalize();
  bone.quaternion.setFromUnitVectors(_UP, bdir);
  bone.position.set(rootX + bdir.x * torsoW * 0.4, rootY + bdir.y * torsoW * 0.4, rootZ + bdir.z * torsoW * 0.4);
  wing.add(bone);
  return wing;
}

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, headY, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const whiteMat = reg(mat('#fbf3df', { rough: 0.55, metal: 0.25 }));
  const goldMat = reg(mat(GOLD, { rough: 0.3, metal: 0.85, emissive: new THREE.Color(GOLD), ei: 0.3 }));
  const darkMat = reg(mat(DARK, { rough: 0.6, metal: 0.55 }));
  const charMat = reg(mat('#1e1e25', { rough: 0.85, metal: 0.3 }));
  const featherWMat = reg(mat('#fefaf0', { rough: 0.7, metal: 0.05 }));
  const featherCMat = reg(mat('#222028', { rough: 0.88, metal: 0.1 }));
  const lightMat = reg(mat(LIGHT, { emissive: new THREE.Color(LIGHT), ei: 2.2, rough: 0.3 }));
  const shadowMat = reg(mat('#b08cff', { emissive: new THREE.Color(SHADOW), ei: 1.4, rough: 0.4 }));

  // --- 軀幹：半聖半墮（深度沿 X，核心透出）---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoD, torsoH * 1.2, torsoW * 0.84), whiteMat);
  torso.castShadow = true;
  // 墮黑半身（+Z 側）
  const darkHalf = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 1.02, torsoH * 1.22, torsoW * 0.43), charMat);
  darkHalf.position.set(0, 0, torsoW * 0.22); torso.add(darkHalf);
  // 金色胸甲 + 聖痕（白側）
  const chest = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.9, torsoH * 0.7, torsoW * 0.6), goldMat);
  chest.position.set(torsoD * 0.1, torsoH * 0.4, -torsoW * 0.05); torso.add(chest);
  for (let i = 0; i < 3; i++) {
    const sigil = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7, 1.6), lightMat);
    sigil.position.set(torsoD * 0.5, -2 + i * 3, -torsoW * (0.1 + i * 0.06)); torso.add(sigil);
  }
  // 墮黑側裂痕（暗紫光）
  for (let i = 0; i < 3; i++) {
    const crack = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6, 1.4), shadowMat);
    crack.position.set(torsoD * 0.45, (i - 1) * 6, torsoW * (0.18 + i * 0.05)); crack.rotation.x = 0.4; torso.add(crack);
  }
  // 腰封
  const belt = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 1.04, 4, torsoW * 0.88), goldMat);
  belt.position.y = -torsoH * 0.55; torso.add(belt);

  // --- 雙翼（左白右焦黑）---
  const wWhite = buildWing(-1, featherWMat, whiteMat, false, torsoD, torsoW, shoulderY); addAccent(wWhite);
  const wChar = buildWing(1, featherCMat, charMat, true, torsoD, torsoW, shoulderY); addAccent(wChar);

  // --- 頭：天使面甲 + 金冠 + 黑化光環 ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(6.5 * bulk, 14, 12), whiteMat);
  head.scale.set(0.95, 1.05, 0.95); head.castShadow = true;
  // 金冠
  const crown = new THREE.Mesh(new THREE.TorusGeometry(5.4 * bulk, 1.2, 6, 16), goldMat);
  crown.position.y = 4 * bulk; crown.rotation.x = Math.PI / 2; head.add(crown);
  for (let i = 0; i < 5; i++) {
    const a = -0.8 + i * 0.4;
    const point = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5 * bulk, 4), goldMat);
    point.position.set(frontX * 0.5 + Math.cos(a) * 2, 5 * bulk, Math.sin(a) * 5.2 * bulk); head.add(point);
  }
  // 蒙眼聖帶 + 金縫
  const band = new THREE.Mesh(new THREE.BoxGeometry(2, 3 * bulk, 14 * bulk), darkMat);
  band.position.set(frontX * 0.82, 0.5, 0); faceGroup.add(band);
  // 發光雙眼（金/暗紫）
  const eyeGeo = new THREE.BoxGeometry(1.4, 1.6, 3 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, lightMat); face.eyeL.position.set(frontX * 0.88, 0.5, -3 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, shadowMat); face.eyeR.position.set(frontX * 0.88, 0.5, 3 * bulk);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);
  // 黑化光環（頭頂傾斜環，半金半暗紫）
  const halo = new THREE.Mesh(new THREE.TorusGeometry(8 * bulk, 0.8, 6, 24), goldMat);
  halo.position.set(0, headY + 12, 0); halo.rotation.set(Math.PI / 2 - 0.4, 0, 0.2); addAccent(halo);
  const haloDark = new THREE.Mesh(new THREE.TorusGeometry(8 * bulk, 0.85, 6, 24, Math.PI), shadowMat);
  haloDark.position.set(0, headY + 12, 0); haloDark.rotation.set(Math.PI / 2 - 0.4, 0, 0.2); addAccent(haloDark);

  // --- 肩甲（左金右墮）---
  const paulL = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat);
  paulL.scale.set(1.1, 0.8, 1.2); paulL.position.set(0, shoulderY + 2, -torsoW * 0.5); addAccent(paulL);
  const paulR = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), charMat);
  paulR.scale.set(1.1, 0.8, 1.2); paulR.position.set(0, shoulderY + 2, torsoW * 0.5); addAccent(paulR);

  // --- 四肢（左聖右墮）---
  const armL = mkLimb(0, -shoulderX, true, whiteMat, goldMat, LIGHT);
  const armR = mkLimb(0, shoulderX, true, charMat, darkMat, SHADOW);
  const legL = mkLimb(0, -hipX, false, whiteMat, goldMat, LIGHT);
  const legR = mkLimb(0, hipX, false, charMat, darkMat, SHADOW);

  // 右腕垂落發光鎖鏈
  const chain = new THREE.Group(); chain.position.set(0, -armLen, 0); armR.add(chain);
  for (let i = 0; i < 5; i++) {
    const link = new THREE.Mesh(new THREE.TorusGeometry(2, 0.7, 6, 10), i % 2 ? shadowMat : goldMat);
    link.position.y = -4 - i * 4; link.rotation.x = i % 2 ? 0 : Math.PI / 2; chain.add(link);
  }

  return { torso, head, armL, armR, legL, legR };
}

// 右手聖墮審判巨劍：金白聖刃＋暗紫墮刃
export function buildWeapon(hand, ctx) {
  const { add, reg, mat } = createWeaponKit(hand, ctx);
  hand.rotation.set(0, 0, -1.05); // 劍向前傾，不再碰到身軀
  hand.position.x += 6;
  const goldMat = reg(mat(GOLD, { rough: 0.3, metal: 0.9, emissive: new THREE.Color(GOLD), ei: 0.4 }));
  const lightMat = reg(mat(LIGHT, { emissive: new THREE.Color(LIGHT), ei: 2.2, rough: 0.3 }));
  const shadowMat = reg(mat('#b08cff', { emissive: new THREE.Color(SHADOW), ei: 1.6, rough: 0.4 }));
  const darkMat = reg(mat(DARK, { rough: 0.5, metal: 0.6 }));
  add(new THREE.Mesh(new THREE.BoxGeometry(8, 70, 3), lightMat), 5, 24, -1.6);   // 聖刃半
  add(new THREE.Mesh(new THREE.BoxGeometry(8, 70, 3), shadowMat), 5, 24, 1.6);   // 墮刃半
  add(new THREE.Mesh(new THREE.ConeGeometry(5.2, 14, 4), lightMat), 5, 62, 0);   // 劍尖
  add(new THREE.Mesh(new THREE.BoxGeometry(26, 5, 6), goldMat), 5, -12, 0);      // 護手(展翼狀)
  for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.ConeGeometry(2.4, 12, 4), goldMat), 5, -12, sz * 12, 0, 0, sz * 1.3);
  add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 16, 8), darkMat), 5, -24, 0); // 柄
  add(new THREE.Mesh(new THREE.OctahedronGeometry(3, 0), goldMat), 5, -34, 0);   // 柄端聖石
}
