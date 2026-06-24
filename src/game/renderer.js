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
import { applyDecorations, updateDecorationFade } from './render3d/decorations.js';
import { createAtmosphere } from './render3d/atmosphere.js';
import { createBossUltimateAura } from './render3d/bossUltimateAura.js';
import { createTimeAnchorLayer } from './render3d/timeAnchors.js';
import { getBossForRound } from './bosses.js';
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

export function createRenderer(canvas, controlScheme = 'wasd-jkl', hooks = {}) {
  const sceneMgr = createSceneManager(canvas);
  const { scene, camera } = sceneMgr;

  const particles = createParticleSystem(scene, { capacity: 5000 });
  particles.setDpr(sceneMgr.renderer.getPixelRatio());
  const fxbus = createFxBus({ scene, particles, sceneMgr });
  const entities = createEntityLayer(scene, particles, { addTransient: fxbus.addTransient, sceneMgr });
  const hud = createHud({ stage: sceneMgr.stage, scene, camera, controlScheme, hooks });
  const atmosphere = createAtmosphere(particles);
  const bossUltimateAura = createBossUltimateAura({ scene, particles, sceneMgr });
  const timeAnchorLayer = createTimeAnchorLayer(scene);
  let hideSelf = false; // 第一人稱(mode 2)時藏自身模型
  let appliedThemeRound = -1;
  let appliedThemeMode = '';
  const sfx = getSfxManager();

  // 本地視覺狀態 (不進 snapshot)
  let lastT = 0;
  const models = new Map();  // pid -> { group, charId }
  const prev = new Map();    // pid -> { x, y } 上一幀世界座標 (算速度)
  const beams = new Map();   // pid -> { group, geo, core, glow, coreMat, glowMat, colorHex, targetId, used }
  const rangeCircles = new Map(); // pid -> { mesh, geo, mat, colorHex, range, used }
  const tetherLines = new Map(); // id -> { group, geo, core, glow, coreMat, glowMat, used }

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
      // 第一人稱時藏起自身模型（避免相機卡在自己身體內）
      e.group.visible = !(hideSelf && p.id === selfId);

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

      // Model Power Vibration (Visual Shake) for Invincible Bosses
      if (p.isBoss && p.ultLockInvincible) {
        const shakeAmp = 1.35 * (p.scale || 1);
        e.group.position.x += (Math.random() - 0.5) * shakeAmp;
        e.group.position.z += (Math.random() - 0.5) * shakeAmp;
      }

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

      // Check for channeled beam (e.g. Necromancer Life Drain)
      if (p.channel && p.channel.targetId) {
        const targetModel = models.get(p.channel.targetId);
        if (targetModel && targetModel.group.visible) {
          const A = new THREE.Vector3(sceneX(e.rx), 26, sceneZ(e.ry));
          const B = new THREE.Vector3(sceneX(targetModel.rx), 26, sceneZ(targetModel.ry));
          
          let beam = beams.get(p.id);
          const colorHex = p.channel.color || '#7bed9f';
          if (!beam || beam.colorHex !== colorHex || beam.targetId !== p.channel.targetId) {
            if (beam) {
              scene.remove(beam.group);
              beam.geo.dispose();
              beam.coreMat.dispose();
              beam.glowMat.dispose();
            }
            
            const group = new THREE.Group();
            const color = new THREE.Color(colorHex);
            const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
            
            const coreMat = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.DoubleSide
            });
            const core = new THREE.Mesh(geo, coreMat);
            
            const glowMat = new THREE.MeshBasicMaterial({
              color: color,
              transparent: true,
              opacity: 0.45,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.DoubleSide
            });
            const glow = new THREE.Mesh(geo, glowMat);
            
            group.add(core);
            group.add(glow);
            scene.add(group);
            
            beam = { group, geo, core, glow, coreMat, glowMat, colorHex, targetId: p.channel.targetId };
            beams.set(p.id, beam);
          }
          
          const direction = new THREE.Vector3().subVectors(B, A);
          const length = direction.length();
          const dir = direction.clone().normalize();
          
          const alignQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          
          const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 80);
          beam.core.scale.set(1.5 * pulse, 1.0, 1.5 * pulse);
          beam.glow.scale.set(4.0 * pulse, 1.0, 4.0 * pulse);
          
          beam.group.position.copy(A).add(B).multiplyScalar(0.5);
          beam.group.scale.set(1.0, length, 1.0);
          beam.group.setRotationFromQuaternion(alignQuat);
          
          if (Math.random() < 0.35) {
            const t = Math.random();
            const px = B.x + (A.x - B.x) * t;
            const py = B.y + (A.y - B.y) * t;
            const pz = B.z + (A.z - B.z) * t;
            const pdir = new THREE.Vector3().subVectors(A, B).normalize();
            particles.spawn({
              x: px, y: py, z: pz,
              vx: pdir.x * 120 + (Math.random() - 0.5) * 20,
              vy: pdir.y * 120 + (Math.random() - 0.5) * 20,
              vz: pdir.z * 120 + (Math.random() - 0.5) * 20,
              drag: 1.0,
              life: 0.4 + Math.random() * 0.3,
              size: 2.5 + Math.random() * 2.5,
              color: colorHex,
              fade: true
            });
          }
          
          beam.used = true;
        }
      }

      // Check for channeled range circle
      if (p.channel) {
        const range = p.channel.range || 320;
        const colorHex = p.channel.color || '#7bed9f';
        let circle = rangeCircles.get(p.id);
        if (!circle || circle.colorHex !== colorHex || circle.range !== range) {
          if (circle) {
            scene.remove(circle.mesh);
            circle.geo.dispose();
            circle.mat.dispose();
          }
          
          const color = new THREE.Color(colorHex);
          const geo = new THREE.RingGeometry(range * 0.985, range, 64);
          const mat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.35,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.rotation.x = -Math.PI / 2;
          scene.add(mesh);
          
          circle = { mesh, geo, mat, colorHex, range };
          rangeCircles.set(p.id, circle);
        }
        
        circle.mesh.position.set(sceneX(e.rx), 1.5, sceneZ(e.ry));
        circle.mat.opacity = 0.35 + 0.15 * Math.sin(performance.now() / 150);
        circle.used = true;
      }

      // 聆聽者 = 本地玩家位置
      if (p.id === selfId) { selfX = e.rx; selfY = e.ry; }
    }
    if (selfX !== null) sfx.setListener(selfX, selfY);
    // 離開房間的玩家才釋放模型
    for (const [pid, e] of models) {
      if (!seen.has(pid)) { disposeModel(e); models.delete(pid); prev.delete(pid); }
    }

    // Clean up unused beams
    for (const [pid, beam] of beams) {
      if (!beam.used) {
        scene.remove(beam.group);
        beam.geo.dispose();
        beam.coreMat.dispose();
        beam.glowMat.dispose();
        beams.delete(pid);
      } else {
        beam.used = false;
      }
    }

    // Clean up unused range circles
    for (const [pid, circle] of rangeCircles) {
      if (!circle.used) {
        scene.remove(circle.mesh);
        circle.geo.dispose();
        circle.mat.dispose();
        rangeCircles.delete(pid);
      } else {
        circle.used = false;
      }
    }
  }

  function syncTethers(state, dt) {
    for (const line of tetherLines.values()) line.used = false;
    const now = performance.now() / 1000;
    for (const t of state.tethers || []) {
      const a = state.players[t.a];
      const b = state.players[t.b];
      if (!a || !b || !a.alive || !b.alive) continue;
      const id = `${t.a}:${t.b}`;
      let line = tetherLines.get(id);
      if (!line) {
        const group = new THREE.Group();
        const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
        const coreMat = new THREE.MeshBasicMaterial({
          color: 0xfff0ff,
          transparent: true,
          opacity: 0.88,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const glowMat = new THREE.MeshBasicMaterial({
          color: 0xd8b3ff,
          transparent: true,
          opacity: 0.34,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const core = new THREE.Mesh(geo, coreMat);
        const glow = new THREE.Mesh(geo, glowMat);
        group.add(core);
        group.add(glow);
        scene.add(group);
        line = { group, geo, core, glow, coreMat, glowMat, used: false };
        tetherLines.set(id, line);
      }

      const dWorld = Math.hypot(a.x - b.x, a.y - b.y);
      const danger = dWorld < (t.minGap || 200);
      const color = danger ? 0xff4d6d : 0xd8b3ff;
      const pulse = 0.82 + 0.18 * Math.sin(now * (danger ? 15 : 7));
      line.coreMat.color.setHex(danger ? 0xffffff : 0xfff0ff);
      line.glowMat.color.setHex(color);
      line.coreMat.opacity = danger ? 0.95 : 0.72;
      line.glowMat.opacity = danger ? 0.58 : 0.3;
      line.core.scale.set(danger ? 2.2 * pulse : 1.25 * pulse, 1, danger ? 2.2 * pulse : 1.25 * pulse);
      line.glow.scale.set(danger ? 8.5 * pulse : 5.5 * pulse, 1, danger ? 8.5 * pulse : 5.5 * pulse);

      const A = new THREE.Vector3(sceneX(a.x), 34, sceneZ(a.y));
      const B = new THREE.Vector3(sceneX(b.x), 34, sceneZ(b.y));
      const direction = new THREE.Vector3().subVectors(B, A);
      const length = direction.length();
      if (length <= 0.001) continue;
      const dir = direction.clone().normalize();
      const alignQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      line.group.position.copy(A).add(B).multiplyScalar(0.5);
      line.group.scale.set(1, length, 1);
      line.group.setRotationFromQuaternion(alignQuat);
      line.used = true;

      if (danger && Math.random() < dt * 18) {
        const k = Math.random();
        particles.spawn({
          x: A.x + (B.x - A.x) * k,
          y: 34,
          z: A.z + (B.z - A.z) * k,
          vx: (Math.random() - 0.5) * 25,
          vy: 40 + Math.random() * 50,
          vz: (Math.random() - 0.5) * 25,
          drag: 1.2,
          life: 0.35,
          size: 3,
          color: '#ff4d6d',
          fade: true,
        });
      }
    }
    for (const [id, line] of tetherLines) {
      if (line.used) continue;
      scene.remove(line.group);
      line.geo.dispose();
      line.coreMat.dispose();
      line.glowMat.dispose();
      tetherLines.delete(id);
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

  function render(state, selfId, view) {
    const now = performance.now();
    let dt = lastT ? (now - lastT) / 1000 : 0;
    lastT = now;
    if (dt > 0.05) dt = 0.05;
    hideSelf = !!(view && view.mode === 2); // 第一人稱藏自身模型

    if (sceneMgr.resize()) hud.resize();

    // 場景主題：偵測 (mode/round) 變化，套用 Boss 主題色 + 裝飾 + 大氣粒子
    if (state.mode === 'boss') {
      if (state.round !== appliedThemeRound || appliedThemeMode !== 'boss') {
        const data = getBossForRound(state.round);
        const theme = (data && data.theme) || null;
        sceneMgr.applyTheme(theme);
        applyDecorations(sceneMgr.themeGroup, theme || {});
        atmosphere.setTheme(theme || {});
        appliedThemeRound = state.round;
        appliedThemeMode = 'boss';
      }
    } else if (appliedThemeMode !== 'ffa') {
      sceneMgr.applyTheme(null);
      applyDecorations(sceneMgr.themeGroup, {});
      atmosphere.setTheme({});
      appliedThemeMode = 'ffa';
      appliedThemeRound = -1;
    }

    // 相機跟隨焦點 (給 destructibles 視線判斷與 setCameraFocus 用)
    const meP = state.players[selfId];
    let fx = 0, fz = 0;
    if (meP && meP.alive) { fx = sceneX(meP.x); fz = sceneZ(meP.y); }
    else {
      for (const pp of Object.values(state.players)) {
        if (pp.alive && !pp.ownerId && !pp.isBoss) { fx = sceneX(pp.x); fz = sceneZ(pp.y); break; }
      }
    }

    fxbus.process(state);
    syncPlayers(state, selfId, dt);
    syncTethers(state, dt);
    bossUltimateAura.sync(state.players, dt);
    timeAnchorLayer.sync(state.timeAnchors || [], state.timeAnchorRitual, dt);

    updateHuntMarker(state, dt);
    entities.syncProjectiles(state.projectiles, dt);
    entities.syncZones(state.zones, dt);
    entities.syncDestructibles(state.destructibles || [], dt, { x: fx, z: fz });
    entities.syncItems(state.items || [], dt);
    updateDecorationFade(sceneMgr.themeGroup, { x: fx, z: fz }, dt);
    atmosphere.update(dt);
    particles.update(dt);
    fxbus.update(dt);
    // 登場動畫：把鏡頭朝 Boss 推近。intro 期間 strength 隨 t 由 0→1→0 (ease in/out)。
    let introStr = 0, bossSx = 0, bossSz = 0;
    if (state.mode === 'boss' && state.roundPhase === 'intro') {
      const dur = state.introDur || 3.2;
      const elapsed = Math.max(0, dur - (state.roundTimer || 0));
      const t = Math.min(1, elapsed / dur);
      // 0-0.18 推近、0.18-0.78 維持、0.78-1.0 退回
      if (t < 0.18) introStr = t / 0.18;
      else if (t < 0.78) introStr = 1;
      else introStr = Math.max(0, 1 - (t - 0.78) / 0.22);
      for (const pp of Object.values(state.players)) {
        if (pp.isBoss) { bossSx = sceneX(pp.x); bossSz = sceneZ(pp.y); break; }
      }
    }
    sceneMgr.setIntroFocus(introStr, bossSx, bossSz);
    sceneMgr.setCameraFocus(fx, fz);
    sceneMgr.setCameraMode(view ? (view.mode | 0) : 0, view ? view.yaw : 0, view ? view.pitch : 0);
    sceneMgr.update(dt);
    hud.update(state, selfId);

    sceneMgr.render();
    hud.render();
  }

  return { render, dispose: () => { bossUltimateAura.dispose(); timeAnchorLayer.dispose(); for (const line of tetherLines.values()) { scene.remove(line.group); line.geo.dispose(); line.coreMat.dispose(); line.glowMat.dispose(); } } };
}
