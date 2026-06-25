export const aiProfile = {
  range: 90,
  slots: ['ultimate', 'skill2', 'skill1', 'basic'],
  pickTarget: 'nearestTarget',
  noLoiter: true,
  combos: {
    ultimate: [
      { slot: 'skill1', windup: 0.2, delay: 0.8 },
      { slot: 'basic', windup: 0.2, delay: 0.6 },
    ],
  },
} as const;
