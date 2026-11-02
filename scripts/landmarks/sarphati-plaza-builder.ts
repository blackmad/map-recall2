import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {letters, ledgeStrip, slab, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {arcGlyphPlacements} from '../../src/canalRecall/landmarks/arcLettering';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';

/**
 * Sarphati Plaza, Rhijnspoorplein 10 / Sarphatistraat 44-48 at the Weesperplein (BAG pand 0363100012182840, bouwjaar 1992;
 * BAG verblijfsobjecten: offices Rhijnspoorplein 10, a shop at Sarphatistraat 48, eleven homes Sarphatistraat 44A-K).
 * The architect is not named by nl.wikipedia, the BAG or the monument registers (no monument record); the letting brochures
 * call it a 1992 office building of ten storeys. Native frame of scripts/landmarks/sarphati-plaza-footprints.json (x east,
 * z south, y up from the street, 0.05 m NAP; origin = vertex average of the BAG ring in RD).
 *
 * The whole plan is square to one pair of axes: a along the Sarphatistraat front, e = (0.949, -0.315) (bearing 72), b towards
 * the garden, s = (0.315, 0.949); origin the tower's north-west BAG corner (-9.096, 8.655). In (a, b), from the BAG ring and the
 * 3DBAG LoD2.2 roof parts (CC BY 4.0), heights above the street:
 *  - the brick front on the Sarphatistraat at b = -14.84: east part a -11.9..15.4 (4 storeys, 16.3 m), west part
 *    a -23.9..-11.9 (5 storeys, 17.65 m, a 14.7 m strip on its garden side), party wall at a = -23.9;
 *  - the round entrance drum at the east end: a circular segment, centre (13.53, -7.42), radius 7.63 m (the BAG arc), whose
 *    two upper storeys cantilever over the entrance on two navy columns;
 *  - the granite tower a 0..15.15: its ground storeys b 0..14.8, above the brick roof b -7.2..14.8 (22 m deep), parapet
 *    36.1 m, 2.4 m shoulders either side and the upper block a 2.5..12.9 to 39.55 m, the dark barrel-vault cap a 4.4..11.3
 *    over the full depth (3DBAG ridge 42.46 m).
 * Openings measured on the rectified Gemeente Amsterdam panorama crops (CC BY 4.0) of the brief (w01-342 37.8 px/m, w02-162 and
 * w04-72 50 px/m) and the aimed views listed in sarphati-plaza-inventory.json. INFERRED: the tower's west face (garden, no
 * panorama; given the east face's pattern) and the brick wing's garden faces (given the front's axes).
 */
type P2 = [number, number];
type Col = Parameters<BuildingTools['add']>[1];

const O: P2 = [-9.096, 8.655], E: P2 = [0.9491044, -0.3149616], S: P2 = [0.3149616, 0.9491044];
const A = (a: number, b: number): P2 => [O[0] + a * E[0] + b * S[0], O[1] + a * E[1] + b * S[1]];
const V = (va: number, vb: number): P2 => [va * E[0] + vb * S[0], va * E[1] + vb * S[1]];

// ---- plan constants (a, b metres) -------------------------------------------------------------------------------------------
const FRONT_B = -14.84, WEST_A = -23.9, SPLIT_A = -11.9, END_A = 15.36;
const TOWER = {a0: 0, a1: 15.15, b0: -7.2, bLow: 0, b1: 14.8};
const H_EAST = 16.3, H_WEST = 17.65, H_STRIP = 14.7, STRIP_B = 1.98, STRIP_B0 = 0.2;
const PARAPET = 36.1, UPPER = {a0: 2.5, a1: 12.9, top: 39.55};
const VAULT = {a0: 4.4, a1: 11.3, spring: 41.0, ridge: 42.45, b0: -7.7, b1: 15.3};
const DRUM_C: P2 = [13.53, -7.42], DRUM_R = 7.63;
/** Tower storeys: a two-storey ground floor of tall windows (1.1-6.7 m), then nine storeys on a 3.2 m pitch (w04-72). */
const ROW_SILLS = Array.from({length: 9}, (_, k) => 7.6 + 3.2 * k), ROW_H = 2.3;

// ---- primitive helpers ------------------------------------------------------------------------------------------------------
function geom(pos: number[]) {
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
/** Wall frame from p (viewer's left) to q in native metres; outward n = [-tz, tx]. */
function lineFrame(p: P2, q: P2): {f: Frame; len: number} {
  const len = Math.hypot(q[0] - p[0], q[1] - p[1]), tx = (q[0] - p[0]) / len, tz = (q[1] - p[1]) / len;
  return {f: {origin: p, tangent: [tx, tz], n: [-tz, tx]}, len};
}
/** Faces in building axes, each seen from outside with t running to the viewer's right. */
const fN = (a0: number, a1: number, b: number) => lineFrame(A(a1, b), A(a0, b));
const fS = (a0: number, a1: number, b: number) => lineFrame(A(a0, b), A(a1, b));
const fE = (a: number, b0: number, b1: number) => lineFrame(A(a, b1), A(a, b0));
const fW = (a: number, b0: number, b1: number) => lineFrame(A(a, b0), A(a, b1));
/** One outward-facing wall quad on a face frame, t 0..len. */
function wall(b: BuildingTools, face: {f: Frame; len: number}, y0: number, y1: number, c: Col) {
  const {f, len} = face, p = f.origin, q: P2 = [p[0] + f.tangent[0] * len, p[1] + f.tangent[1] * len];
  b.add(geom([p[0], y0, p[1], q[0], y0, q[1], p[0], y1, p[1], q[0], y0, q[1], q[0], y1, q[1], p[0], y1, p[1]]), c);
}
const shapeOf = (pts: P2[]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
const capUp = (b: BuildingTools, ab: P2[], y: number, c: Col) => b.add(upwardRoofPlane(shapeOf(ab.map(p => A(p[0], p[1]))), y), c);
function capDown(b: BuildingTools, ab: P2[], y: number, c: Col) {
  const g = new T.ShapeGeometry(shapeOf(ab.map(p => A(p[0], p[1])))); g.rotateX(Math.PI / 2); g.computeVertexNormals(); g.translate(0, y, 0); b.add(g, c);
}
const rectAB = (a0: number, a1: number, b0: number, b1: number): P2[] => [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];

/**
 * Flat faces with cut openings (holedWall.ts): every window, shop front, door and glazed strip on a flat face is a hole
 * through the wall with its reveals and a recessed back (glass 14 cm in), so no pane lies a few centimetres in front of
 * the wall. `void` holes are parts of a face's rectangle that are not wall (the brick roof's side of the tower's lower
 * east and west faces, the sky beside the upper block) and get no back.
 */
type Hole = HoledOpening & {back: Col | null};
type Face = {f: Frame; len: number; y0: number; y1: number; c: Col; holes: Hole[]};
let FACES: Face[] = [];
const REVEAL = 0.14;
function face(fr: {f: Frame; len: number}, y0: number, y1: number, c: Col): Face {
  const F: Face = {...fr, y0, y1, c, holes: []}; FACES.push(F); return F;
}
const voidHole = (F: Face, t0: number, t1: number, y0: number, y1: number) => F.holes.push({t0, t1, y0, y1, depth: 0, back: null});
function flushFaces(b: BuildingTools) {
  for (const F of FACES) {
    const hw = holedWall(F.len, F.y0, F.y1, F.holes);
    const P = (q: [number, number, number]) => [F.f.origin[0] + F.f.tangent[0] * q[0] + F.f.n[0] * q[2], q[1], F.f.origin[1] + F.f.tangent[1] * q[0] + F.f.n[1] * q[2]];
    const tris = (qs: WallQuad[]) => qs.flatMap(q => { const v = q.pts.map(P); return [...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]]; });
    b.add(geom([...tris(hw.face), ...tris(hw.reveals.flat())]), F.c);
    const byBack = new Map<Col, WallQuad[]>();
    F.holes.forEach((h, i) => { if (h.back) byBack.set(h.back, [...(byBack.get(h.back) ?? []), hw.backs[i]]); });
    for (const [c, qs] of byBack) b.add(geom(tris(qs)), c);
  }
  FACES = [];
}
/** Frame border of width fw round a w x h opening at t, y, standing d proud of the wall; long sides are closed slabs. */
function border(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, fw: number, d: number, c: Col) {
  ledgeStrip(b, f, t, y - fw, w + 2 * fw, fw, d, c);
  ledgeStrip(b, f, t, y + h, w + 2 * fw, fw, d, c);
  for (const s of [-1, 1]) (h > 8 ? slab : ledgeStrip)(b, f, t + s * (w + fw) / 2, y, fw, h, d, c);
}
/**
 * Window cut into a face: the glass back 14 cm in, a frame border 10 cm proud round the hole, glazing bars standing from
 * the glass to 2 cm behind the wall plane (cols x rows lights). On a bare Frame (the drum's facets) the pane is applied.
 */
function win(b: BuildingTools, F: Face | Frame, t: number, y: number, w: number, h: number, cols: number, rows: number, frame: Col = 'frame', back: Col = 'glass') {
  const f = 'holes' in F ? F.f : F, cut = 'holes' in F, o = cut ? -REVEAL : 0.0, d = cut ? REVEAL - 0.02 : 0.03;
  if (cut) F.holes.push({t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth: REVEAL, back});
  else slab(b, f, t, y, w, h, 0.06, back, 0);
  border(b, f, t, y, w, h, 0.06, 0.1, frame);
  const o2 = cut ? o : 0.06;
  for (let k = 1; k < cols; k++) (h > 8 ? slab : ledgeStrip)(b, f, t - w / 2 + w * k / cols, y, 0.06, h, d, frame, o2);
  for (let k = 1; k < rows; k++) ledgeStrip(b, f, t, y + h * k / rows - 0.03, w, 0.06, d, frame, o2);
}
/** A pair of windows about t (the brick front's and the tower's paired windows, 0.92 m wide, 1.32 m apart). */
function pair(b: BuildingTools, F: Face | Frame, t: number, y: number, h: number, rows = 2, w = 0.92, gap = 1.32) {
  for (const s of [-1, 1]) win(b, F, t + s * gap / 2, y, w, h, 1, rows);
}

// ---- drum geometry: circles about DRUM_C, angles phi = atan2(b - cb, a - ca); the segment lies beyond the chord a = END_A ----
const dA = END_A - DRUM_C[0];
const phiEnd = (r: number) => Math.acos(Math.min(1, dA / r));
const onCircle = (r: number, phi: number): P2 => [DRUM_C[0] + r * Math.cos(phi), DRUM_C[1] + r * Math.sin(phi)];
const SEG = 16;
/** Plan ring between radii rIn (0 = up to the chord) and rOut, bounded by the chord: outer arc, chord, inner arc. */
function segRing(rIn: number, rOut: number): P2[] {
  const out: P2[] = [], po = phiEnd(rOut);
  for (let i = 0; i <= SEG; i++) out.push(onCircle(rOut, po - 2 * po * i / SEG));
  if (rIn <= dA) return out;
  const pi = phiEnd(rIn);
  for (let i = 0; i <= SEG; i++) out.push(onCircle(rIn, -pi + 2 * pi * i / SEG));
  return out;
}
/** Sector of a ring between angles (for steps), plan outline. */
function sector(r0: number, r1: number, p0: number, p1: number, n = 8): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) out.push(onCircle(r1, p0 + (p1 - p0) * i / n));
  for (let i = n; i >= 0; i--) out.push(onCircle(r0, p0 + (p1 - p0) * i / n));
  return out;
}
/** Faceted curved wall of radius r over its chord segment; returns the facet frames left to right as seen from outside. */
type Facet = {f: Frame; len: number; phi: number; p1: number; p2: number; omitted: boolean};
function arcWall(b: BuildingTools, r: number, y0: number, y1: number, c: Col, omit: (phi: number) => boolean = () => false): Facet[] {
  const pe = phiEnd(r), facets: Facet[] = [];
  for (let i = 0; i < SEG; i++) {
    const p1 = pe - 2 * pe * i / SEG, p2 = pe - 2 * pe * (i + 1) / SEG;
    const [pa, pb] = [onCircle(r, p1), onCircle(r, p2)];
    const face = lineFrame(A(pa[0], pa[1]), A(pb[0], pb[1])), phi = (p1 + p2) / 2, omitted = omit(phi);
    if (!omitted) wall(b, face, y0, y1, c);
    facets.push({...face, phi, p1, p2, omitted});
  }
  // the flat returns on the chord line between the arc ends and the wing corners (b = FRONT_B and b = 0)
  const bArc = Math.sqrt(Math.max(0, r * r - dA * dA));
  if (DRUM_C[1] - bArc > FRONT_B + 0.02) wall(b, fE(END_A, FRONT_B, DRUM_C[1] - bArc), y0, y1, c);
  if (DRUM_C[1] + bArc < -0.02) wall(b, fE(END_A, DRUM_C[1] + bArc, 0), y0, y1, c);
  return facets;
}
/** Thin projecting ring band on the drum (stone stripes, coping): its outer face and its top. */
function ringBand(b: BuildingTools, r: number, y: number, h: number, proj: number, c: Col) {
  arcWall(b, r + proj, y, y + h, c);
  capUp(b, segRing(r, r + proj), y + h, c);
  capDown(b, segRing(r, r + proj), y, c);
}

// ---- the brick wing -----------------------------------------------------------------------------------------------------
function wing(b: BuildingTools) {
  // shell: front, party wall, garden faces, the west part's step over the east part
  const front = face(fN(SPLIT_A, END_A, FRONT_B), 0, H_EAST, 'brick'), west = face(fN(WEST_A, SPLIT_A, FRONT_B), 0, H_WEST, 'brick');
  wall(b, fW(WEST_A, FRONT_B, STRIP_B), 0, H_WEST, 'brick');
  const gW = face(fS(WEST_A, SPLIT_A, STRIP_B), 0, H_STRIP, 'brick');
  wall(b, fS(WEST_A, SPLIT_A, STRIP_B0), H_STRIP, H_WEST, 'brick');
  wall(b, fE(SPLIT_A, 0, STRIP_B), 0, H_STRIP, 'brick');
  wall(b, fE(SPLIT_A, 0, STRIP_B0), H_STRIP, H_WEST, 'brick');
  wall(b, fE(SPLIT_A, FRONT_B, 0), H_EAST, H_WEST, 'brick');
  const gE = face(fS(SPLIT_A, TOWER.a0, 0), 0, H_EAST, 'brick');
  wall(b, fS(TOWER.a1, END_A, 0), 0, H_EAST, 'brick'); // the 0.2 m jog between the drum's chord and the tower's east face
  // roofs: west part, its garden strip, the east part around the tower (the drum keeps its own top)
  capUp(b, rectAB(WEST_A, SPLIT_A, FRONT_B, STRIP_B0), H_WEST, 'slate');
  capUp(b, rectAB(WEST_A, SPLIT_A, STRIP_B0, STRIP_B), H_STRIP, 'slate');
  capUp(b, [[SPLIT_A, FRONT_B], [END_A, FRONT_B], [END_A, 0], [TOWER.a1, 0], [TOWER.a1, TOWER.b0], [TOWER.a0, TOWER.b0], [TOWER.a0, 0], [SPLIT_A, 0]], H_EAST, 'slate');
  // coping and the stone bands (w01-342: shop fascia 4.4 m, the band under the top storey 12.6 m)
  slab(b, front.f, front.len / 2, H_EAST - 0.3, front.len, 0.3, 0.08, 'concrete');
  slab(b, west.f, west.len / 2, H_WEST - 0.3, west.len, 0.3, 0.08, 'concrete');
  ledgeStrip(b, front.f, front.len / 2, 12.45, front.len, 0.22, 0.07, 'concrete');
  // front, east part: t runs west from END_A, so t = END_A - a
  const tE = (a: number) => END_A - a;
  const AXES = [12.45, 8.83, 5.39, 1.82, -1.70, -5.20, -8.77];
  for (const [i, a] of AXES.entries()) {
    if (i < 2) pair(b, front, tE(a), 1.0, 6.6, 4);           // the two axes by the drum: two-storey window pairs
    else pair(b, front, tE(a), 4.95, 2.65, 2);
    pair(b, front, tE(a), 8.5, 2.7, 2);
    pair(b, front, tE(a), 12.9, 1.7, 1);
  }
  win(b, front, tE(-11.2), 4.95, 0.92, 2.65, 1, 2);
  win(b, front, tE(-11.2), 8.5, 0.92, 2.7, 1, 2);
  win(b, front, tE(-11.2), 12.9, 0.92, 1.7, 1, 1);
  // three shop fronts under a dark fascia band (America Today in the middle), brick piers between
  for (const [a0, a1] of [[0.68, 6.37], [-6.47, -0.51], [-11.6, -7.66]]) {
    win(b, front, tE((a0 + a1) / 2), 0.3, a1 - a0, 3.5, Math.round((a1 - a0) / 1.4), 1, 'dark');
    ledgeStrip(b, front.f, tE((a0 + a1) / 2), 3.9, a1 - a0 + 0.3, 0.5, 0.16, 'dark');
  }
  // west part (w01-342 right, five storeys): door and glazed ground floor, short pairs, tall pairs on storeys 2-3, cornice, top pairs
  const tW = (a: number) => SPLIT_A - a;
  for (const a of [-14.4, -17.9, -21.4]) {
    pair(b, west, tW(a), 4.95, 2.65, 2);
    pair(b, west, tW(a), 8.5, 4.9, 3);
    pair(b, west, tW(a), 15.1, 1.7, 1);
  }
  win(b, west, tW(-14.4), 0.15, 1.9, 2.85, 2, 1, 'dark', 'dark');
  win(b, west, tW(-20.55), 0.4, 4.1, 3.0, 4, 1);
  slab(b, west.f, west.len / 2, 13.7, west.len, 0.3, 0.35, 'concrete');
  ledgeStrip(b, west.f, west.len / 2, 4.4, west.len, 0.2, 0.07, 'concrete');
  // garden faces (INFERRED: the front's axes, no panorama)
  for (const a of [-1.70, -5.20, -8.77]) for (const y of [1.2, 4.95, 8.5, 12.9]) pair(b, gE, a - SPLIT_A, y, y > 12 ? 1.7 : 2.4, 2);
  for (const a of [-14.4, -17.9, -21.4]) for (const y of [1.2, 4.95, 8.5, 11.8]) pair(b, gW, a - WEST_A, y, 2.2, 2);
}

// ---- the tower -------------------------------------------------------------------------------------------------------
function tower(b: BuildingTools) {
  const {a0, a1, b0, b1} = TOWER;
  // shell: east and west faces run down to the street on the garden side, above the brick roof on the front side
  const east = face(fE(a1, b0, b1), 0, PARAPET, 'stone'), westF = face(fW(a0, b0, b1), 0, PARAPET, 'stone');
  voidHole(east, b1, b1 - b0, 0, H_EAST); voidHole(westF, 0, -b0, 0, H_EAST);
  // north and south faces run up through the upper block (to 39.55 m); the shoulders' sky is void
  const south = face(fS(a0, a1, b1), 0, UPPER.top, 'stone'), north = face(fN(a0, a1, b0), H_EAST, UPPER.top, 'stone');
  for (const F of [south, north]) { voidHole(F, 0, UPPER.a0, PARAPET, UPPER.top); voidHole(F, UPPER.a1, a1, PARAPET, UPPER.top); }
  // the upper block between the shoulders, to 39.55 m (3DBAG strips 36.1 / 39.55)
  wall(b, fE(UPPER.a1, b0, b1), PARAPET, UPPER.top, 'stone');
  wall(b, fW(UPPER.a0, b0, b1), PARAPET, UPPER.top, 'stone');
  capUp(b, rectAB(a0, UPPER.a0, b0, b1), PARAPET, 'slate');
  capUp(b, rectAB(UPPER.a1, a1, b0, b1), PARAPET, 'slate');
  capUp(b, rectAB(UPPER.a0, UPPER.a1, b0, b1), UPPER.top, 'slate');
  // parapet copings on the shoulders and the upper block
  for (const [face, top] of [[fE(a1, b0, b1), PARAPET], [fW(a0, b0, b1), PARAPET], [fE(UPPER.a1, b0, b1), UPPER.top], [fW(UPPER.a0, b0, b1), UPPER.top]] as const)
    ledgeStrip(b, face.f, face.len / 2, top - 0.25, face.len, 0.25, 0.06, 'concrete');
  // brick plinth (w04-72)
  for (const face of [fE(a1, 0, b1), fW(a0, 0, b1), fS(a0, a1, b1)]) slab(b, face.f, face.len / 2, 0, face.len, 0.45, 0.06, 'brick');

  // east face (w04-72): four bays b 2.15-12.75 to the ground, two more over the drum; four-light windows, tall ground windows
  const tEast = (bb: number) => b1 - bb;
  const BAYS = [12.75, 9.25, 5.65, 2.15], OVER = [-1.35, -4.85];
  const tWest = (bb: number) => bb - b0;
  for (const [F, tOf] of [[east, tEast], [westF, tWest]] as const) {
    for (const bb of BAYS) {
      win(b, F, tOf(bb), 1.1, 2.3, 5.6, 2, 4, 'blue');
      for (const y of ROW_SILLS) win(b, F, tOf(bb), y, 2.3, ROW_H, 2, 3);
    }
    for (const bb of OVER) for (const y of ROW_SILLS) if (y > H_EAST) win(b, F, tOf(bb), y, 2.3, ROW_H, 2, 3);
  }
  // south face (w02-162): a column of window pairs at each end, the glazed strip in the middle to the ground
  for (const t of [1.85, 12.65]) {
    win(b, south, t, 1.1, 2.3, 5.6, t < 5 ? 2 : 4, 4, 'blue');
    for (const y of ROW_SILLS) pair(b, south, t, y, ROW_H, 3, 0.92, 1.36);
  }
  strip(b, south, 7.25, 0.45);
  // north face over the brick roof (w01-342, far view): one column of pairs at the east end, the strip, the west part blank
  const tN = (a: number) => a1 - a;
  for (const y of ROW_SILLS) if (y > H_EAST) pair(b, north, tN(12.65), y, ROW_H, 3, 0.92, 1.36);
  strip(b, north, tN(7.25), H_EAST + 0.3);
  // the raised panel over each strip (w01 crop: 4.1 m wide, 0.6 m over the upper block)
  for (const [bb0, bb1] of [[b0, b0 + 0.3], [b1 - 0.3, b1]]) {
    const pts = rectAB(5.2, 9.3, bb0, bb1);
    for (const face of [fN(5.2, 9.3, bb0), fS(5.2, 9.3, bb1), fE(9.3, bb0, bb1), fW(5.2, bb0, bb1)]) wall(b, face, UPPER.top, UPPER.top + 0.6, 'stone');
    capUp(b, pts, UPPER.top + 0.6, 'concrete');
  }
  crown(b);
}
/** The full-height glazed strip: 3.3 m wide, four lights, navy grid on a 1.6 m transom pitch, up to 38.1 m. */
function strip(b: BuildingTools, F: Face, t: number, y0: number) {
  const w = 3.3, top = 38.1, f = F.f;
  F.holes.push({t0: t - w / 2, t1: t + w / 2, y0, y1: top, depth: REVEAL, back: 'glass'});
  border(b, f, t, y0, w, top - y0, 0.07, 0.1, 'blue');
  for (let k = 1; k < 4; k++) slab(b, f, t - w / 2 + w * k / 4, y0, 0.07, top - y0, REVEAL - 0.02, 'blue', -REVEAL);
  for (let y = y0 + 1.6; y < top - 0.3; y += 1.6) ledgeStrip(b, f, t, y, w, 0.07, REVEAL - 0.02, 'blue', -REVEAL);
}
/** Crown: a dark recessed band on the upper block and the shallow barrel vault over the full depth (3DBAG ridge 42.46 m). */
function crown(b: BuildingTools) {
  const ra = 4.8, rb = 10.9, rb0 = TOWER.b0 + 0.35, rb1 = TOWER.b1 - 0.35;
  for (const face of [fN(ra, rb, rb0), fS(ra, rb, rb1), fE(rb, rb0, rb1), fW(ra, rb0, rb1)]) wall(b, face, UPPER.top, VAULT.spring + 0.1, 'dark');
  capUp(b, rectAB(ra, rb, rb0, rb1), VAULT.spring + 0.1, 'dark');
  // the vault: segmental arc in (a, y), extruded along b; an outer and an inner shell, the two arched ends, the eaves strips
  const half = (VAULT.a1 - VAULT.a0) / 2, mid = (VAULT.a0 + VAULT.a1) / 2, rise = VAULT.ridge - VAULT.spring;
  const R = (half * half + rise * rise) / (2 * rise), cy = VAULT.ridge - R, th = 0.22, n = 12, span = Math.asin(half / R);
  const arc = (r: number) => Array.from({length: n + 1}, (_, i) => { const t = -span + 2 * span * i / n; return [mid + r * Math.sin(t), cy + r * Math.cos(t)] as P2; });
  const outer = arc(R), inner = arc(R - th);
  const P = (ay: P2, bb: number) => { const p = A(ay[0], bb); return [p[0], ay[1], p[1]]; };
  const out: number[] = [], under: number[] = [], endN: number[] = [], endS: number[] = [], eaves: number[] = [];
  const quad = (into: number[], p: number[], q: number[], r: number[], s: number[]) => into.push(...p, ...q, ...r, ...p, ...r, ...s);
  for (let i = 0; i < n; i++) {
    quad(out, P(outer[i], VAULT.b0), P(outer[i], VAULT.b1), P(outer[i + 1], VAULT.b1), P(outer[i + 1], VAULT.b0));
    quad(under, P(inner[i], VAULT.b0), P(inner[i + 1], VAULT.b0), P(inner[i + 1], VAULT.b1), P(inner[i], VAULT.b1));
    quad(endN, P(outer[i], VAULT.b0), P(outer[i + 1], VAULT.b0), P(inner[i + 1], VAULT.b0), P(inner[i], VAULT.b0));
    quad(endS, P(outer[i], VAULT.b1), P(inner[i], VAULT.b1), P(inner[i + 1], VAULT.b1), P(outer[i + 1], VAULT.b1));
  }
  const eW: number[] = [], eE: number[] = [];
  quad(eW, P(outer[0], VAULT.b0), P(inner[0], VAULT.b0), P(inner[0], VAULT.b1), P(outer[0], VAULT.b1));
  quad(eE, P(outer[n], VAULT.b0), P(inner[n], VAULT.b0), P(inner[n], VAULT.b1), P(outer[n], VAULT.b1));
  const up: [number, number, number] = [0, 1, 0], down: [number, number, number] = [0, -1, 0];
  const s3 = (v: P2, k = 1): [number, number, number] => [v[0] * k, 0, v[1] * k];
  orient(out, up); orient(under, down); orient(endN, s3(S, -1)); orient(endS, s3(S)); orient(eW, s3(E, -1)); orient(eE, s3(E));
  eaves.push(...eW, ...eE);
  b.add(geom(out), 'bronze'); b.add(geom(under), 'dark'); b.add(geom([...endN, ...endS, ...eaves]), 'bronze');
}
/** Flip triangles whose geometric normal points away from `want`. */
function orient(pos: number[], want: [number, number, number]) {
  for (let i = 0; i < pos.length; i += 9) {
    const u = [pos[i + 3] - pos[i], pos[i + 4] - pos[i + 1], pos[i + 5] - pos[i + 2]], v = [pos[i + 6] - pos[i], pos[i + 7] - pos[i + 1], pos[i + 8] - pos[i + 2]];
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (nn[0] * want[0] + nn[1] * want[1] + nn[2] * want[2] < 0) for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
  }
}

// ---- the entrance drum -------------------------------------------------------------------------------------------------
const R0 = 5.4, R1B = 6.3, R2 = 5.8;
const Y_L0 = 7.5, Y_L1 = 9.0, Y_L2 = 11.5;
/** Entrance axis: towards the Weesperplein corner (b59 and b18 views put the lettering and the door between the columns). */
const PHI_E = -10 * Math.PI / 180, BAY_HALF = 0.42, BAY_DEPTH = 0.35;
function drum(b: BuildingTools) {
  // ground and first storey: brick drum wall r 5.4 with the entrance; lettering band r 6.3; storey 2 ring r 5.8; upper ring r 7.63
  const inBay = (phi: number) => Math.abs(phi - PHI_E) < BAY_HALF;
  const l0 = arcWall(b, R0, 0, Y_L0, 'brick', inBay);
  capDown(b, segRing(R0, R1B), Y_L0, 'white');
  const l1 = arcWall(b, R1B, Y_L0, Y_L1, 'brick');
  capUp(b, segRing(R2, R1B), Y_L1, 'concrete');
  const l2 = arcWall(b, R2, Y_L1, Y_L2, 'brick');
  capDown(b, segRing(R2, DRUM_R), Y_L2, 'white');
  const l3 = arcWall(b, DRUM_R, Y_L2, H_EAST, 'brick');
  capUp(b, segRing(0, DRUM_R), H_EAST, 'slate');
  void l1;
  // stone stripes on the upper ring band and its coping (b59 view)
  ringBand(b, DRUM_R, 11.95, 0.12, 0.06, 'concrete');
  ringBand(b, DRUM_R, 12.3, 0.12, 0.06, 'concrete');
  ringBand(b, DRUM_R, H_EAST - 0.3, 0.3, 0.08, 'concrete');
  // window rings: storey 2 on l2, storey 3 on the upper ring
  // (not on the end facets, which meet the brick front and the tower at the chord)
  for (const fc of l2.slice(1, -1)) win(b, fc.f, fc.len / 2, 9.45, Math.min(0.85, fc.len - 0.3), 1.65, 1, 2);
  for (const fc of l3.slice(1, -1)) win(b, fc.f, fc.len / 2, 12.9, Math.min(1.05, fc.len - 0.3), 1.9, 1, 2);
  // ground: the two-storey glazed entrance between brick piers (navy grid), tall narrow windows on the other facets
  const near = (fc: {phi: number}) => Math.abs(fc.phi - PHI_E);
  const bay = l0.filter(fc => fc.omitted);
  // the entrance: a glass wall set 0.35 m into the drum between brick returns, under a white soffit, navy grid on the glass
  const rg = R0 - BAY_DEPTH, pTop = bay[0].p1, pBot = bay[bay.length - 1].p2;
  for (const fc of bay) {
    const [pa, pb] = [onCircle(rg, fc.p1), onCircle(rg, fc.p2)], g = lineFrame(A(pa[0], pa[1]), A(pb[0], pb[1]));
    wall(b, g, 0, Y_L0, 'glass');
    slab(b, g.f, 0.04, 0.6, 0.08, Y_L0 - 0.6, 0.1, 'blue');
    for (const y of [0.6, 2.9, 4.5, 6.0, Y_L0 - 0.12]) ledgeStrip(b, g.f, g.len / 2, y, g.len, 0.1, 0.1, 'blue');
  }
  capDown(b, sector(rg, R0, pBot, pTop), Y_L0, 'white');
  { const [o1, i1, o2, i2] = [onCircle(R0, pTop), onCircle(rg, pTop), onCircle(R0, pBot), onCircle(rg, pBot)];
    wall(b, lineFrame(A(o1[0], o1[1]), A(i1[0], i1[1])), 0, Y_L0, 'brick');
    wall(b, lineFrame(A(i2[0], i2[1]), A(o2[0], o2[1])), 0, Y_L0, 'brick'); }
  for (const fc of l0) if (!fc.omitted && near(fc) > 0.6 && l0.indexOf(fc) % 2 === 0) win(b, fc.f, fc.len / 2, 0.9, 0.55, 6.0, 1, 5, 'blue');
  // the two navy banners beside the entrance: tenant list and RHIJNSPOORPLEIN 10 / 38
  const beside = l0.filter(fc => !fc.omitted).sort((p, q) => near(p) - near(q)).slice(0, 2);
  for (const fc of beside) {
    slab(b, fc.f, fc.len / 2, 2.6, 0.85, 3.0, 0.06, 'blue');
    if (fc.phi < PHI_E) {
      letters(b, fc.f, '10', fc.len / 2, 4.55, 0.06, 0.06, 0.03, 'white');
      letters(b, fc.f, '38', fc.len / 2, 3.65, 0.06, 0.06, 0.03, 'white');
    }
  }
  // granite podium and three curved steps in front of the entrance
  for (const [k, h] of [[1.5, 0.15], [1.1, 0.3], [0.7, 0.45]] as const) {
    const pts = sector(R0 - BAY_DEPTH - 0.02, R0 + k, pBot, pTop);
    capUp(b, pts, h, 'sandstone');
    const p0 = pts[0], pn = pts[8];
    for (let i = 0; i < 8; i++) wall(b, lineFrame(A(pts[i + 1][0], pts[i + 1][1]), A(pts[i][0], pts[i][1])), h - 0.15, h, 'sandstone');
    wall(b, lineFrame(A(p0[0], p0[1]), A(pts[17][0], pts[17][1])), h - 0.15, h, 'sandstone');
    wall(b, lineFrame(A(pts[9][0], pts[9][1]), A(pn[0], pn[1])), h - 0.15, h, 'sandstone');
  }
  // two navy columns under the upper ring's edge either side of the entrance
  for (const s of [-1, 1]) {
    const [ca, cb] = onCircle(DRUM_R - 0.55, PHI_E + s * 0.7), p = A(ca, cb);
    b.add(new T.CylinderGeometry(0.26, 0.26, Y_L2, 12), 'blue', p[0], Y_L2 / 2, p[1]);
  }
  // SARPHATI PLAZA in silver capitals on the lettering band, following the curve (arcLettering.ts)
  const px = 0.085;
  for (const g of arcGlyphPlacements('SARPHATI PLAZA', {centre: DRUM_C, radius: R1B, centreAngle: PHI_E, advance: 6 * px})) {
    if (g.char === ' ') continue;
    const f: Frame = {origin: A(g.at[0], g.at[1]), tangent: V(g.tangent[0], g.tangent[1]), n: V(g.n[0], g.n[1])};
    letters(b, f, g.char, 0, 7.95, 0, px, 0.07, 'gold');
  }
}

export function buildSarphatiPlaza(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  FACES = [];
  wing(b); b.mark?.('wing');
  tower(b); b.mark?.('tower');
  drum(b); b.mark?.('drum');
  flushFaces(b); b.mark?.('faces');
}
