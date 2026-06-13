// 權威模擬：僅由房主執行。applyMovement 也供加入者本機預測使用。

import { ARENA, PLAYER_RADIUS, MANA_REGEN, KNOCKBACK_FRICTION, ULT_MAX, ULT_REGEN, ULT_LOCKOUT, COOLDOWN_MULTIPLIER } from './constants.js';
import { getCharacter } from './characters.js';
import { EMPTY_INPUT } from './input.js';
import {
  clamp, dist, angleDiff, makeProjectile, makeZone,
  dealDamage, applyEffect, addFx, missingHp,
} from './entities.js';

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
  if (!p.effects.stun) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx || dy) {
      const l = Math.hypot(dx, dy);
      dx /= l; dy /= l;
      p.facing = Math.atan2(dy, dx);
      if (rooted) { p.vx = 0; p.vy = 0; }
      else { const s = speedOf(p); p.vx = dx * s; p.vy = dy * s; }
    } else { p.vx = 0; p.vy = 0; }
  } else { p.vx = 0; p.vy = 0; }

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

function meleeHit(state, p, a, silent) {
  const m = outMult(p, a);
  const full = a.arc >= 6;
  for (const o of Object.values(state.players)) {
    if (o.id === p.id || !o.alive) continue;
    const dx = o.x - p.x, dy = o.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > a.range + PLAYER_RADIUS) continue;
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

function executeAction(state, p, a, opts = {}) {
  const silent = !!opts.silent; // 大招以單一 'ultimate' fx 取代動作自身的施放 fx，避免重複觸發
  const cos = Math.cos(p.facing), sin = Math.sin(p.facing);
  switch (a.type) {
    case 'projectile': {
      const m = outMult(p, a);
      const n = a.count || 1;
      for (let i = 0; i < n; i++) {
        const ang = p.facing + (i - (n - 1) / 2) * (a.spread || 0);
        const c = Math.cos(ang), s = Math.sin(ang);
        state.projectiles.push(makeProjectile(
          p.id, p.x + c * PLAYER_RADIUS, p.y + s * PLAYER_RADIUS,
          c * a.speed, s * a.speed,
          { dmg: a.dmg * m, radius: a.radius, lifetime: a.lifetime, color: a.color, knockback: a.knockback, pierce: a.pierce, effect: a.effect, split: a.split, homing: a.homing, vfx: a.vfx }
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
        stopOnHit: a.stopOnHit !== false, color: a.color, vfx: a.vfx, hit: {},
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
        effect: a.effect || null, color: a.color, vfx: a.vfx,
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
      const cands = Object.values(state.players).filter((o) => o.id !== p.id && o.alive);
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
      if (a.shield) applyEffect(p, 'shield', { amount: a.shield, duration: a.duration });
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
  }
  if (a.self) applySelfBuff(p, a.self);
}

function tryAction(state, p, slot) {
  const c = getCharacter(p.charId);
  const a = c[slot];
  if (!a || p.cd[slot] > 0) return;
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
  if (!freeMana && (p.ult || 0) < ULT_MAX) return;
  if (!freeMana) p.ult = 0;
  p.cd.ultimate = a.cd || ULT_LOCKOUT;
  executeAction(state, p, a, { silent: true });
  // 單一大招施放特效 (螢幕級華麗表現由 vfx onCast 處理)
  addFx(state, { type: 'ultimate', x: p.x, y: p.y, facing: p.facing, color: a.color, life: 0.7, radius: a.radius || 140, vfx: a.vfx });
}

function resolveCollisions(state) {
  const arr = Object.values(state.players).filter((p) => p.alive);
  const minD = PLAYER_RADIUS * 2;
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      const a = arr[i], b = arr[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.hypot(dx, dy);
      if (d > 0 && d < minD) {
        const push = (minD - d) / 2;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
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
        if (o.id === pr.owner || !o.alive) continue;
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
      continue;
    }
    let dead = false;
    for (const o of Object.values(state.players)) {
      if (o.id === pr.owner || !o.alive || pr.hit[o.id]) continue;
      if (dist(pr.x, pr.y, o.x, o.y) <= pr.radius + PLAYER_RADIUS) {
        dealDamage(state, o, pr.dmg, pr.owner);
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
        if (o.id === z.owner || !o.alive) continue;
        const dx = z.x - o.x, dy = z.y - o.y, d = Math.hypot(dx, dy);
        if (d > 4 && d <= z.radius + PLAYER_RADIUS) {
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
        if (o.id === z.owner || !o.alive) continue;
        if (dist(z.x, z.y, o.x, o.y) <= z.radius + PLAYER_RADIUS) {
          dealDamage(state, o, z.dmg, z.owner);
          if (z.effect) applyEffectFrom(state, o, z.effect, z.owner);
          if (z.knockback) { const dx = o.x - z.x, dy = o.y - z.y, d = Math.hypot(dx, dy) || 1; o.kvx += dx / d * z.knockback; o.kvy += dy / d * z.knockback; }
          hits++;
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
  if (state.startCount >= 2 && alive.length <= 1) {
    state.phase = 'gameover';
    state.winner = alive.length === 1 ? alive[0].id : null;
  }
}

// 腳本化位移：衝鋒(撞敵即停)與躍擊(拋向定點落地 AoE)。回傳 true 表示本 tick 由其接管移動。
function processScripted(state, p, dt) {
  if (p.charge) {
    const c = p.charge;
    const advance = c.speed * dt;
    p.x = clamp(p.x + c.dx * advance, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
    p.y = clamp(p.y + c.dy * advance, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
    c.dist -= advance;
    let hitSomeone = false;
    for (const o of Object.values(state.players)) {
      if (o.id === p.id || !o.alive || c.hit[o.id]) continue;
      if (dist(p.x, p.y, o.x, o.y) <= c.hitRadius + PLAYER_RADIUS) {
        if (c.dmg) dealDamage(state, o, c.dmg, p.id);
        if (c.knockback) { const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy) || 1; o.kvx += dx / d * c.knockback; o.kvy += dy / d * c.knockback; }
        if (c.effect) applyEffectFrom(state, o, c.effect, p.id);
        c.hit[o.id] = true;
        hitSomeone = true;
      }
    }
    p.vx = 0; p.vy = 0;
    if (hitSomeone && c.stopOnHit) { addFx(state, { type: 'hit', x: p.x, y: p.y, color: c.color, life: 0.26, radius: c.hitRadius * 1.4, vfx: c.vfx }); p.charge = null; }
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
      if (o.id === p.id || !o.alive) continue;
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
    const input = inputs[p.id] || EMPTY_INPUT;
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
        if (e.stacks >= e.max && !e.froze) { e.froze = true; applyEffect(p, 'stun', { duration: e.freezeDur }); e.remaining = 0; addFx(state, { type: 'hit', x: p.x, y: p.y, color: '#9fe8ff', life: 0.3, radius: PLAYER_RADIUS * 1.6 }); }
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
  checkWin(state);
}
