export const aiProfile = {
  range: 240,
  slots: ['ultimate', 'skill1', 'skill2', 'basic'],
  pickTarget: 'nearestTarget',
  combos: {
    basic: [{ slot: 'skill1', windup: 0.45, delay: 0.3 }],
    ultimate: [{ slot: 'skill2', windup: 0.3, delay: 1.0 }, { slot: 'skill1', windup: 0.3, delay: 1.2 }],
  },
} as const;
