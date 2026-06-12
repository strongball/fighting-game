// DOM UI：選單 / 大廳 / 角色選擇 / 結算畫面

import { CHARACTERS, getCharacter } from './characters.js';

const $ = (id) => document.getElementById(id);

export function createUI() {
  const screens = {
    menu: $('screen-menu'),
    lobby: $('screen-lobby'),
    game: $('screen-game'),
    gameover: $('screen-gameover'),
  };

  let selectedChar = 0;
  let onSelectChar = () => {};

  function showScreen(name) {
    for (const k in screens) screens[k].classList.toggle('active', k === name);
  }

  function buildCharacterGrid() {
    const grid = $('char-grid');
    grid.innerHTML = '';
    for (const c of CHARACTERS) {
      const card = document.createElement('button');
      card.className = 'char-card';
      card.dataset.id = c.id;
      card.innerHTML = `
        <div class="char-art" style="--char-color:${c.color}">
          ${c.sprite ? `<img src="${c.sprite}" alt="" loading="lazy" />` : `<span>${shapeIcon(c.shape)}</span>`}
        </div>
        <div class="char-name">${c.name}</div>
        <div class="char-stat">HP ${c.maxHp} · MP ${c.maxMana}</div>
        <div class="char-desc">${c.desc}</div>
        <div class="char-skills">
          <span>J ${c.basic.name}</span><span>K ${c.skill1.name}</span><span>L ${c.skill2.name}</span>
        </div>`;
      card.addEventListener('click', () => {
        selectedChar = c.id;
        highlightChar();
        onSelectChar(c.id);
      });
      grid.appendChild(card);
    }
    highlightChar();
  }

  function highlightChar() {
    document.querySelectorAll('.char-card').forEach((el) => {
      el.classList.toggle('selected', Number(el.dataset.id) === selectedChar);
    });
  }

  function setSelectedChar(id) { selectedChar = id; highlightChar(); }

  function renderLobby({ players, selfId, isHost, roomCode }) {
    $('room-code').textContent = roomCode || '連線中…';
    const list = $('player-list');
    list.innerHTML = '';
    for (const p of players) {
      const c = getCharacter(p.charId);
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `
        <span class="dot" style="background:${c.color}"></span>
        <span class="pname">${p.name}${p.id === selfId ? '（你）' : ''}${p.isHost ? ' 👑' : ''}</span>
        <span class="pchar">${c.name}</span>`;
      list.appendChild(row);
    }
    $('lobby-count').textContent = `${players.length} 人在房間`;
    $('btn-start').style.display = isHost ? 'inline-block' : 'none';
    $('lobby-wait').style.display = isHost ? 'none' : 'block';
  }

  function showGameover({ winnerName, players, isHost }) {
    showScreen('gameover');
    $('winner-text').textContent = winnerName ? `🏆 ${winnerName} 獲勝！` : '平手 — 無人存活';
    const box = $('final-scores');
    box.innerHTML = '';
    const sorted = [...players].sort((a, b) => b.kills - a.kills);
    for (const p of sorted) {
      const c = getCharacter(p.charId);
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `<span class="dot" style="background:${c.color}"></span>
        <span class="pname">${p.name}</span>
        <span class="pchar">${c.name}</span>
        <span class="pkills">擊殺 ${p.kills}</span>`;
      box.appendChild(row);
    }
    $('btn-tolobby').style.display = isHost ? 'inline-block' : 'none';
    $('gameover-wait').style.display = isHost ? 'none' : 'block';
  }

  function setMenuStatus(msg, isError) {
    const el = $('menu-status');
    el.textContent = msg || '';
    el.classList.toggle('error', !!isError);
  }
  function setLobbyStatus(msg) { $('lobby-status').textContent = msg || ''; }

  function bind(cb) {
    $('btn-create').addEventListener('click', () => cb.onCreate(getName()));
    $('btn-join').addEventListener('click', () => cb.onJoin(getName(), $('room-input').value.trim()));
    $('btn-start').addEventListener('click', () => cb.onStart());
    $('btn-tolobby').addEventListener('click', () => cb.onToLobby());
    $('btn-leave-lobby').addEventListener('click', () => cb.onLeave());
    $('btn-leave-over').addEventListener('click', () => cb.onLeave());
    $('btn-copy').addEventListener('click', () => {
      const code = $('room-code').textContent;
      navigator.clipboard?.writeText(code);
      $('btn-copy').textContent = '已複製';
      setTimeout(() => ($('btn-copy').textContent = '複製'), 1200);
    });
    onSelectChar = cb.onSelectChar || (() => {});
  }

  function getName() {
    const v = $('name-input').value.trim();
    return v || '玩家' + Math.floor(Math.random() * 1000);
  }

  return {
    showScreen, buildCharacterGrid, setSelectedChar,
    renderLobby, showGameover, setMenuStatus, setLobbyStatus, bind,
    get selectedChar() { return selectedChar; },
  };
}

function shapeIcon(shape) {
  if (shape === 'square') return '■';
  if (shape === 'triangle') return '▲';
  return '●';
}
