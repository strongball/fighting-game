import { describe, it, expect } from 'vitest';
import { makePlayer, makeBoss, createInitialState } from '../src/game/entities/factories.ts';
import { computeBossInput } from '../src/game/bossAI.js';
import { getCharacter } from '../src/game/characters.js';
import { PLAYER_RADIUS } from '../src/game/constants.ts';

describe('boss warning indicators and windup time', () => {
  it('enforces windup time to be at least 1.0 second for any boss skill', () => {
    // 1. Create a game state in boss mode
    const state = createInitialState([], {}, { mode: 'boss' });
    
    // 2. Spawn a player (target) and a boss (charId: 108, which is Fallen Angel)
    const player = makePlayer('player1', 'Hero', 0, 150, 150, 1);
    const boss = makeBoss('boss1', 108, 100, 100, 2, { isBoss: true });
    
    state.players['player1'] = player;
    state.players['boss1'] = boss;
    
    // 3. Make the basic skill available (clear cooldown)
    boss.cd = { basic: 0, skill1: 99, skill2: 99, ultimate: 99, evade: 0 };
    boss.aiState = { mode: 'idle', slot: null };
    
    // 4. Compute boss input
    computeBossInput(state, boss, 0.033);
    computeBossInput(state, boss, 0.033);
    
    // 5. Verify the boss transitioned to windup and windupT is at least 1.0
    expect(boss.aiState.mode).toBe('windup');
    expect(boss.aiState.slot).toBe('basic');
    expect(boss.aiState.totalWindupT).toBeGreaterThanOrEqual(1.0);
    
    // 6. Verify that the warning target coordinates and shape are accurate for melee
    // For melee, center should be the boss itself, and shape should be 'arc'
    const fx = state.fx.find((f: any) => f.type === 'telegraph');
    expect(fx).toBeTruthy();
    expect(fx.x).toBe(boss.x);
    expect(fx.y).toBe(boss.y);
    expect(fx.shape).toBe('arc');
    expect(fx.radius).toBe(getCharacter(108).basic.range + PLAYER_RADIUS);
  });

  it('calculates accurate projectile warning line', () => {
    const state = createInitialState([], {}, { mode: 'boss' });
    const player = makePlayer('player1', 'Hero', 0, 300, 100, 1);
    // charId: 105 is Necromancer Conductor, basic is a projectile
    const boss = makeBoss('boss1', 105, 100, 100, 2, { isBoss: true });
    
    state.players['player1'] = player;
    state.players['boss1'] = boss;
    
    boss.cd = { basic: 0, skill1: 99, skill2: 99, ultimate: 99, evade: 0 };
    boss.aiState = { mode: 'idle', slot: null };
    
    computeBossInput(state, boss, 0.033);
    computeBossInput(state, boss, 0.033);
    
    expect(boss.aiState.mode).toBe('windup');
    expect(boss.aiState.slot).toBe('basic');
    expect(boss.aiState.totalWindupT).toBeGreaterThanOrEqual(1.0);
    
    // For projectile, shape should be 'line', centered on boss
    const fx = state.fx.find((f: any) => f.type === 'telegraph');
    expect(fx).toBeTruthy();
    expect(fx.x).toBe(boss.x);
    expect(fx.y).toBe(boss.y);
    expect(fx.shape).toBe('line');
    
    const basicDef = getCharacter(105).basic;
    const expectedRange = basicDef.range || (basicDef.speed * basicDef.lifetime);
    expect(fx.range).toBe(expectedRange + PLAYER_RADIUS);
    expect(fx.radius).toBe(basicDef.radius + PLAYER_RADIUS);
  });

  it('updates warning indicator position dynamically as the boss moves during windup', () => {
    const state = createInitialState([], {}, { mode: 'boss' });
    const player = makePlayer('player1', 'Hero', 0, 150, 150, 1);
    const boss = makeBoss('boss1', 108, 100, 100, 2, { isBoss: true });
    
    state.players['player1'] = player;
    state.players['boss1'] = boss;
    
    boss.cd = { basic: 0, skill1: 99, skill2: 99, ultimate: 99, evade: 0 };
    boss.aiState = { mode: 'idle', slot: null };
    
    // First frame initiates windup
    computeBossInput(state, boss, 0.033);
    
    // Move the boss to a new position to simulate boss moving during windup
    boss.x = 120;
    boss.y = 120;
    
    // Clear previous FX to isolate this frame's FX
    state.fx = [];
    
    // Second frame updates telegraph
    computeBossInput(state, boss, 0.033);
    
    // Verify the warning indicator position moved with the boss
    const fx = state.fx.find((f: any) => f.type === 'telegraph');
    expect(fx).toBeTruthy();
    expect(fx.x).toBe(120);
    expect(fx.y).toBe(120);
  });
});
