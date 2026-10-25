// Ground-height field: AHN DTM resampled to a coarse RD New grid (pure, no DOM).
//
// Storage is frame-neutral: RD New (EPSG:28992) metres, NAP heights in
// centimetres, so the extract never has to be regenerated when a renderer
// picks a different scene frame. Consumers convert their own frame to RD once
// per area with `fitLocalToRd` (an affine fit, centimetre-accurate over a few
// kilometres because RD is conformal) and then sample bilinearly.
//
// Tile file layout (`tiles/<tx>_<ty>.bin`, served gzip-compressed):
//   n × n little-endian int16, rows south → north, columns west → east;
//   each row is delta-coded along x (first value absolute), wrapping mod 2^16.
// Sample (i, j) of tile (tx, ty) sits at the cell centre
//   x = tx·T + (i + ½)·step,  y = ty·T + (j + ½)·step   (T = tile size in metres).
// NODATA (−32768) only appears where the source had no coverage at all.

export const NODATA = -32768;

export interface GroundIndex {
  version: 1;
  crs: 'EPSG:28992';
  vertical: 'NAP';
  stepM: number;
  tileSizeM: number;
  /** Samples per tile side (tileSizeM / stepM). */
  samples: number;
  heightUnitM: 0.01;
  /**
   * [tx, ty, measured fraction 0..1, stored step metres?]. A tile stored
   * coarser than `stepM` (city-wide build: 4 m away from the centre) is
   * upsampled bilinearly to `stepM` on decode, so the field stays one grid.
   */
  tiles: ([number, number, number] | [number, number, number, number])[];
  /**
   * Residual coding of the int16 cm samples: 'dx' (default, version-1 tiles)
   * = delta along x; 'planar' = left + below − below-left (≈20 % smaller gz).
   */
  predictor?: 'dx' | 'planar';
  /** Scene z = 0 in the riding view, metres NAP (canal water −0.40 + 1.77 m quay freeboard). */
  sceneDatumNAP: number;
  waterLevelNAP: number;
  sources?: Record<string, unknown>;
  attribution?: string;
}

export interface Grid {
  width: number;
  height: number;
  /** Row-major, row 0 = south. NaN = unknown. */
  data: Float32Array;
}

/**
 * Average a north-up raster (row 0 = north, as TIFFs store it) into `factor`×`factor`
 * blocks, flipping to south-first rows. A block with fewer than `minValid`
 * measured pixels is NaN (a hole to fill).
 */
export function downsample(src: { width: number; height: number; data: Float32Array }, factor: number, minValid = Math.ceil(factor * factor / 4)): Grid {
  const width = Math.floor(src.width / factor), height = Math.floor(src.height / factor);
  const data = new Float32Array(width * height);
  for (let by = 0; by < height; by++) {
    for (let bx = 0; bx < width; bx++) {
      let sum = 0, n = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (by * factor + dy) * src.width + bx * factor;
        for (let dx = 0; dx < factor; dx++) { const v = src.data[row + dx]; if (v === v) { sum += v; n++; } }
      }
      // Source row 0 is north; output row 0 is south.
      data[(height - 1 - by) * width + bx] = n >= minValid ? sum / n : NaN;
    }
  }
  return { width, height, data };
}

/**
 * Pull-push hole filling: average known samples up a pyramid, then push the
 * coarse averages back down into the holes only. O(n), smooth, and it never
 * changes a measured sample. Building footprints get the surrounding street
 * level; canals get the mean of their two quays. Returns the number filled.
 */
export function pullPushFill(grid: Grid): number {
  const levels: { w: number; h: number; v: Float32Array; k: Float32Array }[] = [];
  let w = grid.width, h = grid.height;
  let v = new Float32Array(w * h), k = new Float32Array(w * h);
  let holes = 0;
  for (let i = 0; i < v.length; i++) { const x = grid.data[i]; if (x === x) { v[i] = x; k[i] = 1; } else holes++; }
  if (!holes) return 0;
  levels.push({ w, h, v, k });
  while (w > 1 || h > 1) {
    const nw = Math.ceil(w / 2), nh = Math.ceil(h / 2), nv = new Float32Array(nw * nh), nk = new Float32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      let s = 0, c = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const sx = 2 * x + dx, sy = 2 * y + dy;
        if (sx >= w || sy >= h) continue;
        const i = sy * w + sx; s += v[i] * k[i]; c += k[i];
      }
      const o = y * nw + x;
      nk[o] = Math.min(1, c); nv[o] = c > 0 ? s / c : 0;
    }
    w = nw; h = nh; v = nv; k = nk;
    levels.push({ w, h, v, k });
  }
  // Push: each level's holes take the bilinear value of the coarser level.
  for (let l = levels.length - 2; l >= 0; l--) {
    const fine = levels[l], coarse = levels[l + 1];
    for (let y = 0; y < fine.h; y++) for (let x = 0; x < fine.w; x++) {
      const i = y * fine.w + x;
      if (fine.k[i] >= 1) continue;
      const cx = Math.min(coarse.w - 1, Math.max(0, (x - 0.5) / 2)), cy = Math.min(coarse.h - 1, Math.max(0, (y - 0.5) / 2));
      const x0 = Math.floor(cx), y0 = Math.floor(cy), x1 = Math.min(coarse.w - 1, x0 + 1), y1 = Math.min(coarse.h - 1, y0 + 1);
      const fx = cx - x0, fy = cy - y0;
      const c = (coarse.v[y0 * coarse.w + x0] * (1 - fx) + coarse.v[y0 * coarse.w + x1] * fx) * (1 - fy)
        + (coarse.v[y1 * coarse.w + x0] * (1 - fx) + coarse.v[y1 * coarse.w + x1] * fx) * fy;
      // Partially known cells (weight between 0 and 1) blend toward the coarse value.
      fine.v[i] = fine.k[i] > 0 ? fine.v[i] * fine.k[i] + c * (1 - fine.k[i]) : c;
      fine.k[i] = 1;
    }
  }
  const out = levels[0];
  for (let i = 0; i < grid.data.length; i++) if (grid.data[i] !== grid.data[i]) grid.data[i] = out.v[i];
  return holes;
}

/**
 * One pass of a 3×3 binomial ([1 2 1]²/16) filter, in place. Takes the 2 m
 * cell-to-cell noise out of the DTM (kerbs, bollards, filled parked cars) that
 * otherwise reads as rippled paving at a chase camera; slopes and ramps keep
 * their shape. Edges clamp.
 */
export function smooth3(grid: Grid): void {
  const { width: w, height: h, data } = grid, src = data.slice();
  const at = (i: number, j: number) => src[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    data[j * w + i] = (at(i - 1, j - 1) + 2 * at(i, j - 1) + at(i + 1, j - 1) + 2 * at(i - 1, j) + 4 * at(i, j) + 2 * at(i + 1, j) + at(i - 1, j + 1) + 2 * at(i, j + 1) + at(i + 1, j + 1)) / 16;
  }
}

/** Running max (or min) of a row-major grid over a (2r+1)² square, NaN-aware (separable; NaN where the window has no value). */
function squareExtreme(data: Float32Array, w: number, h: number, r: number, max: boolean): Float32Array {
  const pass = (src: Float32Array, horizontal: boolean): Float32Array => {
    const out = new Float32Array(src.length), lines = horizontal ? h : w, len = horizontal ? w : h;
    for (let a = 0; a < lines; a++) for (let b = 0; b < len; b++) {
      let best = NaN;
      for (let d = Math.max(0, b - r), e = Math.min(len - 1, b + r); d <= e; d++) {
        const v = src[horizontal ? a * w + d : d * w + a];
        if (v === v && (best !== best || (max ? v > best : v < best))) best = v;
      }
      out[horizontal ? a * w + b : b * w + a] = best;
    }
    return out;
  };
  return pass(pass(data, true), false);
}

export interface PitOptions {
  /** Grid spacing, metres. */
  stepM: number;
  /** Closing radius, metres: a hollow narrower than about twice this is bridged by the closing. */
  radiusM: number;
  /** A sample this far (metres) below the closed surface belongs to a pit. */
  minDepthM: number;
  /** Pits larger than this (m²) are terrain the rider uses (a tunnel ramp, a sunken road): kept. */
  maxAreaM2: number;
  /**
   * The ring of samples around a pit must be level: its 10–90 % height spread at most this (metres). A stairwell
   * in a plaza has a level rim; a road cut through a rail embankment (an underpass approach) has the embankment on
   * two sides and the street at its ends, and is kept.
   */
  maxRimSpreadM: number;
}

export interface Pit { cells: number; areaM2: number; depthM: number; rimSpreadM: number; i: number; j: number }

/**
 * Stairwells, escalator shafts and garage ramps cut into a paved plaza: the
 * DTM measures their floors 2–4 m under the pavement (Stationsplein's metro
 * and bike-garage entrances), and the 2 m field turned each into a smooth
 * crater the paving drapes into (issue #53). A pit is a connected set of
 * measured samples more than `minDepthM` under the morphological closing of
 * the field (square window of `radiusM`) whose area is at most `maxAreaM2`.
 * Returns the pit mask (1 = pit sample) and the pits found; the caller blanks
 * them before the hole fill so the pavement level carries over them.
 */
export function findPits(grid: Grid, o: PitOptions): { mask: Uint8Array; pits: Pit[]; rejected: number } {
  const { width: w, height: h, data } = grid, r = Math.max(1, Math.round(o.radiusM / o.stepM));
  const closed = squareExtreme(squareExtreme(data, w, h, r, true), w, h, r, false);
  const deep = new Uint8Array(w * h), mask = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  for (let k = 0; k < deep.length; k++) { const v = data[k], c = closed[k]; if (v === v && c === c && c - v > o.minDepthM) deep[k] = 1; }
  const maxCells = o.maxAreaM2 / (o.stepM * o.stepM), pits: Pit[] = [];
  const stack: number[] = [], members: number[] = [], rim: number[] = [];
  let rejected = 0;
  for (let s = 0; s < deep.length; s++) {
    if (!deep[s] || seen[s]) continue;
    stack.length = 0; members.length = 0; stack.push(s); seen[s] = 1;
    let depth = 0, at = s;
    while (stack.length) {
      const k = stack.pop()!, i = k % w, j = (k - i) / w;
      members.push(k);
      const d = closed[k] - data[k]; if (d > depth) { depth = d; at = k; }
      if (i > 0 && deep[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1); }
      if (i < w - 1 && deep[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1); }
      if (j > 0 && deep[k - w] && !seen[k - w]) { seen[k - w] = 1; stack.push(k - w); }
      if (j < h - 1 && deep[k + w] && !seen[k + w]) { seen[k + w] = 1; stack.push(k + w); }
    }
    if (members.length > maxCells) { rejected++; continue; }
    // The ring: measured 8-neighbours of the pit outside it.
    rim.length = 0;
    for (const k of members) {
      const i = k % w, j = (k - i) / w;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj, q = b * w + a;
        if (a < 0 || b < 0 || a >= w || b >= h || deep[q] || seen[q] === 2) continue;
        const v = data[q];
        if (v === v) { rim.push(v); seen[q] = 2; }
      }
    }
    for (const k of members) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = k + dj * w + di; if (q >= 0 && q < seen.length && seen[q] === 2) seen[q] = 0; }
    rim.sort((a, b) => a - b);
    const spread = rim.length ? rim[Math.floor(0.9 * (rim.length - 1))] - rim[Math.floor(0.1 * (rim.length - 1))] : Infinity;
    if (spread > o.maxRimSpreadM) { rejected++; continue; }
    for (const k of members) mask[k] = 1;
    pits.push({ cells: members.length, areaM2: members.length * o.stepM * o.stepM, depthM: +depth.toFixed(2), rimSpreadM: +spread.toFixed(2), i: at % w, j: Math.floor(at / w) });
  }
  return { mask, pits, rejected };
}

/** Grow a mask by `cells` samples (square), so a pit's smoothed rim goes with it. */
export function dilateMask(mask: Uint8Array, w: number, h: number, cells: number): Uint8Array {
  const f = new Float32Array(mask.length);
  for (let k = 0; k < f.length; k++) f[k] = mask[k];
  const g = squareExtreme(f, w, h, cells, true), out = new Uint8Array(mask.length);
  for (let k = 0; k < out.length; k++) out[k] = g[k] > 0 ? 1 : 0;
  return out;
}

/** Default pit search (build-ground-height.ts, the extract repair): 8 m closing, 1 m deep, at most 600 m², level rim (1 m). */
export const PIT_DEFAULTS: Omit<PitOptions, 'stepM'> = { radiusM: 8, minDepthM: 1, maxAreaM2: 600, maxRimSpreadM: 1 };

/** 8-connected components of `on` (row-major), each as its sample indices. */
function components(on: Uint8Array, w: number, h: number, visit: (members: number[]) => void): void {
  const seen = new Uint8Array(on.length), stack: number[] = [], members: number[] = [];
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || seen[s]) continue;
    stack.length = 0; members.length = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const k = stack.pop()!, i = k % w, j = (k - i) / w;
      members.push(k);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj, q = b * w + a;
        if (a < 0 || b < 0 || a >= w || b >= h || !on[q] || seen[q]) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    visit(members);
  }
}

/**
 * Specks: measured islands of at most `maxAreaM2` with no measured sample around them, only holes (laser returns
 * through Centraal's glass roofs hitting a platform 4 m above the street, issue #53). Each pulled the fill of the
 * whole hall toward it as a spike; blanked, the hole fills from its real rim. Returns the samples blanked.
 */
export function dropSpecks(grid: Grid, stepM: number, maxAreaM2: number): number {
  const { width: w, height: h, data } = grid, on = new Uint8Array(w * h), maxCells = maxAreaM2 / (stepM * stepM);
  for (let k = 0; k < on.length; k++) on[k] = data[k] === data[k] ? 1 : 0;
  let dropped = 0;
  components(on, w, h, members => {
    if (members.length > maxCells) return;
    // Enclosed: no member on the grid edge (an island cut by the edge may be part of measured ground beyond it).
    for (const k of members) { const i = k % w, j = (k - i) / w; if (i === 0 || j === 0 || i === w - 1 || j === h - 1) return; }
    for (const k of members) data[k] = NaN;
    dropped += members.length;
  });
  return dropped;
}

/**
 * Large holes (a station hall, a covered bus station: `minAreaM2` and up) are filled from their whole rim, and a rim
 * that runs from the quay (+1 m NAP) to the track bed on the viaducts (+5 m) leaves a 4 m hump under the roof that
 * the riders see from the street beside it (Centraal's IJ side, issue #53). After the fill, cap each such hole at
 * the `quantile` of its rim heights: the street level most of its edge stands on. Measured samples never change.
 * `holes` marks the samples that were holes before the fill. Returns the holes capped.
 */
export function capLargeHoles(grid: Grid, holes: Uint8Array, stepM: number, minAreaM2: number, quantile = 0.5): number {
  const { width: w, height: h, data } = grid, minCells = minAreaM2 / (stepM * stepM), rim: number[] = [], mark = new Uint8Array(w * h);
  let capped = 0;
  components(holes, w, h, members => {
    if (members.length < minCells) return;
    rim.length = 0;
    for (const k of members) {
      const i = k % w, j = (k - i) / w;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj, q = b * w + a;
        if (a < 0 || b < 0 || a >= w || b >= h || holes[q] || mark[q]) continue;
        mark[q] = 1; rim.push(data[q]);
      }
    }
    if (!rim.length) return;
    rim.sort((a, b) => a - b);
    const cap = rim[Math.floor(quantile * (rim.length - 1))];
    for (const k of members) if (data[k] > cap) data[k] = cap;
    capped++;
  });
  return capped;
}

/** Specks of at most 40 m² dropped; holes of 5,000 m² and more capped at their rim's median (build-ground-height.ts). */
export const SPECK_MAX_M2 = 40, LARGE_HOLE_M2 = 5000;

export type Predictor = 'dx' | 'planar';

/** Prediction of sample (i, j) from already-decoded neighbours (q: int cm, row-major, row 0 south). */
function predict(q: Int32Array, n: number, i: number, j: number, predictor: Predictor): number {
  const k = j * n + i;
  if (predictor === 'dx' || j === 0) return i ? q[k - 1] : 0;
  return i ? q[k - 1] + q[k - n] - q[k - n - 1] : q[k - n];
}

/** Metres NAP → int16 centimetre residuals (see file header); `planar` predicts from three neighbours. */
export function encodeTile(heights: Float32Array, n: number, predictor: Predictor = 'dx'): Uint8Array {
  const q = new Int32Array(n * n), out = new Int16Array(n * n);
  for (let k = 0; k < q.length; k++) { const v = heights[k]; q[k] = v === v ? Math.max(-32767, Math.min(32767, Math.round(v * 100))) : NODATA; }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[j * n + i] = ((q[j * n + i] - predict(q, n, i, j, predictor)) << 16) >> 16; // wrap to int16
  return new Uint8Array(out.buffer);
}

export function decodeTile(bytes: Uint8Array, n: number, predictor: Predictor = 'dx'): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < n * n * 2) throw new Error(`ground tile: ${bytes.byteLength} bytes, expected ${n * n * 2}`);
  const q = new Int32Array(n * n), out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    q[k] = ((predict(q, n, i, j, predictor) + view.getInt16(k * 2, true)) << 16) >> 16;
    out[k] = q[k] === NODATA ? NaN : q[k] / 100;
  }
  return out;
}

/** Average `factor`×`factor` blocks of an n×n tile (NaN-aware): the coarse ring's stored grid. */
export function coarsenTile(heights: Float32Array, n: number, factor: number): Float32Array {
  const m = n / factor, out = new Float32Array(m * m);
  for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
    let s = 0, c = 0;
    for (let dy = 0; dy < factor; dy++) for (let dx = 0; dx < factor; dx++) { const v = heights[(j * factor + dy) * n + i * factor + dx]; if (v === v) { s += v; c++; } }
    out[j * m + i] = c ? s / c : NaN;
  }
  return out;
}

/**
 * Bilinear upsample of an m×m cell-centred tile to (m·factor)², edges clamped:
 * the coarse samples' plane, re-gridded so GroundField keeps one step. Seams
 * against finer neighbours stay continuous (the field interpolates between
 * the two tiles' edge samples) and differ by the coarse grid's smoothing only.
 */
export function upsampleTile(coarse: Float32Array, m: number, factor: number): Float32Array {
  const n = m * factor, out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    const fy = Math.min(m - 1, Math.max(0, (j + 0.5) / factor - 0.5)), j0 = Math.floor(fy), j1 = Math.min(m - 1, j0 + 1), v = fy - j0;
    for (let i = 0; i < n; i++) {
      const fx = Math.min(m - 1, Math.max(0, (i + 0.5) / factor - 0.5)), i0 = Math.floor(fx), i1 = Math.min(m - 1, i0 + 1), u = fx - i0;
      out[j * n + i] = (coarse[j0 * m + i0] * (1 - u) + coarse[j0 * m + i1] * u) * (1 - v) + (coarse[j1 * m + i0] * (1 - u) + coarse[j1 * m + i1] * u) * v;
    }
  }
  return out;
}

/** Decode a tile file to the index's `samples`² grid (handles coarse tiles and the predictor). */
export function readGroundTile(index: Pick<GroundIndex, 'stepM' | 'tileSizeM' | 'samples' | 'predictor'>, entry: readonly number[], bytes: Uint8Array): Float32Array {
  const step = entry[3] ?? index.stepM, factor = Math.round(step / index.stepM), m = Math.round(index.tileSizeM / step);
  const h = decodeTile(bytes, m, index.predictor ?? 'dx');
  return factor > 1 ? upsampleTile(h, m, factor) : h;
}

export const tileKey = (tx: number, ty: number) => `${tx}_${ty}`;

/** A set of decoded tiles with bilinear sampling across tile seams (RD metres → metres NAP). */
export class GroundField {
  // Keyed by `tx * 2^21 + ty` (tile indices are small and non-negative in RD), not a `${tx}_${ty}` string:
  // sampleAt runs millions of times while riding (footprint bases, decks, poses) and building the string key
  // per sample was most of its cost (docs/perf-motion-stutter-20261016.md).
  // A measured tile is whole centimetres (decodeTile), so it is kept as its int16 cm samples (NODATA for NaN): half
  // the Float32 bytes, the same heights (2026-10-24, phones: ~24 MB of resident relief per thread). Upsampled and
  // extended tiles are not whole centimetres and stay Float32.
  private readonly tiles = new Map<number, Int16Array | Float32Array>();
  /** The measured step of each tile where it is coarser than `stepM` (the coarse ring's 4 m tiles, upsampled to the grid). */
  private readonly steps = new Map<number, number>();
  private readonly n: number;
  constructor(readonly stepM: number, readonly tileSizeM: number) { this.n = Math.round(tileSizeM / stepM); }
  get samples(): number { return this.n; }
  get tileCount(): number { return this.tiles.size; }

  private static key(tx: number, ty: number): number { return tx * 2097152 + ty; }

  /** `dataStepM`: the spacing the tile was measured at (its index entry), when coarser than the grid it is stored on. */
  addTile(tx: number, ty: number, heights: Float32Array, dataStepM = this.stepM): void {
    if (heights.length !== this.samples * this.samples) throw new Error('ground tile size mismatch');
    const key = GroundField.key(tx, ty);
    this.tiles.set(key, wholeCentimetres(heights) ?? heights);
    if (dataStepM > this.stepM) this.steps.set(key, dataStepM); else this.steps.delete(key);
  }

  removeTile(tx: number, ty: number): void { const key = GroundField.key(tx, ty); this.tiles.delete(key); this.steps.delete(key); }

  /** The measured sample spacing under RD (x, y), metres: finer detail between samples is interpolation, not data. */
  dataStepRd(x: number, y: number): number {
    return this.steps.get(GroundField.key(Math.floor(x / this.tileSizeM), Math.floor(y / this.tileSizeM))) ?? this.stepM;
  }

  /** Grid sample by global column/row index, NaN if its tile is not loaded. */
  sampleAt(gi: number, gj: number): number {
    const n = this.n, tx = Math.floor(gi / n), ty = Math.floor(gj / n);
    const t = this.tiles.get(GroundField.key(tx, ty));
    if (!t) return NaN;
    const v = t[(gj - ty * n) * n + (gi - tx * n)];
    if (t.BYTES_PER_ELEMENT !== 2) return v;
    return v === NODATA ? NaN : Math.fround(v / 100);
  }

  /** Bilinear height at RD (x, y), metres NAP; NaN outside loaded tiles. */
  heightRd(x: number, y: number): number {
    const fx = x / this.stepM - 0.5, fy = y / this.stepM - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    const a = this.sampleAt(i, j), b = this.sampleAt(i + 1, j), c = this.sampleAt(i, j + 1), d = this.sampleAt(i + 1, j + 1);
    if (a !== a || b !== b || c !== c || d !== d) {
      // At the coverage edge use whichever neighbours exist rather than dropping out.
      const known = [[a, (1 - u) * (1 - v)], [b, u * (1 - v)], [c, (1 - u) * v], [d, u * v]].filter(([h]) => h === h);
      if (!known.length) return NaN;
      const w = known.reduce((s, [, k]) => s + k, 0);
      return w > 1e-9 ? known.reduce((s, [h, k]) => s + h * k, 0) / w : known[0][0];
    }
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
}

/** The tile as int16 centimetres when that is exact (every sample NaN or a Float32 `q / 100`), else null. */
function wholeCentimetres(heights: Float32Array): Int16Array | null {
  const out = new Int16Array(heights.length);
  for (let k = 0; k < heights.length; k++) {
    const v = heights[k];
    if (v !== v) { out[k] = NODATA; continue; }
    const q = Math.round(v * 100);
    if (q < -32767 || q > 32767 || Math.fround(q / 100) !== v) return null;
    out[k] = q;
  }
  return out;
}

/**
 * A tile the extract lacks, extended from its resident neighbours (`use`
 * picks which may contribute): their samples on a 3×3-tile canvas, pull-push
 * filled, centre kept. Continuous with every neighbour and flattening toward
 * their mean, instead of the flat fallback's step at the extract's edge.
 */
export function extendTile(field: GroundField, tx: number, ty: number, use: (tx: number, ty: number) => boolean): Float32Array {
  const n = field.samples, w = 3 * n, data = new Float32Array(w * w).fill(NaN);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if ((!dx && !dy) || !use(tx + dx, ty + dy)) continue;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) data[((dy + 1) * n + j) * w + (dx + 1) * n + i] = field.sampleAt((tx + dx) * n + i, (ty + dy) * n + j);
  }
  pullPushFill({ width: w, height: w, data });
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) out.set(data.subarray((n + j) * w + n, (n + j) * w + 2 * n), j * n);
  return out;
}

/**
 * Local scene frame → RD as a quadratic in centred, scaled coordinates:
 * x' = Σ a_k·m_k(u, v), y' = Σ b_k·m_k(u, v), with m = [1, u, v, u², uv, v²],
 * u = (x − cx)/r, v = (y − cy)/r. The game's frame is equirectangular around one
 * origin, RD is conformal: over a kilometre they differ by ~0.2 m non-affinely
 * (the cos-latitude scale), which the quadratic absorbs to millimetres.
 */
export interface LocalToRd { cx: number; cy: number; r: number; a: number[]; b: number[] }

export function applyLocalToRd(m: LocalToRd, x: number, y: number): [number, number] {
  const u = (x - m.cx) / m.r, v = (y - m.cy) / m.r, uu = u * u, uv = u * v, vv = v * v;
  return [m.a[0] + m.a[1] * u + m.a[2] * v + m.a[3] * uu + m.a[4] * uv + m.a[5] * vv, m.b[0] + m.b[1] * u + m.b[2] * v + m.b[3] * uu + m.b[4] * uv + m.b[5] * vv];
}

function solve(A: number[][], B: number[]): number[] {
  const n = B.length;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [B[c], B[p]] = [B[p], B[c]];
    for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; B[r] -= f * B[c]; }
  }
  const x = new Array(n).fill(0);
  for (let c = n - 1; c >= 0; c--) { let s = B[c]; for (let k = c + 1; k < n; k++) s -= A[c][k] * x[k]; x[c] = s / A[c][c]; }
  return x;
}

/**
 * Least-squares quadratic from a local scene frame to RD over a square of radius
 * `r` around (cx, cy), from a 9×9 sample of the exact transform. Returns the
 * map and its worst residual over the samples (metres) so callers can assert it.
 */
export function fitLocalToRd(toRd: (x: number, y: number) => [number, number], cx: number, cy: number, r: number): { map: LocalToRd; maxResidualM: number } {
  const rows: number[][] = [], tx: number[] = [], ty: number[] = [];
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
    const u = a / 4, v = b / 4, [rx, ry] = toRd(cx + u * r, cy + v * r);
    rows.push([1, u, v, u * u, u * v, v * v]); tx.push(rx); ty.push(ry);
  }
  // Normal equations, solved relative to the centre value for conditioning.
  const fit = (t: number[]) => {
    const t0 = t[Math.floor(t.length / 2)];
    const A = Array.from({ length: 6 }, () => new Array(6).fill(0)), B = new Array(6).fill(0);
    rows.forEach((m, k) => { for (let i = 0; i < 6; i++) { B[i] += m[i] * (t[k] - t0); for (let j = 0; j < 6; j++) A[i][j] += m[i] * m[j]; } });
    const c = solve(A, B); c[0] += t0; return c;
  };
  const map: LocalToRd = { cx, cy, r, a: fit(tx), b: fit(ty) };
  let maxResidualM = 0;
  rows.forEach((m, k) => { const [x, y] = applyLocalToRd(map, cx + m[1] * r, cy + m[2] * r); maxResidualM = Math.max(maxResidualM, Math.hypot(x - tx[k], y - ty[k])); });
  return { map, maxResidualM };
}
