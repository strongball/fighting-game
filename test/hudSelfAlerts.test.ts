import { describe, expect, it } from 'vitest';
import '../src/game/render3d/hud/selfAlerts/default.js';
import { getSelfAlert, getSelfAlerts } from '../src/game/render3d/hud/selfAlerts.js';

describe('HUD self-alert registry', () => {
  it('registers default self alerts in priority order', () => {
    expect(getSelfAlerts().map((alert: any) => alert.id)).toEqual([
      'hunted-lowest-hp',
      'soul-tethered',
      'lava-burning',
      'blind',
    ]);
  });

  it('returns the highest-priority matching alert', () => {
    const state: any = {
      mode: 'boss',
      tethers: [{ a: 'p0', b: 'p1' }],
      players: {
        p0: { id: 'p0', effects: { blind: { remaining: 1 } } },
      },
    };

    expect(getSelfAlert({ state, selfId: 'p0', self: state.players.p0, players: Object.values(state.players), huntedId: 'p0' }))
      .toBe('🐺 你被盯上了！快拉開距離');
    expect(getSelfAlert({ state, selfId: 'p0', self: state.players.p0, players: Object.values(state.players), huntedId: null }))
      .toBe('🔗 你被靈魂綁定 — 與隊友拉開距離');
  });
});
