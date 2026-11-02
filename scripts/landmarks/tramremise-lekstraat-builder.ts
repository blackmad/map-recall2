import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {bayPrism, rawWall, type RawWall} from './big-kit';
import {archSlab, letters, put, setSink, slab, type Frame} from './nearbar-kit';
import source from './tramremise-lekstraat-footprints.json';

/**
 * Tramremise Lekstraat (GVB "Tramremise Amsteldijk"), Kromme-Mijdrechtstraat / Waverstraat / Amsteldijk, BAG pand 0363100012106929
 * (bouwjaar 1926; "1927" on the tower door plaque; Dienst der Publieke Werken for the Gemeentetram, in use 1927/1930, still a GVB tram depot).
 * Massing is the 3DBAG LoD2.2 shell (ground 0.125 m NAP): eight long east-west roof lanterns over the hall, each with a white glazed north
 * slope and a solar-panelled south slope (PDOK 2025 orthophoto), flat bitumen valleys, a 6-8.5 m two-level perimeter band, the 10 m office
 * at the Waverstraat corner with its 15 m entrance tower, the 15 m house block at the Amsteldijk end of the north front.
 * Facade detail follows rectified municipal panoramas (40 px/m, t measured from the west corner of the north front):
 *  - north front (Kromme-Mijdrechtstraat, 2024-2025): brown brick, a grey stone plinth, light concrete copings, 5 x 2.4 m white steel
 *    windows (8 x 4 panes) at an 8 m pitch, a clerestory row under the 8.4 m upper band, two risalits with paired narrow windows,
 *    stepped stone consoles beside every entrance, the office and tower with white multi-pane windows under green drip boards,
 *    the arched tower door with its "1927" plaque, and the house block with its brick oriel, green door and louvres;
 *  - west office front (Waverstraat, 2019) and its south face over the yard wall (2021) with the steel fire stair;
 *  - west tram front (the curved yard face, 2021/2025): nine bays between brick piers under a continuous canopy band;
 *  - east tram front (Amsteldijk yard, 2025): white folding tram doors with blue panels under a navy fascia, brick piers, a deep canopy.
 */
type P2 = [number, number];
const src = source as unknown as {surfaces: Surface[]; nativeRing: number[][]};
const W = (i: number): RawWall => rawWall(src as never, i);

/** A straight line from A to B (s in metres from A) laid onto a 3DBAG wall's frame. */
function lineOn(idx: number, A: P2, B: P2) {
  const w = W(idx), L = Math.hypot(B[0] - A[0], B[1] - A[1]), u: P2 = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  return {w, f: w.f, len: L, t: (s: number) => (A[0] + u[0] * s - w.f.origin[0]) * w.f.tangent[0] + (A[1] + u[1] * s - w.f.origin[1]) * w.f.tangent[1]};
}
type Line = ReturnType<typeof lineOn>;
/** Slab on a line at s (centre), bottom y. */
const S = (b: BuildingTools, l: Line, s: number, y: number, w: number, h: number, d: number, c: string, out = 0) => slab(b, l.f, l.t(s), y, w, h, d, c, out);

/**
 * White steel window: glass 5 cm proud of the wall, a white border and mullions 5 cm in front of the glass, transoms another 4.5 cm out
 * (layers never closer than 4.5 cm, so nothing z-fights), and a concrete sill. `out` lifts the whole window onto a projecting surface.
 */
function steelWindow(b: BuildingTools, l: Line, s0: number, y: number, w: number, h: number, cols: number, rows: number, sill = true, out = 0) {
  const s = s0 + w / 2, fr = 0.08;
  if (sill) S(b, l, s, y - 0.12, w + 0.24, 0.1, 0.2, 'concrete', out);
  S(b, l, s, y + 0.02, w - fr, h - fr, 0.05, 'glass', out);
  S(b, l, s0 + fr / 2, y, fr, h, 0.1, 'white', out);
  S(b, l, s0 + w - fr / 2, y, fr, h, 0.1, 'white', out);
  S(b, l, s, y, w - 2 * fr + 0.002, fr, 0.1, 'white', out);
  S(b, l, s, y + h - fr, w - 2 * fr + 0.002, fr, 0.1, 'white', out);
  for (let k = 1; k < cols; k++) S(b, l, s0 + (w * k) / cols, y + fr, 0.05, h - 2 * fr, 0.1, 'white', out);
  for (let k = 1; k < rows; k++) S(b, l, s, y + (h * k) / rows - 0.025, w - 2 * fr - 0.01, 0.05, 0.145, 'white', out);
}
/** Office window: white multi-pane sash with a concrete sill and a green drip board over the head. */
function officeWindow(b: BuildingTools, l: Line, s0: number, y: number, w: number, h: number, cols = 3, rows = 4) {
  steelWindow(b, l, s0, y, w, h, cols, rows);
  S(b, l, s0 + w / 2, y + h + 0.03, w + 0.4, 0.09, 0.25, 'green');
}

/** Stepped stone console (Amsterdam School corbel) beside the entrances: two stacked blocks. */
function console2(b: BuildingTools, l: Line, s: number, y: number) {
  S(b, l, s, y, 0.38, 0.5, 0.42, 'stone');
  S(b, l, s, y + 0.5, 0.62, 0.45, 0.3, 'stone');
}

/** Tram door group: a white frame sheet 4 cm proud, folding leaves of glass above blue panels 5 cm in front of it, mid rails 5 cm further, a navy fascia. */
function tramDoors(b: BuildingTools, l: Line, s0: number, w: number, h: number, fascia = true) {
  const n = Math.max(2, Math.round(w / 0.9)), lw = w / n;
  S(b, l, s0 + w / 2, 0, w, h, 0.04, 'white');
  for (let k = 0; k < n; k++) {
    const c = s0 + lw * (k + 0.5);
    S(b, l, c, 1.25, lw - 0.16, h - 1.4, 0.09, 'glass');
    S(b, l, c, 0.12, lw - 0.16, 1.0, 0.09, 'pink');
    S(b, l, c, 1.25 + (h - 1.4) / 2, lw - 0.1, 0.05, 0.14, 'white');
  }
  if (fascia) S(b, l, s0 + w / 2, h + 0.02, w + 0.1, 0.55, 0.09, 'greyBrick');
}

/** Polyline frame helper for the curved west tram front: frame at arc length s with the outward normal on `side`. */
function polyline(pts: P2[], outward: P2) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const len = seg.reduce((a, c) => a + c, 0);
  const frameAt = (s: number): Frame => {
    let i = 0;
    while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; }
    const a = pts[i], q = pts[i + 1], L = seg[i], tg: P2 = [(q[0] - a[0]) / L, (q[1] - a[1]) / L];
    let n: P2 = [tg[1], -tg[0]];
    if (n[0] * outward[0] + n[1] * outward[1] < 0) n = [-n[0], -n[1]];
    const tangent: P2 = [n[1], -n[0]];
    return {origin: [a[0] + tg[0] * s, a[1] + tg[1] * s], tangent, n};
  };
  return {len, frameAt};
}

export function buildTramremiseLekstraat(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // ---------------- 3DBAG shell: roofs coloured by slope (north glazing, south solar, flat bitumen) ----------------
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    roofFor: (s: Surface) => {
      const r = s.rings[0];
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < r.length; i++) { const a = r[i], q = r[(i + 1) % r.length]; nx += (a[1] - q[1]) * (a[2] + q[2]); ny += (a[2] - q[2]) * (a[0] + q[0]); nz += (a[0] - q[0]) * (a[1] + q[1]); }
      const L = Math.hypot(nx, ny, nz); if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const top = Math.max(...r.map(p => p[1]));
      if (ny / L > 0.96 || top > 12) return 'slate';
      return nz < 0 ? 'canopyGlass' : 'blue';
    },
  });
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);

  // ---------------- North front (Kromme-Mijdrechtstraat) ----------------
  const N0: P2 = [-93.4, -40.3], N1: P2 = [86.4, -81.7];
  const NSEG: [number, number, number][] = [[0, 11.9, 219], [11.9, 19.2, 334], [19.2, 68.2, 335], [68.2, 97.0, 484], [97.0, 101.1, 367], [101.1, 174.9, 366], [174.9, 184.6, 94]];
  const NL = NSEG.map(([, , i]) => lineOn(i, N0, N1));
  const nl = (s: number) => NL[Math.max(0, NSEG.findIndex(([a, c]) => s >= a && s < c))];
  const NS = (s: number, y: number, w: number, h: number, d: number, c: string, out = 0) => S(b, nl(s), s, y, w, h, d, c, out);
  // Stone plinth, segment by segment.
  NSEG.forEach(([a, c], k) => S(b, NL[k], (a + c) / 2, 0, c - a + 0.02, 0.45, 0.07, 'stone'));
  // Copings and parapets: the long hall walls stand 0.8-0.9 m above their 3DBAG roof edge (the street panoramas show the parapet).
  const coping = (l: Line, s0: number, s1: number, y: number, d = 0.12) => S(b, l, (s0 + s1) / 2, y, s1 - s0 + 0.1, 0.24, d, 'concrete');
  coping(NL[0], 0, 11.9, 9.85, 0.14);
  coping(NL[1], 11.9, 19.2, 14.8, 0.45);
  coping(NL[2], 19.2, 68.2, 5.95, 0.32);          // ledge of the lower wall under the clerestory band
  const up = lineOn(328, N0, N1);
  coping(up, 19.2, 63.5, 8.25, 0.12);
  // Parapets on the long hall walls (3DBAG wall tops 6.2 / 6.4 m, panoramas 7.05 / 7.3 m).
  for (const [k, s0, s1, top, y1] of [[3, 68.9, 96.2, 6.2, 7.05], [5, 102.4, 174.9, 6.4, 7.3]] as const) {
    const l = NL[k], n = Math.ceil((s1 - s0) / 15), len = (s1 - s0) / n;
    for (let j = 0; j < n; j++) S(b, l, s0 + len * (j + 0.5), top - 0.02, len + 0.01, y1 - top, 0.05, 'brick');
    coping(l, s0, s1, y1 - 0.02, 0.12);
  }
  // Risalits: 8.5 m brick bays projecting 0.25 m with paired narrow windows and small low windows.
  for (const [s0, s1] of [[63.5, 68.9], [96.2, 102.4]] as const) {
    const l = nl((s0 + s1) / 2);
    // 0.45 m proud: the 3DBAG upper-band wall stands up to 0.37 m in front of the lower wall here.
    S(b, l, (s0 + s1) / 2, 0.45, s1 - s0, 8.1, 0.45, 'brick');
    S(b, l, (s0 + s1) / 2, 0, s1 - s0 + 0.04, 0.45, 0.52, 'stone');
    S(b, l, (s0 + s1) / 2, 8.5, s1 - s0 + 0.2, 0.24, 0.5, 'concrete', 0.1);
    const m = (s0 + s1) / 2;
    for (const off of [-0.68, 0.68]) {
      steelWindow(b, l, m + off - 0.37, 2.9, 0.74, 2.2, 2, 5, true, 0.45);
      steelWindow(b, l, m + off - 0.3, 1.8, 0.6, 0.55, 2, 1, true, 0.45);
    }
    steelWindow(b, l, m - 0.3, 6.75, 0.6, 0.65, 2, 2, true, 0.45);
  }
  // Big white steel windows of the hall (left edges from the rectified crops).
  for (const s0 of [22.2, 31.05, 38.8, 46.9, 54.5, 71.6, 79.6, 87.7, 104.4, 112.4, 120.4, 129.1, 137.1, 145.7, 153.6]) steelWindow(b, nl(s0 + 2.5), s0, 2.9, s0 === 145.7 ? 4.5 : 5.0, 2.4, 8, 4);
  steelWindow(b, nl(167), 165.4, 2.9, 4.5, 2.4, 7, 4);
  for (const s0 of [163.4, 170.6]) steelWindow(b, nl(s0), s0, 2.9, 0.9, 2.4, 2, 4);
  // Small low windows under some hall windows.
  for (const s of [47.4, 49.4, 51.5, 54.85, 59.1]) steelWindow(b, nl(s), s - 0.3, 1.7, 0.6, 0.65, 2, 1);
  // Clerestory row in the upper band.
  for (let k = 0; ; k++) { const s0 = 19.75 + 1.785 * k; if (s0 + 1.25 > 63.2) break; steelWindow(b, up, s0, 6.45, 1.25, 0.8, 3, 1, false); }
  // Stepped stone consoles beside the entrances and risalits.
  for (const s of [11.1, 18.9, 63.35, 68.85, 95.95, 101.65, 176.0]) console2(b, nl(s), s, 2.3);

  // Office (t 0-11.9): two storeys of white multi-pane windows under green drip boards.
  for (const s0 of [2.95, 4.75, 6.45, 8.2]) { officeWindow(b, NL[0], s0, 1.75, 1.05, 2.45); officeWindow(b, NL[0], s0, 5.7, 1.05, 2.05); }
  // Tower (t 11.9-19.2): arched door with the 1927 plaque, four storeys of windows, a projecting concrete roof slab.
  {
    const l = NL[1];
    archSlab(b, l.f, l.t(13.5), 0.45, 1.5, 3.05, 0.12, 'brick', 0);
    archSlab(b, l.f, l.t(13.5), 0.45, 1.2, 2.85, 0.16, 'red', 0, 8);
    S(b, l, 13.45, 4.15, 0.75, 0.42, 0.06, 'stone');
    letters(b, l.f, '1927', l.t(13.45), 4.17, 0.06, 0.042, 0.03, 'gold');
    officeWindow(b, l, 16.1, 2.05, 1.15, 1.95);
    for (const s0 of [13.0, 16.1]) { officeWindow(b, l, s0, 5.7, 1.15, 1.9); officeWindow(b, l, s0, 9.25, 1.15, 2.0); officeWindow(b, l, s0, 12.5, 1.15, 1.6); }
    S(b, l, 15.55, 15.0, 7.9, 0.25, 0.6, 'concrete');
  }
  // House block at the Amsteldijk end (t 174.9-184.6): arched passage, stone base, green door with a concrete hood, louvres, brick oriel.
  {
    const l = NL[6];
    archSlab(b, l.f, l.t(176.4), 0, 1.45, 3.2, 0.12, 'dark');
    S(b, l, 178.55, 0.45, 2.3, 1.8, 0.08, 'stone');
    S(b, l, 183.3, 0.45, 2.1, 1.8, 0.08, 'stone');
    S(b, l, 181.15, 0.45, 2.15, 2.5, 0.1, 'white');
    S(b, l, 181.15, 0.5, 1.85, 2.4, 0.14, 'green');
    S(b, l, 181.15, 2.95, 2.7, 0.25, 0.4, 'concrete');
    S(b, l, 179.35, 2.75, 0.65, 1.25, 0.06, 'dark');
    S(b, l, 183.2, 2.75, 0.65, 1.25, 0.06, 'dark');
    S(b, l, 181.15, 3.4, 1.95, 0.8, 0.06, 'dark');
    steelWindow(b, l, 176.15, 6.6, 0.55, 1.5, 1, 4);
    for (const s0 of [179.0, 182.85]) { steelWindow(b, l, s0, 6.95, 0.75, 1.6, 2, 4); steelWindow(b, l, s0, 10.4, 0.75, 1.35, 2, 3); }
    // Oriel: canted brick bay on stone corbels with a glazed band (5.9-10.75 m).
    S(b, l, 181.25, 5.5, 2.1, 0.4, 0.5, 'stone');
    bayPrism(b, l.f, l.t(181.25), 5.9, 2.5, 1.3, 0.85, 0.45, 'brick');
    bayPrism(b, l.f, l.t(181.25), 7.2, 2.56, 0.1, 0.92, 0.47, 'concrete');
    bayPrism(b, l.f, l.t(181.25), 7.3, 2.36, 1.6, 0.76, 0.42, 'glass');
    for (const q of [-0.62, 0, 0.62]) S(b, l, 181.25 + q, 7.3, 0.07, 1.6, 0.86, 'white');
    bayPrism(b, l.f, l.t(181.25), 8.9, 2.56, 0.1, 0.92, 0.47, 'concrete');
    bayPrism(b, l.f, l.t(181.25), 9.0, 2.5, 1.75, 0.85, 0.45, 'brick');
    bayPrism(b, l.f, l.t(181.25), 10.75, 2.6, 0.12, 0.92, 0.47, 'concrete');
    S(b, l, 181.45, 11.4, 2.1, 0.6, 0.04, 'dark');
    steelWindow(b, l, 181.0, 12.6, 0.4, 0.4, 1, 1, false);
    coping(l, 174.9, 184.6, 14.97, 0.14);
  }

  // ---------------- West office front (Waverstraat, wall 158; s from the north corner) ----------------
  {
    const l = lineOn(158, [-93.4, -40.3], [-88.3, -17.9]);
    S(b, l, l.len / 2, 0, l.len, 0.4, 0.07, 'stone');
    for (const s0 of [1.3, 8.8, 10.7, 12.6, 14.5, 16.4]) { officeWindow(b, l, s0, 5.96, 1.2, 2.0); officeWindow(b, l, s0, 1.76, 1.2, 2.4); }
    for (const s0 of [6.9, 18.8]) { officeWindow(b, l, s0, 6.46, 0.7, 1.1, 2, 3); officeWindow(b, l, s0, 2.66, 0.7, 1.1, 2, 3); }
    S(b, l, 15.1, 5.45, 1.1, 0.22, 0.04, 'white');     // vent grille under a window
    coping(l, 0, 21.7, 9.895, 0.14);
  }
  // Office south face over the yard (wall 330; s from the west end): upper windows, the fire-stair door, the steel stair.
  {
    const l = lineOn(330, [-82.4, -19.1], [-68.6, -22.3]);
    for (const s0 of [1.8, 6.04, 8.1, 13.0]) officeWindow(b, l, s0, 6.36, 1.3, 2.5);
    officeWindow(b, l, 3.9, 5.75, 1.3, 3.1, 3, 5);
    // Fire stair: a landing at the door and a flight down to the 3.5 m roof of the yard wing.
    S(b, l, 4.9, 5.45, 3.2, 0.12, 1.2, 'bronze');
    const flight = new T.BoxGeometry(3.4, 0.12, 0.9).rotateZ(Math.atan2(2.1, 3.0)).translate(0, 0, 0.45 + 0.3);
    put(b, l.f, flight, l.t(3.3), 4.55, -0.3 + 0.1, 'bronze');
    coping(l, 0, 14.1, 9.85, 0.14);
  }
  // Yard wing and other low walls (<= 4 m): heavy light-concrete coping as in the 2018-2021 Waverstraat panoramas.
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = W(i), ys = s.rings[0].map(p => p[1]);
    if (w.len < 2.5 || Math.min(...ys) > 0.05 || w.top > 4.2 || w.top < 3 || w.f.origin[0] > -40 || i === 9) return;
    slab(b, w.f, w.len / 2, w.top - 0.55 + (i % 2) * 0.045, w.len + 0.06, 0.6, 0.12, 'concrete');
  });
  // Glazed pavilion (wall 9) facing the yard: glass between a white fascia and a low base.
  {
    const l = lineOn(9, [-85.2, -6.0], [-81.1, -7.0]);
    S(b, l, l.len / 2, 0.35, l.len - 0.3, 2.45, 0.06, 'glass');
    for (const s of [0.15 + l.len / 3, 0.15 + (2 * l.len) / 3 - 0.3]) S(b, l, s, 0.35, 0.08, 2.45, 0.1, 'white');
    S(b, l, l.len / 2, 0, l.len - 0.12, 0.35, 0.08, 'white');
    S(b, l, l.len / 2, 2.9, l.len + 0.26, 0.55, 0.45, 'white');
  }

  // ---------------- West tram front: the curved yard face, nine bays under a continuous canopy band ----------------
  // 3DBAG draws the curve as 0.3-1.3 m facets with pier notches; each bay gets a flat brick skin standing just in front of its facets
  // (sunk through them), so the bay's doors, piers and canopy sit on one plane, with a 0.25 m coping lip above the 10 m roof edge.
  {
    const pl = polyline([[-64.6, -8.4], [-62.1, -5.0], [-59.6, -1.5], [-57.8, 2.5], [-56.8, 6.5], [-56.25, 10.5], [-56.3, 14.5], [-57.0, 18.5], [-58.0, 21.9]], [-1, 0]);
    const NB = 9, bay = pl.len / NB, pier = 0.9;
    const kinds = ['open', 'doors', 'doors', 'doors', 'window', 'doors', 'doors', 'doors', 'doors'];
    const P = Array.from({length: NB + 1}, (_, k) => pl.frameAt(Math.min(k * bay, pl.len - 1e-6)).origin as P2);
    const verts: P2[] = [];
    src.surfaces.forEach(sf => {
      if (sf.type !== 'WallSurface') return;
      const r = sf.rings[0], cx = r.reduce((q, v) => q + v[0], 0) / r.length, cz = r.reduce((q, v) => q + v[2], 0) / r.length;
      if (cx > -66 && cx < -54 && cz > -10 && cz < 23) for (const v of r) verts.push([v[0], v[2]]);
    });
    for (let k = 0; k < NB; k++) {
      const A = P[k], B = P[k + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), u: P2 = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
      let n: P2 = [u[1], -u[0]];
      if (n[0] > 0) n = [-n[0], -n[1]];
      let hi = -Infinity, lo = Infinity;
      for (const v of verts) {
        const al = (v[0] - A[0]) * u[0] + (v[1] - A[1]) * u[1];
        if (al < -0.3 || al > L + 0.3) continue;
        const o = (v[0] - A[0]) * n[0] + (v[1] - A[1]) * n[1];
        hi = Math.max(hi, o); lo = Math.min(lo, o);
      }
      // Odd bays stand 5 cm further out and 4.5 cm higher, so the overlapping ends of neighbouring bays never share a plane.
      const par = k % 2, front = Math.max(hi, 0) + 0.03 + par * 0.05, depth = Math.min(1.2, front - Math.min(lo, 0) + 0.3), dy = par * 0.045;
      const f: Frame = {origin: [A[0] + n[0] * front, A[1] + n[1] * front], tangent: [n[1], -n[0]], n};
      const l: Line = {w: undefined as never, f, len: L, t: (q: number) => (A[0] + u[0] * q - A[0]) * f.tangent[0] + (A[1] + u[1] * q - A[1]) * f.tangent[1]};
      put(b, f, new T.BoxGeometry(L + 0.3, 10.25 + dy, depth).translate(0, (10.25 + dy) / 2, -depth / 2), l.t(L / 2), 0, 0, 'brick');
      S(b, l, L / 2, 10.23 + dy, L + 0.32, 0.22, 0.12, 'concrete');
      for (const q of [pier / 4, L - pier / 4]) S(b, l, q, 0, pier / 2 + 0.02, 4.4, 0.35, 'brick');
      const w = L - pier;
      if (kinds[k] === 'open') S(b, l, L / 2, 0, w, 4.2, 0.04, 'dark');
      else if (kinds[k] === 'window') { steelWindow(b, l, pier / 2, 0.6, w, 1.6, 6, 2, false); steelWindow(b, l, pier / 2, 2.45, w, 1.8, 6, 3, false); }
      else tramDoors(b, l, pier / 2, w, 3.75, true);
      // Canopy band: projecting brick beam with a concrete edge.
      S(b, l, L / 2, 4.4 + dy, L + 0.05, 0.85, 0.9, 'brick');
      S(b, l, L / 2, 5.25 + dy, L + 0.08, 0.14, 0.98, 'concrete');
    }
  }

  // ---------------- East tram front (Amsteldijk yard; s from the south end) ----------------
  {
    const A: P2 = [114.3, 13.3], B: P2 = [107.2, -19.0];
    const l1 = lineOn(522, A, B), l2 = lineOn(512, A, B);
    const el = (s: number) => (s < 16.5 ? l1 : l2);
    const ES = (s: number, y: number, w: number, h: number, d: number, c: string, out = 0) => S(b, el(s), s, y, w, h, d, c, out);
    // 3DBAG has the front as two walls (s 0-12.8 and 20.27-33.07) with a stepped 0.5-1.2 m projection between them (hidden by the
    // gatehouse in every panorama): door bays only on the two straight walls, the canopy runs across.
    for (const [s0, w] of [[0.4, 1.65], [3.5, 3.6], [8.55, 3.6], [20.6, 3.25], [25.0, 3.25], [29.4, 3.25]]) tramDoors(b, el(s0 + w / 2), s0, w, 4.85, true);
    for (const [a, c] of [[2.0, 3.55], [7.05, 8.6], [12.1, 12.8], [20.27, 20.65], [23.8, 25.05], [28.2, 29.45], [32.6, 33.07]]) ES((a + c) / 2, 0, c - a, 6.1, 0.3, 'brick');
    // Deep canopy over the doors: brick fascia, dark soffit, concrete edge.
    for (const [s0, s1] of [[0, 12.8], [12.8, 20.27], [20.27, 33.07]]) {
      ES((s0 + s1) / 2, 6.1, s1 - s0, 0.8, 1.5, 'brick');
      ES((s0 + s1) / 2, 6.02, s1 - s0, 0.08, 1.42, 'dark');
      ES((s0 + s1) / 2, 6.9, s1 - s0 + 0.04, 0.12, 1.56, 'concrete');
    }
    coping(l1, 0, 12.8, 9.8, 0.14);
    coping(l2, 20.27, 33.07, 9.8, 0.14);
    steelWindow(b, l1, 8.72, 8.05, 0.55, 0.7, 1, 1, false);
  }
  // Ground-floor shop under the Amsteldijk houses (wall 16, 3.6 m; s from the west end): white frames, red-brown doors, white band.
  {
    const l = lineOn(16, [91.2, -62.3], [104.0, -65.2]);
    steelWindow(b, l, 0.9, 0.6, 2.6, 2.3, 4, 2);
    for (const q of [4.0, 5.2, 8.9, 10.0]) { S(b, l, q, 0, 1.0, 2.7, 0.04, 'white'); S(b, l, q, 0.05, 0.8, 2.55, 0.09, 'red'); }
    steelWindow(b, l, 6.3, 0.6, 1.9, 2.3, 3, 2);
    steelWindow(b, l, 11.2, 0.6, 1.4, 2.3, 2, 2);
    S(b, l, l.len / 2, 3.0, l.len + 0.2, 0.32, 0.55, 'white');
  }
  setSink(0);
}
