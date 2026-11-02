import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {upwardRoofPlane} from './house-geometry';
import {Acc, inside, type C} from './tier-kit';
import {glyphRuns} from './mixed-case-glyphs';
import source from './nfta-markenplein-footprints.json';

/**
 * Nederlandse Filmacademie, Markenplein 1 (BAG pand 0363100012170259, bouwjaar 1999, onderwijsfunctie; designed by
 * Koen van Velsen, nl.wikipedia "Nederlandse Filmacademie": "In 1999 verhuisde de academie naar het door Koen van
 * Velsen ontworpen gebouw aan het Markenplein"). Native east/south metres from the BAG vertex average
 * (nfta-markenplein-footprints.json, modern-prepare.mjs), y above local ground (2.25 m NAP).
 *
 * The BAG outline is a parallelogram (62.9 m long fronts on the Mr. Visserplein/SW and Valkenburgerstraat/NE sides,
 * 38.8 m ends, 62.6 deg acute corners at the west and east), one mass to the 3DBAG roof at 19.4 m. Every front is the
 * same system (rectified panorama crops, artifacts/landmark-briefs/nfta-markenplein/):
 *  - a pale fair-faced concrete frame: solid corner piers, slender piers at every bay (17 bays on the long fronts, 11
 *    on the ends; narrower end bays), a top beam and a low plinth;
 *  - green translucent channel glass between the piers in 1.1 m horizontal bands;
 *  - clear ribbon windows placed irregularly per bay at five levels (1.0, 5.0, 8.4, 11.7, 15.0 m), most with a small
 *    white vent grille above; measured per wall in WALLS below.
 * Specials: the open roof terrace in the east corner (above 11.7 m, NE bays 1-5 and SE bays 9-11: the frame stands free
 * and the sky shows through, recording_2025-06-19_06-21-49_00731/00727; a triangle behind a diagonal screen wall under
 * the oversailing roof), the studio glazing in the NW top storey, the louvres in the SE top storey, the "Nederlandse
 * Filmacademie" lettering with the round AHK logo on the SW front (Commons, FaceMePLS 2014; 2021 panorama), the inner
 * courtyard with its glass roof and the solar-panel field on the roof (PDOK orthophoto, 3DBAG hole and planes).
 */
type P2 = [number, number];
type V3 = [number, number, number];
const src = source as unknown as {nativeRing: number[][]};

// BAG corners (native): the ring holds two collinear extra vertices on the NE front; these are its four corners.
const N: P2 = [-11.809, -16.413], W: P2 = [-44.1, 4.955], S: P2 = [10.745, 35.48], E: P2 = [43.036, 14.112];
for (const p of [N, W, S, E]) if (!src.nativeRing.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01)) throw new Error('nfta-markenplein: corner not on the BAG ring');
const CEN: P2 = [(N[0] + W[0] + S[0] + E[0]) / 4, (N[1] + W[1] + S[1] + E[1]) / 4];

const PLINTH = 0.35, BEAM0 = 18.6, TOP = 19.4;
const INFILL_D = -0.25, PIER_W = 0.35, PIER_BACK = -0.4, WIN_D = -0.19;
/** Window levels [bottom, top] in metres above ground, from the rectified crops (all four fronts agree within 0.1 m). */
const LEVELS: Record<'L0' | 'L1' | 'L2' | 'L3' | 'L4', [number, number]> = {L0: [1.0, 1.9], L1: [5.0, 6.1], L2: [8.4, 9.5], L3: [11.7, 12.8], L4: [15.0, 16.1]};
type Level = keyof typeof LEVELS;
/** Lines of the channel-glass bands. */
const TRANSOMS = [1.0, 1.95, 2.9, 3.9, 5.0, 6.1, 7.2, 8.35, 9.45, 10.6, 11.7, 12.8, 13.9, 15.0, 16.1, 17.2];
const TERRACE = 11.7;

type Seg = {y0: number; y1: number; c: C};
interface WallSpec {
  tag: string; L: P2; R: P2; cornerL: number; cornerR: number; bays: number; endBay: number;
  windows: Partial<Record<Level, number[]>>; vents: Partial<Record<Level, number[]>>;
  /** Infill replaced per bay, bottom up (default green channel glass). */
  infill?: Record<number, Seg[]>;
  extra?: {bay: number; y0: number; y1: number; c?: C; mullion?: number}[];
  /** Bays open above TERRACE (the east-corner roof terrace). */
  loggia?: number[];
}
const range = (a: number, b: number) => Array.from({length: b - a + 1}, (_, i) => a + i);
const NW_GROUND: Seg[] = [{y0: PLINTH, y1: 1.1, c: 'glass'}, {y0: 1.1, y1: 4.9, c: 'greyBrick'}];
const WALLS: WallSpec[] = [
  { // w04-327, recording_2025-06-17_08-04-10_03524: viewer-left is the north corner
    tag: 'nw', L: N, R: W, cornerL: 1.9, cornerR: 1.9, bays: 11, endBay: 2.4,
    windows: {L1: [1, 3, 4, 6, 7], L2: [2, 3, 4, 8, 9, 10], L3: [1, 3, 7, 8, 11], L4: [8, 11]},
    vents: {L1: [3, 4, 7], L3: [1, 3, 7, 8, 11]},
    infill: {...Object.fromEntries(range(1, 9).map(b => [b, NW_GROUND])), 10: [{y0: PLINTH, y1: 4.9, c: 'glass'}], 11: [{y0: PLINTH, y1: 4.9, c: 'glass'}]},
    extra: [2, 3, 4].map(bay => ({bay, y0: 14.8, y1: 18.0, mullion: 0.9})),
  },
  { // w01-209, TMX7316010203-002310_pano_0001_001370 (2021) + recording_2025-06-19_06-21-49_00904: viewer-left is the west corner
    tag: 'sw', L: W, R: S, cornerL: 1.5, cornerR: 1.5, bays: 17, endBay: 2.6,
    windows: {L0: [5, 7, 9, 10, 11, 12, 13, 16, 17], L1: [5, 6, 11, 16, 17], L2: [8, 9, 11], L3: [7, 8, 9], L4: [7, 8, 9]},
    vents: {L1: [16], L3: [7, 8, 9], L4: [7, 8]},
    infill: {1: [{y0: PLINTH, y1: 4.9, c: 'glass'}]},
    extra: [{bay: 8, y0: 1.0, y1: 1.9, c: 'dark'}, {bay: 13, y0: 5.0, y1: 6.1, c: 'white', mullion: 0}],
  },
  { // w03-147, TMX7316010203-001665_pano_0000_002037: viewer-left is the south corner
    tag: 'se', L: S, R: E, cornerL: 1.9, cornerR: 1.9, bays: 11, endBay: 2.4,
    windows: {L1: range(3, 11), L2: [6, 7, 8, 9], L3: [1], L4: [1, 3, 4, 5]},
    vents: {L1: range(3, 8), L4: [1, 3, 5]},
    infill: {1: [{y0: PLINTH, y1: 2.4, c: 'dark'}], ...Object.fromEntries(range(2, 11).map(b => [b, [{y0: 0.4, y1: 3.3, c: 'glass'} as Seg]]))},
    extra: [{bay: 1, y0: 3.0, y1: 9.5, mullion: 0.6}, {bay: 3, y0: 10.6, y1: 11.6}],
    loggia: [9, 10, 11],
  },
  { // w02-29, rectified from recording_2025-06-19_06-21-49_00946 (Valkenburgerstraat): viewer-left is the east corner
    tag: 'ne', L: E, R: N, cornerL: 1.5, cornerR: 1.5, bays: 17, endBay: 2.6,
    windows: {L1: [6, 7, 10, 11, 13, 15, 16], L2: [6, 7, 10, 12, 14, 16], L3: [6, 7, 10, 11, 13, 14, 15, 16], L4: [6, 7, 10, 11, 13, 16]},
    vents: {L1: [10, 13, 15, 16], L3: [6, 7, 10, 11, 13, 14, 15, 16], L4: [6, 7, 10, 11, 13, 16]},
    infill: Object.fromEntries(range(8, 16).map(b => [b, [...(b >= 11 && b <= 15 ? [{y0: PLINTH, y1: 3.3, c: 'dark'} as Seg] : []), {y0: 3.3, y1: 5.0, c: 'copper'} as Seg]])),
    loggia: [1, 2, 3, 4, 5],
  },
];

// ---- wall frames -------------------------------------------------------------------------------------------------------
interface Frame { L: P2; len: number; u: P2; n: P2 }
function frameOf(L: P2, R: P2): Frame {
  const len = Math.hypot(R[0] - L[0], R[1] - L[1]), u: P2 = [(R[0] - L[0]) / len, (R[1] - L[1]) / len];
  let n: P2 = [u[1], -u[0]];
  const mid: P2 = [(L[0] + R[0]) / 2 - CEN[0], (L[1] + R[1]) / 2 - CEN[1]];
  if (n[0] * mid[0] + n[1] * mid[1] < 0) n = [-n[0], -n[1]];
  return {L, len, u, n};
}
const at = (f: Frame, s: number, d: number): P2 => [f.L[0] + f.u[0] * s + f.n[0] * d, f.L[1] + f.u[1] * s + f.n[1] * d];
const v3 = (p: P2, y: number): V3 => [p[0], y, p[1]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function tri(acc: Acc, c: C, p: V3, q: V3, r: V3, out: V3) {
  if (dot(cross(sub(q, p), sub(r, p)), out) >= 0) acc.tri(c, p, q, r); else acc.tri(c, p, r, q);
}
function quad(acc: Acc, c: C, a: V3, b: V3, d: V3, e: V3, out: V3) { tri(acc, c, a, b, d, out); tri(acc, c, a, d, e, out); }

/** A face-on rectangle on a wall frame at offset d, facing out. */
function panel(acc: Acc, c: C, f: Frame, s0: number, s1: number, y0: number, y1: number, d: number) {
  const a = at(f, s0, d), b = at(f, s1, d), out: V3 = [f.n[0], 0, f.n[1]];
  quad(acc, c, v3(a, y0), v3(b, y0), v3(b, y1), v3(a, y1), out);
}
/** A box on a wall frame: s0..s1 along, y0..y1 up, d0..d1 out of the wall (d1 the front). Back face only when `back`. */
function wbox(acc: Acc, c: C, f: Frame, s0: number, s1: number, y0: number, y1: number, d0: number, d1: number, o: {back?: boolean; top?: boolean; bottom?: boolean} = {}) {
  const n: V3 = [f.n[0], 0, f.n[1]], u: V3 = [f.u[0], 0, f.u[1]];
  const P = (s: number, y: number, d: number) => v3(at(f, s, d), y);
  quad(acc, c, P(s0, y0, d1), P(s1, y0, d1), P(s1, y1, d1), P(s0, y1, d1), n);
  if (o.back) quad(acc, c, P(s0, y0, d0), P(s1, y0, d0), P(s1, y1, d0), P(s0, y1, d0), [-n[0], 0, -n[2]]);
  quad(acc, c, P(s0, y0, d0), P(s0, y0, d1), P(s0, y1, d1), P(s0, y1, d0), [-u[0], 0, -u[2]]);
  quad(acc, c, P(s1, y0, d0), P(s1, y0, d1), P(s1, y1, d1), P(s1, y1, d0), u);
  if (o.top !== false) quad(acc, c, P(s0, y1, d0), P(s1, y1, d0), P(s1, y1, d1), P(s0, y1, d1), [0, 1, 0]);
  if (o.bottom !== false) quad(acc, c, P(s0, y0, d0), P(s1, y0, d0), P(s1, y0, d1), P(s0, y0, d1), [0, -1, 0]);
}

/** Bay k (1-based) as [s0, s1] between pier faces (or the corner solid). */
function bays(w: WallSpec, f: Frame) {
  const mid = (f.len - w.cornerL - w.cornerR - 2 * w.endBay) / (w.bays - 2);
  const edges = [w.cornerL];
  for (let k = 1; k <= w.bays; k++) edges.push(edges[k - 1] + (k === 1 || k === w.bays ? w.endBay : mid));
  const span = (k: number): [number, number] => [edges[k - 1] + (k === 1 ? 0 : PIER_W / 2), edges[k] - (k === w.bays ? 0 : PIER_W / 2)];
  return {edges, span};
}

/**
 * A ribbon window: a dark glass box 6 cm proud of the channel glass (its sides close onto the infill), head and sill
 * rails and mullions about every `pitch` m standing 5 cm off the glass. Other colours (a louvre) get the box only.
 */
function ribbon(acc: Acc, f: Frame, s0: number, s1: number, y0: number, y1: number, c: C = 'glass', pitch = 0.45) {
  wbox(acc, c, f, s0, s1, y0, y1, INFILL_D, WIN_D);
  if (c !== 'glass') return;
  wbox(acc, 'frame', f, s0, s1, y1 - 0.06, y1, WIN_D, WIN_D + 0.05, {bottom: false});
  wbox(acc, 'frame', f, s0, s1, y0, y0 + 0.06, WIN_D, WIN_D + 0.05, {bottom: false});
  if (!pitch) return;
  const m = Math.max(1, Math.round((s1 - s0) / pitch));
  for (let i = 1; i < m; i++) { const s = s0 + (s1 - s0) * i / m; wbox(acc, 'frame', f, s - 0.025, s + 0.025, y0 + 0.06, y1 - 0.06, WIN_D, WIN_D + 0.05, {top: false, bottom: false}); }
}

// ---- corners ---------------------------------------------------------------------------------------------------------
/** Solid concrete corner pier on the two fronts meeting at `pc`: an L in plan, `ca`/`cb` along each front, 0.4 m deep. */
function cornerPier(acc: Acc, pc: P2, fa: Frame, ca: number, fb: Frame, cb: number) {
  const dirA: P2 = Math.hypot(fa.L[0] - pc[0], fa.L[1] - pc[1]) < 0.01 ? fa.u : [-fa.u[0], -fa.u[1]];
  const dirB: P2 = Math.hypot(fb.L[0] - pc[0], fb.L[1] - pc[1]) < 0.01 ? fb.u : [-fb.u[0], -fb.u[1]];
  const D = -PIER_BACK;
  const a1: P2 = [pc[0] + dirA[0] * ca, pc[1] + dirA[1] * ca], a2: P2 = [a1[0] - fa.n[0] * D, a1[1] - fa.n[1] * D];
  const b1: P2 = [pc[0] + dirB[0] * cb, pc[1] + dirB[1] * cb], b2: P2 = [b1[0] - fb.n[0] * D, b1[1] - fb.n[1] * D];
  // inner corner: the two fronts' lines moved D inward
  const pa: P2 = [pc[0] - fa.n[0] * D, pc[1] - fa.n[1] * D], pb: P2 = [pc[0] - fb.n[0] * D, pc[1] - fb.n[1] * D];
  const det = dirA[0] * -dirB[1] - dirA[1] * -dirB[0];
  const t = ((pb[0] - pa[0]) * -dirB[1] - (pb[1] - pa[1]) * -dirB[0]) / det;
  const x: P2 = [pa[0] + dirA[0] * t, pa[1] + dirA[1] * t];
  const ring: P2[] = [pc, a1, a2, x, b2, b1];
  const area = ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length], e: P2 = [q[0] - p[0], q[1] - p[1]];
    const out: V3 = area > 0 ? [e[1], 0, -e[0]] : [-e[1], 0, e[0]];
    quad(acc, 'concrete', v3(p, PLINTH), v3(q, PLINTH), v3(q, BEAM0), v3(p, BEAM0), out);
  }
}

// ---- the build ---------------------------------------------------------------------------------------------------------
/** Intersection of the lines p + t*u and q + s*v. */
function meet(p: P2, u: P2, q: P2, v: P2): P2 {
  const det = u[0] * -v[1] - u[1] * -v[0];
  const t = ((q[0] - p[0]) * -v[1] - (q[1] - p[1]) * -v[0]) / det;
  return [p[0] + u[0] * t, p[1] + u[1] * t];
}
/**
 * A mitred band round the whole outline (plinth or top beam): outer faces on the fronts, inner faces 0.4 m in, a top
 * and/or a bottom ring. `skip(i)` gives a span [s0, s1] of front i where the bottom ring is left out (the loggia, whose
 * soffit takes over).
 */
function ringBand(acc: Acc, frames: Frame[], y0: number, y1: number, c: C, o: {top: boolean; bottom: boolean; skip?: (i: number) => [number, number] | null}) {
  const n = frames.length, D = -PIER_BACK;
  const inner = frames.map((f, i) => { const g = frames[(i + n - 1) % n]; return meet(at(f, 0, -D), f.u, at(g, 0, -D), g.u); });
  for (let i = 0; i < n; i++) {
    const f = frames[i], o0 = f.L, o1 = frames[(i + 1) % n].L, i0 = inner[i], i1 = inner[(i + 1) % n];
    const out: V3 = [f.n[0], 0, f.n[1]];
    quad(acc, c, v3(o0, y0), v3(o1, y0), v3(o1, y1), v3(o0, y1), out);
    quad(acc, c, v3(i0, y0), v3(i1, y0), v3(i1, y1), v3(i0, y1), [-out[0], 0, -out[2]]);
    if (o.top) quad(acc, c, v3(o0, y1), v3(o1, y1), v3(i1, y1), v3(i0, y1), [0, 1, 0]);
    if (o.bottom) {
      const sp = o.skip?.(i);
      // inner points projected onto the front: s of i0 and i1 along f
      const sAt = (p: P2) => (p[0] - f.L[0]) * f.u[0] + (p[1] - f.L[1]) * f.u[1];
      const piece = (a: number, b2: number) => {
        if (b2 - a < 0.01) return;
        const lerpI = (s: number): P2 => { const t = (s - sAt(i0)) / (sAt(i1) - sAt(i0)); return [i0[0] + (i1[0] - i0[0]) * t, i0[1] + (i1[1] - i0[1]) * t]; };
        const pa = at(f, a, 0), pb = at(f, b2, 0), qa = a <= 0 ? i0 : lerpI(a), qb = b2 >= f.len ? i1 : lerpI(b2);
        quad(acc, c, v3(pa, y0), v3(pb, y0), v3(qb, y0), v3(qa, y0), [0, -1, 0]);
      };
      if (!sp) piece(0, f.len); else { piece(0, sp[0]); piece(sp[1], f.len); }
    }
  }
}

export function buildNftaMarkenplein(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  const frames = WALLS.map(w => frameOf(w.L, w.R));
  const byTag = Object.fromEntries(WALLS.map((w, i) => [w.tag, {w, f: frames[i]}]));
  const {nw, sw, se, ne} = byTag;
  const neEnd = bays(ne.w, ne.f).edges[5], seStart = bays(se.w, se.f).edges[8];

  // plinth (its top carries the piers and the infill) and the top beam (its bottom closes them; the roof owns its top)
  ringBand(acc, frames, 0, PLINTH, 'concrete', {top: true, bottom: false});
  ringBand(acc, frames, BEAM0, TOP, 'concrete', {top: false, bottom: true, skip: i => WALLS[i].tag === 'ne' ? [0, neEnd] : WALLS[i].tag === 'se' ? [seStart, frames[i].len] : null});

  WALLS.forEach((w, wi) => {
    const f = frames[wi], {edges, span} = bays(w, f);
    // piers between bays: boxes, closed at the back where they stand free in front of the loggia
    for (let k = 1; k < w.bays; k++) {
      const s = edges[k], free = w.loggia?.includes(k) || w.loggia?.includes(k + 1);
      wbox(acc, 'concrete', f, s - PIER_W / 2, s + PIER_W / 2, PLINTH, BEAM0, PIER_BACK, 0, {back: !!free, top: false, bottom: false});
    }
    const covered = (k: number, y: number) =>
      (Object.entries(w.windows) as [Level, number[]][]).some(([lv, l]) => l.includes(k) && y > LEVELS[lv][0] - 0.05 && y < LEVELS[lv][1] + 0.05) ||
      (Object.entries(w.vents) as [Level, number[]][]).some(([lv, l]) => l.includes(k) && y > LEVELS[lv][1] && y < LEVELS[lv][1] + 0.55) ||
      (w.extra ?? []).some(x => x.bay === k && y > x.y0 - 0.05 && y < x.y1 + 0.05) ||
      (w.tag === 'se' && (k === 7 || k === 8) && y > 14.65 && y < 17.75);
    // infill per bay, bottom up
    for (let k = 1; k <= w.bays; k++) {
      const [s0, s1] = span(k), loggia = w.loggia?.includes(k), top = loggia ? TERRACE - 0.2 : BEAM0;
      const segs = [...(w.infill?.[k] ?? [])].sort((p, q) => p.y0 - q.y0);
      let y = PLINTH;
      for (const g of segs) { if (g.y0 > y) panel(acc, 'green', f, s0, s1, y, g.y0, INFILL_D); panel(acc, g.c, f, s0, s1, g.y0, Math.min(g.y1, top), INFILL_D); y = g.y1; }
      if (y < top) panel(acc, 'green', f, s0, s1, y, top, INFILL_D);
      // channel-glass band lines, 6 cm proud, broken where a window, vent or louvre stands in front
      for (const t of TRANSOMS) if (t < top - 0.1 && !covered(k, t) && !segs.some(g => g.c !== 'green' && g.c !== 'glass' && t > g.y0 && t < g.y1)) wbox(acc, 'frame', f, s0, s1, t - 0.025, t + 0.025, INFILL_D, INFILL_D + 0.06, {bottom: false});
      if (loggia) {
        // terrace slab edge flush with the pier fronts, and the railing between the free piers
        wbox(acc, 'concrete', f, s0, s1, TERRACE - 0.2, TERRACE, PIER_BACK, 0, {top: false});
        wbox(acc, 'frame', f, s0, s1, TERRACE + 1.0, TERRACE + 1.06, -0.24, -0.18, {back: true});
        for (const s of [s0 + 0.04, (s0 + s1) / 2 - 0.02, s1 - 0.08]) wbox(acc, 'frame', f, s, s + 0.04, TERRACE, TERRACE + 1.0, -0.23, -0.19, {back: true, top: false, bottom: false});
      }
    }
    // windows and vents
    for (const [lv, list] of Object.entries(w.windows) as [Level, number[]][]) {
      const [y0, y1] = LEVELS[lv];
      for (const k of list) { const [s0, s1] = span(k); ribbon(acc, f, s0 + 0.2, s1 - 0.2, y0, y1); }
    }
    for (const [lv, list] of Object.entries(w.vents) as [Level, number[]][]) {
      const y = LEVELS[lv][1] + 0.12;
      for (const k of list) { const [s0, s1] = span(k), m = (s0 + s1) / 2; wbox(acc, 'white', f, m - 0.32, m + 0.32, y, y + 0.36, INFILL_D, WIN_D, {bottom: true}); }
    }
    for (const x of w.extra ?? []) {
      const [s0, s1] = span(x.bay);
      ribbon(acc, f, s0 + 0.2, s1 - 0.2, x.y0, x.y1, x.c ?? 'glass', x.mullion ?? 0.45);
      if (x.c === 'white') for (let y = x.y0 + 0.12; y < x.y1 - 0.05; y += 0.18) wbox(acc, 'frame', f, s0 + 0.25, s1 - 0.25, y, y + 0.04, WIN_D, WIN_D + 0.06, {bottom: false});
    }
    if (w.tag === 'nw') for (const k of [2, 3, 4]) { const [s0, s1] = span(k); wbox(acc, 'frame', f, s0 + 0.2, s1 - 0.2, 16.4, 16.48, WIN_D, WIN_D + 0.05); }
    if (w.tag === 'se') {
      // top-storey louvres in bays 7-8: slatted panels instead of channel glass
      for (const k of [7, 8]) {
        const [s0, s1] = span(k);
        wbox(acc, 'bronze', f, s0, s1, 14.7, 17.7, INFILL_D, WIN_D);
        for (let y = 14.8; y < 17.65; y += 0.2) wbox(acc, 'bronze', f, s0, s1, y, y + 0.05, WIN_D, WIN_D + 0.07);
      }
      // goods entrance at the south corner: air grille on the corner pier
      for (let y = 0.6; y < 4.0; y += 0.22) wbox(acc, 'frame', f, 0.25, w.cornerL - 0.25, y, y + 0.06, 0, 0.06);
    }
  });

  // corner piers (BAG corners N, W, S, E)
  cornerPier(acc, N, nw.f, nw.w.cornerL, ne.f, ne.w.cornerR);
  cornerPier(acc, W, nw.f, nw.w.cornerR, sw.f, sw.w.cornerL);
  cornerPier(acc, S, sw.f, sw.w.cornerR, se.f, se.w.cornerL);
  cornerPier(acc, E, se.f, se.w.cornerR, ne.f, ne.w.cornerL);

  // ---- the east-corner roof terrace: open behind the free frame, a diagonal screen wall, the roof's soffit -------------
  {
    const pNe = at(ne.f, neEnd, 0), pSe = at(se.f, seStart, 0), dn = at(ne.f, neEnd, PIER_BACK), ds = at(se.f, seStart, PIER_BACK);
    const pent: P2[] = [E, pNe, dn, ds, pSe];
    for (let i = 1; i + 1 < pent.length; i++) {
      tri(acc, 'stone', v3(pent[0], TERRACE), v3(pent[i], TERRACE), v3(pent[i + 1], TERRACE), [0, 1, 0]);
      tri(acc, 'concrete', v3(pent[0], BEAM0), v3(pent[i], BEAM0), v3(pent[i + 1], BEAM0), [0, -1, 0]);
    }
    const outward: V3 = [E[0] - (dn[0] + ds[0]) / 2, 0, E[1] - (dn[1] + ds[1]) / 2];
    quad(acc, 'glass', v3(dn, TERRACE), v3(ds, TERRACE), v3(ds, BEAM0), v3(dn, BEAM0), outward);
    // grey slatted screens in front of the glass (recording_2025-06-19_06-21-49_00731) above a handrail
    const dl = Math.hypot(ds[0] - dn[0], ds[1] - dn[1]), ol = Math.hypot(outward[0], outward[2]);
    const df: Frame = {L: dn, len: dl, u: [(ds[0] - dn[0]) / dl, (ds[1] - dn[1]) / dl], n: [outward[0] / ol, outward[2] / ol]};
    for (let s = 0.4; s < dl - 0.3; s += 0.32) wbox(acc, 'bronze', df, s, s + 0.08, TERRACE + 1.1, BEAM0, 0, 0.3, {top: false});
    wbox(acc, 'frame', df, 0.1, dl - 0.1, TERRACE + 1.0, TERRACE + 1.08, 0, 0.4);
  }

  // ---- roof: membrane with the courtyard hole, solar-panel rows, the courtyard -------------------------------------------
  // Courtyard: rectangle fitted to the 3DBAG hole in the 19.4 m roof (planes 14.3-16.8 m inside) and the PDOK orthophoto.
  const C1: P2 = [-0.9, -0.1], ca: P2 = [0.897, 0.442], cb: P2 = [-0.442, 0.897], CA = 22.85, CB = 15.4;
  const cpt = (a: number, bb: number): P2 => [C1[0] + ca[0] * a + cb[0] * bb, C1[1] + ca[1] * a + cb[1] * bb];
  const court: P2[] = [cpt(0, 0), cpt(CA, 0), cpt(CA, CB), cpt(0, CB)];
  {
    const shape = new T.Shape([N, W, S, E].map(([x, z]) => new T.Vector2(x, z)));
    shape.holes.push(new T.Path(court.map(([x, z]) => new T.Vector2(x, z))));
    b.add(upwardRoofPlane(shape, TOP), 'slate');
  }
  const COURT_FLOOR = 14.6, GLASS_A = 16.5, GLASS_TOP = 16.8;
  {
    // inner walls, facing into the courtyard: channel glass with one ribbon of windows
    const cc = cpt(CA / 2, CB / 2);
    for (let i = 0; i < 4; i++) {
      const p = court[i], q = court[(i + 1) % 4], mid: P2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const inward: V3 = [cc[0] - mid[0], 0, cc[1] - mid[1]];
      quad(acc, 'green', v3(p, COURT_FLOOR), v3(q, COURT_FLOOR), v3(q, TOP), v3(p, TOP), inward);
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]), il = Math.hypot(inward[0], inward[2]);
      const cf: Frame = {L: p, len: l, u: [(q[0] - p[0]) / l, (q[1] - p[1]) / l], n: [inward[0] / il, inward[2] / il]};
      wbox(acc, 'glass', cf, 0.8, l - 0.8, 17.3, 18.4, 0, 0.06);
    }
    // terrace (the orthophoto shows a paved terrace) and the pitched glass roof on its south-east end
    b.add(upwardRoofPlane(new T.Shape(court.map(([x, z]) => new T.Vector2(x, z))), COURT_FLOOR), 'stone');
    const g0 = cpt(GLASS_A, 1.5), g1 = cpt(CA, 1.5), g2 = cpt(CA, CB), g3 = cpt(GLASS_A, CB);
    quad(acc, 'canopyGlass', v3(g0, COURT_FLOOR + 0.15), v3(g1, GLASS_TOP), v3(g2, GLASS_TOP), v3(g3, COURT_FLOOR + 0.15), [0, 1, 0]);
    const side: V3 = [-cb[0], 0, -cb[1]];
    tri(acc, 'canopyGlass', v3(g0, COURT_FLOOR), v3(g1, COURT_FLOOR), v3(g1, GLASS_TOP), side);
    tri(acc, 'canopyGlass', v3(g0, COURT_FLOOR), v3(g0, COURT_FLOOR + 0.15), v3(g1, GLASS_TOP), side);
    quad(acc, 'canopyGlass', v3(g0, COURT_FLOOR), v3(g3, COURT_FLOOR), v3(g3, COURT_FLOOR + 0.15), v3(g0, COURT_FLOOR + 0.15), [-ca[0], 0, -ca[1]]);
    // glazing bars across the pitch, 6 cm above the glass
    for (let a = GLASS_A + 1.2; a < CA - 0.3; a += 1.2) {
      const y = COURT_FLOOR + 0.15 + (GLASS_TOP - COURT_FLOOR - 0.15) * (a - GLASS_A) / (CA - GLASS_A) + 0.06;
      const p0 = cpt(a, 1.5), p1 = cpt(a, CB), q1 = cpt(a + 0.06, CB), q0 = cpt(a + 0.06, 1.5);
      quad(acc, 'frame', v3(p0, y), v3(p1, y), v3(q1, y), v3(q0, y), [0, 1, 0]);
    }
  }
  {
    // solar panels: rows along the long fronts, 1.6 m deep with 0.5 m gaps, about 1.4 m in from the fronts and clear
    // of the courtyard (orthophoto: the roof is almost entirely covered)
    const lenS = Math.hypot(S[0] - W[0], S[1] - W[1]), vl = Math.hypot(N[0] - W[0], N[1] - W[1]);
    const uS: P2 = [(S[0] - W[0]) / lenS, (S[1] - W[1]) / lenS], vN: P2 = [(N[0] - W[0]) / vl, (N[1] - W[1]) / vl];
    const sinA = Math.abs(uS[0] * vN[1] - uS[1] * vN[0]);
    const P = (s: number, r: number): P2 => [W[0] + uS[0] * s + vN[0] * r, W[1] + uS[1] * s + vN[1] * r];
    const cc = cpt(CA / 2, CB / 2), big = court.map(p => [cc[0] + (p[0] - cc[0]) * 1.12, cc[1] + (p[1] - cc[1]) * 1.18] as P2);
    const y1 = TOP + 0.22;
    for (let r = 1.4 / sinA; r + 1.6 / sinA < vl - 1.4 / sinA; r += 2.1 / sinA) {
      const r1 = r + 1.6 / sinA, s0 = 1.4 / sinA + 0.5, s1 = lenS - 1.4 / sinA - 0.5;
      const ok = (s: number) => [P(s, r), P(s, r1)].every(p => !inside(p, big));
      let start: number | null = null;
      for (let s = s0; s <= s1 + 1e-6; s += 0.5) {
        const good = ok(s) && ok(Math.min(s + 0.5, s1));
        if (good && start === null) start = s;
        if ((!good || s + 0.5 > s1) && start !== null) {
          const end = good ? s1 : s - 0.2;
          if (end - start > 2) {
            const a = P(start, r), bb = P(end, r), c = P(end, r1), d = P(start, r1), mid: P2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
            quad(acc, 'blue', v3(a, y1), v3(bb, y1), v3(c, y1), v3(d, y1), [0, 1, 0]);
            for (const [p, q] of [[a, bb], [bb, c], [c, d], [d, a]] as [P2, P2][]) quad(acc, 'blue', v3(p, TOP), v3(q, TOP), v3(q, y1), v3(p, y1), [(p[0] + q[0]) / 2 - mid[0], 0, (p[1] + q[1]) / 2 - mid[1]]);
          }
          start = null;
        }
      }
    }
  }

  // ---- lettering and logo on the SW front, bays 1-6 at 9.7-10.7 m (Commons FaceMePLS 2014; 2021 panorama) ------------
  {
    const f = sw.f, px = 0.13, base = 9.75, t0 = 4.25, front = INFILL_D + 0.06;
    for (const r of glyphRuns('Nederlandse Filmacademie', px).runs) wbox(acc, 'white', f, t0 + r.t0, t0 + r.t1, base + r.y0, base + r.y1, INFILL_D, front);
    // the round logo: a white disc 6 cm proud with a purple half 6 cm in front of it, 16 segments, rim back to the glass
    const cx = 2.85, cy = base + 3.5 * px, R = 0.95, K = 16, nOut: V3 = [f.n[0], 0, f.n[1]];
    const P = (a: number, rr: number, d: number) => v3(at(f, cx + Math.cos(a) * rr, d), cy + Math.sin(a) * rr);
    for (let i = 0; i < K; i++) {
      const a0 = i / K * Math.PI * 2, a1 = (i + 1) / K * Math.PI * 2, am = (a0 + a1) / 2;
      tri(acc, 'white', v3(at(f, cx, front), cy), P(a0, R, front), P(a1, R, front), nOut);
      quad(acc, 'white', P(a0, R, INFILL_D), P(a1, R, INFILL_D), P(a1, R, front), P(a0, R, front), [Math.cos(am) * f.u[0], Math.sin(am), Math.cos(am) * f.u[1]]);
      if (a0 >= Math.PI / 2 - 1e-9 && a1 <= Math.PI * 1.5 + 1e-9) {
        const d = front + 0.06;
        tri(acc, 'pink', v3(at(f, cx, d), cy), P(a0, R * 0.9, d), P(a1, R * 0.9, d), nOut);
        quad(acc, 'pink', P(a0, R * 0.9, front), P(a1, R * 0.9, front), P(a1, R * 0.9, d), P(a0, R * 0.9, d), [Math.cos(am) * f.u[0], Math.sin(am), Math.cos(am) * f.u[1]]);
      }
    }
    // the straight edge of the purple half
    const top = P(Math.PI / 2, R * 0.9, front), bot = P(Math.PI * 1.5, R * 0.9, front), dtop = P(Math.PI / 2, R * 0.9, front + 0.06), dbot = P(Math.PI * 1.5, R * 0.9, front + 0.06);
    quad(acc, 'pink', bot, top, dtop, dbot, [f.u[0], 0, f.u[1]]);
  }
  acc.flush();
}
