// @ts-nocheck
// 階段系統：每隻 Boss 可在 data.phases 宣告階段轉換條件與效果。
// 跨越 hpPct 閾值時觸發階段：套用倍率 (dmgMult / speedMult / cdMult)、
// 呼叫 onEnter 自訂腳本、彈出階段橫幅、Boss 短暫無敵 1 秒、震動。
//
// data.phases 格式：
//   [
//     { hpPct: 0.66, name: '怒火覺醒', sub: '攻擊強化', color: '#ff7a3d',
//       dmgMult: 1.2, speedMult: 1.15, cdMult: 0.85,
//       tagsOverride?: [...], onEnter?: (state, boss) => {} }
//   ]
// hpPct 是「跨越」的閾值；按陣列順序從 0 起。

import { getBoss } from '../bosses.js';
import { addFx } from '../entities/fx.ts';

const PHASE_IFRAME = 1.0; // Boss 在階段轉換期間的無敵時間
const PHASE_BANNER_LIFE = 1.4;

export function getBossPhases(boss: any) {
  if (!boss || !boss.isBoss) return null;
  const data = getBoss(boss.charId);
  return data && Array.isArray(data.phases) ? data.phases : null;
}

export function initBossPhase(boss: any) {
  boss.phaseIdx = 0;
  boss.phaseDmgMult = 1;
  boss.phaseSpeedMult = 1;
  boss.phaseCdMult = 1;
  boss.phaseIframe = 0;
  boss.phaseTagsOverride = null;
}

export function tickBossPhases(state: any, dt: number) {
  for (const o of Object.values(state.players) as any[]) {
    if (!o.isBoss || !o.alive) continue;
    if (o.phaseIframe > 0) o.phaseIframe = Math.max(0, o.phaseIframe - dt);
    const phases = getBossPhases(o);
    if (!phases || !phases.length) continue;
    const hpRatio = o.maxHp > 0 ? o.hp / o.maxHp : 1;
    const cur = o.phaseIdx || 0;
    if (cur >= phases.length) continue;
    const next = phases[cur];
    if (hpRatio <= next.hpPct) triggerPhase(state, o, next, cur + 1);
  }
}

function triggerPhase(state: any, boss: any, phase: any, newIdx: number) {
  boss.phaseIdx = newIdx;
  // 套用本階段及之前所有階段的累積倍率 (最後一個生效；不是相乘累加)
  boss.phaseDmgMult = phase.dmgMult != null ? phase.dmgMult : (boss.phaseDmgMult || 1);
  boss.phaseSpeedMult = phase.speedMult != null ? phase.speedMult : (boss.phaseSpeedMult || 1);
  boss.phaseCdMult = phase.cdMult != null ? phase.cdMult : (boss.phaseCdMult || 1);
  if (phase.tagsOverride) boss.phaseTagsOverride = phase.tagsOverride;
  boss.phaseIframe = PHASE_IFRAME;

  // 橫幅 + 震動 + 大爆閃
  state.banner = {
    text: phase.name || `階段 ${newIdx + 1}`,
    sub: phase.sub || '',
    life: PHASE_BANNER_LIFE,
    kind: 'phase',
    color: phase.color || '#ff7a3d',
  };
  addFx(state, {
    type: 'ultimate',
    x: boss.x, y: boss.y, facing: boss.facing,
    color: phase.color || '#ff7a3d',
    life: 0.8, radius: 220,
  });

  // 觸發自訂腳本 (可以加 buff / 召喚物 / 改場上 zone …)
  if (typeof phase.onEnter === 'function') {
    try { phase.onEnter(state, boss); } catch (e) { console.warn('phase.onEnter error', e); }
  }
}
