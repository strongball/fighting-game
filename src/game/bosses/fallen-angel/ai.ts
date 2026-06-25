export const aiProfile = {
  range: 160,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'nearestTarget',
  combos: {
    ultimate: [{ slot: 'skill1', windup: 0.3, delay: 1.0 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }, { slot: 'ultimate', windup: 0.3, delay: 1.0 }],
  },
} as const;
