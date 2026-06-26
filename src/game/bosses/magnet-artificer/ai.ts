export const aiProfile = {
  range: 190,
  slots: ['ultimate', 'skill2', 'skill1', 'basic'],
  pickTarget: 'nearestTarget',
  kite: 95,
  combos: {
    skill2: [
      { slot: 'skill1', windup: 0.3, delay: 0.7 },
    ],
    ultimate: [
      { slot: 'skill1', windup: 0.32, delay: 0.85 },
    ],
  },
} as const;
