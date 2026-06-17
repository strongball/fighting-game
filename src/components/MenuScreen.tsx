// 主選單：名稱輸入、建立房間、輸入房號加入。

import { useState } from 'react';

interface MenuScreenProps {
  status: { msg: string; isError: boolean };
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
}

export function MenuScreen({ status, onCreate, onJoin }: MenuScreenProps) {
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

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

        <p className={'status' + (status.isError ? ' error' : '')}>{status.msg}</p>

        <div className="help">
          <h3>操作方式</h3>
          <p><b>WASD / 方向鍵</b> 移動　<b>J</b> 普攻　<b>K</b> 技能1　<b>L</b> 技能2　<b>;</b> 大絕招　<b>Space</b> 閃避</p>
          <p className="dim">面向＝最後移動方向。Space 閃避會跟著當下「移動方向」逃 (可往後跳)。技能在 CD 結束前 200ms 內預按會自動施放，連招更順。</p>
        </div>
      </div>
    </section>
  );
}
