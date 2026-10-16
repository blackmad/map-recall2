/**
 * Pixel texture of a rectified facade crop, accumulated per measurement cell so any set of cells (the wall of one
 * storey band, one cluster) can be pooled: brick is told from paint, render and concrete by its course lines, not by
 * its colour, and the brick colour is read from the brick faces between the mortar lines.
 *
 * At the crops' 50 px/m a Dutch course (waalformaat 50 mm + 12 mm joint ~ 62 mm; the modern thin-joint and long formats
 * 5..7 cm) is a vertical period of 2.5..3.5 px: close to the sampling limit, so the statistics are pooled over many cells
 * rather than read cell by cell. Per cell, on the luma Y of valid pixels:
 *
 * - `ev`, `eh`: energy of the vertical and horizontal second difference (Y - mean of the two neighbours). Bed joints
 *   are continuous horizontal lines every course, head joints are short and four times sparser, so brick is strongly
 *   anisotropic (ev > eh); paint, render and glass are smooth (both low) and concrete or stucco texture is isotropic.
 * - `s0`, `s[l]` (l = 1..6): autocorrelation sums of the vertical high pass d(y) = Y(y) - mean(Y(y-3..y+3)) at lag l
 *   (pairs inside the image, booked on the upper pixel's cell): the course period shows as a peak at lag 2..4 against
 *   a trough at lag 1..2.
 * - `s3`: the third moment of the second difference, the mortar's polarity: thin dark joints between lighter faces skew
 *   it negative, light joints positive.
 *
 * Pure: no I/O.
 */
import type {FacadeBox, FacadeImage, Rgb} from './measureFacade.ts';

export interface CellTexture {
  cols: number; rows: number;
  /** pixels per cell with a full 3x3 neighbourhood */
  n: Float64Array; ev: Float64Array; eh: Float64Array; s3: Float64Array; ymean: Float64Array;
  s0: Float64Array; s: Float64Array[];
}
export const COURSE_LAGS = 6;

const lumaOf = (im: FacadeImage) => {
  const Y = new Float32Array(im.width * im.height), ok = new Uint8Array(im.width * im.height);
  for (let p = 0; p < Y.length; p++) {
    Y[p] = 0.299 * im.rgb[p * 3] + 0.587 * im.rgb[p * 3 + 1] + 0.114 * im.rgb[p * 3 + 2];
    ok[p] = !im.valid || im.valid[p] >= 128 ? 1 : 0;
  }
  return {Y, ok};
};

/** Per-cell texture sums on the measurement grid of `box` (cell metres, row 0 at box.v1). */
export function cellTexture(im: FacadeImage, box: FacadeBox, cell: number): CellTexture {
  const cols = Math.max(1, Math.floor((box.u1 - box.u0) / cell)), rows = Math.max(1, Math.floor((box.v1 - box.v0) / cell)), N = cols * rows;
  const t: CellTexture = {cols, rows, n: new Float64Array(N), ev: new Float64Array(N), eh: new Float64Array(N), s3: new Float64Array(N), ymean: new Float64Array(N), s0: new Float64Array(N), s: Array.from({length: COURSE_LAGS + 1}, () => new Float64Array(N))};
  const {Y, ok} = lumaOf(im), W = im.width, H = im.height;
  // vertical high pass (7 px box) where the whole window is valid
  const d = new Float32Array(W * H), dOk = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) for (let y = 3; y < H - 3; y++) {
    let s = 0, good = 1; for (let q = -3; q <= 3; q++) { const p = (y + q) * W + x; if (!ok[p]) { good = 0; break; } s += Y[p]; }
    if (good) { d[y * W + x] = Y[y * W + x] - s / 7; dOk[y * W + x] = 1; }
  }
  const cellOf = (x: number, y: number) => {
    const u = (x + 0.5) / im.ppm - box.u0, v = box.v1 - (im.topM - (y + 0.5) / im.ppm);
    const i = Math.floor(u / cell), j = Math.floor(v / cell);
    return i < 0 || j < 0 || i >= cols || j >= rows ? -1 : j * cols + i;
  };
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x; if (!ok[p] || !ok[p - 1] || !ok[p + 1] || !ok[p - W] || !ok[p + W]) continue;
    const k = cellOf(x, y); if (k < 0) continue;
    const hv = Y[p] - (Y[p - W] + Y[p + W]) / 2, hh = Y[p] - (Y[p - 1] + Y[p + 1]) / 2;
    t.n[k]++; t.ev[k] += hv * hv; t.eh[k] += hh * hh; t.s3[k] += hv * hv * hv; t.ymean[k] += Y[p];
    if (dOk[p]) {
      t.s0[k] += d[p] * d[p];
      for (let l = 1; l <= COURSE_LAGS; l++) { const q = p + l * W; if (y + l < H && dOk[q]) t.s[l][k] += d[p] * d[q]; }
    }
  }
  return t;
}

export interface PooledTexture {
  n: number;
  /** mean luma */
  y: number;
  /** RMS of the vertical / horizontal second difference, relative to the mean luma (floored at 20) */
  cv: number; ch: number;
  /** ev / eh: bed joints make brick anisotropic */
  anisotropy: number;
  /** normalised autocorrelation of the vertical high pass at lags 1..6 (index 0 = 1) */
  r: number[];
  /** course score: the best of r(2..4) minus the lower of r(1), r(2) (a period of 2.5..3.5 px) */
  course: number;
  /** skew of the vertical second difference: < 0 dark joints, > 0 light joints */
  skew: number;
}

export function poolTexture(t: CellTexture, cells: Iterable<number>): PooledTexture {
  let n = 0, ev = 0, eh = 0, s3 = 0, ym = 0, s0 = 0; const s = new Array(COURSE_LAGS + 1).fill(0);
  for (const k of cells) { n += t.n[k]; ev += t.ev[k]; eh += t.eh[k]; s3 += t.s3[k]; ym += t.ymean[k]; s0 += t.s0[k]; for (let l = 1; l <= COURSE_LAGS; l++) s[l] += t.s[l][k]; }
  if (!n) return {n: 0, y: 0, cv: 0, ch: 0, anisotropy: 1, r: new Array(COURSE_LAGS).fill(0), course: 0, skew: 0};
  const y = ym / n, ref = Math.max(20, y);
  const r = s.slice(1).map(v => (s0 > 0 ? v / s0 : 0));
  const course = Math.max(r[1], r[2], r[3]) - Math.min(r[0], r[1]);
  const m2 = ev / n;
  return {n, y: +y.toFixed(1), cv: +(Math.sqrt(m2) / ref).toFixed(4), ch: +(Math.sqrt(eh / n) / ref).toFixed(4), anisotropy: +(eh > 0 ? ev / eh : 1).toFixed(3),
    r: r.map(v => +v.toFixed(3)), course: +course.toFixed(3), skew: +(m2 > 0 ? (s3 / n) / Math.pow(m2, 1.5) : 0).toFixed(3)};
}

/**
 * The brick-face colour of a set of cells: the median RGB of the pixels on the faces, not the joints. A pixel is on a
 * joint when its vertical second difference has the mortar's sign (the pooled skew: dark joints when negative) and is
 * larger than `k` times the RMS; the rest are faces. Returns null when there are fewer than 50 face pixels.
 */
export function brickFaceColour(im: FacadeImage, box: FacadeBox, cell: number, cells: Iterable<number>, cols: number, skew: number, k = 0.5): {rgb: Rgb; faces: number; joints: number} | null {
  const {Y, ok} = lumaOf(im), W = im.width, H = im.height, inSet = new Set(cells);
  const xs: number[] = [], rs: number[] = [], gs: number[] = [], bs: number[] = [];
  let joints = 0, e = 0, ne = 0;
  const each = (f: (p: number, hv: number) => void) => {
    for (const kc of inSet) {
      const i = kc % cols, j = (kc - i) / cols;
      const x0 = Math.floor((box.u0 + i * cell) * im.ppm), x1 = Math.floor((box.u0 + (i + 1) * cell) * im.ppm);
      const vt = box.v1 - j * cell, y0 = Math.floor((im.topM - vt) * im.ppm), y1 = Math.floor((im.topM - vt + cell) * im.ppm);
      for (let y = Math.max(1, y0); y < Math.min(H - 1, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        const p = y * W + x; if (!ok[p] || !ok[p - W] || !ok[p + W]) continue;
        f(p, Y[p] - (Y[p - W] + Y[p + W]) / 2);
      }
    }
  };
  each((_, hv) => { e += hv * hv; ne++; });
  if (!ne) return null;
  const rms = Math.sqrt(e / ne), sign = skew < 0 ? -1 : 1;
  each((p, hv) => {
    if (hv * sign > k * rms) { joints++; return; }
    xs.push(p); rs.push(im.rgb[p * 3]); gs.push(im.rgb[p * 3 + 1]); bs.push(im.rgb[p * 3 + 2]);
  });
  if (xs.length < 50) return null;
  const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  return {rgb: [med(rs), med(gs), med(bs)], faces: xs.length, joints};
}
