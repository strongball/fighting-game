// @ts-nocheck
import * as THREE from 'three';
import { buildGlassAstrologerWeapon } from './weapon.ts';

export const modelConfig = { bulk: 1.72, weapon: 'astrolabe', robe: true, skinKind: 'cloth', headgear: 'circlet' };

export function buildModel(ctx) {
  const {
    base, bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, shoulderY, frontX, bodyTex,
    defaultBodyMat, defaultHeadMat, goldMat,
    mkLimb, addAccent, faceGroup,
  } = ctx;

  const glassMat = reg(mat(0xbff5ff, { emissive: 0x7ddcff, ei: 2.3, rough: 0.18, metal: 0.15 }));
  const prismMat = reg(mat(0xf8fbff, { emissive: 0x9ee8ff, ei: 1.8, rough: 0.12, metal: 0.2 }));
  const robeMat = reg(mat(shade(base, -0.05), { rough: 0.72, metal: 0.08, map: bodyTex }));
  const darkGlassMat = reg(mat(0x24364a, { emissive: 0x1b5b75, ei: 0.55, rough: 0.5, metal: 0.25 }));

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.42, torsoW * 0.62, torsoH + 3, 12), defaultBodyMat);

  const chest = new THREE.Mesh(new THREE.OctahedronGeometry(torsoW * 0.18, 0), prismMat);
  chest.position.set(0, torsoH * 0.12, torsoD * 0.5 + 1.1);
  chest.rotation.z = Math.PI / 4;
  torso.add(chest);

  const orbit = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.52, 0.8, 8, 32), glassMat);
  orbit.position.set(0, torsoH * 0.02, 0);
  orbit.rotation.x = Math.PI / 2;
  torso.add(orbit);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(1.8, 0), i % 2 ? prismMat : glassMat);
    shard.position.set(Math.cos(a) * torsoW * 0.72, torsoH * 0.08 + Math.sin(i) * 3, Math.sin(a) * torsoW * 0.72);
    shard.rotation.set(a, a * 0.5, Math.PI / 4);
    addAccent(shard);
  }

  for (const sz of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.OctahedronGeometry(3.0, 0), glassMat);
    shoulder.position.set(0, shoulderY + 1.4, sz * (torsoW * 0.5 + 2.2));
    shoulder.scale.set(0.8, 1.3, 0.8);
    addAccent(shoulder);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(7.1 * bulk, 16, 12), defaultHeadMat);
  const eyeMat = reg(mat(0xffffff, { emissive: 0x9ee8ff, ei: 2.8 }));
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.4, 2.2), eyeMat);
    eye.position.set(frontX - 0.2, 0.8, sz * 2.1 * bulk);
    faceGroup.add(eye);
  }

  const circlet = new THREE.Mesh(new THREE.TorusGeometry(5.5 * bulk, 0.45, 6, 28), goldMat);
  circlet.rotation.y = Math.PI / 2;
  circlet.position.set(frontX * 0.15, 2.8 * bulk, 0);
  faceGroup.add(circlet);
  const crownShard = new THREE.Mesh(new THREE.OctahedronGeometry(1.6 * bulk, 0), glassMat);
  crownShard.position.set(frontX * 0.7, 4.2 * bulk, 0);
  faceGroup.add(crownShard);

  const armL = mkLimb(0, -ctx.shoulderX, true, robeMat, darkGlassMat, base);
  const armR = mkLimb(0, ctx.shoulderX, true, robeMat, darkGlassMat, base);
  const legL = mkLimb(0, -ctx.hipX, false, robeMat, darkGlassMat, base);
  const legR = mkLimb(0, ctx.hipX, false, robeMat, darkGlassMat, base);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildGlassAstrologerWeapon;
