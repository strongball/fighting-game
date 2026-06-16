import { defineConfig } from 'vitest/config';

// Vitest 跑在 Node 環境即可：模擬層 (simulation/systems/entities/actions) 是純邏輯，
// 不需要 DOM/WebGL。角色 sprite 產生器會以 `typeof document === 'undefined'` 自我守衛，
// three.js 只在 render 時才建立 GPU 資源，因此 import 整棵引擎圖在 Node 下是安全的。
//
// Vitest 由 Vite 驅動，原生支援引擎大量使用的 `import.meta.glob`（registry 自動發現）
// 與 `import.meta.env.BASE_URL`（資源路徑），無需額外 loader shim。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // 快照存於 test/__snapshots__/，作為「行為不變」的黃金回歸基準。
    // 重構後若模擬輸出改變，快照比對會失敗，逼使我們確認是否為預期。
  },
});
