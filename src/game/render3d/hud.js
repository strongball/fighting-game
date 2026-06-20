// 引擎內 HUD：CSS2DRenderer 畫頭頂名牌(名稱+血/魔條)；螢幕角落用 DOM 面板(自身狀態/技能冷卻/計分板)。
// 數值邏輯沿用舊版 drawHUD/drawBars。

import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getCharacter } from '../characters.js';
import { ULT_MAX } from '../constants.js';
import { sceneX, sceneZ } from './coords.js';

const HEAD_Y = 90;

// 狀態效果顯示元資料：icon / 顯示名 / 是否為增益
const EFFECT_META = {
  haste:      { icon: '⚡', name: '加速',   buff: true },
  protect:    { icon: '🛡', name: '護體',   buff: true },
  reflect:    { icon: '🪞', name: '反射',   buff: true },
  lifesteal:  { icon: '🩸', name: '吸血',   buff: true },
  rage:       { icon: '🔥', name: '狂暴',   buff: true },
  overdrive:  { icon: '⚡', name: '超載',   buff: true },
  invis:      { icon: '👻', name: '隱身',   buff: true },
  evading:    { icon: '💨', name: '無敵',   buff: true },
  slow:       { icon: '🐢', name: '緩速',   buff: false },
  stun:       { icon: '💫', name: '暈眩',   buff: false },
  root:       { icon: '🌿', name: '定身',   buff: false },
  burn:       { icon: '🔥', name: '燃燒',   buff: false },
  bleed:      { icon: '🩸', name: '流血',   buff: false },
  chill:      { icon: '❄️', name: '冰寒',   buff: false },
  frozen:     { icon: '🧊', name: '冰凍',   buff: false },
  mark:       { icon: '🎯', name: '標記',   buff: false },
  weaken:     { icon: '💀', name: '衰弱',   buff: false },
  dmg_reduce: { icon: '🔻', name: '弱化',   buff: false },
};

function getSkillKeys(controlScheme) {
  if (controlScheme === 'arrows-asdf') {
    return { basic: 'A', skill1: 'S', skill2: 'D', ultimate: 'F' };
  }
  if (controlScheme === 'wasd-ijkl') {
    return { basic: 'J', skill1: 'K', skill2: 'L', ultimate: 'I' };
  }
  return { basic: 'J', skill1: 'K', skill2: 'L', ultimate: ';' };
}

export function createHud({ stage, scene, camera, controlScheme = 'wasd-jkl', hooks = {} }) {
  const css2d = new CSS2DRenderer();
  css2d.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:8;';
  stage.appendChild(css2d.domElement);

  // ---- 螢幕面板 ----
  const layer = document.createElement('div');
  layer.className = 'hud-layer';
  stage.appendChild(layer);

  // 自身狀態 (桌機版，左下)
  const selfDesktop = el('div', 'hud-self-desktop', layer);
  const selfNameD = el('div', 'hud-self-name', selfDesktop);
  const selfTalentD = el('div', 'hud-self-talent', selfDesktop);
  const hpWrapD = el('div', 'hud-bar hp', selfDesktop);
  const hpFillD = el('i', '', hpWrapD);
  const hpTxtD = el('span', '', hpWrapD);
  const mpWrapD = el('div', 'hud-bar mp', selfDesktop);
  const mpFillD = el('i', '', mpWrapD);
  const mpTxtD = el('span', '', mpWrapD);
  const ultWrapD = el('div', 'hud-bar ult', selfDesktop);
  const ultFillD = el('i', '', ultWrapD);
  const ultTxtD = el('span', '', ultWrapD);
  const buffsD = el('div', 'hud-buffs', selfDesktop);
  const skillsContainerD = el('div', 'hud-skills-container', selfDesktop);
  const skillsD = el('div', 'hud-skills', skillsContainerD);
  const evadeWrapD = el('div', 'hud-evade-wrap', skillsContainerD);
  const itemsWrapD = el('div', 'hud-items-wrap', skillsContainerD);
  const keys = getSkillKeys(controlScheme);
  const itemKeys = getItemKeys(controlScheme);
  const chip = {
    basic: skillChip(keys.basic, skillsD),
    skill1: skillChip(keys.skill1, skillsD),
    skill2: skillChip(keys.skill2, skillsD),
    ultimate: skillChip(keys.ultimate, skillsD),
    evade: skillChip('Space', evadeWrapD, 'evade-circle'),
  };
  const itemChips = {
    item1: itemChip(itemKeys.item1, itemsWrapD),
    item2: itemChip(itemKeys.item2, itemsWrapD),
  };

  // 自身狀態 (行動版，左上，極簡)
  const selfMobile = el('div', 'hud-self-mobile', layer);
  const selfNameM = el('div', 'hud-mobile-name', selfMobile);
  const selfTalentM = el('div', 'hud-mobile-talent', selfMobile);
  const barsWrapM = el('div', 'hud-mobile-bars', selfMobile);
  const hpWrapM = el('div', 'hud-mobile-bar hp', barsWrapM);
  const hpFillM = el('i', '', hpWrapM);
  const hpTxtM = el('span', '', hpWrapM);
  const mpWrapM = el('div', 'hud-mobile-bar mp', barsWrapM);
  const mpFillM = el('i', '', mpWrapM);
  const mpTxtM = el('span', '', mpWrapM);
  const buffsM = el('div', 'hud-mobile-buffs', selfMobile);

  // ---- 行動端虛擬搖桿與按鍵 ----
  const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
  let joystickZone, joystickBase, joystickKnob, mobileButtonsZone, mBtns;
  
  if (isMobile) {
    layer.classList.add('is-mobile');
    
    // 搖桿區
    joystickZone = el('div', 'mobile-joystick-zone', layer);
    joystickBase = el('div', 'mobile-joystick-base', joystickZone);
    joystickKnob = el('div', 'mobile-joystick-knob', joystickBase);
    
    // 按鍵區
    mobileButtonsZone = el('div', 'mobile-buttons-zone', layer);
    
    mBtns = {
      basic: mobileButton('basic', 'J', mobileButtonsZone),
      skill1: mobileButton('skill1', 'K', mobileButtonsZone),
      skill2: mobileButton('skill2', 'L', mobileButtonsZone),
      ultimate: mobileButton('ultimate', 'Ult', mobileButtonsZone),
      evade: mobileButton('evade', '閃避', mobileButtonsZone),
      item1: mobileButton('item1', '🍎', mobileButtonsZone),
      item2: mobileButton('item2', '💧', mobileButtonsZone),
    };
    
    // 搖桿事件處理
    let joystickActive = false;
    let joystickStartX = 0;
    let joystickStartY = 0;
    const maxRadius = 30;
    
    joystickZone.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = joystickZone.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      setStyle(joystickBase, 'left', `${x - 40}px`);
      setStyle(joystickBase, 'top', `${y - 40}px`);
      setStyle(joystickBase, 'bottom', 'auto');
      setStyle(joystickBase, 'opacity', '1');
      setStyle(joystickBase, 'transform', 'scale(1)');
      
      joystickActive = true;
      joystickStartX = touch.clientX;
      joystickStartY = touch.clientY;
      
      e.preventDefault();
    }, { passive: false });

    joystickZone.addEventListener('touchmove', (e) => {
      if (!joystickActive) return;
      const touch = e.touches[0];
      
      let dx = touch.clientX - joystickStartX;
      let dy = touch.clientY - joystickStartY;
      const dist = Math.hypot(dx, dy);
      
      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }
      
      setStyle(joystickKnob, 'transform', `translate(${dx}px, ${dy}px)`);
      
      const ndx = dx / maxRadius;
      const ndy = dy / maxRadius;
      
      if (hooks.input && hooks.input.setTouchDirection) {
        hooks.input.setTouchDirection(ndx, ndy);
      }
      
      e.preventDefault();
    }, { passive: false });

    const resetJoystick = (e) => {
      if (!joystickActive) return;
      joystickActive = false;
      
      setStyle(joystickKnob, 'transform', 'translate(0px, 0px)');
      
      setStyle(joystickBase, 'left', '35px');
      setStyle(joystickBase, 'top', 'auto');
      setStyle(joystickBase, 'bottom', '35px');
      setStyle(joystickBase, 'opacity', '0.4');
      setStyle(joystickBase, 'transform', 'scale(0.95)');
      
      if (hooks.input && hooks.input.setTouchDirection) {
        hooks.input.setTouchDirection(0, 0);
      }
      if (e) e.preventDefault();
    };

    joystickZone.addEventListener('touchend', resetJoystick, { passive: false });
    joystickZone.addEventListener('touchcancel', resetJoystick, { passive: false });
    
    // 按鍵事件處理
    Object.values(mBtns).forEach((btn) => {
      btn.root.addEventListener('touchstart', (e) => {
        if (hooks.input && hooks.input.setTouchAction) {
          hooks.input.setTouchAction(btn.id, true);
        }
        btn.root.classList.add('active');
        e.preventDefault();
      }, { passive: false });

      const releaseBtn = (e) => {
        if (hooks.input && hooks.input.setTouchAction) {
          hooks.input.setTouchAction(btn.id, false);
        }
        btn.root.classList.remove('active');
        if (e) e.preventDefault();
      };

      btn.root.addEventListener('touchend', releaseBtn, { passive: false });
      btn.root.addEventListener('touchcancel', releaseBtn, { passive: false });
    });
  }

  function mobileButton(id, keyLabel, parent) {
    const root = el('div', `mbtn mbtn-${id}`, parent);
    const cool = el('div', 'mbtn-cool', root);
    const key = el('span', 'mbtn-key', root);
    setText(key, keyLabel);
    const name = el('span', 'mbtn-name', root);
    const cdTxt = el('span', 'mbtn-cd', root);
    return { root, cool, name, cdTxt, id };
  }

  function updateMobileButton(btn, action, cd, curMana, charId) {
    if (!action) {
      setStyle(btn.root, 'display', 'none');
      return;
    }
    setStyle(btn.root, 'display', 'flex');
    
    setText(btn.name, action.name);
    
    const onCd = cd > 0;
    const cdMax = action.cd || 1;
    const manaCost = action.manaCost || 0;
    const noMana = !onCd && manaCost > 0 && curMana < manaCost;
    const ready = !onCd && !noMana;
    
    btn.root.classList.toggle('ready', ready);
    btn.root.classList.toggle('no-mana', noMana);
    btn.root.classList.toggle('on-cd', onCd);
    
    setStyle(btn.cool, 'height', onCd ? `${(cd / cdMax) * 100}%` : '0%');
    
    if (onCd) {
      setText(btn.cdTxt, `${cd.toFixed(1)}s`);
      setStyle(btn.cdTxt, 'display', 'block');
      setStyle(btn.name, 'display', 'none');
    } else {
      setStyle(btn.cdTxt, 'display', 'none');
      setStyle(btn.name, 'display', 'block');
    }
    
    const char = getCharacter(charId);
    const themeColor = action.color || char.color || '#3aa0ff';
    
    if (ready) {
      setStyle(btn.root, 'borderColor', themeColor);
      setStyle(btn.root, 'background', `radial-gradient(circle, ${hexA(themeColor, 0.45)} 0%, rgba(45, 55, 72, 0.8) 100%)`);
      setStyle(btn.root, 'boxShadow', `0 0 10px ${hexA(themeColor, 0.4)}, 0 4px 12px rgba(0,0,0,0.5)`);
    } else if (noMana) {
      setStyle(btn.root, 'borderColor', '#ff3f3f');
      setStyle(btn.root, 'background', 'rgba(110, 25, 25, 0.75)');
      setStyle(btn.root, 'boxShadow', 'none');
    } else {
      setStyle(btn.root, 'borderColor', 'rgba(255,255,255,0.15)');
      setStyle(btn.root, 'background', 'rgba(25, 30, 40, 0.75)');
      setStyle(btn.root, 'boxShadow', 'none');
    }
  }

  function updateMobileUltButton(btn, action, ult, cd) {
    if (!action) {
      setStyle(btn.root, 'display', 'none');
      return;
    }
    setStyle(btn.root, 'display', 'flex');
    setText(btn.name, action.name);
    
    const r = Math.min(1, ult / ULT_MAX);
    const onCd = cd > 0;
    const ready = r >= 1 && !onCd;
    
    btn.root.classList.toggle('ready', ready);
    btn.root.classList.toggle('on-cd', onCd);
    btn.root.classList.toggle('ult', true);
    
    if (onCd) {
      setStyle(btn.cool, 'height', '100%');
      setText(btn.cdTxt, `${cd.toFixed(1)}s`);
      setStyle(btn.cdTxt, 'display', 'block');
      setStyle(btn.name, 'display', 'none');
    } else {
      setStyle(btn.cool, 'height', `${(1 - r) * 100}%`);
      if (ready) {
        setStyle(btn.cdTxt, 'display', 'none');
        setStyle(btn.name, 'display', 'block');
      } else {
        setText(btn.cdTxt, `${Math.floor(r * 100)}%`);
        setStyle(btn.cdTxt, 'display', 'block');
        setStyle(btn.name, 'display', 'none');
      }
    }
    
    const themeColor = action.color || '#ffd166';
    if (ready) {
      setStyle(btn.root, 'borderColor', themeColor);
      setStyle(btn.root, 'background', `radial-gradient(circle, ${hexA(themeColor, 0.65)} 0%, rgba(45, 55, 72, 0.8) 100%)`);
      setStyle(btn.root, 'boxShadow', `0 0 18px ${hexA(themeColor, 0.85)}, 0 4px 12px rgba(0,0,0,0.5)`);
      btn.root.classList.add('ult-pulse');
    } else {
      setStyle(btn.root, 'borderColor', 'rgba(255,255,255,0.15)');
      setStyle(btn.root, 'background', 'rgba(25, 30, 40, 0.75)');
      setStyle(btn.root, 'boxShadow', 'none');
      btn.root.classList.remove('ult-pulse');
    }
  }

  function updateMobileItemButton(btn, kind, count, isBossMode) {
    if (!isBossMode) {
      setStyle(btn.root, 'display', 'none');
      return;
    }
    setStyle(btn.root, 'display', 'flex');
    const icon = kind === 'heal' ? '🍎' : '💧';
    setText(btn.name, `${icon} x${count}`);
    
    const ready = count > 0;
    btn.root.classList.toggle('ready', ready);
    
    const color = kind === 'heal' ? '#ff4d4d' : '#3aa0ff';
    if (ready) {
      setStyle(btn.root, 'borderColor', color);
      setStyle(btn.root, 'background', `radial-gradient(circle, ${hexA(color, 0.45)} 0%, rgba(45, 55, 72, 0.8) 100%)`);
      setStyle(btn.root, 'boxShadow', `0 0 10px ${hexA(color, 0.4)}, 0 4px 12px rgba(0,0,0,0.5)`);
    } else {
      setStyle(btn.root, 'borderColor', 'rgba(255,255,255,0.15)');
      setStyle(btn.root, 'background', 'rgba(25, 30, 40, 0.75)');
      setStyle(btn.root, 'boxShadow', 'none');
    }
  }

  // 蓄力條 (蓄力技能用，平時隱藏)
  const chargeWrapD = el('div', 'hud-bar charge', selfDesktop);
  const chargeFillD = el('i', '', chargeWrapD);
  const chargeTxtD  = el('span', '', chargeWrapD);
  chargeWrapD.style.display = 'none';

  const chargeWrapM = el('div', 'hud-mobile-bar charge', selfMobile);
  const chargeFillM = el('i', '', chargeWrapM);
  const chargeTxtM  = el('span', '', chargeWrapM);
  chargeWrapM.style.display = 'none';

  // 計分板 (右上)
  const board = el('div', 'hud-board', layer);
  const boardTitle = el('div', 'hud-board-title', board);
  const boardList = el('div', 'hud-board-list', board);

  // 魔王面板 (上方中央) — 闖關模式
  const bossPanel = el('div', 'hud-boss', layer);
  const bossName = el('div', 'hud-boss-name', bossPanel);
  const bossBarWrap = el('div', 'hud-boss-bar', bossPanel);
  const bossFill = el('i', '', bossBarWrap);
  const bossTxt = el('span', '', bossBarWrap);
  const bossParts = el('div', 'hud-boss-parts', bossPanel);
  const bossTags = el('div', 'hud-boss-tags', bossPanel);
  bossPanel.style.display = 'none';

  // 過場橫幅 (中央)
  const banner = el('div', 'hud-banner', layer);
  const bannerText = el('div', 'hud-banner-text', banner);
  const bannerSub = el('div', 'hud-banner-sub', banner);
  const bannerHint = el('div', 'hud-banner-hint', banner);
  banner.style.display = 'none';

  // 站進敵方地面危險區 (毒沼等) 的即時警示：全螢幕綠色暈邊 + 中央提示字
  const hazardWarn = el('div', 'hud-hazard', layer);
  const hazardText = el('div', 'hud-hazard-text', hazardWarn);
  hazardWarn.style.display = 'none';

  // 闖關 Boss 登場動畫 overlay (3 段：暗幕 → 名字滑入 → 機制 tag 揭曉 → 淡出)
  const introOv = el('div', 'hud-intro', layer);
  const introVeil = el('div', 'hud-intro-veil', introOv);
  const introRound = el('div', 'hud-intro-round', introOv);
  const introName = el('div', 'hud-intro-name', introOv);
  const introSub = el('div', 'hud-intro-sub', introOv);
  const introTags = el('div', 'hud-intro-tags', introOv);
  const introHint = el('div', 'hud-intro-hint', introOv);
  introOv.style.display = 'none';

  // 機制提示卡 (右側，固定常駐；H 鍵摺疊)
  const mechCard = el('div', 'hud-mech', layer);
  const mechHead = el('div', 'hud-mech-head', mechCard);
  const mechTitle = el('div', 'hud-mech-title', mechHead);
  mechTitle.textContent = '⚠️ 機制提醒';
  const mechToggle = el('div', 'hud-mech-toggle', mechHead);
  mechToggle.textContent = '[H]';
  const mechBody = el('div', 'hud-mech-body', mechCard);
  const mechHint = el('div', 'hud-mech-hint', mechCard);
  mechCard.style.display = 'none';
  let mechCollapsed = false;
  function setMechCollapsed(c) {
    mechCollapsed = c;
    mechCard.classList.toggle('collapsed', c);
  }
  mechHead.onclick = () => setMechCollapsed(!mechCollapsed);
  function onMechKey(e) {
    if (e.code === 'KeyH' && !e.repeat) setMechCollapsed(!mechCollapsed);
  }
  window.addEventListener('keydown', onMechKey);

  // 全滅後的「重打 / 放棄」面板 — 只在 roundPhase === 'wiped' 顯示
  const wipePanel = el('div', 'hud-wipe', layer);
  const wipeTitle = el('div', 'hud-wipe-title', wipePanel);
  const wipeSub = el('div', 'hud-wipe-sub', wipePanel);
  const wipeActions = el('div', 'hud-wipe-actions', wipePanel);
  const wipeRetry = el('button', 'btn primary', wipeActions);
  wipeRetry.textContent = '🔁 重打本關';
  const wipeQuit = el('button', 'btn ghost', wipeActions);
  wipeQuit.textContent = '🚪 放棄離場';
  const wipeWait = el('div', 'hud-wipe-wait', wipePanel);
  wipeWait.textContent = '等待房主決定…';
  wipePanel.style.display = 'none';
  wipeRetry.onclick = () => { if (hooks.onBossRetry) hooks.onBossRetry(); };
  wipeQuit.onclick = () => { if (hooks.onBossQuit) hooks.onBossQuit(); };

  // 自身狀態警示 (R7 被獵殺 / R9 被靈魂綁定…)，文字動態設定
  const huntWarn = el('div', 'hud-hunt', layer);
  huntWarn.style.display = 'none';

  // 頭頂名牌
  const plates = new Map(); // pid -> { obj, name, hp, mp, root }
  const hpTrack = new Map(); // pid -> { hp, hitAt } 供「隱身被打到才短暫顯示血條」用

  function ensurePlate(pid) {
    let pl = plates.get(pid);
    if (!pl) {
      const root = document.createElement('div');
      root.className = 'nplate';
      const status = el('div', 'nstatus', root);
      const name = el('div', 'nname', root);
      const hpw = el('div', 'nbar', root); const hp = el('i', '', hpw);
      const mpw = el('div', 'nbar mana', root); const mp = el('i', '', mpw);
      const buffs = el('div', 'nbuffs', root);
      const obj = new CSS2DObject(root);
      scene.add(obj);
      pl = { obj, name, hp, mp, root, status, buffs };
      plates.set(pid, pl);
    }
    return pl;
  }

  function update(state, selfId) {
    const players = Object.values(state.players);
    const now = performance.now();
    // 頭頂名牌
    const me0 = state.players[selfId];
    const selfTeam = me0 ? (me0.team || 0) : 0;
    const rel = (p) => {
      if (p.id === selfId) return 'self';
      if (selfTeam > 0 && (p.team || 0) === selfTeam) return 'ally';
      return 'enemy';
    };
    const seen = new Set();
    // R7 類 (鎖血最少) 魔王：找出被獵殺的隊友 (血最少的存活我方)，名牌標 🎯、自己被鎖則跳警示
    let huntedId = null;
    if (state.mode === 'boss') {
      let hb = null;
      for (const p of players) if (p.isBoss && p.alive) { hb = p; break; }
      const hm = hb && getCharacter(hb.charId).mechanic;
      if (hm && hm.targetLowest) {
        let lo = Infinity;
        for (const p of players) if (p.team === 1 && p.alive && p.hp < lo) { lo = p.hp; huntedId = p.id; }
      }
    }
    // 自身狀態警示：R7 被獵殺 / R9 被靈魂綁定 (鎖鏈連線本身由 bossMode 畫，這裡提醒被綁的人拉開)
    let selfAlert = '';
    if (huntedId && huntedId === selfId) selfAlert = '🐺 你被盯上了！快拉開距離';
    else if (state.tethers && state.tethers.some((t) => t.a === selfId || t.b === selfId)) selfAlert = '🔗 你被靈魂綁定 — 與隊友拉開距離';
    setStyle(huntWarn, 'display', selfAlert ? '' : 'none');
    if (selfAlert) setText(huntWarn, selfAlert);
    for (const p of players) {
      const r = rel(p);
      const invis = p.effects && p.effects.invis;
      // 受傷追蹤：隱身敵人「被打到」後短暫顯示名牌(血條)，修正「帳面不扣血卻暴斃」的錯覺。
      let tr = hpTrack.get(p.id);
      if (!tr) { tr = { hp: p.hp, hitAt: -1e9 }; hpTrack.set(p.id, tr); }
      if (p.hp < tr.hp - 0.5) tr.hitAt = now;
      tr.hp = p.hp;
      const recentlyHit = now - tr.hitAt < 1500;
      const invisHidden = invis && r === 'enemy' && !recentlyHit; // 友方/自己隱身仍可見；被打到的敵人短暫現形
      // 倒地 (闖關復活)：team1 真人死亡不隱藏名牌，顯示復活進度供隊友辨識
      const downed = state.mode === 'boss' && !p.alive && p.team === 1 && !p.aiId;
      if ((!p.alive && !downed) || invisHidden) continue;
      seen.add(p.id);
      const pl = ensurePlate(p.id);
      const headY = HEAD_Y * (p.scale && p.scale > 1 ? p.scale : 1); // 巨大魔王名牌抬高到頭頂
      pl.obj.position.set(sceneX(p.x), headY, sceneZ(p.y));
      if (downed) {
        const prog = Math.floor(Math.min(1, (p.reviveProg || 0) / 3) * 100);
        setText(pl.name, `${p.name}　倒地 ${prog}%`);
        setStyle(pl.name, 'color', '#ff9a3c');
      } else {
        const hunted = p.id === huntedId;
        setText(pl.name, p.name);
        // 名牌依敵我上色；被獵殺者名字標紅 (頭頂另有 3D 箭頭指示)；solo 模式敵人不標紅
        setStyle(pl.name, 'color', hunted ? '#ff5a5a' : r === 'self' ? '#ffd54a' : r === 'ally' ? '#6ee7a8' : (selfTeam > 0 ? '#ff8a80' : '#ffffff'));
      }
      setStyle(pl.hp, 'width', pct(p.hp / p.maxHp));
      setStyle(pl.mp, 'width', pct(p.mana / p.maxMana));
      setHtml(pl.buffs, buildPlateBuffs(p));
      const sInfo = stunInfo(p);
      if (sInfo) {
        setStyle(pl.status, 'display', '');
        setHtml(pl.status, `<span class="sw">${sInfo.icon}</span><span class="sw" style="animation-delay:.18s">${sInfo.icon}</span><span class="sw" style="animation-delay:.36s">${sInfo.icon}</span><b>${sInfo.label}</b>`);
        setStyle(pl.status, 'color', sInfo.color);
      } else {
        setStyle(pl.status, 'display', 'none');
      }
      pl.obj.visible = true;
    }
    for (const [pid, pl] of plates) if (!seen.has(pid)) pl.obj.visible = false;
    for (const pid of hpTrack.keys()) if (!state.players[pid]) hpTrack.delete(pid); // 清理離場實體

    // 自身面板
    const me = state.players[selfId];
    if (me) {
      const c = getCharacter(me.charId);
      
      if (!isMobile) {
        setStyle(selfDesktop, 'display', '');
        setStyle(selfMobile, 'display', 'none');
        
        setText(selfNameD, `${me.name}　(${c.name})${me.alive ? '' : '　— 淘汰'}`);
        setStyle(selfNameD, 'color', me.alive ? '#fff' : '#ff7675');
        setText(selfTalentD, c.talent ? `天賦 ${c.talent.name}` : '');
        setStyle(hpFillD, 'width', pct(me.hp / me.maxHp));
        setText(hpTxtD, `${Math.ceil(me.hp)}/${me.maxHp}`);
        setStyle(mpFillD, 'width', pct(me.mana / me.maxMana));
        setText(mpTxtD, `${Math.ceil(me.mana)}/${me.maxMana}`);
        const ultR = Math.min(1, (me.ult || 0) / ULT_MAX);
        const ultReady = ultR >= 1 && me.cd.ultimate <= 0;
        setStyle(ultFillD, 'width', pct(ultR));
        ultWrapD.classList.toggle('ready', ultReady);
        setText(ultTxtD, ultReady ? '終極 就緒！' : `終極 ${Math.floor(ultR * 100)}%`);
        setHtml(buffsD, buildBuffHtml(me));
        setChip(chip.basic,  c.basic,  me.cd.basic,   me.mana);
        setChip(chip.skill1, c.skill1, me.cd.skill1,  me.mana);
        setChip(chip.skill2, c.skill2, me.cd.skill2,  me.mana);
        setUltChip(chip.ultimate, c.ultimate, me.ult || 0, me.cd.ultimate);
        setChip(chip.evade, c.evade, me.cd.evade, me.mana);
        updateItemChip(itemChips.item1, 'heal', me.itemHp || 0, state.mode === 'boss');
        updateItemChip(itemChips.item2, 'mana', me.itemMp || 0, state.mode === 'boss');
      } else {
        setStyle(selfDesktop, 'display', 'none');
        setStyle(selfMobile, 'display', '');
        
        setText(selfNameM, `${me.name} (${c.name})${me.alive ? '' : ' - 淘汰'}`);
        setStyle(selfNameM, 'color', me.alive ? '#fff' : '#ff7675');
        setText(selfTalentM, c.talent ? `天賦: ${c.talent.name}` : '');
        setStyle(hpFillM, 'width', pct(me.hp / me.maxHp));
        setText(hpTxtM, `${Math.ceil(me.hp)}/${me.maxHp}`);
        setStyle(mpFillM, 'width', pct(me.mana / me.maxMana));
        setText(mpTxtM, `${Math.ceil(me.mana)}/${me.maxMana}`);
        setHtml(buffsM, buildBuffHtml(me));
        
        const showControls = me.alive && state.roundPhase !== 'wiped' && state.roundPhase !== 'cleared';
        const wasShown = joystickZone.style.display !== 'none';
        
        setStyle(joystickZone, 'display', showControls ? '' : 'none');
        setStyle(mobileButtonsZone, 'display', showControls ? '' : 'none');
        
        if (!showControls && wasShown) {
          // Reset joystick position visually
          setStyle(joystickKnob, 'transform', 'translate(0px, 0px)');
          setStyle(joystickBase, 'left', '35px');
          setStyle(joystickBase, 'top', 'auto');
          setStyle(joystickBase, 'bottom', '35px');
          setStyle(joystickBase, 'opacity', '0.4');
          setStyle(joystickBase, 'transform', 'scale(0.95)');
          
          // Clear logical inputs to prevent stuck movement/actions
          if (hooks.input) {
            if (hooks.input.setTouchDirection) hooks.input.setTouchDirection(0, 0);
            if (hooks.input.setTouchAction) {
              hooks.input.setTouchAction('basic', false);
              hooks.input.setTouchAction('skill1', false);
              hooks.input.setTouchAction('skill2', false);
              hooks.input.setTouchAction('ultimate', false);
              hooks.input.setTouchAction('evade', false);
              hooks.input.setTouchAction('item1', false);
              hooks.input.setTouchAction('item2', false);
            }
          }
        }
        
        if (showControls) {
          updateMobileButton(mBtns.basic, c.basic, me.cd.basic, me.mana, me.charId);
          updateMobileButton(mBtns.skill1, c.skill1, me.cd.skill1, me.mana, me.charId);
          updateMobileButton(mBtns.skill2, c.skill2, me.cd.skill2, me.mana, me.charId);
          updateMobileUltButton(mBtns.ultimate, c.ultimate, me.ult || 0, me.cd.ultimate);
          updateMobileButton(mBtns.evade, c.evade, me.cd.evade, me.mana, me.charId);
          updateMobileItemButton(mBtns.item1, 'heal', me.itemHp || 0, state.mode === 'boss');
          updateMobileItemButton(mBtns.item2, 'mana', me.itemMp || 0, state.mode === 'boss');
        }
      }

      // 蓄力條
      const cs = me.chargeState;
      const chargeAction = cs && c[cs.slot];
      if (cs && chargeAction && chargeAction.chargeMax) {
        const r = Math.min(1, cs.time / chargeAction.chargeMax);
        const isFull = r >= 0.99;
        const txt = isFull ? '🔥 蓄力全滿！' : `蓄力中 ${Math.floor(r * 100)}%`;
        
        if (!isMobile) {
          setStyle(chargeWrapD, 'display', '');
          setStyle(chargeWrapM, 'display', 'none');
          setStyle(chargeFillD, 'width', pct(r));
          chargeWrapD.classList.toggle('full', isFull);
          setText(chargeTxtD, txt);
        } else {
          setStyle(chargeWrapD, 'display', 'none');
          setStyle(chargeWrapM, 'display', '');
          setStyle(chargeFillM, 'width', pct(r));
          chargeWrapM.classList.toggle('full', isFull);
          setText(chargeTxtM, txt);
        }
      } else {
        setStyle(chargeWrapD, 'display', 'none');
        setStyle(chargeWrapM, 'display', 'none');
      }
    } else {
      setStyle(selfDesktop, 'display', 'none');
      setStyle(selfMobile, 'display', 'none');
    }

    // 計分板
    const isBoss = state.mode === 'boss';
    // 排除召喚物/小兵/分身/部位 (皆帶 ownerId)，只列真實玩家與魔王。
    const realPlayers = players.filter((p) => !p.ownerId);
    const listPlayers = isBoss ? realPlayers.filter((p) => p.team === 1) : realPlayers;
    const sorted = listPlayers.slice().sort((a, b) => b.kills - a.kills);
    const aliveN = listPlayers.filter((p) => p.alive).length;
    setText(boardTitle, isBoss ? `闖關隊伍 ${aliveN}/${listPlayers.length} 存活` : `存活 ${aliveN} 人`);
    let html = '';
    for (const p of sorted) {
      const cls = p.id === selfId ? 'me' : p.alive ? '' : 'dead';
      let tag = p.alive ? '' : ' ✕';
      if (isBoss && !p.alive) { const rp = Math.floor(Math.min(1, (p.reviveProg || 0) / 3) * 100); tag = ` 倒地 ${rp}%`; }
      html += `<div class="row ${cls}">${esc(getCharacter(p.charId).name)} ${esc(p.name)}${isBoss ? '' : '　K:' + p.kills}${tag}</div>`;
    }
    setHtml(boardList, html);

    // ---- 闖關模式：魔王血條 / 部位 / 過場橫幅 ----
    if (isBoss) {
      let boss = null;
      for (const p of players) if (p.isBoss) { boss = p; break; }
      if (boss && boss.alive && state.roundPhase !== 'cleared') {
        setStyle(bossPanel, 'display', '');
        const bc = getCharacter(boss.charId);
        setText(bossName, `ROUND ${state.round}　${bc.subtitle ? bc.subtitle + '「' + bc.name + '」' : bc.name}`);
        const hp = state.bossHp != null ? state.bossHp : boss.hp;
        const mhp = state.bossMaxHp || boss.maxHp;
        setStyle(bossFill, 'width', pct(hp / mhp));
        setText(bossTxt, `${Math.ceil(hp)} / ${mhp}`);
        const parts = players.filter((p) => p.isPart && p.ownerId === boss.id);
        if (parts.length) {
          let ph = '';
          for (const pp of parts) {
            const dead = !pp.alive;
            const w = dead ? 0 : Math.max(0, Math.min(100, (pp.hp / pp.maxHp) * 100));
            ph += `<div class="bpart ${dead ? 'dead' : ''}"><span>${esc(partLabel(bc, pp.partId))}${dead ? ' 已破壞' : ''}</span><b><i style="width:${w}%"></i></b></div>`;
          }
          setHtml(bossParts, ph);
        } else setHtml(bossParts, '');
        // 常駐機制晶片 (由 boss 資料的 tags 驅動)
        if (bc.tags && bc.tags.length) {
          setHtml(bossTags, bc.tags.map((t) => `<span class="btag">${esc(t.icon || '')} ${esc(t.text)}</span>`).join(''));
        } else setHtml(bossTags, '');
      } else {
        setStyle(bossPanel, 'display', 'none');
      }
      // intro 階段用大型登場 overlay；cleared 階段用原 banner
      const inIntro = state.roundPhase === 'intro';
      if (inIntro) {
        setStyle(banner, 'display', 'none');
        const dur = state.introDur || 3.2;
        const t = Math.max(0, Math.min(1, 1 - (state.roundTimer || 0) / dur));
        renderIntro({
          t, boss, round: state.round, banner: state.banner,
          el: { root: introOv, veil: introVeil, round: introRound, name: introName, sub: introSub, tags: introTags, hint: introHint },
        });
      } else if (state.banner && (state.banner.life == null || state.banner.life > 0)) {
        setStyle(introOv, 'display', 'none');
        setStyle(banner, 'display', '');
        const isPhase = state.banner.kind === 'phase';
        setClass(banner, 'hud-banner' + (isPhase ? ' phase' : ''));
        if (isPhase && state.banner.color) {
          setStyle(banner, 'borderColor', state.banner.color);
          setStyle(bannerText, 'color', state.banner.color);
        } else {
          setStyle(banner, 'borderColor', '');
          setStyle(bannerText, 'color', '');
        }
        setText(bannerText, state.banner.text || '');
        setText(bannerSub, state.banner.sub || '');
        const bh = boss && !isPhase ? (getCharacter(boss.charId).hint || '') : '';
        setText(bannerHint, bh);
        setStyle(bannerHint, 'display', bh ? '' : 'none');
      } else { setStyle(banner, 'display', 'none'); setStyle(introOv, 'display', 'none'); }
    } else {
      setStyle(bossPanel, 'display', 'none');
      setStyle(banner, 'display', 'none');
      setStyle(introOv, 'display', 'none');
    }

    // ---- 站進敵方地面危險區 (毒沼等) → 全螢幕警示 (通用：任何敵方造成的 zone) ----
    let inHazard = false;
    if (state.mode === 'boss') {
      const meH = state.players[selfId];
      if (meH && meH.alive && state.zones) {
        for (const z of state.zones) {
          if (z.delay && z.delay > 0) continue;            // 預警中、尚未生效
          const owner = state.players[z.owner];
          if (!owner || owner.team === meH.team) continue;  // 只警示敵方造成的區域
          if (Math.hypot(z.x - meH.x, z.y - meH.y) <= (z.radius || 0)) { inHazard = true; break; }
        }
      }
    }
    setStyle(hazardWarn, 'display', inHazard ? '' : 'none');

    // 機制提示卡：boss 模式才顯示；intro / fighting / wiped 都顯示，cleared 時隱藏
    const isBossMode = state.mode === 'boss';
    const showMech = isBossMode && state.roundPhase !== 'cleared' && !state.banner;
    setStyle(mechCard, 'display', showMech ? '' : 'none');
    if (showMech) {
      let bossForCard = null;
      for (const pp of players) if (pp.isBoss) { bossForCard = pp; break; }
      const bc = bossForCard ? getCharacter(bossForCard.charId) : null;
      const overrideTags = bossForCard && bossForCard.phaseTagsOverride;
      const tags = overrideTags || (bc && bc.tags);
      if (tags && tags.length) {
        const html = tags.map((t) => `<div class="hud-mech-row"><em>${esc(t.icon || '⚠️')}</em><span>${esc(t.text)}</span></div>`).join('');
        setHtml(mechBody, html);
      } else setHtml(mechBody, '<div class="hud-mech-row dim">無特殊機制</div>');
      setText(mechHint, bc && bc.hint ? bc.hint : '');
      setStyle(mechHint, 'display', bc && bc.hint ? '' : 'none');
    }

    // 全滅面板：只在 boss 模式且 roundPhase === 'wiped' 顯示
    const wiped = state.mode === 'boss' && state.roundPhase === 'wiped';
    setStyle(wipePanel, 'display', wiped ? '' : 'none');
    if (wiped) {
      const isHost = hooks.isHost ? hooks.isHost() : false;
      const retries = (state.stats && state.stats._retryCount) || 0;
      setText(wipeTitle, `💀 ROUND ${state.bossWipedRound || state.round} — 全隊倒下`);
      setText(wipeSub, retries > 0 ? `已重打 ${retries} 次` : '想再試一次嗎？');
      setStyle(wipeActions, 'display', isHost ? '' : 'none');
      setStyle(wipeWait, 'display', isHost ? 'none' : '');
    }
    if (inHazard) {
      // 文字與顏色都依當前魔王的危險屬性 (毒綠 / 火紅 / 冰藍…)，不再一律綠色
      let ht = '⚠️ 站在危險地面上 — 快離開！', hc = '#9ad13a';
      for (const pp of players) { if (pp.isBoss) { const bcz = getCharacter(pp.charId); if (bcz.hazardText) ht = bcz.hazardText; if (bcz.hazardColor) hc = bcz.hazardColor; break; } }
      setText(hazardText, ht);
      // 字用「淡色 + 深色描邊 + 同色外光暈」(無底牌，與其他 HUD 一致)：在紅/綠/藍任何畫面都讀得清
      setStyle(hazardText, 'color', lighten(hc, 0.55));
      setStyle(hazardText, 'textShadow', `0 1px 3px #000, 0 2px 7px #000, 0 0 16px ${hexA(hc, 0.85)}`);
      setStyle(hazardWarn, 'boxShadow', `inset 0 0 120px 34px ${hexA(hc, 0.5)}`);
    }
  }

  function partLabel(bc, partId) {
    const parts = bc.model && bc.model.parts;
    if (parts) { const f = parts.find((x) => x.id === partId); if (f) return f.label; }
    return partId;
  }

  function setChip(c, action, cd, curMana) {
    if (c.root.classList.contains('evade-circle')) {
      setHtml(c.label, `<span class="key-name">${c.key}</span><span class="skill-name">${action.name}</span>`);
    } else {
      setText(c.label, `${c.key} ${action.name}`);
    }
    const onCd    = cd > 0;
    const cdMax   = action.cd || 1;
    const manaCost = action.manaCost || 0;
    const noMana  = !onCd && manaCost > 0 && curMana < manaCost;
    const ready   = !onCd && !noMana;

    c.root.classList.toggle('ready',   ready);
    c.root.classList.toggle('no-mana', noMana);
    c.root.classList.toggle('on-cd',   onCd);

    // 冷卻遮罩（從頂部向下收縮）
    setStyle(c.cool, 'height', onCd ? '100%' : '0%');

    // 底部 CD 恢復條
    if (onCd) {
      const readyRatio = 1 - Math.max(0, Math.min(1, cd / cdMax));
      setStyle(c.cdBar, 'width', `${readyRatio * 100}%`);
      setClass(c.cdBar, 'cd-bar');
      setText(c.cdSub, `${cd.toFixed(1)}s`);
      setStyle(c.cdSub, 'display', 'block');
    } else {
      setStyle(c.cdBar, 'width', ready ? '100%' : '0%');
      setClass(c.cdBar, ready ? 'cd-bar ready' : 'cd-bar no-mana');
      setStyle(c.cdSub, 'display', 'none');
    }

    // 魔力不足文字
    setStyle(c.manaHint, 'display', noMana ? 'block' : 'none');
    if (noMana) setText(c.manaHint, `魔力不足 (${manaCost})`);
  }

  // 大招 chip：以能量充能度顯示填充；滿且無連發冷卻 = 就緒發光
  function setUltChip(c, action, ult, cd) {
    if (!action) { setStyle(c.root, 'display', 'none'); return; }
    setStyle(c.root, 'display', '');
    setText(c.label, `${c.key} ${action.name}`);
    const r = Math.min(1, (ult || 0) / ULT_MAX);
    const onCd = cd > 0;
    const ready = r >= 1 && !onCd;
    c.root.classList.toggle('ready',   ready);
    c.root.classList.toggle('no-mana', false);
    c.root.classList.toggle('on-cd',   onCd);
    c.root.classList.toggle('ult', true);
    // 冷卻遮罩：onCd 時全遮，否則靠能量條
    setStyle(c.cool, 'height', onCd ? '100%' : '0%');
    // 底部能量條（金色）
    setStyle(c.cdBar, 'width', `${r * 100}%`);
    setClass(c.cdBar, ready ? 'cd-bar ult-ready' : 'cd-bar ult');
    setText(c.cdSub, onCd ? `${cd.toFixed(1)}s` : `${Math.floor(r * 100)}%`);
    setStyle(c.cdSub, 'display', (!ready) ? 'block' : 'none');
    setStyle(c.manaHint, 'display', 'none');
  }

  function render() { css2d.render(scene, camera); }
  function resize() {
    const w = Math.max(1, stage.clientWidth | 0), h = Math.max(1, stage.clientHeight | 0);
    css2d.setSize(w, h);
  }
  function clear() {
    for (const pl of plates.values()) scene.remove(pl.obj);
    plates.clear();
    window.removeEventListener('keydown', onMechKey);
  }

  return { update, render, resize, clear };
}

function skillChip(key, parent, extraClass = '') {
  const root    = el('div', 'chip' + (extraClass ? ' ' + extraClass : ''), parent);
  const cool    = el('i', 'cool', root);         // 冷卻遮罩 (從頂部向下)
  const label   = el('span', 'chip-label', root); // 按鍵 + 技能名
  const cdBar   = el('b', 'cd-bar', root);        // 底部進度條
  const cdSub   = el('s', 'cd-sub', root);        // 慢速/冷卻秒數 / 能量 %
  const manaHint = el('u', 'mana-hint', root);    // 魔力不足提示
  cdSub.style.display = 'none';
  manaHint.style.display = 'none';
  return { root, label, cool, cdBar, cdSub, manaHint, key };
}

function getItemKeys(controlScheme) {
  if (controlScheme === 'arrows-asdf') {
    return { item1: 'Q', item2: 'E' };
  }
  if (controlScheme === 'wasd-ijkl') {
    return { item1: 'U', item2: 'O' };
  }
  return { item1: 'U', item2: 'I' };
}

function itemChip(key, parent) {
  const root = el('div', 'chip item-slot', parent);
  const label = el('span', 'chip-label', root);
  const countLabel = el('s', 'item-count', root);
  setText(label, key);
  return { root, label, countLabel, key };
}

function updateItemChip(chip, kind, count, isBossMode) {
  if (!isBossMode) {
    setStyle(chip.root, 'display', 'none');
    return;
  }
  setStyle(chip.root, 'display', 'block');
  const name = kind === 'heal' ? '🍎 生命' : '💧 魔力';
  const color = kind === 'heal' ? '#ff4d4d' : '#3aa0ff';
  
  if (count > 0) {
    chip.root.classList.add('ready');
    setText(chip.label, `${chip.key} ${name}`);
    setText(chip.countLabel, `x${count}`);
    chip.countLabel.style.display = 'block';
    setStyle(chip.root, 'borderColor', color);
  } else {
    chip.root.classList.remove('ready');
    setText(chip.label, `${chip.key} 空`);
    setText(chip.countLabel, '');
    chip.countLabel.style.display = 'none';
    setStyle(chip.root, 'borderColor', 'rgba(255,255,255,0.08)');
  }
}

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}
// 只在值真的改變時才寫 DOM；避免每幀重複寫入 textContent/style/innerHTML
// 造成不必要的 reflow/repaint（在 DevTools 會看到元素「瘋狂閃爍」）。
function setText(e, v) { if (e._txt !== v) { e._txt = v; e.textContent = v; } }
function setStyle(e, k, v) { const p = '_st_' + k; if (e[p] !== v) { e[p] = v; e.style[k] = v; } }
function setClass(e, v) { if (e._cls !== v) { e._cls = v; e.className = v; } }
function setHtml(e, v) { if (e._html !== v) { e._html = v; e.innerHTML = v; } }
function pct(r) { return `${Math.max(0, Math.min(1, r)) * 100}%`; }
function hexA(hex, a) { const h = hex.replace('#', ''); const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; const n = parseInt(s, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function lighten(hex, t) { const h = hex.replace('#', ''); const s = h.length === 3 ? h.split('').map((c) => c + c).join('') : h; const n = parseInt(s, 16); const m = (c) => Math.round(c + (255 - c) * t); return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`; }
function esc(s) { return String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }

// 闖關 Boss 登場動畫：以 0-1 的進度 t 推進 3 段表演
// 0-0.25: 暗幕降下 + ROUND N 浮現
// 0.25-0.7: 魔王名 + 副標巨字滑入；機制 tag 卡逐條進場
// 0.7-1.0: 全部淡出
function renderIntro({ t, boss, round, banner, el }) {
  if (!el.root) return;
  el.root.style.display = '';
  const bc = boss ? getCharacterCachedHud(boss.charId) : null;

  // 暗幕：0-0.7 全顯，之後淡出
  const veilA = t < 0.05 ? t / 0.05 : (t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3));
  el.veil.style.opacity = String(veilA * 0.75);

  // ROUND N：0.05 出現、放大；0.85 後淡出
  const roundFade = t < 0.08 ? 0 : t < 0.18 ? (t - 0.08) / 0.1 : t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
  el.round.style.opacity = String(roundFade);
  setText(el.round, `ROUND ${round || 1}`);

  // 名字：0.2 由右滑入；0.85 後淡出
  const nameOpa = t < 0.2 ? 0 : t < 0.3 ? (t - 0.2) / 0.1 : t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
  const nameSlide = t < 0.2 ? 160 : t < 0.35 ? (1 - (t - 0.2) / 0.15) * 160 : 0;
  el.name.style.opacity = String(nameOpa);
  el.name.style.transform = `translateX(${nameSlide}px)`;
  setText(el.name, bc ? bc.name : (banner && banner.text) || '');

  // 副標：0.32 後跟著上
  const subOpa = t < 0.32 ? 0 : t < 0.42 ? (t - 0.32) / 0.1 : t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1;
  el.sub.style.opacity = String(subOpa);
  setText(el.sub, bc ? bc.subtitle || '' : '');

  // tag 機制卡：0.45 後逐條從下往上彈
  const tags = bc && bc.tags ? bc.tags : [];
  let tagsHtml = '';
  for (let i = 0; i < tags.length; i++) {
    const start = 0.45 + i * 0.08;
    const local = (t - start) / 0.15;
    const opa = local < 0 ? 0 : local > 1 ? (t > 0.85 ? Math.max(0, 1 - (t - 0.85) / 0.15) : 1) : local;
    const rise = local < 0 ? 30 : local > 1 ? 0 : (1 - local) * 30;
    const tt = tags[i];
    tagsHtml += `<div class="hud-intro-tag" style="opacity:${opa};transform:translateY(${rise}px)"><em>${esc(tt.icon || '⚠️')}</em><span>${esc(tt.text)}</span></div>`;
  }
  setHtml(el.tags, tagsHtml);

  // hint：最後 0.6 後出現
  const hintOpa = t < 0.6 ? 0 : t < 0.7 ? (t - 0.6) / 0.1 : t > 0.9 ? Math.max(0, 1 - (t - 0.9) / 0.1) : 1;
  el.hint.style.opacity = String(hintOpa);
  setText(el.hint, bc && bc.hint ? bc.hint : '');
}

function getCharacterCachedHud(id) { return getCharacter(id); }

function buildPlateBuffs(p) {
  const list = [];
  if (p.shield > 0) list.push({ buff: true, icon: '🛡' });
  const eff = p.effects || {};
  for (const key of Object.keys(eff)) {
    const data = eff[key]; if (!data) continue;
    const meta = EFFECT_META[key]; if (!meta) continue;
    if (data.remaining != null && data.remaining <= 0) continue;
    list.push({ buff: meta.buff, icon: meta.icon });
  }
  if (!list.length) return '';
  list.sort((a, b) => (b.buff ? 1 : 0) - (a.buff ? 1 : 0));
  return list.slice(0, 8).map((b) => `<em class="${b.buff ? 'buff' : 'debuff'}">${b.icon}</em>`).join('');
}

function stunInfo(p) {
  const eff = p.effects || {};
  if (eff.frozen && eff.frozen.remaining > 0) return { icon: '🧊', label: '冰凍', color: '#9bd9ff' };
  if (eff.stun && eff.stun.remaining > 0)     return { icon: '💫', label: '暈眩', color: '#ffd166' };
  if (eff.root && eff.root.remaining > 0)     return { icon: '🌿', label: '定身', color: '#a3e635' };
  // Boss 破綻窗口
  if (p.isBoss && (p.recoverWindow || 0) > 0) {
    return { icon: '💥', label: p.recoverHeavy ? '巨大破綻！' : '破綻！', color: p.recoverHeavy ? '#ff4d6d' : '#ffd166' };
  }
  return null;
}

function buildBuffHtml(p) {
  const list = [];
  const eff = p.effects || {};
  // 護盾以獨立欄位呈現 (非 effect map 內)
  if (p.shield > 0) {
    list.push({ buff: true, icon: '🛡', name: '護盾', extra: Math.ceil(p.shield), time: p.shieldTime || 0 });
  }
  for (const key of Object.keys(eff)) {
    const data = eff[key];
    if (!data) continue;
    const meta = EFFECT_META[key];
    if (!meta) continue;
    const remaining = data.remaining;
    if (remaining != null && remaining <= 0) continue;
    let extra = null;
    if (key === 'chill' && data.stacks) extra = `x${data.stacks}`;
    else if ((key === 'burn' || key === 'bleed') && data.dmg) extra = `${Math.round(data.dmg)}/s`;
    list.push({ buff: meta.buff, icon: meta.icon, name: meta.name, extra, time: remaining });
  }
  if (!list.length) return '';
  list.sort((a, b) => (b.buff ? 1 : 0) - (a.buff ? 1 : 0));
  return list.map((b) => {
    const cls = b.buff ? 'buff' : 'debuff';
    const t = b.time != null && isFinite(b.time) ? `<i>${b.time.toFixed(1)}s</i>` : '';
    const ex = b.extra != null ? `<u>${esc(b.extra)}</u>` : '';
    return `<span class="bchip ${cls}"><em>${b.icon}</em><b>${esc(b.name)}</b>${ex}${t}</span>`;
  }).join('');
}
