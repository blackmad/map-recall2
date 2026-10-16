/**
 * Structure of a pand's front read off the rectified strip, normalised to the pand itself (buurt generator, 2026-10-16).
 *
 * The auto-placement (blockFace/autoPlace.ts) told its types apart by absolute colour classes (stripPalette.ts
 * `classifyPixel`): the upper light-accent share of a white bay stack read 0.37-0.56 on one strip, but an overexposed
 * strip of plain green-tile fronts read the same (Van Effenstraat 1-9: 0.48), and a dark overcast strip read 0 for
 * everything. Balcony fronts had no reading at all, so the green-tile and two-axis types took them (Jan Hanzenstraat
 * 49-51, Ten Katestraat 29-31, Bellamystraat 18-20).
 *
 * This module reads the upper body (4.6 m .. eaves - 0.6 m) of one span relative to its own wall:
 *   - the WALL is the median Lab of the pixels between the 30th and 80th lightness percentile; a pixel is wall when its
 *     lightness is within 20 % of the span's lightness spread (p3..p97) and its chroma within 14 % (min 5) of it. Every
 *     threshold below scales with that spread, so the reading is the same on a dark 2022 strip and a washed-out 2024 one;
 *   - a BAY is a run of columns that are almost never wall (wall share < 0.3 over the upper body) and mostly light
 *     (>= 0.4 of the column lighter than the wall by 45 % of the way to p97): the painted timber oriels of Hasebroekstraat
 *     53-67 and 56-70 read 2.0-2.3 m, plain window columns of the green-tile and two-axis fronts at most 1.2 m (their
 *     spandrels are brick);
 *   - an OPEN AXIS is a run of columns >= 0.6 m wide whose longest wall run between 5.0 m and eaves - 1.0 m is under
 *     0.45 m: no brick spandrel between the storeys, which is a door to a balcony (or a bay). Dark open axes (light share
 *     < 0.5) are balcony doors with their railings and slabs (Jan Hanzenstraat 49-51: 0.16, Bellamystraat 20: 0.43);
 *     light ones are the white bays (0.58-0.68) when the pand has a bay of 1.5 m or more, else a white balcony door
 *     (Bellamystraat 18: 0.5);
 *   - a SLAB is a not-wall block at least 0.2 m deep, darker than the wall, sitting directly on wall, >= 0.8 m wide: the
 *     shadowed underside and brackets of a balcony. Two or more slabs >= 1.25 m wide on different storeys, stacked
 *     (centres within 0.6 m), are a balcony stack (Ten Katestraat 29-31 on the dark 2023 strip: 1.3-1.6 m at two
 *     storeys; plain window bottoms read <= 1.2 m).
 * `balconies` is true on either such an open axis or a slab stack.
 *
 * Pure: no I/O.
 */
import {rgbToLab} from '../buildingRecipe/measureFacade.ts';

export interface StripStructureInput {
  rgb: Uint8Array; width: number; height: number;
  /** Pixel columns of the pand span (inclusive start, exclusive end). */
  x0: number; x1: number;
  pixelsPerMetre: number;
  /** The eaves (m over the strip's ground line); the body is read from 4.6 m to eaves - 0.6 m. */
  eavesM: number;
}

export interface StripStructure {
  /** Lab of the wall reference and the span's lightness spread (p3..p97). */
  wallLab: [number, number, number]; spread: number;
  /** Widest light not-wall column run (m), 0 when none. */
  bayWidthM: number;
  /** Centre of that bay (0..1 of the span, left to right), null when none. */
  bayCentre: number | null;
  /** Column runs without a brick spandrel: width (m), centre (0..1 of the span), light share. */
  openAxes: {widthM: number; centre: number; light: number}[];
  /** Dark slabs sitting on the wall: height over the ground (m), width (m), centre (0..1). */
  slabs: {atM: number; widthM: number; centre: number}[];
  balconies: boolean;
  /** Why `balconies` reads as it does. */
  balconyWhy: string;
}

export const STRIP_STRUCTURE = {
  bodyFromM: 4.6, topInsetM: 0.6,
  wallTolL: 0.2, wallTolC: 0.14, minWallTolC: 5,
  bayMaxWall: 0.3, bayMinLight: 0.4, bayMinWidthM: 0.3,
  openMaxWallRunM: 0.45, openMinWidthM: 0.6, openDarkLight: 0.5, openBayMinM: 1.5,
  slabMinDepthM: 0.2, slabMinWidthM: 0.8, stackMinWidthM: 1.25, stackMaxOffset: 0.6,
} as const;

const r2 = (v: number) => +v.toFixed(2);

/** Read the structure of one span. Null when the body is too small to read (under 1 m wide or 1 m tall). */
export function measureStripStructure(input: StripStructureInput): StripStructure | null {
  const S = STRIP_STRUCTURE, {rgb, width: W, height: H, pixelsPerMetre: ppm} = input;
  const inset = Math.round((input.x1 - input.x0) * 0.04);
  const x0 = Math.max(0, input.x0 + inset), x1 = Math.min(W, input.x1 - inset);
  const yTop = Math.max(0, Math.round(H - (input.eavesM - S.topInsetM) * ppm)), yBot = Math.min(H, Math.round(H - S.bodyFromM * ppm));
  const w = x1 - x0, h = yBot - yTop;
  if (w < ppm || h < ppm) return null;
  // Lab after a 3x3 box blur (brick speckle and JPEG noise); the strip's grey placeholder is not evidence.
  const L = new Float32Array(w * h), A = new Float32Array(w * h), B = new Float32Array(w * h), ok = new Uint8Array(w * h);
  const grey = (i: number) => Math.abs(rgb[i] - 128) <= 2 && Math.abs(rgb[i + 1] - 128) <= 2 && Math.abs(rgb[i + 2] - 128) <= 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sy = y + yTop, sx = x + x0, k = y * w + x;
    if (grey((sy * W + sx) * 3)) continue;
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = sy + dy, xx = sx + dx; if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
      const i = (yy * W + xx) * 3; if (grey(i)) continue; r += rgb[i]; g += rgb[i + 1]; b += rgb[i + 2]; n++;
    }
    const lab = rgbToLab([r / n, g / n, b / n]); L[k] = lab[0]; A[k] = lab[1]; B[k] = lab[2]; ok[k] = 1;
  }
  // Pure sky white (over a lower neighbour or a crown gap) is no part of the wall statistics.
  const idx: number[] = [];
  for (let k = 0; k < w * h; k++) if (ok[k] && !(L[k] > 93 && Math.hypot(A[k], B[k]) < 6)) idx.push(k);
  if (idx.length < ppm * ppm) return null;
  const Ls = idx.map(k => L[k]).sort((a, b) => a - b), q = (t: number) => Ls[Math.floor(t * (Ls.length - 1))];
  const p97 = q(0.97), spread = Math.max(15, p97 - q(0.03)), lo = q(0.3), hi = q(0.8);
  const mid = idx.filter(k => L[k] >= lo && L[k] <= hi);
  const med = (v: number[]) => v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const ref: [number, number, number] = [med(mid.map(k => L[k])), med(mid.map(k => A[k])), med(mid.map(k => B[k]))];
  const tolL = S.wallTolL * spread, tolC = Math.max(S.minWallTolC, S.wallTolC * spread);
  const wall = new Uint8Array(w * h);
  for (let k = 0; k < w * h; k++) wall[k] = ok[k] && Math.abs(L[k] - ref[0]) < tolL && Math.hypot(A[k] - ref[1], B[k] - ref[2]) < tolC ? 1 : 0;
  const lightT = Math.max(ref[0] + 0.45 * (p97 - ref[0]), ref[0] + 0.15 * spread);

  const colWall: number[] = [], colLight: number[] = [];
  for (let x = 0; x < w; x++) {
    let n = 0, wl = 0, li = 0;
    for (let y = 0; y < h; y++) { const k = y * w + x; if (!ok[k]) continue; n++; if (wall[k]) wl++; if (L[k] > lightT) li++; }
    colWall.push(n > h * 0.5 ? wl / n : NaN); colLight.push(n > h * 0.5 ? li / n : NaN);
  }
  const smooth = (v: number[], r: number) => v.map((_, i) => { const s = v.slice(Math.max(0, i - r), i + r + 1).filter(x => !isNaN(x)); return s.length ? s.reduce((a, b) => a + b) / s.length : NaN; });
  const runs = (v: number[], pass: (x: number) => boolean) => {
    const out: {a: number; b: number}[] = []; let a = -1;
    for (let x = 0; x <= v.length; x++) { const p = x < v.length && pass(v[x]); if (p && a < 0) a = x; if (!p && a >= 0) { out.push({a, b: x}); a = -1; } }
    return out;
  };
  const mean = (v: number[], a: number, b: number) => { const s = v.slice(a, b).filter(x => !isNaN(x)); return s.length ? s.reduce((p, c) => p + c, 0) / s.length : 0; };
  const cw = smooth(colWall, 4), cl = smooth(colLight, 4);
  const bays = runs(cw, x => x < S.bayMaxWall).filter(r => r.b - r.a >= S.bayMinWidthM * ppm && mean(cl, r.a, r.b) >= S.bayMinLight);
  const widest = bays.reduce<{a: number; b: number} | null>((m, r) => !m || r.b - r.a > m.b - m.a ? r : m, null);
  const bayWidthM = widest ? r2((widest.b - widest.a) / ppm) : 0, bayCentre = widest ? r2((widest.a + widest.b) / 2 / w) : null;

  // Open axes: the longest wall run per column (gaps of up to 3 px bridged) between 5.0 m and eaves - 1.0 m.
  const yA = Math.max(0, h - Math.round((input.eavesM - 1.0 - S.bodyFromM) * ppm)), yB = h - Math.round(0.4 * ppm);
  const maxRun: number[] = [];
  for (let x = 0; x < w; x++) {
    let best = 0, cur = 0, gap = 0;
    for (let y = yA; y < yB; y++) { const k = y * w + x; if (wall[k]) { cur += 1 + gap; gap = 0; } else if (cur > 0 && gap < 3) gap++; else { cur = 0; gap = 0; } best = Math.max(best, cur); }
    maxRun.push(best / ppm);
  }
  const openAxes = runs(smooth(maxRun, 2), x => x < S.openMaxWallRunM).filter(r => r.b - r.a >= S.openMinWidthM * ppm)
    .map(r => ({widthM: r2((r.b - r.a) / ppm), centre: r2((r.a + r.b) / 2 / w), light: r2(mean(cl, r.a, r.b))}));

  // Slabs: a dark not-wall block >= 0.2 m deep directly on two rows of wall.
  const darkT = ref[0] - 0.08 * spread, depth = Math.round(S.slabMinDepthM * ppm), tolY = 3;
  const byRow = new Map<number, Set<number>>();
  for (let x = 0; x < w; x++) for (let y = depth; y < h - 2; y++) {
    const k = y * w + x;
    if (!(ok[k] && !wall[k] && ok[k + w] && wall[k + w] && wall[k + 2 * w])) continue;
    let d = 0;
    for (let yy = y; yy >= 0 && d < depth; yy--) { const kk = yy * w + x; if (ok[kk] && !wall[kk] && L[kk] < darkT) d++; else break; }
    if (d < depth) continue;
    const key = Math.round(y / tolY);
    for (const kk of [key - 1, key, key + 1]) { if (!byRow.has(kk)) byRow.set(kk, new Set()); byRow.get(kk)!.add(x); }
  }
  const raw: {y: number; a: number; b: number}[] = [];
  for (const [key, xs] of byRow) {
    const s = [...xs].sort((a, b) => a - b); let a = s[0], prev = s[0];
    for (const x of [...s.slice(1), Infinity]) { if (x - prev > 3) { if (prev - a + 1 >= S.slabMinWidthM * ppm) raw.push({y: key * tolY, a, b: prev + 1}); a = x; } prev = x; }
  }
  raw.sort((p, q2) => p.y - q2.y);
  const merged: {y: number; a: number; b: number}[] = [];
  for (const s of raw) { const m = merged.at(-1); if (m && s.y - m.y < 0.3 * ppm) { if (s.b - s.a > m.b - m.a) { m.a = s.a; m.b = s.b; } } else merged.push({...s}); }
  const slabs = merged.map(m => ({atM: r2((h - m.y) / ppm + S.bodyFromM), widthM: r2((m.b - m.a) / ppm), centre: r2((m.a + m.b) / 2 / w)}));

  // Balconies: a dark open axis, or a stack of wide slabs on two storeys (>= 2 m apart) below the cornice zone.
  // A light open axis is the white bay itself when the pand has one; without a bay it is a balcony door (Bellamystraat 18:
  // a white door behind the railing, light 0.5).
  const darkAxis = openAxes.find(o => o.light < S.openDarkLight || bayWidthM < S.openBayMinM);
  const wide = slabs.filter(s => s.widthM >= S.stackMinWidthM && s.atM >= 5.0 && s.atM <= input.eavesM - 1.5);
  const stack = wide.find(s => wide.some(t => t !== s && Math.abs(t.atM - s.atM) >= 2 && Math.abs(t.centre - s.centre) * w / ppm <= S.stackMaxOffset));
  const balconies = !!darkAxis || !!stack;
  const balconyWhy = darkAxis ? `${darkAxis.light < S.openDarkLight ? 'dark' : 'bay-less'} open axis ${darkAxis.widthM} m at ${darkAxis.centre} (light ${darkAxis.light}): no brick spandrel between the storeys`
    : stack ? `balcony slabs stacked at ${wide.map(s => `${s.atM} m (${s.widthM} m wide)`).join(', ')}`
    : `no dark open axis${openAxes.length ? ` (light ones: ${openAxes.map(o => `${o.widthM} m @ ${o.light}`).join(', ')})` : ''}, ${wide.length} wide slab(s)`;
  return {wallLab: ref.map(r2) as [number, number, number], spread: r2(spread), bayWidthM, bayCentre, openAxes, slabs, balconies, balconyWhy};
}
