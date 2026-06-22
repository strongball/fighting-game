// @ts-nocheck
import * as THREE from 'three';

export const modelConfig = { bulk: 6.2, weapon: 'none', scale: 2.8, head: 'dragon', emissiveCore: '#d6b45f' };

export function buildModel(ctx) {
  const { bulk, reg, mat, torsoW, torsoH, shoulderX, hipX, frontX, face, faceGroup, mkLimb } = ctx;
  const obsidian = reg(mat('#15131d', { rough: 0.42, metal: 0.72 }));
  const dark = reg(mat('#292238', { rough: 0.55, metal: 0.58 }));
  const gold = reg(mat('#d6b45f', { emissive: new THREE.Color('#806222'), ei: 0.9, rough: 0.3, metal: 0.9 }));
  const past = reg(mat('#70e6ff', { emissive: new THREE.Color('#70e6ff'), ei: 2.4, transparent: true, opacity: 0.82 }));
  const future = reg(mat('#d06cff', { emissive: new THREE.Color('#d06cff'), ei: 2.4, transparent: true, opacity: 0.82 }));

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(torsoW * 0.42, torsoH * 1.25, 8, 14), obsidian);
  torso.rotation.z = Math.PI / 2; torso.castShadow = true;
  const clock = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.3, 3.2, 10, 36), gold);
  clock.position.set(torsoW * 0.44, 0, 0); clock.rotation.y = Math.PI / 2; torso.add(clock);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 1.8), gold);
    tick.position.set(torsoW * 0.47, Math.cos(a) * torsoW * 0.27, Math.sin(a) * torsoW * 0.27);
    tick.rotation.x = a; torso.add(tick);
  }
  const hand = new THREE.Mesh(new THREE.BoxGeometry(3, torsoW * 0.25, 2), past);
  hand.position.set(torsoW * 0.49, torsoW * 0.1, 0); hand.rotation.x = 0.7; torso.add(hand);

  const head = new THREE.Mesh(new THREE.ConeGeometry(8 * bulk, 17 * bulk, 6), dark);
  head.rotation.z = -Math.PI / 2; head.castShadow = true;
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(2.2 * bulk, 12 * bulk, 7), gold);
    horn.position.set(-3 * bulk, 7 * bulk, s * 5 * bulk); horn.rotation.z = 0.5; head.add(horn);
  }
  const eyeGeo = new THREE.SphereGeometry(2.2 * bulk, 10, 8);
  face.eyeL = new THREE.Mesh(eyeGeo, past); face.eyeL.position.set(frontX * 0.9, 1, -3.8 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, future); face.eyeR.position.set(frontX * 0.9, 1, 3.8 * bulk);
  faceGroup.add(face.eyeL, face.eyeR);

  const armL = mkLimb(0, -shoulderX, true, obsidian, dark, '#70e6ff', 8 * bulk, 22);
  const armR = mkLimb(0, shoulderX, true, obsidian, dark, '#d06cff', 8 * bulk, 22);
  const legL = mkLimb(0, -hipX, false, obsidian, dark, '#d6b45f', 9 * bulk, 18);
  const legR = mkLimb(0, hipX, false, obsidian, dark, '#d6b45f', 9 * bulk, 18);

  for (const [side, wingMat] of [[-1, past], [1, future]]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(torsoW * 0.55, torsoW * 1.55, 3), wingMat);
    wing.position.set(-torsoW * 0.2, torsoH * 0.15, side * torsoW * 0.7);
    wing.rotation.x = side * 0.95; wing.rotation.z = 0.25; torso.add(wing);
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(5, torsoW * 1.8, 8), gold);
  tail.position.set(-torsoW * 0.85, -torsoH * 0.05, 0); tail.rotation.z = Math.PI / 2; torso.add(tail);
  return { torso, head, armL, armR, legL, legR };
}

export function buildWeapon() {}
