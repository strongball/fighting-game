import { getCharacter } from '../../../characters.js';
import { registerSelfAlert } from '../selfAlerts.js';

function isLavaBurning(state, me) {
  const burn = me && me.effects && me.effects.burn;
  if (!burn || burn.remaining <= 0) return false;
  if (state.mode !== 'boss') return false;
  const boss = Object.values(state.players || {}).find((p) => p && p.isBoss && getCharacter(p.charId)?.lavaBurn);
  return !!boss && (burn.srcId == null || burn.srcId === boss.id);
}

registerSelfAlert({
  id: 'hunted-lowest-hp',
  priority: 400,
  getText({ selfId, huntedId }) {
    return huntedId && huntedId === selfId ? '🐺 你被盯上了！快拉開距離' : '';
  },
});

registerSelfAlert({
  id: 'soul-tethered',
  priority: 300,
  getText({ state, selfId }) {
    return state.tethers && state.tethers.some((t) => t.a === selfId || t.b === selfId)
      ? '🔗 你被靈魂綁定 — 與隊友拉開距離'
      : '';
  },
});

registerSelfAlert({
  id: 'lava-burning',
  priority: 200,
  getText({ state, self }) {
    return isLavaBurning(state, self) ? '🔥 熔岩灼燒中 — 先拉開恢復空間' : '';
  },
});

registerSelfAlert({
  id: 'blind',
  priority: 100,
  getText({ self }) {
    return self && self.effects && self.effects.blind ? '🌚 你被致盲了！畫面一片漆黑' : '';
  },
});
