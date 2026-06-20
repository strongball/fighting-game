// @ts-nocheck
// R6 死靈樂章：漂浮的幽冥指揮巫妖。破舊暗袍下襬懸空、撕裂飄帶、兜帽下是虛空臉孔與
// 綠靈火雙眼、雙手燃綠靈火、手持斷裂指揮棒兼死神鐮。身周護盾泡由共用 minionShield 繪製。
// 配色：幽紫 #7d5fff + 靈綠 #39ff88 + 屍袍灰 #3a3248。
// float：rig 不讀此旗標，改以「袍襬懸於地面上方＋飄帶」呈現漂浮；無可見雙腿。
import * as THREE from 'three';
import { createWeaponKit } from '../../render3d/weaponKit.js';

export const modelConfig = { bulk: 3.5, weapon: 'none', robe: true, scale: 2.0, head: 'circle', float: true, emissiveCore: '#39ff88' };

const PURPLE = '#7d5fff', SOUL = '#39ff88', ROBE = '#3a3248';

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, hipY, shoulderY, shoulderX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const robeMat = reg(mat(ROBE, { rough: 0.9, metal: 0.05 }));
  const robeDarkMat = reg(mat(shade(ROBE, -0.4), { rough: 0.92, metal: 0.05 }));
  const robeTrimMat = reg(mat(PURPLE, { rough: 0.6, metal: 0.2, emissive: new THREE.Color(PURPLE), ei: 0.5 }));
  const soulMat = reg(mat(SOUL, { emissive: new THREE.Color(SOUL), ei: 2.4, rough: 0.3 }));
  const voidMat = reg(mat('#0a0a12', { rough: 0.9, metal: 0.1 }));
  const boneMat = reg(mat('#d8d0c0', { rough: 0.6, metal: 0.1 }));

  // --- 軀幹：袍身（上窄下闊的長袍，下襬懸空）---
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.32, torsoW * 0.6, 36, 9), robeMat);
  torso.castShadow = true;
  // 袍前襟（幽紫飾條）
  const placket = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.5, 30, 2), robeTrimMat);
  placket.position.set(torsoW * 0.5, -2, 0); placket.rotation.y = Math.PI / 2; torso.add(placket);
  // 撕裂的下襬飄帶（懸於地面上方）
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = 8 + Math.random() * 9;
    const tatter = new THREE.Mesh(new THREE.ConeGeometry(2.2, len, 4), i % 2 ? robeMat : robeDarkMat);
    tatter.position.set(Math.cos(a) * torsoW * 0.56, -18 - len * 0.3, Math.sin(a) * torsoW * 0.56);
    tatter.rotation.x = Math.PI + Math.sin(a) * 0.3; tatter.rotation.z = Math.cos(a) * 0.3; torso.add(tatter);
  }
  // 肩部聳起的袍領
  for (const sz of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.2, torsoW * 0.34, 5), robeDarkMat);
    collar.position.set(0, 16, sz * torsoW * 0.28); collar.rotation.x = sz * 0.5; collar.rotation.z = -0.2; torso.add(collar);
  }
  // 胸前綠靈火（環繞共用核心的小火苗）
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 5), soulMat);
    flame.position.set(torsoW * 0.48, 6 + i * 4, (i - 1) * 5); torso.add(flame);
  }

  // --- 頭：兜帽下的虛空臉孔 + 綠靈火眼（黑頭縮小內縮，不再凸出兜帽兩側）---
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.6 * bulk, 12, 10), voidMat);
  head.castShadow = true;
  // 尖兜帽外殼（加大包覆）
  const hood = new THREE.Mesh(new THREE.ConeGeometry(8 * bulk, 17 * bulk, 8), robeMat);
  hood.position.set(-1.2 * bulk, 3.5 * bulk, 0); hood.rotation.z = -0.12; head.add(hood);
  // 兜帽下緣垂布（包住頭兩側與後方）
  const cowl = new THREE.Mesh(new THREE.ConeGeometry(6.8 * bulk, 9 * bulk, 8), robeMat);
  cowl.position.set(-1 * bulk, -1 * bulk, 0); head.add(cowl);
  // 兜帽邊緣（露臉開口）
  const brim = new THREE.Mesh(new THREE.TorusGeometry(4.6 * bulk, 1.6, 8, 16), robeDarkMat);
  brim.position.set(frontX * 0.46, -0.5 * bulk, 0); brim.rotation.y = Math.PI / 2; brim.scale.set(1, 1.25, 1); head.add(brim);
  // 綠靈火雙眼（faceGroup；scale.y 受眨眼）
  const eyeGeo = new THREE.SphereGeometry(1.8, 8, 8);
  face.eyeL = new THREE.Mesh(eyeGeo, soulMat); face.eyeL.position.set(frontX * 0.82, 0.5, -1.8 * bulk); face.eyeL.scale.set(1, 1.5, 0.8);
  face.eyeR = new THREE.Mesh(eyeGeo, soulMat); face.eyeR.position.set(frontX * 0.82, 0.5, 1.8 * bulk); face.eyeR.scale.set(1, 1.5, 0.8);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);
  // 眼上飄升的靈火尾
  for (const sz of [-1, 1]) {
    const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.8, 5 * bulk, 4), soulMat);
    wisp.position.set(frontX * 0.82, 3 * bulk, sz * 1.8 * bulk); faceGroup.add(wisp);
  }

  // --- 雙臂：垂袖 + 綠靈火手 ---
  const armW = 3.2 * bulk;
  const armL = mkLimb(0, -shoulderX, true, robeMat, robeDarkMat, SOUL, armW, 16);
  const armR = mkLimb(0, shoulderX, true, robeMat, robeDarkMat, SOUL, armW, 16);
  for (const arm of [armL, armR]) {
    const sleeve = new THREE.Mesh(new THREE.ConeGeometry(armW * 1.3, 12, 6), robeDarkMat);
    sleeve.position.y = -armLen + 2; sleeve.rotation.x = Math.PI; arm.add(sleeve);
    const soulHand = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.7, 10, 8), soulMat);
    soulHand.position.y = -armLen - 2; soulHand.scale.set(1, 1.3, 1); arm.add(soulHand);
  }

  // --- 「腿」改為兩條搖曳的靈質飄帶（沿用 leg pivot 的走路擺動）---
  const mkWisp = (sz) => {
    const w = new THREE.Group(); w.position.set(0, hipY - 2, sz * torsoW * 0.18);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(3, 18, 5), robeDarkMat);
    tail.position.y = -9; tail.rotation.x = Math.PI; w.add(tail);
    const glow = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 4), soulMat);
    glow.position.y = -16; glow.rotation.x = Math.PI; w.add(glow);
    return w;
  };
  const legL = mkWisp(-1), legR = mkWisp(1);

  return { torso, head, armL, armR, legL, legR };
}

// 右手：斷裂指揮棒／死神鐮（綠靈火刃）
export function buildWeapon(hand, ctx) {
  const { add, reg, mat } = createWeaponKit(hand, ctx);
  const boneMat = reg(mat('#cfc7b4', { rough: 0.6, metal: 0.1 }));
  const darkMat = reg(mat('#2a2436', { rough: 0.8, metal: 0.2 }));
  const soulMat = reg(mat(SOUL, { emissive: new THREE.Color(SOUL), ei: 2.2, rough: 0.3 }));
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 46, 6), darkMat), 4, 14, 0);     // 斷裂長柄
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 8, 6), boneMat), 4, 38, 0, 0, 0, 0.5); // 斷裂接口(歪)
  add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), soulMat), 4, 40, 0);            // 棒頭靈火
  // 死神鐮刃（彎月）
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5, 1.4), soulMat);
    const a = -0.2 + i * 0.32;
    add(seg, 4 + Math.sin(a) * 14, 40 + Math.cos(a) * 14 - 2, 0, 0, 0, a);
  }
  add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 6), soulMat), 4, -8, 0);             // 柄底靈火
}
