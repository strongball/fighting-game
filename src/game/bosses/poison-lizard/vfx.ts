// @ts-nocheck
// R2 地面毒沼：刻意做成「濃濁、把地面染暗的毒液」而非發亮霓虹。
// 讀作「危險、別踩」，而不是「漂亮的光圈」。配上 hud.js 站入時的全螢幕警示。
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';

export function loadVfx() {
  registerVfx('boss_lizard_pool', {
    zone(ctx: any, z: any) {
      const { particles } = ctx;
      const g = new THREE.Group();

      const base = new THREE.Mesh(
        new THREE.CircleGeometry(1, 40),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#20300e'), transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })
      );
      base.rotation.x = -Math.PI / 2; base.position.y = 0.5; g.add(base);

      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#3a5a18'), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
      );
      inner.rotation.x = -Math.PI / 2; inner.position.y = 0.7; g.add(inner);

      const rim = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color('#82ad2c'), transparent: true, opacity: 0.68, side: THREE.DoubleSide, depthWrite: false })
      );
      rim.rotation.x = -Math.PI / 2; rim.position.y = 0.85; g.add(rim);

      let t = 0, bub = 0;
      return {
        object3D: g,
        update(dt: number, zz: any) {
          t += dt;
          const r = zz.radius;
          base.scale.setScalar(r); inner.scale.setScalar(r); rim.scale.setScalar(r);
          inner.rotation.z += dt * 0.25;
          rim.material.opacity = 0.52 + 0.18 * Math.sin(t * 3);
          inner.material.opacity = 0.48 + 0.12 * Math.sin(t * 1.8 + 1);
          bub -= dt;
          if (bub <= 0) {
            bub = 0.12;
            const a = Math.random() * Math.PI * 2, rr = Math.random() * r * 0.8;
            particles.spawn({
              x: g.position.x + Math.cos(a) * rr, y: 1.5, z: g.position.z + Math.sin(a) * rr,
              vx: (Math.random() - 0.5) * 6, vy: 14 + Math.random() * 22, vz: (Math.random() - 0.5) * 6,
              gravity: -8, drag: 1.8, life: 0.6 + Math.random() * 0.6,
              size: 4 + Math.random() * 4, color: Math.random() < 0.8 ? '#7fbf3f' : '#9b6bff', fade: true,
            });
          }
        },
      };
    },
  });
}
