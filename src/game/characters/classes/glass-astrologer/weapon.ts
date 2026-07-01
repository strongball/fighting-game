// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildGlassAstrologerWeapon(hand, ctx) {
  const { THREE, reg, mat, gold, accent, dark, add } = createWeaponKit(hand, ctx);
  const glass = reg(mat(0xbff5ff, { emissive: 0x7ddcff, ei: 2.2, rough: 0.18, metal: 0.15 }));
  const white = reg(mat(0xffffff, { emissive: 0x9ee8ff, ei: 1.7, rough: 0.16 }));

  add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 42, 8), dark), 2, -3, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.8, 8, 32), gold), 2, 21, 0, Math.PI / 2, 0, 0);
  add(new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.55, 8, 32), glass), 2, 21, 0, Math.PI / 2, Math.PI / 4, 0);
  const prism = add(new THREE.Mesh(new THREE.OctahedronGeometry(3.0, 0), white), 2, 21, 0);
  prism.userData = { glow: true };

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(new THREE.Mesh(new THREE.TetrahedronGeometry(1.35, 0), glass), 2, 21 + Math.cos(a) * 6, Math.sin(a) * 6, a, a * 0.4, 0);
  }

  add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 7.0, 0.35), accent), 2.7, 21, 0, 0, 0, Math.PI / 5);
}
