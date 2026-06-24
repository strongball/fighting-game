import { describe, expect, it } from 'vitest';
import { getZoneRenderKind, zoneVisualRadius } from '../src/game/render3d/entities3d.js';
import { makeBoss, makePlayer, makeZone, createInitialState } from '../src/game/entities/factories.ts';
import { PLAYER_RADIUS } from '../src/game/constants.ts';
import { initBossPhase, tickBossPhases } from '../src/game/bosses/phases.ts';
import { tickBossSystems } from '../src/game/bosses/systems.ts';
import { updateZones } from '../src/game/systems/zones.ts';

describe('boss damage warnings', () => {
  it('marks delayed custom zones as standard warning zones before custom VFX activates', () => {
    const vdef = { zone: () => ({}) };
    const delayed = { id: 1, vfx: 'boss_juggernaut_quake', delay: 0.5, radius: 240 };
    const active = { ...delayed, delay: 0 };

    expect(getZoneRenderKind(delayed, vdef)).toBe('std-warning');
    expect(getZoneRenderKind(active, vdef)).toBe('custom:boss_juggernaut_quake');
    expect(zoneVisualRadius(delayed)).toBe(240 + PLAYER_RADIUS);
  });

  it('does not apply delayed zone damage before the delay has resolved', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    const boss = makeBoss('boss', 102, 100, 100, 2, { isBoss: true });
    const player = makePlayer('player', 'Hero', 'warrior', 150, 100, 1);
    state.players = { boss, player };
    state.zones.push(makeZone(boss.id, 150, 100, {
      radius: 120,
      dmg: 20,
      lifetime: 2,
      tick: 0.5,
      delay: 1,
      color: '#ff5a1f',
      vfx: 'boss_juggernaut_quake',
    }));

    updateZones(state, 0.5);

    expect(player.hp).toBe(player.maxHp);
    expect(state.zones[0].delay).toBeGreaterThan(0);
  });

  it('shows clear warning FX when Lava Juggernaut phase burn is applied', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    const boss = makeBoss('boss', 102, 400, 300, 2, { isBoss: true });
    const player = makePlayer('player', 'Hero', 'warrior', 450, 300, 1);
    state.players = { boss, player };
    initBossPhase(boss);
    boss.hp = boss.maxHp * 0.49;

    tickBossPhases(state, 0.016);

    expect(player.effects.burn).toBeTruthy();
    expect(state.fx.some((fx: any) => fx.type === 'hit' && fx.x === player.x && fx.y === player.y)).toBe(true);
    expect(state.fx.some((fx: any) => fx.type === 'popup' && fx.text === '灼燒')).toBe(true);
  });

  it('shows damage popups when soul tether deals proximity damage', () => {
    const state: any = createInitialState([], {}, { mode: 'boss' });
    const a = makePlayer('a', 'A', 'warrior', 300, 300, 1);
    const b = makePlayer('b', 'B', 'mage', 330, 300, 1);
    state.players = { a, b };
    state.tethers = [{ a: 'a', b: 'b', minGap: 200, dmg: 18, tick: 0.5, tickTimer: 0.01, remaining: 2 }];

    tickBossSystems(state, 0.02);

    expect(a.hp).toBe(a.maxHp - 18);
    expect(b.hp).toBe(b.maxHp - 18);
    expect(state.fx.filter((fx: any) => fx.type === 'popup' && fx.text === 18)).toHaveLength(2);
    expect(state.fx.some((fx: any) => fx.type === 'hit' && fx.radius >= 70)).toBe(true);
  });
});
