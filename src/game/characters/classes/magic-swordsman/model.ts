// @ts-nocheck
import * as THREE from 'three';
import { buildMagicSwordsmanWeapon } from './weapon.ts';

// pauldron set to false so we can craft highly-detailed pauldrons manually inside buildModel
export const modelConfig = { bulk: 1.9, weapon: 'magic-sword', skinKind: 'metal', headgear: '', pauldron: false, swingStyle: 'horizontal', stretchBlade: true };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, frontX, shoulderX, hipX,
    shoulderY, hipY,
    defaultBodyMat, darkMat, goldMat,
    faceGroup, helmAddons, mkLimb, addAccent,
  } = ctx;

  // ── 軀幹：金屬暗藍六角裝甲 ──
  const armorBaseColor = '#13143c'; // Dark metallic indigo-blue
  const armorMat = reg(mat(armorBaseColor, { rough: 0.25, metal: 0.85 }));
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.48, torsoW * 0.56, torsoH + 1, 6), armorMat);

  // 胸口魔能核心 (發光青藍色)
  const coreMat = reg(mat('#00f0ff', { emissive: new THREE.Color('#00d2ff'), ei: 3.5, rough: 0.1, metal: 0.5 }));
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.2, 0), coreMat);
  core.position.set(frontX * 0.55, torsoH * 0.08, 0);
  torso.add(core);

  const innerCoreMat = reg(mat('#ffffff', { emissive: new THREE.Color('#e0ffff'), ei: 4.5, rough: 0.05, metal: 0.2 }));
  const innerCore = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.09, 0), innerCoreMat);
  innerCore.position.copy(core.position);
  torso.add(innerCore);

  // 胸口環
  const ringMat = reg(mat('#00f3ff', { emissive: new THREE.Color('#00f3ff'), ei: 2.5, rough: 0.2, metal: 0.4 }));
  const chestRing = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.36, 1.0, 8, 24), ringMat);
  chestRing.position.copy(core.position);
  chestRing.rotation.x = Math.PI / 3;
  chestRing.rotation.y = Math.PI / 2;
  torso.add(chestRing);

  // 黃金裝甲飾邊（上下緣）
  const trimMat = reg(mat(new THREE.Color('#ffd700'), { emissive: new THREE.Color('#ffd700'), ei: 0.8, rough: 0.2, metal: 0.85 }));
  const trimTop = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.50, 0.8, 6, 6), trimMat);
  trimTop.position.set(0, torsoH * 0.48, 0);
  trimTop.rotation.x = Math.PI / 2;
  torso.add(trimTop);
  const trimBot = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.56, 0.8, 6, 6), trimMat);
  trimBot.position.set(0, -torsoH * 0.48, 0);
  trimBot.rotation.x = Math.PI / 2;
  torso.add(trimBot);

  // 腰帶（暗色 + 金色扣環）
  const beltMat = reg(mat('#0a0b1c', { rough: 0.7, metal: 0.1 }));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.54, 1.6, 6, 6), beltMat);
  belt.position.set(0, -torsoH * 0.28, 0);
  belt.rotation.x = Math.PI / 2;
  torso.add(belt);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.5, 2.5), trimMat);
  buckle.position.set(frontX * 0.35, -torsoH * 0.28, 0);
  torso.add(buckle);

  // 戰裙（三片裝甲板，暗藍色 + 金黃邊）
  const skirtMat = reg(mat('#0f102b', { rough: 0.35, metal: 0.8 }));
  const skirtTrim = reg(mat('#ffd700', { emissive: '#ffd700', ei: 0.3, rough: 0.3, metal: 0.8 }));
  for (let i = -1; i <= 1; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.5, 5.0, 4.0), skirtMat);
    plate.position.set(0, -torsoH * 0.5 - 2.5, i * 5.5);
    plate.rotation.x = 0.1 * i;
    torso.add(plate);
    const plateEdge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.8, 4.3), skirtTrim);
    plateEdge.position.set(0, -2.8, 0);
    plate.add(plateEdge);
  }

  // ── 披風（深靛藍背後披風，青藍流光內襯）──
  const capeMat = reg(mat('#0a0b22', { rough: 0.8, metal: 0.15 }));
  const cape = new THREE.Mesh(new THREE.BoxGeometry(2.0, torsoH * 1.4, torsoW * 0.75), capeMat);
  cape.castShadow = true;
  cape.position.set(-torsoD * 0.55, shoulderY - torsoH * 0.55, 0);
  cape.rotation.x = 0.15;

  const capeInnerMat = reg(mat('#00d2ff', { transparent: true, opacity: 0.35, emissive: '#00d2ff', ei: 1.5, side: THREE.DoubleSide }));
  const capeTrim = new THREE.Mesh(new THREE.BoxGeometry(0.8, torsoH * 1.2, torsoW * 0.7), capeInnerMat);
  capeTrim.castShadow = true;
  capeTrim.position.set(-torsoD * 0.45, shoulderY - torsoH * 0.52, 0);
  capeTrim.rotation.x = 0.12;

  // ── 浮游劍氣球體（5 顆沿軌道排列，青藍發光，滿層變金黃）──
  const floatOrbMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color('#00f0ff'), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  const floatCoreMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.9 }));
  const floatRingMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color('#00d2ff'), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  const swordEnergyOrbs = [];
  for (let i = 0; i < 5; i++) {
    const orb = new THREE.Group();
    const isLast = i === 4;
    const size = isLast ? 1.3 : 1.0;
    const col = isLast ? '#ffd700' : '#00f3ff';
    const colMat = reg(new THREE.MeshBasicMaterial({ color: new THREE.Color(col), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    const orbCore = new THREE.Mesh(new THREE.SphereGeometry(4.2 * size, 10, 8), floatCoreMat);
    const orbGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(7.5 * size, 1), colMat);
    const orbRing = new THREE.Mesh(new THREE.TorusGeometry(9.5 * size, 0.7, 5, 16), floatRingMat);
    orbRing.rotation.x = Math.PI / 3;
    orb.add(orbGlow, orbCore, orbRing);
    orb.userData.swordEnergyIndex = i;
    orb.visible = false;
    orb.castShadow = true;
    swordEnergyOrbs.push(orb);
  }

  // ── 額外浮游小劍氣（青藍）──
  const extraMat = reg(mat('#00f3ff', { transparent: true, opacity: 0.4, emissive: '#00f3ff', ei: 1.5, side: THREE.DoubleSide }));
  const extraOrbs = [];
  for (let i = 0; i < 3; i++) {
    const extra = new THREE.Mesh(new THREE.OctahedronGeometry(3.5, 0), extraMat);
    extra.userData.extraOrbitIndex = i;
    extra.visible = true;
    extra.castShadow = true;
    extraOrbs.push(extra);
  }

  // ── 頭部：簡潔鑽石頭盔 (深靛藍面盔 + T形發光青藍眼縫 + 金冠 + 紅羽冠) ──
  const helmMat = reg(mat('#15163b', { rough: 0.28, metal: 0.85 }));
  const head = new THREE.Group();
  const helmMain = new THREE.Mesh(new THREE.OctahedronGeometry(6.8 * bulk, 0), helmMat);
  head.add(helmMain);

  // 前方護面甲 + T 形眼縫
  const visorMat = reg(mat('#0c0d24', { rough: 0.2, metal: 0.9 }));
  const visor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 7.2), visorMat);
  visor.position.set(frontX * 0.5, 0.2, 0);
  head.add(visor);

  const eyeSlitMat = reg(mat('#ffffff', { emissive: new THREE.Color('#00f0ff'), ei: 4.5 }));
  const eyeH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 5.5), eyeSlitMat);
  eyeH.position.set(frontX * 1.1, 0.2, 0);
  head.add(eyeH);
  const eyeV = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.0, 0.35), eyeSlitMat);
  eyeV.position.set(frontX * 1.1, 0.2, 0);
  head.add(eyeV);

  // 金色頭冠
  const crest = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 6.0), trimMat);
  crest.position.set(frontX * 0.3, 6.0, 0);
  head.add(crest);
  const crestGem = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), reg(mat('#00ff88', { emissive: '#00ff88', ei: 2.5, rough: 0.1, metal: 0.3 })));
  crestGem.position.set(frontX * 0.3, 5.5, 0);
  head.add(crestGem);

  // 紅色流線型長羽飾 (Plume) - 展現精緻的羽冠造型
  const plumeMat = reg(mat('#d63031', { rough: 0.5, metal: 0.15 }));
  const plumeG = new THREE.Group();
  plumeG.position.set(-3.5, 6.5, 0);
  plumeG.rotation.z = -0.4;
  for (let i = 0; i < 4; i++) {
    const segment = new THREE.Mesh(new THREE.BoxGeometry(4.0 - i * 0.8, 2.5, 3.5 - i * 0.6), plumeMat);
    segment.position.set(-i * 2.8, -i * 1.2, 0);
    segment.rotation.z = -0.15;
    segment.castShadow = true;
    plumeG.add(segment);
  }
  head.add(plumeG);

  // ── 四肢：金屬裝甲 (手腳使用與軀幹相同的暗藍金屬與發光環) ──
  const limbMat = reg(mat(armorBaseColor, { rough: 0.3, metal: 0.8 }));
  const limbBootMat = reg(mat('#0a0b1f', { rough: 0.4, metal: 0.7 }));
  const armL = mkLimb(0, -shoulderX, true, limbMat, limbBootMat, '#00d2ff');
  const armR = mkLimb(0, shoulderX, true, limbMat, limbBootMat, '#00d2ff');
  const legL = mkLimb(0, -hipX, false, limbMat, limbBootMat, '#00d2ff');
  const legR = mkLimb(0, hipX, false, limbMat, limbBootMat, '#00d2ff');

  // 金色護膝
  const kneeMat = reg(mat('#ffd700', { emissive: '#ffd700', ei: 0.4, rough: 0.3, metal: 0.8 }));
  const kneeL = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 4), kneeMat);
  kneeL.scale.set(1.3, 0.6, 1.0);
  kneeL.position.set(1.8, -10, 0);
  legL.add(kneeL);
  const kneeR = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 4), kneeMat);
  kneeR.scale.set(1.3, 0.6, 1.0);
  kneeR.position.set(1.8, -10, 0);
  legR.add(kneeR);

  // ── 自訂肩甲 (Pauldrons) ──
  // 建立左右手對稱的肩甲板，隨手臂旋轉與移動
  for (const [arm, side] of [[armL, -1], [armR, 1]]) {
    const pGroup = new THREE.Group();
    // 肩甲主裝甲板
    const mainPlate = new THREE.Mesh(new THREE.BoxGeometry(5.8, 6.0, 7.5), limbMat);
    mainPlate.castShadow = true;
    mainPlate.position.set(0, 1.0, side * 0.5);
    mainPlate.rotation.z = -side * 0.15;
    pGroup.add(mainPlate);
    
    // 金色頂邊飾條
    const edgeTrim = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1.2, 8.0), trimMat);
    edgeTrim.castShadow = true;
    edgeTrim.position.set(0, 3.2, 0);
    mainPlate.add(edgeTrim);
    
    // 側邊青藍色魔能水晶核心
    const pCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), coreMat);
    pCore.position.set(2.6 * side, 0, 0);
    pCore.rotation.y = Math.PI / 2;
    mainPlate.add(pCore);

    arm.add(pGroup);
  }

  return { torso, head, armL, armR, legL, legR, swordEnergyOrbs, extraOrbs, cape, capeTrim };
}

export const buildWeapon = buildMagicSwordsmanWeapon;
