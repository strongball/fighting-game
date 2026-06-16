// 引擎共用 domain 型別的單一匯入點。
//
// 用法：`import type { GameState, Player, ActionContext } from '../types';`
//
// 這些型別是引擎的「詞彙表」與 IDE 文件來源。隨著各 .js/@ts-nocheck 檔案逐步
// 移除型別關閉，會改吃這裡的型別以獲得真正的 IntelliSense 與編譯期檢查。
export * from './entities';
export * from './engine';
export * from './actions';
export * from './network';
