import { ARENA, PLAYER_RADIUS } from '../constants.js';
import { getCharacter } from '../characters.js';
import { clamp, dist } from '../entities/math.ts';
import { makeBoss } from '../entities/factories.ts';
import { dealDamage } from '../entities/damage.ts';
import { applyEffect } from '../entities/effects.ts';
import { addFx } from '../entities/fx.ts';
import { isEnemy } from '../entities/team.ts';
import { BOSS_TEAM } from '../bossMode.js';
import { executeBossAction } from '../bosses/actions.ts';
import { maybeScheduleTemporalEcho } from '../bosses/echoes.ts';
import { createActionContext, runPostActionEffects } from './context.ts';
import { ACTION_HANDLERS } from './handlers/index.ts';
import type { GameState, Player, ActionDef, ActionOpts } from '../types';

function bossActionHelpers() {
  return {
    ARENA,
    PLAYER_RADIUS,
    BOSS_TEAM,
    clamp,
    dist,
    makeBoss,
    addFx,
    isEnemy,
    applyEffect,
    dealDamage,
    getCharacter,
    executeAction,
  };
}

export function executeAction(state: GameState, caster: Player, action: ActionDef, opts: ActionOpts = {}) {
  const ctx = createActionContext(state, caster, action, opts, executeAction);
  // DPS 歸因：標記目前施放的技能 slot。同步傷害經 dealDamage 的 _srcSlot fallback 取用；
  // deferred 實體（投射物/區域/DoT）則由各 handler 讀 ctx.source 於建立時 stamp。
  // save/restore 以支援巢狀施放（combo/echo/合成動作）。
  const prevSrc = caster._srcSlot;
  caster._srcSlot = ctx.source != null ? ctx.source : prevSrc;
  const handler = ACTION_HANDLERS.get(action.type);
  if (handler) handler(ctx);
  else executeBossAction(state, caster, action, bossActionHelpers());

  // Replicate Boss actions for active shadow clones
  if (caster.isBoss && !caster.isFake && !opts.cloneCast) {
    const clones = Object.values(state.players).filter(
      (p: any) => p.alive && p.ownerId === caster.id && p.isFake && p.charId === caster.charId
    );
    clones.forEach((clone) => {
      clone.facing = caster.facing;
      executeAction(state, clone, action, { ...opts, cloneCast: true });
    });
  }

  runPostActionEffects(ctx);
  caster._srcSlot = prevSrc;
  maybeScheduleTemporalEcho(state, caster, action);
}
