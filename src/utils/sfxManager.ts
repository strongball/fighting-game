// 音效管理器（SFX）：以 Web Audio API 播放短音效，與背景音樂（audioManager，HTMLAudio）分離。
//
// 設計目標：
// - 低延遲、可重疊、可空間化（依本地玩家位置做距離衰減 + 左右聲道定位）。
// - 「丟檔即生效」慣例：play('<name>') 會載入 `${BASE}assets/sfx/<name>.mp3`，缺檔則靜音不報錯。
// - 純前端、全 renderer-side：不影響 simulation / network 的決定性。
// - 無 AudioContext（headless / 不支援）時全部 no-op，不丟例外。
//
// 觸發點（呼叫端）：
// - 腳步聲：renderer.js syncPlayers 依走路相位（models.js ud.phase 跨越 nπ）呼叫 playFootstep。
// - 出手 / 受傷：renderer.js syncPlayers 依 cd 上跳 / hp 下降呼叫 play('swing'|'cast'|'dash'|'blink'|'ultimate'|'hurt')。
// - 命中 / 死亡：fxbus.js onSpawn 依 fx.type 'hit' / 'death' 呼叫 play。
//
// 命名慣例（public/assets/sfx/<name>.mp3）：
//   footstep / swing / cast / hit / hurt / death / ultimate / dash / blink / buff
//   外加每角色專屬：以該動作 vfx id 命名（如 warrior_grapple.mp3、fighter_ultimate.mp3），
//   缺檔時自動回退泛型名（play 的 fallback 參數）。

/// <reference types="vite/client" />

export interface SfxPlayOptions {
  /** 世界座標 X（用於距離衰減 + 立體聲定位）；省略則不空間化。 */
  x?: number;
  /** 世界座標 Y。 */
  y?: number;
  /** 音量倍率 0..1（預設 1）。 */
  volume?: number;
  /** 播放速率（預設 1）。 */
  rate?: number;
  /** 節流鍵：同一鍵在 minInterval 內只會發一次（避免機關槍）。 */
  throttleKey?: string;
  /** 節流最小間隔（秒）。 */
  minInterval?: number;
  /** 主音效缺檔時改用的回退名（用於每角色覆寫→泛型）。 */
  fallback?: string;
  /** 從緩衝區的此秒數開始播放（用於腳步切片）。 */
  offset?: number;
  /** 播放長度（秒，用於腳步切片）。 */
  duration?: number;
  /** 距離衰減的最大半徑（世界單位）；超過則靜音。 */
  maxDistance?: number;
}

export interface SfxManager {
  /** 播放具名音效（慣例載入 assets/sfx/<name>.mp3）。缺檔靜音；可帶空間化 / 節流 / 回退。 */
  play(name: string, opts?: SfxPlayOptions): void;
  /** 播放一步腳步聲（輪播 footstep.mp3 切出的單步片段 + 微隨機，較自然）。 */
  playFootstep(opts?: SfxPlayOptions): void;
  /** 設定聆聽者（本地玩家）世界座標，供空間化計算。 */
  setListener(x: number, y: number): void;
  /** 設定主音量 0..1。 */
  setMasterVolume(volume: number): void;
  /** 靜音 / 解除靜音。 */
  setMuted(muted: boolean): void;
  /** 預先載入一組音效名稱（非必要，純優化首次延遲）。 */
  preload(names: string[]): void;
  /** 嘗試解鎖 AudioContext（瀏覽器需使用者手勢；亦由內部首次手勢自動呼叫）。 */
  unlock(): void;
}

interface FootSegment {
  offset: number;
  duration: number;
}

// import.meta.env.BASE_URL 由 Vite 注入（對應 vite.config.ts 的 base '/fighting-game/'）。
const BASE = import.meta.env.BASE_URL;
const sfxUrl = (name: string) => `${BASE}assets/sfx/${name}.mp3`;

// 空間化參數（世界單位；座標系見 render3d/coords.js，場地中心約 600,400）。
const NEAR_DIST = 130; // 此半徑內全音量
const FAR_DIST = 1100; // 預設最大可聞半徑
const PAN_RANGE = 560; // 左右滿偏所需的水平距離

const MAX_VOICES = 24; // 同時最大聲部，避免爆音 / 過載

// 腳步切片預設
const FOOTSTEP_VOLUME = 0.42;
const FOOTSTEP_MAX_DIST = 780;

let instance: SfxManager | null = null;

export function getSfxManager(): SfxManager {
  if (!instance) instance = createSfxManager();
  return instance;
}

function createSfxManager(): SfxManager {
  let ctx: AudioContext | null = null;
  try {
    const AC =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (AC) ctx = new AC();
  } catch {
    ctx = null;
  }

  // ctx 不存在 → 回傳全 no-op 介面（headless / 不支援環境安全）。
  if (!ctx) {
    return {
      play() {},
      playFootstep() {},
      setListener() {},
      setMasterVolume() {},
      setMuted() {},
      preload() {},
      unlock() {},
    };
  }

  const audioCtx = ctx;
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.9;
  masterGain.connect(audioCtx.destination);

  let muted = false;
  let listenerX = 600;
  let listenerY = 400;
  let activeVoices = 0;

  // 緩衝區快取：AudioBuffer = 已載入；null = 已知缺檔（不再重試、靜音）。
  const buffers = new Map<string, AudioBuffer | null>();
  const loading = new Map<string, Promise<AudioBuffer | null>>();
  const lastPlayAt = new Map<string, number>();

  function load(name: string): Promise<AudioBuffer | null> {
    const cached = buffers.get(name);
    if (cached !== undefined) return Promise.resolve(cached);
    const inflight = loading.get(name);
    if (inflight) return inflight;

    const p = fetch(sfxUrl(name))
      .then((res) => {
        if (!res.ok) throw new Error(`sfx ${name} ${res.status}`);
        return res.arrayBuffer();
      })
      .then((ab) => audioCtx.decodeAudioData(ab))
      .then((buf) => {
        buffers.set(name, buf);
        loading.delete(name);
        return buf;
      })
      .catch(() => {
        // 缺檔 / 解碼失敗：快取 null（靜音），不報錯。
        buffers.set(name, null);
        loading.delete(name);
        return null;
      });
    loading.set(name, p);
    return p;
  }

  function throttled(opts?: SfxPlayOptions): boolean {
    if (!opts || !opts.throttleKey || !opts.minInterval) return false;
    const now = audioCtx.currentTime;
    const last = lastPlayAt.get(opts.throttleKey) ?? -Infinity;
    if (now - last < opts.minInterval) return true;
    lastPlayAt.set(opts.throttleKey, now);
    return false;
  }

  // 依聆聽者位置算 { vol, pan }；vol 0..1（距離衰減），pan -1..1（左右）。
  function spatial(x: number, y: number, maxDistance: number): { vol: number; pan: number } {
    const dx = x - listenerX;
    const dy = y - listenerY;
    const dist = Math.hypot(dx, dy);
    let vol: number;
    if (dist <= NEAR_DIST) vol = 1;
    else if (dist >= maxDistance) vol = 0;
    else vol = 1 - (dist - NEAR_DIST) / (maxDistance - NEAR_DIST);
    vol *= vol; // 較貼近聽感的衰減曲線
    const pan = Math.max(-1, Math.min(1, dx / PAN_RANGE));
    return { vol, pan };
  }

  function playBuffer(buf: AudioBuffer, opts: SfxPlayOptions): void {
    if (muted || activeVoices >= MAX_VOICES) return;

    let vol = opts.volume ?? 1;
    let pan = 0;
    let spatialized = false;
    if (opts.x !== undefined && opts.y !== undefined) {
      const s = spatial(opts.x, opts.y, opts.maxDistance ?? FAR_DIST);
      vol *= s.vol;
      pan = s.pan;
      spatialized = true;
      if (vol <= 0.001) return; // 太遠 → 不可聞，省略聲部
    }

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;

    const gain = audioCtx.createGain();
    gain.gain.value = vol;
    src.connect(gain);

    let panNode: StereoPannerNode | null = null;
    if (spatialized && typeof audioCtx.createStereoPanner === 'function') {
      panNode = audioCtx.createStereoPanner();
      panNode.pan.value = pan;
      gain.connect(panNode);
      panNode.connect(masterGain);
    } else {
      gain.connect(masterGain);
    }

    activeVoices++;
    src.onended = () => {
      activeVoices = Math.max(0, activeVoices - 1);
      try {
        src.disconnect();
        gain.disconnect();
        if (panNode) panNode.disconnect();
      } catch {
        /* 已斷開 */
      }
    };

    const offset = Math.max(0, opts.offset ?? 0);
    if (opts.duration !== undefined) src.start(0, offset, opts.duration);
    else src.start(0, offset);
  }

  function play(name: string, opts: SfxPlayOptions = {}): void {
    if (muted) return;
    if (throttled(opts)) return; // 節流只在最外層判定一次
    emit(name, opts);
  }

  // 載入並播放；主名缺檔且有 fallback → 回退泛型名（移除 fallback 後遞迴，至多一跳）。
  function emit(name: string, opts: SfxPlayOptions): void {
    load(name).then((buf) => {
      if (buf) {
        playBuffer(buf, opts);
        return;
      }
      const fb = opts.fallback;
      if (fb && fb !== name) {
        const rest: SfxPlayOptions = { ...opts };
        delete rest.fallback;
        delete rest.throttleKey;
        delete rest.minInterval;
        emit(fb, rest);
      }
    });
  }

  // ---- 腳步聲：分析 footstep.mp3 的能量包絡，切出各「單步」片段供輪播 ----
  let footSegs: FootSegment[] | null = null;
  let footBuf: AudioBuffer | null = null;
  let footReq = false;
  let footIdx = 0;

  function analyzeFootsteps(buf: AudioBuffer): FootSegment[] {
    const sr = buf.sampleRate;
    const ch = buf.numberOfChannels;
    const N = buf.length;
    if (N === 0) return [];

    // 單聲道混音
    const data = new Float32Array(N);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < N; i++) data[i] += d[i] / ch;
    }

    // 短時 RMS 能量包絡
    const hopSec = 0.005;
    const winSec = 0.02;
    const hop = Math.max(1, Math.floor(sr * hopSec));
    const win = Math.max(1, Math.floor(sr * winSec));
    const frames = Math.max(0, Math.floor((N - win) / hop));
    if (frames < 4) return [];
    const env = new Float32Array(frames);
    let maxEnv = 0;
    for (let f = 0; f < frames; f++) {
      const start = f * hop;
      let sum = 0;
      for (let i = 0; i < win; i++) {
        const s = data[start + i];
        sum += s * s;
      }
      const rms = Math.sqrt(sum / win);
      env[f] = rms;
      if (rms > maxEnv) maxEnv = rms;
    }
    if (maxEnv <= 0) return [];
    for (let f = 0; f < frames; f++) env[f] /= maxEnv;

    // onset 偵測：能量上升穿越門檻、且距上個 onset 至少 minGap
    const thr = 0.18;
    const minGapFrames = Math.max(1, Math.floor(0.14 / hopSec));
    const onsets: number[] = [];
    let last = -minGapFrames;
    for (let f = 1; f < frames; f++) {
      if (env[f] >= thr && env[f - 1] < thr && f - last >= minGapFrames) {
        onsets.push(f);
        last = f;
      }
    }

    const segs: FootSegment[] = [];
    const backoff = 0.012; // onset 前微退，保留起音
    for (let k = 0; k < onsets.length; k++) {
      const t = (onsets[k] * hop) / sr;
      const nextT = k + 1 < onsets.length ? (onsets[k + 1] * hop) / sr : t + 0.4;
      const offset = Math.max(0, t - backoff);
      let dur = Math.min(nextT - offset, 0.45);
      if (dur < 0.1) dur = 0.1;
      segs.push({ offset, duration: dur });
    }
    return segs;
  }

  function ensureFootsteps(): void {
    if (footReq) return;
    footReq = true;
    load('footstep').then((buf) => {
      if (!buf) return;
      footBuf = buf;
      let segs = analyzeFootsteps(buf);
      if (segs.length < 2) {
        // 分析不到多步 → 退回單一固定窗
        segs = [{ offset: 0, duration: Math.min(0.4, buf.duration) }];
      }
      footSegs = segs;
      // 開發時可確認切出的步數 / 時間點
      console.info(
        `[sfx] footstep 切片 ${segs.length} 段`,
        segs.map((s) => +s.offset.toFixed(3)),
      );
    });
  }

  function playFootstep(opts: SfxPlayOptions = {}): void {
    if (muted) return;
    if (throttled(opts)) return;
    if (!footBuf || !footSegs || footSegs.length === 0) {
      ensureFootsteps(); // 尚未就緒：觸發載入，本步略過（避免首載延遲爆音）
      return;
    }
    const seg = footSegs[footIdx % footSegs.length];
    footIdx++;
    const rate = 1 + (Math.random() * 2 - 1) * 0.06; // ±6% 音高變化
    const volJitter = 1 + (Math.random() * 2 - 1) * 0.1; // ±10% 音量變化
    playBuffer(footBuf, {
      ...opts,
      offset: seg.offset,
      duration: seg.duration,
      rate: opts.rate ?? rate,
      volume: (opts.volume ?? FOOTSTEP_VOLUME) * volJitter,
      maxDistance: opts.maxDistance ?? FOOTSTEP_MAX_DIST,
    });
  }

  function setListener(x: number, y: number): void {
    listenerX = x;
    listenerY = y;
  }

  function setMasterVolume(volume: number): void {
    masterGain.gain.value = Math.max(0, Math.min(1, volume));
  }

  function setMuted(value: boolean): void {
    muted = value;
  }

  function preload(names: string[]): void {
    for (const n of names) load(n);
  }

  function unlock(): void {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    ensureFootsteps();
  }

  // 首次使用者手勢自動解鎖（瀏覽器自動播放政策）。
  if (typeof window !== 'undefined') {
    const onGesture = () => {
      unlock();
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('keydown', onGesture);
    };
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
  }

  return {
    play,
    playFootstep,
    setListener,
    setMasterVolume,
    setMuted,
    preload,
    unlock,
  };
}
