// @ts-nocheck
export function drawMagicSwordsmanTexture(x, S) {
  // Background/Base circle
  x.fillStyle = '#10112d';
  x.beginPath(); x.arc(S / 2, S / 2, 45, 0, Math.PI * 2); x.fill();
  
  // Outer gold rim
  x.strokeStyle = '#ffd700';
  x.lineWidth = 3;
  x.beginPath(); x.arc(S / 2, S / 2, 44, 0, Math.PI * 2); x.stroke();

  // Cyan inner ring
  x.strokeStyle = '#00d2ff';
  x.lineWidth = 2;
  x.beginPath(); x.arc(S / 2, S / 2, 34, 0, Math.PI * 2); x.stroke();

  // Draw 6 orbital runes (glowing cyan and gold dots)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = S / 2 + Math.cos(a) * 26;
    const py = S / 2 + Math.sin(a) * 26;
    x.fillStyle = i % 2 === 0 ? '#ffd700' : '#00d2ff';
    x.beginPath(); x.arc(px, py, 3.5, 0, Math.PI * 2); x.fill();
  }

  // Draw central cross/sword energy (from image theme)
  x.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  x.lineWidth = 4;
  x.beginPath(); x.moveTo(S / 2 - 12, S / 2); x.lineTo(S / 2 + 12, S / 2); x.stroke();
  x.beginPath(); x.moveTo(S / 2, S / 2 - 12); x.lineTo(S / 2, S / 2 + 12); x.stroke();

  // Central glowing core
  x.fillStyle = '#00f3ff';
  x.beginPath(); x.arc(S / 2, S / 2, 6, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#ffffff';
  x.beginPath(); x.arc(S / 2, S / 2, 3, 0, Math.PI * 2); x.fill();
}
