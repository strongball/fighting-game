// 坦克：巨大、鈍重、控場。重拳衝擊 / 六角護盾罩 / 震地裂石。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, sphereFlash, burst, cone, addShake, addFlash, ultimateBurst } from './lib.js';

// 大絕招 — 大地崩裂：裂地神怒與岩脊狂瀾
registerVfx('tank_ultimate', {
  onCast(ctx, f, c) {
    const R = f.radius || 160;
    // 施法起手：大地震波與塵土飛揚
    ctx.sceneMgr.addShake(28);
    ctx.sceneMgr.addFlash(0.35, '#cfd8dc');
    ring(ctx, c, { color: '#a0744a', from: 18, to: R * 1.3, life: 0.6, y: 2, alpha: 0.9, ease: true });
    
    // 釋放衝擊波圓盤
    ring(ctx, c, { color: '#cfd8dc', from: 8, to: R * 0.7, life: 0.45, y: 4, alpha: 0.75 });
    
    for (let i = 0; i < 48; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.8;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * rr, y: 4, z: c.z + Math.sin(a) * rr,
        vx: (Math.random() - 0.5) * 110, vy: 180 + Math.random() * 240, vz: (Math.random() - 0.5) * 110,
        gravity: 480, drag: 1.1, life: 0.6 + Math.random() * 0.5,
        size: 5 + Math.random() * 5.5, color: Math.random() < 0.55 ? '#7f8c8d' : '#5a3a1f', fade: false
      });
    }
  },
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    let timeAcc = 0;
    
    return {
      object3D: g,
      update(dt, zz) {
        timeAcc += dt;
        const rate = 0.075;
        while (timeAcc >= rate) {
          timeAcc -= rate;
          
          // 在移動路徑兩側交錯突起巨岩
          const offsetDist = (Math.random() - 0.5) * 60;
          const aDir = -Math.atan2(zz.vy || 1, zz.vx || 0) + Math.PI / 2;
          const rockX = g.position.x + Math.cos(aDir) * offsetDist;
          const rockZ = g.position.z + Math.sin(aDir) * offsetDist;
          
          // 若出界則不產生該岩石，防止岩石擠在牆壁邊緣排成一排
          if (rockX < -590 || rockX > 590 || rockZ < -390 || rockZ > 390) {
            continue;
          }
          
          const rockH = 13 + Math.random() * 15;
          const rockGeo = new THREE.BoxGeometry(6.5 + Math.random() * 4, rockH, 6.5 + Math.random() * 4);
          const rockMat = new THREE.MeshStandardMaterial({
            color: Math.random() < 0.5 ? 0x7f8c8d : 0x5a3a1f,
            emissive: 0xff3b00,
            emissiveIntensity: 0.9,
            roughness: 0.95
          });
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.set(rockX, -rockH * 0.5, rockZ);
          
          rock.rotation.set(
            (Math.random() - 0.5) * 0.32,
            Math.random() * Math.PI,
            (Math.random() - 0.5) * 0.32
          );
          
          ctx.addTransient(rock, 0.92, (mesh, t) => {
            if (t < 0.22) {
              mesh.position.y = -rockH * 0.5 + (rockH * 0.92) * (t / 0.22);
            } else {
              mesh.position.y = rockH * 0.42 - (t - 0.22) * 11;
              mesh.material.opacity = Math.max(0, (1 - t) * 1.15);
              mesh.material.transparent = true;
            }
          });
          
          rock.userData.geo = rockGeo;
          rock.userData.mat = rockMat;
          
          // 地裂沙石與岩漿火星粒子
          for (let i = 0; i < 6; i++) {
            const spd = 70 + Math.random() * 110;
            const pAngle = Math.random() * Math.PI * 2;
            ctx.particles.spawn({
              x: rockX, y: 4, z: rockZ,
              vx: Math.cos(pAngle) * spd, vy: 120 + Math.random() * 150, vz: Math.sin(pAngle) * spd,
              gravity: 420, drag: 1.25, life: 0.45 + Math.random() * 0.45,
              size: 4 + Math.random() * 4.5, color: Math.random() < 0.5 ? '#7f8c8d' : '#ff7043', fade: true
            });
          }
        }
      }
    };
  }
});

registerVfx('tank_punch', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    ring(ctx, c, { color: '#cfd8dc', from: 8, to: f.range * 1.2, life: 0.3, y: 4, alpha: 0.9 });
    cone(ctx, c, f.facing, { color: ['#aab7b8', '#7f8c8d'], count: 14, speed: 220, spread: 0.5, offset: f.range * 0.4, up: 50, gravity: 260, life: 0.45, size: 4 });
    
    const fistGeo = new THREE.IcosahedronGeometry(f.range * 0.48, 1);
    const fistMat = new THREE.MeshStandardMaterial({
      color: 0x5a3a1f,
      emissive: 0x3d2714,
      emissiveIntensity: 0.5,
      roughness: 0.95
    });
    const fist = new THREE.Mesh(fistGeo, fistMat);
    fist.position.set(c.x, 14, c.z);
    
    const dx = Math.cos(f.facing);
    const dz = Math.sin(f.facing);
    
    ctx.addTransient(fist, 0.32, (mesh, t) => {
      const dist = f.range * 0.7 * Math.sin(t * Math.PI * 0.5);
      mesh.position.set(c.x + dx * dist, 14, c.z + dz * dist);
      mesh.rotation.y = -f.facing;
      mesh.rotation.x = t * 4;
      fistMat.opacity = Math.max(0, 1.0 - t);
      mesh.material.transparent = true;
    });
    fist.userData.geo = fistGeo;
    fist.userData.mat = fistMat;
    
    addShake(ctx, 6);
  },
});

registerVfx('tank_shield', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    const color = new THREE.Color('#dfcbb5');
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const solidMat = new THREE.MeshStandardMaterial({
      color: 0xffa500,
      emissive: 0xcc6600,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.65,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const g = new THREE.Group();
    const mSolid = new THREE.Mesh(geo, solidMat);
    const mWire = new THREE.Mesh(geo, wireMat);
    g.add(mSolid, mWire);
    g.position.set(c.x, 26, c.z);
    
    ctx.addTransient(g, 0.72, (grp, t) => {
      const s = 44 * Math.min(1, t * 4);
      grp.scale.setScalar(s);
      mSolid.rotation.y += 0.02;
      mWire.rotation.y -= 0.03; mWire.rotation.x += 0.01;
      solidMat.opacity = 0.22 * (1 - t);
      wireMat.opacity = 0.65 * (1 - t);
    });
    
    g.userData.geo = geo;
    g.userData.mat = { dispose: () => { solidMat.dispose(); wireMat.dispose(); } };
    
    ring(ctx, c, { color: '#ffd700', from: 10, to: 60, life: 0.4, y: 3 });
    burst(ctx, c, { color: '#ffd700', count: 12, speed: 90, up: 70, flat: true, life: 0.5 });
  },
});

registerVfx('tank_quake', {
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    
    const discGeo = new THREE.CircleGeometry(z.radius, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x110d0a,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1.0;
    g.add(disc);
    
    const ringGeo = new THREE.RingGeometry(z.radius * 0.94, z.radius, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xa0744a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 1.1;
    g.add(ringMesh);

    g.userData.geo = { dispose: () => { discGeo.dispose(); ringGeo.dispose(); } };
    g.userData.mat = { dispose: () => { discMat.dispose(); ringMat.dispose(); } };

    let fired = false;
    let age = 0;
    let particleTimer = 0;
    
    return {
      object3D: g,
      update(dt) {
        age += dt;
        disc.rotation.z += dt * 0.5;
        ringMesh.rotation.z -= dt * 0.8;
        
        if (!fired) {
          fired = true;
          const c = { x: g.position.x, y: 10, z: g.position.z };
          ring(ctx, c, { color: '#caa472', from: 14, to: z.radius, life: 0.4, y: 4, alpha: 0.9, ease: true });
          addShake(ctx, 18);
          addFlash(ctx, 0.2, '#a0744a');
        }
        
        const remaining = Math.max(0, 1 - age / z.lifetime);
        discMat.opacity = 0.5 * remaining;
        ringMat.opacity = 0.85 * remaining;
        
        particleTimer += dt;
        if (particleTimer >= 0.06) {
          particleTimer = 0;
          const angle = Math.random() * Math.PI * 2;
          const startR = z.radius * (0.8 + Math.random() * 0.4);
          const px = g.position.x + Math.cos(angle) * startR;
          const pz = g.position.z + Math.sin(angle) * startR;
          
          const pullSpd = 120 + Math.random() * 80;
          ctx.particles.spawn({
            x: px, y: 4, z: pz,
            vx: -Math.cos(angle) * pullSpd, vy: 40 + Math.random() * 80, vz: -Math.sin(angle) * pullSpd,
            gravity: 280, drag: 1.1, life: 0.45,
            size: 3.5 + Math.random() * 3,
            color: Math.random() < 0.5 ? '#7f8c8d' : '#5a3a1f', fade: true
          });
        }
      }
    };
  }
});
