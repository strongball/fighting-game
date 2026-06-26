// @ts-nocheck
// 刺客：毒刃疊毒收割。毒綠刀光 / 毒霧雲 / 淬毒紫綠爆 / 瘟疫爆發擴散。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { slashBlade, ring, sphereFlash, burst, cone, column, addShake, addFlash, ultimateBurst } from '../../../render3d/vfx/lib.js';

// 大絕招 — 瘟疫爆發：全場中毒引爆＋擴散的毒綠瘟疫
registerVfx('assassin_ultimate', {
  // 施法者處的瘟疫爆發（type 'ultimate'）
  onCast(ctx, f, c) {
    addShake(ctx, 16);
    addFlash(ctx, 0.34, '#1e5a2a');
    sphereFlash(ctx, c, { color: '#d8ffcf', from: 10, to: 120, life: 0.32, alpha: 0.95 });
    ring(ctx, c, { color: '#7ee787', from: 18, to: 240, life: 0.75, y: 4, alpha: 0.9, ease: true });
    ring(ctx, c, { color: '#2ecc71', from: 10, to: 170, life: 0.55, y: 8, alpha: 0.8 });
    // 翻騰的毒氣（向上膨脹的綠雲）＋ 上升毒泡柱
    burst(ctx, c, { color: ['#7ee787', '#2ecc71', '#1a7a3a', '#a06cff'], count: 60, speed: 300, up: 90, gravity: -14, drag: 1.5, life: 0.9, size: 6 });
    column(ctx, c, { color: ['#7ee787', '#d8ffcf'], count: 28, radius: 60, speed: 150, life: 1.0, size: 5 });
  },
  // 每個中毒敵人被引爆＋擴散時的毒爆（type 'hit'，由 plaguenova 對每個目標發出）
  onHit(ctx, f, c) {
    sphereFlash(ctx, c, { color: '#d8ffcf', from: 4, to: 50, life: 0.26, alpha: 0.95 });
    ring(ctx, c, { color: '#7ee787', from: 6, to: 78, life: 0.34, y: 6, alpha: 0.85, ease: true });
    burst(ctx, c, { color: ['#7ee787', '#2ecc71', '#1a7a3a'], count: 22, speed: 240, up: 40, gravity: -10, drag: 1.4, life: 0.6, size: 4.5 });
  },
});

registerVfx('assassin_slash', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    // 毒刃：淡綠主刃 + 毒紫副刃 + 綠色毒沫
    slashBlade(ctx, c, f.facing + 0.35, { color: '#d8ffcf', len: f.range * 1.1, w: 6, swing: -0.7, life: 0.16 });
    slashBlade(ctx, c, f.facing - 0.35, { color: '#a06cff', len: f.range * 1.1, w: 6, swing: 0.7, life: 0.16 });
    cone(ctx, c, f.facing, { color: ['#7ee787', '#2ecc71'], count: 9, speed: 260, spread: 0.4, offset: f.range * 0.4, life: 0.26, size: 2.6 });

    const slashGeo = new THREE.BoxGeometry(f.range * 1.2, 0.5, 2.5);
    const slashMat = new THREE.MeshBasicMaterial({ color: 0x6ee07a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    
    const s1 = new THREE.Mesh(slashGeo, slashMat);
    s1.position.set(c.x + Math.cos(f.facing) * f.range * 0.4, 14, c.z + Math.sin(f.facing) * f.range * 0.4);
    s1.rotation.y = -f.facing;
    s1.rotation.z = 0.4;
    
    const s2 = new THREE.Mesh(slashGeo, slashMat);
    s2.position.set(c.x + Math.cos(f.facing) * f.range * 0.4, 14, c.z + Math.sin(f.facing) * f.range * 0.4);
    s2.rotation.y = -f.facing;
    s2.rotation.z = -0.4;
    
    ctx.addTransient(s1, 0.24, (mesh, t) => { mesh.material.opacity = (1 - t) * 0.85; mesh.scale.y = 1 - t; });
    ctx.addTransient(s2, 0.24, (mesh, t) => { mesh.scale.y = 1 - t; });
    s1.userData.geo = slashGeo;
    s1.userData.mat = slashMat;
  },
});

registerVfx('assassin_blink', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const R = f.range || 260;
    
    ring(ctx, c, { color: '#c39bd3', from: 4, to: 50, life: 0.34, y: 6, alpha: 0.9 });
    burst(ctx, c, { color: ['#9b59b6', '#c39bd3', '#3a2150'], count: 22, speed: 130, up: 40, gravity: -20, drag: 1.4, life: 0.5, size: 5 });
    column(ctx, c, { color: '#c39bd3', count: 10, radius: 12, speed: 120, life: 0.4, size: 3 });
    
    const startX = c.x - Math.cos(f.facing) * R;
    const startZ = c.z - Math.sin(f.facing) * R;
    
    const safeStartX = Math.max(-595, Math.min(595, startX));
    const safeStartZ = Math.max(-395, Math.min(395, startZ));
    
    const cloneGeo = new THREE.ConeGeometry(9, 22, 4);
    const cloneMat = new THREE.MeshBasicMaterial({ color: 0x3a2150, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending });
    const clone = new THREE.Mesh(cloneGeo, cloneMat);
    clone.position.set(safeStartX, 11, safeStartZ);
    clone.rotation.x = Math.PI / 2;
    clone.rotation.y = -f.facing;
    
    ctx.addTransient(clone, 0.48, (mesh, t) => {
      mesh.scale.set(1 + t * 0.4, 1, 1 + t * 0.4);
      cloneMat.opacity = 0.85 * (1 - t);
    });
    clone.userData.geo = cloneGeo;
    clone.userData.mat = cloneMat;
    
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, sp = 50 + Math.random() * 80;
      ctx.particles.spawn({
        x: safeStartX, y: 8, z: safeStartZ,
        vx: Math.cos(a) * sp, vy: 20 + Math.random() * 40, vz: Math.sin(a) * sp,
        drag: 2, life: 0.4, size: 4, color: '#3a2150', fade: true
      });
    }
  },
});

// 淬毒之刃 (skill2)：爆疊劇毒的毒綠重斬 + 毒沫噴濺
registerVfx('assassin_backstab', {
  onCast(ctx, f, c) {
    sphereFlash(ctx, c, { color: '#d8ffcf', from: 6, to: 58, life: 0.22, alpha: 0.98 });
    slashBlade(ctx, c, f.facing, { color: '#ffffff', len: f.range * 1.4, w: 22, swing: (f.arc || 1.6), life: 0.24 });
    slashBlade(ctx, c, f.facing + 0.3, { color: '#a06cff', len: f.range * 1.2, w: 14, swing: -(f.arc || 1.6), life: 0.22 });
    cone(ctx, c, f.facing, { color: ['#7ee787', '#2ecc71', '#a06cff'], count: 30, speed: 380, spread: 0.7, offset: f.range * 0.3, up: 40, life: 0.5, size: 4 });
    ring(ctx, c, { color: '#7ee787', from: 6, to: 92, life: 0.34, y: 8, ease: true });
    addShake(ctx, 9);
    addFlash(ctx, 0.2, '#1e5a2a');
  },
});

// 毒霧步 (skill1)：原地留下的毒綠毒霧雲（zone）＋ 落雲噴霧
registerVfx('assassin_mist', {
  zone(ctx, z) {
    const TH = ctx.THREE;
    const R = z.radius || 150;
    const geo = new TH.CircleGeometry(R, 28);
    const mat = new TH.MeshBasicMaterial({ color: 0x2ecc71, transparent: true, opacity: 0.22, depthWrite: false, side: TH.DoubleSide, blending: TH.AdditiveBlending });
    const disc = new TH.Mesh(geo, mat); disc.rotation.x = -Math.PI / 2; disc.position.y = 1.5;
    const g = new TH.Group(); g.add(disc);
    g.userData.geo = geo; g.userData.mat = mat;
    let first = true;
    return {
      object3D: g,
      update() {
        if (first) {
          first = false;
          const cc = { x: g.position.x, y: 6, z: g.position.z };
          ring(ctx, cc, { color: '#7ee787', from: 8, to: R, life: 0.5, y: 3, ease: true, alpha: 0.6 });
          burst(ctx, cc, { color: ['#7ee787', '#2ecc71', '#1a7a3a'], count: 20, speed: 110, up: 30, drag: 1.5, life: 0.7, size: 6 });
        }
        mat.opacity = 0.18 + 0.07 * Math.sin(performance.now() / 180);
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * R;
          ctx.particles.spawn({ x: g.position.x + Math.cos(a) * rr, y: 3, z: g.position.z + Math.sin(a) * rr, vx: (Math.random() - 0.5) * 12, vy: 18 + Math.random() * 26, vz: (Math.random() - 0.5) * 12, drag: 1.4, gravity: -8, life: 0.9, size: 4 + Math.random() * 3, color: Math.random() < 0.5 ? '#7ee787' : '#2ecc71', fade: true });
        }
      },
    };
  },
});

// 影刺突 (舊 skill1 dash，已不使用；保留註冊無害)
registerVfx('assassin_dash', {
  onCast(ctx, f, c) {
    const TH = ctx.THREE;
    const facing = f.facing || 0;
    const len = 130;
    // 突進殘影條（沿前進方向拉長，快速淡出）
    const trailGeo = new TH.BoxGeometry(len, 0.6, 7);
    const trailMat = new TH.MeshBasicMaterial({ color: 0xc39bd3, transparent: true, opacity: 0.8, blending: TH.AdditiveBlending, depthWrite: false });
    const trail = new TH.Mesh(trailGeo, trailMat);
    trail.position.set(c.x - Math.cos(facing) * len * 0.4, 13, c.z - Math.sin(facing) * len * 0.4);
    trail.rotation.y = -facing;
    ctx.addTransient(trail, 0.26, (mesh, t) => { trailMat.opacity = 0.8 * (1 - t); mesh.scale.x = 1 - t * 0.5; });
    trail.userData.geo = trailGeo;
    trail.userData.mat = trailMat;

    // 突刺斬 + 前向錐 + 落點環
    slashBlade(ctx, c, facing, { color: '#ffffff', len: 90, w: 11, swing: 1.6, life: 0.2 });
    cone(ctx, c, facing, { color: ['#c39bd3', '#e056fd', '#9b59b6'], count: 14, speed: 320, spread: 0.4, offset: 30, life: 0.32, size: 3.2 });
    ring(ctx, c, { color: '#c39bd3', from: 4, to: 64, life: 0.3, y: 6, alpha: 0.85 });
    addShake(ctx, 5);
  },
});
