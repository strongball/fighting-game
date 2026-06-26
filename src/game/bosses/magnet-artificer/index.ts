// @ts-nocheck
import { BaseBoss } from '../BaseBoss.ts';
import { SLOW } from '../effects.js';
import { clamp } from '../../entities/math.ts';
import { addFx } from '../../entities/fx.ts';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts';

const POLARITY_VFX = 'boss_magnet_polarity';
const ANCHOR_VFX = 'boss_magnet_anchor';
const COLLAPSE_VFX = 'boss_magnet_collapse';

function clearMagnetFields(state: any) {
  for (const p of Object.values(state.players || {}) as any[]) {
    if (p.magneticPolarity) delete p.magneticPolarity;
  }
}

function tickMagnetism(state: any, boss: any, dt: number) {
  const bc = state.bossCustom?.magnetArtificer;
  if (!bc) return;

  bc.fxTimer = (bc.fxTimer || 0) - dt;
  const polarities = bc.polarities || {};
  for (const p of Object.values(state.players || {}) as any[]) {
    if (!p.alive || !p.magneticPolarity || p.magneticPolarity.sourceBossId !== boss.id) continue;
    p.magneticPolarity.remaining = Math.max(0, (p.magneticPolarity.expiresAt || 0) - (state.time || 0));
    polarities[p.id] = p.magneticPolarity;
    if (p.magneticPolarity.remaining <= 0) {
      delete polarities[p.id];
      delete p.magneticPolarity;
    } else if (bc.fxTimer <= 0) {
      addFx(state, {
        type: 'buff',
        x: p.x,
        y: p.y,
        color: p.magneticPolarity.color,
        life: 0.32,
        radius: 54,
        polarity: p.magneticPolarity.polarity,
        targetId: p.id,
        vfx: POLARITY_VFX,
      });
    }
  }
  if (bc.fxTimer <= 0) bc.fxTimer = 0.34;

  const anchors = (state.zones || []).filter((z: any) => z.magneticAnchor && z.owner === boss.id);
  bc.anchors = anchors.map((z: any) => ({
    id: z.id,
    x: z.x,
    y: z.y,
    polarity: z.polarity,
    color: z.color,
    radius: z.radius,
    delay: z.delay,
    remaining: z.lifetime + Math.max(0, z.delay || 0),
  }));

  for (const z of anchors) {
    const activeRatio = z.delay > 0 ? (z.warningForceRatio || 0.45) : 1;
    for (const p of Object.values(state.players || {}) as any[]) {
      if (!p.alive || p.team === boss.team || !p.magneticPolarity) continue;
      const dx = z.x - p.x;
      const dy = z.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const same = p.magneticPolarity.polarity === z.polarity;
      const dir = same ? -1 : 1;
      const polarityMult = same ? (z.repulsionMult || 1.45) : (z.attractionMult || 1);
      const fieldScale = z.fieldScale || 300;
      const softening = z.softening || 110;
      const falloff = (fieldScale * fieldScale) / (d * d + softening * softening);
      const force = (z.force || 180) * Math.min(0.75, falloff) * activeRatio * polarityMult * dt;
      p.kvx += (dx / d) * force * dir;
      p.kvy += (dy / d) * force * dir;
    }
  }
}

const data = {
  id: 116,
  round: 8,
  name: '磁核匠師',
  subtitle: '極性鍛造者',
  color: '#58d7ff',
  shape: 'hexagon',
  maxHp: 5800,
  baseHp: 5800,
  maxMana: 999,
  speed: 150,
  deathVfx: 'boss_magnet_death',
  appearance: {
    size: '等身偏大，核心與肢體分離懸浮',
    style: '分離式磁浮工匠：胸前雙極磁核懸浮旋轉，左右肩臂以紅藍磁極牽引，身周有多層半環磁軌。',
    weapon: '碎金屬片會在手前聚合成磁錘或磁針陣列',
    telegraph: '磁錨落地前會亮出 N/S 極性與圓形危險圈；玩家身旁會持續浮現同色極性環。',
  },
  ai: 'magnet_artificer',
  mechanic: { magneticPolarity: true, magneticAnchors: true },
  hint: '被標記 N/S 極性後觀察磁錨顏色：同極會推開，異極會拉近。利用吸斥修正站位，離開坍縮爆發圈。',
  tags: [
    { icon: 'N', text: '藍色 N 極標記' },
    { icon: 'S', text: '紅色 S 極標記' },
    { icon: '↔', text: '同極排斥、異極吸引' },
  ],
  hazardText: '磁場坍縮中！依極性調整站位',
  hazardColor: '#a855ff',
  theme: {
    sky: 0x10161d,
    fog: 0x18212a,
    fogNear: 760,
    fogFar: 2300,
    floor: 0x22282d,
    ring: 0x58d7ff,
    wallStone: 0x15191e,
    wallTrim: 0xff5d6c,
    hemiSky: 0x58d7ff,
    hemiGround: 0x11151a,
    hemiInt: 0.58,
    sunColor: 0xffb3bb,
    sunInt: 1.55,
    rimColor: 0x58d7ff,
    rimInt: 0.7,
    decorations: ['crystal', 'pillar'],
    crystal: { count: 14, color: 0x58d7ff, glow: 0xff5d6c, glowInt: 0.8 },
    pillar: { count: 8, color: 0x2e343b },
    atmosphere: { kind: 'stardust', color: '#9ee8ff', rate: 14 },
    floorDecal: { kind: 'rings', color: '#58d7ff', opacity: 0.22, glow: 0.18 },
  },
  phases: [
    {
      hpPct: 0.5,
      name: '雙極超載',
      sub: '磁軌開始失控加速',
      color: '#ff5d6c',
      dmgMult: 1.12,
      speedMult: 1.08,
      cdMult: 0.78,
      onEnter: (state: any, boss: any) => {
        boss.magnetOverload = true;
        state.banner = {
          text: '雙極超載',
          sub: '磁錨更多，吸斥力更強',
          life: 2.6,
          kind: 'phase',
          color: '#ff5d6c',
        };
        addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: '#ff5d6c', life: 0.8, radius: 250, vfx: 'boss_magnet_ult' });
      },
      tagsOverride: [
        { icon: '⚡', text: '磁錨吸斥力提高' },
        { icon: '↔', text: '極性標記刷新更頻繁' },
      ],
    },
  ],

  basic: {
    name: '磁浮重擊',
    type: 'melee',
    dmg: 30,
    range: 155,
    arc: 1.25,
    knockback: 210,
    cd: 1.45,
    windup: 0.38,
    telegraph: 'arc',
    color: '#d7f7ff',
    vfx: 'boss_magnet_slam',
  },
  skill1: {
    name: '磁針連射',
    type: 'projectile',
    dmg: 22,
    range: 500,
    speed: 700,
    radius: 10,
    count: 4,
    spread: 0.22,
    knockback: 45,
    effect: SLOW(1.2, 0.72),
    cd: 6.2,
    windup: 0.52,
    telegraph: 'line',
    color: '#58d7ff',
    vfx: 'boss_magnet_needle',
  },
  skill2: {
    name: '極性烙印',
    type: 'magnetic_polarity',
    duration: 8.0,
    cd: 10.8,
    windup: 0.65,
    telegraph: 'self',
    color: '#58d7ff',
    vfx: 'boss_magnet_mark',
  },
  ultimate: {
    name: '磁場坍縮',
    type: 'magnetic_collapse',
    radius: 130,
    duration: 6.4,
    warning: 1.25,
    force: 430,
    fieldScale: 270,
    softening: 140,
    soloForce: 780,
    soloFieldScale: 300,
    soloSoftening: 120,
    cd: 13.0,
    windup: 1.05,
    recover: 1.05,
    telegraph: 'self',
    color: '#a855ff',
    vfx: 'boss_magnet_ult',
  },

  tick(state: any, boss: any, dt: number) {
    state.bossCustom = state.bossCustom || {};
    state.bossCustom.magnetArtificer = state.bossCustom.magnetArtificer || {
      polarities: {},
      polarityTimer: 0,
      anchors: [],
      fxTimer: 0,
    };
    if (boss.hp <= boss.maxHp * 0.5) boss.magnetOverload = true;
    tickMagnetism(state, boss, dt);
  },

  renderTick(state: any, boss: any, dt: number, ctx: any) {
    if (ctx?.sceneMgr?.setBossVisualHint) {
      ctx.sceneMgr.setBossVisualHint('magnetOverload', boss.hp <= boss.maxHp * 0.5);
    }
  },

  cleanup(state: any) {
    clearMagnetFields(state);
    if (state.bossCustom?.magnetArtificer) delete state.bossCustom.magnetArtificer;
    if (state.bossCustom && Object.keys(state.bossCustom).length === 0) delete state.bossCustom;
    state.zones = (state.zones || []).filter((z: any) => z.vfx !== ANCHOR_VFX && z.vfx !== COLLAPSE_VFX && !z.magneticAnchor);
    state.fx = (state.fx || []).filter((fx: any) => !String(fx.vfx || '').startsWith('boss_magnet'));
  },
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
