// @ts-nocheck
import * as THREE from 'three';

export const modelConfig = { bulk: 6.8, weapon: 'none', scale: 3.2, head: 'square', emissiveCore: '#ffb347' };

export function buildModel(ctx) {
  const { bulk, reg, mat, shade, torsoW, torsoH, shoulderX, hipX, frontX, face, faceGroup, mkLimb } = ctx;
  const OBSIDIAN = '#17151c', GOLD = '#8f6a38', MOLTEN = '#ffb347', HOT = '#fff2c2', COOL = '#69e8ff';
  const obsidian = reg(mat(OBSIDIAN, { rough: 0.35, metal: 0.82 }));
  const dark = reg(mat(shade(OBSIDIAN, -0.28), { rough: 0.5, metal: 0.75 }));
  const gold = reg(mat(GOLD, { rough: 0.28, metal: 0.92 }));
  const molten = reg(mat(MOLTEN, { emissive: new THREE.Color('#9a531d'), ei: 1.45, rough: 0.32, metal: 0.62 }));
  const hot = reg(mat('#e7b979', { emissive: new THREE.Color('#9e6d30'), ei: 1.7, rough: 0.25, metal: 0.35 }));
  const cool = reg(mat('#58bdcc', { emissive: new THREE.Color('#286b78'), ei: 1.45, rough: 0.3, metal: 0.5, transparent: true, opacity: 0.82 }));

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(torsoW * 0.48, torsoW * 0.6, torsoH * 1.35, 10), obsidian);
  torso.castShadow = true;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(2.2, torsoH, 2.2), molten);
    seam.position.set(Math.cos(a) * torsoW * 0.48, 0, Math.sin(a) * torsoW * 0.48);
    torso.add(seam);
  }
  const furnace = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.24, 18, 12), hot);
  furnace.position.set(torsoW * 0.5, torsoH * 0.08, 0); torso.add(furnace);
  const furnaceRing = new THREE.Mesh(new THREE.TorusGeometry(torsoW * 0.31, 4, 8, 30), gold);
  furnaceRing.position.copy(furnace.position); furnaceRing.rotation.y = Math.PI / 2; torso.add(furnaceRing);
  for (let i = 0; i < 3; i++) {
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(torsoW * (0.48 + i * 0.1), 2.4, 7, 36), i % 2 ? cool : molten);
    orbit.position.set(-torsoW * 0.1, torsoH * 0.15, 0);
    orbit.rotation.set(Math.PI / 2 + i * 0.35, i * 0.5, 0.25 * i);
    torso.add(orbit);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(12 * bulk, 11 * bulk, 12 * bulk), obsidian);
  head.castShadow = true;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(4.5 * bulk, 6.8 * bulk, 5 * bulk, 6), gold);
  crown.position.y = 7 * bulk; head.add(crown);
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(2.2 * bulk, 11 * bulk, 6), molten);
    horn.position.set(-2 * bulk, 7 * bulk, side * 5.4 * bulk); horn.rotation.x = side * 0.5; horn.rotation.z = 0.35; head.add(horn);
  }
  const eyeGeo = new THREE.BoxGeometry(2.2, 3.1 * bulk, 3.6 * bulk);
  face.eyeL = new THREE.Mesh(eyeGeo, molten); face.eyeL.position.set(frontX * 0.88, 0, -3.2 * bulk);
  face.eyeR = new THREE.Mesh(eyeGeo, cool); face.eyeR.position.set(frontX * 0.88, 0, 3.2 * bulk);
  faceGroup.add(face.eyeL, face.eyeR);
  const mask = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5 * bulk, 10 * bulk), dark);
  mask.position.set(frontX * 0.7, -2 * bulk, 0); faceGroup.add(mask);

  const armL = mkLimb(0, -shoulderX, true, obsidian, gold, COOL, 8.5 * bulk, 22);
  const armR = mkLimb(0, shoulderX, true, obsidian, gold, MOLTEN, 9 * bulk, 22);
  const legL = mkLimb(0, -hipX, false, obsidian, dark, MOLTEN, 10 * bulk, 18);
  const legR = mkLimb(0, hipX, false, obsidian, dark, MOLTEN, 10 * bulk, 18);

  const claw = new THREE.Group(); claw.position.y = -26; armL.add(claw);
  const palm = new THREE.Mesh(new THREE.SphereGeometry(15, 10, 8), cool); palm.scale.set(0.7, 1, 1); claw.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Mesh(new THREE.ConeGeometry(3.5, 24, 6), cool);
    finger.position.set(3, -7 + i * 4, (i - 1.5) * 8); finger.rotation.z = -Math.PI / 2; claw.add(finger);
  }

  const hammer = new THREE.Group(); hammer.position.y = -31; armR.add(hammer);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 54, 8), gold); shaft.position.y = -12; hammer.add(shaft);
  const headBlock = new THREE.Mesh(new THREE.BoxGeometry(30, 28, 54), obsidian); headBlock.position.y = -38; headBlock.castShadow = true; hammer.add(headBlock);
  const hotFace = new THREE.Mesh(new THREE.BoxGeometry(31, 21, 40), molten); hotFace.position.set(0, -38, 27); hammer.add(hotFace);
  const core = new THREE.Mesh(new THREE.SphereGeometry(9, 12, 8), hot); core.position.set(0, -38, 0); hammer.add(core);

  return { torso, head, armL, armR, legL, legR };
}

export function buildWeapon() {}
