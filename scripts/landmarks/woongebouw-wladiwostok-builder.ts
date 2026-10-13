import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {wallsOf} from './worship-walls';
import {frameOf, setSink, slab, type Frame} from './nearbar-kit';
import source from './woongebouw-wladiwostok-footprints.json';

/**
 * Woongebouw Wladiwostok (Jo Crepain, c. 1994), Azartplein, Java-eiland: a nine-storey anthracite-brick block whose east front is bent
 * into a concave arc round the tram loop. Massing is the 3DBAG LoD2.2 shell of the BAG pand (native east/south metres from the BAG
 * centroid). The arc is the ring run from vertex 1 to vertex 57. Window columns, storey rows and the planted balcony stack are laid
 * out by arc length from the 2018 and 2023 frontal Commons photographs (twelve columns: five south of the stack, three in it, four north).
 */
const ring = (source as {nativeRing: number[][]}).nativeRing;
const ARC = ring.slice(1, 58);
const seg: number[] = [0];
for (let i = 1; i < ARC.length; i++) seg.push(seg[i - 1] + Math.hypot(ARC[i][0] - ARC[i - 1][0], ARC[i][1] - ARC[i - 1][1]));
const LEN = seg[seg.length - 1];

/** Frame at arc length s, running south to north, normal pointing out of the building (east). */
function at(s: number): Frame {
  let k = seg.findIndex(v => v > s) - 1;
  if (k < 0) k = ARC.length - 2;
  const a = ARC[k], c = ARC[k + 1], l = seg[k + 1] - seg[k], u = Math.min(1, Math.max(0, (s - seg[k]) / l));
  const d: [number, number] = [(c[0] - a[0]) / l, (c[1] - a[1]) / l];
  const n: [number, number] = [-d[1], d[0]];
  const f: Frame = {origin: [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u], tangent: [n[1], -n[0]], n};
  const o = planeOffset(f);
  return {origin: [f.origin[0] + n[0] * o, f.origin[1] + n[1] * o], tangent: f.tangent, n};
}
const WALLS = wallsOf(source as never).filter(w => w.base < 0.5 && Math.max(...w.poly.map(p => p[1])) > 20);
/** Real 3DBAG wall plane vs the footprint ring: how far (m) the facade sits proud of the ring at this frame. */
function planeOffset(f: Frame): number {
  let best = 0;
  for (const w of WALLS) {
    if (w.n[0] * f.n[0] + w.n[1] * f.n[1] < 0.95) continue;
    const dx = f.origin[0] - w.origin[0], dz = f.origin[1] - w.origin[1];
    const t = dx * w.tangent[0] + dz * w.tangent[1];
    if (t < -0.05 || t > w.length + 0.05) continue;
    best = Math.max(best, -(dx * w.n[0] + dz * w.n[1]));
  }
  return best;
}
const PX = (x: number) => ((x - 55) / 1175) * LEN;   // photo x (facade spans 55..1230 px) to arc length, left = south
const COLS = [190, 275, 360, 443, 527, 608, 692, 775, 855, 940, 1020, 1105].map(PX);
const ROWS = [6.1, 9.2, 11.8, 14.4, 17.0, 19.7, 22.3, 25.0];  // window centre heights (m)
const FLOORS = [4.8, 10.3, 15.6, 21.0];                           // balcony slab levels

export function buildWoongebouwWladiwostok(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0.3);
  // The curved east front is anthracite brick (photographed); the other faces are red brick (seen on the 2019 rear photograph).
  const front = new Set(wallsOf(source as never).filter(w => {
    const brg = (Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360;
    return brg > 60 && brg < 120;
  }).map(w => w.index));
  addShell(b, source as never, {wall: 'greyBrick', roof: 'slate', skip: (s, i) => s.type === 'WallSurface' && !front.has(i)});
  addShell(b, source as never, {wall: 'brick', roof: 'slate', skip: (s, i) => s.type !== 'WallSurface' || front.has(i)});
  b.mark?.('shell');
  // Inferred (no frontal photograph): regular window grid on the red-brick faces at the same 3 m column pitch and storey rows as the front.
  for (const w of WALLS) {
    if (front.has(w.index) || w.length < 4) continue;
    const f = frameOf(w), top = Math.max(...w.poly.map(p => p[1]));
    const n = Math.floor((w.length - 1.2) / 3.0) + 1, t0 = w.length / 2 - (n - 1) * 1.5;
    for (let k = 0; k < n; k++) for (const y of ROWS) {
      if (y - 0.68 < w.base + 0.3 || y + 0.7 > top - 0.2 || y > 26) continue;
      slab(b, f, t0 + k * 3.0, y - 0.68, 1.3, 1.36, 0.08, 'frame');
      slab(b, f, t0 + k * 3.0, y - 0.55, 1.05, 1.1, 0.12, 'glass');
    }
  }

  // stepped plinth along the arc
  for (let s = 0.6; s < LEN - 0.6; s += 1.2) slab(b, at(s), 0, 0, 1.3, 0.5, 0.95, 'concrete');
  COLS.forEach((s, i) => {
    const f = at(s), centre = i >= 5 && i <= 7;
    // ground-floor door/shopfront openings
    slab(b, f, 0, 0.5, 1.5, 3.7, 0.08, 'frame');
    slab(b, f, 0, 0.55, 1.2, 3.6, 0.12, 'dark');
    if (centre) {
      // floor-to-ceiling glazing of the balcony stack: one tall pane per storey pair
      for (const fl of FLOORS) {
        slab(b, f, 0, fl + 0.2, i === 6 ? 1.1 : 0.9, 2.8, 0.08, 'frame');
        slab(b, f, 0, fl + 0.3, i === 6 ? 0.9 : 0.7, 2.6, 0.12, 'glass');
      }
      return;
    }
    for (const y of ROWS) {
      slab(b, f, 0, y - 0.68, 1.3, 1.36, 0.08, 'frame');
      slab(b, f, 0, y - 0.55, 1.05, 1.1, 0.12, 'glass');
    }
  });
  // planted balconies: slab, rail and posts in the centre stack
  const f = at(COLS[6]);
  for (const fl of FLOORS) {
    slab(b, f, 0, fl - 0.2, 6.8, 0.2, 1.0, 'concrete');
    slab(b, f, 0, fl + 0.85, 6.8, 0.07, 0.07, 'frame', 0.95);
    for (let k = -6; k <= 6; k++) slab(b, f, k * 0.55, fl, 0.05, 0.88, 0.05, 'frame', 0.95);
  }
  // roof mast with a ship-shaped vane (Azart)
  slab(b, f, 0, 27.6, 0.14, 4.6, 0.14, 'dark', -0.2);
  slab(b, f, 0, 32.0, 1.1, 0.35, 0.1, 'dark', -0.15);
  slab(b, f, 0, 32.35, 0.5, 0.35, 0.1, 'dark', -0.15);
  setSink(0);
}
