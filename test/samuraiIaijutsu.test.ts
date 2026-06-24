import { describe, expect, it } from 'vitest';
import { createInitialState, makePlayer } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';
import { tickSamuraiIaijutsu } from '../src/game/characters/classes/samurai/iaijutsu.ts';
import { getCharacter } from '../src/game/characters.js';

function setup() {
  const state: any = createInitialState([], {}, { mode: 'ffa' });
  const samurai: any = makePlayer('samurai', 'Samurai', 'samurai', 600, 600, 1);
  const enemy: any = makePlayer('enemy', 'Enemy', 'mage', 860, 600, 2);
  const ally: any = makePlayer('ally', 'Ally', 'warrior', 880, 600, 1);
  samurai.facing = 0;
  state.players = { [samurai.id]: samurai, [enemy.id]: enemy, [ally.id]: ally };
  return { state, samurai, enemy, ally };
}

describe('Samurai iaijutsu duel', () => {
  it('keeps Samurai resolvable by its slug id', () => {
    const samurai: any = getCharacter('samurai');
    expect(samurai.id).toBe('samurai');
    expect(samurai.ultimate.type).toBe('samurai_iaijutsu');
  });

  it('schedules three delayed slashes in order', () => {
    const { state, samurai } = setup();
    executeAction(state, samurai, getCharacter('samurai').ultimate);
    expect(samurai.samuraiIaijutsu.strikes).toHaveLength(3);
    expect(samurai.samuraiIaijutsu.strikes.map((s: any) => Number(s.remaining.toFixed(2)))).toEqual([0.32, 0.64, 0.96]);
    tickSamuraiIaijutsu(state, samurai, 0.33);
    expect(samurai.samuraiIaijutsu.strikes).toHaveLength(2);
    tickSamuraiIaijutsu(state, samurai, 0.32);
    expect(samurai.samuraiIaijutsu.strikes).toHaveLength(1);
    tickSamuraiIaijutsu(state, samurai, 0.32);
    expect(samurai.samuraiIaijutsu).toBeNull();
  });

  it('damages enemies only', () => {
    const { state, samurai, enemy, ally } = setup();
    samurai.samuraiIaijutsu = { strikes: [{
      x: 600, y: 600, facing: 0, range: 760, radius: 34,
      dmg: 80, knockback: 0, remaining: 0, telegraphLife: 0.32, color: '#f2f0dc',
    }] };
    tickSamuraiIaijutsu(state, samurai, 1 / 30);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it('uses finalDmg on the final slash', () => {
    const { state, samurai, enemy } = setup();
    samurai.samuraiIaijutsu = { strikes: [{
      x: 600, y: 600, facing: 0, range: 760, radius: 34,
      dmg: 125, knockback: 0, remaining: 0, telegraphLife: 0.32, color: '#d94343', final: true,
    }] };
    tickSamuraiIaijutsu(state, samurai, 1 / 30);
    expect(enemy.hp).toBe(enemy.maxHp - 125);
  });
});
