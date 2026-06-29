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

function addCrossBlade(colorA, colorB) {
  const g = new THREE.Group();
  const matA = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorA), transparent: true, opacity: 0.82, depthWrite: false, blending: THREE.AdditiveBlending });
  const matB = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorB), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(88, 2.2, 5), matA);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(88, 2.2, 5), matB);
  bladeA.position.y = 8;
  bladeB.position.y = 10;
  bladeB.rotation.y = Math.PI / 2;
  g.add(bladeA, bladeB);
  return { group: g, matA, matB, bladeA, bladeB };
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
      ring(ctx, c, { color: BLUE, from: 16, to: 150, life: 0.64, y: 3, alpha: 0.9 });
      ring(ctx, c, { color: RED, from: 150, to: 24, life: 0.64, y: 7, alpha: 0.74 });
      ring(ctx, c, { color: '#ffffff', from: 36, to: 118, life: 0.36, y: 12, alpha: 0.42 });
      burst(ctx, c, { color: [BLUE, RED, STEEL], count: 42, speed: 230, up: 78, life: 0.7, size: 4 });
    },
  });

  registerVfx('boss_magnet_polarity', {
    onCast(ctx, f, c) {
      const color = polarityColor(f.polarity);
      const glyph = addPolarityGlyph(color, f.polarity || 'N');
      glyph.group.position.set(c.x, 0, c.z);
      ctx.addTransient(glyph.group, f.life || 0.34, (m, t) => {
        m.position.y = 4 + Math.sin(t * Math.PI) * 8;
        m.rotation.y += 0.24;
        glyph.ringMesh.scale.setScalar(1 + t * 0.5);
        glyph.mat.opacity = (1 - t) * 0.92;
      });
      ring(ctx, c, { color, from: 20, to: f.radius || 54, life: f.life || 0.34, y: 2.5, alpha: 0.55 });
    },
  });

  registerVfx('boss_magnet_resonance', {
    onCast(ctx, f, c) {
      const color = f.color || polarityColor(f.polarity);
      sphereFlash(ctx, c, { color: '#ffffff', from: 4, to: (f.radius || 78) * 0.55, life: 0.16, alpha: 0.78 });
      ring(ctx, c, { color, from: 14, to: f.radius || 86, life: f.life || 0.42, y: 5, alpha: 0.9, ease: true });
      ring(ctx, c, { color: f.polarity === 'S' ? BLUE : RED, from: f.radius || 86, to: 24, life: f.life || 0.42, y: 10, alpha: 0.58 });
      burst(ctx, c, { color: [color, '#ffffff', STEEL], count: 38, speed: 280, up: 80, life: 0.52, size: 4.4 });
      const blades = addCrossBlade(color, f.polarity === 'S' ? BLUE : RED);
      blades.group.position.set(c.x, 0, c.z);
      ctx.addTransient(blades.group, f.life || 0.42, (m, t) => {
        m.rotation.y += 0.3;
        const s = 0.5 + t * 1.25;
        m.scale.set(s, 1, s);
        blades.matA.opacity = (1 - t) * 0.82;
        blades.matB.opacity = (1 - t) * 0.7;
      });
    },
  });

  registerVfx('boss_magnet_anchor', {
    onCast(ctx, f, c) {
      const color = polarityColor(f.polarity);
      pillar(ctx, c, { color, h: 140, r: 16, taper: 0.36, life: 0.75, alpha: 0.72, grow: 0.32 });
      pillar(ctx, c, { color: '#ffffff', h: 80, r: 5, taper: 0.65, life: 0.36, alpha: 0.46, grow: 0.18 });
      ring(ctx, c, { color, from: 10, to: f.radius || 122, life: 0.72, y: 3, alpha: 0.92, ease: true });
      ring(ctx, c, { color: f.polarity === 'S' ? BLUE : RED, from: 30, to: (f.radius || 122) * 0.72, life: 0.62, y: 9, alpha: 0.5, ease: true });
      burst(ctx, c, { color: [color, STEEL, '#ffffff'], count: 32, speed: 170, up: 105, life: 0.68, size: 3.8 });
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
      const inner = new THREE.Mesh(
        new THREE.TorusGeometry(R * 0.68, 1.8, 8, 48),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(z.polarity === 'S' ? BLUE : RED), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      inner.rotation.x = Math.PI / 2;
      inner.position.y = 5;
      g.add(inner);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(7, 18, 115, 18, 1, true),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.24, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
      );
      beam.position.y = 58;
      g.add(beam);
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
          inner.material.opacity = (warning > 0 ? 0.3 : 0.58) + pulse * 0.1;
          beam.material.opacity = (warning > 0 ? 0.18 : 0.34) + pulse * 0.08;
          outer.rotation.z += dt * (liveZone.polarity === 'S' ? -2.15 : 2.15);
          inner.rotation.z -= dt * (liveZone.polarity === 'S' ? -2.8 : 2.8);
          beam.rotation.y += dt * 1.1;
          glyph.group.rotation.y += dt * 1.65;
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
      ultimateBurst(ctx, c, { color: VIOLET, radius: f.radius || 320, count: 46, shake: 22, flash: 0.34, pillarH: 180, pillarR: 30 });
      ring(ctx, c, { color: BLUE, from: 50, to: f.radius || 320, life: 0.7, y: 8, alpha: 0.62 });
      ring(ctx, c, { color: RED, from: f.radius || 320, to: 70, life: 0.7, y: 14, alpha: 0.5 });
    },
  });

  registerVfx('boss_magnet_tear', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: '#ffffff', from: 4, to: f.radius || 68, life: 0.14, alpha: 0.88 });
      ring(ctx, c, { color: VIOLET, from: 12, to: f.radius || 68, life: f.life || 0.34, y: 4, alpha: 0.9 });
      burst(ctx, c, { color: [VIOLET, BLUE, RED, '#ffffff'], count: 34, speed: 320, up: 62, flat: true, life: 0.42, size: 4.5 });
      const blades = addCrossBlade(VIOLET, f.polarity === 'S' ? RED : BLUE);
      blades.group.position.set(c.x, 0, c.z);
      ctx.addTransient(blades.group, f.life || 0.34, (m, t) => {
        m.rotation.y += 0.5;
        const s = 0.65 + t * 1.45;
        m.scale.set(s, 1, s);
        blades.bladeA.rotation.y += 0.08;
        blades.bladeB.rotation.y -= 0.08;
        blades.matA.opacity = (1 - t) * 0.86;
        blades.matB.opacity = (1 - t) * 0.72;
      });
    },
  });

  registerVfx('boss_magnet_polarity_blast', {
    onCast(ctx, f, c) {
      const radius = f.radius || 170;
      const g = new THREE.Group();
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
      const core = new THREE.Mesh(new THREE.SphereGeometry(18, 18, 12), coreMat);
      core.position.y = 34;
      g.add(core);
      const shockMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET), transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const shock = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.32, 64), shockMat);
      shock.rotation.x = -Math.PI / 2;
      shock.position.y = 2;
      g.add(shock);
      const ringA = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.38, 3.2, 8, 72),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE), transparent: true, opacity: 0.86, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      const ringB = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.48, 2.8, 8, 72),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(RED), transparent: true, opacity: 0.78, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      const ringC = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.58, 2.2, 8, 72),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(VIOLET), transparent: true, opacity: 0.64, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ringA.rotation.x = Math.PI / 2;
      ringB.rotation.x = Math.PI / 2.5;
      ringB.rotation.z = Math.PI / 7;
      ringC.rotation.x = Math.PI / 2.2;
      ringC.rotation.z = -Math.PI / 6;
      ringA.position.y = 12;
      ringB.position.y = 24;
      ringC.position.y = 36;
      g.add(ringA, ringB, ringC);
      g.position.set(c.x, 0, c.z);
      ctx.addTransient(g, f.life || 0.72, (m, t) => {
        const ease = 1 - Math.pow(1 - t, 3);
        core.scale.setScalar(1 + ease * 2.6);
        coreMat.opacity = (1 - t) * 0.9;
        shock.scale.setScalar(1 + ease * 3.8);
        shockMat.opacity = (1 - t) * 0.34;
        ringA.scale.setScalar(0.72 + ease * 1.9);
        ringB.scale.setScalar(0.62 + ease * 2.15);
        ringC.scale.setScalar(0.54 + ease * 2.45);
        ringA.rotation.z += 0.22;
        ringB.rotation.z -= 0.28;
        ringC.rotation.z += 0.34;
        ringA.material.opacity = (1 - t) * 0.86;
        ringB.material.opacity = (1 - t) * 0.78;
        ringC.material.opacity = (1 - t) * 0.64;
      });
      sphereFlash(ctx, c, { color: '#ffffff', from: 10, to: radius * 0.85, life: 0.2, alpha: 0.95 });
      ring(ctx, c, { color: BLUE, from: 18, to: radius, life: 0.55, y: 5, alpha: 0.95, ease: true });
      ring(ctx, c, { color: RED, from: radius * 0.92, to: 28, life: 0.55, y: 12, alpha: 0.82, ease: true });
      ring(ctx, c, { color: VIOLET, from: 44, to: radius * 1.18, life: 0.72, y: 18, alpha: 0.58, ease: true });
      burst(ctx, c, { color: [BLUE, RED, VIOLET, '#ffffff', STEEL], count: 76, speed: 430, up: 120, life: 0.78, size: 5.2 });
      ultimateBurst(ctx, c, { color: VIOLET, radius: radius * 0.8, count: 28, shake: 18, flash: 0.18, pillarH: 130, pillarR: 24 });
      const blades = addCrossBlade(BLUE, RED);
      blades.group.position.set(c.x, 0, c.z);
      ctx.addTransient(blades.group, f.life || 0.72, (m, t) => {
        m.rotation.y += 0.75;
        const s = 0.7 + t * 2.1;
        m.scale.set(s, 1, s);
        blades.matA.opacity = (1 - t) * 0.9;
        blades.matB.opacity = (1 - t) * 0.9;
      });
    },
  });

  registerVfx('boss_magnet_blast_impact', {
    onCast(ctx, f, c) {
      const color = f.color || polarityColor(f.polarity);
      sphereFlash(ctx, c, { color: '#ffffff', from: 3, to: f.radius || 58, life: 0.12, alpha: 0.75 });
      ring(ctx, c, { color, from: 8, to: f.radius || 58, life: f.life || 0.34, y: 6, alpha: 0.78, ease: true });
      ring(ctx, c, { color: VIOLET, from: (f.radius || 58) * 0.75, to: 14, life: f.life || 0.34, y: 13, alpha: 0.42 });
      burst(ctx, c, { color: [color, VIOLET, '#ffffff', STEEL], count: 24, speed: 260, up: 58, flat: true, life: 0.36, size: 3.8 });
    },
  });

  registerVfx('boss_magnet_death', {
    onDeath(ctx, f, c) {
      ultimateBurst(ctx, c, { color: BLUE, radius: 300, count: 42, shake: 22, flash: 0.34, pillarH: 160, pillarR: 28 });
      ring(ctx, c, { color: RED, from: 280, to: 30, life: 0.55, y: 5, alpha: 0.75 });
    },
  });
}
