// 狀態效果系統（registry 模式）。
//
// 每種效果在 EFFECT_DEFS 註冊一筆：apply 決定如何寫入 player.effects（省略則走 genericApply），
// cleanseable 標記是否會被「淨化」清除。→ 新增效果只要加一筆；**淨化清單自動由 cleanseable 推導**，
// 不必再手動維護一長串 delete（過去的踩雷點）。data 為該效果的參數袋（依 kind 而異），故保留 any。
import type { Player, EffectKind, EntityId } from '../types';
import { applyShield } from './shield.ts';

type EffectApply = (p: Player, kind: string, data: any, srcId?: EntityId) => void;
/** HUD 顯示中繼資料（頭頂/角落狀態列的圖示與名稱）；省略代表此效果不在狀態列顯示（如 heal/shield/regen_hot）。 */
export interface EffectHud { icon: string; name: string; buff: boolean; }
interface EffectDef {
  apply?: EffectApply;      // 缺省 → genericApply
  cleanseable?: boolean;    // debuff = true（會被 cleanse 清除）；增益省略
  hud?: EffectHud;          // 狀態列顯示中繼資料（與邏輯 co-located，新增效果只改這一處）
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
  // ---- 即時型（直接改 hp/shield，不留存於 effects；不在狀態列顯示，故無 hud）----
  heal: { apply: (p, _k, data) => { p.hp = Math.min(p.maxHp, p.hp + data.amount); } },
  shield: {
    apply: (p, _k, data) => {
      applyShield(data.state, p, data.amount, data.duration, { popup: data.popup });
    },
  },

  // ---- DoT / 控場（可淨化）----
  burn: {
    cleanseable: true,
    hud: { icon: '🔥', name: '燃燒', buff: false },
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
    hud: { icon: '🩸', name: '流血', buff: false },
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
    hud: { icon: '🎯', name: '標記', buff: false },
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
    hud: { icon: '❄️', name: '冰寒', buff: false },
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
    hud: { icon: '💀', name: '衰弱', buff: false },
    apply: (p, _k, data) => {
      const cur = p.effects.weaken;
      p.effects.weaken = { remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3), factor: Math.max(cur ? cur.factor : 0, data.factor || 0.15) };
    },
  },
  dmg_reduce: {
    cleanseable: true,
    hud: { icon: '🔻', name: '弱化', buff: false },
    apply: (p, _k, data) => {
      const cur = p.effects.dmg_reduce;
      p.effects.dmg_reduce = { remaining: Math.max(cur ? cur.remaining : 0, data.duration || 3), factor: Math.max(cur ? cur.factor : 0, data.factor || 0.25) };
    },
  },
  root: {
    cleanseable: true,
    hud: { icon: '🌿', name: '定身', buff: false },
    apply: (p, _k, data) => { p.effects.root = { remaining: data.duration || 1 }; },
  },

  // ---- 走 genericApply、但仍可淨化（slow/stun/frozen）----
  slow: { cleanseable: true, hud: { icon: '🐢', name: '緩速', buff: false } },
  stun: { cleanseable: true, hud: { icon: '💫', name: '暈眩', buff: false } },
  frozen: { cleanseable: true, hud: { icon: '🧊', name: '冰凍', buff: false } },

  // ---- 增益（不被淨化）----
  reflect: { hud: { icon: '🪞', name: '反射', buff: true }, apply: (p, _k, data) => { p.effects.reflect = { remaining: data.duration || 5, factor: data.factor || 0.35 }; } },
  protect: {
    hud: { icon: '🛡', name: '護體', buff: true },
    apply: (p, _k, data) => {
      const cur = p.effects.protect;
      p.effects.protect = {
        remaining: Math.max(cur ? cur.remaining : 0, data.duration || 4),
        factor: Math.max(cur ? cur.factor : 0, data.factor || 0.2),
      };
    },
  },
  // ---- 走 genericApply 的增益：僅 HUD 顯示中繼資料（無 apply → genericApply；無 cleanseable）----
  haste:     { hud: { icon: '⚡', name: '加速', buff: true } },
  lifesteal: { hud: { icon: '🩸', name: '吸血', buff: true } },
  rage:      { hud: { icon: '🔥', name: '狂暴', buff: true } },
  overdrive: { hud: { icon: '⚡', name: '超載', buff: true } },
  invis:     { hud: { icon: '👻', name: '隱身', buff: true } },
  evading:   { hud: { icon: '💨', name: '無敵', buff: true } },
  regen_hot: {
    apply: (p, _k, data) => {
      const cur = p.effects.regen_hot;
      p.effects.regen_hot = {
        remaining: Math.max(cur ? cur.remaining : 0, data.duration || 7),
        amountPerSec: data.amountPerSec || 10,
        tickTimer: cur ? cur.tickTimer : 1.0,
      };
    },
  },
};

// 淨化清單：由 cleanseable 旗標自動推導 → 新增可淨化效果無需再改 cleanse。
const CLEANSEABLE = Object.keys(EFFECT_DEFS).filter((k) => EFFECT_DEFS[k].cleanseable);

// HUD 狀態列查表：與效果邏輯 co-located（單一事實來源）→ 新增效果只改 EFFECT_DEFS 一處，
// 不必再同步維護 render3d/hud.js 的第二份 icon/name 表。回傳 null = 不在狀態列顯示。
export function getEffectHud(kind: string): EffectHud | null {
  return EFFECT_DEFS[kind]?.hud || null;
}

export function applyEffect(p: Player, kind: EffectKind, data?: any, srcId?: EntityId) {
  if (kind === 'cleanse') {
    for (const k of CLEANSEABLE) delete p.effects[k];
    return;
  }
  if (p.isBoss && p.ultLockInvincible && EFFECT_DEFS[kind]?.cleanseable) {
    return;
  }
  // CC 冷卻：被控後同類型一段時間內免疫，雙向都適用
  const CC_TYPES = ['stun', 'root', 'scramble'];
  const CC_CD: Record<string, number> = { stun: 4, root: 4, scramble: 6 };
  if (CC_TYPES.includes(kind)) {
    const cd = p.ccCooldown?.[kind] || 0;
    if (cd > 0) return;
    p.ccCooldown[kind] = CC_CD[kind];
  }
  const def = EFFECT_DEFS[kind];
  (def && def.apply ? def.apply : genericApply)(p, kind, data || {}, srcId);
}
