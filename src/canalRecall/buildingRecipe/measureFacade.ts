/**
 * Measure a facade from a rectified street-panorama crop: wall and glazing colour, the window grid and the kind of
 * front, so a `kind: large` wall group is fitted to the photo instead of guessed.
 *
 * Input is metric: the crop (`scripts/pand-reference/all-walls.ts`) is rectified at `ppm` pixels per metre, x along
 * the wall from the viewer's left, row 0 at `topM` metres above the wall's ground. The caller gives the box of one
 * wall panel (`cropToPanel.ts`) and the storey lines of its fit, and gets, on a 10 cm cell grid:
 *
 * - **colours**: the cells are clustered in CIELAB (k = 3, lightness at half weight so a shaded wall stays one wall);
 *   the wall is the cluster holding most of the upper storeys, preferring a warm (brick) cluster over a neutral one,
 *   never the darkest unless it is warm and dominant. Every cell further than an Otsu threshold (clamped 9..25) from the
 *   wall centre is *not wall*: darker = glazing (`dark`), lighter = frames, curtains, ledges (`trim`). Colours are
 *   medians. Exposure: the light trim (p95 of the upper cells' lightness) is taken as a near-white reference and
 *   scaled to 215/255, gain clamped 0.75..1.6, with a white balance from the same cells clamped to +-8 %; raw and
 *   normalised colours are both reported (`normalisation`).
 * - **grid**: the column profile of not-wall cells (plus half its vertical-edge energy) over the upper storeys is
 *   autocorrelated for the bay pitch (0.8..8 m; the shortest lag within 85 % of the best, so harmonics lose); the
 *   storey height the same way on the rows (2.4..6.5 m). Folding the mask at the pitch and over the fit's storeys gives
 *   window width (fraction of the bay), height and sill (fractions of the storey).
 * - **class**: curtain wall (glazing >= 0.68), ribbon (windows span >= 85 % of the bay, or no column contrast), glazed
 *   columns (windows >= 92 % of the storey: glass runs through the floor lines), else a punched grid. Shape class from
 *   the window aspect (height / width): tall > 1.4, wide < 0.7, else square.
 *
 * Cells that are not usable (missing panorama pixels, leaf green) are left out of everything; the ground band
 * (0..`groundBandM`) is measured on its own and never pooled with the upper storeys. Pure: no I/O.
 */
export type Rgb = [number, number, number];

export interface FacadeImage {
  width: number; height: number;
  /** RGB bytes, row 0 at the top */
  rgb: Uint8Array;
  /** optional validity per pixel (255 = sampled, 0 = missing) */
  valid?: Uint8Array;
  ppm: number;
  /** height above the wall's ground (m) of row 0's top edge */
  topM: number;
}
/** Metres along the image x (u) and above the ground (v). */
export interface FacadeBox { u0: number; u1: number; v0: number; v1: number }
export interface MeasureInput {
  image: FacadeImage; box: FacadeBox;
  /** storey lines (m above ground) of the fitted wall group: [0, ground top, ..., top] */
  lines: number[];
  groundBandM?: number; cell?: number;
  /** cells whose centre is outside the wall (box metres u, v) are not facade (the 3DBAG panel's outline: sky over a lower part) */
  inside?: (u: number, v: number) => boolean;
}

/**
 * Leaf green, also in shade: green the strongest channel, or yellow-green (G within 6 of R, both well over B), with
 * some saturation. Walls are practically never green; a dark green painted door is a false positive we accept.
 */
export function isLeaf(r: number, g: number, b: number): boolean {
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
  if (hi - lo < 12 || hi < 25) return false;
  return (g >= r && g > b + 8) || (g > r - 6 && g > b + 22 && r > b + 16);
}
export const CELL_M = 0.1;
export const GROUND_BAND_M = 2.5;
/** Mask values per cell. */
export const MASK = {wall: 0, dark: 1, trim: 2, unusable: 255} as const;

export type FrontClass = 'punched' | 'ribbon' | 'curtain' | 'columns' | 'blank';
export type ShapeClass = 'tall' | 'square' | 'wide';

export interface FacadeMeasurement {
  cols: number; rows: number; cell: number; box: FacadeBox;
  /** per cell, row 0 at the top (box.v1): MASK values */
  mask: Uint8Array;
  usableFraction: number; foliageFraction: number; washedOutFraction: number;
  normalisation: {method: string; ref: Rgb | null; gain: number; wb: [number, number, number]};
  wall: {raw: Rgb; normalised: Rgb; hex: string; rawHex: string; cells: number};
  /** the colour clusters of the upper storeys (Lab centre, share, warm) and which one is the wall */
  /** true when the wall was chosen by the floor-zone enrichment (else the continuous-body fallback) */
  zoned?: boolean;
  /** cluster per cell (-1 = not clustered), for debugging */
  labels?: Int8Array;
  clusters?: {lab: Rgb; share: number; warm: boolean; score: number; mixed: boolean; enrich: number; conn: number; span: number[]; wall: boolean}[]; wallCluster?: number; threshold?: number;
  glass: {raw: Rgb; normalised: Rgb; hex: string; rawHex: string; cells: number} | null;
  trim: {normalised: Rgb; hex: string; cells: number} | null;
  /** not-wall share of the usable cells over the upper storeys (>= groundBandM) */
  glazing: number;
  /** per upper storey band of `lines` (index = storey; the ground storey is always null, see `ground`; null where too few usable cells) */
  storeyGlazing: (number | null)[];
  ground: {glazing: number | null; usable: number};
  pitchM: number | null; pitchScore: number; columns: number | null;
  storeyM: number | null;
  window: {w: number; h: number; sill: number; aspect: number; shape: ShapeClass} | null;
  frontClass: FrontClass;
  /** two wall materials side by side along the front (two bricks on one 3DBAG plane): where (fraction of the box width
   *  from u0) and the colour each side; null when the wall is one colour. The kit has no per-group split yet: a named gap. */
  split: WallSplit | null;
}
export interface WallSplit {at: number; left: string; right: string; dE: number}

/** Best single split of the wall cells along u (1 m strips, normalised colour medians) when the two sides differ by
 *  dE76 > 15 and each side is >= 20 % of the width and internally consistent (strip spread < half the split). */
export function wallSplit(cells: number[], colOf: (k: number) => number, cols: number, colour: (k: number) => Rgb, cellsPerStrip = 10): WallSplit | null {
  const nS = Math.ceil(cols / cellsPerStrip), strips: Rgb[][] = Array.from({length: nS}, () => []);
  for (const k of cells) strips[Math.floor(colOf(k) / cellsPerStrip)].push(colour(k));
  const ok = strips.map(s => s.length >= cellsPerStrip * 2), lab = strips.map((s, i) => (ok[i] ? rgbToLab(medRgb(s)) : null));
  const idx = lab.map((_, i) => i).filter(i => ok[i]); if (idx.length < 5) return null;
  const dE = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const med = (is: number[]): Rgb => [0, 1, 2].map(c => median(is.map(i => lab[i]![c]))) as Rgb;
  let best: {n: number; d: number; l: Rgb; r: Rgb} | null = null;
  for (let n = Math.ceil(idx.length * 0.2); n <= Math.floor(idx.length * 0.8); n++) {
    const L = idx.slice(0, n), R = idx.slice(n), l = med(L), r = med(R), d = dE(l, r);
    const spread = Math.max(median(L.map(i => dE(lab[i]!, l))), median(R.map(i => dE(lab[i]!, r))));
    if (d > 15 && spread < d / 2 && (!best || d > best.d)) best = {n, d, l, r};
  }
  if (!best) return null;
  const side = (is: number[]) => hex(medRgb(is.flatMap(i => strips[i])));
  const cut = (idx[best.n - 1] + idx[best.n] + 1) / 2 * cellsPerStrip / cols;
  return {at: +cut.toFixed(3), left: side(idx.slice(0, best.n)), right: side(idx.slice(best.n)), dE: +best.d.toFixed(1)};
}

// ---- colour helpers -------------------------------------------------------------------------------------------
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
export function rgbToLab([r, g, b]: Rgb): Rgb {
  const R = lin(r), G = lin(g), B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
export const hex = (c: Rgb) => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const median = (v: number[]) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const medRgb = (cs: Rgb[]): Rgb => [median(cs.map(c => c[0])), median(cs.map(c => c[1])), median(cs.map(c => c[2]))];
const quant = (v: number[], q: number) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const dLab = (a: Rgb, b: Rgb) => Math.hypot((a[0] - b[0]) * 0.5, a[1] - b[1], a[2] - b[2]);

/** Otsu threshold of values in [lo, hi]. */
export function otsu(values: number[], lo: number, hi: number, bins = 64): number {
  const h = new Array(bins).fill(0);
  for (const v of values) h[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / (hi - lo) * bins)))]++;
  const n = values.length; let sum = 0; for (let i = 0; i < bins; i++) sum += i * h[i];
  let wB = 0, sB = 0, best = 0, at = bins / 2;
  for (let i = 0; i < bins; i++) {
    wB += h[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sB += i * h[i]; const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; at = i + 1; }
  }
  return lo + at / bins * (hi - lo);
}

/** Lag (in samples) of the strongest periodicity in [minLag, maxLag]: the shortest local maximum within 85 % of the best. */
export function dominantPeriod(p: number[], minLag: number, maxLag: number): {lag: number; score: number} | null {
  const n = p.length, mean = p.reduce((s, v) => s + v, 0) / Math.max(1, n), d = p.map(v => v - mean), v0 = d.reduce((s, v) => s + v * v, 0);
  if (n < 4 || v0 < 1e-9) return null;
  const ac: number[] = [];
  const hi = Math.min(maxLag, Math.floor(n / 2));
  for (let lag = 0; lag <= hi; lag++) { let s = 0; for (let i = 0; i + lag < n; i++) s += d[i] * d[i + lag]; ac.push(s / v0 * n / (n - lag)); }
  const peaks: {lag: number; score: number}[] = [];
  for (let lag = Math.max(2, Math.ceil(minLag)); lag < ac.length - 1; lag++) if (ac[lag] >= ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0.05) peaks.push({lag, score: ac[lag]});
  if (!peaks.length) return null;
  const best = Math.max(...peaks.map(q => q.score)), pick = peaks.find(q => q.score >= best * 0.85)!;
  // parabolic refinement of the lag
  const a = ac[pick.lag - 1], b = ac[pick.lag], c = ac[pick.lag + 1], den = a - 2 * b + c;
  return {lag: pick.lag + (Math.abs(den) > 1e-9 ? 0.5 * (a - c) / den : 0), score: +pick.score.toFixed(3)};
}

/** k-means on feature vectors (Euclidean), seeded at evenly spaced quantiles of the first feature (lightness). */
function kmeans(xs: number[][], k: number): {centres: number[][]; label: number[]} {
  const D = xs[0]?.length ?? 0, L0 = xs.map(x => x[0]), d2 = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < D; i++) s += (a[i] - b[i]) ** 2; return s; };
  let centres = Array.from({length: k}, (_, i) => (i + 0.5) / k).map(q => { const L = quant(L0, q); const near = xs.filter(x => Math.abs(x[0] - L) < 0.3); return near.length ? [L, ...Array.from({length: D - 1}, (_, c) => median(near.map(x => x[c + 1])))] : [L, ...Array(D - 1).fill(0)]; });
  let label = xs.map(() => 0);
  for (let it = 0; it < 15; it++) {
    label = xs.map(x => { let bi = 0, bd = Infinity; centres.forEach((c, i) => { const d = d2(x, c); if (d < bd) { bd = d; bi = i; } }); return bi; });
    centres = centres.map((c, i) => { const m = xs.filter((_, q) => label[q] === i); return m.length ? Array.from({length: D}, (_, ch) => m.reduce((s, x) => s + x[ch], 0) / m.length) : c; });
  }
  return {centres, label};
}

/** Largest 4-connected component of `on` cells: its share of the `on` cells and its bounding-box span (width, height fractions). */
function largestComponent(on: Uint8Array, cols: number, rows: number): {conn: number; spanW: number; spanH: number} {
  const seen = new Uint8Array(on.length), stack: number[] = [];
  let total = 0, best = {n: 0, x0: 0, x1: 0, y0: 0, y1: 0};
  for (let s = 0; s < on.length; s++) {
    if (!on[s]) continue; total++;
    if (seen[s]) continue;
    const c = {n: 0, x0: cols, x1: -1, y0: rows, y1: -1}; seen[s] = 1; stack.push(s);
    while (stack.length) {
      const p = stack.pop()!, x = p % cols, y = (p - x) / cols; c.n++;
      c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y);
      for (const q of [x > 0 ? p - 1 : -1, x < cols - 1 ? p + 1 : -1, y > 0 ? p - cols : -1, y < rows - 1 ? p + cols : -1]) if (q >= 0 && on[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
    if (c.n > best.n) best = c;
  }
  return total ? {conn: best.n / total, spanW: (best.x1 - best.x0 + 1) / cols, spanH: (best.y1 - best.y0 + 1) / rows} : {conn: 0, spanW: 0, spanH: 0};
}

export function measureFacade(input: MeasureInput): FacadeMeasurement {
  const {image: im, box} = input, cell = input.cell ?? CELL_M, gb = input.groundBandM ?? GROUND_BAND_M;
  const cols = Math.max(1, Math.floor((box.u1 - box.u0) / cell)), rows = Math.max(1, Math.floor((box.v1 - box.v0) / cell));
  const N = cols * rows, texture = new Float32Array(N), mean: Rgb[] = new Array(N), usable = new Uint8Array(N), foliage = new Uint8Array(N), washed = new Uint8Array(N), edgeX = new Float32Array(N), edgeY = new Float32Array(N);
  const vOf = (j: number) => box.v1 - (j + 0.5) * cell; // cell centre height
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x0 = Math.floor((box.u0 + i * cell) * im.ppm), x1 = Math.max(x0 + 1, Math.floor((box.u0 + (i + 1) * cell) * im.ppm));
    const vt = box.v1 - j * cell, y0 = Math.floor((im.topM - vt) * im.ppm), y1 = Math.max(y0 + 1, Math.floor((im.topM - vt + cell) * im.ppm));
    let r = 0, g = 0, b = 0, n = 0, total = 0, leaf = 0, ys = 0, yy = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      total++;
      if (x < 0 || y < 0 || x >= im.width || y >= im.height) continue;
      const p = y * im.width + x;
      if (im.valid && im.valid[p] < 128) continue;
      const R = im.rgb[p * 3], G = im.rgb[p * 3 + 1], B = im.rgb[p * 3 + 2];
      r += R; g += G; b += B; n++; const Y = 0.299 * R + 0.587 * G + 0.114 * B; ys += Y; yy += Y * Y;
      if (isLeaf(R, G, B)) leaf++;
    }
    const k = j * cols + i;
    mean[k] = n ? [r / n, g / n, b / n] : [0, 0, 0];
    // texture: the cell's luma spread relative to its mean (brick courses and mortar; smooth glass and curtains are low)
    texture[k] = n > 1 ? Math.log1p(Math.sqrt(Math.max(0, yy / n - (ys / n) ** 2)) / Math.max(8, ys / n) * 10) : 0;
    foliage[k] = n && leaf / n > 0.35 ? 1 : 0;
    usable[k] = n >= total * 0.6 && !foliage[k] && (!input.inside || input.inside(box.u0 + (i + 0.5) * cell, vt - cell / 2)) ? 1 : 0;
    const lo = Math.min(...mean[k]), hi = Math.max(...mean[k]);
    washed[k] = n && lo > 150 && hi - lo < 55 ? 1 : 0;
  }
  const lab = mean.map(rgbToLab);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i;
    if (i > 0 && i < cols - 1) edgeX[k] = Math.abs(lab[k + 1][0] - lab[k - 1][0]);
    if (j > 0 && j < rows - 1) edgeY[k] = Math.abs(lab[k + cols][0] - lab[k - cols][0]);
  }
  // Sky (over a lower part of the wall, or in a gap): bright, blue, smooth; or near-white and smooth in the top rows.
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, l = lab[k];
    if (usable[k] && ((l[0] > 55 && l[2] < -8 && edgeX[k] + edgeY[k] < 4) || (j < rows * 0.15 && l[0] > 80 && Math.hypot(l[1], l[2]) < 6 && edgeX[k] + edgeY[k] < 2))) usable[k] = 0;
  }
  const isUpper = (j: number) => vOf(j) >= gb;
  const upperIdx: number[] = [];
  for (let j = 0; j < rows; j++) if (isUpper(j)) for (let i = 0; i < cols; i++) upperIdx.push(j * cols + i);
  const upperUsable = upperIdx.filter(k => usable[k]);
  const allIdx = Array.from({length: N}, (_, k) => k);
  const frac = (idx: number[], f: (k: number) => boolean) => (idx.length ? idx.filter(f).length / idx.length : 0);
  const usableFraction = frac(upperIdx, k => !!usable[k]);
  const foliageFraction = frac(allIdx, k => !!foliage[k]);
  const washedOutFraction = frac(allIdx, k => !!washed[k]);

  // Exposure: the light trim as a near-white reference.
  const pool = upperUsable.length >= 50 ? upperUsable : allIdx.filter(k => usable[k]);
  // the brightest near-neutral cells (white frames, sills, light curtains); glass is neutral too, so a high quantile
  const neutral = pool.filter(k => Math.hypot(lab[k][1], lab[k][2]) < 12), refPool = neutral.length >= pool.length * 0.01 ? neutral : pool;
  const Lref = quant(refPool.map(k => lab[k][0]), 0.97), refCells = refPool.filter(k => lab[k][0] >= Lref);
  const ref = refCells.length ? medRgb(refCells.map(k => mean[k])) : null;
  const refY = ref ? (ref[0] + ref[1] + ref[2]) / 3 : 0;
  const gain = ref && refY > 1 ? Math.max(0.75, Math.min(1.6, 215 / refY)) : 1;
  const wb: [number, number, number] = ref && refY > 1 ? [0, 1, 2].map(c => Math.max(0.92, Math.min(1.08, refY / Math.max(1, ref[c])))) as [number, number, number] : [1, 1, 1];
  const norm = (c: Rgb): Rgb => c.map((v, i) => Math.max(0, Math.min(255, v * gain * wb[i]))) as Rgb;

  const mask = new Uint8Array(N).fill(MASK.unusable);
  const empty: FacadeMeasurement = {cols, rows, cell, box, mask, usableFraction, foliageFraction, washedOutFraction,
    normalisation: {method: 'light-trim p97 of neutral cells -> 215/255', ref, gain: +gain.toFixed(3), wb},
    wall: {raw: [0, 0, 0], normalised: [0, 0, 0], hex: '#000000', rawHex: '#000000', cells: 0}, glass: null, trim: null, split: null,
    glazing: 0, storeyGlazing: [], ground: {glazing: null, usable: 0}, pitchM: null, pitchScore: 0, columns: null, storeyM: null, window: null, frontClass: 'blank'};
  if (pool.length < 30) return empty;

  // Wall clusters: k = 4 colour clusters of the upper storeys, scored by share x connectivity x span (the wall is the one
  // continuous body of the front: brick round punched windows, a concrete frame round infill panels) x colour (warm
  // brick preferred, cool or glass-like clusters discounted). Other warm, connected clusters that span the front
  // (a second brick on the same plane) are wall too; the wall colour is the best cluster's.
  // Features: Lab of the exposure-normalised colour, smoothed over 3x3 usable cells (brick speckle and mortar), each
  // channel z-scored over the upper cells (a dull winter photo has little chroma; relative contrast still separates a
  // red-brown brick from grey glass), lightness at 0.7 weight.
  const nlab = mean.map(c => rgbToLab(norm(c)));
  // Lightness relative to its 3 m neighbourhood (box mean over usable cells): an exposure gradient up a tall front or
  // across a long one (sky light, the panorama's vignetting) otherwise splits one brick into a light and a dark cluster.
  const R = 15, ii = new Float64Array((cols + 1) * (rows + 1)), nn = new Float64Array((cols + 1) * (rows + 1));
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i, q = (j + 1) * (cols + 1) + i + 1;
    ii[q] = ii[q - 1] + ii[q - cols - 1] - ii[q - cols - 2] + (usable[k] ? nlab[k][0] : 0);
    nn[q] = nn[q - 1] + nn[q - cols - 1] - nn[q - cols - 2] + (usable[k] ? 1 : 0);
  }
  const boxMean = (i: number, j: number) => {
    const x0 = Math.max(0, i - R), x1 = Math.min(cols, i + R + 1), y0 = Math.max(0, j - R), y1 = Math.min(rows, j + R + 1);
    const at = (a: Float64Array, x: number, y: number) => a[y * (cols + 1) + x];
    const sum = at(ii, x1, y1) - at(ii, x0, y1) - at(ii, x1, y0) + at(ii, x0, y0), n = at(nn, x1, y1) - at(nn, x0, y1) - at(nn, x1, y0) + at(nn, x0, y0);
    return n ? sum / n : 0;
  };
  // only where the lightness drifts strongly across the front (the top third vs the bottom third differ by > 12 L*)
  const thirds = [0, 1, 2].map(t => { const c = pool.filter(k => Math.floor(Math.floor(k / cols) / rows * 3) === t); return c.length ? median(c.map(k => nlab[k][0])) : NaN; });
  const highPass = Number.isFinite(thirds[0]) && Number.isFinite(thirds[2]) && Math.abs(thirds[0] - thirds[2]) > 12;
  const globalL = pool.reduce((x, k) => x + nlab[k][0], 0) / pool.length;
  const raw4 = nlab.map((l, k) => { const i = k % cols, j = (k - i) / cols; return [highPass ? l[0] - boxMean(i, j) + globalL : l[0], l[1], l[2], texture[k]]; });
  const smooth: number[][] = raw4.map((_, k) => {
    const i = k % cols, j = (k - i) / cols, acc = [0, 0, 0, 0]; let n = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue; const q = jj * cols + ii; if (!usable[q]) continue; for (let c = 0; c < 4; c++) acc[c] += raw4[q][c]; n++; }
    return n ? acc.map(v => v / n) : raw4[k];
  });
  const stat = (c: number, floor: number) => { const v = pool.map(k => smooth[k][c]), m = v.reduce((x, y) => x + y, 0) / v.length; return {m, sd: Math.max(floor, Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length))}; };
  const zs = [stat(0, 4), stat(1, 2), stat(2, 2), stat(3, 0.05)], wts = [0.7, 1, 1, 0.8];
  const F = smooth.map(f => f.map((v, c) => (v - zs[c].m) / zs[c].sd * wts[c]));
  const {centres: fc, label} = kmeans(pool.map(k => F[k]), 4);
  const texOf = fc.map((_, c) => { const m = pool.filter((_, n) => label[n] === c); return m.length ? m.reduce((x, k) => x + smooth[k][3], 0) / m.length : 0; });
  const texMean = pool.reduce((x, k) => x + smooth[k][3], 0) / pool.length;
  // cluster colours in (normalised) Lab, for the warm / glass-like tests
  const centres: Rgb[] = fc.map((_, c) => { const m = pool.filter((_, n) => label[n] === c); return m.length ? [0, 1, 2].map(ch => m.reduce((x, k) => x + nlab[k][ch], 0) / m.length) as Rgb : [0, 0, 0]; });
  const share = centres.map((_, c) => label.filter(l => l === c).length / label.length);
  const warm = (c: Rgb) => c[1] + c[2] > 12 && c[2] > 4;
  // glass-like: dark, nearly neutral, not warm (reflective or dark glazing); a wall is rarely cool (blue-grey)
  const glassLike = (c: Rgb) => c[0] < 50 && Math.hypot(c[1], c[2]) < 12 && c[2] <= 3;
  const cellOf = new Int32Array(N).fill(-1); pool.forEach((k, n) => { cellOf[k] = label[n]; });
  const shape = centres.map((_, c) => largestComponent(Uint8Array.from(cellOf, v => (v === c ? 1 : 0)), cols, rows));
  const dE76 = (x: Rgb, y: Rgb) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  // glass-like only when also smooth: dull dark brick (low chroma in a winter photo) is textured
  const glassy = (i: number) => glassLike(centres[i]) && texOf[i] < texMean;
  // The wall is what the floor zones are made of. Windows sit mid-storey, so glazing is depleted in the zones round the
  // floors (+-0.35 m) compared with the storey middles; brick, render, bands and spandrels are not.
  // Wall clusters: enrichment floor/middle >= 0.9. Known failure: reflective glass as light as the spandrels
  // (Wibautstraat 78 g0, overcast) is not separable by colour; such groups take hand values.
  // Floor zones from the photo itself: the storey period of the fit (median upper storey), its phase where the rows
  // are calmest (fewest vertical edges: no mullions or window jambs); a fit whose storey lines sit half a storey off
  // the real floors (Wibautstraat 78) does not then call the window band the floor.
  const ups = input.lines.slice(1).map((l, s) => input.lines[s + 2] - l).filter(h => Number.isFinite(h) && h >= 2 && h <= 6.5);
  const P = ups.length ? median(ups) : 3.2, nb = Math.max(6, Math.round(P / cell)), fold = new Array(nb).fill(0), fn = new Array(nb).fill(0);
  for (let j = 0; j < rows; j++) {
    const v = vOf(j); if (v < gb || v > box.v1 - 0.3) continue;
    let e = 0, n = 0; for (let i = 0; i < cols; i++) { const k = j * cols + i; if (usable[k]) { e += edgeX[k]; n++; } }
    if (n < cols * 0.3) continue;
    const b = Math.floor((((v % P) + P) % P) / P * nb) % nb; fold[b] += e / n; fn[b]++;
  }
  const fm = fold.map((v, b) => (fn[b] ? v / fn[b] : NaN)), fs = fm.map((_, b) => { const w = [-1, 0, 1].map(d => fm[(b + d + nb) % nb]).filter(Number.isFinite); return w.length ? w.reduce((x, y) => x + y, 0) / w.length : Infinity; });
  const phase = (fs.indexOf(Math.min(...fs)) + 0.5) / nb * P;
  const zone = (v: number): 0 | 1 | 2 => {
    if (v < gb || v > box.v1 - 0.3) return 0;
    const d = ((v - phase) % P + P) % P, w = Math.min(d, P - d);
    return w <= 0.35 ? 1 : Math.abs(d - P / 2) <= 0.15 * P ? 2 : 0;
  };
  const inFloor = centres.map(() => 0), inMid = centres.map(() => 0);
  let nF = 0, nM = 0;
  pool.forEach((k, n) => { const z = zone(vOf(Math.floor(k / cols))); if (z === 1) { inFloor[label[n]]++; nF++; } else if (z === 2) { inMid[label[n]]++; nM++; } });
  const enrich = centres.map((_, c) => (nF && nM ? (inFloor[c] / nF) / Math.max(1e-3, inMid[c] / nM) : 1));
  const zoned = nF >= 50 && nM >= 50 && enrich.some((e, c) => e < 0.7 && share[c] >= 0.08);
  // fallback (no storey zones, or a uniform front): one continuous, textured, warm body
  const score = centres.map((c, i) => share[i] * shape[i].conn * Math.sqrt(shape[i].spanW * shape[i].spanH) * (warm(c) ? 1.5 : c[2] < 0 ? 0.4 : 1) * (glassy(i) ? 0.2 : 1) * Math.max(0.3, Math.min(2, texOf[i] / Math.max(1e-6, texMean))));
  let wallSet: boolean[], wallC: number;
  if (zoned) {
    wallSet = centres.map((_, i) => enrich[i] >= 0.9 && share[i] >= 0.05);
    // the wall colour: the wall cluster that is large, most enriched in the floor zones and one connected body
    const pick = centres.map((_, i) => (wallSet[i] ? share[i] * Math.min(2, enrich[i]) * Math.sqrt(shape[i].conn) : -1));
    wallC = pick.indexOf(Math.max(...pick));
  } else {
    wallC = score.indexOf(Math.max(...score));
    wallSet = centres.map((c, i) => i === wallC || (!glassy(i) && dE76(c, centres[wallC]) < 12)
      // a second continuous body spanning the height (two bricks on one 3DBAG plane)
      || (share[i] >= 0.1 && shape[i].conn >= 0.6 && shape[i].spanH >= 0.6 && shape[i].spanW >= 0.3 && (!glassy(i) || share[i] < share[wallC] * 1.5)));
  }
  const wallLab = centres[wallC];
  const wallCentres = fc.filter((_, i) => wallSet[i]);
  const allUsable = allIdx.filter(k => usable[k]);
  const eu = (a: number[], b: number[]) => Math.sqrt(a.reduce((x, v, i) => x + (v - b[i]) ** 2, 0));
  const dist = allUsable.map(k => Math.min(...wallCentres.map(c => eu(F[k], c))));
  const distTop = allUsable.map(k => eu(F[k], fc[wallC]));
  const tau = Math.max(0.9, Math.min(2.2, otsu(dist, 0, 6)));
  const raw = new Uint8Array(N).fill(MASK.unusable);
  // a cell is wall when its nearest cluster is a wall cluster (cells outside the clustered pool: by distance)
  const nearestC = (k: number) => { let bi = 0, bd = Infinity; fc.forEach((c, i) => { const d = eu(F[k], c); if (d < bd) { bd = d; bi = i; } }); return bi; };
  // Mixed clusters: cells straddling a window edge (half wall, half glass) form their own textured cluster whose colour
  // lies between a wall and a not-wall centre. Neither floor nor glazing, so their cells go cell by cell to the nearer
  // (in Lab) of the pure wall and not-wall colours.
  const segDist = (p: Rgb, a: Rgb, b: Rgb) => { const ab = [0, 1, 2].map(c => b[c] - a[c]), l2 = ab.reduce((x, v) => x + v * v, 0); if (l2 < 1) return null; const t = Math.max(0, Math.min(1, [0, 1, 2].reduce((x, c) => x + (p[c] - a[c]) * ab[c], 0) / l2)); return {d: Math.hypot(...[0, 1, 2].map(c => p[c] - a[c] - t * ab[c])), t, len: Math.sqrt(l2)}; };
  const mixed = centres.map((c, i) => {
    if (texOf[i] < texMean * 1.2) return false;
    for (let a = 0; a < centres.length; a++) for (let b = 0; b < centres.length; b++) {
      if (a === i || b === i || !wallSet[a] || wallSet[b]) continue;
      const r = segDist(c, centres[a], centres[b]); if (r && r.d < 0.25 * r.len && r.t > 0.15 && r.t < 0.85) return true;
    }
    return false;
  });
  const pureWall = centres.filter((_, i) => wallSet[i] && !mixed[i]), pureNot = centres.filter((_, i) => !wallSet[i] && !mixed[i]);
  const nearerWall = (k: number) => { const d = (cs: Rgb[]) => Math.min(...cs.map(c => Math.hypot(nlab[k][0] - c[0], nlab[k][1] - c[1], nlab[k][2] - c[2]))); return d(pureWall) <= d(pureNot); };
  allUsable.forEach((k, n) => {
    const c = cellOf[k] >= 0 ? cellOf[k] : nearestC(k);
    const isWall = mixed[c] && pureWall.length && pureNot.length ? nearerWall(k) : wallSet[c] || dist[n] <= Math.min(tau, 0.9);
    raw[k] = isWall ? MASK.wall : nlab[k][0] > wallLab[0] + 5 ? MASK.trim : MASK.dark;
  });
  // 3x3 majority clean-up of wall / not-wall (keeps the dark/trim label of the cell or its neighbours).
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = j * cols + i; if (raw[k] === MASK.unusable) continue;
    let nw = 0, n = 0, light = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
      const q = raw[jj * cols + ii]; if (q === MASK.unusable) continue;
      n++; if (q !== MASK.wall) { nw++; if (q === MASK.trim) light++; }
    }
    mask[k] = nw * 2 > n ? (raw[k] !== MASK.wall ? raw[k] : light * 2 > nw ? MASK.trim : MASK.dark) : MASK.wall;
  }
  const notWall = (k: number) => mask[k] === MASK.dark || mask[k] === MASK.trim;
  const topOk = new Uint8Array(N); allUsable.forEach((k, n) => { if (cellOf[k] === wallC || distTop[n] <= 0.9) topOk[k] = 1; });
  const wallCells = allUsable.filter(k => mask[k] === MASK.wall && topOk[k] && isUpper(Math.floor(k / cols)));
  const wallRaw = medRgb((wallCells.length ? wallCells : allUsable.filter(k => mask[k] === MASK.wall)).map(k => mean[k]));
  const darkCells = allUsable.filter(k => mask[k] === MASK.dark), trimCells = allUsable.filter(k => mask[k] === MASK.trim);
  const glassRaw = darkCells.length >= 20 ? medRgb(darkCells.map(k => mean[k])) : null;
  const trimN = trimCells.length >= 20 ? norm(medRgb(trimCells.map(k => mean[k]))) : null;
  const grid = analyseMask({mask, cols, rows, cell, box, lines: input.lines, groundBandM: gb, edgeX, edgeY});
  const {glazing, storeyGlazing, ground, pitchM, pitchScore, columns, storeyM, window, frontClass} = grid;

  const wallN = norm(wallRaw), glassN = glassRaw ? norm(glassRaw) : null;
  const split = wallSplit(allUsable.filter(k => mask[k] === MASK.wall && isUpper(Math.floor(k / cols))), k => k % cols, cols, k => norm(mean[k]));
  const clusters = centres.map((c, i) => ({lab: c.map(v => +v.toFixed(1)) as Rgb, share: +share[i].toFixed(3), warm: warm(c), score: +score[i].toFixed(4), mixed: mixed[i], enrich: +enrich[i].toFixed(2), conn: +shape[i].conn.toFixed(2), span: [+shape[i].spanW.toFixed(2), +shape[i].spanH.toFixed(2)], wall: wallSet[i]}));
  return {labels: Int8Array.from(cellOf), zoned, clusters, wallCluster: wallC, threshold: +tau.toFixed(1), cols, rows, cell, box, mask, usableFraction: +usableFraction.toFixed(3), foliageFraction: +foliageFraction.toFixed(3), washedOutFraction: +washedOutFraction.toFixed(3),
    normalisation: {method: 'light-trim p97 of neutral cells -> 215/255 (gain 0.75..1.6, white balance +-8 %)', ref: ref ? ref.map(Math.round) as Rgb : null, gain: +gain.toFixed(3), wb: wb.map(v => +v.toFixed(3)) as [number, number, number]},
    wall: {raw: wallRaw.map(Math.round) as Rgb, normalised: wallN.map(Math.round) as Rgb, hex: hex(wallN), rawHex: hex(wallRaw), cells: wallCells.length},
    glass: glassRaw && glassN ? {raw: glassRaw.map(Math.round) as Rgb, normalised: glassN.map(Math.round) as Rgb, hex: hex(glassN), rawHex: hex(glassRaw), cells: darkCells.length} : null,
    trim: trimN ? {normalised: trimN.map(Math.round) as Rgb, hex: hex(trimN), cells: trimCells.length} : null,
    glazing, storeyGlazing, ground, pitchM, pitchScore, columns, storeyM, window, frontClass, split};
}


export interface MaskGrid {
  glazing: number; storeyGlazing: (number | null)[]; ground: {glazing: number | null; usable: number};
  pitchM: number | null; pitchScore: number; columns: number | null; storeyM: number | null;
  window: FacadeMeasurement['window']; frontClass: FrontClass;
}
/**
 * The grid of a wall/not-wall cell mask (`MASK` values, row 0 at `box.v1`): glazing per upper storey of `lines` and of the
 * ground band, bay pitch and column count, storey height, window proportions and the front class. Shared by the photo
 * measurement and the model elevation (likeness.ts), so both are read the same way. Edge profiles are optional.
 */
export function analyseMask(a: {mask: Uint8Array; cols: number; rows: number; cell: number; box: FacadeBox; lines: number[]; groundBandM?: number; edgeX?: Float32Array; edgeY?: Float32Array}): MaskGrid {
  const {mask, cols, rows, cell, box} = a, gb = a.groundBandM ?? GROUND_BAND_M, N = cols * rows;
  const edgeX = a.edgeX ?? new Float32Array(N), edgeY = a.edgeY ?? new Float32Array(N);
  const usable = Uint8Array.from(mask, m => (m === MASK.unusable ? 0 : 1));
  const vOf = (j: number) => box.v1 - (j + 0.5) * cell;
  const allIdx = Array.from({length: N}, (_, k) => k), allUsable = allIdx.filter(k => usable[k]);
  const upperUsable = allUsable.filter(k => vOf(Math.floor(k / cols)) >= gb);
  const notWall = (k: number) => mask[k] === MASK.dark || mask[k] === MASK.trim;
  const glazing = upperUsable.length ? upperUsable.filter(notWall).length / upperUsable.length : 0;

  // Storey bands of the fit and the ground band.
  const lines = a.lines;
  const storeyGlazing: (number | null)[] = [];
  for (let s = 0; s + 1 < lines.length; s++) {
    if (s === 0) { storeyGlazing.push(null); continue; } // the ground storey: measured as the ground band, never pooled
    const lo = Math.max(lines[s], gb, box.v0), hi = Math.min(lines[s + 1], box.v1);
    if (hi - lo < 0.8) { storeyGlazing.push(null); continue; }
    const idx = allUsable.filter(k => { const v = vOf(Math.floor(k / cols)); return v >= lo && v < hi; });
    const all = allIdx.filter(k => { const v = vOf(Math.floor(k / cols)); return v >= lo && v < hi; });
    storeyGlazing.push(idx.length >= Math.max(20, all.length * 0.4) ? +(idx.filter(notWall).length / idx.length).toFixed(3) : null);
  }
  const groundAll = allIdx.filter(k => vOf(Math.floor(k / cols)) < gb), groundUse = groundAll.filter(k => usable[k]);
  const ground = {glazing: groundUse.length >= Math.max(20, groundAll.length * 0.4) ? +(groundUse.filter(notWall).length / groundUse.length).toFixed(3) : null, usable: +(groundAll.length ? groundUse.length / groundAll.length : 0).toFixed(3)};

  // Column rhythm over the upper storeys (top 0.3 m left out: parapets and copings).
  const colP: number[] = [], colE: number[] = [];
  for (let i = 0; i < cols; i++) {
    let nw = 0, n = 0, e = 0;
    for (let j = 0; j < rows; j++) { const v = vOf(j); if (v < gb || v > box.v1 - 0.3) continue; const k = j * cols + i; if (!usable[k]) continue; n++; if (notWall(k)) nw++; e += edgeX[k]; }
    colP.push(n ? nw / n : NaN); colE.push(n ? e / n : NaN);
  }
  const fill = (p: number[]) => { const m = p.filter(Number.isFinite); const mu = m.length ? m.reduce((s, v) => s + v, 0) / m.length : 0; return p.map(v => (Number.isFinite(v) ? v : mu)); };
  const z = (p: number[]) => { const m = p.reduce((s, v) => s + v, 0) / p.length, sd = Math.sqrt(p.reduce((s, v) => s + (v - m) ** 2, 0) / p.length) || 1; return p.map(v => (v - m) / sd); };
  const cp = fill(colP), ce = fill(colE), zc = z(cp), ze = z(ce), prof = zc.map((v, i) => v + 0.5 * ze[i]);
  // the not-wall profile alone first (mullions inside a ribbon are not bays); its edges help where it is weak (dark glass in dark brick)
  const perMask = dominantPeriod(zc, 0.8 / cell, 8 / cell), per = perMask && perMask.score >= 0.3 ? perMask : dominantPeriod(prof, 0.8 / cell, 8 / cell);
  const widthM = cols * cell;
  const pitchM = per && per.score >= 0.15 ? per.lag * cell : null;
  const columns = pitchM ? Math.max(1, Math.round(widthM / pitchM)) : null;

  // Storey rhythm on the rows.
  const rowP: number[] = [];
  for (let j = 0; j < rows; j++) { let nw = 0, n = 0, e = 0; for (let i = 0; i < cols; i++) { const k = j * cols + i; if (!usable[k]) continue; n++; if (notWall(k)) nw++; e += edgeY[k]; } rowP.push(n ? nw / n + 0.02 * e / n : NaN); }
  const upRows = fill(rowP).filter((_, j) => vOf(j) >= gb);
  const sp = dominantPeriod(z(upRows), 2.4 / cell, 6.5 / cell);
  const storeyM = sp && sp.score >= 0.15 ? +(sp.lag * cell).toFixed(2) : null;

  // Window shape: fold at the pitch (columns) and over the fit's upper storeys (rows).
  let window: FacadeMeasurement['window'] = null;
  const B = 20;
  if (pitchM) {
    const P = pitchM / cell, fb = new Array(B).fill(0), fn = new Array(B).fill(0);
    for (let i = 0; i < cols; i++) { const b = Math.floor((((i + 0.5) / P) % 1) * B); fb[b] += cp[i]; fn[b]++; }
    const f = fb.map((v, b) => (fn[b] ? v / fn[b] : 0)), fmin = Math.min(...f), fmax = Math.max(...f), thr = (fmin + fmax) / 2;
    const inWin = (i: number) => f[Math.floor((((i + 0.5) / P) % 1) * B)] > thr;
    const wFrac = f.filter(v => v > thr).length / B;
    const rb = new Array(B).fill(0), rn = new Array(B).fill(0);
    for (let s = 1; s + 1 < lines.length; s++) {
      const lo = lines[s], hi = lines[s + 1];
      if (lo < gb || hi > box.v1 + 0.05 || hi - lo < 2) continue;
      for (let j = 0; j < rows; j++) { const v = vOf(j); if (v < lo || v >= hi) continue; const b = Math.min(B - 1, Math.floor((v - lo) / (hi - lo) * B));
        for (let i = 0; i < cols; i++) { const k = j * cols + i; if (!usable[k] || !inWin(i)) continue; rn[b]++; if (notWall(k)) rb[b]++; } }
    }
    const rp = rb.map((v, b) => (rn[b] ? v / rn[b] : NaN));
    if (rp.some(Number.isFinite) && fmax - fmin >= 0.15) {
      const rf = fill(rp), rmin = Math.min(...rf), rmax = Math.max(...rf), rthr = Math.max(0.35, (rmin + rmax) / 2);
      const on = rf.map(v => v > rthr), first = on.indexOf(true), last = on.lastIndexOf(true);
      const h = first < 0 ? 0 : (last - first + 1) / B, sill = first < 0 ? 0 : first / B;
      const storeyH = lines.length > 2 ? lines[lines.length - 1] - lines[lines.length - 2] : 3;
      const unit = (() => { const ups = lines.slice(1).map((l, s) => lines[s + 2] - l).filter(v => Number.isFinite(v) && v > 0); return ups.length ? median(ups) : storeyH; })();
      const aspect = wFrac > 0 ? (h * unit) / (wFrac * pitchM) : 0;
      window = {w: +wFrac.toFixed(3), h: +h.toFixed(3), sill: +sill.toFixed(3), aspect: +aspect.toFixed(2), shape: aspect > 1.4 ? 'tall' : aspect < 0.7 ? 'wide' : 'square'};
    }
  }
  const contrast = (() => { const v = cp.filter(Number.isFinite); return v.length ? quant(v, 0.9) - quant(v, 0.1) : 0; })();
  const frontClass: FrontClass = glazing < 0.05 ? 'blank' : glazing >= 0.68 ? 'curtain'
    : (!window && contrast < 0.15 && glazing >= 0.2) || (window && window.w >= 0.85) ? 'ribbon'
    : window && window.h >= 0.92 ? 'columns' : 'punched';
  return {glazing: +glazing.toFixed(3), storeyGlazing, ground, pitchM: pitchM ? +pitchM.toFixed(3) : null, pitchScore: per?.score ?? 0, columns, storeyM, window, frontClass};
}
