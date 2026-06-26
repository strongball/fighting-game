// 模擬決定性測試（自我一致性）。
//
// 同一種子跑兩次必須逐欄相同 → 抓出意外引入的「非決定性」
// (例如在模擬路徑誤用 Date.now / Math.random)。
// 這對 host 權威模擬 + 加入者本機預測 + 重播 的正確性很關鍵，且**不受平衡/角色 redesign 影響**。
//
// 註：原本還有一層「黃金快照」整段重播指紋回歸，但角色平衡 redesign 太頻繁、每次都要
//     重生 ~2700 行快照、維護成本過高，已移除。行為層面的回歸改由各別行為測試
//     (test/*.test.ts) 涵蓋。
import { describe, it, expect } from 'vitest';
import { runScenario } from './harness';

describe('simulation determinism', () => {
  it('is self-consistent: same seed yields identical replay', () => {
    const a = runScenario();
    const b = runScenario();
    expect(b).toEqual(a);
  });
});
