import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, slab} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {pieceFacadeBands, roofAt, type Band, type PieceEdge} from './ring-height-runs';
import {makeFrontKit, type FrontKit, type Sec} from './street-front-kit';
import source from './weteringschans-corner-office-footprints.json';

/**
 * Het Noortse Bosch, BAG pand 0363100012184747 (bouwjaar 1981, CC0): Vijzelgracht 46-58 and Nieuwe Weteringstraat 24-46,
 * the office block on the corner of the Vijzelgracht and the Lijnbaansgracht by architectenbureau Cornelis Wegener
 * Sleeswijk, built for the Amsterdamse Assurantie Beurs and now the Autoriteit Financiële Markten (nl.wikipedia: Lijst van
 * gebouwen aan de Vijzelgracht; Vijzelgracht (Amsterdam)). The catalogue id keeps the brief's name; the block is not on the
 * Weteringschans.
 *
 * What the Gemeente Amsterdam panoramas show (CC BY 4.0, artifacts/landmark-briefs/weteringschans-corner-office/): a
 * stepped block of dark brown brick, five to seven storeys of narrow white-framed windows at a 1.76 m pitch with a grey
 * lintel over each, set back over a glazed ground storey of grey piers under a concrete edge band; along the Lijnbaansgracht
 * the ground storey is a one-storey glazed hall with a concrete parapet over the water; patinated copper roof caps.
 *
 * Native frame of the footprints file (x east, z south, y up from the 0.77 m NAP street). Massing: a closed prism under every
 * 3DBAG LoD2.2 roof piece (CC BY 4.0). Every exposed wall band of every piece (ring-height-runs.ts pieceFacadeBands) gets a
 * cut front 0.3 m outside it with the measured storey grid.
 */
const OFF = 0.3;
// measured on the w04-102 crop and scaled by 1.13 so its 19.7 m eaves meet the 3DBAG 22.3 m roof of the same front
const PITCH = 2.0, WIN_W = 1.42, WIN_H = 2.1, STOREY = 3.34, FIRST_SILL = 5.3;
const GROUND_TOP = 4.9, PIER_BAY = 7.5;
/** Foot of the step between the tall Vijzelgracht block and the lower north wing, where the copper stair strip stands. */
const STAIR: [number, number] | null = [60.1, -2.5];

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
    roofPrism(b, r as number[][][], 'brick', Math.max(...ys) - Math.min(...ys) > 0.6 ? 'copper' : 'concrete');
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

function windows(K: FrontKit, S: Sec, b: BuildingTools, from: number, to: number, y0: number, y1: number, piece = -1) {
  const others = source.roofs.filter((_, i) => i !== piece) as number[][][];
  const t = [(S.ch.b[0] - S.ch.a[0]) / Math.hypot(S.ch.b[0] - S.ch.a[0], S.ch.b[1] - S.ch.a[1]), (S.ch.b[1] - S.ch.a[1]) / Math.hypot(S.ch.b[0] - S.ch.a[0], S.ch.b[1] - S.ch.a[1])];
  /** Highest roof outside the front over a window's width: a sloped lower roof (the copper caps) must stay under the sill. */
  const floorAt = (s: number) => Math.max(0, ...[-0.7, 0, 0.7].flatMap(d => [0.1, 0.6].map(o => roofAt(others, [S.ch.a[0] + t[0] * (s + d) - t[1] * o, S.ch.a[1] + t[1] * (s + d) + t[0] * o]) ?? 0)));
  const len = to - from, n = Math.floor((len - 0.2) / PITCH + 1e-6);   // end piers as narrow as the photo: 0.4 m past the last frame
  if (n < 1) return;
  const f = K.faceFrame(S), first = (from + to) / 2 - ((n - 1) * PITCH) / 2;
  for (let y = FIRST_SILL; y + WIN_H <= y1 - 0.55; y += STOREY) {
    if (y < y0 + 0.35) continue;
    for (let k = 0; k < n; k++) {
      const s = first + k * PITCH;
      if (y < floorAt(s) + 0.3) continue;
      K.opening(S, s, y, WIN_W, WIN_H, {cols: 2, frame: 'white', depth: 0.18});
      ledgeStrip(b, f, s, y + WIN_H + 0.04, WIN_W + 0.16, 0.26, 0.04, 'slate');       // grey lintel over each window
    }
  }
}

function front(c: Ctx, e: PieceEdge, bd: Band) {
  const {K, b} = c;
  const atStart = bd.s0 < 0.01, atEnd = bd.s1 > e.L - 0.01;
  const t: [number, number] = [(e.chord.b[0] - e.chord.a[0]) / e.L, (e.chord.b[1] - e.chord.a[1]) / e.L];
  const P0: [number, number] = [e.chord.a[0] + t[0] * bd.s0, e.chord.a[1] + t[1] * bd.s0], P1: [number, number] = [e.chord.a[0] + t[0] * bd.s1, e.chord.a[1] + t[1] * bd.s1];
  const cov0 = continued(c, bd, P0, t), cov1 = continued(c, bd, P1, t);
  // a front continued on the same line by another piece's front never reaches past the shared point
  const nb0 = atStart && !cov0.length ? neighbourBand(c, e, 0) : undefined, nb1 = atEnd && !cov1.length ? neighbourBand(c, e, 1) : undefined;
  // miters: stop short at concave corners, reach the neighbour's face at convex ones that carry a front from the same foot
  const reach = (nb: Band | undefined) => !!nb && nb.bottom <= bd.bottom + 0.1;
  const x0 = atStart && (e.ext0 < 0 || reach(nb0)) ? e.ext0 : 0, x1 = atEnd && (e.ext1 < 0 || reach(nb1)) ? e.ext1 : 0;
  const s0 = bd.s0 - x0, s1 = bd.s1 + x1;
  if (s1 - s0 < 0.8) return;
  const y0 = bd.bottom, y1 = bd.top;
  const ground = y0 < 0.5;
  const hall = ground && y1 < 7.5;                      // the one-storey glazed hall on the Lijnbaansgracht
  if (ground) {
    const gTop = hall ? Math.max(2.6, y1 - 1.5) : GROUND_TOP;
    const G = K.sec(e.chord, s0, s1, 0, gTop, 'concrete');
    const w = s1 - s0, n = Math.max(1, Math.round(w / PIER_BAY)), bay = w / n;
    for (let k = 0; k < n; k++) {
      const s = s0 + bay * (k + 0.5), ow = bay - 0.45;
      if (ow > 1.2) K.opening(G, s, 0.05, ow, gTop - 0.75, {back: 'glass', frame: 'dark', cols: Math.max(1, Math.round(ow / 1.2)), depth: hall ? 0.5 : 1.2, edge: 0.06});
    }
    const U = K.sec(e.chord, s0, s1, gTop, y1, hall ? 'concrete' : 'brick');
    const near = (s: number) => !!STAIR && Math.hypot(e.chord.a[0] + (e.chord.b[0] - e.chord.a[0]) * s / e.L - STAIR[0], e.chord.a[1] + (e.chord.b[1] - e.chord.a[1]) * s / e.L - STAIR[1]) < 0.5;
    const stairAfter = near(bd.s1) && y1 > 20, stairBefore = near(bd.s0) && y1 < 20;
    if (!hall) windows(K, U, b, stairBefore ? s0 + 1.6 : s0, s1, gTop, y1, bd.piece);
    // the copper-clad stair strip just past the tall Vijzelgracht block, in front of the lower north wing (w04-102), up to the
    // 3DBAG cap over it
    if (stairAfter) slab(b, K.faceFrame(U, 0.02), s1 + 0.72, gTop, 1.4, 25.4 - gTop, 0.6, 'copper');
    cap(c, e, U, nb0, nb1, x0, x1);
  } else {
    const U = K.sec(e.chord, s0, s1, y0, y1, 'brick');
    windows(K, U, b, s0, s1, y0, y1, bd.piece);
    cap(c, e, U, nb0, nb1, x0, x1);
  }
  // open ends: a return from the chord to the face over the heights no continuing or meeting front covers
  if (!(x0 !== 0)) for (const [u, v] of uncovered(y0, y1, cov0)) K.endCap(e.chord, s0, u, v, 'brick', -1, 0);
  if (!(x1 !== 0)) for (const [u, v] of uncovered(y0, y1, cov1)) K.endCap(e.chord, s1, u, v, 'brick', 1, 0);
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

export function buildWeteringschansCornerOffice(_w: number, _d: number, b: BuildingTools) {
  massing(b);
  const K = makeFrontKit(b, OFF);
  const edges = pieceFacadeBands(source.roofs as number[][][], {off: OFF, minBand: 2.4, minRun: 1.6});
  const c: Ctx = {K, b, edges, ends: bandEnds(edges)};
  for (const e of edges) for (const bd of e.bands) front(c, e, bd);
  K.flush();
}
