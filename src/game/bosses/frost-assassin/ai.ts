export const aiProfile = {
  range: 90,
  slots: ['ultimate', 'skill2', 'skill1', 'basic'],
  pickTarget: 'nearestTarget',
  combos: {
    ultimate: [{ slot: 'skill1', windup: 0.2, delay: 0.8 }, { slot: 'skill1', windup: 0.2, delay: 0.8 }, { slot: 'skill2', windup: 0.3, delay: 1.2 }],
  },
} as const;
