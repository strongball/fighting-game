// @ts-nocheck
// 元素使：範圍壓制、前搖明顯。火花扇 / 火焰地帶 / 隕石天降。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, sphereFlash, burst, cone, addShake, addFlash } from '../../../render3d/vfx/lib.js';

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

// 火焰扇：扇形火焰噴發
registerVfx('elem_flamefan', {
  onCast(ctx, f, c) {
    const R = f.range || 280;
    const swingArc = f.arc || 1.8;

    // 爆發閃光
    ring(ctx, c, { color: '#ffffff', from: 6, to: 50, life: 0.18, y: 8, alpha: 1 });
    ring(ctx, c, { color: '#f39c12', from: 8, to: 80, life: 0.25, y: 5, alpha: 0.8 });
    ring(ctx, c, { color: '#ff7043', from: 4, to: 130, life: 0.35, y: 3, alpha: 0.5, ease: true });
    ctx.sceneMgr.addFlash(0.25, '#ffd166');

    // 扇形火焰噴射 (密集大顆，平射)
    const n = 90;
    for (let i = 0; i < n; i++) {
      const ratio = i / n;
      const angle = f.facing - swingArc / 2 + ratio * swingArc + (Math.random() - 0.5) * 0.06;
      const spd = 700 + Math.random() * 600;
      const rise = 20 + Math.random() * 40;
      ctx.particles.spawn({
        x: c.x + Math.cos(angle) * 40,
        y: c.y + 4 + Math.random() * 6,
        z: c.z + Math.sin(angle) * 40,
        vx: Math.cos(angle) * spd,
        vy: rise,
        vz: Math.sin(angle) * spd,
        gravity: 40,
        drag: 0.5,
        life: 0.3 + Math.random() * 0.3,
        size: 42 + Math.random() * 30,
        color: Math.random() < 0.2 ? '#ffffff' : (Math.random() < 0.4 ? '#ffd166' : (Math.random() < 0.7 ? '#ff7043' : '#f39c12')),
        fade: true,
      });
    }

    // 軌跡尾焰 (填補扇面空隙)
    for (let i = 0; i < 40; i++) {
      const angle = f.facing - swingArc / 2 + Math.random() * swingArc;
      const dist = R * (0.15 + Math.random() * 0.65);
      ctx.particles.spawn({
        x: c.x + Math.cos(angle) * dist * 0.2,
        y: c.y + 2 + Math.random() * 6,
        z: c.z + Math.sin(angle) * dist * 0.2,
        vx: (Math.random() - 0.5) * 60,
        vy: 10 + Math.random() * 30,
        vz: (Math.random() - 0.5) * 60,
        gravity: 20,
        drag: 1.5,
        life: 0.5 + Math.random() * 0.35,
        size: 24 + Math.random() * 18,
        color: Math.random() < 0.5 ? '#ff7043' : '#f39c12',
        fade: true,
      });
    }

    // 地面擴散火星
    for (let i = 0; i < 25; i++) {
      const a = f.facing - swingArc / 2 + Math.random() * swingArc;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * (R * (0.1 + Math.random() * 0.6)),
        y: c.y + 1,
        z: c.z + Math.sin(a) * (R * (0.1 + Math.random() * 0.6)),
        vx: Math.cos(a) * (80 + Math.random() * 120),
        vy: 5 + Math.random() * 15,
        vz: Math.sin(a) * (80 + Math.random() * 120),
        gravity: 20,
        drag: 2.0,
        life: 0.4 + Math.random() * 0.25,
        size: 18 + Math.random() * 12,
        color: '#ff7043',
        fade: true,
      });
    }
  },
});

// 火焰地帶：持續 4s 燃燒 (升級為滾動的 3D 火牆)
registerVfx('elem_firezone', {
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 110;
    
    // 預警與地面氣流圈
    const discGeo = new THREE.CircleGeometry(R, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0xe74c3c,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1;
    g.add(disc);

    // 建立 3 個火柱
    const numCols = 3;
    const columnsList = [];
    const geos = [discGeo];
    const mats = [discMat];

    const coneGeo = new THREE.ConeGeometry(R * 0.2, R * 0.65, 6);
    const innerGeo = new THREE.ConeGeometry(R * 0.12, R * 0.55, 6);
    geos.push(coneGeo, innerGeo);

    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xff3b0f,
      emissive: 0xff3b0f,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      wireframe: true
    });
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    mats.push(outerMat, innerMat);

    const offsets = [
      { x: 0, z: 0 },
      { x: -R * 0.55, z: -10 },
      { x: R * 0.55, z: -10 }
    ];

    for (let i = 0; i < numCols; i++) {
      const colGroup = new THREE.Group();
      colGroup.position.set(offsets[i].x, R * 0.325, offsets[i].z);

      const outer = new THREE.Mesh(coneGeo, outerMat);
      const inner = new THREE.Mesh(innerGeo, innerMat);
      colGroup.add(outer, inner);
      g.add(colGroup);

      columnsList.push({
        group: colGroup,
        outer,
        inner,
        phase: i * Math.PI * 0.5
      });
    }

    g.userData.geo = { dispose: () => geos.forEach(geo => geo.dispose()) };
    g.userData.mat = { dispose: () => mats.forEach(mat => mat.dispose()) };

    let age = 0;
    let acc = 0;
    
    return {
      object3D: g,
      update(dt) {
        age += dt;
        discMat.opacity = 0.2 + 0.1 * Math.sin(age * 7);
        
        columnsList.forEach((col) => {
          col.group.rotation.y += dt * 3.5;
          col.outer.rotation.z = Math.sin(age * 5 + col.phase) * 0.15;
          
          const scaleY = 1.0 + Math.sin(age * 14 + col.phase) * 0.2;
          const scaleXZ = 1.0 + Math.cos(age * 12 + col.phase) * 0.12;
          col.group.scale.set(scaleXZ, scaleY, scaleXZ);
        });

        // 持續竄火
        acc += dt;
        const rate = 0.022;
        while (acc >= rate) {
          acc -= rate;
          columnsList.forEach((col) => {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * R * 0.18;
            ctx.particles.spawn({
              x: g.position.x + col.group.position.x + Math.cos(angle) * r,
              y: 4,
              z: g.position.z + col.group.position.z + Math.sin(angle) * r,
              vx: (Math.random() - 0.5) * 30,
              vy: 80 + Math.random() * 130,
              vz: (Math.random() - 0.5) * 30,
              gravity: -25,
              drag: 1.25,
              life: 0.45 + Math.random() * 0.4,
              size: 4 + Math.random() * 4.5,
              color: Math.random() < 0.4 ? '#ffd166' : (Math.random() < 0.6 ? '#ff7043' : '#e74c3c'),
              fade: true
            });
          });
        }
      }
    };
  }
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

// 雷霆風暴：移動雷雲區域，持續落雷 — 浮誇版
registerVfx('elem_lightningstorm', {
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 100;

    // 地面預警電圈
    const discGeo = new THREE.RingGeometry(0.15, 1, 48);
    const discMat = new THREE.MeshBasicMaterial({
      color: 0x42a5f5,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 1;
    disc.scale.setScalar(R);
    g.add(disc);

    // 內圈高亮
    const innerDiscGeo = new THREE.CircleGeometry(1, 32);
    const innerDiscMat = new THREE.MeshBasicMaterial({
      color: 0x29b6f6,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.position.y = 0.5;
    innerDisc.scale.setScalar(R * 0.8);
    g.add(innerDisc);

    // 雷雲 (更大更亮)
    const cloudGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x1a237e,
      emissive: 0x42a5f5,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.6,
      roughness: 0.8,
    });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.3;
      const r = R * (0.2 + Math.random() * 0.6);
      const cloudPuff = new THREE.Mesh(
        new THREE.SphereGeometry(R * (0.18 + Math.random() * 0.18), 7, 7),
        cloudMat
      );
      cloudPuff.position.set(Math.cos(a) * r, 70 + Math.random() * 35, Math.sin(a) * r);
      cloudPuff.scale.y = 0.3 + Math.random() * 0.4;
      cloudGroup.add(cloudPuff);
    }
    // 雲底發光層
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x42a5f5,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(R * 0.6, 24), glowMat);
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = 45;
    g.add(glowDisc);
    g.add(cloudGroup);

    g.userData.geo = { dispose: () => { discGeo.dispose(); innerDiscGeo.dispose(); } };
    g.userData.mat = { dispose: () => { discMat.dispose(); innerDiscMat.dispose(); } };

    let age = 0;
    let lightningTimer = 0;
    const lightningInterval = 0.22;

    return {
      object3D: g,
      update(dt, zz) {
        age += dt;
        discMat.opacity = 0.25 + 0.2 * Math.sin(age * 8);
        innerDiscMat.opacity = 0.12 + 0.12 * Math.sin(age * 6 + 1);
        cloudGroup.rotation.y += dt * 0.5;
        glowMat.opacity = 0.1 + 0.08 * Math.sin(age * 5);

        lightningTimer += dt;
        while (lightningTimer >= lightningInterval) {
          lightningTimer -= lightningInterval;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * R * 0.75;
          const lx = g.position.x + Math.cos(a) * r;
          const lz = g.position.z + Math.sin(a) * r;

          // 落雷閃光 (更大)
          ctx.sceneMgr.addFlash(0.18, '#64b5f6');

          // 閃電粒子爆發 (密集)
          for (let i = 0; i < 24; i++) {
            const arcA = Math.random() * Math.PI * 2;
            const arcR = 6 + Math.random() * 22;
            ctx.particles.spawn({
              x: lx + Math.cos(arcA) * arcR,
              y: 4,
              z: lz + Math.sin(arcA) * arcR,
              vx: (Math.random() - 0.5) * 120,
              vy: 120 + Math.random() * 200,
              vz: (Math.random() - 0.5) * 120,
              gravity: -80,
              drag: 1.5,
              life: 0.2 + Math.random() * 0.25,
              size: 3 + Math.random() * 4,
              color: Math.random() < 0.3 ? '#ffffff' : (Math.random() < 0.6 ? '#90caf9' : '#42a5f5'),
              fade: true
            });
          }

          // 主閃電弧
          const boltH = 60 + Math.random() * 40;
          const boltGeo = new THREE.CylinderGeometry(2.5, 0.5, boltH, 5);
          const boltMat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
          });
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(lx, boltH / 2, lz);
          bolt.rotation.x = (Math.random() - 0.5) * 0.4;
          bolt.rotation.z = (Math.random() - 0.5) * 0.4;
          ctx.addTransient(bolt, 0.12, (mesh, t) => {
            mesh.material.opacity = (1 - t);
            mesh.scale.x = 1 + t * 3;
            mesh.scale.z = 1 + t * 3;
          });
          bolt.userData.geo = boltGeo;
          bolt.userData.mat = boltMat;

          // 連鎖閃電 (分支)
          for (let k = 0; k < 3; k++) {
            const branchA = Math.random() * Math.PI * 2;
            const branchDist = 15 + Math.random() * 30;
            const bx = lx + Math.cos(branchA) * branchDist;
            const bz = lz + Math.sin(branchA) * branchDist;
            const branchH = 20 + Math.random() * 25;
            const branchGeo = new THREE.CylinderGeometry(1.2, 0.3, branchH, 4);
            const branchMat = new THREE.MeshBasicMaterial({
              color: 0x90caf9,
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
            });
            const branch = new THREE.Mesh(branchGeo, branchMat);
            branch.position.set(bx, branchH / 2, bz);
            branch.rotation.x = (Math.random() - 0.5) * 0.5;
            branch.rotation.z = (Math.random() - 0.5) * 0.5;
            ctx.addTransient(branch, 0.1, (mesh, t) => {
              mesh.material.opacity = (1 - t) * 0.8;
            });
            branch.userData.geo = branchGeo;
            branch.userData.mat = branchMat;
          }

          // 地面電花
          for (let i = 0; i < 10; i++) {
            const sa = Math.random() * Math.PI * 2;
            const sd = 5 + Math.random() * 25;
            ctx.particles.spawn({
              x: lx + Math.cos(sa) * sd,
              y: 2,
              z: lz + Math.sin(sa) * sd,
              vx: (Math.random() - 0.5) * 30,
              vy: 40 + Math.random() * 60,
              vz: (Math.random() - 0.5) * 30,
              drag: 2.5,
              life: 0.15 + Math.random() * 0.15,
              size: 2 + Math.random() * 2,
              color: '#ffffff',
              fade: true
            });
          }
        }
      }
    };
  }
});

// 寒霜足跡：冰霜區域
registerVfx('elem_frost', {
  onCast(ctx, f, c) {
    // 多重冰環爆發
    ring(ctx, c, { color: '#74e0ff', from: 6, to: f.radius || 120, life: 0.5, y: 5, alpha: 0.9, ease: true });
    ring(ctx, c, { color: '#74e0ff', from: 4, to: (f.radius || 120) * 0.6, life: 0.35, y: 7, alpha: 0.7 });
    ring(ctx, c, { color: '#bfefff', from: (f.radius || 120) * 0.3, to: (f.radius || 120) * 1.1, life: 0.45, y: 3, alpha: 0.5, ease: true });
    ctx.sceneMgr.addFlash(0.25, '#74e0ff');

    // 冰晶粒子爆發
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 30;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * rr, y: 4, z: c.z + Math.sin(a) * rr,
        vx: (Math.random() - 0.5) * 40, vy: 80 + Math.random() * 120, vz: (Math.random() - 0.5) * 40,
        drag: 1.2, life: 0.5 + Math.random() * 0.4,
        size: 3 + Math.random() * 4, color: '#bfefff', fade: true
      });
    }

    // 上升冰霧
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 40;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * rr, y: 2, z: c.z + Math.sin(a) * rr,
        vx: (Math.random() - 0.5) * 10, vy: 30 + Math.random() * 50, vz: (Math.random() - 0.5) * 10,
        gravity: -5, drag: 0.6, life: 0.8 + Math.random() * 0.5,
        size: 5 + Math.random() * 5, color: '#bfefff', fade: true, alpha: 0.4,
      });
    }
  },
  zone(ctx, z) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const R = z.radius || 120;
    const color = new THREE.Color('#9fe8ff');

    // 冰盤 (更大)
    const iceGeo = new THREE.IcosahedronGeometry(R * 0.85, 1);
    iceGeo.scale(1, 0.1, 1);
    const iceMat = new THREE.MeshStandardMaterial({
      color,
      emissive: 0x5dade2,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.5,
      roughness: 0.05,
      metalness: 0.3,
    });
    const iceMesh = new THREE.Mesh(iceGeo, iceMat);
    iceMesh.position.y = 1.0;
    iceMesh.rotation.y = Math.random() * Math.PI;
    g.add(iceMesh);

    // 冰面光芒 (更亮更大)
    const glowGeo = new THREE.CircleGeometry(R * 0.7, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x74e0ff,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.y = 0.8;
    g.add(glowMesh);

    // 冰刺裝飾 (更多)
    const spikeGroup = new THREE.Group();
    const spikeMat = new THREE.MeshStandardMaterial({
      color: 0x90caf9,
      emissive: 0x5dade2,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.3,
    });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const sr = R * (0.35 + Math.random() * 0.35);
      const spikeGeo = new THREE.ConeGeometry(4 + Math.random() * 4, 14 + Math.random() * 10, 4);
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(Math.cos(a) * sr, 0, Math.sin(a) * sr);
      spike.rotation.x = (Math.random() - 0.5) * 0.2;
      spike.rotation.z = (Math.random() - 0.5) * 0.2;
      spikeGroup.add(spike);
    }
    g.add(spikeGroup);

    g.userData.geo = iceGeo;
    g.userData.mat = iceMat;

    let age = 0;
    let timeAcc = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        
        const remaining = Math.max(0, 1 - age / z.lifetime);
        iceMat.opacity = 0.5 * remaining;
        glowMat.opacity = 0.1 * remaining;
        spikeMat.opacity = 0.3 * remaining;
        spikeGroup.rotation.y += dt * 0.3;

        // 冰晶粒子 (更大更密集)
        timeAcc += dt;
        const rate = 0.15;
        while (timeAcc >= rate) {
          timeAcc -= rate;
          const a = Math.random() * Math.PI * 2, r = Math.random() * R * 0.6;
          ctx.particles.spawn({
            x: g.position.x + Math.cos(a) * r,
            y: 2 + Math.random() * 4,
            z: g.position.z + Math.sin(a) * r,
            vx: (Math.random() - 0.5) * 20,
            vy: 30 + Math.random() * 60,
            vz: (Math.random() - 0.5) * 20,
            drag: 1.5,
            life: 0.5 + Math.random() * 0.4,
            size: 4 + Math.random() * 4,
            color: '#bfefff',
            fade: true
          });
        }

        // 地板冰霧 (更頻繁)
        if (Math.random() < 0.08) {
          const fa = Math.random() * Math.PI * 2, fr = Math.random() * R * 0.5;
          ctx.particles.spawn({
            x: g.position.x + Math.cos(fa) * fr,
            y: 1,
            z: g.position.z + Math.sin(fa) * fr,
            vx: (Math.random() - 0.5) * 8,
            vy: 15 + Math.random() * 25,
            vz: (Math.random() - 0.5) * 8,
            gravity: -3,
            drag: 0.5,
            life: 0.8 + Math.random() * 0.4,
            size: 7 + Math.random() * 6,
            color: '#74e0ff',
            fade: true,
            alpha: 0.3,
          });
        }
      }
    };
  }
});

