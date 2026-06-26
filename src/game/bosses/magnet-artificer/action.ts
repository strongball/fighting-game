// @ts-nocheck
import { registerBossAction } from '../actions.ts';
import { makeZone } from '../../entities/factories.ts';

export const MAGNET_ANCHOR_VFX = 'boss_magnet_anchor';
export const MAGNET_DANGER_VFX = 'boss_magnet_collapse';
export const MAGNET_POLARITY_VFX = 'boss_magnet_polarity';

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
    };
    target.magneticPolarity = mark;
    bc.polarities[target.id] = mark;
    h.addFx(state, {
      type: 'buff',
      x: target.x,
      y: target.y,
      color,
      life: 0.65,
      radius: 70,
      text: polarity,
      polarity,
      targetId: target.id,
      vfx: MAGNET_POLARITY_VFX,
    });
  }
  h.addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: action.color || '#58d7ff', life: 0.5, radius: 150, vfx: 'boss_magnet_mark' });
  state.banner = {
    text: '磁極烙印',
    sub: '藍色 N 與紅色 S 會受磁錨吸引或排斥',
    life: 2.2,
    kind: 'phase',
    color: '#58d7ff',
  };
  return enemies;
}

registerBossAction('magnetic_polarity', (state, boss, action, h) => {
  assignMagneticPolarities(state, boss, action, h);
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
  const n = solo ? 6 : Math.min(8, Math.max(6, enemies.length + 3));
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
      dmg: solo ? 22 : 34,
      lifetime,
      tick: 999,
      delay: warning,
      knockback: solo ? 150 : 190,
      color,
      vfx: MAGNET_DANGER_VFX,
      srcSlot: 'ultimate',
    });
    zone.magneticAnchor = true;
    zone.magneticDanger = true;
    zone.polarity = polarity;
    zone.force = solo ? (action.soloForce || 780) : (action.force || 430);
    zone.fieldScale = solo ? (action.soloFieldScale || 300) : (action.fieldScale || 270);
    zone.softening = solo ? (action.soloSoftening || 120) : (action.softening || 140);
    zone.warningForceRatio = solo ? 0.7 : 0.5;
    zone.repulsionMult = solo ? 1.75 : 1.55;
    zone.attractionMult = solo ? 0.82 : 0.9;
    zone.soloMagnet = solo;
    zone.globalMagnet = true;
    zone.visualLabel = polarity;
    zone.spawnedBy = boss.id;
    state.zones.push(zone);
    anchors.push({ id: zone.id, x, y, polarity, color, radius, remaining: lifetime + warning });
    h.addFx(state, { type: 'buff', x, y, color, life: 0.7, radius: 92, polarity, vfx: MAGNET_ANCHOR_VFX });
  }

  bc.anchors = anchors;
  bc.collapseTimer = lifetime + warning;
  h.addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: action.color || '#a855ff', life: 0.55, radius: 260, vfx: 'boss_magnet_ult' });
  state.banner = {
    text: '磁場坍縮',
    sub: '同極排斥、異極吸引，離開磁錨爆發圈',
    life: 2.4,
    kind: 'phase',
    color: '#a855ff',
  };
});
