// @ts-nocheck
// R4 霜雪刺客：纖細的半透明冰晶刺客。稜面冰晶軀體、菱形冰晶頭顱＋霜冠、雙手冰結匕首、
// 背後霜晶碎片。配色：冰藍 #74e0ff + 霜白 #e0f8ff + 內透幽光 #bfefff。
// 註：材質皆 reg()，分身(假身)由引擎用 skinMats 透明度＋閃爍區分；真身較實。
import * as THREE from 'three';
import { createWeaponKit } from '../../render3d/weaponKit.js';

export const modelConfig = { bulk: 2.5, weapon: 'none', scale: 1.5, head: 'triangle', emissiveCore: '#bfefff', translucent: true };

const ICE = '#74e0ff', FROST = '#e0f8ff', GLOW = '#bfefff';

// 鋸齒冰匕（刃朝 +Y）
function makeDagger(bladeMat, hiltMat) {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.ConeGeometry(2.0, 22, 4), bladeMat); blade.position.y = 13; g.add(blade);
  const barb = new THREE.Mesh(new THREE.ConeGeometry(1.2, 9, 4), bladeMat); barb.position.set(1.6, 8, 0); barb.rotation.z = -0.5; g.add(barb);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.2), hiltMat); guard.position.y = 1.5; g.add(guard);
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 7, 6), hiltMat); hilt.position.y = -2.5; g.add(hilt);
  return g;
}

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const iceMat = reg(mat(ICE, { rough: 0.2, metal: 0.15, emissive: new THREE.Color('#2f7fb0'), ei: 0.5, env: 1.2 }));
  const crystalMat = reg(mat('#9fe8ff', { rough: 0.12, metal: 0.2, emissive: new THREE.Color('#49d0ff'), ei: 0.9, env: 1.3 }));
  const frostMat = reg(mat(FROST, { rough: 0.3, metal: 0.1, emissive: new THREE.Color('#9fe8ff'), ei: 0.4 }));
  const glowMat = reg(mat(GLOW, { emissive: new THREE.Color(GLOW), ei: 2.4, rough: 0.2 }));
  const bladeMat = reg(mat('#cdf6ff', { rough: 0.1, metal: 0.25, emissive: new THREE.Color('#9fe8ff'), ei: 1.6 }));

  // --- 軀幹：纖細稜面冰晶（深度沿 X，露出共用核心）---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoD * 0.32, torsoD * 0.46, torsoH * 1.2, 6), iceMat);
  torso.castShadow = true;
  // 胸口冰晶（框住共用核心）
  const chestCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.2, 0), crystalMat);
  chestCrystal.position.set(torsoD * 0.42, torsoH * 0.1, 0); chestCrystal.scale.set(0.7, 1.2, 1); torso.add(chestCrystal);
  // 肩背霜晶尖刺
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.ConeGeometry(2.0, 10 + Math.random() * 6, 4), crystalMat);
    shard.position.set(Math.cos(a) * torsoD * 0.3, torsoH * 0.4, Math.sin(a) * torsoW * 0.28);
    shard.rotation.x = -Math.sin(a) * 0.8; shard.rotation.z = Math.cos(a) * 0.8 - 0.3; torso.add(shard);
  }

  // --- 頭：菱形冰晶 + 霜冠 + 幽光眼 ---
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(6.5 * bulk, 0), iceMat);
  head.scale.set(0.85, 1.25, 0.85); head.castShadow = true;
  // 後掃霜冠
  for (let i = 0; i < 3; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.3, 9 * bulk - i * 2, 4), crystalMat);
    spike.position.set(-2 * bulk - i * 1.5 * bulk, 4 * bulk, 0); spike.rotation.z = 1.0; head.add(spike);
  }
  for (const sz of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6 * bulk, 4), crystalMat);
    cheek.position.set(0, 1 * bulk, sz * 4 * bulk); cheek.rotation.x = sz * 0.9; head.add(cheek);
  }
  // 幽光裂眼
  const eyeGeo = new THREE.BoxGeometry(1.2, 1.4 * bulk, 2.6 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, glowMat); face.eyeL.position.set(frontX * 0.86, 0.4, -2.4 * bulk); face.eyeL.rotation.x = 0.3;
  face.eyeR = new THREE.Mesh(eyeGeo, glowMat); face.eyeR.position.set(frontX * 0.86, 0.4, 2.4 * bulk); face.eyeR.rotation.x = -0.3;
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // --- 肩部冰晶甲 ---
  for (const sz of [-1, 1]) {
    const paul = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.16, 0), crystalMat);
    paul.position.set(0, shoulderY + 1, sz * torsoW * 0.42); paul.scale.set(0.8, 0.7, 1.1); addAccent(paul);
  }

  // --- 纖細四肢 ---
  const armW = 3.0 * bulk, legW = 3.4 * bulk;
  const armL = mkLimb(0, -shoulderX, true, iceMat, crystalMat, GLOW, armW, 15);
  const armR = mkLimb(0, shoulderX, true, iceMat, crystalMat, GLOW, armW, 15);
  const legL = mkLimb(0, -hipX, false, iceMat, crystalMat, GLOW, legW, 15);
  const legR = mkLimb(0, hipX, false, iceMat, crystalMat, GLOW, legW, 15);

  // --- 左手冰匕（右手由 buildWeapon 處理）---
  const handL = new THREE.Group(); handL.position.y = -armLen; armL.add(handL);
  const leftDagger = makeDagger(bladeMat, crystalMat); leftDagger.position.set(3, 0, 0); handL.add(leftDagger);

  // --- 背後懸浮霜晶碎片 ---
  for (let i = 0; i < 4; i++) {
    const frag = new THREE.Mesh(new THREE.TetrahedronGeometry(2.2 + Math.random() * 1.6), frostMat);
    frag.position.set(-torsoD * 0.6 - Math.random() * 6, torsoH * (0.2 + Math.random() * 0.6), (Math.random() - 0.5) * torsoW * 0.7);
    addAccent(frag);
  }

  return { torso, head, armL, armR, legL, legR };
}

// 右手冰匕
export function buildWeapon(hand, ctx) {
  const { reg, mat } = createWeaponKit(hand, ctx);
  const bladeMat = reg(mat('#cdf6ff', { rough: 0.1, metal: 0.25, emissive: new THREE.Color('#9fe8ff'), ei: 1.6 }));
  const hiltMat = reg(mat('#9fe8ff', { rough: 0.12, metal: 0.2, emissive: new THREE.Color('#49d0ff'), ei: 0.9 }));
  const dagger = makeDagger(bladeMat, hiltMat); dagger.position.set(3, 0, 0); hand.add(dagger);
}
