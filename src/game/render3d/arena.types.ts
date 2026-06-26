// 場地（競技場）主題型別：每隻 boss 在自己的 arena.ts 用它定義場地。
//
// 由 render3d 消費（皆 JS）：scene.js 讀顏色/燈光/地板/牆；decorations 讀 decorations/各道具設定/floorDecal；
// atmosphere 讀 atmosphere。型別僅供 boss 端撰寫時 autocomplete + 擋拼錯。
//
// 座標：道具設定中的 x/z 是「場景座標」(原點=場中心)；colliders 是「世界座標」(world = scene + 1200/800)。

/** 靜態障礙（世界座標）：擋住實體移動，例：神殿基座。需與對應視覺道具位置對齊。
 *  圓形 → 給 r；長方形地標 → 給 hw/hh/rot (有向方框，無死角，建議用這個)。 */
export interface ArenaCollider {
  x: number;
  y: number;
  /** 圓形半徑。 */
  r?: number;
  /** 有向方框半寬 (沿 rot 方向)。 */
  hw?: number;
  /** 有向方框半高 (垂直 rot 方向)。 */
  hh?: number;
  /** 方框旋轉 (弧度)。對齊視覺道具的朝向。 */
  rot?: number;
}

/** 中央地刻（法陣/裂縫/符文…）。kind 內建見 decorations/floor.js 的 makeFloorPattern。 */
export interface FloorDecal {
  kind: 'arcane' | 'cracks' | 'hex' | 'rings' | 'flame' | 'snowflake' | 'grove' | (string & {});
  color?: string;
  glowColor?: number;
  /** 自體發光強度（吃 bloom）；省略 = 不發光。 */
  glow?: number;
  /** 呼吸幅度 0..1。 */
  pulse?: number;
  opacity?: number;
  /** 相對 max(arena) 的比例，預設 0.55。 */
  size?: number;
  scale?: number;
}

/** 飄落大氣粒子。kind 內建見 render3d/atmosphere.js。 */
export interface Atmosphere {
  kind: 'snow' | 'embers' | 'leaves' | 'stardust' | 'spores' | 'petals' | 'ash' | (string & {});
  color?: string;
  rate?: number;
  fallSpeed?: number;
  drift?: number;
  life?: number;
  size?: number;
}

/** boss 專屬道具 builder：收 theme，回傳一個放進場景的 THREE.Object3D（型別檔不依賴 three，故用 any）。 */
export type PropBuilder = (theme: ArenaTheme) => any;

/** 場地主題：scene 顏色/燈光 + 地板/牆風格 + 裝飾清單 + 各道具設定 + 地刻 + 大氣。 */
export interface ArenaTheme {
  // 天空 / 霧
  sky?: number; fog?: number; fogNear?: number; fogFar?: number;
  // 地板
  floor?: number; ring?: number;
  floorStyle?: 'tiled' | 'mossy' | 'organic' | 'flagstone';
  floorTint?: number; outerGround?: number;
  // 邊界牆
  wallStone?: number; wallTrim?: number;
  wallStyle?: 'stone' | 'natural' | 'none';
  wallTrimGlow?: number;
  // 燈光
  hemiSky?: number; hemiGround?: number; hemiInt?: number;
  sunColor?: number; sunInt?: number; rimColor?: number; rimInt?: number;

  /** 要組裝的道具 kind 清單（順序 = 加入順序）。對應 decorations 的註冊表或 props 自訂。 */
  decorations?: string[];
  /** boss 專屬一次性 builder：kind -> builder。覆蓋全域註冊表，免改 decorations.js。 */
  props?: Record<string, PropBuilder>;
  floorDecal?: FloorDecal;
  atmosphere?: Atmosphere;

  // ---- 內建共用道具的設定（值由對應 builder 解讀；boss 專屬道具的設定可用同名 key）----
  tree?: any; rock?: any; crystal?: any; pillar?: any; brazier?: any;
  ruins?: any; temple?: any; roots?: any; foliage?: any; godrays?: any; groundcover?: any;
  // boss 專屬道具設定（搭配 props 的同名 builder）：劇毒飛蜥的石砌祭壇 / 毒池環 / 蛇紋石王座 / 立桿火把。
  dais?: any; pools?: any; throne?: any; torches?: any;
}

/** 一隻 boss 的完整場地定義：放在 <boss>/arena.ts，由 index.ts 併入 boss data。 */
export interface ArenaDef {
  theme: ArenaTheme;
  colliders?: ArenaCollider[];
}
