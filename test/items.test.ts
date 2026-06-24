import { describe, it, expect } from 'vitest';
import { createInitialState, makePlayer, makeDropItem } from '../src/game/entities.js';
import { tickDropItems, useHpPotion, useMpPotion } from '../src/game/systems/items.ts';
import { startBossRound } from '../src/game/bossMode.js';
import { step } from '../src/game/simulation.ts';
import { DT } from '../src/game/constants.js';

describe('Potion and Drop Item System', () => {
  it('correctly spawns dropped items via makeDropItem', () => {
    const item = makeDropItem('heal', 100, 200, { warningTime: 1.5, lifetime: 12 });
    expect(item.kind).toBe('heal');
    expect(item.x).toBe(100);
    expect(item.y).toBe(200);
    expect(item.warningTime).toBe(1.5);
    expect(item.lifetime).toBe(12);
  });

  it('handles item pick up collisions and inventory limits', () => {
    const state = createInitialState([{ id: 'p1', name: 'Tester', charId: 'warrior', team: 1 }], {}, { mode: 'boss' });
    const p = state.players.p1;
    p.x = 100;
    p.y = 100;
    
    // Set itemHp to 2, itemMp to 2
    p.itemHp = 2;
    p.itemMp = 2;
    
    // Drop HP potion at player's location (no warning time so it's active immediately)
    state.items = [
      makeDropItem('heal', 100, 100, { warningTime: 0 }),
    ];
    
    // Process items tick
    tickDropItems(state, DT);
    
    // Player should pick it up since itemHp < 3
    expect(p.itemHp).toBe(3);
    expect(state.items.length).toBe(0);
    
    // Drop another HP potion, player is now full (3)
    state.items = [
      makeDropItem('heal', 100, 100, { warningTime: 0 }),
    ];
    tickDropItems(state, DT);
    
    // Player should NOT pick it up because itemHp is 3
    expect(p.itemHp).toBe(3);
    expect(state.items.length).toBe(1);
    
    // Drop Mana potion, player is at 2, should pick up
    state.items = [
      makeDropItem('mana', 100, 100, { warningTime: 0 }),
    ];
    tickDropItems(state, DT);
    expect(p.itemMp).toBe(3);
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
    // We expect startBossRound to initialize potions to 1 of each.
    startBossRound(state, 1);
    expect(p.itemHp).toBe(1);
    expect(p.itemMp).toBe(1);
    
    // 2. Transition to next round (Round 2)
    // Potion counts should carry over and increment by 1.
    p.itemHp = 1; // say player used none and picked up none, count is 1
    p.itemMp = 0; // say player used one, count is 0
    startBossRound(state, 2);
    expect(p.itemHp).toBe(2); // 1 + 1 = 2
    expect(p.itemMp).toBe(1); // 0 + 1 = 1
    
    // 3. Increment capping at 3 (Round 3)
    p.itemHp = 3;
    p.itemMp = 3;
    startBossRound(state, 3);
    expect(p.itemHp).toBe(3); // capped at 3
    expect(p.itemMp).toBe(3); // capped at 3
    
    // 4. Retry the same round (Round 3 retry)
    // If they had 0 potions, it should reset to at least 1.
    p.itemHp = 0;
    p.itemMp = 0;
    startBossRound(state, 3); // retry round 3
    expect(p.itemHp).toBe(1); // restored to 1
    expect(p.itemMp).toBe(1); // restored to 1
    
    // If they had 2 potions, they should keep them (since 2 >= 1).
    p.itemHp = 2;
    p.itemMp = 2;
    startBossRound(state, 3); // retry round 3
    expect(p.itemHp).toBe(2);
    expect(p.itemMp).toBe(2);
  });
});
