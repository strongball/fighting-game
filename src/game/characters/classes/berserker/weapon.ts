// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildBerserkerWeapon(hand, ctx) {
  const { THREE, hand: weaponHand, base, reg, mat, shade, steel, dark, gold, accent, add } = createWeaponKit(hand, ctx);
  // 狂戰士：雙重熱能巨斧 (Twin Heat Tomahawks)
  hand.rotation.set(0, 0, -0.85);
  hand.position.x += 3.5;
  hand.position.y -= 1.5;
  
  // 巨型斧柄 (保持原樣，不加入 blade-group，以防手把拉長變形)
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 52, 8), dark), 3, -10, 0);

  // 巨大雙刃高熱發光斧面群組 (動態縮放)
  const bladeGroup = new THREE.Group();
  bladeGroup.name = 'blade-group';

  // 雙側斧刃
  const bladeL = new THREE.Mesh(new THREE.BoxGeometry(11, 24, 1.6), accent);
  bladeL.position.set(3, 10, 5.5);
  bladeL.castShadow = true;
  bladeGroup.add(bladeL);

  const bladeR = new THREE.Mesh(new THREE.BoxGeometry(11, 24, 1.6), accent);
  bladeR.position.set(3, 10, -5.5);
  bladeR.castShadow = true;
  bladeGroup.add(bladeR);

  // 斧頭主體結構
  const mainSteel = new THREE.Mesh(new THREE.BoxGeometry(7, 18, 9), steel);
  mainSteel.position.set(3, 10, 0);
  mainSteel.castShadow = true;
  bladeGroup.add(mainSteel);

  // 金色金屬箍與頂部發光尖刺
  const goldBand = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 5, 8), gold);
  goldBand.position.set(3, 10, 0);
  goldBand.castShadow = true;
  bladeGroup.add(goldBand);

  const spike = new THREE.Mesh(new THREE.ConeGeometry(2.0, 9, 6), steel);
  spike.position.set(3, 20, 0);
  spike.castShadow = true;
  bladeGroup.add(spike);

  hand.add(bladeGroup);
}
