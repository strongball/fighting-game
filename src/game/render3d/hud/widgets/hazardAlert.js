// HUD widget：站進敵方地面危險區（毒沼/火海等）→ 全螢幕邊框警示。
// 文字與顏色依當前魔王的危險屬性（hazardText / hazardColor）動態調整。
//
// 這是 HUD widget registry 的示範：自成一格的指示器，從 hud.js 的 update() 抽出，
// 新增同類警示只要再加一個 widget 檔、不必動 hud.js 核心。
import { registerHudWidget } from '../widgets.js';
import { el, setText, setStyle, hexA, lighten } from '../dom.js';
import { getCharacter } from '../../../characters.js';

registerHudWidget({
  id: 'hazard-alert',
  mount({ layer }) {
    const warn = el('div', 'hud-hazard', layer);
    const text = el('div', 'hud-hazard-text', warn);
    warn.style.display = 'none';
    return { warn, text };
  },
  update({ warn, text }, { state, selfId }) {
    // 僅闖關模式；判斷自身是否站在「敵方造成、已生效」的地面區域內。
    let inHazard = false;
    if (state.mode === 'boss') {
      const me = state.players[selfId];
      if (me && me.alive && state.zones) {
        for (const z of state.zones) {
          if (z.delay && z.delay > 0) continue;             // 預警中、尚未生效
          const owner = state.players[z.owner];
          if (!owner || owner.team === me.team) continue;   // 只警示敵方造成的區域
          if (Math.hypot(z.x - me.x, z.y - me.y) <= (z.radius || 0)) { inHazard = true; break; }
        }
      }
    }
    setStyle(warn, 'display', inHazard ? '' : 'none');
    if (inHazard) {
      let ht = '⚠️ 站在危險地面上 — 快離開！', hc = '#9ad13a';
      for (const pp of Object.values(state.players)) {
        if (pp.isBoss) { const bcz = getCharacter(pp.charId); if (bcz.hazardText) ht = bcz.hazardText; if (bcz.hazardColor) hc = bcz.hazardColor; break; }
      }
      setText(text, ht);
      // 淡色 + 深色描邊 + 同色外光暈（無底牌，紅/綠/藍任何畫面都讀得清）
      setStyle(text, 'color', lighten(hc, 0.55));
      setStyle(text, 'textShadow', `0 1px 3px #000, 0 2px 7px #000, 0 0 16px ${hexA(hc, 0.85)}`);
      setStyle(warn, 'boxShadow', `inset 0 0 120px 34px ${hexA(hc, 0.5)}`);
    }
  },
});
