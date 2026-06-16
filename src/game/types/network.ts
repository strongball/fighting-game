// P2P 線路訊息型別（host 星狀拓撲）。
//
// 注意：wire 格式必須與既有 controller 相容——`t` 欄位是訊息類型判別子，
// 重構時不可更動既有欄位名稱。完整的判別聯集（discriminated union）會在
// controller 拆解階段補上；目前先提供判別子與寬鬆結構。

export type NetMessageType =
  | 'hello'   // 加入者 → 房主：自我介紹（名稱）
  | 'select'  // 大廳：選角/隊伍/操作方式
  | 'lobby'   // 房主 → 全體：大廳名單
  | 'start'   // 房主 → 全體：開始遊戲（初始玩家陣列）
  | 'input'   // 加入者 → 房主：每幀輸入
  | 'state'   // 房主 → 全體：權威狀態快照
  | 'gameover' // 房主 → 全體：結算
  | (string & {});

export interface NetMessage {
  t: NetMessageType;
  [key: string]: any;
}
