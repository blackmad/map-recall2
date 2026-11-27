import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, disc, getSink, letters, poly, put, ringFrame, ringSlab, segBand, setSink, slab, type Frame} from './nearbar-kit';
import source from './metz-keizersgracht-455-footprints.json';

/**
 * KEIZERSGRACHT 455 (BAG pand 0363100012176395, rijksmonument 408905, BAG year 1892): the corner block on the Keizersgracht
 * and the Leidsestraat with the domed clock tower over its chamfered corner (the Metz & Co store).
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts), except the corner tower: every shell surface
 * whose centroid stands inside the tower square and that rises past 26 m (the 3DBAG's rough tower walls, dome and
 * lantern) is dropped and the tower is drawn here, square on the chamfer (BAG edge 10) as the 3DBAG walls place it
 * (x -2.85..1.45, z 2.8..7.25).
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0); every front shares one set of storey lines:
 *  - Keizersgracht front (ring vertex 3 to vertex 8, 15.6 m): whole-face rectified crop of b_20250120_0926_Track25_Sphere_00005
 *    (2025, 40 px/m), heights h = 2.44 + 0.02575 (1162 - y), which puts the cornice crown on the 3DBAG eaves (21.3 m);
 *    the 2022 brief crop w01-224.alt.jpg for the ornament. Symmetric: two 4.3 m pavilions round three centre axes.
 *  - Leidsestraat front (vertex 11 to vertex 20, 16.35 m): the same scheme mirrored (oblique 2022 view out of
 *    TMX7316010203-002860_pano_0000_000046 and the right wing of the aimed corner view); the brief crop shows the
 *    building across the street.
 *  - Chamfer (edge 10, 4.4 m): w03-175.jpg (2022, 50.45 px/m), h = (1393 - y) / 50.45.
 *  - Tower over the roof: pitched views out of TMX7316010203-002537_pano_0002_000574 (2022) and
 *    TMX7316010203-003014_pano_0005_000022 (2023), heights from the pitch fitted to the 3DBAG lantern top (38.3 m).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const R = src.facadeRing;
type V2 = [number, number];
// Ring vertices the fronts hang on (facade ring of bag-shell-prepare.ts); checked so a re-prepared ring fails loudly.
const V = (i: number, at: V2): V2 => {
  const p = R[i];
  if (!p || Math.hypot(p[0] - at[0], p[1] - at[1]) > 0.05) throw new Error(`metz: facade ring vertex ${i} moved (${p})`);
  return [p[0], p[1]];
};
const V3 = V(3, [-14.362, -3.71]), V7 = V(7, [-11.148, -0.864]), V8 = V(8, [-3.114, 7.126]);
const V11 = V(11, [1.53, 7.033]), V17 = V(17, [4.483, 4.669]), V18 = V(18, [10.948, -0.506]), V20 = V(20, [14.435, -3.007]);

/** A front frame on the line through a -> c, starting at the projection of `start`, ending at the projection of `end`. */
function lineFrame(a: V2, c: V2, start: V2, end: V2): {F: Frame; L: number} {
  const l = Math.hypot(c[0] - a[0], c[1] - a[1]), u: V2 = [(c[0] - a[0]) / l, (c[1] - a[1]) / l];
  const along = (p: V2) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
  const s = along(start), e = along(end);
  return {F: {origin: [a[0] + u[0] * s, a[1] + u[1] * s], tangent: u, n: [-u[1], u[0]]}, L: e - s};
}
const KG = lineFrame(V7, V8, V3, V8); // t from the party wall (north-west) to the corner; n faces the canal (SW)
const LS = lineFrame(V17, V18, V11, V20); // t from the corner to the party wall (north-east); n faces the Leidsestraat (SE)
const CH = ringFrame(R, 10); // the chamfer, t from its west end

type Col = 'stone' | 'sandstone' | 'ochre' | 'slate' | 'concrete' | 'glass' | 'frame' | 'dark' | 'red' | 'white' | 'bronze' | 'pink';
const S = (c: Col) => c as never;

// ---- storey lines (m above the 3DBAG ground), shared by every front ----
const H = {
  plinth: 0.45, shop: [0.45, 3.8] as V2, transom: [3.8, 4.5] as V2, mezz: [4.55, 7.0] as V2, entab: [7.0, 8.16] as V2,
  balus: [8.16, 8.67] as V2, r2: [8.7, 11.25] as V2, r3: [12.8, 15.2] as V2, r4: [16.9, 19.0] as V2,
  frieze: [19.3, 20.3] as V2, cornice: [20.3, 21.3] as V2,
};
const PAV = 4.3, WIN = 1.2, SMEAR_TOP = 21.7;

export function buildMetzKeizersgracht455(_w: number, _d: number, b: BuildingTools) {
  const inTower = (s: Surface) => {
    const pts = s.rings[0];
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    return Math.max(...pts.map(p => p[1])) > 26 && cx > -3.3 && cx < 1.9 && cz > 2.3 && cz < 7.6;
  };
  // The 3DBAG's mansard plane over the Keizersgracht front (one roof polygon rising from the 20.4 m eaves to 27.45 m,
  // 2.5 m back) runs through the glazed roof storey the photos show; it is replaced by the storey and slate skins.
  const kgMansard = (s: Surface) => {
    if (s.type !== 'RoofSurface') return false;
    const ys = s.rings[0].map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    const offs = s.rings[0].map(p => (p[0] - KG.F.origin[0]) * KG.F.n[0] + (p[2] - KG.F.origin[1]) * KG.F.n[1]);
    return lo < 20.7 && hi > 27.3 && Math.min(...offs) > -2.7 && Math.max(...offs) < 0.4;
  };
  // East of the tower square the 3DBAG smears the tower over the chamfer's diagonal (walls up to 29.6 m from the ground,
  // a 26.9-31.6 m sliver, and the tower roof over them): those walls are cut at the cornice-top line (21.7 m, the
  // Leidsestraat wall's own top) and the strip is closed by a stone cap, so no open shell edge runs up beside the tower.
  const smear = (s: Surface) => {
    const pts = s.rings[0], cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[2], 0) / pts.length;
    return s.type === 'WallSurface' && cx > 1.2 && cx < 2.7 && cz > 5.8 && cz < 7.2 && Math.max(...pts.map(p => p[1])) > 26;
  };
  const sliver = (s: Surface) => {
    const pts = s.rings[0], ys = pts.map(p => p[1]);
    return s.type === 'WallSurface' && Math.min(...ys) > 26 && pts.every(p => p[0] > 1.4 && p[0] < 2.9 && p[2] > 5.0 && p[2] < 5.5);
  };
  let cut = 0, dropped = 0;
  const surfaces = src.surfaces.map(s => smear(s) && ++cut ? {...s, rings: s.rings.map(r => r.map(p => [p[0], Math.min(p[1], SMEAR_TOP), p[2]]))} : s);
  if (cut !== 7) throw new Error(`metz: expected seven smeared chamfer walls east of the tower, cut ${cut}`);
  addShell(b, {...src, surfaces} as never, {wall: 'stone', roof: 'slate', skip: s => (inTower(s) && !smear(s)) || sliver(s) || (kgMansard(s) && ++dropped > 0)});
  put(b, {origin: [0, 0], tangent: [1, 0], n: [0, 1]}, new T.BoxGeometry(1.7, 0.3, 2.05).translate(0, 0.15, 0), 2.05, SMEAR_TOP, 6.125, S('stone'));
  if (dropped !== 1) throw new Error(`metz: expected one Keizersgracht mansard roof polygon, dropped ${dropped}`);
  const sink0 = getSink();
  setSink(0.06, true);
  front(b, KG.F, KG.L, {mirror: false, doorOut: 0.5, cornerOut: 0.1});
  front(b, LS.F, LS.L, {mirror: true, doorOut: 0.45, cornerOut: 0.1});
  chamfer(b);
  tower(b);
  sign(b);
  setSink(sink0);
}

/** A window: dark frame ring, glass, a mullion and a transom near the head. */
function windowAt(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, out = 0, transom = 0.74) {
  // the glass face 6 cm before the frame's and the bars 4 cm before the glass (fronts closer than ~4 cm z-fight at gallery distance)
  slab(b, F, t, y0 - 0.06, w + 0.12, y1 - y0 + 0.12, 0.05, S('frame'), out);
  slab(b, F, t, y0, w, y1 - y0, 0.11, S('glass'), out);
  // the mullion stands on the glass (not sunk into the wall): a deep narrow bar reads to the openings gate as a side-facing part
  put(b, F, new T.BoxGeometry(0.09, (y1 - y0) * transom, 0.04).translate(0, (y1 - y0) * transom / 2, 0.02), t, y0, out + 0.11, S('frame'));
  slab(b, F, t, y0 + (y1 - y0) * transom, w, 0.07, 0.15, S('frame'), out);
}
/** Stone surround (architrave) round a window with a sill. */
function surround(b: BuildingTools, F: Frame, t: number, w: number, y0: number, y1: number, out = 0) {
  for (const s of [-1, 1]) slab(b, F, t + s * (w / 2 + 0.11), y0 - 0.05, 0.16, y1 - y0 + 0.2, 0.16, S('stone'), out);
  slab(b, F, t, y1 + 0.03, w + 0.38, 0.14, 0.16, S('stone'), out);
  slab(b, F, t, y0 - 0.2, w + 0.5, 0.14, 0.24, S('stone'), out);
}
/** Triangular pediment hood over a window: tympanum, raking cornice and a base cornice. */
function pediment(b: BuildingTools, F: Frame, t: number, y: number, w: number, h: number, out = 0, broken = false) {
  slab(b, F, t, y, w, 0.16, 0.3, S('stone'), out);
  if (!broken) {
    poly(b, F, t, y + 0.16, [[-w / 2 + 0.1, 0], [w / 2 - 0.1, 0], [0, h - 0.16]], 0.14, S('sandstone'), out);
    for (const s of [-1, 1]) poly(b, F, t, y + 0.16, [[s * (w / 2), 0], [s * (w / 2 - 0.2), 0], [0, h - 0.3], [0, h - 0.1]].map(p => p as V2), 0.3, S('stone'), out);
  } else {
    // broken pediment: two raking stubs and a cartouche between them
    for (const s of [-1, 1]) poly(b, F, t, y + 0.16, [[s * (w / 2), 0], [s * (w / 2 - 0.55), 0], [s * 0.35, (h - 0.16) * 0.7 - 0.12], [s * 0.35, (h - 0.16) * 0.7]].map(p => p as V2), 0.3, S('stone'), out);
    slab(b, F, t, y + 0.16, 0.55, h - 0.1, 0.32, S('sandstone'), out);
    disc(b, F, t, y + 0.16 + (h - 0.1) * 0.55, 0.2, 0.08, S('stone'), out + 0.32);
  }
}
/** A standing figure (caryatid) on its plinth against a pier: plinth, tapered body, head, capital. */
function caryatid(b: BuildingTools, F: Frame, t: number, y0: number, y1: number, out = 0) {
  const h = y1 - y0;
  slab(b, F, t, y0, 0.5, 0.35, 0.36, S('stone'), out);
  put(b, F, new T.CylinderGeometry(0.2, 0.15, h * 0.62, 6).translate(0, h * 0.31, 0.2), t, y0 + 0.35, out, S('ochre'));
  put(b, F, new T.SphereGeometry(0.13, 6, 4).translate(0, 0, 0.2), t, y0 + 0.35 + h * 0.62 + 0.12, out, S('ochre'));
  slab(b, F, t, y1 - 0.3, 0.52, 0.3, 0.38, S('stone'), out);
}
/** Pierced stone balustrade: rail, base and dark slots. */
function balustrade(b: BuildingTools, F: Frame, t: number, y: number, w: number, h: number, out: number, round = false) {
  slab(b, F, t, y, w, 0.12, 0.34, S('stone'), out);
  slab(b, F, t, y + h - 0.12, w + 0.06, 0.12, 0.36, S('stone'), out);
  slab(b, F, t, y + 0.12, w, h - 0.24, 0.22, S('stone'), out);
  const n = Math.max(3, Math.round(w / 0.3));
  for (let k = 0; k < n; k++) {
    const x = t - w / 2 + (k + 0.5) * w / n;
    if (round) disc(b, F, x, y + h / 2, 0.07, 0.08, S('sandstone'), out + 0.2);
    else slab(b, F, x, y + 0.16, 0.08, h - 0.32, 0.08, S('sandstone'), out + 0.2);
  }
}

/** One street front: door pavilion at u = 0..PAV, three centre axes, corner pavilion; `mirror` puts the door pavilion at t = L. */
function front(b: BuildingTools, F: Frame, L: number, o: {mirror: boolean; doorOut: number; cornerOut: number}) {
  const T_ = (u: number) => (o.mirror ? L - u : u);
  const mid = L / 2, axes = [mid - 2.4, mid, mid + 2.4];
  const pavs = [{u0: 0, u1: PAV, out: o.doorOut, door: true}, {u0: L - PAV, u1: L, out: o.cornerOut, door: false}];
  // plinth over the whole front
  slab(b, F, mid, 0, L - 0.12, H.plinth, 0.24, S('sandstone'), 0); // ends 6 cm off the party walls
  // ---- pavilions ----
  for (const p of pavs) {
    const tc = T_((p.u0 + p.u1) / 2), out = p.out;
    // banded edge piers full height
    for (const e of [p.u0 + 0.3, p.u1 - 0.3]) {
      const te = T_(e);
      slab(b, F, te, H.plinth, 0.6, H.frieze[0] - H.plinth, 0.12, S('stone'), out);
      for (let y = H.plinth + 0.55; y < H.frieze[0] - 0.2; y += 0.6) slab(b, F, te, y, 0.5, 0.06, 0.16, S('sandstone'), out); // 5 cm inside the pier each side: flush end faces z-fight
    }
    if (p.door) {
      // carved doorway: dark wooden double door, a segmental pediment with a cartouche, mezzanine window above
      slab(b, F, tc, H.plinth, 2.2, 3.5, 0.06, S('stone'), out);
      slab(b, F, tc, H.plinth, 1.7, 3.35, 0.12, S('red'), out);
      for (const s of [-1, 1]) for (const [y0, y1] of [[0.8, 2.0], [2.2, 3.5]]) slab(b, F, tc + s * 0.42, y0, 0.6, y1 - y0, 0.16, S('red'), out);
      slab(b, F, tc, H.plinth + 3.35, 1.9, 0.14, 0.2, S('frame'), out);
      for (const s of [-1, 1]) slab(b, F, tc + s * 1.05, H.plinth, 0.3, 3.55, 0.28, S('stone'), out);
      segBand(b, F, tc, 4.0, 2.5, 0.55, 0.2, 0.36, S('stone'), out);
      slab(b, F, tc, 3.86, 2.6, 0.16, 0.36, S('stone'), out);
      slab(b, F, tc, 4.02, 0.8, 0.75, 0.4, S('sandstone'), out);
      disc(b, F, tc, 4.4, 0.22, 0.06, S('stone'), out + 0.4);
      windowAt(b, F, tc, 2.0, H.mezz[0] + 0.55, H.mezz[1], out);
    } else {
      // shop window and the mezzanine window over it in the stone pavilion
      // the 3DBAG steps this pavilion's ground storey back at the jog under its east half: the shop window stands on the stone
      slab(b, F, tc, H.shop[0], 3.0, H.shop[1] - H.shop[0], 0.14, S('stone'), out);
      windowAt(b, F, tc, 2.7, H.shop[0] + 0.15, H.shop[1], out + 0.14, 0.85);
      slab(b, F, tc, H.transom[0], 2.9, 0.18, 0.3, S('stone'), out);
      windowAt(b, F, tc, 2.6, H.mezz[0] + 0.1, H.mezz[1] - 0.1, out, 0.8);
    }
    // second storey: window between two figures on a balustrade, a triangular pediment over it
    balustrade(b, F, tc, H.balus[0], 2.6, H.balus[1] - H.balus[0] + 0.05, out);
    windowAt(b, F, tc, WIN, H.r2[0], H.r2[1], out);
    for (const s of [-1, 1]) caryatid(b, F, tc + s * 1.0, H.balus[1], H.r2[1] + 0.1, out);
    pediment(b, F, tc, H.r2[1] + 0.15, 2.4, 0.85, out);
    // third storey: segmental hood with a relief block
    surround(b, F, tc, WIN, H.r3[0], H.r3[1], out);
    windowAt(b, F, tc, WIN, H.r3[0], H.r3[1], out);
    segBand(b, F, tc, H.r3[1] + 0.25, 2.0, 0.55, 0.18, 0.3, S('stone'), out);
    slab(b, F, tc, H.r3[1] + 0.2, 2.0, 0.14, 0.3, S('stone'), out);
    slab(b, F, tc, H.r3[1] + 0.36, 0.9, 0.38, 0.22, S('sandstone'), out);
    // fourth storey
    surround(b, F, tc, WIN, H.r4[0], H.r4[1], out);
    windowAt(b, F, tc, WIN, H.r4[0], H.r4[1], out);
    if (p.door) attic(b, F, tc, out);
  }
  // ---- centre: the two-storey dark shopfront ----
  const c0 = T_(PAV), c1 = T_(L - PAV), cw = Math.abs(c1 - c0) - 0.2;
  slab(b, F, mid, H.plinth, cw, H.mezz[1] - H.plinth, 0.08, S('dark'), 0);
  for (const [y0, y1] of [[H.shop[0] + 0.1, H.shop[1] - 0.05], [H.mezz[0] + 0.05, H.mezz[1] - 0.12]] as V2[]) {
    slab(b, F, mid, y0, cw - 0.3, y1 - y0, 0.12, S('glass'), 0);
    for (const x of [-1, 1]) slab(b, F, mid + x * cw / 6, y0, 0.12, y1 - y0, 0.17, S('dark'), 0);
    slab(b, F, mid, y0 - 0.04, cw - 0.3, 0.08, 0.17, S('dark'), 0);
  }
  slab(b, F, mid, H.transom[0], cw, H.transom[1] - H.transom[0] + 0.05, 0.18, S('dark'), 0);
  // entablature over the shop storeys, with its cornice
  slab(b, F, mid, H.entab[0], L - 0.04, H.entab[1] - H.entab[0], 0.2, S('stone'), 0);
  slab(b, F, mid, H.entab[0] + 0.3, L - 0.14, 0.3, 0.3, S('sandstone'), 0); // 8 cm before the corner pavilion's piers
  slab(b, F, mid, H.entab[1] - 0.16, L, 0.16, 0.4, S('stone'), 0);
  // centre axes: three storeys of windows between panelled pilasters
  const pil = [T_(PAV), (axes[0] + axes[1]) / 2, (axes[1] + axes[2]) / 2, T_(L - PAV)];
  for (const x of pil) {
    slab(b, F, x, H.entab[1], 0.5, H.frieze[0] - H.entab[1], 0.12, S('stone'), 0);
    for (let y = H.entab[1] + 0.4; y < H.frieze[0] - 0.5; y += 0.62) slab(b, F, x, y, 0.3, 0.38, 0.16, S('sandstone'), 0);
  }
  for (const [k, t] of axes.entries()) {
    slab(b, F, t, H.balus[0], 1.6, 0.5, 0.18, S('stone'), 0);
    for (const r of [H.r2, H.r3, H.r4]) { surround(b, F, t, WIN, r[0], r[1]); windowAt(b, F, t, WIN, r[0], r[1]); }
    pediment(b, F, t, H.r3[1] + 0.2, 1.9, 1.3, 0, k === 1);
    slab(b, F, t, H.r2[1] + 0.2, 1.7, 0.16, 0.24, S('stone'), 0);
  }
  // the middle axis's balcony under the third-storey window
  slab(b, F, axes[1], 11.9, 2.1, 0.18, 0.75, S('stone'), 0);
  for (const s of [-1, 1]) slab(b, F, axes[1] + s * 0.75, 11.45, 0.25, 0.45, 0.6, S('stone'), 0);
  balustrade(b, F, axes[1], 12.08, 2.0, 0.72, 0.5, true);
  // string courses
  for (const y of [H.r2[1] + 0.95, H.r3[1] + 1.55]) slab(b, F, mid, y, L - 0.04, 0.14, 0.22, S('stone'), 0); // 6 cm before the pilaster panels
  // frieze, dentils, modillion cornice
  slab(b, F, mid, H.frieze[0], L - 0.04, H.frieze[1] - H.frieze[0], 0.16, S('stone'), 0);
  for (let x = 0.2; x < L - 0.1; x += 0.3) slab(b, F, x, H.frieze[1] - 0.22, 0.14, 0.18, 0.26, S('sandstone'), 0);
  slab(b, F, mid, H.cornice[0], L, 0.2, 0.34, S('stone'), 0);
  for (let x = 0.35; x < L - 0.2; x += 0.62) slab(b, F, x, H.cornice[0] + 0.2, 0.2, 0.45, 0.6, S('stone'), 0);
  slab(b, F, mid, H.cornice[0] + 0.65, L + 0.1, 0.35, 0.8, S('stone'), 0);
  // a pale parapet on the wall top over the centre axes; on the Keizersgracht the glazed roof storey behind it
  slab(b, F, mid, H.cornice[1], Math.abs(c1 - c0), 0.75, 0.3, S('stone'), -0.05);
  if (!o.mirror) {
    glassStorey(b, F, PAV + 0.3, L - PAV + 0.55);
    slateSkin(b, F, PAV - 0.1, PAV + 0.3);
    slateSkin(b, F, L - PAV + 0.55, L);
  }
}

/**
 * Glazed roof storey over the Keizersgracht centre (2025 crop: glass 21.6-24.4 m between dark posts, a low light row, the
 * pale coping to 25.0 m), standing on the wall line behind the cornice; a slate deck runs back from the coping to the
 * shell's leaning wall (o -0.92 at 23.45 m to o -1.76 at 27.13 m), which carries on to the 27 m roof.
 */
function glassStorey(b: BuildingTools, F: Frame, t0: number, t1: number) {
  const w = t1 - t0, tc = (t0 + t1) / 2, g0 = H.cornice[1] + 0.75, g1 = 24.4, o = -0.35;
  slab(b, F, tc, H.cornice[1], w, g1 - H.cornice[1], 1.15, S('slate'), -1.6); // the storey's body back to the shell wall, its face 16 cm behind the glass face
  slab(b, F, tc, H.cornice[1], w, g0 - H.cornice[1], 0.15, S('slate'), -0.45); // the sill wall under the glazing
  slab(b, F, tc, g0, w, g1 - g0, 0.06, S('glass'), o);
  const n = 10;
  for (let k = 0; k <= n; k++) slab(b, F, t0 + k * w / n, g0, 0.09, g1 - g0, 0.12, S('bronze'), o);
  slab(b, F, tc, g0 + 0.7, w, 0.08, 0.12, S('bronze'), o);
  slab(b, F, tc, g1, w + 0.1, 0.6, 1.5, S('stone'), -1.3); // coping
}
/** Slate mansard skin from the cornice crown on the wall line back to the shell's 27 m roof edge (o -2.3). */
function slateSkin(b: BuildingTools, F: Frame, t0: number, t1: number) {
  const y0 = H.cornice[1], y1 = 27.0;
  const sh = new T.Shape([new T.Vector2(0.05, 0), new T.Vector2(-2.35, y1 - y0), new T.Vector2(-2.6, y1 - y0), new T.Vector2(-2.6, 0)]);
  const g = new T.ExtrudeGeometry(sh, {depth: t1 - t0, bevelEnabled: false});
  // shape (x = o, y) extruded along +z: turn it so the extrusion runs along t from t0 and x points out of the wall
  g.rotateY(-Math.PI / 2).translate(t1 - t0, 0, 0).translate(-(t1 - t0) / 2, 0, 0);
  put(b, F, g, (t0 + t1) / 2, y0, 0, S('slate'));
}

/** Door-pavilion attic over the cornice: stone face, two round-headed lights, entablature, triangular pediment, finial. */
function attic(b: BuildingTools, F: Frame, tc: number, out: number) {
  const y0 = H.cornice[1];
  slab(b, F, tc, y0, 3.9, 2.8, 0.5, S('stone'), out - 0.3);
  for (const s of [-1, 1]) {
    archSlab(b, F, tc + s * 0.55, y0 + 0.45, 0.75, 1.75, 0.08, S('frame'), out + 0.2);
    archSlab(b, F, tc + s * 0.55, y0 + 0.5, 0.62, 1.65, 0.15, S('glass'), out + 0.2);
    slab(b, F, tc + s * 1.65, y0, 0.45, 2.8, 0.3, S('stone'), out + 0.2);
  }
  slab(b, F, tc, y0 + 2.8, 4.1, 0.35, 0.6, S('stone'), out - 0.3);
  poly(b, F, tc, y0 + 3.15, [[-2.0, 0], [2.0, 0], [0, 0.95]], 0.5, S('stone'), out - 0.3);
  poly(b, F, tc, y0 + 3.2, [[-1.6, 0], [1.6, 0], [0, 0.7]], 0.1, S('sandstone'), out + 0.2);
  put(b, F, new T.ConeGeometry(0.12, 0.7, 6).translate(0, 0.35, 0), tc, y0 + 4.05, out, S('stone'));
}

/** The chamfer: tall corner door, carved consoles, figures, the bowed and the straight balconies, fluted columns, cornice, attic. */
function chamfer(b: BuildingTools) {
  const F = CH.f, L = CH.len, tc = L / 2;
  slab(b, F, tc, 0, L, H.plinth, 0.24, S('sandstone'));
  // door with a two-light transom, the white mezzanine panel, carved side panels and consoles
  slab(b, F, tc, H.plinth, 2.3, 2.9, 0.06, S('red'));
  slab(b, F, tc, H.plinth + 0.05, 1.8, 2.2, 0.12, S('dark'));
  for (const s of [-1, 1]) slab(b, F, tc + s * 0.45, 2.65, 0.7, 0.45, 0.12, S('glass'));
  slab(b, F, tc, 3.8, 2.2, 2.0, 0.1, S('white'));
  for (const s of [-1, 1]) {
    slab(b, F, tc + s * 1.62, H.plinth, 0.9, H.entab[0] - H.plinth, 0.12, S('stone'));
    slab(b, F, tc + s * 1.62, 3.1, 0.6, 1.6, 0.2, S('sandstone'));
    slab(b, F, tc + s * 1.55, 5.8, 0.55, 1.4, 0.5, S('stone')); // console
    slab(b, F, tc + s * 1.55, 6.2, 0.4, 0.8, 0.62, S('sandstone'));
    // wall lanterns on brackets
    slab(b, F, tc + s * 1.55, 2.0, 0.06, 0.06, 0.45, S('bronze'));
    slab(b, F, tc + s * 1.55, 1.3, 0.28, 0.7, 0.28, S('bronze'), 0.3);
    slab(b, F, tc + s * 1.55, 2.0, 0.36, 0.1, 0.36, S('bronze'), 0.26);
  }
  slab(b, F, tc, H.entab[0], L, H.entab[1] - H.entab[0], 0.45, S('stone'));
  slab(b, F, tc, H.entab[1] - 0.16, L + 0.1, 0.16, 0.62, S('stone'));
  // second storey: window between figures, on a balustrade
  balustrade(b, F, tc, H.balus[0], 2.8, H.balus[1] - H.balus[0] + 0.05, 0);
  windowAt(b, F, tc, 1.3, H.r2[0], H.r2[1]);
  for (const s of [-1, 1]) caryatid(b, F, tc + s * 1.15, H.balus[1], H.r2[1] + 0.1);
  // bowed balcony on a basket corbel under the third-storey window
  put(b, F, new T.CylinderGeometry(0.95, 0.25, 1.0, 10, 1, false, Math.PI / 2, Math.PI).translate(0, 0.5, 0), tc, 11.2, 0.05, S('stone'));
  put(b, F, new T.CylinderGeometry(0.95, 0.95, 0.7, 10, 1, false, Math.PI / 2, Math.PI).translate(0, 0.35, 0), tc, 12.2, 0.05, S('stone'));
  for (let k = 0; k < 5; k++) { const a = Math.PI * (k + 0.5) / 5 - Math.PI / 2; slab(b, F, tc + Math.sin(a) * 0.96, 12.35, 0.08, 0.4, 0.02, S('sandstone'), 0.05 + Math.cos(a) * 0.95); }
  // third and fourth storeys between fluted colossal columns, the straight balcony between them
  for (const r of [H.r3, H.r4]) { surround(b, F, tc, 1.3, r[0], r[1]); windowAt(b, F, tc, 1.3, r[0], r[1]); }
  slab(b, F, tc, 15.6, 2.3, 0.16, 0.55, S('stone'));
  balustrade(b, F, tc, 15.76, 2.1, 0.9, 0.3);
  for (const s of [-1, 1]) {
    const x = tc + s * 1.82;
    slab(b, F, x, 12.5, 0.6, 0.5, 0.5, S('stone'));
    put(b, F, new T.CylinderGeometry(0.22, 0.25, 6.3, 12).translate(0, 3.15, 0.26), x, 13.0, 0, S('stone'));
    for (let k = 0; k < 6; k++) put(b, F, new T.BoxGeometry(0.03, 6.2, 0.04).translate(0, 3.1, 0), x + Math.sin(k / 6 * Math.PI - Math.PI / 2 + 0.26) * 0.24, 13.05, 0.26 + Math.cos(k / 6 * Math.PI - Math.PI / 2 + 0.26) * 0.24, S('sandstone'));
    slab(b, F, x, 19.3, 0.62, 0.5, 0.56, S('stone')); // capital
  }
  // frieze and cornice continue round the corner
  slab(b, F, tc, H.frieze[0], L, H.frieze[1] - H.frieze[0], 0.2, S('stone'));
  slab(b, F, tc, H.cornice[0], L + 0.2, 0.2, 0.36, S('stone'));
  for (let x = 0.3; x < L - 0.1; x += 0.62) slab(b, F, x, H.cornice[0] + 0.2, 0.2, 0.45, 0.62, S('stone'));
  slab(b, F, tc, H.cornice[0] + 0.65, L + 0.4, 0.35, 0.85, S('stone'));
  // attic: two small lights under a semicircular pediment with a carved relief, side scrolls, an entablature
  const a0 = H.cornice[1];
  for (const s of [-1, 1]) windowAt(b, F, tc + s * 0.5, 0.65, a0 + 0.3, a0 + 0.95, 0.05, 0.99);
  slab(b, F, tc, a0 + 1.0, 3.5, 0.16, 0.3, S('stone'));
  archBand(b, F, tc, a0 + 1.16, 3.4, 1.7, 0.24, 0.4, S('stone'), 0, 12);
  archSlab(b, F, tc, a0 + 1.16, 2.9, 1.45, 0.12, S('sandstone'), 0, 12);
  slab(b, F, tc, a0 + 1.4, 1.2, 0.9, 0.25, S('stone'), 0.1); // relief
  disc(b, F, tc, a0 + 2.1, 0.32, 0.12, S('sandstone'), 0.2);
  for (const s of [-1, 1]) {
    disc(b, F, tc + s * 1.85, a0 + 0.7, 0.4, 0.3, S('stone'));
    ringSlab(b, F, tc + s * 1.85, a0 + 0.7, 0.15, 0.3, 0.06, S('sandstone'), 0.3);
  }
  slab(b, F, tc, a0 + 3.95, L, 0.35, 0.3, S('stone'));
  slab(b, F, tc, a0 + 4.3, L + 0.2, 0.15, 0.4, S('stone'));
}

/** Tower frames: `side` 0 = south (the chamfer), 1 = west, 2 = north, 3 = east, at half-width `a` from the tower axis. */
const TOWER = {t: 2.2, o: -2.22, a: 2.2};
function towerFace(side: number, a: number): Frame {
  const F = CH.f, ang = [0, -Math.PI / 2, Math.PI, Math.PI / 2][side];
  const [s, c] = [Math.sin(ang), Math.cos(ang)];
  const n: V2 = [F.tangent[0] * s + F.n[0] * c, F.tangent[1] * s + F.n[1] * c];
  const tangent: V2 = [F.tangent[0] * c - F.n[0] * s, F.tangent[1] * c - F.n[1] * s];
  const cx = F.origin[0] + F.tangent[0] * TOWER.t + F.n[0] * TOWER.o, cz = F.origin[1] + F.tangent[1] * TOWER.t + F.n[1] * TOWER.o;
  return {origin: [cx + n[0] * a - tangent[0] * 0, cz + n[1] * a - tangent[1] * 0], tangent, n};
}
/** Square-plan lathe (4 sides, faces square to the tower) of half-widths `prof` [halfWidth, y]. */
const squareLathe = (prof: V2[]) => new T.LatheGeometry(prof.map(([a, y]) => new T.Vector2(a * Math.SQRT2, y)), 4, Math.PI / 4);

/** The corner tower: shaft, ledge with balls, clock stage, cornice, bell dome with lucarnes, open lantern, ball and spike. */
function tower(b: BuildingTools) {
  const F = CH.f, at = (g: T.BufferGeometry, y: number, c: Col) => put(b, F, g, TOWER.t, y, TOWER.o, S(c));
  // shaft from the ground (hidden below the roofs) to the ledge, in the facade stone
  at(new T.BoxGeometry(4.3, 27.3, 4.44).translate(0, 27.3 / 2, 0), 0, 'stone'); // 5 cm inside the chamfer's ends
  at(new T.BoxGeometry(4.75, 0.35, 4.8).translate(0, 0.175, 0), 27.15, 'stone');
  // the shaft's west and east faces above the roofs: two banded pilaster strips each
  for (const side of [1, 3]) {
    const Fs = towerFace(side, 2.22);
    for (const s of [-1, 1]) slab(b, Fs, s * 1.85, 22.0, 0.5, 5.15, 0.12, S('sandstone'));
    slab(b, Fs, 0, 25.9, 4.3, 0.3, 0.16, S('stone'));
  }
  for (const [x, z] of [[-2.15, -2.15], [2.15, -2.15], [-2.15, 2.15], [2.15, 2.15]]) {
    at(new T.BoxGeometry(0.45, 0.35, 0.45).translate(x, 0.175, z), 27.5, 'stone');
    at(new T.SphereGeometry(0.24, 8, 6).translate(x, 0.55, z), 27.5, 'stone');
  }
  // clock stage 27.5-31.0 with corner pilasters, the cornice 31.0-31.6
  at(new T.BoxGeometry(4.0, 3.5, 4.0).translate(0, 1.75, 0), 27.5, 'stone');
  for (const [x, z] of [[-1.9, -1.9], [1.9, -1.9], [-1.9, 1.9], [1.9, 1.9]]) at(new T.BoxGeometry(0.42, 3.5, 0.42).translate(x, 1.75, z), 27.5, 'sandstone');
  at(new T.BoxGeometry(4.3, 0.25, 4.3).translate(0, 0.125, 0), 31.0, 'stone');
  at(new T.BoxGeometry(4.55, 0.35, 4.55).translate(0, 0.175, 0), 31.25, 'stone');
  for (const side of [0, 1, 2, 3]) {
    const Fs = towerFace(side, 2.0);
    if (side === 1 || side === 3) {
      // clock: white face in a dark ring, four hour blocks, two hands
      ringSlab(b, Fs, 0, 29.3, 0.58, 0.7, 0.08, S('dark'), 0, 16);
      disc(b, Fs, 0, 29.3, 0.58, 0.06, S('white'));
      for (let k = 0; k < 4; k++) slab(b, Fs, Math.sin(k * Math.PI / 2) * 0.47, 29.3 + Math.cos(k * Math.PI / 2) * 0.47 - 0.05, 0.08, 0.1, 0.09, S('dark'));
      slab(b, Fs, 0, 29.3, 0.06, 0.42, 0.1, S('dark'));
      put(b, Fs, new T.BoxGeometry(0.32, 0.06, 0.1).translate(0.13, 0, 0.05), 0, 29.3, 0, S('dark'));
      slab(b, Fs, 0, 28.25, 2.0, 0.12, 0.12, S('sandstone'));
    } else {
      slab(b, Fs, 0, 28.0, 2.6, 2.6, 0.06, S('sandstone'));
      slab(b, Fs, 0, 28.2, 2.2, 2.2, 0.1, S('stone'));
    }
  }
  // bell dome on a square plan, 31.6-36.2, with an oeil-de-boeuf lucarne on each face
  at(squareLathe([[0, 31.6], [2.08, 31.6], [2.14, 32.2], [2.08, 32.9], [1.85, 33.8], [1.45, 34.8], [1.0, 35.6], [0.82, 36.2], [0, 36.2]]).translate(0, 0, 0), 0, 'concrete');
  for (const side of [0, 1, 2, 3]) {
    const Fs = towerFace(side, 1.95);
    archSlab(b, Fs, 0, 32.0, 0.95, 1.0, 0.35, S('concrete'), 0, 8);
    disc(b, Fs, 0, 32.5, 0.27, 0.41, S('dark'));
    ringSlab(b, Fs, 0, 32.5, 0.27, 0.38, 0.47, S('stone'), 0, 12);
  }
  // open lantern: base, eight columns round a dark core, entablature, cap dome, ball, spike
  at(new T.CylinderGeometry(0.92, 0.92, 0.22, 8).translate(0, 0.11, 0), 36.2, 'stone');
  at(new T.CylinderGeometry(0.42, 0.42, 1.5, 8).translate(0, 0.75, 0), 36.42, 'dark');
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; at(new T.CylinderGeometry(0.07, 0.07, 1.5, 5).translate(Math.sin(a) * 0.72, 0.75, Math.cos(a) * 0.72), 36.42, 'stone'); }
  at(new T.CylinderGeometry(0.95, 0.88, 0.38, 8).translate(0, 0.19, 0), 37.92, 'stone');
  at(new T.LatheGeometry([[0, 0], [0.82, 0], [0.75, 0.3], [0.5, 0.6], [0.18, 0.78], [0, 0.8]].map(([x, y]) => new T.Vector2(x, y)), 8), 38.3, 'concrete');
  at(new T.SphereGeometry(0.28, 10, 8).translate(0, 0.28, 0), 39.05, 'concrete');
  at(new T.ConeGeometry(0.05, 0.85, 5).translate(0, 0.42, 0), 39.6, 'bronze');
}

/** METZ in tall pale letters under a flat steel arc, on legs on the 27 m roof about 3 m behind the Keizersgracht cornice (27.4-28.9 m once the 2025 crop's projection is undone). */
function sign(b: BuildingTools) {
  const F = KG.F, t = 9.25, out = -3.0, y0 = 27.55;
  const px = 0.25, pxY = 0.2;
  letters(b, F, 'METZ', t, y0 - 0.1, out, px, 0.12, S('pink'), pxY);
  // the frame is a flat arc (2025 crop: 6 m chord, 1.3 m over the letter feet)
  segBand(b, F, t, y0 - 0.15, 6.4, 1.9, 0.12, 0.1, S('bronze'), out - 0.02);
  slab(b, F, t, y0 - 0.2, 6.4, 0.12, 0.12, S('bronze'), out - 0.02);
  for (const s of [-1, 0, 1]) slab(b, F, t + s * 2.4, 26.9, 0.1, 0.55, 0.1, S('bronze'), out - 0.02);
}
