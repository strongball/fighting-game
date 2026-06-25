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
import { makeZone } from '../../entities/factories.ts';
import * as THREE from 'three';

const data = {
  id: 113,
  round: 5, // Will be dynamically overridden, but kept for clarity
  name: '潮汐歌姬',
  subtitle: '深海主宰',
  color: '#0a9396',
  shape: 'circle',
  maxHp: 5200,
  baseHp: 5200,
  maxMana: 999,
  speed: 155,
  deathVfx: 'boss_siren_death',
  appearance: {
    size: '等身偏大 (約玩家 1.7 倍)，懸浮',
    style: '懸浮的半人半魚「歌姬」，尾鰭半透明且發光，身後懸浮著水球與泡泡。主要配色：深海藍 #005f73 + 青碧色 #0a9396 + 發光海泡色 #94d2bd。',
    weapon: '以歌聲與漂浮水球施法',
    telegraph: '唱歌施法時身體發光且有擴散的水環；水淹前有低沉的潮汐音效與地表水泡。',
  },
  ai: 'tidal_siren',
  mechanic: { flooded: false },
  hint: '注意避開潮汐上漲！當場地淹水時，迅速躲進安全氣泡（Air Bubble）以避免持續溺水與嚴重減速。隊友若被困在水泡中，需集火打爆水泡救人！',
  tags: [
    { icon: '🌊', text: '定期起潮溺水與減速' },
    { icon: '🫧', text: '水泡困人需集火打爆' },
    { icon: '🌀', text: '半血永久起潮與急流' },
  ],
  hazardText: '🌊 溺水中！快躲進安全氣泡',
  hazardColor: '#0a9396',
  theme: {
    sky: 0x001d2d,
    fog: 0x00334d,
    fogNear: 800,
    fogFar: 2400,
    floor: 0x004d66,
    ring: 0x0a9396,
    wallStone: 0x002b3d,
    wallTrim: 0x94d2bd,
    hemiSky: 0x94d2bd,
    hemiGround: 0x001d2d,
    hemiInt: 0.7,
    sunColor: 0x8ecae6,
    sunInt: 1.8,
    rimColor: 0x0a9396,
    rimInt: 0.5,
    decorations: ['crystal'],
    crystal: { count: 16, color: 0x94d2bd, glow: 0x00ffff, glowInt: 0.9 },
    atmosphere: { kind: 'embers', color: '#94d2bd', rate: 12 },
    floorDecal: { kind: 'rings', color: '#0a9396', opacity: 0.45, glow: 0.35 },
  },

  phases: [
    {
      hpPct: 0.5,
      name: '深海狂歌',
      sub: '暗流湧動',
      color: '#0a9396',
      dmgMult: 1.15,
      speedMult: 1.1,
      cdMult: 0.75,
      onEnter: (state: any, boss: any) => {
        state.bossCustom = state.bossCustom || {};
        state.bossCustom.isPermanentlyFlooded = true;
        state.bossCustom.isFlooded = true;
        state.bossCustom.floodDurationTimer = 99999;
      },
      tagsOverride: [
        { icon: '🌊', text: '全場永久起潮溺水' },
        { icon: '🌀', text: '定期產生激流推搡' },
        { icon: '⚡', text: '技能釋放加快' },
      ],
    },
  ],

  basic: {
    name: '水花彈射',
    type: 'projectile',
    dmg: 16,
    speed: 520,
    radius: 14,
    lifetime: 1.5,
    count: 3,
    spread: 0.22,
    knockback: 40,
    cd: 1.5,
    windup: 0.3,
    telegraph: 'line',
    color: '#0a9396',
    vfx: 'boss_siren_bolt',
  },
  skill1: {
    name: '波濤巨浪',
    type: 'zone',
    range: 450,
    radius: 150,
    dmg: 35,
    lifetime: 1.2,
    tick: 1.2,
    knockback: 350,
    cd: 11.0,
    windup: 0.6,
    telegraph: 'circle',
    color: '#00ffff',
    vfx: 'boss_siren_wave',
  },
  skill2: {
    name: '水泡禁錮',
    type: 'summon_bubble',
    bubbleHp: 300,
    cd: 17.5,
    windup: 0.7,
    telegraph: 'self',
    color: '#94d2bd',
    vfx: 'boss_siren_bubble',
  },
  ultimate: {
    name: '深海交響曲',
    type: 'zone',
    range: 0,
    radius: 120,
    count: 4,
    scatter: 400,
    stagger: 0.3,
    dmg: 65,
    lifetime: 1.4,
    tick: 1.4,
    knockback: 200,
    effect: STUN(0.8),
    cd: 24.0,
    windup: 1.1,
    telegraph: 'circle',
    color: '#00ffff',
    vfx: 'boss_siren_ult',
  },

  tick(state: any, boss: any, dt: number) {
    // 1. 初始化自訂狀態
    state.bossCustom = state.bossCustom || {
      floodCycleTimer: 32.0,
      floodDurationTimer: 0.0,
      isFlooded: false,
      isPermanentlyFlooded: false,
      currentTimer: 6.0,
      currentDuration: 0.0,
      currentDir: { x: 0, y: 0 },
    };

    const bc = state.bossCustom;

    // 二階段轉場：HP < 50%
    if (boss.hp <= boss.maxHp * 0.5 && !bc.isPermanentlyFlooded) {
      bc.isPermanentlyFlooded = true;
      bc.isFlooded = true;
      bc.floodDurationTimer = 99999;
      if (state.fx) {
        addFx(state, { type: 'ultimate', x: boss.x, y: boss.y, color: '#0a9396', life: 1.2, radius: 800 });
      }
      state.banner = {
        text: '🌊 深海狂歌！',
        sub: '海水永久暴漲，激流暗湧！快尋找安全氣泡！',
        life: 3.2,
        kind: 'phase',
        color: '#0a9396',
      };
    }

    // 2. 潮汐循環計時
    if (!bc.isPermanentlyFlooded) {
      if (bc.isFlooded) {
        bc.floodDurationTimer -= dt;
        if (bc.floodDurationTimer <= 0) {
          bc.isFlooded = false;
          bc.floodCycleTimer = 32.0;
          state.banner = {
            text: '💧 潮汐退去',
            sub: '海水已退，暫時安全',
            life: 1.6,
            kind: 'phase',
            color: '#94d2bd',
          };
          // 移除所有安全氣泡區
          state.zones = (state.zones || []).filter((z: any) => z.vfx !== 'boss_siren_safe_bubble');
        }
      } else {
        bc.floodCycleTimer -= dt;
        if (bc.floodCycleTimer <= 0) {
          bc.isFlooded = true;
          bc.floodDurationTimer = 8.0;
          state.banner = {
            text: '🌊 潮汐上漲！',
            sub: '快躲進安全氣泡，避免溺水與減速！',
            life: 2.2,
            kind: 'phase',
            color: '#0a9396',
          };
        }
      }
    }

    // 3. 漲潮狀態處理
    if (bc.isFlooded) {
      // 確保場上維持 2 個安全氣泡區
      const safeZones = (state.zones || []).filter((z: any) => z.vfx === 'boss_siren_safe_bubble');
      if (safeZones.length < 2) {
        const toSpawn = 2 - safeZones.length;
        for (let i = 0; i < toSpawn; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distVal = 160 + Math.random() * 180;
          const zx = Math.max(50, Math.min(ARENA.width - 50, boss.x + Math.cos(angle) * distVal));
          const zy = Math.max(50, Math.min(ARENA.height - 50, boss.y + Math.sin(angle) * distVal));

          const moveAngle = Math.random() * Math.PI * 2;
          const speed = bc.isPermanentlyFlooded ? 75 : 45; // 二階段氣泡移動更快

          const bubbleZone = makeZone(boss.id, zx, zy, {
            radius: 200,
            lifetime: bc.isPermanentlyFlooded ? 12.0 : 9999, // 非永久時讓氣泡存活至退潮
            color: '#94d2bd',
            vfx: 'boss_siren_safe_bubble',
            vx: Math.cos(moveAngle) * speed,
            vy: Math.sin(moveAngle) * speed,
          });
          state.zones = state.zones || [];
          state.zones.push(bubbleZone);
        }
      }

      // 二階段暗流推動
      if (bc.isPermanentlyFlooded) {
        bc.currentTimer -= dt;
        if (bc.currentTimer <= 0) {
          bc.currentTimer = 7.0 + Math.random() * 4.0;
          bc.currentDuration = 2.0;
          const pushAngle = Math.random() * Math.PI * 2;
          bc.currentDir = { x: Math.cos(pushAngle), y: Math.sin(pushAngle) };
          state.banner = {
            text: '⚠️ 暗流湧動！',
            sub: '強烈水流正往一個方向推動，調整站位！',
            life: 1.8,
            kind: 'phase',
            color: '#94d2bd',
          };
        }

        if (bc.currentDuration > 0) {
          bc.currentDuration -= dt;
          const windForce = 145;
          const currentSafeZones = (state.zones || []).filter((z: any) => z.vfx === 'boss_siren_safe_bubble');
          for (const o of Object.values(state.players) as any[]) {
            if (o.team === 1 && o.alive) {
              // 安全區內的玩家免疫暗流推動 (安全區名符其實「完全安全」)
              const inSafe = currentSafeZones.some((sz: any) => {
                const dx = o.x - sz.x, dy = o.y - sz.y;
                return dx * dx + dy * dy <= sz.radius * sz.radius;
              });
              if (!inSafe) {
                o.x = Math.max(22, Math.min(ARENA.width - 22, o.x + bc.currentDir.x * windForce * dt));
                o.y = Math.max(22, Math.min(ARENA.height - 22, o.y + bc.currentDir.y * windForce * dt));
              }
            }
          }
          if (Math.random() < 0.25) {
            addFx(state, {
              type: 'hit',
              x: Math.random() * ARENA.width,
              y: Math.random() * ARENA.height,
              color: '#00ffff',
              life: 0.45,
              radius: 40,
            });
          }
        }
      }

      // 檢查玩家站位，套用溺水傷害與減速
      for (const o of Object.values(state.players) as any[]) {
        if (o.team === 1 && o.alive) {
          // 判定是否在安全氣泡內
          let inSafeZone = false;
          const currentSafeZones = (state.zones || []).filter((z: any) => z.vfx === 'boss_siren_safe_bubble');
          for (const sz of currentSafeZones) {
            const dx = o.x - sz.x;
            const dy = o.y - sz.y;
            if (dx * dx + dy * dy <= (sz.radius * sz.radius)) {
              inSafeZone = true;
              break;
            }
          }

          if (!inSafeZone) {
            // 溺水減速 25%
            applyEffect(o, 'slow', { duration: 0.35, factor: 0.75 }, boss.id);

            // 溺水傷害每 1.5s 扣 0.5% HP，但不超過最大HP的80% (不致死)
            o._drownTimer = (o._drownTimer || 0) - dt;
            if (o._drownTimer <= 0) {
              o._drownTimer = 1.5;
              if (o.hp > o.maxHp * 0.2) {
                const dmg = Math.max(6, Math.round(o.maxHp * 0.005));
                dealDamage(state, o, dmg, boss.id, { dot: true });
                addFx(state, { type: 'popup', x: o.x, y: o.y - 20, color: '#00ffff', life: 0.75, text: '溺水', kind: 'damage' });
              }
            }
          }
        }
      }
    }

    // 4. 更新水泡禁錮鎖定與持續傷害
    for (const p of Object.values(state.players) as any[]) {
      if (p.team === 1) {
        p.floatHeight = 0;
      }
    }

    const activeWarningZoneIds = new Set();
    for (const o of Object.values(state.players) as any[]) {
      if (o.isMinion && o.charId === -3 && o.alive) {
        if (o.warningZoneId) activeWarningZoneIds.add(o.warningZoneId);

        // 強制鎖定水泡在原地，不受任何擊退與暗流漂移影響
        if (o.spawnX != null && o.spawnY != null) {
          o.x = o.spawnX;
          o.y = o.spawnY;
        }
        o.vx = o.vy = o.kvx = o.kvy = 0;

        const trappedPlayer = state.players[o.trappedPlayerId];
        if (trappedPlayer && trappedPlayer.alive) {
          trappedPlayer.floatHeight = 16;

          // 無論單/多人，都鎖定位置在水泡中心（不能逃跑）
          trappedPlayer.x = o.x;
          trappedPlayer.y = o.y;
          trappedPlayer.vx = trappedPlayer.vy = trappedPlayer.kvx = trappedPlayer.kvy = 0;

          if (o.shouldStun) {
            // 多人：額外施加暈眩，完全無法行動，需隊友集火打爆水泡救人
            applyEffect(trappedPlayer, 'stun', { duration: 0.3 }, boss.id);
          }
          // 單人：鎖定位置但不暈眩 → 玩家仍可使用技能攻擊水泡自救

          // 水泡內持續扣血 (頻率調低至 1.2s，傷害減半為 0.5% 最大生命值)
          // 若水泡落在安全氣泡區內，豁免傷害（獎勵在安全區附近的隊友）
          const safeZonesForBubble = (state.zones || []).filter((z: any) => z.vfx === 'boss_siren_safe_bubble');
          const bubbleInSafe = safeZonesForBubble.some((sz: any) => {
            const dx = o.x - sz.x, dy = o.y - sz.y;
            return dx * dx + dy * dy <= sz.radius * sz.radius;
          });
          o.dmgTimer = (o.dmgTimer || 0) - dt;
          if (o.dmgTimer <= 0) {
            o.dmgTimer = 1.2;
            if (!bubbleInSafe) {
              const dmg = Math.max(6, Math.round(trappedPlayer.maxHp * 0.005));
              dealDamage(state, trappedPlayer, dmg, boss.id, { dot: true });
              addFx(state, { type: 'popup', x: trappedPlayer.x, y: trappedPlayer.y - 22, color: '#ff4d6d', life: 0.75, text: Math.round(dmg), kind: 'damage' });
            }
          }
        }
      }
    }

    // 清除已死亡水泡的地面預警光圈
    state.zones = (state.zones || []).filter((z: any) => {
      if (z.vfx === 'boss_siren_warning_bubble') {
        return activeWarningZoneIds.has(z.id);
      }
      return true;
    });
  },

  renderTick(state: any, boss: any, dt: number, ctx: any) {
    const { sceneMgr, scene, atmosphere } = ctx;
    if (state.bossCustom?.isFlooded) {
      sceneMgr._customOverrideActive = true;
      const oceanColor = 0x002233;
      scene.background = new THREE.Color(oceanColor);

      const osc = Math.sin(state.time * 0.5);
      const near = 700 + osc * 150;
      const far = 1800 + osc * 300;
      scene.fog = new THREE.Fog(oceanColor, near, far);

      const particleRate = Math.round(30 + osc * 15);
      atmosphere.setTheme({ atmosphere: { kind: 'embers', color: '#94d2bd', rate: particleRate } });
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
    // 移除剩餘的安全氣泡
    state.zones = (state.zones || []).filter((z: any) => z.vfx !== 'boss_siren_safe_bubble');
    for (const p of Object.values(state.players) as any[]) {
      if (p.team === 1) {
        delete p.floatHeight;
      }
    }
  },
};

export default new BaseBoss(data, { aiProfile, modelConfig, buildModel, buildWeapon, loadVfx });
