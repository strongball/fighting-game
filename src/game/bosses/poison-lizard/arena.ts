// 劇毒飛蜥的場地：陰天毒沼祭壇 — 石砌同心祭壇、中央嵌地毒池環、立桿火把、蛇紋石王座、垂苔紅樹環繞死水。
//
// 參考美術圖重做，刻意與 R1 golem 的「明亮神殿森林」徹底區隔：
//   光線：R1 暖陽 + 神殿光束 → R2 陰天暴風灰空、無光束，靠橙色火把與毒池發光點亮（暖冷對比）。
//   地板：R1 苔泥地 + 發光符文圈 → R2 石砌祭壇 + 同心環刻 + 嵌地毒池。
//   配色：R1 飽和暖綠陽光 → R2 去飽和灰綠陰鬱 + 局部劇毒螢綠 + 火把暖橙。
// boss 專屬道具（buildPoisonPools / buildSerpentThrone / buildTorches）在 ./props.js。

import type { ArenaDef } from '../../render3d/arena.types.ts';
import { buildDais, buildPoisonPools, buildSerpentThrone, buildTorches } from './props.js';

export const arena: ArenaDef = {
  theme: {
    sky: 0x444b48, fog: 0x3a423d, fogNear: 520, fogFar: 2100,
    // 地板主體＝放射狀石砌祭壇（dais 道具）；底層 flagstone 壓暗當祭壇外圍的濕暗地。
    floorStyle: 'flagstone', floorTint: 0x595f54, outerGround: 0x232a22,
    wallStyle: 'natural', wallTrimGlow: 0,
    wallStone: 0x3e463a, wallTrim: 0x3e463a,
    hemiSky: 0xaab4b0, hemiGround: 0x14180f, hemiInt: 0.55,
    sunColor: 0xd6dcd2, sunInt: 1.7, rimColor: 0x7e8a96, rimInt: 0.25,
    decorations: ['dais', 'roots', 'tree', 'foliage', 'groundcover', 'ruins', 'throne', 'torches', 'pools'],
    props: { dais: buildDais, throne: buildSerpentThrone, torches: buildTorches, pools: buildPoisonPools },
    dais: { rx: 1080, rz: 760, grout: '#1f2820' },
    tree: { count: 12, big: true, trunk: 0x231a11, leaf: 0x2a3d1c, leafTop: 0x55802c },
    roots: { count: 22, color: 0x241b10 },
    foliage: { count: 24, low: 0x213213, high: 0x4e7526 },
    groundcover: { splotches: 28, tufts: 16, rInner: 280, rOuter: 900, low: 0x243f15, high: 0x5fa02c },
    ruins: { count: 6, color: 0x5a6052, moss: 0x44682a, vine: 0x365520, scale: 1.25 },
    throne: { color: 0x5c6253, moss: 0x44682a, glow: 0x7fff4a, snake: 0x4e7e2c, vine: 0x365520, x: 0, z: -580, scale: 1.5 },
    torches: { count: 7, rx: 770, rz: 620, flame: 0xffa64d, flameGlow: 0xff6a1f, pole: 0x2c2117, base: 0x555b4e },
    pools: { count: 6, radius: 410, color: 0x86ff3a, rim: 0x5a6052, glow: 1.9 },
    atmosphere: { kind: 'spores', color: '#9ad13a', rate: 14 },
    // 無中央地刻：放射狀同心拼接由 dais 道具本身呈現（不再用 floorDecal 疊環）。
  },
  // 蛇紋石王座基座實體碰撞：有向方框，貼合長方形基座（無死角，連 boss 也擋）。
  // world = scene + (1200, 800)；對齊 throne x=0,z=-580 → 世界中心 (1200, 220)。
  // 基座底階 300×180 ×scale1.5 = 450×270 → 半寬/半高 225/135（+3 邊距）。rot = 0（rotation.y = 0）。
  colliders: [
    { x: 1200, y: 220, hw: 228, hh: 138, rot: 0 },
  ],
};
