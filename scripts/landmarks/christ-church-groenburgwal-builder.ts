import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {disc, poly, put, setSink, slab} from './nearbar-kit';
import type {Frame} from './nearbar-kit';
import source from './christ-church-groenburgwal-footprints.json';

/**
 * Christ Church / "Church of England", Groenburgwal 42 (BAG 0363100012171165, rijksmonument 1269). A cloth hall of 1626
 * (Staalhof) with an 1829 neo-Gothic brick front, one of the first in the Netherlands. Massing is the 3DBAG LoD2.2
 * shell in native east/south metres. The front faces the Groenburgwal quay (south-east), 11.1 m wide; its pointed-arch
 * features were measured by eye from the straight-on Commons photograph (CC0/PD) and the oblique CC BY-SA view listed
 * in the research record:
 *  - three tall stages: a central gable between two brick piers with copper spires, a four-lancet window with
 *    tracery, the "EPISCOPAL CHURCH" stone plaque on corbels and a moulded pointed-arch doorway (recessed 0.74 m in
 *    the BAG outline) below it;
 *  - left bay (wide, three-lancet window, raking parapet to a corner pier with a spire); right bay (narrower, two-lancet,
 *    lower window, lower raking parapet, corner pier with a short spire, a small notice board);
 *  - stone plinth, string courses on the piers, stone copings and iron tie-fleurs on the gable and the rakes.
 * The side and back walls stay the plain 3DBAG brick shell (party walls, inferred). The plaque text is left blank.
 */
type Pt = [number, number];
const SINK = 0.3;
export function buildChristChurchGroenburgwal(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  addShell(b, source as never, {wall: 'brick', roof: 'slate'});
  b.mark?.('shell');
  setSink(SINK);

  const a: Pt = [-0.238, 6.744], c: Pt = [5.359, -2.824];
  const LEN = Math.hypot(c[0] - a[0], c[1] - a[1]), tg: Pt = [(c[0] - a[0]) / LEN, (c[1] - a[1]) / LEN];
  const f: Frame = {origin: a, tangent: tg, n: [-tg[1], tg[0]]};
  const W = 11.08;   // facade width (t runs left to right as seen from the quay)
  const P = 0.35;    // front plane of the brick plate

  /** Extruded shape (with optional holes), back sunk into the wall, front face at `out + d`. */
  const ext = (shape: T.Shape, d: number, colour: string, out: number) =>
    put(b, f, new T.ExtrudeGeometry(shape, {depth: d + SINK, bevelEnabled: false, curveSegments: 6}), 0, 0, out - SINK, colour);

  /** Two-centred pointed arch head: points from the left springing round the apex to the right springing. */
  const head = (cx: number, r: number, hs: number, rise: number, n = 7): Pt[] => {
    const R = (r * r + rise * rise) / (2 * r), thA = Math.atan2(rise, r - R), left: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const th = Math.PI + (thA - Math.PI) * (i / n);
      left.push([cx - r + R + R * Math.cos(th), hs + R * Math.sin(th)]);
    }
    const right = left.slice(0, n).reverse().map(p => [2 * cx - p[0], p[1]] as Pt);
    return [...left, ...right];
  };
  const pointed = (cx: number, y0: number, w: number, h: number, rise = w * 0.95): T.Shape => {
    const r = w / 2, hs = y0 + h - rise, s = new T.Shape();
    s.moveTo(cx - r, y0); s.lineTo(cx + r, y0); s.lineTo(cx + r, hs);
    const hp = head(cx, r, hs, rise);
    for (let i = hp.length - 1; i >= 0; i--) s.lineTo(hp[i][0], hp[i][1]);
    s.lineTo(cx - r, y0);
    return s;
  };
  /** Pointed arch moulding of thickness th, open at the bottom (no hole touching the contour). */
  const band = (cx: number, y0: number, w: number, h: number, rise: number, th: number): T.Shape => {
    const r = w / 2, hs = y0 + h - rise, s = new T.Shape();
    s.moveTo(cx - r, y0); s.lineTo(cx - r, hs);
    for (const p of head(cx, r, hs, rise)) s.lineTo(p[0], p[1]);
    s.lineTo(cx + r, y0); s.lineTo(cx + r - th, y0); s.lineTo(cx + r - th, hs);
    const ri = r - th, riseI = rise - th * 1.1;
    const hi = head(cx, ri, hs, Math.max(0.2, riseI));
    for (let i = hi.length - 1; i >= 0; i--) s.lineTo(hi[i][0], hi[i][1]);
    s.lineTo(cx - r + th, y0); s.lineTo(cx - r, y0);
    return s;
  };
  const shapeOf = (pts: Pt[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));

  // ============ brick front plate with raking parapets, flanking piers and the gable ============
  const doorHead = head(5.675, 0.825, 2.4, 1.5);
  const plate = shapeOf([
    [0, 0], [4.85, 0], [4.85, 2.4], ...doorHead.slice(1, -1), [6.5, 2.4], [6.5, 0],
    [W, 0], [W, 7.9], [8.2, 11.1], [8.2, 13.5], [7.4, 13.5], [6.0, 14.75], [4.6, 13.5], [3.6, 13.5], [3.6, 11.9], [0, 9.2],
  ]);
  ext(plate, P, 'brick', 0);

  /** Pier: a column proud of the plate with stone string courses and a capped copper spire. */
  const pier = (t0: number, t1: number, top: number, spire: number, bands: number[]) => {
    const t = (t0 + t1) / 2, w = t1 - t0;
    slab(b, f, t, 0, w, top, 0.14, 'brick', P);
    for (const y of bands) slab(b, f, t, y, w + 0.12, 0.2, 0.3, 'stone', P);
    slab(b, f, t, top, w + 0.18, 0.28, 0.3, 'stone', P);
    put(b, f, new T.CylinderGeometry(0.02, Math.min(0.42, w * 0.45), spire, 8).translate(0, spire / 2, 0), t, top + 0.28, P - 0.1, 'copper');
  };
  pier(3.6, 4.6, 13.5, 2.8, [4.5, 8.8]);
  pier(7.35, 8.2, 13.5, 2.7, [4.3, 8.4]);
  pier(0, 0.95, 9.0, 2.8, [4.5]);
  pier(10.2, W, 7.7, 2.0, [4.3]);

  // ============ stone plinth (pale limestone) ============
  slab(b, f, 2.35, 0, 4.7, 1.3, 0.12, 'sandstone', P);
  slab(b, f, 2.35, 1.3, 4.7, 0.12, 0.2, 'stone', P);
  slab(b, f, 7.35, 0, 1.7, 1.3, 0.12, 'sandstone', P);
  slab(b, f, 9.8, 0, 2.4, 1.0, 0.12, 'sandstone', P);
  slab(b, f, 9.8, 1.0, 2.4, 0.1, 0.18, 'stone', P);
  for (const [t, w] of [[4.1, 1.1], [7.8, 1.0]] as Pt[]) slab(b, f, t, 0, w, 1.45, 0.24, 'sandstone', P);

  // ============ doorway: recess floor door, moulded pointed arch ============
  {
    const door = pointed(5.675, 0, 1.65, 3.9, 1.5);
    put(b, f, new T.ExtrudeGeometry(door, {depth: 0.1, bevelEnabled: false, curveSegments: 6}), 0, 0, -0.72, 'dark');
    ext(band(5.9, 0, 2.3, 4.7, 2.0, 0.42), 0.1, 'red', P);
    disc(b, f, 5.675, 3.0, 0.2, 0.06, 'glass', -0.62);
    slab(b, f, 5.675, 0.0, 1.9, 0.1, 0.3, 'stone', P - 0.9);
  }

  // ============ windows ============
  /** Pointed window with a brick hood, white mullions/transoms, glass lancets and tracery lights. */
  const window = (cx: number, sill: number, w: number, apex: number, lancets: number, heads: number[]) => {
    const h = apex - sill, rise = w * 0.95;
    // hood (lighter brick relieving arch)
    ext(band(cx, sill - 0.05, w + 0.6, h + 0.4, rise + 0.3, 0.2), 0.1, 'red', P);
    // stone sill
    slab(b, f, cx, sill - 0.2, w + 0.5, 0.2, 0.28, 'stone', P);
    // dark glazing over the whole pointed opening, white lancet outlines (mullions), transoms and tracery
    ext(pointed(cx, sill, w, h, rise), 0.07, 'glass', P);
    ext(band(cx, sill, w, h, rise, 0.08), 0.1, 'white', P + 0.07);
    const inner = w - 0.16, lw = (inner - (lancets - 1) * 0.0) / lancets;
    for (let i = 0; i < lancets; i++) {
      const lc = cx - inner / 2 + lw / 2 + i * lw;
      const top = heads[i] ?? heads[heads.length - 1];
      const lr = lw / 2;
      ext(band(lc, sill + 0.06, lw + 0.04, top - sill - 0.06, lr * 1.8, 0.07), 0.06, 'white', P + 0.07);
    }
    const lowTop = Math.min(...heads.slice(0, lancets)) - 0.4;
    for (let y = sill + 0.85; y < lowTop; y += 0.85) slab(b, f, cx, y, inner, 0.05, 0.14, 'white', P + 0.06);
    const tTop = Math.max(...heads.slice(0, lancets)) + 0.12, free = apex - 0.45 - tTop;
    if (free > 0.4) {
      const n = lancets >= 4 ? 3 : lancets;
      for (let i = 0; i < n; i++) {
        const tc = cx + (i - (n - 1) / 2) * (inner / n), s = Math.min(free * 0.5, inner / n * 0.42);
        const y0 = tTop + (i === (n - 1) / 2 ? 0.25 : 0.05);
        poly(b, f, 0, 0, [[tc - s * 0.7, y0 + s], [tc, y0], [tc + s * 0.7, y0 + s], [tc, y0 + s * 2]], 0.05, 'white', P + 0.07);
        const q = s * 0.55;
        poly(b, f, 0, 0, [[tc - q * 0.7, y0 + s], [tc, y0 + s - q], [tc + q * 0.7, y0 + s], [tc, y0 + s + q]], 0.05, 'glass', P + 0.12);
      }
    }
  };
  window(2.3, 2.5, 1.72, 8.3, 3, [7.0, 7.45, 7.0]);
  window(6.0, 6.4, 2.1, 13.0, 4, [10.6, 11.2, 11.2, 10.6]);
  window(9.2, 2.5, 1.35, 6.9, 2, [5.7, 5.7]);

  // ============ plaque on corbels, memorial disc, notice board ============
  slab(b, f, 6.1, 5.0, 2.4, 0.8, 0.14, 'stone', P);
  slab(b, f, 6.1, 4.88, 2.5, 0.14, 0.24, 'stone', P);
  for (const t of [5.1, 5.75, 6.4, 7.05]) slab(b, f, t, 4.62, 0.16, 0.26, 0.18, 'stone', P);
  slab(b, f, 6.0, 6.2, 2.5, 0.24, 0.26, 'stone', P);
  disc(b, f, 4.25, 2.7, 0.17, 0.05, 'red', P);
  slab(b, f, 9.4, 1.25, 0.9, 0.95, 0.08, 'frame', P);
  slab(b, f, 9.4, 1.32, 0.76, 0.8, 0.12, 'glass', P);

  // ============ copings and iron tie-fleurs on the rakes ============
  const rake = (p0: Pt, p1: Pt, th = 0.26) => poly(b, f, 0, 0, [[p0[0], p0[1] - 0.12], [p1[0], p1[1] - 0.12], [p1[0], p1[1] + th - 0.12], [p0[0], p0[1] + th - 0.12]], 0.14, 'stone', P);
  rake([0, 9.2], [3.6, 11.9], 0.22);
  rake([8.2, 11.1], [W, 7.9], 0.22);
  rake([4.6, 13.5], [6.0, 14.75], 0.24);
  rake([6.0, 14.75], [7.4, 13.5], 0.24);
  const fleur = (t: number, y: number) => { slab(b, f, t, y, 0.07, 0.5, 0.1, 'dark', P); slab(b, f, t - 0.14, y + 0.4, 0.3, 0.07, 0.1, 'dark', P); };
  for (const [t, y] of [[1.2, 9.9], [2.6, 10.9], [4.9, 12.2], [7.1, 12.0], [8.9, 10.1], [10.2, 8.9]] as Pt[]) fleur(t, y);
  slab(b, f, 6.0, 12.9, 0.14, 0.4, 0.1, 'white', P + 0.0);
  slab(b, f, 6.0, 13.0, 0.4, 0.14, 0.1, 'white', P + 0.0);

  // ============ finial: shaft, orb and cross on the gable apex ============
  slab(b, f, 6.0, 14.6, 0.4, 0.5, 0.4, 'stone', P - 0.3);
  put(b, f, new T.SphereGeometry(0.32, 10, 8), 6.0, 15.4, P - 0.1, 'stone');
  slab(b, f, 6.0, 15.65, 0.07, 1.0, 0.07, 'dark', P - 0.15);
  slab(b, f, 6.0, 16.1, 0.5, 0.07, 0.07, 'dark', P - 0.15);
}
