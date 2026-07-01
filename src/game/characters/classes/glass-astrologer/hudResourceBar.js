import { pct, setStyle, setText } from '../../../render3d/hud/dom.js';
import { registerHudResourceBar } from '../../../render3d/hud/resourceBars.js';

registerHudResourceBar({
  id: 'glass-mirrors',
  slotId: 'fury',
  order: 30,
  matches({ character }) {
    return !!(character && character.id === 'glass-astrologer');
  },
  update({ state, player, character }, slot) {
    const max = character.talent?.maxMirrors || 2;
    const count = (state.zones || []).filter((z) => z.kind === 'glass_mirror' && z.owner === player.id && z.lifetime > 0).length;
    setStyle(slot.fill, 'width', pct(Math.min(1, count / max)));
    slot.wrap.classList.toggle('boiling', count >= max);
    setText(slot.text, `星鏡 ${count}/${max}`);
  },
});
