// three.js (WebGL) 渲染入口 — 取代舊版 Canvas2D 渲染。
//
// 對外維持相同介面：createRenderer(canvas, controlScheme) -> { render(state, selfId) }
// 模擬/網路/輸入/UI 完全不變；本檔僅負責把遊戲狀態畫成 3D。
//
// 編排：場景(scene.js) + GPU 粒子(particles.js) + 投射物/區域(entities3d.js)
//      + 特效匯流排(fxbus.js) + 角色模型(models.js) + 引擎內 HUD(hud.js)

import * as THREE from 'three';
import { createSceneManager } from './render3d/scene.js';
import { createParticleSystem } from './render3d/particles.js';
import { createEntityLayer } from './render3d/entities3d.js';
import { createFxBus } from './render3d/fxbus.js';
import { createHud } from './render3d/hud.js';
import { createCharacterModel, animateModel, attachSkin } from './render3d/models.js';
import { computeBossVisualState, createBossPartModel } from './bosses/render3d.ts';
import { sceneX, sceneZ } from './render3d/coords.js';
import { getCharacter } from './characters.js';
import { prepareSkin, instantiateSkin } from './render3d/skins.js';
import { WALK_THRESHOLD } from './constants.js';
import { getSfxManager } from '../utils/sfxManager';

// cd 槽位 + 動作類型 → 出手姿勢 (swing 揮砍/出拳 | cast 施法/舉手)
const CD_SLOTS = ['basic', 'skill1', 'skill2', 'ultimate'];
const SWING_TYPES = new Set(['melee', 'dash', 'charge', 'leap', 'grapple', 'multiblink', 'blink']);

// 被獵殺標記 (R7 等「鎖血最少」王)：漂浮在目標頭頂、向下指的發光紅箭頭 (尖端在群組原點)
function buildHuntMarker() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xff6a5a, emissive: 0xff2a1e, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2, transparent: true, opacity: 0.96 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(10, 14, 4), mat); // 四角錐箭頭，尖端朝下
  cone.rotation.x = Math.PI; cone.rotation.y = Math.PI / 4; cone.position.y = 7;
  g.add(cone);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(4.5, 11, 4.5), mat);
  shaft.position.y = 18; g.add(shaft);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.position.y = 10; halo.scale.y = 1.6; g.add(halo);
  g.scale.setScalar(1.85); // 放大整支箭頭，更明顯
  g.userData = { mat };
  return g;
}

export function createRenderer(canvas, controlScheme = 'wasd-jkl') {
  const sceneMgr = createSceneManager(canvas);
  const { scene, camera } = sceneMgr;

  const particles = createParticleSystem(scene, { capacity: 5000 });
  particles.setDpr(sceneMgr.renderer.getPixelRatio());
  const fxbus = createFxBus({ scene, particles, sceneMgr });
  const entities = createEntityLayer(scene, particles, { addTransient: fxbus.addTransient, sceneMgr });
  const hud = createHud({ stage: sceneMgr.stage, scene, camera, controlScheme });
  const sfx = getSfxManager();

  // 本地視覺狀態 (不進 snapshot)
  let lastT = 0;
  const models = new Map();  // pid -> { group, charId }
  const prev = new Map();    // pid -> { x, y } 上一幀世界座標 (算速度)

  // 被獵殺頭頂箭頭：單一可重用物件，每幀定位到目標頭頂 (R7 等)
  let huntPhase = 0;
  const huntMarker = buildHuntMarker();
  huntMarker.visible = false;
  scene.add(huntMarker);

  sceneMgr.resize();
  hud.resize();

  function ensureModel(p) {
    let e = models.get(p.id);
    if (e && e.charId !== p.charId) { disposeModel(e); models.delete(p.id); e = null; }
    if (!e) {
      const group = p.isPart ? createBossPartModel(p.partColor || '#ffffff', p.scale || 1) : createCharacterModel(p.charId);
      // 召喚物 (非魔王) 依 scale 縮小，呈現「小型戰靈」感；魔王模型已於 createCharacterModel 內套 scale，勿重複。
      if (!p.isPart && !p.isBoss && p.scale && p.scale !== 1) group.scale.setScalar(p.scale);
      group.position.set(sceneX(p.x), 0, sceneZ(p.y));
      scene.add(group);
      // rx/ry：渲染端平滑後的世界座標 (邏輯 30Hz、畫面 60Hz 之間插值)；spd：平滑速度
      // lastFootIdx/wasMoving：腳步聲節奏偵測 (走路相位跨越 + 起步保底)
      e = { group, charId: p.charId, isPart: !!p.isPart, skinReq: false, rx: p.x, ry: p.y, spd: 0, wasHidden: false, lastFootIdx: 0, wasMoving: false };
      models.set(p.id, e);
    }
    // 嘗試載入 GLB 皮膚 (只試一次)；成功則覆蓋程序化外觀，無檔/失敗維持程序化
    if (!e.skinReq && !p.isPart) {
      e.skinReq = true;
      prepareSkin(p.charId).then((tpl) => {
        if (!tpl) return;
        if (models.get(p.id) !== e) return; // 已被釋放或換角
        const skin = instantiateSkin(tpl);
        if (skin) attachSkin(e.group, skin, p.charId);
      }).catch(() => {});
    }
    return e;
  }

  function disposeModel(e) {
    const ud = e.group.userData;
    if (ud && ud.skin) {
      ud.skin.mixer.stopAllAction();
      e.group.remove(ud.skin.root);
      // 只 dispose 逐實例 clone 的材質；geometry 由快取模板共用，不可 dispose
      ud.skin.root.traverse((o) => {
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      ud.skin = null;
    }
    scene.remove(e.group);
    e.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }

  function syncPlayers(state, selfId, dt) {
    const seen = new Set();
    let selfX = null, selfY = null; // 本地玩家位置 → 音效聆聽者基準
    for (const p of Object.values(state.players)) {
      seen.add(p.id);
      const e = ensureModel(p);
      // 倒地 (闖關模式)：team1 真人玩家死亡時不消失，留在原地呈現「倒地」狀態供隊友靠近復活。
      // 其餘 (FFA 淘汰 / 魔王陣營 / 召喚物) 死亡即隱藏。
      const downed = state.mode === 'boss' && !p.alive && p.team === 1 && !p.aiId;
      if (!p.alive && !downed) { e.group.visible = false; e.wasHidden = true; continue; }
      // 從隱藏(死亡/重生)轉可見：位置直接對齊，避免從舊位置滑入
      if (e.wasHidden) { e.rx = p.x; e.ry = p.y; e.spd = 0; e.wasHidden = false; }
      e.group.visible = true;

      // ---- 渲染端位置插值 ----
      // 邏輯/網路 30Hz 更新 p.x/p.y，但畫面以 ~60fps 繪製；直接設位置會出現 30Hz 階梯抖動。
      // 用指數平滑朝目標逼近，讓移動在每幀之間補間。
      // 位移過大 (瞬移/衝刺/重生) 直接對齊，不滑行。
      if (Math.hypot(p.x - e.rx, p.y - e.ry) > 80) { e.rx = p.x; e.ry = p.y; }
      const prevRx = e.rx, prevRy = e.ry;
      const lerpK = 1 - Math.exp(-22 * dt);
      e.rx += (p.x - e.rx) * lerpK;
      e.ry += (p.y - e.ry) * lerpK;
      e.group.position.x = sceneX(e.rx);
      e.group.position.z = sceneZ(e.ry);

      // 速度：由平滑後的實際位移推導，再低通平滑 (穩定的 walk/idle 判定，避免動畫抖動)
      const instSpeed = dt > 0 ? Math.hypot(e.rx - prevRx, e.ry - prevRy) / dt : 0;
      e.spd += (instSpeed - e.spd) * Math.min(1, dt * 10);
      const speed = e.spd;

      // prev：保留 hp/cd 以偵測出手/受擊 (位置/速度已改由 e.rx/e.spd 處理)
      let pr = prev.get(p.id);
      if (!pr) { pr = { hp: p.hp, cd: { ...(p.cd || {}) } }; prev.set(p.id, pr); }

      // 出手偵測：任一冷卻槽「上跳」= 剛開招；依動作類型分揮砍/施法 + 對應音效名
      let attackKind = null;
      let sfxName = null, sfxVfx = null;
      if (p.cd) {
        const ch = getCharacter(p.charId);
        for (const slot of CD_SLOTS) {
          const cur = p.cd[slot] || 0, was = (pr.cd && pr.cd[slot]) || 0;
          if (cur > was + 0.12) {
            const a = ch && ch[slot];
            const isSwing = a && SWING_TYPES.has(a.type);
            attackKind = isSwing ? 'swing' : 'cast';
            // 音效名：大招槽→ultimate；位移技→dash/blink；近戰系→swing；其餘(投射/區域/增益)→cast
            sfxName = slot === 'ultimate' ? 'ultimate'
              : (a && a.type === 'dash') ? 'dash'
              : (a && a.type === 'blink') ? 'blink'
              : isSwing ? 'swing' : 'cast';
            sfxVfx = a && a.vfx; // 每角色專屬覆寫名 (缺檔回退泛型)
            break;
          }
        }
      }
      // 受擊偵測：hp 下降
      const hurt = p.hp < pr.hp - 0.5;

      pr.hp = p.hp;
      if (p.cd) { if (!pr.cd) pr.cd = {}; for (const slot of CD_SLOTS) pr.cd[slot] = p.cd[slot] || 0; }

      const bossVisual = p.isBoss ? computeBossVisualState(state, selfId, p, getCharacter(p.charId)) : {};
      animateModel(e.group, dt, { speed, facing: p.facing, p, isSelf: p.id === selfId, attack: attackKind, hurt, downed, fake: !!p.isFake, ...bossVisual });

      // ---- 音效 (renderer-side 本地偵測；host+joiner 各自播放；缺檔靜音不報錯) ----
      // 出手音：每角色 vfx id 優先，缺檔回退泛型 (swing/cast/dash/blink/ultimate)
      if (sfxName) {
        const primary = sfxVfx || sfxName;
        sfx.play(primary, { x: e.rx, y: e.ry, fallback: primary !== sfxName ? sfxName : undefined });
      }
      // 受傷音
      if (hurt) sfx.play('hurt', { x: e.rx, y: e.ry });
      // 腳步音：依走路相位 (models.js ud.phase 每跨 π 為一步) + 起步保底 → 按一下=一聲、按住=連續
      const ud = e.group.userData;
      if (ud) {
        const moving = speed > WALK_THRESHOLD;
        const footIdx = Math.floor(ud.phase / Math.PI);
        if (moving && (!e.wasMoving || footIdx > e.lastFootIdx)) {
          sfx.playFootstep({ x: e.rx, y: e.ry, throttleKey: 'foot' + p.id, minInterval: 0.13 });
        }
        e.lastFootIdx = footIdx;
        e.wasMoving = moving;
      }

      // 聆聽者 = 本地玩家位置
      if (p.id === selfId) { selfX = e.rx; selfY = e.ry; }
    }
    if (selfX !== null) sfx.setListener(selfX, selfY);
    // 離開房間的玩家才釋放模型
    for (const [pid, e] of models) {
      if (!seen.has(pid)) { disposeModel(e); models.delete(pid); prev.delete(pid); }
    }
  }

  // 每幀把箭頭定位到「被獵殺者」(血最少的存活我方) 頭頂；無則隱藏
  function updateHuntMarker(state, dt) {
    huntPhase += dt;
    let huntedId = null;
    if (state.mode === 'boss') {
      let boss = null;
      for (const p of Object.values(state.players)) if (p.isBoss && p.alive) { boss = p; break; }
      const mech = boss && getCharacter(boss.charId).mechanic;
      if (mech && mech.targetLowest) {
        let lo = Infinity;
        for (const p of Object.values(state.players)) if (p.team === 1 && p.alive && p.hp < lo) { lo = p.hp; huntedId = p.id; }
      }
    }
    const e = huntedId && models.get(huntedId);
    if (!e) { huntMarker.visible = false; return; }
    huntMarker.visible = true;
    const bob = Math.sin(huntPhase * 3) * 5;
    huntMarker.position.set(sceneX(e.rx), 96 + bob, sceneZ(e.ry)); // 拉高到名牌上方，更顯眼
    huntMarker.rotation.y += dt * 2;
    huntMarker.userData.mat.emissiveIntensity = 2.4 + 1.0 * (0.5 + 0.5 * Math.sin(huntPhase * 6));
  }

  function render(state, selfId) {
    const now = performance.now();
    let dt = lastT ? (now - lastT) / 1000 : 0;
    lastT = now;
    if (dt > 0.05) dt = 0.05;

    if (sceneMgr.resize()) hud.resize();

    fxbus.process(state);
    syncPlayers(state, selfId, dt);
    updateHuntMarker(state, dt);
    entities.syncProjectiles(state.projectiles, dt);
    entities.syncZones(state.zones, dt);
    particles.update(dt);
    fxbus.update(dt);
    sceneMgr.update(dt);
    hud.update(state, selfId);

    sceneMgr.render();
    hud.render();
  }

  return { render };
}
