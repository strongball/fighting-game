// 天賦 talonsight（鷹瞳）：連續命中累積，每第 N 次命中必定爆擊（+bonus）。
// 攻速越快 → 命中越密 → 爆擊越頻繁，與本角色的「攻速爆發」定位相扣。
//
// 另：技能「鷹眼凝視 (skill2)」會開啟一段「必爆窗口」——窗口期間每次命中皆爆擊。
// 窗口計時由 onTimers 每幀遞減，於 onCastResolved 施放 skill2 時設定。
// （老鷹的鷹擊另為必定爆擊，見 falcon.ts。）
import { registerTalent } from '../../talents/registry';
import { startFalconStorm, launchFalconCharge } from './falcon.ts';

// 設定「鷹索敵範圍放大」buff（鷹眼凝視 / 大招期間；falcon.ts 的 effectiveRange 讀取、tick 遞減）。
function setFalconRange(p: any, duration: number, mult: number) {
  p._falconRange = { remaining: duration, mult: mult || 1.5 };
}

// 每名玩家的鷹瞳狀態（命中計數 + 必爆窗口剩餘秒數），lazy 初始化以相容舊存檔/測試。
function talonState(p: any) {
  return p._talon || (p._talon = { hits: 0, eagleEye: 0 });
}

registerTalent('talonsight', {
  // 傷害管線：每次對敵命中 +1，達到「每 N 次」或處於必爆窗口時必定爆擊。
  modifyOutgoing({ attacker, dmg, talent }) {
    const s = talonState(attacker);
    s.hits++;
    const every = talent.every || 3;
    const crit = s.eagleEye > 0 || s.hits % every === 0;
    return crit ? dmg * (1 + (talent.bonus || 0.7)) : dmg;
  },
  // 每幀遞減必爆窗口。
  onTimers(_state, p, dt) {
    const s = talonState(p);
    if (s.eagleEye > 0) s.eagleEye = Math.max(0, s.eagleEye - dt);
  },
  // skill1 鷹擊·震退 → 發動鷹「衝鋒飛行」（沿施法方向飛出再弧線飛回、沿途強力擊退；只一隻鳥）。
  // skill2 鷹眼凝視 → 開啟必爆窗口 ＋ 放大鷹索敵範圍。
  // ultimate 鷹擊風暴 → 鷹連續來回俯衝 ＋ 放大鷹索敵範圍（故「包含大招」也吃到範圍 buff）。
  onCastResolved(state, p, action, slot) {
    if (slot === 'skill1') {
      launchFalconCharge(p, p.facing, { range: action.range, dmg: action.dmg, knockback: action.knockback, hitRadius: action.hitRadius });
    } else if (slot === 'skill2') {
      talonState(p).eagleEye = action.duration || 3;
      setFalconRange(p, action.duration || 3, action.falconRange || 1.6);
    } else if (slot === 'ultimate') {
      startFalconStorm(state, p, action.duration || 3.4);
      setFalconRange(p, action.duration || 3.4, action.falconRange || 1.4);
    }
  },
});
