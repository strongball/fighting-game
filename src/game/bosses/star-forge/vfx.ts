// @ts-nocheck
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { slashBlade, cone, burst, ring, column, sphereFlash, pillar } from '../../render3d/vfx/lib.js';

const MOLTEN = '#ffb347', HOT = '#fff2c2', EMBER = '#ff6838', COOL = '#69e8ff', DARK = '#17151c';
const glowMat = (color, opacity = 0.75) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });

export function loadVfx() {
  registerVfx('boss_star_hammer', {
    onCast(ctx, f, c) {
      slashBlade(ctx, c, f.facing, { color: [HOT, MOLTEN], len: f.range || 220, swing: 1.6, life: 0.4, y: 20, sparkCount: 22 });
      cone(ctx, c, f.facing, { color: [HOT, MOLTEN, EMBER], count: 24, speed: 320, spread: 0.7, up: 55, life: 0.65, size: 5 });
      ring(ctx, c, { color: MOLTEN, from: 18, to: 150, life: 0.48, y: 3, alpha: 0.9 });
      ctx.sceneMgr.addShake(15); ctx.sceneMgr.addFlash(0.16, HOT);
    },
  });

  registerVfx('boss_star_gravity', {
    zone(ctx, z) {
      const r = z.radius || 200;
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 40), glowMat(DARK, 0.58)); disc.rotation.x = -Math.PI / 2; disc.position.y = 1; g.add(disc);
      const rings = [];
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(new THREE.RingGeometry(r * (0.25 + i * 0.22), r * (0.29 + i * 0.22), 40), glowMat(i === 1 ? MOLTEN : COOL, 0.62));
        m.rotation.x = -Math.PI / 2; m.position.y = 2 + i; g.add(m); rings.push(m);
      }
      let t = 0, emit = 0;
      return { object3D: g, update(dt) {
        t += dt; rings.forEach((m, i) => { m.rotation.z += dt * (i % 2 ? -1.8 : 1.5); m.scale.setScalar(1 - 0.08 * Math.sin(t * 5 + i)); });
        emit -= dt; if (emit <= 0) { emit = 0.05; const a = Math.random() * 6.283, rr = r * (0.5 + Math.random() * 0.5); ctx.particles.spawn({ x: g.position.x + Math.cos(a) * rr, y: 8 + Math.random() * 30, z: g.position.z + Math.sin(a) * rr, vx: -Math.cos(a) * 150, vy: 5, vz: -Math.sin(a) * 150, gravity: 0, drag: 1.4, life: 0.65, size: 4, color: Math.random() < 0.5 ? COOL : MOLTEN, fade: true }); }
      } };
    },
  });

  registerVfx('boss_star_rain', {
    zone(ctx, z) {
      const r = z.radius || 95;
      const g = new THREE.Group();
      const meteor = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.34, 1), new THREE.MeshStandardMaterial({ color: 0x33252a, emissive: new THREE.Color(MOLTEN), emissiveIntensity: 1.8, roughness: 0.6, metalness: 0.45 }));
      meteor.position.y = 240; g.add(meteor);
      const target = new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 36), glowMat(MOLTEN, 0.8)); target.rotation.x = -Math.PI / 2; target.position.y = 1.5; g.add(target);
      let t = 0, hit = false;
      return { object3D: g, update(dt) {
        t += dt; meteor.rotation.x += dt * 7; meteor.rotation.y += dt * 5; meteor.position.y = Math.max(r * 0.28, 240 * (1 - Math.min(1, t / 0.2)));
        if (!hit && meteor.position.y <= r * 0.3) { hit = true; burst(ctx, { x: g.position.x, y: 4, z: g.position.z }, { color: [HOT, MOLTEN, EMBER], count: 28, speed: 300, up: 90, life: 0.75, size: 5.5 }); column(ctx, { x: g.position.x, y: 0, z: g.position.z }, { color: [MOLTEN, HOT], count: 18, radius: r * 0.5, speed: 230, life: 0.65, size: 5 }); ctx.sceneMgr.addShake(8); }
        target.material.opacity = Math.max(0, 0.8 * (1 - t));
      } };
    },
  });

  registerVfx('boss_star_flip', {
    onCast(ctx, f, c) {
      // The shared light_dark telegraph owns the randomized safe-half display.
      // Keep the impact centered so the VFX never contradicts that warning.
      sphereFlash(ctx, c, { color: HOT, from: 10, to: 150, life: 0.45, alpha: 0.95 });
      ring(ctx, c, { color: MOLTEN, from: 20, to: 340, life: 0.75, y: 4, alpha: 0.9 });
      pillar(ctx, c, { color: [HOT, MOLTEN], h: 360, r: 70, life: 0.8, alpha: 0.7 });
      burst(ctx, c, { color: [HOT, MOLTEN, COOL], count: 42, speed: 380, up: 120, life: 0.9, size: 6 });
      ctx.sceneMgr.addShake(22); ctx.sceneMgr.addFlash(0.38, HOT);
    },
  });

  registerVfx('boss_star_forge_death', {
    onDeath(ctx, f, c) {
      ctx.sceneMgr.addShake(28); ctx.sceneMgr.addFlash(0.55, HOT);
      sphereFlash(ctx, c, { color: HOT, from: 12, to: 190, life: 0.5, alpha: 1 });
      sphereFlash(ctx, c, { color: COOL, from: 8, to: 130, life: 0.65, alpha: 0.75 });
      ring(ctx, c, { color: MOLTEN, from: 20, to: 420, life: 0.9, y: 4, alpha: 0.95 });
      ring(ctx, c, { color: COOL, from: 12, to: 320, life: 1.0, y: 7, alpha: 0.8 });
      column(ctx, c, { color: [HOT, MOLTEN, COOL], count: 48, radius: 120, speed: 360, life: 1.2, size: 6 });
      burst(ctx, c, { color: [HOT, MOLTEN, EMBER, COOL], count: 70, speed: 520, up: 170, life: 1.35, size: 7 });
    },
  });
}
