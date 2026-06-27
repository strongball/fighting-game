// 練功房（傷害測試）即時面板：疊在遊戲畫面右上角，顯示 DPS、各技能輸出佔比、
// maxHit / 爆擊 / 承受傷害，並提供換角、重置、木人還手切換、離開。
// 資料由 controller 每 ~0.15s 經 'trainingStats' 事件推送（host 權威 state 計算）。

import { useMemo, useState } from 'react';
import { CHARACTERS } from '../game/characters.js';
import { SkillCodexList, type SkillKeyDisplay } from './SkillCodexList';
import { getCodexEntry } from '../utils/characterCodex';
import type { CharacterMeta, GameController, TrainingStatsView, TrainingSkillRow } from '../types';

// 練功房用預設按鍵字（wasd-jkl）；與面板底部操作提示一致。
const TRAIN_KEYS: SkillKeyDisplay = { basic: 'J', skill1: 'K', skill2: 'L', ultimate: ';' };

const SLOT_LABEL: Record<string, string> = {
  basic: '普攻', skill1: '技能1', skill2: '技能2', ultimate: '大招', evade: '閃避',
  summon: '召喚物', dot: '持續傷害', reflect: '反傷', other: '其他',
};
const SLOT_COLOR: Record<string, string> = {
  basic: '#7aa2ff', skill1: '#5ad7ff', skill2: '#9b8cff', ultimate: '#ffd166',
  summon: '#5cffa6', dot: '#ff8a5c', reflect: '#ff6b9d', evade: '#9aa7b5', other: '#9aa7b5',
};

const fmt = (n: number) => Math.round(n).toLocaleString();

interface Props {
  stats: TrainingStatsView;
  controller: GameController;
}

export function TrainingOverlay({ stats, controller }: Props) {
  const chars = useMemo(() => (CHARACTERS as any[]).map((c) => ({ id: c.id, name: c.name })), []);
  const charMeta = useMemo(
    () => (CHARACTERS as any[]).find((c) => c.id === stats.charId) as CharacterMeta | undefined,
    [stats.charId],
  );
  const [showSkills, setShowSkills] = useState(true);
  // 天賦（被動）：與技能同源自「角色圖鑑.md」(getCodexEntry)，解析不到時 fallback 至角色資料。
  const talent = useMemo(() => {
    const ct = charMeta?.order != null ? getCodexEntry(charMeta.order)?.talent : null;
    if (ct) return ct;
    const t = (charMeta as any)?.talent;
    return t ? { name: t.name as string, desc: t.desc as string } : null;
  }, [charMeta]);
  const blur = (e: React.MouseEvent) => (e.currentTarget as HTMLElement).blur();

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <strong style={{ fontSize: 14, letterSpacing: 1 }}>🎯 傷害測試 · 練功房</strong>
        <button style={btnGhost} onClick={(e) => { blur(e); controller.quitTraining(); }}>離開</button>
      </div>

      <label style={row}>
        <span style={{ opacity: 0.7, fontSize: 12 }}>角色</span>
        <select
          style={select}
          value={stats.charId}
          onChange={(e) => controller.startTraining(e.target.value)}
        >
          {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <div style={dpsBox}>
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: '#ffd166' }}>{fmt(stats.dps)}</div>
        <div style={{ fontSize: 11, opacity: 0.7 }}>DPS</div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11, opacity: 0.85, lineHeight: 1.5 }}>
          <div>總輸出 <b>{fmt(stats.total)}</b></div>
          <div>時間 <b>{stats.elapsed.toFixed(1)}s</b></div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
        {stats.perSkill.length === 0 && <div style={{ opacity: 0.5, fontSize: 12, padding: '6px 0' }}>開始攻擊木人以收集數據…</div>}
        {stats.perSkill.map((p) => <SkillBar key={p.slot} row={p} />)}
      </div>

      <div style={statsGrid}>
        <Stat label="最大單擊" value={fmt(stats.maxHit)} />
        <Stat label="爆擊次數" value={String(stats.critCount)} />
        <Stat label="承受傷害" value={fmt(stats.dmgTaken)} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button style={btnPrimary} onClick={(e) => { blur(e); controller.resetTrainingStats(); }}>重置數據</button>
        <button
          style={stats.retaliate ? btnOn : btn}
          onClick={(e) => { blur(e); controller.setTrainingRetaliate(!stats.retaliate); }}
        >
          木人還手：{stats.retaliate ? '開' : '關'}
        </button>
      </div>

      <div style={{ fontSize: 10.5, opacity: 0.55, marginTop: 8, lineHeight: 1.5 }}>
        移動貼近木人，J 普攻／K L 技能／; 大招。換角會重開測試。
      </div>

      {charMeta && (
        <div style={skillSection}>
          <button style={skillToggle} onClick={(e) => { blur(e); setShowSkills((v) => !v); }}>
            <span>📖 天賦 · 技能說明</span>
            <span style={{ opacity: 0.6, fontWeight: 400 }}>{showSkills ? '收起 ▾' : '展開 ▸'}</span>
          </button>
          {showSkills && (
            <div style={skillScroll}>
              {talent && (
                <div className="skill-list" style={{ marginBottom: 4 }}>
                  <div className="skill-row">
                    <span className="skill-key" style={{ background: 'rgba(255,209,102,0.18)', borderColor: 'rgba(255,209,102,0.4)' }}>天賦</span>
                    <div className="skill-body">
                      <div className="skill-head">
                        <span className="skill-name">{talent.name}</span>
                        <span className="skill-tag ult">被動</span>
                      </div>
                      <div className="skill-explain">{talent.desc}</div>
                    </div>
                  </div>
                </div>
              )}
              <SkillCodexList char={charMeta} skillDisplay={TRAIN_KEYS} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkillBar({ row }: { row: TrainingSkillRow }) {
  const color = SLOT_COLOR[row.slot] || '#9aa7b5';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 56, color, fontWeight: 600 }}>{SLOT_LABEL[row.slot] || row.slot}</span>
      <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.08)', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, row.pct * 100)}%`, height: '100%', background: color, opacity: 0.85, borderRadius: 7, transition: 'width 0.2s' }} />
      </div>
      <span style={{ width: 46, textAlign: 'right', opacity: 0.9 }}>{(row.pct * 100).toFixed(0)}%</span>
      <span style={{ width: 64, textAlign: 'right', opacity: 0.7 }}>{fmt(row.dps)}/s</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 10, opacity: 0.6 }}>{label}</div>
    </div>
  );
}

// ---- 樣式（inline，避免動到共用 style.css）----
const panel: React.CSSProperties = {
  position: 'fixed', top: 12, right: 12, width: 340, zIndex: 50,
  background: 'rgba(14,18,28,0.86)', backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12,
  padding: 14, color: '#e8eef6', font: '13px/1.4 system-ui, sans-serif',
  boxShadow: '0 10px 40px rgba(0,0,0,0.5)', pointerEvents: 'auto', userSelect: 'none',
};
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 };
const select: React.CSSProperties = {
  flex: 1, background: 'rgba(255,255,255,0.07)', color: '#e8eef6',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 8px', fontSize: 13,
};
const dpsBox: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12,
  padding: '10px 12px', background: 'rgba(255,209,102,0.08)',
  border: '1px solid rgba(255,209,102,0.2)', borderRadius: 10,
};
const statsGrid: React.CSSProperties = {
  display: 'flex', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)',
};
const btnBase: React.CSSProperties = {
  flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12.5, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.15)', color: '#e8eef6', background: 'rgba(255,255,255,0.06)',
};
const btn: React.CSSProperties = { ...btnBase };
const btnPrimary: React.CSSProperties = { ...btnBase, background: 'rgba(122,162,255,0.25)', borderColor: 'rgba(122,162,255,0.5)', fontWeight: 600 };
const btnOn: React.CSSProperties = { ...btnBase, background: 'rgba(255,107,107,0.28)', borderColor: 'rgba(255,107,107,0.55)', fontWeight: 600 };
const btnGhost: React.CSSProperties = { padding: '4px 10px', borderRadius: 8, fontSize: 12, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', color: '#e8eef6', background: 'transparent' };
const skillSection: React.CSSProperties = { marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)' };
const skillToggle: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '6px 9px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
  border: '1px solid rgba(255,255,255,0.15)', color: '#e8eef6', background: 'rgba(255,255,255,0.06)',
};
// 技能清單可能比視窗高 → 限高可捲動，避免面板溢出畫面。
const skillScroll: React.CSSProperties = { maxHeight: '42vh', overflowY: 'auto', paddingRight: 2 };
