/**
 * Palette medians of one pand from the rectified facade strip (Kinkerstraat type library, 2026-10-14).
 *
 * Library palettes were guessed by eye; this measures them. Pixels of the pand's span are classified per band of the
 * front (heights above the strip's ground line), never by coordinates in the intent:
 *   - body (top of the shop storey .. 1 m under the eaves): `glass` (dark, or blue-dominant: windows, sky reflections),
 *     `accent` (light and low-saturated: white/cream paint, sandstone, frames) and `wall` (the rest);
 *   - accent rows: body rows in which accent pixels cover >= `bandRowShare` of the PIER columns (columns that are mostly
 *     wall: a painted course crosses the piers, frames and white curtains do not) are horizontal BANDS (painted
 *     sill/impost courses); the other accent pixels are frames, surrounds and curtains (`frame` is therefore an upper bound
 *     on lightness). Band rows are reported as heights (m),
 *     grouped into runs, so a sill band at 0.9 m over each floor shows up as one run per storey;
 *   - cornice (eaves - 1.2 .. eaves + 0.2 m): its light pixels (a cream stucco cornice) or its median;
 *   - fascia (ground storey top: `fasciaBandM`): median of the band.
 * A body whose accent share passes `stuccoShare` is a painted/stucco wall: its wall colour is the accent median.
 */
import {rgbToHsl, toHex, type Rgb} from './wallColour.ts';

export interface StripPaletteInput {
  /** Raw RGB (3 channels) of the strip, `width` x `height`. */
  rgb: Uint8Array; width: number; height: number;
  /** Pixel columns of the pand span (inclusive start, exclusive end). */
  x0: number; x1: number;
  pixelsPerMetre: number;
  eavesM: number;
  /** Body band bottom (top of the ground storey, default 4.4 m). */
  bodyFromM?: number;
  /** Ground-storey top band holding the fascia (default 3.4..4.3 m). */
  fasciaBandM?: [number, number];
  bandRowShare?: number;
  stuccoShare?: number;
}

export interface StripPalette {
  wall: string | null; accent: string | null; frame: string | null; band: string | null; cornice: string | null; fascia: string | null;
  /** Share of body pixels per class. */
  shares: {wall: number; accent: number; glass: number};
  /** Painted/stucco wall (accent share over the threshold). */
  stucco: boolean;
  /** Runs of band rows, heights above the ground line (m), bottom..top. */
  bandRunsM: [number, number][];
  /** Wall HSL (hue deg, sat, light) for clustering. */
  wallHsl: Rgb | null;
  pixels: number;
}

const median = (v: number[]) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const medRgb = (px: Rgb[]): Rgb | null => px.length < 20 ? null : [0, 1, 2].map(c => median(px.map(p => p[c]))) as Rgb;
const hex = (c: Rgb | null) => c ? toHex(c) : null;

export type PixelClass = 'glass' | 'accent' | 'wall' | 'void';
/** Classify one strip pixel. `void` = the strip's grey placeholder or pure sky white. */
export function classifyPixel(p: Rgb): PixelClass {
  const [h, s, l] = rgbToHsl(p);
  void h;
  if (Math.abs(p[0] - 128) <= 2 && Math.abs(p[1] - 128) <= 2 && Math.abs(p[2] - 128) <= 2) return 'void';
  if (l > 0.97) return 'void';
  if (l < 0.16 || p[2] > p[0] + 8) return 'glass';
  if (l > 0.6 && s < 0.32) return 'accent';
  return 'wall';
}

export function measureStripPalette(input: StripPaletteInput): StripPalette {
  const {rgb, width, height, pixelsPerMetre: ppm, eavesM} = input;
  const x0 = Math.max(0, Math.round(input.x0)), x1 = Math.min(width, Math.round(input.x1));
  const rowOf = (m: number) => Math.max(0, Math.min(height, Math.round(height - m * ppm)));
  const px = (x: number, y: number): Rgb => { const i = (y * width + x) * 3; return [rgb[i], rgb[i + 1], rgb[i + 2]]; };
  // Keep 6 % off each side: party-wall downpipes and the neighbour's bleed.
  const inset = Math.round((x1 - x0) * 0.06), xa = x0 + inset, xb = x1 - inset;
  const bodyTop = rowOf(eavesM - 1), bodyBottom = rowOf(input.bodyFromM ?? 4.4);
  const wall: Rgb[] = [], accentBand: Rgb[] = [], accentOther: Rgb[] = [];
  const bandRows: number[] = [];
  let nGlass = 0, n = 0;
  const share = input.bandRowShare ?? 0.5;
  // Pass 1: classes, and per column the wall share. Piers (the brick between window axes) are the columns that are
  // mostly wall; a painted band crosses them, window frames and curtains do not.
  const cols = xb - xa, rows = Math.max(0, bodyBottom - bodyTop), cls = new Uint8Array(cols * rows), CODE = {void: 0, glass: 1, accent: 2, wall: 3} as const;
  const colWall = new Float64Array(cols), colN = new Float64Array(cols);
  for (let y = bodyTop; y < bodyBottom; y++) for (let x = xa; x < xb; x++) {
    const c = classifyPixel(px(x, y)); cls[(y - bodyTop) * cols + (x - xa)] = CODE[c];
    if (c !== 'void') { colN[x - xa]++; if (c === 'wall') colWall[x - xa]++; }
  }
  const pier = Array.from({length: cols}, (_, i) => colN[i] > rows * 0.5 && colWall[i] / colN[i] >= 0.6);
  for (let y = bodyTop; y < bodyBottom; y++) {
    const row: Rgb[] = []; let pierN = 0, pierAccent = 0;
    for (let x = xa; x < xb; x++) {
      const c = cls[(y - bodyTop) * cols + (x - xa)];
      if (c === 0) continue;
      n++;
      if (pier[x - xa]) { pierN++; if (c === 2) pierAccent++; }
      if (c === 1) nGlass++;
      else if (c === 3) wall.push(px(x, y));
      else row.push(px(x, y));
    }
    if (pierN >= 4 && pierAccent / pierN >= share) { accentBand.push(...row); bandRows.push(y); } else accentOther.push(...row);
  }
  const nAccent = accentBand.length + accentOther.length;
  const shares = {wall: n ? +(wall.length / n).toFixed(3) : 0, accent: n ? +(nAccent / n).toFixed(3) : 0, glass: n ? +(nGlass / n).toFixed(3) : 0};
  const stucco = shares.accent >= (input.stuccoShare ?? 0.45);
  const accentAll = medRgb([...accentBand, ...accentOther]);
  const wallC = stucco ? accentAll : medRgb(wall);
  // Band runs: consecutive band rows (gaps <= 2 px) as heights.
  const runs: [number, number][] = [];
  for (const y of bandRows) {
    const last = runs.at(-1);
    if (last && y - last[1] <= 2) last[1] = y; else runs.push([y, y]);
  }
  const bandRunsM = runs.filter(([a, b]) => b - a >= 1).map(([a, b]) => [+((height - b) / ppm).toFixed(2), +((height - a) / ppm).toFixed(2)] as [number, number]).sort((p, q) => p[0] - q[0]);
  // Cornice: its light pixels when it is painted light, else its median.
  const cTop = rowOf(eavesM + 0.2), cBottom = rowOf(eavesM - 1.2), cLight: Rgb[] = [], cAll: Rgb[] = [];
  for (let y = cTop; y < cBottom; y++) for (let x = xa; x < xb; x++) { const p = px(x, y), c = classifyPixel(p); if (c === 'void') continue; cAll.push(p); if (c === 'accent') cLight.push(p); }
  const cornice = cLight.length > cAll.length * 0.35 ? medRgb(cLight) : medRgb(cAll);
  const [f0, f1] = input.fasciaBandM ?? [3.4, 4.3], fascia: Rgb[] = [];
  for (let y = rowOf(f1); y < rowOf(f0); y++) for (let x = xa; x < xb; x++) { const p = px(x, y); if (classifyPixel(p) !== 'void') fascia.push(p); }
  return {wall: hex(wallC), accent: hex(accentAll), frame: hex(medRgb(accentOther)), band: hex(medRgb(accentBand)), cornice: hex(cornice), fascia: hex(medRgb(fascia)),
    shares, stucco, bandRunsM, wallHsl: wallC ? rgbToHsl(wallC).map((v, i) => +(i ? v.toFixed(3) : v.toFixed(1))) as Rgb : null, pixels: n};
}
