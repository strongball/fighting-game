import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/game/entities/factories.ts';
import { applyShield } from '../src/game/entities/shield.ts';

describe('shield visuals', () => {
  it('keeps max shield behavior and emits a white shield popup when shield increases', () => {
    const state = createInitialState([{ id: 'p0', name: 'Tank', charId: 'tank' }]);
    const p = state.players.p0;

    expect(applyShield(state, p, 140, 5)).toBe(140);
    expect(p.shield).toBe(140);
    expect(p.shieldTime).toBe(5);
    expect(state.fx.at(-1)).toMatchObject({
      type: 'popup',
      color: '#f7fbff',
      text: '+140',
      kind: 'shield',
    });

    expect(applyShield(state, p, 80, 8)).toBe(0);
    expect(p.shield).toBe(140);
    expect(p.shieldTime).toBe(8);
  });
});
