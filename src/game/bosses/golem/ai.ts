export const aiProfile = {
  range: 100,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'aggroSwap',
  combos: {
    basic: [{ slot: 'skill1', windup: 0.4, delay: 0.2 }],
    ultimate: [{ slot: 'ultimate', windup: 0.2, delay: 1.2 }, { slot: 'ultimate', windup: 0.2, delay: 1.2 }],
  },
} as const;
