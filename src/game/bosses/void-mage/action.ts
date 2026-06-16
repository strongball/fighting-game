import { registerBossAction } from '../actions.ts';

registerBossAction('apply_scramble', (state, boss, a, h) => {
  for (const o of Object.values(state.players) as any[]) {
    if (!h.isEnemy(state, boss.id, o)) continue;
    if (h.dist(boss.x, boss.y, o.x, o.y) <= (a.radius || 320)) {
      h.applyEffect(o, 'scramble', { duration: a.duration || 2 });
    }
  }
  h.addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: a.color, life: 0.5, radius: a.radius || 320 });
});

registerBossAction('time_rewind', (state, boss, a, h) => {
  const back = Math.round((a.rewindSeconds || 3) * 30);
  for (const o of Object.values(state.players) as any[]) {
    if (!h.isEnemy(state, boss.id, o)) continue;
    if (a.dmg) h.dealDamage(state, o, a.dmg, boss.id);
    const hist = o._hist;
    if (hist && hist.length) {
      const idx = Math.max(0, hist.length - back);
      const pos = hist[idx];
      o.x = h.clamp(pos.x, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
      o.y = h.clamp(pos.y, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
      h.addFx(state, { type: 'blink', x: o.x, y: o.y, color: a.color, life: 0.3, radius: 50 });
    }
  }
  const enemies = (Object.values(state.players) as any[]).filter((o) => h.isEnemy(state, boss.id, o));
  if (enemies.length >= 2) {
    let i = Math.floor(Math.random() * enemies.length), j = Math.floor(Math.random() * enemies.length);
    if (j === i) j = (j + 1) % enemies.length;
    const A = enemies[i], B = enemies[j], tx = A.x, ty = A.y;
    A.x = B.x; A.y = B.y; B.x = tx; B.y = ty;
  }
  h.addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: a.color, life: 0.6, radius: a.radius || 150 });
});
