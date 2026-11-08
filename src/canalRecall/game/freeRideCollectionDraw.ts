// Drawing for Free Ride's collection (freeRideCollection.ts): the discovery
// token, a small cobalt enamel coin with a copper rim, and the passport stamp
// pressed onto the postcard when a neighbourhood's list is complete. Canvas
// only; what to draw and where is decided in freeRideCollection.ts.

import { daylightTheme, enamelTheme } from '../hudTheme';

/** The enamel coin, centred on (x, y), `size` px across. */
export function drawDiscoveryToken(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number): void {
  if (!(size > 0) || !(alpha > 0)) return;
  const r = size / 2;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.shadowColor = 'rgba(31,28,23,0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  // Copper rim.
  ctx.fillStyle = enamelTheme.copper;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  // Enamel face.
  const face = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r * 0.8);
  face.addColorStop(0, enamelTheme.enamelBright);
  face.addColorStop(1, enamelTheme.enamelDeep);
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.fill();
  // A four-point star, as the city's crosses would be too busy at 12 px.
  ctx.fillStyle = '#fbf8f2';
  const s = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const len = i % 2 === 0 ? s : s * 0.38;
    const px = x + Math.cos(a) * len, py = y + Math.sin(a) * len;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Highlight.
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(0.75, r * 0.12);
  ctx.beginPath(); ctx.arc(x, y, r * 0.78, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
}

/** A round passport stamp, slightly turned, centred on (x, y). */
export function drawPassportStamp(
  ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, label: string, alpha: number, fontFamily: string,
): void {
  if (!(alpha > 0)) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha) * 0.9;
  ctx.translate(x, y);
  ctx.rotate(-0.21);
  ctx.strokeStyle = daylightTheme.accent;
  ctx.fillStyle = daylightTheme.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, radius - 5, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(radius * 0.36)}px ${fontFamily}`;
  ctx.fillText(label.toUpperCase(), 0, 1);
  ctx.restore();
}

/** The coin flipping as it is collected (t: 0..1): it turns edge-on, shows its copper back, and fades. */
export function drawCollectedToken(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number): void {
  if (!(t >= 0 && t < 1)) return;
  const flip = Math.cos(t * Math.PI * 2);
  ctx.save();
  ctx.translate(x, y - t * 10);
  ctx.scale(Math.max(0.08, Math.abs(flip)), 1);
  if (flip >= 0) drawDiscoveryToken(ctx, 0, 0, size, 1 - t);
  else {
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = enamelTheme.copperHi;
    ctx.beginPath(); ctx.arc(0, 0, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = enamelTheme.copperDeep; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
}
