// @ts-nocheck
import { BaseBoss } from '../BaseBoss.ts';
import { SLOW, STUN } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts'; // Ensure custom sand_blink action is registered
import { ARENA } from '../../constants.js';
import { addFx } from '../../entities/fx.ts';
import * as THREE from 'three';

const data = {
  id: 112,
  round: 3, // Will be dynamically overriden, but kept for clarity
  name: '風沙法皇',
  subtitle: '黃沙掌控者',
  color: '#dfc48c',
  shape: 'circle',
  maxHp: 4800,
  baseHp: 4800,
  maxMana: 999,
  speed: 130,
  deathVfx: 'boss_sand_death',
  appearance: {
    size: '等身偏大 (約玩家 2.0 倍)，懸浮',
    style: '黃沙覆蓋的木乃伊，金砂覆蓋的法袍與面具，雙手各懸浮一顆旋轉金砂球。配色為法袍褐 #5c4033 + 砂金 #d4af37 + 雙眼紫光。',
    weapon: '雙手懸浮金砂球',
    telegraph: '施法時身前懸浮沙球發光；沙爆瞬移前後原落點與新落點地表沙塵爆開；大招施展時全身放射金色旋風。',
  },
  ai: 'sand_tyrant',
  mechanic: { inSandReduction: 0.35 },
  talent: { id: 'boss_quicksand_shield', name: '黃沙庇護', desc: '站在流沙內獲得 35% 傷害減免，且流沙會使玩家移速減半。', inSandReduction: 0.35 },
  hint: '遠離黃沙漩渦！當 Boss 站在流沙池中時減傷 35%，拉走他再進行集火。半血後注意躲避隨機強風！',
  tags: [
    { icon: '⏳', text: '流沙緩速 50%' },
    { icon: '🛡️', text: 'Boss 站沙內減傷 35%' },
    { icon: '🌪️', text: '半血沙塵暴與強風' },
  ],
  hazardText: '⚠️ 站在流沙中！快離開',
  hazardColor: '#dfc48c',
  theme: {
    sky: 0x2b221a,
    fog: 0x3d3025,
    fogNear: 600,
    fogFar: 2200,
    floor: 0x8a7355,
    ring: 0xdfc48c,
    wallStone: 0x4d3b2c,
    wallTrim: 0xdfc48c,
    hemiSky: 0xdfc48c,
    hemiGround: 0x2b221a,
    hemiInt: 0.5,
    sunColor: 0xffebad,
    sunInt: 2.0,
    rimColor: 0xdfc48c,
    rimInt: 0.4,
    decorations: ['rock'],
    rock: { count: 18, color: 0x5c4a38 },
    atmosphere: { kind: 'embers', color: '#dfc48c', rate: 20 },
    floorDecal: { kind: 'rings', color: '#dfc48c', opacity: 0.4, glow: 0.2 },
  },
  phases: [
    {
      hpPct: 0.5,
      name: '沙皇怒火',
      sub: '狂沙吞噬一切',
      color: '#ffd700',
      dmgMult: 1.15,
      speedMult: 1.1,
      cdMult: 0.8,
      onEnter: (state: any, boss: any) => {
        state.bossCustom = state.bossCustom || {};
        state.bossCustom.sandstormActive = true;
        // Trigger a visual dust blast
        if (state.fx) {
          state.fx.push({
            type: 'ultimate',
            x: boss.x,
            y: boss.y,
            facing: boss.facing,
            color: '#dfc48c',
            life: 1.2,
            radius: 800
          });
        }
      },
      tagsOverride: [
        { icon: '🌪️', text: '沙塵暴狂風呼嘯' },
        { icon: '👁️', text: '視野受到嚴重阻礙' },
        { icon: '⚔️', text: '出招間隔縮短' },
      ]
    }
  ],
  basic: {
    name: '沙之彈',
    type: 'projectile',
    dmg: 25,
    speed: 600,
    radius: 15,
    lifetime: 1.2,
    count: 3,
    spread: 0.25,
    knockback: 60,
    cd: 1.3,
    windup: 0.4,
    telegraph: 'line',
    color: '#dfc48c',
    vfx: 'boss_sand_bolt'
  },
  skill1: {
    name: '流沙漩渦',
    type: 'zone',
    range: 500,
    radius: 140,
    count: 3,
    scatter: 320,
    dmgPct: 0.015,
    lifetime: 5.0,
    tick: 0.5,
    effect: SLOW(0.6, 0.5),
    cd: 8.0,
    windup: 0.6,
    telegraph: 'circle',
    color: '#dfc48c',
    vfx: 'boss_sand_pool'
  },
  skill2: {
    name: '沙塵瞬移',
    type: 'sand_blink',
    dmg: 45,
    cd: 10.0,
    windup: 0.5,
    telegraph: 'circle',
    color: '#ffd700',
    vfx: 'boss_sand_explode'
  },
  ultimate: {
    name: '黃沙送葬',
    type: 'zone',
    range: 0,
    radius: 320,
    dmg: 50,
    lifetime: 1.5,
    tick: 0.3,
    effect: SLOW(1.2, 0.4),
    knockback: 200,
    cd: 16.0,
    windup: 1.2,
    telegraph: 'circle',
    color: '#ffd700',
    vfx: 'boss_sand_ult'
  },
  tick(state: any, boss: any, dt: number) {
    if (!state.bossCustom?.sandstormActive) return;

    if (state.sandstormWindTimer == null) {
      state.sandstormWindTimer = 3.0;
      state.sandstormWindDur = 0;
      state.sandstormWindDir = { x: 0, y: 0 };
    }

    state.sandstormWindTimer -= dt;
    if (state.sandstormWindTimer <= 0) {
      state.sandstormWindTimer = 8.0 + Math.random() * 4.0;
      state.sandstormWindDur = 2.0;
      const angle = Math.random() * Math.PI * 2;
      state.sandstormWindDir = { x: Math.cos(angle), y: Math.sin(angle) };

      state.banner = {
        text: '⚠️ 砂暴狂風！',
        sub: '注意逆風調整站位',
        life: 1.6,
        kind: 'phase',
        color: '#e6c387'
      };
    }

    if (state.sandstormWindDur > 0) {
      state.sandstormWindDur -= dt;
      const windForce = 135;
      for (const o of Object.values(state.players) as any[]) {
        if (o.team === 1 && o.alive) {
          o.x = Math.max(22, Math.min(ARENA.width - 22, o.x + state.sandstormWindDir.x * windForce * dt));
          o.y = Math.max(22, Math.min(ARENA.height - 22, o.y + state.sandstormWindDir.y * windForce * dt));
        }
      }
      if (Math.random() < 0.22) {
        addFx(state, {
          type: 'hit',
          x: Math.random() * ARENA.width,
          y: Math.random() * ARENA.height,
          color: '#dfc48c',
          life: 0.45,
          radius: 35
        });
      }
    }
  },
  renderTick(state: any, boss: any, dt: number, ctx: any) {
    const { sceneMgr, scene, atmosphere } = ctx;
    if (state.bossCustom?.sandstormActive) {
      sceneMgr._customOverrideActive = true;
      const sandColor = 0xc4b293;
      scene.background = new THREE.Color(sandColor);
      
      // Breathing sandstorm fog: oscillates near/far limits over time!
      const osc = Math.sin(state.time * 0.5); // ranges -1..1, period of ~12.5s
      const near = 600 + osc * 200; // 400..800
      const far = 1600 + osc * 400;  // 1200..2000
      scene.fog = new THREE.Fog(sandColor, near, far);
      
      const particleRate = Math.round(45 + osc * 25); // 20..70 particles
      atmosphere.setTheme({ atmosphere: { kind: 'embers', color: '#dfc48c', rate: particleRate } });
    } else {
      if (sceneMgr._customOverrideActive) {
        sceneMgr._customOverrideActive = false;
        const theme = this.theme;
        if (theme) {
          scene.background = new THREE.Color(theme.sky);
          scene.fog = new THREE.Fog(theme.fog, theme.fogNear, theme.fogFar);
          atmosphere.setTheme(theme);
        }
      }
    }
  },
  modifyIncomingDamage(state: any, boss: any, attacker: any, amount: number) {
    const mech = this.mechanic;
    if (mech && mech.inSandReduction) {
      let inSand = false;
      if (state.zones && state.zones.length) {
        for (const zone of state.zones) {
          if (zone.vfx === 'boss_sand_pool' || zone.color === '#dfc48c') {
            const dx = zone.x - boss.x;
            const dy = zone.y - boss.y;
            if (dx * dx + dy * dy <= zone.radius * zone.radius) {
              inSand = true;
              break;
            }
          }
        }
      }
      if (inSand) {
        return amount * (1 - mech.inSandReduction);
      }
    }
    return amount;
  },
  cleanup(state: any) {
    delete state.bossCustom;
    delete state.sandstormWindTimer;
    delete state.sandstormWindDur;
    delete state.sandstormWindDir;
  }
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
