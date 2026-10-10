import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {setSink, slab} from './nearbar-kit';
import {rawWall} from './big-kit';
import source from './ceramiquelaan-437-footprints.json';

/**
 * Cramiquelaan 437-723 / Docklandsweg 11-13 (BAG 0363100012252989, 2021; Buiksloterham, 108 flats): a perimeter block around a courtyard,
 * stepped 16.5 / 19.6 / 22.9 m, in mottled grey-brown brick with deep-set punched windows (about 1.7 x 2.05 m, 3.03 m floor pitch, first upper
 * row bottom at 4.5 m) over timber-framed glazed ground bays. Rhythm read from rectified municipal panoramas
 * (artifacts/landmark-lanes/ceramiquelaan-437, 16 px/m, t in m from the viewer's left):
 *  - S wall 36 (20.4 m, ref-s1.jpg): 8 columns, timber-lined entrance gap t 5.6-9.4 (two storeys) with loggias above, balcony recesses t 15.8-17.5.
 *  - S wall 489 (16 m, ref-s2.jpg): 6 columns, entrance gap t 3.7-9.4, loggias t 7.3-9.4.
 *  - E walls 512 (27.4 m, ref-e1.jpg) and 707 (24.9 m, ref-e2.jpg): ten and nine columns, concrete balconies with glass balustrades (positions measured, 1.5 m deep estimated).
 *  - N wall 645 (20.6 m, ref-n.jpg): 8 columns, gold-lined entrance portal t 4.8-8.3, loggias at t 4.7-6.6 and 14.4-16.1.
 * INFERRED (no usable panorama): W walls (313, 226, 89, 114, 113), every courtyard wall and the upper setbacks: the same window module, no invented features.
 * Not modelled: roof terraces and plant, bicycle racks, scaffolding, shop signage, the brick relief.
 */
const WW = 1.7, WH = 2.05;
type Row = number[];
type Spec = {
  rows: Record<number, Row>;                 // k -> window centres (m); k = 0 is the first upper floor (bottom 4.5 m)
  loggias?: [number, number, number][];      // t0, t1, k
  gaps?: [number, number, number][];         // t0, t1, top y: deep recess from the ground
  bays: [number, number][];                  // ground glazing
  balconies?: [number, number, number][];    // floor y, t0, t1
  gold?: [number, number, number, number];   // t0, t1, y0, y1 lined portal
};
const SPEC: Record<number, Spec> = {
  36: {
    rows: {4: [1.25, 3.9, 6.0, 8.06, 10.6, 13.1, 15.7, 18.3], 3: [1.25, 3.9, 9.4, 12.0, 14.7, 17.3, 19.8], 2: [1.25, 3.9, 9.4, 12.0, 14.7, 17.3, 19.8], 1: [1.25, 3.9, 11.2, 13.8, 19.2], 0: [1.25, 3.9, 11.2, 13.8, 19.2]},
    loggias: [[5.6, 7.6, 3], [5.6, 7.6, 2], [15.8, 17.5, 1], [15.8, 17.5, 0]], gaps: [[5.6, 9.4, 9.8]],
    bays: [[0.5, 2.0], [3.1, 4.7], [12.2, 13.9], [14.8, 17.0], [17.5, 19.0]],
  },
  489: {
    rows: {4: [1.5, 4.2, 6.9, 11.2, 14.0], 3: [0.4, 2.65, 5.4, 11.2, 14.0], 2: [0.4, 2.65, 5.4, 11.2, 14.0], 1: [0.9, 3.7, 11.2, 14.0], 0: [0.9, 3.7, 11.2, 14.0]},
    loggias: [[7.3, 9.4, 3], [7.3, 9.4, 2]], gaps: [[5.5, 9.4, 9.9], [3.7, 9.4, 3.9]],
    bays: [[0.9, 2.8], [10.3, 12.2], [13.1, 15.0]],
  },
  512: {
    rows: {4: [7.25, 9.9, 17.75, 20.4, 23.0, 25.6], 3: [1.9, 9.8, 12.4, 20.4, 23.0, 25.6], 2: [7.25, 9.8, 17.75, 20.3, 22.8], 1: [1.8, 9.85, 12.5, 20.3, 23.0], 0: [1.9, 4.5, 7.2, 12.4, 15.2, 17.7, 20.25]},
    bays: [[0.9, 2.7], [3.7, 5.5], [6.4, 8.1], [9.0, 10.6], [11.6, 13.3], [14.2, 15.9], [16.8, 18.6], [19.5, 21.25], [22.2, 23.6]],
    balconies: [[15.6, 2.0, 7.8], [15.6, 14.3, 19.5], [12.0, 0.0, 5.3], [12.0, 11.2, 16.4], [12.0, 22.3, 25.5], [8.6, 2.0, 7.8], [8.6, 14.3, 19.5], [5.2, 11.2, 16.4]],
  },
  707: {
    rows: {4: [1.8, 4.3, 6.9, 9.5, 17.2, 19.8, 22.4], 3: [4.3, 6.9, 14.7, 17.2, 19.6], 2: [6.9, 9.5, 17.2, 19.75, 22.4], 1: [4.4, 6.9, 14.7, 17.2], 0: [4.4, 6.9, 9.5, 14.7, 17.2, 19.75]},
    bays: [[0.8, 2.5], [3.4, 5.2], [6.1, 7.8], [8.6, 10.5], [11.25, 13.0], [13.75, 15.5], [16.4, 18.0], [19.0, 20.5], [21.7, 23.3]],
    balconies: [[15.8, 7.8, 13.3], [15.8, 19.1, 24.9], [12.3, 11.1, 16.4], [12.3, 0.0, 5.2], [12.3, 21.7, 24.9], [8.75, 7.8, 13.3], [8.75, 19.1, 24.9], [5.5, 11.1, 16.4], [5.3, 0.0, 5.2], [5.3, 21.7, 24.9]],
  },
  645: {
    rows: {3: [0.5, 2.8, 8.1, 10.6, 13.2, 15.8, 18.3], 2: [0.5, 2.8, 8.1, 10.6, 13.2, 15.8, 18.3], 1: [0.5, 2.8, 9.8, 12.4, 17.5, 20.0], 0: [0.5, 2.8, 9.8, 12.4, 17.5, 20.0]},
    loggias: [[4.7, 6.6, 3], [4.7, 6.6, 2], [14.4, 16.1, 1], [14.4, 16.1, 0]], gold: [4.8, 8.3, 0.4, 9.8],
    bays: [[0.2, 1.1], [2.0, 3.75], [10.9, 12.3], [13.5, 14.8], [16.1, 17.5], [18.75, 20.0]],
  },
};

export function buildCeramiquelaan437(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'greyBrick', roof: 'slate'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  const wall = (i: number) => rawWall(source as never, i);
  type F = ReturnType<typeof wall>['f'];
  const win = (f: F, top: number, t: number, y: number, w = WW, h = WH) => {
    h = Math.min(h, top - 0.3 - y);
    if (h < 0.6) return;
    slab(b, f, t, y - 0.05, w + 0.1, h + 0.1, 0.08, 'frame');
    slab(b, f, t, y, w, h, 0.12, 'glass');
    slab(b, f, t, y, 0.06, h, 0.15, 'frame');
  };
  const rowY = (k: number) => 4.5 + 3.03 * k;
  const observed = new Set(Object.keys(SPEC).map(Number));

  for (const [key, sp] of Object.entries(SPEC)) {
    const w = wall(+key), f = w.f;
    for (const [ks, cols] of Object.entries(sp.rows)) for (const t of cols) win(f, w.top, t, rowY(+ks));
    for (const [a, c] of sp.bays) win(f, w.top, (a + c) / 2, 0.4, c - a, 3.2);
    for (const [a, c, k] of sp.loggias ?? []) { slab(b, f, (a + c) / 2, rowY(k) - 0.05, c - a, WH + 0.1, 0.12, 'dark'); slab(b, f, (a + c) / 2, rowY(k), c - a - 0.2, 0.9, 0.06, 'glass', 0.08); }
    for (const [a, c, y1] of sp.gaps ?? []) slab(b, f, (a + c) / 2, 0.4, c - a, y1 - 0.4, 0.14, 'ochre');
    if (sp.gold) { const [a, c, y0, y1] = sp.gold; slab(b, f, (a + c) / 2, y0, c - a, y1 - y0, 0.16, 'gold'); slab(b, f, 8.35, 0.4, 3.3, 2.7, 0.2, 'gold'); }
    for (const [y, a, c] of sp.balconies ?? []) {
      const hi = Math.min(c, w.len);
      slab(b, f, (a + hi) / 2, y - 0.32, hi - a, 0.32, 1.5, 'concrete');
      slab(b, f, (a + hi) / 2, y, hi - a, 1.05, 0.05, 'glass', 1.45);
    }
  }
  // ---------- INFERRED walls: the same module, evenly spread, no features ----------
  source.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface' || observed.has(i)) return;
    const w = wall(i);
    if (w.len < 4 || w.top - w.base < 2.8) return;
    const n = Math.max(1, Math.round(w.len / 2.75));
    const y0 = w.base < 0.5 ? 4.5 : w.base + 1.4;
    for (let c = 0; c < n; c++) {
      const t = (c + 0.5) * w.len / n;
      for (let y = y0; y + WH + 0.35 <= w.top; y += 3.03) win(w.f, w.top, t, y);
      if (w.base < 0.5 && w.top > 8) win(w.f, w.top, t, 0.4, 1.7, 3.2);
    }
  });
  setSink(0);
}
