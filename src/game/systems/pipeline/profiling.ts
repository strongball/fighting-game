type ProfileScope = 'player' | 'world';

interface ProfileEntry {
  total: number;
  calls: number;
  worst: number;
}

const PROFILE_ENABLED = typeof location !== 'undefined'
  && new URLSearchParams(location.search).get('perf') === '1';
function querySet(name: string) {
  return typeof location !== 'undefined'
    ? new Set(
        (new URLSearchParams(location.search).get(name) || '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
    : new Set<string>();
}

const DISABLED_SYSTEMS = typeof location !== 'undefined'
  ? querySet('disableSystem')
  : new Set<string>();
const TRACED_SYSTEMS = typeof location !== 'undefined'
  ? querySet('traceSystem')
  : new Set<string>();

const REPORT_INTERVAL_MS = 1000;
const entries = new Map<string, ProfileEntry>();
let lastReport = 0;
let disabledSystemsReported = false;
let tracedSystemsReported = false;

function nowMs() {
  return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
}

function record(scope: ProfileScope, id: string, elapsed: number) {
  const key = `${scope}:${id}`;
  const entry = entries.get(key) || { total: 0, calls: 0, worst: 0 };
  entry.total += elapsed;
  entry.calls++;
  if (elapsed > entry.worst) entry.worst = elapsed;
  entries.set(key, entry);
}

function reportIfDue() {
  const now = nowMs();
  if (lastReport === 0) {
    lastReport = now;
    return;
  }
  if (now - lastReport < REPORT_INTERVAL_MS) return;
  lastReport = now;

  const parts = [...entries.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 12)
    .map(([key, entry]) => `${key}=${entry.total.toFixed(2)}ms/${entry.calls}x worst=${entry.worst.toFixed(2)}ms`);

  entries.clear();
  if (parts.length) console.log(`[sim systems] ${parts.join(' ')}`);
}

function hasSystemMatch(set: Set<string>, scope: ProfileScope, id: string) {
  return set.has(id) || set.has(`${scope}:${id}`);
}

function isSystemTraced(scope: ProfileScope, id: string): boolean {
  if (TRACED_SYSTEMS.size === 0) return false;
  if (!tracedSystemsReported) {
    tracedSystemsReported = true;
    console.warn(`[sim systems] traced: ${[...TRACED_SYSTEMS].join(',')}`);
  }
  return hasSystemMatch(TRACED_SYSTEMS, scope, id);
}

export function profileSystem<T>(scope: ProfileScope, id: string, fn: () => T): T {
  const traced = isSystemTraced(scope, id);
  if (!PROFILE_ENABLED && !traced) return fn();
  const start = nowMs();
  try {
    return fn();
  } finally {
    const elapsed = nowMs() - start;
    if (PROFILE_ENABLED) {
      record(scope, id, elapsed);
      reportIfDue();
    }
    if (traced) console.log(`[sim trace] ${scope}:${id} ${elapsed.toFixed(3)}ms`);
  }
}

export function isSystemDisabled(scope: ProfileScope, id: string): boolean {
  if (DISABLED_SYSTEMS.size === 0) return false;
  if (!disabledSystemsReported) {
    disabledSystemsReported = true;
    console.warn(`[sim systems] disabled: ${[...DISABLED_SYSTEMS].join(',')}`);
  }
  return hasSystemMatch(DISABLED_SYSTEMS, scope, id);
}
