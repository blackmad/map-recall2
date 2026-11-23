import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planarPolygon, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, letters, poly, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {speklagen, type BandOpening} from '../../src/canalRecall/landmarks/speklagen';
import {arcGlyphPlacements} from '../../src/canalRecall/landmarks/arcLettering';
import {arcFrame, bayAngles, domeProfile} from '../../src/canalRecall/landmarks/roundTower';
import source from './koningsplein-1-footprints.json';

/**
 * KONINGSPLEIN 1 (BAG pand 0363100012176247, rijksmonument 518359): shop and offices on the corner of the Koningsplein and
 * the Singel, 1890-91, neo-baroque, by Th.G. Schill and D.H. Haverkamp for the Verzekeringsbank 'Kosmos'; tower crown
 * altered 1928, shop front by H. Elte 1929-30. Every part below is from the RCE register text (quoted in
 * scripts/landmarks/koningsplein-1-brief.md) and the Gemeente Amsterdam panoramas (CC BY 4.0) listed in the inventory.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts) for the hipped roof, its glazed strip on the
 * Koningsplein side and the party walls. The 3DBAG's faceted corner blob (walls to 23.8 m, the dome as roof planes) is
 * replaced by a drawn round tower: centre (0.167, 0.503), radius 2.32 m (least-squares fit to the 18 BAG vertices of the
 * corner, max residual 0.06 m), free arc -33..-145 deg (plan angle atan2(z, x)).
 *
 * Heights (m above the 3DBAG ground) from plane rectifications at 40 px/m of b_20250109_1300_Track05_Sphere_00277 (2025,
 * Koningsplein, 16.7 m), recording_2025-06-19_03-28-47_01535 (2025, the tower, 13.5 m) and _01537 (2025, the Singel side),
 * fitted on the 3DBAG cornice wall top (17.5 m; measured 17.35-17.45); the tower's upper parts corrected for their
 * distance behind the rectification plane:
 *   shop 0-4.4 | stone frieze 4.4-5.0 | first storey 5.05-7.45 | consoles + balconies 7.7-8.9 | French windows 9.0-11.7 |
 *   pediments 11.75-12.9 in the painted frieze 12.0-13.3 | cordon 13.3-13.55 | paired round-arched windows 13.65-15.3 |
 *   light-blue frieze with consoles 15.55-16.55 | cornice 16.55-17.45 | drum 17.45-20.95 | dome 20.95-25.0 | lantern, spire.
 * Bays (rectified Koningsplein front, t from the tower): axes at 2.4 and 6.3 of 8.65 m; the Singel front's one axis at
 * 2.28 of 4.17 m (t from its south end).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
type V = [number, number];

const C: V = [0.167, 0.503];
const R = 2.32;                  // tower body (BAG fit)
const RS = 2.4;                  // tower skin, 8 cm proud of the BAG facets so none shows through
const A0 = -33 * Math.PI / 180;  // NE end of the free arc
const A1 = -145 * Math.PI / 180; // NW end
const AC = (A0 + A1) / 2;        // faces north
const RD = 2.2;                  // drum (3DBAG drum walls 2.0-2.3 m from the centre)
const CORNICE = 17.45;

const Y = {
  shop: 4.4, frieze: [4.4, 4.9], f1: [5.05, 7.45], f1Transom: 6.85, console: [7.7, 8.65], balcony: [8.65, 8.9], rail: 1.0,
  f2: [9.0, 11.7], entab: [11.75, 12.0], pedTop: 12.9, paint: [12.0, 13.3], cordon: [13.3, 13.55], f3: [13.65, 15.3],
  blue: [15.55, 16.55], cornice: [16.55, CORNICE],
} as const;

const NW = ringFrame(src.facadeRing, 7); // Koningsplein, 8.65 m
const NE = ringFrame(src.facadeRing, 0); // Singel, 4.17 m

let b: BuildingTools;

export function buildKoningsplein1(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  shell();
  const sink0 = getSink();
  setSink(0.04);
  front(NW.f, NW.len, [2.4, 6.3], {reliefs: [0.6, 4.35, 8.05], entrance: true});
  front(NE.f, NE.len, [2.28], {reliefs: [], entrance: false});
  dormer();
  setSink(sink0);
  tower();
}

// ---------------------------------------------------------------------------------------------------------------- shell

/** Clip a planar ring to y <= yMax (Sutherland-Hodgman on one plane). */
function clipBelow(ring: number[][], yMax: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const pin = p[1] <= yMax, qin = q[1] <= yMax;
    if (pin) out.push(p);
    if (pin !== qin) { const k = (yMax - p[1]) / (q[1] - p[1]); out.push([p[0] + (q[0] - p[0]) * k, yMax, p[2] + (q[2] - p[2]) * k]); }
  }
  return out;
}
const distC = (r: number[][]) => { const x = r.reduce((s, p) => s + p[0], 0) / r.length, z = r.reduce((s, p) => s + p[2], 0) / r.length; return Math.hypot(x - C[0], z - C[1]); };

/**
 * The 3DBAG shell without its corner blob: walls whose centroid lies within 2.45 m of the tower centre are the faceted tower
 * and drum (drawn by tower()); the ground-to-roof walls 2.45-3.2 m out (the junction facets beside the tower and the
 * Singel front's north segment, which 3DBAG carries up to 23.3 m) stop at the cornice; roof planes within 2.6 m are the
 * dome. The steep walls at 17.5-20 m behind the Koningsplein cornice are the register's "strook vensterglas".
 */
function shell() {
  src.surfaces.forEach(s => {
    if (s.type === 'GroundSurface') return;
    const r = s.rings[0], d = distC(r), ys = r.map(p => p[1]);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (s.type === 'RoofSurface') {
      if (d < 2.6) return;
      const g = planarPolygon(s.rings);
      if (!g) return;
      upward(g);
      b.add(g, 'slate' as never);
      return;
    }
    if (d < 2.45) return;
    let rings = s.rings;
    if (d < 3.2 && y0 < 17) rings = [clipBelow(r, CORNICE)];
    if (rings[0].length < 3) return;
    const g = planarPolygon(rings);
    if (!g) return;
    const glazed = y0 > 17.3 && y1 < 20.1 && inFrontBand(r);
    // the Singel front's 3DBAG wall runs on above the cornice as the vertical stand-in for its slate hip roof
    const slateAbove = y0 < 1 && y1 > CORNICE + 0.5 && onFace(r, NE.f);
    if (slateAbove) {
      const lo = planarPolygon([clipBelow(r, CORNICE)]);
      const hi = planarPolygon([clipBelow(r.map(p => [p[0], -p[1], p[2]]), -CORNICE).map(p => [p[0], -p[1], p[2]])]);
      if (lo) b.add(lo, 'brick' as never);
      if (hi) b.add(hi, 'slate' as never);
      return;
    }
    b.add(g, (glazed ? 'copper' : y0 > 17.3 ? 'slate' : 'brick') as never);
  });
  // roof collar round the back half of the drum, closing the 3DBAG roof's hole for its wider blob
  ringBand(RD - 0.02, 3.0, 20.3, 20.38, 0.05, Math.PI - 0.05, 'slate');
}
function onFace(r: number[][], f: Frame) {
  return r.every(p => Math.abs((p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]) < 0.25);
}
/** Within 3 m behind the Koningsplein front. */
function inFrontBand(r: number[][]) {
  const f = NW.f;
  return r.every(p => { const o = (p[0] - f.origin[0]) * f.n[0] + (p[2] - f.origin[1]) * f.n[1]; return o < 0.2 && o > -3.2; });
}
function upward(g: T.BufferGeometry) {
  const pos = g.getAttribute('position'), idx = g.getIndex();
  if (!idx) return;
  const A = new T.Vector3(), B = new T.Vector3(), Cc = new T.Vector3();
  for (let k = 0; k < idx.count; k += 3) {
    A.fromBufferAttribute(pos, idx.getX(k)); B.fromBufferAttribute(pos, idx.getX(k + 1)); Cc.fromBufferAttribute(pos, idx.getX(k + 2));
    if (B.sub(A).cross(Cc.sub(A)).y < 0) { const t = idx.getX(k + 1); idx.setX(k + 1, idx.getX(k + 2)); idx.setX(k + 2, t); }
  }
  g.computeVertexNormals();
}

// ----------------------------------------------------------------------------------------------------- curved primitives

const geom = (pos: number[]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
const P = (r: number, a: number, y: number) => [C[0] + r * Math.cos(a), y, C[1] + r * Math.sin(a)];
const segsFor = (a0: number, a1: number, n = 40) => Math.max(2, Math.ceil(Math.abs(a1 - a0) / (2 * Math.PI) * n));

/** Vertical strip of the circle r between angles a0 and a1, facing out (or in with `inward`). */
function arcStrip(r: number, y0: number, y1: number, a0: number, a1: number, col: string, inward = false, n = 40) {
  const m = segsFor(a0, a1, n), pos: number[] = [];
  for (let i = 0; i < m; i++) {
    const u = a0 + (a1 - a0) * i / m, v = a0 + (a1 - a0) * (i + 1) / m;
    const p0 = P(r, u, y0), p1 = P(r, v, y0), p2 = P(r, v, y1), p3 = P(r, u, y1);
    // outward normal for increasing angle in (x, z) with y up: p0, p3, p2 / p0, p2, p1
    const tri = (a1 > a0) !== inward ? [p0, p3, p2, p0, p2, p1] : [p0, p1, p2, p0, p2, p3];
    for (const p of tri) pos.push(...p);
  }
  b.add(geom(pos), col as never);
}
/**
 * The tower skin as a polygon through explicit angle stations (decreasing, left to right from outside), every vertex on the
 * circle r: a flat facet spans each window bay so the windows sit on a plane, curved runs between them.
 */
function facetStrip(r: number, y0: number, y1: number, stations: number[], col: string) {
  const pos: number[] = [];
  for (let i = 0; i + 1 < stations.length; i++) {
    const u = stations[i], v = stations[i + 1];
    const p0 = P(r, u, y0), p1 = P(r, v, y0), p2 = P(r, v, y1), p3 = P(r, u, y1);
    for (const p of (v > u ? [p0, p3, p2, p0, p2, p1] : [p0, p1, p2, p0, p2, p3])) pos.push(...p);
  }
  b.add(geom(pos), col as never);
}
/** Stations from a0 down to a1: arcs of at most `step` rad, and one straight facet [a + d, a - d] per bay angle. */
function bayStations(a0: number, a1: number, bays: number[], d: number, step = 0.15): number[] {
  const out: number[] = [a0];
  const run = (from: number, to: number) => { const m = Math.max(1, Math.ceil((from - to) / step)); for (let k = 1; k <= m; k++) out.push(from - (from - to) * k / m); };
  let a = a0;
  for (const c of bays) { run(a, c + d); out.push(c - d); a = c - d; }
  run(a, a1);
  return out;
}
/** Flat annulus r0..r1 at height y between angles, facing up (or down). */
function annulus(r0: number, r1: number, y: number, a0: number, a1: number, col: string, down = false) {
  const m = segsFor(a0, a1), pos: number[] = [];
  for (let i = 0; i < m; i++) {
    const u = a0 + (a1 - a0) * i / m, v = a0 + (a1 - a0) * (i + 1) / m;
    const p0 = P(r0, u, y), p1 = P(r1, u, y), p2 = P(r1, v, y), p3 = P(r0, v, y);
    const tri = (a1 > a0) !== down ? [p0, p2, p1, p0, p3, p2] : [p0, p1, p2, p0, p2, p3];
    for (const p of tri) pos.push(...p);
  }
  b.add(geom(pos), col as never);
}
/** A projecting ring course: outer face at r1, top and bottom from r0. */
function ringBand(r0: number, r1: number, y0: number, y1: number, a0: number, a1: number, col: string) {
  arcStrip(r1, y0, y1, a0, a1, col);
  annulus(r0, r1, y1, a0, a1, col);
  annulus(r0, r1, y0, a0, a1, col, true);
}
const TA0 = A0 + 0.22, TA1 = A1 - 0.22; // the tower skin runs a little past the free arc into the junctions

// ---------------------------------------------------------------------------------------------------------------- fronts

type FrontOpts = {reliefs: number[]; entrance: boolean};

/** One flat front (Koningsplein or Singel), t from the viewer's left; `axes` are the window axes. */
function front(F: Frame, L: number, axes: number[], o: FrontOpts) {
  const S = 0.0; // the brick is the 3DBAG wall itself
  // --- shop front (1929-30, H. Elte): black Swedish granite, shop windows with heavy transoms, clerestories of vertical
  // matte-glass strips, granito mosaic tableaux between them (register; Sphere_00277: clerestory 2.25-3.6 m)
  // The granite skin (0.16 m proud) is cut round the recesses; glass, transom, mullions and mosaic stand in them, set back.
  const GR = 0.16;
  const shop: [number, number][] = o.entrance ? [[0.75, 5.35]] : [[0.45, 3.55]];
  const recess: BandOpening[] = shop.map(([t0, t1]) => ({t0, t1, y0: 0.35, y1: Y.shop - 0.12}));
  if (o.entrance) recess.push({t0: 6.0, t1: 7.1, y0: 2.28, y1: 3.6}, {t0: 7.35, t1: 8.35, y0: 0, y1: 4.2});
  else recess.push({t0: 3.58, t1: 4.12, y0: 2.28, y1: 3.6});
  for (const r of speklagen({t0: 0.05, t1: L - 0.05, bands: [{y: 0, h: 0.35}, {y: 0.35, h: Y.shop - 0.35}], openings: recess, minRun: 0.04})) {
    slab(b, F, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, GR, 'bronze', S);
  }
  // granite over and under the recesses (the cut runs leave them open top and bottom)
  for (const q of recess) {
    if (q.y0 > 0.36) slab(b, F, (q.t0 + q.t1) / 2, 0.35, q.t1 - q.t0, q.y0 - 0.35, GR, 'bronze', S);
    if (q.y1 < Y.shop - 0.01) slab(b, F, (q.t0 + q.t1) / 2, q.y1, q.t1 - q.t0, Y.shop - q.y1, GR, 'bronze', S);
  }
  for (const [t0, t1] of shop) {
    const w = t1 - t0, tc = (t0 + t1) / 2;
    slab(b, F, tc, 0.35, w, 1.65, 0.03, 'glass', 0.05);
    slab(b, F, tc, 2.0, w, 0.28, 0.07, 'bronze', 0.05);                     // heavy transom
    slab(b, F, tc, 2.28, w, 1.32, 0.03, 'glass', 0.05);                     // clerestory
    const n = Math.round(w / 0.32);
    for (let k = 1; k < n; k++) slab(b, F, t0 + k * w / n, 2.28, 0.04, 1.32, 0.04, 'bronze', 0.09);
    slab(b, F, tc, 3.6, w, Y.shop - 0.12 - 3.6, 0.04, 'pink', 0.05);         // mosaic tableau above
  }
  if (o.entrance) {
    // side entrance in a portico in the outer bay (register): wooden door with a narrow window, white field above
    slab(b, F, 7.85, 0, 1.0, 2.5, 0.08, 'ochre', 0.0);
    slab(b, F, 7.85, 0.9, 0.16, 1.3, 0.04, 'glass', 0.08);
    slab(b, F, 7.85, 2.6, 1.0, 1.6, 0.04, 'concrete', 0.0);
    for (const k of [-0.25, 0, 0.25]) slab(b, F, 7.85 + k, 2.6, 0.03, 1.6, 0.03, 'red', 0.04);
    slab(b, F, 6.55, 2.28, 1.1, 1.32, 0.04, 'pink', 0.05);
  } else {
    slab(b, F, 3.85, 2.28, 0.54, 1.32, 0.04, 'pink', 0.05);
  }
  // --- stone frieze over the shop front
  slab(b, F, L / 2, Y.frieze[0], L - 0.1, Y.frieze[1] - Y.frieze[0], 0.16, 'stone', S);

  // --- openings
  const W1 = 1.5, W2 = 1.38, W3 = 0.6, PAIR = 0.92;
  const holes: BandOpening[] = [];
  for (const a of axes) {
    holes.push({t0: a - W1 / 2 - 0.18, t1: a + W1 / 2 + 0.18, y0: Y.f1[0] - 0.15, y1: Y.balcony[1]});
    holes.push({t0: a - W2 / 2 - 0.2, t1: a + W2 / 2 + 0.2, y0: Y.f2[0], y1: Y.paint[1]});
  }
  // speklagen: sandstone courses through the red brick (register "roodkleurige baksteen voorzien van natuurstenen speklagen";
  // rectified 2022 crop: a course every ~0.7 m, ~0.14 m tall), stopped at the window surrounds and at the end strips
  const bands = [] as {y: number; h: number}[];
  for (let y = 5.3; y < 11.9; y += 0.7) if (!(y < Y.balcony[1] + 0.05 && y + 0.14 > Y.console[0])) bands.push({y, h: 0.14});
  for (const r of speklagen({t0: 0.35, t1: L - 0.35, bands, openings: holes})) slab(b, F, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.04, 'stone', S);
  // stone end strips (quoins) from the frieze to the cordon
  for (const t of [0.2, L - 0.2]) slab(b, F, t, Y.frieze[1], 0.34, Y.paint[0] - Y.frieze[1], 0.06, 'stone', S);

  for (const a of axes) {
    // first storey: sash with transom light in a stone surround (register "schuifraam en bovenlicht", "natuurstenen omlijsting")
    sash(F, a, Y.f1[0], Y.f1[1], W1, Y.f1Transom);
    surround(F, a, Y.f1[0], Y.f1[1], W1, 0.18);
    // the frieze over it: a stone medallion with garlands between a console at each corner; the consoles carry the balcony
    disc(b, F, a, (Y.console[0] + Y.console[1]) / 2, 0.24, 0.08, 'stone', 0.0);
    slab(b, F, a, (Y.console[0] + Y.console[1]) / 2 - 0.04, 0.9, 0.08, 0.05, 'stone', 0.0);
    for (const s of [-1, 1]) consoleBlock(F, a + s * (W1 / 2 + 0.1), Y.console[0], Y.console[1], 0.6);
    // balcony with an iron railing (not original, per the register)
    const bw = W1 + 0.9, bd = 0.62;
    slab(b, F, a, Y.balcony[0], bw, Y.balcony[1] - Y.balcony[0], bd, 'stone', 0.0);
    railing(F, a, bw - 0.1, bd - 0.06, Y.balcony[1]);
    // second storey: fenetre-a-terre in a stone surround under an entablature and a triangular pediment (fronton)
    sash(F, a, Y.f2[0], Y.f2[1], W2, 11.0);
    surround(F, a, Y.f2[0], Y.f2[1], W2, 0.2);
    slab(b, F, a, Y.entab[0], W2 + 0.7, Y.entab[1] - Y.entab[0], 0.2, 'stone', 0.0);
    const pw = W2 + 0.8, rise = Y.pedTop - Y.entab[1];
    poly(b, F, a, Y.entab[1], [[-pw / 2, 0], [pw / 2, 0], [0, rise]], 0.14, 'stone', 0.0);
    poly(b, F, a, Y.entab[1] + 0.1, [[-pw / 2 + 0.25, 0], [pw / 2 - 0.25, 0], [0, rise - 0.22]], 0.04, 'brick', 0.14);
    // third storey: two round-headed windows coupled (a pair per axis), stone arches
    for (const s of [-1, 1]) arched(F, a + s * PAIR / 2, Y.f3[0], Y.f3[1], W3, 0.12);
  }
  // painted stencil frieze between the cordon bands (the pediments break through it)
  for (const r of speklagen({t0: 0.05, t1: L - 0.05, bands: [{y: Y.paint[0] + 0.02, h: Y.paint[1] - Y.paint[0] - 0.02}], openings: axes.map(a => ({t0: a - (W2 + 0.8) / 2, t1: a + (W2 + 0.8) / 2, y0: Y.entab[1], y1: Y.pedTop}))})) {
    slab(b, F, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'red', 0.0);
  }
  slab(b, F, L / 2, Y.cordon[0], L - 0.1, Y.cordon[1] - Y.cordon[0], 0.24, 'stone', 0.0);
  // third storey: brick, stone Ionic pilasters at the corners and between the pairs, stencilled relief panels between them
  slab(b, F, L / 2, Y.f3[1] + 0.05, L - 0.1, 0.12, 0.05, 'stone', 0.0); // impost course over the arches
  const pil = [0.2, L - 0.2, ...axes.flatMap(a => [a - PAIR / 2 - W3 / 2 - 0.25, a + PAIR / 2 + W3 / 2 + 0.25])];
  for (const t of pil) { slab(b, F, t, Y.cordon[1], 0.3, Y.blue[0] - Y.cordon[1], 0.1, 'stone', 0.0); slab(b, F, t, Y.blue[0] - 0.22, 0.42, 0.22, 0.16, 'stone', 0.0); }
  for (const t of o.reliefs) {
    slab(b, F, t, Y.f3[0] + 0.05, 0.62, 1.45, 0.05, 'stone', 0.0);
    slab(b, F, t, Y.f3[0] + 0.2, 0.42, 1.15, 0.05, 'sandstone', 0.05);
  }
  // light-blue painted frieze between the consoles under the overhanging cornice
  slab(b, F, L / 2, Y.blue[0], L - 0.1, Y.blue[1] - Y.blue[0], 0.04, 'blue', 0.0);
  const nc = Math.round((L - 0.4) / 0.68);
  for (let k = 0; k <= nc; k++) {
    const t = 0.2 + k * (L - 0.4) / nc;
    consoleBlock(F, t, Y.blue[0], Y.blue[1], 0.42, 0.2);
    if (k < nc) disc(b, F, t + (L - 0.4) / nc / 2, (Y.blue[0] + Y.blue[1]) / 2, 0.17, 0.05, 'gold', 0.04);
  }
  cornice(F, L);
}

function sash(F: Frame, a: number, y0: number, y1: number, w: number, transom: number) {
  slab(b, F, a, y0, w, y1 - y0, 0.07, 'glass', 0.0);
  const fb = 0.09;
  for (const s of [-1, 1]) slab(b, F, a + s * (w / 2 - fb / 2), y0, fb, y1 - y0, 0.04, 'frame', 0.07);
  slab(b, F, a, y0, w, fb, 0.04, 'frame', 0.07);
  slab(b, F, a, y1 - fb, w, fb, 0.04, 'frame', 0.07);
  slab(b, F, a, transom, w, 0.08, 0.04, 'frame', 0.07);
  slab(b, F, a, y0 + (transom - y0) / 2 - 0.04, w, 0.07, 0.03, 'frame', 0.075);
  slab(b, F, a, y0, 0.06, transom - y0, 0.03, 'frame', 0.075);
}
function surround(F: Frame, a: number, y0: number, y1: number, w: number, k: number) {
  for (const s of [-1, 1]) slab(b, F, a + s * (w / 2 + k / 2), y0 - 0.05, k, y1 - y0 + 0.1, 0.12, 'stone', 0.0);
  slab(b, F, a, y1 + 0.05, w + 2 * k, k, 0.14, 'stone', 0.0);
  slab(b, F, a, y0 - 0.17, w + 2 * k + 0.1, 0.12, 0.2, 'stone', 0.0);
}
function arched(F: Frame, a: number, y0: number, y1: number, w: number, k: number) {
  archSlab(b, F, a, y0, w, y1 - y0, 0.07, 'glass', 0.0, 6);
  archBand(b, F, a, y0, w + 2 * k, y1 - y0 + k, k, 0.1, 'stone', 0.0, 6);
  slab(b, F, a, y0 + (y1 - y0) * 0.55, w, 0.06, 0.03, 'frame', 0.075);
  slab(b, F, a, y0, 0.05, y1 - y0 - w / 2, 0.03, 'frame', 0.075);
  slab(b, F, a, y1 + k - 0.06, 0.16, 0.24, 0.13, 'stone', 0.0); // keystone
  slab(b, F, a, y0 - 0.12, w + 0.2, 0.1, 0.14, 'stone', 0.0);
}
/** Ornamental console: a block that steps out towards the top. */
function consoleBlock(F: Frame, t: number, y0: number, y1: number, d: number, w = 0.26) {
  const h = y1 - y0;
  slab(b, F, t, y0, w * 0.8, h * 0.45, d * 0.45, 'stone', 0.0);
  slab(b, F, t, y0 + h * 0.45, w, h * 0.55, d, 'stone', 0.0);
}
function railing(F: Frame, a: number, w: number, d: number, y: number) {
  const H = Y.rail, n = Math.round(w / 0.13);
  const side = (s: number): Frame => ({origin: [F.origin[0] + F.tangent[0] * (a + s * w / 2), F.origin[1] + F.tangent[1] * (a + s * w / 2)], tangent: [F.n[0] * s, F.n[1] * s], n: [-F.tangent[0] * s, -F.tangent[1] * s]});
  slab(b, F, a, y + H - 0.05, w, 0.05, 0.06, 'bronze', d - 0.06);
  slab(b, F, a, y + 0.08, w, 0.04, 0.04, 'bronze', d - 0.05);
  for (let k = 0; k <= n; k++) slab(b, F, a - w / 2 + k * w / n, y, 0.025, H, 0.025, 'bronze', d - 0.05);
  for (const s of [-1, 1]) {
    const f = side(s);
    slab(b, f, d / 2 * s, y + H - 0.05, d, 0.05, 0.05, 'bronze', 0.0);
    for (let k = 1; k < 4; k++) slab(b, f, s * k * d / 4, y, 0.025, H, 0.025, 'bronze', 0.0);
  }
}
function cornice(F: Frame, L: number) {
  const [c0, c1] = Y.cornice;
  slab(b, F, L / 2, c0, L - 0.1, 0.18, 0.3, 'stone', 0.0);
  slab(b, F, L / 2, c0 + 0.18, L - 0.1, 0.3, 0.62, 'stone', 0.0);
  slab(b, F, L / 2, c0 + 0.48, L - 0.1, c1 - c0 - 0.48, 0.74, 'stone', 0.0);
}

/** The koekoek in the Singel side's hip roof (register; recording_2025-06-19_03-28-47_01537: 1 m wide, pointed roof, over the axis). */
function dormer() {
  const F = NE.f, a = 2.28, y0 = CORNICE + 0.35, w = 1.0, h = 1.0, d = 0.7;
  slab(b, F, a, y0, w, h, d, 'slate', 0.0);
  slab(b, F, a, y0 + 0.15, 0.6, 0.65, 0.05, 'glass', d + 0.06);
  slab(b, F, a, y0 + 0.1, 0.72, 0.75, 0.06, 'white', d);
  poly(b, F, a, y0 + h, [[-w / 2 - 0.08, 0], [w / 2 + 0.08, 0], [0, 0.55]], d + 0.1, 'slate', 0.0);
}

// ----------------------------------------------------------------------------------------------------------------- tower

const towerFrame = (r: number, a: number): Frame => arcFrame(C, r, a);

function tower() {
  // body from the ground to the cornice, a skin 8 cm outside the BAG facets
  const bays3 = bayAngles(AC, 3, 1.18, RS);
  // a flat facet under each window bay (vertex to vertex at the half-pitch), curved runs beyond: windows sit on planes
  const HB = 0.59 / RS, RC = RS * Math.cos(HB);
  const st = [TA0, ...bayStations(TA0, bays3[0] + HB, [], 0).slice(1), ...bays3.map(a => a - HB), ...bayStations(bays3[2] - HB, TA1, [], 0).slice(1)];
  facetStrip(RS, 0, Y.shop, st, 'bronze');
  facetStrip(RS, Y.shop, CORNICE, st, 'brick');
  const chord = (a: number) => towerFrame(RC, a);
  // shop: the corner entrance (main door) between shop windows, the granito mosaic tableau over them
  ringBand(RS - 0.12, RS + 0.1, 3.6, Y.shop, TA0 + 0.05, TA1 - 0.05, 'pink');
  ringBand(RS - 0.12, RS + 0.14, 2.0, 2.28, TA0 + 0.05, TA1 - 0.05, 'bronze');
  for (const [i, a] of bays3.entries()) {
    const f = chord(a);
    if (i === 1) { slab(b, f, 0, 0, 0.95, 2.0, 0.03, 'ochre', 0.04); slab(b, f, 0, 0.9, 0.5, 0.9, 0.05, 'glass', 0.07); }
    else slab(b, f, 0, 0.35, 1.0, 1.65, 0.03, 'glass', 0.04);
    slab(b, f, 0, 2.28, 1.0, 1.32, 0.03, 'pink', 0.1);
  }
  ringBand(RS - 0.12, RS + 0.16, Y.frieze[0], Y.frieze[1], TA0, TA1, 'stone');
  // speklagen round the tower, broken at the window surrounds
  const holes = (w: number) => bays3.map(a => [a + (w / 2 + 0.2) / RS, a - (w / 2 + 0.2) / RS] as [number, number]);
  const courses = (y0: number, y1: number, w: number) => {
    for (let y = y0; y < y1; y += 0.7) {
      const cuts = holes(w);
      let a = TA0;
      for (const [h0, h1] of cuts) { if (a - h0 > 0.02) ringBand(RS - 0.12, RS + 0.04, y, y + 0.14, a, h0, 'stone'); a = h1; }
      if (a - TA1 > 0.02) ringBand(RS - 0.12, RS + 0.04, y, y + 0.14, a, TA1, 'stone');
    }
  };
  courses(5.3, 7.5, 0.75);
  courses(9.3, 11.9, 0.86);
  // first storey: three narrow rectangular windows in stone surrounds
  for (const a of bays3) { const f = chord(a); sash(f, 0, Y.f1[0], Y.f1[1], 0.75, Y.f1Transom); surround(f, 0, Y.f1[0], Y.f1[1], 0.75, 0.16); }
  // the balcony on stone consoles with stencilled relief between them; iron railing (not original)
  const RB = RS + 0.85;
  for (const a of [A0 + 0.1, ...bays3.map((x, i) => (i < 2 ? (x + bays3[i + 1]) / 2 : x)), A1 - 0.1]) consoleBlock(towerFrame(RS, a), 0, Y.console[0], Y.console[1], 0.8, 0.3);
  ringBand(RS - 0.12, RS + 0.04, Y.console[0], Y.console[1], TA0, TA1, 'sandstone');
  ringBand(RS - 0.12, RB, Y.balcony[0], Y.balcony[1], A0 + 0.02, A1 - 0.02, 'stone');
  ringBand(RB - 0.07, RB - 0.02, Y.balcony[1] + Y.rail - 0.05, Y.balcony[1] + Y.rail, A0 + 0.02, A1 - 0.02, 'bronze');
  ringBand(RB - 0.06, RB - 0.03, Y.balcony[1] + 0.08, Y.balcony[1] + 0.12, A0 + 0.02, A1 - 0.02, 'bronze');
  const nb = Math.round(Math.abs(A1 - A0) * (RB - 0.05) / 0.13);
  for (let k = 0; k <= nb; k++) slab(b, towerFrame(RB - 0.07, A0 + 0.02 + (A1 - A0 - 0.04) * k / nb), 0, Y.balcony[1], 0.025, Y.rail, 0.025, 'bronze', 0.0);
  // second storey: three round-headed windows between stone pilasters with arched surrounds
  for (const a of bays3) arched(chord(a), 0, Y.f2[0], Y.f2[1] + 0.05, 0.86, 0.16);
  for (const a of [A0 + 0.12, ...bays3.slice(0, 2).map((x, i) => (x + bays3[i + 1]) / 2), A1 - 0.12]) slab(b, towerFrame(RS, a), 0, Y.f2[0], 0.26, Y.paint[0] - Y.f2[0], 0.12, 'stone', 0.0);
  ringBand(RS - 0.12, RS + 0.12, Y.entab[0] + 0.1, Y.paint[0], TA0, TA1, 'stone');
  // the red painted frieze with VERZEKERINGSBANK in gold letters (register; recording_2025-06-19_03-28-47_01535)
  ringBand(RS - 0.12, RS + 0.06, Y.paint[0], Y.paint[1], TA0, TA1, 'red');
  const px = 0.085;
  for (const g of arcGlyphPlacements('VERZEKERINGSBANK', {centre: C, radius: RS + 0.06, centreAngle: AC, advance: 6 * px})) {
    if (g.char === ' ') continue;
    letters(b, {origin: g.at, tangent: g.tangent, n: g.n}, g.char, 0, Y.paint[0] + 0.3, 0, px, 0.04, 'gold');
  }
  ringBand(RS - 0.12, RS + 0.26, Y.cordon[0], Y.cordon[1], TA0, TA1, 'stone');
  // third storey: three round-headed windows with stone arches and keystones, Ionic stone pilasters between
  for (const a of bays3) arched(chord(a), 0, Y.f3[0], Y.f3[1], 0.7, 0.13);
  for (const a of [A0 + 0.12, ...bays3.slice(0, 2).map((x, i) => (x + bays3[i + 1]) / 2), A1 - 0.12]) {
    slab(b, towerFrame(RS, a), 0, Y.cordon[1], 0.3, Y.blue[0] - Y.cordon[1], 0.1, 'stone', 0.0);
    slab(b, towerFrame(RS, a), 0, Y.blue[0] - 0.22, 0.42, 0.22, 0.16, 'stone', 0.0);
  }
  ringBand(RS - 0.12, RS + 0.06, Y.f3[1] + 0.05, Y.f3[1] + 0.17, TA0, TA1, 'stone');
  // light-blue frieze with consoles and the overhanging cornice
  ringBand(RS - 0.12, RS + 0.06, Y.blue[0], Y.blue[1], TA0, TA1, 'blue');
  const nc = 9;
  for (let k = 0; k <= nc; k++) {
    const a = A0 + 0.05 + (A1 - A0 - 0.1) * k / nc;
    consoleBlock(towerFrame(RS, a), 0, Y.blue[0], Y.blue[1], 0.42, 0.2);
    if (k < nc) disc(b, towerFrame(RS + 0.06, a + (A1 - A0 - 0.1) / nc / 2), 0, (Y.blue[0] + Y.blue[1]) / 2, 0.17, 0.05, 'gold', 0.0);
  }
  ringBand(RS - 0.12, RS + 0.3, Y.cornice[0], Y.cornice[0] + 0.18, TA0, TA1, 'stone');
  ringBand(RS - 0.12, RS + 0.62, Y.cornice[0] + 0.18, Y.cornice[0] + 0.48, TA0, TA1, 'stone');
  ringBand(0, RS + 0.74, Y.cornice[0] + 0.48, CORNICE + 0.05, TA0, TA1, 'stone');
  drum();
}

/**
 * The fourth tower storey in stone with five round-headed windows between half-columns, the wide white-plastered frieze
 * all round under an overhanging cornice, the shingle-and-zinc dome and the open lantern with its iron spire (register).
 * Sphere_00277 / recording_01535 at 40 px/m: windows 17.9-19.6 m, frieze 19.7-20.45, cornice to 20.95, crown ~25.0.
 */
function drum() {
  const y0 = CORNICE, yw0 = 17.9, yw1 = 19.6, yf = 19.7, yc = 20.45, ytop = 20.95;
  arcStrip(RD, y0, yc, 0, Math.PI * 2, 'stone');
  ringBand(RD - 0.05, RD + 0.12, y0, y0 + 0.3, 0, Math.PI * 2, 'stone');        // plinth
  ringBand(RD - 0.05, RD + 0.08, yf, yc, 0, Math.PI * 2, 'concrete');              // plastered frieze
  ringBand(RD - 0.05, RD + 0.18, yc, yc + 0.12, 0, Math.PI * 2, 'stone');
  ringBand(RD - 0.05, RD + 0.45, yc + 0.12, ytop, 0, Math.PI * 2, 'stone');     // overhanging cornice
  const five = bayAngles(AC, 5, 1.55, RD);
  for (const a of five) {
    const f = towerFrame(RD, a);
    archSlab(b, f, 0, yw0, 0.72, yw1 - yw0, 0.07, 'glass', 0.0, 6);
    archBand(b, f, 0, yw0, 0.92, yw1 - yw0 + 0.1, 0.1, 0.08, 'stone', 0.0, 6);
    slab(b, f, 0, yw0 + 0.95, 0.72, 0.05, 0.03, 'frame', 0.075);
  }
  // half-columns between the windows (and round the back, where the roof hides the drum's lower half)
  for (let k = 0; k < 12; k++) {
    const a = five[0] + 0.5 * (five[0] - five[1]) - k * (five[0] - five[1]);
    const p = P(RD + 0.04, a, 0);
    b.add(new T.CylinderGeometry(0.11, 0.12, yf - y0 - 0.3, 6, 1, true), 'stone' as never, p[0], y0 + 0.3 + (yf - y0 - 0.3) / 2, p[2]);
    b.add(new T.BoxGeometry(0.3, 0.14, 0.3), 'stone' as never, p[0], yf - 0.07, p[2]);
  }
  // dome: a steep helmet clad in shingles and zinc (crown 25.0 m from the rectified views, 3DBAG max 26.0 with the lantern)
  const prof = domeProfile({radius: RD + 0.05, rise: 4.05, exponent: 2.3, steps: 9, neck: 0.32});
  b.add(new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 28), 'slate' as never, C[0], ytop, C[1]);
  const yn = ytop + prof[prof.length - 1][1];
  // zinc ribs up the dome
  for (let k = 0; k < 12; k++) {
    const a = AC + k * Math.PI / 6;
    const ribs: number[] = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, h0] = prof[i], [r1, h1] = prof[i + 1];
      const p0 = P(r0 + 0.02, a, ytop + h0), p1 = P(r1 + 0.02, a, ytop + h1);
      const w = 0.05, t: V = [-Math.sin(a) * w, Math.cos(a) * w];
      const q = (p: number[], s: number) => [p[0] + t[0] * s, p[1], p[2] + t[1] * s];
      for (const v of [q(p0, -1), q(p0, 1), q(p1, 1), q(p0, -1), q(p1, 1), q(p1, -1)]) ribs.push(...v);
    }
    const g = geom(ribs);
    b.add(g, 'bronze' as never);
  }
  // the open lantern: a collar, six iron posts under a cap, and the spire with a ball
  b.add(new T.CylinderGeometry(0.42, 0.42, 0.14, 12), 'stone' as never, C[0], yn + 0.07, C[1]);
  for (let k = 0; k < 6; k++) { const p = P(0.3, AC + k * Math.PI / 3, 0); b.add(new T.CylinderGeometry(0.03, 0.03, 0.6, 4, 1, true), 'bronze' as never, p[0], yn + 0.14 + 0.3, p[2]); }
  b.add(new T.CylinderGeometry(0.4, 0.4, 0.08, 12), 'bronze' as never, C[0], yn + 0.78, C[1]);
  b.add(new T.ConeGeometry(0.3, 0.35, 12, 1, true), 'bronze' as never, C[0], yn + 0.82 + 0.175, C[1]);
  b.add(new T.SphereGeometry(0.08, 8, 6), 'gold' as never, C[0], yn + 1.06, C[1]);
  b.add(new T.ConeGeometry(0.05, 0.55, 6, 1, true), 'bronze' as never, C[0], yn + 1.1 + 0.275, C[1]);
}
