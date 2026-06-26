// @ts-nocheck
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { slashBlade, cone, burst, ring, sphereFlash } from '../../render3d/vfx/lib.js';

const SHADOW = '#1a0033', PURPLE = '#aa33ff', GLOW = '#d8b3ff';

const shadowShardMat = () => new THREE.MeshStandardMaterial({
  color: new THREE.Color(SHADOW),
  emissive: new THREE.Color(PURPLE),
  emissiveIntensity: 1.0,
  metalness: 0.2,
  roughness: 0.6,
  transparent: true,
  opacity: 0.8
});

const addRing = (color, op = 0.6) => new THREE.Mesh(
  new THREE.RingGeometry(0.85, 1, 32),
  new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: op,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
);

export function loadVfx() {
  // 1. 寒光疾刺: 雙層暗紫快斬 + 影塵
  registerVfx('boss_shadow_slash', {
    onCast(ctx, f, c) {
      slashBlade(ctx, c, f.facing, { color: [PURPLE, SHADOW], len: (f.range || 70) * 1.3, swing: 1.2, life: 0.22, y: 14, sparkCount: 10, alpha: 0.95 });
      slashBlade(ctx, c, f.facing, { color: [GLOW, '#ffffff'], len: (f.range || 70) * 0.9, swing: 1.0, life: 0.16, y: 16, sparkCount: 5, alpha: 0.8 });
      cone(ctx, c, f.facing, { color: [PURPLE, SHADOW, GLOW], count: 12, speed: 240, spread: 0.5, up: 18, life: 0.4, size: 3.0 });
    },
  });

  // 2. 隱影突襲 (stealth): 進入隱形時的黑紫煙霧
  registerVfx('boss_shadow_stealth', {
    onCast(ctx, f, c) {
      const { THREE: T, addTransient } = ctx;
      sphereFlash(ctx, c, { color: PURPLE, from: 4, to: 45, life: 0.3, alpha: 0.8 });
      ring(ctx, c, { color: SHADOW, from: 6, to: 60, life: 0.4, y: 2, alpha: 0.7, ease: true });
      burst(ctx, c, { color: [SHADOW, PURPLE], count: 15, speed: 150, up: 30, life: 0.5, size: 4.0 });

      // 飄散的暗影粒子
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        const sh = new T.Mesh(new T.TetrahedronGeometry(4), shadowShardMat());
        sh.position.set(c.x, c.y, c.z);
        addTransient(sh, 0.6, (m, t) => {
          m.position.set(c.x + Math.cos(a) * 40 * t, c.y + 20 * t, c.z + Math.sin(a) * 40 * t);
          m.rotation.y += 0.25;
          m.material.opacity = 0.8 * (1 - t);
        });
      }
    },
  });

  // 3. 影鏡互換 (swap): 兩點互換的黑紫閃光
  registerVfx('boss_shadow_swap', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: GLOW, from: 4, to: 50, life: 0.25, alpha: 0.95 });
      ring(ctx, c, { color: PURPLE, from: 8, to: 80, life: 0.35, y: 2, alpha: 0.8, ease: true });
      burst(ctx, c, { color: [SHADOW, PURPLE, GLOW], count: 18, speed: 200, up: 40, life: 0.45, size: 3.5 });
    },
  });

  // 4. 分身死亡自爆 (explosion): 大範圍黑紫爆炸與灰霧
  registerVfx('boss_shadow_explosion', {
    onCast(ctx, f, c) {
      const { THREE: T, addTransient, sceneMgr } = ctx;
      sceneMgr.addShake(12);
      sphereFlash(ctx, c, { color: PURPLE, from: 10, to: 150, life: 0.4, alpha: 0.9 });
      ring(ctx, c, { color: SHADOW, from: 20, to: 180, life: 0.5, y: 4, alpha: 0.8, ease: true });
      burst(ctx, c, { color: [SHADOW, PURPLE, GLOW], count: 24, speed: 250, up: 60, life: 0.6, size: 4.5 });

      // 飛散的暗影碎片
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const shard = new T.Mesh(new T.OctahedronGeometry(6), shadowShardMat());
        shard.position.set(c.x, c.y + 10, c.z);
        addTransient(shard, 0.7, (m, t) => {
          m.position.set(c.x + Math.cos(a) * 120 * t, c.y + 10 + 30 * Math.sin(t * Math.PI), c.z + Math.sin(a) * 120 * t);
          m.rotation.x += 0.3;
          m.material.opacity = 0.8 * (1 - t);
        });
      }
    },
  });

  // 5. 萬影千殺陣 (ultimate): 軌跡打擊與最終重擊落下
  
  // 暗影降臨預警: Boss/分身 reappear 時的暗影聚集效果
  registerVfx('boss_shadow_ult_warning', {
    onCast(ctx, f, c) {
      const { sceneMgr } = ctx;
      sphereFlash(ctx, c, { color: SHADOW, from: 6, to: 140, life: 0.35, alpha: 0.6 });
      ring(ctx, c, { color: PURPLE, from: 10, to: 190, life: 0.45, y: 2, alpha: 0.5, ease: true });
    },
  });
  
  // 十字軌跡打擊
  registerVfx('boss_shadow_ult_strike', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: PURPLE, from: 2, to: 70, life: 0.2, alpha: 0.85 });
      ring(ctx, c, { color: SHADOW, from: 10, to: 75, life: 0.3, y: 2, alpha: 0.7, ease: true });
    },
  });

  // 最終重擊落地震波
  registerVfx('boss_shadow_ult_slam', {
    onCast(ctx, f, c) {
      const { sceneMgr } = ctx;
      sceneMgr.addShake(22);
      sceneMgr.addFlash(0.35, PURPLE);
      sphereFlash(ctx, c, { color: GLOW, from: 10, to: 200, life: 0.45, alpha: 0.95 });
      ring(ctx, c, { color: PURPLE, from: 20, to: 240, life: 0.55, y: 3, alpha: 0.85, ease: true });
      ring(ctx, c, { color: SHADOW, from: 15, to: 180, life: 0.45, y: 2, alpha: 0.65 });
      burst(ctx, c, { color: [SHADOW, PURPLE, GLOW], count: 35, speed: 280, up: 70, life: 0.65, size: 5.0 });
    },
  });

  // 6. 暗影飛鏢投射物 3D
  registerVfx('boss_shadow_shuriken', {
    projectile(vfxCtx, pr) {
      const THREE = vfxCtx.THREE;
      const g = new THREE.Group();
      
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(SHADOW),
        emissive: new THREE.Color(PURPLE),
        emissiveIntensity: 1.8,
        roughness: 0.2,
        metalness: 0.8
      });
      
      const r = pr.radius || 12;
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(r * 2.8, 2, r * 0.8), mat);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(r * 0.8, 2, r * 2.8), mat);
      g.add(b1);
      g.add(b2);
      
      const center = new THREE.Mesh(new THREE.SphereGeometry(r * 0.6, 8, 8), new THREE.MeshBasicMaterial({ color: GLOW }));
      center.position.y = 1.2;
      g.add(center);
      
      return {
        object3D: g,
        update(dt) {
          g.rotation.y += dt * 18;
          vfxCtx.particles.spawn({
            x: g.position.x, y: g.position.y, z: g.position.z,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, vz: (Math.random() - 0.5) * 8,
            life: 0.2, size: r * 0.5, color: PURPLE, drag: 2, fade: true
          });
        }
      };
    }
  });
}
