// @ts-nocheck
import { registerBossAction } from '../actions.ts';
import { makeZone } from '../../entities/factories.ts';

export const MAGNET_ANCHOR_VFX = 'boss_magnet_anchor';
export const MAGNET_DANGER_VFX = 'boss_magnet_collapse';
export const MAGNET_POLARITY_VFX = 'boss_magnet_polarity';
export const MAGNET_RESONANCE_VFX = 'boss_magnet_resonance';
export const MAGNET_TEAR_VFX = 'boss_magnet_tear';

function aliveEnemies(state, boss, h) {
  return (Object.values(state.players) as any[])
    .filter((o) => h.isEnemy(state, boss.id, o) && o.alive)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

function ensureMagnetState(state) {
  state.bossCustom = state.bossCustom || {};
  state.bossCustom.magnetArtificer = state.bossCustom.magnetArtificer || {
    polarities: {},
    polarityTimer: 0,
    anchors: [],
    fxTimer: 0,
  };
  return state.bossCustom.magnetArtificer;
}

function polarityColor(polarity) {
  return polarity === 'N' ? '#58d7ff' : '#ff5d6c';
}

function humanEnemyCount(enemies) {
  return enemies.filter((p) => !p.isNpc).length;
}

function nearestAnchor(state, boss, target, maxRange) {
  let best = null;
  let bestD = Infinity;
  for (const z of state.zones || []) {
    if (!z.magneticAnchor || z.owner !== boss.id) continue;
    const d = Math.hypot(z.x - target.x, z.y - target.y);
    if (d <= maxRange && d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return best;
}

function emitResonance(state, target, polarity, color, radius, h) {
  h.addFx(state, {
    type: 'hit',
    x: target.x,
    y: target.y,
    color,
    life: 0.42,
    radius,
    polarity,
    targetId: target.id,
    vfx: MAGNET_RESONANCE_VFX,
  });
}

export function assignMagneticPolarities(state, boss, action, h) {
  const bc = ensureMagnetState(state);
  const duration = action.duration || 8.0;
  const enemies = aliveEnemies(state, boss, h);
  bc.polarities = {};
  bc.polarityTimer = duration;
  for (let i = 0; i < enemies.length; i++) {
    const target = enemies[i];
    const polarity = i % 2 === 0 ? 'N' : 'S';
    const color = polarityColor(polarity);
    const mark = {
      polarity,
      color,
      sourceBossId: boss.id,
      remaining: duration,
      expiresAt: (state.time || 0) + duration,
      resonanceCd: 0,
      tearCd: 0,
      blastCd: 0,
    };
    target.magneticPolarity = mark;
    bc.polarities[target.id] = mark;
    const crackDmg = boss.magnetOverload ? (action.overloadCrackDmg || action.crackDmg) : action.crackDmg;
    if (crackDmg) {
      h.dealDamage(state, target, crackDmg, boss.id, { source: 'skill2' });
    }
    h.addFx(state, {
      type: action.crackDmg ? 'hit' : 'buff',
      x: target.x,
      y: target.y,
      color,
      life: action.crackDmg ? 0.78 : 0.65,
      radius: action.crackDmg ? 96 : 70,
      text: polarity,
      polarity,
      targetId: target.id,
      vfx: action.crackDmg ? MAGNET_RESONANCE_VFX : MAGNET_POLARITY_VFX,
    });
    h.addFx(state, {
      type: 'buff',
      x: target.x,
      y: target.y,
      color,
      life: 0.9,
      radius: 74,
      text: polarity,
      polarity,
      targetId: target.id,
      vfx: MAGNET_POLARITY_VFX,
    });
  }
  h.addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: action.color || '#58d7ff', life: 0.8, radius: 180, vfx: 'boss_magnet_mark' });
  state.banner = {
    text: '磁極烙印',
    sub: '藍色 N 與紅色 S 會共振爆裂，並受磁錨吸引或排斥',
    life: 2.2,
    kind: 'phase',
    color: '#58d7ff',
  };
  return enemies;
}

registerBossAction('magnetic_polarity', (state, boss, action, h) => {
  assignMagneticPolarities(state, boss, action, h);
});

registerBossAction('magnetic_needles', (state, boss, action, h) => {
  h.executeAction(state, boss, {
    ...action,
    type: 'projectile',
    vfx: action.vfx || 'boss_magnet_needle',
  }, { source: 'skill1' });

  const enemies = aliveEnemies(state, boss, h);
  const solo = humanEnemyCount(enemies) <= 1;
  const maxRange = action.resonanceRadius || 360;
  for (const target of enemies) {
    const mark = target.magneticPolarity;
    if (!mark || mark.sourceBossId !== boss.id) continue;
    if ((mark.resonanceCd || 0) > 0) continue;

    const anchor = nearestAnchor(state, boss, target, maxRange);
    if (!anchor) {
      const dmg = solo ? 10 : (boss.magnetOverload ? 22 : 16);
      mark.resonanceCd = solo ? 1.0 : (boss.magnetOverload ? 0.6 : 0.8);
      h.dealDamage(state, target, dmg, boss.id, { source: 'skill1' });
      emitResonance(state, target, mark.polarity, mark.color, solo ? 58 : 74, h);
      continue;
    }

    const same = mark.polarity === anchor.polarity;
    const dx = target.x - anchor.x;
    const dy = target.y - anchor.y;
    const d = Math.hypot(dx, dy) || 1;
    const color = same ? mark.color : '#a855ff';
    mark.resonanceCd = solo ? 1.25 : (boss.magnetOverload ? 0.72 : (action.resonanceCd || 1.0));

    if (same) {
      const push = solo ? 190 : (boss.magnetOverload ? 340 : 285);
      target.kvx += dx / d * push;
      target.kvy += dy / d * push;
      h.applyEffect(target, 'slow', { duration: solo ? 0.45 : 0.7, factor: solo ? 0.8 : 0.68 }, boss.id);
      h.dealDamage(state, target, solo ? 12 : (boss.magnetOverload ? 28 : 22), boss.id, { source: 'skill1' });
      emitResonance(state, target, mark.polarity, color, solo ? 74 : 104, h);
    } else {
      const pull = solo ? 145 : (boss.magnetOverload ? 260 : 215);
      target.kvx -= dx / d * pull;
      target.kvy -= dy / d * pull;
      const dmg = solo ? (action.soloResonanceDmg || 9) : (boss.magnetOverload ? (action.overloadResonanceDmg || 24) : (action.resonanceDmg || 18));
      h.dealDamage(state, target, dmg, boss.id, { source: 'skill1' });
      emitResonance(state, target, mark.polarity, color, solo ? 88 : 124, h);
    }
  }
});

registerBossAction('magnetic_collapse', (state, boss, action, h) => {
  const enemies = aliveEnemies(state, boss, h);
  if (!enemies.length) return;

  const bc = ensureMagnetState(state);
  const missingPolarity = enemies.some((p) => !p.magneticPolarity || p.magneticPolarity.sourceBossId !== boss.id);
  if (missingPolarity) assignMagneticPolarities(state, boss, { duration: action.polarityDuration || 7.5, color: action.color }, h);

  state.zones = (state.zones || []).filter((z) => !z.magneticAnchor && !z.magneticDanger);
  const humanEnemies = enemies.filter((p) => !p.isNpc);
  const solo = humanEnemies.length <= 1;
  const n = solo ? 6 : Math.min(boss.magnetOverload ? 9 : 8, Math.max(6, enemies.length + 3 + (boss.magnetOverload ? 1 : 0)));
  const radius = action.radius || 130;
  const warning = action.warning || 1.25;
  const lifetime = action.duration || 3.4;
  const centerX = h.ARENA.width / 2;
  const centerY = h.ARENA.height / 2;
  const longR = Math.min(h.ARENA.width, h.ARENA.height) * (solo ? 0.34 : 0.38);
  const shortR = longR * 0.58;
  const base = boss.facing || 0;
  const anchors = [];

  for (let i = 0; i < n; i++) {
    const ang = base + (i / n) * Math.PI * 2 + (solo ? Math.PI / 9 : Math.PI / 5);
    const orbit = i % 2 === 0 ? longR : shortR;
    const x = h.clamp(centerX + Math.cos(ang) * orbit, 70, h.ARENA.width - 70);
    const y = h.clamp(centerY + Math.sin(ang) * orbit, 70, h.ARENA.height - 70);
    const polarity = i % 2 === 0 ? 'N' : 'S';
    const color = polarityColor(polarity);
    const zone = makeZone(boss.id, x, y, {
      radius,
      dmg: solo ? 26 : (boss.magnetOverload ? 64 : 55),
      lifetime,
      tick: 999,
      delay: warning,
      knockback: solo ? 165 : (boss.magnetOverload ? 260 : 225),
      color,
      vfx: MAGNET_DANGER_VFX,
      srcSlot: 'ultimate',
    });
    zone.magneticAnchor = true;
    zone.magneticDanger = true;
    zone.polarity = polarity;
    zone.force = solo ? (action.soloForce || 900) : (action.force || 430) * (boss.magnetOverload ? 1.65 : 1.42);
    zone.fieldScale = solo ? (action.soloFieldScale || 340) : (action.fieldScale || 320);
    zone.softening = solo ? (action.soloSoftening || 105) : (action.softening || 120);
    zone.warningForceRatio = solo ? 0.7 : 0.5;
    zone.repulsionMult = solo ? 1.75 : (boss.magnetOverload ? 1.78 : 1.6);
    zone.attractionMult = solo ? 1.05 : (boss.magnetOverload ? 1.34 : 1.18);
    zone.soloMagnet = solo;
    zone.globalMagnet = true;
    zone.visualLabel = polarity;
    zone.spawnedBy = boss.id;
    zone.tearDmg = solo ? 16 : (boss.magnetOverload ? 38 : 30);
    zone.tearRange = solo ? 390 : (boss.magnetOverload ? 470 : 430);
    zone.tearVfx = MAGNET_TEAR_VFX;
    zone.blastRadius = solo ? 82 : (boss.magnetOverload ? 96 : 88);
    state.zones.push(zone);
    anchors.push({ id: zone.id, x, y, polarity, color, radius, remaining: lifetime + warning });
    h.addFx(state, { type: 'buff', x, y, color, life: 0.95, radius: 122, polarity, vfx: MAGNET_ANCHOR_VFX });
  }

  bc.anchors = anchors;
  bc.collapseTimer = lifetime + warning;
  h.addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: action.color || '#a855ff', life: 0.85, radius: 320, vfx: 'boss_magnet_ult' });
  state.banner = {
    text: '磁場坍縮',
    sub: '同極排斥、異極吸引，離開磁錨爆發圈',
    life: 2.4,
    kind: 'phase',
    color: '#a855ff',
  };
});
