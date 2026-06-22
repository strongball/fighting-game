// PeerJS P2P 包裝：房主星狀拓撲 (所有加入者只連房主)
// 房主 peer.id = 房號；加入者 peer.connect(房號)。
// 訊息透過 reliable DataConnection 傳遞 (JSON 物件)。

import { Peer } from 'peerjs';

const HANDLER_NAMES = ['onOpen', 'onJoin', 'onLeave', 'onData', 'onError', 'onHostClose'];

export function createNetwork() {
  let peer = null;
  let isHost = false;
  let selfId = null;
  const conns = new Map();     // peerId -> 可靠 DataConnection (房主用：大廳/開始/輸入/結算)
  const snapConns = new Map(); // peerId -> 不可靠 DataConnection (房主用：state 快照,latest-wins)
  let hostConn = null;         // 加入者用：可靠通道
  let hostSnapConn = null;     // 加入者用：不可靠通道 (只收快照)

  const handlers = {};
  for (const n of HANDLER_NAMES) handlers[n] = () => {};

  function host(roomId) {
    isHost = true;
    peer = new Peer(roomId, { debug: 1 });
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

  function join(roomId) {
    isHost = false;
    peer = new Peer(undefined, { debug: 1 });
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
