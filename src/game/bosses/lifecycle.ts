import { ARENA, difficultyMult } from '../constants.js';
import { makeBoss } from '../entities/factories.ts';
import { getBossForRound } from '../bosses.js';
import { initBossPhase } from './phases.ts';

export const BOSS_TEAM = 2;
export const PLAYER_TEAM = 1;

export function teamPlayers(state: any) {
  const out = [];
  for (const o of Object.values(state.players) as any[]) if (o.team === PLAYER_TEAM) out.push(o);
  return out;
}

export function findBossEntity(state: any) {
  for (const o of Object.values(state.players) as any[]) if (o.isBoss) return o;
  return null;
}

export function bossSideEntities(state: any) {
  const out = [];
  for (const o of Object.values(state.players) as any[]) if (o.team === BOSS_TEAM) out.push(o);
  return out;
}

export function spawnBoss(state: any, round: number) {
  const data = getBossForRound(round);
  if (!data) return null;
  const n = Math.max(1, teamPlayers(state).filter((p) => p.alive).length || state.playerCount || 1);
  const hpScale = Math.max(0.35, n / 4) * difficultyMult(state.flags.difficulty ?? 0.5).bossHp;
  state._hpScale = hpScale;
  const cx = ARENA.width / 2, cy = ARENA.height * 0.3;
  const id = 'boss-' + round;
  const modelConfig = data.modelConfig || {};
  const scale = modelConfig.scale || 2;
  const boss = makeBoss(id, data.id, cx, cy, BOSS_TEAM, {
    isBoss: true, aiId: data.ai, hpScale, round, name: data.name, scale, facing: Math.PI / 2,
  });
  state.players[id] = boss;
  initBossPhase(boss);

  const mech = data.mechanic;
  if (mech && mech.parts) {
    for (const pdef of mech.parts) {
      const pc = (modelConfig.parts || []).find((x: any) => x.id === pdef.id) || {};
      const off = pdef.offset || { x: 0, y: 0 };
      const ox = (off.x || 0) * (scale * 0.5), oy = (off.y || 0) * (scale * 0.5);
      const pid = id + '-' + pdef.id;
      const part: any = makeBoss(pid, data.id, cx + ox, cy + oy, BOSS_TEAM, {
        isPart: true, ownerId: id, partId: pdef.id, maxHp: Math.round((pdef.baseHp || 1500) * hpScale), scale: 1.6, aiId: null,
      });
      part.partColor = pc.color || '#ffffff';
      part._offx = ox; part._offy = oy;
      state.players[pid] = part;
    }
  }
  return boss;
}

export function clearBossSide(state: any) {
  for (const o of bossSideEntities(state)) delete state.players[o.id];
  state.tethers = [];
  state.timeAnchors = [];
  state.timeAnchorRitual = null;
  state.temporalEchoes = [];
}

export function followBossParts(state: any) {
  for (const o of Object.values(state.players) as any[]) {
    if (!o.isPart || !o.alive) continue;
    const boss = state.players[o.ownerId];
    if (!boss || !boss.alive) { o.alive = false; continue; }
    o.x = boss.x + (o._offx || 0);
    o.y = boss.y + (o._offy || 0);
    o.facing = boss.facing;
  }
}
