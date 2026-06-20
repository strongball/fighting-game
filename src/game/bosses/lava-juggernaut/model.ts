// @ts-nocheck
// R3 熔岩鐵衛：黑鐵全身重甲的雙足重裝兵。甲縫透出熔岩橘紅光、胸口熔岩爐心、
// 左手鐵塔盾、右手熔岩巨劍。配色：玄鐵黑 #2b2b30 + 熔岩橘 #ff5a1f + 餘燼紅 #ff3010。
// 人形骨架：torso 深度沿 +X（讓共用熔岩核心從胸口透出）、寬度沿 Z。
import * as THREE from 'three';
import { createWeaponKit } from '../../render3d/weaponKit.js';

export const modelConfig = { bulk: 4.5, weapon: 'none', scale: 2.2, head: 'square', emissiveCore: '#ff5a1f' };

const IRON = '#2b2b30', LAVA = '#ff5a1f', EMBER = '#ff3010';

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const ironMat = reg(mat(IRON, { rough: 0.42, metal: 0.9 }));
  const ironDarkMat = reg(mat(shade(IRON, -0.4), { rough: 0.5, metal: 0.82 }));
  const ironLightMat = reg(mat(shade(IRON, 0.14), { rough: 0.38, metal: 0.92 }));
  const lavaMat = reg(mat(LAVA, { emissive: new THREE.Color(LAVA), ei: 2.0, rough: 0.4, metal: 0.2 }));
  const emberMat = reg(mat(EMBER, { emissive: new THREE.Color(EMBER), ei: 1.4, rough: 0.5, metal: 0.3 }));

  const crack = (parent, fx, h) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.3, h, 1.3), lavaMat);
    c.position.set(fx, (Math.random() - 0.5) * torsoH, (Math.random() - 0.5) * torsoW * 0.55);
    c.rotation.x = (Math.random() - 0.5) * 1.5; parent.add(c);
  };

  // --- 軀幹：黑鐵重甲（深度沿 X、寬度沿 Z）---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoD, torsoH * 1.2, torsoW * 0.86), ironMat);
  torso.castShadow = true;
  // 腹甲分節
  const ab = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 1.02, torsoH * 0.5, torsoW * 0.62), ironDarkMat);
  ab.position.y = -torsoH * 0.55; torso.add(ab);
  // 熔岩裂縫
  for (let i = 0; i < 7; i++) crack(torso, torsoD * 0.5, 5 + Math.random() * 8);
  for (let i = 0; i < 4; i++) crack(torso, -torsoD * 0.5, 5 + Math.random() * 6);
  // 胸口熔岩爐心框（框住共用核心）
  const vent = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.2, 3.2, 8, 18), ironLightMat);
  vent.position.set(torsoD * 0.5, torsoH * 0.12, 0); vent.rotation.y = Math.PI / 2; torso.add(vent);
  // 頸護甲
  const collar = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.8, torsoH * 0.3, torsoW * 0.5), ironLightMat);
  collar.position.y = torsoH * 0.62; torso.add(collar);

  // --- 頭：黑鐵盔 + 熔岩面甲 ---
  const head = new THREE.Mesh(new THREE.BoxGeometry(11 * bulk, 11 * bulk, 12 * bulk), ironMat);
  head.castShadow = true;
  const helmTop = new THREE.Mesh(new THREE.BoxGeometry(11.6 * bulk, 3 * bulk, 12.4 * bulk), ironDarkMat);
  helmTop.position.y = 5.5 * bulk; head.add(helmTop);
  // 面甲熔岩橫縫
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8 * bulk, 9 * bulk), lavaMat);
  visor.position.set(frontX * 0.92, 0.5, 0); head.add(visor);
  // 盔頂後掃雙角
  for (const sz of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(2.4, 13 * bulk, 5), ironDarkMat);
    horn.position.set(-2 * bulk, 5.5 * bulk, sz * 4 * bulk); horn.rotation.z = 0.7; horn.rotation.x = sz * 0.25; head.add(horn);
  }
  // 發光面甲眼（faceGroup；只有 scale.y 受眨眼動畫影響）
  const eyeGeo = new THREE.BoxGeometry(1.4, 1.5 * bulk, 3 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, lavaMat); face.eyeL.position.set(frontX * 0.96, 0.6, -3 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, lavaMat); face.eyeR.position.set(frontX * 0.96, 0.6, 3 * bulk);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // --- 巨型肩甲（含尖刺與熔岩飾條）---
  for (const sz of [-1, 1]) {
    const paul = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.78, torsoH * 0.7, torsoW * 0.3), ironLightMat);
    paul.position.set(0, shoulderY + 3, sz * torsoW * 0.48); paul.castShadow = true; addAccent(paul);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.8, 1.8, torsoW * 0.32), lavaMat);
    trim.position.set(0, shoulderY - 2.5, sz * torsoW * 0.48); addAccent(trim);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(3.2, 14, 5), ironDarkMat);
    spike.position.set(0, shoulderY + 11, sz * torsoW * 0.52); spike.rotation.z = sz * 0.2; addAccent(spike);
  }

  // --- 四肢：重甲 + 熔岩接環 ---
  const armL = mkLimb(0, -shoulderX, true, ironMat, ironDarkMat, LAVA);
  const armR = mkLimb(0, shoulderX, true, ironMat, ironDarkMat, LAVA);
  const legL = mkLimb(0, -hipX, false, ironMat, ironDarkMat, LAVA);
  const legR = mkLimb(0, hipX, false, ironMat, ironDarkMat, LAVA);

  // --- 左手鐵塔盾（broad 面朝 +X 前方）---
  const shield = new THREE.Group();
  shield.position.set(torsoD * 0.34, -armLen, shoulderX * 0.18);
  const shieldBody = new THREE.Mesh(new THREE.BoxGeometry(3.5, torsoH * 2.7, torsoW * 0.62), ironMat);
  shieldBody.castShadow = true; shield.add(shieldBody);
  const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(4.2, torsoH * 2.7, 4), ironLightMat);
  for (const sz of [-1, 1]) { const r = shieldRim.clone(); r.position.set(0, 0, sz * torsoW * 0.3); shield.add(r); }
  const boss = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 10), lavaMat);
  boss.position.set(2.5, 0, 0); boss.scale.set(0.6, 1, 1); shield.add(boss);
  // 盾面熔岩十字裂縫
  const vc = new THREE.Mesh(new THREE.BoxGeometry(2, torsoH * 2.2, 2.4), lavaMat); vc.position.set(2, 0, 0); shield.add(vc);
  const hc = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, torsoW * 0.5), lavaMat); hc.position.set(2, 0, 0); shield.add(hc);
  armL.add(shield);

  return { torso, head, armL, armR, legL, legR };
}

// 右手熔岩巨劍：鐵刃 + 中央熔岩槽 + 餘燼刃緣
export function buildWeapon(hand, ctx) {
  const { add, reg, mat } = createWeaponKit(hand, ctx);
  hand.rotation.set(0, 0, -1.05); // 劍向前傾，不再碰到鎧甲
  hand.position.x += 6;
  const ironMat = reg(mat(IRON, { rough: 0.42, metal: 0.9 }));
  const lavaMat = reg(mat(LAVA, { emissive: new THREE.Color(LAVA), ei: 2.2, rough: 0.4, metal: 0.2 }));
  const emberMat = reg(mat(EMBER, { emissive: new THREE.Color(EMBER), ei: 1.4, rough: 0.5, metal: 0.3 }));
  add(new THREE.Mesh(new THREE.BoxGeometry(9, 66, 3.2), ironMat), 5, 22, 0);        // 劍身
  add(new THREE.Mesh(new THREE.BoxGeometry(2.8, 62, 3.6), lavaMat), 5, 22, 0);      // 中央熔岩槽
  add(new THREE.Mesh(new THREE.BoxGeometry(9.6, 66, 0.8), emberMat), 5, 22, 1.8);   // 刃緣餘燼
  add(new THREE.Mesh(new THREE.ConeGeometry(4.5, 12, 4), ironMat), 5, 58, 0);       // 劍尖
  add(new THREE.Mesh(new THREE.BoxGeometry(22, 5, 6), ironMat), 5, -13, 0);         // 護手
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 18, 8), ironMat), 5, -25, 0); // 劍柄
  add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), lavaMat), 5, -35, 0);    // 柄端熔岩核
}
