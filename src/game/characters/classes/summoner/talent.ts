// 天賦 summonbond（戰靈護主）：身邊存活的召喚物越多，主人受到的傷害越低。
// 註：另有「召喚物命中敵人時回血給主人」的互動仍內聯於 damage.ts（召喚物本身無天賦，
// 屬跨實體 owner 邏輯，之後可隨 onTick/aura hook 一併搬移）。
import { registerTalent } from '../../talents/registry';

// 數在場召喚物層數（上限 maxStacks）。受傷減免與傷害加成共用此計數。
function bondStacks(state: any, owner: any, talent: any): number {
  let n = 0;
  for (const other of Object.values(state.players) as any[]) if (other.isMinion && other.ownerId === owner.id && other.alive) n++;
  return Math.min(talent.maxStacks || 3, n);
}

registerTalent('summonbond', {
  // 受傷減免：每層 −dr（戰靈護主）。
  modifyIncoming({ state, target, dmg, talent }) {
    const n = bondStacks(state, target, talent);
    return n > 0 ? dmg * (1 - n * (talent.dr || 0.1)) : dmg;
  },
  // 傷害加成：召喚物越多，召喚師本體輸出越高（讓「養兵」同時提升自身戰力，補足本體偏弱）。
  modifyOutgoing({ state, attacker, dmg, talent }) {
    const per = talent.dmgPerStack || 0;
    if (!per) return dmg;
    const n = bondStacks(state, attacker, talent);
    return n > 0 ? dmg * (1 + n * per) : dmg;
  },
});
