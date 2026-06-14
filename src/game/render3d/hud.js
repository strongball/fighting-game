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
  const skills = el('div', 'hud-skills', self);
  const keys = getSkillKeys(controlScheme);
  const chip = {
    basic: skillChip(keys.basic, skills), skill1: skillChip(keys.skill1, skills), skill2: skillChip(keys.skill2, skills), ultimate: skillChip(keys.ultimate, skills),
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
  bossPanel.style.display = 'none';

  // 過場橫幅 (中央)
  const banner = el('div', 'hud-banner', layer);
  const bannerText = el('div', 'hud-banner-text', banner);
  const bannerSub = el('div', 'hud-banner-sub', banner);
  banner.style.display = 'none';

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
        pl.name.textContent = `${p.name}　倒地 ${prog}%`;
        pl.name.style.color = '#ff9a3c';
      } else {
        pl.name.textContent = p.name;
        // 名牌依敵我上色；solo 模式(selfTeam=0) 敵人不標紅、維持中性白
        pl.name.style.color = r === 'self' ? '#ffd54a' : r === 'ally' ? '#6ee7a8' : (selfTeam > 0 ? '#ff8a80' : '#ffffff');
      }
      pl.hp.style.width = pct(p.hp / p.maxHp);
      pl.mp.style.width = pct(p.mana / p.maxMana);
      pl.root.style.display = '';
    }
    for (const [pid, pl] of plates) if (!seen.has(pid)) pl.root.style.display = 'none';
    for (const pid of hpTrack.keys()) if (!state.players[pid]) hpTrack.delete(pid); // 清理離場實體

    // 自身面板
    const me = state.players[selfId];
    if (me) {
      self.style.display = '';
      const c = getCharacter(me.charId);
      selfName.textContent = `${me.name}　(${c.name})${me.alive ? '' : '　— 淘汰'}`;
      selfName.style.color = me.alive ? '#fff' : '#ff7675';
      selfTalent.textContent = c.talent ? `天賦 ${c.talent.name}` : '';
      hpFill.style.width = pct(me.hp / me.maxHp);
      hpTxt.textContent = `${Math.ceil(me.hp)}/${me.maxHp}`;
      mpFill.style.width = pct(me.mana / me.maxMana);
      mpTxt.textContent = `${Math.ceil(me.mana)}/${me.maxMana}`;
      const ultR = Math.min(1, (me.ult || 0) / ULT_MAX);
      const ultReady = ultR >= 1 && me.cd.ultimate <= 0;
      ultFill.style.width = pct(ultR);
      ultWrap.classList.toggle('ready', ultReady);
      ultTxt.textContent = ultReady ? '終極 就緒！' : `終極 ${Math.floor(ultR * 100)}%`;
      setChip(chip.basic, c.basic, me.cd.basic);
      setChip(chip.skill1, c.skill1, me.cd.skill1);
      setChip(chip.skill2, c.skill2, me.cd.skill2);
      setUltChip(chip.ultimate, c.ultimate, me.ult || 0, me.cd.ultimate);

      // 蓄力條
      const cs = me.chargeState;
      const chargeAction = cs && c[cs.slot];
      if (cs && chargeAction && chargeAction.chargeMax) {
        chargeWrap.style.display = '';
        const r = Math.min(1, cs.time / chargeAction.chargeMax);
        chargeFill.style.width = pct(r);
        const isFull = r >= 0.99;
        chargeWrap.classList.toggle('full', isFull);
        chargeTxt.textContent = isFull ? '🔥 蓄力全滿！' : `蓄力中 ${Math.floor(r * 100)}%`;
      } else {
        chargeWrap.style.display = 'none';
        chargeWrap.classList.remove('full');
      }
    } else {
      self.style.display = 'none';
    }

    // 計分板
    const isBoss = state.mode === 'boss';
    const listPlayers = isBoss ? players.filter((p) => p.team === 1) : players;
    const sorted = listPlayers.slice().sort((a, b) => b.kills - a.kills);
    const aliveN = listPlayers.filter((p) => p.alive).length;
    boardTitle.textContent = isBoss ? `闖關隊伍 ${aliveN}/${listPlayers.length} 存活` : `存活 ${aliveN} 人`;
    let html = '';
    for (const p of sorted) {
      const cls = p.id === selfId ? 'me' : p.alive ? '' : 'dead';
      let tag = p.alive ? '' : ' ✕';
      if (isBoss && !p.alive) { const rp = Math.floor(Math.min(1, (p.reviveProg || 0) / 3) * 100); tag = ` 倒地 ${rp}%`; }
      html += `<div class="row ${cls}">${esc(getCharacter(p.charId).name)} ${esc(p.name)}${isBoss ? '' : '　K:' + p.kills}${tag}</div>`;
    }
    boardList.innerHTML = html;

    // ---- 闖關模式：魔王血條 / 部位 / 過場橫幅 ----
    if (isBoss) {
      let boss = null;
      for (const p of players) if (p.isBoss) { boss = p; break; }
      if (boss && boss.alive && state.roundPhase !== 'cleared') {
        bossPanel.style.display = '';
        const bc = getCharacter(boss.charId);
        bossName.textContent = `ROUND ${state.round}　${bc.subtitle ? bc.subtitle + '「' + bc.name + '」' : bc.name}`;
        const hp = state.bossHp != null ? state.bossHp : boss.hp;
        const mhp = state.bossMaxHp || boss.maxHp;
        bossFill.style.width = pct(hp / mhp);
        bossTxt.textContent = `${Math.ceil(hp)} / ${mhp}`;
        const parts = players.filter((p) => p.isPart && p.ownerId === boss.id);
        if (parts.length) {
          let ph = '';
          for (const pp of parts) {
            const dead = !pp.alive;
            const w = dead ? 0 : Math.max(0, Math.min(100, (pp.hp / pp.maxHp) * 100));
            ph += `<div class="bpart ${dead ? 'dead' : ''}"><span>${esc(partLabel(bc, pp.partId))}${dead ? ' 已破壞' : ''}</span><b><i style="width:${w}%"></i></b></div>`;
          }
          bossParts.innerHTML = ph;
        } else bossParts.innerHTML = '';
      } else {
        bossPanel.style.display = 'none';
      }
      if (state.banner && (state.banner.life == null || state.banner.life > 0)) {
        banner.style.display = '';
        bannerText.textContent = state.banner.text || '';
        bannerSub.textContent = state.banner.sub || '';
      } else banner.style.display = 'none';
    } else {
      bossPanel.style.display = 'none';
      banner.style.display = 'none';
    }
  }

  function partLabel(bc, partId) {
    const parts = bc.model && bc.model.parts;
    if (parts) { const f = parts.find((x) => x.id === partId); if (f) return f.label; }
    return partId;
  }

  function setChip(c, action, cd) {
    c.label.textContent = `${c.key} ${action.name}`;
    const ready = cd <= 0;
    c.root.classList.toggle('ready', ready);
    c.cool.style.height = ready ? '0%' : '100%';
  }

  // 大招 chip：以能量充能度顯示填充；滿且無連發冷卻 = 就緒發光
  function setUltChip(c, action, ult, cd) {
    if (!action) { c.root.style.display = 'none'; return; }
    c.root.style.display = '';
    c.label.textContent = `${c.key} ${action.name}`;
    const r = Math.min(1, (ult || 0) / ULT_MAX);
    const ready = r >= 1 && cd <= 0;
    c.root.classList.toggle('ready', ready);
    c.root.classList.toggle('ult', true);
    c.cool.style.height = `${(1 - r) * 100}%`;
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

function skillChip(key, parent) {
  const root = el('div', 'chip', parent);
  const cool = el('i', 'cool', root);
  const label = el('span', '', root);
  return { root, label, cool, key };
}

function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}
function pct(r) { return `${Math.max(0, Math.min(1, r)) * 100}%`; }
function esc(s) { return String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }
