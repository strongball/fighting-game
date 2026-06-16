import { PLAYER_RADIUS } from '../constants.js';
import { getCharacter } from '../characters.js';

export function getBossEntityHitRadius(charId: number, scale: number, opts: any = {}) {
  if (opts.isPart) return Math.round(24 * (scale || 1));
  if (opts.isBoss) {
    const ch = getCharacter(charId);
    const md = ch.modelConfig || {};
    const bulk = md.bulk || 2.2;
    return Math.round(11 * bulk * (scale || md.scale || 1) * 0.9);
  }
  return Math.round(PLAYER_RADIUS * (scale || 1));
}
