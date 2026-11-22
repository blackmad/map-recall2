import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon, type Surface} from './worship-shell';
import {getSink, ringFrame, setSink, slab, put, type Frame} from './nearbar-kit';
import {rasterFront, type RasterRow} from '../../src/canalRecall/landmarks/rasterFront';
import source from './spaarbank-singel-548-footprints.json';

/**
 * SINGEL 542-548 / REGULIERSDWARSSTRAAT, at the Muntplein (BAG pand 0363100012175216, BAG 1965; gemeentelijk monument
 * 200738): the former Spaarbank voor de Stad Amsterdam by K.L. Sijmons Dzn (designed 1956-61). Register: over the ground
 * floor (with an entresol) four office storeys, the top one set back; travertine (Waldinger) cladding; original timber
 * frames with pivot sashes; "doordat ook de borstweringen verglaasd zijn, vormt de gevel een uitgesproken modernistisch
 * raster"; on the Singel the set-back storey is "een zeer abstract gedachte kroonlijst"; the Reguliersdwarsstraat front
 * "verschilt niet wezenlijk", but its ground floor is more closed and it lacks the cornice.
 *
 * Massing: the 3DBAG LoD2.2 shell (spaarbank-singel-548-footprints.json, bag-shell-prepare.ts): the 16.4 m roof terraces
 * along both fronts, the 20.4 m set-back storey, plant rooms to 25.7 m and the 6.8 m light-court roof. On the Singel the
 * 3DBAG reads the floating cornice as a solid wall to 19.4 m over the east 20 m; those walls and that roof are replaced so
 * the set-back storey shows between the posts, as in the photos.
 *
 * Fronts read from Gemeente Amsterdam panoramas (CC BY 4.0), positions in metres along each facade-ring edge from the
 * viewer's left (ringFrame):
 *  - Reguliersdwarsstraat (edge 8, w01-194): TMX7316010203-001646_pano_0001_000089 (2019, overcast, the sharpest),
 *    b_20250120_0926_Track28_Sphere_00012 (2025), rectified at 42.99 px/m, ground at y 941; levels from the luminance
 *    profile of a pier (ledge tops light, shadows under them);
 *  - Singel (edges 1 and 2, w03-359 and w02-1): TMX7316010203-000354_pano_0001_000224/_000226 (2017, sunlit) and
 *    TMX7316010203-001975_pano_0000_001348/_001346 (2021), across the water behind the Bloemenmarkt stalls, at 50 px/m.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

/** Storey levels (Reguliersdwarsstraat, 2019): spandrel and window rows of the three raster storeys, the top band. */
const ROWS: RasterRow[] = [
  {y0: 6.58, y1: 7.28, openings: [], kind: 'spandrel'},
  {y0: 7.47, y1: 9.63, openings: [], kind: 'window'},
  {y0: 9.93, y1: 10.67, openings: [], kind: 'spandrel'},
  {y0: 10.86, y1: 13.02, openings: [], kind: 'window'},
  {y0: 13.33, y1: 14.05, openings: [], kind: 'spandrel'},
  {y0: 14.30, y1: 16.55, openings: [], kind: 'window'},
];
const RASTER_TOP = 17.5;
const FASCIA: [number, number] = [5.6, 6.58];
/** The raster's glass plane stands GLASS m in front of the 3DBAG wall; piers and ledges in front of the glass. */
const GLASS = 0.1, PIER = 0.3, LEDGE = 0.42;
const FRONT = GLASS + LEDGE;
/** Depth of the colonnade's entresol glazing behind the 3DBAG wall line (2019 thumb: the recess reads about 1.4 m deep). */
const RECESS = 0.9;

/** The Reguliersdwarsstraat colonnade, metres along edge 8 (2019 crop: 135-1365 px). */
const COLONNADE: [number, number] = [3.14, 31.75];
/** Singel: the 3DBAG front walls are cut at the terrace level (CUT), the stair bay east of BAY_X keeps its wall to 19.35 m;
 *  BAY_Z is the front line at BAY_X. */
const CUT = 16.362, BAY_X = 24.704, BAY_Z = -14.1026;

const edge = (i: number) => ringFrame(ring, i);

/** Sutherland-Hodgman: the part of a 3D polygon where `keep(p) >= 0`. */
function clipRing(r: number[][], keep: (p: number[]) => number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length], fa = keep(a), fc = keep(c);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fc >= 0)) { const u = fa / (fa - fc); out.push(a.map((v, k) => v + (c[k] - v) * u)); }
  }
  return out;
}
/** A 3DBAG wall polygon clipped by half-spaces, drawn like the shell walls. */
function wallPiece(b: BuildingTools, r: number[][], ...keeps: ((p: number[]) => number)[]) {
  let p = r;
  for (const k of keeps) p = clipRing(p, k);
  if (p.length < 3) return;
  const g = planarPolygon([p]);
  if (g) b.add(g, 'stone' as never);
}

export function buildSpaarbankSingel548(_w: number, _d: number, b: BuildingTools) {
  // Singel: the 3DBAG front walls to 19.4 m (1, 82), the cornice's back and end (67, 81) and its roof (143) give way to the
  // open set-back storey under the floating cornice (rebuilt in singelFront).
  // Reguliersdwarsstraat: the 3DBAG front walls (56, 114) are cut round the colonnade recess.
  const skip = new Set([1, 82, 67, 81, 143, 56, 114]);
  addShell(b, src as never, {wall: 'stone', roof: 'slate', skip: (_s, i) => skip.has(i)});
  singelShellPatch(b);
  const ring0 = (i: number) => src.surfaces[i].rings[0];
  // Singel: walls 1 and 82 stop at the terrace (16.4 m); the stair bay (x >= 24.4) keeps its wall to 19.4 m
  for (const i of [1, 82]) wallPiece(b, ring0(i), p => CUT - p[1]);
  wallPiece(b, ring0(1), p => p[1] - CUT, p => p[0] - BAY_X);
  // Reguliersdwarsstraat: above the colonnade, and its two ends below it
  const {f} = edge(8);
  const tOf = (p: number[]) => (p[0] - f.origin[0]) * f.tangent[0] + (p[2] - f.origin[1]) * f.tangent[1];
  for (const i of [56, 114]) {
    wallPiece(b, ring0(i), p => p[1] - FASCIA[0]);
    wallPiece(b, ring0(i), p => FASCIA[0] - p[1], p => COLONNADE[0] - tOf(p));
    wallPiece(b, ring0(i), p => FASCIA[0] - p[1], p => tOf(p) - COLONNADE[1]);
  }
  const sink0 = getSink();
  setSink(0.12, true);
  reguliersdwarsstraat(b);
  singelFront(b);
  setSink(sink0);
}

/** Between-pier spans for piers centred at `piers` (width pw) within [a, c] of the wall. */
const between = (piers: number[], pw: number, a: number, c: number): [number, number][] => {
  const edges = [a, ...piers.flatMap(p => [p - pw / 2, p + pw / 2]), c];
  const out: [number, number][] = [];
  for (let k = 0; k < edges.length; k += 2) if (edges[k + 1] - edges[k] > 0.3) out.push([edges[k], edges[k + 1]]);
  return out;
};

/** Box pieces of a raster on frame f from t0 (spans in wall metres). Tone 1 never occurs here (no mottle). */
function raster(b: BuildingTools, f: Frame, t0: number, length: number, spans: [number, number][], o: {bottom?: number; top?: number; rows?: RasterRow[]; ledgeOverhang?: [number, number]; frames?: boolean} = {}) {
  const rows = (o.rows ?? ROWS).map(r => ({...r, openings: spans.map(([a, c]) => [Math.max(0, a - t0), Math.min(length, c - t0)] as [number, number])}));
  const pieces = rasterFront({length, rows, bottom: o.bottom ?? rows[0].y0, top: o.top ?? RASTER_TOP, pierDepth: PIER, ledgeDepth: LEDGE, ledgeOverhang: o.ledgeOverhang});
  const s0 = getSink();
  setSink(0);
  for (const p of pieces) {
    const colour = p.part === 'glass' ? (p.kind === 'spandrel' ? 'blue' : 'glass') : 'stone';
    slab(b, f, t0 + (p.t0 + p.t1) / 2, p.y0, p.t1 - p.t0, p.y1 - p.y0, p.depth, colour, GLASS + p.out);
  }
  setSink(s0, true);
  if (o.frames === false) return;
  // timber frames (register: original, with pivot sashes): a fanlight transom and the two mullions of the centre pivot sash,
  // 10 cm proud of the glass; the spandrels have one mullion pair in line
  for (const r of rows) for (const [a, c] of r.openings) {
    const w = c - a, m = t0 + (a + c) / 2;
    if (w < 0.6) continue;
    if (r.kind === 'window') {
      bar(b, f, m, r.y1 - 0.5, w, 0.07);
      for (const s of [-1, 1]) bar(b, f, m + s * 0.48, r.y0, 0.07, r.y1 - 0.5 - r.y0);
    } else for (const s of [-1, 1]) bar(b, f, m + s * 0.48, r.y0, 0.06, r.y1 - r.y0);
  }
}
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number) {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y, w, h, 0.05, 'frame', GLASS + 0.05);
  setSink(s0, true);
}

/** Steel post on the parapet: a square tube, `y0` to `y1`, `out` its front from the wall plane. */
function post(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(b, f, t, y0, 0.24, y1 - y0, 0.24, 'bronze', out - 0.24);
  setSink(s0, true);
}

/**
 * Reguliersdwarsstraat (edge 8, w01-194): the raster over 0.30-40.18 m (fifteen piers at a 2.807 m pitch from 0.59 m, 0.58 m
 * wide), the solid end bay 40.18-44.5 m to the top band, the ground floor with its five travertine piers under the fascia, the
 * recessed entresol glazing, the stone grid of small windows over the plinth, the staff entrance; on the parapet the steel
 * posts with their beams back to the set-back storey.
 */
function reguliersdwarsstraat(b: BuildingTools) {
  const {f, len} = edge(8);
  const r0 = 0.3, r1 = 40.18, pitch = 2.807;
  const piers = Array.from({length: 15}, (_, k) => 0.59 + k * pitch);
  raster(b, f, r0, r1 - r0, between(piers, 0.58, r0, r1));
  // the closed right end bay, flush with the ledges, from the ground to the top band
  slab(b, f, (r1 + len) / 2, 0, len - r1, RASTER_TOP, FRONT, 'stone');
  // ground floor: left end 0-3.14 m (stone, with a door), the fascia over the colonnade, the closed part 31.75-40.18 m
  const [g0, g1] = COLONNADE;
  // (the 3DBAG wall of this front is cut round the colonnade, see buildSpaarbankSingel548; the end slabs close the recess)
  slab(b, f, (0 + g0) / 2, 0, g0, FASCIA[1], FRONT + RECESS, 'stone', -RECESS);
  slab(b, f, (g0 + g1) / 2, FASCIA[0], g1 - g0, FASCIA[1] - FASCIA[0], FRONT + RECESS, 'stone', -RECESS);
  slab(b, f, (g1 + r1) / 2, 0, r1 - g1, FASCIA[1], FRONT + RECESS, 'stone', -RECESS);
  // the side door in the left end (2019: dark, 0.3-2.7 m, to 2.9 m)
  slab(b, f, 1.5, 0, 2.3, 2.9, 0.1, 'dark', FRONT);
  // the staff entrance 33.8-40.9 m (to 2.8 m) under a thin canopy; the vent grille 40.3-43.6 m at 3.1-3.8 m
  slab(b, f, 37.35, 0, 7.1, 2.8, 0.1, 'dark', FRONT);
  slab(b, f, 37.35, 2.8, 7.4, 0.15, 0.4, 'stone', FRONT);
  slab(b, f, 41.95, 3.1, 3.3, 0.7, 0.1, 'dark', FRONT);
  // colonnade: piers at the measured centres (2019 crop: 397, 650, 891, 1132 px) and the two ends, 0.7 m wide
  const gp = [9.23, 15.12, 20.72, 26.33];
  for (const t of gp) slab(b, f, t, 0, 0.7, FASCIA[0], FRONT + RECESS, 'stone', -RECESS);
  // the recessed entresol glazing (3.84-5.60 m) 1.4 m behind the pier fronts, its mullions every ~1.2 m, and its floor
  slab(b, f, (g0 + g1) / 2, 3.84, g1 - g0, FASCIA[0] - 3.84, 0.06, 'dark', -RECESS);
  slab(b, f, (g0 + g1) / 2, 3.74, g1 - g0, 0.1, RECESS - 0.02, 'stone', -RECESS);
  // the lower stone grid between the piers: plinth to 1.42 m, two rows of small windows, ledge at 3.56-3.84 m
  const bays: [number, number][] = [[g0, gp[0] - 0.35], ...gp.slice(0, -1).map((p, i) => [p + 0.35, gp[i + 1] - 0.35] as [number, number]), [gp[3] + 0.35, g1]];
  for (const [a, c] of bays) {
    const n = 4, w = (c - a) / n;
    const lights = Array.from({length: n}, (_, k) => w * (k + 0.5));
    const rows: RasterRow[] = [{y0: 1.42, y1: 2.07, openings: [], kind: 'shop'}, {y0: 2.25, y1: 3.56, openings: [], kind: 'shop'}];
    const s0 = getSink();
    setSink(0);
    for (const p of rasterFront({length: c - a, rows: rows.map(r => ({...r, openings: lights.map(x => [x - (w - 0.16) / 2, x + (w - 0.16) / 2] as [number, number])})), bottom: 0, top: 3.84, pierDepth: 0.3, ledgeDepth: 0.42})) {
      slab(b, f, a + (p.t0 + p.t1) / 2, p.y0, p.t1 - p.t0, p.y1 - p.y0, p.depth, p.part === 'glass' ? 'glass' : 'stone', FRONT - 0.42 + p.out);
    }
    setSink(s0, true);
    // entresol mullions
    const m = Math.max(1, Math.round((c - a) / 1.2));
    for (let k = 1; k < m; k++) slab(b, f, a + (c - a) * k / m, 3.84, 0.08, FASCIA[0] - 3.84, 0.1, 'frame', -RECESS + 0.06);
  }
  // rooftop: a steel post over every pier, 17.5 -> 21.2 m, with a beam back to the set-back storey (3.0 m behind the wall)
  for (const t of piers) {
    post(b, f, t, RASTER_TOP, 21.2, FRONT - 0.05);
    const g = new T.BoxGeometry(0.2, 0.3, 3.4).translate(0, 0.15, -3.4 / 2 + FRONT - 0.05);
    put(b, f, g, t, 20.9, 0, 'bronze');
    // the raked strut of each frame (2019 crop: the fins read as diagonals), from the post foot up to the beam's back end
    const dz = 3.4 - 0.12, dy = 20.9 + 0.15 - RASTER_TOP, len = Math.hypot(dz, dy);
    const s = new T.BoxGeometry(0.16, 0.22, len).rotateX(Math.atan2(dy, dz)).translate(0, dy / 2, FRONT - 0.05 - 0.12 - dz / 2);
    put(b, f, s, t, RASTER_TOP, 0, 'bronze');
  }
  setbackGlazing(b, [-25.0, 22.8], [15.2, 32.8], [0, 1]);
}

/**
 * Singel (edges 1 and 2): the closed stair bay 0-4.5 m of edge 1, the raster at a 2.715 m pitch across both edges (the
 * piers of edge 1 at 6.98 and 9.69 m line up with edge 2's from 0.64 m), the ground floor (replaced puien: recessed glazing
 * under the fascia, hidden by the stalls; the entrances at both ends from the register), and the floating cornice: a
 * travertine slab on steel posts with knee braces over the open set-back storey (2017: posts 2.6 m, slab 0.5 m).
 */
function singelFront(b: BuildingTools) {
  const pitch = 2.715, pw = 0.5;
  const e1 = edge(1), e2 = edge(2);
  const SLAB: [number, number] = [19.5, 20.0];
  // edge 1: stair bay 0-4.5 m, raster 4.5-11.7 m
  slab(b, e1.f, 2.25, 0, 4.5, SLAB[0], FRONT, 'stone');
  raster(b, e1.f, 4.5, e1.len - 4.5, between([6.98, 9.69], pw, 4.5, e1.len));
  // edge 2: piers at 0.64 + 2.715k to 22.36 m, the last bay cut by the Carlton at 24.9 m (an end pier 24.62-24.9)
  const p2 = Array.from({length: 9}, (_, k) => 0.64 + k * pitch);
  raster(b, e2.f, 0, e2.len, between([...p2, 24.76], pw, 0, e2.len).map(([a, c]) => [a, Math.min(c, 24.62)] as [number, number]));
  for (const {f, len, from} of [{...e1, from: 4.5}, {...e2, from: 0}]) {
    // fascia and the recessed ground-floor glazing; stone piers at every second raster pier (inferred: hidden by the stalls)
    slab(b, f, (from + len) / 2, FASCIA[0], len - from, FASCIA[1] - FASCIA[0], FRONT, 'stone');
    const gEnd = f === e2.f ? 24.6 : len - 0.03;
    slab(b, f, (from + 0.02 + gEnd) / 2, 0, gEnd - from - 0.02, FASCIA[0], 0.04, 'glass', GLASS);
    for (const t of f === e1.f ? [8.335, 11.05] : p2.slice(0, -1).map(p => p + pitch / 2)) slab(b, f, t, 0.6, 0.08, FASCIA[0] - 0.6, 0.1, 'frame', GLASS + 0.04);
    slab(b, f, (from + len) / 2, 0, len - from, 0.6, FRONT - 0.2, 'stone');
  }
  for (const t of [6.98 - 0.02]) slab(b, e1.f, t, 0, pw, FASCIA[0], FRONT, 'stone');
  for (const t of [0.64, 0.64 + 2 * pitch, 0.64 + 4 * pitch, 0.64 + 6 * pitch, 0.64 + 8 * pitch]) slab(b, e2.f, t, 0, pw, FASCIA[0], FRONT, 'stone');
  slab(b, e2.f, 24.76, 0, 0.28, FASCIA[0], FRONT, 'stone');
  // the two entrances (register): the public hall against the left (east) party wall, the offices against the right
  slab(b, e1.f, 5.7, 0.6, 1.8, 2.3, 0.1, 'dark', GLASS + 0.04);
  slab(b, e2.f, 23.3, 0.6, 1.8, 2.3, 0.1, 'dark', GLASS + 0.04);
  // the floating cornice: posts over the piers, knee braces, the slab 0.9 m deep along both edges
  for (const {f, len, ps} of [{...e1, ps: [4.25, 6.98, 9.69]}, {...e2, ps: p2.concat([24.62])}]) {
    for (const t of ps) {
      post(b, f, t, RASTER_TOP, SLAB[0], FRONT - 0.3);
      for (const s of [-1, 1]) {
        const L = 0.9, g = new T.BoxGeometry(L, 0.12, 0.12).rotateZ(s * Math.PI / 4).translate(s * L * 0.35, L * 0.35, FRONT - 0.42);
        if (t + s * 0.7 > 0 && t + s * 0.7 < len) put(b, f, g, t, SLAB[0] - 0.7, 0, 'bronze');
      }
    }
    slab(b, f, len / 2, SLAB[0], len, SLAB[1] - SLAB[0], 0.9 + FRONT, 'stone', -0.9);
  }
  setbackGlazing(b, [-9.4, -11.5], [26.6, -10.4], [0, -1]);
}

/**
 * The set-back storey: dark glass with mullions every 1.35 m and a railing bar, on the 3DBAG wall from a to b (16.5-20.3 m),
 * `out` the outward direction (the street side).
 */
function setbackGlazing(b: BuildingTools, a: [number, number], c: [number, number], out: [number, number]) {
  const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
  let tangent: [number, number] = [(c[0] - a[0]) / L, (c[1] - a[1]) / L];
  let n: [number, number] = [-tangent[1], tangent[0]];
  let origin = a;
  if (n[0] * out[0] + n[1] * out[1] < 0) { n = [-n[0], -n[1]]; tangent = [-tangent[0], -tangent[1]]; origin = c; }
  const f: Frame = {origin, tangent, n};
  const s0 = getSink();
  setSink(0);
  // glass 10 cm proud of the 3DBAG wall, its box run back into the wall (sunk) so it stands on it
  slab(b, f, L / 2, 16.7, L - 0.4, 3.5, 0.2, 'glass', -0.1);
  const m = Math.round(L / 1.35);
  for (let k = 1; k < m; k++) slab(b, f, L * k / m, 16.7, 0.08, 3.5, 0.2, 'frame', 0);
  // the terrace railing: a top rail on posts
  slab(b, f, L / 2, 17.65, L - 0.4, 0.06, 0.06, 'frame', 0.6);
  for (let k = 0; k <= m; k++) slab(b, f, 0.2 + (L - 0.4) * k / m, 16.4, 0.05, 1.25, 0.05, 'frame', 0.6);
  setSink(s0, true);
}

/**
 * Singel shell patch (exact 3DBAG vertices, so the patch meets the shell): the terrace (16.36 m) where the cornice strip was,
 * the stair bay's cap (19.35 m, x >= 24.704) and its west face over the terrace.
 */
function singelShellPatch(b: BuildingTools) {
  const face = (r: number[][], want: (n: T.Vector3) => boolean, colour: string, roof = false) => {
    const g = planarPolygon([r]);
    if (!g) return;
    const p = g.getAttribute('position'), idx = g.getIndex()!;
    const A = new T.Vector3(), B = new T.Vector3(), C = new T.Vector3();
    for (let k = 0; k < idx.count; k += 3) {
      A.fromBufferAttribute(p, idx.getX(k)); B.fromBufferAttribute(p, idx.getX(k + 1)); C.fromBufferAttribute(p, idx.getX(k + 2));
      if (!want(B.sub(A).cross(C.sub(A)))) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
    }
    g.computeVertexNormals();
    if (roof) g.userData.role = 'roof';
    b.add(g, colour as never);
  };
  const up = (n: T.Vector3) => n.y > 0, west = (n: T.Vector3) => n.x < 0;
  face([[BAY_X, CUT, BAY_Z], [15.996, CUT, -13.921], [8.094, CUT, -14.125], [7.278, 16.361, -13.531], [BAY_X, 16.373, -13.148]], up, 'slate', true);
  face([[27.096, 19.304, -11.302], [27.649, 19.366, -14.164], [BAY_X, 19.361, BAY_Z], [BAY_X, 19.342, -13.148], [27.085, 19.343, -13.096], [26.766, 19.307, -11.479]], up, 'slate', true);
  face([[BAY_X, 16.373, -13.148], [BAY_X, CUT, BAY_Z], [BAY_X, 19.361, BAY_Z], [BAY_X, 19.342, -13.148]], west, 'stone');
}
