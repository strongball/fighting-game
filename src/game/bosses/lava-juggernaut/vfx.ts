// @ts-nocheck
// R3 熔岩鐵衛 技能特效。主題：熔岩橘紅／餘燼／黑鐵焦土。
// 效能：一次性走粒子池(particles)＋自動回收 transient；zone 只建少量網格，由 entities3d dispose。
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { slashBlade, cone, burst, ring, column, sphereFlash } from '../../render3d/vfx/lib.js';

const LAVA = '#ff5a1f', EMBER = '#ff3010', GLOW = '#ff7043', SPARK = '#ffcf6b', ASH = '#3a2218';
const addRing = (color, op = 0.85) => new THREE.Mesh(new THREE.RingGeometry(0.84, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
const addCol = (color, op, r1, r2, h) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));

export function loadVfx() {
  // 熔岩劈斬：雙層熾紅刀光 + 餘燼噴濺
  registerVfx('boss_juggernaut_slash', {
    onCast(ctx, f, c) {
      slashBlade(ctx, c, f.facing, { color: [GLOW, LAVA], len: (f.range || 120) * 1.15, swing: 1.6, life: 0.32, y: 16, sparkCount: 16, alpha: 0.96 });
      slashBlade(ctx, c, f.facing, { color: [SPARK, '#ffffff'], len: (f.range || 120) * 0.85, swing: 1.4, life: 0.22, y: 18, sparkCount: 8, alpha: 0.82 });
      cone(ctx, c, f.facing, { color: [LAVA, EMBER, SPARK], count: 22, speed: 260, spread: 0.7, up: 30, life: 0.5, size: 4 });
      ctx.sceneMgr.addShake(6); ctx.sceneMgr.addFlash(0.08, LAVA);
    },
  });

  // 烈焰衝鋒：噴火前衝 + 撞擊雙環爆燃＋揚塵
  registerVfx('boss_juggernaut_charge', {
    onCast(ctx, f, c) {
      burst(ctx, c, { color: [LAVA, EMBER], count: 22, speed: 170, up: 40, life: 0.45, size: 4.5 });
      cone(ctx, c, f.facing, { color: [LAVA, SPARK], count: 26, speed: 340, spread: 0.4, up: 14, life: 0.55, size: 4.5 });
    },
    onHit(ctx, f, c) {
      sphereFlash(ctx, c, { color: SPARK, from: 6, to: 56, life: 0.26, alpha: 0.85 });
      ring(ctx, c, { color: LAVA, from: 10, to: (f.radius || 70) * 1.9, life: 0.44, y: 2, alpha: 0.9, ease: true });
      ring(ctx, c, { color: SPARK, from: 6, to: (f.radius || 70) * 1.1, life: 0.32, y: 3, alpha: 0.7 });
      burst(ctx, c, { color: [LAVA, EMBER, SPARK], count: 32, speed: 280, up: 70, flat: true, life: 0.6, size: 5 });
      column(ctx, c, { color: ['#5a3a22', ASH], count: 14, radius: (f.radius || 70) * 0.5, speed: 170, life: 0.6, size: 5.5 });
      ctx.sceneMgr.addShake(16); ctx.sceneMgr.addFlash(0.24, LAVA);
    },
  });

  // 震地烈焰：焦土 + 放射熔岩裂縫 + 上竄火舌柱 + 噴濺餘燼
  registerVfx('boss_juggernaut_quake', {
    zone(ctx, z) {
      const R = z.radius || 150;
      const g = new THREE.Group();
      const scorch = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(ASH), transparent: true, opacity: 0.58, side: THREE.DoubleSide, depthWrite: false }));
      scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.5; g.add(scorch);
      const cracks = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; const cr = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.95, R * 0.085), new THREE.MeshBasicMaterial({ color: new THREE.Color(LAVA), transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); cr.rotation.x = -Math.PI / 2; cr.rotation.z = a; cr.position.set(Math.cos(a) * R * 0.46, 0.7, Math.sin(a) * R * 0.46); g.add(cr); cracks.push(cr); }
      const flames = [];
      for (let i = 0; i < 4; i++) { const a = (i / 4) * 6.283 + 0.6; const fl = addCol(GLOW, 0.5, R * 0.06, R * 0.13, R * 0.55); fl.position.set(Math.cos(a) * R * 0.5, R * 0.27, Math.sin(a) * R * 0.5); g.add(fl); flames.push(fl); }
      let t = 0, em = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          for (const cr of cracks) cr.material.opacity = 0.55 + 0.3 * Math.sin(t * 6 + cr.rotation.z);
          for (let i = 0; i < flames.length; i++) { flames[i].scale.y = 0.7 + 0.4 * Math.abs(Math.sin(t * 8 + i)); flames[i].material.opacity = 0.4 + 0.2 * Math.sin(t * 10 + i); }
          em -= dt;
          if (em <= 0) { em = 0.04; const a = Math.random() * 6.283, rr = Math.random() * R * 0.9; ctx.particles.spawn({ x: g.position.x + Math.cos(a) * rr, y: 2, z: g.position.z + Math.sin(a) * rr, vx: (Math.random() - 0.5) * 20, vy: 90 + Math.random() * 130, vz: (Math.random() - 0.5) * 20, gravity: -30, drag: 1.3, life: 0.45 + Math.random() * 0.3, size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? LAVA : SPARK, fade: true }); }
        },
      };
    },
  });

  // 熔岩噴發：地表噴出雙層熔岩火柱（多處散落）+ 擴張環 + 餘燼噴泉
  registerVfx('boss_juggernaut_ult', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: SPARK, from: 8, to: 70, life: 0.3, alpha: 0.85 });
      burst(ctx, c, { color: [LAVA, EMBER], count: 30, speed: 250, up: 80, life: 0.65, size: 5 });
      ctx.sceneMgr.addShake(16); ctx.sceneMgr.addFlash(0.24, LAVA);
    },
    zone(ctx, z) {
      const R = z.radius || 120;
      const g = new THREE.Group();
      // 持續熔岩池（地表發光圓盤）：整個傷害期間都看得到、臨近結束才淡出
      //   → 修正「特效已消失但站上去仍會受傷（看起來是正常地板）」。
      const poolMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LAVA), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const pool = new THREE.Mesh(new THREE.CircleGeometry(R, 32), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = 1; g.add(pool);
      const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(EMBER), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const poolCore = new THREE.Mesh(new THREE.CircleGeometry(R * 0.62, 28), coreMat); poolCore.rotation.x = -Math.PI / 2; poolCore.position.y = 1.3; g.add(poolCore);
      const ringMesh = addRing(LAVA); ringMesh.scale.setScalar(R * 0.8); ringMesh.position.y = 1.6; g.add(ringMesh);
      const wave = addRing(SPARK, 0.65); wave.position.y = 1.8; g.add(wave);
      const col = addCol(GLOW, 0, R * 0.45, R * 0.7, R * 1.7); col.position.y = R * 0.85; g.add(col);
      const colCore = addCol('#ffffff', 0, R * 0.2, R * 0.34, R * 1.7); colCore.position.y = R * 0.85; g.add(colCore);
      let t = 0, em = 0, erupted = false;
      return {
        object3D: g,
        update(dt, zone) {
          t += dt;
          const life = zone ? zone.lifetime : 4;          // 剩餘傷害時間（活體 zone）
          // 噴發柱（前 ~1.1s 的爆發感）
          const e = Math.min(1, t / 0.28); const fade = 1 - Math.max(0, (t - 0.4) / 0.7);
          col.material.opacity = Math.max(0, 0.7 * e * fade); col.scale.y = 0.4 + e;
          colCore.material.opacity = Math.max(0, 0.85 * e * fade); colCore.scale.y = 0.4 + e;
          ringMesh.material.opacity = Math.max(0, 0.8 * (1 - t));
          wave.scale.setScalar(R * (0.6 + t * 1.6)); wave.material.opacity = Math.max(0, 0.65 * (1 - t * 1.2));
          if (!erupted && t > 0.02) { erupted = true; column(ctx, { x: g.position.x, y: 0, z: g.position.z }, { color: [LAVA, SPARK], count: 30, radius: R * 0.5, speed: 320, life: 0.85, size: 5.5 }); }
          // 持續熔岩池：傷害整段恆亮（脈動），剩餘時間 < 0.8s 才淡出 → 視覺與傷害一致。
          const endFade = Math.max(0, Math.min(1, life / 0.8));
          const fadeIn = Math.min(1, t / 0.2);
          poolMat.opacity = 0.46 * endFade * fadeIn * (0.78 + 0.22 * Math.sin(t * 7));
          coreMat.opacity = 0.3 * endFade * fadeIn * (0.8 + 0.2 * Math.sin(t * 11));
          em -= dt;
          if (em <= 0 && endFade > 0.15) { em = 0.05; const a = Math.random() * 6.283, rr = Math.random() * R * 0.6; ctx.particles.spawn({ x: g.position.x + Math.cos(a) * rr, y: 2, z: g.position.z + Math.sin(a) * rr, vx: (Math.random() - 0.5) * 30, vy: 130 + Math.random() * 150, vz: (Math.random() - 0.5) * 30, gravity: 60, drag: 1, life: 0.6, size: 4.5, color: Math.random() < 0.5 ? LAVA : EMBER, fade: true }); }
        },
      };
    },
  });

  // 死亡演出：重甲熔解崩塌 — 核心白熱炸開、焦土放射熔岩裂縫、數道熔岩噴發柱、餘燼雨與黑煙升騰
  registerVfx('boss_juggernaut_death', {
    onDeath(ctx, f, c) {
      const { THREE: T, addTransient, sceneMgr, particles } = ctx;
      sceneMgr.addShake(26); sceneMgr.addFlash(0.46, LAVA);
      sphereFlash(ctx, c, { color: SPARK, from: 12, to: 120, life: 0.4, alpha: 0.95 });
      sphereFlash(ctx, c, { color: LAVA, from: 8, to: 80, life: 0.32, alpha: 0.7 });
      ring(ctx, c, { color: LAVA, from: 16, to: 330, life: 0.7, y: 3, alpha: 0.9, ease: true });
      ring(ctx, c, { color: SPARK, from: 12, to: 240, life: 0.55, y: 4, alpha: 0.75 });
      ring(ctx, c, { color: EMBER, from: 10, to: 180, life: 0.8, y: 2, alpha: 0.6, ease: true });
      // 焦黑坑 + 放射熔岩裂縫
      const g = new T.Group(); g.position.set(c.x, 0, c.z);
      const scorch = new T.Mesh(new T.CircleGeometry(150, 32), new T.MeshBasicMaterial({ color: new T.Color(ASH), transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false }));
      scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.6; g.add(scorch);
      const cracks = [];
      for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283; const cr = new T.Mesh(new T.PlaneGeometry(150, 12), new T.MeshBasicMaterial({ color: new T.Color(LAVA), transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); cr.rotation.x = -Math.PI / 2; cr.rotation.z = a; cr.position.set(Math.cos(a) * 75, 0.8, Math.sin(a) * 75); g.add(cr); cracks.push(cr); }
      addTransient(g, 1.4, (gg, t) => { scorch.material.opacity = 0.7 * (1 - Math.max(0, (t - 0.5) / 0.5)); for (const cr of cracks) cr.material.opacity = Math.max(0, 0.9 * (1 - t) * (0.6 + 0.4 * Math.sin(t * 20 + cr.rotation.z))); });
      // 數道熔岩噴發柱
      for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + 0.4, rr = 50; const col = addCol(GLOW, 0, 18, 30, 220); col.position.set(c.x + Math.cos(a) * rr, 110, c.z + Math.sin(a) * rr); addTransient(col, 0.9, (m, t) => { const e = Math.min(1, t / 0.16); const fade = 1 - Math.max(0, (t - 0.4) / 0.5); m.material.opacity = Math.max(0, 0.6 * e * fade); m.scale.y = 0.4 + e; }); }
      column(ctx, c, { color: [LAVA, SPARK], count: 34, radius: 80, speed: 340, life: 1.0, size: 6.5 });
      burst(ctx, c, { color: [LAVA, EMBER, SPARK], count: 46, speed: 340, up: 110, flat: true, life: 0.9, size: 6 });
      // 餘燼雨 + 黑煙升騰
      for (let i = 0; i < 40; i++) { const a = Math.random() * 6.283, rr = Math.random() * 160; particles.spawn({ x: c.x + Math.cos(a) * rr, y: 140 + Math.random() * 80, z: c.z + Math.sin(a) * rr, vx: 0, vy: -40 - Math.random() * 50, vz: 0, gravity: 40, drag: 1.2, life: 1.1, size: 3 + Math.random() * 3, color: Math.random() < 0.5 ? LAVA : SPARK, fade: true }); }
      for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283, rr = Math.random() * 100; particles.spawn({ x: c.x + Math.cos(a) * rr, y: 10, z: c.z + Math.sin(a) * rr, vx: (Math.random() - 0.5) * 20, vy: 60 + Math.random() * 90, vz: (Math.random() - 0.5) * 20, gravity: -12, drag: 0.9, life: 1.3 + Math.random() * 0.6, size: 6 + Math.random() * 5, color: ASH, fade: true }); }
    },
  });
}
