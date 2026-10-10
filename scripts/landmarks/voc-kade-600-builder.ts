import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import type {Surface} from './worship-shell';
import {disc, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './voc-kade-600-footprints.json';

/**
 * VOC-kade 600 (Pieter Goosstraat 1 / Van Reedestraat), a 2021 hotel tower (Inntel Hotels) with ground-floor
 * sport/meeting use, on the Oostenburg quay: a 36 x 23 m concrete-frame tower, 52 m, with brick infill.
 * The 3DBAG LoD2.2 shell supplies the tower and the two low dark wings (7 m SE, 10-11 m SW, the black-clad
 * Werkspoor pavilion). Rhythm below is counted per face from the municipal panoramas
 * (artifacts/landmark-lanes/voc-kade-600):
 *  - NE face (street, ref-ne.jpg rectified, 1 px = 1/38 m): 10 bays on a 3.305 m pitch between 0.82 m piers;
 *    each bay is a 1.3 m brick panel plus a 1.15 m tall window (2.5 m clear); the two bays at the north end
 *    stay blank brick (logo disc); concrete bands every 5.45 m (cell = two floors); ground floor steel windows,
 *    brick with a small square window, black shutters, three full-height glazed bays at the north end.
 *  - NW face (quay, ref-nw-up.jpg): concrete grid with steel windows: 6 narrow bays in the first cell, four
 *    (two wide, two narrow) in the next two, then two five-floor stacks of three balcony bays (to the roof).
 *  - SW and SE faces are only seen obliquely or above neighbours and are modelled on the NE rhythm (inferred).
 */
type P = [number, number];
const frameBetween = (p0: P, p1: P): {f: Frame; len: number} => {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), t: P = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len];
  return {f: {origin: p0, tangent: t, n: [-t[1], t[0]]}, len};
};
// Tower corners (native east/south metres) from the 3DBAG walls.
/** Foot of the perpendicular from p on the line a-b (puts a frame exactly on the mapped wall plane). */
const onLine = (p: P, a: P, b: P): P => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]), u: P = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], k = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]; return [a[0] + u[0] * k, a[1] + u[1] * k]; };
const N: P = [1.9, -23.8], E: P = [27.5, 1.7], S: P = [11.5, 18.1], W: P = [-14.4, -7.7];
const ROOF = 51.9, BAND0 = 6.05, PITCH = 5.45, BAND = 0.7;

export function buildVocKade600(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const maxY = (s: Surface) => Math.max(...s.rings[0].map(p => p[1]));
  const low = (s: Surface) => s.type === 'WallSurface' && maxY(s) < 12.5;
  addShell(b, source as never, {wall: 'concrete', roof: 'slate', skip: low});
  const eastWing = (_s: Surface, i: number) => i === 9 || i === 26;   // brick end of the 7 m wing (ref-ne.jpg left edge)
  addShell(b, source as never, {wall: 'dark', roof: 'slate', skip: (s, i) => !low(s) || eastWing(s, i)});
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (s, i) => !(low(s) && eastWing(s, i))});
  b.mark?.('shell');
  if (process.env.VOC_SHELL_ONLY) return;
  setSink(0.3);   // every solid reaches 0.3 m behind its wall plane so nothing hovers

  const piers = (f: Frame, ts: number[], y0: number, y1: number, w = 0.82) => { for (const t of ts) slab(b, f, t + w / 2, y0, w, y1 - y0, 0.2, 'concrete'); };
  const bands = (f: Frame, len: number, ys: number[]) => { for (const y of ys) slab(b, f, len / 2, y - BAND / 2, len, BAND, 0.2, 'concrete'); };
  /** Tall steel window with transoms; the real panes are ~0.5 m, drawn every `step`. */
  const win = (f: Frame, t: number, y: number, w: number, h: number, step = 0.9) => {
    slab(b, f, t, y, w + 0.1, h, 0.09, 'frame');
    slab(b, f, t, y + 0.05, w - 0.06, h - 0.1, 0.12, 'glass');
    for (let yy = y + step; yy < y + h - 0.2; yy += step) slab(b, f, t, yy, w, 0.07, 0.15, 'frame');
  };
  const brick = (f: Frame, t: number, y: number, w: number, h: number) => slab(b, f, t, y, w, h, 0.1, 'brick');
  const bands5 = (k: number) => BAND0 + PITCH * k;
  const cellLo = (k: number) => bands5(k) + BAND / 2, cellHi = (k: number) => bands5(k + 1) - BAND / 2;

  /** Brick + window grid shared by the NE, SE and SW faces. */
  const brickFace = (f: Frame, len: number, o: {pier0: number; pitch: number; bays: number; windowBays: number[]; yBase: number; ground?: (k: number, x0: number) => void; cells: number}) => {
    const xs = Array.from({length: o.bays + 1}, (_, k) => o.pier0 + o.pitch * k);
    piers(f, xs, o.yBase, ROOF);
    const ys: number[] = []; for (let k = 0; k <= 8; k++) if (bands5(k) > o.yBase + 0.5) ys.push(bands5(k));
    bands(f, len, ys);
    slab(b, f, len / 2, ROOF - 0.5, len, 0.5, 0.22, 'concrete');   // parapet cap
    for (let k = 0; k < o.bays; k++) {
      const x0 = xs[k] + 0.82;   // clear bay starts here, 2.49 m wide
      for (let c = 0; c < 8; c++) {
        const lo = cellLo(c) + 0.05, hi = cellHi(c) - 0.05;
        if (lo < o.yBase) continue;
        brick(f, x0 + 0.65, lo, 1.3, hi - lo);
        if (o.windowBays.includes(k)) { win(f, x0 + 1.3 + 0.6, lo + 0.1, 1.15, hi - lo - 0.2); }
        else brick(f, x0 + 1.3 + 0.595, lo, 1.19, hi - lo);
      }
      brick(f, x0 + 1.245, cellHi(7) + 0.35, 2.49, ROOF - 0.5 - cellHi(7) - 0.35);   // parapet brick
      o.ground?.(k, x0);
    }
  };

  // ---- NE face: ref-ne.jpg. t runs from the east corner to the north corner (36.07 m). ----
  {
    const {f, len} = frameBetween(E, N);
    const pier0 = 1.03, pitch = 3.305;
    // ground floor, bay by bay (measured in the rectified photo)
    const ground = (k: number, x0: number) => {
      const yTop = BAND0 - BAND / 2;   // underside of first band
      const kind = ['steel', 'brick', 'sq', 'steel', 'steel', 'sq', 'sq', 'glass', 'glass', 'glass'][k];
      const c = x0 + 1.245;
      if (kind === 'glass') {
        win(f, c, 0.35, 2.3, yTop - 0.4, 0.85);
      } else {
        slab(b, f, c, 0.0, 2.49, 2.75, 0.1, 'dark');                      // black roller shutters
        if (kind === 'steel') win(f, c, 2.9, 2.3, yTop - 2.95, 0.7);
        else { brick(f, c, 2.75, 2.49, yTop - 2.75); if (kind === 'sq') win(f, c, 3.45, 1.3, 1.3, 0.65); }
      }
    };
    brickFace(f, len, {pier0, pitch, bays: 10, windowBays: [0, 1, 2, 3, 4, 5, 6, 7].map(k => k), yBase: 0, ground, cells: 8});
    // brick bays 8-9 stay blank on every cell: drawn above through windowBays (not in list). Logo disc, top right.
    disc(b, f, 31.2, 28.6, 2.4, 0.14, 'dark', 0.1);
    // black steel balconies seen in the rectified photo: [t0, t1, floor height]
    const balc = (t0: number, t1: number, y: number) => {
      const w = t1 - t0, c = (t0 + t1) / 2;
      slab(b, f, c, y - 0.12, w, 0.18, 1.35, 'dark', 0.1);
      slab(b, f, c, y + 0.06, w, 0.06, 1.35, 'frame', 0.1);
      slab(b, f, c, y + 0.95, w, 0.05, 1.3, 'frame', 0.14);
      for (const t of [t0 + 0.03, t1 - 0.03]) slab(b, f, t, y + 0.06, 0.05, 0.95, 1.3, 'frame', 0.14);
      for (let u = t0 + 0.35; u < t1 - 0.2; u += 0.35) slab(b, f, u, y + 0.06, 0.03, 0.95, 0.03, 'frame', 1.4);
      slab(b, f, c, y + 0.06, w, 0.95, 0.03, 'frame', 1.4);
    };
    balc(18.4, 21.3, 6.4); balc(7.2, 10.9, 11.9); balc(25.1, 31.8, 11.9);
    balc(11.0, 14.2, 17.4); balc(18.4, 21.3, 17.4);
    balc(4.3, 10.7, 23.0); balc(21.7, 25.1, 23.0); balc(15.0, 20.9, 28.4);
  }

  // ---- NW face (quay): ref-nw-up.jpg. t from the north corner to the west corner (22.95 m). ----
  {
    const {f, len} = frameBetween(onLine(N, [1.4, -23.6], W), W);
    const pier = (l: number, w: number, y0: number, y1: number) => slab(b, f, l + w / 2, y0, w, y1 - y0, 0.2, 'concrete');
    for (const [l, w] of [[0, 1.0], [3.2, 1.0], [6.6, 1.2], [10.5, 0.8], [14.1, 0.9], [17.75, 0.95], [21.4, 1.5]]) pier(l, w, 0, 11.5);
    for (const [l, w] of [[0, 1.06], [6.7, 1.1], [14.1, 0.9], [17.75, 0.95], [21.4, 1.5]]) pier(l, w, 11.5, 22.4);
    for (const [l, w] of [[0, 0.9], [6.8, 0.9], [14.1, 0.9], [21.6, 1.3]]) pier(l, w, 22.4, ROOF);
    slab(b, f, len / 2, ROOF - 0.5, len, 0.5, 0.22, 'concrete');
    const stackLo = [cellLo(3), 37.8], stackHi = [37.1, ROOF - 0.5];
    bands(f, len, [bands5(0), bands5(1), bands5(2), bands5(3), 37.45]);
    // ground floor: tall glazing in the first-cell columns; entrance at the quay end
    const r1: [number, number][] = [[1.0, 3.2], [4.2, 6.6], [7.8, 10.5], [11.3, 14.1], [15.0, 17.75], [18.7, 21.4]];
    for (const [a, c] of r1) {
      win(f, (a + c) / 2, 0.35, c - a, BAND0 - BAND / 2 - 0.4, 0.85);
      win(f, (a + c) / 2, cellLo(0) + 0.1, c - a, cellHi(0) - cellLo(0) - 0.2, 0.75);
    }
    slab(b, f, 19.9, 0, 3.0, 3.1, 0.12, 'dark');                              // entrance hall frame
    win(f, 19.9, 0.15, 2.8, 2.9, 0.95);
    for (const [a, c] of [[1.06, 6.7], [7.8, 14.1], [15.0, 17.75], [18.7, 21.4]]) for (const k of [1, 2]) win(f, (a + c) / 2, cellLo(k) + 0.1, c - a, cellHi(k) - cellLo(k) - 0.2, 0.9);
    // two five-floor stacks of balcony loggias, three bays wide
    for (let s = 0; s < 2; s++) {
      const lo = stackLo[s], hi = stackHi[s], floor = (hi - lo) / 5;
      for (const [a, c] of [[0.9, 6.8], [7.7, 14.1], [15.0, 21.6]]) {
        const t = (a + c) / 2, w = c - a;
        slab(b, f, t, lo, w, hi - lo, 0.09, 'frame');
        slab(b, f, t, lo + 0.05, w - 0.1, hi - lo - 0.1, 0.12, 'glass');
        for (let k = 0; k < 5; k++) {
          const y = lo + k * floor;
          slab(b, f, t, y + floor - 0.08, w, 0.1, 0.5, 'dark', 0.1);        // balcony slab
          slab(b, f, t, y + 0.2, w, 0.8, 0.04, 'frame', 0.55);               // balustrade
          slab(b, f, t, y + 0.2, w, 0.05, 0.1, 'frame', 0.5);
          slab(b, f, t, y + 1.0, w, 0.05, 0.1, 'frame', 0.5);
        }
        for (let u = a + 0.6; u < c - 0.3; u += 1.2) slab(b, f, u, lo, 0.07, hi - lo, 0.16, 'frame');
      }
    }
  }

  // ---- SW (above the 10 m wing) and SE (above the 7 m wing) faces: NE rhythm, inferred ----
  {
    const {f, len} = frameBetween(W, S);
    brickFace(f, len, {pier0: 0.4, pitch: 3.305, bays: 11, windowBays: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], yBase: 10.1, cells: 8});
  }
  {
    const {f, len} = frameBetween(S, E);
    brickFace(f, len, {pier0: 0.1, pitch: 3.305, bays: 7, windowBays: [0, 1, 2, 3, 4, 5, 6], yBase: 7.3, cells: 8});
  }

  // ---- Werkspoor pavilion (low SW wing), quay front: glazed ground floor under black cladding, steel piers (ref-nw.jpg, b261/b312 panoramas) ----
  {
    const {f, len} = frameBetween(W, [-29.5, 7.5]);
    const n = Math.round(len / 4.3), pitch = len / n;
    for (let k = 0; k < n; k++) {
      slab(b, f, (k + 0.5) * pitch, 0.3, pitch - 0.35, 4.0, 0.1, 'glass');
      slab(b, f, k * pitch, 0.0, 0.3, 5.6, 0.22, 'frame');
    }
    slab(b, f, len - 0.15, 0.0, 0.3, 5.6, 0.22, 'frame');
    slab(b, f, len / 2, 4.3, len, 0.25, 0.22, 'frame');
  }
  setSink(0);
}
