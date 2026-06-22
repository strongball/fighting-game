import { describe, expect, it, vi } from 'vitest';
import { createInitialState, makeBoss, makePlayer } from '../src/game/entities/factories.ts';
import { dealDamage } from '../src/game/entities/damage.ts';
import { prepareTimeAnchorRitual, resolveTimeAnchorRitual, tickTimeAnchors } from '../src/game/bosses/time-anchors.ts';
import { maybeScheduleTemporalEcho, tickTemporalEchoes } from '../src/game/bosses/echoes.ts';
import { computeBossInput } from '../src/game/bossAI.js';
import { getCharacter } from '../src/game/characters.js';

function setup(playerCount = 2) {
  const state: any = createInitialState([], {}, { mode: 'boss' });
  state.roundPhase = 'fighting';
  const boss: any = makeBoss('boss-11', 110, 1200, 450, 2, { isBoss: true, aiId: 'time_devourer' });
  state.players[boss.id] = boss;
  for (let i = 0; i < playerCount; i++) {
    const p: any = makePlayer(`p${i}`, `P${i}`, 0, 300 + i * 100, 900, 1);
    state.players[p.id] = p;
  }
  return { state, boss };
}

describe('Round 11 time anchors', () => {
  it('creates one anchor per living player and succeeds when all occupy one', () => {
    const { state, boss } = setup(3);
    prepareTimeAnchorRitual(state, boss, { windup: 5, finalPhaseWindup: 3.8, anchorRadius: 95 });
    expect(state.timeAnchors).toHaveLength(3);
    const players: any[] = Object.values(state.players).filter((p: any) => p.team === 1) as any[];
    players.forEach((p, i) => { p.x = state.timeAnchors[i].x; p.y = state.timeAnchors[i].y; });
    expect(resolveTimeAnchorRitual(state, boss)).toBe(true);
    expect(players.every((p) => p.alive)).toBe(true);
  });

  it('places the solo anchor away from the boss and counts body overlap at the ring edge', () => {
    const { state, boss } = setup(1);
    prepareTimeAnchorRitual(state, boss, { windup: 5, anchorRadius: 95 });
    const anchor = state.timeAnchors[0];
    const player: any = state.players.p0;
    expect(anchor.y).toBeGreaterThan(state.players[boss.id].y + 300);
    expect(anchor.captureRadius).toBe(anchor.radius + player.hitR + 10);
    player.x = anchor.x + anchor.radius + player.hitR + 5;
    player.y = anchor.y;
    expect(resolveTimeAnchorRitual(state, boss)).toBe(true);
    expect(player.alive).toBe(true);
  });

  it('keeps a recently occupied anchor valid for the 0.25 second grace window', () => {
    const { state, boss } = setup(1);
    boss.aiState = { slot: 'ultimate', windupT: 2 };
    prepareTimeAnchorRitual(state, boss, { windup: 5, anchorRadius: 95 });
    const anchor = state.timeAnchors[0];
    const player: any = state.players.p0;
    player.x = anchor.x; player.y = anchor.y;
    tickTimeAnchors(state, 1 / 30);
    expect(anchor.occupiedBy).toBe(player.id);
    player.x = anchor.x + anchor.captureRadius + 100;
    tickTimeAnchors(state, 0.2);
    expect(resolveTimeAnchorRitual(state, boss)).toBe(true);
  });

  it('expires occupancy after the grace window', () => {
    const { state, boss } = setup(1);
    boss.aiState = { slot: 'ultimate', windupT: 2 };
    prepareTimeAnchorRitual(state, boss, { windup: 5, anchorRadius: 95 });
    const anchor = state.timeAnchors[0];
    const player: any = state.players.p0;
    player.x = anchor.x; player.y = anchor.y;
    tickTimeAnchors(state, 1 / 30);
    player.x = anchor.x + anchor.captureRadius + 100;
    tickTimeAnchors(state, 0.3);
    expect(resolveTimeAnchorRitual(state, boss)).toBe(false);
  });

  it('updates persistent anchor state without flooding the fx queue', () => {
    const { state, boss } = setup(4);
    boss.aiState = { slot: 'ultimate', windupT: 4 };
    prepareTimeAnchorRitual(state, boss, { windup: 5, anchorRadius: 95 });
    const fxBefore = state.fx.length;
    for (let i = 0; i < 120; i++) {
      boss.aiState.windupT -= 1 / 30;
      tickTimeAnchors(state, 1 / 30);
    }
    expect(state.fx).toHaveLength(fxBefore);
    expect(state.timeAnchorRitual.required).toBe(4);
    expect(state.timeAnchors.every((a: any) => typeof a.progress === 'number')).toBe(true);
  });

  it('keeps attacking with lightweight projectiles during the ritual', () => {
    const { state, boss } = setup(1);
    boss.aiState = { slot: 'ultimate', windupT: 4 };
    prepareTimeAnchorRitual(state, boss, {
      windup: 5, anchorRadius: 95,
      barrageDelay: 0.2, barrageInterval: 1.1, barrageCount: 3, barrageDmg: 20,
    });
    tickTimeAnchors(state, 0.21);
    expect(state.projectiles).toHaveLength(3);
    expect(state.projectiles.every((p: any) => p.owner === boss.id && p.dmg === 20)).toBe(true);
    expect(state.fx).toHaveLength(0);
  });

  it('cancels all boss-owned attacks when the ritual starts', () => {
    const { state, boss } = setup(1);
    boss.chargeState = { slot: 'basic' };
    boss.charge = { dist: 100 };
    boss.leap = { t: 0 };
    boss.channel = { remaining: 2 };
    boss.kvx = 120; boss.kvy = -40;
    state.projectiles = [{ id: 1, owner: boss.id }, { id: 2, owner: 'p0' }];
    state.zones = [{ id: 3, owner: boss.id }, { id: 4, owner: 'p0' }];
    state.temporalEchoes = [{ bossId: boss.id }, { bossId: 'other' }];
    prepareTimeAnchorRitual(state, boss, { windup: 5, anchorRadius: 95 });
    expect(boss.chargeState).toBeNull();
    expect(boss.charge).toBeNull();
    expect(boss.leap).toBeNull();
    expect(boss.channel).toBeNull();
    expect([boss.kvx, boss.kvy]).toEqual([0, 0]);
    expect(state.projectiles.map((p: any) => p.owner)).toEqual(['p0']);
    expect(state.zones.map((z: any) => z.owner)).toEqual(['p0']);
    expect(state.temporalEchoes.map((e: any) => e.bossId)).toEqual(['other']);
  });

  it('kills the living team when any required anchor is empty', () => {
    const { state, boss } = setup(2);
    prepareTimeAnchorRitual(state, boss, { windup: 5, anchorRadius: 95 });
    const players: any[] = Object.values(state.players).filter((p: any) => p.team === 1) as any[];
    players[0].x = state.timeAnchors[0].x; players[0].y = state.timeAnchors[0].y;
    players[1].x = players[0].x; players[1].y = players[0].y;
    expect(resolveTimeAnchorRitual(state, boss)).toBe(false);
    expect(players.every((p) => !p.alive && p.hp === 0)).toBe(true);
  });

  it('prepares anchors when the global 20% lock forces the ultimate', () => {
    const { state, boss } = setup(2);
    boss.hp = boss.maxHp * 0.21;
    dealDamage(state, boss, boss.maxHp * 0.05, state.players.p0.id);
    expect(boss.desperation).toBe(true);
    expect(boss.aiState.slot).toBe('ultimate');
    expect(state.timeAnchors).toHaveLength(2);
  });
});

describe('Round 11 temporal echoes', () => {
  it('replays eligible attacks at 60% damage', () => {
    const { state, boss } = setup(1);
    boss.phaseIdx = 1;
    maybeScheduleTemporalEcho(state, boss, { type: 'melee', dmg: 50, range: 100, telegraph: 'arc' });
    expect(state.temporalEchoes[0].action.dmg).toBe(30);
    const execute = vi.fn();
    tickTemporalEchoes(state, 1.6, execute);
    expect(execute).toHaveBeenCalledOnce();
    expect(state.temporalEchoes).toEqual([]);
  });
});

describe('Round 11 falling clock hands', () => {
  it('uses four persistent delayed zones without windup fx spam or custom zone geometry', () => {
    const { state, boss } = setup(1);
    const skill = getCharacter(110).skill2;
    expect(skill.count).toBe(4);
    expect(skill.delay).toBeGreaterThan(0);
    expect(skill.suppressWindupTelegraph).toBe(true);
    expect(skill.vfx).toBeUndefined();
    state.players.p0.x = boss.x + 200;
    state.players.p0.y = boss.y;
    boss.cd = { basic: 99, skill1: 99, skill2: 0, ultimate: 99, evade: 0 };
    boss.aiState = { mode: 'idle', slot: null };
    for (let i = 0; i < 100 && boss.aiState.mode !== 'windup'; i++) computeBossInput(state, boss, 0.033);
    expect(boss.aiState.slot).toBe('skill2');
    state.fx = [];
    computeBossInput(state, boss, 0.2);
    expect(state.fx.filter((fx: any) => fx.type === 'telegraph')).toHaveLength(0);
  });
});
