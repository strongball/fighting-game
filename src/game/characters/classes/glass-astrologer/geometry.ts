import { ARENA, PLAYER_RADIUS } from '../../../constants.js';
import { clamp, dist } from '../../../entities/math.ts';
import { isEnemy } from '../../../entities/team.ts';
import type { GameState, Player, Zone, EntityId } from '../../../types';

export interface Vec2 { x: number; y: number }

export function norm(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

export function mirrorSegment(mirror: any) {
  const half = (mirror.length || 190) / 2;
  const dx = Math.cos(mirror.angle || 0) * half;
  const dy = Math.sin(mirror.angle || 0) * half;
  return {
    ax: mirror.x - dx,
    ay: mirror.y - dy,
    bx: mirror.x + dx,
    by: mirror.y + dy,
  };
}

export function reflectDir(dir: Vec2, mirror: any): Vec2 {
  const tangent = { x: Math.cos(mirror.angle || 0), y: Math.sin(mirror.angle || 0) };
  const normal = norm({ x: -tangent.y, y: tangent.x });
  const dot = dir.x * normal.x + dir.y * normal.y;
  return norm({ x: dir.x - 2 * dot * normal.x, y: dir.y - 2 * dot * normal.y });
}

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx;
}

export function segmentIntersection(a: Vec2, b: Vec2, c: Vec2, d: Vec2) {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denom = cross(rx, ry, sx, sy);
  if (Math.abs(denom) < 1e-6) return null;
  const qpx = c.x - a.x;
  const qpy = c.y - a.y;
  const t = cross(qpx, qpy, sx, sy) / denom;
  const u = cross(qpx, qpy, rx, ry) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + rx * t, y: a.y + ry * t, t, u };
}

export function findFirstMirrorHit(state: GameState, ownerId: EntityId, from: Vec2, to: Vec2, skipMirrorId?: EntityId | null) {
  let best: any = null;
  for (const mirror of state.zones as any[]) {
    if (mirror.kind !== 'glass_mirror' || mirror.owner !== ownerId || mirror.id === skipMirrorId) continue;
    if (mirror.lifetime <= 0) continue;
    const seg = mirrorSegment(mirror);
    const hit = segmentIntersection(from, to, { x: seg.ax, y: seg.ay }, { x: seg.bx, y: seg.by });
    if (!hit) continue;
    if (!best || hit.t < best.hit.t) best = { mirror, hit };
  }
  return best;
}

export function consumeMirror(mirror: Zone) {
  mirror.hits = (mirror.hits || 0) + 1;
}

export function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const x = ax + vx * t;
  const y = ay + vy * t;
  return dist(px, py, x, y);
}

export function ownMirrors(state: GameState, ownerId: EntityId) {
  return (state.zones as any[]).filter((z) => z.kind === 'glass_mirror' && z.owner === ownerId && z.lifetime > 0);
}

export function trimMirrors(state: GameState, ownerId: EntityId, maxMirrors = 2) {
  const mirrors = ownMirrors(state, ownerId).filter((z) => !z.ultimateMirror).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  while (mirrors.length > maxMirrors) {
    const old = mirrors.shift();
    if (old) old.lifetime = 0;
  }
}

export function clampArenaPoint(p: Vec2): Vec2 {
  return {
    x: clamp(p.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS),
    y: clamp(p.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS),
  };
}

export function markBonus(target: Player, ownerId: EntityId, perStack = 8) {
  const mark = target.effects && target.effects.glassmark;
  if (!mark || mark.srcId !== ownerId) return 0;
  return (mark.stacks || 0) * perStack;
}

export function findKaleidoscopeTarget(state: GameState, owner: Player, mirror: any, range: number) {
  let bestMarked: Player | null = null;
  let bestMarkedDist = Infinity;
  let bestAny: Player | null = null;
  let bestAnyDist = Infinity;
  for (const target of Object.values(state.players) as Player[]) {
    if (!target.alive || !isEnemy(state, owner.id, target)) continue;
    const d = dist(mirror.x, mirror.y, target.x, target.y);
    if (d > range) continue;
    const ownMark = target.effects?.glassmark?.srcId === owner.id && (target.effects.glassmark.stacks || 0) > 0;
    if (ownMark && d < bestMarkedDist) {
      bestMarked = target;
      bestMarkedDist = d;
    }
    if (d < bestAnyDist) {
      bestAny = target;
      bestAnyDist = d;
    }
  }
  return bestMarked || bestAny;
}
