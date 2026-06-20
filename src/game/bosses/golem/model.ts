// @ts-nocheck
// R1 巨木傀儡：木石魔像。覆滿樹皮與苔蘚的軀幹、雙樹幹臂、頭頂樹冠。
// 胸口綠色生命核心由 bosses/render3d.ts 的共用 core 提供（emissiveCore）。
// 回傳標準 6 件部位（torso/head/armL/armR/legL/legR）沿用走路／揮擊動畫骨架。
import * as THREE from 'three';

export const modelConfig = { bulk: 5.0, weapon: 'none', scale: 2.2, head: 'square', emissiveCore: '#9acd32' };

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade,
    torsoW, torsoH, frontX,
    shoulderX, hipX, face, faceGroup, mkLimb,
  } = ctx;

  const BARK = '#6b4a2b';
  const barkMat = reg(mat(BARK, { rough: 0.96, metal: 0.0 }));
  const barkDarkMat = reg(mat(shade(BARK, -0.3), { rough: 0.96, metal: 0.0 }));
  const mossMat = reg(mat('#6b8e23', { rough: 0.9, metal: 0.0 }));
  const mossBrightMat = reg(mat('#7ac050', { rough: 0.85, metal: 0.0, emissive: new THREE.Color('#3f6b1f'), ei: 0.3 }));
  const leafMat = reg(mat('#4a7a2c', { rough: 0.82, metal: 0.0 }));
  const leafDarkMat = reg(mat('#37601f', { rough: 0.85, metal: 0.0 }));
  const eyeMat = reg(mat('#c8ff6a', { emissive: new THREE.Color('#9acd32'), ei: 2.4, rough: 0.4 }));

  // --- 軀幹：粗壯樹幹（前後略扁，露出胸口生命核心）---
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(torsoW * 0.52, torsoW * 0.68, torsoH * 1.2, 10, 1),
    barkMat,
  );
  torso.scale.set(0.82, 1, 1.08);
  torso.castShadow = true;

  // 樹皮縱稜
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(2.4, torsoH * 1.12, 4), barkDarkMat);
    ridge.position.set(Math.cos(a) * torsoW * 0.5, (Math.random() - 0.5) * 3, Math.sin(a) * torsoW * 0.56);
    ridge.lookAt(0, ridge.position.y, 0);
    torso.add(ridge);
  }
  // 苔蘚塊
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const moss = new THREE.Mesh(new THREE.SphereGeometry(3.5 + Math.random() * 4, 8, 6), i % 2 ? mossMat : mossBrightMat);
    moss.scale.set(1.5, 0.5, 1.5);
    moss.position.set(Math.cos(a) * torsoW * 0.46, (Math.random() - 0.25) * torsoH * 0.7, Math.sin(a) * torsoW * 0.52);
    torso.add(moss);
  }
  // 胸口樹洞（框住共用生命核心）
  const socket = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.24, 3.2, 8, 18), barkDarkMat);
  socket.position.set(torsoW * 0.42, torsoH * 0.1, 0);
  socket.rotation.y = Math.PI / 2;
  torso.add(socket);

  // --- 頭部：苔石方顱 ---
  const head = new THREE.Mesh(new THREE.BoxGeometry(13 * bulk, 12 * bulk, 13 * bulk), barkMat);
  head.castShadow = true;
  // 頭頂苔蓋 + 樹冠葉簇
  const cap = new THREE.Mesh(new THREE.BoxGeometry(13.6 * bulk, 3 * bulk, 13.6 * bulk), mossMat);
  cap.position.y = 6.3 * bulk; head.add(cap);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(4 + Math.random() * 3.5, 0), i % 2 ? leafMat : leafDarkMat);
    leaf.position.set((Math.random() - 0.5) * 9 * bulk, 8.5 * bulk + Math.random() * 5 * bulk, (Math.random() - 0.5) * 9 * bulk);
    leaf.scale.setScalar(1.1 + Math.random() * 0.9); head.add(leaf);
  }
  // 枯枝獸角
  for (const sz of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.4, 9 * bulk, 5), barkDarkMat);
    horn.position.set(0, 7 * bulk, sz * 5 * bulk);
    horn.rotation.x = sz * 0.5; horn.rotation.z = 0.2; head.add(horn);
  }
  // 發光綠眼 + 粗眉
  const eyeGeo = new THREE.BoxGeometry(2, 3.4, 4.4);
  face.eyeL = new THREE.Mesh(eyeGeo, eyeMat); face.eyeL.position.set(frontX * 0.82, 0.5, -3.2 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, eyeMat); face.eyeR.position.set(frontX * 0.82, 0.5, 3.2 * bulk);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);
  const brow = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 17 * bulk), barkDarkMat);
  brow.position.set(frontX * 0.72, 3.6, 0); faceGroup.add(brow);

  // --- 雙樹幹臂（粗壯、無持械，以樹瘤拳砸擊）---
  const armW = 8 * bulk, armLen = 19;
  const armL = mkLimb(0, -shoulderX, true, barkMat, barkDarkMat, '#7ac050', armW, armLen);
  const armR = mkLimb(0, shoulderX, true, barkMat, barkDarkMat, '#7ac050', armW, armLen);
  for (const arm of [armL, armR]) {
    const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(armW * 0.82, 0), barkMat);
    fist.position.y = -armLen; fist.castShadow = true; arm.add(fist);
    const fistMoss = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.42, 8, 6), mossBrightMat);
    fistMoss.scale.set(1.3, 0.6, 1.3); fistMoss.position.y = -armLen + armW * 0.5; arm.add(fistMoss);
    const armMoss = new THREE.Mesh(new THREE.SphereGeometry(armW * 0.4, 8, 6), mossMat);
    armMoss.scale.set(1.1, 0.5, 1.1); armMoss.position.set(armW * 0.42, -armLen * 0.35, 0); arm.add(armMoss);
  }

  // --- 根狀腿 ---
  const legW = 9 * bulk, legLen = 15;
  const legL = mkLimb(0, -hipX, false, barkMat, barkDarkMat, '#6b8e23', legW, legLen);
  const legR = mkLimb(0, hipX, false, barkMat, barkDarkMat, '#6b8e23', legW, legLen);
  for (const leg of [legL, legR]) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const root = new THREE.Mesh(new THREE.ConeGeometry(2.6, 11, 5), barkMat);
      root.position.set(Math.cos(a) * legW * 0.55, -legLen - legW * 0.45, Math.sin(a) * legW * 0.55);
      root.rotation.z = Math.cos(a) * 0.7; root.rotation.x = -Math.sin(a) * 0.7;
      leg.add(root);
    }
  }

  return { torso, head, armL, armR, legL, legR };
}

// 巨木傀儡以雙臂砸擊，無持械
export function buildWeapon() {}
