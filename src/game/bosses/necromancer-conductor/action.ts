import { registerBossAction } from '../actions.ts';

registerBossAction('summon_minions', (state: any, boss: any, a: any, h: any) => {
  let alive = 0;
  for (const o of Object.values(state.players) as any[]) {
    if (o.isMinion && o.ownerId === boss.id && o.alive) alive++;
  }
  const cap = a.cap || 6;
  const n = Math.min(a.count || 3, Math.max(0, cap - alive));
  if (n <= 0) return;
  const hp = Math.round((a.minionHp || 240) * (state._hpScale || 1));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random();
    const x = h.clamp(boss.x + Math.cos(ang) * 110, h.PLAYER_RADIUS, h.ARENA.width - h.PLAYER_RADIUS);
    const y = h.clamp(boss.y + Math.sin(ang) * 110, h.PLAYER_RADIUS, h.ARENA.height - h.PLAYER_RADIUS);
    const id = boss.id + '-min-' + Math.random().toString(36).slice(2, 7);
    const m = h.makeBoss(id, a.minionCharId != null ? a.minionCharId : 7, x, y, h.BOSS_TEAM, {
      isMinion: true,
      ownerId: boss.id,
      aiId: 'minion',
      name: a.minionName || '亡者殘影',
      maxHp: hp,
      scale: 1,
    });
    m.aiProfile = { range: 200, slots: ['basic'], pickTarget: 'nearestTarget' };
    state.players[id] = m;
  }
  h.addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: a.color, life: 0.5, radius: 100 });
});

registerBossAction('necro_burst', (state: any, boss: any, a: any, h: any) => {
  const radius = a.radius || 200;
  for (const o of Object.values(state.players) as any[]) {
    if (!h.isEnemy(state, boss.id, o)) continue;
    const dx = o.x - boss.x, dy = o.y - boss.y;
    const d = Math.hypot(dx, dy);
    if (d > radius) continue;
    h.dealDamage(state, o, a.dmg || 55, boss.id);
    if (d > 0) {
      o.kvx += dx / d * (a.knockback || 200);
      o.kvy += dy / d * (a.knockback || 200);
    }
  }
  let shieldAmt = a.shield || 200;
  if (a.shieldPerMinion) {
    let mc = 0;
    for (const o of Object.values(state.players) as any[]) {
      if (o.isMinion && o.ownerId === boss.id && o.alive) mc++;
    }
    shieldAmt += a.shieldPerMinion * mc;
  }
  h.applyEffect(boss, 'shield', { amount: shieldAmt, duration: a.duration || 8 });
  h.addFx(state, { type: 'hit', x: boss.x, y: boss.y, color: a.color, life: 0.5, radius, vfx: a.vfx });
});
