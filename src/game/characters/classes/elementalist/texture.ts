// @ts-nocheck
export function drawElementalistTexture(x, S) {
  // 元素使：白金祭袍、橘金火紋、淡綠披帛。
  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, 'rgba(255, 249, 229, 0.96)');
  g.addColorStop(0.5, 'rgba(255, 226, 151, 0.86)');
  g.addColorStop(1, 'rgba(194, 232, 202, 0.76)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);

  x.fillStyle = 'rgba(255, 132, 32, 0.72)';
  x.beginPath();
  x.moveTo(S * 0.5, S * 0.08);
  x.lineTo(S * 0.68, S * 0.48);
  x.lineTo(S * 0.54, S * 0.92);
  x.lineTo(S * 0.46, S * 0.92);
  x.lineTo(S * 0.32, S * 0.48);
  x.closePath();
  x.fill();

  x.strokeStyle = 'rgba(180, 115, 28, 0.72)';
  x.lineWidth = Math.max(2, S * 0.035);
  x.beginPath();
  x.arc(S * 0.5, S * 0.28, S * 0.24, Math.PI * 0.08, Math.PI * 1.22);
  x.stroke();

  x.fillStyle = 'rgba(133, 216, 185, 0.62)';
  x.beginPath();
  x.moveTo(S * 0.15, S * 0.54);
  x.quadraticCurveTo(S * 0.3, S * 0.75, S * 0.16, S * 0.98);
  x.lineTo(S * 0.38, S * 0.9);
  x.quadraticCurveTo(S * 0.34, S * 0.68, S * 0.24, S * 0.46);
  x.closePath();
  x.fill();
  x.beginPath();
  x.moveTo(S * 0.85, S * 0.54);
  x.quadraticCurveTo(S * 0.7, S * 0.75, S * 0.84, S * 0.98);
  x.lineTo(S * 0.62, S * 0.9);
  x.quadraticCurveTo(S * 0.66, S * 0.68, S * 0.76, S * 0.46);
  x.closePath();
  x.fill();

  x.fillStyle = 'rgba(255, 255, 244, 0.86)';
  for (let i = 0; i < 18; i++) {
    const px = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const py = (Math.sin(i * 78.233) * 24634.6345) % 1;
    x.fillRect(Math.abs(px) * S, Math.abs(py) * S, Math.max(1, S * 0.018), Math.max(1, S * 0.018));
  }
}
