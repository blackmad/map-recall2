/**
 * Cheap front read for the repeated-buildings front check (2026-11-15): a footprint match is only a candidate filter,
 * the front decides group membership. From a rectified straight-on elevation (pand-reference `front.jpg`, x along the
 * wall, y down, `ppm` pixels per metre, mid-grey = no data) this reads:
 *
 *   - `wall`: the wall colour, the median of the pixels between the 30th and 80th lightness percentiles (glass, shadow,
 *     white trim and sky fall outside), as hex and OKLab;
 *   - `bays`: window columns, runs of columns where at least `DARK_COL` of the facade height is darker than 0.72 x the
 *     wall lightness (openings read dark against brick or render), each run at least 0.45 m wide;
 *   - `rows`: window rows (storeys with windows), the same on the row profile, each at least 0.6 m tall;
 *   - `glazing`: the dark share of the valid facade.
 *
 * Noisy by design (trees, cars, reflections): it splits a footprint group into front families for the montage, which an
 * opus reviewer then reads. Pure; pixels in, numbers out.
 */

export interface FrontRead { validShare: number; wall: {hex: string; L: number; a: number; b: number}; bays: number; rows: number; glazing: number; widthM: number; heightM: number }

const lin = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export function oklab(r: number, g: number, b: number): [number, number, number] {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/** Pixels the rectifier left empty: flat mid-grey (128 ± 3 on every channel). */
const isNoData = (r: number, g: number, b: number) => Math.abs(r - 128) <= 3 && Math.abs(g - 128) <= 3 && Math.abs(b - 128) <= 3;

export const DARK_COL = 0.22, DARK_ROW = 0.18, DARK_FACTOR = 0.72;

function runs(profile: number[], threshold: number, minLen: number): number {
  let n = 0, len = 0;
  for (let i = 0; i <= profile.length; i++) {
    if (i < profile.length && profile[i] >= threshold) len++;
    else { if (len >= minLen) n++; len = 0; }
  }
  return n;
}
const smooth = (p: number[], k: number) => p.map((_, i) => { let s = 0, n = 0; for (let j = i - k; j <= i + k; j++) if (j >= 0 && j < p.length) { s += p[j]; n++; } return s / n; });

export function readFront(data: Uint8Array | Buffer, width: number, height: number, channels: number, ppm: number): FrontRead | null {
  const N = width * height, valid = new Uint8Array(N), L = new Float32Array(N);
  let nValid = 0;
  for (let i = 0; i < N; i++) {
    const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
    if (isNoData(r, g, b)) continue;
    valid[i] = 1; nValid++; L[i] = oklab(r, g, b)[0];
  }
  if (nValid < N * 0.2) return null;
  const Ls = [...L.filter((_, i) => valid[i])].sort((a, b) => a - b), q = (f: number) => Ls[Math.floor(f * (Ls.length - 1))];
  const lo = q(0.3), hi = q(0.8);
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  for (let i = 0; i < N; i += 3) if (valid[i] && L[i] >= lo && L[i] <= hi) { rs.push(data[i * channels]); gs.push(data[i * channels + 1]); bs.push(data[i * channels + 2]); }
  const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
  const wr = med(rs), wg = med(gs), wb = med(bs), [wl, wa, wbb] = oklab(wr, wg, wb);
  const dark = DARK_FACTOR * wl;
  const col = new Array(width).fill(0), colN = new Array(width).fill(0), row = new Array(height).fill(0), rowN = new Array(height).fill(0);
  let nDark = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!valid[i]) continue;
    colN[x]++; rowN[y]++;
    if (L[i] < dark) { col[x]++; row[y]++; nDark++; }
  }
  const colP = smooth(col.map((v, x) => (colN[x] > height * 0.2 ? v / colN[x] : 0)), Math.round(ppm * 0.08));
  const rowP = smooth(row.map((v, y) => (rowN[y] > width * 0.2 ? v / rowN[y] : 0)), Math.round(ppm * 0.1));
  return {
    validShare: +(nValid / N).toFixed(2), wall: {hex: hex(wr, wg, wb), L: +wl.toFixed(3), a: +wa.toFixed(3), b: +wbb.toFixed(3)},
    bays: runs(colP, DARK_COL, Math.round(0.45 * ppm)), rows: runs(rowP, DARK_ROW, Math.round(0.6 * ppm)),
    glazing: +(nDark / nValid).toFixed(2), widthM: +(width / ppm).toFixed(1), heightM: +(height / ppm).toFixed(1),
  };
}

/** Two fronts read as one design: same window rows, bays within one (a tree or a car hides one), wall colour close. */
export function sameFront(a: FrontRead, b: FrontRead): {same: boolean; why: string} {
  const dAB = Math.hypot(a.wall.a - b.wall.a, a.wall.b - b.wall.b), dL = Math.abs(a.wall.L - b.wall.L);
  if (a.rows !== b.rows) return {same: false, why: `window rows ${a.rows} vs ${b.rows}`};
  if (Math.abs(a.bays - b.bays) > Math.max(1, Math.round(0.15 * Math.max(a.bays, b.bays)))) return {same: false, why: `bays ${a.bays} vs ${b.bays}`};
  if (dAB > 0.035 || dL > 0.14) return {same: false, why: `wall ${a.wall.hex} vs ${b.wall.hex}`};
  return {same: true, why: 'rows, bays and wall agree'};
}
