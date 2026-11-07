import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, slab} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {pieceFacadeBands, roofAt, type Band, type PieceEdge} from './ring-height-runs';
import {makeFrontKit, type FrontKit, type Sec} from './street-front-kit';
import source from './doubletree-centraal-footprints.json';

/**
 * DoubleTree by Hilton Amsterdam Centraal Station, Oosterdoksstraat 4, BAG pand 0363100012237484 (bouwjaar 2011,
 * logiesfunctie, CC0), on the Oosterdokseiland between the railway and the Oosterdok. The OBA next to it is not drawn.
 *
 * What the Gemeente Amsterdam panoramas show (CC BY 4.0, artifacts/landmark-briefs/doubletree-centraal/): a stepped block
 * of dark grey brick with ribbon windows under grey bands on every hotel storey, a glazed two-storey ground floor between
 * dark brick piers under a glass canopy on steel ties along the Oosterdok (the restaurant terraces), and white panel
 * cladding on the curved entrance volume at the east end (the DoubleTree entrance) and on the west corner; the top storeys
 * rise to 44 m (the skybar storey on the highest piece).
 *
 * Native frame of the footprints file (x east, z south, y up from the 1.03 m NAP street). Massing: a closed prism under every
 * 3DBAG LoD2.2 roof piece (CC BY 4.0); every exposed wall band (ring-height-runs.ts pieceFacadeBands) gets a cut front 0.3 m
 * outside it with the storey grid, as for weteringschans-corner-office.
 */
const OFF = 0.3;
// measured on the rectified w17-210 crop (50 px/m): ground glazing to 9.4 m with a transom at 4.7 m under a brick lintel to
// 10.1 m; hotel windows 2.2 m tall on a 3.1 m storey from a 12.4 m sill, a 0.9 m grey band between; on the Oosterdok the
// upper windows are 3.5 m wide between 2.1 m brick piers on the 5.6 m terrace bay, elsewhere they run as ribbons
const STOREY = 3.1, FIRST_SILL = 12.4, WIN_H = 2.2, MULLION = 1.65, PIER_W = 2.1;
const GROUND_TOP = 10.1, GLAZE_H = 9.35, TRANSOM = 4.7, PIER_BAY = 5.6, CANOPY_Y = 10.3;
/** The Oosterdok terrace fronts (w08/w09, w16-w25 face 207-210). */
const oosterdok = (bearing: number) => bearing > 190 && bearing < 230;
/** White panel cladding (w02-21, w11-72, w13-72, w28-21 at the east entrance volume; w15-30 at the west corner). */
const white = (bd: Band) => {
  const t = [(bd.chord.b[0] - bd.chord.a[0]) / bd.L, (bd.chord.b[1] - bd.chord.a[1]) / bd.L], m = (bd.s0 + bd.s1) / 2;
  const x = bd.chord.a[0] + t[0] * m, z = bd.chord.a[1] + t[1] * m;
  return x > 18 || Math.hypot(x + 51, z + 30) < 6;
};

type Ctx = {K: FrontKit; b: BuildingTools; edges: PieceEdge[]; ends: End[]};
/** A front's end on its chord line: where it is, which way the chord runs, and the heights it covers. */
type End = {p: [number, number]; t: [number, number]; y0: number; y1: number; band: Band};

const bandEnds = (edges: PieceEdge[]): End[] => edges.flatMap(e => e.bands.flatMap(bd => {
  const t: [number, number] = [(e.chord.b[0] - e.chord.a[0]) / e.L, (e.chord.b[1] - e.chord.a[1]) / e.L];
  const at = (s: number): [number, number] => [e.chord.a[0] + t[0] * s, e.chord.a[1] + t[1] * s];
  return [{p: at(bd.s0), t, y0: bd.bottom, y1: bd.top, band: bd}, {p: at(bd.s1), t, y0: bd.bottom, y1: bd.top, band: bd}];
}));
/** Height ranges of other fronts that continue this one's line through point p (collinear, sharing the end point). */
function continued(c: Ctx, bd: Band, p: [number, number], t: [number, number]): [number, number][] {
  return c.ends.filter(q => q.band !== bd && Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < 0.05 && Math.abs(q.t[0] * t[1] - q.t[1] * t[0]) < 0.03)
    .map(q => [q.y0, q.y1] as [number, number]);
}
/** [y0, y1] minus the union of the covered ranges. */
function uncovered(y0: number, y1: number, cov: [number, number][]): [number, number][] {
  let out: [number, number][] = [[y0, y1]];
  for (const [a, b] of cov) out = out.flatMap(([u, v]) => (b <= u || a >= v ? [[u, v]] : [[u, Math.min(v, a)], [Math.max(u, b), v]]).filter(([p, q]) => q - p > 0.05) as [number, number][]);
  return out;
}

function massing(b: BuildingTools) {
  for (const r of source.roofs) {
    const ys = r[0].map(p => p[1]);
    roofPrism(b, r as number[][][], 'greyBrick', 'concrete');
  }
}

/** Neighbouring edge of the same piece at a corner, and its band touching that corner. */
function neighbourBand(c: Ctx, e: PieceEdge, end: 0 | 1): Band | undefined {
  const same = c.edges.filter(q => q.piece === e.piece);
  const k = same.indexOf(e), q = same[(k + (end ? 1 : -1) + same.length) % same.length];
  if (!q) return undefined;
  const pt = end ? e.chord.b : e.chord.a, qa = end ? q.chord.a : q.chord.b;
  if (Math.hypot(pt[0] - qa[0], pt[1] - qa[1]) > 1e-3) return undefined;
  return end ? q.bands.find(bd => bd.s0 < 0.01) : q.bands.find(bd => bd.s1 > q.L - 0.01);
}

/** Grey storey band standing proud of the wall: front, top and underside only (its back lies on the wall, its 5 cm ends are
 *  open), 6 triangles instead of a box's 12, for the ~800 bands of the hotel. */
function band(b: BuildingTools, f: ReturnType<FrontKit['faceFrame']>, t: number, y: number, w: number, h: number, d: number) {
  const g = new T.BoxGeometry(w, h, d).translate(0, h / 2, d / 2);
  const idx = g.getIndex()!.array as ArrayLike<number>, keep: number[] = [];
  for (const face of [2, 3, 4]) for (let i = 0; i < 6; i++) keep.push(idx[face * 6 + i]);   // +y, -y, +z
  g.setIndex(keep);
  put(b, f, g, t, y, 0, 'slate');
}

function windows(K: FrontKit, S: Sec, b: BuildingTools, from: number, to: number, y0: number, y1: number, piece = -1, piered = false) {
  const others = source.roofs.filter((_, i) => i !== piece) as number[][][];
  const L = Math.hypot(S.ch.b[0] - S.ch.a[0], S.ch.b[1] - S.ch.a[1]), t = [(S.ch.b[0] - S.ch.a[0]) / L, (S.ch.b[1] - S.ch.a[1]) / L];
  /** Highest roof outside the front along a window: a lower roof must stay under its sill. */
  const floorAt = (s0: number, s1: number) => Math.max(0, ...[s0 - 0.3, s0, (s0 + s1) / 2, s1, s1 + 0.3].flatMap(s => [0.1, 0.6, 1.2].map(o => roofAt(others, [S.ch.a[0] + t[0] * s - t[1] * o, S.ch.a[1] + t[1] * s + t[0] * o]) ?? 0)));
  const len = to - from;
  if (len < 1.6) return;
  const f = K.faceFrame(S);
  // piered: one 3.5 m window per terrace bay; ribbon: one window across the band with mullions every 1.65 m (w07-251: six panes over 9.7 m)
  const n = piered ? Math.max(1, Math.round(len / PIER_BAY)) : 1, bay = len / n, w = piered ? Math.min(bay - 0.8, bay - PIER_W) : len - 1.4;
  if (w < 1.0) return;
  for (let k = 0; k < n; k++) {
    const s = from + bay * (k + 0.5);
    for (let y = FIRST_SILL; y + WIN_H <= y1 - 0.5; y += STOREY) {
      if (y < y0 + 0.35 || y < floorAt(s - w / 2, s + w / 2) + 0.3) continue;
      K.opening(S, s, y, w, WIN_H, {cols: Math.max(1, Math.round(w / MULLION)), frame: 'bronze', depth: 0.16, edge: 0.06});
      // the grey band over the window, 9 cm proud of the brick (past the 2-8 cm z-fight range)
      if (y + WIN_H + 0.9 <= y1 - 0.2) band(b, f, s, y + WIN_H + 0.05, w, 0.8, 0.09);
    }
  }
}

/**
 * Convex corner fill: the wedge between the chord corner, this front's end and the miter line (or, past an acute corner,
 * the bisector point 1.2 m out), so a front that stops at a corner closes against its neighbour whatever height the
 * neighbour's band has. Closed on the miter line, where the neighbour's own wedge (if any) meets it back to back.
 */
function cornerWedge(b: BuildingTools, ch: {a: [number, number]; b: [number, number]} | {a: number[]; b: number[]}, s: number, sign: 1 | -1, ext: number, y0: number, y1: number, colour: string) {
  const L = Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]), t = [(ch.b[0] - ch.a[0]) / L, (ch.b[1] - ch.a[1]) / L], n = [-t[1], t[0]];
  const C = [ch.a[0] + t[0] * s, ch.a[1] + t[1] * s], Q = [C[0] + n[0] * OFF, C[1] + n[1] * OFF];
  const e = Math.min(ext, 1.2), M = [Q[0] + t[0] * sign * e, Q[1] + t[1] * sign * e];
  const pos: number[] = [];
  const tri = (p: number[][], want: number[]) => {
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const q = c[0] * want[0] + c[1] * want[1] + c[2] * want[2] >= 0 ? p : [p[0], p[2], p[1]];
    for (const r of q) pos.push(...r);
  };
  const out = [n[0], 0, n[1]];
  tri([[Q[0], y0, Q[1]], [M[0], y0, M[1]], [M[0], y1, M[1]]], out);
  tri([[Q[0], y0, Q[1]], [M[0], y1, M[1]], [Q[0], y1, Q[1]]], out);
  tri([[C[0], y1, C[1]], [Q[0], y1, Q[1]], [M[0], y1, M[1]]], [0, 1, 0]);
  if (y0 > 0.05) tri([[C[0], y0, C[1]], [Q[0], y0, Q[1]], [M[0], y0, M[1]]], [0, -1, 0]);
  // the side on the miter line, facing the neighbour's wedge
  const side = [t[0] * sign, 0, t[1] * sign];
  tri([[C[0], y0, C[1]], [M[0], y0, M[1]], [M[0], y1, M[1]]], side);
  tri([[C[0], y0, C[1]], [M[0], y1, M[1]], [C[0], y1, C[1]]], side);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, colour as never);
}

function front(c: Ctx, e: PieceEdge, bd: Band) {
  const {K, b} = c;
  const atStart = bd.s0 < 0.01, atEnd = bd.s1 > e.L - 0.01;
  const t: [number, number] = [(e.chord.b[0] - e.chord.a[0]) / e.L, (e.chord.b[1] - e.chord.a[1]) / e.L];
  const P0: [number, number] = [e.chord.a[0] + t[0] * bd.s0, e.chord.a[1] + t[1] * bd.s0], P1: [number, number] = [e.chord.a[0] + t[0] * bd.s1, e.chord.a[1] + t[1] * bd.s1];
  const cov0 = continued(c, bd, P0, t), cov1 = continued(c, bd, P1, t);
  const nb0 = atStart && !cov0.length ? neighbourBand(c, e, 0) : undefined, nb1 = atEnd && !cov1.length ? neighbourBand(c, e, 1) : undefined;
  const reach = (nb: Band | undefined) => !!nb && nb.bottom <= bd.bottom + 0.1;
  // no miters: the drum and the stepped tops meet at many short facets with different band bottoms, so every band end is capped
  // (concave ends run on to the corner; their end edge rests on the neighbouring wall up to its roof, capped above it)
  void reach; const x0 = 0, x1 = 0;
  const s0 = bd.s0 - x0, s1 = bd.s1 + x1;
  if (s1 - s0 < 0.15) return;
  const y0 = bd.bottom, y1 = bd.top, wall = white(bd) ? 'gold' : 'greyBrick';
  let U: Sec;
  if (y0 < 0.5 && y1 > GROUND_TOP + 2) {
    // two-storey glazed ground floor between dark brick piers, the glass canopy on the Oosterdok side
    const G = K.sec(e.chord, s0, s1, 0, GROUND_TOP, wall);
    const w = s1 - s0, n = Math.max(1, Math.round(w / PIER_BAY)), bay = w / n;
    for (let k = 0; k < n; k++) {
      const s = s0 + bay * (k + 0.5), ow = bay - 0.9;
      if (ow > 1.2) K.opening(G, s, 0.05, ow, GLAZE_H - 0.05, {back: 'glass', frame: 'bronze', cols: Math.max(1, Math.round(ow / 1.4)), bars: [TRANSOM], depth: 0.2, edge: 0.07});
    }
    // the louvred pergola on steel ties over the terrace glazing (depth not measurable on the panoramas: 1.8 m, read from the oblique w08/w16 views)
    if (oosterdok(e.bearing)) slab(b, K.faceFrame(G), (s0 + s1) / 2, CANOPY_Y, w - 0.1, 0.12, 1.8, 'slate');
    U = K.sec(e.chord, s0, s1, GROUND_TOP, y1, wall);
    windows(K, U, b, s0, s1, GROUND_TOP, y1, bd.piece, oosterdok(e.bearing));
  } else {
    U = K.sec(e.chord, s0, s1, y0, y1, wall);
    windows(K, U, b, s0, s1, y0, y1, bd.piece, oosterdok(e.bearing));
  }
  cap(c, e, U, nb0, nb1, x0, x1);
  const n: [number, number] = [-t[1], t[0]];
  /** Over a concave end the neighbouring wall stands across the gap up to its own roof; the cap is needed only above it. */
  const floor = (P: [number, number], sign: number, concave: boolean, atEndHere: boolean) => !concave || !atEndHere ? y0
    : Math.max(y0, roofAt(source.roofs as number[][][], [P[0] - t[0] * sign * 0.15 + n[0] * 0.15, P[1] - t[1] * sign * 0.15 + n[1] * 0.15]) ?? 0);
  // only a near-square concave corner puts the front's end edge on the neighbouring wall; any other angle leaves it free,
  // so it is capped over the whole band (the cap then runs inside the neighbour's massing or behind its front)
  const square = (x: number) => x < 0 && Math.abs(x) > 0.26 && Math.abs(x) < 0.35;
  const f0 = floor(P0, -1, square(e.ext0), atStart), f1 = floor(P1, 1, square(e.ext1), atEnd);
  for (const [u, v] of uncovered(f0, y1, cov0)) if (v - u > 0.05) {
    K.endCap(e.chord, s0, u, v, wall, -1, 0);
    if (atStart && e.ext0 > 0.02) cornerWedge(b, e.chord, s0, -1, e.ext0, u, v, wall);
  }
  for (const [u, v] of uncovered(f1, y1, cov1)) if (v - u > 0.05) {
    K.endCap(e.chord, s1, u, v, wall, 1, 0);
    if (atEnd && e.ext1 > 0.02) cornerWedge(b, e.chord, s1, 1, e.ext1, u, v, wall);
  }
}

/** Thin coping over the face top, reaching back over the gap; at a convex corner shared with another front at the same
 *  height only the front ending at the corner covers the corner square, so the two copings never overlap. */
function cap(c: Ctx, e: PieceEdge, S: Sec, nb0: Band | undefined, nb1: Band | undefined, x0: number, x1: number) {
  const top = S.F.y1, proud = 0.06, back = 0.5, h = 0.18;
  // over an open end the coping runs 4 cm past the return, so its end face never lies within 3 cm of the return's plane
  let s0 = x0 === 0 ? S.s0 - 0.04 : S.s0, s1 = x1 === 0 ? S.s1 + 0.04 : S.s1;
  if (nb1 && x1 > 0 && Math.abs(nb1.top - top) < 0.3) s1 = S.s1 + proud;
  if (nb0 && x0 > 0 && Math.abs(nb0.top - top) < 0.3) s0 = S.s0 + x0 + back;
  if (s1 - s0 > 0.2) c.K.coping(S, top, h, proud, 'slate', s0, s1, back);
}

export function buildDoubletreeCentraal(_w: number, _d: number, b: BuildingTools) {
  massing(b);
  const K = makeFrontKit(b, OFF);
  const edges = pieceFacadeBands(source.roofs as number[][][], {off: OFF, minBand: 2.4, minRun: 0.3, minEdge: 0.2});
  const c: Ctx = {K, b, edges, ends: bandEnds(edges)};
  for (const e of edges) for (const bd of e.bands) front(c, e, bd);
  K.flush();
}
