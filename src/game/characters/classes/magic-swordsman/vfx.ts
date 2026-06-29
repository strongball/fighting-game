// @ts-nocheck
// 魔劍士：靛藍魔能、青藍斬光、星晨旋風、極限解放毀滅爆發。
// 特效基調：發光青藍 (#00f3ff) + 亮藍 (#4895ef) + 金黃 (#ffd700) + 亮白 (#ffffff)
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, burst, cone, column, slashBlade, sphereFlash, pillar, addShake, addFlash, ultimateBurst, getSwingDir } from '../../../render3d/vfx/lib.js';

const CYAN = '#00f3ff';
const BLUE = '#4895ef';
const GOLD = '#ffd700';
const WHITE = '#ffffff';
const DEEP = '#120c42';

// ─── J：魔刃連斬 ───
// 雙重交叉斬光 + 青焰拖尾 + 大量火花
registerVfx('magic_swordsman_slash', {
  onCast(ctx, f, c) {
    try {
      // 搜尋場景中對應的玩家模型，確認當前是正手還是反手揮砍
      const swingDir = getSwingDir(ctx, c);

      // 輕量化單次橫劈斬：白-青雙色刀光，極佳視覺清晰度
      slashBlade(ctx, c, f.facing, { color: CYAN, len: f.range * 1.2, w: 18, swing: swingDir, life: 0.26, sparkCount: 8 });
      
      // 輕量化扇形青焰 (減量 65% 粒子以避免卡頓)
      cone(ctx, c, f.facing, { color: [BLUE, CYAN, WHITE], count: 6, speed: 280, spread: 0.65, offset: f.range * 0.35, up: 40, life: 0.3, size: 3.8 });
      
      addShake(ctx, 3);
    } catch (err) {
      console.error("VFX magic_swordsman_slash ERROR:", err);
      if (typeof document !== 'undefined') {
        let div = document.getElementById('debug-error-overlay');
        if (!div) {
          div = document.createElement('div');
          div.id = 'debug-error-overlay';
          div.style.position = 'fixed';
          div.style.top = '10px';
          div.style.left = '10px';
          div.style.right = '10px';
          div.style.padding = '20px';
          div.style.background = 'rgba(255, 0, 0, 0.9)';
          div.style.color = 'white';
          div.style.fontFamily = 'monospace';
          div.style.fontSize = '14px';
          div.style.zIndex = '99999';
          div.style.whiteSpace = 'pre-wrap';
          div.style.borderRadius = '8px';
          div.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
          document.body.appendChild(div);
        }
        div.textContent = `VFX magic_swordsman_slash Error:\n${err.message}\n\nStack:\n${err.stack}`;
      }
      throw err;
    }
  },
});

// ─── K：劍氣波 ───
// 超廣角巨型螺旋月牙 + 雙重軌跡粒子 + 命中毀滅爆發
registerVfx('magic_swordsman_wave', {
  projectile(ctx, pr) {
    const g = new THREE.Group();
    const SIZE_MULT = 2.4; // 寬度加大

    // 核心月牙（更寬的弧形）
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const core = new THREE.Mesh(new THREE.RingGeometry(pr.radius * 0.4 * SIZE_MULT, pr.radius * 2.8 * SIZE_MULT, 40, 1, -1.4, 2.8), coreMat);
    core.rotation.x = -Math.PI / 2;
    g.add(core);

    // 外層藍暈（更寬）
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const glow = new THREE.Mesh(new THREE.RingGeometry(pr.radius * 1.2 * SIZE_MULT, pr.radius * 4.0 * SIZE_MULT, 40, 1, -1.4, 2.8), glowMat);
    glow.rotation.x = -Math.PI / 2;
    g.add(glow);

    // 巨大白色內核
    const coreDotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(WHITE), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const coreDot = new THREE.Mesh(new THREE.SphereGeometry(pr.radius * 1.2 * SIZE_MULT, 12, 10), coreDotMat);
    coreDot.position.y = 3;
    g.add(coreDot);

    // 外層旋轉光環（雙重環繞：金黃與青藍）
    const orbitMat1 = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const orbit1 = new THREE.Mesh(new THREE.TorusGeometry(pr.radius * 2.8 * SIZE_MULT, 1.2, 8, 32), orbitMat1);
    orbit1.rotation.x = Math.PI / 3;
    orbit1.rotation.z = Math.PI / 4;
    g.add(orbit1);

    const orbitMat2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const orbit2 = new THREE.Mesh(new THREE.TorusGeometry(pr.radius * 3.2 * SIZE_MULT, 0.8, 8, 32), orbitMat2);
    orbit2.rotation.x = -Math.PI / 4;
    orbit2.rotation.z = Math.PI / 3;
    g.add(orbit2);

    g.userData.mat = { dispose() { coreMat.dispose(); glowMat.dispose(); coreDotMat.dispose(); orbitMat1.dispose(); orbitMat2.dispose(); } };
    g.userData.geo = { dispose() { core.geometry.dispose(); glow.geometry.dispose(); coreDot.geometry.dispose(); orbit1.geometry.dispose(); orbit2.geometry.dispose(); } };

    return {
      object3D: g,
      update(dt) {
        g.rotation.y += dt * 12;
        core.scale.x = 1 + Math.sin(performance.now() * 0.025) * 0.15;
        glow.scale.x = 1 + Math.cos(performance.now() * 0.02) * 0.12;
        orbit1.rotation.z += dt * 3;
        orbit1.rotation.x += dt * 2;
        orbit2.rotation.z -= dt * 2.5;
        orbit2.rotation.y += dt * 1.8;
        
        // 雙重螺旋拖尾（更多、更大、更密）
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2;
          const helix = Math.sin(performance.now() * 0.01 + i) * 12;
          ctx.particles.spawn({
            x: g.position.x + Math.cos(a) * helix,
            y: 14 + Math.sin(a + performance.now() * 0.005) * 10,
            z: g.position.z + Math.sin(a) * helix,
            vx: Math.cos(a) * 30 + (Math.random() - 0.5) * 12,
            vy: 15 + Math.random() * 30,
            vz: Math.sin(a) * 30 + (Math.random() - 0.5) * 12,
            drag: 2.0, life: 0.4 + Math.random() * 0.3,
            size: 3.5 + Math.random() * 4,
            color: [WHITE, CYAN, BLUE, GOLD],
            fade: true,
          });
        }
        // 尾焰粒子（密集小點）
        for (let i = 0; i < 3; i++) {
          ctx.particles.spawn({
            x: g.position.x + (Math.random() - 0.5) * 10,
            y: 8 + Math.random() * 16,
            z: g.position.z + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 20, vy: 8 + Math.random() * 12, vz: (Math.random() - 0.5) * 20,
            drag: 3, life: 0.2 + Math.random() * 0.15,
            size: 2 + Math.random() * 2.5, color: [GOLD, CYAN, WHITE],
            fade: true,
          });
        }
      },
    };
  },
  onHit(ctx, f, c) {
    addShake(ctx, 14);
    addFlash(ctx, 0.18, CYAN);

    // 四層衝擊環 (金黃/白/青藍/藍)
    ring(ctx, c, { color: GOLD, from: 12, to: 120, life: 0.5, y: 3, alpha: 0.92, ease: true });
    ring(ctx, c, { color: WHITE, from: 8, to: 85, life: 0.4, y: 6, alpha: 0.88 });
    ring(ctx, c, { color: CYAN, from: 6, to: 60, life: 0.35, y: 9, alpha: 0.8 });
    ring(ctx, c, { color: BLUE, from: 4, to: 40, life: 0.28, y: 12, alpha: 0.65 });

    // 雙重球閃
    sphereFlash(ctx, c, { color: WHITE, from: 8, to: 65, life: 0.34, alpha: 0.95, detail: 3 });
    sphereFlash(ctx, c, { color: CYAN, from: 6, to: 45, life: 0.28, alpha: 0.85 });

    // 超大範圍爆發
    burst(ctx, c, {
      color: [WHITE, CYAN, BLUE, GOLD],
      count: 50,
      speed: 420,
      up: 100,
      life: 0.6,
      size: 6,
    });

    // 前向大型錐形噴射
    cone(ctx, c, f.facing || 0, {
      color: [BLUE, CYAN, WHITE, GOLD],
      count: 40,
      speed: 520,
      spread: 0.5,
      up: 80,
      life: 0.5,
      size: 5.5,
    });

    // 地面光柱 (金黃與白色)
    pillar(ctx, c, { color: GOLD, h: 120, r: 24, taper: 0.4, life: 0.45, alpha: 0.65, grow: 0.6 });
    pillar(ctx, c, { color: WHITE, h: 100, r: 12, taper: 0.2, life: 0.35, alpha: 0.5, grow: 0.4 });

    // 大量散落火星
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 80;
      ctx.particles.spawn({
        x: c.x + Math.cos(a) * dist, y: 4 + Math.random() * 8, z: c.z + Math.sin(a) * dist,
        vx: Math.cos(a) * 60 + (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 80,
        vz: Math.sin(a) * 60 + (Math.random() - 0.5) * 40,
        gravity: 140, drag: 1.8, life: 0.5 + Math.random() * 0.4,
        size: 3 + Math.random() * 4, color: [GOLD, CYAN, WHITE], fade: true,
      });
    }
  },
});

// ─── L：魔能護體 ───
// 青色吸收護盾 + 環繞金色符印
registerVfx('magic_swordsman_guard', {
  onCast(ctx, f, c) {
    addShake(ctx, 6);
    // 雙層防護環
    ring(ctx, c, { color: CYAN, from: 12, to: 110, life: 0.55, y: 4, alpha: 0.88, ease: true });
    ring(ctx, c, { color: GOLD, from: 6, to: 76, life: 0.42, y: 7, alpha: 0.76 });
    sphereFlash(ctx, c, { color: WHITE, from: 8, to: 52, life: 0.34, alpha: 0.85 });

    // 全方向青焰噴發
    burst(ctx, c, { color: [BLUE, CYAN, WHITE], count: 28, speed: 240, up: 90, life: 0.6, size: 5 });
    column(ctx, c, { color: [CYAN, BLUE], count: 20, radius: 32, speed: 180, life: 0.7, size: 4 });

    // 環繞旋轉的金色符印方塊 (對應原畫中魔能與裝甲的符印美感)
    const sealCount = 6;
    const sealMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(GOLD), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const seals = [];
    for (let i = 0; i < sealCount; i++) {
      const seal = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 1.4), sealMat);
      seal.position.y = 4;
      const a = (i / sealCount) * Math.PI * 2;
      seal.userData.angle = a;
      seal.userData.rad = 68;
      ctx.addTransient(seal, 0.48, (m, t) => {
        const ang = m.userData.angle + t * Math.PI * 3;
        m.position.x = c.x + Math.cos(ang) * m.userData.rad;
        m.position.z = c.z + Math.sin(ang) * m.userData.rad;
        m.position.y = 4 + Math.sin(t * Math.PI * 4 + i) * 6;
        m.rotation.y += 0.15;
        m.rotation.x += 0.08;
        sealMat.opacity = 0.8 * (1 - t);
      });
      seals.push(seal);
    }
  },
});

// L 技能觸發的魔刃強化（消耗 3 劍氣時額外特效）
registerVfx('magic_swordsman_enhance', {
  onCast(ctx, f, c) {
    addShake(ctx, 8);
    addFlash(ctx, 0.22, GOLD);
    // 金色與白色閃電環 + 劍氣爆發
    ring(ctx, c, { color: GOLD, from: 16, to: 130, life: 0.65, y: 4, alpha: 0.92, ease: true });
    ring(ctx, c, { color: WHITE, from: 8, to: 90, life: 0.5, y: 6, alpha: 0.85 });
    ring(ctx, c, { color: BLUE, from: 6, to: 60, life: 0.4, y: 9, alpha: 0.7 });
    sphereFlash(ctx, c, { color: GOLD, from: 10, to: 70, life: 0.36, alpha: 0.9, detail: 3 });

    // 巨型上升光柱
    pillar(ctx, c, { color: CYAN, h: 160, r: 28, taper: 0.3, life: 0.7, alpha: 0.6, grow: 0.4 });
    pillar(ctx, c, { color: WHITE, h: 140, r: 12, taper: 0.2, life: 0.55, alpha: 0.5, grow: 0.3 });

    // 密集噴射
    burst(ctx, c, { color: [GOLD, WHITE, CYAN], count: 40, speed: 320, up: 110, life: 0.7, size: 5.5 });
    column(ctx, c, { color: [GOLD, CYAN], count: 30, radius: 40, speed: 220, life: 0.9, size: 4.5 });
  },
});

// 劍氣衰退/收回的特效（talent 中使用）
registerVfx('magic_swordsman_decay', {
  onCast(ctx, f, c) {
    ctx.particles.spawn({
      x: c.x + (Math.random() - 0.5) * 20,
      y: 10 + Math.random() * 12,
      z: c.z + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 30,
      vy: 20 + Math.random() * 30,
      vz: (Math.random() - 0.5) * 30,
      drag: 2.0, life: 0.35 + Math.random() * 0.25,
      size: 3 + Math.random() * 2.5, color: [CYAN, BLUE, WHITE], fade: true,
    });
  },
});

// ─── ；極限解放 ───
// 毀滅級爆發：多層次元衝擊 + 四重光柱 + 密集隕石 + 閃屏停頓 + 延遲破滅斬 + 終結爆破
registerVfx('magic_swordsman_ultimate', {
  onCast(ctx, f, c) {
    addShake(ctx, 40);
    addFlash(ctx, 0.6, CYAN);

    const R = f.radius || 220;

    // 第一波：加速吸力特效（地面收縮環）
    ring(ctx, c, { color: BLUE, from: R * 0.1, to: R * 1.8, life: 0.35, y: 1, alpha: 0.5, inner: 0.96, ease: true });

    // 六層球面衝擊波
    ring(ctx, c, { color: GOLD, from: 24, to: R, life: 0.85, y: 2, alpha: 0.95, ease: true });
    ring(ctx, c, { color: WHITE, from: 14, to: R * 0.7, life: 0.65, y: 5, alpha: 0.92 });
    ring(ctx, c, { color: CYAN, from: 10, to: R * 0.85, life: 0.52, y: 8, alpha: 0.88 });
    ring(ctx, c, { color: BLUE, from: 8, to: R * 0.95, life: 0.45, y: 11, alpha: 0.8 });
    ring(ctx, c, { color: GOLD, from: R * 0.3, to: R * 2.0, life: 1.0, y: 1, alpha: 0.45, inner: 0.92, ease: true });
    ring(ctx, c, { color: WHITE, from: 6, to: R * 0.5, life: 0.38, y: 14, alpha: 0.7 });

    // 三重巨型球閃
    sphereFlash(ctx, c, { color: WHITE, from: 12, to: R * 0.48, life: 0.38, alpha: 0.98, detail: 4 });
    sphereFlash(ctx, c, { color: CYAN, from: 10, to: R * 0.7, life: 0.48, alpha: 0.8, detail: 3 });
    sphereFlash(ctx, c, { color: BLUE, from: 8, to: R * 0.32, life: 0.32, alpha: 0.7 });

    // 四重通天光柱（青藍 + 白 + 藍 + 金黃）
    pillar(ctx, c, { color: CYAN, h: 380, r: 55, taper: 0.25, life: 1.0, alpha: 0.75, grow: 0.5 });
    pillar(ctx, c, { color: WHITE, h: 420, r: 28, taper: 0.12, life: 0.8, alpha: 0.6, grow: 0.35 });
    pillar(ctx, c, { color: BLUE, h: 320, r: 42, taper: 0.3, life: 0.9, alpha: 0.55, grow: 0.45 });
    pillar(ctx, c, { color: GOLD, h: 360, r: 16, taper: 0.08, life: 0.7, alpha: 0.4, grow: 0.25 });

    // 密集上升星塵（3 組不同半徑）
    column(ctx, c, { color: [BLUE, CYAN, WHITE, GOLD], count: 60, radius: R * 0.6, speed: 320, life: 1.4, size: 6 });
    column(ctx, c, { color: [GOLD, WHITE, CYAN], count: 40, radius: R * 0.3, speed: 200, life: 1.0, size: 4 });
    column(ctx, c, { color: [WHITE, CYAN], count: 30, radius: R * 0.85, speed: 250, life: 1.2, size: 5 });

    // 地面全方位爆裂火花
    burst(ctx, c, { color: [BLUE, CYAN, WHITE, GOLD], count: 80, speed: 380, up: 100, flat: true, life: 0.8, size: 6 });
    burst(ctx, c, { color: [WHITE, GOLD], count: 50, speed: 280, up: 60, flat: true, life: 0.55, size: 4.5 });

    // 全方向大型錐形噴射（4 方向）
    for (let dir = 0; dir < 4; dir++) {
      const a = (f.facing || 0) + (dir / 4) * Math.PI * 2;
      cone(ctx, c, a, {
        color: [BLUE, CYAN, WHITE, GOLD],
        count: 28, speed: 380 + dir * 60,
        spread: 0.7, up: 100, life: 0.6, size: 5,
      });
    }

    // 三層環繞旋轉的符文能量環（金黃/青藍/白色）
    const runeLayers = [
      { count: 16, geo: (s: number) => new THREE.TorusGeometry(4 * s, 1.4 * s, 6, 6), radMul: 0.7, color: GOLD, speed: 4, yAmp: 14 },
      { count: 12, geo: (s: number) => new THREE.TorusKnotGeometry(3 * s, 1.0 * s, 8, 6), radMul: 0.45, color: CYAN, speed: -5, yAmp: 10 },
      { count: 8, geo: (s: number) => new THREE.BoxGeometry(6, 6, 1.5), radMul: 0.25, color: WHITE, speed: 6, yAmp: 8 },
    ];
    for (const layer of runeLayers) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(layer.color), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      for (let i = 0; i < layer.count; i++) {
        const rune = new THREE.Mesh(layer.geo(1), mat);
        rune.position.y = 2;
        const a = (i / layer.count) * Math.PI * 2;
        rune.userData.angle = a;
        rune.userData.baseRad = R * layer.radMul;
        ctx.addTransient(rune, 1.0, (m, t) => {
          const ang = m.userData.angle + t * Math.PI * layer.speed;
          const rad = m.userData.baseRad + t * 50;
          m.position.x = c.x + Math.cos(ang) * rad;
          m.position.z = c.z + Math.sin(ang) * rad;
          m.position.y = 2 + Math.sin(t * Math.PI * 5 + i) * layer.yAmp + t * 40;
          m.rotation.x += 0.15;
          m.rotation.y += 0.2;
          m.rotation.z += 0.1;
          mat.opacity = 0.8 * (1 - t);
        });
      }
    }

    // 延遲第二波：破滅斬（超級進化版）
    setTimeout(() => {
      if (!ctx.scene) return;
      addShake(ctx, 50);
      addFlash(ctx, 0.55, CYAN);

      const TH = ctx.THREE;

      // 巨型斬月（青藍主斬）
      const slashMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(CYAN),
        transparent: true, opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const slashGeo = new THREE.RingGeometry(80, 300, 56, 1, -1.2, 2.4);
      const slash = new THREE.Mesh(slashGeo, slashMat);
      slash.rotation.x = -Math.PI / 2;
      const slashG = new THREE.Group();
      slashG.position.set(c.x, 20, c.z);
      slashG.rotation.y = -(f.facing || 0);
      slashG.add(slash);
      ctx.addTransient(slashG, 0.55, (grp, t) => {
        const s = 0.6 + t * 0.8;
        slash.scale.set(s, s, 1);
        slashMat.opacity = 1.0 * (1 - t);
        grp.rotation.y = -(f.facing || 0) + (t - 0.5) * 0.6;
      });

      // 白色副斬（交叉）
      const slashMat2 = new THREE.MeshBasicMaterial({
        color: new THREE.Color(WHITE),
        transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const slashGeo2 = new THREE.RingGeometry(50, 220, 48, 1, -1.0, 2.0);
      const slash2 = new THREE.Mesh(slashGeo2, slashMat2);
      slash2.rotation.x = -Math.PI / 2;
      const slashG2 = new THREE.Group();
      slashG2.position.set(c.x, 26, c.z);
      slashG2.rotation.y = -(f.facing || 0) + 0.7;
      slashG2.add(slash2);
      ctx.addTransient(slashG2, 0.5, (grp, t) => {
        const s = 0.6 + t * 0.7;
        slash2.scale.set(s, s, 1);
        slashMat2.opacity = 0.9 * (1 - t);
        grp.rotation.y = -(f.facing || 0) + 0.7 - (t - 0.5) * 0.5;
      });

      // 第三斬：藍色雙刃
      const slashMat3 = new THREE.MeshBasicMaterial({
        color: new THREE.Color(BLUE),
        transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      });
      const slashGeo3 = new THREE.RingGeometry(30, 180, 40, 1, -0.9, 1.8);
      const slash3 = new THREE.Mesh(slashGeo3, slashMat3);
      slash3.rotation.x = -Math.PI / 2;
      const slashG3 = new THREE.Group();
      slashG3.position.set(c.x, 32, c.z);
      slashG3.rotation.y = -(f.facing || 0) - 0.5;
      slashG3.add(slash3);
      ctx.addTransient(slashG3, 0.42, (grp, t) => {
        const s = 0.6 + t * 0.6;
        slash3.scale.set(s, s, 1);
        slashMat3.opacity = 0.8 * (1 - t);
        grp.rotation.y = -(f.facing || 0) - 0.5 + (t - 0.5) * 0.4;
      });

      // 三層衝擊光環 (金黃/白色/青藍)
      ring(ctx, c, { color: GOLD, from: 40, to: R * 1.6, life: 0.7, y: 2, alpha: 0.92, ease: true });
      ring(ctx, c, { color: WHITE, from: 20, to: R * 1.0, life: 0.55, y: 5, alpha: 0.88 });
      ring(ctx, c, { color: CYAN, from: 12, to: R * 0.75, life: 0.45, y: 8, alpha: 0.8 });

      // 四重光柱再現（更強）
      pillar(ctx, c, { color: CYAN, h: 450, r: 65, taper: 0.2, life: 0.9, alpha: 0.8, grow: 0.6 });
      pillar(ctx, c, { color: WHITE, h: 500, r: 30, taper: 0.08, life: 0.75, alpha: 0.65, grow: 0.4 });
      pillar(ctx, c, { color: BLUE, h: 380, r: 48, taper: 0.25, life: 0.85, alpha: 0.6, grow: 0.5 });
      pillar(ctx, c, { color: GOLD, h: 420, r: 18, taper: 0.06, life: 0.65, alpha: 0.45, grow: 0.3 });

      // 密集粒子大爆發
      column(ctx, c, { color: [CYAN, WHITE, BLUE, GOLD], count: 80, radius: R * 0.6, speed: 380, life: 1.2, size: 6.5 });
      burst(ctx, c, { color: [CYAN, WHITE, BLUE, GOLD], count: 100, speed: 480, up: 130, flat: true, life: 0.8, size: 7 });

      // 終結震波：大範圍慢速擴張光環
      ring(ctx, c, { color: WHITE, from: 60, to: R * 2.5, life: 1.2, y: 1, alpha: 0.35, inner: 0.98, ease: true });

      // 最後火花雨
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * R;
        ctx.particles.spawn({
          x: c.x + Math.cos(a) * dist, y: 6 + Math.random() * 10, z: c.z + Math.sin(a) * dist,
          vx: (Math.random() - 0.5) * 80,
          vy: 80 + Math.random() * 140,
          vz: (Math.random() - 0.5) * 80,
          gravity: 180, drag: 1.5, life: 0.7 + Math.random() * 0.6,
          size: 3.5 + Math.random() * 5, color: [CYAN, BLUE, WHITE, GOLD], fade: true,
        });
      }
    }, 200);
  },
});
