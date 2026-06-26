// @ts-nocheck
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { burst, cone, ring, sphereFlash, pillar, ultimateBurst } from '../../render3d/vfx/lib.js';

const BLUE = '#58d7ff';
const RED = '#ff5d6c';
const VIOLET = '#a855ff';
const STEEL = '#b7c4cc';

function polarityColor(v) {
  return v === 'S' ? RED : BLUE;
}

function addPolarityGlyph(color, label) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(22, 1.8, 8, 36), mat);
  ringMesh.rotation.x = Math.PI / 2;
  ringMesh.position.y = 34;
  g.add(ringMesh);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(label === 'N' ? 8 : 18, 2.2, 2.2), mat);
  bar.position.y = 34;
  g.add(bar);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 16), mat);
  bar2.position.y = 34;
  if (label === 'N') g.add(bar2);
  return { group: g, mat, ringMesh };
}

export function loadVfx() {
  registerVfx('boss_magnet_slam', {
    onCast(ctx, f, c) {
      cone(ctx, c, f.facing, { color: [STEEL, BLUE, RED], count: 20, speed: 260, spread: 0.72, up: 28, life: 0.5, size: 4 });
      ring(ctx, c, { color: '#d7f7ff', from: 18, to: f.range || 150, life: 0.28, y: 3, alpha: 0.72 });
    },
  });

  registerVfx('boss_magnet_needle', {
    onCast(ctx, f, c) {
      cone(ctx, c, f.facing, { color: [BLUE, STEEL], count: 16, speed: 430, spread: 0.18, up: 8, life: 0.35, size: 3 });
      sphereFlash(ctx, c, { color: BLUE, from: 3, to: 32, life: 0.2, alpha: 0.55 });
    },
  });

  registerVfx('boss_magnet_mark', {
    onCast(ctx, f, c) {
      ring(ctx, c, { color: BLUE, from: 16, to: 105, life: 0.46, y: 3, alpha: 0.85 });
      ring(ctx, c, { color: RED, from: 105, to: 18, life: 0.46, y: 5, alpha: 0.65 });
      burst(ctx, c, { color: [BLUE, RED], count: 26, speed: 180, up: 60, life: 0.55, size: 3.5 });
    },
  });

  registerVfx('boss_magnet_polarity', {
    onCast(ctx, f, c) {
      const color = polarityColor(f.polarity);
      const glyph = addPolarityGlyph(color, f.polarity || 'N');
      glyph.group.position.set(c.x, 0, c.z);
      ctx.addTransient(glyph.group, f.life || 0.34, (m, t) => {
        m.position.y = 4 + Math.sin(t * Math.PI) * 8;
        m.rotation.y += 0.18;
        glyph.ringMesh.scale.setScalar(1 + t * 0.35);
        glyph.mat.opacity = (1 - t) * 0.78;
      });
      ring(ctx, c, { color, from: 20, to: f.radius || 54, life: f.life || 0.34, y: 2.5, alpha: 0.55 });
    },
  });

  registerVfx('boss_magnet_anchor', {
    onCast(ctx, f, c) {
      const color = polarityColor(f.polarity);
      pillar(ctx, c, { color, h: 95, r: 12, taper: 0.45, life: 0.52, alpha: 0.58, grow: 0.3 });
      ring(ctx, c, { color, from: 10, to: f.radius || 92, life: 0.52, y: 3, alpha: 0.85, ease: true });
      burst(ctx, c, { color: [color, STEEL], count: 18, speed: 120, up: 80, life: 0.5, size: 3 });
    },
  });

  registerVfx('boss_magnet_collapse', {
    zone(ctx, z) {
      const R = z.radius || 130;
      const color = polarityColor(z.polarity);
      const g = new THREE.Group();
      const field = new THREE.Mesh(
        new THREE.CircleGeometry(R, 44),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      field.rotation.x = -Math.PI / 2;
      field.position.y = 1;
      g.add(field);
      const outer = new THREE.Mesh(
        new THREE.TorusGeometry(R, 2.6, 8, 54),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      outer.rotation.x = Math.PI / 2;
      outer.position.y = 2;
      g.add(outer);
      const glyph = addPolarityGlyph(color, z.polarity || 'N');
      glyph.group.position.y = 6;
      g.add(glyph.group);
      let t = 0;
      return {
        object3D: g,
        update(dt, liveZone) {
          t += dt;
          const warning = Math.max(0, liveZone.delay || 0);
          const pulse = 0.5 + 0.5 * Math.sin(t * (warning > 0 ? 15 : 7));
          field.material.opacity = (warning > 0 ? 0.11 : 0.2) + pulse * 0.08;
          outer.material.opacity = (warning > 0 ? 0.55 : 0.85) + pulse * 0.12;
          outer.rotation.z += dt * (liveZone.polarity === 'S' ? -1.5 : 1.5);
          glyph.group.rotation.y += dt * 1.2;
          glyph.mat.opacity = 0.5 + pulse * 0.28;
        },
      };
    },
    onCast(ctx, f, c) {
      const color = f.color || polarityColor(f.polarity);
      sphereFlash(ctx, c, { color, from: 8, to: f.radius || 130, life: 0.36, alpha: 0.72 });
      burst(ctx, c, { color: [color, '#ffffff'], count: 32, speed: 250, up: 70, flat: true, life: 0.6, size: 4.2 });
    },
  });

  registerVfx('boss_magnet_ult', {
    onCast(ctx, f, c) {
      ultimateBurst(ctx, c, { color: VIOLET, radius: f.radius || 240, count: 28, shake: 14, flash: 0.22, pillarH: 130, pillarR: 22 });
    },
  });

  registerVfx('boss_magnet_death', {
    onDeath(ctx, f, c) {
      ultimateBurst(ctx, c, { color: BLUE, radius: 300, count: 42, shake: 22, flash: 0.34, pillarH: 160, pillarR: 28 });
      ring(ctx, c, { color: RED, from: 280, to: 30, life: 0.55, y: 5, alpha: 0.75 });
    },
  });
}
