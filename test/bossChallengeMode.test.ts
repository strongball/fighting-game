import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/entities.js';
import { checkBossRound, findBossEntity, startBossRound } from '../src/game/bossMode.js';

function clearedBossState(round: number, bossMode: 'campaign' | 'challenge') {
  const state: any = createInitialState([], {}, { mode: 'boss' });
  state.bossMode = bossMode;
  startBossRound(state, round);
  state.roundPhase = 'fighting';
  const boss = findBossEntity(state);
  boss.alive = false;
  boss.hp = 0;
  checkBossRound(state, 1 / 30);
  expect(state.roundPhase).toBe('cleared');
  state.roundTimer = 0;
  return state;
}

describe('Boss challenge mode', () => {
  it('ends after defeating the selected Boss', () => {
    const state = clearedBossState(5, 'challenge');
    checkBossRound(state, 1 / 30);
    expect(state.round).toBe(5);
    expect(state.roundPhase).toBe('victory');
    expect(state.phase).toBe('gameover');
  });

  it('keeps campaign progression unchanged', () => {
    const state = clearedBossState(5, 'campaign');
    checkBossRound(state, 1 / 30);
    expect(state.round).toBe(6);
    expect(state.roundPhase).toBe('intro');
    expect(state.phase).toBe('playing');
  });

  it('ends the campaign after defeating Round 12', () => {
    const state = clearedBossState(12, 'campaign');
    checkBossRound(state, 1 / 30);
    expect(state.round).toBe(12);
    expect(state.roundPhase).toBe('victory');
    expect(state.phase).toBe('gameover');
  });
});
