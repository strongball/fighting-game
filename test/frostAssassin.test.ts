import { describe, it, expect } from 'vitest';
import { getBoss } from '../src/game/bosses.js';
import { makeBoss, createInitialState } from '../src/game/entities/factories.ts';
import { executeAction } from '../src/game/actions/executor.ts';

// 霜雪刺客 boss id = 103，技能 skill2「鏡花幻影」(summon_clones)。
const FROST_ID = 103;

function setup(difficulty: number) {
  const state: any = createInitialState([], { difficulty }, { mode: 'boss' });
  state.roundPhase = 'fighting';
  const boss = makeBoss('frost', FROST_ID, 800, 600, 2, { isBoss: true });
  boss.hp = 5000;
  boss.maxHp = 5000;
  state.players = { [boss.id]: boss };
  return { state, boss };
}

const countClones = (state: any, boss: any) =>
  Object.values(state.players).filter((p: any) => p.isFake && p.ownerId === boss.id && p.alive).length;

describe('Round 7 Frost Assassin — 鏡花幻影 (summon_clones)', () => {
  // 回歸測試:修正前,本尊施法會被 executor 複製給每個分身,而 summon_clones 沒有
  // isFake 守衛 → 分身遞迴召喚 → 每次施放 ~×5 指數爆炸。修正後必須穩定封在 cap。
  it('does NOT exponentially explode: clones stay capped across repeated casts', () => {
    const { state, boss } = setup(0.5); // 普通難度 → cap 3
    const skill2 = getBoss(FROST_ID)!.skill2;

    // executeAction 會走真實的「分身複製本尊招式」路徑(executor.ts:44-53)。
    for (let i = 0; i < 8; i++) executeAction(state, boss, skill2);

    // 修正前:此處會是數百~數千。修正後:補滿到 cap 後維持不變。
    expect(countClones(state, boss)).toBe(3);
  });

  it('caps concurrent clones by difficulty: easy=2, normal=3, hard=4', () => {
    for (const [difficulty, cap] of [[0, 2], [0.5, 3], [1, 4]] as const) {
      const { state, boss } = setup(difficulty);
      const skill2 = getBoss(FROST_ID)!.skill2;
      for (let i = 0; i < 5; i++) executeAction(state, boss, skill2);
      expect(countClones(state, boss)).toBe(cap);
    }
  });

  it('a clone (isFake) never spawns its own clones, even when cast directly', () => {
    const { state, boss } = setup(1); // 困難 → cap 4
    const skill2 = getBoss(FROST_ID)!.skill2;

    executeAction(state, boss, skill2);
    const after1 = countClones(state, boss);
    expect(after1).toBe(4);

    // 直接以分身身分施放 summon_clones → 守衛 `if (boss.isFake) return` 應使其完全無作用。
    const clone: any = Object.values(state.players).find((p: any) => p.isFake && p.ownerId === boss.id);
    expect(clone).toBeTruthy();
    executeAction(state, clone, skill2);

    expect(countClones(state, boss)).toBe(after1); // 數量不變
  });
});
