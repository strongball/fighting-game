// PeerJS P2P 包裝：房主星狀拓撲 (所有加入者只連房主)
// 房主 peer.id = 房號；加入者 peer.connect(房號)。
// 訊息透過 reliable DataConnection 傳遞 (JSON 物件)。

import { Peer } from 'peerjs';

const HANDLER_NAMES = ['onOpen', 'onJoin', 'onLeave', 'onData', 'onError', 'onHostClose'];

// Cloudflare TURN：向自架的 Worker 取「短效」ICE 憑證（STUN+TURN）。
// Worker 端持有 API token 動態簽發憑證，前端不接觸機密；此 endpoint 本就會被瀏覽器呼叫，公開無妨。
// 取不到時退回純 STUN（等同接 TURN 前的穿透水準，不造成回歸）。
const TURN_ENDPOINT = 'https://wispy-bird-e672.maxwellkuo47.workers.dev';
const STUN_FALLBACK = [{ urls: 'stun:stun.l.google.com:19302' }];

async function getIceServers() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000); // Worker 卡住不拖累建房/加入
    const r = await fetch(TURN_ENDPOINT, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return STUN_FALLBACK;
    const data = await r.json();
    return Array.isArray(data.iceServers) && data.iceServers.length ? data.iceServers : STUN_FALLBACK;
  } catch {
    return STUN_FALLBACK;
  }
}

export function createNetwork() {
  let peer = null;
  let isHost = false;
  let selfId = null;
  const conns = new Map();     // peerId -> 可靠 DataConnection (房主用：大廳/開始/輸入/結算)
  const snapConns = new Map(); // peerId -> 不可靠 DataConnection (房主用：state 快照,latest-wins)
  let hostConn = null;         // 加入者用：可靠通道
  let hostSnapConn = null;     // 加入者用：不可靠通道 (只收快照)
  let epoch = 0;               // 連線世代：host/join 取憑證的 await 空檔被 destroy/重連作廢時，丟棄過期建立

  const handlers = {};
  for (const n of HANDLER_NAMES) handlers[n] = () => {};

  async function host(roomId) {
    const myEpoch = ++epoch;
    isHost = true;
    const iceServers = await getIceServers();
    if (myEpoch !== epoch) return; // 取憑證期間已被 destroy 或另一次 host/join → 別建出孤兒 peer
    peer = new Peer(roomId, { debug: 1, config: { iceServers } });
    peer.on('open', (id) => { selfId = id; handlers.onOpen(id); });
    peer.on('connection', (conn) => setupHostConn(conn));
    peer.on('error', (err) => handlers.onError(err));
  }

  function setupHostConn(conn) {
    // 加入者會開兩條連線：label 'snap' = 不可靠快照通道；其餘 = 可靠控制通道。
    const isSnap = conn.label === 'snap';
    if (isSnap) {
      conn.on('open', () => { snapConns.set(conn.peer, conn); });
      conn.on('close', () => { snapConns.delete(conn.peer); });
      conn.on('error', () => { snapConns.delete(conn.peer); });
      return; // 快照通道只供房主下行送快照,不收上行資料,也不影響在場判定
    }
    conn.on('open', () => { conns.set(conn.peer, conn); });
    conn.on('data', (data) => handlers.onData(conn.peer, data));
    conn.on('close', () => { conns.delete(conn.peer); snapConns.delete(conn.peer); handlers.onLeave(conn.peer); });
    conn.on('error', () => { conns.delete(conn.peer); snapConns.delete(conn.peer); handlers.onLeave(conn.peer); });
  }

  async function join(roomId) {
    const myEpoch = ++epoch;
    isHost = false;
    const iceServers = await getIceServers();
    if (myEpoch !== epoch) return; // 同上：取憑證期間被作廢就放棄
    peer = new Peer(undefined, { debug: 1, config: { iceServers } });
    peer.on('open', (id) => {
      selfId = id;
      // 可靠通道：大廳/開始/輸入/結算等不可遺失的訊息
      hostConn = peer.connect(roomId, { reliable: true, label: 'ctrl' });
      hostConn.on('open', () => handlers.onOpen(id));
      hostConn.on('data', (data) => handlers.onData('host', data));
      hostConn.on('close', () => handlers.onHostClose());
      hostConn.on('error', (err) => handlers.onError(err));
      // 不可靠通道：只收 state 快照 (允許掉包/亂序,避開可靠通道的 head-of-line blocking)。
      // 此通道的 open/close/error 皆非致命：未就緒時房主會以可靠通道後備送出快照。
      hostSnapConn = peer.connect(roomId, { reliable: false, label: 'snap' });
      hostSnapConn.on('data', (data) => handlers.onData('host', data));
    });
    peer.on('error', (err) => handlers.onError(err));
  }

  function broadcast(obj) {
    for (const c of conns.values()) if (c.open) c.send(obj);
  }
  // 快照專用：優先走不可靠通道;若該加入者的快照通道尚未就緒,後備走可靠通道,確保不漏狀態。
  function broadcastSnapshot(obj) {
    for (const [pid, c] of conns) {
      const sc = snapConns.get(pid);
      if (sc && sc.open) sc.send(obj);
      else if (c.open) c.send(obj);
    }
  }
  function sendToHost(obj) {
    if (hostConn && hostConn.open) hostConn.send(obj);
  }
  function sendTo(peerId, obj) {
    const c = conns.get(peerId);
    if (c && c.open) c.send(obj);
  }

  function destroy() {
    epoch++; // 作廢任何進行中的 host/join（避免其 await 結束後又建出 peer）
    try { if (peer) peer.destroy(); } catch (e) { /* ignore */ }
    peer = null; hostConn = null; hostSnapConn = null; conns.clear(); snapConns.clear();
  }

  return {
    host, join, broadcast, broadcastSnapshot, sendToHost, sendTo, destroy,
    on(name, fn) { if (HANDLER_NAMES.includes(name)) handlers[name] = fn; },
    get isHost() { return isHost; },
    get id() { return selfId; },
    get connCount() { return conns.size; },
  };
}

// 產生易讀房號 (公開 broker 上需夠獨特，故加前綴)
export function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'fg-' + s;
}
