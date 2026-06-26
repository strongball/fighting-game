// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildMagicSwordsmanWeapon(hand, ctx) {
  const { THREE, reg, mat, add } = createWeaponKit(hand, ctx);
  hand.rotation.set(0, 0, -0.8);
  hand.position.x += 2;

  // 魔能結晶大劍：多面體刃 + 流光核心 + 華麗護手
  const crystal = reg(mat('#a29bfe', { emissive: new THREE.Color('#6c5ce7'), ei: 2.5, rough: 0.1, metal: 0.7 }));
  const bright = reg(mat('#f0f0ff', { emissive: new THREE.Color('#a29bfe'), ei: 3.5, rough: 0.05, metal: 0.2 }));
  const pink = reg(mat('#fd79a8', { emissive: new THREE.Color('#fd79a8'), ei: 2.2, rough: 0.2, metal: 0.5 }));
  const dark = reg(mat('#1a1a2e', { rough: 0.75, metal: 0.2 }));
  const gold = reg(mat(0xffd700, { rough: 0.15, metal: 0.9 }));

  // 主劍刃：寬底窄尖的晶石造型（雙層疊加）
  const bladeMain = new THREE.Mesh(new THREE.BoxGeometry(4.8, 38, 2.6), crystal);
  bladeMain.position.set(3, 20, 0);
  add(bladeMain);

  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(2.8, 18, 4), crystal);
  bladeTip.position.set(3, 46, 0);
  add(bladeTip);

  // 劍刃中央流光核心
  const coreGlow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 54, 0.4), bright);
  coreGlow.position.set(3, 22, 0);
  add(coreGlow);

  // 側邊發光稜線（讓刃看起來有水晶層次）
  for (const sz of [-1, 1]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 34, 0.6), bright);
    edge.position.set(3, 20, sz * 2.0);
    add(edge);
  }

  // 護手：粉紅雙翼造形（兩片斜角）
  const guardL = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 1.8), pink);
  guardL.position.set(3, -5, -5.5);
  guardL.rotation.x = 0.3;
  add(guardL);

  const guardR = new THREE.Mesh(new THREE.BoxGeometry(7, 2.5, 1.8), pink);
  guardR.position.set(3, -5, 5.5);
  guardR.rotation.x = -0.3;
  add(guardR);

  const guardCenter = new THREE.Mesh(new THREE.BoxGeometry(4, 3.5, 3.5), gold);
  guardCenter.position.set(3, -5, 0);
  add(guardCenter);

  // 護手寶石
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(3.0, 0), bright);
  gem.position.set(3, -2.5, 0);
  add(gem);

  // 握柄
  const gripMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.0, 14, 8), dark);
  gripMesh.position.set(3, -15, 0);
  add(gripMesh);

  // 劍首寶石
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 8), pink);
  pommel.position.set(3, -23, 0);
  add(pommel);
}
