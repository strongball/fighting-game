// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildMagicSwordsmanWeapon(hand, ctx) {
  const kit = createWeaponKit(hand, ctx);
  const { THREE, reg, mat } = kit;
  
  // Rotate hand to make the character hold the massive sword correctly
  hand.rotation.set(0, 0, -0.85);
  hand.position.x += 3.5;
  hand.position.y -= 1.5;

  // Create sub-groups for blade and hilt/guard
  const bladeGroup = new THREE.Group();
  bladeGroup.name = 'magic-sword-blade';
  hand.add(bladeGroup);

  const hiltGroup = new THREE.Group();
  hiltGroup.name = 'magic-sword-hilt';
  hand.add(hiltGroup);

  // Helper for adding meshes to bladeGroup (the crystal blade and emissive core)
  const addBlade = (m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    m.castShadow = true;
    m.receiveShadow = true;
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    bladeGroup.add(m);
    return m;
  };

  // Helper for adding meshes to hiltGroup (the crossguard, gem, hilt, pommel)
  const addHilt = (m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    m.castShadow = true;
    m.receiveShadow = true;
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    hiltGroup.add(m);
    return m;
  };

  // ── 精緻材質定義 ──
  // 青藍水晶刀刃
  const cyanCrystal = reg(mat('#00f3ff', { emissive: new THREE.Color('#00d2ff'), ei: 3.2, rough: 0.1, metal: 0.5, transparent: true, opacity: 0.85 }));
  // 核心強光
  const brightCore = reg(mat('#ffffff', { emissive: new THREE.Color('#e0ffff'), ei: 4.8, rough: 0.05, metal: 0.2 }));
  // 護手翡翠綠寶石
  const emeraldGem = reg(mat('#00ff88', { emissive: new THREE.Color('#00ff88'), ei: 3.8, rough: 0.1, metal: 0.2 }));
  // 金色裝甲
  const goldMetal = reg(mat('#ffd700', { rough: 0.18, metal: 0.9 }));
  // 暗鋼加固件/把手
  const darkSteel = reg(mat('#12132e', { rough: 0.6, metal: 0.7 }));

  // ── 巨型劍刃 (高約 80 單位，寬度厚度均大幅增加，跟角色一樣大) ──
  // 主劍刃 (水晶主體)
  const bladeMain = new THREE.Mesh(new THREE.BoxGeometry(8.5, 52, 3.2), cyanCrystal);
  addBlade(bladeMain, 3, 26, 0);

  // 劍尖 (水晶劍尖)
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(5.0, 24, 4), cyanCrystal);
  addBlade(bladeTip, 3, 64, 0, 0, Math.PI / 4, 0);

  // ── 劍刃中央流光核心 (白色強光 core) ──
  const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(1.6, 75, 0.8), brightCore);
  addBlade(coreGlow, 3, 28, 0);

  // ── 劍刃兩側加固暗鋼甲 (Exquisite brace with gold trims near hilt) ──
  const brace = new THREE.Mesh(new THREE.BoxGeometry(9.6, 14, 4.0), darkSteel);
  addHilt(brace, 3, 7, 0);

  const braceGold1 = new THREE.Mesh(new THREE.BoxGeometry(10.0, 1.5, 4.4), goldMetal);
  addHilt(braceGold1, 3, 13, 0);

  const braceGold2 = new THREE.Mesh(new THREE.BoxGeometry(10.0, 1.5, 4.4), goldMetal);
  addHilt(braceGold2, 3, 1, 0);

  // ── 護手：金色雙翼羽翼護手 ──
  const guardL = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 2.5), goldMetal);
  addHilt(guardL, 3, -5, -6.5, 0.35, 0, 0);

  const guardR = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 2.5), goldMetal);
  addHilt(guardR, 3, -5, 6.5, -0.35, 0, 0);

  // 護手中段暗鋼基座
  const guardCenter = new THREE.Mesh(new THREE.BoxGeometry(5.5, 6.0, 5.5), darkSteel);
  addHilt(guardCenter, 3, -5, 0);

  // 護手中心翡翠綠寶石 (對應原畫中心的綠寶石 eye 細節)
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(4.0, 0), emeraldGem);
  addHilt(gem, 3, -5, 0);

  // ── 握柄與劍首 ──
  // 雙手大劍長把手 (深色皮革鋼骨)
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 26, 8), darkSteel);
  addHilt(grip, 3, -20, 0);

  // 握柄防滑螺旋金色環裝飾
  for (let i = 0; i < 3; i++) {
    const gripRing = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.5, 6, 12), goldMetal);
    addHilt(gripRing, 3, -12 - i * 6, 0, Math.PI / 2, 0, 0);
  }

  // 金色劍首
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(3.6, 8, 8), goldMetal);
  addHilt(pommel, 3, -34, 0);

  // 劍首末端發光青藍水晶
  const pommelGem = new THREE.Mesh(new THREE.OctahedronGeometry(2.0, 0), cyanCrystal);
  addHilt(pommelGem, 3, -37, 0);
}
