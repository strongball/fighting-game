// 弓箭手：精準、輕盈。流線箭矢 / 多重散射 / 後撤陷阱網。
import * as THREE from 'three';
import { registerVfx } from './registry.js';
import { ring, burst, cone } from './lib.js';

// 大絕招 — 萬箭齊發：神意·千羽風暴與神梭傾瀉
registerVfx('archer_ultimate', {
  onCast(ctx, f, c) {
    const THREE = ctx.THREE;
    ctx.sceneMgr.addShake(8);
    ctx.sceneMgr.addFlash(0.2, '#7bed9f');

    // 施法起手：精靈之風法陣
    ring(ctx, c, { color: '#7bed9f', from: 10, to: 80, life: 0.5, y: 4, ease: true });
    
    // 召喚背後的「翠綠光之雙翼」
    const wingGroup = new THREE.Group();
    wingGroup.position.set(c.x, c.y + 14, c.z);
    wingGroup.rotation.y = -f.facing;

    const wingMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const leftWingGeo = new THREE.ConeGeometry(5, 34, 3);
    const leftWing = new THREE.Mesh(leftWingGeo, wingMat);
    leftWing.position.set(-8, 4, -6);
    leftWing.rotation.set(0.4, 0, 0.7);
    
    const rightWingGeo = new THREE.ConeGeometry(5, 34, 3);
    const rightWing = new THREE.Mesh(rightWingGeo, wingMat);
    rightWing.position.set(8, 4, -6);
    rightWing.rotation.set(0.4, 0, -0.7);

    wingGroup.add(leftWing, rightWing);

    ctx.addTransient(wingGroup, 0.65, (mesh, t) => {
      const scale = 0.5 + 0.5 * Math.sin(t * Math.PI);
      mesh.scale.set(scale, scale, scale);
      leftWing.rotation.z = 0.7 + Math.sin(t * Math.PI * 4) * 0.25;
      rightWing.rotation.z = -0.7 - Math.sin(t * Math.PI * 4) * 0.25;
      wingMat.opacity = (1 - t) * 0.85;
    });

    wingGroup.userData.geo = { dispose: () => { leftWingGeo.dispose(); rightWingGeo.dispose(); } };
    wingGroup.userData.mat = wingMat;

    cone(ctx, c, f.facing, { color: ['#7bed9f', '#ffffff'], count: 26, speed: 320, spread: 0.6, up: 30, life: 0.4 });
  },

  projectile(ctx, pr) {
    const THREE = ctx.THREE;
    const g = new THREE.Group();
    const col = new THREE.Color('#2ecc71');
    const white = new THREE.Color('#ffffff');

    // 1. 中心發光光梭
    const shaftGeo = new THREE.CylinderGeometry(pr.radius * 0.38, pr.radius * 0.38, pr.radius * 8, 6);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: col,
      emissiveIntensity: 3.2,
      roughness: 0.2
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.rotation.z = Math.PI / 2;
    g.add(shaft);

    // 2. 風暴螺旋外圈
    const torusGeo = new THREE.TorusGeometry(pr.radius * 1.5, pr.radius * 0.24, 6, 16);
    const torusMat = new THREE.MeshBasicMaterial({
      color: white,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.y = Math.PI / 2;
    g.add(torus);

    return {
      object3D: g,
      update(dt) {
        torus.rotation.x += dt * 18;
        
        ctx.particles.spawn({
          x: g.position.x, y: g.position.y, z: g.position.z,
          vx: (Math.random() - 0.5) * 16, vy: (Math.random() - 0.5) * 16, vz: (Math.random() - 0.5) * 16,
          drag: 3, life: 0.24, size: pr.radius * 1.2,
          color: Math.random() < 0.5 ? '#7bed9f' : '#ffffff', fade: true
        });
      }
    };
  },

  onHit(ctx, f, c) {
    const THREE = ctx.THREE;
    // 命中時的「旋轉風暴氣旋」Mesh
    const geo = new THREE.TorusGeometry(1, 0.28, 6, 24);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x7bed9f,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.x, 8, c.z);
    
    ctx.addTransient(m, 0.42, (mesh, t) => {
      mesh.scale.setScalar((f.radius || 14) * 3.5 * t);
      mesh.rotation.z += 0.12;
      mesh.material.opacity = (1 - t) * 0.9;
    });
    m.userData.geo = geo;
    m.userData.mat = m.material;

    // 噴射翠綠羽毛/風刃粒子
    burst(ctx, c, { color: ['#7bed9f', '#d8ffe6', '#ffffff'], count: 18, speed: 220, up: 40, life: 0.45, size: 3.5 });
  }
});

function makeArrow(ctx, pr, tint) {
  const g = new THREE.Group();
  const col = new THREE.Color(tint || pr.color);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(pr.radius * 0.35, pr.radius * 0.35, pr.radius * 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xede3c8, emissive: col, emissiveIntensity: 0.6 })
  );
  shaft.rotation.z = Math.PI / 2; g.add(shaft);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(pr.radius * 0.8, pr.radius * 2, 7),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: col, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.3 })
  );
  tip.rotation.z = -Math.PI / 2; tip.position.x = pr.radius * 4; g.add(tip);
  // 尾羽
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(
      new THREE.BoxGeometry(pr.radius * 1.6, 0.6, pr.radius * 1.2),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
    );
    f.position.x = -pr.radius * 2.6; f.rotation.x = (i / 3) * Math.PI; g.add(f);
  }
  return {
    object3D: g,
    update() {
      ctx.particles.spawn({
        x: g.position.x, y: g.position.y, z: g.position.z,
        vx: 0, vy: 0, vz: 0, drag: 5, life: 0.2, size: pr.radius * 1.1, color: tint || pr.color, fade: true,
      });
    },
  };
}

registerVfx('archer_arrow', {
  projectile(ctx, pr) { return makeArrow(ctx, pr, '#2ecc71'); },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: '#2ecc71', from: 4, to: (f.radius || 16) * 2.2, life: 0.26, y: 8 });
    burst(ctx, c, { color: ['#2ecc71', '#7bed9f'], count: 12, speed: 180, up: 40, life: 0.4, size: 2.6 });
  },
});

// 蓄力貫穿箭：尺寸依 pr.radius 自動反映蓄力程度 + 冰藍能量外殼
registerVfx('archer_arrow_charged', {
  projectile(ctx, pr) {
    const g = new THREE.Group();
    const baseCol = new THREE.Color('#9fe8ff');
    const whiteCol = new THREE.Color('#ffffff');
    // 主箭桿（發白光）
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(pr.radius * 0.38, pr.radius * 0.22, pr.radius * 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: baseCol, emissiveIntensity: 2.8 })
    );
    shaft.rotation.z = Math.PI / 2; g.add(shaft);
    // 能量外殼（線框球，旋轉）
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(pr.radius * 1.5, 1),
      new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: baseCol, emissiveIntensity: 3.8, transparent: true, opacity: 0.38, wireframe: true })
    );
    g.add(shell);
    // 箭頭（放大版）
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(pr.radius * 1.3, pr.radius * 3.5, 7),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: whiteCol, emissiveIntensity: 3.5, metalness: 0.8, roughness: 0.1 })
    );
    tip.rotation.z = -Math.PI / 2; tip.position.x = pr.radius * 5.5; g.add(tip);
    // 尾羽（4 片，冰藍）
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(
        new THREE.BoxGeometry(pr.radius * 2.2, 0.7, pr.radius * 1.6),
        new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.75 })
      );
      f.position.x = -pr.radius * 3.2; f.rotation.x = (i / 4) * Math.PI; g.add(f);
    }
    return {
      object3D: g,
      update(dt) {
        shell.rotation.x += dt * 5;
        shell.rotation.y += dt * 7;
        // 冰藍能量粒子尾跡
        for (let i = 0; i < 2; i++) {
          ctx.particles.spawn({
            x: g.position.x + (Math.random() - 0.5) * pr.radius * 3,
            y: g.position.y + Math.random() * 20,
            z: g.position.z + (Math.random() - 0.5) * pr.radius * 3,
            vx: 0, vy: 15, vz: 0, drag: 5, gravity: 0,
            life: 0.28, size: pr.radius * 1.6, color: Math.random() < 0.55 ? '#9fe8ff' : '#ffffff', fade: true,
          });
        }
      },
    };
  },
  onHit(ctx, f, c) {
    const R = (f.radius || 20) * 3.2;
    ring(ctx, c, { color: '#9fe8ff', from: 6, to: R, life: 0.44, y: 8, ease: true });
    ring(ctx, c, { color: '#ffffff', from: 4, to: R * 0.55, life: 0.28, y: 14, alpha: 0.9 });
    burst(ctx, c, { color: ['#9fe8ff', '#ffffff', '#7fefff'], count: 28, speed: 320, up: 100, life: 0.58, size: 3.8 });
    ctx.sceneMgr.addFlash(0.18, '#9fe8ff');
    ctx.sceneMgr.addShake(10);
  },
});

registerVfx('archer_multishot', {
  projectile(ctx, pr) { return makeArrow(ctx, pr, '#7bed9f'); },
  onHit(ctx, f, c) {
    burst(ctx, c, { color: '#7bed9f', count: 9, speed: 160, up: 30, life: 0.35, size: 2.4 });
  },
});

// 後撤陷阱：地面網 (lifetime 4s)
registerVfx('archer_trap', {
  zone(ctx, z) {
    const g = new THREE.Group();
    const col = new THREE.Color('#1abc9c');
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 40),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 1; disc.scale.setScalar(z.radius); g.add(disc);
    // 交叉網線
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(z.radius * 2, 0.6, 1.4),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      line.position.y = 1.4; line.rotation.y = -a; g.add(line);
    }
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 40),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    rim.rotation.x = -Math.PI / 2; rim.position.y = 1.5; rim.scale.setScalar(z.radius); g.add(rim);
    let fired = false; let age = 0;
    return {
      object3D: g,
      update(dt) {
        age += dt;
        if (!fired) { fired = true; const c = { x: g.position.x, y: 10, z: g.position.z }; ring(ctx, c, { color: '#1abc9c', from: 8, to: z.radius, life: 0.4, y: 4 }); cone(ctx, c, 0, { color: '#caa472', count: 14, speed: 120, spread: Math.PI, up: 60, life: 0.5 }); }
        const pulse = 0.5 + 0.5 * Math.sin(age * 5);
        disc.material.opacity = 0.14 + 0.1 * pulse;
        g.rotation.y += dt * 0.5;
      },
    };
  },
});
