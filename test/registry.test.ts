// Registry / 資料完整性測試。
//
// 這些不變式同時也是「專案文件」：清楚描述引擎對角色、魔王、action handler 的期望。
// 之後新增角色/魔王/action 時，若漏接某個 registry，這裡會立刻報錯。
import { describe, it, expect } from 'vitest';
import { CHARACTERS, getCharacter } from '../src/game/characters.js';
import { BOSSES, BOSS_COUNT, getBossForRound } from '../src/game/bosses.js';
import { ACTION_HANDLERS } from '../src/game/actions/handlers/index.ts';
import { getTalentHooks } from '../src/game/characters/talents/registry.ts';
import { BOSS_PIPELINE_STEP_IDS, PLAYER_PIPELINE_STEP_IDS, WORLD_PIPELINE_STEP_IDS } from '../src/game/systems/pipeline/index.ts';

const SLOTS = ['basic', 'skill1', 'skill2', 'ultimate', 'evade'] as const;

describe('character registry', () => {
  it('exposes player characters with unique string slug ids', () => {
    expect(CHARACTERS.length).toBeGreaterThanOrEqual(19);
    // id 為穩定字串 slug（= 資料夾名），不再是連續數字索引 → 新增角色不會搶號衝突。
    for (const c of CHARACTERS as any[]) {
      expect(typeof c.id, `${c.name} id should be a slug string`).toBe('string');
    }
    const ids = (CHARACTERS as any[]).map((c) => c.id);
    expect(new Set(ids).size, 'character slug ids must be unique').toBe(ids.length);
  });

  it('gives every character all action slots + a talent + an evade type', () => {
    for (const c of CHARACTERS as any[]) {
      expect(c.basic?.type, `${c.name} basic`).toBeTruthy();
      expect(c.ultimate?.type, `${c.name} ultimate`).toBeTruthy();
      expect(c.evade?.type, `${c.name} evade`).toBeTruthy();
      expect(['blink', 'dash'], `${c.name} evadeType`).toContain(c.evadeType);
      expect(c.talent?.id, `${c.name} talent`).toBeTruthy();
    }
  });

  it('resolves players (slug), bosses (>=100) and minions (<0) through getCharacter', () => {
    expect(getCharacter('star-orbit')?.name).toBe('星環使');
    expect(getCharacter('warrior')?.id).toBe('warrior');
    expect(getCharacter(100)?.id).toBe(100);
    expect(getCharacter(-1)).toBeTruthy();
    expect(getCharacter(-2)).toBeTruthy();
  });
});

describe('talent hook registry', () => {
  // 守護「角色 index.ts 忘了 import './talent.ts'」這類靜默漏接：傷害管線天賦的 hook 必須註冊。
  it('registers damage-pipeline hooks for migrated talents', () => {
    expect(CHARACTERS.length).toBeGreaterThan(0); // 確保 glob 已載入觸發 talent 註冊
    expect(getTalentHooks('virulence')?.modifyOutgoing).toBeTypeOf('function'); // 刺客 (原 lethal → 改劇毒增傷)
    expect(getTalentHooks('deadeye')?.modifyOutgoing).toBeTypeOf('function');
    expect(getTalentHooks('summonbond')?.modifyIncoming).toBeTypeOf('function');
    expect(getTalentHooks('arcane_flow')?.onDealt).toBeTypeOf('function');
    expect(getTalentHooks('bloodlust')?.onDealt).toBeTypeOf('function');
    expect(getTalentHooks('retribution')?.onAttacked).toBeTypeOf('function');
  });

  it('registers lifecycle hooks for migrated talents', () => {
    expect(getTalentHooks('bloodlust')?.cooldownRate).toBeTypeOf('function');
    expect(getTalentHooks('lifebloom')?.onRecovery).toBeTypeOf('function');
    expect(getTalentHooks('iaido')?.onTimers).toBeTypeOf('function');
    expect(getTalentHooks('timeprism')?.onCastResolved).toBeTypeOf('function');
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
  it('provides 17 bosses, one per round 1..17', () => {
    expect(BOSS_COUNT).toBe(17);
    expect(BOSSES.length).toBe(17);
    for (let round = 1; round <= 17; round++) {
      expect(getBossForRound(round), `boss for round ${round}`).toBeTruthy();
    }
    expect(getBossForRound(18)).toBeNull();
  });
});

describe('simulation pipeline', () => {
  it('keeps player lifecycle order explicit', () => {
    expect([...PLAYER_PIPELINE_STEP_IDS]).toEqual([
      'summon-life',
      'resolve-input',
      'character-timers',
      'cooldowns',
      'status-effects',
      'passive-recovery',
      'channels',
      'barrage',
      'scripted-action',
      'items',
      'auto-lock',
      'movement',
      'trail',
      'cast-input-actions',
    ]);
  });

  it('keeps boss lifecycle order explicit', () => {
    expect([...BOSS_PIPELINE_STEP_IDS]).toEqual([
      'parts',
      'phases',
      'time-anchors',
      'tethers',
      'revive',
      'boss-specific-tick',
      'history',
    ]);
  });

  it('keeps world lifecycle order explicit', () => {
    expect([...WORLD_PIPELINE_STEP_IDS]).toEqual([
      'collisions',
      'static-colliders',
      'projectiles',
      'zones',
      'temporal-echoes',
      'destructibles',
      'drop-items',
      'fx',
      'dead-summon-cleanup',
      'mode-resolution',
    ]);
  });
});
