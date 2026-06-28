// 音效管理器（SFX）：以 Web Audio API 播放短音效，與背景音樂（audioManager，HTMLAudio）分離。
//
// 設計目標：
// - 低延遲、可重疊、可空間化（依本地玩家位置做距離衰減 + 左右聲道定位）。
// - 「丟檔即生效」慣例：play('<name>') 會載入 assets/sfx/<name>.wav，缺檔則靜音不報錯。
// - 純前端、全 renderer-side：不影響 simulation / network 的決定性。
// - 無 AudioContext（headless / 不支援）時全部 no-op，不丟例外。
//
// 觸發點（呼叫端）：
// - 腳步聲：renderer.js syncPlayers 依走路相位（models.js ud.phase 跨越 nπ）呼叫 playFootstep（隨機播一個腳步變體）。
// - 出手 / 受傷：renderer.js syncPlayers 依 cd 上跳 / hp 下降呼叫 play('swing'|'cast'|'dash'|'blink'|'ultimate'|'hurt')。
// - 命中 / 死亡：fxbus.js onSpawn 依 fx.type 'hit' / 'death' 呼叫 play。
//
// 命名慣例（public/assets/sfx/<name>.wav）：
//   footstep1 / footstep2 / footstep3（腳步變體，隨機播）、swing / cast / hit / hurt / death / ultimate / dash / blink / buff
//   外加每角色專屬：以該動作 vfx id 命名（如 warrior_grapple、fighter_ultimate），
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
  /** 距離衰減的最大半徑（世界單位）；超過則靜音。 */
  maxDistance?: number;
}

export interface SfxManager {
  /** 播放具名音效（慣例載入 assets/sfx/<name>.mp3 或 .wav）。缺檔靜音；可帶空間化 / 節流 / 回退。 */
  play(name: string, opts?: SfxPlayOptions): void;
  /** 播放一步腳步聲（從 footstep1/2/3 隨機選一 + 微隨機，較自然）。 */
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

// import.meta.env.BASE_URL 由 Vite 注入（對應 vite.config.ts 的 base '/fighting-game/'）。
// 目前所有音效資產皆為 .wav（程序化合成輸出）；故只嘗試 .wav，避免每名先打一發 .mp3 → 404 的浪費。
// 若日後加入 .mp3 正式音效，於陣列前面加回 'mp3' 即可（取第一個「能成功解碼」的）。
const BASE = import.meta.env.BASE_URL;
const SFX_EXTS = ['wav'];
const sfxUrl = (name: string, ext: string) => `${BASE}assets/sfx/${name}.${ext}`;

// 空間化參數（世界單位；座標系見 render3d/coords.js，場地中心約 600,400）。
const NEAR_DIST = 130; // 此半徑內全音量
const FAR_DIST = 1100; // 預設最大可聞半徑
const PAN_RANGE = 560; // 左右滿偏所需的水平距離

const MAX_VOICES = 24; // 同時最大聲部，避免爆音 / 過載

// 腳步變體（隨機播一）；依序載入存在的，缺檔自動跳過。
const FOOTSTEP_NAMES = ['footstep1', 'footstep2', 'footstep3'];
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
  masterGain.gain.value = 1.0;
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

    const p = decodeFirst(name)
      .then((buf) => {
        buffers.set(name, buf);
        loading.delete(name);
        return buf;
      })
      .catch(() => {
        buffers.set(name, null);
        loading.delete(name);
        return null;
      });
    loading.set(name, p);
    return p;
  }

  // 依 SFX_EXTS 順序 fetch + 解碼，回傳第一個「成功解碼」的 buffer，都不行→null。
  // 重要：dev server 對缺檔會以 index.html 回 200（SPA fallback），所以不能只看 res.ok——
  // 必須「真的解碼成功」才算數，否則 .mp3 缺檔會拿到 HTML 誤判成功而不再試 .wav（原 fallback bug）。
  async function decodeFirst(name: string): Promise<AudioBuffer | null> {
    for (const ext of SFX_EXTS) {
      try {
        const res = await fetch(sfxUrl(name, ext));
        if (!res.ok) continue;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) continue; // SPA fallback 回傳的 HTML，非音效
        const ab = await res.arrayBuffer();
        // decodeAudioData 不看副檔名、只看 bytes；HTML/損壞檔會丟例外→試下一個。
        return await audioCtx.decodeAudioData(ab);
      } catch {
        /* 此副檔名失敗 → 試下一個 */
      }
    }
    return null;
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

    src.start(0);
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

  // ---- 腳步聲：載入 footstep1/2/3 兩三個變體，每步隨機選一 + 微隨機音高/音量 ----
  const footBufs: AudioBuffer[] = [];
  let footReq = false;

  function ensureFootsteps(): void {
    if (footReq) return;
    footReq = true;
    for (const n of FOOTSTEP_NAMES) {
      load(n).then((buf) => { if (buf) footBufs.push(buf); });
    }
  }

  function playFootstep(opts: SfxPlayOptions = {}): void {
    if (muted) return;
    if (throttled(opts)) return;
    if (footBufs.length === 0) {
      ensureFootsteps(); // 尚未就緒：觸發載入，本步略過（避免首載延遲）
      return;
    }
    const buf = footBufs[(Math.random() * footBufs.length) | 0];
    const rate = 1 + (Math.random() * 2 - 1) * 0.08;  // ±8% 音高變化
    const volJitter = 1 + (Math.random() * 2 - 1) * 0.12; // ±12% 音量變化
    playBuffer(buf, {
      ...opts,
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
