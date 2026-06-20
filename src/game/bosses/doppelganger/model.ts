// @ts-nocheck
// R10 另一個自己（終焉之神）：流動變形的虛空剪影。由虛空與星光構成的鏡面軀體、表面裂開流瀉
// 白光、灑落星點，頭頂懸浮王者冠與光環，肩背垂落流動虛空披風。配色：虛空黑 + 星光白 #e8e8f0
// + 裂縫白光 + 王冠金 #ffe9a8 + 終焉靛 #c9c0ff。
import * as THREE from 'three';
import { createWeaponKit } from '../../render3d/weaponKit.js';

export const modelConfig = { bulk: 7.0, weapon: 'none', scale: 3.0, head: 'circle', emissiveCore: '#ffffff', phases: 3, voidBody: true };

const VOID = '#0c0c18', STAR = '#e8e8f0', GOLD = '#ffe9a8', AURA = '#c9c0ff';

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, headY, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const voidMat = reg(mat(VOID, { rough: 0.25, metal: 0.7, emissive: new THREE.Color('#161630'), ei: 0.4, env: 1.3 }));
  const voidDarkMat = reg(mat('#070710', { rough: 0.4, metal: 0.6 }));
  const crackMat = reg(mat('#ffffff', { emissive: new THREE.Color('#e6e8ff'), ei: 2.6, rough: 0.2 }));
  const starMat = reg(mat('#ffffff', { emissive: new THREE.Color(STAR), ei: 1.8, rough: 0.3 }));
  const eyeMat = reg(mat('#ffffff', { emissive: new THREE.Color('#cfd2ff'), ei: 3.0, rough: 0.2 }));
  const goldMat = reg(mat(GOLD, { emissive: new THREE.Color(GOLD), ei: 1.3, metal: 0.7, rough: 0.3 }));
  const auraMat = reg(mat(AURA, { emissive: new THREE.Color(AURA), ei: 1.6, rough: 0.3 }));

  const crack = (parent, fx, h) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.2, h, 1.2), crackMat);
    c.position.set(fx, (Math.random() - 0.5) * torsoH, (Math.random() - 0.5) * torsoW * 0.55);
    c.rotation.z = (Math.random() - 0.5) * 1.6; parent.add(c);
  };
  const star = (parent, rad) => {
    const a = Math.random() * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random(), 6, 5), starMat);
    s.position.set(Math.cos(a) * rad, (Math.random() - 0.5) * torsoH * 1.1, Math.sin(a) * torsoW * 0.5); parent.add(s);
  };

  // --- 軀幹：鏡面虛空塊體（裂縫流光 + 星點）---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoD, torsoH * 1.32, torsoW * 0.86), voidMat);
  torso.castShadow = true;
  const ab = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 1.02, torsoH * 0.5, torsoW * 0.66), voidDarkMat);
  ab.position.y = -torsoH * 0.6; torso.add(ab);
  for (let i = 0; i < 8; i++) crack(torso, torsoD * 0.5, 6 + Math.random() * 9);
  for (let i = 0; i < 4; i++) crack(torso, -torsoD * 0.5, 5 + Math.random() * 7);
  for (let i = 0; i < 16; i++) star(torso, torsoD * 0.5);
  // 胸口終焉核心框
  const ring = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.2, 3, 8, 24), goldMat);
  ring.position.set(torsoD * 0.5, torsoH * 0.12, 0); ring.rotation.y = Math.PI / 2; torso.add(ring);

  // --- 流動虛空披風（肩背垂落的撕裂帶）---
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3;
    const len = 44 + (1 - Math.abs(t)) * 22;
    const cape = new THREE.Mesh(new THREE.ConeGeometry(5 - Math.abs(t) * 1.5, len, 4), i % 2 ? voidMat : voidDarkMat);
    cape.position.set(-torsoD * 0.45, torsoH * 0.4 - len * 0.4, t * torsoW * 0.42);
    cape.rotation.x = Math.PI + t * 0.2; cape.rotation.z = -0.15; cape.scale.set(1.3, 1, 0.5); torso.add(cape);
    if (i % 2 === 0) { const edge = new THREE.Mesh(new THREE.ConeGeometry(1.2, len * 0.9, 4), crackMat); edge.position.copy(cape.position); edge.position.x -= 1; edge.rotation.copy(cape.rotation); torso.add(edge); }
  }

  // --- 頭：虛空頭顱 + 流光眼 + 王者冠 + 光環 ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(6 * bulk, 14, 12), voidMat);
  head.scale.set(0.92, 1.05, 0.92); head.castShadow = true;
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5 * bulk, 0.8), crackMat); c.position.set(frontX * 0.7, -1, (i - 1) * 2.4 * bulk); c.rotation.x = (i - 1) * 0.4; head.add(c); }
  const eyeGeo = new THREE.BoxGeometry(1.4, 2.4, 3.2 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, eyeMat); face.eyeL.position.set(frontX * 0.86, 0.5, -2.8 * bulk); face.eyeL.rotation.x = 0.2;
  face.eyeR = new THREE.Mesh(eyeGeo, eyeMat); face.eyeR.position.set(frontX * 0.86, 0.5, 2.8 * bulk); face.eyeR.rotation.x = -0.2;
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // 王者冠（金冠 + 尖突）
  const crown = new THREE.Group(); crown.position.y = headY + 5 * bulk; addAccent(crown);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(5.6 * bulk, 6 * bulk, 2.6 * bulk, 12), goldMat); crown.add(band);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const h = i % 2 ? 7 * bulk : 4 * bulk;
    const pt = new THREE.Mesh(new THREE.ConeGeometry(1.4, h, 4), goldMat);
    pt.position.set(Math.cos(a) * 5.8 * bulk, 2 * bulk + h * 0.4, Math.sin(a) * 5.8 * bulk); crown.add(pt);
    if (i % 2) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), auraMat); gem.position.set(Math.cos(a) * 5.8 * bulk, 2 * bulk + h, Math.sin(a) * 5.8 * bulk); crown.add(gem); }
  }
  // 懸浮光環
  const halo = new THREE.Mesh(new THREE.TorusGeometry(7.5 * bulk, 0.9, 8, 28), auraMat);
  halo.position.set(0, headY + 14 * bulk, 0); halo.rotation.set(Math.PI / 2 - 0.35, 0, 0.15); addAccent(halo);

  // --- 肩甲（虛空稜晶）---
  for (const sz of [-1, 1]) {
    const paul = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.17, 0), voidMat);
    paul.scale.set(0.9, 0.8, 1.1); paul.position.set(0, shoulderY + 4, sz * torsoW * 0.5); paul.castShadow = true; addAccent(paul);
    const edge = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.16, 1.4, 6, 16), crackMat);
    edge.position.set(0, shoulderY + 4, sz * torsoW * 0.5); edge.rotation.y = Math.PI / 2; addAccent(edge);
  }

  // --- 四肢：虛空肢體 + 裂縫流光環 ---
  const armW = 6.5 * bulk;
  const armL = mkLimb(0, -shoulderX, true, voidMat, voidDarkMat, '#ffffff', armW, 17);
  const armR = mkLimb(0, shoulderX, true, voidMat, voidDarkMat, '#ffffff', armW, 17);
  const legL = mkLimb(0, -hipX, false, voidMat, voidDarkMat, AURA, 8 * bulk, 16);
  const legR = mkLimb(0, hipX, false, voidMat, voidDarkMat, AURA, 8 * bulk, 16);

  return { torso, head, armL, armR, legL, legR };
}

// 右手凝聚的虛空巨劍（黑刃＋星光裂縫刃緣）
export function buildWeapon(hand, ctx) {
  const { add, reg, mat } = createWeaponKit(hand, ctx);
  hand.rotation.set(0, 0, -1.25); // 盔甲巨大，劍向前傾更多以免穿出
  hand.position.x += 12;
  const voidMat = reg(mat(VOID, { rough: 0.25, metal: 0.7, emissive: new THREE.Color('#161630'), ei: 0.4 }));
  const crackMat = reg(mat('#ffffff', { emissive: new THREE.Color('#e6e8ff'), ei: 2.6, rough: 0.2 }));
  const goldMat = reg(mat(GOLD, { emissive: new THREE.Color(GOLD), ei: 1.2, metal: 0.7, rough: 0.3 }));
  add(new THREE.Mesh(new THREE.BoxGeometry(9, 72, 3.2), voidMat), 5, 24, 0);        // 黑刃
  add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 66, 3.6), crackMat), 5, 24, 0);     // 中央星光裂縫
  add(new THREE.Mesh(new THREE.ConeGeometry(5, 14, 4), voidMat), 5, 62, 0);         // 劍尖
  add(new THREE.Mesh(new THREE.ConeGeometry(5.4, 15, 4), crackMat), 5, 62, 0.2);    // 劍尖流光
  add(new THREE.Mesh(new THREE.BoxGeometry(24, 5, 6), goldMat), 5, -13, 0);         // 護手
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 18, 8), voidMat), 5, -25, 0); // 柄
  add(new THREE.Mesh(new THREE.OctahedronGeometry(3.4, 0), crackMat), 5, -36, 0);   // 柄端星核
}
