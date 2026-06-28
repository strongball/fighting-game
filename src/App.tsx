// 頂層元件：訂閱 controller 事件、依遊戲階段切換畫面。
// React 只負責 menu / lobby / gameover 與 game 容器；遊戲迴圈與 three.js 渲染在 controller。

import { useEffect, useState } from 'react';
import { getController } from './game/controller';
import { getAudioManager } from './utils/audioManager';
import { applyAudioSettings } from './utils/audioSettings';
import { MenuScreen } from './components/MenuScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { GameScreen } from './components/GameScreen';
import { GameOverScreen } from './components/GameOverScreen';
import { AudioSettingsButton } from './components/AudioSettingsButton';
import { TrainingOverlay } from './components/TrainingOverlay';
import type { AppPhase, ControlScheme, GameFlags, GameOverView, LobbyView, TrainingStatsView } from './types';

const EMPTY_LOBBY: LobbyView = { players: [], selfId: null, isHost: false, roomCode: '', gameFlags: { freeMana: false, noCooldown: false, noDamage: false, difficulty: 0 }, lobbyMode: 'expedition', bossRound: 1 };

export function App() {
  const controller = getController();
  const [phase, setPhase] = useState<AppPhase>('menu');
  const [lobby, setLobby] = useState<LobbyView>(EMPTY_LOBBY);
  const [menuStatus, setMenuStatus] = useState<{ msg: string; isError: boolean }>({ msg: '', isError: false });
  const [lobbyStatus, setLobbyStatus] = useState('');
  const [gameover, setGameover] = useState<GameOverView | null>(null);
  const [trainingStats, setTrainingStats] = useState<TrainingStatsView | null>(null);
  const [selectedChar, setSelectedChar] = useState<string>(controller.selectedChar);
  const [selectedControlScheme, setSelectedControlScheme] = useState<ControlScheme>('wasd-jkl');
  const [selectedTeam, setSelectedTeam] = useState(0);

  useEffect(() => {
    const offs = [
      controller.on('phase', setPhase),
      controller.on('lobby', setLobby),
      controller.on('menuStatus', (msg, isError) => setMenuStatus({ msg, isError })),
      controller.on('lobbyStatus', setLobbyStatus),
      controller.on('gameover', setGameover),
      controller.on('trainingStats', setTrainingStats),
    ];
    return () => offs.forEach((off) => off());
  }, [controller]);

  // 開發者模式：檢查 URL 參數 ?dev=true 或環境變數 VITE_DEV_MODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const devModeParam = params.get('dev');
    const roleParam = params.get('role');
    // @ts-ignore
    const envDev = import.meta.env?.VITE_DEV_MODE;
    const isDev = devModeParam === 'true' || envDev === 'true';
    if (isDev) {
      const bossParam = params.get('boss');
      const roundParam = params.get('bossRound');
      const charId = roleParam || undefined; // 角色 slug（穩定唯一 id）
      const bossRound = roundParam ? parseInt(roundParam, 10) : undefined;
      if (bossParam === 'true') setTimeout(() => controller.devStartBoss(charId, bossRound), 100);
      else setTimeout(() => controller.devStartGame(charId), 100);
    }
  }, [controller]);

  // 套用已儲存的音效/音樂音量設定（掛載時一次，確保載入的音量在音樂開始前生效）
  useEffect(() => {
    applyAudioSettings();
  }, []);

  // 重整／關閉分頁時跳出瀏覽器原生「確認離開」（避免誤觸丟失連線中的房間／戰局）。
  // 僅在非主選單階段啟用；主選單本就是最前面，不需要攔。
  useEffect(() => {
    if (phase === 'menu') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if ((window as any).__intentionalLeave) return; // 面板「離開遊戲」已確認過，不再彈
      e.preventDefault();
      e.returnValue = ''; // 觸發瀏覽器原生確認框（文字由瀏覽器決定，無法自訂）
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [phase]);

  // 根據遊戲階段切換背景音樂
  useEffect(() => {
    const audioManager = getAudioManager();
    if (phase === 'lobby') {
      audioManager.playMusic('lobby');
    } else if (phase === 'game') {
      audioManager.playMusic('game');
    } else {
      audioManager.stopMusic();
    }
  }, [phase]);

  function handleSelectChar(charId: string) {
    setSelectedChar(charId);
    controller.selectChar(charId);
  }

  function handleSelectControlScheme(scheme: ControlScheme) {
    setSelectedControlScheme(scheme);
    controller.selectControlScheme(scheme);
  }

  function handleSelectTeam(team: number) {
    setSelectedTeam(team);
    controller.selectTeam(team);
  }

  function handleSelectGameFlags(flags: GameFlags) {
    controller.selectGameFlags(flags);
  }

  function renderScreen() {
    switch (phase) {
      case 'menu':
        return (
          <MenuScreen
            status={menuStatus}
            onCreate={(name) => controller.createRoom(name)}
            onJoin={(name, code) => controller.joinRoom(name, code)}
            onTraining={(charId) => controller.startTraining(charId)}
          />
        );
      case 'lobby':
        return (
          <LobbyScreen
            lobby={lobby}
            status={lobbyStatus}
            selectedChar={selectedChar}
            selectedControlScheme={selectedControlScheme}
            selectedTeam={selectedTeam}
            onSelectChar={handleSelectChar}
            onSelectControlScheme={handleSelectControlScheme}
            onSelectTeam={handleSelectTeam}
            onSelectGameFlags={handleSelectGameFlags}
            onSelectMode={(mode) => controller.selectLobbyMode(mode)}
            onSelectBossRound={(round) => controller.selectBossRound(round)}
            onSetReady={(ready) => controller.setReady(ready)}
            onJoinGame={() => controller.joinGame()}
            onAddNpc={() => controller.addNpc()}
            onRemoveNpc={() => controller.removeNpc()}
            onStart={() => controller.startGame()}
            onStartBoss={() => controller.startBossGame()}
            onStartBossChallenge={(round) => controller.startBossChallenge(round)}
            onLeave={() => controller.leave()}
          />
        );
      case 'game':
        return <GameScreen controller={controller} />;
      case 'gameover':
        return gameover ? (
          <GameOverScreen
            view={gameover}
            onToLobby={() => controller.returnToLobby()}
            onLeave={() => controller.leave()}
          />
        ) : null;
      default:
        return null;
    }
  }

  // 音效設定鈕全域疊在最上層 → 選單/大廳/遊戲中/結算皆可調整（遊戲內外通用）。
  return (
    <>
      {renderScreen()}
      {trainingStats && phase === 'game' && <TrainingOverlay stats={trainingStats} controller={controller} />}
      <AudioSettingsButton canLeave={phase !== 'menu'} onLeave={() => controller.leave()} />
    </>
  );
}
