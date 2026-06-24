// 加入者（joiner）端的「快照緩衝 + 自身預測 + 遠端插值」。
//
// 從 controller 抽出：這整塊是 joiner 專屬、狀態自成一格（snapBuf / lastSnapshot / localSelf），
// 與大廳/迴圈/連線核心耦合很低，獨立成模組後 netplay 平順度相關調整不再撞 controller 主檔。
//
// 用法：const pred = createPrediction({ getSelfId, perf });
//   收到 'start'   → pred.initFromSnapshot(state)
//   收到 'state'   → pred.receiveSnapshot(snap, seq)
//   logicTick     → pred.tickSelfPrediction(inp, dt)   // 自身固定步預測
//   draw (60fps)  → pred.buildView()                   // 遠端在時間緩衝內插值
//   camera 朝向   → pred.getLocalSelf()

import { applyMovement } from '../simulation.ts';

interface PredictionDeps {
  getSelfId: () => string | null;
  perf: any | null;
}

// 角度插值（走最短弧，避免 ±π 邊界瞬轉）。
function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function emptyView() {
  return { players: {}, projectiles: [], zones: [], fx: [], destructibles: [], items: [], timeAnchors: [], timeAnchorRitual: null, phase: 'playing', winner: null, time: 0 };
}

export function createPrediction({ getSelfId, perf }: PredictionDeps) {
  let lastSnapshot: any = null;
  let view: any = null;
  let localSelf: any = null; // 本機自身移動預測
  // 快照時間緩衝：加入者在「最新快照之前 INTERP_DELAY 秒」的時間點,於兩個快照之間插值，
  // 讓遠端角色在 60fps 下完全滑順、且能吸收網路抖動 / 單包遺失 (緩衝內仍有資料可插)。
  const INTERP_DELAY = 0.10; // 渲染落後最新快照約 100ms
  let snapBuf: { recv: number; snap: any }[] = []; // recv = performance.now()/1000
  let lastSnapSeq = -1; // 丟棄 unreliable 通道後到的舊/重複快照

  function getLocalSelf() { return localSelf; }

  // 收到 host 廣播的初始 state：種子化快照緩衝與自身預測狀態。
  function initFromSnapshot(state: any) {
    const selfId = getSelfId();
    lastSnapshot = state;
    view = emptyView();
    // 以初始狀態種子化快照緩衝,讓第一個 'state' 到達前就有遠端角色可插值
    snapBuf = [{ recv: performance.now() / 1000, snap: state }];
    lastSnapSeq = -1;
    const me = state.players[selfId as string];
    localSelf = me ? { x: me.x, y: me.y, facing: me.facing, kvx: 0, kvy: 0, charId: me.charId } : null;
  }

  function receiveSnapshot(snap: any, seq?: number) {
    const selfId = getSelfId();
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
    const selfId = getSelfId();
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
    const selfId = getSelfId();
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

  return { initFromSnapshot, receiveSnapshot, tickSelfPrediction, buildView, getLocalSelf };
}
