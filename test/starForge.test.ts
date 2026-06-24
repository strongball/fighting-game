import { describe, expect, it } from 'vitest';
import { computeBossInput } from '../src/game/bossAI.js';
import { executeAction } from '../src/game/actions/executor.ts';
import { getBossForRound } from '../src/game/bosses.js';
import { createInitialState, makeBoss, makePlayer } from '../src/game/entities/factories.ts';
import { dealDamage } from '../src/game/entities/damage.ts';

function setup() {
  const state: any = createInitialState([], {}, { mode: 'boss' });
  state.roundPhase = 'fighting';
  const boss: any = makeBoss('boss-12', 111, 1200, 450, 2, { isBoss: true, aiId: 'star_forge' });
  const left: any = makePlayer('left', 'Left', 'mage', 1000, 700, 1);
  const right: any = makePlayer('right', 'Right', 'mage', 1400, 700, 1);
  state.players = { [boss.id]: boss, [left.id]: left, [right.id]: right };
  return { state, boss, left, right };
}

function startSelectedWindup(state: any, boss: any, slot: string) {
  boss.cd = { basic: 99, skill1: 99, skill2: 99, ultimate: 99, evade: 0, [slot]: 0 };
  boss.aiState = { mode: 'idle', slot: null };
  boss.desperation = true;
  computeBossInput(state, boss, 0.033);
}

describe('Round 12 star forge', () => {
  it('uses only existing action types and chains the ultimate into a hammer', () => {
    const boss: any = getBossForRound(12);
    expect([boss.basic.type, boss.skill1.type, boss.skill2.type, boss.ultimate.type]).toEqual([
      'melee', 'zone', 'zone', 'light_dark',
    ]);
    expect(boss.ultimate.chain).toEqual([{ slot: 'basic', windup: 0.7, delay: 0.35 }]);
  });

  it.each([[0, 4], [1, 6], [2, 7]])('precalculates phase %i star-rain impacts', (phaseIdx, count) => {
    const { state, boss } = setup();
    boss.phaseIdx = phaseIdx;
    startSelectedWindup(state, boss, 'skill2');
    expect(boss.aiState.slot).toBe('skill2');
    expect(boss.aiState.precalculatedZones).toHaveLength(count);
  });

  it('shortens the safe-half warning in the final phase', () => {
    const { state, boss } = setup();
    boss.phaseIdx = 2;
    startSelectedWindup(state, boss, 'ultimate');
    expect(boss.aiState.slot).toBe('ultimate');
    expect(boss.aiState.totalWindupT).toBe(0.6);
  });

  it('draws the cooling warning on the same half used by damage resolution', () => {
    const { state, boss } = setup();
    startSelectedWindup(state, boss, 'ultimate');
    boss.aiState.safeLeft = true;
    state.fx = [];
    computeBossInput(state, boss, 0.25);
    const warning = state.fx.find((fx: any) => fx.type === 'telegraph');
    expect(warning).toMatchObject({ x: 0, shape: 'line', color: '#58cfe0' });
    expect(warning.range).toBe(1200);
  });

  it('damages only players outside the selected cooling half', () => {
    const { state, boss, left, right } = setup();
    boss.aiState.safeLeft = true;
    const leftHp = left.hp, rightHp = right.hp;
    executeAction(state, boss, getBossForRound(12)!.ultimate);
    expect(left.hp).toBe(leftHp);
    expect(right.hp).toBeLessThan(rightHp);
    expect(right.kvx).toBeGreaterThan(0);
  });

  it('uses the existing 20% health lock to force the ultimate', () => {
    const { state, boss, left } = setup();
    boss.phaseIdx = 2;
    boss.hp = boss.maxHp * 0.21;
    dealDamage(state, boss, boss.maxHp * 0.05, left.id);
    expect(boss.desperation).toBe(true);
    expect(boss.aiState.slot).toBe('ultimate');
    expect(boss.aiState.totalWindupT).toBe(1.0);
  });
});
