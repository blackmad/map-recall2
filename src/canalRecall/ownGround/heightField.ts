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
  /** [tx, ty, measured fraction 0..1] */
  tiles: [number, number, number][];
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

/** Metres NAP → delta-coded int16 centimetres (see file header). */
export function encodeTile(heights: Float32Array, n: number): Uint8Array {
  const out = new Int16Array(n * n);
  for (let j = 0; j < n; j++) {
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const v = heights[j * n + i];
      const q = v === v ? Math.max(-32767, Math.min(32767, Math.round(v * 100))) : NODATA;
      out[j * n + i] = ((q - prev) << 16) >> 16; // wrap to int16
      prev = q;
    }
  }
  return new Uint8Array(out.buffer);
}

export function decodeTile(bytes: Uint8Array, n: number): Float32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < n * n * 2) throw new Error(`ground tile: ${bytes.byteLength} bytes, expected ${n * n * 2}`);
  const out = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    let prev = 0;
    for (let i = 0; i < n; i++) {
      const q = ((prev + view.getInt16((j * n + i) * 2, true)) << 16) >> 16;
      prev = q;
      out[j * n + i] = q === NODATA ? NaN : q / 100;
    }
  }
  return out;
}

export const tileKey = (tx: number, ty: number) => `${tx}_${ty}`;

/** A set of decoded tiles with bilinear sampling across tile seams (RD metres → metres NAP). */
export class GroundField {
  private readonly tiles = new Map<string, Float32Array>();
  constructor(readonly stepM: number, readonly tileSizeM: number) {}
  get samples(): number { return Math.round(this.tileSizeM / this.stepM); }
  get tileCount(): number { return this.tiles.size; }

  addTile(tx: number, ty: number, heights: Float32Array): void {
    if (heights.length !== this.samples * this.samples) throw new Error('ground tile size mismatch');
    this.tiles.set(tileKey(tx, ty), heights);
  }

  removeTile(tx: number, ty: number): void { this.tiles.delete(tileKey(tx, ty)); }

  /** Grid sample by global column/row index, NaN if its tile is not loaded. */
  sampleAt(gi: number, gj: number): number {
    const n = this.samples, tx = Math.floor(gi / n), ty = Math.floor(gj / n);
    const t = this.tiles.get(tileKey(tx, ty));
    return t ? t[(gj - ty * n) * n + (gi - tx * n)] : NaN;
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
