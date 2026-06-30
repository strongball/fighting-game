// @ts-nocheck
import * as THREE from 'three';
import { buildElementalistWeapon } from './weapon.ts';

export const modelConfig = { bulk: 1.92, weapon: 'elements', robe: true, skinKind: 'cloth', headgear: 'band' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH,
    shoulderX, hipX, frontX,
    defaultHeadMat, bodyTex,
    face, faceGroup, helmAddons, mkLimb, addAccent
  } = ctx;

  const ivoryMat = reg(mat(0xfff6df, { rough: 0.72, metal: 0.08, map: bodyTex }));
  const warmIvoryMat = reg(mat(0xf8edd0, { rough: 0.68, metal: 0.1, map: bodyTex }));
  const goldMat = reg(mat(0xf3c36a, { rough: 0.22, metal: 0.72, emissive: 0x6a360f, ei: 0.45 }));
  const flameMat = reg(mat(0xff8a24, { rough: 0.2, metal: 0.28, emissive: 0xff5a10, ei: 1.9, transparent: true, opacity: 0.95 }));
  const mintMat = reg(mat(0xdff7c8, { rough: 0.78, metal: 0.04, emissive: 0x86d5b2, ei: 0.25, transparent: true, opacity: 0.88 }));
  const veilMat = reg(mat(0xbfe9d6, { rough: 0.82, metal: 0.02, emissive: 0x80cbb6, ei: 0.55, transparent: true, opacity: 0.58 }));
  const hairMat = reg(mat(0xfff8ea, { rough: 0.82, metal: 0.03 }));
  const tealMat = reg(mat(0x7fe6d2, { rough: 0.24, metal: 0.2, emissive: 0x53c9bb, ei: 1.35 }));

  const torso = new THREE.Group();

  const upperRobe = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.31, torsoW * 0.36, torsoH * 0.44, 14), ivoryMat);
  upperRobe.position.y = torsoH * 0.19;
  upperRobe.scale.x = 0.88;
  upperRobe.castShadow = true;
  torso.add(upperRobe);

  const lowerRobe = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.28, torsoW * 0.66, torsoH * 0.42, 14), warmIvoryMat);
  lowerRobe.position.y = -torsoH * 0.22;
  lowerRobe.scale.x = 0.78;
  lowerRobe.castShadow = true;
  torso.add(lowerRobe);

  const breastplate = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.66), warmIvoryMat);
  breastplate.position.set(torsoD * 0.3, torsoH * 0.27, 0);
  breastplate.scale.set(0.62, 0.36, 0.78);
  breastplate.castShadow = true;
  torso.add(breastplate);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.3, 0.85, 6, 22, Math.PI * 1.18), goldMat);
  collar.position.set(torsoD * 0.26, torsoH * 0.48, 0);
  collar.rotation.y = Math.PI / 2;
  collar.rotation.z = -0.6;
  torso.add(collar);

  const shoulderWrap = new THREE.Mesh(new THREE.BoxGeometry(3.6, 4.2, torsoW * 1.18), ivoryMat);
  shoulderWrap.position.set(torsoD * 0.04, torsoH * 0.37, 0);
  shoulderWrap.rotation.x = 0.05;
  shoulderWrap.castShadow = true;
  torso.add(shoulderWrap);

  const waistBelt = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.34, 0.92, 7, 24), goldMat);
  waistBelt.position.set(torsoD * 0.05, -torsoH * 0.08, 0);
  waistBelt.rotation.x = Math.PI / 2;
  waistBelt.scale.x = 0.7;
  torso.add(waistBelt);

  const waistCore = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.18, torsoW * 0.2, torsoH * 0.22, 12), ivoryMat);
  waistCore.position.y = -torsoH * 0.1;
  waistCore.scale.x = 0.7;
  waistCore.castShadow = true;
  torso.add(waistCore);

  const waistGem = new THREE.Mesh(new THREE.OctahedronGeometry(2.45 * bulk, 0), tealMat);
  waistGem.position.set(torsoD * 0.4, -torsoH * 0.25, 0);
  torso.add(waistGem);

  const chestFlame = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.17, torsoH * 0.34, 5), flameMat);
  chestFlame.position.set(torsoD * 0.43, torsoH * 0.11, 0);
  chestFlame.rotation.z = Math.PI;
  chestFlame.scale.z = 0.3;
  torso.add(chestFlame);

  const frontFlame = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.18, torsoH * 0.56, 5), flameMat);
  frontFlame.position.set(torsoD * 0.45, -torsoH * 0.34, 0);
  frontFlame.rotation.z = Math.PI;
  frontFlame.scale.z = 0.28;
  torso.add(frontFlame);

  for (let i = 0; i < 5; i++) {
    const offset = i - 2;
    const panelMat = i === 2 ? ivoryMat : reg(mat(i % 2 ? 0xffefc3 : 0xf7efce, { rough: 0.7, metal: 0.06, transparent: true, opacity: 0.92 }));
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.14, torsoH * 0.52, 4), panelMat);
    skirt.position.set(torsoD * (0.18 - Math.abs(offset) * 0.02), -torsoH * 0.52, offset * torsoW * 0.16);
    skirt.rotation.set(0.08, offset * -0.1, Math.PI + offset * 0.08);
    skirt.scale.set(0.95, 1, 0.32);
    skirt.castShadow = true;
    torso.add(skirt);
  }

  const backDrape = new THREE.Mesh(new THREE.BoxGeometry(3.0, torsoH * 0.78, torsoW * 0.82), veilMat);
  backDrape.position.set(-torsoD * 0.46, -torsoH * 0.34, 0);
  backDrape.rotation.x = 0.05;
  backDrape.castShadow = true;
  torso.add(backDrape);

  for (const sz of [-1, 1]) {
    const sidePetal = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.14, torsoH * 0.58, 5), reg(mat(sz > 0 ? 0xffd889 : 0xffefb8, { rough: 0.64, metal: 0.08, transparent: true, opacity: 0.9 })));
    sidePetal.position.set(torsoD * 0.34, -torsoH * 0.28, sz * torsoW * 0.24);
    sidePetal.rotation.set(sz * 0.12, 0, Math.PI + sz * 0.24);
    sidePetal.scale.z = 0.28;
    sidePetal.castShadow = true;
    torso.add(sidePetal);

    const hipGuard = new THREE.Mesh(new THREE.BoxGeometry(3.0, torsoH * 0.42, torsoW * 0.22), mintMat);
    hipGuard.position.set(torsoD * 0.02, -torsoH * 0.34, sz * torsoW * 0.43);
    hipGuard.rotation.set(0.06, sz * 0.2, sz * 0.18);
    hipGuard.castShadow = true;
    torso.add(hipGuard);

    const sash = new THREE.Mesh(new THREE.BoxGeometry(2.8, 25, 8.5), mintMat);
    sash.position.set(-torsoD * 0.58, -torsoH * 0.58, sz * torsoW * 0.5);
    sash.rotation.set(0.18, sz * 0.32, sz * 0.16);
    addAccent(sash);

    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 20, 7), veilMat);
    tail.position.set(-torsoD * 0.78, -torsoH * 1.0, sz * torsoW * 0.68);
    tail.rotation.set(0.28, sz * 0.42, sz * 0.28);
    addAccent(tail);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(7.5 * bulk, 16, 12), defaultHeadMat);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(7.9 * bulk, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hairCap.position.set(-0.8 * bulk, 1.4 * bulk, 0);
  helmAddons.add(hairCap);

  const backHair = new THREE.Mesh(new THREE.ConeGeometry(5.2 * bulk, 29 * bulk, 12), hairMat);
  backHair.position.set(-5.2 * bulk, -8.2 * bulk, 0);
  backHair.rotation.z = Math.PI;
  backHair.scale.set(0.95, 1, 0.72);
  backHair.castShadow = true;
  helmAddons.add(backHair);

  for (let i = 0; i < 5; i++) {
    const offset = i - 2;
    const strand = new THREE.Mesh(new THREE.ConeGeometry((1.35 + Math.abs(offset) * 0.14) * bulk, (24 - Math.abs(offset) * 2.2) * bulk, 7), hairMat);
    strand.position.set((-4.2 - Math.abs(offset) * 0.45) * bulk, (-8.0 + Math.abs(offset) * 0.8) * bulk, offset * 2.1 * bulk);
    strand.rotation.z = Math.PI + offset * 0.035;
    strand.rotation.x = offset * 0.06;
    strand.castShadow = true;
    helmAddons.add(strand);
  }

  for (const sz of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.ConeGeometry(1.9 * bulk, 16 * bulk, 8), hairMat);
    lock.position.set(2.4 * bulk, -3.6 * bulk, sz * 4.4 * bulk);
    lock.rotation.z = Math.PI;
    lock.rotation.x = sz * 0.18;
    helmAddons.add(lock);

    const longSideLock = new THREE.Mesh(new THREE.ConeGeometry(1.45 * bulk, 22 * bulk, 8), hairMat);
    longSideLock.position.set(0.9 * bulk, -7.0 * bulk, sz * 6.0 * bulk);
    longSideLock.rotation.z = Math.PI + sz * 0.08;
    longSideLock.rotation.x = sz * 0.22;
    longSideLock.castShadow = true;
    helmAddons.add(longSideLock);
  }

  const crownBand = new THREE.Mesh(new THREE.TorusGeometry(8.8 * bulk, 0.55 * bulk, 8, 28), goldMat);
  crownBand.position.set(0, 5.8 * bulk, 0);
  crownBand.rotation.x = Math.PI / 2;
  helmAddons.add(crownBand);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(11.5 * bulk, 0.75 * bulk, 8, 32), goldMat);
  halo.position.set(-3.8 * bulk, 10.6 * bulk, 0);
  halo.rotation.y = Math.PI / 2;
  helmAddons.add(halo);

  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * Math.PI;
    const ray = new THREE.Mesh(new THREE.ConeGeometry(0.7 * bulk, 6.4 * bulk, 6), goldMat);
    ray.position.set(-4.0 * bulk, 10.6 * bulk + Math.sin(a) * 12.0 * bulk, Math.cos(a) * 12.0 * bulk);
    ray.rotation.z = Math.PI / 2 - a;
    helmAddons.add(ray);
  }

  for (const sz of [-1, 1]) {
    const earring = new THREE.Mesh(new THREE.TorusGeometry(2.1 * bulk, 0.25 * bulk, 6, 14), goldMat);
    earring.position.set(1.8 * bulk, -1.2 * bulk, sz * 6.7 * bulk);
    earring.rotation.x = Math.PI / 2;
    helmAddons.add(earring);
  }

  const eyeMat = reg(mat(0x72e8d7, { emissive: 0x72e8d7, ei: 1.8 }));
  face.eyeL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 2.2), eyeMat); face.eyeL.position.set(frontX - 0.4, 1.2, -2.2 * bulk);
  face.eyeR = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 2.2), eyeMat); face.eyeR.position.set(frontX - 0.4, 1.2, 2.2 * bulk);
  faceGroup.add(face.eyeL); faceGroup.add(face.eyeR);

  const armL = mkLimb(0, -shoulderX, true, ivoryMat, goldMat, base, 3.9 * bulk, 15.5);
  const armR = mkLimb(0, shoulderX, true, ivoryMat, goldMat, base, 3.9 * bulk, 15.5);
  const legL = mkLimb(0, -hipX, false, warmIvoryMat, goldMat, shade(base, 0.12), 4.7 * bulk, 16.5);
  const legR = mkLimb(0, hipX, false, warmIvoryMat, goldMat, shade(base, 0.12), 4.7 * bulk, 16.5);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildElementalistWeapon;
