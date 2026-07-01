// @ts-nocheck
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { setVecFromWorld } from '../../../render3d/coords.js';
import { ring, burst, column, sphereFlash, addShake, addFlash, ultimateBurst } from '../../../render3d/vfx/lib.js';

const GLASS = '#9ee8ff';
const WHITE = '#ffffff';
const GOLD = '#ffe6a7';
const BLUE = '#5ad7ff';

function beamSegment(ctx, f) {
  if (!f.ray || f.x1 == null || f.y1 == null || f.x2 == null || f.y2 == null) return false;
  const TH = ctx.THREE;
  const a = new TH.Vector3();
  const b = new TH.Vector3();
  setVecFromWorld(a, f.x1, f.y1, 24);
  setVecFromWorld(b, f.x2, f.y2, 24);
  const mid = new TH.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  if (len <= 1) return true;

  const g = new TH.Group();
  g.position.copy(mid);
  g.rotation.y = -Math.atan2(f.y2 - f.y1, f.x2 - f.x1);

  const beamWidth = f.width || 18;
  const outerGeo = new TH.BoxGeometry(len, Math.max(16, beamWidth * 1.15), Math.max(26, beamWidth * 1.1));
  const coreGeo = new TH.BoxGeometry(len, Math.max(7, beamWidth * 0.36), Math.max(12, beamWidth * 0.46));
  const curtainGeo = new TH.PlaneGeometry(len, Math.max(46, (f.width || 18) * 3.4));
  const tubeGeo = new TH.CylinderGeometry(Math.max(2.5, (f.width || 18) * 0.18), Math.max(4, (f.width || 18) * 0.28), len, 12, 1, true);
  const prismGeo = new TH.OctahedronGeometry(Math.max(6, (f.width || 18) * 0.5), 0);
  const outerMat = new TH.MeshBasicMaterial({ color: 0x5ad7ff, transparent: true, opacity: 0.42, blending: TH.AdditiveBlending, depthWrite: false });
  const coreMat = new TH.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, blending: TH.AdditiveBlending, depthWrite: false });
  const curtainMat = new TH.MeshBasicMaterial({ color: 0x9ee8ff, transparent: true, opacity: 0.22, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
  const tubeMat = new TH.MeshBasicMaterial({ color: 0xbff5ff, transparent: true, opacity: 0.62, blending: TH.AdditiveBlending, depthWrite: false });
  const prismMat = new TH.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: TH.AdditiveBlending, depthWrite: false });
  const outer = new TH.Mesh(outerGeo, outerMat);
  const core = new TH.Mesh(coreGeo, coreMat);
  const curtainA = new TH.Mesh(curtainGeo, curtainMat);
  const curtainB = new TH.Mesh(curtainGeo, curtainMat.clone());
  curtainA.position.set(0, 24, Math.max(8, beamWidth * 0.48));
  curtainB.position.set(0, 24, -Math.max(8, beamWidth * 0.48));
  const tube = new TH.Mesh(tubeGeo, tubeMat);
  tube.rotation.z = Math.PI / 2;
  tube.position.y = 18;
  const sideTubeA = new TH.Mesh(tubeGeo, tubeMat.clone());
  const sideTubeB = new TH.Mesh(tubeGeo, tubeMat.clone());
  sideTubeA.rotation.z = Math.PI / 2;
  sideTubeB.rotation.z = Math.PI / 2;
  sideTubeA.position.set(0, 13, Math.max(10, beamWidth * 0.42));
  sideTubeB.position.set(0, 13, -Math.max(10, beamWidth * 0.42));
  const slabGeo = new TH.BoxGeometry(len, Math.max(5, beamWidth * 0.22), Math.max(34, beamWidth * 1.55));
  const slabMat = new TH.MeshBasicMaterial({ color: 0x5ad7ff, transparent: true, opacity: 0.25, blending: TH.AdditiveBlending, depthWrite: false });
  const slab = new TH.Mesh(slabGeo, slabMat);
  slab.position.y = 10;
  g.add(curtainA, curtainB, outer, core, slab, tube, sideTubeA, sideTubeB);

  const prisms = [];
  const prismCount = Math.max(2, Math.min(5, Math.floor(len / 170)));
  for (let i = 0; i < prismCount; i++) {
    const p = new TH.Mesh(prismGeo, prismMat);
    p.position.x = ((i + 1) / (prismCount + 1) - 0.5) * len;
    p.position.y = 24 + (i % 2) * 14;
    p.scale.setScalar(0.75 + (i % 2) * 0.22);
    prisms.push(p);
    g.add(p);
  }

  ctx.addTransient(g, f.life || 0.22, (mesh, t) => {
    const p = 1 - t;
    outer.material.opacity = p * 0.42;
    core.material.opacity = p * 0.92;
    curtainA.material.opacity = p * 0.22;
    curtainB.material.opacity = p * 0.16;
    tube.material.opacity = p * 0.62;
    sideTubeA.material.opacity = p * 0.32;
    sideTubeB.material.opacity = p * 0.32;
    slab.material.opacity = p * 0.25;
    prismMat.opacity = p * 0.55;
    mesh.scale.y = 1 + Math.sin(t * Math.PI) * 0.28;
    for (const prism of prisms) {
      prism.rotation.x += 0.22;
      prism.rotation.y += 0.35;
    }
  });
  g.userData.geo = { dispose: () => { outerGeo.dispose(); coreGeo.dispose(); curtainGeo.dispose(); tubeGeo.dispose(); slabGeo.dispose(); prismGeo.dispose(); } };
  g.userData.mat = { dispose: () => { outerMat.dispose(); coreMat.dispose(); curtainMat.dispose(); curtainB.material.dispose(); tubeMat.dispose(); sideTubeA.material.dispose(); sideTubeB.material.dispose(); slabMat.dispose(); prismMat.dispose(); } };

  for (let i = 0; i < 26; i++) {
    const t = Math.random();
    ctx.particles.spawn({
      x: a.x + (b.x - a.x) * t,
      y: 18 + Math.random() * 58,
      z: a.z + (b.z - a.z) * t + (Math.random() - 0.5) * beamWidth * 1.35,
      vx: (Math.random() - 0.5) * 26,
      vy: 28 + Math.random() * 68,
      vz: (Math.random() - 0.5) * 44,
      drag: 2.8,
      life: 0.3 + Math.random() * 0.28,
      size: 2.8 + Math.random() * 4.4,
      color: Math.random() < 0.5 ? WHITE : GLASS,
      fade: true,
    });
  }
  return true;
}

function glassProjectile(ctx, pr, scale = 1) {
  const TH = ctx.THREE;
  const g = new TH.Group();
  const reflected = pr.glassSplitChild || (pr.glassReflects || 0) > 0;
  const geo = new TH.OctahedronGeometry((pr.radius || 8) * scale, 0);
  const mat = new TH.MeshStandardMaterial({ color: reflected ? 0xfff3be : 0xf8fbff, emissive: reflected ? 0xffc84d : 0x7ddcff, emissiveIntensity: reflected ? 3.4 : 2.8, roughness: 0.12, metalness: 0.15 });
  const core = new TH.Mesh(geo, mat);
  g.add(core);
  const ringGeo = new TH.TorusGeometry((pr.radius || 8) * scale * (reflected ? 1.95 : 1.6), (pr.radius || 8) * 0.14, 6, 18);
  const ringMat = new TH.MeshBasicMaterial({ color: reflected ? 0xffe6a7 : 0x9ee8ff, transparent: true, opacity: reflected ? 0.82 : 0.7, blending: TH.AdditiveBlending, depthWrite: false });
  const halo = new TH.Mesh(ringGeo, ringMat);
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  g.userData.geo = { dispose: () => { geo.dispose(); ringGeo.dispose(); } };
  g.userData.mat = { dispose: () => { mat.dispose(); ringMat.dispose(); } };
  return {
    object3D: g,
    update(dt) {
      core.rotation.x += dt * 5.2;
      core.rotation.y += dt * 7.4;
      halo.rotation.z += dt * (reflected ? 11 : 8);
      if (Math.random() < (reflected ? 0.65 : 0.45)) ctx.particles.spawn({ x: g.position.x, y: g.position.y, z: g.position.z, vx: (Math.random() - 0.5) * 18, vy: 8 + Math.random() * 20, vz: (Math.random() - 0.5) * 18, life: 0.26, size: reflected ? 3 : 2.4, color: Math.random() < 0.5 ? WHITE : (reflected ? GOLD : GLASS), drag: 4, fade: true });
    },
  };
}

registerVfx('glass_astrologer_shard', {
  projectile(ctx, pr) {
    return glassProjectile(ctx, pr, 0.9);
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: GLASS, from: 4, to: 28, life: 0.25, y: 5, alpha: 0.8 });
    burst(ctx, c, { color: [WHITE, GLASS], count: 8, speed: 120, life: 0.28, size: 2.6 });
  },
});

registerVfx('glass_astrologer_lance', {
  projectile(ctx, pr) {
    return glassProjectile(ctx, pr, 1.15);
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: BLUE, from: 6, to: 42, life: 0.3, y: 5, alpha: 0.85 });
    burst(ctx, c, { color: [WHITE, GLASS, BLUE], count: 14, speed: 170, life: 0.34, size: 3 });
  },
});

registerVfx('glass_astrologer_mirror', {
  zone(ctx, z) {
    const TH = ctx.THREE;
    const g = new TH.Group();
    const len = z.length || 190;
    const thick = z.thickness || 18;
    const paneGeo = new TH.BoxGeometry(len, 32, Math.max(2, thick * 0.18));
    const paneMat = new TH.MeshBasicMaterial({ color: 0xbff5ff, transparent: true, opacity: 0.42, blending: TH.AdditiveBlending, depthWrite: false });
    const pane = new TH.Mesh(paneGeo, paneMat);
    pane.position.y = 18;
    g.add(pane);

    const edgeGeo = new TH.BoxGeometry(len + 10, 3, 3);
    const edgeMat = new TH.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: TH.AdditiveBlending, depthWrite: false });
    const top = new TH.Mesh(edgeGeo, edgeMat);
    top.position.y = 36;
    const bottom = new TH.Mesh(edgeGeo, edgeMat);
    bottom.position.y = 1.5;
    g.add(top, bottom);

    g.rotation.y = -(z.angle || 0);
    g.userData.geo = { dispose: () => { paneGeo.dispose(); edgeGeo.dispose(); } };
    g.userData.mat = { dispose: () => { paneMat.dispose(); edgeMat.dispose(); } };
    return {
      object3D: g,
      update(dt, next) {
        g.rotation.y = -(next.angle || 0);
        const chargePulse = Math.max(0.25, Math.min(1, (next.charges || 0) / 3));
        paneMat.opacity = 0.24 + 0.2 * chargePulse + 0.05 * Math.sin(performance.now() / 140);
        edgeMat.opacity = 0.45 + 0.4 * chargePulse;
      },
    };
  },
  onCast(ctx, f, c) {
    ring(ctx, c, { color: GLASS, from: 12, to: f.radius || 90, life: 0.35, y: 4, alpha: 0.75, ease: true });
    burst(ctx, c, { color: [WHITE, GLASS], count: 12, speed: 110, life: 0.32, size: 2.8 });
  },
});

registerVfx('glass_astrologer_ray', {
  onHit(ctx, f, c) {
    if (beamSegment(ctx, f)) return;
    ring(ctx, c, { color: BLUE, from: 5, to: f.radius || 32, life: 0.22, y: 5, alpha: 0.75 });
    burst(ctx, c, { color: [WHITE, GLASS, BLUE], count: 10, speed: 150, life: 0.26, size: 2.6 });
  },
});

registerVfx('glass_astrologer_detonate', {
  onCast(ctx, f, c) {
    ring(ctx, c, { color: GLASS, from: 12, to: f.radius || 70, life: 0.36, y: 5, alpha: 0.9, ease: true });
    sphereFlash(ctx, c, { color: WHITE, from: 5, to: 34, life: 0.24, alpha: 0.8 });
    burst(ctx, c, { color: [WHITE, GLASS, GOLD], count: 18, speed: 180, up: 28, life: 0.42, size: 3 });
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: GLASS, from: 8, to: f.radius || 56, life: 0.3, y: 6, alpha: 0.85 });
    burst(ctx, c, { color: [WHITE, GLASS, GOLD], count: 16, speed: 170, up: 22, life: 0.36, size: 3.2 });
  },
});

registerVfx('glass_astrologer_refract', {
  onHit(ctx, f, c) {
    ring(ctx, c, { color: GOLD, from: 4, to: 32, life: 0.24, y: 5, alpha: 0.8 });
    burst(ctx, c, { color: [WHITE, GOLD, GLASS], count: 10, speed: 145, life: 0.28, size: 2.5 });
  },
});

registerVfx('glass_astrologer_ultimate', {
  onCast(ctx, f, c) {
    const R = f.radius || 260;
    addShake(ctx, 13);
    addFlash(ctx, 0.22, GLASS);
    ultimateBurst(ctx, c, { color: GLASS, radius: Math.min(R, 340), pillarH: 150, pillarR: 24, count: 38, shake: 0, flash: 0 });
    ring(ctx, c, { color: GOLD, from: 28, to: Math.min(R, 420), life: 0.7, y: 3, alpha: 0.65, inner: 0.9, ease: true });
    column(ctx, c, { color: [WHITE, GLASS, GOLD], count: 34, radius: 46, speed: 240, life: 0.8, size: 4 });
    sphereFlash(ctx, c, { color: WHITE, from: 10, to: 82, life: 0.32, alpha: 0.72 });
  },
});
