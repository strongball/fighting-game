// @ts-nocheck
export function drawGlassAstrologerTexture(x, S) {
  const cx = S / 2;
  const cy = S / 2;

  x.strokeStyle = 'rgba(185, 245, 255, 0.62)';
  x.lineWidth = 2;
  for (let r = 18; r <= 52; r += 17) {
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.stroke();
  }

  x.strokeStyle = 'rgba(255, 230, 167, 0.5)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    x.lineTo(cx + Math.cos(a) * 58, cy + Math.sin(a) * 58);
    x.stroke();
  }

  x.fillStyle = 'rgba(255, 255, 255, 0.68)';
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const r = 24 + (i % 3) * 12;
    x.beginPath();
    x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.8 + (i % 2), 0, Math.PI * 2);
    x.fill();
  }

  x.strokeStyle = 'rgba(158, 232, 255, 0.42)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const px = 18 + i * 15;
    x.beginPath();
    x.moveTo(px, 18 + (i % 2) * 16);
    x.lineTo(px + 12, 44 + (i % 3) * 15);
    x.lineTo(px - 4, 84 - (i % 2) * 12);
    x.stroke();
  }
}
