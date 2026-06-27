import { bossTick, checkBossRound } from '../../bossMode.js';
import { executeAction } from '../../actions/executor.ts';
import { tickTemporalEchoes } from '../../bosses/echoes.ts';
import { resolveCollisions, resolveStaticColliders } from '../collisions.ts';
import { tickDestructibles } from '../destructibles.ts';
import { updateFx } from '../fx.ts';
import { tickDropItems } from '../items.ts';
import { updateProjectiles } from '../projectiles.ts';
import { checkWin } from '../win.ts';
import { updateZones } from '../zones.ts';
import type { GameState } from '../../types';
import type { WorldSystem } from './types.ts';
import { isSystemDisabled, profileSystem } from './profiling.ts';

function cleanupDeadSummons(state: GameState) {
  for (const id of Object.keys(state.players)) {
    const o = state.players[id];
    if (o.isSummon && !o.alive) delete state.players[id];
  }
}

function resolveMode(state: GameState, dt: number) {
  if (state.mode === 'boss') {
    bossTick(state, dt);
    checkBossRound(state, dt);
  } else {
    checkWin(state);
  }
}

export const WORLD_SYSTEMS = [
  { id: 'collisions', tick: (state: GameState) => resolveCollisions(state) },
  { id: 'static-colliders', tick: (state: GameState) => resolveStaticColliders(state) },
  { id: 'projectiles', tick: (state: GameState, dt: number) => updateProjectiles(state, dt) },
  { id: 'zones', tick: (state: GameState, dt: number) => updateZones(state, dt) },
  { id: 'temporal-echoes', tick: (state: GameState, dt: number) => tickTemporalEchoes(state, dt, executeAction) },
  { id: 'destructibles', tick: (state: GameState, dt: number) => tickDestructibles(state, dt) },
  { id: 'drop-items', tick: (state: GameState, dt: number) => tickDropItems(state, dt) },
  { id: 'fx', tick: (state: GameState, dt: number) => updateFx(state, dt) },
  { id: 'dead-summon-cleanup', tick: (state: GameState) => cleanupDeadSummons(state) },
  { id: 'mode-resolution', tick: (state: GameState, dt: number) => resolveMode(state, dt) },
] as const satisfies readonly WorldSystem[];

export const WORLD_PIPELINE_STEP_IDS = WORLD_SYSTEMS.map((system) => system.id);

export function runWorldPipeline(state: GameState, dt: number) {
  for (const system of WORLD_SYSTEMS) {
    if (isSystemDisabled('world', system.id)) continue;
    profileSystem('world', system.id, () => system.tick(state, dt));
  }
}
