// 權威模擬：僅由房主執行。applyMovement 也供加入者本機預測使用。

import { ARENA, PLAYER_RADIUS, MANA_REGEN, KNOCKBACK_FRICTION, ULT_MAX, ULT_REGEN, ULT_LOCKOUT, COOLDOWN_MULTIPLIER } from './constants.js';
import { getCharacter } from './characters.js';
import { EMPTY_INPUT } from './input.js';
import {
  clamp, dist, angleDiff, makeProjectile, makeZone, makeBoss,
  dealDamage, applyEffect, addFx, missingHp, isEnemy, isAlly,
} from './entities.js';
import { computeBossInput } from './bossAI.js';
import { bossTick, checkBossRound, BOSS_TEAM } from './bossMode.js';

export function speedOf(p) {
  const c = getCharacter(p.charId);
  let s = c.speed;
  if (p.effects.slow) s *= p.effects.slow.factor;
  if (p.effects.chill) s *= p.effects.chill.factor;
  if (p.effects.haste) s *= p.effects.haste.factor;
  if (p.effects.rage) s *= p.effects.rage.speed;
  return s;
}

// 移動 + 擊退位移 + 邊界限制 (房主與加入者預測共用)
export function applyMovement(p, input, dt) {
  const rooted = !!p.effects.root; // 定身：可轉向/施法，但不可位移 (異於 stun 完全凍結)
  const scrambled = !!p.effects.scramble; // 混亂 (R8)：移動輸入反轉
  if (!p.effects.stun) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (scrambled) { dx = -dx; dy = -dy; }
    if (dx || dy) {
      const l = Math.hypot(dx, dy);
      dx /= l; dy /= l;
      if (input.aim == null) p.facing = Math.atan2(dy, dx); // 未指定瞑準時，以移動方向轉向
      if (rooted) { p.vx = 0; p.vy = 0; }
      else {
        const s = speedOf(p);
        // 蓄力中速度降為 35%
        const moveSpeed = p.chargeState ? s * 0.35 : s;
        p.vx = dx * moveSpeed; p.vy = dy * moveSpeed;
      }
    } else { p.vx = 0; p.vy = 0; }
  } else { p.vx = 0; p.vy = 0; }
  if (input.aim != null && !p.effects.stun) p.facing = input.aim; // 指定瞑準 (魔王邊走邊瞑)

  p.x += (p.vx + p.kvx) * dt;
  p.y += (p.vy + p.kvy) * dt;

  const f = Math.exp(-KNOCKBACK_FRICTION * dt);
  p.kvx *= f; p.kvy *= f;

  p.x = clamp(p.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
  p.y = clamp(p.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
}

function outMult(p, a) {
  let m = 1;
  if (a.lowHpBonus) m *= 1 + (1 - p.hp / p.maxHp);
  if (p.effects.rage) m *= p.effects.rage.dmg;
  return m;
}

// 目標身體命中半徑 (魔王大模型有大 hitR，使攻擊可命中整個視覺體積，而非僅中心點)
function bodyR(o) { return o.hitR || PLAYER_RADIUS; }

function meleeHit(state, p, a, silent) {
  const m = outMult(p, a);
  const full = a.arc >= 6;
  for (const o of Object.values(state.players)) {
    if (!isEnemy(state, p.id, o)) continue;
    const dx = o.x - p.x, dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > a.range + bodyR(o)) continue;
    if (!full) {
      const ang = Math.atan2(dy, dx);
      if (Math.abs(angleDiff(ang, p.facing)) > a.arc / 2) continue;
    }
    let dmg = a.dmg * m;
    // 印記引爆：對帶死亡印記的目標額外爆發並消耗印記 (刺客體系)
    if (a.detonate && o.effects.mark) {
      dmg *= a.detonate.mult || 2;
      delete o.effects.mark;
      addFx(state, { type: 'hit', x: o.x, y: o.y, color: a.color, life: 0.26, radius: 64, vfx: a.vfx });
    }
    // 處決：目標血量低於門檻時暴增傷害 (狂戰士體系)
    if (a.execute && o.hp <= o.maxHp * (a.execute.threshold || 0.25)) dmg *= a.execute.mult || 5;
    dealDamage(state, o, dmg, p.id);
    if (a.knockback && d > 0) { o.kvx += (dx / d) * a.knockback; o.kvy += (dy / d) * a.knockback; }
    if (a.effect) applyEffectFrom(state, o, a.effect, p.id);
  }
  if (!silent) addFx(state, { type: 'melee', x: p.x, y: p.y, facing: p.facing, range: a.range, arc: full ? 7 : a.arc, color: a.color, life: 0.18, vfx: a.vfx });
}

// 透過來源天賦調整 debuff 再施加 (元素使烈焰精通：強化自身燃燒)
function applyEffectFrom(state, target, effect, srcId) {
  let e = effect;
  const src = state.players[srcId];
  if (src && effect.kind === 'burn') {
    const t = getCharacter(src.charId).talent;
    if (t && t.id === 'pyromancy') {
      e = { ...effect, dmg: Math.round((effect.dmg || 0) * (t.burnDmg || 1.5)), duration: (effect.duration || 2) * (t.burnDur || 1.4) };
    }
  }
  // 元素使天賦烈焰精通：對即時凍結有免疫，預警只疊 1 層屡而不会立刻凍結
  if (effect.kind === 'chill' && (effect.stacks || 1) >= (effect.max || 4)) {
    const tt = getCharacter(target.charId).talent;
    if (tt && tt.id === 'pyromancy') {
      e = { ...e, stacks: 1 };
    }
  }
  applyEffect(target, e.kind, e, srcId);
}

// 對自己施加增益 (供大招 a.self 使用，可搭配任意動作類型)
function applySelfBuff(p, s) {
  if (!s) return;
  if (s.cleanse) applyEffect(p, 'cleanse');
  if (s.heal) applyEffect(p, 'heal', { amount: s.heal });
  if (s.shield) applyEffect(p, 'shield', { amount: s.shield, duration: s.duration || 5 });
  if (s.effect) applyEffect(p, s.effect.kind, s.effect, p.id);
  if (s.effects) for (const e of s.effects) applyEffect(p, e.kind, e, p.id); // 多重自我效果 (如血怒 + 吸血)
}

// 對範圍內友方 (含自己) 施加增益 (支援型技能：治療/護盾/減傷光環)。
// 鍵盤無選敵 → 一律以施放者為中心 AoE；solo 時僅作用自身。
function applyAllyBuff(state, caster, ally) {
  if (!ally) return;
  const r = ally.radius || 1e9;
  for (const o of Object.values(state.players)) {
    if (!isAlly(state, caster.id, o)) continue;
    if (dist(caster.x, caster.y, o.x, o.y) > r) continue;
    if (ally.cleanse) applyEffect(o, 'cleanse');
    if (ally.heal) applyEffect(o, 'heal', { amount: ally.heal });
    if (ally.shield) applyEffect(o, 'shield', { amount: ally.shield, duration: ally.duration || 5 });
    if (ally.effect) applyEffect(o, ally.effect.kind, ally.effect, caster.id);
    if (ally.effects) for (const e of ally.effects) applyEffect(o, e.kind, e, caster.id);
  }
}

function executeAction(state, p, a, opts = {}) {
  const silent = !!opts.silent; // 大招以單一 'ultimate' fx 取代動作自身的施放 fx，避免重複觸發
  const dmgMul = opts.chargeFactor || 1;        // 蓄力傷害倍數 (1x~2x)
  const chargeRatio = opts.chargeRatio || 0;   // 蓄力比例 0~1，供速度/半徑/特效縮放
  const cos = Math.cos(p.facing), sin = Math.sin(p.facing);
  switch (a.type) {
    case 'projectile': {
      const m = outMult(p, a);
      const n = a.count || 1;
      // chargeMax 技能才套蓄力縮放，避免影響其他角色飛彈
      const speedMul  = a.chargeMax ? 1 + chargeRatio * 0.6  : 1; // 速度 1x~1.6x
      const radiusMul = a.chargeMax ? 1 + chargeRatio * 1.2  : 1; // 碰撞半徑 1x~2.2x
      const projVfx   = a.chargeMax && chargeRatio > 0 ? a.vfx + '_charged' : a.vfx;
      for (let i = 0; i < n; i++) {
        const ang = p.facing + (i - (n - 1) / 2) * (a.spread || 0);
        const c = Math.cos(ang), s = Math.sin(ang);
        state.projectiles.push(makeProjectile(
          p.id, p.x + c * PLAYER_RADIUS, p.y + s * PLAYER_RADIUS,
          c * a.speed * speedMul, s * a.speed * speedMul,
          { dmg: a.dmg * m * dmgMul, radius: a.radius * radiusMul, lifetime: a.lifetime, color: a.color, knockback: a.knockback, pierce: a.pierce, effect: a.effect, split: a.split, homing: a.homing, leaveZone: a.leaveZone, freezeBonus: a.freezeBonus || 0, vfx: projVfx }
        ));
      }
      break;
    }
    case 'melee':
      meleeHit(state, p, a, silent);
      break;
    case 'dash':
      p.kvx += cos * a.impulse; p.kvy += sin * a.impulse;
      if (a.dmg) meleeHit(state, p, a, true);
      if (!silent) addFx(state, { type: 'dash', x: p.x, y: p.y, facing: p.facing, color: a.color, life: 0.25, vfx: a.vfx });
      break;
    case 'charge': {
      // 衝鋒：沿面向高速推進，撞到第一個敵人立即停下並命中 (戰士戰矛突刺)
      p.charge = {
        dx: cos, dy: sin, speed: a.speed || 950, dist: a.range || 300,
        dmg: a.dmg || 0, hitRadius: a.hitRadius || PLAYER_RADIUS * 1.5,
        knockback: a.knockback || 0, effect: a.effect || null,
        stopOnHit: a.stopOnHit !== false, wallStun: a.wallStun || 0, color: a.color, vfx: a.vfx, hit: {},
      };
      if (!silent) addFx(state, { type: 'dash', x: p.x, y: p.y, facing: p.facing, color: a.color, life: 0.25, vfx: a.vfx });
      break;
    }
    case 'leap': {
      // 躍擊：拋向面前目標點，落地造成範圍命中 (狂戰士嗜血躍斬)
      const tx = clamp(p.x + cos * (a.range || 240), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      const ty = clamp(p.y + sin * (a.range || 240), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      p.leap = {
        t: 0, dur: a.dur || 0.45, fromx: p.x, fromy: p.y, tx, ty,
        dmg: a.dmg || 0, radius: a.radius || 120, knockback: a.knockback || 0,
        effect: a.effect || null, leaveZone: a.leaveZone || null, color: a.color, vfx: a.vfx,
      };
      if (!silent) addFx(state, { type: 'dash', x: p.x, y: p.y, facing: p.facing, color: a.color, life: 0.25, vfx: a.vfx });
      break;
    }
    case 'grapple': {
      // 鉤索：射出鉤爪，命中第一個敵人後把對方拉到自己面前 (戰士鎖鏈鉤爪)
      state.projectiles.push(makeProjectile(
        p.id, p.x + cos * PLAYER_RADIUS, p.y + sin * PLAYER_RADIUS,
        cos * (a.speed || 760), sin * (a.speed || 760),
        { dmg: a.dmg || 0, radius: a.radius || 12, lifetime: a.lifetime || 0.5, color: a.color, knockback: 0, pierce: false, effect: a.effect, pull: { gap: a.gap || 26 }, vfx: a.vfx }
      ));
      if (!silent) addFx(state, { type: 'dash', x: p.x, y: p.y, facing: p.facing, color: a.color, life: 0.2, vfx: a.vfx });
      break;
    }
    case 'blink': {
      p.x = clamp(p.x + cos * a.range, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      p.y = clamp(p.y + sin * a.range, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      if (a.dmg) meleeHit(state, p, { dmg: a.dmg, range: a.hitRadius || 90, arc: 7, knockback: a.knockback || 0, effect: a.effect, detonate: a.detonate }, true); // 落點全方位爆發 (位置已是傳送後，teleport range 與命中半徑分開)
      if (!silent) addFx(state, { type: 'blink', x: p.x, y: p.y, color: a.color, life: 0.3, radius: a.hitRadius || PLAYER_RADIUS * 1.6, vfx: a.vfx });
      break;
    }
    case 'multiblink': {
      // 多目標瞬殺：在最近/帶印記的敵人間連續瞬移斬擊 (刺客虛空換影)
      const n = a.count || 3;
    const cands = Object.values(state.players).filter((o) => isEnemy(state, p.id, o));
      cands.sort((x, y) => {
        const mx = (x.effects && x.effects.mark) ? 0 : 1, my = (y.effects && y.effects.mark) ? 0 : 1;
        if (mx !== my) return mx - my;
        const dxv = dist(p.x, p.y, x.x, x.y), dyv = dist(p.x, p.y, y.x, y.y);
        if (dxv !== dyv) return dxv - dyv;
        return x.id - y.id; // 決定性 tiebreak (host/joiner 一致)
      });
      for (const o of cands.slice(0, n)) {
        const ang = o.facing + Math.PI; // 傳送到目標背後
        p.x = clamp(o.x + Math.cos(ang) * (PLAYER_RADIUS * 2), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
        p.y = clamp(o.y + Math.sin(ang) * (PLAYER_RADIUS * 2), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
        p.facing = Math.atan2(o.y - p.y, o.x - p.x);
        dealDamage(state, o, a.dmg, p.id);
        if (a.knockback) { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1; o.kvx += dx / d * a.knockback; o.kvy += dy / d * a.knockback; }
        if (a.effect) applyEffectFrom(state, o, a.effect, p.id);
        addFx(state, { type: 'blink', x: p.x, y: p.y, color: a.color, life: 0.24, radius: PLAYER_RADIUS * 1.8, vfx: a.vfx });
      }
      break;
    }
    case 'channel': {
      // 持續汲取鏈：每跳鎖定最近敵人傷害並回復自身 (治療師生命汲取)
      p.channel = {
        kind: 'drain', remaining: a.duration || 3, tick: a.tick || 0.4, tickTimer: 0,
        range: a.range || 320, dmg: a.dmg || 0, heal: a.heal || 0,
        effect: a.effect || null, color: a.color, vfx: a.vfx,
      };
      if (!silent) addFx(state, { type: 'buff', x: p.x, y: p.y, color: a.color, life: 0.3, radius: PLAYER_RADIUS * 2, vfx: a.vfx });
      break;
    }
    case 'buff':
      if (a.cleanse) applyEffect(p, 'cleanse');
      if (a.heal) applyEffect(p, 'heal', { amount: a.heal });
      {
        let shieldAmt = a.shield || 0;
        if (a.shieldPerMinion) { let mc = 0; for (const o of Object.values(state.players)) if (o.isMinion && o.ownerId === p.id && o.alive) mc++; shieldAmt += a.shieldPerMinion * mc; }
        if (shieldAmt) applyEffect(p, 'shield', { amount: shieldAmt, duration: a.duration });
      }
      if (a.knockbackAura) { for (const o of Object.values(state.players)) { if (!isEnemy(state, p.id, o)) continue; const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy); if (d > 0 && d < 260) { o.kvx += dx / d * a.knockbackAura; o.kvy += dy / d * a.knockbackAura; } } }
      if (a.effect) applyEffect(p, a.effect.kind, a.effect);
      if (a.trail) p.trail = { remaining: a.trail.duration || 3, spacing: a.trail.spacing || 42, lastx: p.x, lasty: p.y, zone: a.trail.zone };
      if (!silent) addFx(state, { type: 'buff', x: p.x, y: p.y, color: a.color, life: 0.4, radius: PLAYER_RADIUS * 2.2, vfx: a.vfx });
      break;
    case 'zone': {
      const baseX = clamp(p.x + cos * (a.range || 0), PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      const baseY = clamp(p.y + sin * (a.range || 0), PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      const n = a.count || 1;
      if (n <= 1) {
        // a.moving = 速度(px/s) → 沿面向推進的範圍區 (火牆/地裂線)
        const zopt = a.moving ? { ...a, vx: cos * a.moving, vy: sin * a.moving } : a;
        state.zones.push(makeZone(p.id, baseX, baseY, zopt));
      } else {
        // 散射多個範圍區 (隕石風暴/箭雨)；第一個落在瞄準中心，其餘於 scatter 半徑內
        const scatter = a.scatter || 120;
        for (let i = 0; i < n; i++) {
          let zx = baseX, zy = baseY;
          if (i > 0) {
            const ang = Math.random() * Math.PI * 2;
            const rr = Math.sqrt(Math.random()) * scatter;
            zx = clamp(baseX + Math.cos(ang) * rr, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
            zy = clamp(baseY + Math.sin(ang) * rr, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
          }
          const z = makeZone(p.id, zx, zy, a);
          if (a.delay) z.delay += i * (a.stagger || 0.16); // 錯開落點，連續轟炸
          state.zones.push(z);
        }
      }
      if (a.recoil) { p.kvx -= cos * a.recoil; p.kvy -= sin * a.recoil; }
      break;
    }
    // ======== 闖關模式魔王自訂動作 ========
    case 'summon_clones': bossSummonClones(state, p, a); break;
    case 'summon_minions': bossSummonMinions(state, p, a); break;
    case 'apply_scramble': {
      for (const o of Object.values(state.players)) {
        if (!isEnemy(state, p.id, o)) continue;
        if (dist(p.x, p.y, o.x, o.y) <= (a.radius || 320)) applyEffect(o, 'scramble', { duration: a.duration || 2 });
      }
      addFx(state, { type: 'buff', x: p.x, y: p.y, color: a.color, life: 0.5, radius: a.radius || 320 });
      break;
    }
    case 'time_rewind': bossTimeRewind(state, p, a); break;
    case 'soul_bind': bossSoulBind(state, p, a); break;
    case 'light_dark': bossLightDark(state, p, a); break;
    case 'mirror_players': bossMirrorPlayers(state, p, a); break;
    case 'steal_ultimate': bossStealUltimate(state, p, a); break;
  }
  if (a.self) applySelfBuff(p, a.self);
  if (a.ally) applyAllyBuff(state, p, a.ally); // 施放瞬間對友軍的 AoE 增益 (治療/護盾/減傷)
}

// ======== 魔王自訂動作實作 ========
function bossSummonClones(state, boss, a) {
  const n = a.count || 3;
  const clones = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const x = clamp(boss.x + Math.cos(ang) * 90, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const y = clamp(boss.y + Math.sin(ang) * 90, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const id = boss.id + '-clone-' + Math.random().toString(36).slice(2, 7);
    const c = makeBoss(id, boss.charId, x, y, BOSS_TEAM, { isFake: true, ownerId: boss.id, aiId: 'fake', maxHp: 1, scale: boss.scale, facing: boss.facing });
    state.players[id] = c;
    clones.push(c);
  }
  // 真身與隨機分身換位 (swapTell)
  if (clones.length && Math.random() < 0.6) {
    const c = clones[Math.floor(Math.random() * clones.length)];
    const tx = c.x, ty = c.y; c.x = boss.x; c.y = boss.y; boss.x = tx; boss.y = ty;
  }
  addFx(state, { type: 'blink', x: boss.x, y: boss.y, color: a.color, life: 0.4, radius: 90 });
}

function bossSummonMinions(state, boss, a) {
  const n = a.count || 3;
  const hp = Math.round((a.minionHp || 240) * (state._hpScale || 1));
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random();
    const x = clamp(boss.x + Math.cos(ang) * 110, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const y = clamp(boss.y + Math.sin(ang) * 110, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const id = boss.id + '-min-' + Math.random().toString(36).slice(2, 7);
    const m = makeBoss(id, a.minionCharId != null ? a.minionCharId : 7, x, y, BOSS_TEAM, { isMinion: true, ownerId: boss.id, aiId: 'minion', maxHp: hp, scale: 1 });
    state.players[id] = m;
  }
  addFx(state, { type: 'buff', x: boss.x, y: boss.y, color: a.color, life: 0.5, radius: 100 });
}

function bossTimeRewind(state, boss, a) {
  const back = Math.round((a.rewindSeconds || 3) * 30);
  for (const o of Object.values(state.players)) {
    if (!isEnemy(state, boss.id, o)) continue;
    if (a.dmg) dealDamage(state, o, a.dmg, boss.id);
    const h = o._hist;
    if (h && h.length) {
      const idx = Math.max(0, h.length - back);
      const pos = h[idx];
      o.x = clamp(pos.x, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      o.y = clamp(pos.y, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
      addFx(state, { type: 'blink', x: o.x, y: o.y, color: a.color, life: 0.3, radius: 50 });
    }
  }
  const en = Object.values(state.players).filter((o) => isEnemy(state, boss.id, o));
  if (en.length >= 2) {
    let i = Math.floor(Math.random() * en.length), j = Math.floor(Math.random() * en.length);
    if (j === i) j = (j + 1) % en.length;
    const A = en[i], B = en[j], tx = A.x, ty = A.y; A.x = B.x; A.y = B.y; B.x = tx; B.y = ty;
  }
  addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: a.color, life: 0.6, radius: a.radius || 150 });
}

function bossSoulBind(state, boss, a) {
  const en = Object.values(state.players).filter((o) => isEnemy(state, boss.id, o) && o.alive);
  if (en.length < 2) return;
  for (let i = en.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = en[i]; en[i] = en[j]; en[j] = t; }
  if (!state.tethers) state.tethers = [];
  const pairs = Math.floor(Math.min(a.count || 2, en.length) / 2);
  for (let k = 0; k < pairs; k++) {
    const x = en[k * 2], y = en[k * 2 + 1];
    state.tethers.push({ a: x.id, b: y.id, minGap: a.minGap || 200, dmg: a.dmg || 18, tick: a.tick || 0.5, tickTimer: 0.5, remaining: a.duration || 6 });
    addFx(state, { type: 'buff', x: x.x, y: x.y, color: a.color, life: 0.6, radius: 70 });
    addFx(state, { type: 'buff', x: y.x, y: y.y, color: a.color, life: 0.6, radius: 70 });
  }
}

function bossLightDark(state, boss, a) {
  const safeLeft = Math.random() < 0.5;
  const midX = ARENA.width / 2;
  for (const o of Object.values(state.players)) {
    if (!isEnemy(state, boss.id, o)) continue;
    const onLeft = o.x < midX;
    if (onLeft !== safeLeft) { // 站錯側
      dealDamage(state, o, a.dmg || 80, boss.id);
      o.kvx += (onLeft ? -1 : 1) * 220;
    }
  }
  addFx(state, { type: 'ultimate', x: midX, y: ARENA.height / 2, color: a.color, life: 0.7, radius: 220 });
}

function bossMirrorPlayers(state, boss, a) {
  const en = Object.values(state.players).filter((o) => o.team === 1 && o.alive);
  for (const o of en) {
    const x = clamp(boss.x + (o.x - boss.x) * 0.4, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const y = clamp(boss.y + 70, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const id = boss.id + '-mirror-' + o.id;
    if (state.players[id]) continue;
    const m = makeBoss(id, o.charId, x, y, BOSS_TEAM, { isMirror: true, ownerId: boss.id, aiId: 'mirror', maxHp: o.maxHp, scale: 1, name: '镜像' });
    state.players[id] = m;
    addFx(state, { type: 'blink', x, y, color: a.color, life: 0.4, radius: 70 });
  }
}

function bossStealUltimate(state, boss, a) {
  const en = Object.values(state.players).filter((o) => o.team === 1 && o.alive);
  if (!en.length) return;
  const victim = en[Math.floor(Math.random() * en.length)];
  const ult = getCharacter(victim.charId).ultimate;
  if (!ult) return;
  const tgt = en.reduce((b, o) => (dist(boss.x, boss.y, o.x, o.y) < dist(boss.x, boss.y, b.x, b.y) ? o : b), en[0]);
  boss.facing = Math.atan2(tgt.y - boss.y, tgt.x - boss.x);
  executeAction(state, boss, ult, { silent: true });
  addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: a.color, life: 0.6, radius: ult.radius || 140 });
}

// 開始蔀力 (chargeMax 技能: 均不打出，只記錄撇)
function tryStartCharge(p, a, slot) {
  if (p.chargeState) return; // 已在蔀力另一個技能，否戙
  p.chargeState = { slot, time: 0 }; // 開始蔀力，不消費償力/冷却
}

// 搹力技能確實發射：推進反寶對記錄 + 傷害贈旍
// 譯力時間贈旍: 1 + (chargeTime / chargeMax) * 最大 1 = 2x
function executeChargedAction(state, p, slot) {
  const c = getCharacter(p.charId);
  const a = c[slot];
  if (!a || !a.chargeMax) return;
  if (p.chargeState && p.chargeState.slot !== slot) return; // 無效例外
  const t = p.chargeState ? p.chargeState.time : 0;
  const ratio = Math.min(1, t / a.chargeMax); // 0~1
  const chargeFac = 1 + ratio;               // 傷害 1x~2x
  executeAction(state, p, a, { chargeFactor: chargeFac, chargeRatio: ratio });
  p.chargeState = null; // 清除蔀力
}

function tryAction(state, p, slot) {
  const c = getCharacter(p.charId);
  const a = c[slot];
  if (!a || p.cd[slot] > 0) return;
  // 如果是蔀力技能，開始蔀力而不是程せ打出
  if (a.chargeMax) {
    tryStartCharge(p, a, slot);
    return;
  }
  // 一般技能
  const freeMana = state.flags && state.flags.freeMana;
  if (!freeMana && a.manaCost && p.mana < a.manaCost) return;
  if (a.hpCost && p.hp <= a.hpCost) return;
  if (!freeMana && a.manaCost) p.mana -= a.manaCost;
  if (a.hpCost) p.hp -= a.hpCost;
  p.cd[slot] = a.cd;
  executeAction(state, p, a);
}

// 大絕招：需能量槽滿槽。不耗 mana/hp，改消耗能量。
function tryUltimate(state, p) {
  const c = getCharacter(p.charId);
  const a = c.ultimate;
  if (!a) return;
  if (p.cd.ultimate > 0) return;
  const freeMana = state.flags && state.flags.freeMana;
  const isAI = p.isBoss || p.aiId; // 魔王/召喚物/镜像：大招改為純 cd 閘，不用能量槽
  if (!isAI) {
    if (!freeMana && (p.ult || 0) < ULT_MAX) return;
    if (!freeMana) p.ult = 0;
  }
  p.cd.ultimate = a.cd || ULT_LOCKOUT;
  executeAction(state, p, a, { silent: true });
  // 單一大招施放特效 (螢幕級華麗表現由 vfx onCast 處理)
  addFx(state, { type: 'ultimate', x: p.x, y: p.y, facing: p.facing, color: a.color, life: 0.7, radius: a.radius || 140, vfx: a.vfx });
}

function resolveCollisions(state) {
  const arr = Object.values(state.players).filter((p) => p.alive);
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      const minD = bodyR(a) + bodyR(b);
      if (d < minD) {
        // 完全重疊 (d≈0) 時給一個預設分離方向，避免除以零卡死在中心
        const nx = d > 0.0001 ? dx / d : 1, ny = d > 0.0001 ? dy / d : 0;
        const overlap = minD - d;
        // 魔王/部位為重型 (不被推開，位置由腳本控制)；只把輕量一方推出體外
        const aHeavy = a.isBoss || a.isPart, bHeavy = b.isBoss || b.isPart;
        if (aHeavy && bHeavy) continue;
        if (aHeavy) { b.x += nx * overlap; b.y += ny * overlap; }
        else if (bHeavy) { a.x -= nx * overlap; a.y -= ny * overlap; }
        else { const push = overlap / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
      }
    }
  }
}

// 投射物分裂：到期/命中時於當前位置生成 N 顆子彈，繞當前速度向量散開 (子彈不再分裂)
function splitProjectile(state, pr, out) {
  const s = pr.split;
  const n = Math.max(2, s.count || 6);
  const base = Math.atan2(pr.vy, pr.vx);
  const full = (s.spread ?? Math.PI * 2) >= Math.PI * 2 - 1e-3;
  const speed = s.speed || Math.hypot(pr.vx, pr.vy) || 360;
  for (let i = 0; i < n; i++) {
    const ang = full
      ? base + (i / n) * Math.PI * 2
      : base + (i - (n - 1) / 2) * ((s.spread ?? 1) / Math.max(1, n - 1));
    const c = Math.cos(ang), sn = Math.sin(ang);
    out.push(makeProjectile(pr.owner, pr.x, pr.y, c * speed, sn * speed, {
      dmg: s.dmg ?? pr.dmg, radius: s.radius ?? pr.radius, lifetime: s.lifetime ?? 0.8,
      color: s.color || pr.color, knockback: s.knockback ?? 0, pierce: !!s.pierce,
      effect: s.effect || pr.effect, vfx: s.vfx || pr.vfx,
    }));
  }
  addFx(state, { type: 'hit', x: pr.x, y: pr.y, color: s.color || pr.color, life: 0.22, radius: (pr.radius || 8) * 2.4, vfx: pr.vfx });
}

function updateProjectiles(state, dt) {
  const keep = [];
  const spawned = []; // 分裂產生的子彈，迴圈結束後一併加入
  for (const pr of state.projectiles) {
    // 追蹤：朝最近敵人轉向 (限制每秒轉向速率)
    if (pr.homing) {
      let best = null, bd = Infinity;
      for (const o of Object.values(state.players)) {
        if (!isEnemy(state, pr.owner, o)) continue;
        const d = dist(pr.x, pr.y, o.x, o.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        const desired = Math.atan2(best.y - pr.y, best.x - pr.x);
        const cur = Math.atan2(pr.vy, pr.vx);
        let diff = angleDiff(desired, cur);
        const maxTurn = pr.homing * dt;
        if (diff > maxTurn) diff = maxTurn; else if (diff < -maxTurn) diff = -maxTurn;
        const na = cur + diff, sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.lifetime -= dt;
    const oob = pr.x < 0 || pr.y < 0 || pr.x > ARENA.width || pr.y > ARENA.height;
    if (pr.lifetime <= 0 || oob) {
      if (pr.split && !oob) splitProjectile(state, pr, spawned); // 飛行到期於界內爆散
      if (pr.leaveZone && !oob) state.zones.push(makeZone(pr.owner, pr.x, pr.y, pr.leaveZone)); // 毒池
      continue;
    }
    let dead = false;
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, pr.owner, o) || pr.hit[o.id]) continue;
      if (dist(pr.x, pr.y, o.x, o.y) <= pr.radius + bodyR(o)) {
        // 凍結加成：目標處於封凍狀態(stun)時傷害提升 (烎燃溶冰組合)
        const hitDmg = (pr.freezeBonus && o.effects && o.effects.stun) ? pr.dmg * pr.freezeBonus : pr.dmg;
        dealDamage(state, o, hitDmg, pr.owner);
        if (pr.knockback) {
          const l = Math.hypot(pr.vx, pr.vy) || 1;
          o.kvx += (pr.vx / l) * pr.knockback; o.kvy += (pr.vy / l) * pr.knockback;
        }
        // 鉤索：把命中的目標拉到擁有者面前
        if (pr.pull) {
          const owner = state.players[pr.owner];
          if (owner && owner.alive) {
            const dx = owner.x - o.x, dy = owner.y - o.y, d = Math.hypot(dx, dy) || 1;
            const gap = PLAYER_RADIUS * 2 + (pr.pull.gap || 24);
            o.x = clamp(owner.x - dx / d * gap, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
            o.y = clamp(owner.y - dy / d * gap, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
          }
        }
        if (pr.effect) applyEffectFrom(state, o, pr.effect, pr.owner);
        addFx(state, { type: 'hit', x: pr.x, y: pr.y, color: pr.color, life: 0.2, radius: pr.radius * 2, vfx: pr.vfx });
        pr.hit[o.id] = true;
        if (!pr.pierce) { dead = true; break; }
      }
    }
    if (dead) {
      if (pr.split) splitProjectile(state, pr, spawned); // 命中爆散
      if (pr.leaveZone) state.zones.push(makeZone(pr.owner, pr.x, pr.y, pr.leaveZone)); // 毒池
      continue;
    }
    keep.push(pr);
  }
  state.projectiles = spawned.length ? keep.concat(spawned) : keep;
}

function updateZones(state, dt) {
  const keep = [];
  for (const z of state.zones) {
    // 跟隨擁有者 (光環)；擁有者死亡則消散
    if (z.follow != null) {
      const ow = state.players[z.follow];
      if (!ow || !ow.alive) continue;
      z.x = ow.x; z.y = ow.y;
    }
    // 移動範圍區 (火牆/地裂線)
    if (z.vx || z.vy) {
      z.x = clamp(z.x + z.vx * dt, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
      z.y = clamp(z.y + z.vy * dt, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    }
    if (z.delay > 0) {
      z.delay -= dt;
      if (z.delay > 0) { keep.push(z); continue; }
      addFx(state, { type: 'hit', x: z.x, y: z.y, color: z.color, life: 0.3, radius: z.radius, vfx: z.vfx });
    }
    // 向心吸引 (黑洞/擒抱)：每幀把圈內敵人拉向中心
    if (z.pull) {
      for (const o of Object.values(state.players)) {
        if (!isEnemy(state, z.owner, o)) continue;
        const dx = z.x - o.x, dy = z.y - o.y, d = Math.hypot(dx, dy);
        if (d > 4 && d <= z.radius + bodyR(o)) {
          const f = Math.min(d, z.pull * dt);
          o.x = clamp(o.x + dx / d * f, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
          o.y = clamp(o.y + dy / d * f, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
        }
      }
    }
    z.lifetime -= dt;
    z.tickTimer -= dt;
    if (z.tickTimer <= 0) {
      z.tickTimer += z.tick;
      let hits = 0;
      for (const o of Object.values(state.players)) {
        if (!o.alive) continue;
        if (dist(z.x, z.y, o.x, o.y) > z.radius + bodyR(o)) continue;
        if (isEnemy(state, z.owner, o)) {
          if (z.dmg) dealDamage(state, o, z.dmg, z.owner);
          if (z.effect) applyEffectFrom(state, o, z.effect, z.owner);
          if (z.knockback) { const dx = o.x - z.x, dy = o.y - z.y, d = Math.hypot(dx, dy) || 1; o.kvx += dx / d * z.knockback; o.kvy += dy / d * z.knockback; }
          hits++;
        } else if (z.allyHeal && isAlly(state, z.owner, o)) {
          o.hp = Math.min(o.maxHp, o.hp + z.allyHeal); // 友方光環持續回血 (含自己)
        }
      }
      // 範圍汲取：依命中敵數回復擁有者 (治療師大招)
      if (z.drainHeal && hits > 0) {
        const ow = state.players[z.owner];
        if (ow && ow.alive) ow.hp = Math.min(ow.maxHp, ow.hp + z.drainHeal * hits);
      }
    }
    if (z.lifetime > 0) keep.push(z);
  }
  state.zones = keep;
}

function updateFx(state, dt) {
  for (const f of state.fx) f.life -= dt;
  state.fx = state.fx.filter((f) => f.life > 0);
}

function checkWin(state) {
  if (state.phase !== 'playing') return;
  const alive = Object.values(state.players).filter((p) => p.alive);
  // 存活「陣營」數：team>0 以隊伍號計，team 0 (單人) 各自為一方
  const sides = new Set();
  for (const p of alive) sides.add(p.team > 0 ? 't' + p.team : 'p' + p.id);
  if (state.startCount >= 2 && sides.size <= 1) {
    state.phase = 'gameover';
    state.winner = alive.length >= 1 ? alive[0].id : null;
    state.winnerTeam = alive.length >= 1 ? (alive[0].team || 0) : 0;
  }
}

// 腳本化位移：衝鋒(撞敵即停)與躍擊(拋向定點落地 AoE)。回傳 true 表示本 tick 由其接管移動。
function processScripted(state, p, dt) {
  if (p.charge) {
    const c = p.charge;
    const advance = c.speed * dt;
    const nx = p.x + c.dx * advance, ny = p.y + c.dy * advance;
    const cx = clamp(nx, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    const cy = clamp(ny, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    const hitWall = (cx !== nx) || (cy !== ny);
    p.x = cx; p.y = cy;
    c.dist -= advance;
    let hitSomeone = false;
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, p.id, o) || c.hit[o.id]) continue;
      if (dist(p.x, p.y, o.x, o.y) <= c.hitRadius + bodyR(o)) {
        if (c.dmg) dealDamage(state, o, c.dmg, p.id);
        if (c.knockback) { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1; o.kvx += dx / d * c.knockback; o.kvy += dy / d * c.knockback; }
        if (c.effect) applyEffectFrom(state, o, c.effect, p.id);
        c.hit[o.id] = true;
        hitSomeone = true;
      }
    }
    p.vx = 0; p.vy = 0;
    if (hitSomeone && c.stopOnHit) { addFx(state, { type: 'hit', x: p.x, y: p.y, color: c.color, life: 0.26, radius: c.hitRadius * 1.4, vfx: c.vfx }); p.charge = null; }
    else if (hitWall && c.wallStun) { // R3 燔岩鐵衛：衝鑄撞牆未命中→自暈 (開窗)
      applyEffect(p, 'stun', { duration: c.wallStun });
      addFx(state, { type: 'hit', x: p.x, y: p.y, color: c.color, life: 0.5, radius: c.hitRadius * 1.8, vfx: c.vfx });
      p.charge = null;
    }
    else if (c.dist <= 0) p.charge = null;
    return true;
  }
  if (p.leap) {
    const l = p.leap;
    l.t += dt;
    const k = Math.min(1, l.t / l.dur);
    p.x = clamp(l.fromx + (l.tx - l.fromx) * k, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    p.y = clamp(l.fromy + (l.ty - l.fromy) * k, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    p.vx = 0; p.vy = 0;
    if (k >= 1) {
      meleeHit(state, p, { dmg: l.dmg, range: l.radius, arc: 7, knockback: l.knockback, effect: l.effect, vfx: l.vfx }, false);
      addFx(state, { type: 'hit', x: p.x, y: p.y, color: l.color, life: 0.3, radius: l.radius, vfx: l.vfx });
      if (l.leaveZone) state.zones.push(makeZone(p.id, p.x, p.y, l.leaveZone));
      p.leap = null;
    }
    return true;
  }
  return false;
}

// 汲取鏈：每跳鎖定範圍內最近敵人，傷害並回復自身。
function processChannel(state, p, dt) {
  const ch = p.channel;
  if (!ch) return;
  ch.remaining -= dt; ch.tickTimer -= dt;
  if (ch.tickTimer <= 0) {
    ch.tickTimer += ch.tick;
    let best = null, bd = Infinity;
    for (const o of Object.values(state.players)) {
      if (!isEnemy(state, p.id, o)) continue;
      const d = dist(p.x, p.y, o.x, o.y);
      if (d <= ch.range && d < bd) { bd = d; best = o; }
    }
    if (best) {
      dealDamage(state, best, ch.dmg, p.id);
      if (ch.heal) p.hp = Math.min(p.maxHp, p.hp + ch.heal);
      if (ch.effect) applyEffectFrom(state, best, ch.effect, p.id);
      addFx(state, { type: 'hit', x: best.x, y: best.y, color: ch.color, life: 0.2, radius: 20, vfx: ch.vfx });
    }
  }
  if (ch.remaining <= 0) p.channel = null;
}

// 移動留痕：移動超過間距即在腳下生成範圍區 (冰霜足跡)。
function processTrail(state, p, dt) {
  const tr = p.trail;
  if (!tr) return;
  tr.remaining -= dt;
  if (dist(p.x, p.y, tr.lastx, tr.lasty) >= tr.spacing) {
    state.zones.push(makeZone(p.id, p.x, p.y, tr.zone));
    tr.lastx = p.x; tr.lasty = p.y;
  }
  if (tr.remaining <= 0) p.trail = null;
}

// 一個固定步的權威模擬
export function step(state, inputs, dt) {
  if (state.phase !== 'playing') return;
  state.time += dt;

  for (const p of Object.values(state.players)) {
    if (!p.alive) continue;
    let input = inputs[p.id] || EMPTY_INPUT;
    // 魔王/召喚物/镜像：以 AI 計算輸入取代鍵盤 (僅 fighting 階段行動；host-only 運算)
    if (p.aiId && state.mode === 'boss') {
      input = state.roundPhase === 'fighting' ? computeBossInput(state, p, dt) : EMPTY_INPUT;
    }
    const talent = getCharacter(p.charId).talent;

    // 攻速天賦 (狂戰士嗜血狂暴：殘血加速冷卻回復)
    let cdRate = 1;
    if (talent && talent.id === 'bloodlust') cdRate = 1 + (talent.haste || 0.6) * missingHp(p);
    // 應用全局冷卻乘數 (COOLDOWN_MULTIPLIER)
    cdRate /= COOLDOWN_MULTIPLIER;
    for (const k of ['basic', 'skill1', 'skill2', 'ultimate']) p.cd[k] = Math.max(0, p.cd[k] - dt * cdRate);
    if (state.flags && state.flags.noCooldown) { for (const k of ['basic', 'skill1', 'skill2', 'ultimate']) p.cd[k] = 0; }

    for (const kind of Object.keys(p.effects)) {
      const e = p.effects[kind];
      e.remaining -= dt;
      if (kind === 'burn') {
        e.tickTimer -= dt;
        if (e.tickTimer <= 0) { e.tickTimer += e.tick; dealDamage(state, p, e.dmg, e.srcId); addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#ff6b3d', life: 0.3, radius: PLAYER_RADIUS }); }
      } else if (kind === 'bleed') {
        const moving = (Math.abs(p.vx) + Math.abs(p.vy)) > 1; // 移動中流血加速 (用上一 tick 速度)
        e.tickTimer -= dt * (moving ? e.moveMult : 1);
        if (e.tickTimer <= 0) { e.tickTimer += e.tick; dealDamage(state, p, e.dmg, e.srcId); addFx(state, { type: 'burn', x: p.x, y: p.y, color: '#e84141', life: 0.3, radius: PLAYER_RADIUS }); }
      } else if (kind === 'chill') {
        if (e.stacks >= e.max && !e.froze) {
          e.froze = true;
          applyEffect(p, 'stun', { duration: e.freezeDur });
          applyEffect(p, 'frozen', { duration: e.freezeDur }); // 凍結視覺標記，供渲染器顯示冰晶效果
          e.remaining = 0;
          addFx(state, { type: 'hit', x: p.x, y: p.y, color: '#9fe8ff', life: 0.4, radius: PLAYER_RADIUS * 2.5, vfx: 'mage_iceshard' });
        }
      }
      if (e.remaining <= 0) delete p.effects[kind];
    }
    if (!p.alive) continue; // 燃燒/流血等 DoT 可能在本迴圈擊殺

    if (p.comboTimer > 0) { p.comboTimer -= dt; if (p.comboTimer <= 0) p.combo = 0; } // 連擊衰減
    if (talent && talent.id === 'lifebloom') p.hp = Math.min(p.maxHp, p.hp + (talent.regen || 6) * dt); // 持續回血

    if (p.shieldTime > 0) { p.shieldTime -= dt; if (p.shieldTime <= 0) p.shield = 0; }

    p.mana = Math.min(p.maxMana, p.mana + MANA_REGEN * dt);
    p.ult = Math.min(ULT_MAX, (p.ult || 0) + ULT_REGEN * dt); // 被動充能
    if (state.flags && state.flags.freeMana) { p.mana = p.maxMana; p.ult = ULT_MAX; }

    processChannel(state, p, dt); // 汲取鏈 (不限制移動)

    const scripted = processScripted(state, p, dt); // 衝鋒/躍擊進行中接管移動
    if (!scripted) {
      applyMovement(p, input, dt);

      // 煙遁天賦 (忍者)：靜止一段時間自動短隱身
      if (talent && talent.id === 'smoke') {
        const moving = (Math.abs(p.vx) + Math.abs(p.vy)) > 1;
        if (moving) p.still = 0; else p.still += dt;
        if (p.still >= (talent.delay || 1.5)) {
          const cur = p.effects.invis;
          if (!cur || cur.remaining < (talent.linger || 0.5)) applyEffect(p, 'invis', { duration: talent.linger || 0.5, speed: 1.0 });
        }
      }

      processTrail(state, p, dt); // 移動留痕 (冰霜足跡)

      // 蓄力技能：每幀累計時間，鬆開時發射
      if (p.chargeState) {
        if (input[p.chargeState.slot]) {
          // 還在按著：累計蓄力時間
          const a = getCharacter(p.charId)[p.chargeState.slot];
          p.chargeState.time = Math.min(p.chargeState.time + dt, a?.chargeMax || 5);
        } else {
          // 鬆開了：檢查魔力並發射
          const slot = p.chargeState.slot;
          const a = getCharacter(p.charId)[slot];
          const freeMana = state.flags && state.flags.freeMana;
          if (a && (!freeMana && a.manaCost ? p.mana >= a.manaCost : true)) {
            if (!freeMana && a.manaCost) p.mana -= a.manaCost;
            p.cd[slot] = a.cd;
            executeChargedAction(state, p, slot);
          } else {
            p.chargeState = null; // 魔力不足，取消
          }
        }
      }

      if (!p.effects.stun) {
        if (input.basic) tryAction(state, p, 'basic');
        if (input.skill1) tryAction(state, p, 'skill1');
        if (input.skill2) tryAction(state, p, 'skill2');
        if (input.ultimate) tryUltimate(state, p);
      }
    }
  }

  resolveCollisions(state);
  updateProjectiles(state, dt);
  updateZones(state, dt);
  updateFx(state, dt);
  if (state.mode === 'boss') { bossTick(state, dt); checkBossRound(state, dt); }
  else checkWin(state);
}
