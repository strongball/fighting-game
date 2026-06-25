// @ts-nocheck
// R5 潮汐歌姬 技能特效。
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { burst, ring, sphereFlash, column, pillar } from '../../render3d/vfx/lib.js';

const WATER = '#0a9396';
const FOAM = '#94d2bd';
const AQUA = '#00ffff';
const DEEP = '#005f73';

export function loadVfx() {
  // 1. 普攻：水花彈射發射與擊中
  registerVfx('boss_siren_bolt', {
    onCast(ctx, f, c) {
      burst(ctx, c, { color: [WATER, FOAM], count: 6, speed: 100, life: 0.25, size: 2.2 });
    },
    onHit(ctx, f, c) {
      sphereFlash(ctx, c, { color: AQUA, from: 1, to: 18, life: 0.15 });
      burst(ctx, c, { color: [WATER, AQUA, FOAM], count: 10, speed: 130, life: 0.35, size: 3.5 });
    }
  });

  // 2. 招式 1：波濤巨浪 (Surging Wave)
  registerVfx('boss_siren_wave', {
    onCast(ctx, f, c) {
      ring(ctx, c, { color: WATER, from: 10, to: 130, life: 0.4, y: 1.2, alpha: 0.8 });
      burst(ctx, c, { color: [WATER, AQUA], count: 20, speed: 200, life: 0.5, size: 4.5 });
      ctx.sceneMgr.addShake(6);
    },
    zone(ctx, z) {
      const R = z.radius || 150;
      const g = new THREE.Group();

      // 水藍色底座
      const waterBase = new THREE.Mesh(
        new THREE.CircleGeometry(R, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(DEEP), transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
      );
      waterBase.rotation.x = -Math.PI / 2;
      waterBase.position.y = 0.4;
      g.add(waterBase);

      // 外圈水環
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(R * 0.85, R, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(AQUA), transparent: true, opacity: 0.65, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.5;
      g.add(ringMesh);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          ringMesh.rotation.z += dt * 1.8;
          
          if (Math.random() < 0.18) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * R * 0.85;
            ctx.particles.spawn({
              x: g.position.x + Math.cos(angle) * dist,
              y: 1.0,
              z: g.position.z + Math.sin(angle) * dist,
              vx: 0,
              vy: 30 + Math.random() * 30,
              vz: 0,
              gravity: -8,
              drag: 0.6,
              life: 0.4 + Math.random() * 0.4,
              size: 2.5 + Math.random() * 2.5,
              color: Math.random() < 0.5 ? AQUA : FOAM,
              fade: true
            });
          }
        }
      };
    }
  });

  // 3. 招式 2：水泡禁錮
  registerVfx('boss_siren_bubble', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: AQUA, from: 4, to: 48, life: 0.3, alpha: 0.8 });
      burst(ctx, c, { color: [WATER, FOAM], count: 12, speed: 120, life: 0.4, size: 3.0 });
    }
  });

  // 4. 大招：深海交響曲 (Erupting Water Spouts)
  registerVfx('boss_siren_ult', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: AQUA, from: 8, to: 80, life: 0.35, alpha: 0.9 });
      burst(ctx, c, { color: [WATER, AQUA, FOAM], count: 30, speed: 250, up: 60, life: 0.65, size: 5.0 });
      ctx.sceneMgr.addShake(12);
      ctx.sceneMgr.addFlash(0.2, AQUA);
    },
    zone(ctx, z) {
      const R = z.radius || 120;
      const g = new THREE.Group();

      const base = new THREE.Mesh(
        new THREE.RingGeometry(R * 0.8, R, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(AQUA), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.5;
      g.add(base);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          base.scale.setScalar(1 + Math.sin(t * 8) * 0.05);

          // Erupt water pillar visual
          if (t >= 0.8 && !g.userData.erupted) {
            g.userData.erupted = true;
            pillar(ctx, g.position, { r: R * 0.6, h: 220, color: WATER, life: 0.6, alpha: 0.75, grow: 0.3 });
            column(ctx, g.position, { radius: R * 0.5, speed: 180, count: 25, life: 0.75, color: AQUA });
          }
        }
      };
    }
  });

  // 5. 安全氣泡區域 (Safe Air Bubble)
  registerVfx('boss_siren_safe_bubble', {
    zone(ctx, z) {
      const R = z.radius || 90;
      const g = new THREE.Group();

      // 半透明氣泡罩
      const bubbleGeo = new THREE.SphereGeometry(R, 16, 12);
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(AQUA),
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      const bubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      bubbleMesh.position.y = 10;
      g.add(bubbleMesh);

      // 地面光圈
      const ringGeo = new THREE.RingGeometry(R * 0.9, R, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(FOAM),
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.6;
      g.add(ringMesh);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          ringMesh.rotation.z += dt * 0.8;
          
          // 氣泡微弱跳動
          const osc = 1 + Math.sin(t * 3.5) * 0.04;
          bubbleMesh.scale.set(osc, osc * 0.6, osc);

          if (Math.random() < 0.1) {
            ctx.particles.spawn({
              x: g.position.x + (Math.random() - 0.5) * R * 1.2,
              y: 2 + Math.random() * R * 0.4,
              z: g.position.z + (Math.random() - 0.5) * R * 1.2,
              vx: 0,
              vy: 8 + Math.random() * 8,
              vz: 0,
              gravity: -2,
              drag: 0.3,
              life: 0.6 + Math.random() * 0.5,
              size: 2.0 + Math.random() * 2.0,
              color: FOAM,
              fade: true
            });
          }
        }
      };
    }
  });

  // 7. 禁錮水泡地表預警圈 (Warning Bubble indicator)
  registerVfx('boss_siren_warning_bubble', {
    zone(ctx, z) {
      const R = z.radius || 40;
      const g = new THREE.Group();

      // 地面旋轉警告光圈
      const ringGeo = new THREE.RingGeometry(R * 0.85, R, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ff3366'),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.7;
      g.add(ringMesh);

      // 半透明紅光底盤
      const discMesh = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.85, 24),
        new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
      );
      discMesh.rotation.x = -Math.PI / 2;
      discMesh.position.y = 0.6;
      g.add(discMesh);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          ringMesh.rotation.z -= dt * 1.5;
          const osc = 1.0 + Math.sin(t * 5.0) * 0.08;
          ringMesh.scale.setScalar(osc);
        }
      };
    }
  });

  // 6. 死亡特效：海嘯大爆炸
  registerVfx('boss_siren_death', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: AQUA, from: 10, to: 140, life: 0.6, alpha: 0.95 });
      burst(ctx, c, { color: [WATER, AQUA, FOAM], count: 48, speed: 280, up: 70, life: 0.9, size: 6.5 });
      ctx.sceneMgr.addShake(22);
    }
  });
}
