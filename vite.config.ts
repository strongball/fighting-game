import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React UI 殼；遊戲引擎與 three.js 渲染維持命令式。
// Vite 原生解析 'three' 與 'three/addons/*'（透過 three 套件的 exports），
// 因此 src/game/render3d/* 的匯入完全不需更動。
export default defineConfig({
  base: '/fighting-game/',
  plugins: [react()],
  server: {
    host: true, // 允許區域網路其他裝置連入測試多人連線
  },
  // three 的 addons 體積較大，預先打包可避免開發期大量零散請求。
  optimizeDeps: {
    include: ['three', 'peerjs'],
  },
});
