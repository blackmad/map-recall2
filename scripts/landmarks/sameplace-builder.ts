import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {ledgeStrip, letters, poly, ringSlab, setSink, slab} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {archFillOutline, frameAt, makeFrontKit, type Chord, type FrontKit, type Sec} from './street-front-kit';
import source from './sameplace-footprints.json' with {type: 'json'};

/**
 * Sameplace, Nassaukade 120 on the corner of the Tweede Hugo de Grootstraat (BAG pand 0363100012156534, bouwjaar
 * 1889; the café has been here since 1997, sameplace.nl). An 1889 corner block of the Nassaukade row: three storeys
 * of orange-red brick over a timber shopfront, white bands (speklagen) at every sill, transom and springing,
 * segmental-arched windows with white arch rings and keystones on the first and second floors, flat white lintels on
 * the third, French balconies with iron rails, a white entablature with festoon panels and a dentil cornice, and a
 * slate mansard with pedimented dormers. The corner is cut off by a 1.95 m chamfer with a balcony on every floor and
 * the café door under its "CAFE SAMEPLACE" board.
 *
 * Read from the Gemeente Amsterdam panoramas (CC BY 4.0) via face-crops.ts (40 px/m): Nassaukade front
 * recording_2024-09-11_07-28-02_01946 (sunlit) and b_20241121_0951_Track22_Sphere_00430 (brief), corner
 * recording_2024-09-11_07-28-02_01942, Tweede Hugo de Grootstraat recording_2025-06-17_11-17-15_01488 and
 * TMX7316010203-002055_pano_0000_001938 (2021). Every item and its plan is in sameplace-inventory.json.
 *
 * Native frame of sameplace-footprints.json (x east, z south, y up from the 0.957 m NAP pavement). Massing: the BAG
 * ring minus the rear annex (3DBAG piece 2, 4.6-5.0 m) as a block under the main cornice, a mansard swept along the
 * three street faces with mitred corners (roofs from the front, not 3DBAG), the flat roof behind it at the 3DBAG
 * 18.3 m, and the annex as its own prism under its 3DBAG roof.
 */
type C = 'brick' | 'white' | 'frame' | 'glass' | 'dark' | 'slate' | 'stone' | 'blue' | 'gold' | 'bronze' | 'ochre' | 'pink' | 'concrete';
// white is window trim (an opening material for the audit); the dormers are rendered stucco ('ochre', same white tint), the sign letters 'pink' (cream)
type XZ = [number, number];
const SRC = source as unknown as {nativeRing: XZ[]; roofs: Record<string, number[][][]>};
const RING = SRC.nativeRing;
const ROOFS = SRC.roofs['0363100012156534'];
const OFF = 0.22;

// ---- street chords (outward normal n = (-tz, tx)); s runs from a -----------------------------------------------------
const E: Chord = {a: RING[1], b: RING[2]};    // Nassaukade, 10.18 m, s from the party wall with Nassaukade 118
const CH: Chord = {a: RING[2], b: RING[3]};   // the chamfered corner, 1.95 m
const N: Chord = {a: RING[3], b: RING[16]};   // Tweede Hugo de Grootstraat, 8.91 m through the pier faces
const len = (ch: Chord) => Math.hypot(ch.b[0] - ch.a[0], ch.b[1] - ch.a[1]);
const tan = (ch: Chord): XZ => [(ch.b[0] - ch.a[0]) / len(ch), (ch.b[1] - ch.a[1]) / len(ch)];
const nrm = (ch: Chord): XZ => { const t = tan(ch); return [-t[1], t[0]]; };
const at = (ch: Chord, s: number, o = 0): XZ => { const t = tan(ch), n = nrm(ch); return [ch.a[0] + t[0] * s + n[0] * o, ch.a[1] + t[1] * s + n[1] * o]; };
/** Where the lines `o` outside chords A and B meet: [s on A, s on B]. */
function meet(A: Chord, B: Chord, o: number): [number, number] {
  const p = at(A, 0, o), q = at(B, 0, o), u = tan(A), v = tan(B);
  const den = u[0] * v[1] - u[1] * v[0];
  const sA = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
  const sB = ((q[0] - p[0]) * u[1] - (q[1] - p[1]) * u[0]) / den;
  return [sA, sB];
}
const [E1, C0] = meet(E, CH, OFF), [C1, N0] = meet(CH, N, OFF);
const LN = len(N);

// ---- measured heights (m above the pavement; crops 40 px/m, pavement at 0.3 m in the crop) -----------------------------
const BASE = -0.3;
const SHOP_TOP = 4.3;
const STOREYS = [{y0: 5.0, y1: 7.45, arch: true}, {y0: 8.25, y1: 10.6, arch: true}, {y0: 11.45, y1: 13.5, arch: false}];
const RISE = 0.22;          // segmental heads of the first and second floor
const WIN_W = 1.08;
const BRICK_TOP = 14.1;     // white entablature above
const CORNICE = [15.75, 16.15];
const CLAMP = 16.1;         // roof of the strip under the mansard
const MANS_TOP = 18.3;      // 3DBAG flat roof behind the mansard
const MANS_IN = -1.6;       // mansard top edge, behind the chord

// window axes per face (s along the chord), read off the rectified crops
const AX_E = [1.28, 2.84, 4.4, 7.26, 9.16];
const AX_N = [1.65, 3.5, 5.35, 7.25];
const BLIND_N = new Set([1.65, 3.5]);            // painted-out windows nearest the corner
const BALC_E = new Set([2.84]);                  // French balconies on every floor of axis 2

type Ctx = {K: FrontKit; b: BuildingTools};
const ff = (c: Ctx, S: Sec, proud = 0) => c.K.faceFrame(S, proud);

/** Segments of [s0, s1] clear of the given opening intervals (each widened by `pad`). */
function clear(s0: number, s1: number, holes: [number, number][], pad: number): [number, number][] {
  const out: [number, number][] = [];
  let cur = s0;
  for (const [a, b] of [...holes].sort((x, y) => x[0] - y[0])) {
    if (a - pad > cur + 0.02) out.push([cur, a - pad]);
    cur = Math.max(cur, b + pad);
  }
  if (s1 > cur + 0.02) out.push([cur, s1]);
  return out;
}
/** White band (speklaag) across the piers of a section, stopping at the windows. */
function band(c: Ctx, S: Sec, y: number, h: number, holes: [number, number][], d = 0.05, col: C = 'white') {
  for (const [a, b] of clear(S.s0, S.s1, holes, 0.1)) ledgeStrip(c.b, ff(c, S), (a + b) / 2, y, b - a, h, d, col);
}
/** French balcony: a slab floor on the sill and a rail of bars, 0.42 m out of the wall. */
function balcony(c: Ctx, S: Sec, s: number, y: number, w: number) {
  const f = ff(c, S), D = 0.42;
  slab(c.b, f, s, y + 0.035, w, 0.1, D, 'bronze');   // floor top at y + 0.135: clear of the sill top (y + 0.05) and the frame's sill rail (y + 0.10), so the two tops never share a plane
  ledgeStrip(c.b, f, s, y + 0.9, w, 0.04, D + 0.02, 'bronze');
  for (let k = 0; k <= 8; k++) ledgeStrip(c.b, f, s - w / 2 + 0.02 + (w - 0.04) * k / 8, y, 0.02, 0.9, 0.02, 'bronze', D - 0.02);
  // open sides: a top rail back to the wall and one post at the wall, no side plates
  for (const sg of [-1, 1]) {
    slab(c.b, f, s + sg * (w / 2 - 0.015), y + 0.9, 0.03, 0.04, D, 'bronze');
    slab(c.b, f, s + sg * (w / 2 - 0.015), y, 0.03, 0.9, 0.03, 'bronze', 0.06);
  }
}
/** One upper-storey window with its white sill, arch ring or lintel, and keystone. */
function window1(c: Ctx, S: Sec, s: number, st: typeof STOREYS[number], w = WIN_W, blind = false) {
  const {K} = c, h = st.y1 - st.y0, f = ff(c, S);
  if (blind) K.opening(S, s, st.y0, w, h, {back: 'white', edge: 0, depth: 0.08, ...(st.arch ? {rise: RISE} : {})});
  else K.opening(S, s, st.y0, w, h, {cols: 1, frame: 'frame', depth: 0.16, bars: [h * 0.68], edge: 0.07, ...(st.arch ? {rise: RISE} : {})});
  slab(c.b, f, s, st.y0 - 0.04, w + 0.16, 0.09, 0.1, 'white');   // sill top 5 cm up the reveal, clear of its brick floor
  if (st.arch) {
    K.archHead(S, s, st.y1 - RISE, w, RISE, 0.17, 0.06, 'white');
    if (w >= WIN_W) slab(c.b, f, s, st.y1 - 0.02, 0.2, 0.32, 0.09, 'white');   // keystone (the narrow corner lights have none)
  } else {
    slab(c.b, f, s, st.y1 + 0.02, w + 0.2, 0.18, 0.06, 'white');
    slab(c.b, f, s, st.y1 + 0.02, 0.2, 0.3, 0.09, 'white');
  }
}
/** The three brick storeys of one face: windows, bands, balconies. */
/** `hide`: [s0, s1] of the first floor covered by the billboard, where no window, trim or band is drawn (it would be buried). */
function storeys(c: Ctx, ch: Chord, s0: number, s1: number, axes: number[], opt: {w?: number; blind?: Set<number>; balc?: Set<number>; hide?: [number, number]} = {}) {
  const S = c.K.sec(ch, s0, s1, SHOP_TOP, BRICK_TOP, 'brick');
  const w = opt.w ?? WIN_W, holes: [number, number][] = axes.map(a => [a - w / 2, a + w / 2]);
  STOREYS.forEach((st, i) => {
    const hide = i === 0 && opt.hide ? [opt.hide] : [];
    const shown = axes.filter(a => !hide.some(([p, q]) => a > p && a < q));
    for (const a of shown) window1(c, S, a, st, w, opt.blind?.has(a));
    const h = st.y1 - st.y0, hs = [...holes, ...hide];
    band(c, S, st.y0 - 0.2, 0.14, hs);
    band(c, S, st.y0 + h * 0.68 - 0.06, 0.14, hs);
    band(c, S, (st.arch ? st.y1 - RISE : st.y1) - 0.14, 0.14, hs);
    band(c, S, st.y1 + 0.42, 0.12, []);
    for (const a of shown) if (opt.balc?.has(a)) balcony(c, S, a, st.y0, w + 0.3);
  });
  band(c, S, SHOP_TOP + 0.3, 0.12, []);
  return S;
}
/** White entablature over the brick: architrave, frieze with a festoon panel over every axis, dentil band, cornice. */
function entablature(c: Ctx, ch: Chord, s0: number, s1: number, axes: number[], lift: number) {
  const {K} = c, S = K.sec(ch, s0, s1, BRICK_TOP, CORNICE[0], 'white'), f = ff(c, S);
  ledgeStrip(c.b, f, (s0 + s1) / 2, BRICK_TOP, s1 - s0, 0.22, 0.08, 'white');
  for (const a of axes) {
    slab(c.b, f, a, 14.55, 1.2, 0.6, 0.05, 'white');
    poly(c.b, f, a, 14.68, [[-0.4, 0.3], [-0.2, 0.08], [0, 0.0], [0.2, 0.08], [0.4, 0.3], [0.3, 0.3], [0.15, 0.17], [0, 0.12], [-0.15, 0.17], [-0.3, 0.3]], 0.09, 'white');
  }
  ledgeStrip(c.b, f, (s0 + s1) / 2, 15.38, s1 - s0, 0.14, 0.13, 'white');
  K.coping(S, CORNICE[0], CORNICE[1] - CORNICE[0] + lift, 0.45, 'white', s0 - 0.45, s1 + 0.45);
}

// ---- ground floor: timber shopfronts --------------------------------------------------------------------------------
function shopEast(c: Ctx) {
  const {K} = c, S = K.sec(E, 0, E1, BASE, SHOP_TOP, 'dark'), f = ff(c, S);
  K.opening(S, 0.65, 0, 0.8, 2.15, {cols: 1, frame: 'dark', back: 'dark', depth: 0.12, edge: 0.06});          // house door
  K.opening(S, 2.71, 0.65, 2.92, 1.62, {cols: 1, frame: 'dark', depth: 0.16, edge: 0.08});                    // café window
  K.opening(S, 4.75, 0, 0.75, 2.2, {cols: 1, frame: 'dark', depth: 0.14, bars: [1.5], edge: 0.06});           // café door
  K.opening(S, 6.39, 0, 0.8, 2.15, {cols: 1, frame: 'dark', back: 'dark', depth: 0.12, edge: 0.06});          // Sameplace door
  K.opening(S, 6.39, 2.3, 0.8, 0.32, {cols: 1, frame: 'dark', depth: 0.12, edge: 0.05});                      // its fanlight
  K.opening(S, 8.21, 0.62, 2.42, 2.03, {back: 'blue', edge: 0, depth: 0.1});                                   // the blue boarded window
  K.opening(S, 2.71, 2.83, 5.05, 1.07, {cols: 6, rows: 3, frame: 'dark', depth: 0.12, edge: 0.06});           // clerestory grids
  K.opening(S, 7.8, 2.8, 3.55, 1.08, {cols: 4, rows: 3, frame: 'dark', depth: 0.12, edge: 0.06});
  // black stone plinth under the piers, and the café awning box over the left shop
  for (const [a, b] of [[5.2, 5.97], [9.45, E1]]) slab(c.b, f, (a + b) / 2, BASE, b - a, 1.1 - BASE, 0.06, 'stone');
  slab(c.b, f, 2.7, 2.32, 5.35, 0.4, 0.32, 'bronze');
  ledgeStrip(c.b, f, 2.7, 2.72, 5.35, 0.06, 0.34, 'frame');
  sameplaceLogo(c, S, 8.21, 1.3, 0.1);
  ledgeStrip(c.b, f, (S.s0 + S.s1) / 2, SHOP_TOP - 0.12, S.s1 - S.s0, 0.12, 0.12, 'dark');
}
function shopCorner(c: Ctx) {
  const {K} = c, S = K.sec(CH, C0, C1, BASE, SHOP_TOP, 'dark'), f = ff(c, S), m = (C0 + C1) / 2;
  K.opening(S, m, 0, 0.95, 2.25, {cols: 1, frame: 'dark', back: 'dark', depth: 0.12, edge: 0.06});
  K.opening(S, m, 3.2, 1.6, 0.95, {cols: 2, rows: 3, frame: 'dark', depth: 0.12, edge: 0.06});
  // the "CAFE SAMEPLACE" board over the corner door: brown board, cream capitals
  slab(c.b, f, m, 2.35, 1.82, 0.72, 0.08, 'dark');
  letters(c.b, f, 'CAFE', m, 2.76, 0.08, 0.034, 0.05, 'pink');
  letters(c.b, f, 'SAMEPLACE', m, 2.43, 0.08, 0.031, 0.05, 'pink');
  ledgeStrip(c.b, f, m, SHOP_TOP - 0.12, S.s1 - S.s0, 0.12, 0.12, 'dark');
}
function shopNorth(c: Ctx) {
  const {K} = c, S = K.sec(N, N0, LN, BASE, SHOP_TOP, 'dark'), f = ff(c, S);
  // three timber bays between brick piers (BAG ring: bays 0.1 m behind the pier faces)
  const bays: [number, number][] = [[0.72, 2.56], [3.48, 5.32], [6.24, 8.24]];
  for (const [a, b] of bays) K.opening(S, (a + b) / 2, 2.85, b - a - 0.1, 1.05, {cols: 4, rows: 3, frame: 'dark', depth: 0.12, edge: 0.06});
  K.opening(S, 1.64, 0.6, 1.7, 2.05, {back: 'blue', edge: 0, depth: 0.1});
  K.opening(S, 4.4, 0.6, 1.7, 2.05, {back: 'blue', edge: 0, depth: 0.1});
  K.opening(S, 6.8, 0, 0.9, 2.3, {cols: 1, frame: 'dark', back: 'dark', depth: 0.12, edge: 0.06});
  K.opening(S, 7.78, 0.6, 0.8, 1.7, {cols: 1, frame: 'dark', depth: 0.14, edge: 0.06});
  for (const s of [1.64, 4.4]) sameplaceLogo(c, S, s, 1.3, 0.1);
  for (const [a, b] of [[N0, 0.72], [2.56, 3.48], [5.32, 6.24], [8.24, LN]]) slab(c.b, f, (a + b) / 2, BASE, b - a, 1.0 - BASE, 0.06, 'stone');
  ledgeStrip(c.b, f, (S.s0 + S.s1) / 2, SHOP_TOP - 0.12, S.s1 - S.s0, 0.12, 0.12, 'dark');
}
/** Sameplace's mark on the blue boards: an orange ring with a cross under it and the name, on the recessed board. */
function sameplaceLogo(c: Ctx, S: Sec, s: number, y: number, depth: number) {
  const f = ff(c, S, -depth);
  ringSlab(c.b, f, s, y + 0.55, 0.07, 0.11, 0.05, 'gold', 0, 12);
  slab(c.b, f, s, y + 0.25, 0.03, 0.2, 0.05, 'gold');
  slab(c.b, f, s, y + 0.33, 0.12, 0.03, 0.05, 'gold');
  letters(c.b, f, 'SAMEPLACE', s, y, 0, 0.022, 0.05, 'gold');
}

// ---- roof: massing, mansard, dormers ----------------------------------------------------------------------------------
type Poly = [number, number][][];
const strip = (ch: Chord, s0: number, s1: number, oOut: number, oIn: number): Poly => [[at(ch, s0, oOut), at(ch, s1, oOut), at(ch, s1, oIn), at(ch, s0, oIn), at(ch, s0, oOut)]];
const lift = (b: BuildingTools, mp: ReturnType<typeof polygonClipping.union>, y: number, wall: C, roof: C) => {
  for (const pg of mp) roofPrism(b, pg.map(r => r.slice(0, -1).map(([x, z]) => [x, y, z])), wall, roof);
};
function massing(b: BuildingTools) {
  const ring: Poly = [[...RING, RING[0]]];
  // the 3DBAG annex piece hugs the BAG rear edge to a few cm: scale it 6 % about its centre and clip it to the ring, so
  // the main block and the annex share one boundary instead of leaving slivers with coplanar walls along the rear
  const annex = ROOFS[2], cx = annex.reduce((t, p) => t + p[0], 0) / annex.length, cz = annex.reduce((t, p) => t + p[2], 0) / annex.length;
  const grown: Poly = [[...annex.map(p => [cx + (p[0] - cx) * 1.06, cz + (p[2] - cz) * 1.06] as XZ), [cx + (annex[0][0] - cx) * 1.06, cz + (annex[0][2] - cz) * 1.06]]];
  const annexPart = polygonClipping.intersection(ring, grown);
  lift(b, annexPart, 4.8, 'brick', 'slate');
  const main = polygonClipping.difference(ring, grown);
  const cut = polygonClipping.union(strip(E, -2, len(E) + 2, 1, MANS_IN), strip(CH, -2, len(CH) + 2, 1, MANS_IN), strip(N, -2, LN + 2, 1, MANS_IN));
  lift(b, polygonClipping.intersection(main, cut), CLAMP, 'brick', 'slate');
  lift(b, polygonClipping.difference(main, cut), MANS_TOP, 'brick', 'slate');
}
/** Slate mansard swept along the three street faces with mitred corners, from the cornice top to the flat roof. */
function mansard(b: BuildingTools) {
  const fronts = [E, CH, N];
  const line = (o: number): XZ[] => {
    const pts: XZ[] = [at(E, 0, o)];
    for (let i = 0; i + 1 < fronts.length; i++) { const [sA] = meet(fronts[i], fronts[i + 1], o); pts.push(at(fronts[i], sA, o)); }
    pts.push(at(N, LN, o));
    return pts;
  };
  const lo = line(0.12), hi = line(MANS_IN), y0 = CORNICE[1] + 0.02, y1 = MANS_TOP;
  const pos: number[] = [];
  const tri = (a: number[], c: number[], d: number[], want: number[]) => {
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0) pos.push(...a, ...c, ...d); else pos.push(...a, ...d, ...c);
  };
  for (let i = 0; i + 1 < lo.length; i++) {
    const A = [lo[i][0], y0, lo[i][1]], B = [lo[i + 1][0], y0, lo[i + 1][1]], Ct = [hi[i + 1][0], y1, hi[i + 1][1]], D = [hi[i][0], y1, hi[i][1]];
    const n = nrm(fronts[i]), want = [n[0], 1.2, n[1]];
    tri(A, B, Ct, want); tri(A, Ct, D, want);
  }
  // end triangles against the party walls (facing along the chord, away from the building)
  const capE = tan(E), capN = tan(N);
  tri([lo[0][0], y0, lo[0][1]], [hi[0][0], y1, hi[0][1]], [hi[0][0], y0, hi[0][1]], [-capE[0], 0, -capE[1]]);
  const L = lo.length - 1;
  tri([lo[L][0], y0, lo[L][1]], [hi[L][0], y1, hi[L][1]], [hi[L][0], y0, hi[L][1]], [capN[0], 0, capN[1]]);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  b.add(g, 'slate');
}
/** Dormer standing in the mansard over an axis: white cheeks and pilasters, a two-light window, a segmental pediment. */
function dormer(c: Ctx, ch: Chord, s: number) {
  const y = CORNICE[1] + 0.08, w = 1.7, h = 1.55, f = frameAt(ch, 0, 0.32), depth = 2.0;   // front stands on the cornice, in front of the mansard foot (o = 0.12)
  // the dormer's foot clears the cornice top by 8 cm (geometryAudit FOOT_CLEARS_M), on a lead-grey sill block
  slab(c.b, f, s, CORNICE[1] - 0.03, w + 0.04, 0.12, depth + 0.02, 'slate', -depth);
  slab(c.b, f, s, y, w, h, depth, 'ochre', -depth);
  slab(c.b, f, s, y + 0.25, 1.0, 1.05, 0.08, 'glass', 0.0);
  ledgeStrip(c.b, f, s, y + 0.25, 0.06, 1.05, 0.12, 'frame');
  for (const sg of [-1, 1]) slab(c.b, f, s + sg * 0.68, y, 0.24, h, 0.1, 'ochre');
  // entablature and segmental pediment
  slab(c.b, f, s, y + h, w + 0.2, 0.18, depth + 0.12, 'ochre', -depth);
  poly(c.b, f, s, y + h + 0.18, archFillOutline(w + 0.2, 0.5, 10), depth + 0.12, 'ochre', -depth);
  slab(c.b, f, s, y + h + 0.3, 0.5, 0.22, 0.1, 'ochre', 0.12);
}

export function buildSameplace(_w: number, _d: number, b: BuildingTools) {
  setSink(0.04, true);
  try {
    massing(b);
    mansard(b);
    const K = makeFrontKit(b, OFF);
    const c: Ctx = {K, b};
    // Nassaukade
    shopEast(c);
    storeys(c, E, 0, E1, AX_E, {balc: BALC_E});
    entablature(c, E, 0, E1, AX_E, 0);
    slab(b, frameAt(E, 0, OFF), 5.8, BRICK_TOP, 0.42, CORNICE[0] - BRICK_TOP, 0.13, 'white');   // console pair over the downpipe
    // corner
    shopCorner(c);
    const m = (C0 + C1) / 2;
    const Sc = storeys(c, CH, C0, C1, [m], {w: 0.95});
    for (const st of STOREYS) balcony(c, Sc, m, st.y0, 1.25);
    entablature(c, CH, C0, C1, [], 0.04);
    // Tweede Hugo de Grootstraat
    shopNorth(c);
    storeys(c, N, N0, LN, AX_N, {blind: BLIND_N, hide: [0.92, 4.22]});
    entablature(c, N, N0, LN, AX_N, 0);
    // the billboard over the two blind windows of the first floor (its posters change; the board stays)
    const fN = frameAt(N, 0, OFF);
    slab(b, fN, 2.57, 5.15, 3.3, 2.7, 0.14, 'bronze');
    slab(b, fN, 2.57, 5.25, 3.1, 2.5, 0.24, 'concrete');
    // party-wall ends of the fronts
    K.endCap(E, 0.1, BASE, CORNICE[1], 'brick', -1, -0.4);   // 10 cm in: the party wall is within 2 deg of square
    K.endCap(N, LN - 0.1, BASE, CORNICE[1], 'brick', 1, -0.4);
    for (const s of [2.84, 9.16]) dormer(c, E, s);
    dormer(c, N, 5.35);
    K.flush();
  } finally {
    setSink(0);
  }
}
