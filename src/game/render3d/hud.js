// 引擎內 HUD：CSS2DRenderer 畫頭頂名牌(名稱+血/魔條)；螢幕角落用 DOM 面板(自身狀態/技能冷卻/計分板)。
// 數值邏輯沿用舊版 drawHUD/drawBars。

import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getCharacter } from '../characters.js';
import { ULT_MAX } from '../constants.js';
import { sceneX, sceneZ } from './coords.js';

const HEAD_Y = 90;

function getSkillKeys(controlScheme) {
  if (controlScheme === 'arrows-asdf') {
    return { basic: 'A', skill1: 'S', skill2: 'D', ultimate: 'F' };
  }
  return { basic: 'J', skill1: 'K', skill2: 'L', ultimate: ';' };
}

export function createHud({ stage, scene, camera, controlScheme = 'wasd-jkl' }) {
  const css2d = new CSS2DRenderer();
  css2d.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:8;';
  stage.appendChild(css2d.domElement);

  // ---- 螢幕面板 ----
  const layer = document.createElement('div');
  layer.className = 'hud-layer';
  stage.appendChild(layer);

  // 自身狀態 (左下)
  const self = el('div', 'hud-self', layer);
  const selfName = el('div', 'hud-self-name', self);
  const selfTalent = el('div', 'hud-self-talent', self);
  const hpWrap = el('div', 'hud-bar hp', self);
  const hpFill = el('i', '', hpWrap);
  const hpTxt = el('span', '', hpWrap);
  const mpWrap = el('div', 'hud-bar mp', self);
  const mpFill = el('i', '', mpWrap);
  const mpTxt = el('span', '', mpWrap);
  const ultWrap = el('div', 'hud-bar ult', self);
  const ultFill = el('i', '', ultWrap);
  const ultTxt = el('span', '', ultWrap);
  const skillsContainer = el('div', 'hud-skills-container', self);
  const skills = el('div', 'hud-skills', skillsContainer);
  const evadeWrap = el('div', 'hud-evade-wrap', skillsContainer);
  const keys = getSkillKeys(controlScheme);
  const chip = {
    basic: skillChip(keys.basic, skills),
    skill1: skillChip(keys.skill1, skills),
    skill2: skillChip(keys.skill2, skills),
    ultimate: skillChip(keys.ultimate, skills),
    evade: skillChip('Space', evadeWrap, 'evade-circle'),
  };

  // 蓄力條 (蓄力技能用，平時隱藏)
  const chargeWrap = el('div', 'hud-bar charge', self);
  const chargeFill = el('i', '', chargeWrap);
  const chargeTxt  = el('span', '', chargeWrap);
  chargeWrap.style.display = 'none';

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
      const name = el('div', 'nname', root);
      const hpw = el('div', 'nbar', root); const hp = el('i', '', hpw);
      const mpw = el('div', 'nbar mana', root); const mp = el('i', '', mpw);
      const obj = new CSS2DObject(root);
      scene.add(obj);
      pl = { obj, name, hp, mp, root };
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
      pl.obj.visible = true;
    }
    for (const [pid, pl] of plates) if (!seen.has(pid)) pl.obj.visible = false;
    for (const pid of hpTrack.keys()) if (!state.players[pid]) hpTrack.delete(pid); // 清理離場實體

    // 自身面板
    const me = state.players[selfId];
    if (me) {
      setStyle(self, 'display', '');
      const c = getCharacter(me.charId);
      setText(selfName, `${me.name}　(${c.name})${me.alive ? '' : '　— 淘汰'}`);
      setStyle(selfName, 'color', me.alive ? '#fff' : '#ff7675');
      setText(selfTalent, c.talent ? `天賦 ${c.talent.name}` : '');
      setStyle(hpFill, 'width', pct(me.hp / me.maxHp));
      setText(hpTxt, `${Math.ceil(me.hp)}/${me.maxHp}`);
      setStyle(mpFill, 'width', pct(me.mana / me.maxMana));
      setText(mpTxt, `${Math.ceil(me.mana)}/${me.maxMana}`);
      const ultR = Math.min(1, (me.ult || 0) / ULT_MAX);
      const ultReady = ultR >= 1 && me.cd.ultimate <= 0;
      setStyle(ultFill, 'width', pct(ultR));
      ultWrap.classList.toggle('ready', ultReady);
      setText(ultTxt, ultReady ? '終極 就緒！' : `終極 ${Math.floor(ultR * 100)}%`);
      setChip(chip.basic,  c.basic,  me.cd.basic,   me.mana);
      setChip(chip.skill1, c.skill1, me.cd.skill1,  me.mana);
      setChip(chip.skill2, c.skill2, me.cd.skill2,  me.mana);
      setUltChip(chip.ultimate, c.ultimate, me.ult || 0, me.cd.ultimate);
      setChip(chip.evade, c.evade, me.cd.evade, me.mana);

      // 蓄力條
      const cs = me.chargeState;
      const chargeAction = cs && c[cs.slot];
      if (cs && chargeAction && chargeAction.chargeMax) {
        setStyle(chargeWrap, 'display', '');
        const r = Math.min(1, cs.time / chargeAction.chargeMax);
        setStyle(chargeFill, 'width', pct(r));
        const isFull = r >= 0.99;
        chargeWrap.classList.toggle('full', isFull);
        setText(chargeTxt, isFull ? '🔥 蓄力全滿！' : `蓄力中 ${Math.floor(r * 100)}%`);
      } else {
        setStyle(chargeWrap, 'display', 'none');
        chargeWrap.classList.remove('full');
      }
    } else {
      setStyle(self, 'display', 'none');
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
      if (state.banner && (state.banner.life == null || state.banner.life > 0)) {
        setStyle(banner, 'display', '');
        setText(bannerText, state.banner.text || '');
        setText(bannerSub, state.banner.sub || '');
        // 開場橫幅戰術提示 (由當前魔王資料的 hint 驅動；intro 階段魔王存在)
        const bh = boss ? (getCharacter(boss.charId).hint || '') : '';
        setText(bannerHint, bh);
        setStyle(bannerHint, 'display', bh ? '' : 'none');
      } else setStyle(banner, 'display', 'none');
    } else {
      setStyle(bossPanel, 'display', 'none');
      setStyle(banner, 'display', 'none');
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
  }

  return { update, render, resize, clear };
}

function skillChip(key, parent, extraClass = '') {
  const root    = el('div', 'chip' + (extraClass ? ' ' + extraClass : ''), parent);
  const cool    = el('i', 'cool', root);         // 冷卻遮罩 (從頂部向下)
  const label   = el('span', 'chip-label', root); // 按鍵 + 技能名
  const cdBar   = el('b', 'cd-bar', root);        // 底部進度條
  const cdSub   = el('s', 'cd-sub', root);        // 冷卻秒數 / 能量 %
  const manaHint = el('u', 'mana-hint', root);    // 魔力不足提示
  cdSub.style.display = 'none';
  manaHint.style.display = 'none';
  return { root, label, cool, cdBar, cdSub, manaHint, key };
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
