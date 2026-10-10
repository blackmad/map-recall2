import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab, letters, disc} from './nearbar-kit';
import {rawWall} from './big-kit';
import source from './haarlemmerweg-333-footprints.json';

/**
 * Haarlemmerweg 333 / Van Slingelandtplein 2-4 (BAG 0363100012088027, 2001; 3,294 m2 L-shaped office block, 19 m with a 23 m set-back
 * penthouse): terracotta-red cladding over a grey ground floor of glazed shop bays between grey piers, ribbon windows about 2.8 x 1.45 m
 * at a 3.55 m storey pitch. Rhythm read from rectified municipal panoramas (artifacts/landmark-lanes/haarlemmerweg-333, 16 px/m; t runs
 * along the viewer's right as in big-kit rawWall):
 *  - N wall 73 (43.9 m, ref-n2b.jpg, 2020-01 leafless): 12 columns x 4 rows, ground piers every 7.2 m, dark fascia with shop signs.
 *  - N wall 75 (48.7 m, ref-n1c.jpg, 2021-03 leafless): grey base to 6.9 m with a row of nine small windows, five glazed ground bays,
 *    10 + 1 dark red-storey columns x 3 rows, entrance t 41.3-44.2, dark glazed stair core t 44.4-47.2.
 *  - E wall 79 (14.6 m, ref-e1.jpg, 2019-11): 4 columns x 3 rows, SPACES sign band at 7.3-8.6 m with a yellow disc.
 *  - E wall 18 (29.8 m, ref-e2.jpg, 2025-10): red band over a grey base, tall stair window, garage door and glazed bays.
 *  - S wall 127 (36.3 m, ref-s.jpg, 2025-10): 10 columns x 2 rows over a 3.6 m grey base with five glazed bays.
 * INFERRED (no photograph from that side): every other wall (the south face of the north wing, the courtyard walls, the low east
 * wing), drawn with the same window module; the west gable 98 is plain brick (the only visible part above the neighbour is blank).
 * Not modelled: roof plant, shop signage text other than SPACES, the red storey's overhang over the grey base, the recessed east corner.
 */
type Win = {sills: number[]; cols: number[]; w: number; h: number; mat?: string};
type Spec = {
  base?: [number, number, number];        // grey ground band: t0, t1, top y
  wins: Win[];
  bays?: [number, number, number, number][]; // t0, t1, y0, y1 glazed
  fascia?: [number, number, number, number]; // t0, t1, y0, y1 dark soffit/fascia
};
const pitch = (t0: number, step: number, n: number) => Array.from({length: n}, (_, k) => +(t0 + step * k).toFixed(2));
const SPEC: Record<number, Spec> = {
  73: {
    base: [0, 43.9, 4.3],
    wins: [{sills: [6.0, 9.55, 13.1, 16.65], cols: pitch(2.25, 3.575, 12), w: 2.8, h: 1.45}],
    bays: [[1.0, 7.3, 0.4, 3.4], [8.3, 14.5, 0.4, 3.4], [15.5, 21.6, 0.4, 3.4], [22.6, 28.6, 0.4, 3.4], [29.6, 35.5, 0.4, 3.4], [36.5, 42.7, 0.4, 3.4]],
    fascia: [0.8, 43.1, 3.5, 4.3],
  },
  75: {
    base: [2.5, 48.7, 6.9],
    wins: [
      {sills: [5.2], cols: [7.4, 10.75, 14.05, 17.3, 20.75, 23.95, 27.25, 30.6, 33.9], w: 2.6, h: 1.5},
      {sills: [8.9, 12.4, 15.8], cols: pitch(5.8, 3.58, 10), w: 2.8, h: 1.4},
      {sills: [8.9, 12.4, 15.8], cols: [41.55], w: 2.8, h: 1.4, mat: 'dark'},
    ],
    bays: [[3.4, 8.75, 0.4, 3.0], [9.5, 15.3, 0.4, 3.0], [16.1, 22.2, 0.4, 3.0], [22.6, 28.6, 0.4, 3.0], [29.25, 35.3, 0.4, 3.0], [37.1, 39.2, 1.3, 6.3], [41.3, 44.0, 3.6, 6.9]],
    fascia: [3.4, 35.3, 3.0, 3.8],
  },
  79: {
    base: [0, 14.6, 7.0],
    wins: [{sills: [5.3, 8.9, 12.3, 15.6], cols: [2.1, 5.5, 8.9, 12.3], w: 2.7, h: 1.45}],
    bays: [[0.5, 6.9, 0.4, 3.3], [7.5, 11.9, 0.4, 3.1]],
  },
  18: {
    base: [5.6, 29.8, 6.9],
    wins: [
      {sills: [5.2], cols: pitch(10.75, 3.15, 6), w: 2.55, h: 1.3},
      {sills: [9.0], cols: [6.65, 10.2, 13.75, 17.3, 20.75, 24.2, 27.7], w: 2.9, h: 1.5},
    ],
    bays: [[12.5, 15.1, 0.5, 3.2], [15.7, 21.0, 0.5, 3.2], [22.1, 27.8, 0.5, 3.2], [28.6, 29.8, 0.5, 3.2], [6.0, 7.9, 1.5, 6.0]],
    fascia: [9.6, 29.8, 3.2, 3.8],
  },
  127: {
    base: [0, 36.27, 3.6],
    wins: [{sills: [5.25, 8.8], cols: pitch(1.4, 3.65, 10), w: 2.9, h: 1.5}],
    bays: [[0.2, 6.4, 0.5, 2.7], [7.2, 13.8, 0.5, 2.7], [14.6, 21.0, 0.5, 2.7], [21.8, 28.2, 0.5, 2.7], [29.0, 35.4, 0.5, 2.7]],
    fascia: [0, 36.27, 2.7, 3.6],
  },
};
const BLANK = new Set([98]);

export function buildHaarlemmerweg333(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'red', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);
  type F = ReturnType<typeof wall>['f'];
  const win = (f: F, top: number, t: number, y: number, w: number, h: number, mat = 'glass') => {
    h = Math.min(h, top - 0.3 - y);
    if (h < 0.6) return;
    slab(b, f, t, y - 0.06, w + 0.12, h + 0.12, 0.08, 'frame');
    slab(b, f, t, y, w, h, 0.12, mat);
    slab(b, f, t, y, 0.05, h, 0.15, 'frame');
  };
  const observed = new Set(Object.keys(SPEC).map(Number));
  for (const [key, sp] of Object.entries(SPEC)) {
    const w = wall(+key), f = w.f;
    if (sp.base) { const [a, c, y1] = sp.base; slab(b, f, (a + c) / 2, 0, c - a, y1, 0.1, 'concrete'); }
    if (sp.fascia) { const [a, c, y0, y1] = sp.fascia; slab(b, f, (a + c) / 2, y0, c - a, y1 - y0, 0.2, 'dark'); }
    for (const [a, c, y0, y1] of sp.bays ?? []) {
      win(f, w.top, (a + c) / 2, y0, c - a, y1 - y0, 'glass');
      const n = Math.max(1, Math.round((c - a) / 1.9));
      for (let k = 1; k < n; k++) slab(b, f, a + (c - a) * k / n, y0, 0.07, y1 - y0, 0.16, 'frame');
    }
    for (const g of sp.wins) for (const s of g.sills) for (const t of g.cols) win(f, w.top, t, s, g.w, g.h, g.mat ?? 'glass');
  }
  // Wall 75: entrance door, dark glazed stair core.
  { const w = wall(75), f = w.f;
    slab(b, f, 42.65, 0, 2.9, 3.4, 0.16, 'glass'); slab(b, f, 43.4, 0, 1.2, 3.0, 0.2, 'dark');
    slab(b, f, 45.8, 0.4, 2.8, 17.1, 0.14, 'dark'); for (let y = 3.4; y < 17.4; y += 3.55) slab(b, f, 45.8, y, 2.8, 0.1, 0.2, 'frame'); }
  // Wall 79: SPACES sign band on a canopy, yellow disc.
  { const w = wall(79), f = w.f;
    slab(b, f, 7.25, 7.3, 13.3, 1.3, 0.4, 'dark');
    letters(b, f, 'SPACES', 4.8, 7.65, 0.4, 0.15, 0.04, 'white');
    disc(b, f, 12.5, 7.95, 0.8, 0.05, 'gold', 0.4); }
  // ---------- INFERRED walls: the same module, evenly spread ----------
  source.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || observed.has(i) || BLANK.has(i)) return;
    const w = wall(i);
    if (w.len < 4 || w.top - w.base < 2.8 || w.base > 11.5) return;
    const n = Math.max(1, Math.round((w.len - 1) / 3.6));
    const ground = w.base < 0.5;
    const s0 = ground ? (w.top > 8 ? 5.25 : 99) : w.base + 1.45;
    for (let c = 0; c < n; c++) {
      const t = (c + 0.5) * w.len / n;
      for (let y = s0; y + 1.5 + 0.5 <= w.top; y += 3.55) win(w.f, w.top, t, y, 2.8, 1.45);
    }
    if (ground && w.top >= 4) {
      const nb = Math.max(1, Math.round(w.len / 7.1));
      for (let k = 0; k < nb; k++) win(w.f, w.top, (k + 0.5) * w.len / nb, 0.5, w.len / nb - 0.9, Math.min(2.2, w.top - 1.2));
    }
  });
  setSink(0);
}
