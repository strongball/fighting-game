// 實體工廠、數學工具、傷害/效果輔助

import { ARENA, PLAYER_RADIUS } from './constants.js';
import { getCharacter } from './characters.js';

let _id = 1;
export function uid() { return _id++; }

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function makePlayer(id, name, charId, x, y) {
  const c = getCharacter(charId);
  return {
    id, name, charId,
    x, y, vx: 0, vy: 0, kvx: 0, kvy: 0, facing: 0,
    hp: c.maxHp, maxHp: c.maxHp,
    mana: c.maxMana, maxMana: c.maxMana,
    alive: true,
    shield: 0, shieldTime: 0,
    kills: 0,
    cd: { basic: 0, skill1: 0, skill2: 0 },
    effects: {}, // kind -> { remaining, factor?, speed?, dmg? }
  };
}

export function spawnPoints(n) {
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  const r = Math.min(ARENA.width, ARENA.height) * 0.38;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function createInitialState(playersArr) {
  const pts = spawnPoints(playersArr.length);
  const players = {};
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  playersArr.forEach((p, i) => {
    const pl = makePlayer(p.id, p.name, p.charId, pts[i].x, pts[i].y);
    pl.facing = Math.atan2(cy - pts[i].y, cx - pts[i].x); // 一開始面向中心
    players[p.id] = pl;
  });
  return {
    phase: 'playing',
    players,
    projectiles: [],
    zones: [],
    fx: [],          // 短暫視覺特效
    time: 0,
    winner: null,
    startCount: playersArr.length,
  };
}

export function makeProjectile(owner, x, y, vx, vy, opt) {
  return {
    id: uid(), owner, x, y, vx, vy,
    dmg: opt.dmg, radius: opt.radius, lifetime: opt.lifetime,
    color: opt.color, knockback: opt.knockback || 0,
    pierce: !!opt.pierce, effect: opt.effect || null,
    hit: {},
  };
}

export function makeZone(owner, x, y, opt) {
  return {
    id: uid(), owner, x, y,
    radius: opt.radius, dmg: opt.dmg,
    lifetime: opt.lifetime, tick: opt.tick, tickTimer: opt.delay ? opt.delay : 0,
    delay: opt.delay || 0,
    effect: opt.effect || null, color: opt.color,
  };
}

export function addFx(state, fx) {
  fx.id = uid();
  fx.life = fx.life ?? 0.25;
  fx.maxLife = fx.life;
  state.fx.push(fx);
  if (state.fx.length > 120) state.fx.shift();
}

export function dealDamage(state, target, amount, attackerId) {
  if (!target.alive || amount <= 0) return;
  let dmg = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg <= 0) return;
  target.hp -= dmg;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    const killer = state.players[attackerId];
    if (killer && killer.id !== target.id) killer.kills++;
    addFx(state, { type: 'death', x: target.x, y: target.y, color: '#ffffff', life: 0.5, radius: PLAYER_RADIUS * 2 });
  }
}

export function applyEffect(p, kind, data) {
  if (kind === 'heal') { p.hp = Math.min(p.maxHp, p.hp + data.amount); return; }
  if (kind === 'shield') {
    p.shield = Math.max(p.shield, data.amount);
    p.shieldTime = Math.max(p.shieldTime, data.duration);
    return;
  }
  if (kind === 'cleanse') { delete p.effects.slow; delete p.effects.stun; return; }
  p.effects[kind] = {
    remaining: data.duration,
    factor: data.factor,
    speed: data.speed,
    dmg: data.dmg,
  };
}
