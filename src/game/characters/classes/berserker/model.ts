// @ts-nocheck
import * as THREE from 'three';
import { buildBerserkerWeapon } from './weapon.ts';

export const modelConfig = { bulk: 2.6, weapon: 'axes', skinKind: 'metal', headgear: 'horns', pauldron: true, swingStyle: 'horizontal', stretchBlade: true };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat,
    torsoW, torsoD, torsoH,
    shoulderX, hipX, frontX,
    defaultBodyMat, defaultHeadMat, defaultArmMat, defaultBootMat,
    darkMat, accentHelmMat, darkHelmMat,
    face, faceGroup, helmAddons, mkLimb
  } = ctx;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), defaultBodyMat);
  for (const sz of [-1, 1]) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 4), darkMat);
    spike.position.set(torsoW * 0.35, torsoH * 0.35, sz * torsoD * 0.35); spike.rotation.z = -Math.PI / 4; torso.add(spike);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 8), reg(mat(0xff0000, { emissive: 0xff0000, ei: 2.4 })));
    core.rotation.x = Math.PI / 2; core.position.set(torsoW * 0.2, torsoH * 0.1, sz * torsoD * 0.45); torso.add(core);
  }

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.8, torsoH * 0.7, 6), darkMat);
  backpack.position.set(-torsoD * 0.5 - 2.8, 0, 0); torso.add(backpack);

  const redFireMat = reg(mat(0xff0000, { emissive: 0xff0000, ei: 3.0 }));
  for (const sz of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 4, 8), darkMat);
    nozzle.position.set(-torsoD * 0.5 - 3.8, -torsoH * 0.2, sz * torsoW * 0.28);
    nozzle.rotation.z = Math.PI / 2 + 0.15; torso.add(nozzle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.5, 7, 8), redFireMat);
    flame.position.set(-torsoD * 0.5 - 7.0, -torsoH * 0.32, sz * torsoW * 0.28);
    flame.rotation.z = Math.PI / 2 + 0.15; torso.add(flame);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(7.5 * bulk, 16, 12), defaultHeadMat);

  const eyeMat = reg(mat(0xff0000, { emissive: 0xff0000, ei: 2.8 }));
  face.eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 2.4), eyeMat); face.eyeL.position.set(frontX - 0.4, 1.2, -2.4 * bulk); face.eyeL.rotation.z = 0.25;
  face.eyeR = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 2.4), eyeMat); face.eyeR.position.set(frontX - 0.4, 1.2, 2.4 * bulk); face.eyeR.rotation.z = -0.25;
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  for (const sz of [-1, 1]) {
    const hornBase = new THREE.Mesh(new THREE.CylinderGeometry(2.4 * bulk, 3.2 * bulk, 6 * bulk, 8), darkHelmMat);
    hornBase.position.set(0, 6 * bulk, sz * 5 * bulk); hornBase.rotation.x = sz * 0.6; helmAddons.add(hornBase);
    const hornTip = new THREE.Mesh(new THREE.ConeGeometry(1.8 * bulk, 16 * bulk, 8), accentHelmMat);
    hornTip.position.set(0, 11 * bulk, sz * 8 * bulk); hornTip.rotation.x = sz * 1.1; helmAddons.add(hornTip);
  }

  const armL = mkLimb(0, -shoulderX, true, defaultArmMat, defaultBootMat, base);
  const armR = mkLimb(0, shoulderX, true, defaultArmMat, defaultBootMat, base);
  const legL = mkLimb(0, -hipX, false, defaultBodyMat, defaultBootMat, base);
  const legR = mkLimb(0, hipX, false, defaultBodyMat, defaultBootMat, base);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildBerserkerWeapon;
