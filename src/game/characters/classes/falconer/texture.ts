// @ts-nocheck
export function drawFalconerTexture(x, S) {
  // 鳥獵：鷹羽皮甲，暖琥珀色羽紋拼貼
  x.fillStyle = 'rgba(224, 168, 46, 0.5)';
  for (let i = 0; i < 12; i++) {
    x.fillRect(Math.random() * (S - 18), Math.random() * (S - 8), 18, 8);
  }
  x.fillStyle = 'rgba(120, 80, 20, 0.4)';
  for (let i = 0; i < 8; i++) {
    x.fillRect(Math.random() * (S - 10), Math.random() * (S - 4), 10, 4);
  }
}
