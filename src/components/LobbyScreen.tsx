// 大廳：房號、角色選擇格、玩家列表、開始/等待。

import { useState } from 'react';
import { CHARACTERS as RAW_CHARACTERS, getCharacter as rawGetCharacter } from '../game/characters.js';
import { BOSSES as RAW_BOSSES } from '../game/bosses.js';
import { getCodexEntry, type SkillSlot } from '../utils/characterCodex';
import type { CharacterMeta, ControlScheme, GameFlags, LobbyView, SkillMeta } from '../types';

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

const SKILL_SLOTS: SkillSlot[] = ['basic', 'skill1', 'skill2', 'ultimate'];

function actionTypeLabel(type?: string) {
  switch (type) {
    case 'projectile': return '投射物';
    case 'melee': return '近戰';
    case 'dash': return '衝刺';
    case 'blink': return '瞬移';
    case 'zone': return '區域';
    case 'buff': return '增益';
    case 'star_orbit_cannon': return '星砲';
    case 'star_orbit_guard': return '增益';
    case 'star_orbit_burst': return '大絕';
    case 'samurai_iaijutsu': return '奧義';
    default: return type;
  }
}

function secondsLabel(value?: number) {
  return typeof value === 'number' ? `${value}s` : undefined;
}

// 選角詳情面板：技能說明以「角色圖鑑.md」為單一來源 (getCodexEntry)，
// 解析不到時 fallback 至程式內既有欄位；數值 (HP/MP/移速) 一律取自程式碼以保證與實際一致。
function CharacterDetail({ char, skillDisplay }: { char: CharacterMeta; skillDisplay: ReturnType<typeof getSkillDisplay> }) {
  // 圖鑑（角色圖鑑.md）以數字 id 為鍵；角色的 order 保留該對照（= 舊數字 id）。
  const codex = char.order != null ? getCodexEntry(char.order) : null;
  const role = codex?.role ?? char.role;
  const description = codex?.description ?? char.desc;
  const talent = codex?.talent ?? char.talent;
  const synergy = codex?.synergy ?? char.synergy;
  const evade = char.evade as (SkillMeta & { cd?: number }) | undefined;

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

      <div className="skill-list">
        {SKILL_SLOTS.map((slot) => {
          const cs = codex?.skills.find((s) => s.slot === slot);
          const fallback = char[slot] as SkillMeta | undefined;
          const name = cs?.name ?? fallback?.name;
          if (!name) return null;
          const type = cs?.type ?? actionTypeLabel(fallback?.type);
          const cooldown = cs?.cooldown ?? secondsLabel(fallback?.cd);
          const mana = cs?.mana ?? (typeof fallback?.manaCost === 'number' ? String(fallback.manaCost) : undefined);
          const explain = cs?.explain ?? fallback?.desc;
          return (
            <div className="skill-row" key={slot}>
              <span className="skill-key">{skillDisplay[slot]}</span>
              <div className="skill-body">
                <div className="skill-head">
                  <span className="skill-name">{name}</span>
                  {slot === 'ultimate' && <span className="skill-tag ult">大絕</span>}
                  {type && <span className="skill-tag">{type}</span>}
                  {cooldown && cooldown !== '—' && <span className="skill-tag">冷卻 {cooldown}</span>}
                  {mana && mana !== '—' && <span className="skill-tag">魔力 {mana}</span>}
                </div>
                {explain && <div className="skill-explain">{explain}</div>}
              </div>
            </div>
          );
        })}
        {evade && (
          <div className="skill-row">
            <span className="skill-key">Space</span>
            <div className="skill-body">
              <div className="skill-head">
                <span className="skill-name">{evade.name}</span>
                <span className="skill-tag">閃避</span>
                {evade.cd ? <span className="skill-tag">冷卻 {evade.cd}s</span> : null}
              </div>
              <div className="skill-explain">短暫無敵位移，可閃避攻擊、拉開距離。</div>
            </div>
          </div>
        )}
      </div>
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
  onAddNpc: () => void;
  onRemoveNpc: () => void;
  onStart: () => void;
  onStartBoss: () => void;
  onStartBossChallenge: (round: number) => void;
  onLeave: () => void;
}

export function LobbyScreen({ lobby, status, selectedChar, selectedControlScheme, selectedTeam, onSelectChar, onSelectControlScheme, onSelectTeam, onSelectGameFlags, onAddNpc, onRemoveNpc, onStart, onStartBoss, onStartBossChallenge, onLeave }: LobbyScreenProps) {
  const { players, selfId, isHost, roomCode, gameFlags } = lobby;
  const [copied, setCopied] = useState(false);
  const [bossPickerOpen, setBossPickerOpen] = useState(false);
  const [selectedBossRound, setSelectedBossRound] = useState(BOSSES[0]?.round ?? 1);
  const skillDisplay = getSkillDisplay(selectedControlScheme);
  const selectedBoss = BOSSES.find((boss) => boss.round === selectedBossRound) ?? BOSSES[0];

  function copyRoom() {
    if (!roomCode) return;
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  if (bossPickerOpen) {
    return (
      <section id="screen-boss-select" className="screen active">
        <div className="panel wide boss-picker-panel">
          <div className="lobby-head">
            <div>
              <h2>Boss 挑戰模式</h2>
              <p className="hint">選擇一位 Boss 單獨挑戰，擊破後立即完成。</p>
            </div>
            <button className="btn ghost" onClick={() => setBossPickerOpen(false)}>返回大廳</button>
          </div>

          <div className="boss-select-grid boss-picker-grid">
            {BOSSES.map((boss) => (
              <button
                key={boss.id}
                type="button"
                className={'boss-select-card' + (boss.round === selectedBossRound ? ' selected' : '')}
                onClick={() => setSelectedBossRound(boss.round)}
                aria-pressed={boss.round === selectedBossRound}
              >
                <span className="boss-select-round">ROUND {boss.round}</span>
                <span className="boss-select-icon" style={{ color: boss.color }}>{shapeIcon(boss.shape)}</span>
                <span className="boss-select-name">{boss.name}</span>
                <span className="boss-select-sub">{boss.subtitle || '未知威脅'} · HP {boss.maxHp}</span>
              </button>
            ))}
          </div>

          <div className="boss-picker-actions">
            <div>
              <span className="boss-picker-label">目前選擇</span>
              <strong>{selectedBoss?.name || `ROUND ${selectedBossRound}`}</strong>
            </div>
            <button className="btn big boss-challenge-start" onClick={() => onStartBossChallenge(selectedBossRound)}>
              🎯 開始挑戰
            </button>
          </div>
        </div>
      </section>
    );
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
          <button
            className={'btn' + (selectedControlScheme === 'wasd-ijkl' ? ' primary' : '')}
            onClick={() => onSelectControlScheme('wasd-ijkl')}
          >
            WASD 移動 + JKL 技能 + I 大絕
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

        <h3>難度{!isHost && <span className="dim">（由房主設定）</span>}</h3>
        <div className="difficulty-selector">
          {[
            { label: '簡單', value: 0, icon: '🌱', desc: '魔王傷害降低、血量減少、攻速變慢' },
            { label: '普通', value: 0.5, icon: '⚖️', desc: '預設平衡數值，適合初次挑戰' },
            { label: '困難', value: 1, icon: '💀', desc: '魔王強化，考驗操作與團隊配合' },
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
                      {p.isNpc ? '🤖 NPC'
                        : p.controlScheme === 'wasd-jkl' ? '⌨️ WASD+;'
                        : p.controlScheme === 'wasd-ijkl' ? '⌨️ WASD+I'
                        : '🎮 ↑↓←→'}
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
                  <button className="btn big boss-start" onClick={onStartBoss}>⚔️ 闖關模式（全 Boss 協同）</button>
                  <button className="btn big boss-challenge-start" onClick={() => setBossPickerOpen(true)}>🎯 Boss 挑戰模式</button>
                </>
              : <p className="dim">等待房主開始…</p>}
            <p className="status">{status}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
