import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, ledgeStrip, put, poly, archSlab, archBand, ringSlab, disc, letters, ringFrame, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import source from './de-burcht-footprints.json';

/**
 * De Burcht, Henri Polaklaan 9 (BAG pand 0363100012170603; H.P. Berlage 1899-1900 for the diamond workers' union ANDB;
 * Rijksmonument 1509). Native east/south metres from the BAG vertex average, y above the 3DBAG ground (0.2 m NAP).
 *
 * Massing: one closed prism per 3DBAG LoD2.2 roof plane (CC BY 4.0, scripts/landmarks/de-burcht-footprints.json), except the
 * four tower planes (75, 76, 78, 80), which the authored tower replaces. The front is the facade-ring edge 2 (bearing 210,
 * 22.76 m); t runs from its north-west end (viewer's left) to the south-east end, as on the rectified crop (50 px/m).
 * Read from the Gemeente Amsterdam panorama b_20241210_1246_Track22_Sphere_00058 (CC BY 4.0) and the RCE photographs on
 * Commons (CC BY-SA 4.0) listed in scripts/landmarks/de-burcht-inventory.json:
 *  - red-brown brick, pale dressed stone lintels, bands and arch, grey weathered-stone merlons, brown window frames,
 *    ochre-painted downpipes (2024 panorama);
 *  - the tower over the entrance, t 1.8-6.2 m (3DBAG tower planes), stone band and flared stepped stone cap at the top,
 *    a round window under it, twin lancets at top-floor level;
 *  - four window groups of three on a 3.45 m pitch right of the tower (crop: centres 8.85, 12.3, 15.65, 19.15 m), storeys
 *    0.75-2.65, 4.0-6.85, 8.0-10.45 and 13.3-14.5 m; stone band 14.75-15.0 m; A N D B panels 15.1-15.85 m; coping 16.6 m;
 *    merlons to ~17.9 m;
 *  - the stone arch (outer 2.9 m, apex 7.9 m) at the top of a straight stair up to the door at ~3.2 m.
 * INFERRED: the rear walls carry the three-window storey grid seen on Commons 20529083/84 (placement along the rear not
 * pinned); the short south-east side wall is plain brick.
 */
type Surface = {type: string; rings: number[][][]};
const src = source as unknown as {surfaces: Surface[]; facadeRing: number[][]};
const TOWER_PLANES = new Set([75, 76, 78, 80]);
const GLASS_ROOF = new Set([71, 72]);

const FRONT = ringFrame(src.facadeRing, 2).f;              // bearing 210, origin at the north-west end
const LEN = 22.76;
const shift = (f: Frame, out: number, along = 0): Frame => ({...f, origin: [f.origin[0] + f.n[0] * out + f.tangent[0] * along, f.origin[1] + f.n[1] * out + f.tangent[1] * along]});
const T0 = 1.8, T1 = 6.2, TC = 4.0, TDEPTH = 3.6, TPROUD = 0.1;    // tower span along the front, depth behind it
const TOWER = shift(FRONT, TPROUD);                                // the tower's front plane
const GROUPS = [8.85, 12.3, 15.65, 19.15];
const PANE = 0.75, PIER = 0.22;
const STOREYS: [number, number][] = [[0.75, 2.65], [4.0, 6.85], [8.0, 10.45]];
const TOP: [number, number] = [13.3, 14.5];

/** Box whose top face is narrowed to (wt, dt): a frustum, bottom at y = 0, centred on x/z. */
function frustum(wb: number, db: number, wt: number, dt: number, h: number): T.BufferGeometry {
  const g = new T.BoxGeometry(wb, h, db).translate(0, h / 2, 0);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) > h / 2) { p.setX(i, p.getX(i) * wt / wb); p.setZ(i, p.getZ(i) * dt / db); }
  g.computeVertexNormals();
  return g;
}

/** One brown-framed window: frame sheet, glass 3 cm in front of it, a transom bar (front at 0.14 m). */
function pane(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w = PANE, transom = true) {
  const h = y1 - y0;
  slab(b, f, t, y0, w, h, 0.06, 'frame');
  slab(b, f, t, y0 + 0.05, w - 0.1, h - 0.1, 0.1, 'glass');
  if (transom) slab(b, f, t, y0 + h * 0.68, w - 0.1, 0.08, 0.14, 'frame');
}

/** A group of three windows with its long stone lintel and a sill ledge. */
function windowGroup(b: BuildingTools, f: Frame, c: number, y0: number, y1: number, lintel = true) {
  for (const d of [-1, 0, 1]) pane(b, f, c + d * (PANE + PIER), y0, y1);
  const W = 3 * PANE + 2 * PIER;
  if (lintel) slab(b, f, c, y1 + 0.08, W + 0.3, 0.38, 0.17, 'stone');
  ledgeStrip(b, f, c, y0 - 0.12, W + 0.2, 0.1, 0.13, 'stone');
}

/** Merlon: a pointed stone block with a dark hole, bottom at y. */
function merlon(b: BuildingTools, f: Frame, t: number, y: number, out: number) {
  poly(b, f, t, y, [[-0.3, 0], [0.3, 0], [0.3, 0.68], [0.12, 1.0], [-0.12, 1.0], [-0.3, 0.68]], 0.42, 'concrete', out);
  slab(b, f, t, y + 0.46, 0.18, 0.18, 0.05, 'bronze', out + 0.42);
}

/** Front of the main block: window groups, top storey, bands, A N D B panels, parapet and merlons, pipes, plinth. */
function front(b: BuildingTools) {
  const f = FRONT;
  for (const c of GROUPS) {
    for (const [y0, y1] of STOREYS) windowGroup(b, f, c, y0, y1);
    // top storey: three small windows, each under a pointed stone hood
    for (const d of [-1, 0, 1]) {
      const t = c + d * (PANE + PIER);
      pane(b, f, t, TOP[0], TOP[1], 0.62, false);
      poly(b, f, t, TOP[1] + 0.02, [[-0.42, 0], [0.42, 0], [0, 0.22]], 0.14, 'stone');
    }
    ledgeStrip(b, f, c, TOP[0] - 0.12, 3 * PANE + 2 * PIER + 0.2, 0.1, 0.13, 'stone');
  }
  // iron wall anchors between the groups (and outside the end ones) at 7.4 m and 11.6 m
  const anchors = [GROUPS[0] - 1.72, ...GROUPS.slice(1).map((c, k) => (c + GROUPS[k]) / 2), GROUPS[3] + 1.72];
  for (const y of [7.4, 11.6]) for (const t of anchors) slab(b, f, t, y, 0.06, 0.45, 0.1, 'bronze');
  // the right-end door under a stone lintel, the stone plinth, the ochre downpipes
  slab(b, f, 21.5, 0.45, 0.75, 2.15, 0.08, 'copper');
  slab(b, f, 21.5, 2.68, 1.05, 0.32, 0.17, 'stone');
  slab(b, f, (T1 + LEN) / 2, 0, LEN - T1 - 0.1, 0.45, 0.08, 'concrete');
  for (const [t, y0] of [[1.0, 0.5], [T1 + 0.15, 0.5], [22.05, 5.4]]) slab(b, f, t, y0, 0.12, 14.7 - y0, 0.14, 'ochre', 0.04);

  // parapet: brick facing from the top storey band up, stone band, A N D B panels, stone coping, merlons
  for (const [a, c] of [[0, T0], [T1, LEN]] as [number, number][]) {
    const w = c - a, m = (a + c) / 2;
    slab(b, f, m, 14.62, w, 2.0, 0.45, 'brick', -0.37);
    slab(b, f, m, 14.75, w, 0.25, 0.1, 'stone', 0.08);
    slab(b, f, m, 16.6, w, 0.32, 0.6, 'stone', -0.45);
    const n = Math.max(1, Math.round((w - 0.3) / 0.9));
    for (let k = 0; k < n; k++) merlon(b, f, a + (w / n) * (k + 0.5), 16.92, -0.3);
  }
  const ANDB = 'ANDB';
  GROUPS.forEach((c, k) => {
    slab(b, f, c, 15.08, 0.95, 0.8, 0.1, 'stone', 0.08);
    slab(b, f, c, 15.16, 0.75, 0.64, 0.05, 'pink', 0.18);
    letters(b, f, ANDB[k], c, 15.13, 0.23, 0.08, 0.05, 'red', 0.075);
  });
  // corbelled stone pinnacles at both corners
  for (const t of [0.45, LEN - 0.45]) {
    poly(b, f, t, 14.9, [[-0.3, 0], [0.3, 0], [0.45, 0.7], [-0.45, 0.7]], 0.3, 'stone', 0.08);
    slab(b, f, t, 15.6, 0.9, 1.0, 0.3, 'stone', 0.08);
  }
}

/** The tower: brick shaft, twin lancets, oculus, stone band with cross vents, cornice, flared stepped cap, finial. */
function tower(b: BuildingTools) {
  const W = T1 - T0, D = TDEPTH + TPROUD, TOPY = 23.0;
  const cx = TOWER.origin[0] + TOWER.tangent[0] * TC - TOWER.n[0] * D / 2, cz = TOWER.origin[1] + TOWER.tangent[1] * TC - TOWER.n[1] * D / 2;
  const at = (g: T.BufferGeometry, y: number, c: string) => { g.rotateY(Math.atan2(TOWER.n[0], TOWER.n[1])); g.translate(cx, y, cz); b.add(g, c as never); };
  at(new T.BoxGeometry(W, TOPY, D).translate(0, TOPY / 2, 0), 0, 'brick');
  at(new T.BoxGeometry(W + 0.12, 1.2, D + 0.12).translate(0, 0.6, 0), TOPY, 'stone');
  at(frustum(W + 0.12, D + 0.12, W + 0.6, D + 0.6, 0.3), TOPY + 1.2, 'stone');
  // the cap: four tiers, each flaring out at its foot and stepping in (photos 20529090/91)
  let y = TOPY + 1.5, w = W + 0.6, d = D + 0.6;
  for (let k = 0; k < 4; k++) {
    const h = 0.5, wt = w - 1.0, dt = d - 1.0 * (D / W);
    at(frustum(w, d, wt, dt, h), y, 'slate');
    y += h; w = wt + 0.15; d = dt + 0.15 * (D / W);
  }
  at(frustum(0.5, 0.5, 0.25, 0.25, 0.35), y, 'slate');
  // cross vents in the stone band, four per side, on all four faces
  const faces: Frame[] = [0, 1, 2, 3].map(k => {
    const a = Math.atan2(TOWER.n[0], TOWER.n[1]) + k * Math.PI / 2, n: [number, number] = [Math.sin(a), Math.cos(a)];
    const half = k % 2 === 0 ? D / 2 + 0.06 : W / 2 + 0.06, span = k % 2 === 0 ? W : D;
    const tangent: [number, number] = [n[1], -n[0]];
    return {n, tangent: [-tangent[0], -tangent[1]], origin: [cx + n[0] * half + tangent[0] * span / 2, cz + n[1] * half + tangent[1] * span / 2]} as Frame;
  });
  faces.forEach((f, k) => {
    const span = k % 2 === 0 ? W : D;
    for (let i = 0; i < 4; i++) {
      const t = span * (i + 0.5) / 4;
      slab(b, f, t, TOPY + 0.35, 0.12, 0.5, 0.05, 'bronze');
      slab(b, f, t, TOPY + 0.54, 0.34, 0.12, 0.05, 'bronze');
    }
  });
  const f = TOWER;
  // oculus: stone ring, glass, white spokes
  ringSlab(b, f, TC, 20.8, 0.5, 0.7, 0.12, 'stone');
  disc(b, f, TC, 20.8, 0.52, 0.06, 'glass');
  for (let k = 0; k < 4; k++) {
    const g = new T.BoxGeometry(1.0, 0.06, 0.05).rotateZ(k * Math.PI / 4).translate(0, 0, 0.025);
    put(b, f, g, TC, 20.8, 0.07, 'white');
  }
  // twin lancets at top-floor level
  for (const s of [-0.25, 0.25]) {
    archSlab(b, f, TC + s, 13.3, 0.36, 1.3, 0.06, 'frame', 0, 4);
    archSlab(b, f, TC + s, 13.36, 0.24, 1.18, 0.1, 'glass', 0, 4);
  }
  ledgeStrip(b, f, TC, 13.15, 1.0, 0.12, 0.14, 'stone');
  // monogram tablet over the arch: the A in a ring
  slab(b, f, TC, 8.45, 1.1, 1.1, 0.1, 'stone');
  ringSlab(b, f, TC, 9.0, 0.36, 0.44, 0.06, 'red', 0.1);
  letters(b, f, 'A', TC, 8.72, 0.1, 0.07, 0.05, 'red', 0.065);
  entrance(b, f);
}

/** Entrance: brown door under a fanlight in the deep stone arch, impost blocks, the stair with its side walls and pedestals. */
function entrance(b: BuildingTools, f: Frame) {
  const LAND = 3.2;
  archSlab(b, f, TC, LAND, 1.8, 4.15, 0.06, 'copper', 0, 10);
  disc(b, f, TC, 6.25, 0.22, 0.05, 'glass', 0.06);
  archBand(b, f, TC, LAND, 2.9, 4.7, 0.55, 0.35, 'stone', 0, 12);
  for (const s of [-1, 1]) slab(b, f, TC + s * 1.2, LAND + 1.6, 0.6, 0.55, 0.42, 'stone');
  // stair: 16 risers of 0.2 m, 0.3 m treads, landing 1.4 m deep; shape in (out, y), extruded across the front
  const N = 16, R = LAND / N, G = 0.3, LANDD = 1.4, W = 2.9;
  const s = new T.Shape();
  s.moveTo(0, 0); s.lineTo(LANDD + N * G, 0);
  for (let k = 0; k < N; k++) { const x = LANDD + (N - k) * G; s.lineTo(x, (k + 1) * R); s.lineTo(x - G, (k + 1) * R); }
  s.lineTo(0, LAND); s.lineTo(0, 0);
  const stairs = new T.ExtrudeGeometry(s, {depth: W, bevelEnabled: false}).rotateY(-Math.PI / 2).translate(W / 2, 0, 0);
  put(b, f, stairs, TC, 0, -0.05, 'concrete');
  const RUN = LANDD + N * G;
  for (const side of [-1, 1]) {
    const wall = new T.Shape([[0, 0], [RUN + 0.3, 0], [RUN + 0.3, 1.0], [LANDD, LAND + 1.0], [0, LAND + 1.0]].map(p => new T.Vector2(p[0], p[1])));
    const g = new T.ExtrudeGeometry(wall, {depth: 0.45, bevelEnabled: false}).rotateY(-Math.PI / 2).translate(0.225, 0, 0);
    put(b, f, g, TC + side * (W / 2 + 0.2), 0, -0.05, 'stone');
    const ped = new T.CylinderGeometry(0.38, 0.4, 1.45, 12).translate(0, 0.725, 0);
    put(b, f, ped, TC + side * (W / 2 + 0.2), 0, RUN + 0.3 + 0.2, 'concrete');
    put(b, f, new T.SphereGeometry(0.38, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), TC + side * (W / 2 + 0.2), 1.45, RUN + 0.3 + 0.2, 'concrete');
  }
}

/** Rear of the main block (inferred placement, Commons 20529083/84): dark brick facing and the three-window storey grid. */
function rear(b: BuildingTools) {
  // the rear walls at out -17.6 (t 0-15, over the low courtyard annexes) and -18.5 (t 15-22.7, the exterior edge 4)
  const back = (out: number): Frame => ({n: [-FRONT.n[0], -FRONT.n[1]], tangent: [-FRONT.tangent[0], -FRONT.tangent[1]], origin: [FRONT.origin[0] + FRONT.n[0] * out, FRONT.origin[1] + FRONT.n[1] * out]});
  const parts: [number, number, number, number][] = [[-17.6, 0.3, 15.0, 3.5], [-18.5, 15.06, LEN - 0.1, 0]];
  for (const [out, a, c, y0] of parts) {
    const f = back(out);                     // t' = -t on this frame
    slab(b, f, -(a + c) / 2, y0 + 0.1, c - a, 15.4 - y0, 0.08, 'greyBrick');
    for (const g of [3.6, 7.05, 10.5, 13.95, 17.4, 20.85]) {
      if (g - 1.5 < a || g + 1.5 > c) continue;
      for (const [s0, s1] of [[0.75, 2.65], ...STOREYS.slice(1), TOP] as [number, number][]) {
        if (s0 < y0 + 0.4) continue;
        for (const d of [-1, 0, 1]) pane(b, shift(f, 0.08), -(g + d * (PANE + PIER)), s0, s1, s1 - s0 > 2 ? PANE : 0.62);
      }
    }
  }
}

export function buildDeBurcht(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'RoofSurface' || TOWER_PLANES.has(i)) return;
    roofPrism(b, s.rings, 'brick', GLASS_ROOF.has(i) ? 'canopyGlass' : 'slate');
  });
  b.mark?.('shell');
  setSink(0.08);
  front(b);
  tower(b);
  rear(b);
  setSink(0);
}
