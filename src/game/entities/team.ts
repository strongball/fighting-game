import type { GameState, Player, EntityId } from '../types';

// 陣營/敵我判定。核心是 factionKey：team>0 走隊伍號；否則循 ownerId 找根實體
// → 召喚物與主人同陣營，FFA 與組隊/boss 制皆正確。
export function factionKey(state: GameState, p: Player): string | null {
  if (!p) return null;
  if (p.team > 0) return 't' + p.team;
  const root = (p.ownerId && state.players[p.ownerId]) ? state.players[p.ownerId] : p;
  if (root.team > 0) return 't' + root.team;
  return 'p' + root.id;
}

export function isEnemy(state: GameState, ownerId: EntityId, target: Player): boolean {
  if (!target || !target.alive || target.id === ownerId) return false;
  const owner = state.players[ownerId];
  if (owner && factionKey(state, owner) === factionKey(state, target)) return false;
  return true;
}

export function isAlly(state: GameState, ownerId: EntityId, target: Player): boolean {
  if (!target || !target.alive) return false;
  if (target.id === ownerId) return true;
  const owner = state.players[ownerId];
  return !!(owner && factionKey(state, owner) === factionKey(state, target));
}
