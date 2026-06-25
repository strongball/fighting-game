export const aiProfile = {
  range: 160,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'nearestTarget',
  slow: true,
  combos: {
    ultimate: [{ slot: 'skill1', windup: 0.4, delay: 1.2 }, { slot: 'skill2', windup: 0.4, delay: 1.2 }, { slot: 'ultimate', windup: 0.4, delay: 1.0 }],
  },
} as const;
