// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { getBossForRound } from '../src/game/bosses.js';
import { makeBoss, makePlayer, createInitialState } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';
import { tickBossSystems } from '../src/game/bosses/systems.ts';

function setup(players = 2) {
  const state: any = createInitialState([], {}, { mode: 'boss' });
  state.roundPhase = 'fighting';
  state.round = 8;
  const boss = makeBoss('boss-8', 116, 600, 360, 2, { isBoss: true, round: 8, name: '磁核匠師' });
  state.players = { [boss.id]: boss };
  for (let i = 0; i < players; i++) {
    const p = makePlayer('p' + i, 'P' + i, 'warrior', 500 + i * 80, 520, 1);
    state.players[p.id] = p;
  }
  return { state, boss, data: getBossForRound(8) };
}

describe('Round 8 Magnet Artificer', () => {
  it('is registered as Round 8', () => {
    const boss = getBossForRound(8);
    expect(boss).toBeTruthy();
    expect(boss.name).toBe('磁核匠師');
  });

  it('assigns network-visible N/S polarities in multiplayer', () => {
    const { state, boss, data } = setup(3);
    const hpBefore = state.players.p1.hp;

    executeAction(state, boss, data.skill2, { source: 'skill2' });

    const marks = ['p0', 'p1', 'p2'].map((id) => state.players[id].magneticPolarity);
    expect(marks.map((m) => m.polarity)).toEqual(['N', 'S', 'N']);
    expect(marks.every((m) => m.resonanceCd === 0 && m.tearCd === 0)).toBe(true);
    expect(state.players.p1.hp).toBeLessThan(hpBefore);
    expect(state.bossCustom.magnetArtificer.polarities.p0.polarity).toBe('N');
    expect(state.fx.some((fx) => fx.vfx === 'boss_magnet_polarity' && fx.targetId === 'p1')).toBe(true);
    expect(state.fx.some((fx) => fx.vfx === 'boss_magnet_resonance' && fx.targetId === 'p1')).toBe(true);
  });

  it('fires magnetic needles and resonates marked players near anchors', () => {
    const { state, boss, data } = setup(2);
    const p0 = state.players.p0;
    const p1 = state.players.p1;
    p0.x = 300;
    p0.y = 300;
    p1.x = 340;
    p1.y = 300;
    p0.kvx = 0;
    p0.kvy = 0;
    p1.kvx = 0;
    p1.kvy = 0;
    p0.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8, resonanceCd: 0 };
    p1.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, resonanceCd: 0 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: p0.magneticPolarity, p1: p1.magneticPolarity }, anchors: [], fxTimer: 99 } };
    state.zones = [{
      id: 'n-anchor',
      owner: boss.id,
      x: 260,
      y: 300,
      radius: 130,
      dmg: 40,
      lifetime: 4,
      tick: 999,
      tickTimer: 0,
      delay: 0,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
    }];
    const p0Hp = p0.hp;
    const p1Hp = p1.hp;

    executeAction(state, boss, data.skill1, { source: 'skill1' });

    expect(state.projectiles.filter((p: any) => p.vfx === 'boss_magnet_needle')).toHaveLength(4);
    expect(p0.hp).toBeLessThan(p0Hp);
    expect(p1.hp).toBeLessThan(p1Hp);
    expect(p0.magneticPolarity.resonanceCd).toBeGreaterThan(0);
    expect(p1.magneticPolarity.resonanceCd).toBeGreaterThan(0);
    expect(p1.kvx).toBeGreaterThan(0);
    expect(state.fx.filter((fx: any) => fx.vfx === 'boss_magnet_resonance')).toHaveLength(2);
  });

  it('does not resonate unmarked targets when firing magnetic needles', () => {
    const { state, boss, data } = setup(1);
    const player = state.players.p0;
    const hpBefore = player.hp;

    executeAction(state, boss, data.skill1, { source: 'skill1' });

    expect(state.projectiles.filter((p: any) => p.vfx === 'boss_magnet_needle')).toHaveLength(4);
    expect(player.hp).toBe(hpBefore);
    expect(state.fx.some((fx: any) => fx.vfx === 'boss_magnet_resonance')).toBe(false);
  });

  it('spawns synced magnetic anchors and applies attraction or repulsion', () => {
    const { state, boss, data } = setup(2);
    const p0 = state.players.p0;
    p0.x = 470;
    p0.y = 360;
    p0.kvx = 0;
    p0.kvy = 0;
    p0.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8 };
    state.players.p1.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8 };
    state.bossCustom = {
      magnetArtificer: {
        polarities: { p0: p0.magneticPolarity, p1: state.players.p1.magneticPolarity },
        anchors: [],
        fxTimer: 0,
      },
    };

    executeAction(state, boss, data.ultimate, { source: 'ultimate' });

    const anchors = state.zones.filter((z: any) => z.magneticAnchor);
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    expect(anchors.every((z: any) => z.dmg >= 55)).toBe(true);
    expect(anchors.every((z: any) => z.tearVfx === 'boss_magnet_tear')).toBe(true);
    const nAnchor = anchors.find((z: any) => z.polarity === 'N');
    expect(nAnchor).toBeTruthy();

    p0.x = nAnchor.x - 80;
    p0.y = nAnchor.y;
    tickBossSystems(state, 0.2);
    const repel = p0.kvx;
    expect(repel).toBeLessThan(0);

    p0.magneticPolarity.polarity = 'S';
    p0.kvx = 0;
    p0.kvy = 0;
    tickBossSystems(state, 0.2);
    expect(p0.kvx).toBeGreaterThan(0);
    expect(Math.abs(repel)).toBeGreaterThan(p0.kvx);
  });

  it('keeps solo magnetic collapse self-rescuable', () => {
    const { state, boss, data } = setup(1);
    const player = state.players.p0;
    player.x = 520;
    player.y = 520;
    player.kvx = 0;
    player.kvy = 0;

    executeAction(state, boss, data.ultimate, { source: 'ultimate' });

    const anchors = state.zones.filter((z: any) => z.magneticAnchor);
    expect(anchors.length).toBe(6);
    expect(anchors.every((z: any) => z.lifetime >= 6)).toBe(true);
    expect(data.ultimate.cd).toBeLessThanOrEqual(13);
    expect(Math.max(...anchors.map((z: any) => Math.hypot(z.x - player.x, z.y - player.y)))).toBeGreaterThan(260);
    tickBossSystems(state, 0.2);
    const soloPull = Math.hypot(player.kvx, player.kvy);
    expect(soloPull).toBeGreaterThan(5);
    expect(soloPull).toBeLessThan(145);
    expect(state.players.p0.effects.stun).toBeFalsy();
    expect(state.players.p0.effects.root).toBeFalsy();
    expect(anchors.every((z: any) => z.dmg <= 28)).toBe(true);
  });

  it('triggers magnetic tear during active collapse with cooldown', () => {
    const { state, boss } = setup(2);
    const player = state.players.p0;
    player.x = 340;
    player.y = 300;
    player.kvx = 140;
    player.kvy = 0;
    player.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, tearCd: 0 };
    state.players.p1.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, tearCd: 0 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: player.magneticPolarity }, anchors: [], fxTimer: 99 } };
    state.zones = [{
      id: 'tear-anchor',
      owner: boss.id,
      x: 260,
      y: 300,
      radius: 130,
      dmg: 40,
      lifetime: 4,
      tick: 999,
      tickTimer: 0,
      delay: 0,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
      force: 430,
      fieldScale: 270,
      softening: 140,
      tearDmg: 30,
      tearRange: 430,
      tearVfx: 'boss_magnet_tear',
    }];
    const hpBefore = player.hp;

    tickBossSystems(state, 0.2);
    const hpAfterFirst = player.hp;
    tickBossSystems(state, 0.2);

    expect(hpAfterFirst).toBeLessThan(hpBefore);
    expect(player.hp).toBe(hpAfterFirst);
    expect(player.magneticPolarity.tearCd).toBeGreaterThan(0);
    expect(state.fx.some((fx: any) => fx.vfx === 'boss_magnet_tear' && fx.targetId === 'p0')).toBe(true);
  });

  it('deals magnetic tear damage to marked players standing in an active field', () => {
    const { state, boss } = setup(2);
    const player = state.players.p0;
    player.x = 520;
    player.y = 300;
    player.kvx = 0;
    player.kvy = 0;
    player.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8, tearCd: 0 };
    state.players.p1.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, tearCd: 0 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: player.magneticPolarity }, anchors: [], fxTimer: 99 } };
    state.zones = [{
      id: 'field-tear-anchor',
      owner: boss.id,
      x: 260,
      y: 300,
      radius: 130,
      dmg: 55,
      lifetime: 4,
      tick: 999,
      tickTimer: 0,
      delay: 0,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
      force: 430,
      fieldScale: 270,
      softening: 140,
      tearDmg: 30,
      tearRange: 430,
      tearVfx: 'boss_magnet_tear',
    }];
    const hpBefore = player.hp;

    tickBossSystems(state, 0.2);

    expect(player.hp).toBeLessThan(hpBefore);
    expect(Math.hypot(player.kvx, player.kvy)).toBeLessThan(120);
    expect(state.fx.some((fx: any) => fx.vfx === 'boss_magnet_tear' && fx.targetId === 'p0')).toBe(true);
  });

  it('explodes opposite-polarity players who get too close and hurts nearby teammates', () => {
    const { state, boss } = setup(3);
    const p0 = state.players.p0;
    const p1 = state.players.p1;
    const p2 = state.players.p2;
    p0.x = 500;
    p0.y = 500;
    p1.x = 580;
    p1.y = 500;
    p2.x = 540;
    p2.y = 610;
    p0.kvx = p0.kvy = p1.kvx = p1.kvy = p2.kvx = p2.kvy = 0;
    p0.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, blastCd: 0 };
    p1.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8, blastCd: 0 };
    p2.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, blastCd: 0 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: p0.magneticPolarity, p1: p1.magneticPolarity, p2: p2.magneticPolarity }, anchors: [], fxTimer: 99 } };
    const hp0 = p0.hp;
    const hp1 = p1.hp;
    const hp2 = p2.hp;

    tickBossSystems(state, 0.2);
    const afterFirst = { p0: p0.hp, p1: p1.hp, p2: p2.hp };
    tickBossSystems(state, 0.2);

    expect(afterFirst.p0).toBeLessThan(hp0);
    expect(afterFirst.p1).toBeLessThan(hp1);
    expect(afterFirst.p2).toBeLessThan(hp2);
    expect(p0.kvx).toBeLessThan(-450);
    expect(p1.kvx).toBeGreaterThan(450);
    expect(p2.kvy).toBeGreaterThan(250);
    expect(p0.hp).toBe(afterFirst.p0);
    expect(p1.hp).toBe(afterFirst.p1);
    expect(p2.hp).toBe(afterFirst.p2);
    expect(p0.magneticPolarity.blastCd).toBeGreaterThan(0);
    expect(p1.magneticPolarity.blastCd).toBeGreaterThan(0);
    expect(state.fx.some((fx: any) => fx.vfx === 'boss_magnet_polarity_blast')).toBe(true);
    expect(state.fx.filter((fx: any) => fx.vfx === 'boss_magnet_blast_impact')).toHaveLength(3);
  });

  it('explodes when a marked player steps onto an opposite-polarity anchor core', () => {
    const { state, boss } = setup(2);
    const p0 = state.players.p0;
    const p1 = state.players.p1;
    p0.x = 300;
    p0.y = 300;
    p1.x = 410;
    p1.y = 300;
    p0.kvx = p0.kvy = p1.kvx = p1.kvy = 0;
    p0.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8, blastCd: 0, anchorBlastCd: 0 };
    p1.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8, blastCd: 0, anchorBlastCd: 0 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: p0.magneticPolarity, p1: p1.magneticPolarity }, anchors: [], fxTimer: 99 } };
    state.zones = [{
      id: 'core-anchor',
      owner: boss.id,
      x: 300,
      y: 300,
      radius: 130,
      dmg: 55,
      lifetime: 4,
      tick: 999,
      tickTimer: 0,
      delay: 0,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
      force: 430,
      fieldScale: 270,
      softening: 140,
      blastRadius: 88,
      _tearDisabled: true,
    }];
    const hp0 = p0.hp;
    const hp1 = p1.hp;

    tickBossSystems(state, 0.2);

    expect(p0.hp).toBeLessThan(hp0);
    expect(p1.hp).toBeLessThan(hp1);
    expect(Math.abs(p0.kvx)).toBeGreaterThan(550);
    expect(p1.kvx).toBeGreaterThan(300);
    expect(p0.magneticPolarity.anchorBlastCd).toBeGreaterThan(0);
    expect(state.fx.some((fx: any) => fx.vfx === 'boss_magnet_polarity_blast')).toBe(true);
    expect(state.fx.filter((fx: any) => fx.vfx === 'boss_magnet_blast_impact')).toHaveLength(2);
    expect(state.zones.some((z: any) => z.id === 'core-anchor' && z.magneticAnchor)).toBe(false);
  });

  it('uses solo-feel magnet placement when one human has npc teammates', () => {
    const { state, boss, data } = setup(3);
    state.players.p1.isNpc = true;
    state.players.p2.isNpc = true;
    const player = state.players.p0;
    player.x = 520;
    player.y = 520;

    executeAction(state, boss, data.ultimate, { source: 'ultimate' });

    const anchors = state.zones.filter((z: any) => z.magneticAnchor);
    expect(anchors.length).toBe(6);
    expect(anchors.every((z: any) => z.soloMagnet)).toBe(true);
    expect(Math.max(...anchors.map((z: any) => Math.hypot(z.x - player.x, z.y - player.y)))).toBeGreaterThan(260);
  });

  it('applies a global inverse-square magnetic pull outside the warning circle', () => {
    const { state, boss, data } = setup(1);
    const player = state.players.p0;
    player.x = 1180;
    player.y = 760;
    player.kvx = 0;
    player.kvy = 0;
    player.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: player.magneticPolarity }, anchors: [], fxTimer: 99 } };
    state.zones = [{
      id: 'far-magnet',
      owner: boss.id,
      x: 220,
      y: 180,
      radius: 130,
      dmg: 0,
      lifetime: 3,
      tick: 3,
      tickTimer: 0,
      delay: 0,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
      force: 780,
      fieldScale: 300,
      softening: 120,
      globalMagnet: true,
    }];

    tickBossSystems(state, 0.2);

    expect(Math.hypot(player.kvx, player.kvy)).toBeGreaterThan(8);
  });

  it('pulls opposite-polarity players strongly toward anchor cores', () => {
    const { state, boss } = setup(2);
    const player = state.players.p0;
    player.x = 440;
    player.y = 300;
    player.kvx = 0;
    player.kvy = 0;
    player.magneticPolarity = { polarity: 'S', color: '#ff5d6c', sourceBossId: boss.id, remaining: 8, expiresAt: 8 };
    state.players.p1.magneticPolarity = { polarity: 'N', color: '#58d7ff', sourceBossId: boss.id, remaining: 8, expiresAt: 8 };
    state.bossCustom = { magnetArtificer: { polarities: { p0: player.magneticPolarity }, anchors: [], fxTimer: 99 } };
    state.zones = [{
      id: 'strong-pull-anchor',
      owner: boss.id,
      x: 300,
      y: 300,
      radius: 130,
      dmg: 0,
      lifetime: 3,
      tick: 999,
      tickTimer: 0,
      delay: 0,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
      force: 610,
      fieldScale: 320,
      softening: 120,
      attractionMult: 1.18,
      _tearDisabled: true,
    }];

    tickBossSystems(state, 0.2);

    expect(player.kvx).toBeLessThan(-75);
  });

  it('cleans magnetic state, markers, anchors, and fx', () => {
    const { state, boss, data } = setup(2);
    executeAction(state, boss, data.skill2, { source: 'skill2' });
    executeAction(state, boss, data.ultimate, { source: 'ultimate' });

    expect(state.players.p0.magneticPolarity).toBeTruthy();
    expect(state.zones.some((z: any) => z.magneticAnchor)).toBe(true);

    data.cleanup(state);

    expect(state.players.p0.magneticPolarity).toBeUndefined();
    expect(state.players.p1.magneticPolarity).toBeUndefined();
    expect(state.bossCustom?.magnetArtificer).toBeUndefined();
    expect(state.zones.some((z: any) => z.magneticAnchor)).toBe(false);
    expect(state.fx.some((fx: any) => String(fx.vfx || '').startsWith('boss_magnet'))).toBe(false);
  });
});
