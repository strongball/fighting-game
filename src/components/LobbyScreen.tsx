// 大廳：房號、角色選擇格、玩家列表、開始/等待。

import { useState } from 'react';
import { CHARACTERS as RAW_CHARACTERS, getCharacter as rawGetCharacter } from '../game/characters.js';
import type { CharacterMeta, ControlScheme, GameFlags, LobbyView } from '../types';

const CHARACTERS = RAW_CHARACTERS as unknown as CharacterMeta[];
const getCharacter = rawGetCharacter as (id: number) => CharacterMeta;

function shapeIcon(shape: string) {
  if (shape === 'square') return '■';
  if (shape === 'triangle') return '▲';
  return '●';
}

function getSkillDisplay(scheme: ControlScheme) {
  if (scheme === 'wasd-jkl') {
    return { basic: 'J', skill1: 'K', skill2: 'L', ultimate: ';' };
  } else {
    return { basic: 'A', skill1: 'S', skill2: 'D', ultimate: 'F' };
  }
}

interface LobbyScreenProps {
  lobby: LobbyView;
  status: string;
  selectedChar: number;
  selectedControlScheme: ControlScheme;
  selectedTeam: number;
  onSelectChar: (id: number) => void;
  onSelectControlScheme: (scheme: ControlScheme) => void;
  onSelectTeam: (team: number) => void;
  onSelectGameFlags: (flags: GameFlags) => void;
  onAddNpc: () => void;
  onRemoveNpc: () => void;
  onStart: () => void;
  onStartBoss: () => void;
  onLeave: () => void;
}

export function LobbyScreen({ lobby, status, selectedChar, selectedControlScheme, selectedTeam, onSelectChar, onSelectControlScheme, onSelectTeam, onSelectGameFlags, onAddNpc, onRemoveNpc, onStart, onStartBoss, onLeave }: LobbyScreenProps) {
  const { players, selfId, isHost, roomCode, gameFlags } = lobby;
  const [copied, setCopied] = useState(false);
  const skillDisplay = getSkillDisplay(selectedControlScheme);

  function copyRoom() {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <section id="screen-lobby" className="screen active">
      <div className="panel wide">
        <div className="lobby-head">
          <div>
            <h2>房間大廳</h2>
            <div className="room-line">房號：<code>{roomCode || '連線中…'}</code>
              <button className="btn tiny" onClick={copyRoom}>{copied ? '已複製' : '複製'}</button>
            </div>
          </div>
          <button className="btn ghost" onClick={onLeave}>離開</button>
        </div>

        <p className="hint">把房號分享給朋友，請他們在主選單輸入房號加入。選好角色後由房主開始。</p>

        <h3>選擇操作方式</h3>
        <div className="control-scheme-selector">
          <button
            className={'btn' + (selectedControlScheme === 'wasd-jkl' ? ' primary' : '')}
            onClick={() => onSelectControlScheme('wasd-jkl')}
          >
            WASD 移動 + JKL; 技能
          </button>
          <button
            className={'btn' + (selectedControlScheme === 'arrows-asdf' ? ' primary' : '')}
            onClick={() => onSelectControlScheme('arrows-asdf')}
          >
            ↑↓←→ 移動 + ASDF 技能
          </button>
        </div>

        <h3>隊伍</h3>
        <div className="control-scheme-selector team-selector">
          {[0, 1, 2, 3, 4].map((t) => (
            <button
              key={t}
              className={'btn' + (selectedTeam === t ? ' primary' : '')}
              onClick={() => onSelectTeam(t)}
            >
              {t === 0 ? '單人混戰' : `隊伍 ${t}`}
            </button>
          ))}
        </div>
        <p className="hint">同隊玩家為友軍：不會互相傷害，治療／護盾／增益可作用於隊友。單人＝全場混戰、最後一人獲勝。</p>

        <h3>遊戲模式{!isHost && <span className="dim">（由房主設定）</span>}</h3>
        <div className="game-modes-grid">
          <button
            className={'btn mode-btn' + (gameFlags.freeMana ? ' active' : '')}
            onClick={() => isHost && onSelectGameFlags({ ...gameFlags, freeMana: !gameFlags.freeMana })}
            disabled={!isHost}
          >
            <div className="mode-icon">💧</div>
            <div className="mode-name">無限魔力</div>
            <div className="mode-desc">MP 與大招能量始終滿格，技能無限施放</div>
          </button>
          <button
            className={'btn mode-btn' + (gameFlags.noCooldown ? ' active' : '')}
            onClick={() => isHost && onSelectGameFlags({ ...gameFlags, noCooldown: !gameFlags.noCooldown })}
            disabled={!isHost}
          >
            <div className="mode-icon">⚡</div>
            <div className="mode-name">無冷卻</div>
            <div className="mode-desc">所有技能冷卻時間清零，可連續施放</div>
          </button>
          <button
            className={'btn mode-btn' + (gameFlags.noDamage ? ' active' : '')}
            onClick={() => isHost && onSelectGameFlags({ ...gameFlags, noDamage: !gameFlags.noDamage })}
            disabled={!isHost}
          >
            <div className="mode-icon">🛡️</div>
            <div className="mode-name">無敵模式</div>
            <div className="mode-desc">所有玩家受到攻擊時 HP 不下降</div>
          </button>
        </div>



        <h3>選擇角色</h3>
        <div className="char-grid">
          {CHARACTERS.map((c) => (
            <button
              key={c.id}
              className={'char-card' + (c.id === selectedChar ? ' selected' : '')}
              onClick={() => onSelectChar(c.id)}
            >
              <div className="char-art" style={{ '--char-color': c.color } as React.CSSProperties}>
                {c.sprite ? <img src={c.sprite} alt="" loading="lazy" /> : <span>{shapeIcon(c.shape)}</span>}
              </div>
              <div className="char-name">{c.name}</div>
              <div className="char-stat">HP {c.maxHp} · MP {c.maxMana}</div>
              {c.role && <div className="char-role">{c.role}</div>}
              <div className="char-desc">{c.desc}</div>
              {c.talent && (
                <div className="char-talent"><b>天賦</b> {c.talent.name}：{c.talent.desc}</div>
              )}
              {c.synergy && <div className="char-synergy"><b>搭配</b> {c.synergy}</div>}
              <div className="char-skills">
                <span>{skillDisplay.basic} {c.basic.name}</span><span>{skillDisplay.skill1} {c.skill1.name}</span><span>{skillDisplay.skill2} {c.skill2.name}</span>
                {c.ultimate && <span className="ult">{skillDisplay.ultimate} {c.ultimate.name}（大絕）</span>}
                {c.evade && <span>Space {c.evade.name}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="lobby-foot">
          <div className="players">
            <h3>
              {players.length} 人在房間
              {isHost && (
                <span className="npc-controls">
                  <button className="btn tiny" onClick={onAddNpc} title="加入 NPC">+ NPC</button>
                  <button className="btn tiny" onClick={onRemoveNpc} title="移除 NPC" disabled={!players.some((p) => p.isNpc)}>− NPC</button>
                </span>
              )}
            </h3>
            <div className="player-list">
              {players.map((p) => {
                const c = getCharacter(p.charId);
                return (
                  <div className="player-row" key={p.id}>
                    <span className="dot" style={{ background: c.color }}></span>
                    <span className="pname">{p.name}{p.id === selfId ? '（你）' : ''}{p.isHost ? ' 👑' : ''}</span>
                    <span className="pchar">{c.name}</span>
                    {p.team ? <span className="pteam">隊 {p.team}</span> : null}
                    <span className="pcontrol">
                      {p.isNpc ? '🤖 NPC' : (p.controlScheme === 'wasd-jkl' ? '⌨️ WASD' : '🎮 ↑↓←→')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="start-box">
            {isHost
              ? <>
                  <button className="btn primary big" onClick={onStart}>開始遊戲</button>
                  <button className="btn big boss-start" onClick={onStartBoss}>⚔️ 闖關模式（10 魔王協同）</button>
                </>
              : <p className="dim">等待房主開始…</p>}
            <p className="status">{status}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
