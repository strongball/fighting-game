// @ts-nocheck
import { createWeaponKit } from '../../../render3d/weaponKit.js';

export function buildElementalistWeapon(hand, ctx) {
  const { THREE, base, reg, mat, shade, gold, add } = createWeaponKit(hand, ctx);
  const flameMat = reg(mat(0xff8b2a, { rough: 0.18, metal: 0.18, emissive: 0xff5c12, ei: 2.7, transparent: true, opacity: 0.92 }));
  const paleFlameMat = reg(mat(0xfff0b8, { rough: 0.25, metal: 0.08, emissive: 0xffc36a, ei: 2.2, transparent: true, opacity: 0.86 }));
  const runeMat = reg(mat(shade(base, 0.08), { rough: 0.2, metal: 0.68, emissive: 0xb85a15, ei: 0.9, transparent: true, opacity: 0.9 }));
  const orbMats = [
    reg(mat(0xffb34c, { rough: 0.2, metal: 0.15, emissive: 0xff6a1a, ei: 1.8 })),
    reg(mat(0x7fe6d2, { rough: 0.22, metal: 0.12, emissive: 0x4fc7bb, ei: 1.4 })),
    reg(mat(0xffe38a, { rough: 0.2, metal: 0.18, emissive: 0xffc652, ei: 1.5 })),
  ];

  for (let i = 0; i < 3; i++) {
    const sigil = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(13.0, 0.72, 6, 40, Math.PI * 1.35), runeMat);
    ring.rotation.y = Math.PI / 2;
    ring.rotation.z = i * 0.55;
    sigil.add(ring);

    const inner = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.46, 6, 26, Math.PI * 1.15), gold);
    inner.rotation.y = Math.PI / 2;
    inner.rotation.z = -0.8;
    sigil.add(inner);

    const orb = new THREE.Mesh(new THREE.SphereGeometry(3.65, 18, 14), orbMats[i]);
    orb.position.set(0, -0.75, 0);
    sigil.add(orb);

    for (let j = 0; j < 3; j++) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(2.45 + j * 0.22, 9.6 - j * 0.7, 7), j === 1 ? paleFlameMat : flameMat);
      const a = j * (Math.PI * 2 / 3) + i * 0.4;
      flame.position.set(0, Math.sin(a) * 12.6, Math.cos(a) * 12.6);
      flame.rotation.z = Math.PI;
      flame.rotation.x = a;
      sigil.add(flame);
    }

    const spark = new THREE.Mesh(new THREE.OctahedronGeometry(2.55, 0), paleFlameMat);
    spark.position.set(0, 14.8, 0);
    sigil.add(spark);

    const o = add(sigil, 8.5, 0, 0);
    o.userData.orbit = i;
  }
}
