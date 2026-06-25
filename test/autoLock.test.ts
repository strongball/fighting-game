// 玩家自動瞄準/鎖定（systems/autoLock.ts）單元測試。
//
// 驗證：
//  1) A 出招微吸附「近戰/遠程分流」(方案 D)：近戰完全對準＋微衝刺；遠程只小幅修正、遠射不吸。
//  2) C 按住鎖定 合成正確的 input.aim、維護 lockTargetId。
//  3) 「契約」：沒有 assist/lock 旗標的輸入（腳本/AI）完全不受影響 —— determinism 黃金快照不變的根本。

// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/entities/factories.ts';
import { applyPlayerAutoLock } from '../src/game/systems/autoLock.ts';
import { EMPTY_INPUT } from '../src/game/input.js';

// assassin: basic=melee(reach 95)、skill1=blink(位移)。mage: basic=projectile(遠程)。
function scene(attackerChar = 'assassin') {
  const state = createInitialState(
    [
      { id: 'a', name: 'A', charId: attackerChar, team: 0 },
      { id: 'e', name: 'E', charId: 'mage', team: 0 },
    ],
    {},
    { mode: 'ffa' },
  );
  const a = state.players.a, e = state.players.e;
  a.x = 1000; a.y = 800; a.facing = 0; // 朝東(+x)
  e.x = 1300; e.y = 950;               // 右前下方，角度 ≈ 0.4636
  return { state, a, e };
}

const ANG = (a, e) => Math.atan2(e.y - a.y, e.x - a.x);

function input(overrides) {
  return { ...EMPTY_INPUT, aim: null, ...overrides };
}

describe('autoLock A — 近戰系（完全對準＋微衝刺）', () => {
  it('按下近戰招式 + 前方錐內有敵人 → 完全對準；不設 lockTargetId', () => {
    const { state, a, e } = scene('assassin');
    const inp = input({ basic: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeCloseTo(ANG(a, e), 4);
    expect(a.lockTargetId).toBeNull();
  });

  it('微衝刺：目標在攻擊範圍外一點 → 補到 reach 邊緣，但絕不更靠近', () => {
    const { state, a, e } = scene('assassin'); // reach 95
    e.x = 1150; e.y = 800; // 正前方 d=150（超出 reach 55，在衝刺帶內）
    const inp = input({ basic: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(a.x).toBeGreaterThan(1000);        // 朝 +x 補
    expect(a.x).toBeLessThanOrEqual(1055);    // 只補到 reach 邊緣(1150-95)，不會更靠近
    expect(a.y).toBeCloseTo(800, 6);
    expect(inp.aim).toBeCloseTo(0, 4);
  });

  it('已在攻擊範圍內 → 不衝刺', () => {
    const { state, a, e } = scene('assassin');
    e.x = 1060; e.y = 800; // d=60 < reach 95
    const inp = input({ basic: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(a.x).toBe(1000);
  });

  it('位移型招式(blink skill1) 不吃自動瞄準', () => {
    const { state, a } = scene('assassin');
    const inp = input({ skill1: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeNull();
  });
});

describe('autoLock A — 遠程系（小幅修正、遠射不吸）', () => {
  it('中近距離、角度差超過上限 → 只小幅修正、不完全 snap', () => {
    const { state, a, e } = scene('mage'); // basic=projectile
    // e 預設 (1300,950) 角度 0.4636 > 上限 0.3 → 修正被夾到 0.3
    const inp = input({ basic: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeCloseTo(0.3, 4);
    expect(Math.abs(inp.aim - ANG(a, e))).toBeGreaterThan(0.1); // 沒有完全對準
  });

  it('角度差在上限內 → 完全對準', () => {
    const { state, a, e } = scene('mage');
    e.x = 1300; e.y = 850; // 角度 ≈ 0.165 < 0.3
    const inp = input({ basic: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeCloseTo(ANG(a, e), 3);
  });

  it('超出吸附距離（風箏遠射）→ 不自動瞄，保留手動瞄技術門檻', () => {
    const { state, a, e } = scene('mage');
    e.x = 1600; e.y = 800; // d=600 > 450
    const inp = input({ basic: true, assist: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeNull();
  });
});

describe('autoLock C — 按住鎖定（依角色類型分流）', () => {
  it('近戰角色按住 lock → 完全對準目標（不分距離）', () => {
    const { state, a, e } = scene('assassin'); // meleeRole
    e.x = 1600; e.y = 800; // 即使遠，近戰仍完全鎖定（玩家主動鎖、可繞步）
    const inp = input({ lock: true });
    applyPlayerAutoLock(state, a, inp);
    expect(a.lockTargetId).toBe('e');
    expect(inp.aim).toBeCloseTo(ANG(a, e), 4);
  });

  it('遠程角色(槍手)站定按住 lock → 完整瞄準（任意距離）', () => {
    const { state, a, e } = scene('gunner'); // 非 meleeRole
    e.x = 1600; e.y = 800; // d=600，站定仍完整瞄準
    const inp = input({ lock: true }); // 無移動鍵
    applyPlayerAutoLock(state, a, inp);
    expect(a.lockTargetId).toBe('e');
    expect(inp.aim).toBeCloseTo(ANG(a, e), 4);
  });

  it('遠程角色移動中按住 lock → 不瞄準（避免邊走邊免費瞄）', () => {
    const { state, a, e } = scene('gunner');
    e.x = 1300; e.y = 950; // 即使近距離，一走路就不瞄
    const inp = input({ lock: true, up: true });
    applyPlayerAutoLock(state, a, inp);
    expect(a.lockTargetId).toBeNull();
    expect(inp.aim).toBeNull();
  });

  it('放開 lock → 清除 lockTargetId', () => {
    const { state, a } = scene('assassin');
    applyPlayerAutoLock(state, a, input({ lock: true }));
    expect(a.lockTargetId).toBe('e');
    applyPlayerAutoLock(state, a, input({ lock: false }));
    expect(a.lockTargetId).toBeNull();
  });

  it('近戰繞步(strafe)：移動方向不影響朝向 → aim 仍指向目標', () => {
    const { state, a, e } = scene('assassin');
    const inp = input({ lock: true, up: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeCloseTo(ANG(a, e), 4); // 指向敵人，而非移動方向
  });
});

describe('autoLock — 契約：腳本/AI 輸入不受影響', () => {
  it('輸入未帶 assist/lock 旗標（腳本/harness）→ aim 與位置完全不動', () => {
    const { state, a, e } = scene('assassin');
    e.x = 1150; e.y = 800;
    const inp = input({ basic: true, up: true, right: true }); // 無 assist/lock
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeNull();
    expect(a.lockTargetId).toBeNull();
    expect(a.x).toBe(1000); // 無微衝刺
  });

  it('AI 控制的實體（aiId）即使帶 lock 也不介入', () => {
    const { state, a } = scene();
    a.aiId = 'boss-x';
    const inp = input({ lock: true });
    applyPlayerAutoLock(state, a, inp);
    expect(inp.aim).toBeNull();
    expect(a.lockTargetId).toBeNull();
  });
});
