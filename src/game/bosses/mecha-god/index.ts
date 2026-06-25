// @ts-nocheck
import { BaseBoss } from '../BaseBoss.ts';
import { SLOW, STUN } from '../effects.js';
import { aiProfile } from './ai.ts';
import { modelConfig, buildModel, buildWeapon } from './model.ts';
import { loadVfx } from './vfx.ts';
import './action.ts'; // Ensure custom actions are registered
import { ARENA } from '../../constants.js';
import { addFx } from '../../entities/fx.ts';
import { applyEffect } from '../../entities/effects.ts';
import { dealDamage } from '../../entities/damage.ts';
import { makeZone, makeBoss } from '../../entities/factories.ts';
import * as THREE from 'three';

export function spawnPylons(state: any, boss: any) {
  // 移除場上舊的能量柱與警告圈
  for (const key of Object.keys(state.players)) {
    const o = state.players[key];
    if (o.isMinion && o.charId === -7 && o.ownerId === boss.id) {
      o.alive = false;
      delete state.players[key];
    }
  }
  state.zones = (state.zones || []).filter((z: any) => z.vfx !== 'boss_mecha_pylon_warning');

  // 在 Boss 的左右兩側對稱生成 2 個能量共振柱
  const offsetDistance = 180;
  const offsets = [
    { x: -offsetDistance, y: -50 },
    { x: offsetDistance, y: 50 },
  ];

  const enemies = (Object.values(state.players) as any[]).filter(
    (o) => o.team === 1 && o.alive
  );
  const enemiesCount = Math.max(1, enemies.length);
  const baseHp = enemiesCount === 1 ? 80 : Math.round(150 * enemiesCount * (state._hpScale || 1));

  offsets.forEach((offset, idx) => {
    const px = Math.max(60, Math.min(ARENA.width - 60, boss.x + offset.x));
    const py = Math.max(60, Math.min(ARENA.height - 60, boss.y + offset.y));

    const pylonId = boss.id + '-pylon-' + idx + '-' + Math.random().toString(36).slice(2, 7);

    const pylonMinion = makeBoss(pylonId, -7, px, py, boss.team, {
      isMinion: true,
      ownerId: boss.id,
      aiId: 'fake', // 無 AI
      name: '能量共振柱',
      maxHp: baseHp,
      facing: boss.facing,
    });
    pylonMinion.hitR = 30;

    // 將能量柱鎖死在原地，禁止任何漂移或擊退
    pylonMinion.spawnX = px;
    pylonMinion.spawnY = py;

    state.players[pylonId] = pylonMinion;

    // 添加地表預警/連結區域
    const pylonZone = makeZone(boss.id, px, py, {
      radius: 35,
      lifetime: 99.0, // 隨能量柱死亡而清理
      color: '#ffaa00',
      vfx: 'boss_mecha_pylon_warning',
      follow: pylonId
    });
    state.zones.push(pylonZone);

    // 播放生成特效
    addFx(state, { type: 'buff', x: px, y: py, color: '#ff5500', life: 0.6, radius: 50 });
  });

  // Boss 喊話
  state.banner = {
    text: '🛡️ 能量共振！',
    sub: '機械真神獲得了 90% 減傷護盾，快擊破能量共振柱！',
    life: 2.5,
    kind: 'phase',
    color: '#ffaa00',
  };
}

const data = {
  id: 114,
  round: 7, // Will be dynamically overridden by BOSS_ORDER
  name: '機械真神',
  subtitle: '鋼鐵造物者',
  color: '#4e5a65',
  shape: 'circle',
  maxHp: 6000,
  baseHp: 6000,
  maxMana: 999,
  speed: 140,
  deathVfx: 'boss_mecha_death',
  appearance: {
    size: '等身偏大 (約玩家 1.8 倍)，雙臂厚重',
    style: '重裝鋼鐵機甲，核心散發能量橘色高熱光芒，配備推進背包與粗壯的火箭拳套。主要配色：鋼鐵灰 #4e5a65 + 暗金屬 #2c3e50 + 能量橘 #ff5500。',
    weapon: '火箭拳套與推進器雷射',
    telegraph: '施法時核心劇烈閃爍；蓄力電磁砲時地表會出現亮橘色軌道警示；釋放奧米伽雷射前全身噴射尾焰並有環形擴散波。',
  },
  ai: 'mecha_god',
  mechanic: { pylonShield: true, overheat: true },
  hint: '當機械真神召喚能量共振柱時，它會獲得 90% 減傷！優先擊破兩側能量柱。另外，Boss 施放技能會累積熱量，達到 100% 後會進入 6 秒系統過熱狀態，受傷害增加 50% 且嚴重減速！',
  tags: [
    { icon: '🛡️', text: '共振柱存在時減傷 90%' },
    { icon: '🔥', text: '技能積熱，100% 過熱虛弱' },
    { icon: '⚡', text: '半血進入超載狂暴狀態' },
  ],
  theme: {
    sky: 0x1f1f2e,
    fog: 0x14141f,
    fogNear: 800,
    fogFar: 2400,
    floor: 0x2e2e3d,
    ring: 0xff5500,
    wallStone: 0x1a1a24,
    wallTrim: 0xffaa00,
    hemiSky: 0xffaa00,
    hemiGround: 0x1f1f2e,
    hemiInt: 0.6,
    sunColor: 0xffddaa,
    sunInt: 2.0,
    rimColor: 0xff5500,
    rimInt: 0.6,
    decorations: ['crystal'],
    crystal: { count: 12, color: 0xffaa00, glow: 0xff3300, glowInt: 0.8 },
    atmosphere: { kind: 'embers', color: '#ff5500', rate: 15 },
    floorDecal: { kind: 'rings', color: '#ff5500', opacity: 0.4, glow: 0.3 },
  },

  phases: [
    {
      hpPct: 0.5,
      name: '系統超載',
      sub: '無限火力',
      color: '#ff5500',
      dmgMult: 1.25,
      speedMult: 1.15,
      cdMult: 0.7,
      onEnter: (state: any, boss: any) => {
        state.banner = {
          text: '⚠️ 系統超載！',
          sub: '機械真神大幅提升攻擊力與移動速度，出招更快！',
          life: 3.0,
          kind: 'phase',
          color: '#ff5500',
        };
      }
    }
  ],

  // 技能定義
  basic: {
    name: '火箭重拳',
    type: 'melee',
    dmg: 32,
    range: 160,
    arc: 1.2,
    knockback: 200,
    cd: 1.6,
    windup: 0.4,
    telegraph: 'arc',
    color: '#ff5500',
    vfx: 'boss_mecha_punch',
  },
  skill1: {
    name: '電磁軌道砲',
    type: 'projectile',
    dmg: 45,
    range: 480,
    speed: 650,
    radius: 15,
    count: 1,
    knockback: 100,
    cd: 8.0,
    windup: 0.7,
    telegraph: 'line',
    color: '#ff5500',
    vfx: 'boss_mecha_beam',
  },
  skill2: {
    name: '召喚共振柱',
    type: 'summon_pylons',
    cd: 18.0,
    windup: 0.8,
    telegraph: 'self',
    color: '#ffaa00',
  },
  ultimate: {
    name: '歐米伽輻射',
    type: 'zone',
    range: 0,
    radius: 240,
    dmg: 75,
    lifetime: 1.5,
    tick: 0.5,
    knockback: 180,
    effect: STUN(1.0),
    cd: 25.0,
    windup: 1.2,
    telegraph: 'circle',
    color: '#ff3300',
    vfx: 'boss_mecha_ult',
  },

  // 減傷與過熱傷害加成邏輯
  modifyIncomingDamage(state: any, boss: any, attacker: any, dmg: number) {
    let pylonsAlive = 0;
    for (const o of Object.values(state.players) as any[]) {
      if (o.isMinion && o.charId === -7 && o.ownerId === boss.id && o.alive) {
        pylonsAlive++;
      }
    }
    if (pylonsAlive > 0) {
      return dmg * 0.1; // 90% 減傷
    }

    if (state.bossCustom?.isOverheated) {
      return dmg * 1.5; // 過熱時受傷加深 50%
    }
    return dmg;
  },

  tick(state: any, boss: any, dt: number) {
    // 1. 初始化自定義狀態
    state.bossCustom = state.bossCustom || {
      heat: 0.0,
      overheatTimer: 0.0,
      isOverheated: false,
      pylonSummoned: false,
    };
    const bc = state.bossCustom;

    // 2. 生命值低於 75% 時，強制觸發一次能量共振柱召喚
    if (boss.hp <= boss.maxHp * 0.75 && !bc.pylonSummoned) {
      bc.pylonSummoned = true;
      spawnPylons(state, boss);
    }

    // 3. 熱量累積與過熱邏輯
    if (bc.isOverheated) {
      // 套用過熱減速 60% (速度變為 40%)
      applyEffect(boss, 'slow', { duration: 0.2, factor: 0.4 }, boss.id);

      bc.overheatTimer -= dt;
      if (bc.overheatTimer <= 0) {
        bc.isOverheated = false;
        bc.heat = 0;
        state.banner = {
          text: '🔋 系統冷卻完成',
          sub: '機械真神恢復正常運作',
          life: 2.0,
          kind: 'phase',
          color: '#ffaa00',
        };
      }
    } else {
      // 監測技能釋放以累積熱量
      if (boss.aiState && boss.aiState.mode === 'windup') {
        if (!boss._lastWindupSlot || boss._lastWindupSlot !== boss.aiState.slot) {
          boss._lastWindupSlot = boss.aiState.slot;
          
          let heatAdd = 15;
          if (boss.aiState.slot === 'ultimate') heatAdd = 35;
          else if (boss.aiState.slot === 'skill1') heatAdd = 25;
          else if (boss.aiState.slot === 'skill2') heatAdd = 20;

          bc.heat = Math.min(100, bc.heat + heatAdd);

          if (bc.heat >= 100) {
            bc.isOverheated = true;
            bc.overheatTimer = 6.0;
            state.banner = {
              text: '❄️ 系統過熱！',
              sub: '機械真神癱瘓，受傷害提升 50% 且嚴重減速！',
              life: 3.0,
              kind: 'phase',
              color: '#00ffff',
            };
          }
        }
      } else {
        boss._lastWindupSlot = null;
      }

      // 未過熱時，每秒冷卻 6.5 點熱量
      bc.heat = Math.max(0, bc.heat - dt * 6.5);
    }

    // 4. 繪製共振柱與 Boss 之間的粒子能量流
    for (const o of Object.values(state.players) as any[]) {
      if (o.isMinion && o.charId === -7 && o.ownerId === boss.id && o.alive) {
        // 固定能量共振柱位置在原地
        if (o.spawnX != null && o.spawnY != null) {
          o.x = o.spawnX;
          o.y = o.spawnY;
        }
        o.vx = o.vy = o.kvx = o.kvy = 0;

        if (Math.random() < 0.22) {
          const ratio = Math.random();
          addFx(state, {
            type: 'buff',
            x: o.x + (boss.x - o.x) * ratio + (Math.random() - 0.5) * 16,
            y: o.y + (boss.y - o.y) * ratio + (Math.random() - 0.5) * 16,
            color: '#ffaa00',
            life: 0.35,
            radius: 12
          });
        }
      }
    }
  },

  renderTick(state: any, boss: any, dt: number, ctx: any) {
    const { sceneMgr, scene, atmosphere } = ctx;
    const bc = state.bossCustom;

    // 過熱或超載時，調整場地色調與氣氛
    if (bc?.isOverheated) {
      sceneMgr._customOverrideActive = true;
      scene.background = new THREE.Color(0x0a141a);
      scene.fog = new THREE.Fog(0x0a141a, 600, 2000);
      atmosphere.setTheme({ atmosphere: { kind: 'embers', color: '#00ffff', rate: 25 } });
    } else if (boss.hp <= boss.maxHp * 0.5) {
      sceneMgr._customOverrideActive = true;
      scene.background = new THREE.Color(0x2a0800);
      scene.fog = new THREE.Fog(0x2a0800, 700, 2200);
      atmosphere.setTheme({ atmosphere: { kind: 'embers', color: '#ff3300', rate: 30 } });
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

  cleanup(state: any) {
    delete state.bossCustom;
    // 清理場上遺留的共振柱與警告圈
    for (const key of Object.keys(state.players)) {
      const o = state.players[key];
      if (o.isMinion && o.charId === -7) {
        o.alive = false;
        delete state.players[key];
      }
    }
    state.zones = (state.zones || []).filter((z: any) => z.vfx !== 'boss_mecha_pylon_warning');
  },
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
