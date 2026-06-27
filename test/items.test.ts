import { describe, it, expect } from 'vitest';
import { createInitialState, makePlayer, makeDropItem } from '../src/game/entities.js';
import { tickDropItems, useHpPotion, useMpPotion } from '../src/game/systems/items.ts';
import { startBossRound } from '../src/game/bossMode.js';
import { step } from '../src/game/simulation.ts';
import { DT, POTION_MAX, BOSS_POTION_FLOOR, SKY_DROP_INTERVAL, DROP_ITEM_LIFETIME, DROP_ITEM_WARNING_TIME } from '../src/game/constants.js';

describe('Potion and Drop Item System', () => {
  it('correctly spawns dropped items via makeDropItem', () => {
    const item = makeDropItem('heal', 100, 200, { warningTime: DROP_ITEM_WARNING_TIME, lifetime: DROP_ITEM_LIFETIME });
    expect(item.kind).toBe('heal');
    expect(item.x).toBe(100);
    expect(item.y).toBe(200);
    expect(item.warningTime).toBe(DROP_ITEM_WARNING_TIME);
    expect(item.lifetime).toBe(DROP_ITEM_LIFETIME);
  });

  it('handles item pick up collisions and inventory limits', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'boss' });
    const p = state.players.p1;
    p.x = 100;
    p.y = 100;
    
    // Set itemHp to POTION_MAX - 1, itemMp to POTION_MAX - 1
    p.itemHp = POTION_MAX - 1;
    p.itemMp = POTION_MAX - 1;
    
    // Drop HP potion at player's location (no warning time so it's active immediately)
    state.items = [
      makeDropItem('heal', 100, 100, { warningTime: 0 }),
    ];
    
    // Process items tick
    tickDropItems(state, DT);
    
    // Player should pick it up since itemHp < POTION_MAX
    expect(p.itemHp).toBe(POTION_MAX);
    expect(state.items.length).toBe(0);
    
    // Drop another HP potion, player is now full (POTION_MAX)
    state.items = [
      makeDropItem('heal', 100, 100, { warningTime: 0 }),
    ];
    tickDropItems(state, DT);
    
    // Player should NOT pick it up because itemHp is POTION_MAX
    expect(p.itemHp).toBe(POTION_MAX);
    expect(state.items.length).toBe(1);
    
    // Drop Mana potion, player is at POTION_MAX - 1, should pick up
    state.items = [
      makeDropItem('mana', 100, 100, { warningTime: 0 }),
    ];
    tickDropItems(state, DT);
    expect(p.itemMp).toBe(POTION_MAX);
    expect(state.items.length).toBe(0);
  });

  it('applies instant + slow heal-over-time on using HP potion', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'boss' });
    const p = state.players.p1;
    p.maxHp = 500;
    p.hp = 100; // Low hp
    p.itemHp = 1;
    
    // Use HP Potion
    useHpPotion(state, p);
    expect(p.itemHp).toBe(0);
    
    // Instant heal should be: 20% max HP + 30 HP = 500 * 0.20 + 30 = 130 HP.
    // HP should be: 100 + 130 = 230
    expect(p.hp).toBe(230);
    
    // Regen Hot effect should be applied: 5% Max HP (25 HP) per second for 7 seconds
    expect(p.effects.regen_hot).toBeDefined();
    expect(p.effects.regen_hot.remaining).toBe(7);
    expect(p.effects.regen_hot.amountPerSec).toBe(25);
  });

  it('applies mana restoration on using MP potion', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'boss' });
    const p = state.players.p1;
    p.maxMana = 100;
    p.mana = 20;
    p.itemMp = 1;
    
    useMpPotion(state, p);
    expect(p.itemMp).toBe(0);
    expect(p.mana).toBe(60); // 20 + 40 = 60
  });

  it('applies global passive HP regeneration of 2% max HP per second', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'ffa' });
    const p = state.players.p1;
    p.maxHp = 500;
    p.hp = 250; // 50% HP
    
    // Run simulation step for 1 second (30 ticks of DT)
    const inputs = { p1: { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: false, item2: false, aim: null } };
    
    for (let i = 0; i < 30; i++) {
      step(state, inputs, DT);
    }
    
    // In 1 second, should regenerate 2% of 500 = 10 HP.
    // HP should be around 250 + 10 = 260
    expect(p.hp).toBeCloseTo(260, 1);
  });

  it('avoids double trigger of potion on holding keys (rising-edge check)', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'boss' });
    const p = state.players.p1;
    p.maxHp = 500;
    p.hp = 100;
    p.itemHp = 3;
    
    // Holding item1 input for 10 consecutive frames
    const inputs = { p1: { up: false, down: false, left: false, right: false, basic: false, skill1: false, skill2: false, ultimate: false, evade: false, item1: true, item2: false, aim: null } };
    
    for (let i = 0; i < 10; i++) {
      step(state, inputs, DT);
    }
    
    // Potion count should decrease by exactly 1, NOT 10
    expect(p.itemHp).toBe(2);
  });

  it('correctly handles potion starting count, carry-over, and replenishment between rounds', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'boss' });
    const p = state.players.p1;
    
    // 1. Initial round start (Round 1)
    // We expect startBossRound to initialize potions to BOSS_POTION_FLOOR of each.
    startBossRound(state, 1);
    expect(p.itemHp).toBe(BOSS_POTION_FLOOR);
    expect(p.itemMp).toBe(BOSS_POTION_FLOOR);
    
    // 2. Transition to next round (Round 2)
    // Potion counts should be replenished to at least BOSS_POTION_FLOOR.
    p.itemHp = BOSS_POTION_FLOOR - 1;
    p.itemMp = 0;
    startBossRound(state, 2);
    expect(p.itemHp).toBe(BOSS_POTION_FLOOR);
    expect(p.itemMp).toBe(BOSS_POTION_FLOOR);
    
    // 3. Counts cap at POTION_MAX.
    p.itemHp = POTION_MAX + 2;
    p.itemMp = POTION_MAX;
    startBossRound(state, 3);
    expect(p.itemHp).toBe(POTION_MAX);
    expect(p.itemMp).toBe(POTION_MAX);
    
    // 4. Retry the same round (Round 3 retry)
    // If they had 0 potions, it should reset to at least BOSS_POTION_FLOOR.
    p.itemHp = 0;
    p.itemMp = 0;
    startBossRound(state, 3); // retry round 3
    expect(p.itemHp).toBe(BOSS_POTION_FLOOR); // restored to floor
    expect(p.itemMp).toBe(BOSS_POTION_FLOOR); // restored to floor
    
    // If they had more than BOSS_POTION_FLOOR but <= POTION_MAX, they should keep them.
    const keepValue = BOSS_POTION_FLOOR + 2;
    p.itemHp = keepValue;
    p.itemMp = keepValue;
    startBossRound(state, 3); // retry round 3
    expect(p.itemHp).toBe(keepValue);
    expect(p.itemMp).toBe(keepValue);
  });
});
