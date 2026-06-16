// @ts-nocheck
let nextId = 1;

export function uid() {
  return nextId++;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const missingHp = (p) => 1 - p.hp / p.maxHp;
