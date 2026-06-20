import { registerBossAction } from '../actions.ts';

registerBossAction('soul_bind', (state, boss, a, h) => {
  if (boss.aiState && boss.aiState.preselectedSoulBindPairs) {
    if (!state.tethers) state.tethers = [];
    for (const pair of boss.aiState.preselectedSoulBindPairs) {
      const x = state.players[pair.a];
      const y = state.players[pair.b];
      if (x && y && x.alive && y.alive) {
        state.tethers.push({ a: x.id, b: y.id, minGap: a.minGap || 200, dmg: a.dmg || 18, tick: a.tick || 0.5, tickTimer: 0.5, remaining: a.duration || 6 });
        h.addFx(state, { type: 'buff', x: x.x, y: x.y, color: a.color, life: 0.6, radius: 70 });
        h.addFx(state, { type: 'buff', x: y.x, y: y.y, color: a.color, life: 0.6, radius: 70 });
      }
    }
    boss.aiState.preselectedSoulBindPairs = null;
    return;
  }

  const enemies = (Object.values(state.players) as any[]).filter((o) => h.isEnemy(state, boss.id, o) && o.alive);
  if (enemies.length < 2) return;
  for (let i = enemies.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = enemies[i]; enemies[i] = enemies[j]; enemies[j] = t;
  }
  if (!state.tethers) state.tethers = [];
  const pairs = Math.floor(Math.min(a.count || 2, enemies.length) / 2);
  for (let k = 0; k < pairs; k++) {
    const x = enemies[k * 2], y = enemies[k * 2 + 1];
    state.tethers.push({ a: x.id, b: y.id, minGap: a.minGap || 200, dmg: a.dmg || 18, tick: a.tick || 0.5, tickTimer: 0.5, remaining: a.duration || 6 });
    h.addFx(state, { type: 'buff', x: x.x, y: x.y, color: a.color, life: 0.6, radius: 70 });
    h.addFx(state, { type: 'buff', x: y.x, y: y.y, color: a.color, life: 0.6, radius: 70 });
  }
});

registerBossAction('light_dark', (state, boss, a, h) => {
  const safeLeft = boss.aiState && boss.aiState.safeLeft !== null && boss.aiState.safeLeft !== undefined
    ? boss.aiState.safeLeft
    : (Math.random() < 0.5);
  const midX = h.ARENA.width / 2;
  for (const o of Object.values(state.players) as any[]) {
    if (!h.isEnemy(state, boss.id, o)) continue;
    const onLeft = o.x < midX;
    if (onLeft !== safeLeft) {
      h.dealDamage(state, o, a.dmg || 80, boss.id);
      o.kvx += (onLeft ? -1 : 1) * 220;
    }
  }
  h.addFx(state, { type: 'ultimate', x: midX, y: h.ARENA.height / 2, color: a.color, life: 0.7, radius: 220 });
  if (boss.aiState) boss.aiState.safeLeft = null;
});
