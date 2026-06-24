// 結算畫面：勝者、依擊殺排序的戰績、返回大廳/離開。
// 闖關模式：顯示每關用時、各人完整統計、MVP。

import { getCharacter as rawGetCharacter } from '../game/characters.js';
import type { BossPlayerStats, BossRoundEntry, CharacterMeta, GameOverView } from '../types';

const getCharacter = rawGetCharacter as (id: string) => CharacterMeta;

interface GameOverScreenProps {
  view: GameOverView;
  onToLobby: () => void;
  onLeave: () => void;
}

function fmtDuration(s: number): string {
  if (!isFinite(s) || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function GameOverScreen({ view, onToLobby, onLeave }: GameOverScreenProps) {
  const { winnerName, winnerTeam, players, isHost, bossResult, bossRound, bossStats, bossMode, bossName } = view;
  const isBossChallenge = bossMode === 'challenge';
  const sorted = [...players].sort((a, b) => b.kills - a.kills);
  const title = bossResult
    ? (bossResult === 'victory'
        ? (isBossChallenge ? `🎯 Boss 挑戰成功 — ${bossName || `ROUND ${bossRound ?? '?'}`}` : '🏆 全部魔王討伐完成！')
        : (isBossChallenge ? `💀 Boss 挑戰失敗 — ${bossName || `ROUND ${bossRound ?? '?'}`}` : `💀 闖關失敗 — 止步於 ROUND ${bossRound ?? '?'}`))
    : winnerName
      ? (winnerTeam && winnerTeam > 0 ? `🏆 隊伍 ${winnerTeam} 獲勝！` : `🏆 ${winnerName} 獲勝！`)
      : '平手 — 無人存活';

  const showBossSettle = bossResult && bossStats;

  return (
    <section id="screen-gameover" className="screen active">
      <div className={`panel ${showBossSettle ? 'boss-settle' : ''}`}>
        <h1>{title}</h1>
        {bossResult && <p className="hint">{bossResult === 'victory' ? (isBossChallenge ? `你們成功擊破了${bossName ? `「${bossName}」` : '選定的 Boss'}。` : '你們擊敗了全部魔王，傳奇就此誕生。') : '靠近倒地的隊友即可拉起，下次再協力挑戰！'}</p>}

        {showBossSettle ? (
          <BossSettlement stats={bossStats} />
        ) : (
          <>
            <h3>{bossResult ? '闖關隊伍' : '本局戰績'}</h3>
            <div className="player-list">
              {sorted.map((p, i) => {
                const c = getCharacter(p.charId);
                return (
                  <div className="player-row" key={i}>
                    <span className="dot" style={{ background: c.color }}></span>
                    <span className="pname">{p.name}</span>
                    <span className="pchar">{c.name}</span>
                    {p.team ? <span className="pchar">隊 {p.team}</span> : null}
                    <span className="pkills">擊殺 {p.kills}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="over-actions">
          {isHost
            ? <button className="btn primary" onClick={onToLobby}>返回大廳</button>
            : <p className="dim">等待房主返回大廳…</p>}
          <button className="btn ghost" onClick={onLeave}>離開</button>
        </div>
      </div>
    </section>
  );
}

function BossSettlement({ stats }: { stats: NonNullable<GameOverView['bossStats']> }) {
  const { totalDuration, retryCount, perRound, perPlayer, mvpId } = stats;
  const maxRoundDur = Math.max(1, ...perRound.map((r) => r.duration));
  const playerSorted = [...perPlayer].sort((a, b) => b.dmgDealt - a.dmgDealt);

  return (
    <div className="boss-settle-body">
      <div className="bs-summary">
        <div className="bs-stat"><div className="bs-label">總用時</div><div className="bs-value">{fmtDuration(totalDuration)}</div></div>
        <div className="bs-stat"><div className="bs-label">通關關卡</div><div className="bs-value">{perRound.filter((r) => r.defeated).length} / 10</div></div>
        <div className="bs-stat"><div className="bs-label">重打次數</div><div className="bs-value">{retryCount}</div></div>
      </div>

      <h3>每關進度</h3>
      <div className="bs-rounds">
        {perRound.map((r) => (
          <RoundRow key={r.round} entry={r} maxDur={maxRoundDur} />
        ))}
        {perRound.length === 0 && <p className="dim">尚未通過任何關卡。</p>}
      </div>

      <h3>個人戰績{mvpId ? <span className="bs-mvp-hint">— MVP ⭐ 標示者</span> : null}</h3>
      <div className="bs-players">
        {playerSorted.map((p) => (
          <PlayerRow key={p.id} player={p} isMvp={p.id === mvpId} />
        ))}
      </div>
    </div>
  );
}

function RoundRow({ entry, maxDur }: { entry: BossRoundEntry; maxDur: number }) {
  const pct = Math.max(2, (entry.duration / maxDur) * 100);
  return (
    <div className={`bs-round ${entry.defeated ? '' : 'failed'}`}>
      <span className="bs-r-num">R{entry.round}</span>
      <span className="bs-r-name">{entry.bossName || '—'}</span>
      <div className="bs-r-bar"><i style={{ width: `${pct}%` }} /></div>
      <span className="bs-r-time">{fmtDuration(entry.duration)}</span>
      {entry.retries > 0 ? <span className="bs-r-retry">×{entry.retries + 1}</span> : <span className="bs-r-retry" />}
    </div>
  );
}

function PlayerRow({ player, isMvp }: { player: BossPlayerStats; isMvp: boolean }) {
  const c = getCharacter(player.charId);
  const totalSkills = player.skillUses.basic + player.skillUses.skill1 + player.skillUses.skill2 + player.skillUses.ultimate + player.skillUses.evade;
  return (
    <div className={`bs-player ${isMvp ? 'mvp' : ''}`}>
      <div className="bs-p-head">
        <span className="dot" style={{ background: c.color }} />
        <span className="bs-p-name">{isMvp ? '⭐ ' : ''}{player.name}</span>
        <span className="bs-p-char">{c.name}</span>
      </div>
      <div className="bs-p-grid">
        <Stat label="輸出" value={player.dmgDealt} />
        <Stat label="承傷" value={player.dmgTaken} />
        <Stat label="治療" value={player.healing} />
        <Stat label="擊殺" value={player.kills} />
        <Stat label="死亡" value={player.deaths} />
        <Stat label="復活隊友" value={player.revives} />
        <Stat label="最大單擊" value={player.maxHit} />
        <Stat label="暴擊" value={player.critCount} />
        <Stat label="控制命中" value={player.ccApplied} />
        <Stat label="技能使用" value={totalSkills} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bs-p-stat">
      <div className="bs-p-stat-label">{label}</div>
      <div className="bs-p-stat-value">{value}</div>
    </div>
  );
}
