import { BODY_HEIGHT, PLAYER_RADIUS, PROJECTILE_HEIGHT, TILT } from '../constants.js';
import { clamp, hexA, seeded, sx, sy } from './utils.js';

export function drawFx(ctx, fx, renderCtx) {
  const t = clamp(fx.life / fx.maxLife, 0, 1);
  const p = 1 - t;
  switch (fx.type) {
    case 'melee': drawMeleeFx(ctx, fx, t, p); break;
    case 'hit': drawHitFx(ctx, fx, t, p); break;
    case 'death': drawDeathFx(ctx, fx, t, p); break;
    case 'buff': drawBuffFx(ctx, fx, t, p, renderCtx); break;
    case 'blink': drawBlinkFx(ctx, fx, t, p); break;
    case 'dash': drawDashFx(ctx, fx, t, p); break;
    case 'popup': drawPopupFx(ctx, fx, t, p); break;
    case 'skillname': drawSkillNameFx(ctx, fx, t, p); break;
    case 'ultimate': drawUltimateFx(ctx, fx, t, p); break;
    default: drawHitFx(ctx, fx, t, p);
  }
}

function drawPopupFx(ctx, fx, t, p) {
  const jitter = (seeded(fx.id, 0) - 0.5) * 26;
  const x = sx(fx.x) + jitter;
  const rise = 32 + p * 36;
  const y = sy(fx.y) - BODY_HEIGHT - 18 - rise;
  const kind = fx.kind || 'damage';
  const big = kind === 'crit';
  const size = big ? 28 : kind === 'heal' || kind === 'shield' ? 18 : 22;
  const scaleIn = Math.min(1, (1 - t) * 6 + 0.4);
  const fade = t < 0.25 ? t / 0.25 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scaleIn * (big ? 1.15 : 1), scaleIn * (big ? 1.15 : 1));
  ctx.globalAlpha = fade;
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.strokeText(String(fx.text), 0, 0);
  if (big) {
    ctx.shadowColor = fx.color;
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = fx.color;
  ctx.fillText(String(fx.text), 0, 0);
  if (big) {
    ctx.shadowBlur = 0;
    ctx.font = `bold 11px system-ui, sans-serif`;
    ctx.fillStyle = '#fff7d0';
    ctx.fillText('CRIT!', 0, -size * 0.85);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSkillNameFx(ctx, fx, t, p) {
  const x = sx(fx.x);
  const baseY = sy(fx.y) - BODY_HEIGHT - 56;
  const slide = (1 - t) * 10 - p * 6;
  const y = baseY - slide;
  const fade = t < 0.18 ? t / 0.18 : t;
  const isUlt = !!fx.ultimate;
  const size = isUlt ? 30 : 22;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);
  const scaleIn = Math.min(1.0, (1 - t) * 4 + 0.6);
  ctx.scale(scaleIn, scaleIn);
  ctx.font = `900 ${size}px system-ui, "PingFang TC", "Noto Sans CJK TC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = String(fx.text);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(text, 0, 0);
  ctx.shadowColor = fx.color;
  ctx.shadowBlur = isUlt ? 22 : 12;
  ctx.fillStyle = fx.color;
  ctx.fillText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMeleeFx(ctx, fx, t, p) {
  const bx = sx(fx.x), by = sy(fx.y) - BODY_HEIGHT;
  const full = fx.arc >= 6;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (full) {
    for (let k = 0; k < 3; k++) {
      const rr = Math.max(6, fx.range * (0.45 + 0.55 * p) - k * 12);
      const off = p * Math.PI * 4 + k * 1.3;
      ctx.globalAlpha = t * (0.6 - k * 0.15);
      ctx.lineWidth = 7 - k * 2;
      ctx.strokeStyle = k === 0 ? '#ffffff' : fx.color;
      ctx.beginPath(); ctx.arc(bx, by, rr, off, off + Math.PI * 1.5); ctx.stroke();
    }
  } else {
    const a0 = fx.facing - fx.arc / 2, a1 = fx.facing + fx.arc / 2;
    const lead = a0 + (a1 - a0) * Math.min(1, p * 1.3);
    const inner = fx.range * 0.32, outer = fx.range * (0.85 + 0.15 * p);
    ctx.globalAlpha = t * 0.55;
    const g = ctx.createRadialGradient(bx, by, inner, bx, by, outer);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, hexA(fx.color, 0.55));
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, outer, a0, lead);
    ctx.arc(bx, by, inner, lead, a0, true);
    ctx.closePath(); ctx.fill();
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

function drawHitFx(ctx, fx, t, p) {
  const x = sx(fx.x), y = sy(fx.y) - PROJECTILE_HEIGHT;
  const radius = fx.radius || 14;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = t;
  ctx.lineWidth = 2 + 5 * t;
  ctx.strokeStyle = fx.color;
  ctx.beginPath(); ctx.arc(x, y, radius * (0.4 + 1.1 * p), 0, Math.PI * 2); ctx.stroke();
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(255,255,255,${0.9 * t})`);
  g.addColorStop(0.4, hexA(fx.color, 0.6 * t));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = t; ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    const ang = seeded(fx.id, i) * Math.PI * 2;
    const l0 = radius * 0.3, l1 = radius * (0.6 + 0.9 * p);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * l0, y + Math.sin(ang) * l0);
    ctx.lineTo(x + Math.cos(ang) * l1, y + Math.sin(ang) * l1);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawDeathFx(ctx, fx, t, p) {
  const x = sx(fx.x), y = sy(fx.y) - BODY_HEIGHT * 0.5;
  const radius = fx.radius || 36;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 2; k++) {
    ctx.globalAlpha = t * (0.85 - k * 0.35);
    ctx.lineWidth = 6 - k * 2;
    ctx.strokeStyle = k === 0 ? '#ffffff' : fx.color;
    ctx.beginPath(); ctx.arc(x, y, radius * (0.3 + 1.5 * p) + k * radius * 0.35, 0, Math.PI * 2); ctx.stroke();
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.4);
  g.addColorStop(0, `rgba(255,255,255,${0.85 * t})`);
  g.addColorStop(0.5, `rgba(255,240,210,${0.4 * t})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, radius * 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawBuffFx(ctx, fx, t, p, renderCtx) {
  const bx = sx(fx.x), by = sy(fx.y);
  const radius = fx.radius || 40;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.save();
  ctx.translate(bx, by); ctx.scale(1, TILT); ctx.rotate(p * 5);
  ctx.globalAlpha = t * 0.85; ctx.lineWidth = 3; ctx.strokeStyle = fx.color;
  ctx.beginPath(); ctx.arc(0, 0, radius * (0.6 + 0.4 * p), 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r0 = radius * 0.55, r1 = radius * 0.72;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = t * 0.4;
  const lg = ctx.createLinearGradient(0, by, 0, by - BODY_HEIGHT - 26);
  lg.addColorStop(0, hexA(fx.color, 0.5));
  lg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(bx - radius * 0.35, by - BODY_HEIGHT - 26, radius * 0.7, BODY_HEIGHT + 26);
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

  if (Math.random() < renderCtx.curDt * 36) {
    const a = Math.random() * Math.PI * 2, rr = Math.random() * radius * 0.7;
    renderCtx.addParticle({
      x: fx.x + Math.cos(a) * rr, y: fx.y + Math.sin(a) * rr, z: 0,
      vx: 0, vy: 0, vz: 50 + Math.random() * 60, gravity: -10, drag: 1,
      life: 0.4 + Math.random() * 0.4, size: 1.6 + Math.random() * 1.8,
      color: fx.color, additive: true,
    });
  }
}

function drawBlinkFx(ctx, fx, t, p) {
  const x = sx(fx.x), y = sy(fx.y) - BODY_HEIGHT;
  const radius = fx.radius || 28;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = t; ctx.lineWidth = 3; ctx.strokeStyle = fx.color;
  ctx.beginPath(); ctx.arc(x, y, radius * (0.3 + 1.2 * p), 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = t * 0.9;
  for (let i = 0; i < 8; i++) {
    const ang = seeded(fx.id, i) * Math.PI * 2;
    const l1 = radius * (1.4 - p), l0 = radius * (1.0 - p) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * l1, y + Math.sin(ang) * l1);
    ctx.lineTo(x + Math.cos(ang) * l0, y + Math.sin(ang) * l0);
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.8);
  g.addColorStop(0, `rgba(255,255,255,${0.8 * t})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, radius * 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawDashFx(ctx, fx, t) {
  const x = sx(fx.x), y = sy(fx.y) - BODY_HEIGHT;
  const dx = Math.cos(fx.facing || 0), dy = Math.sin(fx.facing || 0);
  const perp = (fx.facing || 0) + Math.PI / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = fx.color; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    const off = i * PLAYER_RADIUS * 0.6;
    const ox = Math.cos(perp) * off, oy = Math.sin(perp) * off * TILT;
    ctx.globalAlpha = t * 0.8 * (1 - Math.abs(i) * 0.3);
    ctx.lineWidth = 4 - Math.abs(i);
    const len = 44 * (0.6 + (1 - t));
    ctx.beginPath();
    ctx.moveTo(x + ox, y + oy);
    ctx.lineTo(x + ox - dx * len, y + oy - dy * len * TILT);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function drawUltimateFx(ctx, fx, t, p) {
  const x = sx(fx.x), y = sy(fx.y) - BODY_HEIGHT * 0.5;
  const radius = fx.radius || 140;
  const scale = fx.isBoss ? 1.8 : 1.0;
  const R = radius * scale;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // Multiple expanding shockwaves
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = t * (0.85 - k * 0.2);
    ctx.lineWidth = (6 - k * 1.5) * (fx.isBoss ? 2 : 1);
    ctx.strokeStyle = k === 0 ? '#ffffff' : fx.color;
    ctx.beginPath();
    ctx.arc(x, y, R * (0.2 + 0.8 * p) * (1 - k * 0.15), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Large radial flash
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(255,255,255,${0.95 * t})`);
  g.addColorStop(0.3, hexA(fx.color, 0.75 * t));
  g.addColorStop(0.7, hexA(fx.color, 0.3 * t));
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  // Burst lines
  ctx.globalAlpha = t * 0.9;
  ctx.lineWidth = fx.isBoss ? 3 : 2;
  ctx.strokeStyle = '#ffffff';
  const lines = fx.isBoss ? 16 : 8;
  for (let i = 0; i < lines; i++) {
    const ang = (i / lines) * Math.PI * 2 + p * 0.5;
    const l0 = R * 0.1, l1 = R * (0.4 + 0.6 * p);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(ang) * l0, y + Math.sin(ang) * l0);
    ctx.lineTo(x + Math.cos(ang) * l1, y + Math.sin(ang) * l1);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
