// @ts-nocheck
import { ULT_MAX, ULT_LOCKOUT } from '../constants.js';
import { getCharacter } from '../characters.js';
import { applyEffect } from '../entities/effects.ts';
import { addFx } from '../entities/fx.ts';
import { recordSkillUse } from '../entities/stats.ts';
import { executeAction } from './executor.ts';

function tryStartCharge(p, action, slot) {
  if (p.chargeState) return;
  p.chargeState = { slot, time: 0 };
}

function executeChargedAction(state, p, slot) {
  const character = getCharacter(p.charId);
  const action = character[slot];
  if (!action || !action.chargeMax) return;
  if (p.chargeState && p.chargeState.slot !== slot) return;
  const t = p.chargeState ? p.chargeState.time : 0;
  const ratio = Math.min(1, t / action.chargeMax);
  const chargeFactor = 1 + ratio;
  if (slot !== 'basic' && slot !== 'evade' && action.name) {
    addFx(state, { type: 'skillname', x: p.x, y: p.y, color: action.color || '#ffffff', life: 1.0, text: action.name, owner: p.id });
  }
  recordSkillUse(state, p, slot);
  executeAction(state, p, action, { chargeFactor, chargeRatio: ratio });
  p.chargeState = null;
}

export function tickChargeState(state, p, input, dt) {
  if (!p.chargeState) return;
  if (input[p.chargeState.slot]) {
    const action = getCharacter(p.charId)[p.chargeState.slot];
    p.chargeState.time = Math.min(p.chargeState.time + dt, action?.chargeMax || 5);
    return;
  }

  const slot = p.chargeState.slot;
  const action = getCharacter(p.charId)[slot];
  const freeMana = state.flags && state.flags.freeMana;
  if (action && (!freeMana && action.manaCost ? p.mana >= action.manaCost : true)) {
    if (!freeMana && action.manaCost) p.mana -= action.manaCost;
    p.cd[slot] = p.isBoss && p.phaseCdMult ? action.cd * p.phaseCdMult : action.cd;
    executeChargedAction(state, p, slot);
  } else {
    p.chargeState = null;
  }
}

export function tryAction(state, p, slot) {
  const character = getCharacter(p.charId);
  const action = character[slot];
  if (!action || p.cd[slot] > 0) return;
  if (action.chargeMax) {
    tryStartCharge(p, action, slot);
    return;
  }

  const freeMana = state.flags && state.flags.freeMana;
  if (!freeMana && action.manaCost && p.mana < action.manaCost) return;
  if (action.hpCost && p.hp <= action.hpCost) return;
  if (!freeMana && action.manaCost) p.mana -= action.manaCost;
  if (action.hpCost) p.hp -= action.hpCost;
  p.cd[slot] = p.isBoss && p.phaseCdMult ? action.cd * p.phaseCdMult : action.cd;

  const talent = character.talent;
  if (talent && talent.id === 'iaido' && !action.noIaiReset) {
    p.iaiReady = p.iaiTimer >= (talent.delay || 2);
    p.iaiTimer = 0;
  }
  if (slot !== 'basic' && slot !== 'evade' && action.name) {
    addFx(state, { type: 'skillname', x: p.x, y: p.y, color: action.color || '#ffffff', life: 1.0, text: action.name, owner: p.id });
  }
  recordSkillUse(state, p, slot);
  executeAction(state, p, action);
  p.iaiReady = false;
  if (talent && talent.id === 'timeprism' && slot !== 'basic') applyEffect(p, 'haste', { duration: talent.duration || 1.5, factor: talent.factor || 1.25 });
}

export function tryUltimate(state, p) {
  const character = getCharacter(p.charId);
  const action = character.ultimate;
  if (!action) return;
  if (p.cd.ultimate > 0) return;
  const freeMana = state.flags && state.flags.freeMana;
  const isAI = p.isBoss || p.aiId;
  if (!isAI) {
    if (!freeMana && (p.ult || 0) < ULT_MAX) return;
    if (!freeMana) p.ult = 0;
  }
  p.cd.ultimate = (action.cd || ULT_LOCKOUT) * (p.isBoss && p.phaseCdMult ? p.phaseCdMult : 1);
  const talent = character.talent;
  if (talent && talent.id === 'iaido') {
    p.iaiReady = p.iaiTimer >= (talent.delay || 2);
    p.iaiTimer = 0;
  }
  executeAction(state, p, action, { silent: true });
  p.iaiReady = false;
  if (talent && talent.id === 'timeprism') applyEffect(p, 'haste', { duration: talent.duration || 1.5, factor: talent.factor || 1.25 });
  recordSkillUse(state, p, 'ultimate');
  addFx(state, {
    type: 'ultimate',
    x: p.x,
    y: p.y,
    facing: p.facing,
    color: action.color,
    life: 0.7,
    radius: action.radius || 140,
    allyRadius: action.ally ? action.ally.radius : undefined,
    vfx: action.vfx
  });
  if (action.name) {
    addFx(state, { type: 'skillname', x: p.x, y: p.y, color: action.color || '#ffd166', life: 1.4, text: action.name, owner: p.id, ultimate: true });
  }
}

export function castInputActions(state, p, input, dt) {
  tickChargeState(state, p, input, dt);
  if (p.effects.stun) return;
  if (input.basic) tryAction(state, p, 'basic');
  if (input.skill1) tryAction(state, p, 'skill1');
  if (input.skill2) tryAction(state, p, 'skill2');
  if (input.ultimate) tryUltimate(state, p);
  if (input.evade) tryAction(state, p, 'evade');
}
