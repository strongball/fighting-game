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
});
