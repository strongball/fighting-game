// @ts-nocheck
import * as THREE from 'three';

export const modelConfig = {
  bulk: 3.5,
  weapon: 'none',
  scale: 2.35,
  head: 'none',
  emissiveCore: '#58d7ff',
};

export function buildModel(ctx) {
  const { bulk, reg, mat, shade, torsoW, torsoH, shoulderX, hipX, frontX, face, faceGroup, mkLimb } = ctx;
  const STEEL = '#3a434c';
  const DARK = '#151a20';
  const BLUE = '#58d7ff';
  const RED = '#ff5d6c';
  const VIOLET = '#a855ff';
  const steel = reg(mat(STEEL, { rough: 0.34, metal: 0.88 }));
  const dark = reg(mat(DARK, { rough: 0.48, metal: 0.75 }));
  const blue = reg(mat(BLUE, { emissive: new THREE.Color(BLUE), ei: 2.3, rough: 0.22, metal: 0.55 }));
  const red = reg(mat(RED, { emissive: new THREE.Color(RED), ei: 2.3, rough: 0.22, metal: 0.55 }));
  const violet = reg(mat(VIOLET, { emissive: new THREE.Color(VIOLET), ei: 1.6, rough: 0.25, metal: 0.45, transparent: true, opacity: 0.86 }));

  const torso = new THREE.Group();
  torso.name = 'magnet-artificer-core';

  const coreShell = new THREE.Mesh(new THREE.IcosahedronGeometry(torsoW * 0.32, 2), dark);
  coreShell.castShadow = true;
  torso.add(coreShell);
  const coreBlue = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.17, 16, 10), blue);
  coreBlue.position.set(torsoW * 0.18, torsoH * 0.08, -torsoW * 0.18);
  torso.add(coreBlue);
  const coreRed = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.17, 16, 10), red);
  coreRed.position.set(torsoW * 0.18, torsoH * 0.08, torsoW * 0.18);
  torso.add(coreRed);

  const rails = [];
  for (let i = 0; i < 3; i++) {
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(torsoW * (0.52 + i * 0.15), 2.2 + i * 0.35, 8, 54, Math.PI * 1.45),
      i === 0 ? blue : i === 1 ? red : violet
    );
    rail.rotation.set(Math.PI / 2 + i * 0.45, i * 0.72, i * 0.33);
    rail.position.set(-torsoW * 0.02, torsoH * 0.05, 0);
    rail.userData.spin = (i % 2 ? -1 : 1) * (0.75 + i * 0.22);
    torso.add(rail);
    rails.push(rail);
  }

  const shoulderBridge = new THREE.Mesh(new THREE.BoxGeometry(torsoW * 0.75, torsoH * 0.16, torsoW * 1.15), steel);
  shoulderBridge.position.set(-torsoW * 0.05, torsoH * 0.22, 0);
  shoulderBridge.castShadow = true;
  torso.add(shoulderBridge);

  const head = new THREE.Group();
  const visorFrame = new THREE.Mesh(new THREE.BoxGeometry(8 * bulk, 7 * bulk, 10 * bulk), dark);
  visorFrame.castShadow = true;
  head.add(visorFrame);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4 * bulk, 8.2 * bulk), violet);
  visor.position.set(frontX * 0.86, 0.2 * bulk, 0);
  head.add(visor);
  face.eyeL = new THREE.Mesh(new THREE.SphereGeometry(1.5 * bulk, 8, 6), blue);
  face.eyeR = new THREE.Mesh(new THREE.SphereGeometry(1.5 * bulk, 8, 6), red);
  face.eyeL.position.set(frontX * 0.98, 0.5 * bulk, -2.7 * bulk);
  face.eyeR.position.set(frontX * 0.98, 0.5 * bulk, 2.7 * bulk);
  faceGroup.add(face.eyeL, face.eyeR);
  for (const side of [-1, 1]) {
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * bulk, 0.45 * bulk, 8 * bulk, 6), side < 0 ? blue : red);
    antenna.position.set(-1.5 * bulk, 5.4 * bulk, side * 4.2 * bulk);
    antenna.rotation.z = side * 0.35;
    head.add(antenna);
  }

  const armL = mkLimb(0, -shoulderX, true, steel, dark, BLUE, 7.2 * bulk, 21);
  const armR = mkLimb(0, shoulderX, true, steel, dark, RED, 7.2 * bulk, 21);
  const legL = mkLimb(0, -hipX, false, dark, steel, BLUE, 6.6 * bulk, 15);
  const legR = mkLimb(0, hipX, false, dark, steel, RED, 6.6 * bulk, 15);

  const fragments = [];
  function addFragmentArm(arm, side, poleMat) {
    const hand = new THREE.Group();
    hand.position.y = -24;
    arm.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(5.5 * bulk, 10, 8), poleMat);
    hand.add(palm);
    for (let i = 0; i < 8; i++) {
      const shard = new THREE.Mesh(new THREE.BoxGeometry(2.1 * bulk, 4.5 * bulk, 1.4 * bulk), i % 2 ? steel : poleMat);
      shard.position.set(4 + i * 0.7, -8 - (i % 3) * 3, side * ((i - 3.5) * 3.2));
      shard.rotation.set(i * 0.35, side * 0.4, i * 0.21);
      hand.add(shard);
      fragments.push({ shard, side, phase: i * 0.7 });
    }
  }
  addFragmentArm(armL, -1, blue);
  addFragmentArm(armR, 1, red);

  const parts = { torso, head, armL, armR, legL, legR };
  let t = 0;
  parts.customUpdate = (dt, group, ud, info) => {
    t += dt;
    const overload = !!info?.p?.magnetOverload;
    const rate = overload ? 1.75 : 1.0;
    coreShell.rotation.x += dt * 0.55 * rate;
    coreShell.rotation.y += dt * 0.85 * rate;
    coreBlue.scale.setScalar(1 + Math.sin(t * 4.4) * (overload ? 0.2 : 0.12));
    coreRed.scale.setScalar(1 + Math.sin(t * 4.4 + Math.PI) * (overload ? 0.2 : 0.12));
    for (const rail of rails) {
      rail.rotation.z += dt * rail.userData.spin * rate;
      rail.material.emissiveIntensity = (overload ? 2.2 : 1.35) + Math.sin(t * 3 + rail.userData.spin) * 0.25;
    }
    armL.position.y = Math.sin(t * 2.1) * 3;
    armR.position.y = Math.sin(t * 2.1 + Math.PI) * 3;
    for (const f of fragments) {
      const pulse = Math.sin(t * (overload ? 5.5 : 3.8) + f.phase);
      f.shard.position.x = 5 + pulse * 3.5;
      f.shard.rotation.y += dt * f.side * (overload ? 2.4 : 1.5);
      f.shard.rotation.z += dt * (overload ? 1.7 : 1.0);
    }
  };

  return parts;
}

export function buildWeapon() {}
