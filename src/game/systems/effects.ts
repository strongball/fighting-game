import { PLAYER_RADIUS } from '../constants.js';
import { getCharacter } from '../characters.js';
import { dealDamage } from '../entities/damage.ts';
import { applyEffect } from '../entities/effects.ts';
import { applyHeal } from '../entities/heal.ts';
import { addFx } from '../entities/fx.ts';
import type { GameState, Player, EntityId } from '../types';

function dotLifesteal(state: GameState, srcId: EntityId | null | undefined, dmg: number) {
  if (srcId == null || !dmg) return;
  const src = state.players[srcId];
  if (!src || !src.alive) return;
  const talent = getCharacter(src.charId).talent;
  if (talent && talent.id === 'undeath') applyHeal(state, src, dmg * (talent.factor || 0.15));
}

export function tickStatusEffects(state: GameState, p: Player, dt: number) {
  for (const kind of Object.keys(p.effects)) {
    const effect = p.effects[kind]!;
    effect.remaining -= dt;

    if (kind === 'burn') {
      effect.tickTimer -= dt;
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.tick;
        dealDamage(state, p, effect.dmg, effect.srcId);
        dotLifesteal(state, effect.srcId, effect.dmg);
        addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#ff6b3d', life: 0.3, radius: PLAYER_RADIUS });
      }
    } else if (kind === 'bleed') {
      const moving = (Math.abs(p.vx) + Math.abs(p.vy)) > 1;
      effect.tickTimer -= dt * (moving ? effect.moveMult : 1);
      if (effect.tickTimer <= 0) {
        effect.tickTimer += effect.tick;
        dealDamage(state, p, effect.dmg, effect.srcId);
        dotLifesteal(state, effect.srcId, effect.dmg);
        addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#e84141', life: 0.3, radius: PLAYER_RADIUS });
      }
    } else if (kind === 'chill') {
      if (effect.stacks >= effect.max && !effect.froze) {
        effect.froze = true;
        applyEffect(p, 'stun', { duration: effect.freezeDur });
        applyEffect(p, 'frozen', { duration: effect.freezeDur });
        effect.remaining = 0;
        addFx(state, { type: 'hit', x: p.x, y: p.y, color: '#9fe8ff', life: 0.4, radius: PLAYER_RADIUS * 2.5, vfx: 'mage_iceshard' });
      }
    }

    if (effect.remaining <= 0) delete p.effects[kind];
  }
}
