/**
 * Hand-drawn Amsterdam bay textures for the rendering spike: one bay wide, one
 * storey tall, about 1 px per cm so brick courses survive mipmapping. Drawn on a
 * canvas over the CC0 ambientCG brick so nothing here is copied from a model or
 * a photograph. Browser only.
 */
import { hashSeed } from './wallBays.js';

export const PX_PER_M = 100;
export const BAY_PX = 520;
export const STOREY_PX = 310;
export const GROUND_PX = 340;

export type BayKind = 'upper' | 'groundDoor' | 'groundWindow' | 'plain';
export type Look = 'photo' | 'cartoon';
export interface BayStyle { frame: string; door: string; shutters: boolean; arch: boolean; wall: string; accent: string }

const WOODWORK = ['#f1ede2', '#f1ede2', '#f1ede2', '#e8e2d0', '#2f4a3c'];
const DOORS = ['#243a2f', '#1f2a3a', '#3a1f1c', '#222222', '#2f4a3c'];

/** Cartoon palette: a handful of warm, friendly wall colours and four door/shutter accents. */
export const CARTOON_WALLS = ['#d9674a', '#e58a5c', '#eab85f', '#f0dfb8', '#e5a396', '#9dbb9b', '#7ea3c2'] as const;
export const CARTOON_ACCENTS = ['#2a8c8c', '#e0a526', '#d9453d', '#2c4a7c'] as const;
const OUTLINE = '#3b2a2a';

export function bayStyleFor(seed: string, look: Look = 'photo'): BayStyle {
  const h = hashSeed(seed);
  if (look === 'cartoon') {
    const accent = (h >>> 4) % CARTOON_ACCENTS.length;
    return { frame: '#fffaf0', door: CARTOON_ACCENTS[accent], shutters: accent % 2 === 0, arch: false,
      wall: CARTOON_WALLS[h % CARTOON_WALLS.length], accent: CARTOON_ACCENTS[accent] };
  }
  return {
    wall: '#ffffff', accent: '#ffffff',
    frame: WOODWORK[h % WOODWORK.length],
    door: DOORS[(h >>> 4) % DOORS.length],
    shutters: (h >>> 8) % 5 === 0,
    arch: (h >>> 11) % 4 === 0,
  };
}

const cache = new Map<string, HTMLCanvasElement>();

function drawBrick(ctx: CanvasRenderingContext2D, brick: CanvasImageSource, w: number, h: number): void {
  const tile = 105;
  for (let y = 0; y < h; y += tile) for (let x = 0; x < w; x += tile) ctx.drawImage(brick, x, y, tile, tile);
}

function window2d(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: BayStyle): void {
  const frame = 9;
  // Reveal: the shadow inside the brick opening.
  ctx.fillStyle = 'rgba(20,14,10,0.55)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  // Lintel: a soldier course of upright bricks over the opening, or an arch.
  ctx.fillStyle = '#c9b496';
  if (style.arch) {
    ctx.beginPath(); ctx.ellipse(x + w / 2, y, w / 2 + 6, 22, 0, Math.PI, 0); ctx.fill();
  } else {
    ctx.fillRect(x - 8, y - 26, w + 16, 22);
    ctx.strokeStyle = 'rgba(80,58,44,0.8)'; ctx.lineWidth = 2;
    for (let bx = x - 8; bx < x + w + 8; bx += 10) { ctx.beginPath(); ctx.moveTo(bx, y - 26); ctx.lineTo(bx, y - 4); ctx.stroke(); }
  }
  // Sill: pale stone, wider than the frame.
  ctx.fillStyle = '#cfcabd'; ctx.fillRect(x - 7, y + h + 1, w + 14, 8);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 7, y + h + 9, w + 14, 3);
  // Frame and glass with a faint sky reflection.
  ctx.fillStyle = style.frame; ctx.fillRect(x, y, w, h);
  const gx = x + frame, gy = y + frame, gw = w - 2 * frame, gh = h - 2 * frame;
  const glass = ctx.createLinearGradient(0, gy, 0, gy + gh);
  glass.addColorStop(0, '#6f8796'); glass.addColorStop(0.55, '#2f4350'); glass.addColorStop(1, '#1d2a33');
  ctx.fillStyle = glass; ctx.fillRect(gx, gy, gw, gh);
  // Six-over-six sash: a meeting rail in the middle, muntins in each sash.
  ctx.fillStyle = style.frame;
  const rail = 6; ctx.fillRect(gx, gy + gh / 2 - rail / 2, gw, rail);
  for (let c = 1; c < 3; c++) ctx.fillRect(gx + (gw * c) / 3 - 1.5, gy, 3, gh);
  for (const half of [0, 1]) ctx.fillRect(gx, gy + gh / 4 + half * (gh / 2) - 1.5, gw, 3);
  if (style.shutters) {
    ctx.fillStyle = '#2f4a3c';
    ctx.fillRect(x - w * 0.42, y - 2, w * 0.4, h + 4); ctx.fillRect(x + w * 1.02, y - 2, w * 0.4, h + 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let sy = y + 6; sy < y + h; sy += 9) { ctx.fillRect(x - w * 0.42, sy, w * 0.4, 2); ctx.fillRect(x + w * 1.02, sy, w * 0.4, 2); }
  }
}

function door2d(ctx: CanvasRenderingContext2D, x: number, groundY: number, style: BayStyle): void {
  const w = 112, h = 232, top = groundY - h;
  ctx.fillStyle = 'rgba(20,14,10,0.55)'; ctx.fillRect(x - 5, top - 5, w + 10, h + 5);
  ctx.fillStyle = '#d9d4c7'; ctx.fillRect(x - 12, top - 34, w + 24, 26); // stone surround and lintel
  ctx.fillStyle = style.door; ctx.fillRect(x, top, w, h);
  // Fanlight over the door with radiating bars.
  const fan = 46;
  ctx.fillStyle = '#1d2a33'; ctx.fillRect(x + 8, top + 8, w - 16, fan);
  ctx.strokeStyle = style.frame; ctx.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + w / 2, top + 8 + fan); ctx.lineTo(x + 8 + ((w - 16) * i) / 4, top + 8); ctx.stroke(); }
  // Panels and a brass handle.
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
  ctx.strokeRect(x + 14, top + fan + 22, w - 28, 62); ctx.strokeRect(x + 14, top + fan + 100, w - 28, 62);
  ctx.fillStyle = '#c9a24a'; ctx.fillRect(x + w - 24, top + h * 0.55, 8, 8);
  // Two stone steps.
  ctx.fillStyle = '#bdb8ab'; ctx.fillRect(x - 14, groundY - 8, w + 28, 8);
  ctx.fillStyle = '#a9a496'; ctx.fillRect(x - 24, groundY, w + 48, 10);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function cartoonWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, style: BayStyle): void {
  ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = OUTLINE;
  if (style.shutters) {
    ctx.fillStyle = style.accent;
    for (const sx of [x - w * 0.46, x + w * 1.06]) { roundRect(ctx, sx, y + 4, w * 0.4, h - 8, 6); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 3; for (let ly = y + 20; ly < y + h - 14; ly += 16) { ctx.beginPath(); ctx.moveTo(sx + 6, ly); ctx.lineTo(sx + w * 0.4 - 6, ly); ctx.stroke(); } ctx.lineWidth = 6; }
  }
  // Cream stone lintel block and sill, both outlined.
  ctx.fillStyle = '#fff1cf';
  roundRect(ctx, x - 14, y - 34, w + 28, 28, 8); ctx.fill(); ctx.stroke();
  roundRect(ctx, x - 12, y + h + 2, w + 24, 14, 6); ctx.fill(); ctx.stroke();
  // White frame, bright sky-blue glass, chunky cross.
  ctx.fillStyle = style.frame; roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#a9e0f7'); g.addColorStop(1, '#5aa8d8');
  ctx.fillStyle = g; roundRect(ctx, x + 12, y + 12, w - 24, h - 24, 6); ctx.fill();
  ctx.lineWidth = 4; ctx.stroke();
  ctx.fillStyle = style.frame; ctx.fillRect(x + w / 2 - 4, y + 12, 8, h - 24); ctx.fillRect(x + 12, y + h * 0.42, w - 24, 8);
  // Two highlight streaks in each upper pane.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath(); ctx.moveTo(x + 20, y + 20); ctx.lineTo(x + 36, y + 20); ctx.lineTo(x + 20, y + 52); ctx.closePath(); ctx.fill();
}

function cartoonDoor(ctx: CanvasRenderingContext2D, x: number, groundY: number, style: BayStyle): void {
  const w = 118, h = 226, top = groundY - h;
  ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = '#fff1cf'; roundRect(ctx, x - 14, top - 40, w + 28, h + 40, 14); ctx.fill(); ctx.stroke(); // stone surround
  ctx.fillStyle = style.accent; roundRect(ctx, x, top, w, h, 12); ctx.fill(); ctx.stroke();
  // Round fanlight with a sunburst.
  ctx.fillStyle = '#a9e0f7'; ctx.beginPath(); ctx.arc(x + w / 2, top + 52, 38, Math.PI, 0); ctx.lineTo(x + w / 2 + 38, top + 66); ctx.lineTo(x + w / 2 - 38, top + 66); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3; for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w / 2, top + 66); ctx.lineTo(x + w / 2 - 38 + (76 * i) / 4, top + 20); ctx.stroke(); }
  ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(59,42,42,0.55)';
  roundRect(ctx, x + 16, top + 86, w - 32, 56, 8); ctx.stroke(); roundRect(ctx, x + 16, top + 152, w - 32, 56, 8); ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x + w - 22, top + h * 0.55, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = 6; ctx.fillStyle = '#fff1cf';
  roundRect(ctx, x - 26, groundY - 16, w + 52, 16, 6); ctx.fill(); ctx.stroke();
}

function cartoonBay(kind: BayKind, style: BayStyle, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = style.wall; ctx.fillRect(0, 0, w, h);
  // Soft brick courses, so the wall is not a flat sheet but stays calm.
  ctx.strokeStyle = 'rgba(60,30,20,0.10)'; ctx.lineWidth = 2;
  for (let row = 0, y = 6; y < h; y += 14, row++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    for (let x = (row % 2) * 24; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); }
  }
  if (kind === 'upper') {
    cartoonWindow(ctx, w * 0.22 - 58, 66, 116, 186, style);
    cartoonWindow(ctx, w * 0.78 - 58, 66, 116, 186, style);
  } else if (kind === 'groundDoor') {
    cartoonDoor(ctx, w * 0.18, h - 20, style);
    cartoonWindow(ctx, w * 0.64, 76, 126, 150, style);
  } else if (kind === 'groundWindow') {
    cartoonWindow(ctx, w * 0.2 - 18, 66, 136, 164, style);
    cartoonWindow(ctx, w * 0.62, 66, 136, 164, style);
  }
  if (kind !== 'upper') { ctx.fillStyle = 'rgba(40,24,24,0.30)'; ctx.fillRect(0, h - 20, w, 20); }
  return canvas;
}

/** One tileable bay, drawn once per (kind, style, brick) and cached. */
export function bayTexture(kind: BayKind, style: BayStyle, brick: CanvasImageSource, look: Look = 'photo'): HTMLCanvasElement {
  const key = `${look}|${kind}|${style.wall}|${style.frame}|${style.door}|${style.shutters}|${style.arch}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = BAY_PX, h = kind === 'upper' ? STOREY_PX : GROUND_PX;
  if (look === 'cartoon') { const c = cartoonBay(kind, style, w, h); cache.set(key, c); return c; }
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  drawBrick(ctx, brick, w, h);
  if (kind === 'upper') {
    // Windows get taller toward the piano nobile: this is the standard storey.
    window2d(ctx, w * 0.22 - 55, 60, 110, 188, style);
    window2d(ctx, w * 0.78 - 55, 60, 110, 188, style);
  } else if (kind === 'groundDoor') {
    door2d(ctx, w * 0.2, h - 24, style);
    window2d(ctx, w * 0.66, 70, 120, 150, style);
  } else if (kind === 'groundWindow') {
    window2d(ctx, w * 0.2 - 15, 60, 130, 160, style);
    window2d(ctx, w * 0.62, 60, 130, 160, style);
  }
  if (kind !== 'upper') {
    // Dark stone plinth at the foot of the wall.
    ctx.fillStyle = 'rgba(40,36,34,0.78)'; ctx.fillRect(0, h - 24, w, 24);
  }
  cache.set(key, canvas);
  return canvas;
}
