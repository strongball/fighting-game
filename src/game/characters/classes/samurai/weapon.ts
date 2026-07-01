// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildSamuraiWeapon(hand, ctx) {
  const { THREE, reg, mat, add } = createWeaponKit(hand, ctx);
  
  // 微調手部旋轉與位置，配合握把位置優化
  hand.rotation.set(0, 0, -1.22);
  hand.position.x += 2.5;

  const steelTex = ctx.materialTex ? ctx.materialTex('steel', 'armor') : null;
  const wrapTex = ctx.materialTex ? ctx.materialTex('leather', 'robe') : null;

  const steelMat = reg(mat('#f2f0dc', { map: steelTex, emissive: new THREE.Color('#766f58'), ei: 0.5, rough: 0.22, metal: 0.95 }));
  const redGlow = reg(mat('#d94343', { emissive: new THREE.Color('#d94343'), ei: 1.8, rough: 0.15, metal: 0.45 }));
  const wrapMat = reg(mat('#171111', { map: wrapTex, rough: 0.82, metal: 0.25 }));
  // 用黑鐵 (dark steel) 取代黃金，使武器看起來更沉穩且符合「墮天」設定
  const darkSteel = reg(mat('#262525', { map: steelTex, rough: 0.5, metal: 0.8 }));

  // 刀刃群組 (會被動態拉伸)
  const bladeGroup = new THREE.Group();
  bladeGroup.name = 'blade-group';
  // 將刀刃群組起點定位在護手上方 (Y = 6)，當刀刃拉伸時，它會從護手處向上延展，而不會向下壓縮手部/握把
  bladeGroup.position.set(3.5, 6, 0);

  // 刀刃主體 (更加寬、加厚、加長)
  // 長度為 82，所以在群組內中心位於 41，底部剛好為 0
  const bladeMain = new THREE.Mesh(new THREE.BoxGeometry(4.2, 82, 2.2), steelMat);
  bladeMain.position.set(0, 41, 0);
  bladeMain.castShadow = true;
  bladeGroup.add(bladeMain);

  // 刀背的能量刻紋槽 (赤紅色強光，與刀身一同拉伸)
  const energySlotL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 76, 0.4), redGlow);
  energySlotL.position.set(-1.8, 38, 0.8);
  energySlotL.castShadow = true;
  bladeGroup.add(energySlotL);

  const energySlotR = energySlotL.clone();
  energySlotR.position.z = -0.8;
  bladeGroup.add(energySlotR);

  // 刀尖 (刀本體長 82，刀尖中心位在 82 + 7 = 89)
  const bladeTip = new THREE.Mesh(new THREE.ConeGeometry(2.9, 14, 4), steelMat);
  bladeTip.position.set(0, 89, 0);
  bladeTip.rotation.y = Math.PI / 4;
  bladeTip.castShadow = true;
  bladeGroup.add(bladeTip);

  hand.add(bladeGroup);

  // 護手與刀柄 (保持原樣不拉伸)
  // 將手部抓握點設在 Y = 0，護手設在 Y = 6，握柄從 Y = -16 到 6，達成最真實的揮動支點
  // 黑鐵護手 (Tsuba)
  add(new THREE.Mesh(new THREE.CylinderGeometry(7.8, 8.2, 3.2, 8), darkSteel), 3.5, 6, 0, 0, Math.PI / 8, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(10.5, 2.0, 3.8), redGlow), 3.5, 6, 0);

  // 刀柄 (Tsuka)
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 22, 8), wrapMat), 3.5, -5, 0);

  // 刀柄領 (Fuchi) 與柄頭 (Kashira) - 亦採用黑鐵材質
  add(new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.8, 8), darkSteel), 3.5, 4.2, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.1, 2.2, 8), darkSteel), 3.5, -16.9, 0);

  // 飄逸的裝飾緞帶 (從柄頭垂下，約 Y = -18 以下)
  add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 18, 1.6), redGlow), 3.1, -25.9, 0.5, 0.1, 0, 0.15);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 15, 1.3), steelMat), 3.9, -24.4, -0.5, -0.1, 0, -0.15);
}
