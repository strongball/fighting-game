// 巨木傀儡的場地：森林神殿遺跡 — 苔蘚地貌、神殿光束、發光符文法陣、廢棄神殿地標（實體碰撞）。
//
// 這是「rich arena」的參考範例。新 boss 場地照抄本檔結構即可（見 render3d/decorations/README.md）。

import type { ArenaDef } from '../../render3d/arena.types.ts';

export const arena: ArenaDef = {
  theme: {
    sky: 0x243826, fog: 0x18271b, fogNear: 820, fogFar: 3000,
    floorStyle: 'mossy', outerGround: 0x6f7a54,
    wallStyle: 'natural', wallTrimGlow: 0,
    wallStone: 0x3c4a32, wallTrim: 0x3c4a32,
    hemiSky: 0x9fce5a, hemiGround: 0x243016, hemiInt: 0.6,
    sunColor: 0xfff0b0, sunInt: 2.2, rimColor: 0x6fae3e, rimInt: 0.45,
    decorations: ['godrays', 'temple', 'ruins', 'tree', 'roots', 'foliage', 'groundcover', 'rock', 'crystal'],
    godrays: { count: 7, color: 0xe8ffc8, opacity: 0.32 },
    temple: { color: 0x5e6450, moss: 0x4e6f30, glow: 0x6fd23a, x: 760, z: -420, scale: 1.7 },
    ruins: { count: 6, color: 0x636757, moss: 0x4e6f30, vine: 0x3e5e26, scale: 1.3 },
    tree: { count: 26, big: true, trunk: 0x3a2718, leaf: 0x274a1a, leafTop: 0x77b343 },
    roots: { count: 14, color: 0x2f2114 },
    foliage: { count: 32, low: 0x2c4a1a, high: 0x5f8a30 },
    groundcover: { splotches: 30, tufts: 18, rInner: 340, rOuter: 840, low: 0x2c4a1a, high: 0x5f8a30 },
    rock: { count: 16, color: 0x6a6560 },
    crystal: { count: 8, color: 0x9be86a, glow: 0x6fd23a, glowInt: 0.9 },
    atmosphere: { kind: 'leaves', color: '#a6c84a', rate: 16 },
    floorDecal: { kind: 'grove', color: '#9ff06a', glowColor: 0x7ad84a, opacity: 0.58, glow: 1.6, pulse: 0.55, size: 0.62 },
  },
  // 神殿基座實體碰撞：單一有向方框，精準貼合長方形基座 (無死角，連 boss 也擋)。
  // world = scene + (1200, 800)；對齊 theme.temple x=760,z=-420 → 世界中心 1960,380。
  // 基座底階 380×240 ×scale1.7 = 646×408 → 半寬/半高 323/204 (留 ~3 邊距)；
  // rot = -atan2(-760,420) = 1.0663 (對齊神殿朝向場中心)。
  colliders: [
    { x: 1960, y: 380, hw: 326, hh: 207, rot: 1.0663 },
  ],
};
