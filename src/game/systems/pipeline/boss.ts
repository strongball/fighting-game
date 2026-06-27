import {
  followBossParts,
  recordBossHistory,
  reviveTick,
  tetherTick,
  tickBossSpecific,
} from '../../bosses/systems.ts';
import { tickBossPhases } from '../../bosses/phases.ts';
import { tickTimeAnchors } from '../../bosses/time-anchors.ts';
import type { GameState } from '../../types';
import type { BossSystem } from './types.ts';
import { isSystemDisabled, profileSystem } from './profiling.ts';

export const BOSS_SYSTEMS = [
  { id: 'parts', tick: (state: GameState) => followBossParts(state) },
  { id: 'phases', tick: (state: GameState, dt: number) => tickBossPhases(state, dt) },
  { id: 'time-anchors', tick: (state: GameState, dt: number) => tickTimeAnchors(state, dt) },
  { id: 'tethers', tick: (state: GameState, dt: number) => tetherTick(state, dt) },
  { id: 'revive', tick: (state: GameState, dt: number) => reviveTick(state, dt) },
  { id: 'boss-specific-tick', tick: (state: GameState, dt: number) => tickBossSpecific(state, dt) },
  { id: 'history', tick: (state: GameState) => recordBossHistory(state) },
] as const satisfies readonly BossSystem[];

export const BOSS_PIPELINE_STEP_IDS = BOSS_SYSTEMS.map((system) => system.id);

export function runBossPipeline(state: GameState, dt: number) {
  if (state.roundPhase !== 'fighting') return;
  for (const system of BOSS_SYSTEMS) {
    if (isSystemDisabled('boss', system.id)) continue;
    profileSystem('boss', system.id, () => system.tick(state, dt));
  }
}
