import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, letters, poly, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import source from './de-kandelaar-vening-meineszlaan-footprints.json';

/**
 * DE KANDELAAR, Burgemeester Vening Meineszlaan 64 / Johan Herman Doornstraat 1, Slotermeer (BAG pand 0363100012149095,
 * BAG 1963): the Salvation Army (Leger des Heils) corps building, now the community centre De Kandelaar. Four parts under
 * flat roofs: the meeting hall (8.4 m) with a folded south wall of tall slit windows and a faceted east end whose brown-grey
 * brick is studded with a grid of dark round bosses; the two-storey house at the west end (6.1 m) with a ribbon of windows
 * and red casements; the glazed entrance pavilion between them under a white fascia with "DE KANDELAAR" in red; the low
 * wing along the west (3.6-4.0 m). The three-post concrete campanile in the forecourt is a separate structure, not in the
 * pand, and is not drawn here.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned. Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), t in metres
 * along each facade-ring edge from the viewer's left (ringFrame), y up from the 3DBAG ground:
 *  - the house's south front (edge 5, w04-195): TMX7316010203-001326_pano_0000_005074 (2019) and
 *    recording_2025-10-02_10-04-24_00414 (2025);
 *  - the house's west side (edge 4, w05-285): TMX7316010203-002509_pano_0004_002196 (2022, 50 px/m, ground at 460 px);
 *  - the entrance pavilion (edge 9, w03-195): TMX7316010203-000831_pano_0000_002250 (2018) and
 *    b_20240918_0854_Track07_Sphere_01244 (2024);
 *  - the hall's studded east end (edges 35-42, w08-104): recording_2025-10-02_08-33-49_01079 (2025) and
 *    TMX7316010203-001326_pano_0000_004058 (2019); its folded south wall (edges 13-34, w10-105):
 *    TMX7316010203-001326_pano_0000_005066 (2019);
 *  - the low west wing (edge 0, w01-285): TMX7316010203-002067_pano_0000_002697 (2021, 50 px/m, ground at 470 px).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;
type Wall = {f: Frame; len: number};
const wall = (i: number): Wall => ringFrame(ring, i);
const HALL = 8.4;
/** The hall's edges: the folded south wall (13-34), the faceted studded end (35-42). */
const FOLD_FACES = [14, 17, 20, 23, 26, 29, 32];
/** 3DBAG wall surfaces of the studded east end and the lowest stud row and first stud position on each (surface 86 rises from the annex roof at 2.3 m; the first 0.9 m of surface 37 hides behind the folded wall's last fold). */
const STUDDED_SURFACES: [number, number, number][] = [[37, 0, 0.9], [32, 0, 0], [87, 0, 0], [86, 2.61, 0]];
const HALL_CENTRE: [number, number] = [6, 1];
/** A wall frame on a 3DBAG wall surface's bottom edge, facing away from the hall's centre. */
function surfaceWall(i: number): Wall {
  const r = src.surfaces[i].rings[0], y0 = Math.min(...r.map(p => p[1]));
  const lo = r.filter(p => p[1] < y0 + 0.5);
  const a = lo[0], b = lo.reduce((m, p) => (Math.hypot(p[0] - a[0], p[2] - a[2]) > Math.hypot(m[0] - a[0], m[2] - a[2]) ? p : m), lo[0]);
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]), tx = (b[0] - a[0]) / len, tz = (b[2] - a[2]) / len;
  let n: [number, number] = [-tz, tx], o = a, tangent: [number, number] = [tx, tz];
  if (n[0] * ((a[0] + b[0]) / 2 - HALL_CENTRE[0]) + n[1] * ((a[2] + b[2]) / 2 - HALL_CENTRE[1]) < 0) { n = [tz, -tx]; tangent = [-tx, -tz]; o = b; }
  return {f: {origin: [o[0], o[2]], tangent, n}, len};
}

export function buildDeKandelaarVeningMeineszlaan(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: 'brick', roof: 'slate', wallFor: s => (hallWall(s) ? 'greyBrick' : 'brick')});
  const sink0 = getSink();
  setSink(0.1, true);
  houseSouth(wall(5));
  houseWest(wall(4));
  pavilion(wall(9));
  westWing(wall(0));
  for (const i of FOLD_FACES) slitWindow(wall(i));
  // studs on the hall's own 3DBAG wall planes (the BAG ring's east edges stand up to 0.5 m off them, and its north edges are
  // the low annex): the south-east facet, the east face, the start of the north-east facet, the north wall above the annex
  for (const [i, y0, t0] of STUDDED_SURFACES) studs(surfaceWall(i), y0, t0);
  shield(surfaceWall(37), 2.4, 5.6, 1.0);
  // fascias: the hall's grey metal cap, the white boards of the house, pavilion and wing
  src.surfaces.forEach((s, i) => { if (s.type === 'WallSurface' && hallWall(s)) { const w = surfaceWall(i); if (w.len > 0.3) slab(B, w.f, w.len / 2, HALL - 0.16, w.len, 0.24, 0.05, 'sandstone'); } });
  for (const i of [0, 1, 2, 3, 4, 5, 6, 8, 10, 11, 54, 55, 56]) { const w = wall(i), y = top(w); slab(B, w.f, w.len / 2, y - 0.34, w.len, 0.4, 0.3, 'concrete'); }
  setSink(sink0);
}

/** Wall surfaces of the hall: anything reaching above 7 m. */
function hallWall(s: Surface) {
  return Math.max(...s.rings[0].map(p => p[1])) > 7;
}
/** Roof height just inside the middle of a wall. */
function top(w: Wall) {
  const x = w.f.origin[0] + w.f.tangent[0] * w.len / 2 - w.f.n[0] * 0.3, z = w.f.origin[1] + w.f.tangent[1] * w.len / 2 - w.f.n[1] * 0.3;
  return roofHeightAt(src.surfaces, x, z) ?? 4;
}

// ---- kit -------------------------------------------------------------------------------------------------------------

/** A white-framed window; `red` lists casements (t0, t1) drawn as red frames inside it. */
function win(w: Wall, t0: number, t1: number, y0: number, y1: number, red: [number, number][] = [], panels: [number, number][] = []) {
  const t = (t0 + t1) / 2;
  slab(B, w.f, t, y0 - 0.06, t1 - t0 + 0.12, y1 - y0 + 0.12, 0.05, 'white');
  slab(B, w.f, t, y0, t1 - t0 - 0.04, y1 - y0, 0.06, 'glass', 0.05);
  for (const [a, c] of red) {
    for (const s of [a + 0.1, c - 0.1]) slab(B, w.f, s, y0 + 0.02, 0.06, y1 - y0 - 0.04, 0.05, 'red', 0.11);
    for (const y of [y0 + 0.06, y1 - 0.12]) slab(B, w.f, (a + c) / 2, y, c - a, 0.06, 0.05, 'red', 0.11);
  }
  for (const [a, c] of panels) slab(B, w.f, (a + c) / 2, y0 + 0.02, c - a, y1 - y0 - 0.04, 0.04, 'white', 0.11);
}

/** Tall slit window on each south-east face of the folded wall (w10-105): glass 1.0-7.4 m with a red panel band. */
function slitWindow(w: Wall) {
  const t = w.len / 2;
  slab(B, w.f, t, 0.95, 0.46, 6.55, 0.05, 'white');
  slab(B, w.f, t, 1.0, 0.36, 6.45, 0.06, 'glass', 0.05);
  slab(B, w.f, t, 3.9, 0.36, 0.7, 0.04, 'red', 0.11);
  for (const y of [3.85, 4.6]) slab(B, w.f, t, y, 0.42, 0.06, 0.08, 'white', 0.11);
}

/**
 * The studded brick of the hall's faceted east end (w08-104.alt, 2019 sunlit, rectified at 50 px/m): dark round bosses about
 * 20 cm across on a square grid, 1.0 m apart in each row (50 px) and 1.05 m between rows (52 px), the rows aligned, the lowest
 * row about 1.5 m up and the top one under the cap at 7.8 m.
 */
function studs(w: Wall, yStart = 0, tStart = 0) {
  for (let y = 1.5; y <= 7.9; y += 1.05) {
    if (y < yStart) continue;
    for (let t = 0.5; t <= w.len - 0.3; t += 1.0) {
      if (t < tStart) continue;
      // a 20 cm square boss (12 triangles)
      slab(B, w.f, t, y - 0.1, 0.2, 0.2, 0.05, 'brick');
    }
  }
}

/** The red Salvation Army shield with its white "Leger des Heils" lettering, simplified to a shield shape and a white band. */
function shield(w: Wall, t: number, y: number, h: number) {
  const s = h / 1.0;
  poly(B, w.f, t, y, [[-0.4 * s, 0.5 * s], [0.4 * s, 0.5 * s], [0.42 * s, 0.05 * s], [0.25 * s, -0.3 * s], [0, -0.5 * s], [-0.25 * s, -0.3 * s], [-0.42 * s, 0.05 * s]], 0.06, 'red', 0.04);
  for (const dy of [0.22, 0.0, -0.22]) slab(B, w.f, t, y + dy * s - 0.04 * s, 0.5 * s, 0.07 * s, 0.05, 'white', 0.1);
}

// ---- fronts ----------------------------------------------------------------------------------------------------------

/**
 * The house's south front (edge 5, 9.98 m, w04-195 aimed view: the wall 110-880 px, 77 px/m across, ground 815 px, roof 405 px):
 * a ribbon of four glazed lights with white panels and red casements between 3.8 and 5.4 m, two wide windows below with a red
 * casement each, the blue street-name plate.
 */
function houseSouth(w: Wall) {
  win(w, 0.4, 9.6, 3.8, 5.4, [[1.75, 2.45], [4.6, 4.85], [7.5, 7.8]], [[3.8, 4.6], [6.7, 7.5]]);
  win(w, 1.2, 5.0, 0.4, 2.3, [[3.65, 5.0]]);
  win(w, 6.4, 8.8, 0.4, 2.3, [[6.4, 7.1]]);
  slab(B, w.f, 1.6, 2.55, 1.1, 0.3, 0.06, 'blue');
}

/** The house's west side (edge 4, w05-285 at 50 px/m, ground at 460 px): the tall slit window, the shield, the blue plaque, the red door. */
function houseWest(w: Wall) {
  slab(B, w.f, 2.72, 1.12, 1.1, 4.24, 0.05, 'white');
  slab(B, w.f, 2.72, 1.2, 0.92, 4.08, 0.06, 'glass', 0.05);
  for (const s of [2.31, 3.13]) slab(B, w.f, s, 2.3, 0.06, 1.1, 0.05, 'red', 0.11);
  for (const y of [2.3, 3.34]) slab(B, w.f, 2.72, y, 0.88, 0.06, 0.05, 'red', 0.11);
  shield(w, 6.4, 3.55, 0.75);
  slab(B, w.f, 6.65, 2.6, 1.5, 0.45, 0.03, 'blue', 0.02);
  slab(B, w.f, 6.4, 0, 1.08, 2.35, 0.04, 'white');
  slab(B, w.f, 6.4, 0.02, 0.92, 2.25, 0.04, 'red', 0.04);
}

/**
 * The entrance pavilion (edge 9, 11.52 m, w03-195 aimed view: the pavilion 270-790 px at 45 px/m, ground 800 px): glazing
 * between white mullions with pale curtains, the red door, the shield, and the white fascia with DE KANDELAAR in red.
 */
function pavilion(w: Wall) {
  const y1 = top(w) - 0.6;
  slab(B, w.f, w.len / 2, 0, w.len - 0.4, y1, 0.03, 'glass', 0.02);
  for (const [a, c] of [[3.2, 4.4], [5.2, 6.2], [7.7, 8.3], [9.8, 10.9]]) slab(B, w.f, (a + c) / 2, 0.3, c - a, y1 - 0.4, 0.04, 'pink', 0.05);
  for (const t of [1.2, 2.3, 3.2, 4.5, 5.6, 6.7, 7.7, 8.4, 9.8]) slab(B, w.f, t, 0, 0.1, y1, 0.14, 'white');
  // the corner posts are part of the white frame of the box (the concrete slot, same white), not glazing bars
  for (const t of [0.15, 11.3]) slab(B, w.f, t, 0, 0.12, y1, 0.14, 'concrete');
  slab(B, w.f, w.len / 2, 0, w.len, 0.12, 0.1, 'white');
  slab(B, w.f, 1.75, 0.12, 0.95, 2.08, 0.07, 'red', 0.03);
  shield(w, 1.4, 2.75, 0.55);
  slab(B, w.f, w.len / 2, y1, w.len + 0.1, 0.6, 0.38, 'concrete');
  letters(B, w.f, 'DE KANDELAAR', 5.7, y1 + 0.12, 0.32, 0.045, 0.03, 'red', 0.39);
}

/**
 * The low west wing (edge 0, 23.45 m from its north end, w01-285 alt at 50 px/m, ground at 470 px): the red garage door under
 * a white panel, five white windows with a red split casement on their left third.
 */
function westWing(w: Wall) {
  slab(B, w.f, 1.75, 0.15, 2.5, 2.55, 0.04, 'red');
  slab(B, w.f, 1.75, 2.75, 2.6, 0.65, 0.04, 'white');
  for (const t0 of [8.64, 10.76, 12.86, 15.0, 17.06]) {
    const t1 = t0 + 1.68, s = t0 + 0.55;
    win(w, t0, t1, 1.3, 3.04, [[t0, s]]);
    slab(B, w.f, (t0 + s) / 2, 2.1, s - t0, 0.06, 0.08, 'red', 0.11);
  }
}
