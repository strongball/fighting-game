// 產生 iOS Safari PWA 啟動畫面 (apple-touch-startup-image)。
// iOS 不吃 manifest 的 icon/splash，必須用「精準裝置解析度」的 PNG 才會套用，
// 否則開啟 PWA 時會閃一下白畫面。這裡產生符合主題色的純色啟動圖（含直/橫向）。
//
// 用法: node tools/gen-ios-splash.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG = [0x0b, 0x11, 0x18]; // #0b1118，與 theme_color / background_color 一致
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'splash');

// 各代 iPhone 的「直向」實體像素 (寬 x 高)；橫向會自動交換寬高。
const PORTRAIT = [
  [1290, 2796], // 14/15/16 Pro Max, 15/16 Plus
  [1179, 2556], // 14 Pro, 15/16
  [1284, 2778], // 12/13 Pro Max
  [1170, 2532], // 12/13/14, 16e
  [1125, 2436], // X, XS, 11 Pro
  [1242, 2688], // XS Max, 11 Pro Max
  [828, 1792],  // XR, 11
  [1242, 2208], // 8 Plus
  [750, 1334],  // 8, SE2, SE3
  [640, 1136],  // SE1
];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function solidPng(w, h, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor RGB
  // 每列開頭 1 byte filter(0) + w*3 bytes pixel
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) {
    row[1 + x * 3] = r;
    row[1 + x * 3 + 1] = g;
    row[1 + x * 3 + 2] = b;
  }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 每代 iPhone 的 device-pixel-ratio（媒體查詢需要邏輯像素 = 實體 / dpr）。
const DPR = { 1290: 3, 1179: 3, 1284: 3, 1170: 3, 1125: 3, 1242: 3, 828: 2, 750: 2, 640: 2 };

mkdirSync(OUT_DIR, { recursive: true });
for (const [pw, ph] of PORTRAIT) {
  for (const [w, h] of [[pw, ph], [ph, pw]]) {
    writeFileSync(join(OUT_DIR, `splash-${w}x${h}.png`), solidPng(w, h, BG));
  }
}

// 輸出可直接貼進 index.html 的 link 標籤。
const lines = [];
for (const [pw, ph] of PORTRAIT) {
  const dpr = DPR[pw];
  const lw = pw / dpr, lh = ph / dpr;
  lines.push(
    `<link rel="apple-touch-startup-image" media="screen and (device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" href="./splash/splash-${pw}x${ph}.png" />`
  );
  lines.push(
    `<link rel="apple-touch-startup-image" media="screen and (device-width: ${lw}px) and (device-height: ${lh}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: landscape)" href="./splash/splash-${ph}x${pw}.png" />`
  );
}
console.log(lines.join('\n'));
