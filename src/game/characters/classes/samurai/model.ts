// @ts-nocheck
import * as THREE from 'three';
import { buildSamuraiWeapon } from './weapon.ts';

export const modelConfig = { bulk: 2.04, weapon: 'katana', skinKind: 'metal', headgear: 'none', pauldron: false, swingStyle: 'horizontal', stretchBlade: true };

// 武士：可玩版無明劍聖，複製自斬業 Boss 的黑袍、蒙眼、白髮與斷裂劍輪語彙。
export function buildModel(ctx) {
  const {
    bulk, reg, mat, shade,
    torsoW, torsoD, torsoH, shoulderY, frontX,
    faceGroup, mkLimb, addAccent,
  } = ctx;

  const BLACK = '#151515', CLOTH = '#262020', WHITE = '#f2f0dc', RED = '#d94343';
  const black = reg(mat(BLACK, { rough: 0.82, metal: 0.15 }));
  const cloth = reg(mat(CLOTH, { rough: 0.9, metal: 0.08 }));
  const white = reg(mat(WHITE, { emissive: new THREE.Color('#8f886f'), ei: 0.75, rough: 0.45, metal: 0.2 }));
  const red = reg(mat(RED, { emissive: new THREE.Color(RED), ei: 1.25, rough: 0.35, metal: 0.3 }));
  const dark = reg(mat(shade(BLACK, -0.28), { rough: 0.75, metal: 0.18 }));

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.42, torsoW * 0.58, torsoH * 1.18, 8), cloth);
  torso.castShadow = true;
  const lapelL = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 0.28, torsoH * 1.0, 1.8), black);
  lapelL.position.set(frontX * 0.36, 2, -torsoW * 0.16); lapelL.rotation.x = 0.35; torso.add(lapelL);
  const lapelR = lapelL.clone(); lapelR.position.z = torsoW * 0.16; lapelR.rotation.x = -0.35; torso.add(lapelR);
  const sash = new THREE.Mesh(new THREE.BoxGeometry(torsoD * 1.05, 4.2, torsoW * 0.78), red);
  sash.position.y = -torsoH * 0.42; torso.add(sash);
  for (let i = 0; i < 4; i++) {
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(1.1, torsoH * 0.75, 1.1), red);
    stitch.position.set(frontX * 0.42, -2, (i - 1.5) * torsoW * 0.15);
    stitch.rotation.x = i % 2 ? 0.18 : -0.18;
    torso.add(stitch);
  }

  const head = new THREE.Mesh(new THREE.SphereGeometry(6.2 * bulk, 14, 10), dark);
  head.scale.set(0.9, 1.05, 0.9); head.castShadow = true;
  const band = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.0 * bulk, 12 * bulk), white);
  band.position.set(frontX * 0.86, 0.5, 0); faceGroup.add(band);
  for (let i = 0; i < 7; i++) {
    const hair = new THREE.Mesh(new THREE.ConeGeometry(1.15 * bulk, 9.5 * bulk, 5), white);
    hair.position.set(-1.7 * bulk, 1.8 * bulk - i * 0.45, (i - 3) * 1.9 * bulk);
    hair.rotation.z = 0.62 + i * 0.025;
    head.add(hair);
  }

  const armL = mkLimb(0, -ctx.shoulderX, true, cloth, black, RED, 5.2 * bulk, 14);
  const armR = mkLimb(0, ctx.shoulderX, true, cloth, black, RED, 5.4 * bulk, 14);
  const legL = mkLimb(0, -ctx.hipX, false, black, dark, WHITE, 5.8 * bulk, 14);
  const legR = mkLimb(0, ctx.hipX, false, black, dark, WHITE, 5.8 * bulk, 14);

  const wheel = new THREE.Group();
  wheel.position.set(-13, shoulderY + 6, 0);
  for (let i = 0; i < 9; i++) {
    if (i === 2 || i === 6) continue;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.5, 22, 2.8), i % 3 === 0 ? red : white);
    const a = (i / 9) * Math.PI * 2;
    blade.position.set(0, Math.sin(a) * 18, Math.cos(a) * 18);
    blade.rotation.x = a;
    wheel.add(blade);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 1.0, 6, 36), white);
  ring.rotation.y = Math.PI / 2; wheel.add(ring);
  addAccent(wheel);

  return { torso, head, armL, armR, legL, legR };
}

export const buildWeapon = buildSamuraiWeapon;
