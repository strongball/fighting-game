// @ts-nocheck
export function applyEffect(p, kind, data, srcId) {
  if (kind === 'heal') { p.hp = Math.min(p.maxHp, p.hp + data.amount); return; }
  if (kind === 'shield') {
    p.shield = Math.max(p.shield, data.amount);
    p.shieldTime = Math.max(p.shieldTime, data.duration);
    return;
  }
  if (kind === 'cleanse') {
    delete p.effects.slow; delete p.effects.stun; delete p.effects.burn;
    delete p.effects.bleed; delete p.effects.chill; delete p.effects.root; delete p.effects.mark; delete p.effects.frozen;
    delete p.effects.weaken; delete p.effects.dmg_reduce;
    return;
  }
  if (kind === 'burn') {
    const cur = p.effects.burn;
    const tick = data.tick || 0.5;
    p.effects.burn = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3),
      tick,
      tickTimer: cur ? cur.tickTimer : tick,
      dmg: Math.max(cur ? cur.dmg : 0, data.dmg || 0),
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'bleed') {
    const cur = p.effects.bleed;
    const tick = data.tick || 0.5;
    p.effects.bleed = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3),
      tick,
      tickTimer: cur ? cur.tickTimer : tick,
      dmg: Math.max(cur ? cur.dmg : 0, data.dmg || 0),
      moveMult: data.moveMult || 1.5,
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'mark') {
    const cur = p.effects.mark;
    p.effects.mark = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 4),
      bonus: Math.max(cur ? cur.bonus : 0, data.factor || 0.25),
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'reflect') { p.effects.reflect = { remaining: data.duration || 5, factor: data.factor || 0.35 }; return; }
  if (kind === 'protect') {
    const cur = p.effects.protect;
    p.effects.protect = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 4),
      factor: Math.max(cur ? cur.factor : 0, data.factor || 0.2),
    };
    return;
  }
  if (kind === 'chill') {
    const cur = p.effects.chill;
    const max = data.max || 4;
    const stacks = Math.min(max, (cur ? cur.stacks : 0) + (data.stacks || 1));
    p.effects.chill = {
      remaining: data.duration || 3,
      stacks, max,
      factor: Math.max(0.35, 1 - 0.16 * stacks),
      freezeDur: data.freezeDur || 1.1,
      froze: cur ? cur.froze : false,
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'weaken') {
    const cur = p.effects.weaken;
    p.effects.weaken = { remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3), factor: Math.max(cur ? cur.factor : 0, data.factor || 0.15) };
    return;
  }
  if (kind === 'dmg_reduce') {
    const cur = p.effects.dmg_reduce;
    p.effects.dmg_reduce = { remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3), factor: Math.max(cur ? cur.factor : 0, data.factor || 0.25) };
    return;
  }
  if (kind === 'root') { p.effects.root = { remaining: data.duration || 1 }; return; }
  p.effects[kind] = {
    remaining: data.duration,
    factor: data.factor,
    speed: data.speed,
    dmg: data.dmg,
  };
}
