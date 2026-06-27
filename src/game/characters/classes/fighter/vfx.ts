// @ts-nocheck
// 武僧（格鬥家）：聚氣→爆發。連環拳(掌風) / 聚氣(集氣球) / 不動明王(金身免傷) / 真·昇龍霸(化龍砸地·地裂)。
import * as THREE from 'three';
import { registerVfx } from '../../../render3d/vfx/registry.js';
import { ring, pillar, burst, cone, sphereFlash, slashBlade, addShake, addFlash } from '../../../render3d/vfx/lib.js';

// 大字字板（真·昇龍霸）：canvas 貼圖 → sprite，金底黑描邊。
function makeTextSprite(text, colorStr) {
  const cv = document.createElement('canvas');
  cv.width = 640; cv.height = 200;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  g.font = 'bold 120px "PingFang TC","Microsoft YaHei","Heiti TC",sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 16; g.strokeStyle = 'rgba(60,28,0,0.92)'; g.strokeText(text, cv.width / 2, cv.height / 2);
  g.shadowColor = 'rgba(255,180,40,0.9)'; g.shadowBlur = 24;
  g.fillStyle = colorStr; g.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return tex;
}

// ── 連環拳（普攻）：俐落掌風／拳勁，不再是「噴方塊」。
registerVfx('fighter_combo', {
  onCast(ctx, f, c) {
    const dx = Math.cos(f.facing), dz = Math.sin(f.facing);
    const R = f.range || 95;
    const hit = { x: c.x + dx * R * 0.7, z: c.z + dz * R * 0.7 };
    // 揮擊弧光（手勢）
    slashBlade(ctx, c, f.facing, { color: '#ffe9a8', len: R * 1.0, w: 7, swing: 1.3, life: 0.13 });
    // 前方拳勁尖（細長錐、朝目標衝出後淡出）
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const wedge = new THREE.Mesh(new THREE.ConeGeometry(5, 22, 6), mat);
    const g = new THREE.Group(); g.add(wedge); wedge.rotation.z = -Math.PI / 2; // 尖朝 +X
    g.position.set(c.x, 16, c.z); g.rotation.y = -f.facing;
    g.userData.geo = { dispose() { wedge.geometry.dispose(); } }; g.userData.mat = mat;
    ctx.addTransient(g, 0.15, (m, t) => {
      m.position.x = c.x + dx * R * (0.2 + t * 0.7);
      m.position.z = c.z + dz * R * (0.2 + t * 0.7);
      mat.opacity = 0.9 * (1 - t); m.scale.set(1 + t * 0.7, 1, 1);
    });
    // 命中震波 + 火花
    sphereFlash(ctx, hit, { color: '#fff3c8', from: 4, to: 26, life: 0.16, alpha: 0.95 });
    ring(ctx, hit, { color: '#ffd76a', from: 2, to: 30, life: 0.2, y: 3, ease: true });
    for (let i = 0; i < 8; i++) {
      const a = f.facing + (Math.random() - 0.5) * 1.2, spd = 120 + Math.random() * 120;
      ctx.particles.spawn({ x: hit.x, y: 14, z: hit.z, vx: Math.cos(a) * spd, vy: 40 + Math.random() * 60, vz: Math.sin(a) * spd, gravity: 240, drag: 2, life: 0.3, size: 3, color: '#ffe9a8', fade: true });
    }
  },
});

// ── 聚氣（K）：向心匯聚的金氣凝成一顆氣球。chi 越高、爆光越亮。
registerVfx('fighter_qi', {
  onCast(ctx, f, c) {
    const chi = f.chi || 1;
    const full = !!f.full;                                  // 滿氣＝赤紅
    const col = full ? '#ff7a44' : '#ffd76a';
    const col2 = full ? '#ff3320' : '#ffe9a8';
    addFlash(ctx, full ? 0.14 : 0.08, col2);
    sphereFlash(ctx, c, { color: full ? '#ffd0b4' : '#fff3c8', from: 6, to: 22 + chi * 3, life: 0.28, alpha: 0.92 });
    // 大而遠的內縮聚氣環（從外圍 95 收束到身上）＋一道副環
    ring(ctx, c, { color: col, from: 96, to: 12, life: 0.34, y: 5, ease: true });
    ring(ctx, c, { color: col2, from: 72, to: 8, life: 0.42, y: 8, alpha: 0.7 });
    pillar(ctx, c, { color: col, h: 60 + chi * 12, r: 10, taper: 0.4, life: 0.42, alpha: 0.62, grow: 0.3 });
    if (full) addFlash(ctx, 0.12, '#ff3320');
    // 自更遠處向心匯聚的氣（更遠、更多、更快）
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, rr = 84 + Math.random() * 28;
      ctx.particles.spawn({ x: c.x + Math.cos(a) * rr, y: 8 + Math.random() * 42, z: c.z + Math.sin(a) * rr, vx: -Math.cos(a) * 205, vy: 26, vz: -Math.sin(a) * 205, gravity: -34, drag: 2.4, life: 0.45, size: 3.6, color: col2, fade: true });
    }
  },
});

// ── 不動明王（L）：金身護體。旋轉金剛多面護罩 + 頭頂佛光輪 + 八邊形種子字腳陣 + 持續上竄的火焰光背。
//   （不動明王＝火生三昧的忿怒護法；用「火焰光背＋金剛護罩」取代原本平淡的半透明穹頂。）
registerVfx('fighter_steelbody', {
  onCast(ctx, f, c) {
    addFlash(ctx, 0.26, '#ffb84a');
    addShake(ctx, 8);
    ring(ctx, c, { color: '#ffd700', from: 6, to: 84, life: 0.5, y: 3, ease: true });
    sphereFlash(ctx, c, { color: '#fff3c8', from: 8, to: 52, life: 0.3, alpha: 0.96 });
    pillar(ctx, c, { color: '#ffcf5a', h: 120, r: 16, taper: 0.4, life: 0.5, alpha: 0.72, grow: 0.3 });

    const DUR = 2.0;
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z);
    // 旋轉金剛多面護罩（faceted wireframe，比平滑穹頂更狠）+ 內層淡實體
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xffca54, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, wireframe: true });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(36, 1), shellMat); shell.position.y = 30; shell.scale.y = 1.2;
    const shell2Mat = new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const shell2 = new THREE.Mesh(new THREE.IcosahedronGeometry(33, 1), shell2Mat); shell2.position.y = 30; shell2.scale.y = 1.2;
    // 頭頂佛光輪
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(22, 1.7, 8, 30), haloMat); halo.rotation.x = Math.PI / 2; halo.position.y = 52;
    // 八邊形種子字腳陣（八小光塊繞八邊外框）
    const glyphMat = new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const footRing = new THREE.Mesh(new THREE.RingGeometry(30, 36, 8), glyphMat); footRing.rotation.x = -Math.PI / 2; footRing.position.y = 2;
    const glyphGeo = new THREE.BoxGeometry(6, 1, 2.4);
    const glyphs = [];
    for (let i = 0; i < 8; i++) { const gm = new THREE.Mesh(glyphGeo, glyphMat); const a = (i / 8) * Math.PI * 2; gm.position.set(Math.cos(a) * 33, 3, Math.sin(a) * 33); gm.rotation.y = -a; g.add(gm); glyphs.push(gm); }
    g.add(shell, shell2, halo, footRing);
    g.userData.geo = { dispose() { shell.geometry.dispose(); shell2.geometry.dispose(); halo.geometry.dispose(); footRing.geometry.dispose(); glyphGeo.dispose(); } };
    g.userData.mat = { dispose() { shellMat.dispose(); shell2Mat.dispose(); haloMat.dispose(); glyphMat.dispose(); } };
    let frame = 0;
    const ownerId = f.owner;                    // 跟隨施法者（金身會跟著走，不再留在原地）
    const getPos = ctx.getEntityPos;
    ctx.addTransient(g, DUR, (m, t) => {
      const fade = t < 0.85 ? 1 : (1 - t) / 0.15;
      const pulse = 0.8 + 0.2 * Math.sin(t * DUR * 9);
      shellMat.opacity = 0.26 * fade * pulse; shell2Mat.opacity = 0.1 * fade;
      haloMat.opacity = 0.9 * fade; glyphMat.opacity = 0.85 * fade * pulse;
      shell.rotation.y += 0.03; shell.rotation.x += 0.012;
      shell2.rotation.y -= 0.022;
      halo.rotation.z += 0.05;
      footRing.rotation.z -= 0.03;
      for (const gm of glyphs) gm.rotation.y += 0.04;
      // 跟隨施法者即時位置（取不到就留在施放點）
      const lp = getPos ? getPos(ownerId) : null;
      const cx = lp ? lp.x : c.x, cz = lp ? lp.z : c.z;
      m.position.set(cx, Math.sin(t * DUR * 5) * 0.8, cz);
      // 火焰光背：持續上竄的金焰（負重力＝往上舔），跟著本體
      if ((frame++ % 2 === 0) && t < 0.9) {
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2, rr = 22 + Math.random() * 14;
          ctx.particles.spawn({ x: cx + Math.cos(a) * rr, y: 4, z: cz + Math.sin(a) * rr, vx: Math.cos(a) * 10, vy: 130 + Math.random() * 130, vz: Math.sin(a) * 10, gravity: -30, drag: 1.6, life: 0.5 + Math.random() * 0.3, size: 4 + Math.random() * 3, color: k % 2 ? '#ffb43a' : '#ffe27a', fade: true });
        }
      }
    });
  },
});

// ── 真·昇龍霸（大招·施放氣爆）：施法者腳下金色氣勁爆發＋衝天前兆（由 casting.ts 自動觸發於施法者）。
registerVfx('fighter_ultimate', {
  onCast(ctx, f, c) {
    addShake(ctx, 10);
    addFlash(ctx, 0.22, '#ffe27a');
    ring(ctx, c, { color: '#ffd700', from: 8, to: 120, life: 0.45, y: 3, ease: true });
    sphereFlash(ctx, c, { color: '#fff7da', from: 8, to: 56, life: 0.3, alpha: 0.95 });
    pillar(ctx, c, { color: '#ffe27a', h: 150, r: 18, taper: 0.3, life: 0.5, alpha: 0.7, grow: 0.4 });
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * 24;
      ctx.particles.spawn({ x: c.x + Math.cos(a) * rr, y: 3, z: c.z + Math.sin(a) * rr, vx: Math.cos(a) * 60, vy: 280 + Math.random() * 220, vz: Math.sin(a) * 60, gravity: 220, drag: 1.2, life: 0.6, size: 4.5, color: '#ffe9a8', fade: true });
    }
  },
});

// ── 真·昇龍霸（大招·落地龍）：飛撲落地點生成。delay≈leap dur 後爆發：砸地震波＋地裂＋金龍衝天＋大字。
//   氣球(chi)越多 → 龍越大、地裂越多越長、字越大。由 risingdragon handler 於落地點送出。
registerVfx('fighter_dragon', {
  onCast(ctx, f, c) {
    const chi = Math.max(0, Math.min(5, f.chi || 0));
    const dur = f.dur || 0.5;                  // 飛撲時間 → 延後到落地才爆
    const scale = 1 + chi * 0.16;              // 氣球越多越大
    const life = f.life || 1.5;

    // 落地前：地面預警圈（標出砸點），落地瞬間消失。
    const warnMat = new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const warn = new THREE.Mesh(new THREE.RingGeometry(54 * scale, 60 * scale, 36), warnMat);
    warn.rotation.x = -Math.PI / 2; warn.position.set(c.x, 2, c.z);
    warn.userData.geo = { dispose() { warn.geometry.dispose(); } }; warn.userData.mat = warnMat;
    ctx.addTransient(warn, dur, (m, t) => { warnMat.opacity = 0.5 * Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(t * 30)); });

    // 落地爆發（單發排程）：用一個隱形計時器在 age>=dur 觸發。
    const timer = new THREE.Object3D();
    let fired = false;
    timer.userData.geo = { dispose() {} }; timer.userData.mat = { dispose() {} };
    ctx.addTransient(timer, life, (m, t) => {
      const age = t * life;
      if (fired || age < dur) return;
      fired = true;
      const hit = { x: c.x, y: c.y, z: c.z };
      const encR = Math.max(34, (f.targetR || 18) * 1.4) + chi * 4;   // 環繞半徑：依目標體型（打大王也繞得住）

      // 1) 砸地：鏡頭重震 + 閃白 + 雙層震環 + 白光球
      addShake(ctx, 20 + chi * 2);
      addFlash(ctx, 0.4, '#fff2c0');
      ring(ctx, hit, { color: '#ffe27a', from: 12, to: Math.max(150, encR * 1.7) + chi * 8, life: 0.5, y: 4, ease: true });
      ring(ctx, hit, { color: '#ffd700', from: 8, to: 90 + chi * 10, life: 0.36, y: 8 });
      sphereFlash(ctx, hit, { color: '#ffffff', from: 10, to: 70, life: 0.26, alpha: 0.98 });

      // 2) 地裂：自砸點向外輻射的發光裂縫（數量/長度隨 chi）。
      const cracks = 6 + chi * 2;
      const crackMat = new THREE.MeshBasicMaterial({ color: 0xffb734, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
      const crackGroup = new THREE.Group(); crackGroup.position.set(hit.x, 1.5, hit.z);
      const crackGeo = new THREE.PlaneGeometry(1, 1);
      const segs = [];
      for (let i = 0; i < cracks; i++) {
        const ang = (i / cracks) * Math.PI * 2 + (i % 2) * 0.25;
        const len = Math.max(96, encR * 1.25) + Math.random() * 60;   // 裂縫伸出目標外，打大王也露得出來
        const seg = new THREE.Mesh(crackGeo, crackMat);
        seg.rotation.x = -Math.PI / 2; seg.rotation.z = -ang;
        seg.position.set(Math.cos(ang) * len * 0.5, 0, Math.sin(ang) * len * 0.5);
        seg.scale.set(len, 1, 1);
        seg.userData.w = 3 + Math.random() * 3;
        crackGroup.add(seg); segs.push(seg);
      }
      crackGroup.userData.geo = { dispose() { crackGeo.dispose(); } };
      crackGroup.userData.mat = crackMat;
      ctx.addTransient(crackGroup, 1.1, (mm, tt) => {
        const grow = Math.min(1, tt / 0.18);
        for (const s of segs) s.scale.z = s.userData.w * grow;
        crackMat.opacity = 0.95 * (1 - Math.max(0, (tt - 0.5) / 0.5));
      });

      // 3) 金龍：自砸點化龍盤旋衝天 —— TubeGeometry 連續蛇身（沿螺旋曲線、由地竄升揭示）
      //    + 背鬃 + 細緻龍頭（吻/角/鬚/眼）。chi 越多龍越粗越長。
      const rise = Math.max(230, encR * 2.0) + chi * 16;  // 竄升高度隨環繞半徑（維持龍體修長、不變扁盤）
      const coils = 3.0, SEG = 48;        // 多繞一圈＝更像蛇身
      const pts = [];
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG, a = u * Math.PI * 2 * coils, rad = encR * (1 - u * 0.42); // 自環繞半徑往上微收
        pts.push(new THREE.Vector3(Math.cos(a) * rad, u * rise, Math.sin(a) * rad));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const bodyR = (3.4 + chi * 0.8) * scale;
      const tubeGeo = new THREE.TubeGeometry(curve, 100, bodyR, 8, false);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xff9a1f, emissiveIntensity: 2.0, metalness: 0.45, roughness: 0.28, transparent: true, opacity: 0.98 });
      const body = new THREE.Mesh(tubeGeo, bodyMat);
      const dragon = new THREE.Group(); dragon.position.set(hit.x, 0, hit.z); dragon.add(body);
      // 背鬃（沿身體小尖刺，隨揭示出現）
      const spikeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
      const spikeGeo = new THREE.ConeGeometry(bodyR * 0.7, bodyR * 2.6, 4);
      const spikes = [];
      for (let i = 4; i < SEG - 1; i += 3) { const u = i / SEG, p = curve.getPoint(u); const sp = new THREE.Mesh(spikeGeo, spikeMat); sp.position.copy(p); sp.userData.u = u; dragon.add(sp); spikes.push(sp); }
      // 龍頭（吻朝 -Z，配合 lookAt 沿切線領頭）
      const headMat = new THREE.MeshStandardMaterial({ color: 0xffe06a, emissive: 0xff8a00, emissiveIntensity: 2.4, metalness: 0.5, roughness: 0.25, transparent: true, opacity: 1 });
      const skullGeo = new THREE.SphereGeometry(7 * scale, 10, 8);
      const snoutGeo = new THREE.ConeGeometry(5.4 * scale, 20 * scale, 6);
      const jawGeo = new THREE.ConeGeometry(4.6 * scale, 13 * scale, 5);
      const hornGeo = new THREE.ConeGeometry(1.8 * scale, 15 * scale, 5);
      const eyeGeo = new THREE.SphereGeometry(1.7 * scale, 8, 8);
      const whiskerGeo = new THREE.CylinderGeometry(0.5 * scale, 0.2 * scale, 24 * scale, 5);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const whiskerMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.85 });
      const headG = new THREE.Group();
      const snout = new THREE.Mesh(snoutGeo, headMat); snout.rotation.x = Math.PI / 2; snout.position.z = -9 * scale;
      const jaw = new THREE.Mesh(jawGeo, headMat); jaw.rotation.x = Math.PI / 2; jaw.position.set(0, -3.2 * scale, -7 * scale); jaw.scale.y = 0.5;
      headG.add(new THREE.Mesh(skullGeo, headMat), snout, jaw);
      for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(hornGeo, headMat); horn.position.set(sx * 3 * scale, 5 * scale, 4 * scale); horn.rotation.set(0.6, 0, sx * 0.2); headG.add(horn);
        const eye = new THREE.Mesh(eyeGeo, eyeMat); eye.position.set(sx * 3.6 * scale, 2 * scale, -5 * scale); headG.add(eye);
        const wh = new THREE.Mesh(whiskerGeo, whiskerMat); wh.position.set(sx * 5 * scale, -1 * scale, -8 * scale); wh.rotation.set(Math.PI / 2, 0, sx * 0.6); headG.add(wh);
      }
      dragon.add(headG);
      dragon.userData.geo = { dispose() { tubeGeo.dispose(); spikeGeo.dispose(); skullGeo.dispose(); snoutGeo.dispose(); jawGeo.dispose(); hornGeo.dispose(); eyeGeo.dispose(); whiskerGeo.dispose(); } };
      dragon.userData.mat = { dispose() { bodyMat.dispose(); spikeMat.dispose(); headMat.dispose(); eyeMat.dispose(); whiskerMat.dispose(); } };
      const idxCount = tubeGeo.index ? tubeGeo.index.count : 0;
      const _tan = new THREE.Vector3(), _hp = new THREE.Vector3(), _q = new THREE.Quaternion();
      const NEG_Z = new THREE.Vector3(0, 0, -1);
      const headScale = 1.6;                                      // 龍頭放大
      ctx.addTransient(dragon, 2.2, (mm, tt) => {
        const prog = Math.min(1, tt / 0.62);                      // 加快竄升（~0.62s）
        if (idxCount) tubeGeo.setDrawRange(0, Math.max(0, Math.floor(idxCount * prog)));
        const hu = Math.min(0.999, prog * 0.999);
        curve.getPoint(hu, _hp); curve.getTangent(hu, _tan);
        headG.position.copy(_hp);
        _q.setFromUnitVectors(NEG_Z, _tan);                       // 龍頭 -Z(吻) 對齊局部切線 → 隨螺旋轉向（修「頭一直朝右」）
        headG.quaternion.copy(_q);
        headG.scale.setScalar(prog > 0.05 ? headScale : 0.001);
        for (const sp of spikes) sp.visible = sp.userData.u <= prog;
        // 揭示完成後整條龍繼續加速竄向天空、邊升邊淡出消失 —— 不再停在原地（尤其打矮目標時）。
        const lift = Math.max(0, tt - 0.62);
        dragon.position.y = lift * 280 + lift * lift * 260;
        const op = Math.max(0, 1 - Math.max(0, (tt - 1.25) / 0.95));  // 升空途中淡出，life 結束(2.2s)歸零
        bodyMat.opacity = 0.98 * op; spikeMat.opacity = 0.92 * op; headMat.opacity = op; whiskerMat.opacity = 0.85 * op;
        // 升空時加速自旋 → 龍「轉著(螺旋)」竄上去，不再像垂直滑上去。
        dragon.rotation.y = tt * 0.5 + lift * 7;
      });

      // 4) 大字「真·昇龍霸」：砸點上方放大字板，punch-in 後上飄淡出。
      const tex = makeTextSprite('真·昇龍霸', '#ffe14a');
      const spMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
      const sprite = new THREE.Sprite(spMat); sprite.position.set(hit.x, 64, hit.z);
      const baseW = 150, baseH = 47;
      sprite.userData.geo = { dispose() { tex.dispose(); } }; sprite.userData.mat = spMat;
      ctx.addTransient(sprite, 1.6, (mm, tt) => {
        const pop = tt < 0.12 ? tt / 0.12 : 1;          // 彈入
        const s = (0.7 + pop * 0.5);
        sprite.scale.set(baseW * s, baseH * s, 1);
        sprite.position.y = 64 + tt * 26;
        spMat.opacity = tt < 0.74 ? Math.min(1, pop) : (1 - tt) / 0.26;
      });

      // 5) 碎石塵爆
      for (let i = 0; i < 46 + chi * 6; i++) {
        const a = Math.random() * Math.PI * 2, spd = 200 + Math.random() * 260;
        ctx.particles.spawn({ x: hit.x, y: 4, z: hit.z, vx: Math.cos(a) * spd, vy: 120 + Math.random() * 240, vz: Math.sin(a) * spd, gravity: 360, drag: 1.1, life: 0.6 + Math.random() * 0.5, size: 4 + Math.random() * 4, color: i % 3 ? '#ffe27a' : '#c98a2e', fade: true });
      }
    });
  },
});
