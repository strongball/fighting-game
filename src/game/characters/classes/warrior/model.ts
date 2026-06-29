// @ts-nocheck
import * as THREE from 'three';
import { buildWarriorWeapon } from './weapon.ts';

export const modelConfig = { bulk: 2.36, weapon: 'sword', skinKind: 'metal', headgear: 'helm', pauldron: true, swingStyle: 'horizontal', stretchBlade: true };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, hipY, shoulderY, headY,
    shoulderX, hipX, frontX,
    defaultBodyMat, defaultHeadMat, defaultArmMat, defaultBootMat,
    darkMat, goldMat, helmMat, accentHelmMat,
    face, faceGroup, helmAddons, mkLimb, addAccent
  } = ctx;

  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), defaultBodyMat);
  
  const coreCol = new THREE.Color(base);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.22, torsoW * 0.22, 3, 12), reg(mat(coreCol, { metal: 0.8, emissive: coreCol, ei: 2.2 })));
  core.rotation.x = Math.PI / 2; core.position.set(0, torsoH * 0.05, torsoD * 0.5 + 1.2); torso.add(core);

  const chestArmor = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.23, 1.4, 8, 16), goldMat);
  chestArmor.position.set(0, torsoH * 0.05, torsoD * 0.5 + 0.4); torso.add(chestArmor);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.8, torsoH * 0.8, 6), darkMat);
  backpack.position.set(-torsoD * 0.5 - 2.8, 0, 0); torso.add(backpack);

  const thrusterMat = reg(mat(0xb9c4cf, { metal: 0.9, rough: 0.1 }));
  const fireMat = reg(mat(0xff4500, { emissive: 0xff4500, ei: 2.5 }));
  for (const sz of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 4, 8), thrusterMat);
    nozzle.position.set(-torsoD * 0.5 - 3.8, -torsoH * 0.2, sz * torsoW * 0.28);
    nozzle.rotation.z = Math.PI / 2 + 0.15; torso.add(nozzle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(1.2, 5, 8), fireMat);
    flame.position.set(-torsoD * 0.5 - 7.0, -torsoH * 0.32, sz * torsoW * 0.28);
    flame.rotation.z = Math.PI / 2 + 0.15; torso.add(flame);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(7.5 * bulk, 16, 12), defaultHeadMat);
  
  const eyeMat = reg(mat(0xffea00, { emissive: 0xffea00, ei: 2.5 }));
  face.eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 2.4), eyeMat); face.eyeL.position.set(frontX - 0.4, 1.2, -2.4 * bulk); face.eyeL.rotation.z = -0.22;
  face.eyeR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 2.4), eyeMat); face.eyeR.position.set(frontX - 0.4, 1.2, 2.4 * bulk); face.eyeR.rotation.z = -0.22;
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  const vfinL = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 7 * bulk), goldMat); vfinL.position.set(frontX * 0.68, 2 * bulk, -3 * bulk); vfinL.rotation.y = 0.22; vfinL.rotation.z = -0.42; faceGroup.add(vfinL);
  const vfinR = new THREE.Mesh(new THREE.BoxGeometry(1, 1.4, 7 * bulk), goldMat); vfinR.position.set(frontX * 0.68, 2 * bulk, 3 * bulk); vfinR.rotation.y = -0.22; vfinR.rotation.z = -0.42; faceGroup.add(vfinR);
  const gemMat = reg(mat(0xff0000, { metal: 0.4, emissive: 0xff0000, ei: 1.6 }));
  const gem = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.0, 1.8), gemMat); gem.position.set(frontX * 0.68 + 0.4, 0.4, 0); faceGroup.add(gem);

  const faceplate = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, 7 * bulk), reg(mat(shade(base, -0.2), { metal: 0.6 })));
  faceplate.position.set(frontX * 0.8, -1.8, 0); faceGroup.add(faceplate);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 2.4 * bulk), reg(mat(0xff0000, { emissive: 0xcc0000, ei: 0.3 })));
  chin.position.set(frontX * 0.86, -3.2, 0); faceGroup.add(chin);

  for (const sz of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(4.2 * bulk, 6.5 * bulk, 2.5 * bulk), reg(mat(shade(base, -0.1), { metal: 0.7 })));
    ear.position.set(-1.2, 0, sz * (frontX + 1.0)); ear.rotation.y = sz * -0.12; faceGroup.add(ear);
  }

  const crest = new THREE.Mesh(new THREE.BoxGeometry(2 * bulk, 7 * bulk, 16 * bulk), helmMat); crest.position.set(0, 7.5 * bulk, -2 * bulk); crest.rotation.x = -0.15; helmAddons.add(crest);
  const crestGlow = new THREE.Mesh(new THREE.BoxGeometry(0.6 * bulk, 8 * bulk, 12 * bulk), accentHelmMat); crestGlow.position.set(0, 7.6 * bulk, -2 * bulk); crestGlow.rotation.x = -0.15; helmAddons.add(crestGlow);

  const armL = mkLimb(0, -shoulderX, true, defaultArmMat, defaultBootMat, base);
  const armR = mkLimb(0, shoulderX, true, defaultArmMat, defaultBootMat, base);
  const legL = mkLimb(0, -hipX, false, defaultBodyMat, defaultBootMat, base);
  const legR = mkLimb(0, hipX, false, defaultBodyMat, defaultBootMat, base);

  const pSize = torsoW * 0.38;
  const pg = new THREE.BoxGeometry(pSize, pSize, pSize);
  for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(pg, reg(mat(shade(base, 0.15), { metal: 0.85, rough: 0.2 })));
    m.position.set(0, shoulderY + 1.5, sz * (torsoW * 0.5 + 3.2)); m.scale.y = 0.8; addAccent(m);
  }

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildWarriorWeapon;
