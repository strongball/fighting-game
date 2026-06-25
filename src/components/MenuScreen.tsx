// 主選單：名稱輸入、建立房間、輸入房號加入。

import { useState } from 'react';
import { CHARACTERS } from '../game/characters.js';

interface MenuScreenProps {
  status: { msg: string; isError: boolean };
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  onTraining: (charId: string) => void;
}

const ROSTER = (CHARACTERS as any[]).map((c) => ({ id: c.id, name: c.name }));

export function MenuScreen({ status, onCreate, onJoin, onTraining }: MenuScreenProps) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');
  const [trainChar, setTrainChar] = useState<string>(ROSTER[0]?.id ?? 'warrior');

  // 名稱留空時自動產生隨機名（沿用舊版行為）。
  function resolveName() {
    const v = name.trim();
    return v || '玩家' + Math.floor(Math.random() * 1000);
  }

  return (
    <section id="screen-menu" className="screen active">
      <div className="panel">
        <h1>幾何鬥技場</h1>
        <p className="subtitle">2.5D 俯視 · 多人連線 · 最後存活者獲勝</p>

        <label className="field">
          <span>你的名稱</span>
          <input
            maxLength={12}
            placeholder="輸入名稱"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="menu-actions">
          <button className="btn primary" onClick={() => onCreate(resolveName())}>建立房間</button>
          <div className="join-row">
            <input
              placeholder="輸入房號（例 fg-ABCDE）"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onJoin(resolveName(), room.trim()); }}
            />
            <button className="btn" onClick={() => onJoin(resolveName(), room.trim())}>加入房間</button>
          </div>
        </div>

        <div className="training-row" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <select
            value={trainChar}
            onChange={(e) => setTrainChar(e.target.value)}
            style={{ flex: 1, padding: '8px', borderRadius: 8 }}
            aria-label="練功房角色"
          >
            {ROSTER.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn" onClick={() => onTraining(trainChar)}>🎯 練功房（傷害測試）</button>
        </div>
        <p className="dim" style={{ fontSize: 12, marginTop: 4 }}>單機練功房：對不死木人測試 DPS 與各技能輸出佔比，可即時換角、重置。</p>

        <p className={'status' + (status.isError ? ' error' : '')}>{status.msg}</p>

        <div className="help">
          <h3>操作方式</h3>
          <p><b>WASD / 方向鍵</b> 移動　<b>J</b> 普攻　<b>K</b> 技能1　<b>L</b> 技能2　<b>;</b> 大絕招　<b>Space</b> 閃避　<b>滑鼠右鍵</b> 鎖定</p>
          <p className="dim">出招會自動微吸附前方敵人（可在設定關閉）；按住 <b>滑鼠右鍵</b>（或鍵盤 <b>C</b>）完全鎖定最近敵人、邊走邊繞（攻擊朝鎖定目標）。Space 閃避仍跟當下「移動方向」逃。技能在 CD 結束前 200ms 內預按會自動施放，連招更順。</p>
        </div>
      </div>
    </section>
  );
}
