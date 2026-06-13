// 遊戲 Controller：串接連線 / 模擬 / 渲染 / 輸入，並管理大廳與遊戲迴圈。
// 由 main.js 移植而來；原本對 ui.* 的呼叫改成對 React 發送事件（emit）。
//
// 重要：渲染器（three.js）延後到 React 把 canvas 掛上後（attachCanvas）才建立。
// 邏輯/網路維持 setInterval(30Hz) 驅動，渲染用 requestAnimationFrame，
// 並保留「rAF 超過 60ms 未跑就後備 draw()」的機制（勿用 document.hidden 包住渲染）。

import { createRenderer } from './renderer.js';
import { createNetwork, makeRoomCode } from './network.js';
import { createInput, EMPTY_INPUT } from './input.js';
import { createInitialState } from './entities.js';
import { step, applyMovement } from './simulation.js';
import { DT, SNAPSHOT_INTERVAL, INPUT_INTERVAL, MAX_PLAYERS } from './constants.js';
import type {
  ControllerEvents,
  ControlScheme,
  GameController,
  GameFlags,
  GameOverView,
  LobbyEntry,
  LobbyView,
} from '../types';

function createController(): GameController {
  // ---------- 事件匯流排 (Controller → React) ----------
  const listeners: { [K in keyof ControllerEvents]: Set<ControllerEvents[K]> } = {
    phase: new Set(),
    lobby: new Set(),
    menuStatus: new Set(),
    lobbyStatus: new Set(),
    gameover: new Set(),
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
  let selectedChar = 0;
  let selectedControlScheme: ControlScheme = 'wasd-jkl';
  let gameFlags: GameFlags = { freeMana: false, noCooldown: false, noDamage: false };
  let lobby: LobbyEntry[] = [];

  let gameState: any = null;       // 房主權威狀態
  const inputs: Record<string, any> = {}; // 房主：playerId -> input

  // 加入者用
  let lastSnapshot: any = null;
  let view: any = null;
  let localSelf: any = null;       // 本機自身移動預測

  let running = false;
  let wantLoop = false;            // 想啟動迴圈但等待 canvas 掛上
  let gameoverSent = false;
  let accumulator = 0, snapAcc = 0, inputAcc = 0;
  let lastLogic = 0;
  let lastRender = 0;
  let logicTimer: ReturnType<typeof setInterval> | null = null;
  let rafId: number | null = null;

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
      addToLobby({ id, name: myName, charId: selectedChar, controlScheme: selectedControlScheme, isHost: true });
      emit('phase', 'lobby');
      renderLobby();
    });
    net.on('onData', (from: string, data: any) => {
      if (data.t === 'hello') {
        if (lobby.length >= MAX_PLAYERS) { net.sendTo(from, { t: 'full' }); return; }
        addToLobby({ id: from, name: data.name, charId: data.charId | 0, controlScheme: data.controlScheme || 'wasd-jkl', isHost: false });
        broadcastLobby();
      } else if (data.t === 'select') {
        const p = lobby.find((x) => x.id === from);
        if (p) { p.charId = data.charId | 0; if (data.controlScheme) p.controlScheme = data.controlScheme; broadcastLobby(); }
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
      net.sendToHost({ t: 'hello', name: myName, charId: selectedChar, controlScheme: selectedControlScheme });
      emit('lobbyStatus', '已連上房主，等待開始…');
    });
    net.on('onData', (_from: string, data: any) => {
      if (data.t === 'lobby') { lobby = data.players; if (data.gameFlags) gameFlags = data.gameFlags; renderLobby(); }
      else if (data.t === 'start') { lobby = data.lobby; startFromSnapshot(data.state); }
      else if (data.t === 'state') { receiveSnapshot(data.snapshot); }
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
    const arr = lobby.map((p) => ({ id: p.id, name: p.name, charId: p.charId }));
    gameState = createInitialState(arr, gameFlags);
    for (const id of Object.keys(gameState.players)) inputs[id] = { ...EMPTY_INPUT };
    net.broadcast({ t: 'start', state: gameState, lobby });
    beginLoop();
  }

  function startFromSnapshot(state: any) {
    lastSnapshot = state;
    view = emptyView();
    const me = state.players[selfId as string];
    localSelf = me ? { x: me.x, y: me.y, facing: me.facing, kvx: 0, kvy: 0, charId: me.charId } : null;
    beginLoop();
  }

  function emptyView() {
    return { players: {}, projectiles: [], zones: [], fx: [], phase: 'playing', winner: null, time: 0 };
  }

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
  }

  function stopLoop() {
    running = false;
    wantLoop = false;
    if (logicTimer) { clearInterval(logicTimer); logicTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
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
      inputs[selfId as string] = inp;
      accumulator += dt;
      let guard = 0;
      while (accumulator >= DT && guard < 8) { step(gameState, inputs, DT); accumulator -= DT; guard++; }

      snapAcc += dt;
      if (snapAcc >= SNAPSHOT_INTERVAL) { snapAcc = 0; net.broadcast({ t: 'state', snapshot: gameState }); }

      if (gameState.phase === 'gameover' && !gameoverSent) hostGameover();
    } else {
      inputAcc += dt;
      if (inputAcc >= INPUT_INTERVAL) { inputAcc = 0; net.sendToHost({ t: 'input', input: inp }); }
      predictAndInterpolate(inp, dt);
    }

    // 後備渲染：若 requestAnimationFrame 因分頁被視為隱藏而暫停，
    // 仍以邏輯頻率補畫一幀，避免某些內嵌瀏覽器出現黑畫面。
    if (now - lastRender > 60) draw();
  }

  function draw() {
    if (!renderer) return;
    lastRender = performance.now();
    if (role === 'host') { if (gameState) renderer.render(gameState, selfId); }
    else if (view) renderer.render(view, selfId);
  }

  // ---------- 渲染迴圈 ----------
  // 可見時由 rAF 驅動，提供平順的畫面更新；背景時瀏覽器會自動暫停 rAF，
  // 此時改由 logicTick 的後備渲染接手。
  function renderLoop() {
    if (!running) return;
    draw();
    rafId = requestAnimationFrame(renderLoop);
  }

  // ---------- 加入者：預測 + 插值 ----------
  function receiveSnapshot(snap: any) {
    lastSnapshot = snap;
    if (localSelf && snap.players[selfId as string]) {
      const me = snap.players[selfId as string];
      const blend = me.alive ? 0.2 : 1; // 死亡直接對齊
      localSelf.x += (me.x - localSelf.x) * blend;
      localSelf.y += (me.y - localSelf.y) * blend;
      localSelf.kvx = me.kvx; localSelf.kvy = me.kvy;
    }
  }

  function predictAndInterpolate(inp: any, dt: number) {
    const snap = lastSnapshot;
    if (!snap || !view) return;
    view.phase = snap.phase; view.winner = snap.winner; view.time = snap.time;

    const k = 1 - Math.exp(-14 * dt); // 遠端玩家位置平滑
    const next: Record<string, any> = {};
    for (const id of Object.keys(snap.players)) {
      const sp = snap.players[id];
      let vp = view.players[id];
      if (!vp) vp = { ...sp };
      Object.assign(vp, {
        id: sp.id, name: sp.name, charId: sp.charId, facing: sp.facing,
        hp: sp.hp, maxHp: sp.maxHp, mana: sp.mana, maxMana: sp.maxMana,
        alive: sp.alive, shield: sp.shield, kills: sp.kills, effects: sp.effects, cd: sp.cd,
      });
      if (id === selfId && localSelf) {
        vp.x = localSelf.x; vp.y = localSelf.y; vp.facing = localSelf.facing;
      } else {
        vp.x += (sp.x - vp.x) * k;
        vp.y += (sp.y - vp.y) * k;
      }
      next[id] = vp;
    }
    view.players = next;
    view.projectiles = snap.projectiles;
    view.zones = snap.zones;
    view.fx = snap.fx;

    // 預測自身移動
    if (localSelf) {
      const me = snap.players[selfId as string];
      if (me && me.alive) {
        const tmp = { charId: localSelf.charId, x: localSelf.x, y: localSelf.y, vx: 0, vy: 0, kvx: localSelf.kvx, kvy: localSelf.kvy, facing: localSelf.facing, effects: me.effects };
        applyMovement(tmp, inp, dt);
        localSelf.x = tmp.x; localSelf.y = tmp.y; localSelf.facing = tmp.facing;
        localSelf.kvx = tmp.kvx; localSelf.kvy = tmp.kvy;
      } else if (me) {
        localSelf.x = me.x; localSelf.y = me.y;
      }
    }
  }

  // ---------- 結算 ----------
  function hostGameover() {
    gameoverSent = true;
    stopLoop();
    input.disable();
    const winner = gameState.winner ? gameState.players[gameState.winner] : null;
    const winnerName = winner ? winner.name : null;
    const players = Object.values(gameState.players).map((p: any) => ({ name: p.name, charId: p.charId, kills: p.kills }));
    net.broadcast({ t: 'gameover', winner: winnerName, players });
    showGameover({ winnerName, players, isHost: true });
  }

  function joinerGameover(data: any) {
    stopLoop();
    input.disable();
    showGameover({ winnerName: data.winner, players: data.players, isHost: false });
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

  function selectChar(charId: number) {
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

  function selectGameFlags(flags: GameFlags) {
    gameFlags = { ...flags };
    if (role === 'host') broadcastLobby();
  }

  function startGame() {
    if (role === 'host') hostStart();
  }

  // ---------- 開發者模式：直接進入遊戲（指定或隨機角色）----------
  function devStartGame(charId?: number) {
    const DEV_MODE = true;
    if (!DEV_MODE) return;

    // 設定為房主
    myName = 'Dev Player';
    role = 'host';
    selfId = 'dev-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'DEV';

    // 生成隨機玩家（2-4個角色）
    const numPlayers = Math.floor(Math.random() * 3) + 2; // 2-4 players
    const allCharIds = Array.from({ length: 10 }, (_, i) => i); // 0-9 characters
    lobby = [];

    // 自己：使用指定的角色或隨機選取
    let charForSelf: number;
    if (charId !== undefined && charId >= 0 && charId < 10) {
      charForSelf = charId;
    } else {
      charForSelf = allCharIds[Math.floor(Math.random() * allCharIds.length)];
    }
    lobby.push({ id: selfId, name: myName, charId: charForSelf, controlScheme: selectedControlScheme, isHost: true });

    // 其他玩家
    for (let i = 1; i < numPlayers; i++) {
      const randomChar = allCharIds[Math.floor(Math.random() * allCharIds.length)];
      lobby.push({
        id: 'dev-' + i,
        name: `NPC ${i}`,
        charId: randomChar,
        controlScheme: 'wasd-jkl',
        isHost: false,
      });
    }

    selectedChar = charForSelf;
    emit('phase', 'game');
    wantLoop = true;
    hostStart();
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
    renderer = createRenderer(canvas, selectedControlScheme);
    maybeStartLoop();
  }

  function detachCanvas() {
    stopLoop();
    input.disable();
    renderer = null;
    canvasEl = null;
  }

  return {
    on,
    createRoom,
    joinRoom,
    selectChar,
    selectControlScheme,
    selectGameFlags,
    startGame,
    devStartGame,
    returnToLobby,
    leave,
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
