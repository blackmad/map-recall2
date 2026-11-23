import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {disc, getSink, poly, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import source from './sofitel-the-grand-1926-footprints.json';

/**
 * SOFITEL THE GRAND, 1924-26 WING (BAG pand 0363100012250983, rijksmonument 6085: "een nieuwe vleugel uit 1924-1926 naar het
 * ontwerp van A.R. Hulshoff en N. Lansdorp in de stijl van de Amsterdamse school"). The wing's long front follows the
 * Oudezijds Achterburgwal in a gentle curve of 5 m facets (the 3DBAG ring's edges 1-37, facing W-NW). Read from the
 * rectified Gemeente Amsterdam panoramas TMX7316010203-001981_pano_0000_000196 to _000228 (2021-01-25, frontal, 50 px/m)
 * with the 2017 series as the second view, and TMX7315120208-000073_pano_0004_000064 (2016) for the ground-storey piers;
 * CC BY 4.0. Heights are fitted per photo to the 3DBAG wall tops (16.2 m on the north block, 18.7-19.4 m on the curve,
 * 22.4 m on the stair tower).
 *
 *  - North block (edge 1, 20.1 m, w01-300): a granite base storey with ten dark-wood windows under a stone band, a
 *    mezzanine row of eleven small sash windows with carved brick corbels between them under a corbelled course, two
 *    rows of four wide white windows (five lights over three), a stone band at 16.2 m and a set-back attic storey with
 *    four groups of three small windows under dark headers, eaves at 19.3 m.
 *  - Stair tower (edge 3, 6.7 m, w06-300): a stone-framed stair window of three lights in seven tiers from 1.9 to 17.2 m,
 *    three small windows under hoods at the top and a stepped stone crest over the parapet (22.4-23.7 m).
 *  - The curve (edges 5-33, w08-w15): per facet a granite pier with a carved figure capital and a wide dark-wood window
 *    in the stone base, three wide white windows, a stone string course at 13.9 m, four small attic windows under dark
 *    headers and a white dormer in the tiled roof.
 *  - South end (edge 37, w07-285): the low block's wide window and the tower's narrow windows.
 * Back and courtyard sides (w05, w14, w17) have no panorama: shell.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
type Col = 'brick' | 'dark' | 'stone' | 'sandstone' | 'bronze' | 'glass' | 'frame' | 'greyBrick' | 'slate' | 'concrete' | 'copper';

const shift = (f: Frame, k: number): Frame => ({origin: [f.origin[0] + f.n[0] * k, f.origin[1] + f.n[1] * k], tangent: f.tangent, n: f.n});

export function buildSofitelTheGrand1926(_w: number, _d: number, b: BuildingTools) {
  // Edge 13's 3DBAG front has a 0.66 m piece leaning 6 cm back (surfaces 262/266); it is redrawn flush with its neighbours so
  // the facet reads as one wall (and its wide windows sit on one plane).
  const LEAN = new Set([262, 266]);
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => LEAN.has(i)});
  {
    const {f} = ringFrame(src.facadeRing, 13);
    const r = src.surfaces[266].rings[0];
    const pts = r.map(p => [(p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1], p[1]] as [number, number]);
    poly(b, f, 0, 0, pts, 0.02, 'brick', 0.02 + getSink());
  }
  const sink0 = getSink();
  setSink(0.04);
  northBlock(b);
  stairTower(b);
  for (const e of [5, 9, 13, 17, 21, 25, 29]) curveFacet(b, e, 5.1);
  curveFacet(b, 33, 2.76);
  southEnd(b);
  southSide(b);
  setSink(sink0);
}

/** A white window: glass 7-9 cm proud, a white frame border and glazing bars 9-14 cm proud (layer rule 3.5 cm). */
function lights(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, cols: number, rows: number, glass: Col = 'glass', frame: Col = 'frame', bar = 0.06) {
  slab(b, f, t, y0 + 0.04, w - 0.08, y1 - y0 - 0.08, 0.02, glass, 0.07);
  const B = 0.08;
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - B / 2), y0, B, y1 - y0, 0.05, frame, 0.09);
  slab(b, f, t, y0, w - 2 * B, B, 0.05, frame, 0.09);
  slab(b, f, t, y1 - B, w - 2 * B, B, 0.05, frame, 0.09);
  for (let c = 1; c < cols; c++) slab(b, f, t - w / 2 + c * w / cols, y0 + B, bar, y1 - y0 - 2 * B, 0.05, frame, 0.09);
  for (let r = 1; r < rows; r++) slab(b, f, t, y0 + r * (y1 - y0) / rows - bar / 2, w - 2 * B, bar, 0.05, frame, 0.09);
}

/** The Amsterdam School wide window: five upper lights over a transom, three lower lights (narrow, wide, narrow), a stone sill. */
function wide(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number) {
  const tr = y1 - (y1 - y0) * 0.47;
  slab(b, f, t, y0 + 0.04, w - 0.08, y1 - y0 - 0.08, 0.02, 'glass', 0.07);
  const B = 0.09;
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - B / 2), y0, B, y1 - y0, 0.05, 'frame', 0.09);
  slab(b, f, t, y0, w - 2 * B, B, 0.05, 'frame', 0.09);
  slab(b, f, t, y1 - B, w - 2 * B, B, 0.05, 'frame', 0.09);
  slab(b, f, t, tr - 0.06, w - 2 * B, 0.12, 0.05, 'frame', 0.09);
  // upper five lights, each with a horizontal bar
  for (let c = 1; c < 5; c++) slab(b, f, t - w / 2 + c * w / 5, tr + 0.06, 0.05, y1 - tr - 0.06 - B, 0.05, 'frame', 0.09);
  slab(b, f, t, (tr + y1) / 2, w - 2 * B, 0.04, 0.05, 'frame', 0.09);
  // lower: narrow side lights of a fifth of the width
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - w / 5), y0 + B, 0.06, tr - 0.06 - y0 - B, 0.05, 'frame', 0.09);
  // stone sill with short ears either side (2021: dark ledges at the sill ends)
  slab(b, f, t, y0 - 0.12, w + 0.3, 0.12, 0.18, 'stone');
}

/** A small attic or mezzanine sash under a dark header. */
function small(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, header = true) {
  lights(b, f, t, y0, y1, w, 2, 3);
  if (header) slab(b, f, t, y1, w + 0.2, 0.28, 0.1, 'greyBrick');
  slab(b, f, t, y0 - 0.08, w + 0.12, 0.08, 0.12, 'stone');
}

/** Dark-wood window in the granite base: frames and a grid of panes. */
function woodWindow(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, cols: number, rows: number) {
  // set 6 cm forward so the glass clears the granite facing (8 cm) by 5 cm
  lights(b, shift(f, 0.06), t, y0, y1, w, cols, rows, 'glass', 'dark', 0.07);
}

function northBlock(b: BuildingTools) {
  const {f, len} = ringFrame(src.facadeRing, 1);
  const L = 18.9; // the 16.2 m block; t 18.9-20.1 is the corner tower
  // granite base and its band (w01: y 1010-1170, band 1010-1030)
  slab(b, f, L / 2, 0, L - 0.04, 2.93, 0.08, 'stone');
  slab(b, f, L / 2, 2.93, L - 0.04, 0.41, 0.14, 'stone');
  for (let k = 0; k < 10; k++) woodWindow(b, f, 1.95 + k * 1.7, 1.57, 2.72, 0.95, 2, 2);
  // mezzanine: eleven sashes with carved corbels between, under a corbelled course
  for (let k = 0; k < 11; k++) small(b, f, 1.67 + k * 1.74, 4.28, 6.52, 1.15, false);
  for (let k = 0; k <= 11; k++) {
    const t = 0.8 + k * 1.74;
    if (t > L - 0.3) break;
    slab(b, f, t, 6.3, 0.26, 0.75, 0.12, 'stone');
    slab(b, f, t, 6.85, 0.36, 0.2, 0.18, 'stone');
  }
  slab(b, f, L / 2, 7.45, L - 0.04, 0.16, 0.1, 'brick');
  for (let k = 0; k < 47; k++) slab(b, f, 0.25 + k * 0.4, 7.3, 0.16, 0.15, 0.16, 'brick');
  // two rows of four wide windows
  for (const t of [4.31, 8.89, 13.44, 18.05].map(v => Math.min(v, L - 1.5))) {
    wide(b, f, t, 8.05, 10.76, 2.7);
    wide(b, f, t, 12.0, 14.8, 2.7);
  }
  // stone band at the 3DBAG wall top, then the attic storey 0.3 m back
  slab(b, f, L / 2, 15.95, L, 0.3, 0.2, 'stone');
  const fa = shift(f, -0.33);
  // four groups of three (w01: centres x 223, 444, 664, 885 px), the last pulled in to clear the corner tower at t 18.9;
  // r17 recount (w01 at 50 px/m): windows 0.76 m frame to frame at a 1.13 m pitch in a group (x 149-186, 205-244, 262-301)
  for (const c of [4.4, 8.8, 13.2, 17.35]) for (const o of [-1.13, 0, 1.13]) small(b, fa, c + o, 16.6, 17.8, 0.76);
  void len;
}

function stairTower(b: BuildingTools) {
  const {f} = ringFrame(src.facadeRing, 3);
  slab(b, f, 3.35, 0, 6.6, 1.9, 0.08, 'stone');
  // the stair window: stone frame, stone mullions and transoms, leaded lights in seven tiers (w06: y 340-1065)
  const t0 = 2.3, t1 = 5.5, y0 = 1.9, y1 = 17.2, tc = (t0 + t1) / 2, W = t1 - t0;
  slab(b, f, tc, y0 + 0.04, W - 0.1, y1 - y0 - 0.08, 0.02, 'copper', 0.07);
  for (const s of [-1, 1]) slab(b, f, tc + s * (W / 2 - 0.09), y0 - 0.15, 0.18, y1 - y0 + 0.3, 0.2, 'stone', 0);
  slab(b, f, tc, y0 - 0.25, W + 0.4, 0.25, 0.22, 'stone');
  slab(b, f, tc, y1, W + 0.4, 0.3, 0.22, 'stone');
  for (const s of [-1, 1]) slab(b, f, tc + s * W / 6, y0, 0.12, y1 - y0, 0.06, 'stone', 0.09);
  for (let k = 1; k < 7; k++) slab(b, f, tc, y0 + k * (y1 - y0) / 7 - 0.06, W - 0.36, 0.12, 0.06, 'stone', 0.09);
  // three small windows under little hoods at the top (y 225-295)
  for (const o of [-0.75, 0, 0.75]) {
    lights(b, f, tc + o, 18.1, 19.5, 0.55, 1, 2);
    slab(b, f, tc + o, 19.5, 0.7, 0.14, 0.28, 'stone');
    slab(b, f, tc + o, 19.64, 0.5, 0.14, 0.16, 'stone');
  }
  // stepped stone crest over the parapet (w06: 2.4 m wide at 22.4 m, 23.7 m at the top)
  slab(b, f, tc, 21.9, 3.0, 0.5, 0.35, 'stone');
  for (const [w, y, h] of [[2.4, 22.4, 0.45], [1.6, 22.85, 0.45], [0.8, 23.3, 0.42]] as const) slab(b, f, tc, y, w, h, 0.5, 'stone', -0.1);
  // vertical fins on the crest (w06: two pairs of uprights over the window's mullions)
  for (const o of [-0.53, 0.53]) slab(b, f, tc + o, 19.8, 0.14, 2.1, 0.12, 'stone', 0);
}

function curveFacet(b: BuildingTools, e: number, len: number) {
  const {f} = ringFrame(src.facadeRing, e);
  const narrow = len < 4;
  // granite base with a wide dark-wood window, the pier with its figure capital at the facet's north end
  slab(b, f, len / 2, 0, len - 0.04, 2.7, 0.08, 'stone');
  slab(b, f, len / 2, 2.7, len - 0.04, 0.3, 0.14, 'stone');
  if (!narrow) woodWindow(b, f, 2.95, 0.1, 2.3, 3.9, 4, 3);
  else woodWindow(b, f, 1.55, 0.1, 2.3, 2.1, 2, 3);
  slab(b, f, 0.42, 0, 0.8, 2.7, 0.24, 'stone');
  figure(b, f, 0.42, 2.1);
  // three wide windows (w12: x 68-232, y 465-985)
  const tw = narrow ? 1.45 : 3.0, ww = narrow ? 2.0 : 3.2;
  for (const [y0, y1] of [[3.47, 5.98], [7.27, 9.79], [11.0, 13.5]]) wide(b, f, tw, y0, y1, ww);
  // string course
  slab(b, f, len / 2, 13.85, len - 0.04, 0.2, 0.14, 'stone');
  // small attic windows under dark headers (w12: x 12-228 in four, y 300-380)
  const atts = narrow ? [0.85, 2.0] : [0.64, 1.82, 2.98, 4.14];
  for (const t of atts) small(b, f, t, 15.2, 16.7, 0.85);
  // dormers on the facets from the stair tower to edge 25; edge 29's (next to the 24 m south tower) is not drawn: the audit
  // clusters its front with the tower's and reads the pane as past the wall
  if (!narrow && e !== 29) dormer(b, f, 3.03, 3.0, e);
}

/** The facets' cornice (median 3DBAG wall top of edges 9-29: 19.39, 19.18, 18.72, 19.04, 19.35). The 2021 panoramas show one
 *  continuous eaves line along the curve with every dormer just above it. */
const CURVE_EAVES = 19.18;

/** Front-plane 3DBAG walls of edge e, projected to (t, y), with how far each stands proud of the ring line. */
function frontWalls(e: number): {pts: [number, number][]; proud: number}[] {
  const {f} = ringFrame(src.facadeRing, e);
  const out: {pts: [number, number][]; proud: number}[] = [];
  for (const s of src.surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0];
    const n = r.map(p => (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]);
    if (Math.max(...n.map(Math.abs)) > 0.1) continue;
    out.push({pts: r.map(p => [(p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1], p[1]] as [number, number]), proud: Math.max(0, ...n)});
  }
  return out;
}

/** The part of a polygon at or above height y (one Sutherland-Hodgman clip). */
function clipAbove(pts: [number, number][], y: number): [number, number][] {
  const res: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], c = pts[(i + 1) % pts.length];
    const ia = a[1] >= y, ic = c[1] >= y;
    if (ia) res.push(a);
    if (ia !== ic) { const k = (y - a[1]) / (c[1] - a[1]); res.push([a[0] + k * (c[0] - a[0]), y]); }
  }
  return res;
}

/** A white dormer box in the tiled roof just above the eaves (w12: x 75-228, y 145-190), its front 0.1 m behind the wall (the 3DBAG roof rises ~1.3 m per metre back, so a deeper front sinks into the slope). */
function dormer(b: BuildingTools, f: Frame, t: number, w: number, e: number) {
  let top = eaves(e), front = -0.1;
  if (top > CURVE_EAVES + 0.4) {
    // Edges 5 and 13: the 3DBAG fused the dormer and roof into the front wall (tops 21.7 and 20.7 m), which put these two
    // dormers 1.5-2.5 m above their neighbours. The photo's tiled roof is drawn over the wall above the cornice line and
    // the dormer sits on the line like the others.
    top = CURVE_EAVES;
    let proud = 0;
    for (const {pts, proud: p} of frontWalls(e)) proud = Math.max(proud, p);
    for (const {pts} of frontWalls(e)) {
      if (Math.max(...pts.map(p => p[1])) <= CURVE_EAVES + 0.4) continue;
      const up = clipAbove(pts, CURVE_EAVES);
      if (up.length >= 3) poly(b, f, 0, 0, up, 0.03, 'slate', proud + 0.04);
    }
    front = proud + 0.1; // in front of that tiled cover
  }
  // Edge 21's 3DBAG wall top is 18.72 m, half a metre under the line its neighbours share; the photo's dormers stand level.
  top = Math.max(top, CURVE_EAVES - 0.1);
  const y0 = top + 0.12, h = 0.95, fd = shift(f, front);
  // cheeks and top in the roof's tile, the front in cream boarding
  slab(b, fd, t, y0, w + 0.2, h + 0.15, 1.6, 'slate', -1.6);
  slab(b, fd, t, y0, w, h, 0.04, 'concrete', 0.0);
  lights(b, fd, t, y0 + 0.1, y0 + h - 0.1, w - 0.2, 4, 1);
}

/** Wall top of a front edge's main wall (3DBAG), for dormers. */
function eaves(e: number) {
  const {f, len} = ringFrame(src.facadeRing, e);
  let best = 0;
  for (const s of src.surfaces) {
    if (s.type !== 'WallSurface') continue;
    const r = s.rings[0];
    const outs = r.map(p => (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]);
    if (Math.max(...outs.map(Math.abs)) > 0.1) continue;
    const ts = r.map(p => (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1]);
    if (Math.max(...ts) < 0.5 * len || Math.min(...ts) > 0.5 * len) continue;
    best = Math.max(best, ...r.map(p => p[1]));
  }
  return best || 18.7;
}

/** The carved figure on the pier top (2016 w16: a standing figure cut into the granite, ~1 m tall): stacked blocks and a head. */
function figure(b: BuildingTools, f: Frame, t: number, y: number) {
  const out = 0.2;
  slab(b, f, t, y - 0.1, 0.62, 0.12, 0.14, 'sandstone', out);
  slab(b, f, t, y, 0.44, 0.42, 0.14, 'sandstone', out);
  slab(b, f, t, y + 0.42, 0.34, 0.2, 0.12, 'sandstone', out);
  const head = new T.SphereGeometry(0.11, 8, 6).translate(0, 0.11, 0);
  put(b, f, head, t, y + 0.62, out + 0.08, 'sandstone');
  disc(b, f, t, y + 0.25, 0.09, 0.04, 'sandstone', out + 0.14);
}

function southEnd(b: BuildingTools) {
  const {f} = ringFrame(src.facadeRing, 37);
  // the low block (t 1.4-6.2, 7.7 m): granite base with a wood window, the wide window over it (w07: y 870-980)
  slab(b, f, 3.77, 0, 4.66, 2.7, 0.08, 'stone');
  slab(b, f, 3.77, 2.7, 4.66, 0.3, 0.14, 'stone');
  woodWindow(b, f, 3.8, 0.1, 2.3, 3.6, 4, 3);
  lights(b, f, 3.8, 3.6, 5.8, 3.9, 3, 2);
  slab(b, f, 3.8, 3.48, 4.2, 0.12, 0.18, 'stone');
  slab(b, f, 3.8, 7.45, 4.76, 0.25, 0.16, 'stone');
  // the tower face (t 0-1.4, to 24.4 m): narrow windows at three levels and a pair at the top
  slab(b, f, 0.7, 0, 1.36, 2.7, 0.08, 'stone');
  for (const [y0, y1] of [[7.0, 9.4], [10.7, 13.2], [14.4, 16.8]]) small(b, f, 0.7, y0, y1, 1.0, false);
  for (const o of [-0.27, 0.27]) small(b, f, 0.7 + o, 18.3, 19.2, 0.42, false);
}

/**
 * The south side on the Agnietenstraat (ring edge 38, w02-194: TMX7316010203-002629_pano_0001_000770, 2022-06-27, frontal,
 * rectified at 50 px/m; t = x / 50 from the west corner, h = (1203 - y) / 50, the low block's 7.66 m roof at y 820). r16
 * skipped it as not visible; the 2022 crop shows it plainly: the low block's wide window, the tower face set ~1.5 m back with
 * three wide windows and three dark louvres under the parapet, a column of thirteen slot windows under a stepped stone
 * chevron, and the lower wing on the right with three more wide windows. The 3DBAG faces there lean up to 6 degrees off the
 * ring edge, so each part is drawn on its own surface's plane.
 */
function southSide(b: BuildingTools) {
  const e = ringFrame(src.facadeRing, 38).f;
  const h = (y: number) => +((1203 - y) / 50).toFixed(2);
  // A frame on 3DBAG surface i's own plane; `at` maps an edge-38 t (the photo's x / 50) onto it.
  const plane = (i: number) => {
    const r = src.surfaces[i].rings[0];
    let nx = 0, nz = 0;
    for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    const along = (q: number[]) => (q[0] - e.origin[0]) * e.tangent[0] + (q[2] - e.origin[1]) * e.tangent[1];
    const p = r.reduce((m, q) => (along(q) < along(m) ? q : m));
    const f: Frame = {origin: [p[0], p[2]], tangent: [-nz, nx], n: [nx, nz]};
    if (f.tangent[0] * e.tangent[0] + f.tangent[1] * e.tangent[1] < 0) f.tangent = [nz, -nx];
    const at = (t: number) => {
      const x = e.origin[0] + e.tangent[0] * t, z = e.origin[1] + e.tangent[1] * t;
      // along the edge's normal onto the plane, then along the plane
      const d = ((p[0] - x) * nx + (p[2] - z) * nz) / (e.n[0] * nx + e.n[1] * nz);
      return (x + e.n[0] * d - p[0]) * f.tangent[0] + (z + e.n[1] * d - p[2]) * f.tangent[1];
    };
    return {f, at};
  };
  /** The wide window of this side: four lights in two tiers over one tall pane, white frames, a stone sill. */
  const tiered = (f: Frame, t: number, y0: number, y1: number, w: number) => {
    const mid = y0 + (y1 - y0) * 0.46;
    lights(b, f, t, mid, y1, w, 4, 2);
    lights(b, f, t, y0, mid, w, 1, 1);
    slab(b, f, t, y0 - 0.12, w + 0.24, 0.12, 0.16, 'stone');
  };
  // the low block (surface 374, the ring line): granite base and band, the wide window of three lights in two tiers (x 0-160)
  slab(b, e, 6.3, 0, 12.5, 2.3, 0.08, 'stone');
  slab(b, e, 6.3, 1.85, 12.5, 0.45, 0.14, 'stone');
  lights(b, e, 1.62, h(1035), h(885), 3.1, 3, 2);
  slab(b, e, 1.62, h(1035) - 0.12, 3.3, 0.12, 0.16, 'stone');
  // the tower face (surface 361): three wide windows (x 93-207) and three dark louvres under the parapet (y 90-148)
  {
    const {f, at} = plane(361);
    const t = at(3.0);
    for (const [ya, yb] of [[818, 690], [613, 460], [385, 232]]) tiered(f, t, h(ya), h(yb), 2.28);
    // (top held at 21.9 m, under the 3DBAG parapet at 22.3)
    for (const x of [91, 150, 209]) slab(b, f, at(x / 50), 20.75, 0.94, 1.15, 0.04, 'dark', 0.02);
  }
  // the slot column (surface 379): thirteen slots (x 318-347), 4.6-20.2 m in the crop; drawn from 5.0 m at a 1.2 m pitch,
  // clear of the 3DBAG's 4.9 m roof in front of the column's foot
  {
    const {f, at} = plane(379);
    const t = at(6.65);
    slab(b, f, t, 4.95, 0.95, 16.45, 0.12, 'brick');
    for (let k = 0; k < 13; k++) {
      const y0 = 5.0 + k * 1.2;
      slab(b, f, t, y0, 0.5, 0.78, 0.02, 'glass', 0.17);
      slab(b, f, t, y0 - 0.1, 0.66, 0.1, 0.24, 'stone');
    }
    // the chevron: stone courses stepping in to a point (x 295-365, y 40-190)
    for (let k = 0; k < 6; k++) slab(b, f, t, h(190) + k * 0.5, 1.4 - k * 0.22, 0.5, 0.3, 'stone', 0.02);
  }
  // the lower wing on the right (surface 240): three wide windows (x 520-622)
  {
    const {f, at} = plane(240);
    const t = at(11.42);
    for (const [ya, yb] of [[865, 732], [670, 535], [470, 332]]) tiered(f, t, h(ya), h(yb), 2.04);
  }
}
