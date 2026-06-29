// @ts-nocheck
// 聖騎士：黃金聖光、十字、神聖審判。
// 錘擊金光斬 / 神聖衝鋒（落地留奉獻聖土）/ 制裁聖域（頭頂降天使）/ 天堂審判（天使環＋聖十字＋光柱）。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, cone, column, burst, sphereFlash, pillar, slashBlade, addShake, addFlash, ultimateBurst } from '../../../render3d/vfx/lib.js';

const GOLD = '#ffd700';
const LIGHT = '#fff7d0';
const WHITE = '#ffffff';

// ── 共用：以基本幾何拼出「發光天使」Group ─────────────────────────────
// 回傳的 group 帶 userData：{ geos, mats, wingR, wingL, halo, setAlpha(a), geo/mat(聚合 dispose) }
// 兩種釋放路徑都安全：① zone 子物件由 disposeZone traverse 釋放；② addTransient 由 userData.geo/mat 聚合釋放。
function buildAngel(TH, opt = {}) {
  const s = opt.scale || 1;
  const g = new TH.Group();
  const geos = [];
  const mats = [];
  const mk = (geo, color, op) => {
    geos.push(geo);
    const m = new TH.MeshBasicMaterial({ color: new TH.Color(color), transparent: true, opacity: op, depthWrite: false, side: TH.DoubleSide, blending: TH.AdditiveBlending });
    m.userData = { base: op };
    mats.push(m);
    return new TH.Mesh(geo, m);
  };

  // 長袍（寬襬窄肩的圓錐）＋ 內層亮芯
  const robe = mk(new TH.ConeGeometry(7 * s, 22 * s, 16, 1, true), opt.robe || '#ffe6ad', 0.55);
  robe.position.y = 11 * s; g.add(robe);
  const robeCore = mk(new TH.ConeGeometry(4 * s, 19 * s, 12, 1, true), WHITE, 0.5);
  robeCore.position.y = 11 * s; g.add(robeCore);
  // 頭
  const head = mk(new TH.SphereGeometry(3.4 * s, 16, 12), '#fff4cf', 0.85);
  head.position.y = 26 * s; g.add(head);
  // 光環
  const halo = mk(new TH.TorusGeometry(4.4 * s, 0.7 * s, 8, 28), opt.halo || '#ffd24a', 0.95);
  halo.rotation.x = Math.PI * 0.42; halo.position.y = 31 * s; g.add(halo);

  // 翅膀（羽扇剪影 Shape）
  const wing = new TH.Shape();
  wing.moveTo(0, 0);
  wing.quadraticCurveTo(10 * s, 4 * s, 22 * s, 3 * s);
  wing.quadraticCurveTo(30 * s, 1 * s, 26 * s, -5 * s);
  wing.quadraticCurveTo(33 * s, -7 * s, 24 * s, -12 * s);
  wing.quadraticCurveTo(29 * s, -16 * s, 18 * s, -18 * s);
  wing.quadraticCurveTo(22 * s, -23 * s, 11 * s, -23 * s);
  wing.quadraticCurveTo(6 * s, -14 * s, 0, 0);
  const wingGeoR = new TH.ShapeGeometry(wing);
  const wingGeoL = wingGeoR.clone();
  const wingR = mk(wingGeoR, opt.wing || '#fffae6', 0.6);
  const wingL = mk(wingGeoL, opt.wing || '#fffae6', 0.6);
  wingL.scale.x = -1;
  const wingPivotR = new TH.Group(); wingPivotR.position.set(2 * s, 19 * s, -1 * s); wingPivotR.add(wingR); wingPivotR.rotation.y = -0.5;
  const wingPivotL = new TH.Group(); wingPivotL.position.set(-2 * s, 19 * s, -1 * s); wingPivotL.add(wingL); wingPivotL.rotation.y = 0.5;
  g.add(wingPivotR); g.add(wingPivotL);

  g.userData = {
    geos, mats, halo, wingR: wingPivotR, wingL: wingPivotL,
    setAlpha(a) { for (const m of mats) m.opacity = m.userData.base * a; },
    geo: { dispose() { for (const x of geos) x.dispose(); } },
    mat: { dispose() { for (const x of mats) x.dispose(); } },
  };
  return g;
}

// ── 共用：發光聖十字 Group ───────────────────────────────────────────
function buildCross(TH, opt = {}) {
  const s = opt.scale || 1;
  const g = new TH.Group();
  const geos = [];
  const mats = [];
  const mk = (geo, color, op) => {
    geos.push(geo);
    const m = new TH.MeshBasicMaterial({ color: new TH.Color(color), transparent: true, opacity: op, depthWrite: false, side: TH.DoubleSide, blending: TH.AdditiveBlending });
    m.userData = { base: op };
    mats.push(m);
    return new TH.Mesh(geo, m);
  };
  const col = opt.color || '#fff3c4';
  const vert = mk(new TH.BoxGeometry(3 * s, 28 * s, 3 * s), col, 0.9); g.add(vert);
  const horiz = mk(new TH.BoxGeometry(16 * s, 3 * s, 3 * s), col, 0.9); horiz.position.y = 7 * s; g.add(horiz);
  // 外發光（稍大、半透）
  const glowV = mk(new TH.BoxGeometry(6.5 * s, 33 * s, 1.5 * s), WHITE, 0.35); g.add(glowV);
  const glowH = mk(new TH.BoxGeometry(20 * s, 6.5 * s, 1.5 * s), WHITE, 0.35); glowH.position.y = 7 * s; g.add(glowH);
  g.userData = {
    geos, mats,
    setAlpha(a) { for (const m of mats) m.opacity = m.userData.base * a; },
    geo: { dispose() { for (const x of geos) x.dispose(); } },
    mat: { dispose() { for (const x of mats) x.dispose(); } },
  };
  return g;
}

// ── 制裁之光：頭頂降臨的大天使（独立 addTransient，比 0.5s 傷害區存活更久供欣賞）─
function spawnSanctionAngel(ctx, cx, cz) {
  const TH = ctx.THREE;
  const angel = buildAngel(TH, { scale: 2.4 });
  angel.position.set(cx, 190, cz);
  // 自天使向下投射的聖光錐（放大覆蓋更大的聖域）
  const coneGeo = new TH.ConeGeometry(58, 170, 24, 1, true);
  const coneMat = new TH.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.5, depthWrite: false, side: TH.DoubleSide, blending: TH.AdditiveBlending });
  coneMat.userData = { base: 0.5 };
  const lightCone = new TH.Mesh(coneGeo, coneMat); lightCone.position.y = -86; angel.add(lightCone);
  angel.userData.geos.push(coneGeo); angel.userData.mats.push(coneMat);

  const smooth = (k) => k * k * (3 - 2 * k);
  ctx.addTransient(angel, 1.5, (grp, t) => {
    // 降臨 → 懸停 → 升空淡出
    let y;
    if (t < 0.24) y = 190 - 68 * smooth(t / 0.24);
    else if (t < 0.72) y = 122 + Math.sin((t - 0.24) * 7) * 3;
    else y = 122 + 96 * ((t - 0.72) / 0.28) * ((t - 0.72) / 0.28);
    grp.position.y = y;
    const fadeIn = Math.min(1, t / 0.16);
    const fadeOut = t > 0.74 ? Math.max(0, 1 - (t - 0.74) / 0.26) : 1;
    grp.userData.setAlpha(fadeIn * fadeOut);
    const flap = Math.sin(t * Math.PI * 3.4) * 0.22;
    grp.userData.wingR.rotation.z = -0.18 - flap;
    grp.userData.wingL.rotation.z = 0.18 + flap;
    grp.userData.halo.rotation.z += 0.06;
  });
  // 飄落的聖光點
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * 60;
    ctx.particles.spawn({ x: cx + Math.cos(a) * rr, y: 110 + Math.random() * 40, z: cz + Math.sin(a) * rr, vx: 0, vy: -90 - Math.random() * 60, vz: 0, drag: 0.5, life: 0.9, size: 3.2 + Math.random() * 2, color: Math.random() < 0.5 ? LIGHT : GOLD, fade: true });
  }
}

// 大絕招 — 天堂審判：天使環 + 聖十字環 + 天降巨型聖光柱 + 持續灼燒聖域
registerVfx('paladin_ultimate', {
  onCast(ctx, f, c) {
    addShake(ctx, 10);
    addFlash(ctx, 0.3, LIGHT);
    column(ctx, c, { color: [GOLD, LIGHT], count: 30, radius: 30, speed: 200, life: 0.8 });
    ring(ctx, c, { color: GOLD, from: 12, to: 92, life: 0.5, y: 3, alpha: 0.8, ease: true });
  },
  zone(ctx, z) {
    const TH = ctx.THREE;
    const R = z.radius || 150;
    const g = new TH.Group();
    const geos = [], mats = [];
    const reg = (geo, mat) => { geos.push(geo); mats.push(mat); };

    // 地面聖光圓盤 + 旋轉雙十字 + 外環
    const discGeo = new TH.CircleGeometry(R, 36);
    const discMat = new TH.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const disc = new TH.Mesh(discGeo, discMat); disc.rotation.x = -Math.PI / 2; disc.position.y = 1.1; g.add(disc); reg(discGeo, discMat);
    const rimGeo = new TH.RingGeometry(R * 0.93, R, 40);
    const rimMat = new TH.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.8, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const rim = new TH.Mesh(rimGeo, rimMat); rim.rotation.x = -Math.PI / 2; rim.position.y = 1.3; g.add(rim); reg(rimGeo, rimMat);

    const crossMat = new TH.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.5, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const crossGrp = new TH.Group(); crossGrp.position.y = 1.5;
    const cvGeo = new TH.PlaneGeometry(R * 0.16, R * 1.7), chGeo = new TH.PlaneGeometry(R * 1.7, R * 0.16);
    const cv = new TH.Mesh(cvGeo, crossMat), ch = new TH.Mesh(chGeo, crossMat);
    cv.rotation.x = ch.rotation.x = -Math.PI / 2; crossGrp.add(cv); crossGrp.add(ch); g.add(crossGrp); reg(cvGeo, crossMat); reg(chGeo, crossMat);

    // 巨型聖光柱
    const pillarGeo = new TH.CylinderGeometry(R * 0.42, R * 0.5, 240, 24, 1, true);
    const pillarMat = new TH.MeshBasicMaterial({ color: 0xfff7d0, transparent: true, opacity: 0.0, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const beam = new TH.Mesh(pillarGeo, pillarMat); beam.position.y = 120; g.add(beam); reg(pillarGeo, pillarMat);

    // 天空天使環（建一次、update 動畫）
    const angels = [];
    const NA = 7;
    for (let i = 0; i < NA; i++) {
      const a = buildAngel(TH, { scale: 1.05 });
      a.userData.ang = (i / NA) * Math.PI * 2;
      a.userData.orbR = R * (0.66 + (i % 2) * 0.2);
      a.userData.yBase = 178 + (i % 3) * 28;
      g.add(a); angels.push(a);
    }
    // 聖十字環
    const crosses = [];
    const NX = 5;
    for (let i = 0; i < NX; i++) {
      const cr = buildCross(TH, { scale: 1.8 });
      cr.userData.ang = (i / NX) * Math.PI * 2 + 0.3;
      g.add(cr); crosses.push(cr);
    }

    g.userData.geo = { dispose: () => geos.forEach((x) => x.dispose()) };
    g.userData.mat = { dispose: () => mats.forEach((x) => x.dispose()) };
    const totalDelay = Math.max(0.0001, z.delay || 0.4);
    let landed = false;
    let t0 = 0;

    return {
      object3D: g,
      update(dt, zz) {
        t0 += dt;
        crossGrp.rotation.y += dt * 0.5;
        rim.rotation.z -= dt * 0.6;
        const entrance = Math.min(1, t0 / 0.5);
        const lifeFade = zz.lifetime > 0 ? Math.min(1, zz.lifetime / 0.7) : 0;

        // 天使環：緩慢環繞 + 緩降 + 拍翅
        for (const a of angels) {
          a.userData.ang += dt * 0.32;
          const ang = a.userData.ang;
          const y = Math.max(74, a.userData.yBase - t0 * 13);
          a.position.set(Math.cos(ang) * a.userData.orbR, y, Math.sin(ang) * a.userData.orbR);
          a.rotation.y = -ang + Math.PI / 2;
          const flap = Math.sin(t0 * 6 + ang) * 0.26;
          a.userData.wingR.rotation.z = -0.18 - flap;
          a.userData.wingL.rotation.z = 0.18 + flap;
          a.userData.halo.rotation.z += 0.05;
          a.userData.setAlpha(entrance * lifeFade);
        }
        // 聖十字環：旋繞 + 脈動上下浮
        for (const cr of crosses) {
          cr.userData.ang += dt * 0.22;
          const ang = cr.userData.ang;
          cr.position.set(Math.cos(ang) * R * 0.92, 34 + Math.sin(t0 * 1.6 + ang) * 6, Math.sin(ang) * R * 0.92);
          cr.rotation.y = -ang;
          cr.userData.setAlpha((0.7 + 0.3 * Math.sin(t0 * 3 + ang)) * entrance * lifeFade);
        }

        if (zz.delay > 0) {
          const fill = 1 - zz.delay / totalDelay;
          pillarMat.opacity = 0.15 + 0.2 * fill;
          beam.scale.x = beam.scale.z = 0.3 + fill * 0.7;
        } else {
          if (!landed) {
            landed = true;
            const cc = { x: g.position.x, y: 16, z: g.position.z };
            ultimateBurst(ctx, cc, { color: LIGHT, radius: R, pillarH: 220, pillarR: 36, shake: 16, flash: 0.32 });
            for (let i = 0; i < 30; i++) { const a = Math.random() * Math.PI * 2, sp = 200 + Math.random() * 200; ctx.particles.spawn({ x: cc.x, y: 6, z: cc.z, vx: Math.cos(a) * sp, vy: 120 + Math.random() * 220, vz: Math.sin(a) * sp, gravity: 220, drag: 1.8, life: 0.6, size: 4 + Math.random() * 4, color: Math.random() < 0.5 ? GOLD : LIGHT, fade: true }); }
          }
          const pulse = 0.55 + 0.25 * Math.sin(performance.now() / 90);
          pillarMat.opacity = 0.32 * pulse * (lifeFade > 0 ? 1 : 0);
          beam.scale.x = beam.scale.z = 1;
          discMat.opacity = (0.18 + 0.1 * pulse) * Math.max(0.2, lifeFade);
          // 持續飄落聖光點
          if (Math.random() < 0.5) ctx.particles.spawn({ x: g.position.x + (Math.random() - 0.5) * R * 1.6, y: 90, z: g.position.z + (Math.random() - 0.5) * R * 1.6, vx: 0, vy: -120, vz: 0, drag: 0.6, life: 0.8, size: 3.5, color: LIGHT, fade: true });
        }
      },
    };
  },
});

// 神聖衝鋒落地的「奉獻聖土」：金色聖焰地表（裂紋網 + 中央焰柱 + 上升火星）
registerVfx('paladin_consecration', {
  zone(ctx, z) {
    const TH = ctx.THREE;
    const R = z.radius || 130;
    const g = new TH.Group();

    // 地表熔光圓盤 + 外環
    const baseGeo = new TH.CircleGeometry(R, 40);
    const baseMat = new TH.MeshBasicMaterial({ color: 0xffb52e, transparent: true, opacity: 0.3, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const base = new TH.Mesh(baseGeo, baseMat); base.rotation.x = -Math.PI / 2; base.position.y = 0.6; g.add(base);
    const rimGeo = new TH.RingGeometry(R * 0.88, R, 44);
    const rimMat = new TH.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.85, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const rim = new TH.Mesh(rimGeo, rimMat); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.8; g.add(rim);

    // 放射裂紋網（細長發光條，模擬熔岩裂縫）
    const crackMat = new TH.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.78, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const crackGrp = new TH.Group(); crackGrp.position.y = 0.9;
    const NC = 11;
    for (let i = 0; i < NC; i++) {
      const len = R * (0.5 + Math.random() * 0.45);
      const w = 2.2 + Math.random() * 2.4;
      const slot = new TH.Group();
      slot.rotation.y = (i / NC) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const cm = new TH.Mesh(new TH.PlaneGeometry(len, w), crackMat);
      cm.rotation.x = -Math.PI / 2; cm.position.x = len * 0.5;
      slot.add(cm); crackGrp.add(slot);
    }
    g.add(crackGrp);

    let first = true, emit = 0;
    return {
      object3D: g,
      update(dt, zz) {
        if (first) {
          first = false;
          const cc = { x: g.position.x, y: 4, z: g.position.z };
          ring(ctx, cc, { color: GOLD, from: 20, to: R, life: 0.5, y: 3, alpha: 0.9, ease: true });
          sphereFlash(ctx, cc, { color: LIGHT, from: 8, to: R * 0.5, life: 0.28, alpha: 0.85 });
          addShake(ctx, 5);
        }
        const t = performance.now() / 1000;
        const fade = zz.lifetime > 0 ? Math.min(1, zz.lifetime / 0.8) : 0;
        base.material.opacity = (0.22 + 0.12 * Math.sin(t * 5)) * fade;
        rim.material.opacity = (0.6 + 0.25 * Math.sin(t * 4 + 1)) * fade;
        crackMat.opacity = (0.55 + 0.28 * Math.sin(t * 7)) * fade;
        // 持續上升火星（壓低高度，維持地面焰感、不形成光柱）
        emit += dt;
        while (emit > 0.045 && fade > 0.2) {
          emit -= 0.045;
          const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * R * 0.92;
          ctx.particles.spawn({ x: g.position.x + Math.cos(a) * rr, y: 2, z: g.position.z + Math.sin(a) * rr, vx: 0, vy: 40 + Math.random() * 55, vz: 0, gravity: 10, drag: 1.1, life: 0.4 + Math.random() * 0.3, size: 2.6 + Math.random() * 2.4, color: Math.random() < 0.45 ? WHITE : (Math.random() < 0.6 ? GOLD : '#ffb52e'), fade: true });
        }
      },
    };
  },
});

registerVfx('paladin_smite', {
  onCast(ctx, f, c) {
    slashBlade(ctx, c, f.facing, { color: LIGHT, len: f.range * 1.1, w: 16, swing: (f.arc || 1.4), life: 0.22 });
    slashBlade(ctx, c, f.facing, { color: GOLD, len: f.range, w: 24, swing: (f.arc || 1.4), life: 0.26 });
    cone(ctx, c, f.facing, { color: [GOLD, LIGHT, '#ffecb3'], count: 14, speed: 240, spread: (f.arc || 1.4) / 2, offset: f.range * 0.4, up: 36, life: 0.32, size: 4 });
    addFlash(ctx, 0.1, GOLD);
  },
});

registerVfx('paladin_charge', {
  onCast(ctx, f, c) {
    const TH = ctx.THREE;
    ring(ctx, c, { color: GOLD, from: 10, to: 96, life: 0.4, y: 2, alpha: 0.85, ease: true });
    sphereFlash(ctx, c, { color: LIGHT, from: 8, to: 46, life: 0.3, alpha: 0.85 });
    cone(ctx, c, f.facing, { color: [GOLD, '#ffecb3'], count: 16, speed: 360, spread: 0.4, offset: 30, life: 0.4, size: 4 });
    // 前衝聖光十字盾
    const shGeo = new TH.PlaneGeometry(40, 52);
    const shMat = new TH.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.75, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const sh = new TH.Mesh(shGeo, shMat);
    sh.position.set(c.x + Math.cos(f.facing) * 24, 20, c.z + Math.sin(f.facing) * 24); sh.rotation.y = -f.facing + Math.PI / 2;
    ctx.addTransient(sh, 0.34, (m, t) => { m.material.opacity = (1 - t) * 0.75; m.scale.setScalar(1 + t * 0.4); });
    sh.userData.geo = shGeo; sh.userData.mat = shMat;
    addShake(ctx, 6);
  },
});

registerVfx('paladin_sanction', {
  zone(ctx, z) {
    const TH = ctx.THREE;
    const R = z.radius || 170;
    const g = new TH.Group();
    const discGeo = new TH.CircleGeometry(R, 32);
    const discMat = new TH.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.4, blending: TH.AdditiveBlending, depthWrite: false, side: TH.DoubleSide });
    const disc = new TH.Mesh(discGeo, discMat); disc.rotation.x = -Math.PI / 2; disc.position.y = 1.2; g.add(disc);
    g.userData.geo = discGeo; g.userData.mat = discMat;
    let first = true;
    return {
      object3D: g,
      update(dt, zz) {
        if (first) {
          first = false;
          const cc = { x: g.position.x, y: 6, z: g.position.z };
          ring(ctx, cc, { color: GOLD, from: 14, to: R * 1.05, life: 0.5, y: 3, alpha: 0.95, ease: true });
          ring(ctx, cc, { color: LIGHT, from: 8, to: R * 0.7, life: 0.4, y: 6, alpha: 0.8 });
          column(ctx, cc, { color: [GOLD, LIGHT], count: 22, radius: R * 0.5, speed: 170, life: 0.6 });
          sphereFlash(ctx, cc, { color: LIGHT, from: 8, to: R * 0.6, life: 0.3, alpha: 0.9 });
          addShake(ctx, 7); addFlash(ctx, 0.14, GOLD);
          // 頭頂降臨大天使
          spawnSanctionAngel(ctx, g.position.x, g.position.z);
        }
        const a = zz.lifetime > 0 ? Math.min(1, zz.lifetime / 0.5) : 0;
        discMat.opacity = 0.4 * a;
      },
    };
  },
});
