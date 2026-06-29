// @ts-nocheck
// 武士：可玩版斬業。白色死線、紅色命中斬痕、納刀光圈。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, cone, burst, sphereFlash, slashBlade, getSwingDir } from '../../../render3d/vfx/lib.js';

const WHITE = '#f2f0dc';
const RED = '#d94343';
const BLACK = '#151515';

function lineFlash(ctx, c, facing, color, len = 240, width = 7) {
  const geo = new THREE.PlaneGeometry(len, width);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = -facing;
  m.position.set(c.x + Math.cos(facing) * len * 0.5, 5, c.z + Math.sin(facing) * len * 0.5);
  ctx.addTransient(m, 0.28, (mesh, t) => {
    mesh.material.opacity = 0.82 * (1 - t);
    mesh.scale.y = 1 - t * 0.45;
  });
}

registerVfx('samurai_draw', {
  onCast(ctx, f, c) {
    const swingDir = getSwingDir(ctx, c);
    slashBlade(ctx, c, f.facing, { color: [WHITE, RED], len: f.range * 1.16, w: 10, swing: (f.arc || 0.9) * swingDir, life: 0.2 });
    lineFlash(ctx, c, f.facing, WHITE, f.range * 1.15, 5);
    cone(ctx, c, f.facing, { color: [WHITE, RED], count: 10, speed: 280, spread: (f.arc || 0.9) / 2.5, offset: f.range * 0.5, life: 0.28, size: 3.2 });
  },
});

registerVfx('samurai_iai', {
  onCast(ctx, f, c) {
    lineFlash(ctx, c, f.facing, RED, (f.range || 190) * 1.55, 9);
    ring(ctx, c, { color: RED, from: 8, to: 70, life: 0.34, y: 3, alpha: 0.82 });
    cone(ctx, c, f.facing, { color: [WHITE, RED], count: 18, speed: 420, spread: 0.16, life: 0.3, size: 3.5 });
    ctx.sceneMgr.addShake(6);
  },
});

registerVfx('samurai_guard', {
  onCast(ctx, f, c) {
    ring(ctx, c, { color: WHITE, from: 10, to: 62, life: 0.4, y: 4, alpha: 0.85, ease: true });
    sphereFlash(ctx, c, { color: RED, from: 6, to: 42, life: 0.28, alpha: 0.75 });
    lineFlash(ctx, c, f.facing + Math.PI / 2, WHITE, 72, 5);
  },
});

registerVfx('samurai_ultimate', {
  onCast(ctx, f, c) {
    if (f.type === 'ultimate') {
      ctx.sceneMgr.addShake(14);
      ctx.sceneMgr.addFlash(0.18, WHITE);
      sphereFlash(ctx, c, { color: RED, from: 8, to: 82, life: 0.32, alpha: 0.9 });
      ring(ctx, c, { color: WHITE, from: 20, to: 145, life: 0.46, y: 4, alpha: 0.88 });
      lineFlash(ctx, c, f.facing, RED, f.range || 760, 8);
      burst(ctx, c, { color: [WHITE, RED, BLACK], count: 28, speed: 450, up: 58, life: 0.6, size: 4.5 });
    } else {
      slashBlade(ctx, c, f.facing, { color: [WHITE, RED], len: 96, w: 12, swing: 1.5, life: 0.2 });
      sphereFlash(ctx, c, { color: WHITE, from: 5, to: 44, life: 0.2, alpha: 0.85 });
      burst(ctx, c, { color: [WHITE, RED], count: 14, speed: 230, life: 0.36, size: 3.2 });
    }
  },
});
