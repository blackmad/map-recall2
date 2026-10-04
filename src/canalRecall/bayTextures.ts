/**
 * Hand-drawn Amsterdam bay textures for the rendering spike. One bay wide and
 * one storey tall (about 1 px per cm), drawn twice: a colour pass, and a tint
 * mask (R = wall, G = accent such as door leaf, shutters, awning) so a shader
 * can recolour walls and accents per building without a canvas per colour.
 * Two looks share one layout: `photo` (CC0 ambientCG brick, shaded detail) and
 * `cartoon` (flat colour, thick outlines). Browser only.
 */
import { hashSeed } from './wallBays.js';

export const PX_PER_M = 100;
export const BAY_PX = 520;
export const STOREY_PX = 310;
export const GROUND_PX = 340;

export type Look = 'photo' | 'storybook' | 'cartoon';
/** Construction periods inform palette and details; opening family is independent. */
export type Archetype = 'canal' | 'c19' | 'school' | 'modern';
export type BayKind = 'plain' | 'groundDoor' | 'groundShop' | 'shopCafe' | 'shopWindow' | 'shopBar' | 'shopDeli' | 'shopFlorist' | 'shopBike' | 'ground' | 'upper' | 'upperTall' | 'attic';
export const SHOP_KINDS = ['groundShop', 'shopCafe', 'shopWindow', 'shopBar', 'shopDeli', 'shopFlorist', 'shopBike'] as const;
export type ShopKind = (typeof SHOP_KINDS)[number];
export type WindowShape = 'rect' | 'arch' | 'round';

/** Everything that changes how a bay is drawn; colours are not part of it. */
export interface BayVariant {
  archetype: Archetype;
  kind: BayKind;
  windows: 1 | 2 | 3;
  shape: WindowShape;
  shutters: boolean;
  /** Frame woodwork: white, or the accent colour (painted frames). */
  paintedFrames: boolean;
  family?: 'masonry' | 'punched' | 'ribbon' | 'curtain';
  proportions?: 'tall' | 'balanced' | 'wide';
  frameTone?: 'pale' | 'dark';
  lintel?: 'flat' | 'arch' | 'none';
  paleAccents?: boolean;
  openingOccupancy?: number;
  openingHeight?: number;
  sash?: 'plain' | 'transom' | 'six-over-six';
  trimDensity?: 'restrained' | 'ornate';
  wallMaterial?: 'brick' | 'smooth';
}

export const variantKey = (v: BayVariant, look: Look) =>
  `${look}|${v.archetype}|${v.kind}|${v.windows}|${v.shape}|${v.shutters}|${v.paintedFrames}|${v.family ?? "masonry"}|${v.proportions ?? "tall"}|${v.frameTone ?? "pale"}|${v.lintel ?? "flat"}|${!!v.paleAccents}|${v.openingOccupancy ?? "legacy"}|${v.openingHeight ?? "legacy"}|${v.sash ?? "legacy"}|${v.trimDensity ?? "legacy"}|${v.wallMaterial ?? "legacy"}`;

/** Building-level choices, derived from a seed so every wall of a building agrees. */
export function buildingStyle(seed: string, archetype: Archetype): Omit<BayVariant, 'kind'> & { shop: boolean } {
  const h = hashSeed(seed);
  const windows = (archetype === 'modern' ? 1 : [2, 2, 3, 1][h % 4]) as 1 | 2 | 3;
  const shape: WindowShape = archetype === 'canal' ? (['rect', 'rect', 'rect', 'arch', 'round'] as const)[(h >>> 3) % 5] : 'rect';
  return {
    archetype, windows, shape, family: archetype === 'modern' ? 'punched' : 'masonry',
    shutters: archetype === 'canal' && (h >>> 8) % 4 === 0,
    paintedFrames: (h >>> 10) % 5 === 0,
    shop: (h >>> 13) % 4 === 0,
  };
}

export const PALETTES: Record<Look, Record<Archetype, { walls: string[]; accents: string[] }>> = {
  cartoon: {
    canal: { walls: ['#d9674a', '#e58a5c', '#eab85f', '#f0dfb8', '#e5a396', '#9dbb9b', '#7ea3c2', '#c9714a', '#f2c14e', '#b9a1c9'],
      accents: ['#2a8c8c', '#e0a526', '#d9453d', '#2c4a7c', '#7a3b6e', '#2f6b45', '#4aa3d9'] },
    c19: { walls: ['#d9674a', '#e58a5c', '#eab85f', '#f0dfb8', '#e5a396', '#9dbb9b', '#7ea3c2', '#c9714a', '#f2c14e', '#b9a1c9'],
      accents: ['#2a8c8c', '#e0a526', '#d9453d', '#2c4a7c', '#7a3b6e', '#2f6b45', '#4aa3d9'] },
    school: { walls: ['#9c5a42', '#8a4b3a', '#a8664c', '#7a4a40'], accents: ['#2c4a7c', '#2a8c8c', '#e0a526'] },
    modern: { walls: ['#f4efe6', '#dcdcd6', '#e9d9c0', '#b9c4cc', '#f0c9a9'], accents: ['#2a8c8c', '#d9453d', '#2c4a7c', '#e0a526'] },
  },
  storybook: {
    canal: { walls: ['#d9674a', '#e58a5c', '#eab85f', '#f0dfb8', '#e5a396', '#9dbb9b', '#7ea3c2', '#c9714a', '#f2c14e', '#b9a1c9'],
      accents: ['#2a8c8c', '#e0a526', '#d9453d', '#2c4a7c', '#7a3b6e', '#2f6b45', '#4aa3d9'] },
    c19: { walls: ['#d9674a', '#e58a5c', '#eab85f', '#f0dfb8', '#e5a396', '#9dbb9b', '#7ea3c2', '#c9714a', '#f2c14e', '#b9a1c9'],
      accents: ['#2a8c8c', '#e0a526', '#d9453d', '#2c4a7c', '#7a3b6e', '#2f6b45', '#4aa3d9'] },
    school: { walls: ['#9c5a42', '#8a4b3a', '#a8664c', '#7a4a40'], accents: ['#2c4a7c', '#2a8c8c', '#e0a526'] },
    modern: { walls: ['#f4efe6', '#dcdcd6', '#e9d9c0', '#b9c4cc', '#f0c9a9'], accents: ['#2a8c8c', '#d9453d', '#2c4a7c', '#e0a526'] },
  },
  photo: {
    canal: { walls: ['#ffffff', '#f2d9c8', '#d9b9a4', '#e6c9b0', '#c9a38c', '#f0e4d2', '#ffd9b0', '#e8c0b0', '#d0c8c0'],
      accents: ['#243a2f', '#1f2a3a', '#3a1f1c', '#222222', '#2f4a3c', '#6b2b2b', '#2c3e50'] },
    c19: { walls: ['#ffffff', '#f2d9c8', '#d9b9a4', '#e6c9b0', '#c9a38c', '#f0e4d2', '#ffd9b0', '#e8c0b0', '#d0c8c0'],
      accents: ['#243a2f', '#1f2a3a', '#3a1f1c', '#222222', '#2f4a3c', '#6b2b2b', '#2c3e50'] },
    school: { walls: ['#b89080', '#a88070', '#9c7868'], accents: ['#1f2a3a', '#243a2f', '#3a1f1c'] },
    modern: { walls: ['#f2f2ee', '#d8d8d2', '#e8dcc8', '#c8d0d4'], accents: ['#2c3e50', '#6b2b2b', '#243a2f'] },
  },
};

/** Wall and accent colour for a building. */
export function paletteFor(seed: string, archetype: Archetype, look: Look): { wall: string; accent: string } {
  const h = hashSeed(seed), p = PALETTES[look][archetype];
  return { wall: p.walls[h % p.walls.length], accent: p.accents[(h >>> 5) % p.accents.length] };
}

/** Known construction period, otherwise a conservative low-rise masonry/tall punched fallback. */
export function archetypeFor(_seed: string, year: number | null, heightM: number): Archetype {
  // The same periods as `facadeStyleFor`: 1860-1914 and post-war blocks no longer draw as canal houses.
  if (year !== null && year > 1500 && year < 2100) return year < 1860 ? 'canal' : year < 1915 ? 'c19' : year < 1945 ? 'school' : 'modern';
  if (heightM >= 28) return 'modern';
  return 'c19';
}

type Pass = 'colour' | 'mask';
const OUTLINE = '#3b2a2a';
const cache = new Map<string, { colour: HTMLCanvasElement; mask: HTMLCanvasElement }>();

class Painter {
  constructor(readonly ctx: CanvasRenderingContext2D, readonly pass: Pass, readonly look: Look) {}
  /** Both illustrated looks draw outlined, flat-filled shapes; `toon` is the bolder of the two. */
  get cartoon() { return this.look !== 'photo'; }
  get toon() { return this.look === 'cartoon'; }
  get lineW() { return this.toon ? 9 : 3.5; }
  get glass(): [string, string] { return this.toon ? ['#a9e0f7', '#5aa8d8'] : ['#a3bccb', '#6a8799']; }
  get stone() { return this.toon ? '#fff1cf' : '#e6dbc3'; }
  /** Fill with a role-aware colour: `wall`/`accent` become mask channels; `ink` is untinted. */
  fill(role: 'wall' | 'accent' | 'ink', colour: string | CanvasGradient): void {
    this.ctx.fillStyle = this.pass === 'mask' ? (role === 'wall' ? '#ff0000' : role === 'accent' ? '#00ff00' : '#000000')
      : role === 'accent' ? '#ffffff' : colour;
  }
  stroke(colour: string, width: number): void {
    this.ctx.strokeStyle = this.pass === 'mask' ? '#000000' : colour; this.ctx.lineWidth = width;
  }
  /** Shading that only exists in the colour pass. */
  shade(fn: () => void): void { if (this.pass === 'colour') fn(); }
  rr(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx; c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
}

function wall(p: Painter, w: number, h: number, brick: CanvasImageSource, archetype: Archetype, material?: 'brick' | 'smooth'): void {
  const { ctx } = p;
  if (p.pass === 'mask') { p.fill('wall', ''); ctx.fillRect(0, 0, w, h); return; }
  const smooth = material === 'smooth' || archetype === 'modern' && material !== 'brick';
  if (p.cartoon || smooth) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    if (p.toon && !smooth) return; // cartoon walls are flat colour
    ctx.strokeStyle = smooth ? 'rgba(0,0,0,0.05)' : 'rgba(60,30,20,0.16)'; ctx.lineWidth = 2;
    if (smooth) { for (let x = 130; x < w; x += 130) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } return; }
    for (let row = 0, y = 6; y < h; y += 14, row++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      for (let x = (row % 2) * 24; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 14); ctx.stroke(); }
    }
    return;
  }
  for (let y = 0; y < h; y += 105) for (let x = 0; x < w; x += 105) ctx.drawImage(brick, x, y, 105, 105);
  if (archetype === 'school') { ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(0, 0, w, h); }
}

function windowAt(p: Painter, x: number, y: number, w: number, h: number, v: BayVariant): void {
  const { ctx } = p, cartoon = p.cartoon, line = cartoon ? p.lineW : 0;
  const shape = v.shape;
  const topR = shape === 'arch' ? w / 2 : shape === 'round' ? 18 : 6;
  const outline = () => { if (cartoon) { p.stroke(OUTLINE, line); ctx.lineJoin = 'round'; ctx.stroke(); } };
  const shutterColour = '#ffffff';
  // Shutters belong to a canal house's ground floor; on every storey they read as New England (user screenshots 2026-10-02).
  if (v.shutters && v.archetype === 'canal' && (v.kind === 'ground' || v.kind === 'groundDoor')) {
    for (const sx of [x - w * 0.46, x + w * 1.06]) {
      p.fill('accent', shutterColour); p.rr(sx, y + 4, w * 0.4, h - 8, 5); ctx.fill(); outline();
      p.shade(() => { ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 2; for (let ly = y + 18; ly < y + h - 12; ly += 15) { ctx.beginPath(); ctx.moveTo(sx + 5, ly); ctx.lineTo(sx + w * 0.4 - 5, ly); ctx.stroke(); } });
    }
  }
  // Reveal shadow, then lintel (soldier course or cream block) and sill.
  p.fill('ink', 'rgba(20,14,10,0.55)'); ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  const restrained = v.trimDensity === 'restrained';
  const stone = cartoon ? p.stone : '#cfc8b8';
  if (v.lintel !== 'none' && v.family !== 'punched' && v.archetype !== 'modern') {
    p.fill('ink', stone);
    if (v.lintel === 'arch' || (v.lintel === undefined && shape === 'arch')) { ctx.beginPath(); ctx.ellipse(x + w / 2, y + 2, w / 2 + (restrained ? 5 : 12), restrained ? 12 : 30, 0, Math.PI, 0); ctx.fill(); if (cartoon) outline(); }
    else { p.rr(x - (restrained ? 4 : 12), y - (restrained ? 12 : 32), w + (restrained ? 8 : 24), restrained ? 8 : 26, cartoon ? 4 : 1); ctx.fill(); outline();
      p.shade(() => { if (!cartoon && !restrained) { ctx.strokeStyle = 'rgba(80,58,44,0.7)'; ctx.lineWidth = 2; for (let bx = x - 10; bx < x + w + 12; bx += 10) { ctx.beginPath(); ctx.moveTo(bx, y - 32); ctx.lineTo(bx, y - 6); ctx.stroke(); } } }); }
    p.fill('ink', stone); p.rr(x - (restrained ? 4 : 10), y + h + 2, w + (restrained ? 8 : 20), restrained ? 5 : 12, cartoon ? 3 : 1); ctx.fill(); outline();
  }
  // Alternating pale masonry blocks sit outside the rectangular glazing, not in it.
  if (v.paleAccents) {
    p.fill('ink', p.cartoon ? '#fffaf0' : '#eee9de');
    for (let by = y + 8; by < y + h; by += restrained ? 70 : 42) {
      ctx.fillRect(x - (restrained ? 10 : 18), by, restrained ? 10 : 18, restrained ? 12 : 18); ctx.fillRect(x + w, by, restrained ? 10 : 18, restrained ? 12 : 18);
    }
  }
  // Frame and glass.
  const frameColour = v.frameTone === 'dark' ? '#2c302f' : v.paintedFrames ? '#ffffff' : (cartoon ? '#fffaf0' : '#f1ede2');
  p.fill(v.paintedFrames ? 'accent' : 'ink', frameColour);
  if (shape === 'arch') { ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w, y + h); ctx.closePath(); }
  else if (shape === 'round') { p.rr(x, y, w, h, Math.min(w / 2, 28)); } else p.rr(x, y, w, h, topR);
  ctx.fill(); outline();
  const m = restrained ? (p.toon ? 8 : 5) : v.paleAccents ? (cartoon ? 16 : 13) : cartoon ? 12 : 9;
  p.shade(() => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (cartoon) { g.addColorStop(0, p.glass[0]); g.addColorStop(1, p.glass[1]); } else { g.addColorStop(0, '#6f8796'); g.addColorStop(0.55, '#2f4350'); g.addColorStop(1, '#1d2a33'); }
    ctx.fillStyle = g;
    if (shape === 'arch') { ctx.beginPath(); ctx.moveTo(x + m, y + h - m); ctx.lineTo(x + m, y + w / 2); ctx.arc(x + w / 2, y + w / 2, w / 2 - m, Math.PI, 0); ctx.lineTo(x + w - m, y + h - m); ctx.closePath(); ctx.fill(); }
    else { p.rr(x + m, y + m, w - 2 * m, h - 2 * m, 5); ctx.fill(); }
  });
  if (p.pass === 'mask') { ctx.fillStyle = '#000'; ctx.fillRect(x + m, y + m, w - 2 * m, h - 2 * m); }
  // Muntins: a cross in cartoon, six-over-six sashes in photo.
  p.fill(v.paintedFrames ? 'accent' : 'ink', frameColour);
  if (v.sash === 'transom') {
    ctx.fillRect(x + m, y + h * .29 - 2, w - 2 * m, p.toon ? 5 : 4);
  } else if (v.sash === 'plain') {
    // Unsubdivided modern opening; perimeter frame already drawn.
  } else if (p.toon || v.family === 'punched') { ctx.fillRect(x + w / 2 - 4, y + m, 8, h - 2 * m); ctx.fillRect(x + m, y + h * 0.42, w - 2 * m, 8); }
  else {
    ctx.fillRect(x + m, y + h / 2 - 3, w - 2 * m, 6);
    for (let c = 1; c < 3; c++) ctx.fillRect(x + m + ((w - 2 * m) * c) / 3 - 1.5, y + m, 3, h - 2 * m);
    for (const half of [0, 1]) ctx.fillRect(x + m, y + h / 4 + half * (h / 2) - 1.5, w - 2 * m, 3);
  }
  p.shade(() => { if (cartoon) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(x + 20, y + h * 0.1 + 14); ctx.lineTo(x + 36, y + h * 0.1 + 14); ctx.lineTo(x + 20, y + h * 0.1 + 46); ctx.closePath(); ctx.fill(); } });
}

/** Shared modern/quiet entry layout; keep it clear of the adjacent window. */
export function bayDoorGeometry(v: BayVariant) {
  const quiet = v.trimDensity === 'restrained';
  return { x: BAY_PX * .14, width: quiet ? 98 : 118, height: quiet ? 214 : 226, bottom: 24, fanlight: !quiet };
}
export function bayDoorWindowGeometry(v: BayVariant, look: Look = 'photo') {
  const quiet = v.trimDensity === 'restrained';
  if (quiet) return { axis: .66, width: v.family === 'punched' ? 160 : 170, y: 88, height: 166 };
  const g = bayWindowGeometry({ ...v, windows: 1 }, 76, 150, look);
  return { axis: .64, ...g };
}
function quietDoorAt(p: Painter, v: BayVariant, groundY: number): void {
  const { ctx } = p, g = bayDoorGeometry(v), y = groundY - g.height;
  p.fill('ink', p.cartoon ? '#e8e3d8' : '#c9c7be'); ctx.fillRect(g.x - 5, y - 5, g.width + 10, g.height + 5);
  p.fill('accent', '#ffffff'); ctx.fillRect(g.x, y, g.width, g.height);
  // Modern communal entry has a flush rectangular glazed leaf, never a historic fanlight.
  if (v.family === 'punched' || v.family === 'curtain' || v.family === 'ribbon') {
    glassRect(p, g.x + 9, y + 10, g.width - 18, g.height - 24, 1);
    p.fill('ink', '#bdbdb4'); ctx.fillRect(g.x + g.width - 16, y + g.height * .5, 3, 24);
  } else {
    glassRect(p, g.x + 8, y + 9, g.width - 16, 36, 1);
    p.shade(() => { ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.strokeRect(g.x + 12, y + 66, g.width - 24, g.height - 82); });
    p.fill('ink', '#b3aea0'); ctx.fillRect(g.x + g.width - 17, y + g.height * .6, 4, 13);
  }
}

function doorAt(p: Painter, x: number, groundY: number, v: BayVariant): void {
  const { ctx } = p, cartoon = p.cartoon, w = 118, h = 226, top = groundY - h;
  const line = () => { if (cartoon) { p.stroke(OUTLINE, p.lineW); ctx.lineJoin = 'round'; ctx.stroke(); } };
  p.fill('ink', 'rgba(20,14,10,0.55)'); ctx.fillRect(x - 5, top - 5, w + 10, h + 5);
  p.fill('ink', cartoon ? '#fff1cf' : '#d9d4c7'); p.rr(x - 14, top - 40, w + 28, h + 40, cartoon ? 14 : 3); ctx.fill(); line();
  p.fill('accent', '#ffffff'); p.rr(x, top, w, h, cartoon ? 12 : 2); ctx.fill(); line();
  // Fanlight.
  p.fill('ink', cartoon ? '#a9e0f7' : '#1d2a33');
  ctx.beginPath(); ctx.arc(x + w / 2, top + 52, 38, Math.PI, 0); ctx.lineTo(x + w / 2 + 38, top + 66); ctx.lineTo(x + w / 2 - 38, top + 66); ctx.closePath(); ctx.fill(); line();
  p.stroke(cartoon ? OUTLINE : '#f1ede2', 3);
  if (p.pass === 'colour') for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w / 2, top + 66); ctx.lineTo(x + w / 2 - 38 + (76 * i) / 4, top + 20); ctx.stroke(); }
  p.shade(() => { ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4; p.rr(x + 16, top + 86, w - 32, 56, 6); ctx.stroke(); p.rr(x + 16, top + 152, w - 32, 56, 6); ctx.stroke();
    ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x + w - 22, top + h * 0.55, 7, 0, Math.PI * 2); ctx.fill(); });
  p.fill('ink', cartoon ? '#fff1cf' : '#bdb8ab'); p.rr(x - 26, groundY - 16, w + 52, 16, cartoon ? 6 : 1); ctx.fill(); line();
  void v;
}

/**
 * A shop's ground floor is one painted surface down to the pavement, as Amsterdam shopfronts
 * are (user report 2026-10-02: the white surround stopped above a strip of brick). It is drawn
 * flat white on the wall channel, so the mesh tints it with the building's ground-floor paint
 * (`groundHex`: white, cream, black, dark green, ...); frames and muntins take the same paint.
 */
function paintedGround(p: Painter, w: number, h: number): void {
  p.fill('wall', '#f6f3ec'); p.ctx.fillRect(0, 0, w, h);
}

function shopAt(p: Painter, w: number, groundY: number): void {
  const { ctx } = p, cartoon = p.cartoon, x = 36, top = 74, sw = w - 72, sh = groundY - top - 8;
  const line = () => { if (cartoon) { p.stroke(OUTLINE, p.lineW); ctx.lineJoin = 'round'; ctx.stroke(); } };
  p.fill('ink', 'rgba(20,14,10,0.5)'); ctx.fillRect(x - 6, top - 6, sw + 12, sh + 6);
  p.fill('wall', cartoon ? '#fffaf0' : '#e4dfd2'); p.rr(x, top, sw, sh, cartoon ? 10 : 2); ctx.fill(); line();
  p.shade(() => { const g = ctx.createLinearGradient(0, top, 0, top + sh); if (cartoon) { g.addColorStop(0, '#bdeaff'); g.addColorStop(1, '#7ec0e6'); } else { g.addColorStop(0, '#7e97a6'); g.addColorStop(1, '#27363f'); }
    ctx.fillStyle = g; p.rr(x + 12, top + 12, sw - 24, sh - 24, 6); ctx.fill(); });
  if (p.pass === 'mask') { ctx.fillStyle = '#000'; ctx.fillRect(x + 12, top + 12, sw - 24, sh - 24); }
  p.fill('wall', cartoon ? '#fffaf0' : '#e4dfd2');
  for (const mx of [x + sw * 0.36, x + sw * 0.7]) ctx.fillRect(mx - 4, top + 12, 8, sh - 24);
  // Awning: scalloped accent colour stripe over the shopfront.
  p.fill('accent', '#ffffff'); p.rr(x - 10, top - 44, sw + 20, 40, 6); ctx.fill(); line();
  p.shade(() => { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let sx = x; sx < x + sw; sx += 60) ctx.fillRect(sx, top - 40, 30, 32); });
}

/** A pane of glass: gradient in the colour pass, a hole in the tint mask. */
function glassRect(p: Painter, x: number, y: number, w: number, h: number, r = 6): void {
  const { ctx } = p;
  p.shade(() => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    if (p.cartoon) { g.addColorStop(0, p.glass[0]); g.addColorStop(1, p.glass[1]); } else { g.addColorStop(0, '#7e97a6'); g.addColorStop(1, '#27363f'); }
    ctx.fillStyle = g; p.rr(x, y, w, h, r); ctx.fill();
  });
  if (p.pass === 'mask') { ctx.fillStyle = '#000'; p.rr(x, y, w, h, r); ctx.fill(); }
}

/** Fascia sign: an accent-coloured board with pale blocks standing in for lettering. */
function fascia(p: Painter, x: number, y: number, w: number, h: number): void {
  const { ctx } = p;
  p.fill('accent', '#ffffff'); p.rr(x, y, w, h, p.cartoon ? 8 : 2); ctx.fill();
  if (p.cartoon) { p.stroke(OUTLINE, p.lineW); ctx.stroke(); }
  p.fill('ink', p.cartoon ? '#fffaf0' : '#e8e2d2');
  const letters = 7;
  for (let i = 0; i < letters; i++) ctx.fillRect(x + w * 0.16 + (i * w * 0.68) / letters, y + h * 0.3, (w * 0.68) / letters - 6, h * 0.4);
}

/** The other shopfronts: a café, a display window under a sign, a brown café. */
/** Quiet observed streets use real facade openings, not painted pavement props. */
function quietShopAt(p: Painter, w: number, groundY: number, kind: BayKind): void {
  const { ctx } = p;
  const x = 24, y = 78, width = w - 48, height = groundY - y - 12;
  p.fill('wall', '#ffffff'); ctx.fillRect(x, y, width, height);
  glassRect(p, x + 7, y + 7, width - 14, height - 14, 1);
  p.fill('wall', '#ffffff');
  for (const mx of [w * .34, w * .70]) ctx.fillRect(mx - 3, y + 7, 6, height - 14);
  ctx.fillRect(x + 7, y + 42, width - 14, 5);
  // A narrow plain fascia. Synthetic lettering and terrace objects do not describe architecture.
  p.fill('ink', kind === 'shopBar' ? '#43322f' : '#39423e'); ctx.fillRect(x, 35, width, 28);
  // Only mapped cafe/restaurant categories retain a small straight valance.
  if (kind === 'shopCafe' || kind === 'groundShop') {
    p.fill('accent', '#ffffff'); ctx.fillRect(x, 66, width, 10);
  }
}

function shopVariantAt(p: Painter, w: number, groundY: number, kind: BayKind): void {
  const { ctx } = p, cartoon = p.cartoon;
  const frame = cartoon ? '#fffaf0' : '#e4dfd2';
  const outline = () => { if (cartoon) { p.stroke(OUTLINE, p.lineW); ctx.lineJoin = 'round'; ctx.stroke(); } };
  if (kind === 'shopCafe') {
    // Café / restaurant: a sign, a scalloped awning over a wide window, a terrace of small
    // tables out front: the busiest ground floors in the city have to read as cafés at a glance.
    fascia(p, 24, 16, w - 48, 44);
    p.fill('wall', frame); p.rr(24, 100, w - 48, groundY - 108, cartoon ? 8 : 2); ctx.fill(); outline();
    glassRect(p, 36, 112, w - 72, groundY - 196, 6);
    p.fill('wall', frame); ctx.fillRect(w / 2 - 4, 112, 8, groundY - 196);
    p.fill('accent', '#ffffff'); ctx.fillRect(10, 66, w - 20, 34);
    ctx.beginPath(); for (let sx = 10; sx < w - 10; sx += 40) ctx.arc(sx + 20, 100, 20, 0, Math.PI); ctx.fill(); outline();
    p.shade(() => { ctx.fillStyle = 'rgba(255,255,255,0.65)'; for (let sx = 10; sx < w - 10; sx += 80) ctx.fillRect(sx, 66, 40, 34); });
    for (let cx = 60; cx < w - 40; cx += 110) {
      p.fill('ink', cartoon ? '#3a2a20' : '#2c2a28'); ctx.fillRect(cx - 3, groundY - 52, 6, 44);
      p.fill('accent', '#ffffff'); ctx.beginPath(); ctx.ellipse(cx, groundY - 54, 28, 8, 0, 0, Math.PI * 2); ctx.fill(); outline();
      p.fill('ink', cartoon ? '#3a2a20' : '#2c2a28'); for (const dx of [-38, 30]) { ctx.fillRect(cx + dx, groundY - 40, 8, 32); ctx.fillRect(cx + dx - 4, groundY - 42, 16, 6); }
    }
  } else if (kind === 'shopWindow') {
    fascia(p, 18, 24, w - 36, 62);
    p.fill('wall', frame); p.rr(24, 102, w - 48, groundY - 110, cartoon ? 8 : 2); ctx.fill(); outline();
    glassRect(p, 36, 114, w - 72, groundY - 134, 6);
    p.fill('wall', frame); for (const mx of [w * 0.34, w * 0.67]) ctx.fillRect(mx - 4, 114, 8, groundY - 134);
  } else if (kind === 'shopDeli') {
    // Food shop (bakery, cheese, deli, greengrocer): striped awning, a wide window, crates of produce out front.
    fascia(p, 24, 18, w - 48, 44);
    p.fill('wall', frame); p.rr(24, 104, w - 48, groundY - 112, cartoon ? 8 : 2); ctx.fill(); outline();
    glassRect(p, 36, 116, w - 72, groundY - 196, 6);
    p.fill('accent', '#ffffff'); ctx.beginPath(); ctx.moveTo(14, 70); ctx.lineTo(w - 14, 70); ctx.lineTo(w - 4, 110); ctx.lineTo(4, 110); ctx.closePath(); ctx.fill(); outline();
    p.shade(() => { ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let sx = 14; sx < w - 14; sx += 48) { ctx.beginPath(); ctx.moveTo(sx, 70); ctx.lineTo(sx + 24, 70); ctx.lineTo(sx + 28, 110); ctx.lineTo(sx + 4, 110); ctx.closePath(); ctx.fill(); } });
    const produce = ['#e85a3c', '#f2b92e', '#7cb342', '#ee7f2c', '#c0392b', '#9ccc65'];
    for (let i = 0, cx = 40; cx < w - 60; cx += 62, i++) {
      p.fill('ink', cartoon ? '#a0703f' : '#7a5a3a'); ctx.fillRect(cx, groundY - 70, 52, 54);
      p.shade(() => { ctx.fillStyle = produce[i % produce.length]; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(cx + 9 + (k % 3) * 17, groundY - 74 + Math.floor(k / 3) * 10, 8, 0, Math.PI * 2); ctx.fill(); } });
    }
  } else if (kind === 'shopFlorist') {
    // Florist: a green fascia, a deep window, buckets of flowers stepping up in front.
    fascia(p, 24, 22, w - 48, 52);
    p.fill('wall', frame); p.rr(24, 92, w - 48, groundY - 100, cartoon ? 8 : 2); ctx.fill(); outline();
    glassRect(p, 36, 104, w - 72, groundY - 124, 6);
    const blooms = ['#e84a7f', '#f2b92e', '#ffffff', '#c04fd0', '#ff7a45', '#e8573d'];
    for (let row = 0; row < 3; row++) for (let i = 0, cx = 30 + row * 14; cx < w - 40; cx += 44, i++) {
      const by = groundY - 14 - row * 34;
      p.fill('ink', cartoon ? '#3f6f5a' : '#33473d'); ctx.fillRect(cx, by - 26, 30, 26);
      p.shade(() => { ctx.fillStyle = cartoon ? '#4caf50' : '#3f7d3a'; ctx.beginPath(); ctx.arc(cx + 15, by - 30, 17, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = blooms[(i + row * 2) % blooms.length]; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + 6 + (k % 2) * 18, by - 38 + Math.floor(k / 2) * 10, 6, 0, Math.PI * 2); ctx.fill(); } });
    }
  } else if (kind === 'shopBike') {
    // Bike shop: wide display window with bikes standing in it, bikes parked out front.
    fascia(p, 18, 24, w - 36, 56);
    p.fill('wall', frame); p.rr(24, 96, w - 48, groundY - 104, cartoon ? 8 : 2); ctx.fill(); outline();
    glassRect(p, 36, 108, w - 72, groundY - 128, 6);
    const bike = (bx: number, by: number, s: number) => {
      ctx.beginPath(); ctx.arc(bx, by, 16 * s, 0, Math.PI * 2); ctx.arc(bx + 48 * s, by, 16 * s, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + 18 * s, by - 26 * s); ctx.lineTo(bx + 40 * s, by - 26 * s); ctx.lineTo(bx + 48 * s, by); ctx.moveTo(bx + 18 * s, by - 26 * s); ctx.lineTo(bx + 24 * s, by); ctx.lineTo(bx + 40 * s, by - 26 * s); ctx.stroke();
    };
    p.stroke(cartoon ? OUTLINE : '#1c1c1c', 5);
    for (let bx = 60; bx < w - 90; bx += 92) bike(bx, groundY - 70, 1);
    p.stroke(cartoon ? '#2a9d8f' : '#2f3a40', 6);
    for (let bx = 30; bx < w - 70; bx += 70) bike(bx, groundY - 18, 0.9);
  } else {
    // Brown café: dark wood below, small amber windows above, a hanging sign.
    p.fill('ink', cartoon ? '#5a3b2c' : '#3d2a20'); ctx.fillRect(16, 168, w - 32, groundY - 176);
    p.fill('ink', cartoon ? '#6d4a37' : '#4b3326'); for (let x = 30; x < w - 30; x += 70) ctx.fillRect(x, 182, 54, groundY - 200);
    for (const cx of [w * 0.28, w * 0.66]) {
      p.fill('wall', frame); p.rr(cx - 62, 84, 124, 78, cartoon ? 8 : 2); ctx.fill(); outline();
      glassRect(p, cx - 52, 94, 104, 58, 4);
      p.shade(() => { ctx.fillStyle = cartoon ? 'rgba(255,200,120,0.45)' : 'rgba(255,180,90,0.30)'; ctx.fillRect(cx - 52, 94, 104, 58); });
    }
    p.stroke(OUTLINE, 5); ctx.beginPath(); ctx.moveTo(w - 30, 58); ctx.lineTo(w - 96, 58); ctx.stroke();
    p.fill('accent', '#ffffff'); ctx.beginPath(); ctx.arc(w - 84, 92, 28, 0, Math.PI * 2); ctx.fill(); outline();
  }
}

function ribbon(p: Painter, w: number, y: number, h: number): void {
  const { ctx } = p, cartoon = p.cartoon;
  p.fill('ink', cartoon ? '#fffaf0' : '#cfd3d4'); ctx.fillRect(14, y - 8, w - 28, h + 16);
  if (cartoon) { p.stroke(OUTLINE, 6); ctx.strokeRect(14, y - 8, w - 28, h + 16); }
  p.shade(() => { const g = ctx.createLinearGradient(0, y, 0, y + h); if (cartoon) { g.addColorStop(0, '#a9e0f7'); g.addColorStop(1, '#5aa8d8'); } else { g.addColorStop(0, '#8fa6b4'); g.addColorStop(1, '#2d3d48'); }
    ctx.fillStyle = g; ctx.fillRect(24, y, w - 48, h); });
  if (p.pass === 'mask') { ctx.fillStyle = '#000'; ctx.fillRect(24, y, w - 48, h); }
  p.fill('ink', cartoon ? '#fffaf0' : '#cfd3d4');
  for (let mx = 24 + (w - 48) / 4; mx < w - 30; mx += (w - 48) / 4) ctx.fillRect(mx - 3, y, 6, h);
  // Spandrel panel under the band takes the accent colour.
  p.fill('accent', '#ffffff'); ctx.fillRect(14, y + h + 10, w - 28, 44);
}

/** Shared by the painter and 3D ornament placement. Fractions are quantized into bounded presets. */
export function bayWindowGeometry(v: Pick<BayVariant, 'windows' | 'proportions' | 'openingOccupancy' | 'openingHeight'>, y: number, h: number, look?: Look) {
  const width = v.openingOccupancy !== undefined ? BAY_PX * v.openingOccupancy / v.windows : (v.windows === 1 ? 150 : v.windows === 2 ? 112 : 82) * (v.proportions === 'wide' ? 1.35 : v.proportions === 'balanced' ? 1.12 : 1) * (look === 'cartoon' ? 1.12 : 1);
  const height = v.openingHeight !== undefined ? Math.min((y === 70 || y === 76 ? GROUND_PX : STOREY_PX) * v.openingHeight, h * 1.18) : h * (v.proportions === 'wide' ? 0.76 : v.proportions === 'balanced' ? 0.88 : 1);
  return { width, y: y + (h - height) / 2, height };
}
function layoutWindows(p: Painter, v: BayVariant, w: number, y: number, h: number): void {
  const geometry = bayWindowGeometry(v, y, h, p.look), ww = geometry.width;
  y = geometry.y; h = geometry.height;
  for (let i = 0; i < v.windows; i++) windowAt(p, ((i + 0.5) / v.windows) * w - ww / 2, y, ww, h, v);
}

/**
 * Bare wall bays: a gable, party wall or chamfer. Their layer carries wall only — no opening, no
 * shop and no accent band, at every archetype. Modern used to draw its ribbon window here, so a
 * modern gable face read as a window band (user report 2026-10-04). `draw` branches on this first,
 * and `check-three-buildings` pins it.
 */
export const isBareBay = (kind: BayKind): boolean => kind === 'plain';

function draw(p: Painter, v: BayVariant, w: number, h: number, brick: CanvasImageSource): void {
  const { ctx } = p;
  wall(p, w, h, brick, v.archetype, v.wallMaterial);
  const isShop = (SHOP_KINDS as readonly string[]).includes(v.kind);
  const ground = v.kind === 'groundDoor' || isShop || v.kind === 'ground';
  if (isBareBay(v.kind)) {
    // wall only
  } else if (v.family === 'ribbon' || v.family === 'curtain') {
    if (!ground) ribbon(p, w, v.family === 'curtain' ? 8 : v.kind === 'attic' ? 120 : 70, v.family === 'curtain' ? h - 24 : v.kind === 'attic' ? 90 : 140);
    else if (isShop) { paintedGround(p, w, h); if (v.trimDensity === 'restrained') quietShopAt(p, w, h, v.kind); else if (v.kind === 'groundShop') shopAt(p, w, h); else shopVariantAt(p, w, h, v.kind); }
    else { windowAt(p, w * 0.2, 80, 140, 140, { ...v, shape: 'rect', archetype: 'modern' }); if (v.kind === 'groundDoor') doorAt(p, w * 0.62, h - 24, v); }
  } else if (ground) {
    if (isShop) { paintedGround(p, w, h); if (v.trimDensity === 'restrained') quietShopAt(p, w, h, v.kind); else if (v.kind === 'groundShop') shopAt(p, w, h); else shopVariantAt(p, w, h, v.kind); }
    else if (v.kind === 'groundDoor') {
      if (v.trimDensity === 'restrained') quietDoorAt(p, v, h - 24); else doorAt(p, w * .14, h - 24, v);
      const g = bayDoorWindowGeometry(v, p.look);
      windowAt(p, w * g.axis - g.width / 2, g.y, g.width, g.height, v);
    }
    else layoutWindows(p, v, w, 70, 150);
    if (v.archetype === 'school') { p.fill('ink', p.cartoon ? '#fff1cf' : '#c9c1ae'); ctx.fillRect(0, h - 70, w, 8); }
    if (v.archetype === 'c19') { p.fill('ink', p.stone); ctx.fillRect(0, 0, w, 12); }
  } else {
    const [y, wh] = v.kind === 'upperTall' ? [26, 250] : v.kind === 'attic' ? [96, 118] : [62, 188];
    if (v.archetype === 'school' && !v.proportions) {
      // Paired tall windows under a pale stone band at the floor line.
      p.fill('ink', p.cartoon ? '#fff1cf' : '#c9c1ae'); ctx.fillRect(0, 0, w, 16); ctx.fillRect(0, h - 10, w, 10);
      for (const cx of [0.3, 0.7]) { windowAt(p, w * cx - 38, y + 6, 76, wh - 8, { ...v, shape: 'rect', shutters: false }); }
    } else layoutWindows(p, v, w, y, wh);
    if (v.archetype === 'c19') {
      // White stucco string course at the floor line and a sill band: the 19th-century street's horizontal lines.
      p.fill('ink', p.stone); ctx.fillRect(0, h - (v.trimDensity === 'restrained' ? 4 : 12), w, v.trimDensity === 'restrained' ? 4 : 12); if (v.trimDensity !== 'restrained') ctx.fillRect(0, y + wh + 4, w, 7);
      if (p.cartoon) { p.stroke(OUTLINE, p.lineW * 0.5); ctx.strokeRect(0, h - 12, w, 12); }
    } else if (v.archetype === 'canal' && v.kind !== 'attic') {
      // A pale cornice line under each canal-house floor, the white trim the streets show.
      p.fill('ink', p.stone); ctx.fillRect(0, h - 7, w, 7);
    }
    if (v.kind === 'upperTall' && v.archetype === 'canal') {
      // French-window balustrade across the bay.
      p.fill('ink', p.cartoon ? '#fffaf0' : '#2b2b2b'); ctx.fillRect(w * 0.1, y + wh - 40, w * 0.8, 6);
      for (let bx = w * 0.1; bx < w * 0.9; bx += 18) ctx.fillRect(bx, y + wh - 40, 4, 38);
    }
  }
  // A dark plinth under a house's ground floor; a shop's paint runs to the pavement instead.
  if (ground && !isShop) { p.shade(() => { ctx.fillStyle = p.cartoon ? 'rgba(40,24,24,0.30)' : 'rgba(40,36,34,0.78)'; ctx.fillRect(0, h - 24, w, 24); }); }
}

/** One tileable bay in colour plus its tint mask, drawn once per variant and cached. */
export function bayTextures(v: BayVariant, brick: CanvasImageSource, look: Look): { colour: HTMLCanvasElement; mask: HTMLCanvasElement } {
  const key = variantKey(v, look), hit = cache.get(key);
  if (hit) return hit;
  const w = BAY_PX, h = v.kind === 'upper' || v.kind === 'upperTall' || v.kind === 'attic' || v.kind === 'plain' ? STOREY_PX : GROUND_PX;
  const make = (pass: Pass) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(new Painter(canvas.getContext('2d')!, pass, look), v, w, h, brick);
    return canvas;
  };
  const out = { colour: make('colour'), mask: make('mask') };
  cache.set(key, out);
  return out;
}
