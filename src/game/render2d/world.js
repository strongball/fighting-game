import { ARENA, TILT } from '../constants.js';
import { hexA, sx, sy } from './utils.js';

export function drawFloor(ctx) {
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

export function drawTimeAnchors(ctx, anchors = [], ritual = null) {
  const now = performance.now() / 1000;
  for (const anchor of anchors) {
    const occupied = anchor.occupiedBy != null;
    const color = occupied ? '#7CFCB2' : '#70e6ff';
    const radius = anchor.captureRadius || anchor.radius || 120;
    const urgent = (ritual?.remaining ?? Infinity) <= 1;
    const pulse = 0.94 + 0.06 * Math.sin(now * (urgent ? 18 : 7));
    const x = sx(anchor.x), y = sy(anchor.y);
    ctx.save();
    ctx.translate(x, y); ctx.scale(1, TILT);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = hexA(color, occupied ? 0.3 : 0.16);
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = occupied ? 7 : 5;
    ctx.shadowColor = color; ctx.shadowBlur = urgent ? 24 : 14;
    ctx.beginPath(); ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.font = '900 18px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.fillStyle = color;
    const label = occupied ? '✓ 已鎖定' : '▼ 站這裡';
    ctx.strokeText(label, x, y - radius * TILT - 18); ctx.fillText(label, x, y - radius * TILT - 18);
    ctx.restore();
  }
}

export function drawZone(ctx, zone, renderCtx) {
  const x = sx(zone.x), y = sy(zone.y);
  if (zone.delay > 0) { drawTelegraph(ctx, zone, x, y); return; }
  const now = performance.now() / 1000;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, TILT);

  const pulse = 0.5 + 0.5 * Math.sin(now * 5);
  const g = ctx.createRadialGradient(0, 0, zone.radius * 0.15, 0, 0, zone.radius);
  g.addColorStop(0, hexA(zone.color, 0.32 + 0.14 * pulse));
  g.addColorStop(0.65, hexA(zone.color, 0.16));
  g.addColorStop(1, hexA(zone.color, 0.02));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, zone.radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.rotate(now * 0.7);
  ctx.lineWidth = 3; ctx.strokeStyle = hexA(zone.color, 0.85);
  ctx.beginPath(); ctx.arc(0, 0, zone.radius * 0.97, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 5; ctx.strokeStyle = hexA(zone.color, 0.6);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = zone.radius * 0.86, r1 = zone.radius * 0.97;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.rotate(-now * 1.3);
  ctx.lineWidth = 2; ctx.strokeStyle = hexA(zone.color, 0.75);
  ctx.beginPath(); ctx.arc(0, 0, zone.radius * 0.6, 0, Math.PI * 1.6); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, zone.radius * 0.6, Math.PI, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
  ctx.restore();

  if (Math.random() < renderCtx.curDt * 42) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * zone.radius;
    const cool = zone.effect && zone.effect.kind === 'slow';
    renderCtx.addParticle({
      x: zone.x + Math.cos(a) * rr, y: zone.y + Math.sin(a) * rr, z: 0,
      vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20,
      vz: cool ? 14 + Math.random() * 26 : 36 + Math.random() * 54,
      gravity: cool ? 30 : -16, drag: 1.5,
      life: 0.5 + Math.random() * 0.6, size: 1.6 + Math.random() * 2.2,
      color: zone.color, additive: true,
    });
  }
}

function drawTelegraph(ctx, zone, x, y) {
  const now = performance.now() / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, TILT);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.arc(0, 0, zone.radius * 0.92, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,70,55,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, zone.radius, 0, Math.PI * 2); ctx.stroke();
  const beat = 0.5 + 0.5 * Math.sin(now * 9);
  ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,140,60,${0.5 + 0.5 * beat})`;
  ctx.beginPath(); ctx.arc(0, 0, zone.radius * (0.3 + 0.55 * beat), 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,90,60,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-zone.radius, 0); ctx.lineTo(zone.radius, 0);
  ctx.moveTo(0, -zone.radius); ctx.lineTo(0, zone.radius);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const bw = zone.radius * 0.55;
  const lg = ctx.createLinearGradient(0, y - 340, 0, y);
  lg.addColorStop(0, 'rgba(255,90,55,0)');
  lg.addColorStop(1, `rgba(255,140,70,${0.18 + 0.14 * beat})`);
  ctx.fillStyle = lg;
  ctx.fillRect(x - bw / 2, y - 340, bw, 340);
  ctx.restore();
}
