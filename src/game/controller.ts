// 遊戲 Controller：串接連線 / 模擬 / 渲染 / 輸入，並管理大廳與遊戲迴圈。
// 由 main.js 移植而來；原本對 ui.* 的呼叫改成對 React 發送事件（emit）。
//
// 重要：渲染器（three.js）延後到 React 把 canvas 掛上後（attachCanvas）才建立。
// 邏輯/網路維持 setInterval(30Hz) 驅動，渲染用 requestAnimationFrame，
// 並保留「rAF 超過 60ms 未跑就後備 draw()」的機制（勿用 document.hidden 包住渲染）。
//
// ── 架構 ───────────────────────────────────────────────────────────
// 單例（getController）。核心（連線/大廳/開始/遊戲迴圈/結算）高度共用閉包狀態，留在本檔；
// 自成一格、低耦合的關注點已抽到 ./controller/ 與 ./network/ 子模組，各自獨立演進：
//   ./network/snapshot.ts     網路快照序列化（宣告式欄位 manifest）
//   ./controller/prediction.ts 加入者快照緩衝 / 自身預測 / 遠端插值
//   ./controller/camera.ts     視角模式 / 滑鼠鎖定 / 準心
//   ./controller/bossStats.ts  闖關結算統計
// 本檔仍含段落：事件匯流排 / 大廳 / 連線回呼(host+joiner) / 開始遊戲 / 遊戲迴圈 / 結算 / 開發者模式
//
// host-authoritative P2P 星狀拓撲。線路訊息以 `t` 判別（型別見 game/types/network.ts）：
//   hello   加入者→房主：自我介紹(name/charId/team)
//   select  大廳：選角/隊伍/操作方式
//   lobby   房主→全體：大廳名單
//   start   房主→全體：開始(初始 state + lobby)
//   input   加入者→房主：每幀輸入
//   state   房主→全體：權威狀態快照(供 joiner 插值/預測)
//   gameover/tolobby/full  結算 / 返回大廳 / 房間已滿
// 房主跑 step() 權威模擬並廣播 snapshot；加入者送 input、收 snapshot 做插值，自身用 applyMovement 預測。
// ──────────────────────────────────────────────────────────────────

import { createRenderer } from './renderer.js';
import { createNetwork, makeRoomCode } from './network.js';
import { createInput, EMPTY_INPUT } from './input.js';
import { createInitialState, makePlayer } from './entities.js';
import { CHARACTERS } from './characters.js';
import { getBossForRound } from './bosses.js';
import { startBossRound, retryBossRound, quitBossRun } from './bossMode.js';
import { step } from './simulation.ts';
import { serializeNetworkSnapshot } from './network/snapshot';
import { buildBossStats } from './controller/bossStats';
import { setupStats, summarizeDps } from './entities/stats.ts';
import { createPrediction } from './controller/prediction';
import { createCamera } from './controller/camera';
import { ARENA, DT, SNAPSHOT_INTERVAL, INPUT_INTERVAL, MAX_PLAYERS } from './constants.js';
import type {
  ControllerEvents,
  ControlScheme,
  GameController,
  GameFlags,
  GameOverView,
  LobbyEntry,
  LobbyView,
} from '../types';

// 網路快照序列化已抽到 ./network/snapshot.ts（宣告式欄位 manifest）。
// 此處 re-export 維持既有引用點（含 test/networkSnapshot.test.ts）不需改動。
export { serializeNetworkPlayer, serializeNetworkSnapshot } from './network/snapshot';

// ---------- 加入者效能量測 (?perf=1) ----------
// 量化加入者卡頓來源：每包大小 (含 fx / projectiles 佔比)、反序列化處理、buildView 插值耗時、
// 掉幀、插值緩衝枯竭 (holds)。每秒 console 印一行；未開啟時所有量測碼皆跳過、正常路徑零成本。
const PERF = typeof location !== 'undefined' && new URLSearchParams(location.search).get('perf') === '1';
function makePerf() {
  return { last: 0, snaps: 0, bytes: 0, fxBytes: 0, projBytes: 0, worstBytes: 0,
           recvMs: 0, builds: 0, buildMs: 0, worstBuildMs: 0, frames: 0, holds: 0,
           // 房主端：logicTick 實際觸發率 / step() 呼叫率 / 快照廣播率 — 證明 tick 是否被渲染擠掉頻
           ticks: 0, steps: 0, snapsOut: 0 };
}

function createController(): GameController {
  // ---------- 事件匯流排 (Controller → React) ----------
  const listeners: { [K in keyof ControllerEvents]: Set<ControllerEvents[K]> } = {
    phase: new Set(),
    lobby: new Set(),
    menuStatus: new Set(),
    lobbyStatus: new Set(),
    gameover: new Set(),
    trainingStats: new Set(),
  };
  function on<K extends keyof ControllerEvents>(event: K, fn: ControllerEvents[K]) {
    listeners[event].add(fn);
    return () => { listeners[event].delete(fn); };
  }
  function emit<K extends keyof ControllerEvents>(event: K, ...args: Parameters<ControllerEvents[K]>) {
    for (const fn of listeners[event]) (fn as (...a: unknown[]) => void)(...args);
  }

  // ---------- 引擎 ----------
  const net = createNetwork();
  const input = createInput();
  let renderer: ReturnType<typeof createRenderer> | null = null;
  let canvasEl: HTMLCanvasElement | null = null;

  let role: 'host' | 'joiner' | null = null;
  let selfId: string | null = null;
  let myName = '';
  let roomCode = '';
  let selectedChar: string = CHARACTERS[0]?.id ?? 'warrior'; // 角色 slug（穩定唯一 id）
  let selectedControlScheme: ControlScheme = 'wasd-jkl';
  let selectedTeam = 0; // 0 = 單人；正數 = 組隊
  let gameFlags: GameFlags = { freeMana: false, noCooldown: false, noDamage: false, difficulty: 0.5 };
  let lobby: LobbyEntry[] = [];

  let gameState: any = null;       // 房主權威狀態
  const inputs: Record<string, any> = {}; // 房主：playerId -> input

  let running = false;
  let wantLoop = false;            // 想啟動迴圈但等待 canvas 掛上
  let gameoverSent = false;
  let accumulator = 0, snapAcc = 0, inputAcc = 0, snapSeq = 0, trainEmitAcc = 0;
  let lastLogic = 0;
  let lastRender = 0;
  let logicTimer: ReturnType<typeof setInterval> | null = null;
  let rafId: number | null = null;
  const perf = PERF ? makePerf() : null;

  // 加入者：快照緩衝 / 自身預測 / 遠端插值（狀態自成一格，見 ./controller/prediction.ts）
  const prediction = createPrediction({ getSelfId: () => selfId, perf });
  // 視角模式 / 滑鼠鎖定 / 準心（見 ./controller/camera.ts）
  const camera = createCamera({
    input,
    getCanvasEl: () => canvasEl,
    isRunning: () => running,
    getSelfFacing: () => selfFacing(),
  });

  // ---------- 大廳 ----------
  function addToLobby(entry: LobbyEntry) {
    if (!lobby.find((p) => p.id === entry.id)) lobby.push(entry);
  }
  function removeFromLobby(id: string) { lobby = lobby.filter((p) => p.id !== id); }
  function renderLobby() {
    const view: LobbyView = { players: lobby, selfId, isHost: role === 'host', roomCode, gameFlags };
    emit('lobby', view);
  }
  function broadcastLobby() {
    net.broadcast({ t: 'lobby', players: lobby, gameFlags });
    renderLobby();
  }

  // ---------- 連線回呼 ----------
  function setupHost() {
    net.on('onOpen', (id: string) => {
      selfId = id;
      addToLobby({ id, name: myName, charId: selectedChar, controlScheme: selectedControlScheme, isHost: true, team: selectedTeam });
      emit('phase', 'lobby');
      renderLobby();
    });
    net.on('onData', (from: string, data: any) => {
      if (data.t === 'hello') {
        if (lobby.length >= MAX_PLAYERS) { net.sendTo(from, { t: 'full' }); return; }
        addToLobby({ id: from, name: data.name, charId: data.charId ?? CHARACTERS[0]?.id, controlScheme: data.controlScheme || 'wasd-jkl', isHost: false, team: data.team | 0 });
        broadcastLobby();
      } else if (data.t === 'select') {
        const p = lobby.find((x) => x.id === from);
        if (p) { if (data.charId != null) p.charId = data.charId; if (data.controlScheme) p.controlScheme = data.controlScheme; if (data.team != null) p.team = data.team | 0; broadcastLobby(); }
      } else if (data.t === 'input') {
        inputs[from] = data.input;
      }
    });
    net.on('onLeave', (id: string) => {
      removeFromLobby(id);
      if (gameState && gameState.players[id]) { delete gameState.players[id]; delete inputs[id]; }
      if (!running) broadcastLobby(); else renderLobby();
    });
    net.on('onError', (err: any) => {
      const taken = err && /unavailable|taken|ID/i.test(String(err.type || err.message || err));
      emit('menuStatus', '連線錯誤：' + (err.type || err.message || err) + (taken ? '（房號被占用，請重試）' : ''), true);
    });
  }

  function setupJoiner() {
    net.on('onOpen', () => {
      selfId = net.id;
      emit('phase', 'lobby');
      net.sendToHost({ t: 'hello', name: myName, charId: selectedChar, controlScheme: selectedControlScheme, team: selectedTeam });
      emit('lobbyStatus', '已連上房主，等待開始…');
    });
    net.on('onData', (_from: string, data: any) => {
      if (data.t === 'lobby') { lobby = data.players; if (data.gameFlags) gameFlags = data.gameFlags; renderLobby(); }
      else if (data.t === 'start') { lobby = data.lobby; startFromSnapshot(data.state); }
      else if (data.t === 'state') { prediction.receiveSnapshot(data.snapshot, data.seq); }
      else if (data.t === 'gameover') { joinerGameover(data); }
      else if (data.t === 'tolobby') { lobby = data.players; stopLoop(); input.disable(); emit('phase', 'lobby'); renderLobby(); }
      else if (data.t === 'full') { alert('房間已滿（上限 ' + MAX_PLAYERS + ' 人）'); window.location.reload(); }
    });
    net.on('onHostClose', () => { alert('與房主的連線已中斷，遊戲結束。'); window.location.reload(); });
    net.on('onError', (err: any) => {
      emit('menuStatus', '無法連線到房間：' + (err.type || err.message || err) + '（請確認房號正確）', true);
      emit('phase', 'menu');
    });
  }

  // ---------- 開始遊戲 ----------
  function hostStart() {
    const arr = lobby.map((p) => ({ id: p.id, name: p.name, charId: p.charId, team: p.team || 0, isNpc: p.isNpc }));
    gameState = createInitialState(arr, gameFlags);
    for (const id of Object.keys(gameState.players)) inputs[id] = { ...EMPTY_INPUT };
    net.broadcast({ t: 'start', state: gameState, lobby });
    beginLoop();
  }

  // ---------- Boss 模式（闖關固定 R1；挑戰模式只打指定 Boss） ----------
  function startBossSession(round: number, bossMode: 'campaign' | 'challenge') {
    if (role !== 'host') return;
    const arr = lobby.map((p) => ({ id: p.id, name: p.name, charId: p.charId, team: 1, isNpc: p.isNpc }));
    gameState = createInitialState(arr, gameFlags, { mode: 'boss' });
    gameState.bossMode = bossMode;
    for (const id of Object.keys(gameState.players)) inputs[id] = { ...EMPTY_INPUT };
    startBossRound(gameState, round);
    net.broadcast({ t: 'start', state: gameState, lobby });
    beginLoop();
  }

  function startBossGame() { startBossSession(1, 'campaign'); }

  function startBossChallenge(round: number) { startBossSession(round, 'challenge'); }

  function startFromSnapshot(state: any) {
    prediction.initFromSnapshot(state);
    beginLoop();
  }

  // ---------- 房主：精簡快照 (只送加入者「渲染/HUD」需要的欄位) ----------
  // 原本廣播整包 gameState：每個實體都帶大量「房主專用」模擬欄位 (魔王/小兵的 aiState、
  // charge/leap/trail/suppress 計時器、不斷累積的 stats…)。這些加入者完全用不到，卻要在
  // 主執行緒以 30Hz 反序列化，造成 GC / 解析尖峰 → 加入者畫面卡頓 (房主擁有物件故不受影響)。
  // 改送精簡快照後，封包小很多、加入者每幀分配的垃圾大幅下降，卡頓即緩解。
  // ---------- 迴圈生命週期 ----------
  // beginLoop 只切換到遊戲畫面並標記想啟動；實際啟動等 canvas 掛上 (attachCanvas)。
  function beginLoop() {
    emit('phase', 'game');
    wantLoop = true;
    maybeStartLoop();
  }

  function maybeStartLoop() {
    if (!wantLoop || running || !renderer) return;
    input.setScheme(selectedControlScheme);
    input.enable();
    running = true;
    gameoverSent = false;
    accumulator = 0; snapAcc = 0; inputAcc = 0;
    lastLogic = performance.now();
    lastRender = 0;
    // 邏輯與網路用 setInterval 驅動：即使視窗失焦/隱藏也會持續運作（rAF 會被暫停），
    // 房主因此不會在切換視窗時讓全場凍結。渲染則交給 requestAnimationFrame。
    if (logicTimer) clearInterval(logicTimer);
    logicTimer = setInterval(logicTick, 1000 / 30);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(renderLoop);
    camera.setBattleActive(true); // 戰鬥開始：設定面板顯示「視角」切換列
  }

  function stopLoop() {
    running = false;
    wantLoop = false;
    if (logicTimer) { clearInterval(logicTimer); logicTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    camera.reset(); // 離開戰鬥時回到一般遠景視角
    camera.setBattleActive(false); // 戰鬥結束：隱藏「視角」切換列
  }

  // ---------- 邏輯/網路迴圈（固定步、不依賴畫面更新）----------
  function logicTick() {
    if (!running) return;
    const now = performance.now();
    let dt = (now - lastLogic) / 1000;
    lastLogic = now;
    if (dt > 0.25) dt = 0.25; // 限制追趕，避免長時間背景後一次爆衝

    const inp = input.get();

    if (role === 'host') {
      if (perf) perf.ticks++; // logicTick 實際觸發次數 (setInterval 在主執行緒忙時會漂移)
      inputs[selfId as string] = inp;
      accumulator += dt;
      let guard = 0;
      while (accumulator >= DT && guard < 8) { step(gameState, inputs, DT); accumulator -= DT; guard++; if (perf) perf.steps++; }

      // 練功房維生：木人與玩家皆 god mode（木人穩定承傷不死、玩家持續輸出不中斷），
      // 並節流推送即時 DPS / 各技能佔比給 React overlay。
      if (gameState.mode === 'training') {
        const dummy = gameState.players[gameState.trainingDummyId];
        if (dummy) {
          dummy.hp = dummy.maxHp; dummy.alive = true;
          if (!dummy.isNpc) {
            // 靜止木人：固定原地、清擊退，免被推走（還手模式交給 NPC AI 自由移動）。
            dummy.x = gameState.trainingDummyX; dummy.y = gameState.trainingDummyY;
            dummy.vx = 0; dummy.vy = 0; dummy.kvx = 0; dummy.kvy = 0;
          }
        }
        const meP = gameState.players[selfId as string];
        if (meP) { meP.hp = meP.maxHp; meP.alive = true; }
        trainEmitAcc += dt;
        if (trainEmitAcc >= 0.15) { trainEmitAcc = 0; emitTrainingStats(); }
      }

      snapAcc += dt;
      // 快照走「不可靠 / 不排序」通道 (broadcastSnapshot)：state 是 latest-wins,允許掉包/亂序,
      // 藉此避開可靠通道的 head-of-line blocking (一包延遲卡住後續全部) — 偶發大卡頓的根因。
      // 帶 seq 讓加入者丟棄後到的舊包。
      // 保留餘數 (snapAcc -=，不要歸零)：setInterval 在 host 渲染壓力下會抖動，歸零會把累積的
      // 餘數丟掉，使快照率掉到 tick 率以下。減去 interval 可讓下一個短 tick 補送，維持接近 30Hz。
      if (snapAcc >= SNAPSHOT_INTERVAL) {
        snapAcc -= SNAPSHOT_INTERVAL;
        if (snapAcc > SNAPSHOT_INTERVAL) snapAcc = SNAPSHOT_INTERVAL; // 長時間背景後限制追趕，避免連續爆送
        net.broadcastSnapshot({ t: 'state', seq: snapSeq++, snapshot: serializeNetworkSnapshot(gameState) });
        if (perf) perf.snapsOut++;
      }

      if (gameState.phase === 'gameover' && !gameoverSent) hostGameover();
    } else {
      inputAcc += dt;
      if (inputAcc >= INPUT_INTERVAL) { inputAcc = 0; net.sendToHost({ t: 'input', input: inp }); }
      prediction.tickSelfPrediction(inp, dt); // 自身固定步預測；遠端插值改在 draw() 以 60fps 進行
    }

    // 後備渲染：若 requestAnimationFrame 因分頁被視為隱藏而暫停，
    // 仍以邏輯頻率補畫一幀，避免某些內嵌瀏覽器出現黑畫面。
    if (now - lastRender > 60) draw();
  }

  function draw() {
    if (!renderer) return;
    lastRender = performance.now();
    const view = input.getView ? input.getView() : null;
    let rendered: any = null;
    if (role === 'host') { rendered = gameState; if (rendered) renderer.render(rendered, selfId, view); }
    else { rendered = prediction.buildView(); if (rendered) renderer.render(rendered, selfId, view); } // 每幀重建插值視圖
    // 全滅「重來/離開」面板出現時自動解除滑鼠鎖定，讓玩家點得到按鈕（否則游標被鎖住看不見）
    if (rendered && rendered.roundPhase === 'wiped' && document.pointerLockElement) document.exitPointerLock();
    if (perf) reportPerf();
  }

  // 每秒彙整一行 (加入者欄位最有意義；房主只有 fps)。重點看 avgPkt 與 fx 佔比、buildAvg、holds/s。
  function reportPerf() {
    if (!perf) return;
    perf.frames++;
    const now = performance.now();
    if (perf.last === 0) { perf.last = now; return; }
    if (now - perf.last < 1000) return;
    const secs = (now - perf.last) / 1000;
    const r1 = (x: number) => (x / secs).toFixed(0);
    if (role === 'host') {
      // tickHz 應 ≈30；若被渲染擠到 ~17，快照率 (snapOutHz) 跟著腰斬 → 全場加入者卡
      console.log(
        `[perf host] fps=${r1(perf.frames)} tickHz=${r1(perf.ticks)} stepHz=${r1(perf.steps)} snapOutHz=${r1(perf.snapsOut)}`,
      );
    } else {
      const n = perf.snaps || 1;
      const kb = (b: number) => (b / 1024).toFixed(1);
      console.log(
        `[perf joiner] fps=${r1(perf.frames)} snaps/s=${r1(perf.snaps)} ` +
        `avgPkt=${kb(perf.bytes / n)}KB (fx=${kb(perf.fxBytes / n)} proj=${kb(perf.projBytes / n)}) worstPkt=${kb(perf.worstBytes)}KB ` +
        `recvAvg=${(perf.recvMs / n).toFixed(2)}ms buildAvg=${(perf.buildMs / (perf.builds || 1)).toFixed(2)}ms ` +
        `buildWorst=${perf.worstBuildMs.toFixed(1)}ms holds/s=${r1(perf.holds)}`,
      );
    }
    perf.last = now;
    perf.snaps = perf.bytes = perf.fxBytes = perf.projBytes = perf.worstBytes = 0;
    perf.recvMs = perf.builds = perf.buildMs = perf.worstBuildMs = perf.frames = perf.holds = 0;
    perf.ticks = perf.steps = perf.snapsOut = 0;
  }

  // ---------- 渲染迴圈 ----------
  // 可見時由 rAF 驅動，提供平順的畫面更新；背景時瀏覽器會自動暫停 rAF，
  // 此時改由 logicTick 的後備渲染接手。
  function renderLoop() {
    if (!running) return;
    draw();
    rafId = requestAnimationFrame(renderLoop);
  }

  // ---------- 結算 ----------
  function hostGameover() {
    gameoverSent = true;
    stopLoop();
    input.disable();
    const isBoss = gameState.mode === 'boss';
    const bossResult = isBoss ? (gameState.bossResult || (gameState.roundPhase === 'victory' ? 'victory' : 'defeat')) : undefined;
    const bossRound = isBoss ? gameState.round : undefined;
    const winner = gameState.winner ? gameState.players[gameState.winner] : null;
    const winnerName = winner ? winner.name : null;
    const winnerTeam = gameState.winnerTeam || 0;
    const players = Object.values(gameState.players)
      .filter((p: any) => !p.ownerId && (!isBoss || p.team === 1))
      .map((p: any) => ({ name: p.name, charId: p.charId, kills: p.kills, team: p.team || 0 }));
    const bossStats = isBoss ? buildBossStats(gameState) : undefined;
    const bossMode = isBoss ? (gameState.bossMode || 'campaign') : undefined;
    const bossName = isBoss ? getBossForRound(gameState.round)?.name : undefined;
    net.broadcast({ t: 'gameover', winner: winnerName, winnerTeam, players, bossResult, bossRound, bossStats, bossMode, bossName });
    showGameover({ winnerName, winnerTeam, players, isHost: true, bossResult, bossRound, bossStats, bossMode, bossName } as GameOverView);
  }

  function joinerGameover(data: any) {
    stopLoop();
    input.disable();
    showGameover({ winnerName: data.winner, winnerTeam: data.winnerTeam || 0, players: data.players, isHost: false, bossResult: data.bossResult, bossRound: data.bossRound, bossStats: data.bossStats, bossMode: data.bossMode, bossName: data.bossName } as GameOverView);
  }

  function showGameover(viewData: GameOverView) {
    emit('phase', 'gameover');
    emit('gameover', viewData);
  }

  // ---------- React 對外 API ----------
  function createRoom(name: string) {
    myName = name;
    role = 'host';
    roomCode = makeRoomCode();
    setupHost();
    emit('menuStatus', '建立房間中…', false);
    net.host(roomCode);
  }

  function joinRoom(name: string, code: string) {
    if (!code) { emit('menuStatus', '請輸入房號', true); return; }
    myName = name;
    role = 'joiner';
    roomCode = code;
    setupJoiner();
    emit('menuStatus', '連線中…', false);
    net.join(code);
  }

  function selectChar(charId: string) {
    selectedChar = charId;
    if (role === 'host') {
      const me = lobby.find((p) => p.id === selfId);
      if (me) { me.charId = charId; broadcastLobby(); }
    } else if (role === 'joiner') {
      net.sendToHost({ t: 'select', charId, controlScheme: selectedControlScheme });
    }
  }

  function selectControlScheme(scheme: ControlScheme) {
    selectedControlScheme = scheme;
    if (role === 'host') {
      const me = lobby.find((p) => p.id === selfId);
      if (me) { me.controlScheme = scheme; broadcastLobby(); }
    } else if (role === 'joiner') {
      net.sendToHost({ t: 'select', charId: selectedChar, controlScheme: scheme });
    }
  }

  function selectTeam(team: number) {
    selectedTeam = team | 0;
    if (role === 'host') {
      const me = lobby.find((p) => p.id === selfId);
      if (me) { me.team = selectedTeam; broadcastLobby(); }
    } else if (role === 'joiner') {
      net.sendToHost({ t: 'select', charId: selectedChar, controlScheme: selectedControlScheme, team: selectedTeam });
    }
  }

  function selectGameFlags(flags: GameFlags) {
    gameFlags = { ...flags };
    if (role === 'host') broadcastLobby();
  }

  function addNpc() {
    if (role !== 'host') return;
    if (lobby.length >= MAX_PLAYERS) return;
    const npcId = 'npc-' + Math.random().toString(36).slice(2, 8);
    const charId = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)].id;
    const npcNum = lobby.filter((p) => p.isNpc).length + 1;
    lobby.push({ id: npcId, name: `NPC ${npcNum}`, charId, controlScheme: 'wasd-jkl', isHost: false, isNpc: true, team: 0 });
    broadcastLobby();
  }

  function removeNpc() {
    if (role !== 'host') return;
    const lastNpc = [...lobby].reverse().find((p) => p.isNpc);
    if (!lastNpc) return;
    removeFromLobby(lastNpc.id);
    broadcastLobby();
  }

  function startGame() {
    if (role === 'host') hostStart();
  }

  // ---------- 開發者模式：直接進入遊戲（指定或隨機角色）----------
  function devStartGame(charId?: string) {
    const DEV_MODE = true;
    if (!DEV_MODE) return;

    // 設定為房主
    myName = 'Dev Player';
    role = 'host';
    selfId = 'dev-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'DEV';

    // 生成隨機玩家（2-4個角色）
    const numPlayers = Math.floor(Math.random() * 3) + 2; // 2-4 players
    const allCharIds = CHARACTERS.map((c) => c.id); // 角色 slug 清單
    const randomCharId = () => allCharIds[Math.floor(Math.random() * allCharIds.length)];
    lobby = [];

    // 自己：使用指定的角色（slug）或隨機選取
    const charForSelf: string = (charId !== undefined && allCharIds.includes(charId)) ? charId : randomCharId();
    lobby.push({ id: selfId, name: myName, charId: charForSelf, controlScheme: selectedControlScheme, isHost: true, team: selectedTeam });

    // 其他玩家
    for (let i = 1; i < numPlayers; i++) {
      const randomChar = randomCharId();
      lobby.push({
        id: 'dev-' + i,
        name: `NPC ${i}`,
        charId: randomChar,
        controlScheme: 'wasd-jkl',
        isHost: false,
        isNpc: true,
        team: 0,
      });
    }

    selectedChar = charForSelf;
    emit('phase', 'game');
    wantLoop = true;
    hostStart();
  }

  // ---------- 開發者：直接進入闖關模式 (?dev=true&boss=true) ----------
  function devStartBoss(charId?: string, round = 1) {
    myName = 'Dev Player';
    role = 'host';
    selfId = 'dev-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'DEV';
    const all = CHARACTERS.map((c) => c.id); // 角色 slug 清單
    const randomCharId = () => all[Math.floor(Math.random() * all.length)];
    const me: string = (charId !== undefined && all.includes(charId)) ? charId : randomCharId();
    lobby = [{ id: selfId, name: myName, charId: me, controlScheme: selectedControlScheme, isHost: true, team: 1 }];
    for (let i = 1; i <= 2; i++) lobby.push({ id: 'dev-' + i, name: '隊友 ' + i, charId: randomCharId(), controlScheme: 'wasd-jkl', isHost: false, isNpc: true, team: 1 });
    selectedChar = me; selectedTeam = 1;
    startBossSession(round, 'campaign');
  }

  // ---------- 練功房 / 傷害測試（單機本地：玩家 vs 不死木人，即時 DPS / 各技能輸出佔比）----------
  const TRAIN_DUMMY_ID = 'dummy';
  const TRAIN_DUMMY_HP = 1e9;

  // 非近戰角色當乾淨木人：避開「近戰受擊 ×0.85」與多數減傷天賦，給所有角色一致基準。
  function trainingDummyChar(): string {
    const c = CHARACTERS.find((x: any) => !x.meleeRole);
    return (c || CHARACTERS[0]).id;
  }

  function emitTrainingStats() {
    if (!gameState || gameState.mode !== 'training') return;
    const view = summarizeDps(gameState, selfId as string) || {
      elapsed: 0, total: 0, dps: 0, dmgTaken: 0, maxHit: 0, critCount: 0, skillUses: {}, perSkill: [],
    };
    const dummy = gameState.players[TRAIN_DUMMY_ID];
    const meP = gameState.players[selfId as string];
    emit('trainingStats', {
      ...view,
      charId: selectedChar,
      charName: (meP && meP.name) || '',
      retaliate: !!(dummy && dummy.isNpc),
    } as any);
  }

  function startTraining(charId?: string, opts: { retaliate?: boolean } = {}) {
    myName = '練習';
    role = 'host';
    selfId = 'train-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'TRAIN';
    const me: string = charId && CHARACTERS.some((c: any) => c.id === charId) ? charId : selectedChar;
    selectedChar = me;
    lobby = [{ id: selfId, name: myName, charId: me, controlScheme: selectedControlScheme, isHost: true, team: 1 }];

    gameState = createInitialState([{ id: selfId, name: myName, charId: me, team: 1 }], gameFlags, { mode: 'training' });

    // 木人樁：team 2、巨血、置於玩家右側。預設靜止承傷；retaliate=true 交給 NPC AI 還手。
    const cx = ARENA.width / 2, cy = ARENA.height / 2;
    const dummy = makePlayer(TRAIN_DUMMY_ID, '木人樁', trainingDummyChar(), cx + 170, cy, 2);
    dummy.maxHp = TRAIN_DUMMY_HP; dummy.hp = TRAIN_DUMMY_HP;
    dummy.isDummy = true;
    if (opts.retaliate) dummy.isNpc = true;
    gameState.players[TRAIN_DUMMY_ID] = dummy;
    gameState.trainingDummyId = TRAIN_DUMMY_ID;
    gameState.trainingDummyX = cx + 170;
    gameState.trainingDummyY = cy;

    const meP = gameState.players[selfId];
    if (meP) { meP.x = cx; meP.y = cy; meP.facing = 0; }

    setupStats(gameState);
    for (const id of Object.keys(gameState.players)) inputs[id] = { ...EMPTY_INPUT };
    trainEmitAcc = 0;
    beginLoop();
    emitTrainingStats();
  }

  function resetTrainingStats() {
    if (role !== 'host' || !gameState || gameState.mode !== 'training') return;
    setupStats(gameState); // 重建 perPlayer/perSkill，runStart=當前 time（歸零累計）
    emitTrainingStats();
  }

  function setTrainingRetaliate(on: boolean) {
    if (!gameState || gameState.mode !== 'training') return;
    const d = gameState.players[TRAIN_DUMMY_ID];
    if (!d) return;
    d.isNpc = !!on;
    if (!on) { inputs[TRAIN_DUMMY_ID] = { ...EMPTY_INPUT }; d.effects = {}; d.x = ARENA.width / 2 + 170; d.y = ARENA.height / 2; }
    emitTrainingStats();
  }

  function quitTraining() {
    stopLoop();
    input.disable();
    gameState = null;
    emit('trainingStats', null as any);
    emit('phase', 'menu');
  }

  function bossRetry() {
    if (role !== 'host' || !gameState) return;
    retryBossRound(gameState);
  }

  function bossQuit() {
    if (role !== 'host' || !gameState) return;
    quitBossRun(gameState);
  }

  function returnToLobby() {
    if (role !== 'host') return;
    stopLoop();
    gameState = null;
    net.broadcast({ t: 'tolobby', players: lobby });
    emit('phase', 'lobby');
    renderLobby();
  }

  function leave() {
    net.destroy();
    window.location.reload();
  }

  // ---------- Canvas 生命週期 (由 GameScreen 掛載/卸載呼叫) ----------
  function attachCanvas(canvas: HTMLCanvasElement) {
    if (renderer && canvasEl === canvas) { maybeStartLoop(); return; }
    canvasEl = canvas;
    renderer = createRenderer(canvas, selectedControlScheme, {
      isHost: () => role === 'host',
      onBossRetry: bossRetry,
      onBossQuit: bossQuit,
      input,
    });
    camera.bindViewControls();
    maybeStartLoop();
  }

  function detachCanvas() {
    stopLoop();
    input.disable();
    renderer?.dispose?.();
    renderer = null;
    canvasEl = null;
  }

  // 自身朝向：camera 進入視角模式時用來初始化鏡頭方向。host 取權威 state，joiner 取預測值。
  function selfFacing(): number {
    const me: any = role === 'host' ? (gameState && gameState.players[selfId as string]) : prediction.getLocalSelf();
    return me && typeof me.facing === 'number' ? me.facing : 0;
  }

  return {
    on,
    createRoom,
    joinRoom,
    selectChar,
    selectControlScheme,
    selectTeam,
    selectGameFlags,
    addNpc,
    removeNpc,
    startGame,
    startBossGame,
    startBossChallenge,
    devStartGame,
    devStartBoss,
    startTraining,
    resetTrainingStats,
    setTrainingRetaliate,
    quitTraining,
    returnToLobby,
    bossRetry,
    bossQuit,
    leave,
    get isHost() { return role === 'host'; },
    attachCanvas,
    detachCanvas,
    get selectedChar() { return selectedChar; },
  };
}

// 模組單例：整個 App 共用同一個 controller。
let instance: GameController | null = null;
export function getController(): GameController {
  if (!instance) instance = createController();
  return instance;
}
