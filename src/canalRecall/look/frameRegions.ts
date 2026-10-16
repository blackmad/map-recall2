// Frame regions for look measurements (pure): which pixels of a live-play frame are facade walls, roofs, paved
// ground, water, parks or sky, from the ID pass of scripts/look/region-mask.js, and their median luma and chroma.
//
// Mask encoding: buildings draw their flat world normal (z-up) as rgb = n * 0.5 + 0.5, the own ground pure red,
// trees pure green, other three.js objects yellow, the sky and the basemap black. A pixel counts only when its
// four neighbours have the same class (antialiased edges blend two classes). The ground is split by the clean
// frame's own colour: water is green-blue over red, parks green, the rest paved.

export type Region = 'wall' | 'roof' | 'road' | 'cycle' | 'pavement' | 'water' | 'park' | 'sky' | 'tree' | 'other';
export const REGIONS: readonly Region[] = ['wall', 'roof', 'road', 'cycle', 'pavement', 'water', 'park', 'sky', 'tree', 'other'];
/** Road, cycle track and pavement together. */
export type Layer = Region | 'paved' | 'frame';

/** Class of one mask pixel, or null when it is a blend of classes. */
export function maskClass(r: number, g: number, b: number): 'building-wall' | 'building-roof' | 'ground' | 'tree' | 'other' | 'sky' | null {
  if (r < 12 && g < 12 && b < 12) return 'sky';
  if (r > 240 && g < 15 && b < 15) return 'ground';
  if (r < 15 && g > 240 && b < 15) return 'tree';
  if (r > 240 && g > 240 && b < 15) return 'other';
  // a unit normal: |n| = 1 within the 8-bit encoding
  const n = [r, g, b].map(v => v / 127.5 - 1), len = Math.hypot(n[0], n[1], n[2]);
  if (Math.abs(len - 1) > 0.08) return null;
  if (Math.abs(n[2]) < 0.3) return 'building-wall';
  if (n[2] > 0.6) return 'building-roof';
  return null;
}

/** Ground pixel by its rendered colour: neutral grey is road, red is a cycle track, the rest of the paved ground pavement. */
export function groundKind(r: number, g: number, b: number): 'road' | 'cycle' | 'pavement' | 'water' | 'park' {
  // grass is saturated green (chroma ~60); the bright look's grey-green canal (104,122,114) is not
  if (g > r + 20 && g > b + 20) return 'park';
  if (g > r + 3 && b > r) return 'water';
  if (r >= g + 40 && r >= b + 40) return 'cycle';
  if (Math.max(r, g, b) - Math.min(r, g, b) <= 10) return 'road';
  return 'pavement';
}

/** Region index per pixel (index into REGIONS, 255 = none). `mask` and `clean` are packed RGB. */
export function regionOfMask(mask: Uint8Array | Buffer, clean: Uint8Array | Buffer, width: number, height: number): Uint8Array {
  const cls: (string | null)[] = new Array(width * height);
  for (let i = 0; i < width * height; i++) cls[i] = maskClass(mask[i * 3], mask[i * 3 + 1], mask[i * 3 + 2]);
  const out = new Uint8Array(width * height).fill(255);
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const i = y * width + x, c = cls[i];
    if (!c || cls[i - 1] !== c || cls[i + 1] !== c || cls[i - width] !== c || cls[i + width] !== c) continue;
    const region: Region = c === 'building-wall' ? 'wall' : c === 'building-roof' ? 'roof' : c === 'sky' ? 'sky' : c === 'tree' ? 'tree' : c === 'other' ? 'other'
      : groundKind(clean[i * 3], clean[i * 3 + 1], clean[i * 3 + 2]);
    out[i] = REGIONS.indexOf(region);
  }
  return out;
}

export interface RegionStats { n: number; share: number; luma: number; chroma: number; median: [number, number, number] }

const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((p, q) => p - q); return s[s.length >> 1]; };
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function stats(clean: Uint8Array | Buffer, idx: number[], total: number): RegionStats | null {
  if (idx.length < 200) return null;
  const L: number[] = [], C: number[] = [], R: number[] = [], G: number[] = [], B: number[] = [];
  for (const i of idx) {
    const r = clean[i * 3], g = clean[i * 3 + 1], b = clean[i * 3 + 2];
    L.push(luma(r, g, b)); C.push(Math.max(r, g, b) - Math.min(r, g, b)); R.push(r); G.push(g); B.push(b);
  }
  return { n: idx.length, share: +(idx.length / total).toFixed(3), luma: Math.round(median(L)), chroma: Math.round(median(C)), median: [median(R), median(G), median(B)] };
}

/** Median luma, chroma and colour of each region, and of the whole frame. */
export function regionStats(clean: Uint8Array | Buffer, regions: Uint8Array): Record<Layer, RegionStats | null> {
  const by: number[][] = REGIONS.map(() => []), all: number[] = [], paved: number[] = [];
  const pavedSet = new Set(['road', 'cycle', 'pavement'].map(r => REGIONS.indexOf(r as Region)));
  for (let i = 0; i < regions.length; i++) { all.push(i); if (regions[i] !== 255) { by[regions[i]].push(i); if (pavedSet.has(regions[i])) paved.push(i); } }
  const out = { frame: stats(clean, all, regions.length), paved: stats(clean, paved, regions.length) } as Record<Layer, RegionStats | null>;
  REGIONS.forEach((r, k) => { out[r] = stats(clean, by[k], regions.length); });
  return out;
}
