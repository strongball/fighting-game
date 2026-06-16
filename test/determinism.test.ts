// 行為不變的黃金回歸測試。
//
// 重構引擎時，先確保此檔通過 = 模擬「行為」未變。兩個層次：
//  1) 自我一致性：同一種子跑兩次必須逐欄相同 (抓出意外引入的非決定性)。
//  2) 黃金快照：把整段重播指紋鎖進 __snapshots__；行為改變 → 比對失敗。
//
// 若你「刻意」改變了平衡或修了 bug 而導致快照失效，請以 `vitest -u` 更新快照，
// 並在 PR/commit 說明變更原因。
import { describe, it, expect } from 'vitest';
import { runScenario } from './harness';

describe('simulation determinism (golden regression)', () => {
  it('is self-consistent: same seed yields identical replay', () => {
    const a = runScenario();
    const b = runScenario();
    expect(b).toEqual(a);
  });

  it('matches the golden behavior snapshot', () => {
    expect(runScenario()).toMatchSnapshot();
  });
});
