import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, poly, ringFrame, ringSlab, setSink, slab, type Frame} from './nearbar-kit';
import {reshapeShell} from './shell-gable-fit';
import {ZoneMesh, bagFrame, type Cut, type Zone} from './zone-wall-kit';
import source from './utrechtsestraat-9-17-footprints.json';

/**
 * UTRECHTSESTRAAT 9-17 / Rembrandtplein (BAG pand 0363100012169214, BAG 1932; gemeentelijk monument 200500): the brown-brick
 * office block with a granite base, triple steel windows between brick pilasters, the projecting Utrechtsestraat range with
 * its loggia gallery (green copper parapets and trims), the slender clock tower at the Rembrandtplein corner with the
 * Amsterdam arms at its foot, the lower corner block with its tall granite portal, and the setback attic storeys.
 * Massing: the 3DBAG LoD2.2 shell (utrechtsestraat-9-17-footprints.json, bag-shell-prepare.ts), its lumpy rooftop volume
 * snapped flat. Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per item in
 * utrechtsestraat-9-17-inventory.json; positions are metres along each ring edge from the viewer's left:
 *  - Utrechtsestraat range (ring edge 1, w01-257, 2024): nine 6.4 m bays, a granite ground storey with recessed shops,
 *    loggias 4.3 m wide over green copper parapets, three storeys of triple windows, pilasters with stepped capitals, the
 *    cornice at 24.1 m and the glazed attic pavilions behind it. Rebuilt as a holed wall (zone-wall-kit) so the loggias,
 *    shops and windows are real recesses;
 *  - Rembrandtplein front (edge 23, w04-258), north front on the Amstelstraat (edge 18, w03-3), corner block (edge 20,
 *    w06-274), Herengracht front (edges 2-10, w02-163 and its 2021 view), the 4 m return (edge 0, w07-347): proud
 *    window, pilaster and base slabs on the shell walls;
 *  - the clock tower (measured on refs/tower-w.jpg and tower-top.jpg, recording_2025-06-19_03-28-47_01649).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
type P = [number, number];

/** Plan coordinates of a point in a ring edge's frame (t along from the viewer's left, d outward). */
const edgeLocal = (i: number) => {
  const {f, len} = ringFrame(ring, i);
  return {f, len, loc: (x: number, z: number) => ({t: (x - f.origin[0]) * f.tangent[0] + (z - f.origin[1]) * f.tangent[1], d: (x - f.origin[0]) * f.n[0] + (z - f.origin[1]) * f.n[1]})};
};
const E1 = edgeLocal(1), E23 = edgeLocal(23);
/**
 * The clock tower: a box in the Rembrandtplein front's frame (t -1.25..2.5, d -3.4..+0.25) that encloses the 3DBAG tower
 * (40.4-40.7 m), whose scan is cut at the 30.5 m roof and left inside the box as a closed stump.
 */
const TW = {t0: -1.25, t1: 2.5, d0: -3.4, d1: 0.25};
const inTower = (x: number, z: number, pad = 0.1) => {
  const {t, d} = E23.loc(x, z);
  return t > TW.t0 - pad && t < TW.t1 + pad && d > TW.d0 - pad && d < TW.d1 + pad;
};
/** The east lift tower (3DBAG 39.5 m, inside the block): kept as scanned. */
const inEastTower = (x: number, z: number) => x > 7.9 && x < 11.8 && z > -33 && z < -26.3;
/** The Utrechtsestraat range: within 6 m behind ring edge 1. */
const inRange = (x: number, z: number, dmax = 6) => {
  const {t, d} = E1.loc(x, z);
  return t > -0.5 && t < E1.len + 0.5 && d < 0.6 && d > -dmax;
};
/** Wall polygons in the plane of ring edge 1 (rebuilt as the holed Utrechtsestraat wall). */
const onEdge1 = (s: Surface) => s.type === 'WallSurface' && s.rings[0].every(p => {
  const {t, d} = E1.loc(p[0], p[2]);
  return Math.abs(d) < 0.6 && t > -0.3 && t < E1.len + 0.3;
});

const EAVES1 = 24.1;
/** Utrechtsestraat range: pilaster lines and bay centres (w01-257 rectified, 31.3 px/m). */
const PIL1 = [6.7, 13.1, 19.5, 25.9, 32.3, 38.7, 45.1, 51.5];
const BAY1 = [3.35, 9.9, 16.3, 22.7, 29.1, 35.5, 41.9, 48.3, 54.55];
const ROWS1: [number, number][] = [[9.1, 12.3], [13.9, 17.0], [18.75, 21.8]];

export function buildUtrechtsestraat917(_w: number, _d: number, b: BuildingTools) {
  // The rooftop volume is a field of 33-37 m slivers in 3DBAG; one flat roof at 35.8 m. The 29-32 m setbacks snap to the
  // 30.5 m attic roof. The east lift tower keeps its height; the clock tower's scan is cut at 30.5 m (drawn by tower()).
  const keep = (x: number, z: number) => !inTower(x, z, 0.3) && !inEastTower(x, z);
  const surfaces = reshapeShell(src.surfaces, {
    snap: [
      {inside: keep, lo: 32.8, hi: 37.4, to: 35.8},
      {inside: keep, lo: 28.5, hi: 32.4, to: 30.5},
    ],
    compress: [{inside: (x, z) => inTower(x, z, 0.3), y0: 30.5, s: 0}],
  });
  const edge1: Surface[] = [];
  addShell(b, {...src, surfaces} as never, {
    wall: 'brick', roof: 'slate',
    skip: s => {
      if (onEdge1(s)) { edge1.push(s); return true; }
      return false;
    },
    wallFor: s => {
      const r = s.rings[0], ys = r.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
      if (lo >= 30.4 && r.every(p => !inEastTower(p[0], p[2]))) return 'concrete';
      if (lo >= 22.7 && hi <= 27.3 && r.every(p => inRange(p[0], p[2]))) return 'bronze';
      return 'brick';
    },
  });
  const sink0 = getSink();
  setSink(0.12, true);
  utrechtsestraatRange(b, edge1);
  attic(b, surfaces);
  rembrandtpleinFront(b);
  northFront(b);
  cornerBlock(b);
  herengrachtFront(b);
  returnFront(b);
  tower(b);
  setSink(sink0);
}

/**
 * Thin glazing bar on a pane: no sink and shallower than it is wide, so its face (not its sides) sets its facing axis in
 * the openings audit (a deep 4 cm bar near a corner was judged against the perpendicular wall).
 */
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number, colour = 'frame') {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, 0.045, colour as never, out);
  setSink(s0, true);
}
/** A light of a steel window as a proud slab: frame border, glass, transom and two glazing bars below it. */
function light(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, out = 0) {
  slab(b, f, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.06, 'frame', out);
  slab(b, f, t, y0, w, y1 - y0, 0.1, 'glass', out);
  const tr = y0 + (y1 - y0) * 0.68;
  bar(b, f, t, tr, w, 0.08, out + 0.1);
  for (const k of [-1, 1]) bar(b, f, t + (k * w) / 3, y0, 0.06, tr - y0, out + 0.1);
}
/** n lights centred on t, light width w, brick mullion m between them; a sill under the group. */
function group(b: BuildingTools, f: Frame, t: number, rows: [number, number][], n: number, w: number, m: number, out = 0, sill = true) {
  for (const [y0, y1] of rows) {
    for (let k = 0; k < n; k++) light(b, f, t + (k - (n - 1) / 2) * (w + m), y0, y1, w, out);
    if (sill) slab(b, f, t, y0 - 0.2, n * w + (n - 1) * m + 0.3, 0.14, 0.12, 'brick', out);
  }
}
/** Brick pilaster with a stepped capital. */
function pilaster(b: BuildingTools, f: Frame, t: number, y0: number, cap: number, top: number, out = 0) {
  slab(b, f, t, y0, 0.72, cap - y0, 0.2, 'brick', out);
  slab(b, f, t, cap, 0.95, top - cap - 0.45, 0.32, 'brick', out);
  slab(b, f, t, top - 0.45, 1.1, 0.45, 0.42, 'brick', out);
}

/**
 * Utrechtsestraat range (ring edge 1, w01-257 rectified 2024-12-03; w01 thumb for depth and colour): the in-plane shell
 * walls are replaced by one holed wall: granite 0-3.6 m with a recessed shop under each bay, brick above with a loggia
 * (3.6-7.05 m, 2.2 m deep, light plastered reveals and a glazed back wall) and three rows of triple windows per bay.
 * The 3DBAG pieces that reach 27.1 m in this plane are the attic pavilions: glass panels over the cornice.
 */
function utrechtsestraatRange(b: BuildingTools, edge1: Surface[]) {
  const {f: zf, len} = bagFrame(ring.map(p => [p[0], p[1]] as P), 1);
  const {f} = ringFrame(ring, 1);
  const cuts: Cut[] = [];
  for (const c of BAY1) {
    cuts.push({t0: c - 2.15, t1: c + 2.15, y0: 0.25, y1: 3.0, depth: 0.45, back: 'dark', reveal: 'sandstone'});
    cuts.push({t0: c - 2.15, t1: c + 2.15, y0: 3.6, y1: 7.05, depth: 2.2, back: 'brick', reveal: 'stone'});
    for (const [y0, y1] of ROWS1) for (const k of [-1, 0, 1]) {
      const t = c + k * 1.55;
      cuts.push({t0: t - 0.6, t1: t + 0.6, y0, y1, depth: 0.2, back: 'glass'});
    }
  }
  const zm = new ZoneMesh(b);
  const granite: Zone = {t0: 0, t1: len, y0: 0, y1: 3.6, face: 'sandstone', cuts};
  const brick: Zone = {t0: 0, t1: len, y0: 3.6, y1: EAVES1, face: 'brick', cuts};
  zm.emitZone(zf, granite, 0, len, 0, 3.6);
  zm.emitZone(zf, brick, 0, len, 3.6, EAVES1);
  // attic pavilion panels where the scan's front wall reaches the 27.1 m attic roof
  for (const s of edge1) {
    const r = s.rings[0], hi = Math.max(...r.map(p => p[1]));
    if (hi < EAVES1 + 0.3) continue;
    const loc = r.map(p => E1.loc(p[0], p[2])), ts = loc.map(q => q.t);
    const t0 = Math.max(0, Math.min(...ts)), t1 = Math.min(len, Math.max(...ts)), dd = loc.reduce((a, q) => a + q.d, 0) / loc.length;
    // in the scan's own plane (its side walls meet it there), with a ledge back to the rebuilt wall's top
    zm.rect(zf, t0, t1, EAVES1, hi, dd, 'bronze');
    if (dd < -0.02) zm.quad(zf, {pts: [[t0, EAVES1, dd], [t0, EAVES1, 0], [t1, EAVES1, 0], [t1, EAVES1, dd]], normal: [0, 1, 0]}, 'brick');
  }
  zm.flush();
  for (const c of BAY1) {
    // loggia: copper parapet front, copper trim round the opening, glazed doors and windows in the back wall
    slab(b, f, c, 3.05, 4.55, 0.38, 0.16, 'copper');
    for (const k of [-1, 1]) slab(b, f, c + k * 2.26, 3.6, 0.12, 3.6, 0.08, 'copper');
    slab(b, f, c, 7.1, 4.64, 0.12, 0.08, 'copper');
    for (const k of [-1, 0, 1]) slab(b, f, c + k * 1.2, 3.75, 0.95, 2.7, 0.06, 'glass', -2.2);
    // window glazing bars in the 0.2 m reveals, sills
    for (const [y0, y1] of ROWS1) {
      for (const k of [-1, 0, 1]) {
        const t = c + k * 1.55, tr = y0 + (y1 - y0) * 0.68;
        bar(b, f, t, tr, 1.2, 0.08, -0.2);
        for (const q of [-1, 1]) bar(b, f, t + q * 0.4, y0, 0.06, tr - y0, -0.2);
      }
      slab(b, f, c, y0 - 0.2, 4.6, 0.16, 0.12, 'brick');
    }
  }
  for (const t of PIL1) pilaster(b, f, t, 3.6, 21.6, 23.0);
  for (const t of [0.35, len - 0.35]) pilaster(b, f, t, 3.6, 21.6, 23.0);
  // granite piers' top course, cornice and its copper cap
  slab(b, f, len / 2, 3.45, len, 0.15, 0.12, 'sandstone');
  slab(b, f, len / 2, 23.0, len + 0.2, 0.8, 0.34, 'brick');
  slab(b, f, len / 2, 23.95, len + 0.3, 0.3, 0.42, 'copper');
}

/**
 * Attic pavilions behind the Utrechtsestraat cornice (w01-257: glass boxes with green copper posts and a projecting copper
 * roof edge; w02-163 the same seen end-on): copper posts every 2.2 m and a fascia on each street-facing glazed shell wall.
 */
function attic(b: BuildingTools, surfaces: Surface[]) {
  const {f: f1} = ringFrame(ring, 1);
  for (const s of surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0], ys = r.map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    if (lo < 22.7 || hi > 27.3 || hi - lo < 2 || !r.every(p => inRange(p[0], p[2]))) continue;
    const loc = r.map(p => E1.loc(p[0], p[2])), ds = loc.map(q => q.d), ts = loc.map(q => q.t);
    if (Math.max(...ds) - Math.min(...ds) > 0.2) continue;
    const t0 = Math.min(...ts), t1 = Math.max(...ts), d = ds.reduce((a, v) => a + v, 0) / ds.length;
    if (t1 - t0 < 1.5) continue;
    const f: Frame = {origin: [f1.origin[0] + f1.n[0] * d, f1.origin[1] + f1.n[1] * d], tangent: f1.tangent, n: f1.n};
    const n = Math.max(1, Math.round((t1 - t0) / 2.2));
    for (let k = 0; k <= n; k++) slab(b, f, t0 + ((t1 - t0) * k) / n, lo, 0.14, hi - lo, 0.1, 'copper');
    slab(b, f, (t0 + t1) / 2, hi - 0.2, t1 - t0 + 0.4, 0.35, 0.5, 'copper');
    slab(b, f, (t0 + t1) / 2, lo + 1.0, t1 - t0, 0.06, 0.08, 'copper');
  }
}

/**
 * Rembrandtplein front (ring edge 23, w04-258 rectified 2020-04-21 and 2022, 46.3 px/m; tower at its north end): granite
 * base to 4.1 m with four shop windows, four bays of triple windows on four storeys between pilasters, a cornice at 22.6 m,
 * two attic ribbon rows and a railing on the 30.5 m roof. The Booking.com letters of 2020-2022 are gone in 2025
 * (refs/tower-w.jpg): not drawn.
 */
function rembrandtpleinFront(b: BuildingTools) {
  const {f, len} = ringFrame(ring, 23);
  const t0 = TW.t1;
  slab(b, f, (t0 + len) / 2, 0, len - t0, 4.1, 0.1, 'sandstone');
  slab(b, f, (t0 + len) / 2, 3.95, len - t0, 0.2, 0.2, 'sandstone');
  for (const [a, c] of [[2.9, 6.8], [8.75, 12.85], [14.9, 18.9], [21.0, 24.85]]) {
    slab(b, f, (a + c) / 2, 0.45, c - a + 0.2, 3.15, 0.14, 'frame');
    slab(b, f, (a + c) / 2, 0.55, c - a, 2.95, 0.18, 'dark');
  }
  // the first bay is narrowed to clear the tower box (the scan's tower is 0.4 m wider than the photo's)
  const rows4: [number, number][] = [[4.3, 7.1], [8.9, 12.0], [13.4, 16.6], [18.1, 21.4]];
  group(b, f, 4.95, rows4, 3, 1.15, 0.35);
  for (const c of [10.8, 17.0, 23.1]) group(b, f, c, rows4, 3, 1.2, 0.4);
  for (const t of [7.45, 13.8, 20.2, len - 0.35]) pilaster(b, f, t, 4.1, 21.4, 22.7);
  slab(b, f, (t0 + len) / 2, 22.6, len - t0, 0.5, 0.3, 'brick');
  // attic: two ribbon rows per bay with slim mullions, a brick sill band under each
  for (const [y0, y1] of [[23.9, 25.1], [27.0, 28.4]] as [number, number][]) {
    for (const [a, c] of [[2.9, 7.3], [8.0, 13.6], [14.1, 19.6], [20.3, 25.7]]) {
      slab(b, f, (a + c) / 2, y0, c - a, y1 - y0, 0.08, 'glass');
      const n = Math.round((c - a) / 1.3);
      for (let k = 1; k < n; k++) slab(b, f, a + ((c - a) * k) / n, y0, 0.06, y1 - y0, 0.12, 'frame');
    }
    slab(b, f, (t0 + len) / 2, y0 - 0.25, len - t0, 0.2, 0.18, 'brick');
  }
  slab(b, f, (t0 + len) / 2, 30.35, len - t0, 0.25, 0.15, 'sandstone');
  railing(b, f, t0 + 0.2, len - 0.2, 30.5, -0.3);
}
/** Light roof railing: a top rail on posts every 2.5 m. */
function railing(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, out: number) {
  slab(b, f, (t0 + t1) / 2, y + 1.0, t1 - t0, 0.06, 0.06, 'greyBrick', out);
  const n = Math.max(1, Math.round((t1 - t0) / 2.5));
  for (let k = 0; k <= n; k++) slab(b, f, t0 + ((t1 - t0) * k) / n, y, 0.06, 1.0, 0.06, 'greyBrick', out);
}

/**
 * North front on the Amstelstraat (ring edge 18, w03-3 rectified 2021-03-08, 40.1 px/m, viewer's left = east): granite base
 * to 4.1 m with five shop openings, a three- and a two-light bay, four triple bays on four storeys, pilasters with capitals,
 * the cornice at 22.5 m; the corner block (from 27.3 m, to 26.2 m) with its granite portal and a fifth row of small lights.
 */
function northFront(b: BuildingTools) {
  const {f, len} = ringFrame(ring, 18);
  const cb = 27.3, cc = (cb + len) / 2;
  slab(b, f, cb / 2 + 0.06, 0, cb - 0.12, 4.1, 0.1, 'sandstone');
  slab(b, f, cb / 2 + 0.06, 3.95, cb - 0.12, 0.2, 0.2, 'sandstone');
  for (const [a, c] of [[0.75, 5.1], [6.6, 8.85], [10.7, 15.8], [16.8, 21.9], [22.9, 26.6]]) {
    slab(b, f, (a + c) / 2, 0.0, c - a + 0.2, 3.25, 0.14, 'frame');
    slab(b, f, (a + c) / 2, 0.0, c - a, 3.1, 0.18, 'dark');
  }
  const rows: [number, number][] = [[4.3, 7.1], [9.1, 11.9], [13.7, 16.5], [18.3, 20.3]];
  group(b, f, 2.9, rows, 3, 1.0, 0.45);
  group(b, f, 7.7, rows, 2, 1.0, 0.45);
  for (const c of [13.2, 19.4, 24.6]) group(b, f, c, rows, 3, 1.0, 0.45);
  for (const t of [0.35, 5.5, 9.85, 16.2, 22.0]) pilaster(b, f, t, 4.1, 20.4, 21.6);
  slab(b, f, cb / 2, 21.75, cb, 0.9, 0.3, 'brick');
  // corner block: granite portal, four rows of three lights, pilaster at the step, cornice band
  portal(b, f, cc, 4.1, 7.3);
  group(b, f, cc, [[9.1, 11.9], [13.7, 16.5], [18.3, 20.4], [21.8, 22.8]], 3, 1.0, 0.45);
  pilaster(b, f, cb + 0.4, 4.1, 23.6, 25.0);
  slab(b, f, cc, 23.6, len - cb, 0.4, 0.15, 'brick');
  slab(b, f, cc, 25.85, len - cb + 0.1, 0.5, 0.25, 'sandstone');
}
/** Granite portal of the corner block: surround, a tall glazed opening with two dark posts. */
function portal(b: BuildingTools, f: Frame, c: number, w: number, h: number) {
  slab(b, f, c, 0, w, h, 0.22, 'sandstone');
  slab(b, f, c, 0, w - 0.9, h - 0.3, 0.27, 'dark');
  slab(b, f, c, h - 1.6, w - 0.9, 0.08, 0.31, 'frame');
  for (const k of [-1, 1]) slab(b, f, c + k * (w - 0.9) / 6, 0, 0.14, h - 0.3, 0.33, 'frame');
}

/** Corner block west face (ring edge 20, w06-274 rectified 2025-06-19, 50 px/m): portal, four rows of four lights. */
function cornerBlock(b: BuildingTools) {
  const {f, len} = ringFrame(ring, 20);
  slab(b, f, len / 2, 0, len, 4.4, 0.1, 'sandstone');
  portal(b, f, 4.0, 5.8, 7.65);
  for (const t of [1.7, 3.25, 4.75, 6.3]) for (const [y0, y1] of [[9.2, 12.1], [13.6, 16.5], [18.2, 20.1], [21.6, 22.7]] as [number, number][]) light(b, f, t, y0, y1, 1.05);
  for (const [y0] of [[9.2], [13.6], [18.2], [21.6]]) slab(b, f, 4.0, y0 - 0.2, 6.2, 0.14, 0.12, 'brick');
  // brick frame round the window field and the cornice
  slab(b, f, len / 2, 23.6, len - 0.4, 0.45, 0.14, 'brick');
  for (const t of [0.25, len - 0.25]) slab(b, f, t, 7.65, 0.5, 16.4, 0.14, 'brick');
  slab(b, f, len / 2, 25.85, len + 0.1, 0.5, 0.25, 'sandstone');
}

/**
 * Herengracht front (ring edges 2-10, 39.8 m with 0.3 m jogs; w02-163 2021 view rectified, 37.7 px/m, viewer's left = west):
 * granite base to 3.9 m, the centre entrance with relief panels between low windows over it, a two-light and a three-light
 * bay at the west end, three triple bays in the middle and singles and a triple at the east end, the cornice at 22.8 m.
 */
function herengrachtFront(b: BuildingTools) {
  const segs = [2, 4, 6, 8, 10].map(i => ({i, ...ringFrame(ring, i)}));
  let acc = 0;
  const at = segs.map(s => { const o = acc; acc += s.len; return {...s, s0: o}; });
  const OUT = 0.1;
  /** Frame and local t for a position s along the whole front. */
  const on = (s: number) => { const g = at.find(q => s >= q.s0 - 1e-6 && s <= q.s0 + q.len + 1e-6) ?? at[at.length - 1]; return {f: g.f, t: s - g.s0}; };
  for (const g of at) {
    slab(b, g.f, g.len / 2, 0, g.len - 0.12, 3.9, 0.1, 'sandstone', OUT);
    slab(b, g.f, g.len / 2, 3.75, g.len - 0.12, 0.18, 0.2, 'sandstone', OUT);
    slab(b, g.f, g.len / 2, 22.8, g.len + 0.05, 0.8, 0.3, 'brick', OUT);
    slab(b, g.f, g.len / 2, 23.95, g.len + 0.1, 0.3, 0.4, 'copper', OUT);
  }
  const up: [number, number][] = [[9.15, 12.1], [13.8, 16.6], [18.3, 21.1]];
  const col = (s: number, rows: [number, number][], w = 1.2) => { const {f, t} = on(s); for (const [y0, y1] of rows) { light(b, f, t, y0, y1, w, OUT); slab(b, f, t, y0 - 0.2, w + 0.3, 0.14, 0.12, 'brick', OUT); } };
  for (const s of [1.4, 3.05]) col(s, up, 1.15);
  for (const s of [5.9, 7.5, 9.0]) col(s, [[4.2, 7.2], ...up], 1.15);
  for (const s of [12.05, 13.45, 14.85, 17.65, 19.05, 20.45, 23.05, 24.45, 25.85]) col(s, up);
  for (const s of [29.05, 31.15, 32.5, 33.85, 36.1]) col(s, [[4.2, 7.2], ...up]);
  // centre: low windows between carved granite panels over the entrance, the recessed doorway
  for (const [a, c] of [[12.7, 15.0], [17.2, 20.6], [22.8, 25.2]]) { const {f, t} = on((a + c) / 2); light(b, f, t, 5.4, 6.9, c - a, OUT); }
  for (const s of [12.2, 15.5, 16.7, 21.1, 22.3, 25.7]) { const {f, t} = on(s); slab(b, f, t, 5.3, 0.75, 1.6, 0.22, 'sandstone', OUT); slab(b, f, t, 5.55, 0.45, 1.1, 0.3, 'sandstone', OUT); }
  {
    const {f, t} = on(18.85);
    for (const k of [-1, 0, 1]) slab(b, f, t + k * 3.1, 0, 2.2, 3.1, 0.25, 'dark', OUT);
  }
  // basement grilles under the east columns
  for (const s of [29.05, 31.15, 32.5, 33.85, 36.1]) { const {f, t} = on(s); slab(b, f, t, 2.8, 1.0, 0.85, 0.16, 'dark', OUT); slab(b, f, t, 1.2, 1.0, 0.5, 0.16, 'dark', OUT); }
  for (const s of [4.2, 10.3, 27.6]) { const {f, t} = on(s); pilaster(b, f, t, 3.9, 21.4, 22.8, OUT); }
}

/** The 4 m return of the Utrechtsestraat range (ring edge 0, w07-347): a column of single lights, granite base. */
function returnFront(b: BuildingTools) {
  const {f, len} = ringFrame(ring, 0);
  slab(b, f, len / 2, 0, len, 3.6, 0.1, 'sandstone');
  slab(b, f, 2.2, 0.3, 1.3, 2.8, 0.16, 'dark');
  for (const [y0, y1] of [[4.3, 6.8], ...ROWS1]) { light(b, f, 2.2, y0, y1, 1.2); slab(b, f, 2.2, y0 - 0.2, 1.5, 0.14, 0.12, 'brick'); }
  slab(b, f, len / 2, 23.0, len, 0.8, 0.3, 'brick');
}

/**
 * The clock tower at the Rembrandtplein corner (refs/tower-w.jpg, tower-top.jpg: recording_2025-06-19_03-28-47_01649,
 * 20 m out; arms.jpg: TMX7316010203-001664_pano_0000_001939, 2020): a square brick shaft 3.65 x 3.25 m from the pavement,
 * stepped corner piers with stone weatherings at 31.0 and 33.6 m, a small grilled window, a clock stage 37.0-39.9 m with a
 * teal dial and gilt ring on each face, a stone coping to 40.5 m; at its foot the granite base and the Amsterdam arms with
 * two lion supporters and a crown in stone (4.3-7.7 m).
 */
function tower(b: BuildingTools) {
  const {f: f23} = ringFrame(ring, 23);
  const tc = (TW.t0 + TW.t1) / 2, dc = (TW.d0 + TW.d1) / 2, W = TW.t1 - TW.t0, D = TW.d1 - TW.d0;
  const cx = f23.origin[0] + f23.tangent[0] * tc + f23.n[0] * dc, cz = f23.origin[1] + f23.tangent[1] * tc + f23.n[1] * dc;
  const yaw = Math.atan2(f23.n[0], f23.n[1]);
  const box = (w: number, d: number, y0: number, y1: number, c: string) =>
    b.add(new T.BoxGeometry(w, y1 - y0, d).rotateY(yaw).translate(cx, (y0 + y1) / 2, cz), c as never);
  // box local z runs along n after rotateY(yaw): BoxGeometry(width along t, depth along n)
  box(W, D, 0, 33.6, 'brick');
  box(W - 0.3, D - 0.3, 33.6, 37.0, 'brick');
  box(W - 0.55, D - 0.55, 37.0, 39.9, 'brick');
  box(W - 0.2, D - 0.2, 39.9, 40.25, 'sandstone');
  box(W - 0.7, D - 0.7, 40.25, 40.5, 'sandstone');
  box(W + 0.1, D + 0.1, 0, 4.1, 'sandstone');
  // four faces: frames on the tower box faces, viewer's left origin
  const faces: {f: Frame; len: number; inset: number}[] = [];
  const corner = (t: number, d: number): [number, number] => [f23.origin[0] + f23.tangent[0] * t + f23.n[0] * d, f23.origin[1] + f23.tangent[1] * t + f23.n[1] * d];
  const tg = f23.tangent, n = f23.n;
  faces.push({f: {origin: corner(TW.t0, TW.d1), tangent: [tg[0], tg[1]], n: [n[0], n[1]]}, len: W, inset: 0}); // west
  faces.push({f: {origin: corner(TW.t1, TW.d1), tangent: [-n[0], -n[1]], n: [tg[0], tg[1]]}, len: D, inset: 0}); // south
  faces.push({f: {origin: corner(TW.t1, TW.d0), tangent: [-tg[0], -tg[1]], n: [-n[0], -n[1]]}, len: W, inset: 0}); // east
  faces.push({f: {origin: corner(TW.t0, TW.d0), tangent: [n[0], n[1]], n: [-tg[0], -tg[1]]}, len: D, inset: 0}); // north
  for (const {f, len} of faces) {
    // stepped corner piers with stone weatherings
    for (const t of [0.3, len - 0.3]) {
      slab(b, f, t, 22.0, 0.6, 9.0, 0.22, 'brick');
      slab(b, f, t, 31.0, 0.7, 0.2, 0.3, 'sandstone');
    }
    slab(b, f, len / 2, 33.4, len + 0.1, 0.25, 0.18, 'sandstone');
    slab(b, f, len / 2, 34.8, 0.75, 1.0, 0.08, 'dark', -0.15);
    for (const k of [-1, 0, 1]) bar(b, f, len / 2 + k * 0.2, 34.8, 0.06, 1.0, -0.07);
    // clock: gilt ring, teal dial, hands (sits on the clock stage, inset 0.275 m from the shaft face)
    const out = -0.275;
    ringSlab(b, f, len / 2, 38.45, 0.78, 0.9, 0.1, 'gold', out);
    disc(b, f, len / 2, 38.45, 0.78, 0.08, 'blue', out);
    slab(b, f, len / 2, 38.42, 0.06, 0.55, 0.12, 'gold', out);
    slab(b, f, len / 2, 38.42, 0.42, 0.06, 0.12, 'gold', out);
    slab(b, f, len / 2, 36.85, len - 0.1, 0.25, 0.2, 'sandstone', -0.15);
  }
  arms(b, faces[0].f, W / 2);
}

/** Amsterdam arms at the tower foot (arms.jpg): pedestal, shield with the pale and three saltires, two lions, a crown. */
function arms(b: BuildingTools, f: Frame, t: number) {
  const y = 4.1, o = 0.05;
  slab(b, f, t, y, 2.9, 0.45, 0.6, 'sandstone', o);
  slab(b, f, t, y + 0.45, 2.5, 2.4, 0.18, 'sandstone', o);
  // shield
  poly(b, f, t, y + 0.75, [[-0.55, 1.9], [0.55, 1.9], [0.55, 0.6], [0, 0], [-0.55, 0.6]], 0.22, 'sandstone', o + 0.18);
  slab(b, f, t, y + 0.85, 0.32, 1.7, 0.08, 'stone', o + 0.4);
  for (const k of [0, 1, 2]) {
    const cy = y + 1.15 + k * 0.5;
    for (const s of [-1, 1]) b.add(new T.BoxGeometry(0.34, 0.06, 0.06).rotateZ(s * Math.PI / 4).rotateY(Math.atan2(f.n[0], f.n[1])).translate(f.origin[0] + f.tangent[0] * t + f.n[0] * (o + 0.5), cy, f.origin[1] + f.tangent[1] * t + f.n[1] * (o + 0.5)), 'sandstone' as never);
  }
  // lions rampant either side, facing the shield (side profiles)
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [[0, 0], [0.45, 0], [0.5, 0.7], [0.35, 1.3], [0.55, 1.75], [0.4, 2.1], [0.15, 2.0], [0.05, 1.5], [-0.05, 0.8]];
    poly(b, f, t + s * 0.95, y + 0.45, pts.map(([a, c]) => [-s * (a - 0.2), c] as [number, number]), 0.35, 'sandstone', o + 0.18);
  }
  // crown over the shield
  slab(b, f, t, y + 2.85, 0.9, 0.3, 0.3, 'sandstone', o + 0.1);
  for (const k of [-1, 0, 1]) slab(b, f, t + k * 0.35, y + 3.15, 0.14, 0.3, 0.26, 'sandstone', o + 0.12);
}
