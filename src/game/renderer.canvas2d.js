// 稍微傾斜的俯視渲染 + HUD (血條/魔力條/名稱/計分)

import {
  TILT, BODY_HEIGHT, PROJECTILE_HEIGHT, PLAYER_RADIUS,
  CANVAS_W, CANVAS_H,
  SHAKE_DECAY, SHAKE_MAX, FLASH_DECAY,
  BOB_AMP, BOB_FREQ, WALK_THRESHOLD,
} from './constants.js';
import { getCharacter } from './characters.js';
import { drawFx } from './render2d/fx.js';
import { drawHUD } from './render2d/hud.js';
import { createParticleSystem } from './render2d/particles.js';
import { drawBar, seeded, shade, sx, sy } from './render2d/utils.js';
import { drawFloor, drawZone } from './render2d/world.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const spriteCache = new Map();

  // ---- 本地視覺狀態 (不進 snapshot) ----
  let lastT = 0;          // 上一幀時間戳 (ms)
  let curDt = 0;          // 本幀 dt (秒)
  const particles = createParticleSystem(ctx);
  const animState = new Map(); // pid -> 走路動畫狀態
  const projTrails = new Map(); // 投射物 id -> 拖尾點
  let seenFx = new Set(); // 已處理過的 fx id (事件去重)
  let shakeMag = 0;       // 畫面震動強度
  let flashA = 0;         // 全畫面閃光 alpha
  let flashColor = '#ffffff';

  // ---- 畫面震動 / 閃光 ----
  function addShake(m) { shakeMag = Math.min(SHAKE_MAX, Math.max(shakeMag, m)); }
  function addFlash(a, color) { if (a >= flashA) { flashA = a; flashColor = color || flashColor; } }
  function updateShakeFlash(dt) {
    shakeMag *= Math.exp(-SHAKE_DECAY * dt); if (shakeMag < 0.3) shakeMag = 0;
    flashA *= Math.exp(-FLASH_DECAY * dt); if (flashA < 0.01) flashA = 0;
  }

  // ---- fx 事件去重 → 觸發一次性粒子爆發 / 震動 / 閃光 ----
  function processFxEvents(state) {
    const cur = new Set();
    for (const f of state.fx) {
      cur.add(f.id);
      if (!seenFx.has(f.id)) onFxSpawn(f);
    }
    seenFx = cur;
  }
  function onFxSpawn(f) {
    switch (f.type) {
      case 'death':
        addShake(17); addFlash(0.5, '#ffffff');
        particles.spawnDebris(f.x, f.y, f.color || '#ffffff', 28);
        particles.spawnSparks(f.x, f.y, BODY_HEIGHT * 0.5, '#ffffff', 22, { speed: 260 });
        break;
      case 'hit': {
        const R = f.radius || 14;
        if (R >= 70) { addShake(13); addFlash(0.3, f.color); particles.spawnDebris(f.x, f.y, f.color, 20); }
        else if (R >= 34) addShake(3.5);
        particles.spawnSparks(f.x, f.y, PROJECTILE_HEIGHT, f.color, Math.min(16, 5 + R / 11), { speed: 150 + R * 1.4 });
        break;
      }
      case 'blink':
        particles.spawnSparks(f.x, f.y, BODY_HEIGHT, f.color, 18, { speed: 200 });
        break;
      case 'dash':
        particles.spawnStreaks(f.x, f.y, f.facing || 0, f.color);
        break;
      case 'melee': {
        const full = f.arc >= 6;
        spawnMeleeSparks(f, full ? 20 : 7);
        if (full) addShake(6);
        break;
      }
      case 'buff':
        particles.spawnSparks(f.x, f.y, 4, f.color, 12, { up: true, speed: 90 });
        break;
    }
  }
  function spawnMeleeSparks(f, n) {
    const full = f.arc >= 6;
    for (let i = 0; i < n; i++) {
      const ang = full ? Math.random() * Math.PI * 2
        : f.facing + (Math.random() - 0.5) * f.arc;
      const rr = f.range * (0.5 + Math.random() * 0.5);
      const spd = 120 + Math.random() * 180;
      particles.add({
        x: f.x + Math.cos(ang) * rr * 0.4, y: f.y + Math.sin(ang) * rr * 0.4,
        z: BODY_HEIGHT * 0.7,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd * 0.75,
        vz: Math.random() * 80, gravity: 220, drag: 3,
        life: 0.22 + Math.random() * 0.28, size: 1.6 + Math.random() * 2,
        color: f.color, additive: true, streak: true,
      });
    }
  }

  // ---- 走路動畫狀態 ----
  function getAnim(p) {
    let a = animState.get(p.id);
    if (!a) {
      a = { prevX: p.x, prevY: p.y, phase: 0, dir: 1, move: 0, lastSin: 0, breathe: Math.random() * 6 };
      animState.set(p.id, a);
    }
    return a;
  }

  function drawShape(shape, cx, cy, r) {
    ctx.beginPath();
    if (shape === 'square') {
      ctx.rect(cx - r, cy - r, r * 2, r * 2);
    } else if (shape === 'triangle') {
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.lineTo(cx - r, cy + r);
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }

  function drawShadow(wx, wy, r, scale = 1) {
    ctx.save();
    ctx.translate(sx(wx), sy(wy));
    ctx.scale(scale, TILT * scale);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.restore();
  }

  // 地面瞄準指示 (沿 facing 的箭頭，傳達精確面向)
  function drawAim(bx, by, facing, color, bright) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1, TILT);
    ctx.rotate(facing);
    const r = PLAYER_RADIUS;
    ctx.globalAlpha = bright ? 0.95 : 0.5;
    ctx.fillStyle = bright ? '#eaffff' : color;
    ctx.beginPath();
    ctx.moveTo(r + 4, 0);
    ctx.lineTo(r + 4 + 16, 6);
    ctx.lineTo(r + 4 + 11, 0);
    ctx.lineTo(r + 4 + 16, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBody(p, isSelf) {
    const c = getCharacter(p.charId);
    const bx = sx(p.x), by = sy(p.y);
    const r = PLAYER_RADIUS;
    const sprite = getSprite(c.sprite);

    // 走路動畫狀態更新 (用位置差，host/joiner 通用)
    const a = getAnim(p);
    let spd = 0;
    if (curDt > 0) spd = Math.hypot(p.x - a.prevX, p.y - a.prevY) / curDt;
    a.prevX = p.x; a.prevY = p.y;
    const moveTarget = spd > WALK_THRESHOLD ? 1 : 0;
    a.move += (moveTarget - a.move) * Math.min(1, curDt * 12);
    const stride = Math.min(1.5, 0.55 + spd / 200);
    if (a.move > 0.02) a.phase += curDt * BOB_FREQ * stride;
    a.breathe += curDt;
    // 踏步揚塵
    const sphase = Math.sin(a.phase);
    if (a.lastSin < 0 && sphase >= 0 && a.move > 0.45) particles.spawnDust(p.x, p.y);
    a.lastSin = sphase;
    // 面向左右翻轉 (含遲滯，避免上下移動時抖動)
    const cf = Math.cos(p.facing);
    if (cf > 0.18) a.dir = 1; else if (cf < -0.18) a.dir = -1;

    const bob = a.move > 0.02
      ? Math.abs(Math.sin(a.phase)) * BOB_AMP * a.move
      : Math.sin(a.breathe * 2.2) * 1.1;
    const lean = Math.sin(a.phase) * 0.13 * a.move;
    const sqY = 1 + Math.sin(a.phase * 2) * 0.05 * a.move;
    const sqX = 1 - Math.sin(a.phase * 2) * 0.045 * a.move;
    const bodyCY = by - BODY_HEIGHT - bob;

    const invis = p.effects && p.effects.invis;
    const evading = p.effects && p.effects.evading;
    const alpha = evading ? 0.55 : (invis ? (isSelf ? 0.5 : 0.22) : 1);

    // 地面層：選取環 + 瞄準指示 (在身體之下)
    if (isSelf) {
      ctx.save();
      ctx.translate(bx, by); ctx.scale(1, TILT);
      ctx.strokeStyle = 'rgba(150,235,255,0.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 隱身的敵人不顯示瞄準箭頭 (避免洩漏位置)
    if (isSelf || !invis) drawAim(bx, by, p.facing, c.color, isSelf);

    // 影子 (懸空時縮小)
    drawShadow(p.x, p.y, r, 1 - (bob / (BOB_AMP + 2)) * 0.3);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (sprite) {
      const size = r * 4.15;
      ctx.save();
      ctx.translate(bx, by - bob);   // 以腳底為樞紐 (含彈跳)
      ctx.rotate(lean);
      ctx.scale(a.dir * sqX, sqY);   // 左右翻轉 + 擠壓伸展
      ctx.drawImage(sprite, -size / 2, -BODY_HEIGHT - size / 2, size, size);
      ctx.restore();
    } else {
      const topY = bodyCY;
      ctx.fillStyle = shade(c.color, -25);
      ctx.fillRect(bx - r, topY, r * 2, BODY_HEIGHT + bob);
      ctx.fillStyle = c.color;
      ctx.strokeStyle = isSelf ? '#ffffff' : 'rgba(0,0,0,0.45)';
      ctx.lineWidth = isSelf ? 3 : 2;
      drawShape(c.shape, bx, topY, r);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bx, topY);
      ctx.lineTo(bx + Math.cos(p.facing) * (r + 8), topY + Math.sin(p.facing) * (r + 8));
      ctx.stroke();
    }

    // 護盾圈
    if (p.shield > 0) {
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 120);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(120,220,255,${0.7 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, bodyCY, r + (sprite ? 20 : 6), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 狂暴光環
    if (p.effects && p.effects.rage) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 90);
      ctx.strokeStyle = `rgba(255,70,60,${0.7 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, bodyCY, r + (sprite ? 25 : 11), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (Math.random() < curDt * 30) {
        particles.add({
          x: p.x + (Math.random() - 0.5) * r, y: p.y + (Math.random() - 0.5) * r, z: BODY_HEIGHT * Math.random(),
          vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, vz: 40 + Math.random() * 50,
          gravity: -20, drag: 2, life: 0.4 + Math.random() * 0.3, size: 1.6 + Math.random() * 1.8,
          color: '#ff5a46', additive: true,
        });
      }
    }
    ctx.restore();

    drawBars(p, bx, by - BODY_HEIGHT - r - 16);
  }

  function drawBars(p, cx, top) {
    const w = 46, h = 5;
    const x = cx - w / 2;
    // 名稱
    ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(p.name, cx + 1, top - 7 + 1);
    ctx.fillStyle = '#fff';
    ctx.fillText(p.name, cx, top - 7);
    // 血條
    drawBar(ctx, x, top, w, h, p.hp / p.maxHp, '#2ecc71', '#0c2a18');
    // 魔力條
    drawBar(ctx, x, top + h + 2, w, h - 1, p.mana / p.maxMana, '#3aa0ff', '#0c1c2a');
  }

  function drawProjectile(pr) {
    const x = sx(pr.x), y = sy(pr.y) - PROJECTILE_HEIGHT;
    drawShadow(pr.x, pr.y, pr.radius * 0.8);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 拖尾
    const tr = projTrails.get(pr.id);
    if (tr && tr.length > 1) {
      for (let i = 1; i < tr.length; i++) {
        const f = i / tr.length;
        ctx.globalAlpha = f * 0.5;
        ctx.lineWidth = Math.max(1, pr.radius * 2 * f);
        ctx.strokeStyle = pr.color; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx(tr[i - 1].x), sy(tr[i - 1].y) - PROJECTILE_HEIGHT);
        ctx.lineTo(sx(tr[i].x), sy(tr[i].y) - PROJECTILE_HEIGHT);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    if (pr.pierce) {
      // 閃電：抖動電弧 + 白熱核
      const ang = Math.atan2(pr.vy, pr.vx);
      const len = pr.radius * 7;
      const perp = ang + Math.PI / 2;
      const segs = 7;
      const flick = Math.floor(performance.now() / 35);
      ctx.lineWidth = 2.4; ctx.strokeStyle = '#dffaff'; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
      for (let s = 1; s <= segs; s++) {
        const f = s / segs;
        const bxp = x - Math.cos(ang) * len * (1 - f);
        const byp = y - Math.sin(ang) * len * (1 - f);
        const j = (seeded(pr.id, s + flick) * 2 - 1) * pr.radius * 1.8 * (1 - f);
        ctx.lineTo(bxp + Math.cos(perp) * j, byp + Math.sin(perp) * j);
      }
      ctx.stroke();
      const g = ctx.createRadialGradient(x, y, 0, x, y, pr.radius * 4);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, pr.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, pr.radius * 4, 0, Math.PI * 2); ctx.fill();
    } else {
      // 彗星光球：脈動光暈 + 白熱核
      const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 60 + pr.id);
      const g = ctx.createRadialGradient(x, y, 0, x, y, pr.radius * 3.2 * pulse);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, pr.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, pr.radius * 3.2 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(x, y, pr.radius * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function render(state, selfId) {
    // 本幀 dt
    const now = performance.now();
    curDt = lastT ? (now - lastT) / 1000 : 0;
    lastT = now;
    if (curDt > 0.05) curDt = 0.05;

    // fx 事件 (一次性爆發/震動/閃光) + 本地模擬
    processFxEvents(state);
    updateTrails(state);
    particles.update(curDt);
    updateShakeFlash(curDt);

    ctx.fillStyle = '#0b1118';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ---- 世界層 (套用畫面震動) ----
    ctx.save();
    if (shakeMag > 0) {
      ctx.translate((Math.random() * 2 - 1) * shakeMag, (Math.random() * 2 - 1) * shakeMag);
    }

    drawFloor(ctx);

    // 地面區域 (先畫)
    for (const z of state.zones) drawZone(ctx, z, { curDt, addParticle: particles.add });

    // 深度排序的實體 (玩家 + 投射物)
    const drawables = [];
    for (const p of Object.values(state.players)) if (p.alive) drawables.push({ wy: p.y, kind: 'p', ref: p });
    for (const pr of state.projectiles) drawables.push({ wy: pr.y, kind: 'pr', ref: pr });
    drawables.sort((a, b) => a.wy - b.wy);
    for (const d of drawables) {
      if (d.kind === 'p') drawBody(d.ref, d.ref.id === selfId);
      else drawProjectile(d.ref);
    }

    // 技能特效 + 粒子 (最上層)
    for (const f of state.fx) drawFx(ctx, f, { curDt, addParticle: particles.add });
    particles.draw();

    ctx.restore();

    // ---- 全畫面命中閃光 (世界之上、HUD 之下) ----
    if (flashA > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, flashA);
      ctx.fillStyle = flashColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.restore();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawHUD(ctx, state, selfId);
  }

  // 追蹤投射物軌跡 (本地，供拖尾)
  function updateTrails(state) {
    const cur = new Set();
    for (const pr of state.projectiles) {
      cur.add(pr.id);
      let tr = projTrails.get(pr.id);
      if (!tr) { tr = []; projTrails.set(pr.id, tr); }
      tr.push({ x: pr.x, y: pr.y });
      if (tr.length > 16) tr.shift();
    }
    for (const id of projTrails.keys()) if (!cur.has(id)) projTrails.delete(id);
  }

  return { render, ctx };

  function getSprite(src) {
    if (!src) return null;
    let img = spriteCache.get(src);
    if (!img) {
      img = new Image();
      img.decoding = 'async';
      img.src = src;
      spriteCache.set(src, img);
    }
    return img.complete && img.naturalWidth > 0 ? img : null;
  }
}
