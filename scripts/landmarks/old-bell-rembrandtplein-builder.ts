import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {put, ringFrame, slab, type Frame} from './nearbar-kit';
import {glyphRuns} from './mixed-case-glyphs';
import {speklagen} from '../../src/canalRecall/landmarks/speklagen';
import {steppedGable} from '../../src/canalRecall/landmarks/steppedGable';
import source from './old-bell-rembrandtplein-footprints.json';

/**
 * THE OLD BELL / CITY HOTEL, REMBRANDTPLEIN 46 / UTRECHTSESTRAAT 2 (BAG pand 0363100012178852; rijksmonument 518404):
 * the office building of De Eerste Nederlandsche Verzekeringsmaatschappij, 1891-92, J. Kok and A. van Ameijde van Duijm;
 * remodelled 1926 by J. van Schaik for 't Modehuis v/h H. Simons. Today The Old Bell cafe and the City Hotel.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts) for the party walls, the rear and the inner roofs;
 * the three street faces (the Utrechtsestraat front, the corner chamfer and the Rembrandtplein front) are drawn here up to
 * the eaves (17.05 m), with the shingled mansard behind them rising to a flat roof at 21.2 m, 2.0 m behind the fronts (the 2025 frontal crop shows the slope's top edge at 18.4 m in the front plane from a camera 13 m out: about 2.3 m back)
 * (the 3DBAG walls stand straight up to 20.7-21.8 m; the register: "schuin oplopende schilden met daarboven een plat dak").
 *
 * Read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0): the Rembrandtplein front from
 * recording_2025-06-19_03-28-47_01657 (2025, frontal, 50 px/m: w02-348.alt.jpg) and TMX7316010203-002537_pano_0001_000087
 * (2022: w02-348.jpg, w02-348.thumb.jpg for the corner); the Utrechtsestraat front from b_20250120_0926_Track30_Sphere_00341
 * (2025, 49.8 px/m: w01-77.jpg) and TMX7316010203-000716_pano_0001_000026 (2018, sunlit, the stepped gable: w01-77.alt.jpg).
 * Heights h = (1100 - y) / 50 on the 2025 Rembrandtplein crop; t = x / 50 (N) and x / 49.8 (E) from each front's left end.
 *  - ground storey of grey stone piers (wider foot) between shop fronts: green fascia, red-brown panelling with painted
 *    pictures, leaded lower lights; enamel beer plaques on the Rembrandtplein piers; the corner entrance on the chamfer
 *    with its copper bell on a bracket (the register: "een koperen klok in een beugel": the bell of the name);
 *  - the gilt "the old Bell" letters standing on the stone cordon over the Rembrandtplein shop fronts (x 100-357, y 843-880);
 *  - two storeys of light red brick banded with pale stone every 0.82 m, double windows in stone aedicules (stone
 *    colonnet mullion, carved paired panels between the storeys) on three axes (Utrechtsestraat) and two (Rembrandtplein),
 *    with the red CITY / HOTEL boards on the Rembrandtplein upper sills; brick colonnettes on carved consoles between;
 *  - the three-sided corner oriel over both storeys on a sandstone console, topped by an open stone parapet with ironwork;
 *  - the narrow balcony along both fronts on carved consoles: stone posts with wrought-iron panels;
 *  - the third storey's French doors in groups of three between Ionic half-columns, with top lights;
 *  - the frieze of carved metopes between brick colonnettes carrying the beam ends of the broad timber eaves;
 *  - the eight-tread stepped gable breaking the eaves on the Utrechtsestraat (two paired sash windows), the small stepped
 *    crown with its finial over the corner, the mansard with four dormers to the square and one to the street.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
type Face = {f: Frame; len: number};
const E: Face = ringFrame(src.facadeRing, 2), C: Face = ringFrame(src.facadeRing, 3), N: Face = ringFrame(src.facadeRing, 4);

const H = {
  shopTop: 4.0, gTop: 4.6, cordon: [4.6, 4.9] as const,
  aed: [4.95, 11.5] as const, low: [5.05, 7.45] as const, panel: [7.45, 8.2] as const, sill2: [8.85, 9.0] as const,
  up: [9.05, 11.1] as const, consoles: 11.6, balc: [12.3, 12.56] as const, bal: 13.26,
  l3: [13.35, 14.85] as const, transom: [14.05, 14.2] as const, frieze: 15.05, metope: [15.25, 15.95] as const,
  beams: [16.0, 16.8] as const, eaves: 17.05, roof: 21.2,
};
const AED_HW = 1.33, WIN_HW = 0.96, MANS_D = 2.0, SKIN = 0.35;
const BANDS = Array.from({length: 8}, (_, k) => ({y: 5.2 + 0.82 * k, h: 0.16})).concat([{y: 13.8, h: 0.14}, {y: 14.55, h: 0.14}]);
/** Window axes and ground-storey piers per front (crop x / px-per-m). */
const N_AX = [128 / 50, 334 / 50], E_AX = [112 / 49.8, 288 / 49.8, 458 / 49.8];
const N_PIERS: [number, number][] = [[0, 1.04], [4.24, 5.37], [8.4, N.len]];
const E_PIERS: [number, number][] = [[0, 1.1], [3.65, 4.5], [7.07, 8.03], [10.54, E.len]];
/** The Utrechtsestraat gable over the two southern axes (2018 crop: steps at x 165-272, paired windows at x 37-75, 106-144). */
const GABLE = {c: 3.95, w: 6.7};

/** Shell surfaces replaced here: the street walls (1, 6, 15, 22), the small steps along them (23, 24), the top roofs (28, 29). */
const SKIP = new Set([1, 6, 15, 22, 23, 24, 28, 29]);

/**
 * The two party walls (3 to the west, 16 to the south) end at the street corners, where the drawn brick skin ends too: their
 * last 0.36 m would lie in the skin's end faces (coplanar overlap). Their street edge is moved back along the wall to just
 * behind the skin, where the skin's back face covers it.
 */
function partyWallsBehindSkin(): Surface[] {
  const R = src.facadeRing;
  const pull = (i: number, corner: number[], other: number[]) => {
    const dx = other[0] - corner[0], dz = other[1] - corner[1], L = Math.hypot(dx, dz), k = (SKIN + 0.01) / L;
    return src.surfaces[i].rings.map(r => r.map(p => (Math.hypot(p[0] - corner[0], p[2] - corner[1]) < 0.05 ? [p[0] + dx * k, p[1], p[2] + dz * k] : p)));
  };
  return src.surfaces.map((sf, i) => (i === 3 ? {...sf, rings: pull(3, R[0], [-7.7, -1.7])} : i === 16 ? {...sf, rings: pull(16, R[2], R[1])} : sf));
}

export function buildOldBellRembrandtplein(_w: number, _d: number, b: BuildingTools) {
  addShell(b, {...src, surfaces: partyWallsBehindSkin()} as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => SKIP.has(i), wallFor: () => 'brick'});
  roofAndMansard(b);
  front(b, E, E_AX, E_PIERS, false);
  front(b, N, N_AX, N_PIERS, true);
  chamfer(b);
  gable(b);
  dormers(b);
}

// ---- small geometry helpers ------------------------------------------------------------------------------------------
const at = (F: Face, t: number, o = 0): [number, number] => [F.f.origin[0] + F.f.tangent[0] * t + F.f.n[0] * o, F.f.origin[1] + F.f.tangent[1] * t + F.f.n[1] * o];
/** Triangles from a convex/simple polygon in 3D, wound so the normal points along `hint`. */
function polyFace(b: BuildingTools, pts: [number, number, number][], hint: [number, number, number], col: string) {
  const pos: number[] = [];
  for (let i = 1; i + 1 < pts.length; i++) {
    let [a, q, r] = [pts[0], pts[i], pts[i + 1]];
    const u = [q[0] - a[0], q[1] - a[1], q[2] - a[2]], v = [r[0] - a[0], r[1] - a[1], r[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) [q, r] = [r, q];
    pos.push(...a, ...q, ...r);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  b.add(g, col as never);
}
/** Upward flat polygon (x, z ring) at height y. */
function flat(b: BuildingTools, ring: [number, number][], y: number, col: string) {
  const tris = T.ShapeUtils.triangulateShape(ring.map(p => new T.Vector2(p[0], p[1])), []);
  const pos: number[] = [];
  for (const [i, j, k] of tris) {
    const a = ring[i], q = ring[j], r = ring[k];
    const up = (q[0] - a[0]) * (r[1] - a[1]) - (q[1] - a[1]) * (r[0] - a[0]) < 0; // y = z x x: up when the xz cross is negative
    const tri = up ? [a, q, r] : [a, r, q];
    for (const p of tri) pos.push(p[0], y, p[1]);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  b.add(g, col as never);
}
/** Vertical prism over an (x, z) polygon from y0 to y1. */
function prism(b: BuildingTools, ring: [number, number][], y0: number, y1: number, col: string) {
  const s = new T.Shape(ring.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false}).rotateX(Math.PI / 2).translate(0, y1, 0);
  b.add(g, col as never);
}
/** Line intersection of p + s*d and q + u*e. */
function meet(p: [number, number], d: [number, number], q: [number, number], e: [number, number]): [number, number] {
  const den = d[0] * e[1] - d[1] * e[0], s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den;
  return [p[0] + d[0] * s, p[1] + d[1] * s];
}
/** A rectangle of wall [t0,t1] x [y0,y1] as boxes `SKIN` deep behind the plane, with rectangular holes left open. */
function skin(b: BuildingTools, F: Face, t0: number, t1: number, y0: number, y1: number, holes: [number, number, number, number][], col: string, d = SKIN) {
  const ys = [...new Set([y0, y1, ...holes.flatMap(h => [h[2], h[3]]).filter(y => y > y0 && y < y1)])].sort((a, c) => a - c);
  for (let i = 0; i + 1 < ys.length; i++) {
    const a = ys[i], c = ys[i + 1];
    const cuts = holes.filter(h => h[2] < c - 1e-6 && h[3] > a + 1e-6).map(h => [h[0], h[1]] as [number, number]).sort((p, q) => p[0] - q[0]);
    let p0 = t0;
    for (const [c0, c1] of [...cuts, [t1, t1] as [number, number]]) {
      if (c0 - p0 > 0.01) slab(b, F.f, (p0 + Math.min(c0, t1)) / 2, a, Math.min(c0, t1) - p0, c - a, d, col, -d);
      p0 = Math.max(p0, c1);
    }
  }
}
/** Glass in a reveal with light frames: `rows` horizontal bars at the given heights, `cols` lights. */
function glazing(b: BuildingTools, F: Face, t0: number, t1: number, y0: number, y1: number, bars: number[] = [], cols = 1, frame = 'frame') {
  const w = t1 - t0, tc = (t0 + t1) / 2, o = -0.12;
  slab(b, F.f, tc, y0, w, y1 - y0, 0.005, 'glass', o);
  const B = 0.07;
  slab(b, F.f, tc, y0, w, B, 0.05, frame, o);
  slab(b, F.f, tc, y1 - B, w, B, 0.05, frame, o);
  for (const s of [-1, 1]) slab(b, F.f, tc + s * (w - B) / 2, y0 + B, B, y1 - y0 - 2 * B, 0.05, frame, o);
  for (const y of bars) slab(b, F.f, tc, y - 0.04, w - 2 * B, 0.08, 0.05, frame, o);
  for (let k = 1; k < cols; k++) slab(b, F.f, t0 + w * k / cols, y0 + B, 0.07, y1 - y0 - 2 * B, 0.09, frame, o);
}
/** Text from the mixed-case glyph table, centred at t, baseline y. */
function text(b: BuildingTools, F: Face, s: string, t: number, y: number, px: number, pxY: number, d: number, col: string, out: number) {
  const {runs, width} = glyphRuns(s, px);
  for (const r of runs) slab(b, F.f, t - width / 2 + (r.t0 + r.t1) / 2, y + r.y0 / px * pxY, r.t1 - r.t0, (r.y1 - r.y0) / px * pxY, d, col, out);
}

// ---- roof and mansard ------------------------------------------------------------------------------------------------
function roofAndMansard(b: BuildingTools) {
  const R = src.facadeRing as [number, number][];
  const inset = (F: Face): [[number, number], [number, number]] => [at(F, 0, -MANS_D), F.f.tangent];
  const [e0, eT] = inset(E), [c0, cT] = inset(C), [n0, nT] = inset(N);
  const sDir: [number, number] = [R[2][0] - R[1][0], R[2][1] - R[1][1]], wDir: [number, number] = [R[1][0] - R[0][0], R[1][1] - R[0][1]];
  const Qs = meet(e0, eT, R[1], sDir), Qe = meet(e0, eT, c0, cT), Qn = meet(c0, cT, n0, nT), Qw = meet(n0, nT, R[0], wDir);
  const M = [at(E, 0), at(C, 0), at(N, 0), at(N, N.len)], Q = [Qs, Qe, Qn, Qw];
  // the flat roof: the inset street line plus the inner vertices of 3DBAG roofs 28 and 29 (their union), at 21.2
  flat(b, [Qw, [-7.7, -1.7], [-7.2, 0.2], [-2.5, -0.5], [-0.6, 4], [-1.7, 4.8], [-1.5, 7], Qs, Qe, Qn], H.roof, 'slate');
  // shingled slopes from the eaves at the front plane to the roof edge
  for (let i = 0; i < 3; i++) {
    const out: [number, number, number] = [-(Q[i][0] + Q[i + 1][0]) / 2 + (M[i][0] + M[i + 1][0]) / 2, 0.3, -(Q[i][1] + Q[i + 1][1]) / 2 + (M[i][1] + M[i + 1][1]) / 2];
    polyFace(b, [[M[i][0], H.eaves, M[i][1]], [M[i + 1][0], H.eaves, M[i + 1][1]], [Q[i + 1][0], H.roof, Q[i + 1][1]], [Q[i][0], H.roof, Q[i][1]]], out, 'slate');
  }
  // end wedges against the party walls
  for (const [m0, q0, hint, dir] of [[M[0], Q[0], [-sDir[1], 0, sDir[0]], E.f.tangent], [M[3], Q[3], [wDir[1], 0, -wDir[0]], N.f.tangent]] as const) {
    const k = dir === E.f.tangent ? 0.1 : -0.1, m = [m0[0] + dir[0] * k, m0[1] + dir[1] * k], q = [q0[0] + dir[0] * k, q0[1] + dir[1] * k];
    polyFace(b, [[m[0], H.eaves, m[1]], [q[0], H.roof, q[1]], [m[0], H.roof, m[1]]], [hint[0], 0, hint[2]] as [number, number, number], 'brick');
  }
  // the broad overhang at the change to the flat roof (the register's "brede overstek"): a thin lip along the roof edge
  for (const [F, t0, t1] of [[E, 0, E.len], [C, 0, C.len], [N, 0, N.len]] as const) slab(b, F.f, (t0 + t1) / 2, H.roof - 0.1, t1 - t0, 0.1, 0.25, 'blue', -MANS_D);
}

// ---- the two fronts --------------------------------------------------------------------------------------------------
function front(b: BuildingTools, F: Face, axes: number[], piers: [number, number][], square: boolean) {
  const len = F.len, lo = 0, hi = len, mid = (lo + hi) / 2, span = hi - lo;
  const shops: [number, number][] = piers.slice(0, -1).map((p, i) => [p[1], piers[i + 1][0]]);
  const underGable = (t: number) => !square && t > GABLE.c - GABLE.w / 2 - 0.1 && t < GABLE.c + GABLE.w / 2 + 0.1;
  // ground storey: grey stone with the shop openings, stone piers with a wider foot, the cordon
  skin(b, F, lo, hi, 0, H.gTop, shops.map(([a, c]) => [a, c, 0.15, H.shopTop] as [number, number, number, number]), 'stone');
  for (const [a, c] of piers) {
    const w = c - a - 0.1;
    slab(b, F.f, (a + c) / 2, 0, w, 0.6, 0.12, 'stone');
    slab(b, F.f, (a + c) / 2, 0.6, w - 0.12, H.shopTop - 0.6, 0.06, 'stone');
    slab(b, F.f, (a + c) / 2, H.shopTop - 0.2, w, 0.2, 0.1, 'stone');
  }
  slab(b, F.f, mid, H.shopTop, span, H.gTop - H.shopTop, 0.04, 'stone');
  slab(b, F.f, mid, H.cordon[0], span, 0.12, 0.18, 'stone');
  slab(b, F.f, mid, H.cordon[0] + 0.12, span, H.cordon[1] - H.cordon[0] - 0.12, 0.26, 'stone');
  shops.forEach(([a, c], i) => shop(b, F, a + 0.04, c - 0.04, !square && i === 0));
  if (square) {
    // enamel beer plaques on the piers (Guinness, Amstel, Courage) and the gilt lettering on the cordon
    for (const [a, c] of piers) {
      slab(b, F.f, (a + c) / 2, 2.0, 0.62, 1.45, 0.05, 'white', 0.06);
      slab(b, F.f, (a + c) / 2, 2.55, 0.34, 0.6, 0.05, 'ochre', 0.11);
    }
    text(b, F, 'the old Bell', 228 / 50, 4.6, 0.072, 0.103, 0.06, 'gold', 0.28);
  }
  // brick storeys: skin with the aedicule windows and the third-storey groups cut out
  const holes: [number, number, number, number][] = [];
  for (const a of axes) {
    holes.push([a - WIN_HW, a + WIN_HW, H.low[0], H.low[1]], [a - WIN_HW, a + WIN_HW, H.up[0], H.up[1]], [a - 1.15, a + 1.15, H.l3[0], H.l3[1]]);
  }
  skin(b, F, lo, hi, H.gTop, H.eaves, holes, 'brick');
  // pale stone bands, stopped by the aedicules and the third-storey groups
  const bandOpen = axes.flatMap(a => [{t0: a - AED_HW, t1: a + AED_HW, y0: H.aed[0], y1: H.aed[1]}, {t0: a - 1.27, t1: a + 1.27, y0: H.l3[0] - 0.1, y1: H.l3[1] + 0.2}]);
  for (const r of speklagen({t0: lo, t1: hi, bands: BANDS, openings: bandOpen})) slab(b, F.f, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'concrete');
  for (const a of axes) aedicule(b, F, a, square ? (a === axes[0] ? 'CITY' : 'HOTEL') : null);
  // brick colonnettes on carved stone consoles between and beside the aedicules
  const mids = [0.55, ...axes.slice(1).map((a, i) => (a + axes[i]) / 2), len - 0.55];
  for (const m of mids) {
    slab(b, F.f, m, 7.3, 0.34, 0.9, 0.2, 'greyBrick');
    slab(b, F.f, m, 8.2, 0.24, H.consoles - 8.2, 0.1, 'brick');
  }
  // balcony on consoles: slab, stone posts with wrought-iron panels, rail
  for (let t = 0.3; t < len - 0.2; t += 0.9) slab(b, F.f, t, H.consoles + 0.3, 0.16, 0.4, 0.4, 'greyBrick');
  for (const m of mids) slab(b, F.f, m, H.consoles, 0.3, 0.7, 0.45, 'greyBrick');
  balcony(b, F, lo, hi, H.balc[0], 0.55);
  // third storey: French doors in groups of three between Ionic half-columns, top lights over a stone transom
  for (const a of axes) {
    const t0 = a - 1.15, t1 = a + 1.15;
    // each light glazed on its own between the half-columns, the doors under the transom, the top lights over it
    for (let k = 0; k < 3; k++) {
      const l0 = t0 + 2.3 * k / 3 + (k ? 0.11 : 0), l1 = t0 + 2.3 * (k + 1) / 3 - (k < 2 ? 0.11 : 0);
      glazing(b, F, l0, l1, H.l3[0], H.transom[0], [], 2);
      glazing(b, F, l0, l1, H.transom[1], H.l3[1]);
    }
    slab(b, F.f, a, H.transom[0], 2.3, H.transom[1] - H.transom[0], 0.16, 'sandstone', -0.12);
    for (const k of [1, 2]) {
      const t = t0 + 2.3 * k / 3;
      slab(b, F.f, t, H.l3[0], 0.22, H.transom[0] - H.l3[0], 0.14, 'sandstone', -0.12);
      slab(b, F.f, t, H.transom[0] - 0.12, 0.26, 0.12, 0.2, 'sandstone', -0.12); // capital
      slab(b, F.f, t, H.transom[1], 0.08, H.l3[1] - H.transom[1], 0.12, 'sandstone', -0.12);
    }
    for (const s of [-1, 1]) slab(b, F.f, a + s * 1.2, H.l3[0], 0.12, H.l3[1] - H.l3[0], 0.06, 'sandstone');
    slab(b, F.f, a, H.l3[1], 2.5, 0.2, 0.08, 'sandstone');
  }
  // frieze of carved metopes between colonnettes carrying the beam ends of the eaves (not under the gable)
  const n = Math.round((len - 1.8) / 1.04), pitch = (len - 1.8) / n;
  for (let k = 0; k <= n; k++) {
    const t = 0.9 + k * pitch;
    slab(b, F.f, t, H.frieze, 0.24, 0.25, 0.14, 'greyBrick');
    slab(b, F.f, t, H.frieze + 0.25, 0.16, H.beams[0] - H.frieze - 0.25, 0.08, 'brick');
    if (k < n) {
      const m = t + pitch / 2;
      slab(b, F.f, m, H.metope[0], 0.78, H.metope[1] - H.metope[0], 0.04, 'concrete');
      put(b, F.f, new T.CylinderGeometry(0.2, 0.2, 0.05, 10).rotateX(Math.PI / 2).translate(0, 0, 0.025), m, (H.metope[0] + H.metope[1]) / 2, 0.04, 'greyBrick');
    }
    if (underGable(t)) continue;
    slab(b, F.f, t, H.beams[0], 0.18, 0.4, 0.3, 'blue');
    slab(b, F.f, t, H.beams[0] + 0.4, 0.2, 0.4, 0.58, 'blue');
  }
  // the broad eaves (interrupted by the Utrechtsestraat gable)
  const runs: [number, number][] = square ? [[0, hi]] : [[GABLE.c + GABLE.w / 2, len]];
  for (const [t0, t1] of runs) {
    slab(b, F.f, (t0 + t1) / 2, H.beams[1], t1 - t0, 0.13, 0.66, 'blue');
    slab(b, F.f, (t0 + t1) / 2, H.beams[1] + 0.13, t1 - t0, H.eaves - H.beams[1] - 0.13, 0.72, 'blue');
  }
}

/** A stone aedicule with its double window over two storeys; the carved panels between; a sign board on the upper sill. */
function aedicule(b: BuildingTools, F: Face, a: number, sign: string | null) {
  const [y0, y1] = H.aed;
  for (const s of [-1, 1]) slab(b, F.f, a + s * (AED_HW + WIN_HW) / 2, y0, AED_HW - WIN_HW, y1 - y0, 0.1, 'sandstone');
  slab(b, F.f, a, H.up[1], 2 * WIN_HW, y1 - H.up[1] - 0.12, 0.1, 'sandstone');
  slab(b, F.f, a, y1 - 0.12, 2 * AED_HW + 0.14, 0.16, 0.18, 'sandstone');
  slab(b, F.f, a, y0 - 0.1, 2 * AED_HW + 0.1, 0.15, 0.14, 'sandstone');
  slab(b, F.f, a, H.panel[0], 2 * WIN_HW, H.panel[1] - H.panel[0], 0.05, 'sandstone');
  for (const s of [-1, 1]) slab(b, F.f, a + s * 0.48, H.panel[0] + 0.1, 0.78, 0.52, 0.04, 'greyBrick', 0.05);
  slab(b, F.f, a, H.sill2[0], 2 * WIN_HW + 0.12, H.sill2[1] - H.sill2[0], 0.12, 'sandstone');
  // the stone colonnet mullion through both storeys
  for (const [y0, y1] of [H.low, H.up]) slab(b, F.f, a, y0, 0.14, y1 - y0, 0.14, 'sandstone', -0.12);
  glazing(b, F, a - WIN_HW, a - 0.07, H.low[0], H.low[1], [6.45]);
  glazing(b, F, a + 0.07, a + WIN_HW, H.low[0], H.low[1], [6.45]);
  glazing(b, F, a - WIN_HW, a - 0.07, H.up[0], H.up[1], [10.15]);
  glazing(b, F, a + 0.07, a + WIN_HW, H.up[0], H.up[1], [10.15]);
  if (sign) {
    // red enamel board with a green border and white capitals (2025: x 77-179, y 648-670)
    slab(b, F.f, a, 8.55, 2.0, 0.46, 0.04, 'green', 0.12);
    slab(b, F.f, a, 8.59, 1.9, 0.38, 0.09, 'red', 0.12);
    text(b, F, sign, a, 8.63, 0.05, 0.043, 0.05, 'white', 0.21);
  }
}

/** One shop front: green fascia, red-brown panelling with a painted picture, leaded lower lights over a panelled plinth. */
function shop(b: BuildingTools, F: Face, t0: number, t1: number, hotelDoor: boolean) {
  const w = t1 - t0, tc = (t0 + t1) / 2, o = -0.25, wood = hotelDoor ? 'green' : 'dark';
  slab(b, F.f, tc, 3.72, w, H.shopTop - 3.72, 0.05, 'green', o);
  slab(b, F.f, tc, 2.2, w, 1.52, 0.05, wood, o);
  if (!hotelDoor) slab(b, F.f, tc, 2.6, Math.min(1.6, w - 0.6), 0.85, 0.05, 'ochre', o + 0.05);
  slab(b, F.f, tc, 2.1, w - 0.2, 0.1, 0.1, wood, o);
  slab(b, F.f, tc, 0.15, w, 0.35, 0.06, wood, o);
  if (!hotelDoor) slab(b, F.f, tc, 0.5, w, 1.6, 0.02, 'glass', o);
  else slab(b, F.f, t0 + (w - 1.1) / 2, 0.5, w - 1.1, 1.6, 0.02, 'glass', o);
  for (const s of [-1, 1]) slab(b, F.f, tc + s * (w / 2 - 0.05), 0.15, 0.1, 3.57, 0.14, wood, o);
  if (hotelDoor) {
    // the hotel entrance: a green door with a glazed upper half on the right of the front, a window on the left
    slab(b, F.f, t1 - 0.6, 0.15, 0.95, 2.05, 0.05, 'green', o + 0.02);
    slab(b, F.f, t1 - 0.6, 1.25, 0.6, 0.65, 0.05, 'green', o + 0.07);
    slab(b, F.f, t0 + (w - 1.1) / 2, 1.25, w - 1.3, 0.06, 0.08, 'green', o);
    return;
  }
  // lead lines of the lower lights
  const nv = Math.max(2, Math.round(w / 0.32));
  for (let k = 1; k < nv; k++) slab(b, F.f, t0 + w * k / nv, 0.5, 0.025, 1.6, 0.05, 'bronze', o + 0.02);
  for (const y of [0.9, 1.3, 1.7]) slab(b, F.f, tc, y, w - 0.2, 0.025, 0.09, 'bronze', o + 0.02);
}

/** Stone balcony slab with posts, wrought-iron panels and a rail, from t0 to t1 on face F. */
function balcony(b: BuildingTools, F: Face, t0: number, t1: number, y: number, proj: number, withSlab = true) {
  const w = t1 - t0, tc = (t0 + t1) / 2;
  if (withSlab) slab(b, F.f, tc, y, w, 0.26, proj, 'sandstone');
  const top = y + 0.26, h = H.bal - top;
  slab(b, F.f, tc, top, w, 0.08, 0.2, 'sandstone', proj - 0.25);
  slab(b, F.f, tc, top + h - 0.1, w, 0.1, 0.24, 'sandstone', proj - 0.27);
  const n = Math.max(1, Math.round(w / 0.42)); // stone posts every ~0.42 m (2025 Rembrandtplein crop: 21 px pitch)
  for (let k = 0; k <= n; k++) slab(b, F.f, t0 + 0.08 + (w - 0.16) * k / n, top + 0.08, 0.15, h - 0.18, 0.15, 'sandstone', proj - 0.22);
  slab(b, F.f, tc, top + 0.12, w - 0.1, h - 0.26, 0.03, 'bronze', proj - 0.16);
}

// ---- the corner: chamfered entrance, the oriel, its parapet, the stepped crown ----------------------------------------
function chamfer(b: BuildingTools) {
  const L = C.len;
  // ground storey: stone, the corner door with its top light, the copper bell on a bracket
  const door: [number, number] = [L / 2 - 0.15, L / 2 + 0.85];
  skin(b, C, 0, L, 0, H.gTop, [[door[0], door[1], 0.15, 3.85]], 'stone');
  slab(b, C.f, L / 2 + 0.35, 0.15, 1.0, 2.55, 0.05, 'dark', -0.25);
  slab(b, C.f, L / 2 + 0.35, 0.9, 0.6, 1.5, 0.005, 'glass', -0.15);
  glazing(b, C, door[0], door[1], 2.75, 3.85, [], 2);
  slab(b, C.f, L / 2, H.cordon[0], L, H.cordon[1] - H.cordon[0], 0.26, 'stone');
  // the bell: an iron bracket out of the wall left of the door, the copper bell hanging from its tip
  const bt = 0.55;
  slab(b, C.f, bt, 3.7, 0.06, 0.06, 0.75, 'bronze');
  put(b, C.f, new T.BoxGeometry(0.05, 0.05, 0.62).rotateX(-0.6).translate(0, 0.17, 0.3), bt, 3.4, 0, 'bronze');
  put(b, C.f, new T.CylinderGeometry(0.075, 0.2, 0.32, 10).translate(0, -0.16, 0), bt, 3.66, 0.62, 'copper');
  put(b, C.f, new T.SphereGeometry(0.08, 8, 5).translate(0, 0, 0), bt, 3.66, 0.62, 'copper');
  // the oriel: three sides on the chamfer, front 1.07 m wide, 0.7 m out
  const P0 = 0.1, P1 = L - 0.1, OUT = 0.7, f0 = L / 2 - 0.535, f1 = L / 2 + 0.535;
  const plan: [number, number][] = [[P0, 0], [f0, OUT], [f1, OUT], [P1, 0]];
  const faces: Face[] = [];
  for (let i = 0; i < 3; i++) {
    const p = at(C, plan[i][0], plan[i][1]), q = at(C, plan[i + 1][0], plan[i + 1][1]), len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const tan: [number, number] = [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
    faces.push({f: {origin: p, tangent: tan, n: [-tan[1], tan[0]].map(v => v) as [number, number]}, len});
  }
  // outward normals must point away from the chamfer
  for (const F of faces) {
    const mid = at(F, F.len / 2), back = at(C, L / 2, -1);
    if ((mid[0] - back[0]) * F.f.n[0] + (mid[1] - back[1]) * F.f.n[1] < 0) F.f.n = [-F.f.n[0], -F.f.n[1]];
  }
  const footprint = plan.map(([t, o]) => at(C, t, o)).concat([at(C, P1, -0.3), at(C, P0, -0.3)]) as [number, number][];
  // sandstone shell console under it (stepped: the concha)
  for (const [y0, k] of [[4.35, 0.8], [4.05, 0.55], [3.8, 0.3]] as const) {
    const fp = plan.map(([t, o]) => at(C, L / 2 + (t - L / 2) * k, o * k)).concat([at(C, L / 2 + (P1 - L / 2) * k, -0.3), at(C, L / 2 + (P0 - L / 2) * k, -0.3)]) as [number, number][];
    prism(b, fp, y0, y0 + 0.3, 'sandstone');
  }
  faces.forEach((F, i) => {
    const ww = i === 1 ? 0.36 : 0.22, mid = F.len / 2;
    const wins: [number, number, number, number][] = [[mid - ww, mid + ww, 5.15, 7.45], [mid - ww, mid + ww, 8.6, 11.1]];
    skin(b, F, 0, F.len, H.cordon[1], H.balc[0], wins, 'brick', 0.25);
    for (const r of speklagen({t0: 0, t1: F.len, bands: BANDS.slice(0, 8), openings: wins.map(w => ({t0: w[0] - 0.1, t1: w[1] + 0.1, y0: w[2] - 0.1, y1: w[3] + 0.1}))})) slab(b, F.f, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'concrete');
    for (const [t0, t1, y0, y1] of wins) {
      glazing(b, F, t0, t1, y0, y1, [y1 - 0.5]);
      for (const s of [-1, 1]) slab(b, F.f, (t0 + t1) / 2 + s * (ww + 0.05), y0, 0.1, y1 - y0, 0.08, 'sandstone');
      slab(b, F.f, (t0 + t1) / 2, y0 - 0.1, 2 * ww + 0.25, 0.12, 0.12, 'sandstone');
    }
    // carved stone frieze between the storeys (the 1919 date stone) and the narrow frieze under the top
    slab(b, F.f, mid, 7.5, F.len - 0.04, 0.85, 0.09, 'greyBrick');
    slab(b, F.f, mid, 11.3, F.len - 0.04, 0.3, 0.09, 'greyBrick');
  });
  // the oriel's top slab and its open parapet with ironwork
  const top = plan.map(([t, o]) => at(C, t, o + 0.08)).concat([at(C, P1 + 0.05, -0.3), at(C, P0 - 0.05, -0.3)]) as [number, number][];
  prism(b, top, H.balc[0], H.balc[1], 'sandstone');
  faces.forEach(F => balcony(b, F, 0.02, F.len - 0.02, H.balc[0], 0.3, false));
  // chamfer wall behind: brick, the balcony door with its arched field, frieze and eaves round the corner
  const bd: [number, number, number, number] = [L / 2 - 0.45, L / 2 + 0.45, H.balc[1], 14.9];
  skin(b, C, 0, L, H.balc[0], H.eaves, [bd], 'brick');
  glazing(b, C, bd[0], bd[1], bd[2], bd[3], [14.0], 2);
  slab(b, C.f, L / 2, 14.9, 1.2, 0.35, 0.1, 'greyBrick');
  for (const r of speklagen({t0: 0, t1: L, bands: BANDS.slice(8), openings: [{t0: bd[0] - 0.1, t1: bd[1] + 0.1, y0: bd[2], y1: bd[3] + 0.5}]})) slab(b, C.f, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'concrete');
  slab(b, C.f, L / 2, H.metope[0], 1.0, H.metope[1] - H.metope[0], 0.04, 'concrete');
  for (const t of [0.25, L - 0.25]) { slab(b, C.f, t, H.frieze, 0.24, 0.25, 0.14, 'greyBrick'); slab(b, C.f, t, H.beams[0], 0.2, 0.8, 0.58, 'blue'); }
  slab(b, C.f, L / 2, H.beams[1], L + 0.3, 0.13, 0.66, 'blue');
  slab(b, C.f, L / 2, H.beams[1] + 0.13, L + 0.4, H.eaves - H.beams[1] - 0.13, 0.72, 'blue');
  // the stepped crown over the corner: two treads a side, a stone finial on top
  const g = steppedGable({width: 2.3, y0: H.eaves, stepsPerSide: 2, rise: [0.8, 0.75, 0.7], run: 0.4, coping: 0.12, overhang: 0.06});
  for (const k of g.tiers) slab(b, C.f, L / 2 + (k.t0 + k.t1) / 2, k.y0, k.t1 - k.t0, k.y1 - k.y0, MANS_D, 'brick', -MANS_D + 0.02);
  for (const k of g.tiers) slab(b, C.f, L / 2, k.y0 + 0.3, k.t1 - k.t0 - 0.02, 0.12, 0.05, 'concrete', 0.02);
  for (const c of g.copings) slab(b, C.f, L / 2 + (c.t0 + c.t1) / 2, c.y, c.t1 - c.t0, c.h, MANS_D + 0.14, 'sandstone', -MANS_D);
  slab(b, C.f, L / 2, 17.95, 0.5, 0.7, 0.1, 'greyBrick', 0.02);
  slab(b, C.f, L / 2, g.top, 0.34, 0.35, 0.34, 'sandstone', -0.2);
  put(b, C.f, new T.ConeGeometry(0.14, 0.7, 6).translate(0, 0.35, 0), L / 2, g.top + 0.35, -0.03, 'sandstone');
}

// ---- the Utrechtsestraat stepped gable -------------------------------------------------------------------------------
function gable(b: BuildingTools) {
  const g = steppedGable({width: GABLE.w, y0: H.eaves, stepsPerSide: 4, rise: [0.9, 1.0, 1.0, 1.0, 1.05], run: [0.4, 0.5, 0.5, 0.5], coping: 0.12, overhang: 0.06});
  // the gable's lower part, in the frieze zone under it (the eaves are interrupted): brick to the first tier
  const t0 = GABLE.c - GABLE.w / 2, t1 = GABLE.c + GABLE.w / 2;
  slab(b, E.f, GABLE.c, H.beams[0], GABLE.w, H.eaves - H.beams[0], 0.06, 'brick');
  slab(b, E.f, GABLE.c, H.beams[1] - 0.05, GABLE.w + 0.2, 0.18, 0.2, 'sandstone');
  for (const k of g.tiers) slab(b, E.f, GABLE.c + (k.t0 + k.t1) / 2, k.y0, k.t1 - k.t0, k.y1 - k.y0, MANS_D, 'brick', -MANS_D + 0.06);
  for (const c of g.copings) slab(b, E.f, GABLE.c + (c.t0 + c.t1) / 2, c.y, c.t1 - c.t0, c.h, MANS_D + 0.16, 'sandstone', -MANS_D + 0.02);
  // two rows of paired sash windows in stone frames, and the recessed panels of the lowest tier
  const wins: [number, number, number, number][] = [];
  for (const [y0, y1] of [[17.3, 18.75], [19.15, 20.6]] as const) for (const sd of [-1, 1]) wins.push([GABLE.c + sd * 0.52 - 0.33, GABLE.c + sd * 0.52 + 0.33, y0, y1]);
  const panels: [number, number, number, number][] = [-1, 1].map(sd => [GABLE.c + sd * 2.2 - 0.35, GABLE.c + sd * 2.2 + 0.35, H.eaves + 0.15, H.eaves + 0.75]);
  for (const [p0, p1, y0, y1] of panels) slab(b, E.f, (p0 + p1) / 2, y0, p1 - p0, y1 - y0, 0.045, 'pink', 0.06);
  for (const [w0, w1, y0, y1] of wins) {
    const tc = (w0 + w1) / 2, ym = (y0 + y1) / 2;
    slab(b, E.f, tc, y0, w1 - w0, y1 - y0, 0.045, 'glass', 0.06);
    for (const sd of [-1, 1]) slab(b, E.f, tc + sd * 0.39, y0 - 0.1, 0.12, y1 - y0 + 0.3, 0.13, 'sandstone', 0.06);
    slab(b, E.f, tc, y0 - 0.1, 0.66, 0.1, 0.13, 'sandstone', 0.06);
    slab(b, E.f, tc, y1, 0.66, 0.2, 0.13, 'sandstone', 0.06);
    slab(b, E.f, tc, ym - 0.04, 0.66, 0.08, 0.09, 'frame', 0.06);
    slab(b, E.f, tc, y0, 0.06, ym - 0.04 - y0, 0.09, 'frame', 0.06);
    slab(b, E.f, tc, ym + 0.04, 0.06, y1 - ym - 0.04, 0.09, 'frame', 0.06);
  }
  // pale bands across each tier, stopped at the windows and panels, and brick colonnettes up each step edge to its coping
  const stops = [...wins, ...panels].map(([w0, w1, y0, y1]) => ({t0: w0 - 0.46 + 0.33, t1: w1 + 0.46 - 0.33, y0: y0 - 0.12, y1: y1 + 0.22}));
  for (const k of g.tiers) {
    const bands = [k.y0 + 0.35, k.y0 + 0.75].filter(y => y + 0.12 < k.y1).map(y => ({y, h: 0.12}));
    for (const r of speklagen({t0: GABLE.c + k.t0 + 0.01, t1: GABLE.c + k.t1 - 0.01, bands, openings: stops})) slab(b, E.f, (r.t0 + r.t1) / 2, r.y, r.t1 - r.t0, r.h, 0.05, 'concrete', 0.06);
    for (const sd of [-1, 1]) slab(b, E.f, GABLE.c + sd * ((k.t1 - k.t0) / 2 - 0.12), k.y0, 0.18, k.y1 - k.y0, 0.1, 'brick', 0.06);
  }
  slab(b, E.f, GABLE.c, g.top, 0.4, 0.3, 0.4, 'sandstone', -0.3);
  put(b, E.f, new T.ConeGeometry(0.15, 0.8, 6).translate(0, 0.4, 0), GABLE.c, g.top + 0.3, -0.1, 'sandstone');
  void t0; void t1;
}

// ---- dormers in the mansard ------------------------------------------------------------------------------------------
function dormers(b: BuildingTools) {
  const list: [Face, number, number][] = [[N, 1.3, 2.2], [N, 3.1, 4.0], [N, 5.1, 6.0], [N, 6.9, 7.8], [E, 8.75, 9.65]];
  for (const [F, t0, t1] of list) {
    const w = t1 - t0, tc = (t0 + t1) / 2, y0 = H.eaves, y1 = 19.0, o = -0.05;
    slab(b, F.f, tc, y0, w, y1 - y0, MANS_D + o, 'slate', -MANS_D);
    slab(b, F.f, tc, y1, w + 0.16, 0.12, MANS_D + o + 0.12, 'blue', -MANS_D);
    slab(b, F.f, tc, 17.6, w - 0.2, 1.15, 0.045, 'glass', o);
    slab(b, F.f, tc, 17.6, w - 0.2, 0.08, 0.09, 'frame', o);
    slab(b, F.f, tc, 18.67, w - 0.2, 0.08, 0.09, 'frame', o);
    for (const s of [-1, 1]) slab(b, F.f, tc + s * (w / 2 - 0.14), 17.68, 0.08, 0.99, 0.09, 'frame', o);
    slab(b, F.f, tc, 18.15, w - 0.36, 0.06, 0.09, 'frame', o);
  }
}
