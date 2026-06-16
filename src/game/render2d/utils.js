import { FLOOR_LEFT, FLOOR_TOP, TILT } from '../constants.js';

export function sx(wx) { return FLOOR_LEFT + wx; }
export function sy(wy) { return FLOOR_TOP + wy * TILT; }

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

export function drawBar(ctx, x, y, w, h, ratio, fg, bg) {
  ratio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fg; ctx.fillRect(x, y, w * ratio, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

// Stable pseudo-random value from an effect/projectile id.
export function seeded(seed, i = 0) {
  let t = (Math.imul(seed | 0, 73856093) ^ Math.imul(i | 0, 19349663)) >>> 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0;
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}

export function hexA(hex, a) {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex, amt) {
  let { r, g, b } = parseHex(hex);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `rgb(${r},${g},${b})`;
}

export function parseHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
