import { registerBossAction, registerBossActionPrepare } from '../actions.ts';
import { prepareTimeAnchorRitual, resolveTimeAnchorRitual } from '../time-anchors.ts';

registerBossActionPrepare('time_anchor_ritual', (state, boss, action) => {
  prepareTimeAnchorRitual(state, boss, action);
});

registerBossAction('time_anchor_ritual', (state, boss) => {
  resolveTimeAnchorRitual(state, boss);
});
