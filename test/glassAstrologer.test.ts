// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/game/entities.js';
import { getCharacter } from '../src/game/characters.js';
import { executeAction } from '../src/game/actions/executor.ts';
import { updateProjectiles } from '../src/game/systems/projectiles.ts';
import { reflectDir } from '../src/game/characters/classes/glass-astrologer/geometry.ts';

function buildState(extra = []) {
  const state = createInitialState([
    { id: 'glass', name: 'Glass', charId: 'glass-astrologer', team: 1 },
    { id: 'target', name: 'Target', charId: 'mage', team: 2 },
    ...extra,
  ], { freeMana: true, noCooldown: true }, { mode: 'team' });

  const caster = state.players.glass;
  const target = state.players.target;
  caster.x = 400; caster.y = 400; caster.facing = 0;
  target.x = 700; target.y = 400;
  return state;
}

function glass() {
  return getCharacter('glass-astrologer') as any;
}

function tickProjectiles(state, steps = 30, dt = 0.02) {
  for (let i = 0; i < steps; i++) updateProjectiles(state, dt);
}

function mirrors(state) {
  return state.zones.filter((z) => z.kind === 'glass_mirror' && z.lifetime > 0);
}

function addMirror(state, patch = {}) {
  const mirror = {
    id: 1000 + state.zones.length,
    owner: 'glass',
    x: 520,
    y: 400,
    radius: 0,
    dmg: 0,
    lifetime: 9,
    tick: 999,
    tickTimer: 999,
    delay: 0,
    knockback: 0,
    vx: 0,
    vy: 0,
    pull: 0,
    color: '#d8f7ff',
    vfx: 'glass_astrologer_mirror',
    kind: 'glass_mirror',
    angle: Math.PI / 4,
    length: 220,
    thickness: 18,
    charges: 6,
    createdAt: state.time,
    ...patch,
  };
  state.zones.push(mirror);
  return mirror;
}

describe('glass astrologer mirror geometry', () => {
  it('places at most three mirrors and removes the oldest when placing a fourth', () => {
    const state = buildState();
    const caster = state.players.glass;
    const action = glass().skill1;

    executeAction(state, caster, action, { source: 'skill1' });
    state.time += 1;
    caster.facing = 0.4;
    executeAction(state, caster, action, { source: 'skill1' });
    state.time += 1;
    caster.facing = 0.8;
    executeAction(state, caster, action, { source: 'skill1' });
    state.time += 1;
    caster.facing = 1.2;
    executeAction(state, caster, action, { source: 'skill1' });

    const live = mirrors(state);
    expect(live.length).toBe(3);
    expect(action.cd).toBe(2.4);
    expect(action.manaCost).toBe(8);
    expect(live.every((m) => m.charges === 6 && m.lifetime <= 9)).toBe(true);
    expect(live.map((m) => m.createdAt)).toEqual([1, 2, 3]);
  });

  it('direct star shard deals damage but does not add glassmark', () => {
    const state = buildState();
    const caster = state.players.glass;
    const target = state.players.target;
    executeAction(state, caster, glass().basic, { source: 'basic' });
    expect(state.projectiles.length).toBe(3);
    expect(glass().basic.spread).toBe(0.3);
    expect(state.projectiles[0].vy).toBeLessThan(0);
    expect(Math.abs(state.projectiles[1].vy)).toBeLessThan(1e-6);
    expect(state.projectiles[2].vy).toBeGreaterThan(0);
    tickProjectiles(state, 24);

    expect(glass().basic.dmg).toBe(7);
    expect(target.maxHp - target.hp).toBeCloseTo(7, 5);
    expect(target.effects.glassmark).toBeUndefined();
  });

  it('star shard pierces through the mirror and creates one larger reflected shard', () => {
    const state = buildState([
      { id: 'second', name: 'Second', charId: 'mage', team: 2 },
    ]);
    const caster = state.players.glass;
    const target = state.players.target;
    const second = state.players.second;
    target.x = 520;
    target.y = 250;
    second.x = 520;
    second.y = 210;
    addMirror(state, { x: 520, y: 400, angle: -Math.PI / 4, length: 260 });

    const singleShard = { ...glass().basic, count: 1 };
    executeAction(state, caster, singleShard, { source: 'basic' });
    let children = [];
    let passThrough = null;
    for (let i = 0; i < 12; i++) {
      updateProjectiles(state, 0.02);
      children = state.projectiles.filter((p) => p.glassSplitChild);
      passThrough = state.projectiles.find((p) => p.glassShard && !p.glassSplitChild && (p.glassReflects || 0) > 0);
      if (children.length) break;
    }
    expect(children.length).toBe(1);
    expect(passThrough?.pierce).toBe(true);
    expect(passThrough?.vx).toBeGreaterThan(0);
    expect(passThrough?.radius).toBeLessThan(singleShard.radius);
    expect(children[0].pierce).toBe(true);
    expect(children[0].glassMaxReflects).toBe(2);
    expect(children[0].glassSplitOnMirror).toBe(false);
    expect(children[0].radius).toBeGreaterThan(singleShard.radius);
    expect(Math.abs(children[0].vx)).toBeLessThan(1e-6);
    expect(children[0].vy).toBeLessThan(0);

    tickProjectiles(state, 32);

    const reflectedShardDmg = singleShard.dmg * singleShard.splitDmgMult * (1 + singleShard.reflectBonus);
    expect(target.maxHp - target.hp).toBeCloseTo(reflectedShardDmg, 5);
    expect(second.maxHp - second.hp).toBeCloseTo(reflectedShardDmg, 5);
    expect(target.effects.glassmark?.stacks).toBe(1);
    expect(second.effects.glassmark?.stacks).toBe(1);
    expect(mirrors(state)[0].charges).toBe(6);
    expect(mirrors(state)[0].hits).toBeGreaterThan(0);
  });

  it('star shard does not reflect when its path misses the mirror segment', () => {
    const state = buildState();
    const caster = state.players.glass;
    const target = state.players.target;
    target.x = 700;
    target.y = 400;
    addMirror(state, { x: 520, y: 520, angle: Math.PI / 4, length: 120 });

    executeAction(state, caster, glass().basic, { source: 'basic' });
    tickProjectiles(state, 24);

    expect(target.maxHp - target.hp).toBeCloseTo(glass().basic.dmg, 5);
    expect(target.effects.glassmark).toBeUndefined();
    expect(mirrors(state)[0].charges).toBe(6);
  });

  it('folded starlight fires eight radial beam pulses and marks on reflected hits', () => {
    const state = buildState();
    const caster = state.players.glass;
    const target = state.players.target;
    target.x = 520;
    target.y = 250;
    addMirror(state, { x: 520, y: 400, angle: -Math.PI / 4, length: 260 });

    executeAction(state, caster, glass().skill2, { source: 'skill2' });
    expect(caster.glassBeam?.remaining).toBe(0.75);
    expect(target.maxHp - target.hp).toBe(0);

    glass().tick(state, caster, 0.26);
    const rayFx = state.fx.filter((fx) => fx.vfx === 'glass_astrologer_ray' && fx.ray && fx.x1 != null && fx.y1 != null && fx.x2 != null && fx.y2 != null);
    const originRayFx = rayFx.filter((fx) => Math.abs(fx.x1 - caster.x) < 1e-6 && Math.abs(fx.y1 - caster.y) < 1e-6);
    expect(originRayFx.length).toBe(8);
    expect(target.maxHp - target.hp).toBeCloseTo(glass().skill2.pulseDmg * 1.35, 5);
    expect(target.effects.glassmark?.stacks).toBe(1);

    const hpAfterFirst = target.hp;
    glass().tick(state, caster, 0.25);
    expect(hpAfterFirst - target.hp).toBeCloseTo(glass().skill2.pulseDmg * 1.35 + glass().skill2.markBonusPerStack, 5);
    expect(target.effects.glassmark?.stacks).toBe(2);
  });

  it('kaleidoscope creates a front/back mirror array and fires an empowered splitting shard', () => {
    const state = buildState([
      { id: 'ally', name: 'Ally Mirror Owner', charId: 'mage', team: 1 },
    ]);
    const caster = state.players.glass;
    addMirror(state, { x: 500, y: 400, angle: 0, length: 220 });
    addMirror(state, { x: 580, y: 380, angle: Math.PI / 2, length: 220, owner: 'ally' });

    executeAction(state, caster, glass().ultimate, { source: 'ultimate' });

    const ownUltimate = mirrors(state).filter((m) => m.owner === 'glass' && m.ultimateMirror);
    expect(caster.shield).toBe(80);
    expect(ownUltimate.length).toBe(14);
    expect(ownUltimate.filter((m) => m.laneMirror && !m.backMirror).length).toBe(3);
    expect(ownUltimate.filter((m) => m.laneMirror && m.backMirror).length).toBe(3);
    expect(ownUltimate.filter((m) => m.outerMirror && !m.backMirror).length).toBe(6);
    expect(ownUltimate.filter((m) => m.outerMirror && m.backMirror).length).toBe(2);
    expect(ownUltimate.every((m) => m.charges === 8 && m.lifetime === 7)).toBe(true);
    expect(mirrors(state).filter((m) => m.owner === 'ally').length).toBe(1);
    expect(state.projectiles.some((p) => p.glassShard && p.glassMaxReflects === 6 && p.glassSplitOnMirror)).toBe(true);
  });

  it('kaleidoscope lane mirrors catch the three basic shards and aim them through the back mirrors', () => {
    const state = buildState();
    const caster = state.players.glass;
    executeAction(state, caster, glass().ultimate, { source: 'ultimate' });

    const ownUltimate = mirrors(state).filter((m) => m.owner === 'glass' && m.ultimateMirror);
    const frontMirrors = ownUltimate.filter((m) => m.laneMirror && !m.backMirror).sort((a, b) => a.laneIndex - b.laneIndex);
    const backMirrors = ownUltimate.filter((m) => m.laneMirror && m.backMirror).sort((a, b) => a.laneIndex - b.laneIndex);
    const focus = { x: caster.x + Math.cos(caster.facing) * 520, y: caster.y + Math.sin(caster.facing) * 520 };
    expect(frontMirrors.length).toBe(3);
    expect(backMirrors.length).toBe(3);

    for (let i = 0; i < 3; i++) {
      const front = frontMirrors[i];
      const back = backMirrors[i];
      const incomingToFront = { x: front.x - caster.x, y: front.y - caster.y };
      const frontLen = Math.hypot(incomingToFront.x, incomingToFront.y) || 1;
      const towardBack = { x: back.x - front.x, y: back.y - front.y };
      const backLen = Math.hypot(towardBack.x, towardBack.y) || 1;
      const frontReflect = reflectDir({ x: incomingToFront.x / frontLen, y: incomingToFront.y / frontLen }, front);
      expect(frontReflect.x * (towardBack.x / backLen) + frontReflect.y * (towardBack.y / backLen)).toBeGreaterThan(0.98);

      const backReflect = reflectDir({ x: towardBack.x / backLen, y: towardBack.y / backLen }, back);
      const towardFocus = { x: focus.x - back.x, y: focus.y - back.y };
      const focusLen = Math.hypot(towardFocus.x, towardFocus.y) || 1;
      expect(backReflect.x * (towardFocus.x / focusLen) + backReflect.y * (towardFocus.y / focusLen)).toBeGreaterThan(0.98);
    }
  });

  it('kaleidoscope outer mirrors aim escaped shards back toward the front focus', () => {
    const state = buildState();
    const caster = state.players.glass;
    executeAction(state, caster, glass().ultimate, { source: 'ultimate' });

    const focus = { x: caster.x + Math.cos(caster.facing) * 520, y: caster.y + Math.sin(caster.facing) * 520 };
    const outerMirrors = mirrors(state).filter((m) => m.owner === 'glass' && m.ultimateMirror && m.outerMirror);
    expect(outerMirrors.length).toBe(8);
    expect(outerMirrors.filter((m) => !m.backMirror).length).toBe(6);
    expect(outerMirrors.every((m) => m.length === 200)).toBe(true);

    for (const mirror of outerMirrors) {
      const source = mirror.backMirror
        ? { x: caster.x - Math.cos(caster.facing) * 120 + Math.sin(caster.facing) * (mirror.y < caster.y ? 126 : -126), y: caster.y - Math.sin(caster.facing) * 120 - Math.cos(caster.facing) * (mirror.y < caster.y ? 126 : -126) }
        : { x: caster.x + Math.cos(caster.facing) * 190 + Math.sin(caster.facing) * (mirror.y < caster.y ? 126 : -126), y: caster.y + Math.sin(caster.facing) * 190 - Math.cos(caster.facing) * (mirror.y < caster.y ? 126 : -126) };
      const incoming = { x: mirror.x - source.x, y: mirror.y - source.y };
      const inLen = Math.hypot(incoming.x, incoming.y) || 1;
      const reflected = reflectDir({ x: incoming.x / inLen, y: incoming.y / inLen }, mirror);
      const toFocus = { x: focus.x - mirror.x, y: focus.y - mirror.y };
      const focusLen = Math.hypot(toFocus.x, toFocus.y) || 1;
      expect(reflected.x * (toFocus.x / focusLen) + reflected.y * (toFocus.y / focusLen)).toBeGreaterThan(0.96);
    }
  });

  it('kaleidoscope front and back lane mirrors bounce all three basic shards into heavy front damage', () => {
    const state = buildState();
    const caster = state.players.glass;
    const target = state.players.target;
    target.x = 920;
    target.y = 400;

    executeAction(state, caster, glass().ultimate, { source: 'ultimate' });
    state.projectiles.length = 0;
    executeAction(state, caster, glass().basic, { source: 'basic' });
    tickProjectiles(state, 90);

    const ownUltimate = mirrors(state).filter((m) => m.owner === 'glass' && m.ultimateMirror);
    const frontLaneHits = ownUltimate.filter((m) => m.laneMirror && !m.backMirror).map((m) => m.hits || 0);
    const backLaneHits = ownUltimate.filter((m) => m.laneMirror && m.backMirror).map((m) => m.hits || 0);
    expect(frontLaneHits.every((hits) => hits > 0)).toBe(true);
    expect(backLaneHits.every((hits) => hits > 0)).toBe(true);
    expect(target.maxHp - target.hp).toBeGreaterThan(glass().basic.dmg * 3);
    expect(mirrors(state).every((m) => !m.ultimateMirror || m.charges === 8)).toBe(true);
  });

  it('normal mirrors do not count or trim ultimate mirrors', () => {
    const state = buildState();
    const caster = state.players.glass;

    executeAction(state, caster, glass().ultimate, { source: 'ultimate' });
    for (let i = 0; i < 4; i++) {
      state.time += 1;
      caster.facing = i * 0.2;
      executeAction(state, caster, glass().skill1, { source: 'skill1' });
    }

    expect(mirrors(state).filter((m) => m.owner === 'glass' && m.ultimateMirror).length).toBe(14);
    expect(mirrors(state).filter((m) => m.owner === 'glass' && !m.ultimateMirror).length).toBe(3);
  });
});
