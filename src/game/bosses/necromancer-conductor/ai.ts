export const aiProfile = {
  range: 460,
  slots: ['skill1', 'skill2', 'ultimate', 'basic'],
  pickTarget: 'nearestTarget',
  kite: 360,
  combos: {
    ultimate: [{ slot: 'skill1', windup: 0.4, delay: 1.2 }, { slot: 'skill2', windup: 0.4, delay: 1.4 }],
  },
} as const;
