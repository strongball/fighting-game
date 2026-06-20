// Compatibility barrel for entity helpers.
export { uid, clamp, dist, angleDiff, missingHp } from './entities/math.ts';
export { makePlayer, makeBoss, spawnPoints, createInitialState, makeProjectile, makeZone, makeDropItem } from './entities/factories.ts';
export { addFx } from './entities/fx.ts';
export { factionKey, isEnemy, isAlly } from './entities/team.ts';
export { dealDamage } from './entities/damage.ts';
export { applyEffect } from './entities/effects.ts';
