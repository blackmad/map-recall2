import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, poly, segBand, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import {upwardRoofPlane} from './house-geometry';
import {archOpeningWall, springing, type ArchOpening, type Tri} from '../../src/canalRecall/landmarks/archOpeningWall';

/**
 * The Tetterode complex, the former type foundry Lettergieterij "Amsterdam" voorheen N. Tetterode, one BAG pand
 * 0363100012236799 (bouwjaar 1903, in use; 71 verblijfsobjecten at Bilderdijkstraat 155-167 and Da Costakade 136-164: dwellings
 * with workshops, shops, the Dijktheater and De Trut; BAG, api.data.amsterdam.nl, CC0). Squatted 1981, since 1986 housing and
 * studios (nl.wikipedia "Tetterode (bedrijf)", "De Trut"). Rijksmonument complex 524827 (monument register, CC0):
 *  - 524828, the 1902-03 FABRIEK on the Bilderdijkstraat by J.W.F. Hartkamp (raised one storey 1906): ochre brick, ten window
 *    axes between lisenen that break through the cornice, a high-glazed middle part with straight-headed windows above, side
 *    parts with an insteek (mezzanine) and segmental ("gedrukte") window heads, red brick in the arches, flat roof;
 *  - 524830, the 1898 MELKFABRIEK "Holland" (Bilderdijkstraat 157a-161, taken over 1921): hardstone ground storey with three
 *    wide segmental arches and the frieze LETTERGIETERIJ AMSTERDAM VOORHEEN N. TETTERODE, brown brick with yellow bands and
 *    stijlen, nine axes, a three-axis tuitgevel with a three-light arched window, a short tiled roof over the right part,
 *    balconies with wrought-iron railings on the second and third floors;
 *  - 524829, the 1909-12 CENTRALE UITBREIDING on the Da Costakade (158-164) by Hartkamp: twelve axes of cross windows, a high
 *    ground storey with a stone-framed gate, simple doors at both ends, the stone frieze LETTERGIETERIJ 'AMSTERDAM' V/H
 *    N.TETTERODE over the ground storey, a cornice on consoles and a raised mansard with dormers;
 *  - 524831, the 1940-51 extension at Da Costakade 148 by B. Merkelbach and Ch.J.F. Karsten (Nieuwe Bouwen): a concrete frame
 *    with steel-framed ribbon windows and glazed-brick spandrels, a high ground storey with insteek, four storeys, a set-back
 *    roof storey under a broad canopy and a half-round rooftop volume with frosted panels.
 * The pand also holds the corner house Bilderdijkstraat 155-157 (north of the dairy) and the cream-brick housing block
 * Da Costakade 136-140 (north of the Merkelbach block), both photographed.
 *
 * Native frame of scripts/landmarks/da-costakade-146-footprints.json (x east, z south, y up from the 0.907 m NAP ground). The plan is
 * square to one pair of axes: e (east-north-east, from the Bilderdijkstraat front) and n (south-south-east along it, from the
 * north end of the front, BAG vertex 13 (-48.26, -4.023)); E = (0.92397, -0.38246), N = (0.38246, 0.92397). Every BAG edge lies within
 * 0.6 m of e 0 / 9 / 15.9 / 23 / 45.3 / 60.3 and n 0 / 11.7 / 18.7 / 70.57. Volumes (3DBAG LoD2.2 roof parts, CC BY 4.0, m above
 * the ground): corner house 16.4, dairy 18.1 behind its 15.2 front and the 20.8 gable, factory 17.3 (piers 18.0), low sheds 5.5,
 * a 15.4 m bridge range across the yard, the south shed 5.0, the Merkelbach block 26.0 + roof storey to 29.0 and canopy 29.3 with
 * the half-round volume to 32.6, the 1909 range cornice 21.0 under a mansard to 24.6, its raised south end 28.0, the rear piece
 * 25.3, the housing block 23.2 between 15.0 / 14.8 wings.
 * Openings measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of the brief: w01-248 (2025-07-31, 32.0 px/m,
 * the whole Bilderdijkstraat front), w02-67 (2020-05-11, 37.5 px/m, the Da Costakade 1909 range and Merkelbach block), w05/w07/w11
 * (the housing block); checked against Wikimedia Commons photos by Marcel Mulder (CC BY-SA 3.0 nl): "Bilderdijkstraat 163.jpg",
 * "Bilderdijkstraat 159.jpg", "Lettergieterij (Tetterode).JPG", "Uitbreiding lettergieterij (Tetterode).JPG".
 * INFERRED: the yard faces, the party walls, the housing block's back, the Merkelbach block's north side above the housing.
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];
let B: BuildingTools;

const O: P2 = [-48.26, -4.023], E: P2 = [0.92397, -0.38246], N: P2 = [0.38246, 0.92397];
const A = (e: number, n: number): P2 => [O[0] + e * E[0] + n * N[0], O[1] + e * E[1] + n * N[1]];

// ---- frames -----------------------------------------------------------------------------------------------------------
type Fr = Frame & {len: number};
function lineFrame(p: P2, q: P2): Fr {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
  return {origin: p, tangent: [tx, tz], n: [-tz, tx], len};
}
/** Faces seen from outside, t running to the viewer's right. */
const fW = (e: number, n0: number, n1: number) => lineFrame(A(e, n0), A(e, n1));   // west-facing, t from the north
const fE = (e: number, n0: number, n1: number) => lineFrame(A(e, n1), A(e, n0));   // east-facing, t from the south
const fN = (e0: number, e1: number, n: number) => lineFrame(A(e1, n), A(e0, n));   // north-facing, t from the east
const fS = (e0: number, e1: number, n: number) => lineFrame(A(e0, n), A(e1, n));   // south-facing, t from the west

function place(g: T.BufferGeometry, f: Frame, t: number, y: number, out: number) {
  const M = new T.Matrix4().makeBasis(new T.Vector3(f.tangent[0], 0, f.tangent[1]), new T.Vector3(0, 1, 0), new T.Vector3(f.n[0], 0, f.n[1]));
  M.setPosition(f.origin[0] + f.tangent[0] * t + f.n[0] * out, y, f.origin[1] + f.tangent[1] * t + f.n[1] * out);
  g.applyMatrix4(M); return g;
}
/** Flat polygon in a wall plane (t, y), facing out of the wall. */
function polyFace(f: Frame, pts: P2[], c: Col, holes: P2[][] = []) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
  for (const h of holes) s.holes.push(new T.Path(h.map(p => new T.Vector2(p[0], p[1]))));
  B.add(place(new T.ShapeGeometry(s), f, 0, 0, 0), c);
}
const rectFace = (f: Fr, y0: number, y1: number, c: Col, t0 = 0, t1 = f.len) => polyFace(f, [[t0, y0], [t1, y0], [t1, y1], [t0, y1]], c);
const shapeOf = (pts: P2[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
const capUp = (en: P2[], y: number, c: Col) => B.add(upwardRoofPlane(shapeOf(en.map(p => A(p[0], p[1]))), y), c);
const rect = (e0: number, e1: number, n0: number, n1: number): P2[] => [[e0, n0], [e1, n0], [e1, n1], [e0, n1]];
/** Sloping roof quad between two (e, n, y) edges, wound to face up. */
function roofQuad(p: [number, number, number][], c: Col) {
  const v = p.map(([e, n, y]) => { const a = A(e, n); return new T.Vector3(a[0], y, a[1]); });
  const nrm = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
  const order = nrm.y >= 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(order.flatMap(i => [v[i].x, v[i].y, v[i].z]), 3));
  g.computeVertexNormals(); B.add(g, c);
}

// ---- faces with openings (archOpeningWall: flat heads `arch: 0`, segmental heads `rise`) -------------------------------------
type Cut = ArchOpening & {back: Col};
type Face = Fr & {y0: number; y1: number; c: Col; cuts: Cut[]};
let FACES: Face[] = [];
function face(fr: Fr, y0: number, y1: number, c: Col): Face { const F = {...fr, y0, y1, c, cuts: []}; FACES.push(F); return F; }
function flushFaces() {
  for (const F of FACES) {
    for (const c of F.cuts) if (c.t0 < -1e-9 || c.t1 > F.len + 1e-9 || c.y0 < F.y0 - 1e-9 || c.y1 > F.y1 + 1e-9) throw Error(`opening ${JSON.stringify(c)} outside face len ${F.len.toFixed(2)} y ${F.y0}-${F.y1} at ${F.origin}`);
    const w = archOpeningWall(F.len, F.y0, F.y1, F.cuts);
    const tris = (ts: Tri[]) => ts.flatMap(t => t.pts.flatMap(([u, y, o]) => [F.origin[0] + F.tangent[0] * u + F.n[0] * o, y, F.origin[1] + F.tangent[1] * u + F.n[1] * o]));
    const geom = (pos: number[]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
    // Largest wall triangles first: the geometry audit clusters wall planes from the first triangle it meets, and a thin band
    // between two close opening levels, tilted by position quantization, would seed a plane that splits a 70 m front.
    const area = (t: Tri) => { const [a, b, c] = t.pts; return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])); };
    B.add(geom(tris([...[...w.face].sort((p, q) => area(q) - area(p)), ...w.reveals.flat()])), F.c);
    const byBack = new Map<Col, Tri[]>();
    F.cuts.forEach((h, i) => byBack.set(h.back, [...(byBack.get(h.back) ?? []), ...w.backs[i]]));
    for (const [c, ts] of byBack) B.add(geom(tris(ts)), c);
  }
  FACES = [];
}
type OpenOpts = {depth?: number; cols?: number; rows?: number; bars?: number[]; frame?: Col; back?: Col; edge?: number; rise?: number; transom?: number};
/**
 * Opening cut into a face (t centre, sill y, width w, apex/head y + h). Frame members stand 9 cm off the back, inside the reveal;
 * a segmental opening keeps its arched head plain glass above a transom on the springing line.
 */
function opening(F: Face, t: number, y: number, w: number, h: number, o: OpenOpts = {}) {
  const depth = o.depth ?? 0.2, frame = o.frame ?? 'frame', back = o.back ?? 'glass', fw = o.edge ?? 0.07, d = Math.min(0.09, depth - 0.03), out = -depth;
  const cut: Cut = {t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back, ...(o.rise ? {rise: o.rise, segments: 4} : {arch: 0})};
  F.cuts.push(cut);
  if (fw <= 0) return;
  const top = o.rise ? springing(cut) : y + h, fb = Math.max(fw, 0.1);
  ledgeStrip(B, F, t, y, w, fb, d, frame, out);
  ledgeStrip(B, F, t, top - fw, w, fw, d, frame, out);
  for (const s of [-1, 1]) ledgeStrip(B, F, t + s * (w - fw) / 2, y + fb, fw, top - y - fw - fb, d, frame, out);
  const cols = o.cols ?? 1, rows = o.rows ?? 1, ih = top - y;
  for (let k = 1; k < cols; k++) ledgeStrip(B, F, t - w / 2 + w * k / cols, y + fb, 0.06, ih - fw - fb, d, frame, out);
  for (let k = 1; k < rows; k++) ledgeStrip(B, F, t, y + ih * k / rows - 0.03, w - 2 * fw, 0.06, d, frame, out);
  for (const yb of o.bars ?? []) ledgeStrip(B, F, t, y + yb - 0.04, w - 2 * fw, o.transom ?? 0.08, d, frame, out);
}
/** Text set in 5 x 7 pixel runs (mixed-case-glyphs.ts), centred on t, baseline y, standing `out` + d off the wall. */
function text(f: Frame, s: string, t: number, y: number, px: number, out: number, d: number, c: Col) {
  const {runs, width} = glyphRuns(s, px);
  for (const r of runs) ledgeStrip(B, f, t - width / 2 + (r.t0 + r.t1) / 2, y + r.y0, r.t1 - r.t0, r.y1 - r.y0, d, c, out);
}
/** Wrought-iron balcony: stone slab on two consoles, a rail and balusters every 12 cm suggested by three bars. */
function balcony(f: Frame, t: number, y: number, w: number, proj = 0.8) {
  slab(B, f, t, y - 0.16, w, 0.16, proj, 'stone');
  for (const s of [-1, 1]) slab(B, f, t + s * (w / 2 - 0.15), y - 0.55, 0.14, 0.39, proj * 0.7, 'stone');
  slab(B, f, t, y + 0.95, w, 0.1, 0.05, 'bronze', proj - 0.05);
  slab(B, f, t, y + 0.12, w, 0.1, 0.05, 'bronze', proj - 0.05);
  for (let k = 0; k <= 6; k++) slab(B, f, t - w / 2 + 0.05 + (w - 0.1) * k / 6, y, 0.04, 0.95, 0.04, 'bronze', proj - 0.05);
  for (const s of [-1, 1]) slab(B, f, t + s * (w / 2 - 0.03), y + 0.95, 0.05, 0.1, proj - 0.05, 'bronze', 0.0);
}

// ---- the corner house, Bilderdijkstraat 155-157 (w01-248, n 0-11.7) -----------------------------------------------------
const CH = {n1: 11.7, e1: 9, top: 14.3, roof: 16.4, mans: 2.2};
function cornerHouse() {
  const F = face(fW(0, 0, CH.n1), 0, CH.top, 'red');
  // shop glazing under a grey fascia (w01: 1.2-2.9 m glass, fascia 3.0-3.8 m)
  for (const [t0, t1] of [[0.3, 3.4], [3.9, 7.6], [8.1, 11.3]]) opening(F, (t0 + t1) / 2, 0.25, t1 - t0, 2.7, {depth: 0.25, cols: Math.round((t1 - t0) / 1.3), frame: 'dark'});
  slab(B, F, CH.n1 / 2, 3.15, CH.n1, 0.6, 0.06, 'greyBrick');
  // w01 rectified at ~33 px/m: a tripartite window (0.4 / 1.1 / 0.4 m lights) at the north end, then four single axes;
  // balconies across t 0.3-2.9 on storey 2 and across the 6.7 / 8.6 axes on storeys 2 and 3
  const WIN: [number, number][] = [[1.25, 0.4], [2.1, 1.1], [2.95, 0.4], [4.6, 0.95], [6.7, 0.95], [8.6, 0.95], [10.3, 0.95]];
  const BALC: [number, number, number][] = [[1.6, 7.6, 2.4], [7.65, 7.6, 2.6], [7.65, 10.9, 2.6]];
  for (const [sill, h] of [[4.5, 2.1], [7.6, 2.15], [10.9, 2.2]] as const) {
    for (const [t, w] of WIN) opening(F, t, sill, w, h, {cols: w > 0.6 ? 2 : 1, bars: [h * 0.7], frame: 'white'});
    for (const [t, w] of [[2.1, 2.3], ...WIN.slice(3)] as const) {
      if (!BALC.some(([bt, by, bw]) => by === sill && Math.abs(bt - t) < bw / 2)) slab(B, F, t, sill - 0.12, w + 0.15, 0.12, 0.1, 'stone');
      if (sill > 7) segBand(B, F, t, sill + h + 0.24, w + 0.25, 0.18, 0.2, 0.06, 'stone');
    }
  }
  for (const [t, y, w] of BALC) balcony(F, t, y, w);
  slab(B, F, CH.n1 / 2, CH.top - 0.3, CH.n1, 0.3, 0.25, 'white');    // eaves cornice
  // mansard to 16.4 m, flat behind; a gabled dormer with a round-headed window (w01 n 7.6-11.0, apex 17.0)
  roofQuad([[0, 0, CH.top], [0, CH.n1, CH.top], [CH.mans, CH.n1, CH.roof], [CH.mans, 0, CH.roof]], 'slate');
  capUp(rect(CH.mans, CH.e1, 0, CH.n1), CH.roof, 'slate');
  const k = (CH.roof - CH.top) / CH.mans, dy0 = CH.top + 0.75 * k, eTop = (16.2 - CH.top) / k;
  // the dormer front: one cut wall to the eaves (the window's own host), the gable triangle above it
  opening(face(fW(0.75, 7.6, 11.0), dy0, 16.2, 'red'), 1.7, dy0 + 0.25, 0.7, 16.13 - dy0 - 0.25, {depth: 0.12, rise: 0.3, frame: 'white', edge: 0.05});
  polyFace(fW(0.75, 7.6, 11.0), [[0, 16.2], [3.4, 16.2], [1.7, 17.0]], 'red');
  for (const [p, q] of [[7.5, 9.3], [11.1, 9.3]] as const) roofQuad([[0.6, p, 16.15], [0.6, q, 17.05], [CH.mans + 1.2, q, 17.05], [CH.mans + 1.2, p, 16.15]], 'slate');
  // dormer cheeks between the mansard and the dormer eaves
  polyFace(fN(0.75, eTop, 7.6), [[0, dy0], [eTop - 0.75, 16.2], [0, 16.2]].map(([t, y]) => [eTop - 0.75 - t, y] as P2), 'red');
  polyFace(fS(0.75, eTop, 11.0), [[0, dy0], [eTop - 0.75, 16.2], [0, 16.2]], 'red');
  // north party wall above the neighbour and the house's back to the yard (inferred, plain)
  polyFace(fN(0, CH.e1, 0), [[0, 0], [CH.e1, 0], [CH.e1, CH.top], [CH.e1 - CH.mans, CH.roof], [0, CH.roof]], 'red');
  const back = face(fE(CH.e1, 0, CH.n1), 0, CH.roof, 'red');
  for (const y of [4.1, 7.4, 10.8]) for (const t of [2.5, 6, 9.2]) opening(back, t, y, 1.0, 1.6, {cols: 2});
  // south strip over the dairy's gable roof (e 0.94-4.5 between its eaves line and this roof)
  polyFace(fS(0, MF.gDepth, CH.n1), [[(MF.top - CH.top) / k, MF.top], [MF.gDepth, MF.top], [MF.gDepth, CH.roof], [CH.mans, CH.roof]], 'red');
}

// ---- the dairy (melkfabriek Holland, 1898), Bilderdijkstraat 157a-161 (w01-248, n 11.7-32.9) -----------------------------
const MF = {n0: 11.7, n1: 32.9, e1: 15.9, top: 15.2, roof: 18.1, gN0: 11.7, gN1: 18.6, apex: 20.8, gDepth: 4.5, slope: 2.4};
function dairy() {
  const L = MF.n1 - MF.n0, tN = (n: number) => n - MF.n0;
  const base = face(fW(0, MF.n0, MF.n1), 0, 5.45, 'stone');
  const F = face(fW(0, MF.n0, MF.n1), 5.45, MF.top, 'pink');
  // hardstone ground: three wide segmental arches (springing 3.3, apex 4.5), the glazed fronts and doors set back behind them
  const ARCH = [[12.2, 18.6], [19.0, 25.4], [25.8, 32.2]];
  ARCH.forEach(([a, c], i) => {
    const t = tN((a + c) / 2), w = c - a;
    opening(base, t, 0.12, w, 4.4, {depth: 0.55, rise: 1.15, cols: 4, frame: 'white', bars: [2.6]});
    segBand(B, base, t, 3.5, w + 0.9, 1.45, 0.4, 0.08, 'stone');
    // a door at the arch's outer end (w01: doors at n 19.0-19.9 and 30.3-31.1)
    if (i > 0) slab(B, base, t + (i === 1 ? -1 : 1) * (w / 2 - 0.75), 0.12, 1.0, 2.4, 0.05, 'dark', -0.43);
  });
  // the frieze LETTERGIETERIJ AMSTERDAM VOORHEEN N. TETTERODE (w01: 4.9-5.4 m, n 13.5-31)
  slab(B, base, L / 2, 4.95, L - 0.6, 0.5, 0.08, 'stone');
  text(base, 'LETTERGIETERIJ AMSTERDAM VOORHEEN N. TETTERODE', L / 2, 5.02, 0.05, 0.08, 0.05, 'bronze');
  // nine axes: three in the gable part, six on the right (w01 zoom: n 13.1-17.3, 19.8-30.1)
  const AX = [13.1, 15.2, 17.3, 19.8, 21.86, 23.92, 25.98, 28.04, 30.1].map(tN), BALC = [AX[1], AX[4], AX[7]];
  for (const [sill, h] of [[5.8, 2.1], [9.0, 2.2], [12.3, 2.1]] as const) for (const t of AX) {
    opening(F, t, sill, 1.1, h, {cols: 2, bars: [h * 0.68], frame: 'white'});
    if (!(sill > 6 && BALC.includes(t))) slab(B, F, t, sill - 0.12, 1.3, 0.12, 0.1, 'stone');
    if (sill < 12) segBand(B, F, t, sill + h + 0.22, 1.35, 0.15, 0.2, 0.06, 'stone');
  }
  // yellow banding and stijlen (ochre courses at the sills and lintels, pilaster strips between the axes)
  const BANDS = [5.5, 8.5, 11.7, 14.6];
  for (const y of BANDS) ledgeStrip(B, F, L / 2, y, L, 0.16, 0.06, 'ochre');
  for (const t of [0.35, ...AX.slice(0, -1).map((a, i) => (a + AX[i + 1]) / 2), L - 0.35])
    for (let k = 0; k + 1 < BANDS.length; k++) ledgeStrip(B, F, t, BANDS[k] + 0.16, 0.24, BANDS[k + 1] - BANDS[k] - 0.16, 0.06, 'ochre');
  // balconies on the second and third floors at three axes (w01 zoom: n 15.0, 21.3, 27.9)
  for (const t of BALC) { balcony(F, t, 9.0, 1.9); balcony(F, t, 12.3, 1.9); }
  // cornice of the right part, its short tiled roof and dormer; the flat roof behind
  slab(B, F, (tN(MF.gN1) + L) / 2, MF.top - 0.32, L - tN(MF.gN1), 0.32, 0.3, 'white');
  const k = (MF.roof - MF.top) / MF.slope;
  roofQuad([[0, MF.gN1, MF.top], [0, MF.n1, MF.top], [MF.slope, MF.n1, MF.roof], [MF.slope, MF.gN1, MF.roof]], 'copper');
  const dE = 0.85, dY0 = MF.top + dE * k, dTop = 17.6, dE1 = (dTop - MF.top) / k;
  opening(face(fW(dE, 27.6, 29.2), dY0, dTop, 'white'), 0.8, dY0 + 0.15, 0.9, dTop - dY0 - 0.35, {depth: 0.1, cols: 2, frame: 'white', edge: 0.05});
  roofQuad([[dE - 0.15, 27.45, dTop], [dE - 0.15, 29.35, dTop], [dE1 + 0.3, 29.35, dTop + 0.1], [dE1 + 0.3, 27.45, dTop + 0.1]], 'slate');
  polyFace(fS(dE, dE1, 29.2), [[0, dY0], [dE1 - dE, dTop], [0, dTop]], 'white');
  polyFace(fN(dE, dE1, 27.6), [[dE1 - dE, dY0], [dE1 - dE, dTop], [0, dTop]], 'white');
  capUp([[MF.slope, MF.gN1], [MF.slope, MF.n1], [MF.e1, MF.n1], [MF.e1, MF.n0], [MF.gDepth, MF.n0], [MF.gDepth, MF.gN1]], MF.roof, 'slate');
  // the tuitgevel: stone-edged gable from the 15.2 m line to the 20.8 m apex, the three-light round-headed window, a finial
  const gF = fW(0, MF.gN0, MF.gN1), gw = MF.gN1 - MF.gN0, gm = gw / 2, W0 = gm - 1.5, W1 = gm + 1.5;
  polyFace(gF, [[0, MF.top], [gw, MF.top], [gm, MF.apex]], 'pink', [[[W0, 15.9], [W1, 15.9], [W1, 18.3], [W0, 18.3]]]);
  const gwin = face(fW(0, MF.gN0 + W0, MF.gN0 + W1), 15.9, 18.3, 'pink');
  for (const [c, w, h] of [[0.45, 0.7, 1.3], [1.5, 0.9, 1.85], [2.55, 0.7, 1.3]] as const) opening(gwin, c, 16.0, w, h, {depth: 0.15, rise: w / 2, frame: 'white', edge: 0.05});
  segBand(B, gF, gm, 17.3, 3.6, 0.9, 0.25, 0.08, 'stone');
  for (const s of [-1, 1]) {
    const pts: P2[] = [[-0.2, MF.top], [0.25, MF.top], [gm, MF.apex - 0.4], [gm, MF.apex + 0.1]];
    poly(B, gF, s < 0 ? 0 : gw, 0, pts.map(([t, y]) => [-s * t, y] as P2), 0.12, 'stone');
  }
  slab(B, gF, gm, MF.apex - 0.1, 0.45, 0.9, 0.3, 'stone');
  // saddle roof behind the gable (ridge along e at the apex), its back gable above the flat roof
  const ridgeN = MF.gN0 + gm;
  roofQuad([[0, MF.gN0, MF.top], [MF.gDepth, MF.gN0, MF.top], [MF.gDepth, ridgeN, MF.apex], [0, ridgeN, MF.apex]], 'copper');
  roofQuad([[0, ridgeN, MF.apex], [MF.gDepth, ridgeN, MF.apex], [MF.gDepth, MF.gN1, MF.top], [0, MF.gN1, MF.top]], 'copper');
  const kk = (MF.apex - MF.roof) / (MF.apex - MF.top) * gm;
  polyFace(fE(MF.gDepth, MF.gN0, MF.gN1), [[gm - kk, MF.roof], [gm + kk, MF.roof], [gm, MF.apex]], 'pink');
  polyFace(fW(MF.gDepth, MF.gN0, MF.gN1), [[0, MF.top], [gm - kk, MF.roof], [0, MF.roof]], 'pink');
  polyFace(fW(MF.gDepth, MF.gN0, MF.gN1), [[gm + kk, MF.roof], [gw, MF.top], [gw, MF.roof]], 'pink');
  // the right part's north end above the gable roof's south eaves (t from the east: e 4.5 at t 0)
  polyFace(fN(0, MF.gDepth, MF.gN1), [[0, MF.top], [MF.gDepth, MF.top], [MF.gDepth - MF.slope, MF.roof], [0, MF.roof]], 'pink');
  // north side: over the corner house and to the yard; east side to the yard and over the sheds (inferred, plain brick with windows)
  rectFace(fN(MF.gDepth, CH.e1, MF.n0), CH.roof, MF.roof, 'pink');
  const nY = face(fN(CH.e1, MF.e1, MF.n0), 0, MF.roof, 'pink');
  for (const y of [6, 9.4, 12.8]) opening(nY, 3.5, y, 1.2, 1.8, {cols: 2});
  const eY = face(fE(MF.e1, MF.n0, MF.n1), 0, MF.roof, 'pink');
  for (const y of [7, 10.4, 13.8]) for (let t = 2.5; t < MF.n1 - MF.n0 - 1; t += 3.4) opening(eY, t, y, 1.2, 1.8, {cols: 2});
  rectFace(fS(0, MF.e1, MF.n1), FY.top, MF.roof, 'pink');
}

// ---- the 1902-03 factory, Bilderdijkstraat 163-167 (w01-248, n 32.9-70.57) ----------------------------------------------
const FY = {n0: 32.9, n1: 70.57, e1: 23, top: 17.3, pier: 18.0};
function factory() {
  const F = face(fW(0, FY.n0, FY.n1), 0, FY.top, 'ochre'), tN = (n: number) => n - FY.n0, L = FY.n1 - FY.n0;
  const PIERS = [40.97, 45.95, 50.95, 56.05, 61.05].map(tN), ALLP_IN = PIERS;
  const BAYS = [43.3, 48.3, 53.3, 58.4].map(tN);
  // middle part: four bays of a high segmental ground window (1.1-6.4 m, rise 0.9) and two storeys of straight four-light windows
  BAYS.forEach((t, i) => {
    opening(F, t, 0.35, 3.9, 6.05, {depth: 0.3, rise: 0.9, cols: 3, bars: [2.9, 3.9], frame: 'frame'});
    if (i === 1 || i === 2) slab(B, F, t + (i === 1 ? 0.2 : -0.1), 0.35, 1.15, 2.4, 0.05, 'dark', -0.18);   // the shop doors (w01 n 48.6-49.7, 52.3-54.2)
    segBand(B, F, t, 5.75, 4.5, 1.05, 0.42, 0.06, 'brick');
    opening(F, t, 7.9, 4.0, 3.8, {cols: 4, rows: 1, bars: [2.55], frame: 'frame'});
    opening(F, t, 13.1, 4.0, 3.3, {cols: 4, bars: [2.2], frame: 'frame'});
    for (const y of [7.62, 12.82]) ledgeStrip(B, F, t, y, 4.2, 0.24, 0.08, 'stone');
    segBand(B, F, t, 12.1, 4.3, 0.3, 0.32, 0.06, 'brick');
    segBand(B, F, t, 16.55, 4.3, 0.25, 0.3, 0.06, 'brick');
  });
  // side parts: three axes of segmental windows on storeys 2 and 3, five small arched mezzanine lights, ground doors and windows
  const SIDE = [[34.5, 36.8, 39.1], [62.6, 65.1, 67.6]].map(a => a.map(tN));
  const MEZZ = [[34.2, 35.6, 37.0, 38.4, 39.8], [62.4, 63.85, 65.3, 66.75, 68.2]].map(a => a.map(tN));
  for (const s of [0, 1]) {
    for (const t of SIDE[s]) {
      opening(F, t, 7.9, 2.0, 3.6, {rise: 0.5, cols: 2, bars: [2.2], frame: 'frame'});
      opening(F, t, 13.1, 2.0, 3.1, {rise: 0.45, cols: 2, bars: [1.9], frame: 'frame'});
      segBand(B, F, t, 11.05, 2.3, 0.55, 0.3, 0.06, 'brick');
      segBand(B, F, t, 15.75, 2.3, 0.5, 0.3, 0.06, 'brick');
      for (const y of [7.62, 12.82]) ledgeStrip(B, F, t, y, 2.3, 0.24, 0.08, 'stone');
    }
    for (const t of MEZZ[s]) { opening(F, t, 4.7, 0.9, 1.9, {rise: 0.45, cols: 1, frame: 'frame', bars: [1.0]}); ledgeStrip(B, F, t, 4.48, 1.1, 0.18, 0.08, 'stone'); }
    const [c0, c1] = s === 0 ? [0.55, ALLP_IN[0] - 0.42] : [ALLP_IN[4] + 0.42, L - 0.55];   // between the piers
    ledgeStrip(B, F, (c0 + c1) / 2, 3.9, c1 - c0, 0.2, 0.08, 'stone');
  }
  // ground of the side parts (w01): two windows and the wooden double door (left), the door and two windows (right)
  for (const [n, w, h, door] of [[34.7, 1.4, 2.3, false], [36.6, 1.75, 2.3, false], [39.05, 1.7, 3.05, true], [62.6, 1.4, 3.0, true], [65.25, 1.9, 2.5, false], [68.15, 1.9, 2.5, false]] as const)
    opening(F, tN(n), door ? 0.15 : 1.0, w, h, door ? {depth: 0.25, back: 'gold', frame: 'gold', bars: [2.3]} : {cols: 2, bars: [h * 0.65], frame: 'frame'});
  // lisenen breaking through the cornice to 18.0 m with stone caps; iron wall anchors with plant motifs on them
  const ALLP = [0.25, ...PIERS, L - 0.25];
  for (const t of ALLP) {
    const pw = t === 0.25 || t === L - 0.25 ? 0.5 : 0.75;
    slab(B, F, t, 0, pw, FY.pier - 0.15, 0.12, 'ochre');
    slab(B, F, t, FY.pier - 0.15, 0.95, 0.2, 0.3, 'stone', -0.05);
    for (const y of [6.3, 11.6]) { slab(B, F, t, y, 0.12, 1.25, 0.06, 'bronze', 0.12); slab(B, F, t, y + 0.75, 0.45, 0.1, 0.06, 'bronze', 0.12); }
  }
  // cornice: stone coping over a brick arcade frieze
  slab(B, F, L / 2, FY.top - 0.3, L, 0.3, 0.18, 'stone');
  for (const t of [tN(36.5), tN(65.6)]) segBand(B, F, t, 16.95, 6.4, 0.2, 0.25, 0.06, 'brick');
  // the pier caps also stand on the roof: the pier blocks rise behind the front as 0.7 m square posts
  for (const t of ALLP) slab(B, F, t, FY.top, t === 0.25 || t === L - 0.25 ? 0.5 : 0.75, FY.pier - 0.15 - FY.top, 0.6, 'ochre', -0.6);
  capUp(rect(0, FY.e1, FY.n0, FY.n1), FY.top, 'slate');
  // north end over the low sheds, the yard face and the south party wall (inferred)
  rectFace(fN(MF.e1, FY.e1, FY.n0), LOW.top, FY.top, 'ochre');
  const yard = face(fE(FY.e1, FY.n0, FY.n1), 0, FY.top, 'ochre');
  // yard windows only where the face is exposed (n 45.5-64.2 from the ground, elsewhere above the sheds)
  for (let n = 46.8; n < 63.5; n += 3.2) for (const y of [1.2, 7.9, 13.1]) opening(yard, FY.n1 - n, y, 2.2, 3.0, {cols: 2, bars: [2.0]});
  for (const n of [35.5, 39.5, 67.5]) for (const y of [7.9, 13.1]) opening(yard, FY.n1 - n, y, 2.2, 3.0, {cols: 2, bars: [2.0]});
  rectFace(fS(0, FY.e1, FY.n1), 0, FY.top, 'ochre');
}

// ---- the low yard buildings: sheds, the 15.4 m bridge range, the south shed (3DBAG; inferred faces) -------------------------
const LOW = {top: 5.5, n0: 18.7, nYard: 43.5, eE: 45.3};
const BR = {n0: 43.5, n1: 45.5, top: 15.4};
const SS = {n0: 64.2, n1: 70.5, top: 5.0};
function yardBuildings() {
  capUp([[MF.e1, LOW.n0], [LOW.eE, LOW.n0], [LOW.eE, LOW.nYard], [FY.e1, LOW.nYard], [FY.e1, FY.n0], [MF.e1, FY.n0]], LOW.top, 'slate');
  const nF = face(fN(MF.e1, LOW.eE, LOW.n0), 0, LOW.top, 'brick');
  for (let t = 3; t < LOW.eE - MF.e1 - 2; t += 5) opening(nF, t, 2.0, 2.4, 2.2, {cols: 3});
  // bridge range across the yard
  rectFace(fN(FY.e1, LOW.eE, BR.n0), LOW.top, BR.top, 'brick');
  const s = face(fS(FY.e1, LOW.eE, BR.n1), 0, BR.top, 'brick');
  for (let t = 2.5; t < LOW.eE - FY.e1 - 1.5; t += 3.4) for (const y of [1.5, 6.4, 10.9]) opening(s, t, y, 2.0, 2.6, {cols: 2});
  capUp(rect(FY.e1, LOW.eE, BR.n0, BR.n1), BR.top, 'slate');
  // south shed
  const sn = face(fN(FY.e1, LOW.eE, SS.n0), 0, SS.top, 'brick');
  for (let t = 2.5; t < LOW.eE - FY.e1 - 1.5; t += 4.4) opening(sn, t, 1.4, 2.6, 2.4, {cols: 3});
  rectFace(fS(FY.e1, LOW.eE, SS.n1), 0, SS.top, 'brick');
  capUp(rect(FY.e1, LOW.eE, SS.n0, SS.n1), SS.top, 'slate');
}

// ---- the Merkelbach & Karsten extension, Da Costakade 148 (w02-67 t 26.4-51.5; Commons "Uitbreiding lettergieterij") ----------
const MK = {e0: 45.3, e1: 60.32, n0: 17.9, n1: 43.0, top: 26.0, roofE: 58.8, roofTop: 29.0, canopy: 29.3, rearN1: 61.0, rearE1: 57.4};
/** Steel-framed ribbon window: white mullions about every 1.25 m and one transom at 62 % of the height. */
const ribbonWin = (F: Face, t0: number, t1: number, y: number, h: number, depth = 0.15) =>
  opening(F, (t0 + t1) / 2, y, t1 - t0, h, {depth, cols: Math.max(1, Math.round((t1 - t0) / 1.25)), bars: [h * 0.62], frame: 'white', edge: 0.06, transom: 0.06});
function merkelbach() {
  const F = face(fE(MK.e1, MK.n0, MK.n1), 0, MK.top, 'greyBrick'), L = MK.n1 - MK.n0;
  // ground storey with insteek between concrete columns (w02: columns at t 3.6, 8.7, 13.7, 18.9 from the south)
  const COLS = [3.6, 8.7, 13.7, 18.9];
  const bays = [[0, 3.6], [3.6, 8.7], [8.7, 13.7], [13.7, 18.9], [18.9, L]];
  bays.forEach(([a, c], i) => {
    // the tiled bay: the steel door under a ribbon (w02)
    if (i === 0) { opening(F, 1.9, 0.1, 1.15, 2.4, {depth: 0.12, back: 'dark', frame: 'dark', edge: 0.05}); ribbonWin(F, a + 0.45, c - 0.45, 4.3, 2.15); return; }
    // red doors at one end of each bay's lower glazing, alternately the right and the left end (w02, Commons), a top light over each
    const dw = 0.95, dc = i % 2 ? c - 0.45 - dw / 2 : a + 0.45 + dw / 2;
    opening(F, dc, 0.3, dw, 2.2, {depth: 0.2, back: 'red', frame: 'white', edge: 0.06});
    opening(F, dc, 2.6, dw, 1.0, {depth: 0.2, frame: 'white', edge: 0.06});
    if (i % 2) ribbonWin(F, a + 0.45, dc - dw / 2 - 0.1, 0.3, 3.3, 0.2); else ribbonWin(F, dc + dw / 2 + 0.1, c - 0.45, 0.3, 3.3, 0.2);
    ribbonWin(F, a + 0.45, c - 0.45, 4.3, 2.15);
  });
  for (const t of COLS) slab(B, F, t, 0, 0.5, 6.6, 0.18, 'concrete');
  // four storeys of ribbons between glazed-brick spandrels, small square vent blocks in the spandrels
  const SILLS = [7.9, 12.65, 17.4, 22.15];
  for (const y of SILLS) ribbonWin(F, 0.3, L - 0.3, y, 3.4);
  for (const y of [6.6, ...SILLS.slice(1).map(s => s - 1.35)]) {
    slab(B, F, L / 2, y + 1.3, L, 0.08, 0.1, 'white');
    for (let t = 2.4; t < L - 1; t += 4.6) slab(B, F, t, y + 0.5, 0.3, 0.3, 0.08, 'dark');
  }
  // roof storey: terrace with a rail, set-back glazed wall, the broad canopy on slender posts, the half-round volume on top
  capUp(rect(MK.roofE, MK.e1, MK.n0, MK.n1), MK.top, 'slate');
  const rs = face(fE(MK.roofE, MK.n0, MK.n1), MK.top, MK.roofTop, 'greyBrick');
  for (let t = 0.4; t < L - 2; t += 4.2) ribbonWin(rs, t, Math.min(L - 0.4, t + 3.8), MK.top + 0.35, 2.3);
  const tF = fE(MK.e1 - 0.15, MK.n0, MK.n1);
  slab(B, tF, L / 2, MK.top + 1.0, L - 0.2, 0.06, 0.06, 'white');
  for (let t = 0.3; t < L; t += 1.6) slab(B, tF, t, MK.top, 0.05, 1.0, 0.05, 'white');
  for (let t = 0.2; t < L; t += 8.4) slab(B, tF, t, MK.top, 0.14, MK.roofTop - MK.top, 0.14, 'white', -0.2);
  const can = new T.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5);
  const c0 = A(MK.e0, MK.n0);
  can.scale(MK.e1 + 0.3 - MK.e0, MK.canopy - MK.roofTop, MK.n1 - MK.n0);
  place(can, {origin: c0, tangent: E, n: N}, 0, MK.roofTop, 0); B.add(can, 'white');
  // the half-round volume: frosted panels, flat side north (3DBAG roof part e 48-57, n 39-43 at 32.6 m)
  const cx = 52.5, cn = 39.0, r = 4.0, segs = 10, hr = 32.6 - MK.canopy;
  const arc: P2[] = [];
  for (let k = 0; k <= segs; k++) { const a = Math.PI * k / segs; arc.push([cx + r * Math.cos(a), cn + r * Math.sin(a)]); }
  for (let k = 0; k < segs; k++) {
    const [p, q] = [arc[k + 1], arc[k]];
    const fr = lineFrame(A(p[0], p[1]), A(q[0], q[1]));
    rectFace(fr, MK.canopy, 32.6, 'canopyGlass');
    if (k % 2 === 0) slab(B, fr, fr.len / 2, MK.canopy, 0.08, hr, 0.06, 'white');
  }
  rectFace(fN(cx - r, cx + r, cn), MK.canopy, 32.6, 'greyBrick');
  capUp(arc, 32.6, 'slate');
  // north side above the housing (14.8 m) and the roof storey (INFERRED: the photos show its east front only)
  const nF = face(fN(MK.e0, MK.e1, MK.n0), 14.8, MK.top, 'greyBrick');
  for (const y of SILLS.slice(2)) ribbonWin(nF, 1.2, 8.0, y, 3.4);
  void nF;
  polyFace(fN(MK.e0, MK.e1, MK.n0), [[MK.e1 - MK.roofE, MK.top], [MK.e1 - MK.e0, MK.top], [MK.e1 - MK.e0, MK.roofTop], [MK.e1 - MK.roofE, MK.roofTop]], 'greyBrick');
  // the west face over the sheds and the yard, MK and the rear block together (INFERRED: steel-framed windows)
  const wF = face(fW(MK.e0, MK.n0, MK.rearN1), 0, MK.roofTop, 'greyBrick');
  for (const y of SILLS) for (let n = 20; n < MK.rearN1 - 2; n += 5.2) { if (y < BR.top + 0.5 && n > BR.n0 - 3 && n < BR.n1 + 0.5) continue; if (n < LOW.nYard && y < LOW.top) continue; ribbonWin(wF, n - MK.n0, n - MK.n0 + 4.2, y, 3.0); }
  for (let n = 46.5; n < MK.rearN1 - 4.5; n += 5.2) ribbonWin(wF, n - MK.n0, n - MK.n0 + 4.2, 1.2, 4.6);
  // rear block (behind the 1909 range): top at the roof storey, its glazed loft over the mansard (Commons "Lettergieterij" shows it)
  capUp(rect(MK.e0, MK.rearE1, MK.n1, MK.rearN1), MK.roofTop, 'slate');
  const loft = face(fE(MK.rearE1, MK.n1, MK.rearN1), R9.mans, MK.roofTop, 'greyBrick');
  for (let t = 0.4; t < MK.rearN1 - MK.n1 - 3.5; t += 3.6) ribbonWin(loft, t, t + 3.2, R9.mans + 0.6, 3.2);
  polyFace(fS(MK.e0, MK.e1, MK.n1), [[MK.rearE1 - MK.e0, R9.mans], [MK.e1 - MK.e0, R9.cornice], [MK.e1 - MK.e0, MK.top], [MK.roofE - MK.e0, MK.top], [MK.roofE - MK.e0, MK.roofTop], [MK.rearE1 - MK.e0, MK.roofTop]], 'greyBrick');
  rectFace(fS(MK.e0, RP.e1, MK.rearN1), RP.top, MK.roofTop, 'greyBrick');
  rectFace(fS(RP.e1, MK.rearE1, MK.rearN1), TW.top, MK.roofTop, 'greyBrick');
}

// ---- the 1909-12 central extension, Da Costakade 158-164 (w02-67 t 0-26.4 from the south; Commons "Lettergieterij (Tetterode)") ---
const R9 = {e0: 57.4, e1: 60.37, n0: 43.0, n1: 69.4, cornice: 21.0, mans: 24.6};
const TW = {e0: 50.0, n0: 61.0, top: 28.0};
const RP = {e1: 50.0, n1: 70.0, top: 25.3};
function centralExtension() {
  const F = face(fE(R9.e1, R9.n0, R9.n1), 0, R9.cornice, 'brick'), L = R9.n1 - R9.n0;   // t from the south end
  const AX = [1.2, 3.2, 5.5, 7.3, 9.6, 11.7, 14.0, 16.1, 18.4, 20.7, 22.8, 24.9];
  // cross windows on three storeys: mullion, transom, a top light of six or eight panes (w02: s1 7.6-11.1, s2 12.7-15.5, s3 17.1-19.3)
  for (const [sill, h] of [[7.6, 3.5], [12.7, 2.8], [17.1, 2.2]] as const) for (const t of AX) {
    opening(F, t, sill, 1.45, h, {cols: 2, bars: [h * 0.66], frame: 'white'});
    for (const s of [-1, 1]) ledgeStrip(B, F, t + s * 0.36, sill + h * 0.66 + 0.04, 0.04, h * 0.34 - 0.12, 0.09, 'white', -0.2);
    slab(B, F, t, sill - 0.14, 1.6, 0.14, 0.12, 'stone');
  }
  // ground: tall cross windows on axes 5-10, the stone-framed four-leaf gate, mezzanine windows over doors at both ends
  for (const t of AX.slice(4, 10)) {
    opening(F, t, 1.0, 1.45, 3.45, {cols: 2, bars: [2.3], frame: 'white'});
    slab(B, F, t, 0.86, 1.6, 0.14, 0.12, 'stone');
  }
  for (const t of [AX[0], AX[1], AX[10], AX[11]]) {
    opening(F, t, 0.12, 1.2, 2.95, {depth: 0.22, back: 'green', frame: 'white', bars: [2.35]});
    opening(F, t, 4.05, 1.45, 1.85, {cols: 2, frame: 'white'});
  }
  opening(F, 5.4, 0.12, 2.5, 4.1, {depth: 0.35, back: 'green', frame: 'white', rise: 0.6, cols: 4, bars: [3.0]});
  for (const s of [-1, 1]) slab(B, F, 5.4 + s * 1.48, 0, 0.42, 3.55, 0.14, 'stone');
  segBand(B, F, 5.4, 4.36, 3.38, 0.62, 0.45, 0.14, 'stone');
  slab(B, F, 5.4, 4.4, 0.45, 0.6, 0.18, 'stone');
  // the frieze over the ground storey
  slab(B, F, 12.6, 5.45, 16.8, 0.85, 0.08, 'stone');
  text(F, "LETTERGIETERIJ 'AMSTERDAM' V/H N.TETTERODE", 12.6, 5.62, 0.066, 0.08, 0.05, 'bronze');
  // cornice on consoles under the mansard (n 43-61); the raised south end rises in brick to 28 m
  const tCor = R9.n1 - TW.n0;
  slab(B, F, (tCor + L) / 2, R9.cornice - 0.45, L - tCor, 0.45, 0.55, 'white');
  for (let t = tCor + 0.6; t < L; t += 1.1) slab(B, F, t, R9.cornice - 0.95, 0.18, 0.5, 0.4, 'sandstone');   // consoles: a host colour (cream), as the 'white' trim set reads them as loose openings
  roofQuad([[R9.e1, R9.n0, R9.cornice], [R9.e1, TW.n0, R9.cornice], [R9.e0, TW.n0, R9.mans], [R9.e0, R9.n0, R9.mans]], 'slate');
  // four white dormers in the mansard (Commons: t 11.0, 15.2, 19.5, 23.9 from the south)
  const k = (R9.mans - R9.cornice) / (R9.e1 - R9.e0);
  for (const t of [11.0, 15.2, 19.5, 23.9]) {
    const n = R9.n1 - t, e1 = R9.e1 - 0.45, y0 = R9.cornice + 0.45 * k, y1 = 24.2, e0 = R9.e1 - (y1 - R9.cornice) / k - 0.1;
    const df = face(fE(e1, n - 1.3, n + 1.3), y0, y1, 'sandstone');   // a host colour: an all-'white' dormer reads as a loose window to the audit
    opening(df, 1.3, 0.3 + y0, 1.5, y1 - y0 - 0.55, {depth: 0.12, cols: 2, bars: [(y1 - y0 - 0.55) * 0.66], frame: 'white', edge: 0.06});
    polyFace(fN(e0, e1, n - 1.3), [[0, y0 - 0.05], [0, y1], [e1 - e0, y1]], 'sandstone');
    polyFace(fS(e0, e1, n + 1.3), [[0, y1], [e1 - e0, y1], [e1 - e0, y0 - 0.05]], 'sandstone');
    roofQuad([[e1 + 0.15, n - 1.45, y1], [e1 + 0.15, n + 1.45, y1], [e0, n + 1.45, y1 + 0.15], [e0, n - 1.45, y1 + 0.15]], 'slate');
  }
  // the raised south end: brick front from the cornice to 28 m with two windows at the top (Commons), its north flank above the mansard
  const tw = face(fE(R9.e1, TW.n0, R9.n1), R9.cornice, TW.top, 'brick');
  for (const t of [3.0, 5.6]) opening(tw, t, 25.0, 1.3, 1.6, {cols: 2});
  slab(B, tw, tw.len / 2, TW.top - 0.25, tw.len, 0.25, 0.1, 'stone');
  polyFace(fN(TW.e0, R9.e1, TW.n0), [[0, R9.cornice], [0, TW.top], [R9.e1 - R9.e0, TW.top], [R9.e1 - R9.e0, R9.mans]], 'brick');
  rectFace(fW(TW.e0, TW.n0, R9.n1), RP.top, TW.top, 'brick');
  rectFace(fS(TW.e0, R9.e1, R9.n1), 0, TW.top, 'brick');
  capUp(rect(TW.e0, R9.e1, TW.n0, R9.n1), TW.top, 'slate');
  // the rear piece behind (25.3 m): yard face, south party wall (inferred)
  const rw = face(fW(MK.e0, TW.n0, RP.n1), 0, RP.top, 'brick');
  for (const y of [7.9, 12.65, 17.4]) opening(rw, 2.2, y, 2.2, 2.6, {cols: 2});
  rectFace(fS(MK.e0, RP.e1, RP.n1), 0, RP.top, 'brick');
  rectFace(fE(RP.e1, R9.n1, RP.n1), 0, RP.top, 'brick');
  capUp(rect(MK.e0, RP.e1, TW.n0, RP.n1), RP.top, 'slate');
}

// ---- the housing block, Da Costakade 136-140 (w05-67, w07-68, w08-68, w09-68, w11-67) ------------------------------------
const HB = {e0: 45.3, n0: -6.65, nA: -2.41, nB: 1.78, nC: 9.46, nD: 13.65, n1: MK.n0, low: 15.0, top: 23.2, lowS: 14.8};
const SILLS_HB = [4.4, 7.1, 9.8, 12.5, 15.2, 17.9, 20.6];
function housing() {
  // the cream-brick fronts, stepped as the BAG ring: 15 m wing, three 23.2 m sections (the middle one with loggias), 14.8 m wing
  const segs: [number, number, number, number, 'win' | 'loggia' | 'gate' | 'low'][] = [
    [59.82, HB.n0, HB.nA, HB.low, 'low'], [60.04, HB.nA, HB.nB, HB.top, 'win'], [60.25, HB.nB, HB.nC, HB.top, 'loggia'],
    [60.03, HB.nC, HB.nD, HB.top, 'win'], [59.8, HB.nD, HB.n1, HB.lowS, 'gate']];
  for (const [e, n0, n1, top, kind] of segs) {
    const F = face(fE(e, n0, n1), 0, top, 'sandstone'), L = n1 - n0;
    const rows = SILLS_HB.filter(y => y + 1.3 < top - 0.6);
    if (kind === 'loggia') {
      for (const y of rows) for (const t of [1.2, 3.0, 4.75, 6.5]) {
        opening(F, t * L / 7.68, y, 1.3, 1.45, {depth: 1.0, back: 'dark', frame: 'dark', edge: 0});
        slab(B, F, t * L / 7.68, y, 1.3, 0.1, 0.05, 'bronze', -0.15);
        slab(B, F, t * L / 7.68, y + 0.85, 1.3, 0.06, 0.05, 'bronze', -0.15);
      }
      // the entrance portico: white posts and a sawtooth lintel (w05)
      opening(F, L / 2, 0.1, 3.0, 3.3, {depth: 0.9, back: 'glass', frame: 'dark', cols: 3, bars: [2.4]});
      for (const s of [-1, 0, 1]) slab(B, F, L / 2 + s * 1.55, 0, 0.32, 3.4, 0.25, 'white');
      slab(B, F, L / 2, 3.4, 3.8, 0.55, 0.3, 'white');
    } else {
      for (const y of rows) for (const t of [0.3, 0.72]) opening(F, t * L, y, 1.25, 1.3, {cols: 1, frame: 'dark', edge: 0.06, depth: 0.18});
      if (kind === 'gate') { opening(F, L * 0.62, 0.1, 2.3, 3.0, {depth: 1.2, back: 'dark', frame: 'white', edge: 0.12}); }
      else for (const t of [0.3, 0.72]) opening(F, t * L, 1.8, 1.25, 1.3, {cols: 1, frame: 'dark', edge: 0.06});
    }
    // white plinth, broken at the entrance and the gate
    const gap = kind === 'loggia' ? [L / 2 - 1.71, L / 2 + 1.71] : kind === 'gate' ? [L * 0.62 - 1.2, L * 0.62 + 1.2] : null;
    for (const [p0, p1] of gap ? [[0, gap[0]], [gap[1], L]] : [[0, L]]) slab(B, F, (p0 + p1) / 2, 0, p1 - p0, 1.0, 0.06, 'white');
    slab(B, F, L / 2, top - 0.45, L + 0.02, 0.45, 0.3, 'slate');   // grey coping
  }
  // steps between the sections, the sections' end walls over the wings, north party wall and back (inferred)
  rectFace(fN(59.82, 60.04, HB.nA), 0, HB.low, 'sandstone');
  rectFace(fN(HB.e0, 60.04, HB.nA), HB.low, HB.top, 'sandstone');
  rectFace(fN(60.04, 60.25, HB.nB), 0, HB.top, 'sandstone');
  rectFace(fS(60.03, 60.25, HB.nC), 0, HB.top, 'sandstone');
  rectFace(fS(59.8, 60.03, HB.nD), 0, HB.lowS, 'sandstone');
  rectFace(fS(HB.e0, 60.03, HB.nD), HB.lowS, HB.top, 'sandstone');
  rectFace(fN(HB.e0, 59.82, HB.n0), 0, HB.low, 'sandstone');
  for (const [n0, n1, top] of [[HB.n0, HB.nA, HB.low], [HB.nA, HB.nD, HB.top], [HB.nD, HB.n1, HB.lowS]] as const) {
    const w = face(fW(HB.e0, n0, n1), 0, top, 'sandstone');
    for (const y of SILLS_HB.filter(y => y + 1.3 < top - 0.6)) for (let t = 1.2; t < n1 - n0 - 1.5; t += 2.8) opening(w, t + 0.6, y, 1.25, 1.3, {frame: 'dark', edge: 0.06});
  }
  capUp([[HB.e0, HB.n0], [59.82, HB.n0], [59.82, HB.nA], [HB.e0, HB.nA]], HB.low, 'slate');
  capUp([[HB.e0, HB.nA], [60.04, HB.nA], [60.04, HB.nB], [60.25, HB.nB], [60.25, HB.nC], [60.03, HB.nC], [60.03, HB.nD], [HB.e0, HB.nD]], HB.top, 'slate');
  capUp([[HB.e0, HB.nD], [59.8, HB.nD], [59.8, HB.n1], [HB.e0, HB.n1]], HB.lowS, 'slate');
}

export function buildDaCostakade146(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  // Everything but the cut walls is recorded and added after them, so the walls' materials and their large triangles come first in
  // the GLB: the geometry audit seeds each wall plane from the first triangle it meets, and a 10 cm hood tilted by quantization
  // seeded a plane that split the 70 m Bilderdijkstraat front into fragments.
  const later: Parameters<BuildingTools['add']>[] = [];
  B = {...b, add: (...a: Parameters<BuildingTools['add']>) => { later.push(a); }} as BuildingTools; FACES = [];
  cornerHouse(); b.mark?.('corner');
  dairy(); b.mark?.('dairy');
  factory(); b.mark?.('factory');
  yardBuildings(); b.mark?.('yard');
  merkelbach(); b.mark?.('merkelbach');
  centralExtension(); b.mark?.('1909');
  housing(); b.mark?.('housing');
  B = b; flushFaces(); b.mark?.('faces');
  for (const a of later) b.add(...a);
}
