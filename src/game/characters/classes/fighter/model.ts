// @ts-nocheck
import * as THREE from 'three';
import { buildFighterWeapon } from './weapon.ts';

// 武僧：光頭戒疤、念珠、斜披橙色袈裟、繃帶前臂、背後金色氣勁環。膚色裸上身、厚實。
export const modelConfig = { bulk: 2.1, weapon: 'gloves', skinKind: 'skin', headgear: 'none' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH,
    shoulderX, hipX, frontX,
    defaultBootMat, face, faceGroup, helmAddons, mkLimb,
  } = ctx;

  const skinMat = reg(mat(0xe0a878, { rough: 0.62, metal: 0.04 }));   // 膚色
  const sashMat = reg(mat(0xd9711f, { rough: 0.55, metal: 0.05 }));   // 橙袈裟
  const beadMat = reg(mat(0x5b3a1e, { rough: 0.5, metal: 0.2 }));     // 念珠木
  const wrapMat = reg(mat(0xeae0cf, { rough: 0.78, metal: 0.02 }));   // 繃帶
  const qiMat = reg(mat(shade(base, 0.35), { metal: 0.6, rough: 0.2, emissive: new THREE.Color(base), ei: 1.6 })); // 金氣

  // 厚實裸上身
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.98, torsoH, torsoD * 0.92), skinMat);
  // 斜披袈裟（左肩到右腰）
  const sash = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 1.05, torsoH * 0.4, torsoD * 1.03), sashMat);
  sash.rotation.z = 0.52; sash.position.y = torsoH * 0.04; torso.add(sash);
  // 腰帶
  const belt = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 1.0, 3.4, torsoD * 0.98), sashMat);
  belt.position.y = -torsoH * 0.42; torso.add(belt);
  // 背後金色氣勁環（日輪）
  const sunRing = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.5, 1.8, 8, 24), qiMat);
  sunRing.position.set(-torsoD * 0.52, torsoH * 0.08, 0); sunRing.rotation.y = Math.PI / 2; torso.add(sunRing);

  // 光頭
  const head = new THREE.Mesh(new THREE.SphereGeometry(7.6 * bulk, 16, 12), skinMat);
  // 戒疤（頭頂三點）
  for (let i = -1; i <= 1; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.7 * bulk, 6, 6), beadMat);
    dot.position.set(0.4 * bulk, 6.6 * bulk, i * 2.0 * bulk); helmAddons.add(dot);
  }
  // 念珠項鍊（繞頸）
  const beads = new THREE.Mesh(new THREE.TorusGeometry(7.6 * bulk, 1.1 * bulk, 6, 18), beadMat);
  beads.rotation.x = Math.PI / 2; beads.position.set(0, -2.6 * bulk, 0); helmAddons.add(beads);

  // 沉穩暖金的眼
  const eyeMat = reg(mat(0xfff1c0, { emissive: 0xffcf6a, ei: 1.6 }));
  face.eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 2.2), eyeMat); face.eyeL.position.set(frontX - 0.4, 0.7, -2.4 * bulk); face.eyeL.rotation.z = -0.18;
  face.eyeR = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 2.2), eyeMat); face.eyeR.position.set(frontX - 0.4, 0.7, 2.4 * bulk); face.eyeR.rotation.z = 0.18;
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  // 手臂膚色、前臂繃帶；腿穿橙褲
  const armL = mkLimb(0, -shoulderX, true, skinMat, wrapMat, base);
  const armR = mkLimb(0, shoulderX, true, skinMat, wrapMat, base);
  const legL = mkLimb(0, -hipX, false, sashMat, defaultBootMat, base);
  const legR = mkLimb(0, hipX, false, sashMat, defaultBootMat, base);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildFighterWeapon;

export { attachSkinGear } from './gear.ts';
