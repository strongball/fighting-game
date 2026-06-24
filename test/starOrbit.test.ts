import { describe, expect, it } from 'vitest';
import { createInitialState, makePlayer } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';
import { ACTION_HANDLERS } from '../src/game/actions/handlers/index.ts';
import { tickStarOrbit } from '../src/game/characters/classes/star-orbit/orbit.ts';
import { getCharacter } from '../src/game/characters.js';

function setup() {
  const state: any = createInitialState([], {}, { mode: 'ffa' });
  const star: any = makePlayer('star', 'Star', 'star-orbit', 600, 600, 1);
  const enemy: any = makePlayer('enemy', 'Enemy', 'healer', 760, 600, 2);
  const ally: any = makePlayer('ally', 'Ally', 'mage', 760, 620, 1);
  enemy.maxHp = 500;
  enemy.hp = 500;
  state.players = { [star.id]: star, [enemy.id]: enemy, [ally.id]: ally };
  return { state, star, enemy, ally };
}

describe('Star Orbit character hook', () => {
  it('registers as character id 18 with custom action types', () => {
    const ch: any = getCharacter('star-orbit');
    expect(ch.name).toBe('星環使');
    expect(ch.skill1.type).toBe('star_orbit_cannon');
    expect(ch.skill2.type).toBe('star_orbit_guard');
    expect(ch.ultimate.type).toBe('star_orbit_burst');
    expect(ACTION_HANDLERS.has('star_orbit_cannon')).toBe(true);
  });

  it('keeps shards capped at three and regenerates missing shards', () => {
    const { state, star } = setup();
    star.starOrbit = { shards: 5, regenTimer: 0, visTimer: 99 };
    tickStarOrbit(state, star, 0.1);
    expect(star.starOrbit.shards).toBe(3);
    star.starOrbit.shards = 1;
    tickStarOrbit(state, star, 2.05);
    expect(star.starOrbit.shards).toBe(2);
  });

  it('guard grants shield through post effects and refills shards', () => {
    const { state, star } = setup();
    star.starOrbit = { shards: 1, regenTimer: 1, visTimer: 99 };
    executeAction(state, star, getCharacter('star-orbit').skill2);
    expect(star.starOrbit.shards).toBe(3);
    expect(star.shield).toBe(150);
  });

  it('cannon spends shards and scales its damage', () => {
    const { state, star, enemy, ally } = setup();
    star.facing = 0;
    star.starOrbit = { shards: 3, regenTimer: 0, visTimer: 99 };
    executeAction(state, star, getCharacter('star-orbit').skill1);
    expect(star.starOrbit.shards).toBe(0);
    expect(enemy.hp).toBe(enemy.maxHp - 46 - 24 * 3);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it('burst creates three beam pulses and damages enemies only', () => {
    const { state, star, enemy, ally } = setup();
    star.facing = 0;
    executeAction(state, star, getCharacter('star-orbit').ultimate);
    expect(star.starOrbit.burst.pulsesLeft).toBe(3);
    tickStarOrbit(state, star, 0.01);
    expect(enemy.hp).toBe(enemy.maxHp - 62);
    expect(ally.hp).toBe(ally.maxHp);
    tickStarOrbit(state, star, 0.28);
    tickStarOrbit(state, star, 0.28);
    expect(enemy.hp).toBe(enemy.maxHp - 62 - 62 - 130);
    expect(star.starOrbit.burst).toBeNull();
  });
});
