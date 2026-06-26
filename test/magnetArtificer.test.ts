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

    executeAction(state, boss, data.skill2, { source: 'skill2' });

    const marks = ['p0', 'p1', 'p2'].map((id) => state.players[id].magneticPolarity);
    expect(marks.map((m) => m.polarity)).toEqual(['N', 'S', 'N']);
    expect(state.bossCustom.magnetArtificer.polarities.p0.polarity).toBe('N');
    expect(state.fx.some((fx) => fx.vfx === 'boss_magnet_polarity' && fx.targetId === 'p1')).toBe(true);
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
    expect(anchors.every((z: any) => z.dmg <= 24)).toBe(true);
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

    expect(Math.hypot(player.kvx, player.kvy)).toBeGreaterThan(6);
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
