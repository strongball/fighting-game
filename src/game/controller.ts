// 遊戲 Controller：串接連線 / 模擬 / 渲染 / 輸入，並管理大廳與遊戲迴圈。
// 由 main.js 移植而來；原本對 ui.* 的呼叫改成對 React 發送事件（emit）。
//
// 重要：渲染器（three.js）延後到 React 把 canvas 掛上後（attachCanvas）才建立。
// 邏輯/網路維持 setInterval(30Hz) 驅動，渲染用 requestAnimationFrame，
// 並保留「rAF 超過 60ms 未跑就後備 draw()」的機制（勿用 document.hidden 包住渲染）。
//
// ── 架構 ───────────────────────────────────────────────────────────
// 單例（getController）。內部以閉包變數持有可變狀態（role/gameState/inputs/view…）：
// 刻意不拆成多檔，因狀態高度互相纏繞、且只有一個實例；分區以下列段落註解標示。
//   事件匯流排 / 大廳 / 連線回呼(host+joiner) / 開始遊戲 / 遊戲迴圈 / 預測插值 / 結算 / 開發者模式
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
import { createInitialState } from './entities.js';
import { CHARACTERS } from './characters.js';
import { getBossForRound } from './bosses.js';
import { startBossRound, retryBossRound, quitBossRun } from './bossMode.js';
import { step, applyMovement } from './simulation.ts';
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

export function serializeNetworkPlayer(p: any) {
  return {
    id: p.id, name: p.name, charId: p.charId,
    x: p.x, y: p.y, facing: p.facing, kvx: p.kvx, kvy: p.kvy,
    hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana,
    alive: p.alive, shield: p.shield, shieldTime: p.shieldTime, kills: p.kills,
    effects: p.effects, cd: p.cd, ult: p.ult, team: p.team, chargeState: p.chargeState,
    // 魔王/召喚物/部位渲染旗標
    isBoss: p.isBoss, isPart: p.isPart, isMinion: p.isMinion, isFake: p.isFake, isMirror: p.isMirror,
    ownerId: p.ownerId, partId: p.partId, partColor: p.partColor, scale: p.scale, reviveProg: p.reviveProg,
    // HUD/渲染額外線索：破綻窗口、相位機制覆寫、倒地判定 (aiId)、引導光束 (channel)
    aiId: p.aiId, channel: p.channel, recoverWindow: p.recoverWindow, recoverHeavy: p.recoverHeavy,
    phaseTagsOverride: p.phaseTagsOverride,
  };
}

export function serializeNetworkSnapshot(state: any) {
  const players: Record<string, any> = {};
  for (const id of Object.keys(state.players)) players[id] = serializeNetworkPlayer(state.players[id]);
  return {
    phase: state.phase, winner: state.winner, winnerTeam: state.winnerTeam, time: state.time,
    mode: state.mode, round: state.round, bossId: state.bossId,
    bossHp: state.bossHp, bossMaxHp: state.bossMaxHp,
    roundPhase: state.roundPhase, roundTimer: state.roundTimer, introDur: state.introDur,
    banner: state.banner, tethers: state.tethers, bossWipedRound: state.bossWipedRound,
    // 全滅面板只需要重打次數；不送整包 stats (會持續累積、且只在結算才完整用到)
    stats: state.stats ? { _retryCount: state.stats._retryCount || 0 } : null,
    players,
    // 投射物/區域/特效/可破壞物仍是渲染必需，原樣帶上 (數量少、生命短)
    projectiles: state.projectiles, zones: state.zones, fx: state.fx,
    destructibles: state.destructibles || [],
    items: state.items || [],
    timeAnchors: state.timeAnchors || [],
    timeAnchorRitual: state.timeAnchorRitual || null,
  };
}

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
  // 視角模式（本機視覺/操作，不進網路協定）：0=一般遠景 1=近景第三人稱 2=第一人稱，V 循環
  let viewMode = 0;
  let crosshairEl: HTMLDivElement | null = null;
  let chaseBound = false;

  let role: 'host' | 'joiner' | null = null;
  let selfId: string | null = null;
  let myName = '';
  let roomCode = '';
  let selectedChar = 0;
  let selectedControlScheme: ControlScheme = 'wasd-jkl';
  let selectedTeam = 0; // 0 = 單人；正數 = 組隊
  let gameFlags: GameFlags = { freeMana: false, noCooldown: false, noDamage: false, difficulty: 0.5 };
  let lobby: LobbyEntry[] = [];

  let gameState: any = null;       // 房主權威狀態
  const inputs: Record<string, any> = {}; // 房主：playerId -> input

  // 加入者用
  let lastSnapshot: any = null;
  let view: any = null;
  let localSelf: any = null;       // 本機自身移動預測
  // 快照時間緩衝：加入者在「最新快照之前 INTERP_DELAY 秒」的時間點,於兩個快照之間插值，
  // 讓遠端角色在 60fps 下完全滑順、且能吸收網路抖動 / 單包遺失 (緩衝內仍有資料可插)。
  const INTERP_DELAY = 0.10; // 渲染落後最新快照約 100ms
  let snapBuf: { recv: number; snap: any }[] = []; // recv = performance.now()/1000
  let lastSnapSeq = -1;            // 丟棄 unreliable 通道後到的舊/重複快照

  let running = false;
  let wantLoop = false;            // 想啟動迴圈但等待 canvas 掛上
  let gameoverSent = false;
  let accumulator = 0, snapAcc = 0, inputAcc = 0, snapSeq = 0;
  let lastLogic = 0;
  let lastRender = 0;
  let logicTimer: ReturnType<typeof setInterval> | null = null;
  let rafId: number | null = null;
  const perf = PERF ? makePerf() : null;

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
        addToLobby({ id: from, name: data.name, charId: data.charId | 0, controlScheme: data.controlScheme || 'wasd-jkl', isHost: false, team: data.team | 0 });
        broadcastLobby();
      } else if (data.t === 'select') {
        const p = lobby.find((x) => x.id === from);
        if (p) { p.charId = data.charId | 0; if (data.controlScheme) p.controlScheme = data.controlScheme; if (data.team != null) p.team = data.team | 0; broadcastLobby(); }
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
      else if (data.t === 'state') { receiveSnapshot(data.snapshot, data.seq); }
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
    lastSnapshot = state;
    view = emptyView();
    // 以初始狀態種子化快照緩衝,讓第一個 'state' 到達前就有遠端角色可插值
    snapBuf = [{ recv: performance.now() / 1000, snap: state }];
    lastSnapSeq = -1;
    const me = state.players[selfId as string];
    localSelf = me ? { x: me.x, y: me.y, facing: me.facing, kvx: 0, kvy: 0, charId: me.charId } : null;
    beginLoop();
  }

  function emptyView() {
    return { players: {}, projectiles: [], zones: [], fx: [], destructibles: [], items: [], timeAnchors: [], timeAnchorRitual: null, phase: 'playing', winner: null, time: 0 };
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
  }

  function stopLoop() {
    running = false;
    wantLoop = false;
    if (logicTimer) { clearInterval(logicTimer); logicTimer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    applyViewMode(0); // 離開戰鬥時回到一般遠景視角
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
      tickSelfPrediction(inp, dt); // 自身固定步預測；遠端插值改在 draw() 以 60fps 進行
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
    else { rendered = buildView(); if (rendered) renderer.render(rendered, selfId, view); } // 每幀重建插值視圖
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

  // ---------- 加入者：快照緩衝 + 自身預測 + 遠端插值 ----------
  function receiveSnapshot(snap: any, seq?: number) {
    const t0 = perf ? performance.now() : 0;
    // 不可靠通道可能後到舊包 / 重複：以 seq 丟棄非最新者 (沒帶 seq 的舊路徑則照收)
    if (seq != null) { if (seq <= lastSnapSeq) return; lastSnapSeq = seq; }
    lastSnapshot = snap;
    if (perf) {
      // stringify 僅近似封包 byte 數 (PeerJS 已 parse 成物件，拿不到原始 bytes)；分項看 fx/proj 佔比
      const s = JSON.stringify(snap); perf.snaps++; perf.bytes += s.length;
      if (s.length > perf.worstBytes) perf.worstBytes = s.length;
      perf.fxBytes += snap.fx ? JSON.stringify(snap.fx).length : 0;
      perf.projBytes += snap.projectiles ? JSON.stringify(snap.projectiles).length : 0;
      perf.recvMs += performance.now() - t0;
    }
    const recv = performance.now() / 1000;
    snapBuf.push({ recv, snap });
    // 只保留最近約 1 秒,避免無限成長
    const cut = recv - 1.0;
    while (snapBuf.length > 2 && snapBuf[0].recv < cut) snapBuf.shift();
    // 自身位置校正 (server reconciliation)：把預測拉回權威值,死亡則直接對齊
    if (localSelf && snap.players[selfId as string]) {
      const me = snap.players[selfId as string];
      const blend = me.alive ? 0.2 : 1;
      localSelf.x += (me.x - localSelf.x) * blend;
      localSelf.y += (me.y - localSelf.y) * blend;
      localSelf.kvx = me.kvx; localSelf.kvy = me.kvy;
    }
  }

  // 自身移動固定步預測 (與輸入同頻;遠端不在此處)
  function tickSelfPrediction(inp: any, dt: number) {
    const snap = lastSnapshot;
    if (!snap || !localSelf) return;
    const me = snap.players[selfId as string];
    if (me && me.alive) {
      const tmp = { charId: localSelf.charId, x: localSelf.x, y: localSelf.y, vx: 0, vy: 0, kvx: localSelf.kvx, kvy: localSelf.kvy, facing: localSelf.facing, effects: me.effects };
      const diff = (lastSnapshot?.flags?.difficulty ?? 0.5) as number;
      applyMovement(tmp as any, inp, dt, diff);
      localSelf.x = tmp.x; localSelf.y = tmp.y; localSelf.facing = tmp.facing;
      localSelf.kvx = tmp.kvx; localSelf.kvy = tmp.kvy;
    } else if (me) {
      localSelf.x = me.x; localSelf.y = me.y;
    }
  }

  // 找出夾住 renderTime 的兩個快照 (供線性插值)；緩衝不足/枯竭時夾在端點 (hold)
  function findBracket(rt: number): { a: any; b: any; alpha: number } | null {
    if (snapBuf.length === 0) return null;
    let i = -1;
    for (let k = 0; k < snapBuf.length; k++) { if (snapBuf[k].recv <= rt) i = k; else break; }
    if (i < 0) return { a: snapBuf[0].snap, b: snapBuf[0].snap, alpha: 0 };          // rt 比最舊還舊
    if (i >= snapBuf.length - 1) {                                                    // rt 超過最新 → hold 最新
      const last = snapBuf[snapBuf.length - 1].snap; return { a: last, b: last, alpha: 0 };
    }
    const A = snapBuf[i], B = snapBuf[i + 1];
    const span = B.recv - A.recv;
    const alpha = span > 1e-6 ? (rt - A.recv) / span : 0;
    return { a: A.snap, b: B.snap, alpha: Math.max(0, Math.min(1, alpha)) };
  }

  // 每幀 (60fps) 由 draw() 呼叫：頂層欄位取最新快照,遠端玩家在時間緩衝內插值,自身用預測值
  function buildView() {
    const latest = lastSnapshot;
    if (!latest) return null;
    const t0 = perf ? performance.now() : 0;
    if (!view) view = emptyView();
    // 頂層 (HUD / 過場動畫 / 動態物件) 一律取最新快照
    view.phase = latest.phase; view.winner = latest.winner; view.time = latest.time;
    view.mode = latest.mode; view.round = latest.round; view.bossId = latest.bossId;
    view.bossHp = latest.bossHp; view.bossMaxHp = latest.bossMaxHp;
    view.roundPhase = latest.roundPhase; view.banner = latest.banner; view.tethers = latest.tethers;
    view.introDur = latest.introDur; view.roundTimer = latest.roundTimer;
    view.bossWipedRound = latest.bossWipedRound; view.stats = latest.stats;
    view.timeAnchors = latest.timeAnchors || [];
    view.timeAnchorRitual = latest.timeAnchorRitual || null;
    // 投射物/區域/特效/可破壞物：生命短、移動快,取最新即可 (插值意義不大)
    view.projectiles = latest.projectiles; view.zones = latest.zones;
    view.fx = latest.fx; view.destructibles = latest.destructibles || [];
    view.items = latest.items || [];

    const rt = performance.now() / 1000 - INTERP_DELAY;
    const pair = findBracket(rt);
    // hold = 緩衝枯竭 (rt 找不到夾住的兩包，只能定格最新)；數值高代表掉包/抖動 > 100ms 緩衝
    if (perf && pair && pair.a === pair.b) perf.holds++;
    const next: Record<string, any> = {};
    for (const id of Object.keys(latest.players)) {
      const sp = latest.players[id];
      const vp = view.players[id] || {};
      Object.assign(vp, sp); // 快照已精簡 → 直接覆蓋所有渲染欄位 (含 x/y/facing,下方再覆寫)
      if (id === selfId && localSelf) {
        vp.x = localSelf.x; vp.y = localSelf.y; vp.facing = localSelf.facing;
      } else if (pair) {
        const a = pair.a.players[id], b = pair.b.players[id];
        if (a && b) {
          // 瞬移/閃現：兩快照間位移過大時直接對齊終點,避免被插值成「滑行」而失去瞬移感
          if ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 > 160 * 160) {
            vp.x = b.x; vp.y = b.y; vp.facing = b.facing;
          } else {
            vp.x = a.x + (b.x - a.x) * pair.alpha;
            vp.y = a.y + (b.y - a.y) * pair.alpha;
            vp.facing = lerpAngle(a.facing, b.facing, pair.alpha);
          }
        } else if (b) { vp.x = b.x; vp.y = b.y; vp.facing = b.facing; }
        else if (a) { vp.x = a.x; vp.y = a.y; vp.facing = a.facing; }
      }
      next[id] = vp;
    }
    view.players = next;
    if (perf) { perf.builds++; const d = performance.now() - t0; perf.buildMs += d; if (d > perf.worstBuildMs) perf.worstBuildMs = d; }
    return view;
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

  function buildBossStats(state: any) {
    const stats = state.stats;
    if (!stats) return undefined;
    const perPlayer = Object.entries(stats.perPlayer || {}).map(([id, raw]: any) => ({
      id,
      name: raw.name,
      charId: raw.charId,
      dmgDealt: Math.round(raw.dmgDealt || 0),
      dmgTaken: Math.round(raw.dmgTaken || 0),
      healing: Math.round(raw.healing || 0),
      kills: raw.kills || 0,
      deaths: raw.deaths || 0,
      revives: raw.revives || 0,
      maxHit: Math.round(raw.maxHit || 0),
      critCount: raw.critCount || 0,
      ccApplied: raw.ccApplied || 0,
      skillUses: { basic: raw.skillUses?.basic || 0, skill1: raw.skillUses?.skill1 || 0, skill2: raw.skillUses?.skill2 || 0, ultimate: raw.skillUses?.ultimate || 0, evade: raw.skillUses?.evade || 0 },
    }));
    let mvpId: string | null = null;
    let mvpScore = -1;
    for (const p of perPlayer) {
      const score = p.dmgDealt + p.healing * 0.6 + p.revives * 80 + p.kills * 25;
      if (score > mvpScore) { mvpScore = score; mvpId = p.id; }
    }
    return {
      totalDuration: (state.time || 0) - (stats.runStart || 0),
      retryCount: stats._retryCount || 0,
      perRound: stats.perRound || [],
      perPlayer,
      mvpId,
    };
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
    const charId = Math.floor(Math.random() * CHARACTERS.length);
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
    const allCharIds = Array.from({ length: CHARACTERS.length }, (_, i) => i); // 0..N-1 characters
    lobby = [];

    // 自己：使用指定的角色或隨機選取
    let charForSelf: number;
    if (charId !== undefined && charId >= 0 && charId < CHARACTERS.length) {
      charForSelf = charId;
    } else {
      charForSelf = allCharIds[Math.floor(Math.random() * allCharIds.length)];
    }
    lobby.push({ id: selfId, name: myName, charId: charForSelf, controlScheme: selectedControlScheme, isHost: true, team: selectedTeam });

    // 其他玩家
    for (let i = 1; i < numPlayers; i++) {
      const randomChar = allCharIds[Math.floor(Math.random() * allCharIds.length)];
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
  function devStartBoss(charId?: number, round = 1) {
    myName = 'Dev Player';
    role = 'host';
    selfId = 'dev-' + Math.random().toString(36).slice(2, 9);
    roomCode = 'DEV';
    const all = Array.from({ length: CHARACTERS.length }, (_, i) => i);
    const me = (charId !== undefined && charId >= 0 && charId < CHARACTERS.length) ? charId : all[Math.floor(Math.random() * all.length)];
    lobby = [{ id: selfId, name: myName, charId: me, controlScheme: selectedControlScheme, isHost: true, team: 1 }];
    for (let i = 1; i <= 2; i++) lobby.push({ id: 'dev-' + i, name: '隊友 ' + i, charId: all[Math.floor(Math.random() * all.length)], controlScheme: 'wasd-jkl', isHost: false, isNpc: true, team: 1 });
    selectedChar = me; selectedTeam = 1;
    startBossSession(round, 'campaign');
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
    bindViewControls();
    maybeStartLoop();
  }

  function detachCanvas() {
    stopLoop();
    input.disable();
    renderer?.dispose?.();
    renderer = null;
    canvasEl = null;
  }

  // ---------- 視角模式：V 循環（0 遠景 → 1 近景三人稱 → 2 第一人稱）、滑鼠鎖定控視角、準心 ----------
  function ensureCrosshair() {
    if (crosshairEl || !canvasEl) return;
    const host = canvasEl.parentElement || document.body;
    const el = document.createElement('div');
    el.className = 'chase-crosshair';
    el.style.display = 'none';
    el.innerHTML = '<div class="chase-cross-dot"></div>';
    host.appendChild(el);
    crosshairEl = el;
  }

  function selfFacing(): number {
    const me: any = role === 'host' ? (gameState && gameState.players[selfId as string]) : localSelf;
    return me && typeof me.facing === 'number' ? me.facing : 0;
  }

  function applyViewMode(mode: number) {
    mode = ((mode % 3) + 3) % 3;
    if (mode === viewMode) return;
    const wasNormal = viewMode === 0;
    viewMode = mode;
    if (mode !== 0) {
      ensureCrosshair();
      // 由遠景進入時以自身朝向初始化視角；近景預設稍俯視、第一人稱平視（模式間切換則保留視角）
      if (wasNormal) input.setLook(selfFacing(), mode === 1 ? -0.35 : 0);
      input.setViewMode(mode);
      if (crosshairEl) crosshairEl.style.display = 'flex';
      if (!document.pointerLockElement) canvasEl?.requestPointerLock?.();
    } else {
      input.setViewMode(0);
      if (crosshairEl) crosshairEl.style.display = 'none';
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  function bindViewControls() {
    if (chaseBound) return;
    chaseBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && running && !e.repeat) { e.preventDefault(); applyViewMode(viewMode + 1); }
    });
    // 視角模式下若滑鼠未鎖定，點「畫布」重新鎖定（限定 canvas，避免點選單/按鈕時誤搶游標）
    window.addEventListener('mousedown', (e) => {
      if (viewMode !== 0 && running && !document.pointerLockElement && e.target === canvasEl) canvasEl?.requestPointerLock?.();
    });
    // 鎖定被解除（Esc/切窗）時更新準心提示樣式
    document.addEventListener('pointerlockchange', () => {
      if (crosshairEl) crosshairEl.classList.toggle('unlocked', viewMode !== 0 && !document.pointerLockElement);
    });
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

// 角度插值 (走最短弧,避免 ±π 邊界瞬轉)
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// 模組單例：整個 App 共用同一個 controller。
let instance: GameController | null = null;
export function getController(): GameController {
  if (!instance) instance = createController();
  return instance;
}
