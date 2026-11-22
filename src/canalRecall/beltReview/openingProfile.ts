/**
 * Belt windows lane (2026-11-22): the windows of a storey band found on the rectified crop's pixels, the way pixelProfile.ts
 * reads storey lines off a grid. Within the band, a pixel is "not wall" when its colour is far from the wall's (the band's
 * commonest colour bin): glass, frames and bars are, the brick or paint between the windows is not. A column profile of the
 * not-wall share finds the window columns; within each, a row profile finds the frame's top and bottom. Inside each window a
 * brightness profile finds bright (or dark) bars: the mullions, the transom and the rails.
 *
 * Trees, shadows, awnings and parked bikes break the profiles; the lane checks every result by eye on an overlay and
 * records the method per value (houseLine/openingGrid.ts OpeningRow.by). Pure: the caller hands in RGB pixels.
 */

export interface RgbImage { width: number; height: number; /** RGB, 3 bytes a pixel, row-major. */ data: Uint8Array | Buffer }
export interface PxBox { x0: number; x1: number; y0: number; y1: number }
export interface BandWindows {
  /** The wall colour the band was read against. */
  wall: [number, number, number];
  /** The not-wall share per column (x over the crop). */
  columns: number[];
  windows: PxBox[];
}

const lum = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** The band's commonest colour (bins of 16 per channel), averaged over that bin's pixels. */
export function wallColour(img: RgbImage, y0: number, y1: number, x0 = 0, x1 = img.width): [number, number, number] {
  const counts = new Map<number, [number, number, number, number]>();
  for (let y = Math.max(0, y0); y < Math.min(img.height, y1); y++) for (let x = Math.max(0, x0); x < Math.min(img.width, x1); x++) {
    const i = (y * img.width + x) * 3, r = img.data[i], g = img.data[i + 1], b = img.data[i + 2];
    const k = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4), c = counts.get(k) ?? [0, 0, 0, 0];
    c[0]++; c[1] += r; c[2] += g; c[3] += b; counts.set(k, c);
  }
  let best: [number, number, number, number] = [1, 128, 128, 128];
  for (const c of counts.values()) if (c[0] > best[0]) best = c;
  return [best[1] / best[0], best[2] / best[0], best[3] / best[0]];
}

/** Runs of indices where `v[i] >= t`, at least `min` long. */
export function runsOver(v: readonly number[], t: number, min: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start = -1;
  for (let i = 0; i <= v.length; i++) {
    const on = i < v.length && v[i] >= t;
    if (on && start < 0) start = i;
    if (!on && start >= 0) { if (i - start >= min) out.push([start, i]); start = -1; }
  }
  return out;
}
const smooth = (v: readonly number[], r: number) => v.map((_, i) => { let s = 0, n = 0; for (let k = Math.max(0, i - r); k <= Math.min(v.length - 1, i + r); k++) { s += v[k]; n++; } return s / n; });

/**
 * The windows in a storey band [y0, y1) between x0 and x1 (crop pixels). `ppm`: the crop's pixels per metre (windows
 * narrower than 0.35 m or lower than 0.5 m are dropped); `tol`: the colour distance that counts as not wall.
 */
export function bandWindows(img: RgbImage, band: { y0: number; y1: number; x0?: number; x1?: number }, ppm: number, tol = 42): BandWindows {
  const X0 = Math.max(0, band.x0 ?? 0), X1 = Math.min(img.width, band.x1 ?? img.width), Y0 = Math.max(0, band.y0), Y1 = Math.min(img.height, band.y1);
  const wall = wallColour(img, Y0, Y1, X0, X1);
  const off = (x: number, y: number) => { const i = (y * img.width + x) * 3; return Math.hypot(img.data[i] - wall[0], img.data[i + 1] - wall[1], img.data[i + 2] - wall[2]) > tol ? 1 : 0; };
  const inset = Math.round((Y1 - Y0) * 0.12), cols: number[] = [];
  for (let x = 0; x < img.width; x++) {
    if (x < X0 || x >= X1) { cols.push(0); continue; }
    let s = 0; for (let y = Y0 + inset; y < Y1 - inset; y++) s += off(x, y);
    cols.push(s / Math.max(1, Y1 - Y0 - 2 * inset));
  }
  const sc = smooth(cols, Math.max(1, Math.round(ppm * 0.03)));
  const inside = sc.slice(X0, X1), lo = Math.min(...inside), hi = Math.max(...inside), t = lo + (hi - lo) * 0.5;
  const windows: PxBox[] = [];
  for (const [a, b] of runsOver(sc, t, Math.round(ppm * 0.35))) {
    const ia = Math.round(a + (b - a) * 0.15), ib = Math.round(b - (b - a) * 0.15), rows: number[] = [];
    for (let y = Y0; y < Y1; y++) { let s = 0; for (let x = ia; x < ib; x++) s += off(x, y); rows.push(s / Math.max(1, ib - ia)); }
    const sr = smooth(rows, Math.max(1, Math.round(ppm * 0.03)));
    const runs = runsOver(sr, Math.max(0.35, Math.min(...sr) + (Math.max(...sr) - Math.min(...sr)) * 0.5), Math.round(ppm * 0.5));
    if (!runs.length) continue;
    const [p, q] = runs.reduce((m, r) => r[1] - r[0] > m[1] - m[0] ? r : m);
    windows.push({ x0: a, x1: b, y0: Y0 + p, y1: Y0 + q });
  }
  return { wall, columns: cols, windows };
}

/**
 * The bars inside a window (its box shrunk by `frame` px): positions (shares across, from the left; down, from the top) where
 * a column's or row's brightness stands out from the glass by `k` of the box's spread. Bright bars on white joinery, dark
 * on dark; `bright` picks which.
 */
export function windowBars(img: RgbImage, w: PxBox, frame: number, bright = true, k = 0.35): { mullions: number[]; rails: number[] } {
  const x0 = w.x0 + frame, x1 = w.x1 - frame, y0 = w.y0 + frame, y1 = w.y1 - frame;
  if (x1 - x0 < 6 || y1 - y0 < 6) return { mullions: [], rails: [] };
  const L = (x: number, y: number) => { const i = (y * img.width + x) * 3; return lum(img.data[i], img.data[i + 1], img.data[i + 2]); };
  const colMean: number[] = [], rowMean: number[] = [];
  for (let x = x0; x < x1; x++) { let s = 0; for (let y = y0; y < y1; y++) s += L(x, y); colMean.push(s / (y1 - y0)); }
  for (let y = y0; y < y1; y++) { let s = 0; for (let x = x0; x < x1; x++) s += L(x, y); rowMean.push(s / (x1 - x0)); }
  const peaks = (v: number[]) => {
    const sv = bright ? v : v.map(a => -a), sorted = [...sv].sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)], top = sorted[sorted.length - 1];
    const t = med + (top - med) * (1 - k);
    return runsOver(sv, t, 1).filter(([a, b]) => a > 1 && b < sv.length - 1).map(([a, b]) => +(((a + b) / 2) / sv.length).toFixed(3));
  };
  return { mullions: peaks(colMean), rails: peaks(rowMean) };
}
