import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall} from './big-kit';
import source from './bogortuin-101-footprints.json';

/**
 * Bogortuin 11-145 (BAG 0363100012141457, 2001; Java-eiland, 2,567 m2 residential slab, flat roof at 24 m, 25 m stepped plan): a
 * dark-brown brick grid of storey-high punched windows (about 2.5 x 1.75 m at a 3.59 m column pitch and a 2.87 m storey pitch, seven
 * upper rows from sill 4.4 m plus a taller glazed ground row at sill 0.65 m). Rhythm read from rectified municipal panoramas
 * (artifacts/landmark-lanes/bogortuin-101, 16 px/m, t along the viewer's right as in big-kit rawWall):
 *  - S wall 1 (75.9 m, ref-s1.jpg, 2020-01): 20 full columns x 8 rows, first column clipped by the corner.
 *  - S wall 12 (42.6 m, ref-s2.jpg, 2016-11, oblique 19 deg): the same grid, 11-12 columns x 8 rows.
 *  - N wall 39 (71 m, ref-n1.jpg, 2018-05, rows 2-8 above a courtyard wall): the same grid.
 *  - E gable wall 36 (25.2 m, ref-e.jpg, 2024-10): plain brick with a stack of four loggias at t 12.3-15.3, a door at t 21.8.
 *  - W gable wall 8 (25.3 m, ref-w.jpg, 2020-01): seven rows of two small square windows at t 5.4 and 16.6 and a central stack of four loggias t 9.5-12.6.
 * INFERRED (no photograph from that side): N wall 2, S wall 3, the west wing walls 6 and 27, the short returns 25, 28, 38: the same grid evenly spread.
 * Not modelled: the loggia depth (dark recess panels), balcony railings, bicycle racks, the roof edge detail, brick relief.
 */
const WW = 2.5, WH = 1.75;
const ROWS = [4.4, 7.27, 10.14, 13.01, 15.88, 18.75, 21.62];
const GROUND_SILL = 0.65, GROUND_H = 2.5;
const PITCH = 3.59;
const pitch = (t0: number, step: number, n: number) => Array.from({length: n}, (_, k) => +(t0 + step * k).toFixed(2));
type Loggia = [number, number, number, number]; // t0, t1, y0, y1
const LOGGIAS: Record<number, Loggia[]> = {
  36: [[12.3, 15.3, 18.4, 23.0], [12.3, 15.3, 12.7, 17.5], [12.3, 15.3, 7.1, 11.75], [12.3, 15.3, 3.8, 6.2]],
  8: [[9.5, 12.6, 18.4, 23.0], [9.5, 12.6, 12.5, 17.4], [9.5, 12.6, 6.7, 11.6], [9.5, 12.6, 0.4, 5.9]],
};
const GABLE_SMALL: Record<number, number[]> = {8: [5.4, 16.6]};

export function buildBogortuin101(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);
  type F = ReturnType<typeof wall>['f'];
  const win = (f: F, top: number, t: number, y: number, w = WW, h = WH) => {
    h = Math.min(h, top - 0.3 - y);
    if (h < 0.6) return;
    slab(b, f, t, y - 0.06, w + 0.12, h + 0.12, 0.08, 'frame');
    slab(b, f, t, y, w, h, 0.12, 'glass');
    slab(b, f, t, y + h / 2, w, 0.05, 0.15, 'frame');
  };
  const grid = (f: F, top: number, cols: number[], widths?: number[]) => {
    cols.forEach((t, i) => {
      const w = widths?.[i] ?? WW;
      for (const y of ROWS) win(f, top, t, y, w);
      win(f, top, t, GROUND_SILL, w, GROUND_H);
    });
  };
  const observed = new Set([1, 36, 8]);
  // Wall 1: 20 full columns plus a clipped first one; the photo's column centres are 0.65 + 3.59 k.
  { const w = wall(1); grid(w.f, w.top, pitch(0.65 + 3.59, PITCH, 20)); grid(w.f, w.top, [0.9], [1.8]); }
  // Gable 36: loggia stack and door.
  { const w = wall(36), f = w.f;
    for (const [a, c, y0, y1] of LOGGIAS[36]) { slab(b, f, (a + c) / 2, y0, c - a, y1 - y0, 0.12, 'dark'); win(f, w.top, (a + c) / 2, y0 + 0.8, 1.5, Math.min(1.5, y1 - y0 - 1.1)); slab(b, f, (a + c) / 2, y0, c - a - 0.2, 1.0, 0.06, 'concrete', 0.12); }
    slab(b, f, 21.8, 0, 1.2, 2.2, 0.12, 'dark'); }
  // Gable 8: small square windows and loggia stack.
  { const w = wall(8), f = w.f;
    for (const t of GABLE_SMALL[8]) for (const c of [22, 19.2, 16.3, 13.5, 10.75, 7.9, 5.1]) win(f, w.top, t, c - 0.7, 1.4, 1.4);
    for (const [a, c, y0, y1] of LOGGIAS[8]) { slab(b, f, (a + c) / 2, y0, c - a, y1 - y0, 0.12, 'dark'); win(f, w.top, (a + c) / 2, y0 + 0.8, 1.5, Math.min(1.5, y1 - y0 - 1.1)); } }
  // Wall 12 and 39 are observed with the same grid; spread evenly to their lengths. Others inferred identically.
  source.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || observed.has(i)) return;
    const w = wall(i);
    if (w.len < 4 || w.top - w.base < 2.8) return;
    const n = Math.max(1, Math.round(w.len / PITCH));
    grid(w.f, w.top, Array.from({length: n}, (_, k) => (k + 0.5) * w.len / n));
  });
  setSink(0);
}
