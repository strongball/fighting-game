export const aiProfile = {
  range: 110,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'nearestTarget',
  combos: {
    basic: [{ slot: 'skill2', windup: 0.4, delay: 0.4 }],
    ultimate: [{ slot: 'skill1', windup: 0.3, delay: 1.5 }, { slot: 'skill2', windup: 0.3, delay: 1.5 }, { slot: 'skill1', windup: 0.3, delay: 1.5 }],
  },
} as const;
