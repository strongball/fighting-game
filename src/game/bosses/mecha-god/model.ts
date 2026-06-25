// @ts-nocheck
// R7 機械真神 3D 造型定義 (Chibi Mecha Robot)
import * as THREE from 'three';

export const modelConfig = { 
  bulk: 2.6, 
  weapon: 'none', 
  scale: 2.2, 
  head: 'cube', 
  emissiveCore: '#ff5500', 
  translucent: false 
};

const STEEL_GREY = '#4e5a65';
const ORANGE_GLOW = '#ff5500';
const BRIGHT_CYAN = '#00f0ff';
const DARK_METAL = '#2c3e50';

export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade, torsoW, torsoD, torsoH, shoulderY, shoulderX, hipX, frontX, armLen,
    face, faceGroup, mkLimb, addAccent,
  } = ctx;

  const greyMat = reg(mat(STEEL_GREY, { rough: 0.4, metal: 0.7 }));
  const darkMat = reg(mat(DARK_METAL, { rough: 0.35, metal: 0.9 }));
  const glowMat = reg(mat(ORANGE_GLOW, { emissive: new THREE.Color(ORANGE_GLOW), ei: 2.0 }));
  const eyeMat = reg(mat(BRIGHT_CYAN, { emissive: new THREE.Color(BRIGHT_CYAN), ei: 2.5 }));

  // --- 軀幹：厚重的機械裝甲箱體 ---
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.75, torsoH * 0.9, torsoD * 0.75), greyMat);
  torso.name = 'torso';
  torso.castShadow = true;

  // 胸口發光核 (Energy Core)
  const core = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.18, torsoW * 0.18, 2, 8), glowMat);
  core.rotation.x = Math.PI / 2;
  core.position.set(torsoD * 0.38, 0, 0);
  torso.add(core);

  // 肩膀裝甲護墊 (Shoulder Pads)
  for (const sz of [-1, 1]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.3, torsoH * 0.25, torsoD * 0.35), darkMat);
    pad.position.set(0, torsoH * 0.4, sz * torsoW * 0.45);
    pad.castShadow = true;
    torso.add(pad);
  }

  // --- 背部噴射背包 (Thruster Jetpack) ---
  const jetpack = new THREE.Group();
  jetpack.position.set(-torsoD * 0.4, torsoH * 0.1, 0);
  
  const mainBox = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.25, torsoH * 0.6, torsoD * 0.5), darkMat);
  mainBox.castShadow = true;
  jetpack.add(mainBox);

  // 雙噴射口 (Cone Thrusters)
  for (const sz of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.08, torsoH * 0.25, 6), glowMat);
    nozzle.position.set(-torsoW * 0.05, -torsoH * 0.35, sz * torsoD * 0.18);
    nozzle.rotation.z = Math.PI / 6; // 向後傾斜
    jetpack.add(nozzle);
  }
  torso.add(jetpack);

  // --- 頭部：正方形機械頭盔與發光眼部面罩 ---
  const head = new THREE.Mesh(new THREE.BoxGeometry(7.0 * bulk, 7.0 * bulk, 7.0 * bulk), greyMat);
  head.castShadow = true;

  // 青色發光面罩 (Cyan Visor)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2, 1.8 * bulk, 5.0 * bulk), eyeMat);
  visor.position.set(3.6 * bulk, 0.4, 0);
  head.add(visor);

  // 頂部天線 (Antenna)
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.0 * bulk, 4), darkMat);
  ant.position.y = 4.8 * bulk;
  ant.rotation.z = -0.2;
  head.add(ant);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), glowMat);
  antTip.position.y = 6.8 * bulk;
  head.add(antTip);

  // --- 雙手：粗壯的機械手臂 (Rocket Arm) ---
  const armW = 3.6 * bulk;
  const armL = mkLimb(0, -shoulderX, true, greyMat, darkMat, STEEL_GREY, armW, armLen);
  const armR = mkLimb(0, shoulderX, true, greyMat, darkMat, STEEL_GREY, armW, armLen);

  // 加裝火箭拳套 (Fist enhancements)
  const fistL = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 5), darkMat);
  fistL.position.y = -armLen * 0.55;
  armL.add(fistL);
  const fistR = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 5), darkMat);
  fistR.position.y = -armLen * 0.55;
  armR.add(fistR);

  // --- 雙腳：穩健的機械腿部 ---
  const legW = 3.8 * bulk;
  const legL = mkLimb(1, -hipX, false, greyMat, darkMat, STEEL_GREY, legW, armLen * 0.95);
  const legR = mkLimb(1, hipX, false, greyMat, darkMat, STEEL_GREY, legW, armLen * 0.95);

  const parts = { torso, head, armL, armR, legL, legR };
  
  let timeAcc = 0;
  parts.customUpdate = (dt) => {
    timeAcc += dt;
    // 天線尖端微弱呼吸起伏
    antTip.scale.setScalar(1.0 + Math.sin(timeAcc * 6) * 0.15);
  };

  return parts;
}

export function buildWeapon(hand, ctx) {
  // 機械真神以拳套與噴射雷射施法，不生成外置持械
}
