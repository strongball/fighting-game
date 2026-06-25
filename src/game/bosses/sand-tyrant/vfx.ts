// @ts-nocheck
// R3 風沙法皇 技能特效。主題：黃沙金塵／流沙漩渦／風暴強風。
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { slashBlade, cone, burst, ring, column, sphereFlash } from '../../render3d/vfx/lib.js';

const SAND = '#dfc48c', GOLD = '#ffd700', DUST = '#a68d60', PURPLE = '#c050ff';

export function loadVfx() {
  // 普攻：沙塵彈發射與擊中
  registerVfx('boss_sand_bolt', {
    onCast(ctx, f, c) {
      burst(ctx, c, { color: [SAND, DUST], count: 8, speed: 120, life: 0.35, size: 3 });
    },
    onHit(ctx, f, c) {
      sphereFlash(ctx, c, { color: GOLD, from: 2, to: 28, life: 0.2 });
      burst(ctx, c, { color: [SAND, GOLD], count: 12, speed: 160, life: 0.4, size: 3.5 });
    }
  });

  // 技能一：流沙漩渦 (Quicksand Pool)
  registerVfx('boss_sand_pool', {
    zone(ctx, z) {
      const R = z.radius || 150;
      const g = new THREE.Group();
      
      // 地面流沙底面
      const sandBase = new THREE.Mesh(
        new THREE.CircleGeometry(R, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(DUST), transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false })
      );
      sandBase.rotation.x = -Math.PI / 2;
      sandBase.position.y = 0.4;
      g.add(sandBase);

      // 旋轉流沙花紋環
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(R * 0.8, R * 0.95, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(SAND), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.6;
      g.add(ringMesh);

      let t = 0, em = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          ringMesh.rotation.z -= dt * 1.6; // 旋動
          em -= dt;
          if (em <= 0) {
            em = 0.05;
            const a = Math.random() * 6.283;
            const rr = Math.random() * R * 0.82;
            ctx.particles.spawn({
              x: g.position.x + Math.cos(a) * rr,
              y: 1.2,
              z: g.position.z + Math.sin(a) * rr,
              vx: -Math.sin(a) * 45, // 漩渦切向速度
              vy: 6 + Math.random() * 12,
              vz: Math.cos(a) * 45,
              gravity: 1,
              drag: 1.1,
              life: 0.6 + Math.random() * 0.4,
              size: 2.2 + Math.random() * 2.5,
              color: Math.random() < 0.35 ? GOLD : SAND,
              fade: true
            });
          }
        }
      };
    }
  });

  // 技能二：沙塵瞬移爆炸 (Sand Blink Explosion)
  registerVfx('boss_sand_explode', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: GOLD, from: 4, to: 52, life: 0.28, alpha: 0.8 });
      ring(ctx, c, { color: SAND, from: 10, to: 160, life: 0.4, y: 1.2, alpha: 0.85 });
      burst(ctx, c, { color: [SAND, GOLD, DUST], count: 24, speed: 220, life: 0.55, size: 4.5 });
      ctx.sceneMgr.addShake(8);
    }
  });

  // 大招：黃沙送葬沙塵暴區域
  registerVfx('boss_sand_ult', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: GOLD, from: 8, to: 82, life: 0.34, alpha: 0.95 });
      burst(ctx, c, { color: [SAND, GOLD], count: 32, speed: 280, up: 50, life: 0.7, size: 5.5 });
      ctx.sceneMgr.addShake(18); ctx.sceneMgr.addFlash(0.24, GOLD);
    },
    zone(ctx, z) {
      const R = z.radius || 280;
      const g = new THREE.Group();

      // 大沙暴擴展外環
      const wave = new THREE.Mesh(
        new THREE.RingGeometry(R * 0.92, R * 1.0, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      wave.rotation.x = -Math.PI / 2;
      wave.position.y = 1.0;
      g.add(wave);

      let t = 0, em = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          wave.scale.setScalar(0.2 + 0.8 * Math.min(1, t / 0.4));
          wave.material.opacity = Math.max(0, 0.75 * (1 - t * 0.6));
          em -= dt;
          if (em <= 0) {
            em = 0.03; // 極密沙塵粒子
            const a = Math.random() * 6.283;
            const rr = Math.random() * R * 0.95;
            ctx.particles.spawn({
              x: g.position.x + Math.cos(a) * rr,
              y: 2,
              z: g.position.z + Math.sin(a) * rr,
              vx: -Math.sin(a) * 90 + (Math.random() - 0.5) * 20, // 狂暴旋轉
              vy: 12 + Math.random() * 26,
              vz: Math.cos(a) * 90 + (Math.random() - 0.5) * 20,
              gravity: -2,
              drag: 1.05,
              life: 0.5 + Math.random() * 0.5,
              size: 3 + Math.random() * 4,
              color: Math.random() < 0.4 ? GOLD : SAND,
              fade: true
            });
          }
        }
      };
    }
  });

  // 死亡演出：法袍沙化崩塌與紫光散逸
  registerVfx('boss_sand_death', {
    onDeath(ctx, f, c) {
      const { THREE: T, addTransient, sceneMgr, particles } = ctx;
      sceneMgr.addShake(28); sceneMgr.addFlash(0.42, GOLD);
      sphereFlash(ctx, c, { color: GOLD, from: 10, to: 100, life: 0.38, alpha: 0.9 });
      sphereFlash(ctx, c, { color: PURPLE, from: 6, to: 70, life: 0.3, alpha: 0.8 });
      ring(ctx, c, { color: GOLD, from: 16, to: 280, life: 0.65, y: 1.5, alpha: 0.85, ease: true });

      // 黃沙崩裂與黑夜升騰粒子
      for (let i = 0; i < 48; i++) {
        const a = Math.random() * 6.283, rr = Math.random() * 80;
        particles.spawn({
          x: c.x + Math.cos(a) * rr,
          y: 10 + Math.random() * 60,
          z: c.z + Math.sin(a) * rr,
          vx: (Math.random() - 0.5) * 80,
          vy: 40 + Math.random() * 80,
          vz: (Math.random() - 0.5) * 80,
          gravity: 40,
          drag: 1.1,
          life: 0.8 + Math.random() * 0.5,
          size: 4 + Math.random() * 5,
          color: Math.random() < 0.7 ? SAND : GOLD,
          fade: true
        });
      }

      // 核心紫光炸裂上升
      for (let i = 0; i < 20; i++) {
        particles.spawn({
          x: c.x + (Math.random() - 0.5) * 20,
          y: 20,
          z: c.z + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 30,
          vy: 90 + Math.random() * 100,
          vz: (Math.random() - 0.5) * 30,
          gravity: -30,
          drag: 1.15,
          life: 1.2,
          size: 3 + Math.random() * 3,
          color: PURPLE,
          fade: true
        });
      }
    }
  });
}
