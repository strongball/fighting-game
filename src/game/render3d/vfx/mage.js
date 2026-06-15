// 法師：奧術元素。漩渦火球 / 冰霜碎晶新星 / 分支閃電。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, sphereFlash, burst, cone, addShake, ultimateBurst } from './lib.js';

// 大絕招 — 天降流星：奧術星陣與巨型流星砸落
registerVfx('mage_ultimate', {
  onCast(ctx, f, c) {
    // 施法起手：微弱奧術聚光與魔力震顫
    ctx.sceneMgr.addFlash(0.18, '#e056fd');
    ctx.sceneMgr.addShake(6);
    burst(ctx, c, { color: ['#e056fd', '#3498db'], count: 18, speed: 120, up: 60, life: 0.45 });
  },
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 140;

    // 1. 地面自轉奧術魔法陣
    const arrayGeos = [];
    const arrayMats = [];
    
    const discGeo = new THREE.CircleGeometry(R, 40);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x9b59b6,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1.1;
    g.add(disc);
    arrayGeos.push(discGeo);
    arrayMats.push(discMat);
    
    const ringGeo1 = new THREE.RingGeometry(R * 0.94, R, 40);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0xe056fd,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 1.3;
    g.add(ring1);
    arrayGeos.push(ringGeo1);
    arrayMats.push(ringMat1);

    const ringGeo2 = new THREE.RingGeometry(R * 0.72, R * 0.78, 32);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 1.4;
    g.add(ring2);
    arrayGeos.push(ringGeo2);
    arrayMats.push(ringMat2);

    // 2. 奧術流星
    const meteorGeo = new THREE.IcosahedronGeometry(R * 0.32, 2);
    const meteorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe056fd,
      emissiveIntensity: 3.2,
      roughness: 0.3
    });
    const meteor = new THREE.Mesh(meteorGeo, meteorMat);
    g.add(meteor);
    arrayGeos.push(meteorGeo);
    arrayMats.push(meteorMat);

    g.userData.geo = { dispose: () => arrayGeos.forEach(geo => geo.dispose()) };
    g.userData.mat = { dispose: () => arrayMats.forEach(mat => mat.dispose()) };

    const totalDelay = Math.max(0.0001, z.delay || 0.8);
    let exploded = false;
    
    return {
      object3D: g,
      update(dt, zz) {
        disc.rotation.z += dt * 0.8;
        ring1.rotation.z -= dt * 1.2;
        ring2.rotation.z += dt * 1.5;
        
        if (zz.delay > 0) {
          meteor.visible = true;
          const fill = 1 - zz.delay / totalDelay;
          const startY = 850;
          
          // 傾斜砸地
          meteor.position.y = startY * (zz.delay / totalDelay) + R * 0.32;
          meteor.position.x = -240 * (zz.delay / totalDelay);
          meteor.position.z = -120 * (zz.delay / totalDelay);
          
          meteor.rotation.x += dt * 6;
          meteor.rotation.y += dt * 5;
          
          // 流星下墜拖尾粒子
          ctx.particles.spawn({
            x: g.position.x + meteor.position.x + (Math.random() - 0.5) * 16,
            y: meteor.position.y,
            z: g.position.z + meteor.position.z + (Math.random() - 0.5) * 16,
            vx: (Math.random() - 0.5) * 40, vy: 40, vz: (Math.random() - 0.5) * 40,
            drag: 1.5, life: 0.45, size: 9,
            color: Math.random() < 0.5 ? '#e056fd' : '#3498db', fade: true
          });
          
          discMat.opacity = 0.2 + 0.3 * Math.abs(Math.sin(fill * Math.PI * 6));
          ringMat1.opacity = 0.5 + 0.45 * Math.abs(Math.sin(fill * Math.PI * 6));
        } else {
          meteor.visible = false;
          if (!exploded) {
            exploded = true;
            const cc = { x: g.position.x, y: 16, z: g.position.z };
            ctx.sceneMgr.addShake(22);
            ctx.sceneMgr.addFlash(0.35, '#e056fd');
            
            // 落地瞬間爆發
            ultimateBurst(ctx, cc, { color: '#e056fd', radius: R, pillarH: 240, pillarR: 38, shake: 24, flash: 0.36 });
            
            // 爆開的大量星塵粒子
            for (let i = 0; i < 72; i++) {
              const a = Math.random() * Math.PI * 2, spd = 280 + Math.random() * 320;
              ctx.particles.spawn({
                x: cc.x, y: 6, z: cc.z,
                vx: Math.cos(a) * spd, vy: 160 + Math.random() * 260, vz: Math.sin(a) * spd,
                gravity: 350, drag: 1.2, life: 0.65 + Math.random() * 0.65,
                size: 4 + Math.random() * 5, color: Math.random() < 0.4 ? '#e056fd' : (Math.random() < 0.7 ? '#3498db' : '#ffffff'), fade: true
              });
            }
            
            // 地面發光裂痕
            for (let k = 0; k < 5; k++) {
              const ang = (k / 5) * Math.PI * 2 + Math.random() * 0.4;
              const crackGeo = new THREE.BoxGeometry(R * 1.5, 0.8, 2.5);
              const crackX = cc.x + Math.cos(ang) * R * 0.38;
              const crackZ = cc.z + Math.sin(ang) * R * 0.38;
               
              // 若出界則跳過該裂紋，防止裂紋擠在牆壁邊緣
              if (crackX < -590 || crackX > 590 || crackZ < -390 || crackZ > 390) {
                continue;
              }
               
              const crackMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
              const crack = new THREE.Mesh(crackGeo, crackMat);
              crack.position.set(crackX, 1.2, crackZ);
              crack.rotation.y = -ang;
              ctx.addTransient(crack, 1.4, (mesh, t) => {
                mesh.material.opacity = (1 - t) * 0.9;
                mesh.scale.x = 1 - t * 0.3;
              });
              crack.userData.geo = crackGeo;
              crack.userData.mat = crackMat;
            }
          }
          discMat.opacity = Math.max(0, discMat.opacity - dt * 2.5);
          ringMat1.opacity = Math.max(0, ringMat1.opacity - dt * 2.5);
          ringMat2.opacity = Math.max(0, ringMat2.opacity - dt * 2.5);
        }
      }
    };
  },
});

registerVfx('mage_fireball', {
  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const emissiveColor = new THREE.Color(pr.color || '#7aa2ff');
    
    const coreGeo = new THREE.OctahedronGeometry(pr.radius * 0.9, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: emissiveColor,
      emissiveIntensity: 2.8,
      roughness: 0.1
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    g.add(core);
    
    const shellGeo = new THREE.IcosahedronGeometry(pr.radius * 1.5, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      color: emissiveColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      wireframe: true
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    g.add(shell);
    
    g.userData.geo = { dispose: () => { coreGeo.dispose(); shellGeo.dispose(); } };
    g.userData.mat = { dispose: () => { coreMat.dispose(); shellMat.dispose(); } };

    return {
      object3D: g,
      update(dt) {
        core.rotation.x += dt * 8; core.rotation.y += dt * 10;
        shell.rotation.y -= dt * 4; shell.rotation.z += dt * 6;
        
        ctx.particles.spawn({
          x: g.position.x + (Math.random() - 0.5) * 4,
          y: g.position.y + (Math.random() - 0.5) * 4,
          z: g.position.z + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, vz: (Math.random() - 0.5) * 20,
          drag: 3, life: 0.28, size: pr.radius * 0.9,
          color: pr.color, fade: true
        });
      }
    };
  },
  onHit(ctx, f, c) {
    const splashColor = f.color || '#7aa2ff';
    sphereFlash(ctx, c, { color: '#ffffff', from: 4, to: f.radius || 36, life: 0.22, alpha: 0.95 });
    ring(ctx, c, { color: splashColor, from: 6, to: (f.radius || 28) * 1.6, life: 0.32, y: 8 });
    burst(ctx, c, { color: [splashColor, '#ffffff'], count: 16, speed: 220, up: 30, life: 0.48 });
    addShake(ctx, 4);
  }
});

// 冰霜新星：自身為中心瞬間爆發 (zone, 無 delay → 自訂 zone 處理視覺)
registerVfx('mage_frostnova', {
  zone(ctx, z) {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfefff'), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 1; disc.scale.setScalar(z.radius);
    g.add(disc);
    let fired = false; let age = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        if (!fired) {
          fired = true;
          const c = { x: g.position.x, y: 14, z: g.position.z };
          ring(ctx, c, { color: '#74e0ff', from: 10, to: z.radius, life: 0.4, y: 4, alpha: 0.95, ease: true });
          ring(ctx, c, { color: '#ffffff', from: 6, to: z.radius * 0.7, life: 0.3, y: 6 });
          // 冰晶往外飛
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            const spd = 160 + Math.random() * 120;
            ctx.particles.spawn({
              x: c.x, y: 8, z: c.z, vx: Math.cos(a) * spd, vy: 30 + Math.random() * 60, vz: Math.sin(a) * spd,
              gravity: 180, drag: 1.6, life: 0.5 + Math.random() * 0.3, size: 4, color: Math.random() < 0.5 ? '#bfefff' : '#ffffff', fade: true,
            });
          }
          addShake(ctx, 5);
        }
        disc.material.opacity = Math.max(0, 0.32 * (1 - age / Math.max(0.2, z.lifetime)));
        disc.rotation.z += dt * 0.6;
      },
    };
  },
});

// 閃電鏈：穿透。亮白電芯 + 抖動分支
registerVfx('mage_lightning', {
  projectile(ctx, pr) {
    const g = new THREE.Group();
    const len = Math.max(46, pr.radius * 9);
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(pr.radius * 0.7, pr.radius * 0.7, len, 6),
      new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: new THREE.Color('#b388ff'), emissiveIntensity: 3.4 })
    );
    core.rotation.z = Math.PI / 2; g.add(core);
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(pr.radius * 0.3, pr.radius * 0.3, len * 0.6, 5),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#dffaff'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    g.add(branch);
    return {
      object3D: g,
      update(dt) {
        branch.rotation.set(Math.random() * 0.6 - 0.3, 0, Math.PI / 2 + (Math.random() * 0.8 - 0.4));
        branch.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
        core.material.emissiveIntensity = 2.8 + Math.random() * 1.4;
        ctx.particles.spawn({
          x: g.position.x, y: g.position.y, z: g.position.z,
          vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, vz: (Math.random() - 0.5) * 60,
          drag: 4, life: 0.18, size: pr.radius * 1.2, color: '#dffaff', fade: true,
        });
      },
    };
  },
  onHit(ctx, f, c) {
    sphereFlash(ctx, c, { color: '#dffaff', from: 4, to: (f.radius || 24), life: 0.16, alpha: 1 });
    ring(ctx, c, { color: '#b388ff', from: 4, to: (f.radius || 20) * 2, life: 0.26, y: 8 });
    // 分叉電弧：數道短電芒向外炸裂 (呼應閃電鏈分裂)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.random() * 0.5;
      const len = 22 + Math.random() * 20;
      const geo = new THREE.CylinderGeometry(1.2, 0.2, len, 5);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color('#dffaff'), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(c.x + Math.cos(a) * len * 0.5, c.y, c.z + Math.sin(a) * len * 0.5);
      m.rotation.z = Math.PI / 2; m.rotation.y = -a;
      ctx.addTransient(m, 0.18, (mesh, t) => { mesh.material.opacity = (1 - t) * 0.9; mesh.scale.x = 1 + Math.random() * 0.4; });
      m.userData.mat = m.material; m.userData.geo = geo;
    }
    for (let i = 0; i < 18; i++) {
      const a = Math.random() * Math.PI * 2, spd = 220 + Math.random() * 220;
      ctx.particles.spawn({ x: c.x, y: c.y, z: c.z, vx: Math.cos(a) * spd, vy: (Math.random() - 0.3) * 130, vz: Math.sin(a) * spd, drag: 3, life: 0.25, size: 3, color: '#dffaff', fade: true });
    }
    addShake(ctx, 6);
  },
});

registerVfx('mage_flamebreath', {
  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const coreGeo = new THREE.IcosahedronGeometry(pr.radius * 0.6, 1);
    const shellGeo = new THREE.IcosahedronGeometry(pr.radius * 1.25, 2);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff4500, emissiveIntensity: 2.5 });
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false });
    
    const core = new THREE.Mesh(coreGeo, coreMat);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    g.add(core, shell);
    
    g.userData.geo = { dispose: () => { coreGeo.dispose(); shellGeo.dispose(); } };
    g.userData.mat = { dispose: () => { coreMat.dispose(); shellMat.dispose(); } };

    let age = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        const pulse = 1.0 + age * 1.5;
        shell.scale.setScalar(pulse);
        shellMat.opacity = Math.max(0, 0.65 * (1 - age / (pr.lifetime || 0.45)));
        core.rotation.x += dt * 8; core.rotation.y += dt * 6;
        
        ctx.particles.spawn({
          x: g.position.x + (Math.random() - 0.5) * 5,
          y: g.position.y + (Math.random() - 0.5) * 5,
          z: g.position.z + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 20, vy: 10 + Math.random() * 30, vz: (Math.random() - 0.5) * 20,
          drag: 2.2, life: 0.25 + Math.random() * 0.2,
          size: pr.radius * 0.9, color: Math.random() < 0.65 ? '#ff4500' : '#ff8c00', fade: true
        });
      }
    };
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: '#ff4500', from: 4, to: (f.radius || 13) * 2.2, life: 0.28, y: 8 });
    burst(ctx, c, { color: ['#ff4500', '#ff8c00', '#331100'], count: 10, speed: 180, up: 25, life: 0.4 });
    if (Math.random() < 0.4) {
      ctx.particles.spawn({
        x: c.x, y: 12, z: c.z,
        vx: (Math.random() - 0.5) * 12, vy: 40 + Math.random() * 40, vz: (Math.random() - 0.5) * 12,
        drag: 1.5, gravity: -15, life: 0.5 + Math.random() * 0.3, size: 5, color: '#3a2a22', fade: true
      });
    }
  }
});

registerVfx('mage_iceshard', {
  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const shardGeo = new THREE.ConeGeometry(pr.radius * 0.6, pr.radius * 4.8, 5);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xe0f7fa,
      emissive: 0x80deea,
      emissiveIntensity: 2.4,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85
    });
    const shard = new THREE.Mesh(shardGeo, iceMat);
    shard.rotation.z = -Math.PI / 2;
    g.add(shard);
    
    g.userData.geo = shardGeo;
    g.userData.mat = iceMat;

    return {
      object3D: g,
      update(dt) {
        ctx.particles.spawn({
          x: g.position.x + (Math.random() - 0.5) * 4,
          y: g.position.y + (Math.random() - 0.5) * 4,
          z: g.position.z + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, vz: (Math.random() - 0.5) * 10,
          drag: 3, life: 0.28, size: pr.radius * 0.7,
          color: Math.random() < 0.6 ? '#b3e5fc' : '#ffffff', fade: true
        });
      }
    };
  },
  onHit(ctx, f, c) {
    const THREE = ctx.THREE;
    ring(ctx, c, { color: '#80deea', from: 4, to: (f.radius || 12) * 2.5, life: 0.32, y: 8 });
    
    const spikeGeo = new THREE.ConeGeometry(3.5, 12, 4);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xe0f7fa, emissive: 0x00bcd4, emissiveIntensity: 1.5, roughness: 0.1 });
    
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 8;
      const spkX = c.x + Math.cos(angle) * dist;
      const spkZ = c.z + Math.sin(angle) * dist;
      
      if (spkX < -595 || spkX > 595 || spkZ < -395 || spkZ > 395) {
        continue;
      }
      
      spike.position.set(spkX, -6, spkZ);
      spike.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.3);
      ctx.addTransient(spike, 0.58, (mesh, t) => {
        if (t < 0.22) {
          mesh.position.y = -6 + 12 * (t / 0.22);
        } else {
          mesh.position.y = 6 - (t - 0.22) * 14;
          mesh.material.opacity = Math.max(0, (1 - t) * 1.4);
          mesh.material.transparent = true;
        }
      });
    }
    
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, spd = 140 + Math.random() * 120;
      ctx.particles.spawn({
        x: c.x, y: 8, z: c.z,
        vx: Math.cos(a) * spd, vy: 80 + Math.random() * 100, vz: Math.sin(a) * spd,
        gravity: 240, drag: 1.5, life: 0.45, size: 3.5, color: '#e0f7fa', fade: true
      });
    }
    addShake(ctx, 4);
  }
});

