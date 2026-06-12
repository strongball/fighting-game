// 稍微傾斜的俯視渲染 + HUD (血條/魔力條/名稱/計分)

import {
  ARENA, TILT, BODY_HEIGHT, PROJECTILE_HEIGHT, PLAYER_RADIUS,
  CANVAS_W, CANVAS_H, FLOOR_TOP, FLOOR_LEFT,
  PARTICLE_MAX, SHAKE_DECAY, SHAKE_MAX, FLASH_DECAY,
  BOB_AMP, BOB_FREQ, WALK_THRESHOLD,
} from './constants.js';
import { getCharacter } from './characters.js';

function sx(wx) { return FLOOR_LEFT + wx; }
function sy(wy) { return FLOOR_TOP + wy * TILT; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const spriteCache = new Map();

  // ---- 本地視覺狀態 (不進 snapshot) ----
  let lastT = 0;          // 上一幀時間戳 (ms)
  let curDt = 0;          // 本幀 dt (秒)
  const particles = [];   // 本地粒子
  const animState = new Map(); // pid -> 走路動畫狀態
  const projTrails = new Map(); // 投射物 id -> 拖尾點
  let seenFx = new Set(); // 已處理過的 fx id (事件去重)
  let shakeMag = 0;       // 畫面震動強度
  let flashA = 0;         // 全畫面閃光 alpha
  let flashColor = '#ffffff';

  // ---- 粒子系統 ----
  function addParticle(p) {
    p.maxLife = p.life;
    particles.push(p);
    if (particles.length > PARTICLE_MAX) particles.splice(0, particles.length - PARTICLE_MAX);
  }
  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vz !== undefined) { p.z += p.vz * dt; p.vz -= (p.gravity || 0) * dt; }
      if (p.z !== undefined && p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; }
      const f = Math.exp(-(p.drag || 0) * dt);
      p.vx *= f; p.vy *= f;
    }
    let n = 0;
    for (const p of particles) if (p.life > 0) particles[n++] = p;
    particles.length = n;
  }
  function drawParticles() {
    ctx.save();
    for (const p of particles) {
      const lf = clamp(p.life / p.maxLife, 0, 1);
      const px = sx(p.x), py = sy(p.y) - (p.z || 0);
      ctx.globalAlpha = lf;
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over';
      ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
      if (p.streak && (p.vx || p.vy)) {
        ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - p.vx * 0.045, py - p.vy * 0.045 * TILT);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, p.size * (0.45 + 0.55 * lf), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function spawnSparks(wx, wy, z, color, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (opt.speed || 130) * (0.4 + Math.random());
      addParticle({
        x: wx, y: wy, z,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.75,
        vz: opt.up ? 70 + Math.random() * 110 : Math.random() * 150 - 30,
        gravity: opt.up ? 70 : 220, drag: 2.5,
        life: 0.28 + Math.random() * 0.4, size: 1.6 + Math.random() * 2.4,
        color, additive: true, streak: true,
      });
    }
  }
  function spawnDebris(wx, wy, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 90 + Math.random() * 230;
      addParticle({
        x: wx, y: wy, z: BODY_HEIGHT * 0.4,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.7,
        vz: 120 + Math.random() * 200, gravity: 460, drag: 1.2,
        life: 0.5 + Math.random() * 0.5, size: 2 + Math.random() * 3,
        color, additive: false,
      });
    }
  }
  function spawnStreaks(wx, wy, facing, color) {
    for (let i = 0; i < 10; i++) {
      const a = facing + Math.PI + (Math.random() - 0.5) * 0.9;
      const spd = 180 + Math.random() * 260;
      addParticle({
        x: wx, y: wy, z: BODY_HEIGHT * (0.3 + Math.random() * 0.6),
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.75, vz: 0,
        gravity: 0, drag: 4, life: 0.22 + Math.random() * 0.18,
        size: 2 + Math.random() * 2, color, additive: true, streak: true,
      });
    }
  }
  function spawnDust(wx, wy) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      addParticle({
        x: wx + Math.cos(a) * PLAYER_RADIUS * 0.5, y: wy + Math.sin(a) * PLAYER_RADIUS * 0.4, z: 0,
        vx: Math.cos(a) * 32, vy: Math.sin(a) * 24, vz: 18 + Math.random() * 26,
        gravity: 120, drag: 4.5, life: 0.32 + Math.random() * 0.22,
        size: 2.4 + Math.random() * 2.2, color: 'rgba(150,162,175,0.55)', additive: false,
      });
    }
  }

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
        spawnDebris(f.x, f.y, f.color || '#ffffff', 28);
        spawnSparks(f.x, f.y, BODY_HEIGHT * 0.5, '#ffffff', 22, { speed: 260 });
        break;
      case 'hit': {
        const R = f.radius || 14;
        if (R >= 70) { addShake(13); addFlash(0.3, f.color); spawnDebris(f.x, f.y, f.color, 20); }
        else if (R >= 34) addShake(3.5);
        spawnSparks(f.x, f.y, PROJECTILE_HEIGHT, f.color, Math.min(16, 5 + R / 11), { speed: 150 + R * 1.4 });
        break;
      }
      case 'blink':
        spawnSparks(f.x, f.y, BODY_HEIGHT, f.color, 18, { speed: 200 });
        break;
      case 'dash':
        spawnStreaks(f.x, f.y, f.facing || 0, f.color);
        break;
      case 'melee': {
        const full = f.arc >= 6;
        spawnMeleeSparks(f, full ? 20 : 7);
        if (full) addShake(6);
        break;
      }
      case 'buff':
        spawnSparks(f.x, f.y, 4, f.color, 12, { up: true, speed: 90 });
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
      addParticle({
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

  function drawFloor() {
    const x0 = sx(0), y0 = sy(0), w = ARENA.width, h = ARENA.height * TILT;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#243447');
    g.addColorStop(1, '#16202c');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const step = 100;
    for (let gx = 0; gx <= ARENA.width; gx += step) {
      ctx.beginPath(); ctx.moveTo(sx(gx), sy(0)); ctx.lineTo(sx(gx), sy(ARENA.height)); ctx.stroke();
    }
    for (let gy = 0; gy <= ARENA.height; gy += step) {
      ctx.beginPath(); ctx.moveTo(sx(0), sy(gy)); ctx.lineTo(sx(ARENA.width), sy(gy)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(120,200,255,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, w, h);
  }

  function drawZone(z) {
    const x = sx(z.x), y = sy(z.y);
    if (z.delay > 0) { drawTelegraph(z, x, y); return; }
    const now = performance.now() / 1000;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, TILT);

    // 脈動 additive 填色
    const pulse = 0.5 + 0.5 * Math.sin(now * 5);
    const g = ctx.createRadialGradient(0, 0, z.radius * 0.15, 0, 0, z.radius);
    g.addColorStop(0, hexA(z.color, 0.32 + 0.14 * pulse));
    g.addColorStop(0.65, hexA(z.color, 0.16));
    g.addColorStop(1, hexA(z.color, 0.02));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // 外環 + 符文刻痕 (旋轉)
    ctx.save();
    ctx.rotate(now * 0.7);
    ctx.lineWidth = 3; ctx.strokeStyle = hexA(z.color, 0.85);
    ctx.beginPath(); ctx.arc(0, 0, z.radius * 0.97, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = hexA(z.color, 0.6);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = z.radius * 0.86, r1 = z.radius * 0.97;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();

    // 內環 (反向旋轉)
    ctx.save();
    ctx.rotate(-now * 1.3);
    ctx.lineWidth = 2; ctx.strokeStyle = hexA(z.color, 0.75);
    ctx.beginPath(); ctx.arc(0, 0, z.radius * 0.6, 0, Math.PI * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, z.radius * 0.6, Math.PI, Math.PI * 1.55); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // 持續上升餘燼 (本地粒子)
    if (Math.random() < curDt * 42) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * z.radius;
      const cool = z.effect && z.effect.kind === 'slow';
      addParticle({
        x: z.x + Math.cos(a) * rr, y: z.y + Math.sin(a) * rr, z: 0,
        vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
        vz: cool ? 14 + Math.random() * 26 : 36 + Math.random() * 54,
        gravity: cool ? 30 : -16, drag: 1.5,
        life: 0.5 + Math.random() * 0.6, size: 1.6 + Math.random() * 2.2,
        color: z.color, additive: true,
      });
    }
  }

  // 隕石/延遲區的落地預警
  function drawTelegraph(z, x, y) {
    const now = performance.now() / 1000;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, TILT);
    // 地面陰影
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, z.radius * 0.92, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // 警示外環
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,70,55,0.9)';
    ctx.beginPath(); ctx.arc(0, 0, z.radius, 0, Math.PI * 2); ctx.stroke();
    // 收縮倒數環
    const beat = 0.5 + 0.5 * Math.sin(now * 9);
    ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,140,60,${0.5 + 0.5 * beat})`;
    ctx.beginPath(); ctx.arc(0, 0, z.radius * (0.3 + 0.55 * beat), 0, Math.PI * 2); ctx.stroke();
    // 十字準星
    ctx.strokeStyle = 'rgba(255,90,60,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-z.radius, 0); ctx.lineTo(z.radius, 0);
    ctx.moveTo(0, -z.radius); ctx.lineTo(0, z.radius);
    ctx.stroke();
    ctx.restore();
    // 下墜光柱 (螢幕垂直方向)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bw = z.radius * 0.55;
    const lg = ctx.createLinearGradient(0, y - 340, 0, y);
    lg.addColorStop(0, 'rgba(255,90,55,0)');
    lg.addColorStop(1, `rgba(255,140,70,${0.18 + 0.14 * beat})`);
    ctx.fillStyle = lg;
    ctx.fillRect(x - bw / 2, y - 340, bw, 340);
    ctx.restore();
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
    if (a.lastSin < 0 && sphase >= 0 && a.move > 0.45) spawnDust(p.x, p.y);
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
    const alpha = invis ? (isSelf ? 0.5 : 0.22) : 1;

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
        addParticle({
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
    bar(x, top, w, h, p.hp / p.maxHp, '#2ecc71', '#0c2a18');
    // 魔力條
    bar(x, top + h + 2, w, h - 1, p.mana / p.maxMana, '#3aa0ff', '#0c1c2a');
  }

  function bar(x, y, w, h, ratio, fg, bg) {
    ratio = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fg; ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
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

  function drawFx(f) {
    const t = clamp(f.life / f.maxLife, 0, 1); // 1 → 0
    const p = 1 - t;                           // 0 → 1
    switch (f.type) {
      case 'melee': drawMeleeFx(f, t, p); break;
      case 'hit': drawHitFx(f, t, p); break;
      case 'death': drawDeathFx(f, t, p); break;
      case 'buff': drawBuffFx(f, t, p); break;
      case 'blink': drawBlinkFx(f, t, p); break;
      case 'dash': drawDashFx(f, t, p); break;
      default: drawHitFx(f, t, p);
    }
  }

  function drawMeleeFx(f, t, p) {
    const bx = sx(f.x), by = sy(f.y) - BODY_HEIGHT;
    const full = f.arc >= 6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (full) {
      // 旋風：多層旋轉環
      for (let k = 0; k < 3; k++) {
        const rr = Math.max(6, f.range * (0.45 + 0.55 * p) - k * 12);
        const off = p * Math.PI * 4 + k * 1.3;
        ctx.globalAlpha = t * (0.6 - k * 0.15);
        ctx.lineWidth = 7 - k * 2;
        ctx.strokeStyle = k === 0 ? '#ffffff' : f.color;
        ctx.beginPath(); ctx.arc(bx, by, rr, off, off + Math.PI * 1.5); ctx.stroke();
      }
    } else {
      const a0 = f.facing - f.arc / 2, a1 = f.facing + f.arc / 2;
      const lead = a0 + (a1 - a0) * Math.min(1, p * 1.3);
      const inner = f.range * 0.32, outer = f.range * (0.85 + 0.15 * p);
      // 月牙掃光
      ctx.globalAlpha = t * 0.55;
      const g = ctx.createRadialGradient(bx, by, inner, bx, by, outer);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.7, hexA(f.color, 0.55));
      g.addColorStop(1, 'rgba(255,255,255,0.9)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, outer, a0, lead);
      ctx.arc(bx, by, inner, lead, a0, true);
      ctx.closePath(); ctx.fill();
      // 前緣高光
      ctx.globalAlpha = t;
      ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(lead) * inner, by + Math.sin(lead) * inner);
      ctx.lineTo(bx + Math.cos(lead) * outer, by + Math.sin(lead) * outer);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawHitFx(f, t, p) {
    const x = sx(f.x), y = sy(f.y) - PROJECTILE_HEIGHT;
    const R = f.radius || 14;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 衝擊環
    ctx.globalAlpha = t;
    ctx.lineWidth = 2 + 5 * t;
    ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.arc(x, y, R * (0.4 + 1.1 * p), 0, Math.PI * 2); ctx.stroke();
    // 閃光核
    const g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, `rgba(255,255,255,${0.9 * t})`);
    g.addColorStop(0.4, hexA(f.color, 0.6 * t));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    // 放射火花線
    ctx.globalAlpha = t; ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const ang = seeded(f.id, i) * Math.PI * 2;
      const l0 = R * 0.3, l1 = R * (0.6 + 0.9 * p);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * l0, y + Math.sin(ang) * l0);
      ctx.lineTo(x + Math.cos(ang) * l1, y + Math.sin(ang) * l1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawDeathFx(f, t, p) {
    const x = sx(f.x), y = sy(f.y) - BODY_HEIGHT * 0.5;
    const R = f.radius || 36;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 2; k++) {
      ctx.globalAlpha = t * (0.85 - k * 0.35);
      ctx.lineWidth = 6 - k * 2;
      ctx.strokeStyle = k === 0 ? '#ffffff' : f.color;
      ctx.beginPath(); ctx.arc(x, y, R * (0.3 + 1.5 * p) + k * R * 0.35, 0, Math.PI * 2); ctx.stroke();
    }
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 1.4);
    g.addColorStop(0, `rgba(255,255,255,${0.85 * t})`);
    g.addColorStop(0.5, `rgba(255,240,210,${0.4 * t})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawBuffFx(f, t, p) {
    const bx = sx(f.x), by = sy(f.y);
    const R = f.radius || 40;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 腳下旋轉符文盤
    ctx.save();
    ctx.translate(bx, by); ctx.scale(1, TILT); ctx.rotate(p * 5);
    ctx.globalAlpha = t * 0.85; ctx.lineWidth = 3; ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.arc(0, 0, R * (0.6 + 0.4 * p), 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r0 = R * 0.55, r1 = R * 0.72;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
    // 上升光柱
    ctx.globalAlpha = t * 0.4;
    const lg = ctx.createLinearGradient(0, by, 0, by - BODY_HEIGHT - 26);
    lg.addColorStop(0, hexA(f.color, 0.5));
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(bx - R * 0.35, by - BODY_HEIGHT - 26, R * 0.7, BODY_HEIGHT + 26);
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // 持續上升光點
    if (Math.random() < curDt * 36) {
      const a = Math.random() * Math.PI * 2, rr = Math.random() * R * 0.7;
      addParticle({
        x: f.x + Math.cos(a) * rr, y: f.y + Math.sin(a) * rr, z: 0,
        vx: 0, vy: 0, vz: 50 + Math.random() * 60, gravity: -10, drag: 1,
        life: 0.4 + Math.random() * 0.4, size: 1.6 + Math.random() * 1.8,
        color: f.color, additive: true,
      });
    }
  }

  function drawBlinkFx(f, t, p) {
    const x = sx(f.x), y = sy(f.y) - BODY_HEIGHT;
    const R = f.radius || 28;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // 爆裂環
    ctx.globalAlpha = t; ctx.lineWidth = 3; ctx.strokeStyle = f.color;
    ctx.beginPath(); ctx.arc(x, y, R * (0.3 + 1.2 * p), 0, Math.PI * 2); ctx.stroke();
    // 內爆匯聚線
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = t * 0.9;
    for (let i = 0; i < 8; i++) {
      const ang = seeded(f.id, i) * Math.PI * 2;
      const l1 = R * (1.4 - p), l0 = R * (1.0 - p) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * l1, y + Math.sin(ang) * l1);
      ctx.lineTo(x + Math.cos(ang) * l0, y + Math.sin(ang) * l0);
      ctx.stroke();
    }
    // 核
    const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.8);
    g.addColorStop(0, `rgba(255,255,255,${0.8 * t})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawDashFx(f, t, p) {
    const x = sx(f.x), y = sy(f.y) - BODY_HEIGHT;
    const dx = Math.cos(f.facing || 0), dy = Math.sin(f.facing || 0);
    const perp = (f.facing || 0) + Math.PI / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = f.color; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      const off = i * PLAYER_RADIUS * 0.6;
      const ox = Math.cos(perp) * off, oy = Math.sin(perp) * off * TILT;
      ctx.globalAlpha = t * 0.8 * (1 - Math.abs(i) * 0.3);
      ctx.lineWidth = 4 - Math.abs(i);
      const len = 44 * (0.6 + p);
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox - dx * len, y + oy - dy * len * TILT);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawHUD(state, selfId) {
    const me = state.players[selfId];
    // 左下：自身大血條/魔力條
    if (me) {
      const x = 24, y = CANVAS_H - 70, w = 280;
      const c = getCharacter(me.charId);
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = me.alive ? '#fff' : '#ff7675';
      ctx.fillText(`${me.name}  (${c.name})${me.alive ? '' : ' — 淘汰'}`, x, y - 8);
      bar(x, y, w, 14, me.hp / me.maxHp, '#2ecc71', '#0c2a18');
      ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(me.hp)}/${me.maxHp}`, x + w / 2, y + 11);
      bar(x, y + 18, w, 12, me.mana / me.maxMana, '#3aa0ff', '#0c1c2a');
      ctx.fillStyle = '#fff'; ctx.fillText(`${Math.ceil(me.mana)}/${me.maxMana}`, x + w / 2, y + 28);
      // 技能冷卻
      drawSkillIcons(me, x, y + 36, c);
    }
    // 右上：存活計分板
    const players = Object.values(state.players).sort((a, b) => b.kills - a.kills);
    ctx.textAlign = 'left';
    ctx.font = '13px system-ui, sans-serif';
    let ry = 24;
    const alive = players.filter((p) => p.alive).length;
    ctx.fillStyle = '#ffd166'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(`存活 ${alive} 人`, CANVAS_W - 180, ry);
    ry += 22;
    ctx.font = '13px system-ui';
    for (const p of players) {
      ctx.fillStyle = p.id === selfId ? '#ffd166' : p.alive ? '#fff' : '#7b8a97';
      const tag = p.alive ? '' : ' ✕';
      ctx.fillText(`${getCharacter(p.charId).name} ${p.name}  K:${p.kills}${tag}`, CANVAS_W - 180, ry);
      ry += 19;
    }
  }

  function drawSkillIcons(me, x, y, c) {
    const slots = [['J', c.basic], ['K', c.skill1], ['L', c.skill2]];
    let ix = x;
    for (const [key, a] of slots) {
      const ready = me.cd[key === 'J' ? 'basic' : key === 'K' ? 'skill1' : 'skill2'] <= 0;
      ctx.fillStyle = ready ? 'rgba(60,160,255,0.85)' : 'rgba(80,80,90,0.7)';
      ctx.fillRect(ix, y, 86, 18);
      ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(`${key} ${a.name}`, ix + 5, y + 13);
      ix += 92;
    }
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
    updateParticles(curDt);
    updateShakeFlash(curDt);

    ctx.fillStyle = '#0b1118';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // ---- 世界層 (套用畫面震動) ----
    ctx.save();
    if (shakeMag > 0) {
      ctx.translate((Math.random() * 2 - 1) * shakeMag, (Math.random() * 2 - 1) * shakeMag);
    }

    drawFloor();

    // 地面區域 (先畫)
    for (const z of state.zones) drawZone(z);

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
    for (const f of state.fx) drawFx(f);
    drawParticles();

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

    drawHUD(state, selfId);
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

// ---- 數學 / 顏色工具 ----
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
// 由 fx id 產生穩定亂數 (host/joiner 一致)，用於火花角度等
function seeded(seed, i = 0) {
  let t = (Math.imul(seed | 0, 73856093) ^ Math.imul(i | 0, 19349663)) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}
function hexA(hex, a) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function shade(hex, amt) {
  let { r, g, b } = parseHex(hex);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}
function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
