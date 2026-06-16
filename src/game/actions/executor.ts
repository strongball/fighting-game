// @ts-nocheck
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
import { createActionContext, runPostActionEffects } from './context.ts';
import { ACTION_HANDLERS } from './handlers/index.ts';

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

export function executeAction(state, caster, action, opts = {}) {
  const ctx = createActionContext(state, caster, action, opts, executeAction);
  const handler = ACTION_HANDLERS.get(action.type);
  if (handler) handler(ctx);
  else executeBossAction(state, caster, action, bossActionHelpers());
  runPostActionEffects(ctx);
}
