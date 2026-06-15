// 元素使：範圍壓制、前搖明顯。火花扇 / 火焰地帶 / 隕石天降。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, sphereFlash, burst, cone, addShake, addFlash } from './lib.js';

// 大絕招 — 隕石風暴：末日宣判與混沌隕星雨 (火/冰/雷三元素隨機下墜與獨特爆炸)
registerVfx('elem_ultimate', {
  onCast(ctx, f, c) {
    ctx.sceneMgr.addFlash(0.35, '#ff5a1f');
    ctx.sceneMgr.addShake(12);
    ring(ctx, c, { color: '#ff5a1f', from: 20, to: 240, life: 0.55, y: 4, ease: true });
    ring(ctx, c, { color: '#ffd166', from: 12, to: 160, life: 0.45, y: 6, alpha: 0.7 });
  },
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 130;
    
    // 隨機選擇一種元素（使用 z.id 保證雙端一致性，將數值 ID 轉為字串以防 chatCodeAt 報錯）
    const elemTypes = ['fire', 'frost', 'storm'];
    const idStr = String(z.id || '');
    const elemIdx = idStr.length > 0 ? (idStr.charCodeAt(idStr.length - 1) || 0) % 3 : 0;
    const elemType = elemTypes[elemIdx];

    const geos = [];
    const mats = [];

    // 1. 地面元素預警環
    const warnColor = elemType === 'fire' ? 0xff5a1f : (elemType === 'frost' ? 0x74e0ff : 0xb388ff);
    const warnGeo = new THREE.RingGeometry(0.86, 1, 32);
    const warnMat = new THREE.MeshBasicMaterial({
      color: warnColor,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const warn = new THREE.Mesh(warnGeo, warnMat);
    warn.rotation.x = -Math.PI / 2;
    warn.position.y = 1.5;
    warn.scale.setScalar(R);
    g.add(warn);
    geos.push(warnGeo);
    mats.push(warnMat);

    // 2. 建立不同外觀的元素隕石
    let meteor;
    let meteorMat;
    let meteorGeo;

    if (elemType === 'fire') {
      meteorGeo = new THREE.IcosahedronGeometry(R * 0.4, 1);
      meteorMat = new THREE.MeshStandardMaterial({
        color: 0x4a1008,
        emissive: 0xff5a1f,
        emissiveIntensity: 2.6,
        roughness: 0.65
      });
    } else if (elemType === 'frost') {
      meteorGeo = new THREE.OctahedronGeometry(R * 0.38, 0);
      meteorMat = new THREE.MeshStandardMaterial({
        color: 0xbfefff,
        emissive: 0x3498db,
        emissiveIntensity: 2.0,
        roughness: 0.1,
        transparent: true,
        opacity: 0.9
      });
    } else {
      meteorGeo = new THREE.IcosahedronGeometry(R * 0.35, 1);
      meteorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xb388ff,
        emissiveIntensity: 3.4,
        roughness: 0.2,
        wireframe: true
      });
    }
    
    meteor = new THREE.Mesh(meteorGeo, meteorMat);
    g.add(meteor);
    geos.push(meteorGeo);
    mats.push(meteorMat);

    g.userData.geo = { dispose: () => geos.forEach(geo => geo.dispose()) };
    g.userData.mat = { dispose: () => mats.forEach(mat => mat.dispose()) };

    const totalDelay = Math.max(0.0001, z.delay || 0.8);
    let exploded = false;

    return {
      object3D: g,
      update(dt, zz) {
        if (zz.delay > 0) {
          meteor.visible = true;
          const fill = 1 - zz.delay / totalDelay;
          
          // 帶斜角的流星下墜
          meteor.position.y = 850 * (zz.delay / totalDelay) + R * 0.4;
          meteor.position.x = -180 * (zz.delay / totalDelay);
          meteor.position.z = -90 * (zz.delay / totalDelay);
          
          meteor.rotation.x += dt * 5;
          meteor.rotation.y += dt * 6;

          // 下墜尾焰粒子
          const pColor = elemType === 'fire' ? '#ff7043' : (elemType === 'frost' ? '#bfefff' : '#b388ff');
          ctx.particles.spawn({
            x: g.position.x + meteor.position.x + (Math.random() - 0.5) * 12,
            y: meteor.position.y,
            z: g.position.z + meteor.position.z + (Math.random() - 0.5) * 12,
            vx: (Math.random() - 0.5) * 20, vy: 40, vz: (Math.random() - 0.5) * 20,
            drag: 1.5, life: 0.48, size: 9,
            color: pColor, fade: true
          });

          warnMat.opacity = 0.4 + 0.5 * Math.abs(Math.sin((1 - zz.delay / totalDelay) * Math.PI * 6));
        } else {
          meteor.visible = false;
          if (!exploded) {
            exploded = true;
            const cc = { x: g.position.x, y: 16, z: g.position.z };
            ctx.sceneMgr.addShake(22);

            if (elemType === 'fire') {
              // 火元素地裂火海
              ctx.sceneMgr.addFlash(0.32, '#ff5a1f');
              ring(ctx, cc, { color: '#ff5a1f', from: 14, to: R * 1.8, life: 0.48, y: 4, ease: true });
              sphereFlash(ctx, cc, { color: '#ff7043', from: 8, to: R * 1.1, life: 0.32, alpha: 0.9 });
              
              for (let i = 0; i < 48; i++) {
                const a = Math.random() * Math.PI * 2, spd = 220 + Math.random() * 260;
                ctx.particles.spawn({
                  x: cc.x, y: 6, z: cc.z,
                  vx: Math.cos(a) * spd, vy: 140 + Math.random() * 200, vz: Math.sin(a) * spd,
                  gravity: 460, drag: 1.1, life: 0.6 + Math.random() * 0.5,
                  size: 5 + Math.random() * 5, color: Math.random() < 0.6 ? '#ff7043' : '#4a1008', fade: true
                });
              }
            } else if (elemType === 'frost') {
              // 冰元素突起 3D 冰刺
              ctx.sceneMgr.addFlash(0.28, '#74e0ff');
              ring(ctx, cc, { color: '#74e0ff', from: 14, to: R * 1.6, life: 0.48, y: 4, ease: true });
              sphereFlash(ctx, cc, { color: '#bfefff', from: 8, to: R * 0.95, life: 0.3, alpha: 0.85 });

              for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
                const spikeX = cc.x + Math.cos(a) * R * 0.55;
                const spikeZ = cc.z + Math.sin(a) * R * 0.55;
                
                // 若出界則跳過，防止冰刺擠在牆壁邊緣
                if (spikeX < -590 || spikeX > 590 || spikeZ < -390 || spikeZ > 390) {
                  continue;
                }

                const spikeGeo = new THREE.ConeGeometry(8, 26, 4);
                const spikeMat = new THREE.MeshStandardMaterial({
                  color: 0xbfefff,
                  emissive: 0x3498db,
                  emissiveIntensity: 1.8,
                  transparent: true,
                  opacity: 0.9
                });
                const spike = new THREE.Mesh(spikeGeo, spikeMat);
                spike.position.set(spikeX, -13, spikeZ);
                
                ctx.addTransient(spike, 0.95, (mesh, t) => {
                  if (t < 0.2) {
                    mesh.position.y = -13 + 26 * (t / 0.2);
                  } else {
                    mesh.position.y = 13 - (t - 0.2) * 16;
                    mesh.material.opacity = (1 - t) * 0.9;
                  }
                });
                spike.userData.geo = spikeGeo;
                spike.userData.mat = spikeMat;
              }

              for (let i = 0; i < 36; i++) {
                const a = Math.random() * Math.PI * 2, spd = 180 + Math.random() * 200;
                ctx.particles.spawn({
                  x: cc.x, y: 6, z: cc.z,
                  vx: Math.cos(a) * spd, vy: 120 + Math.random() * 160, vz: Math.sin(a) * spd,
                  gravity: 380, drag: 1.2, life: 0.55 + Math.random() * 0.45,
                  size: 4 + Math.random() * 4, color: Math.random() < 0.5 ? '#bfefff' : '#ffffff', fade: true
                });
              }
            } else {
              // 雷元素扭曲電弧
              ctx.sceneMgr.addFlash(0.35, '#b388ff');
              ring(ctx, cc, { color: '#b388ff', from: 14, to: R * 1.7, life: 0.42, y: 4, ease: true });
              sphereFlash(ctx, cc, { color: '#ffffff', from: 8, to: R * 1.15, life: 0.24, alpha: 0.95 });

              for (let k = 0; k < 4; k++) {
                const a = (k / 4) * Math.PI * 2 + Math.random() * 0.5;
                const len = 40 + Math.random() * 30;
                const arcX = cc.x + Math.cos(a) * len * 0.5;
                const arcZ = cc.z + Math.sin(a) * len * 0.5;
                
                // 若出界則跳過
                if (arcX < -590 || arcX > 590 || arcZ < -390 || arcZ > 390) {
                  continue;
                }

                const arcGeo = new THREE.CylinderGeometry(1.5, 0.2, len, 4);
                const arcMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
                const mArc = new THREE.Mesh(arcGeo, arcMat);
                mArc.position.set(arcX, 14, arcZ);
                mArc.rotation.z = Math.PI / 2;
                mArc.rotation.y = -a;
                
                ctx.addTransient(mArc, 0.22, (mesh, t) => {
                  mesh.material.opacity = (1 - t) * 0.9;
                  mesh.scale.x = 1 + Math.random() * 0.4;
                });
                mArc.userData.geo = arcGeo;
                mArc.userData.mat = arcMat;
              }

              for (let i = 0; i < 40; i++) {
                const a = Math.random() * Math.PI * 2, spd = 240 + Math.random() * 280;
                ctx.particles.spawn({
                  x: cc.x, y: 6, z: cc.z,
                  vx: Math.cos(a) * spd, vy: 150 + Math.random() * 200, vz: Math.sin(a) * spd,
                  gravity: 280, drag: 1.3, life: 0.5 + Math.random() * 0.4,
                  size: 4 + Math.random() * 4.5, color: '#b388ff', fade: true
                });
              }
            }
          }
          warnMat.opacity = Math.max(0, warnMat.opacity - dt * 2);
        }
      }
    };
  }
});

registerVfx('elem_spark', {
  onCast(ctx, f, c) {
    // 前向火焰舌
    cone(ctx, c, f.facing, { color: ['#f39c12', '#ff7043', '#ffd166'], count: 20, speed: 300, spread: 0.45, offset: 10, up: 20, gravity: -10, drag: 2, life: 0.4, size: 4 });
    ring(ctx, c, { color: '#f39c12', from: 4, to: 30, life: 0.2, y: 4 });
  },
});

// 火焰地帶：持續 4s 燃燒
registerVfx('elem_firezone', {
  zone(ctx, z) {
    const g = new THREE.Group();
    const col = new THREE.Color('#e74c3c');
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 1; disc.scale.setScalar(z.radius); g.add(disc);
    let acc = 0; let age = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        disc.material.opacity = 0.22 + 0.1 * Math.sin(age * 8);
        disc.rotation.z += dt * 0.4;
        // 持續竄火 (節流)
        acc += dt;
        const rate = 0.02;
        while (acc >= rate) {
          acc -= rate;
          const a = Math.random() * Math.PI * 2, rr = Math.random() * z.radius;
          ctx.particles.spawn({
            x: g.position.x + Math.cos(a) * rr, y: 2, z: g.position.z + Math.sin(a) * rr,
            vx: (Math.random() - 0.5) * 20, vy: 80 + Math.random() * 110, vz: (Math.random() - 0.5) * 20,
            gravity: -20, drag: 1.2, life: 0.4 + Math.random() * 0.4, size: 4 + Math.random() * 4,
            color: Math.random() < 0.4 ? '#ffd166' : (Math.random() < 0.6 ? '#ff7043' : '#e74c3c'), fade: true,
          });
        }
      },
    };
  },
});

// 隕石：delay 期間天降隕石 + 預警圈；落地時 hit fx 觸發大爆炸
registerVfx('elem_meteor', {
  zone(ctx, z) {
    const g = new THREE.Group();
    const col = new THREE.Color('#c0392b');
    // 地面預警圈
    const warn = new THREE.Mesh(
      new THREE.RingGeometry(0.86, 1, 48),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    warn.rotation.x = -Math.PI / 2; warn.position.y = 1.5; warn.scale.setScalar(z.radius); g.add(warn);
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    inner.rotation.x = -Math.PI / 2; inner.position.y = 1; inner.scale.setScalar(z.radius); g.add(inner);
    // 隕石球 (從高空落下)
    const meteor = new THREE.Mesh(
      new THREE.IcosahedronGeometry(z.radius * 0.32, 1),
      new THREE.MeshStandardMaterial({ color: 0x4a1008, emissive: new THREE.Color('#ff5a1f'), emissiveIntensity: 2.4, roughness: 0.6 })
    );
    g.add(meteor);
    const totalDelay = Math.max(0.0001, z.delay || 1.2);
    const startH = 900;
    let exploded = false;
    return {
      object3D: g,
      update(dt, zz) {
        if (zz.delay > 0) {
          const fill = 1 - zz.delay / totalDelay;
          meteor.visible = true;
          meteor.position.y = startH * (zz.delay / totalDelay) + z.radius * 0.32;
          meteor.rotation.x += dt * 6; meteor.rotation.y += dt * 5;
          // 下墜火尾
          ctx.particles.spawn({
            x: g.position.x + (Math.random() - 0.5) * 10, y: meteor.position.y, z: g.position.z + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 20, vy: 40, vz: (Math.random() - 0.5) * 20, drag: 1.5, life: 0.5, size: 8, color: Math.random() < 0.5 ? '#ff7043' : '#ffd166', fade: true,
          });
          warn.material.opacity = 0.4 + 0.5 * Math.abs(Math.sin(fill * Math.PI * 6));
          inner.material.opacity = 0.1 + 0.12 * fill;
          inner.scale.setScalar(z.radius * (0.3 + 0.7 * fill));
        } else {
          meteor.visible = false;
          if (!exploded) {
            exploded = true;
            const c = { x: g.position.x, y: 16, z: g.position.z };
            sphereFlash(ctx, c, { color: '#ffd166', from: 10, to: z.radius * 1.1, life: 0.3, alpha: 1 });
            ring(ctx, c, { color: '#ff5a1f', from: 14, to: z.radius * 1.8, life: 0.45, y: 4, ease: true });
            for (let i = 0; i < 40; i++) {
              const a = Math.random() * Math.PI * 2, spd = 200 + Math.random() * 320;
              ctx.particles.spawn({ x: c.x, y: 6, z: c.z, vx: Math.cos(a) * spd, vy: 120 + Math.random() * 260, vz: Math.sin(a) * spd, gravity: 460, drag: 1, life: 0.6 + Math.random() * 0.6, size: 5 + Math.random() * 5, color: Math.random() < 0.5 ? '#ff7043' : '#4a1008', fade: false });
            }
            addShake(ctx, 22); addFlash(ctx, 0.32, '#ff5a1f');
          }
          warn.material.opacity = Math.max(0, warn.material.opacity - dt * 2);
          inner.material.opacity = Math.max(0, inner.material.opacity - dt * 1.5);
        }
      },
    };
  },
});
