// @ts-nocheck
export function factionKey(state, p) {
  if (!p) return null;
  if (p.team > 0) return 't' + p.team;
  const root = (p.ownerId && state.players[p.ownerId]) ? state.players[p.ownerId] : p;
  if (root.team > 0) return 't' + root.team;
  return 'p' + root.id;
}

export function isEnemy(state, ownerId, target) {
  if (!target || !target.alive || target.id === ownerId) return false;
  const owner = state.players[ownerId];
  if (owner && factionKey(state, owner) === factionKey(state, target)) return false;
  return true;
}

export function isAlly(state, ownerId, target) {
  if (!target || !target.alive) return false;
  if (target.id === ownerId) return true;
  const owner = state.players[ownerId];
  return !!(owner && factionKey(state, owner) === factionKey(state, target));
}
