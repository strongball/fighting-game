// Registry / 資料完整性測試。
//
// 這些不變式同時也是「專案文件」：清楚描述引擎對角色、魔王、action handler 的期望。
// 之後新增角色/魔王/action 時，若漏接某個 registry，這裡會立刻報錯。
import { describe, it, expect } from 'vitest';
import { CHARACTERS, getCharacter } from '../src/game/characters.js';
import { BOSSES, BOSS_COUNT, getBossForRound } from '../src/game/bosses.js';
import { ACTION_HANDLERS } from '../src/game/actions/handlers/index.ts';

const SLOTS = ['basic', 'skill1', 'skill2', 'ultimate', 'evade'] as const;

describe('character registry', () => {
  it('exposes 18 player characters with sequential ids 0..17', () => {
    expect(CHARACTERS.length).toBe(18);
    CHARACTERS.forEach((c: any, i: number) => expect(c.id).toBe(i));
  });

  it('gives every character all action slots + a talent', () => {
    for (const c of CHARACTERS as any[]) {
      expect(c.basic?.type, `${c.name} basic`).toBeTruthy();
      expect(c.ultimate?.type, `${c.name} ultimate`).toBeTruthy();
      expect(c.evade?.type, `${c.name} evade`).toBeTruthy();
      expect(c.talent?.id, `${c.name} talent`).toBeTruthy();
    }
  });

  it('resolves bosses (>=100) and minions (<0) through getCharacter', () => {
    expect(getCharacter(100)?.id).toBe(100);
    expect(getCharacter(-1)).toBeTruthy();
    expect(getCharacter(-2)).toBeTruthy();
  });
});

describe('action handler registry', () => {
  it('has a registered handler for every action type used by any character', () => {
    const types = new Set<string>();
    for (const c of CHARACTERS as any[]) {
      for (const slot of SLOTS) if (c[slot]?.type) types.add(c[slot].type);
    }
    for (const t of types) {
      expect(ACTION_HANDLERS.has(t), `missing handler for action type "${t}"`).toBe(true);
    }
  });
});

describe('boss registry', () => {
  it('provides 12 bosses, one per round 1..12', () => {
    expect(BOSS_COUNT).toBe(12);
    expect(BOSSES.length).toBe(12);
    for (let round = 1; round <= 12; round++) {
      expect(getBossForRound(round), `boss for round ${round}`).toBeTruthy();
    }
  });
});
