// 狀態效果系統（registry 模式）。
//
// 每種效果在 EFFECT_DEFS 註冊一筆：apply 決定如何寫入 player.effects（省略則走 genericApply），
// cleanseable 標記是否會被「淨化」清除。→ 新增效果只要加一筆；**淨化清單自動由 cleanseable 推導**，
// 不必再手動維護一長串 delete（過去的踩雷點）。data 為該效果的參數袋（依 kind 而異），故保留 any。
import type { Player, EffectKind, EntityId } from '../types';

type EffectApply = (p: Player, kind: string, data: any, srcId?: EntityId) => void;
interface EffectDef {
  apply?: EffectApply;      // 缺省 → genericApply
  cleanseable?: boolean;    // debuff = true（會被 cleanse 清除）；增益省略
}

// 通用衰減型效果（slow/stun/haste/rage/overdrive/frozen/evading/invis…）的缺省寫入。
const genericApply: EffectApply = (p, kind, data) => {
  p.effects[kind] = {
    remaining: data.duration,
    factor: data.factor,
    speed: data.speed,
    dmg: data.dmg,
    atkSpeed: data.atkSpeed,
  };
};

const EFFECT_DEFS: Record<string, EffectDef> = {
  // ---- 即時型（直接改 hp/shield，不留存於 effects）----
  heal: { apply: (p, _k, data) => { p.hp = Math.min(p.maxHp, p.hp + data.amount); } },
  shield: {
    apply: (p, _k, data) => {
      p.shield = Math.max(p.shield, data.amount);
      p.shieldTime = Math.max(p.shieldTime, data.duration);
    },
  },

  // ---- DoT / 控場（可淨化）----
  burn: {
    cleanseable: true,
    apply: (p, _k, data, srcId) => {
      const cur = p.effects.burn;
      const tick = data.tick || 0.5;
      p.effects.burn = {
        remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3),
        tick,
        tickTimer: cur ? cur.tickTimer : tick,
        dmg: Math.max(cur ? cur.dmg : 0, data.dmg || 0),
        srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
      };
    },
  },
  bleed: {
    cleanseable: true,
    apply: (p, _k, data, srcId) => {
      const cur = p.effects.bleed;
      const tick = data.tick || 0.5;
      p.effects.bleed = {
        remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3),
        tick,
        tickTimer: cur ? cur.tickTimer : tick,
        dmg: Math.max(cur ? cur.dmg : 0, data.dmg || 0),
        moveMult: data.moveMult || 1.5,
        srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
      };
    },
  },
  mark: {
    cleanseable: true,
    apply: (p, _k, data, srcId) => {
      const cur = p.effects.mark;
      p.effects.mark = {
        remaining: Math.max(cur ? cur.remaining : 0, data.duration || 4),
        bonus: Math.max(cur ? cur.bonus : 0, data.factor || 0.25),
        srcId: srcId != null ? srcId : (cur ? cur.srcId : undefined),
      };
    },
  },
  chill: {
    cleanseable: true,
    apply: (p, _k, data, srcId) => {
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
    },
  },
  weaken: {
    cleanseable: true,
    apply: (p, _k, data) => {
      const cur = p.effects.weaken;
      p.effects.weaken = { remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3), factor: Math.max(cur ? cur.factor : 0, data.factor || 0.15) };
    },
  },
  dmg_reduce: {
    cleanseable: true,
    apply: (p, _k, data) => {
      const cur = p.effects.dmg_reduce;
      p.effects.dmg_reduce = { remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3), factor: Math.max(cur ? cur.factor : 0, data.factor || 0.25) };
    },
  },
  root: {
    cleanseable: true,
    apply: (p, _k, data) => { p.effects.root = { remaining: data.duration || 1 }; },
  },

  // ---- 走 genericApply、但仍可淨化（slow/stun/frozen）----
  slow: { cleanseable: true },
  stun: { cleanseable: true },
  frozen: { cleanseable: true },

  // ---- 增益（不被淨化）----
  reflect: { apply: (p, _k, data) => { p.effects.reflect = { remaining: data.duration || 5, factor: data.factor || 0.35 }; } },
  protect: {
    apply: (p, _k, data) => {
      const cur = p.effects.protect;
      p.effects.protect = {
        remaining: Math.max(cur ? cur.remaining : 0, data.duration || 4),
        factor: Math.max(cur ? cur.factor : 0, data.factor || 0.2),
      };
    },
  },
};

// 淨化清單：由 cleanseable 旗標自動推導 → 新增可淨化效果無需再改 cleanse。
const CLEANSEABLE = Object.keys(EFFECT_DEFS).filter((k) => EFFECT_DEFS[k].cleanseable);

export function applyEffect(p: Player, kind: EffectKind, data?: any, srcId?: EntityId) {
  if (kind === 'cleanse') {
    for (const k of CLEANSEABLE) delete p.effects[k];
    return;
  }
  const def = EFFECT_DEFS[kind];
  (def && def.apply ? def.apply : genericApply)(p, kind, data || {}, srcId);
}
