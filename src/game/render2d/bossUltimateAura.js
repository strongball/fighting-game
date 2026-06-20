import { BODY_HEIGHT, CANVAS_H, CANVAS_W, TILT } from '../constants.js';

// Canvas2D 備援版：和 3D 共用「瞬間爆發 + 持續氣焰」節奏。
export function createBossUltimateAura2d({ ctx, particles, addShake, addFlash }) {
  const entries = new Map();

  function trigger(p) {
    const e = { age: 0, emitAcc: 0, shakeAcc: 0, boltAcc: 0, bolts: [], shockAge: 0 };
    entries.set(p.id, e);
    addShake(28);
    addFlash(0.68, '#fff3c4');
    for (let i = 0; i < 76; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 180 + Math.random() * 360;
      particles.add({
        x: p.x, y: p.y, z: BODY_HEIGHT * (0.2 + Math.random() * 0.8),
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd * 0.72,
        vz: 90 + Math.random() * 210, gravity: 200, drag: 1.8,
        life: 0.38 + Math.random() * 0.42, size: 4 + Math.random() * 7,
        color: i % 4 === 0 ? '#ffffff' : i % 3 === 0 ? '#ff5533' : '#ffc247',
        additive: true, streak: i % 3 === 0,
      });
    }
    return e;
  }

  function refreshBolts(e, r) {
    e.bolts = [];
    for (let b = 0; b < 2 + Math.floor(Math.random() * 2); b++) {
      const pts = [{ x: (Math.random() - 0.5) * r * 1.5, y: r * 1.5 }];
      for (let i = 1; i <= 7; i++) {
        pts.push({ x: (Math.random() - 0.5) * r * 5.5, y: r * 1.5 - i * r * 1.35 });
      }
      e.bolts.push({ pts, cyan: Math.random() < 0.7 });
    }
  }

  function sync(players, dt) {
    const active = new Set();
    for (const p of Object.values(players || {})) {
      if (!p.isBoss || !p.alive || !p.ultLockInvincible) continue;
      active.add(p.id);
      const e = entries.get(p.id) || trigger(p);
      e.age += dt;
      e.shockAge += dt;
      e.emitAcc += dt * 125;
      const count = Math.min(10, Math.floor(e.emitAcc));
      e.emitAcc -= count;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * 34 * (p.scale || 1);
        particles.add({
          x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr,
          z: Math.random() * BODY_HEIGHT * 0.7,
          vx: Math.cos(a) * (18 + Math.random() * 40),
          vy: Math.sin(a) * (18 + Math.random() * 40),
          vz: 115 + Math.random() * 180, gravity: -24, drag: 1.1,
          life: 0.42 + Math.random() * 0.38, size: 4 + Math.random() * 8,
          color: Math.random() < 0.18 ? '#ffffff' : Math.random() < 0.35 ? '#ff5533' : '#ffc247',
          additive: true,
        });
      }
      e.boltAcc -= dt;
      if (e.boltAcc <= 0) { refreshBolts(e, 20 * (p.scale || 1)); e.boltAcc = 0.09 + Math.random() * 0.1; }
      e.shakeAcc -= dt;
      if (e.shakeAcc <= 0) { addShake(7); e.shakeAcc = 0.3; }
    }
    for (const id of [...entries.keys()]) if (!active.has(id)) entries.delete(id);
  }

  function draw(p, bx, bodyCY, r) {
    const e = entries.get(p.id);
    if (!e) return;
    const pulse = 0.5 + 0.5 * Math.sin(e.age * 10);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 一次性雙層全場衝擊波。
    if (e.shockAge < 0.72) {
      const t1 = Math.min(1, e.shockAge / 0.58);
      const t2 = Math.max(0, Math.min(1, (e.shockAge - 0.08) / 0.64));
      ctx.save(); ctx.translate(bx, bodyCY + r * 1.6); ctx.scale(1, TILT);
      ctx.lineWidth = 7 * (1 - t1) + 1;
      ctx.strokeStyle = `rgba(255,245,196,${(1 - t1) * 0.9})`;
      ctx.beginPath(); ctx.arc(0, 0, r * (1 + t1 * 15), 0, Math.PI * 2); ctx.stroke();
      if (e.shockAge > 0.08) {
        ctx.lineWidth = 9 * (1 - t2) + 1;
        ctx.strokeStyle = `rgba(255,70,32,${(1 - t2) * 0.68})`;
        ctx.beginPath(); ctx.arc(0, 0, r * (1 + t2 * 21), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    const glow = ctx.createRadialGradient(bx, bodyCY, r * 0.5, bx, bodyCY, r * 11);
    glow.addColorStop(0, 'rgba(255,255,235,.92)');
    glow.addColorStop(0.22, 'rgba(255,194,71,.7)');
    glow.addColorStop(0.58, 'rgba(255,69,35,.3)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(bx, bodyCY, r * (9.5 + pulse * 1.5), 0, Math.PI * 2); ctx.fill();

    // 火焰輪廓與白熱光柱，底部寬、頂部收束。
    const column = ctx.createLinearGradient(bx - r * 6, 0, bx + r * 6, 0);
    column.addColorStop(0, 'rgba(255,65,30,0)');
    column.addColorStop(0.22, 'rgba(255,80,30,.2)');
    column.addColorStop(0.42, 'rgba(255,190,55,.42)');
    column.addColorStop(0.5, 'rgba(255,255,225,.7)');
    column.addColorStop(0.58, 'rgba(255,190,55,.42)');
    column.addColorStop(0.78, 'rgba(255,80,30,.2)');
    column.addColorStop(1, 'rgba(255,65,30,0)');
    ctx.fillStyle = column;
    ctx.beginPath();
    ctx.moveTo(bx - r * (5.5 + pulse), bodyCY + r * 2);
    ctx.lineTo(bx - r * 1.7, bodyCY - r * 13);
    ctx.lineTo(bx + r * 1.7, bodyCY - r * 13);
    ctx.lineTo(bx + r * (5.5 + pulse), bodyCY + r * 2);
    ctx.closePath(); ctx.fill();

    ctx.shadowBlur = 18; ctx.shadowColor = '#ffd760'; ctx.lineWidth = 3.5;
    for (let i = 0; i < 3; i++) {
      const phase = (e.age * 0.72 + i / 3) % 1;
      ctx.save();
      ctx.translate(bx, bodyCY + r * 1.5 - phase * r * 9);
      ctx.scale(1.7, 0.42);
      ctx.strokeStyle = `rgba(255,245,190,${Math.sin(phase * Math.PI) * 0.7})`;
      ctx.beginPath(); ctx.arc(0, 0, r * (0.8 + phase * 3.2), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    for (const bolt of e.bolts) {
      ctx.strokeStyle = bolt.cyan ? '#89f5ff' : '#fff3af';
      ctx.shadowColor = bolt.cyan ? '#24d9ff' : '#ffb52e';
      ctx.shadowBlur = 14; ctx.lineWidth = 3;
      ctx.beginPath();
      bolt.pts.forEach((pt, i) => i ? ctx.lineTo(bx + pt.x, bodyCY + pt.y) : ctx.moveTo(bx + pt.x, bodyCY + pt.y));
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlay() {
    if (!entries.size) return;
    const g = ctx.createRadialGradient(CANVAS_W * 0.5, CANVAS_H * 0.48, CANVAS_H * 0.12, CANVAS_W * 0.5, CANVAS_H * 0.48, CANVAS_W * 0.68);
    g.addColorStop(0, 'rgba(255,90,25,.04)');
    g.addColorStop(0.58, 'rgba(32,5,0,.10)');
    g.addColorStop(1, 'rgba(0,0,0,.42)');
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); ctx.restore();
  }

  return { sync, draw, drawOverlay };
}
