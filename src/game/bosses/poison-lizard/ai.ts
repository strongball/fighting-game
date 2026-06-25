export const aiProfile = {
  range: 120,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'nearestTarget',
  kite: 80,
  combos: {
    ultimate: [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'skill1', windup: 0.3, delay: 1.0 }],
  },
} as const;
