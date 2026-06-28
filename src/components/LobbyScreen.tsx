// 大廳：先選玩法模式，再依模式顯示對應設定；角色選擇、玩家列表、開始/等待。

import { CHARACTERS as RAW_CHARACTERS, getCharacter as rawGetCharacter } from '../game/characters.js';
import { BOSSES as RAW_BOSSES } from '../game/bosses.js';
import { getCodexEntry } from '../utils/characterCodex';
import { SkillCodexList } from './SkillCodexList';
import { useState } from 'react';
import type { CharacterMeta, ControlScheme, GameFlags, LobbyMode, LobbyView } from '../types';

const CHARACTERS = RAW_CHARACTERS as unknown as CharacterMeta[];
const getCharacter = rawGetCharacter as (id: string) => CharacterMeta;

interface BossMeta {
  id: number;
  round: number;
  name: string;
  subtitle?: string;
  color: string;
  shape: string;
  maxHp: number;
}

const BOSSES = RAW_BOSSES as unknown as BossMeta[];

// 三種玩法模式（與 controller / types 的 LobbyMode 對應）。
const MODES: { id: LobbyMode; icon: string; name: string; desc: string }[] = [
  { id: 'expedition', icon: '🐲', name: '征伐之路', desc: '組隊協同，連續討伐所有魔王，一路打到底' },
  { id: 'challenge', icon: '🎯', name: '魔王試煉', desc: '指定一位魔王單獨挑戰，擊破即完成' },
  { id: 'versus', icon: '⚔️', name: '群雄亂鬥', desc: '玩家互相對抗，最後存活者獲勝' },
];

function shapeIcon(shape: string) {
  if (shape === 'square') return '■';
  if (shape === 'triangle') return '▲';
  return '●';
}

function getSkillDisplay(scheme: ControlScheme) {
  switch (scheme) {
    case 'arrows-asdf':
      return { basic: 'A', skill1: 'S', skill2: 'D', ultimate: 'F' };
    case 'wasd-ijkl':
      return { basic: 'J', skill1: 'K', skill2: 'L', ultimate: 'I' };
    case 'wasd-jkl':
    default:
      return { basic: 'J', skill1: 'K', skill2: 'L', ultimate: ';' };
  }
}

// 選角詳情面板：技能說明以「角色圖鑑.md」為單一來源 (getCodexEntry)，
// 解析不到時 fallback 至程式內既有欄位；數值 (HP/MP/移速) 一律取自程式碼以保證與實際一致。
// 技能清單本身抽到共用的 <SkillCodexList>（與練功房共用）。
function CharacterDetail({ char, skillDisplay }: { char: CharacterMeta; skillDisplay: ReturnType<typeof getSkillDisplay> }) {
  // 圖鑑（角色圖鑑.md）以數字 id 為鍵；角色的 order 保留該對照（= 舊數字 id）。
  const codex = char.order != null ? getCodexEntry(char.order) : null;
  const role = codex?.role ?? char.role;
  const description = codex?.description ?? char.desc;
  const talent = codex?.talent ?? char.talent;
  const synergy = codex?.synergy ?? char.synergy;

  return (
    <div className="char-detail">
      <div className="char-detail-head">
        <div className="char-detail-art" style={{ '--char-color': char.color } as React.CSSProperties}>
          {char.sprite ? <img src={char.sprite} alt="" /> : <span>{shapeIcon(char.shape)}</span>}
        </div>
        <div className="char-detail-title">
          <div className="char-detail-name">{char.name}</div>
          {role && <span className="char-role">{role}</span>}
          <div className="char-detail-stats">
            HP {char.maxHp} · MP {char.maxMana}{char.speed ? ` · 移速 ${char.speed}` : ''}
          </div>
        </div>
      </div>

      {description && <p className="char-detail-desc">{description}</p>}
      {talent && <div className="char-talent"><b>天賦 · {talent.name}</b>　{talent.desc}</div>}
      {synergy && <div className="char-synergy"><b>搭配</b>　{synergy}</div>}

      <SkillCodexList char={char} skillDisplay={skillDisplay} />
    </div>
  );
}

interface LobbyScreenProps {
  lobby: LobbyView;
  status: string;
  selectedChar: string;
  selectedControlScheme: ControlScheme;
  selectedTeam: number;
  onSelectChar: (id: string) => void;
  onSelectControlScheme: (scheme: ControlScheme) => void;
  onSelectTeam: (team: number) => void;
  onSelectGameFlags: (flags: GameFlags) => void;
  onSelectMode: (mode: LobbyMode) => void;
  onSelectBossRound: (round: number) => void;
  onSetReady: (ready: boolean) => void;
  onJoinGame: () => void;
  onAddNpc: () => void;
  onRemoveNpc: () => void;
  onStart: () => void;
  onStartBoss: () => void;
  onStartBossChallenge: (round: number) => void;
  onLeave: () => void;
}

export function LobbyScreen({ lobby, status, selectedChar, selectedControlScheme, selectedTeam, onSelectChar, onSelectControlScheme, onSelectTeam, onSelectGameFlags, onSelectMode, onSelectBossRound, onSetReady, onJoinGame, onAddNpc, onRemoveNpc, onStart, onStartBoss, onStartBossChallenge, onLeave }: LobbyScreenProps) {
  const { players, selfId, isHost, roomCode, gameFlags, matchLive } = lobby;
  // 準備狀態：房主/NPC 視為恆準備；全員準備房主才能開始。
  const self = players.find((p) => p.id === selfId);
  const humanJoiners = players.filter((p) => !p.isHost && !p.isNpc);
  const readyCount = humanJoiners.filter((p) => p.ready).length;
  const everyoneReady = humanJoiners.every((p) => p.ready);
  const [copied, setCopied] = useState(false);
  const skillDisplay = getSkillDisplay(selectedControlScheme);

  // 模式 / 選定 Boss 皆由房主決定、同步給所有人。
  const mode: LobbyMode = lobby.lobbyMode ?? 'expedition';
  const bossRound = lobby.bossRound ?? BOSSES[0]?.round ?? 1;
  const selectedBoss = BOSSES.find((b) => b.round === bossRound) ?? BOSSES[0];
  const activeMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  // 依模式決定要顯示哪些設定區塊（精簡大廳）。
  const showTeams = mode === 'versus';        // 隊伍分組只在 PvP 有意義
  const showDifficulty = mode !== 'versus';   // 難度是調魔王強度，PvP 不需要
  const showBossPicker = mode === 'challenge'; // 只有魔王試煉要挑單王

  function copyRoom() {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  function handleStart() {
    if (mode === 'versus') onStart();
    else if (mode === 'challenge') onStartBossChallenge(bossRound);
    else onStartBoss();
  }
  const startLabel = mode === 'versus' ? '⚔️ 開始群雄亂鬥'
    : mode === 'challenge' ? '🎯 開始魔王試煉'
    : '🐲 開始征伐之路';

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

        <p className="hint">把房號分享給朋友，請他們在主選單輸入房號加入。選好玩法與角色後由房主開始。</p>

        <h3>選擇玩法{!isHost && <span className="dim">（由房主設定）</span>}</h3>
        <div className="mode-picker">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={'mode-pick-card' + (m.id === mode ? ' selected' : '')}
              onClick={() => isHost && onSelectMode(m.id)}
              disabled={!isHost && m.id !== mode}
              aria-pressed={m.id === mode}
            >
              <span className="mode-pick-icon">{m.icon}</span>
              <span className="mode-pick-name">{m.name}</span>
              <span className="mode-pick-desc">{m.desc}</span>
            </button>
          ))}
        </div>

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
          <button
            className={'btn' + (selectedControlScheme === 'wasd-ijkl' ? ' primary' : '')}
            onClick={() => onSelectControlScheme('wasd-ijkl')}
          >
            WASD 移動 + JKL 技能 + I 大絕
          </button>
        </div>

        {showTeams && (
          <>
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
          </>
        )}

        {showBossPicker && (
          <>
            <h3>選擇魔王{!isHost && <span className="dim">（由房主設定）</span>}</h3>
            <div className="boss-select-grid">
              {BOSSES.map((boss) => (
                <button
                  key={boss.id}
                  type="button"
                  className={'boss-select-card' + (boss.round === bossRound ? ' selected' : '')}
                  onClick={() => isHost && onSelectBossRound(boss.round)}
                  disabled={!isHost && boss.round !== bossRound}
                  aria-pressed={boss.round === bossRound}
                >
                  <span className="boss-select-round">ROUND {boss.round}</span>
                  <span className="boss-select-icon" style={{ color: boss.color }}>{shapeIcon(boss.shape)}</span>
                  <span className="boss-select-name">{boss.name}</span>
                  <span className="boss-select-sub">{boss.subtitle || '未知威脅'} · HP {boss.maxHp}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <h3>進階開關{!isHost && <span className="dim">（由房主設定）</span>}</h3>
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

        {showDifficulty && (
          <>
            <h3>難度{!isHost && <span className="dim">（由房主設定）</span>}</h3>
            <div className="difficulty-selector">
              {[
                { label: '簡單', value: -0.3, icon: '🍃', desc: '輕鬆體驗冒險，適合新手或不擅長動作遊戲的玩家' },
                { label: '普通', value: 0, icon: '⚖️', desc: '魔王傷害降低、血量減少、攻速變慢，適合初次挑戰' },
                { label: '困難', value: 0.5, icon: '💀', desc: '魔王強化，考驗操作與團隊配合' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  className={'btn diff-btn' + (gameFlags.difficulty === opt.value ? ' active' : '')}
                  onClick={() => isHost && onSelectGameFlags({ ...gameFlags, difficulty: opt.value })}
                  disabled={!isHost}
                >
                  <span className="diff-icon">{opt.icon}</span>
                  <span className="diff-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <h3>選擇角色</h3>
        <div className="char-select">
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
              {c.role && <div className="char-role">{c.role}</div>}
              <div className="char-stat">HP {c.maxHp} · MP {c.maxMana}</div>
            </button>
          ))}
        </div>

          <CharacterDetail char={getCharacter(selectedChar)} skillDisplay={skillDisplay} />
        </div>

        <div className="lobby-foot">
          <div className="players">
            <h3>
              {players.length} 人在房間
              {humanJoiners.length > 0 && <span className="ready-progress"> · {readyCount}/{humanJoiners.length} 已準備</span>}
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
                    {showTeams && p.team ? <span className="pteam">隊 {p.team}</span> : null}
                    <span className="pcontrol">
                      {p.isNpc ? '🤖 NPC'
                        : p.controlScheme === 'wasd-jkl' ? '⌨️ WASD+;'
                        : p.controlScheme === 'wasd-ijkl' ? '⌨️ WASD+I'
                        : '🎮 ↑↓←→'}
                    </span>
                    {p.isHost || p.isNpc ? null : (
                      <span className={'pready' + (p.ready ? ' is-ready' : '')}>
                        {p.ready ? '✓ 已準備' : '⏳ 未準備'}
                      </span>
                    )}
                    {p.inGame ? <span className="pingame">🎮 遊戲中</span> : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="start-box">
            {isHost ? (
              <>
                <div className="start-mode-line">
                  目前玩法：<strong>{activeMode.name}</strong>
                  {showBossPicker && selectedBoss && <span className="dim"> · {selectedBoss.name}</span>}
                </div>
                <button className="btn primary big start-main" onClick={handleStart} disabled={!everyoneReady}>{startLabel}</button>
                {!everyoneReady && <p className="dim">等待所有玩家準備（{readyCount}/{humanJoiners.length}）…</p>}
              </>
            ) : matchLive ? (
              <>
                <button className="btn primary big" onClick={onJoinGame}>加入遊戲</button>
                <p className="dim">這場已開打（{activeMode.name}），選好角色後即可加入。</p>
              </>
            ) : (
              <>
                <button
                  className={'btn big' + (self?.ready ? ' ghost' : ' primary')}
                  onClick={() => onSetReady(!self?.ready)}
                >
                  {self?.ready ? '取消準備' : '我已準備'}
                </button>
                <p className="dim">{self?.ready ? `已準備（${activeMode.name}），等待房主開始…` : '選好角色後按下準備。'}</p>
              </>
            )}
            <p className="status">{status}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
