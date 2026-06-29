import { describe, expect, it } from 'vitest';
import { serializeNetworkSnapshot } from '../src/game/controller.ts';
import { createInitialState, makeDropItem } from '../src/game/entities/factories.ts';

describe('network snapshot serialization', () => {
  it('syncs persistent renderer state needed by joiners', () => {
    const state: any = createInitialState([
      { id: 'p0', name: 'Host Player', charId: 'warrior', team: 1 },
    ], {}, { mode: 'boss' });
    state.timeAnchors = [{
      id: 'anchor-1',
      ownerId: 'boss-11',
      x: 900,
      y: 720,
      radius: 95,
      captureRadius: 125,
      color: '#70e6ff',
      occupiedBy: 'p0',
      occupancyGrace: 0.25,
      progress: 0.6,
    }];
    state.timeAnchorRitual = {
      ownerId: 'boss-11',
      total: 5,
      remaining: 2,
      progress: 0.6,
      occupied: 1,
      required: 1,
    };
    state.items = [makeDropItem('heal', 640, 500, { lifetime: 8 })];
    state.temporalEchoes = [{ bossId: 'boss-11', delay: 1.2 }];

    const snapshot = serializeNetworkSnapshot(state);

    expect(snapshot.timeAnchors).toEqual(state.timeAnchors);
    expect(snapshot.timeAnchorRitual).toEqual(state.timeAnchorRitual);
    expect(snapshot.items).toEqual(state.items);
    expect(snapshot.temporalEchoes).toBeUndefined();
  });

  it('keeps existing networked boss mechanics in the same snapshot', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    state.tethers = [{ a: 'p0', b: 'p1', minGap: 200, remaining: 3 }];
    state.destructibles = [{ id: 'pillar-1', x: 300, y: 400, r: 30, hp: 100 }];

    const snapshot = serializeNetworkSnapshot(state);

    expect(snapshot.tethers).toEqual(state.tethers);
    expect(snapshot.destructibles).toEqual(state.destructibles);
  });

  it('syncs player potion inventory counts for joiner HUDs', () => {
    const state: any = createInitialState([
      { id: 'p0', name: 'Host Player', charId: 'warrior', team: 1 },
      { id: 'p1', name: 'Joiner Player', charId: 'mage', team: 1 },
    ], {}, { mode: 'boss' });
    state.players.p0.itemHp = 4;
    state.players.p0.itemMp = 2;
    state.players.p1.itemHp = 1;
    state.players.p1.itemMp = 0;

    const snapshot = serializeNetworkSnapshot(state);

    expect(snapshot.players.p0.itemHp).toBe(4);
    expect(snapshot.players.p0.itemMp).toBe(2);
    expect(snapshot.players.p1.itemHp).toBe(1);
    expect(snapshot.players.p1.itemMp).toBe(0);
  });

  it('syncs magnet artificer multiplayer display objects', () => {
    const state: any = createInitialState([
      { id: 'p0', name: 'Host Player', charId: 'warrior', team: 1 },
      { id: 'p1', name: 'Joiner Player', charId: 'mage', team: 1 },
    ], {}, { mode: 'boss' });
    state.players.p0.magneticPolarity = {
      polarity: 'N',
      color: '#58d7ff',
      sourceBossId: 'boss-8',
      remaining: 7.5,
      expiresAt: 8,
    };
    state.players.p1.magneticPolarity = {
      polarity: 'S',
      color: '#ff5d6c',
      sourceBossId: 'boss-8',
      remaining: 7.5,
      expiresAt: 8,
    };
    state.players['boss-8'] = {
      id: 'boss-8',
      name: '磁核匠師',
      charId: 116,
      team: 2,
      magnetOverload: true,
    };
    state.bossCustom = {
      magnetArtificer: {
        polarities: {
          p0: state.players.p0.magneticPolarity,
          p1: state.players.p1.magneticPolarity,
        },
        anchors: [{ id: 100, x: 620, y: 420, polarity: 'N', radius: 130 }],
      },
    };
    state.zones = [{
      id: 100,
      owner: 'boss-8',
      x: 620,
      y: 420,
      radius: 130,
      dmg: 34,
      lifetime: 3,
      tick: 3,
      tickTimer: 0,
      delay: 1.2,
      color: '#58d7ff',
      vfx: 'boss_magnet_collapse',
      magneticAnchor: true,
      polarity: 'N',
    }];
    state.fx = [{
      id: 200,
      type: 'buff',
      x: 500,
      y: 520,
      life: 0.3,
      color: '#58d7ff',
      vfx: 'boss_magnet_polarity',
      targetId: 'p0',
      polarity: 'N',
    }];

    const snapshot = serializeNetworkSnapshot(state);

    expect(snapshot.players.p0.magneticPolarity.polarity).toBe('N');
    expect(snapshot.players.p1.magneticPolarity.polarity).toBe('S');
    expect(snapshot.players['boss-8'].magnetOverload).toBe(true);
    expect(snapshot.bossCustom.magnetArtificer.anchors[0].polarity).toBe('N');
    expect(snapshot.zones[0].magneticAnchor).toBe(true);
    expect(snapshot.zones[0].vfx).toBe('boss_magnet_collapse');
    expect(snapshot.fx[0].vfx).toBe('boss_magnet_polarity');
  });
});
