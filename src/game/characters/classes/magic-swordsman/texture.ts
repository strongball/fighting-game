// @ts-nocheck
export function drawMagicSwordsmanTexture(x, S) {
  x.strokeStyle = 'rgba(108, 92, 231, 0.7)';
  x.lineWidth = 4;
  x.beginPath(); x.arc(S / 2, S / 2, 44, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(162, 155, 254, 0.5)';
  x.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const px = S / 2 + Math.cos(a) * 32;
    const py = S / 2 + Math.sin(a) * 32;
    x.beginPath(); x.arc(px, py, 4 + (i % 2) * 2, 0, Math.PI * 2); x.stroke();
  }
  x.strokeStyle = 'rgba(253, 121, 168, 0.8)';
  x.lineWidth = 3;
  x.beginPath(); x.moveTo(S / 2 - 14, S / 2 + 10); x.lineTo(S / 2 + 14, S / 2 - 10); x.stroke();
  x.beginPath(); x.moveTo(S / 2 - 14, S / 2 - 10); x.lineTo(S / 2 + 14, S / 2 + 10); x.stroke();
  x.fillStyle = 'rgba(242, 240, 255, 0.6)';
  x.beginPath(); x.arc(S / 2, S / 2, 8, 0, Math.PI * 2); x.fill();
}
