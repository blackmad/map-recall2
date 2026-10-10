import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {archSlab, setSink, slab} from './nearbar-kit';
import {rawWall, topOf} from './big-kit';
import source from './de-bazel-footprints.json';

/**
 * De Bazel (Vijzelstraat 32, K.P.C. de Bazel 1919-26, Amsterdam School; ex Nederlandsche Handel-Maatschappij, now Stadsarchief).
 * 3DBAG LoD2.2 supplies the stepped massing. Facade rhythm is counted from rectified municipal panoramas
 * (artifacts/landmark-lanes/de-bazel/rect-*.jpg, 40 px/m):
 *  - Vijzelstraat (east, wall 10, 90.2 m): dark basalt plinth with small barred basement windows; four floors of window groups
 *    (groups of four windows at ~1.4 m pitch between wide striped piers, narrow slit windows in the narrow piers); a fifth attic row;
 *    the entrance block (t 44-53) carries four tall slots and the arched portal; shopfronts in the plinth at t 36-42 and 56-61.
 *  - Keizersgracht (north, wall 352, 29.9 m): seven window pairs per floor at 3.1 m pitch, slit windows at both ends, a four-tier oriel and
 *    an arched entrance at the east end.
 *  - South (wall 8): four pairs per floor counted on rect-s1.jpg (its vertical scale is not trustworthy, rows are laid at the N pitch).
 *  - West (wall 152): no photograph, INFERRED from the north rhythm.
 * Not modelled: the sculptures above the entrance, relief ornament panels, stepped corbel courses and the roof terraces.
 */
const BASALT_H = 4.7;

type W = ReturnType<typeof rawWall>;
const ROWS_E = [5.6, 10.0, 14.4, 18.8];
const ROWS_N = [5.4, 9.5, 14.0, 18.5];

export function buildDeBazel(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.SHELL_ONLY) return;
  setSink(Number(process.env.SINK ?? 0.3));
  const wall = (i: number) => rawWall(source as never, i);

  /** Granite/brick stripes ("De Spekkoek") on a run of pier, skipping the listed [t0,t1] window spans. */
  const stripes = (w: W, t0: number, t1: number, y0: number, y1: number, skip: [number, number][]) => {
    for (let y = y0; y < y1; y += 1.5) {
      let a = t0;
      const cuts = skip.filter(s => s[1] > t0 && s[0] < t1).sort((p, q) => p[0] - q[0]);
      const segs: [number, number][] = [];
      for (const c of cuts) { if (c[0] > a) segs.push([a, c[0]]); a = Math.max(a, c[1]); }
      if (a < t1) segs.push([a, t1]);
      for (const [s0, s1] of segs) if (s1 - s0 > 0.3) slab(b, w.f, (s0 + s1) / 2, y, s1 - s0, 0.32, 0.03, 'sandstone');
    }
  };

  const window1 = (w: W, t: number, y: number, ww: number, h: number) => {
    if (t - ww / 2 < 0.15 || t + ww / 2 > w.len - 0.15) return false;
    if (Math.min(topOf(w, t - ww / 2), topOf(w, t + ww / 2)) < y + h + 0.25) return false;
    if (ww > 0.5 && !process.env.NOSILL) slab(b, w.f, t, y - 0.12, ww + 0.3, 0.14, 0.07, 'sandstone');
    slab(b, w.f, t, y, ww + 0.14, h + 0.1, 0.02, 'frame', -0.04);              // reveal frame
    slab(b, w.f, t, y + 0.06, ww - 0.04, h - 0.04, 0.05, 'glass', -0.04);
    if (ww > 0.8) slab(b, w.f, t, y + 0.06, 0.05, h - 0.04, 0.12, 'frame');
    if (ww > 0.8) slab(b, w.f, t, y + h * 0.62, ww - 0.04, 0.05, 0.12, 'frame');
    return true;
  };

  // ---------- Vijzelstraat (east) ----------
  const E = wall(10);
  const groups: number[][] = [[4.0, 5.45, 6.9, 8.4], [14.4, 15.75, 17.1, 18.4], [24.5, 26, 27.5, 29], [37.4, 38.75, 40.1, 41.4],
    [56.2, 57.6, 59], [60.4, 61.75, 63.1], [68.4, 69.9, 71.4, 72.9], [78.1, 79.5, 80.9, 82.3], [88.9]];
  const slits = [10.4, 22.5, 32.4, 66.2, 74.9, 86.9];
  const eSkip: [number, number][] = [];
  for (const g of groups) for (const t of g) eSkip.push([t - 0.55, t + 0.55]);
  for (const s of slits) eSkip.push([s - 0.3, s + 0.3]);
  eSkip.push([44.5, 53]);
  slab(b, E.f, E.len / 2, 0, E.len - 0.6, BASALT_H, 0.22, 'greyBrick');
  stripes(E, 0.3, E.len - 0.3, BASALT_H + 0.1, 24.6, eSkip);
  for (const g of groups) {
    for (const t of g) {
      for (const y of ROWS_E) window1(E, t, y, 0.95, 2.3);
      window1(E, t, 23.3, 0.95, 0.9);
      slab(b, E.f, t, 0.85, 0.9, 1.0, 0.1, 'dark');          // barred basement window
      
    }
    if (g[0] > 80 || g.length < 3 || process.env.NOBAND) continue;
    const t0 = g[0], t1 = g[g.length - 1];
    for (const y of ROWS_E.slice(1)) slab(b, E.f, (t0 + t1) / 2, y - 1.15, t1 - t0 + 1.2, 0.8, 0.07, 'ochre');   // relief panel band under the windows
  }
  for (const t of slits) for (const y of ROWS_E) window1(E, t, y, 0.35, 2.3);
  for (const t of [14.4, 15.75, 17.1, 18.4]) window1(E, t, 21.6, 0.95, 1.5);
  // barred tall windows and the plinth
  for (const [t0, t1] of [[3, 9.2], [24, 30], [56, 61.5]] as [number, number][]) {
    const n = Math.round((t1 - t0) / 1.5);
    for (let k = 0; k < n; k++) { const t = t0 + (k + 0.5) * (t1 - t0) / n; slab(b, E.f, t, 2.6, 1.1, 2.0, 0.08, 'glass'); for (let q = -1; q <= 1; q++) slab(b, E.f, t + q * 0.3, 2.55, 0.035, 2.1, 0.14, 'frame'); }
  }
  // shopfronts (Stadsboekwinkel, restaurant de Bazel) and the entrance block
  for (const [t0, t1] of [[36.5, 42.2], [55.8, 60.9]] as [number, number][]) {
    const c = (t0 + t1) / 2, wd = t1 - t0;
    slab(b, E.f, c, 0.6, wd, 4.0, 0.1, 'glass');
    slab(b, E.f, c, 0.55, wd + 0.2, 0.12, 0.2, 'frame'); slab(b, E.f, c, 4.55, wd + 0.2, 0.12, 0.2, 'frame');
    for (let k = 0; k <= Math.round(wd / 1.4); k++) slab(b, E.f, t0 + k * wd / Math.round(wd / 1.4), 0.6, 0.07, 4.0, 0.16, 'frame');
  }
  slab(b, E.f, 49, 0, 5.0, 5.6, 0.3, 'sandstone');           // portal surround
  slab(b, E.f, 49, 0.05, 2.6, 3.2, 0.42, 'dark');          // door recess
  slab(b, E.f, 49, 3.3, 3.4, 0.35, 0.45, 'sandstone');       // lintel
  for (const t of [46.5, 48.25, 50, 51.75]) slab(b, E.f, t, 6.5, 0.9, 15.4, 0.08, 'glass');     // tall slots over the entrance
  for (const t of [46.5, 48.25, 50, 51.75]) slab(b, E.f, t, 6.4, 1.05, 0.12, 0.2, 'sandstone');
  for (const t of [45.5, 47.4, 49.1, 50.9, 52.6]) slab(b, E.f, t, 6.4, 0.22, 15.6, 0.22, 'sandstone');

  // ---------- Keizersgracht (north) ----------
  const N = wall(352);
  const pairs = [4.25, 7.4, 10.5, 13.6, 16.7, 19.75, 22.9];
  const nSkip: [number, number][] = [];
  for (const c of pairs) nSkip.push([c - 1.05, c + 1.05]);
  nSkip.push([1.55, 2.25], [28.1, 28.7], [24.9, 27.6]);
  slab(b, N.f, N.len / 2, 0, N.len - 0.5, BASALT_H, 0.22, 'greyBrick');
  stripes(N, 0.3, N.len - 0.3, BASALT_H + 0.1, 24.8, nSkip);
  for (const c of pairs) for (const s of [-0.58, 0.58]) {
    for (const y of ROWS_N) window1(N, c + s, y, 0.72, 2.5);
    window1(N, c + s, 22.7, 0.72, 1.4);
    slab(b, N.f, c + s, 1.1, 0.7, 0.9, 0.1, 'dark');
  }
  for (const t of [1.9, 28.4]) for (const y of ROWS_N) window1(N, t, y, 0.3, 2.5);
  for (const [y, h] of [[6.4, 1.9], [10.0, 2.8], [14.5, 2.9], [18.9, 2.9]] as [number, number][]) {   // four-tier oriel
    slab(b, N.f, 26.2, y - 0.35, 2.9, 0.35, 0.65, 'sandstone', 0.0);
    slab(b, N.f, 26.2, y, 2.6, h, 0.5, 'brick', 0.0);
    slab(b, N.f, 26.2, y + 0.2, 2.3, h - 0.45, 0.06, 'glass', 0.5);
    for (const t of [25.4, 26.2, 27.0]) slab(b, N.f, t, y + 0.2, 0.05, h - 0.45, 0.1, 'frame', 0.5);
  }
  archSlab(b, N.f, 26.2, 0.0, 2.4, 3.1, 0.35, 'dark', 0.1);   // arched entrance
  slab(b, N.f, 26.2, 3.1, 3.0, 0.3, 0.4, 'sandstone');

  // ---------- South (wall 8, 22.3 m) and west (wall 152, inferred) ----------
  const rhythm = (index: number, centres: number[]) => {
    const w = wall(index);
    slab(b, w.f, w.len / 2, 0, w.len - 0.5, BASALT_H, 0.22, 'greyBrick');
    const skip: [number, number][] = centres.map(c => [c - 1.05, c + 1.05]);
    stripes(w, 0.3, w.len - 0.3, BASALT_H + 0.1, 24.8, skip);
    for (const c of centres) for (const s of [-0.58, 0.58]) {
      for (const y of ROWS_N) window1(w, c + s, y, 0.72, 2.5);
      window1(w, c + s, 22.7, 0.72, 1.4);
      slab(b, w.f, c + s, 1.1, 0.7, 0.9, 0.1, 'dark');
    }
  };
  const S = wall(8);
  rhythm(8, [2.2, 6.7, 11.1, 15.5, 19.8].filter(c => c < S.len - 1.2));
  const Wst = wall(152);
  const wc: number[] = []; for (let c = 3.2; c < Wst.len - 1.5; c += 3.1) wc.push(c);
  rhythm(152, wc);
  setSink(0);
}
