import { FURY_MAX } from '../../../constants.js';
import { pct, setStyle, setText } from '../dom.js';
import { registerHudResourceBar } from '../resourceBars.js';

registerHudResourceBar({
  id: 'fury',
  order: 10,
  matches({ character }) {
    return !!(character && character.talent && character.talent.id === 'bulwark');
  },
  update({ player, character }, slot) {
    const fury = player.fury || 0;
    setStyle(slot.fill, 'width', pct(Math.min(1, fury / FURY_MAX)));
    slot.wrap.classList.toggle('boiling', fury >= (character.talent.threshold ?? 55));
    setText(slot.text, `怒氣 ${Math.floor(fury)}`);
  },
});

registerHudResourceBar({
  id: 'sword-energy',
  order: 20,
  matches({ character }) {
    return !!(character && character.talent && character.talent.id === 'arcane_contract');
  },
  update({ player, character }, slot) {
    const max = character.talent.maxSwordEnergy || 5;
    const count = (player.magicSwordsman && player.magicSwordsman.swordEnergy) || 0;
    setStyle(slot.fill, 'width', pct(count / max));
    setText(slot.text, `劍氣 ${count}/${max}`);
  },
});
