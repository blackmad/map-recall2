import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, letters, put, ringFrame, ringSlab, disc, setSink, slab, type Frame} from './nearbar-kit';
import source from './tugelahuis-tugelaweg-footprints.json';

/**
 * TUGELAHUIS, Tugelaweg 59A, Transvaalbuurt (BAG pand 0363100012240693, BAG 2015): the Dynamo community centre, a one-room
 * pavilion in the Tugelaweg green. A square hall (12.15 x 12.15 m) under a red-tiled saddle roof with the ridge running
 * north-east to south-west, a lower flat-roofed service strip along its north-west side.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (eaves 4.0-4.16 m, ridge 6.33 m). Fronts read from rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0) at 50 px/m, t in metres along each facade-ring edge from the viewer's left (ringFrame), y up from the
 * 3DBAG ground:
 *  - north-east gable to the path (edge 8 + 0, w01-63): recording_2024-10-02_13-17-06_00528 (2024) and
 *    TMX7316010203-001604_pano_0000_000379 (2019). Fully glazed between four timber posts (t 0.1, 3.2, 8.9, 12.0: a 5.7 m
 *    centre bay between two 3.1 m side bays), a timber beam at 2.8 m carrying the "Tugelahuis" letters, sloped glass under
 *    the rakes, the rust-red rake boards;
 *  - south-east side (edge 7, w02-153, TMX7315120208-000071_pano_0006_000749, 2016): white render with three round
 *    portholes 1.7 m across in grey frames, a timber strip under a deep dark fascia;
 *  - south-west gable (edge 6, w03-242, recording_2025-06-20_09-22-37_01794 2025 and TMX7316010203-002142_pano_0000_003131
 *    2021): white render with a mural, the timber frame (two posts, a beam at eaves height), a round window in the gable,
 *    one wide grey-framed window and a white door.
 *  - the north-west strip (edges 1-5) has no panorama: plain white render (inferred).
 * Roof colour from the PDOK 2025 orthophoto (open data): red clay tiles with three roof lights.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;
type Wall = {f: Frame; len: number};
const wall = (i: number): Wall => ringFrame(ring, i);

/** Gable profile of the hall (12.15 m wide, apex at its middle): eaves 4.1 m, rake underside at the apex 6.15 m. */
const GW = 12.15, EAVES = 4.08, APEX = 6.2;
const rakeY = (t: number) => EAVES + (APEX - EAVES) * (1 - Math.abs(t - GW / 2) / (GW / 2));

export function buildTugelahuisTugelaweg(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: 'white', roof: 'red', roofFor: s => (isFlat(s) ? 'slate' : 'red')});
  const sink0 = getSink();
  setSink(0.1, true);
  // the north-east gable is two collinear ring edges: 8 (from the south corner, 10.49 m) and 0 (1.66 m)
  northEastGable(wall(8));
  southEastSide(wall(7));
  southWestGable(wall(6));
  // concrete kerb plinth along the white walls
  for (const i of [1, 2, 3, 4, 5]) { const w = wall(i); slab(B, w.f, w.len / 2, 0, w.len, 0.15, 0.08, 'concrete'); }
  roofLights();
  setSink(sink0);
}

function isFlat(s: Surface) {
  const ys = s.rings[0].map(p => p[1]);
  return Math.max(...ys) - Math.min(...ys) < 0.6;
}

// ---- kit -------------------------------------------------------------------------------------------------------------

/** A sloped bar from (t0, y0) to (t1, y1), `h` tall, `d` deep, standing `out` in front of the wall. */
function sloped(f: Frame, t0: number, y0: number, t1: number, y1: number, h: number, d: number, colour: string, out = 0) {
  const L = Math.hypot(t1 - t0, y1 - y0);
  const g = new T.BoxGeometry(L, h, d).rotateZ(Math.atan2(y1 - y0, t1 - t0)).translate(0, 0, out + d / 2);
  put(B, f, g, (t0 + t1) / 2, (y0 + y1) / 2, 0, colour);
}
/** Glass pane polygon in the wall plane (points in t, y), a few cm proud. */
function pane(f: Frame, pts: [number, number][], colour = 'glass', out = 0.02) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
  put(B, f, new T.ExtrudeGeometry(s, {depth: 0.03, bevelEnabled: false}), 0, 0, out, colour);
}
/** The rust-red rake boards on both slopes of a gable and the deep fascia under them. */
function rakes(w: Wall, out: number) {
  const m = GW / 2;
  for (const [a, c] of [[-0.35, m], [m, GW + 0.35]] as const) sloped(w.f, a, rakeY(a) + 0.16, c, rakeY(c) + 0.16, 0.32, 0.12, 'red', out);
}

// ---- fronts ----------------------------------------------------------------------------------------------------------

/**
 * North-east gable (w01-63, 2024 at 50 px/m: posts at 5, 160, 435, 590 px; beam 175-185 px with ground at 320 px; apex 300 px):
 * glass from the floor to the rakes between timber posts, a timber beam at 2.8 m with the name, glass doors in the centre bay.
 */
function northEastGable(w: Wall) {
  const posts = [0.2, 3.2, 8.95, 11.95];
  // glazing: lower lights (0.12-2.8 m) and the sloped upper lights (2.95 m to the rake)
  for (let k = 0; k < posts.length - 1; k++) {
    const a = posts[k] + 0.12, c = posts[k + 1] - 0.12;
    pane(w.f, [[a, 0.15], [c, 0.15], [c, 2.75], [a, 2.75]]);
    const pts: [number, number][] = [[a, 2.95], [c, 2.95], [c, rakeY(c) - 0.12]];
    if (a < GW / 2 && c > GW / 2) pts.push([GW / 2, rakeY(GW / 2) - 0.12]);
    pts.push([a, rakeY(a) - 0.12]);
    pane(w.f, pts);
  }
  // white curtains drawn behind the side bays' lower lights (both photos)
  for (const [a, c] of [[0.5, 1.6], [2.0, 3.0], [9.2, 10.4], [10.6, 11.8]]) slab(B, w.f, (a + c) / 2, 0.2, c - a, 2.5, 0.04, 'white', 0.06);
  // timber posts, the beam, the sill, mullions of the centre bay (doors at 4.6-6.4 m)
  for (const t of posts) slab(B, w.f, t, 0, 0.24, rakeY(t) + 0.05, 0.16, 'ochre');
  slab(B, w.f, GW / 2, 2.75, GW, 0.22, 0.16, 'ochre');
  slab(B, w.f, GW / 2, 0, GW, 0.15, 0.1, 'concrete');
  for (const t of [4.6, 6.0, 7.5]) slab(B, w.f, t, 0.15, 0.06, 2.6, 0.1, 'dark');
  for (const t of [1.65, 10.5, 4.6, 7.5]) slab(B, w.f, t, 2.97, 0.06, rakeY(t) - 3.0, 0.1, 'dark');
  // the name in light letters on the beam (2024: 250-350 px wide, 0.3 m tall)
  letters(B, w.f, 'TUGELAHUIS', GW / 2, 2.72, 0.17, 0.042, 0.03, 'concrete', 0.035);
  rakes(w, 0.05);
}

/**
 * South-east side (w02-153, 2016 at 50 px/m: corner post at 520-535 px, portholes centred 52, 235, 417 px, 0.84 m radius,
 * 87 px under the wall top): white render, three round windows in grey frames, a timber strip at the top under the fascia.
 */
function southEastSide(w: Wall) {
  const top = EAVES;
  for (const t of [2.0, 5.6, 9.2]) {
    ringSlab(B, w.f, t, top - 1.75, 0.68, 0.86, 0.12, 'frame', 0);
    disc(B, w.f, t, top - 1.75, 0.69, 0.06, 'glass', 0);
    ringSlab(B, w.f, t, top - 1.75, 0.68, 0.74, 0.05, 'frame', 0.12);
  }
  slab(B, w.f, w.len / 2, top - 0.25, w.len, 0.25, 0.08, 'ochre');
  // the deep dark fascia and its grey metal capping, 0.45 m proud (the eaves overhang)
  slab(B, w.f, w.len / 2, top, w.len + 0.5, 0.42, 0.12, 'bronze', 0.4);
  slab(B, w.f, w.len / 2, top + 0.42, w.len + 0.6, 0.08, 0.6, 'frame', 0.0);
  // the timber corner post at the glazed gable
  slab(B, w.f, w.len - 0.16, 0, 0.24, top, 0.1, 'ochre');
  slab(B, w.f, w.len / 2, 0, w.len, 0.15, 0.08, 'concrete');
}

/**
 * South-west gable (w03-242 alt, 2021 at 50 px/m, ground at 330 px: posts at 130-150 and 440-460 px, beam at 175 px; the
 * round window centred 300 px, 100 px; the wide window 270-380 x 190-255 px; the white door 545-600 px).
 */
function southWestGable(w: Wall) {
  // t from the north-west corner, the photo's left
  for (const t of [2.85, 9.0]) slab(B, w.f, t, 0, 0.24, rakeY(t) + 0.05, 0.12, 'ochre');
  slab(B, w.f, GW / 2, EAVES - 0.1, GW, 0.22, 0.12, 'ochre');
  ringSlab(B, w.f, GW / 2, 5.15, 0.55, 0.7, 0.1, 'frame', 0);
  disc(B, w.f, GW / 2, 5.15, 0.56, 0.05, 'glass', 0);
  // wide window, dark grey frame with a centre mullion
  slab(B, w.f, 6.5, 2.4, 2.2, 1.3, 0.06, 'frame');
  slab(B, w.f, 6.5, 2.48, 2.04, 1.14, 0.05, 'glass', 0.06);
  slab(B, w.f, 6.5, 2.48, 0.06, 1.14, 0.06, 'frame', 0.08);
  // door (white panel in a light frame) near the south corner
  slab(B, w.f, 11.45, 0.1, 1.0, 2.2, 0.05, 'concrete');
  // mural: the painted figures and the pink/yellow patches across the gable (simplified to flat colour panels)
  for (const [t, y, ww, h, c] of [[2.2, 4.3, 1.0, 1.0, 'pink'], [3.7, 4.2, 0.8, 0.8, 'gold'], [7.6, 4.15, 1.6, 1.3, 'gold'], [8.6, 4.4, 0.9, 1.0, 'pink'], [4.6, 4.2, 1.1, 0.5, 'pink'], [0.9, 4.15, 1.0, 0.55, 'pink']] as const) {
    slab(B, w.f, t, y, ww, Math.min(h, rakeY(t) - y - 0.15), c === 'gold' ? 0.09 : 0.05, c);
  }
  rakes(w, 0.05);
  slab(B, w.f, GW / 2, 0, GW, 0.15, 0.08, 'concrete');
}

/** Three roof lights on the south-east slope (PDOK 2025 orthophoto). */
function roofLights() {
  // positions in native x/z on the SE slope: a third and two thirds along the ridge, half-way down
  const ridgeA = [7.14, 0.39], ridgeB = [-3.64, 5.96], eavesA = [9.89, 5.71], eavesB = [-0.89, 11.27];
  for (const [u, v] of [[0.3, 0.45], [0.55, 0.3], [0.62, 0.62]]) {
    const x = ridgeA[0] + (ridgeB[0] - ridgeA[0]) * u, z = ridgeA[1] + (ridgeB[1] - ridgeA[1]) * u;
    const ex = eavesA[0] + (eavesB[0] - eavesA[0]) * u, ez = eavesA[1] + (eavesB[1] - eavesA[1]) * u;
    const px = x + (ex - x) * v, pz = z + (ez - z) * v, y = 6.33 + (4.16 - 6.33) * v;
    const g = new T.BoxGeometry(0.8, 0.12, 0.9);
    const slope = Math.atan2(6.33 - 4.16, Math.hypot(ex - x, ez - z));
    g.rotateX(slope).rotateY(Math.atan2(ex - x, ez - z)).translate(px, y + 0.06, pz);
    B.add(g, 'glass' as never);
  }
}
