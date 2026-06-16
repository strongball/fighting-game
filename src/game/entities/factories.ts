// @ts-nocheck
import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { getCharacter } from '../characters.js';
import { getBossEntityHitRadius } from '../bosses/hitbox.ts';
import { uid } from './math.ts';

export function makePlayer(id, name, charId, x, y, team = 0) {
  const c = getCharacter(charId);
  return {
    id, name, charId,
    team,
    x, y, vx: 0, vy: 0, kvx: 0, kvy: 0, facing: 0,
    hp: c.maxHp, maxHp: c.maxHp,
    mana: c.maxMana, maxMana: c.maxMana,
    alive: true,
    hitR: PLAYER_RADIUS,
    shield: 0, shieldTime: 0,
    kills: 0,
    ult: 0,
    cd: { basic: 0, skill1: 0, skill2: 0, ultimate: 0, evade: 0 },
    chargeState: null,
    effects: {},
    charge: null,
    leap: null,
    channel: null,
    trail: null,
    still: 0,
    combo: 0, comboTimer: 0,
    iaiTimer: 0,
    suppressTarget: null, suppressStacks: 0,
    ownerId: null,
    summonLife: 0,
  };
}

export function makeBoss(id, charId, x, y, team, opts = {}) {
  // \u540d\u7a31\uff1a\u512a\u5148\u7528 opts.name\uff1b\u5176\u6b21\u9b54\u738b\u7528 'Boss'\u3001\u5176\u9918 (\u5c0f\u5175/\u5206\u8eab/\u90e8\u4f4d/\u93e1\u50cf) \u7528\u6a21\u677f\u540d\u7a31\u3002
  const fallbackName = opts.isBoss ? 'Boss' : (getCharacter(charId).name || 'Boss');
  const e = makePlayer(id, opts.name || fallbackName, charId, x, y, team);
  if (opts.hpScale) { e.maxHp = Math.max(1, Math.round(e.maxHp * opts.hpScale)); e.hp = e.maxHp; }
  if (opts.maxHp) { e.maxHp = opts.maxHp; e.hp = e.maxHp; }
  e.isBoss = !!opts.isBoss;
  e.isMinion = !!opts.isMinion;
  e.isFake = !!opts.isFake;
  e.isPart = !!opts.isPart;
  e.isMirror = !!opts.isMirror;
  e.ownerId = opts.ownerId || null;
  e.aiId = opts.aiId || null;
  e.partId = opts.partId || null;
  e.bossRound = opts.round || 0;
  e.scale = opts.scale || 1;
  e.hitR = getBossEntityHitRadius(charId, e.scale, opts);
  e.aiState = {};
  e.facing = opts.facing != null ? opts.facing : e.facing;
  return e;
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

export function createInitialState(playersArr, flags = {}, opts = {}) {
  const pts = spawnPoints(playersArr.length);
  const players = {};
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  playersArr.forEach((p, i) => {
    const pl = makePlayer(p.id, p.name, p.charId, pts[i].x, pts[i].y, p.team || 0);
    pl.facing = Math.atan2(cy - pts[i].y, cx - pts[i].x);
    players[p.id] = pl;
  });
  return {
    phase: 'playing',
    mode: opts.mode || 'ffa',
    players,
    projectiles: [],
    zones: [],
    fx: [],
    time: 0,
    winner: null,
    winnerTeam: 0,
    startCount: playersArr.length,
    flags: { freeMana: false, noCooldown: false, noDamage: false, ...flags },
    round: opts.round || 1,
    bossId: null,
    bossHp: 0,
    bossMaxHp: 0,
    roundPhase: 'intro',
    roundTimer: 0,
    playerCount: playersArr.length,
    banner: null,
  };
}

export function makeProjectile(owner, x, y, vx, vy, opt) {
  return {
    id: uid(), owner, x, y, vx, vy,
    dmg: opt.dmg, radius: opt.radius, lifetime: opt.lifetime,
    color: opt.color, knockback: opt.knockback || 0,
    pierce: !!opt.pierce, effect: opt.effect || null,
    split: opt.split || null,
    homing: opt.homing || 0,
    pull: opt.pull || null,
    leaveZone: opt.leaveZone || null,
    freezeBonus: opt.freezeBonus || 0,
    vfx: opt.vfx || null,
    hit: {},
  };
}

export function makeZone(owner, x, y, opt) {
  return {
    id: uid(), owner, x, y,
    radius: opt.radius, dmg: opt.dmg,
    lifetime: opt.lifetime, tick: opt.tick, tickTimer: 0,
    delay: opt.delay || 0,
    effect: opt.effect || null, color: opt.color,
    effects: opt.effects || null,
    allyEffect: opt.allyEffect || null,
    knockback: opt.knockback || 0,
    vx: opt.vx || 0, vy: opt.vy || 0,
    follow: opt.follow ? owner : null,
    pull: opt.pull || 0,
    drainHeal: opt.drainHeal || 0,
    allyHeal: opt.allyHeal || 0,
    vfx: opt.vfx || null,
  };
}
