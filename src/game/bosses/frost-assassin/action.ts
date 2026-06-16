import { registerBossAction } from '../actions.ts';

registerBossAction('summon_clones', (state, boss, a, h) => {
  const n = a.count || 3;
  const clones = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const x = h.clamp(boss.x + Math.cos(ang) * 90, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
    const y = h.clamp(boss.y + Math.sin(ang) * 90, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
    const id = boss.id + '-clone-' + Math.random().toString(36).slice(2, 7);
    const c = h.makeBoss(id, boss.charId, x, y, h.BOSS_TEAM, {
      isFake: true,
      ownerId: boss.id,
      aiId: 'fake',
      name: '幻影分身',
      maxHp: 1,
      scale: boss.scale,
      facing: boss.facing,
    });
    state.players[id] = c;
    clones.push(c);
  }
  if (clones.length && Math.random() < 0.6) {
    const c = clones[Math.floor(Math.random() * clones.length)];
    const tx = c.x, ty = c.y;
    c.x = boss.x; c.y = boss.y; boss.x = tx; boss.y = ty;
  }
  h.addFx(state, { type: 'blink', x: boss.x, y: boss.y, color: a.color, life: 0.4, radius: 90 });
});
