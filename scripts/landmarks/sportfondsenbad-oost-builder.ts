/**
 * Sportfondsenbad Oost: the retort house (stokerij) of the Oostergasfabriek (1886-87, attributed to I. Gosschalk with
 * J. Pazzani, possibly worked out by B.J. Ouendag), gemeentelijk monument 200525, the first Sportfondsenbad of the
 * Netherlands since 1929 (C. van Amstel, then H. and H.A.J. Baanders). BAG panden 0363100012236677 (north part, the pool)
 * and 0363100012236879 (south part, former machine room / milk factory, now a gym; the round chimney on its west side).
 *
 * Everything below comes from the Gemeente Amsterdam panoramas (CC BY 4.0) listed in
 * scripts/landmarks/sportfondsenbad-oost-inventory.json, the monument register text (cached in the brief), the PDOK
 * orthophoto (roof glazing, plant), AHN4 (chimney top) and the BAG/3DBAG rings and roofs (sportfondsenbad-oost-footprints.json).
 * Nothing is described from memory.
 *
 *  - Two parallel saddle-roofed halls (3DBAG eaves 13.5 m, ridges 19.6 m, 32 deg), 69 m long, gable ends north
 *    (Land van Cocagneplein, above the 2014 one-storey shop block) and south (square, gym entrance).
 *  - Gable ends (north-1 2022, view-s4 2021): per hall big pilasters at the corners, the apex and the valley; the apex
 *    pilaster runs past the ridge to 21.3 m with a stone cap and a fleur-de-lis wall anchor. Below the 8.3 m dentil band
 *    a dense pier grid (3.1 m) with star anchors; above it per half-hall one light group of three round-headed windows
 *    (centre taller) under a pointed (keperboog) brick band; the gable rake follows the roof with a dentil band beneath.
 *    North: the light groups are bricked up (blind arches, one glazed centre light each); south: glazed iron windows,
 *    and two rows of modern square windows in the pier grid.
 *  - West side (westS 2019/2016, w01-251 2018/2023): eleven bays between pilasters, a triplet of round-headed clerestory
 *    windows in each, dentil bands; in the southernmost bay the one surviving large round-arched (railway) opening,
 *    glazed, and the corner pilaster rising past the eaves (the "torentje").
 *  - The round chimney (pool boilers, 1929) in front of the west side: 30.6 m (AHN4), tapering, banded.
 *  - Roof: dark sheets, a glazed strip either side of each ridge over the pool (orthophoto), the gym's roof plant.
 *  - East side: hidden behind the 2014 HEMA block (15.5 m); plain brick with its pilasters.
 *
 * Geometry is authored in the hall frame (u across the halls towards ENE, v along them towards SSE, metres, y up) and
 * rotated into the native frame (x east, z south) by rotateY(18.568 deg); see sportfondsenbad-oost-prepare.ts.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planarPolygon} from './worship-shell';
import {setSink, slab, archSlab, archBand, put, poly, type Frame} from './nearbar-kit';
import plan from './sportfondsenbad-oost-footprints.json';

type V = [number, number];
const ANGLE = (plan.hallFrameDeg * Math.PI) / 180;
let b: BuildingTools;     // wrapped: everything added is rotated from the hall frame into the native frame
let raw: BuildingTools;

// ---------------------------------------------------------------------------------------------------- measurements
const UW = -14.85, UV = 4.5, UE = 23.0;          // west wall, valley, east wall (BAG rings, hall frame)
const VN = -6.3, VS = 62.7;                       // north and south wall planes (BAG rings; pilasters stand proud)
const EAVES = 13.5, RIDGE = 19.6;                 // 3DBAG
const HALLS = [{u0: UW, u1: UV}, {u0: UV, u1: UE}];
const BAND = 8.0;                                 // the rich dentil band (stokerij floor), view-s4 / north-1
const roofY = (u: number) => {                    // roof top surface over the halls
  for (const h of HALLS) if (u >= h.u0 - 0.6 && u <= h.u1 + 0.6) {
    const c = (h.u0 + h.u1) / 2, half = (h.u1 - h.u0) / 2;
    return EAVES + (RIDGE - EAVES) * (1 - Math.min(1, Math.abs(u - c) / half));
  }
  return EAVES;
};

// ---------------------------------------------------------------------------------------------------- helpers
/** Frame on a wall: origin (u, v), outward normal n; tangent = viewer's right facing the wall from outside. */
const frame = (o: V, n: V): Frame => ({origin: o, n, tangent: [n[1], -n[0]]});
/** One planar face given in hall-frame [u, y, v] points, turned to face `out` (a hall-frame direction). */
function face(pts: number[][], colour: string, out: [number, number, number]) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], q = pts[(i + 1) % pts.length];
    nx += (a[1] - q[1]) * (a[2] + q[2]); ny += (a[2] - q[2]) * (a[0] + q[0]); nz += (a[0] - q[0]) * (a[1] + q[1]);
  }
  const ring = nx * out[0] + ny * out[1] + nz * out[2] >= 0 ? pts : [...pts].reverse();
  const g = planarPolygon([ring]);
  if (g) b.add(g, colour as never);
}
/** Closed slab under a roof quad: top face at the quad, `th` thick downwards. */
function roofSheet(q: number[][], th: number, colour: string) {
  const bot = q.map(p => [p[0], p[1] - th, p[2]]);
  const c = q.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4 - th / 2, a[2] + p[2] / 4], [0, 0, 0]);
  face(q, colour, [0, 1, 0]);
  face(bot, colour, [0, -1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, s = [q[i], q[j], bot[j], bot[i]];
    const m = s.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4, a[2] + p[2] / 4], [0, 0, 0]);
    face(s, colour, [m[0] - c[0], 0, m[2] - c[2]]);
  }
}
/** Diagonal bar (iron anchor arm) of length l at angle a (rad) in the wall plane, centred at (t, y). */
function bar(fr: Frame, t: number, y: number, l: number, a: number, w: number, out: number) {
  put(b, fr, new T.BoxGeometry(w, l, 0.05).rotateZ(a).translate(0, 0, 0.025), t, y, out, 'bronze');
}
/** Star wall anchor (south piers, view-s4): vertical bar and two crossed arms with forked ends. */
function starAnchor(fr: Frame, t: number, y: number, out: number) {
  bar(fr, t, y, 1.25, 0, 0.07, out);
  bar(fr, t, y, 1.0, 0.75, 0.06, out);
  bar(fr, t, y, 1.0, -0.75, 0.06, out);
}
/** Fleur-de-lis wall anchor (big pilasters, north-1 / view-s4): stem, crossbar and two curled side leaves. */
function fleurAnchor(fr: Frame, t: number, y: number, out: number, s = 1) {
  bar(fr, t, y, 1.3 * s, 0, 0.08, out);
  bar(fr, t, y + 0.1 * s, 0.45 * s, Math.PI / 2, 0.07, out);
  for (const k of [-1, 1]) {
    bar(fr, t + k * 0.2 * s, y + 0.38 * s, 0.42 * s, k * 0.5, 0.06, out);
    bar(fr, t + k * 0.22 * s, y - 0.32 * s, 0.4 * s, -k * 0.5, 0.06, out);
  }
  poly(b, fr, t, y + 0.62 * s, [[0, 0], [0.09 * s, 0.14 * s], [0, 0.3 * s], [-0.09 * s, 0.14 * s]], 0.05, 'bronze', out);
}
/** Dentil band: a brick course with a row of projecting blocks under it. */
function dentils(fr: Frame, t0: number, t1: number, y: number, out = 0, pitch = 0.42) {
  slab(b, fr, (t0 + t1) / 2, y, t1 - t0, 0.22, 0.1, 'brick', out);
  const n = Math.max(1, Math.round((t1 - t0) / pitch));
  for (let k = 0; k < n; k++) slab(b, fr, t0 + ((t1 - t0) * (k + 0.5)) / n, y - 0.18, 0.16, 0.18, 0.16, 'brick', out);
}
/** A sloped strip from (tA, yA) to (tB, yB), thickness h measured vertically. */
function rake(fr: Frame, tA: number, yA: number, tB: number, yB: number, h: number, d: number, colour: string, out = 0) {
  // Not sunk like the kit solids: its back face stays on `out`, so it never lands on another solid's hidden back plane.
  const sh = new T.Shape([[tA, yA], [tB, yB], [tB, yB + h], [tA, yA + h]].map(p => new T.Vector2(p[0], p[1])));
  put(b, fr, new T.ExtrudeGeometry(sh, {depth: d, bevelEnabled: false}), 0, 0, out, colour);
}
/** Round-headed window: frame, glass, mullion and transom bars, stone sill. `blind` = bricked up (pale infill, frame band). */
function archLight(fr: Frame, t: number, y: number, w: number, h: number, o: {blind?: boolean; out?: number; bars?: boolean} = {}) {
  const out = o.out ?? 0;
  if (o.blind) {
    archBand(b, fr, t, y, w + 0.24, h + 0.12, 0.11, 0.08, 'brick', out, 6);
    archSlab(b, fr, t, y, w, h, 0.05, 'pink', out, 6);
  } else {
    archSlab(b, fr, t, y - 0.04, w + 0.1, h + 0.06, 0.08, 'white', out, 6);
    archSlab(b, fr, t, y, w - 0.06, h - 0.04, 0.13, 'glass', out, 6);
    if (o.bars !== false) {
      slab(b, fr, t, y, 0.05, h - w / 2, 0.18, 'white', out);
      slab(b, fr, t, y + h - w / 2 - 0.05, w - 0.06, 0.05, 0.18, 'white', out);
      slab(b, fr, t, y + (h - w / 2) * 0.5, w - 0.06, 0.04, 0.18, 'white', out);
    }
    archBand(b, fr, t, y, w + 0.32, h + 0.16, 0.1, 0.1, 'brick', out, 6);
  }
  slab(b, fr, t, y - 0.12, w + 0.3, 0.1, 0.2, 'stone', out);
}

// ---------------------------------------------------------------------------------------------------- shell
function shell() {
  // Long walls up to the eaves, gable walls up to the roof underside (pentagon per hall), all brick.
  face([[UW, 0, VN], [UW, 0, VS], [UW, EAVES, VS], [UW, EAVES, VN]], 'brick', [-1, 0, 0]);
  face([[UE, 0, VN], [UE, 0, VS], [UE, EAVES, VS], [UE, EAVES, VN]], 'brick', [1, 0, 0]);
  for (const [v, dir] of [[VN, -1], [VS, 1]] as [number, number][]) {
    for (const h of HALLS) {
      const c = (h.u0 + h.u1) / 2;
      face([[h.u0, 0, v], [h.u1, 0, v], [h.u1, EAVES, v], [c, RIDGE, v], [h.u0, EAVES, v]], 'brick', [0, 0, dir]);
    }
  }
  // Close the top of the wall tube under the roof sheets (hidden inside them): one plane per roof slope on the wall tops.
  for (const h of HALLS) {
    const c = (h.u0 + h.u1) / 2;
    for (const e of [h.u0, h.u1]) face([[e, EAVES, VN], [e, EAVES, VS], [c, RIDGE, VS], [c, RIDGE, VN]], 'slate', [0, -1, 0]);
  }
  // Roof sheets (30 cm thick slabs, 35 cm eaves overhang on the long sides, flush with the gable coping).
  const o = 0.55;
  for (const h of HALLS) {
    const c = (h.u0 + h.u1) / 2, k = (RIDGE - EAVES) / ((h.u1 - h.u0) / 2);
    const lo0 = h.u0 === UW ? h.u0 - o : h.u0, lo1 = h.u1 === UE ? h.u1 + o : h.u1;
    const y0 = RIDGE - k * (c - lo0) + 0.05, y1 = RIDGE - k * (lo1 - c) + 0.05;
    roofSheet([[lo0, y0, VN - 0.15], [lo0, y0, VS + 0.15], [c, RIDGE + 0.05, VS + 0.15], [c, RIDGE + 0.05, VN - 0.15]], 0.3, 'slate');
    roofSheet([[c, RIDGE + 0.05, VN - 0.15], [c, RIDGE + 0.05, VS + 0.15], [lo1, y1, VS + 0.15], [lo1, y1, VN - 0.15]], 0.3, 'slate');
    // ridge capping
    roofSheet([[c - 0.18, RIDGE + 0.17, VN - 0.15], [c - 0.18, RIDGE + 0.17, VS + 0.15], [c + 0.18, RIDGE + 0.17, VS + 0.15], [c + 0.18, RIDGE + 0.17, VN - 0.15]], 0.15, 'slate');
    // Glazed strip either side of the ridge over the pool (PDOK orthophoto: v ~0-31, ~2.5 m down each slope).
    for (const s of [-1, 1]) {
      const a = c + s * 0.35, e = c + s * 2.6, ya = RIDGE - k * 0.35 + 0.16, ye = RIDGE - k * 2.6 + 0.16;
      roofSheet([[a, ya, 0.2], [a, ya, 30.8], [e, ye, 30.8], [e, ye, 0.2]], 0.2, 'canopyGlass');
      for (let v = 0.2; v <= 30.81; v += 1.8) roofSheet([[a, ya + 0.08, v - 0.04], [a, ya + 0.08, v + 0.04], [e, ye + 0.08, v + 0.04], [e, ye + 0.08, v - 0.04]], 0.2, 'white');
    }
  }
  // Valley gutter between the halls.
  roofSheet([[UV - 0.4, EAVES + 0.3, VN - 0.15], [UV - 0.4, EAVES + 0.3, VS + 0.15], [UV + 0.4, EAVES + 0.3, VS + 0.15], [UV + 0.4, EAVES + 0.3, VN - 0.15]], 0.45, 'slate');
  // Eaves gutters on the long walls.
  for (const u of [UW - 0.5, UE + 0.5]) {
    const g = new T.BoxGeometry(0.22, 0.22, VS - VN + 0.3).translate(u, EAVES - 0.5, (VN + VS) / 2);
    b.add(g, 'slate' as never);
  }
  roofPlant();
  westAnnex();
}
/** The gym's roof plant over the south part (orthophoto: grey boxes and silver ducts, u ~0-10, v ~38-47; 3DBAG to 20.8 m). */
function roofPlant() {
  const base = (u: number) => roofY(u) - 0.3;
  const box = (u0: number, u1: number, v0: number, v1: number, top: number, colour: string) => {
    const y0 = Math.min(base(u0), base(u1)) - 0.2;
    b.add(new T.BoxGeometry(u1 - u0, top - y0, v1 - v0).translate((u0 + u1) / 2, (top + y0) / 2, (v0 + v1) / 2), colour as never);
  };
  box(1.8, 7.6, 39.0, 43.6, 17.4, 'concrete');
  box(2.6, 6.8, 43.6, 45.9, 17.1, 'concrete');
  // the duct run over the valley and up the east hall slope
  b.add(new T.CylinderGeometry(0.45, 0.45, 8.0, 10).rotateZ(Math.PI / 2).translate(7.0, 17.0, 42.4), 'concrete' as never);
  b.add(new T.CylinderGeometry(0.4, 0.4, 3.6, 10).translate(9.6, 18.6, 41.0), 'concrete' as never);
}
/** One-storey annex on the west side at the north end (BAG 236677 ring, 3DBAG 6.9 m), inside the 2014 shop block. */
function westAnnex() {
  const u0 = -17.97, v0 = -0.69, v1 = 3.76, top = 6.9;
  face([[u0, 0, v0], [u0, 0, v1], [u0, top, v1], [u0, top, v0]], 'brick', [-1, 0, 0]);
  face([[u0, 0, v0], [UW, 0, v0], [UW, top, v0], [u0, top, v0]], 'brick', [0, 0, -1]);
  face([[u0, 0, v1], [UW, 0, v1], [UW, top, v1], [u0, top, v1]], 'brick', [0, 0, 1]);
  face([[u0, top, v0], [UW, top, v0], [UW, top, v1], [u0, top, v1]], 'slate', [0, 1, 0]);
}

// ---------------------------------------------------------------------------------------------------- gable ends
/**
 * A gable end with two halls. `fr` runs along the facade from the viewer's left corner; `halls` are [t0, t1] per hall.
 * North (side 'N'): blind light groups with a glazed centre light, blind ground arches (behind the 2014 shop block).
 * South ('S'): glazed light groups, two rows of square windows in the pier grid.
 */
function gableEnd(fr: Frame, halls: V[], side: 'N' | 'S') {
  const D = 0.5;                                    // big pilaster projection (BAG ring bumps 0.5-0.8 m)
  const L = halls[1][1];
  // Big pilasters: outer corners, apexes, the valley.
  const big: {t: number; w: number; top: number; apex: boolean}[] = [
    {t: 0.6, w: 1.2, top: 14.6, apex: false}, {t: L - 0.6, w: 1.2, top: 14.6, apex: false}, {t: halls[0][1], w: 1.0, top: 14.9, apex: false},
  ];
  for (const [t0, t1] of halls) big.push({t: (t0 + t1) / 2, w: 1.5, top: 20.4, apex: true});
  for (const p of big) {
    slab(b, fr, p.t, 0, p.w, p.top, D, 'brick');
    slab(b, fr, p.t, p.top, p.w + 0.16, 0.18, D + 0.08, 'stone');                       // cap plate
    slab(b, fr, p.t, p.top + 0.18, p.w - 0.1, 0.28, D - 0.05, 'brick');
    slab(b, fr, p.t, p.top + 0.46, p.w + 0.06, 0.16, D + 0.03, 'stone');                // opzetstuk cover
    if (p.apex) poly(b, fr, p.t, p.top + 0.62, [[-p.w / 2 + 0.05, 0], [p.w / 2 - 0.05, 0], [0.12, 0.32], [-0.12, 0.32]], D - 0.05, 'stone');
    for (const y of [BAND - 0.05, 11.6]) slab(b, fr, p.t, y, p.w + 0.1, 0.45, D + 0.05, 'stone');   // stone blocks at the bands
    // north-1 / view-s4: anchors on the apex pilasters (~12 m and near the top) and the valley pilaster, none on the corners
    if (p.apex) fleurAnchor(fr, p.t, 19.0, D, 1.2);
    if (p.w !== 1.2) fleurAnchor(fr, p.t, 10.6, D, 1);
  }
  // Ground pier grid (3.1 m; BAG ring bumps) and the band.
  for (const [t0, t1] of halls) {
    const tc = (t0 + t1) / 2, k = (RIDGE - EAVES) / ((t1 - t0) / 2);
    for (const [h0, h1] of [[t0, tc], [tc, t1]] as V[]) {
      const s0 = h0 + (h0 === t0 ? (t0 === 0 ? 1.2 : 0.5) : 0.75), s1 = h1 - (h1 === t1 ? (t1 === L ? 1.2 : 0.5) : 0.75);
      const sub = (s1 - s0) / 3;
      for (const t of [s0 + sub, s0 + 2 * sub]) {
        slab(b, fr, t, 0, 0.7, BAND, 0.35, 'brick');
        if (side === 'S') starAnchor(fr, t, 2.7, 0.35);
      }
      for (let j = 0; j < 3; j++) {
        const t = s0 + sub * (j + 0.5), w = Math.min(1.9, sub - 0.95);
        if (side === 'S') {
          // view-s4: dark-framed square windows, a tall one below and a lower one above (the upper one bricked in the middle bay).
          slab(b, fr, t, 0.9, w + 0.12, 3.1, 0.08, 'frame');
          slab(b, fr, t, 0.96, w, 2.98, 0.13, 'glass');
          if (!(j === 2 && h0 === t0)) { slab(b, fr, t, 5.0, w + 0.12, 1.85, 0.08, 'frame'); slab(b, fr, t, 5.06, w, 1.73, 0.13, 'glass'); }
          slab(b, fr, t, 4.35, sub - 0.75, 0.12, 0.06, 'brick');
          slab(b, fr, t, 4.75, sub - 0.75, 0.12, 0.06, 'brick');
        } else {
          archBand(b, fr, t, 0.6, sub - 0.8, 6.4, 0.25, 0.08, 'brick', 0, 6);              // closed ground arches (register)
        }
      }
      // Upper light group of three under the pointed band.
      const hc = (h0 + h1) / 2, hw = (h1 - h0) / 2 - 0.9;
      if (side === 'N') {
        for (const s of [-1, 0, 1]) {
          const w = s === 0 ? 1.3 : 1.0;
          archLight(fr, hc + s * 2.05, 10.75, w, s === 0 ? 2.0 : 0.95, {blind: true});
          if (s === 0) { slab(b, fr, hc, 8.75, 1.38, 1.42, 0.08, 'white'); slab(b, fr, hc, 8.8, 1.26, 1.32, 0.13, 'glass'); slab(b, fr, hc, 9.4, 1.26, 0.05, 0.18, 'white'); slab(b, fr, hc, 8.8, 0.05, 1.32, 0.18, 'white'); }
          else { slab(b, fr, hc + s * 2.05, 8.75, w + 0.08, 1.4, 0.05, 'pink'); }
          slab(b, fr, hc + s * 2.05, 8.63, w + 0.3, 0.1, 0.2, 'stone');
        }
      } else {
        for (const s of [-1, 0, 1]) archLight(fr, hc + s * 2.05, 9.0, s === 0 ? 1.3 : 1.05, s === 0 ? 3.75 : 3.0);
      }
      // Pointed (keperboog) band over the group, a straight band at the gable foot.
      rake(fr, hc - hw, 11.9, hc, 14.1, 0.24, 0.1, 'brick');
      rake(fr, hc, 14.1, hc + hw, 11.9, 0.24, 0.1, 'brick');
      for (let q = 0; q < 6; q++) {
        const tq = hc - hw + (hw * (q + 0.5)) / 6;
        slab(b, fr, tq, 11.9 + (2.2 * (q + 0.5)) / 6 - 0.2, 0.16, 0.16, 0.15, 'brick');
        slab(b, fr, 2 * hc - tq, 11.9 + (2.2 * (q + 0.5)) / 6 - 0.2, 0.16, 0.16, 0.15, 'brick');
      }
    }
    // Gable rake: stone/zinc coping on the roof edge and a dentil band 0.7 m below it.
    const ta = t0 + 0.05, tb = t1 - 0.05;
    rake(fr, ta, EAVES - 0.05, tc, RIDGE - 0.05, 0.38, 0.3, 'slate');
    rake(fr, tc, RIDGE - 0.05, tb, EAVES - 0.05, 0.38, 0.3, 'slate');
    rake(fr, t0 + 1.0, EAVES - 0.7 + k * 1.0 - 0.2, tc - 0.8, RIDGE - 0.7 - k * 0.8 - 0.2, 0.22, 0.1, 'brick');
    rake(fr, tc + 0.8, RIDGE - 0.7 - k * 0.8 - 0.2, t1 - 1.0, EAVES - 0.7 + k * 1.0 - 0.2, 0.22, 0.1, 'brick');
  }
  dentils(fr, 0, L, BAND + 0.25, 0, 0.45);
  slab(b, fr, L / 2, BAND - 0.3, L, 0.12, 0.08, 'brick');
  slab(b, fr, L / 2, 0, L, 0.6, 0.06, 'greyBrick');                               // plinth
}

// ---------------------------------------------------------------------------------------------------- west side
/** Eleven bays (register: "elf traveeen breed"), pilasters at the bay lines; t runs south from the north corner. */
function westSide() {
  const fr = frame([UW, VN], [-1, 0]), L = VS - VN, bay = L / 11;
  for (let k = 0; k <= 11; k++) {
    const t = k === 0 ? 0.6 : k === 11 ? L - 0.6 : k * bay, w = k === 0 || k === 11 ? 1.2 : 1.0;
    const top = k === 11 ? 14.8 : EAVES;
    slab(b, fr, t, 0, w, top, 0.4, 'brick');
    for (const y of [BAND - 0.05, EAVES - 0.75]) slab(b, fr, t, y, w + 0.08, 0.4, 0.45, 'stone');
    if (k === 11) { slab(b, fr, t, 14.8, w + 0.16, 0.16, 0.5, 'stone'); slab(b, fr, t, 14.96, w - 0.2, 0.5, 0.3, 'brick'); slab(b, fr, t, 15.46, w, 0.14, 0.4, 'stone'); }
    if (k > 0 && k < 11) fleurAnchor(fr, t, 11.3, 0.4, 0.8);
  }
  dentils(fr, 0, L, EAVES - 0.35, 0, 0.42);
  dentils(fr, 0, L, 12.2, 0, 0.5);
  slab(b, fr, L / 2, BAND, L, 0.18, 0.08, 'brick');
  slab(b, fr, L / 2, 7.8, L, 0.12, 0.06, 'brick');
  slab(b, fr, L / 2, 4.6, L, 0.12, 0.06, 'brick');
  slab(b, fr, L / 2, 0, L, 0.6, 0.06, 'greyBrick');
  for (let j = 0; j < 11; j++) {
    const c = (j + 0.5) * bay;
    if (j === 10) {
      // The surviving large round-arched railway opening (westS: 3.4 m wide, 7.45-11.1 m), glazed with radial bars.
      archSlab(b, fr, c, 7.4, 3.5, 3.75, 0.08, 'white', 0, 12);
      archSlab(b, fr, c, 7.45, 3.36, 3.65, 0.13, 'glass', 0, 12);
      archBand(b, fr, c, 7.4, 3.9, 3.95, 0.22, 0.12, 'brick', 0, 12);
      slab(b, fr, c, 7.45, 3.36, 0.06, 0.18, 'white');
      slab(b, fr, c, 9.0, 3.36, 0.05, 0.18, 'white');
      for (const a of [-1.0, -0.35, 0.35, 1.0]) put(b, fr, new T.BoxGeometry(0.05, 1.6, 0.05).translate(0, 0.8, 0.025).rotateZ(a * 0.6), c, 9.42, 0.13, 'white');
      for (const s of [-0.84, 0, 0.84]) slab(b, fr, c + s, 7.45, 0.05, 1.98, 0.18, 'white');
      slab(b, fr, c, 7.3, 3.7, 0.12, 0.22, 'stone');
      // ground: one low round-arched opening with a dark door
      archSlab(b, fr, c, 0.15, 1.9, 2.4, 0.16, 'frame', 0, 8);
      archBand(b, fr, c, 0.1, 2.3, 2.6, 0.2, 0.1, 'brick', 0, 8);
      continue;
    }
    // Clerestory triplet (w01-251, westS): three equal round-headed lights 9.4-11.1 m.
    for (const s of [-1, 0, 1]) archLight(fr, c + s * 1.2, 9.4, 0.85, 1.7);
    if (j === 9) {
      archSlab(b, fr, c - 1.4, 0.15, 1.6, 2.4, 0.16, 'frame', 0, 8);
      archBand(b, fr, c - 1.4, 0.1, 2.0, 2.6, 0.2, 0.1, 'brick', 0, 8);
      slab(b, fr, c + 1.2, 0.15, 1.4, 3.0, 0.12, 'white'); slab(b, fr, c + 1.2, 0.2, 1.2, 2.9, 0.17, 'glass');
    } else if (j === 8) {
      for (const s of [-1, 0, 1]) archLight(fr, c + s * 1.2, 5.4, 0.75, 1.6);
      archSlab(b, fr, c, 0.15, 1.5, 2.4, 0.16, 'frame', 0, 8);
    } else {
      archBand(b, fr, c, 0.6, bay - 2.0, 3.6, 0.22, 0.08, 'brick', 0, 6);                // closed ground arches
    }
  }
}

// ---------------------------------------------------------------------------------------------------- east side
function eastSide() {
  const fr = frame([UE, VS], [1, 0]), L = VS - VN, bay = L / 11;
  for (let k = 0; k <= 11; k++) slab(b, fr, k === 0 ? 0.6 : k === 11 ? L - 0.6 : k * bay, 0, k % 11 ? 1.0 : 1.2, EAVES, 0.4, 'brick');
  dentils(fr, 0, L, EAVES - 0.35, 0, 0.6);
}

// ---------------------------------------------------------------------------------------------------- chimney
/** The pool's round boiler chimney (1929, register; BAG 236879 ring circle at u -18.0, v 49.9, r 1.4; AHN4 top 31.6 m NAP). */
function chimney() {
  const u = -18.0, v = 49.9, y1 = 29.6, r0 = 1.45, r1 = 1.0;
  const r = (y: number) => r0 + ((r1 - r0) * y) / y1;
  b.add(new T.CylinderGeometry(1.62, 1.62, 1.1, 16).translate(u, 0.55, v), 'brick' as never);
  b.add(new T.CylinderGeometry(r1, r0, y1 - 1.1, 16, 1, true).translate(u, 1.1 + (y1 - 1.1) / 2, v), 'brick' as never);
  for (const y of [9.5, 16.5, 22.0, 26.5, 28.2]) b.add(new T.CylinderGeometry(r(y) + 0.06, r(y) + 0.06, 0.16, 16).translate(u, y, v), 'greyBrick' as never);
  b.add(new T.CylinderGeometry(r1 + 0.2, r1, 0.5, 16).translate(u, y1 + 0.25, v), 'brick' as never);       // corbelled crown
  b.add(new T.CylinderGeometry(r1 + 0.2, r1 + 0.2, 0.45, 16, 1, true).translate(u, y1 + 0.72, v), 'brick' as never);
  b.add(new T.RingGeometry(r1 - 0.25, r1 + 0.2, 16).rotateX(-Math.PI / 2).translate(u, y1 + 0.95, v), 'greyBrick' as never);
  b.add(new T.CircleGeometry(r1 - 0.25, 16).rotateX(-Math.PI / 2).translate(u, y1 + 0.3, v), 'dark' as never);
  // the low link to the wall (BAG ring bump u -16.6..-15.4, v 49.6-50.3)
  b.add(new T.BoxGeometry(2.3, 2.6, 0.9).translate(-15.75, 1.3, 49.95), 'brick' as never);
}

export function buildSportfondsenbadOost(_w: number, _d: number, tools: BuildingTools) {
  raw = tools;
  b = {...tools, add: (g: T.BufferGeometry, c: never, x?: number, y?: number, z?: number, angle?: number) => {
    if (angle) g.rotateY(angle);
    if (x !== undefined) g.translate(x, y ?? 0, z ?? 0);
    g.rotateY(ANGLE);
    raw.add(g, c);
  }} as BuildingTools;
  setSink(0.12, true);
  shell();
  gableEnd(frame([UE, VN], [0, -1]), [[0, UE - UV], [UE - UV, UE - UW]], 'N');
  gableEnd(frame([UW, VS], [0, 1]), [[0, UV - UW], [UV - UW, UE - UW]], 'S');
  westSide();
  eastSide();
  chimney();
  setSink(0);
}
