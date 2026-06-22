import { addFx } from '../entities/fx.ts';

// Round 11 phase mechanic: replay non-ultimate attacks from their original cast point.
export function maybeScheduleTemporalEcho(state: any, caster: any, action: any) {
  if (state._executingTemporalEcho || caster.charId !== 110 || !caster.isBoss) return;
  if ((caster.phaseIdx || 0) < 1 || action.type === 'time_anchor_ritual' || action.echoDisabled) return;
  state.temporalEchoes = state.temporalEchoes || [];
  state.temporalEchoes.push({
    remaining: caster.phaseIdx >= 2 ? 0.8 : 1.5,
    total: caster.phaseIdx >= 2 ? 0.8 : 1.5,
    bossId: caster.id,
    x: caster.x,
    y: caster.y,
    facing: caster.facing,
    action: {
      ...action,
      dmg: (action.dmg || 0) * 0.6,
      dmgPct: (action.dmgPct || 0) * 0.6,
      chain: null,
      echoDisabled: true,
      color: '#8de8ff',
    },
    telegraphT: 0,
  });
}

export function tickTemporalEchoes(state: any, dt: number, executeAction: Function) {
  const keep = [];
  for (const echo of state.temporalEchoes || []) {
    const boss = state.players[echo.bossId];
    if (!boss || !boss.alive) continue;
    echo.remaining -= dt;
    echo.telegraphT -= dt;
    if (echo.telegraphT <= 0 && echo.remaining > 0) {
      echo.telegraphT = 0.18;
      const a = echo.action;
      addFx(state, {
        type: 'telegraph', x: echo.x, y: echo.y, facing: echo.facing,
        color: '#8de8ff', life: 0.24,
        shape: a.telegraph === 'line' ? 'line' : (a.telegraph === 'arc' ? 'arc' : 'circle'),
        radius: a.radius || a.range || 100,
        range: a.range || ((a.speed || 0) * (a.lifetime || 0)) || 260,
        arc: a.arc || 1.4,
        progress: 1 - echo.remaining / echo.total,
      });
    }
    if (echo.remaining <= 0) {
      const ghost = { ...boss, x: echo.x, y: echo.y, facing: echo.facing };
      state._executingTemporalEcho = true;
      executeAction(state, ghost, echo.action, { silent: true });
      state._executingTemporalEcho = false;
      addFx(state, { type: 'blink', x: echo.x, y: echo.y, color: '#8de8ff', life: 0.45, radius: 90 });
    } else keep.push(echo);
  }
  state.temporalEchoes = keep;
}
