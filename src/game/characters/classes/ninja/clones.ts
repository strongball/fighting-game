// 忍者大招「千影分身」：召出 5 個無敵殘影分身，於一段時間內圍繞最近目標持續斬擊。
//   ・分身為「持續存在」的人形殘影（VFX 一次生成、整段時間都在；非每幀閃一下）——
//     視覺上看得到 5 個分身站在目標四周連續砍，而不是一圈光錐。
//   ・分身非實體（純傷害來源＋殘影 VFX），故天生「無敵」、不可被攻擊。
//   ・施法者本體於施放期間隱身＋無敵（由 ult 的 self 效果套用），形成安全爆發窗。
// 由 BaseCharacter 的 tick 每幀呼叫（見 index.ts）；狀態 p._ninjaClones 由 shadowflurry handler 設定。
// 決定性：目標以「最近敵人」決定、無 Math.random。
import { dealDamage } from '../../../entities/damage.ts';
import { addFx } from '../../../entities/fx.ts';
import { isEnemy } from '../../../entities/team.ts';
import type { Player } from '../../../types';

function nearestEnemy(state: any, p: Player, range: number): Player | null {
  let best: Player | null = null;
  let bestD = range;
  for (const o of Object.values(state.players) as any[]) {
    if (!o.alive || !isEnemy(state, p.id, o)) continue;
    const d = Math.hypot(o.x - p.x, o.y - p.y);
    if (d <= bestD) { bestD = d; best = o; }
  }
  return best;
}

export function tickNinjaClones(state: any, p: Player, dt: number) {
  const cl = (p as any)._ninjaClones;
  if (!cl) return;
  if (!p.alive) { (p as any)._ninjaClones = null; return; }

  cl.remaining -= dt;
  cl.timer -= dt;

  // 首次取得目標 → 鎖定該目標 id，於目標處召出殘影分身；VFX 之後每幀跟隨此目標移動（targetId 帶給 render 端）。
  // strikeInterval 帶給 VFX，使分身的斬擊節奏與傷害節奏一致（避免「動畫與掉血不同步」）。
  if (!cl.spawned) {
    const t0 = nearestEnemy(state, p, cl.range);
    if (t0) {
      cl.spawned = true;
      cl.targetId = t0.id;
      addFx(state, { type: 'buff', x: t0.x, y: t0.y, color: '#9fd2ff', life: cl.remaining, radius: cl.orbit, targetId: t0.id, strikeInterval: cl.interval, vfx: 'ninja_clones' });
    }
  }

  // 每 interval 對「鎖定的同一目標」造成一輪傷害（count 段）。分身視覺也跟隨同一目標 →
  // 傷害與分身同目標、同節奏，不再出現「目標移動後分身留在原地、血量卻不動」。
  if (cl.timer <= 0 && cl.remaining > 0) {
    cl.timer += cl.interval;
    const target = cl.targetId != null ? state.players[cl.targetId] : null;
    if (target && target.alive) {
      for (let i = 0; i < cl.count; i++) dealDamage(state, target, cl.dmg, p.id, { source: 'ultimate' });
    }
  }

  if (cl.remaining <= 0) (p as any)._ninjaClones = null;
}
