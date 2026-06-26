// @ts-nocheck
// 忍者：隱密、影分身、處決。手裏劍 / 定身符 / 影襲·處決瞬移爆斬 / 千影殘影亂舞。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, burst, column, slashBlade, sphereFlash, cone, addShake, addFlash } from '../../../render3d/vfx/lib.js';

// 書法墨字貼圖（影襲落點的「影」字殘影）
function createCalligraphyTexture(text, colorStr = '#1a1a1a', size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size * 0.45);
  grad.addColorStop(0, 'rgba(44, 62, 80, 0.25)');
  grad.addColorStop(0.5, 'rgba(26, 37, 48, 0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colorStr;
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const dist = size * 0.3;
    const r = size * 0.04;
    ctx.beginPath();
    ctx.arc(size / 2 + Math.cos(angle) * dist, size / 2 + Math.sin(angle) * dist, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `bold ${size * 0.65}px "Kaiti", "STKaiti", "SimSun", "Microsoft YaHei", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, size / 2, size / 2);
  return new THREE.CanvasTexture(canvas);
}

// 一道「影分身」殘影（半透明三角錐）+ 斬擊刀光，用於處決與千影的每一擊
function shadowCloneStrike(ctx, c, facing, { big = false, slashColor = '#eaf2ff' } = {}) {
  const TH = ctx.THREE;
  const cloneGeo = new TH.ConeGeometry(big ? 13 : 10, big ? 32 : 24, 5);
  // 發光殘影（青白＋additive）→ 在暗場上也清楚可見（舊版近黑色 NormalBlending 幾乎看不到）
  const cloneMat = new TH.MeshBasicMaterial({ color: big ? 0xcfeaff : 0x86bce6, transparent: true, opacity: 0.9, blending: TH.AdditiveBlending, depthWrite: false });
  const clone = new TH.Mesh(cloneGeo, cloneMat);
  clone.position.set(c.x, big ? 15 : 12, c.z);
  clone.rotation.x = Math.PI / 2;
  clone.rotation.y = -facing;
  ctx.addTransient(clone, big ? 0.4 : 0.34, (mesh, t) => {
    mesh.position.x = c.x - Math.cos(facing) * t * (big ? 26 : 18);
    mesh.position.z = c.z - Math.sin(facing) * t * (big ? 26 : 18);
    cloneMat.opacity = 0.85 * (1 - t);
    mesh.scale.setScalar(1 + t * 0.5);
  });
  clone.userData.geo = cloneGeo;
  clone.userData.mat = cloneMat;

  // 交叉斬：亮白主刃 + 影色副刃
  slashBlade(ctx, c, facing, { color: slashColor, len: big ? 96 : 64, w: big ? 13 : 8, swing: 1.7, life: big ? 0.24 : 0.18 });
  slashBlade(ctx, c, facing + 0.5, { color: '#2c3e50', len: big ? 80 : 54, w: big ? 9 : 6, swing: -1.5, life: big ? 0.22 : 0.16 });
  burst(ctx, c, { color: ['#10161f', '#2c3e50', '#9aa4b2'], count: big ? 18 : 10, speed: big ? 240 : 150, up: 30, life: 0.4, size: big ? 4.5 : 3 });
}

// 一個「半透明忍者殘影分身」：直接複製忍者本體模型（ctx.createCharacterModel('ninja')），
//   把所有材質改半透明＋微弱冷色自發光（暗場上看得見輪廓、又保留忍者本色），隱藏地面陰影圈。
//   回傳 model（THREE.Group）與其材質清單 mats（供逐幀調整透明度）。
//   createModel 由 fxbus 經 ctx 注入（render 層匯入，避免角色層循環依賴）。
function buildCloneModel(createModel) {
  const model = createModel('ninja');
  const mats = [];
  model.traverse((o) => {
    // 半透明殘影不需要地面接觸陰影圈
    if (o.geometry && o.geometry.type === 'CircleGeometry') { o.visible = false; return; }
    const list = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of list) {
      m.transparent = true;
      m.depthWrite = false;
      m.opacity = 0.6;
      if (m.emissive !== undefined && m.emissive) {        // 冷色幽光 → 殘影感、確保可見
        m.emissive = new THREE.Color(0x49b3ff);
        m.emissiveIntensity = 0.55;
      }
      mats.push(m);
    }
  });
  return { model, mats };
}

// 大絕 — 千影：召出一圈發光影分身俯衝亂斬（cast）＋每次瞬斬的命中閃光（strike）
registerVfx('ninja_ultimate', {
  onCast(ctx, f, c) {
    if (f.type === 'ultimate') {
      addShake(ctx, 16);
      addFlash(ctx, 0.32, '#1a2433');
      ring(ctx, c, { color: '#9fd2ff', from: 16, to: 210, life: 0.6, y: 4, alpha: 0.9, ease: true });
      ring(ctx, c, { color: '#2c3e50', from: 8, to: 150, life: 0.45, y: 8, alpha: 0.8 });
      sphereFlash(ctx, c, { color: '#dff1ff', from: 10, to: 120, life: 0.34, alpha: 0.95 });
      // 施放瞬間的爆發（真正的「5 個分身」由 ninja_clones 在目標處持續顯示）
      burst(ctx, c, { color: ['#86bce6', '#cfeaff', '#2c3e50'], count: 44, speed: 340, up: 70, life: 0.7, size: 5 });
      column(ctx, c, { color: ['#9fd2ff', '#dff1ff'], count: 16, radius: 30, speed: 150, life: 0.6, size: 4 });
    } else {
      // 每次瞬斬命中：發光殘影 + 斬光
      shadowCloneStrike(ctx, c, f.facing || 0, { big: false, slashColor: '#eaf5ff' });
    }
  },
});

// 千影分身：在最近目標四周「拉開到普攻射程的環」上召出 5 個半透明忍者本體殘影分身，
//   整段大招期間站在環上、各自錯開節奏朝目標突進斬一刀再退回（看得到 5 個真．忍者圍攻）。
//   由 ninja/clones.ts 的 tick 在取得目標時發出一次（type 'buff'），orbit 由 ult 的 orbit 帶入。
registerVfx('ninja_clones', {
  onCast(ctx, f, c) {
    const N = 5;
    const orbit = f.radius || 190;                  // 環半徑：拉到普攻交戰距離，不再貼著目標
    const dur = f.life || 3.5;
    addShake(ctx, 6);
    addFlash(ctx, 0.16, '#1a2433');
    const createModel = ctx.createCharacterModel;
    if (!createModel) return;                        // 保險：render 層未注入則略過（不致崩潰）
    for (let i = 0; i < N; i++) {
      const ang = (i / N) * Math.PI * 2 - Math.PI / 2;       // 由正上方均分一圈
      const cx = c.x + Math.cos(ang) * orbit;
      const cz = c.z + Math.sin(ang) * orbit;
      const ux = (c.x - cx) / orbit, uz = (c.z - cz) / orbit; // 指向目標的單位向量
      const faceIn = Math.atan2(c.z - cz, c.x - cx);
      const { model, mats } = buildCloneModel(createModel);
      model.position.set(cx, 0, cz);
      model.rotation.y = -faceIn;                            // 面向目標
      // 只 dispose 逐實例 geometry / material；貼圖由 _texCache 共用，不可 dispose
      model.userData.geo = { dispose() { model.traverse((o) => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); }); } };
      model.userData.mat = { dispose() { for (const m of mats) m.dispose(); } };
      const st = { phase: 'idle', next: 0.3 + i * 0.12, start: 0, struck: false }; // 突進狀態機（錯開）
      ctx.addTransient(model, dur, (m, t) => {
        const age = t * dur;
        const fadeIn = Math.min(1, age / 0.22), fadeOut = Math.min(1, (1 - t) / 0.3);
        const alpha = Math.min(fadeIn, fadeOut);
        for (const mt of mats) mt.opacity = 0.68 * alpha;
        // 突進斬：到時間 → 朝目標衝一小段、半程斬一刀、再退回 → 回 idle 等下一輪
        let lunge = 0;
        if (st.phase === 'idle' && age >= st.next) { st.phase = 'lunge'; st.start = age; st.struck = false; }
        if (st.phase === 'lunge') {
          const lt = (age - st.start) / 0.26;
          if (lt >= 1) { st.phase = 'idle'; st.next = age + 0.4 + (i % 3) * 0.08; }
          else {
            lunge = Math.sin(lt * Math.PI) * 54;
            if (!st.struck && lt >= 0.45) {                  // 衝到半程 → 在目標處斬一刀
              st.struck = true;
              slashBlade(ctx, { x: c.x, z: c.z }, faceIn, { color: '#dff1ff', len: 70, w: 9, swing: 1.7, life: 0.16 });
            }
          }
        }
        const slideIn = (1 - fadeIn) * orbit * 0.3;           // 入場：自外側淡入滑進定位
        m.position.x = cx + ux * (lunge - slideIn);
        m.position.z = cz + uz * (lunge - slideIn);
        m.position.y = Math.sin(age * 5 + i) * 1.5;           // 輕浮動
      });
    }
  },
});

// 大絕招 — 影襲·處決：瞬移到被控目標背後的致命爆斬
registerVfx('ninja_shadowstrike', {
  onCast(ctx, f, c) {
    const big = !!f.big; // 命中被控目標的處決（big）vs 退化瞬移（一般）
    addShake(ctx, big ? 13 : 6);
    addFlash(ctx, big ? 0.26 : 0.12, big ? '#0e1622' : '#2c3e50');

    // 落點「影」字殘影（僅處決時）
    if (big) {
      const tex = createCalligraphyTexture('影', '#0b0f16');
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(c.x, 18, c.z);
      sprite.scale.set(34, 34, 1);
      ctx.addTransient(sprite, 0.6, (mesh, t) => { mesh.position.y = 18 + t * 26; mat.opacity = 0.95 * (1 - t); mesh.scale.setScalar(34 * (1 + t * 0.4)); });
      sprite.userData.geo = { dispose() { tex.dispose(); } };
      sprite.userData.mat = mat;
    }

    // 主視覺：殘影 + 巨型處決斬
    shadowCloneStrike(ctx, c, f.facing || 0, { big, slashColor: big ? '#ffffff' : '#cfd8dc' });
    if (big) {
      sphereFlash(ctx, c, { color: '#eef4ff', from: 8, to: 70, life: 0.24, alpha: 0.98 });
      ring(ctx, c, { color: '#2c3e50', from: 6, to: 110, life: 0.4, y: 8, ease: true });
      cone(ctx, c, f.facing || 0, { color: ['#0e1622', '#2c3e50', '#9aa4b2'], count: 22, speed: 360, spread: 0.6, offset: 30, up: 36, life: 0.45, size: 4 });
    } else {
      ring(ctx, c, { color: '#636e72', from: 4, to: 56, life: 0.3, y: 6, alpha: 0.8 });
    }
  },
});

registerVfx('ninja_shuriken', {
  projectile(ctx, pr) {
    const TH = ctx.THREE;
    const g = new TH.Group();
    const mat = new TH.MeshStandardMaterial({ color: 0x151b24, emissive: 0x2c3e50, emissiveIntensity: 1.5, metalness: 0.9, roughness: 0.15, side: TH.DoubleSide });
    const r = pr.radius * 2.2;
    const aGeo = new TH.BoxGeometry(r * 2, 0.8, r * 0.45);
    const bGeo = new TH.BoxGeometry(r * 0.45, 0.8, r * 2);
    const hubGeo = new TH.CylinderGeometry(r * 0.28, r * 0.28, 1.2, 8);
    const a = new TH.Mesh(aGeo, mat), b = new TH.Mesh(bGeo, mat), hub = new TH.Mesh(hubGeo, mat);
    g.add(a, b, hub);
    g.userData.geo = { dispose() { aGeo.dispose(); bGeo.dispose(); hubGeo.dispose(); } };
    g.userData.mat = mat;
    return {
      object3D: g,
      update(dt) {
        g.rotation.y += dt * 32;
        if (Math.random() < 0.65) {
          ctx.particles.spawn({ x: g.position.x + (Math.random() - 0.5) * 1.5, y: g.position.y, z: g.position.z + (Math.random() - 0.5) * 1.5, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, vz: (Math.random() - 0.5) * 8, drag: 3, life: 0.28 + Math.random() * 0.22, size: pr.radius * (1.3 + Math.random() * 0.7), color: Math.random() < 0.65 ? '#1a1a1a' : '#2c3e50', fade: true });
        }
      },
    };
  },
  onHit(ctx, f, c) {
    ring(ctx, c, { color: '#2c3e50', from: 4, to: (f.radius || 14) * 2.8, life: 0.32, y: 8, alpha: 0.85 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const spd = 70 + (i % 5) * 24;
      ctx.particles.spawn({ x: c.x, y: 8, z: c.z, vx: Math.cos(a) * spd, vy: 50 + (i % 4) * 22, vz: Math.sin(a) * spd, drag: 1.8, life: 0.42 + (i % 3) * 0.1, size: 3.5 + (i % 3) * 1.4, color: i % 2 ? '#1a1a1a' : '#2c3e50', fade: true });
    }
  },
});

registerVfx('ninja_bind', {
  projectile(ctx, pr) {
    const TH = ctx.THREE;
    const g = new TH.Group();
    const talGeo = new TH.BoxGeometry(pr.radius * 2.5, 0.4, pr.radius * 1.2);
    const talMat = new TH.MeshStandardMaterial({ color: 0x210e30, emissive: 0x9b59b6, emissiveIntensity: 2.2, roughness: 0.5 });
    const tal = new TH.Mesh(talGeo, talMat);
    g.add(tal);
    g.userData.geo = talGeo;
    g.userData.mat = talMat;
    return {
      object3D: g,
      update(dt) {
        tal.rotation.y += dt * 10;
        tal.rotation.x += dt * 5;
        ctx.particles.spawn({ x: g.position.x, y: g.position.y, z: g.position.z, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, vz: (Math.random() - 0.5) * 12, drag: 3, life: 0.24, size: pr.radius * 0.9, color: Math.random() < 0.6 ? '#636e72' : '#9b59b6', fade: false });
      },
    };
  },
  onHit(ctx, f, c) {
    const TH = ctx.THREE;
    ring(ctx, c, { color: '#9b59b6', from: 4, to: (f.radius || 11) * 2.8, life: 0.5, y: 8 });
    // 定身的纏縛繩環（拉長為 2 秒定身，視覺更明顯）
    const ropeGeo = new TH.CylinderGeometry(f.radius || 12, f.radius || 12, 32, 8, 1, true);
    const ropeMat = new TH.MeshBasicMaterial({ color: 0x2c3e50, transparent: true, opacity: 0.85, side: TH.DoubleSide, depthWrite: false });
    const rope = new TH.Mesh(ropeGeo, ropeMat);
    rope.position.set(c.x, 16, c.z);
    ctx.addTransient(rope, 0.9, (mesh, t) => { mesh.scale.set(1 - t * 0.25, 1, 1 - t * 0.25); mesh.rotation.y += 0.06; mesh.material.opacity = 0.85 * (1 - t); });
    rope.userData.geo = ropeGeo;
    rope.userData.mat = ropeMat;
    burst(ctx, c, { color: ['#2c3e50', '#9b59b6', '#000000'], count: 14, speed: 130, up: 30, life: 0.5 });
  },
});
