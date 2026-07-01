import { PLAYER_RADIUS } from '../../../../../constants.js';
import { makeProjectile, makeZone } from '../../../../../entities/factories.ts';
import { applyShield } from '../../../../../entities/shield.ts';
import { addFx } from '../../../../../entities/fx.ts';
import { clampArenaPoint } from '../../geometry.ts';
import type { ActionContext } from '../../../../../types';

function mirrorPoint(caster: any, forward: number, side: number) {
  const fx = Math.cos(caster.facing);
  const fy = Math.sin(caster.facing);
  const sx = -fy;
  const sy = fx;
  return clampArenaPoint({
    x: caster.x + fx * forward + sx * side,
    y: caster.y + fy * forward + sy * side,
  });
}

function localDir(caster: any, angle: number) {
  const fx = Math.cos(caster.facing);
  const fy = Math.sin(caster.facing);
  const sx = -fy;
  const sy = fx;
  return {
    x: fx * Math.cos(angle) + sx * Math.sin(angle),
    y: fy * Math.cos(angle) + sy * Math.sin(angle),
  };
}

function norm(v: { x: number; y: number }) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function mirrorAngleFor(inDir: { x: number; y: number }, outDir: { x: number; y: number }) {
  const incoming = norm(inDir);
  const outgoing = norm(outDir);
  const normal = norm({ x: incoming.x - outgoing.x, y: incoming.y - outgoing.y });
  return Math.atan2(normal.y, normal.x) - Math.PI / 2;
}

function addLaneMirror(ctx: ActionContext, forward: number, side: number, angle: number, backMirror: boolean, laneIndex: number) {
  const { state, caster, action } = ctx;
  const pos = mirrorPoint(caster, forward, side);
  const mirror = Object.assign(makeZone(caster.id, pos.x, pos.y, {
    radius: 0,
    dmg: 0,
    lifetime: action.mirrorLife || 7,
    tick: 999,
    color: action.color,
    vfx: 'glass_astrologer_mirror',
  }), {
    kind: 'glass_mirror',
    angle: caster.facing + angle,
    length: action.laneMirrorLength || 84,
    thickness: action.mirrorThickness || 18,
    charges: action.mirrorCharges || 8,
    createdAt: state.time,
    ultimateMirror: true,
    backMirror,
    laneMirror: true,
    laneIndex,
    srcSlot: ctx.source,
  });
  state.zones.push(mirror);
  addFx(state, { type: 'buff', x: mirror.x, y: mirror.y, facing: mirror.angle, color: action.color, life: 0.32, radius: mirror.length * 0.5, vfx: mirror.vfx });
  return mirror;
}

function addOuterMirror(ctx: ActionContext, forward: number, side: number, sourceForward: number, sourceSide: number, focusForward: number, focusSide: number, backMirror = false) {
  const { state, caster, action } = ctx;
  const pos = mirrorPoint(caster, forward, side);
  const source = mirrorPoint(caster, sourceForward, sourceSide);
  const focus = mirrorPoint(caster, focusForward, focusSide);
  const angle = mirrorAngleFor({ x: pos.x - source.x, y: pos.y - source.y }, { x: focus.x - pos.x, y: focus.y - pos.y });
  const mirror = Object.assign(makeZone(caster.id, pos.x, pos.y, {
    radius: 0,
    dmg: 0,
    lifetime: action.mirrorLife || 7,
    tick: 999,
    color: action.color,
    vfx: 'glass_astrologer_mirror',
  }), {
    kind: 'glass_mirror',
    angle,
    length: action.outerMirrorLength || 200,
    thickness: action.mirrorThickness || 18,
    charges: action.mirrorCharges || 8,
    createdAt: state.time,
    ultimateMirror: true,
    backMirror,
    outerMirror: true,
    srcSlot: ctx.source,
  });
  state.zones.push(mirror);
  addFx(state, { type: 'buff', x: mirror.x, y: mirror.y, facing: mirror.angle, color: action.color, life: 0.32, radius: mirror.length * 0.5, vfx: mirror.vfx });
  return mirror;
}

function fireEmpoweredShard(ctx: ActionContext) {
  const { state, caster, action, cos, sin } = ctx;
  const speed = action.shardSpeed || 860;
  state.projectiles.push(makeProjectile(caster.id, caster.x + cos * PLAYER_RADIUS, caster.y + sin * PLAYER_RADIUS, cos * speed, sin * speed, {
    dmg: (action.shardDmg || 18) * (action.empoweredDmgMult || 1.15),
    radius: action.shardRadius || 9,
    lifetime: action.shardLife || 1.75,
    color: '#ffe6a7',
    knockback: 28,
    pierce: false,
    vfx: 'glass_astrologer_shard',
    srcSlot: ctx.source,
    glassShard: true,
    glassReflects: 0,
    glassMaxReflects: action.empoweredReflects || 6,
    glassReflectBonus: action.reflectBonus || 0.18,
    glassMarkOnReflected: true,
    glassPierceOnReflect: true,
    glassSplitOnMirror: true,
    glassSplitDmgMult: action.splitDmgMult || 1,
    glassSplitRadiusMult: action.splitRadiusMult || 1,
    glassPassRadiusMult: action.passRadiusMult || 0.9,
    glassReflectRadiusMult: action.reflectRadiusMult || 1.28,
    glassChildMaxReflects: action.childMaxReflects || 2,
  }));
}

export function glass_kaleidoscope(ctx: ActionContext) {
  const { state, caster, action } = ctx;
  if (action.self?.shield) applyShield(state, caster, action.self.shield, action.self.duration || 3);
  addFx(state, { type: 'ultimate', x: caster.x, y: caster.y, facing: caster.facing, color: action.color, life: 0.75, radius: action.range || 820, vfx: action.vfx });

  const spread = action.catchSpread || 0.3;
  const frontForward = action.frontCatchForward || 190;
  const backForward = action.backCatchForward || -120;
  const focusForward = action.returnFocusForward || 520;
  const focusSide = action.returnFocusSide || 0;
  const lanes = [-spread, 0, spread];

  lanes.forEach((laneAngle, laneIndex) => {
    const frontSide = Math.tan(laneAngle) * frontForward;
    const backSide = Math.tan(laneAngle) * (frontForward * 2 - backForward);
    addLaneMirror(ctx, frontForward, frontSide, Math.PI / 2, false, laneIndex);

    const incoming = localDir(caster, Math.PI - laneAngle);
    const backPos = mirrorPoint(caster, backForward, backSide);
    const focus = mirrorPoint(caster, focusForward, focusSide);
    const backAngle = mirrorAngleFor(incoming, { x: focus.x - backPos.x, y: focus.y - backPos.y });
    addLaneMirror(ctx, backForward, backSide, backAngle - caster.facing, true, laneIndex);
  });

  const outerSide = action.outerMirrorSide || 310;
  const outerInnerSide = action.outerInnerMirrorSide || 190;
  const outerFront = action.outerFrontForward || 430;
  const outerFarFront = action.outerFarFrontForward || 600;
  const outerBack = action.outerBackForward || -260;
  addOuterMirror(ctx, outerFront, -outerSide, frontForward, -outerSide * 0.45, focusForward, focusSide);
  addOuterMirror(ctx, outerFront, -outerInnerSide, frontForward, -outerInnerSide * 0.45, focusForward, focusSide);
  addOuterMirror(ctx, outerFront, outerInnerSide, frontForward, outerInnerSide * 0.45, focusForward, focusSide);
  addOuterMirror(ctx, outerFront, outerSide, frontForward, outerSide * 0.45, focusForward, focusSide);
  addOuterMirror(ctx, outerFarFront, -outerInnerSide, outerFront, -outerInnerSide * 0.65, focusForward, focusSide);
  addOuterMirror(ctx, outerFarFront, outerInnerSide, outerFront, outerInnerSide * 0.65, focusForward, focusSide);
  addOuterMirror(ctx, outerBack, -outerSide, backForward, -outerSide * 0.45, focusForward, focusSide, true);
  addOuterMirror(ctx, outerBack, outerSide, backForward, outerSide * 0.45, focusForward, focusSide, true);
  fireEmpoweredShard(ctx);
}

export const handlers = { glass_kaleidoscope };
