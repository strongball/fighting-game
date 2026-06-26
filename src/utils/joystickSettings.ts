export interface JoystickSettings {
  mode: 'fixed' | 'floating';
  scale: number;
}

const STORAGE_KEY = 'fg-joystick-settings';
const DEFAULTS: JoystickSettings = {
  mode: 'floating',
  scale: 1.0,
};

function clampScale(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.6, Math.min(2.0, n));
}

function loadSettings(): JoystickSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<JoystickSettings>;
    return {
      mode: parsed.mode === 'fixed' || parsed.mode === 'floating' ? parsed.mode : DEFAULTS.mode,
      scale: clampScale(parsed.scale, DEFAULTS.scale),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let state: JoystickSettings = loadSettings();
const subscribers = new Set<(s: JoystickSettings) => void>();

function persist(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* localStorage 不可用 → 略過 */
  }
}

export function getJoystickSettings(): JoystickSettings {
  return state;
}

export function subscribeJoystickSettings(cb: (s: JoystickSettings) => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function updateJoystickSettings(patch: Partial<JoystickSettings>): void {
  state = {
    ...state,
    ...patch,
    mode: patch.mode !== undefined ? patch.mode : state.mode,
    scale: patch.scale !== undefined ? clampScale(patch.scale, state.scale) : state.scale,
  };
  persist();
  subscribers.forEach((cb) => cb(state));
}
