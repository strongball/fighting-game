import { ARENA } from '../constants.js';
import { dist } from '../entities/math.ts';
import { spawnPoints } from '../entities/factories.ts';
import { addFx } from '../entities/fx.ts';
import { recordRevive } from '../entities/stats.ts';
import { followBossParts, teamPlayers } from './lifecycle.ts';
import { tickBossPhases } from './phases.ts';
import { tickTimeAnchors } from './time-anchors.ts';

const REVIVE_RADIUS = 100;
const REVIVE_TIME = 3.0;
const HIST_CAP = 150;

export function reviveAndHealAll(state: any) {
  const humans = teamPlayers(state);
  const pts = spawnPoints(humans.length);
  const cx = ARENA.width / 2, cy = ARENA.height * 0.72;
  humans.forEach((p: any, i: number) => {
    p.alive = true;
    p.hp = p.maxHp; p.mana = p.maxMana; p.ult = 0;
    p.shield = 0; p.shieldTime = 0; p.effects = {};
    p.kvx = 0; p.kvy = 0; p.vx = 0; p.vy = 0;
    p.charge = null; p.leap = null; p.channel = null; p.trail = null; p.chargeState = null;
    p.reviveProg = 0;
    p.x = pts[i] ? cx + (pts[i].x - cx) * 0.5 : cx;
    p.y = cy;
    p.facing = -Math.PI / 2;
  });
}

export function tickBossSystems(state: any, dt: number) {
  followBossParts(state);
  tickBossPhases(state, dt);
  tickTimeAnchors(state, dt);
  tetherTick(state, dt);
  reviveTick(state, dt);
  recordHistory(state);
}

function tetherTick(state: any, dt: number) {
  if (!state.tethers || !state.tethers.length) return;
  const keep = [];
  for (const t of state.tethers) {
    t.remaining -= dt;
    const a = state.players[t.a], b = state.players[t.b];
    if (!a || !b || !a.alive || !b.alive || t.remaining <= 0) continue;
    const d = dist(a.x, a.y, b.x, b.y);
    if (d < t.minGap) {
      t.tickTimer -= dt;
      if (t.tickTimer <= 0) {
        t.tickTimer += t.tick || 0.5;
        a.hp = Math.max(0, a.hp - t.dmg); b.hp = Math.max(0, b.hp - t.dmg);
        if (a.hp <= 0) a.alive = false; if (b.hp <= 0) b.alive = false;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        addFx(state, { type: 'hit', x: mx, y: my, color: '#ff4d6d', life: 0.25, radius: 50 });
      }
    }
    t._vis = (t._vis || 0) - dt;
    if (t._vis <= 0) {
      t._vis = 0.2;
      addFx(state, { type: 'buff', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, color: d < t.minGap ? '#ff4d6d' : '#d8b3ff', life: 0.25, radius: 30 });
    }
    keep.push(t);
  }
  state.tethers = keep;
}

function reviveTick(state: any, dt: number) {
  const humans = teamPlayers(state);
  for (const p of humans) {
    if (p.alive) continue;
    let helper = false;
    for (const o of humans) {
      if (o.alive && o.id !== p.id && dist(o.x, o.y, p.x, p.y) <= REVIVE_RADIUS) { helper = true; break; }
    }
    if (helper) {
      p.reviveProg = (p.reviveProg || 0) + dt;
      if (p.reviveProg >= REVIVE_TIME) {
        p.alive = true; p.hp = p.maxHp; p.mana = p.maxMana; p.effects = {}; p.shield = 0;
        p.cd = { basic: 0, skill1: 0, skill2: 0, ultimate: 0 };
        p.reviveProg = 0; p.kvx = 0; p.kvy = 0;
        addFx(state, { type: 'buff', x: p.x, y: p.y, color: '#7CFC00', life: 0.6, radius: 70 });
        // 找最近的活人記為復活施援者
        let helperId = null, best = Infinity;
        for (const o of humans) {
          if (!o.alive || o.id === p.id) continue;
          const d = dist(o.x, o.y, p.x, p.y);
          if (d < best) { best = d; helperId = o.id; }
        }
        if (helperId != null) recordRevive(state, helperId);
      }
    } else {
      p.reviveProg = Math.max(0, (p.reviveProg || 0) - dt * 0.5);
    }
  }
}

function recordHistory(state: any) {
  for (const p of teamPlayers(state)) {
    if (!p._hist) p._hist = [];
    p._hist.push({ x: p.x, y: p.y });
    if (p._hist.length > HIST_CAP) p._hist.shift();
  }
}
