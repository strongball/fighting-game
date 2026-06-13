// 實體工廠、數學工具、傷害/效果輔助

import { ARENA, PLAYER_RADIUS, ULT_MAX, ULT_GAIN_DEAL, ULT_GAIN_TAKE } from './constants.js';
import { getCharacter } from './characters.js';

let _id = 1;
export function uid() { return _id++; }

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function makePlayer(id, name, charId, x, y) {
  const c = getCharacter(charId);
  return {
    id, name, charId,
    x, y, vx: 0, vy: 0, kvx: 0, kvy: 0, facing: 0,
    hp: c.maxHp, maxHp: c.maxHp,
    mana: c.maxMana, maxMana: c.maxMana,
    alive: true,
    shield: 0, shieldTime: 0,
    kills: 0,
    ult: 0, // 終極能量 (0..ULT_MAX)
    cd: { basic: 0, skill1: 0, skill2: 0, ultimate: 0 },
    effects: {}, // kind -> { remaining, factor?, speed?, dmg? }
    // 主機端腳本化狀態 (隨 snapshot 序列化，加入者僅讀位置不需用到)
    charge: null,   // 衝鋒即停 { dx,dy,speed,dist,dmg,hitRadius,knockback,effect,stopOnHit,color,vfx,hit }
    leap: null,     // 躍擊 { t,dur,fromx,fromy,tx,ty,dmg,radius,knockback,effect,color,vfx }
    channel: null,  // 持續鏈 (汲取) { kind,remaining,tick,tickTimer,range,dmg,heal,effect,color,vfx }
    trail: null,    // 移動留痕 { remaining,spacing,lastx,lasty,zone }
    still: 0,       // 靜止累計秒數 (忍者煙遁天賦)
    combo: 0, comboTimer: 0, // 連擊層數 (格鬥家天賦)
  };
}

export function spawnPoints(n) {
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  const r = Math.min(ARENA.width, ARENA.height) * 0.38;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

export function createInitialState(playersArr, flags = {}) {
  const pts = spawnPoints(playersArr.length);
  const players = {};
  const cx = ARENA.width / 2, cy = ARENA.height / 2;
  playersArr.forEach((p, i) => {
    const pl = makePlayer(p.id, p.name, p.charId, pts[i].x, pts[i].y);
    pl.facing = Math.atan2(cy - pts[i].y, cx - pts[i].x); // 一開始面向中心
    players[p.id] = pl;
  });
  return {
    phase: 'playing',
    players,
    projectiles: [],
    zones: [],
    fx: [],          // 短暫視覺特效
    time: 0,
    winner: null,
    startCount: playersArr.length,
    flags: { freeMana: false, noCooldown: false, noDamage: false, ...flags },
  };
}

export function makeProjectile(owner, x, y, vx, vy, opt) {
  return {
    id: uid(), owner, x, y, vx, vy,
    dmg: opt.dmg, radius: opt.radius, lifetime: opt.lifetime,
    color: opt.color, knockback: opt.knockback || 0,
    pierce: !!opt.pierce, effect: opt.effect || null,
    split: opt.split || null, // 到期/命中時分裂成多顆子彈 { count, dmg, speed, radius, lifetime, spread?, color?, knockback?, effect?, vfx? }
    homing: opt.homing || 0,  // 追蹤轉向速率 (rad/s)，0 = 直線
    pull: opt.pull || null,   // 命中時把目標拉向擁有者 (鉤爪) { gap }
    vfx: opt.vfx || null,
    hit: {},
  };
}

export function makeZone(owner, x, y, opt) {
  return {
    id: uid(), owner, x, y,
    radius: opt.radius, dmg: opt.dmg,
    lifetime: opt.lifetime, tick: opt.tick, tickTimer: 0,
    delay: opt.delay || 0,
    effect: opt.effect || null, color: opt.color,
    knockback: opt.knockback || 0,                // tick 時把命中敵人推離中心 (地裂線/震地)
    vx: opt.vx || 0, vy: opt.vy || 0,           // 移動範圍區 (火牆/地裂線)
    follow: opt.follow ? owner : null,          // 跟隨擁有者 (光環)
    pull: opt.pull || 0,                        // 每秒朝中心吸引強度 (黑洞/擒抱)
    drainHeal: opt.drainHeal || 0,              // 每跳每命中一名敵人回復擁有者血量 (範圍汲取)
    vfx: opt.vfx || null,
  };
}

export function addFx(state, fx) {
  fx.id = uid();
  fx.life = fx.life ?? 0.25;
  fx.maxLife = fx.life;
  state.fx.push(fx);
  if (state.fx.length > 120) state.fx.shift();
}

export const missingHp = (p) => 1 - p.hp / p.maxHp;

// 天賦傷害修正 (攻擊者增傷 / 受害者減傷)；回傳修正後傷害。純函式，副作用(回魔/連擊/吸血)在 dealDamage 內處理。
function talentDamageMods(attacker, target, amount) {
  let dmg = amount;
  if (attacker && attacker.alive) {
    const at = getCharacter(attacker.charId).talent;
    if (at) {
      if (at.id === 'deadeye') { // 弓箭手：對越遠的敵人傷害越高
        const d = Math.hypot(target.x - attacker.x, target.y - attacker.y);
        dmg *= 1 + (at.bonus || 0.5) * Math.min(1, d / (at.range || 520));
      } else if (at.id === 'lethal') { // 刺客：隱身或背刺爆擊
        const behind = Math.abs(angleDiff(Math.atan2(attacker.y - target.y, attacker.x - target.x), target.facing)) > Math.PI - (at.arc || 1.2);
        if ((attacker.effects && attacker.effects.invis) || behind) dmg *= 1 + (at.bonus || 0.6);
      } else if (at.id === 'momentum') { // 格鬥家：連擊層數增傷
        const s = Math.min(at.maxStacks || 5, attacker.combo || 0);
        if (s > 0) dmg *= 1 + s * (at.perStack || 0.1);
      }
    }
  }
  const tt = getCharacter(target.charId).talent;
  if (tt) {
    if (tt.id === 'unbreakable') dmg *= 1 - (tt.maxDr || 0.35) * missingHp(target); // 戰士：越殘血減傷越高
    else if (tt.id === 'bulwark') dmg *= 1 - (tt.dr || 0.12);                         // 坦克：固定減傷
  }
  return dmg;
}

export function dealDamage(state, target, amount, attackerId, opts = {}) {
  if (!target.alive || amount <= 0) return;
  // 終極能量充能：攻擊者依造成傷害累積
  const attacker = state.players[attackerId];
  const hostile = attacker && attacker.id !== target.id && attacker.alive;
  if (hostile) attacker.ult = Math.min(ULT_MAX, (attacker.ult || 0) + amount * ULT_GAIN_DEAL);

  // 不扣血模式：能量充能仍生效，但不造成實際傷害
  if (state.flags && state.flags.noDamage) return;

  let dmg = amount;
  if (!opts.noTalent && hostile) dmg = talentDamageMods(attacker, target, dmg);
  // 死亡印記：受傷放大 (刺客標記引爆體系)
  if (target.effects && target.effects.mark) dmg *= 1 + target.effects.mark.bonus;

  // 荊棘反傷：依「嘗試造成的傷害」彈回攻擊者，即使被護盾吸收仍反彈
  // (反震盾/招架本身會附帶護盾，若只反彈穿透傷害會完全失效)
  if (!opts.noReflect && hostile && target.effects && target.effects.reflect) {
    const rdmg = dmg * (target.effects.reflect.factor || 0);
    if (rdmg > 0) dealDamage(state, attacker, rdmg, target.id, { noReflect: true, noTalent: true });
  }

  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg <= 0) return;
  // 受害者依實際承受傷害累積 (逆境快充)
  target.ult = Math.min(ULT_MAX, (target.ult || 0) + dmg * ULT_GAIN_TAKE);
  target.hp -= dmg;

  // 吸血：攻擊者若有 lifesteal 效果，依實際造成傷害回血
  if (hostile && attacker.effects && attacker.effects.lifesteal) {
    const ls = dmg * (attacker.effects.lifesteal.factor || 0);
    if (ls > 0) attacker.hp = Math.min(attacker.maxHp, attacker.hp + ls);
  }
  // 天賦命中副作用 (回魔 / 嗜血吸血 / 連擊累積)
  if (!opts.noTalent && hostile) {
    const at = getCharacter(attacker.charId).talent;
    if (at) {
      if (at.id === 'arcane_flow') attacker.mana = Math.min(attacker.maxMana, attacker.mana + (at.mana || 8));
      else if (at.id === 'bloodlust') {
        const ls = dmg * (at.lifesteal || 0.25) * (0.4 + missingHp(attacker));
        if (ls > 0) attacker.hp = Math.min(attacker.maxHp, attacker.hp + ls);
      } else if (at.id === 'momentum') { attacker.combo = Math.min(at.maxStacks || 5, (attacker.combo || 0) + 1); attacker.comboTimer = at.window || 2.2; }
    }
  }

  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    const killer = state.players[attackerId];
    if (killer && killer.id !== target.id) killer.kills++;
    addFx(state, { type: 'death', x: target.x, y: target.y, color: '#ffffff', life: 0.5, radius: PLAYER_RADIUS * 2 });
  }
}

export function applyEffect(p, kind, data, srcId) {
  if (kind === 'heal') { p.hp = Math.min(p.maxHp, p.hp + data.amount); return; }
  if (kind === 'shield') {
    p.shield = Math.max(p.shield, data.amount);
    p.shieldTime = Math.max(p.shieldTime, data.duration);
    return;
  }
  if (kind === 'cleanse') {
    delete p.effects.slow; delete p.effects.stun; delete p.effects.burn;
    delete p.effects.bleed; delete p.effects.chill; delete p.effects.root; delete p.effects.mark;
    return;
  }
  if (kind === 'burn') {
    // 燃燒 DoT：疊加刷新取較高傷害與較長時間；srcId 供擊殺計分/終極充能
    const cur = p.effects.burn;
    const tick = data.tick || 0.5;
    p.effects.burn = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3),
      tick,
      tickTimer: cur ? cur.tickTimer : tick,
      dmg: Math.max(cur ? cur.dmg : 0, data.dmg || 0),
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'bleed') {
    // 流血 DoT：與燃燒類似，但目標「移動時」每跳更快 (剋逃跑/追擊者)
    const cur = p.effects.bleed;
    const tick = data.tick || 0.5;
    p.effects.bleed = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3),
      tick,
      tickTimer: cur ? cur.tickTimer : tick,
      dmg: Math.max(cur ? cur.dmg : 0, data.dmg || 0),
      moveMult: data.moveMult || 2.2,
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'mark') {
    // 死亡印記：受傷放大，可被引爆消耗
    const cur = p.effects.mark;
    p.effects.mark = {
      remaining: Math.max(cur ? cur.remaining : 0, data.duration || 4),
      bonus: Math.max(cur ? cur.bonus : 0, data.factor || 0.25),
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'reflect') {
    p.effects.reflect = { remaining: data.duration || 5, factor: data.factor || 0.35 };
    return;
  }
  if (kind === 'chill') {
    // 冰霜層數：每層加重減速，疊滿即凍結 (轉為 stun)
    const cur = p.effects.chill;
    const max = data.max || 4;
    const stacks = Math.min(max, (cur ? cur.stacks : 0) + (data.stacks || 1));
    p.effects.chill = {
      remaining: data.duration || 3,
      stacks, max,
      factor: Math.max(0.35, 1 - 0.16 * stacks),
      freezeDur: data.freezeDur || 1.1,
      froze: cur ? cur.froze : false,
      srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
    };
    return;
  }
  if (kind === 'root') { p.effects.root = { remaining: data.duration || 1 }; return; }
  p.effects[kind] = {
    remaining: data.duration,
    factor: data.factor,
    speed: data.speed,
    dmg: data.dmg,
  };
}
