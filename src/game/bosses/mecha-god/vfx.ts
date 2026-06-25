// @ts-nocheck
// R7 機械真神 技能與場域特效定義
import * as THREE from 'three';
import { registerVfx } from '../../render3d/vfx/registry.js';
import { burst, ring, sphereFlash, column, pillar } from '../../render3d/vfx/lib.js';

const ORANGE = '#ff5500';
const BRIGHT_ORANGE = '#ffaa00';
const CYAN = '#00f0ff';
const DARK_METAL = '#2c3e50';

export function loadVfx() {
  // 1. 普攻：火箭拳擊與爆發
  registerVfx('boss_mecha_punch', {
    onCast(ctx, f, c) {
      burst(ctx, c, { color: [ORANGE, BRIGHT_ORANGE], count: 8, speed: 120, life: 0.25, size: 2.5 });
    },
    onHit(ctx, f, c) {
      sphereFlash(ctx, c, { color: ORANGE, from: 1, to: 16, life: 0.12 });
      burst(ctx, c, { color: [ORANGE, DARK_METAL, BRIGHT_ORANGE], count: 12, speed: 150, life: 0.35, size: 3.5 });
    }
  });

  // 2. 技能 1：電磁軌道砲 (Charge Beam)
  registerVfx('boss_mecha_beam', {
    onCast(ctx, f, c) {
      ring(ctx, c, { color: ORANGE, from: 8, to: 140, life: 0.45, y: 1.5, alpha: 0.85 });
      burst(ctx, c, { color: [ORANGE, CYAN], count: 24, speed: 220, life: 0.5, size: 5.0 });
      ctx.sceneMgr.addShake(8);
    },
    zone(ctx, z) {
      const R = z.radius || 120;
      const g = new THREE.Group();

      // 線性警告條
      const lineMesh = new THREE.Mesh(
        new THREE.BoxGeometry(R * 2, 0.8, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(ORANGE), transparent: true, opacity: 0.4, depthWrite: false })
      );
      lineMesh.position.y = 0.5;
      g.add(lineMesh);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          lineMesh.scale.z = 1 + Math.sin(t * 12) * 0.15;
          if (Math.random() < 0.2) {
            ctx.particles.spawn({
              x: g.position.x + (Math.random() - 0.5) * R,
              y: 1.0,
              z: g.position.z + (Math.random() - 0.5) * 8,
              vx: 0, vy: 25, vz: 0,
              gravity: -6, drag: 0.5,
              life: 0.3 + Math.random() * 0.3,
              size: 2.0, color: BRIGHT_ORANGE, fade: true
            });
          }
        }
      };
    }
  });

  // 3. 能量共振柱地表預警/連結圈
  registerVfx('boss_mecha_pylon_warning', {
    zone(ctx, z) {
      const R = z.radius || 35;
      const g = new THREE.Group();

      // 金黃色地面共振圈
      const ringGeo = new THREE.RingGeometry(R * 0.85, R, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#ffaa00'),
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.6;
      g.add(ringMesh);

      // 橘紅光底盤
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(R * 0.85, 24),
        new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.5;
      g.add(disc);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          ringMesh.rotation.z += dt * 1.2;
          const osc = 1.0 + Math.sin(t * 6.0) * 0.08;
          ringMesh.scale.setScalar(osc);
        }
      };
    }
  });

  // 4. 大招：終極歐米伽雷射 (Omega Laser)
  registerVfx('boss_mecha_ult', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: ORANGE, from: 10, to: 90, life: 0.4, alpha: 0.9 });
      burst(ctx, c, { color: [ORANGE, CYAN, BRIGHT_ORANGE], count: 32, speed: 240, up: 55, life: 0.7, size: 5.5 });
      ctx.sceneMgr.addShake(14);
      ctx.sceneMgr.addFlash(0.25, ORANGE);
    },
    zone(ctx, z) {
      const R = z.radius || 240;
      const g = new THREE.Group();

      const base = new THREE.Mesh(
        new THREE.RingGeometry(R * 0.9, R, 32),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(ORANGE), transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.5;
      g.add(base);

      let t = 0;
      return {
        object3D: g,
        update(dt) {
          t += dt;
          base.scale.setScalar(1 + Math.sin(t * 6) * 0.03);

          if (t >= 0.7 && !g.userData.erupted) {
            g.userData.erupted = true;
            pillar(ctx, g.position, { r: R * 0.75, h: 260, color: ORANGE, life: 0.7, alpha: 0.8, grow: 0.4 });
            column(ctx, g.position, { radius: R * 0.6, speed: 200, count: 30, life: 0.8, color: CYAN });
          }
        }
      };
    }
  });

  // 5. 死亡特效：金屬熔解與核心大爆炸
  registerVfx('boss_mecha_death', {
    onCast(ctx, f, c) {
      sphereFlash(ctx, c, { color: ORANGE, from: 12, to: 160, life: 0.7, alpha: 0.95 });
      burst(ctx, c, { color: [ORANGE, CYAN, DARK_METAL], count: 64, speed: 300, up: 80, life: 1.0, size: 7.0 });
      ctx.sceneMgr.addShake(25);
    }
  });
}
