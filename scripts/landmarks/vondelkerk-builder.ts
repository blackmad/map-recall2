import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import {facePoly} from './worship-kit';
import {poly, slab, type Frame} from './nearbar-kit';

/**
 * Vondelkerk, Vondelstraat 120 (P.J.H. Cuypers, 1872-80): neo-Gothic cross-shaped brick basilica on an oval island between the two
 * arms of Vondelstraat. Modelled as it stood until the New Year's Eve fire of 2026 (nl.wikipedia: the main tower and roof collapsed).
 *
 * The 3DBAG LoD2.2 shell is useless here (the tower is a blank slab and the 60-degree roofs are shredded), so the church is built
 * from its own measurements in an axis frame (a along the nave toward the apse, bearing 66 degrees; b to the right, i.e. south-south-east):
 *   nave 10.6 m wide, eave 12.8 m, ridge 22.0 m at 60 degrees (3DBAG roof planes #419/#424/#427/#432),
 *   aisles +-5.3..7.15 m, three gabled side chapels per side, transept 8.6 m wide with three-faced ends, three-faced apse,
 *   west front with two tapering octagonal stair towers (cone tops about 30.8 m), pointed portal under a stone hood, triple lancet,
 *   corbel frieze and a blind-arcade gable, and the octagonal crossing tower (belfry with clocks, needle spire, about 47 m).
 * Footprint check: the BAG ring matches these rectangles to within about 0.4 m.
 */
const TH = 66 * Math.PI / 180;                       // bearing of the nave axis (towards the apse)
const O: [number, number] = [-4.147, 1.327];         // native east/south metres of the crossing centre
const PHI = Math.PI / 2 - TH;                        // rotateY that takes local X (=a) onto the axis
const nat = (a: number, bb: number): [number, number] => [O[0] + a * Math.sin(TH) + bb * Math.cos(TH), O[1] - a * Math.cos(TH) + bb * Math.sin(TH)];
const dirNat = (da: number, db: number): [number, number] => [da * Math.sin(TH) + db * Math.cos(TH), -da * Math.cos(TH) + db * Math.sin(TH)];
const P3 = (a: number, y: number, bb: number): number[] => { const p = nat(a, bb); return [p[0], y, p[1]]; };
const o3 = (da: number, up: number, db: number): number[] => { const d = dirNat(da, db); return [d[0], up, d[1]]; };

const EAVE_A = 8.9, EAVE_N = 12.8, EAVE_T = 13.6, RIDGE = 22.0;
const NW = 5.3, AW = 7.15;                           // nave half-width, aisle outer half-width
const AF = -23.2, NF = -22.0, AISLE_F = -21.7;       // west front plane, nave back-of-front, aisle front
const A_END = 16.6;                                  // chancel/apse spring

type Pt = [number, number];

export function buildVondelkerk(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  /** Local-frame geometry (X = a, Z = b) placed at a,b,y. */
  const lput = (g: T.BufferGeometry, colour: string, a: number, y: number, bb: number, rot = 0) => {
    g.rotateY(PHI + rot);
    const p = nat(a, bb);
    g.translate(p[0], y, p[1]);
    b.add(g, colour as never);
  };
  const lbox = (a: number, y0: number, bb: number, la: number, h: number, lb: number, colour: string, rot = 0) =>
    lput(new T.BoxGeometry(la, h, lb).translate(0, h / 2, 0), colour, a, y0, bb, rot);
  const shapeOf = (pts: Pt[]) => new T.Shape(pts.map(p => { const q = nat(p[0], p[1]); return new T.Vector2(q[0], q[1]); }));
  /** Open-top prism over a polygon given in (a,b); roofs own the tops. */
  const cap = (pts: Pt[], y: number, colour: string) => { const g = upwardRoofPlane(shapeOf(pts), y); g.userData.role = 'roof'; b.add(g, colour as never); };
  /** Walls plus a flat cap so every prism is a closed solid (the cap sits under the real roofs where there are any). */
  const prism = (pts: Pt[], y0: number, y1: number, colour: string) => { b.add(openTopPrism(shapeOf(pts), y0, y1), colour as never); cap(pts, y1, 'slate'); };
  const roof = (pts: number[][], out: number[], colour = 'slate') => facePoly(b, pts, colour, out, 'roof');
  /** Frame on a face from local point p to q whose outward normal points along local direction `o`. */
  const frame = (p: Pt, q: Pt, o: Pt): Frame => {
    const P = nat(p[0], p[1]), Q = nat(q[0], q[1]), od = dirNat(o[0], o[1]);
    let tx = Q[0] - P[0], tz = Q[1] - P[1];
    const l = Math.hypot(tx, tz); tx /= l; tz /= l;
    let n: Pt = [-tz, tx], origin: Pt = P;
    if (n[0] * od[0] + n[1] * od[1] < 0) { tx = -tx; tz = -tz; n = [-tz, tx]; origin = Q; }
    return {origin, tangent: [tx, tz], n};
  };
  const len = (p: Pt, q: Pt) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  /** Tangent coordinate on a frame of the local point (a,b). */
  const at = (f: Frame, a: number, bb: number) => { const p = nat(a, bb); return (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1]; };
  /** Equilateral pointed arch outline in (x,y): width w, springing at ys, apex at ys + 0.866 w. */
  const pointedPts = (w: number, ys: number): [number, number][] => {
    const pts: [number, number][] = [[-w / 2, 0], [w / 2, 0], [w / 2, ys]];
    const n = 8;
    for (let i = 1; i <= n; i++) { const a = (Math.PI / 3) * i / n; pts.push([-w / 2 + w * Math.cos(a), ys + w * Math.sin(a)]); }
    for (let i = 1; i < n; i++) { const a = Math.PI * 2 / 3 + (Math.PI / 3) * i / n; pts.push([w / 2 + w * Math.cos(a), ys + w * Math.sin(a)]); }
    pts.push([-w / 2, ys]);
    return pts;
  };
  const pointed = (f: Frame, t: number, y: number, w: number, h: number, colour: string, d: number, out: number) =>
    poly(b, f, t, y, pointedPts(w, Math.max(0.01, h - 0.866 * w)), d, colour, out);
  /** Pointed lancet: stone surround, glass, mullions and a transom. */
  const lancet = (f: Frame, t: number, y: number, w: number, h: number, mull = 0) => {
    pointed(f, t, y - 0.05, w + 0.36, h + 0.05 + 0.31, 'stone', 0.08, 0);
    pointed(f, t, y, w, h, 'glass', 0.06, 0.06);
    for (let k = 1; k <= mull; k++) slab(b, f, t - w / 2 + w * k / (mull + 1), y, 0.06, h - 0.866 * w, 0.05, 'frame', 0.1);
    slab(b, f, t, y + (h - 0.866 * w) * 0.5, w, 0.05, 0.05, 'frame', 0.1);
  };
  const octPrism = (a: number, y0: number, bb: number, r0: number, r1: number, h: number, colour: string) =>
    lput(new T.CylinderGeometry(r1, r0, h, 8).rotateY(Math.PI / 8).translate(0, h / 2, 0), colour, a, y0, bb);
  const octCone = (a: number, y0: number, bb: number, r: number, h: number, colour: string, seg = 8) =>
    lput(new T.ConeGeometry(r, h, seg).rotateY(Math.PI / 8).translate(0, h / 2, 0), colour, a, y0, bb);

  // ---------------------------------------------------------------- massing
  prism([[AISLE_F, -AW], [15.5, -AW], [15.5, AW], [AISLE_F, AW]], 0, EAVE_A, 'brick');
  // the nave walls are split at the aisle-roof line so the lean-to edge is a true shared edge
  prism([[NF, -NW], [A_END, -NW], [A_END, NW], [NF, NW]], 0, 9.9, 'brick');
  prism([[NF, -NW], [A_END, -NW], [A_END, NW], [NF, NW]], 9.9, EAVE_N, 'brick');
  const tEnd = (s: number): Pt[] => [[-4.3, s * 5.3], [-4.3, s * 11.53], [-1.78, s * 14.05], [1.78, s * 14.05], [4.3, s * 11.53], [4.3, s * 5.3]];
  prism(tEnd(-1), 0, EAVE_T, 'brick');
  prism(tEnd(1), 0, EAVE_T, 'brick');
  const apse: Pt[] = [[A_END, -NW], [19.7, -2.2], [19.7, 2.2], [A_END, NW]];
  prism(apse, 0, EAVE_N, 'brick');

  // Nave and chancel roof: two 60 degree planes, ridge 22.0; aisle lean-tos; apse hips to the ridge end.
  for (const s of [-1, 1]) {
    roof([P3(NF, EAVE_N, s * NW), P3(A_END, EAVE_N, s * NW), P3(A_END, RIDGE, 0), P3(NF, RIDGE, 0)], o3(0, 0.9, s));
    roof([P3(AISLE_F, EAVE_A, s * AW), P3(15.5, EAVE_A, s * AW), P3(15.5, 9.9, s * NW), P3(AISLE_F, 9.9, s * NW)], o3(0, 0.5, s));
    facePoly(b, [P3(AISLE_F, EAVE_A, s * AW), P3(AISLE_F, EAVE_A, s * NW), P3(AISLE_F, 9.9, s * NW)], 'brick', o3(-1, 0, 0));
    facePoly(b, [P3(15.5, EAVE_A, s * AW), P3(15.5, EAVE_A, s * NW), P3(15.5, 9.9, s * NW)], 'brick', o3(1, 0, 0));
  }
  const ap = apse.map(p => P3(p[0], EAVE_N, p[1]));
  const R_APSE = P3(A_END, 17.8, 0);
  facePoly(b, [P3(A_END, EAVE_N, -NW), P3(A_END, EAVE_N, NW), P3(A_END, RIDGE, 0)], 'slate', o3(1, 0.3, 0));
  for (let i = 0; i < 3; i++) {
    const mx = (apse[i][0] + apse[i + 1][0]) / 2 - A_END, mb = (apse[i][1] + apse[i + 1][1]) / 2, l = Math.hypot(mx, mb);
    roof([ap[i], ap[i + 1], R_APSE], o3(mx / l, 0.7, mb / l));
  }
  // closed back end of the aisle block (small step down to the apse), and the nave gable behind the facade
  facePoly(b, [P3(15.5, 0, -AW), P3(15.5, 0, AW), P3(15.5, EAVE_A, AW), P3(15.5, EAVE_A, -AW)], 'brick', o3(1, 0, 0));
  facePoly(b, [P3(NF, EAVE_N, -NW), P3(NF, EAVE_N, NW), P3(NF, RIDGE, 0)], 'brick', o3(-1, 0, 0));

  // Transept roof, ridge along b, three-faced hip ends.
  for (const s of [-1, 1]) {
    const br = s * 10.4;
    for (const k of [-1, 1]) roof([P3(k * 4.3, EAVE_T, 0), P3(k * 4.3, EAVE_T, s * 11.53), P3(0, RIDGE, br), P3(0, RIDGE, 0)], o3(k, 0.8, 0));
    const e = tEnd(s).slice(1, 5).map(p => P3(p[0], EAVE_T, p[1]));
    const R = P3(0, RIDGE, br), Rl = nat(0, br);
    for (let i = 0; i < 3; i++) {
      const mx = (e[i][0] + e[i + 1][0]) / 2 - Rl[0], mz = (e[i][2] + e[i + 1][2]) / 2 - Rl[1], l = Math.hypot(mx, mz) || 1;
      roof([e[i], e[i + 1], R], [mx / l, 0.7, mz / l]);
    }
  }

  // Side chapels: trapezoid footprints on the aisle wall, tip at |b| 9.65, pyramidal slate hip, one lancet per slanted face.
  const CE = 8.3;   // chapel eave (the aisle wall behind it is 8.9 m)
  const chapel = (ac: number, w: number, s: number, yr: number) => {
    const bt = 9.65;
    const fp: Pt[] = [[ac - w, s * AW], [ac - 0.3, s * bt], [ac + 0.3, s * bt], [ac + w, s * AW]];
    const fpb: Pt[] = [[ac - w - 0.1, s * (AW - 0.25)], fp[0], fp[1], fp[2], fp[3], [ac + w + 0.1, s * (AW - 0.25)]];
    prism(fpb, 0, CE, 'brick');
    const E = fp.map(p => P3(p[0], CE, p[1]));
    const R1 = P3(ac, yr, s * (AW - 0.2)), R2 = P3(ac, yr, s * (bt - 0.45));
    roof([E[0], E[1], R2, R1], o3(-0.6, 0.8, s * 0.5));
    roof([E[3], E[2], R2, R1], o3(0.6, 0.8, s * 0.5));
    roof([E[1], E[2], R2], o3(0, 0.5, s));
    facePoly(b, [E[0], E[3], R1], 'brick', o3(0, 0, -s));
    for (const [p, q, sg] of [[fp[0], fp[1], -1], [fp[3], fp[2], 1]] as [Pt, Pt, number][]) {
      // small slate-roofed dormer on the roof face
      const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], rm: Pt = [ac, s * (AW - 0.2 + bt - 0.45) / 2], t = 0.42;
      const da = m[0] + (rm[0] - m[0]) * t, db = m[1] + (rm[1] - m[1]) * t, dy = CE + (yr - CE) * t;
      const ang = Math.atan2(s * 0.4, sg * 0.9);
      lbox(da, dy - 0.5, db, 0.7, 1.5, 0.95, 'brick', -ang);
      lbox(da + Math.cos(ang) * 0.36, dy - 0.05, db + Math.sin(ang) * 0.36, 0.05, 0.85, 0.55, 'glass', -ang);
      lput(new T.ConeGeometry(0.78, 0.8, 4).rotateY(Math.PI / 4).translate(0, 0.4, 0), 'slate', da, dy + 1.0, db, -ang);
      const fr = frame(p, q, [sg * 0.9, s * 0.4]);
      lancet(fr, len(p, q) / 2, 3.3, 1.15, 4.3, 0);
      slab(b, fr, len(p, q) / 2, 3.0, len(p, q) - 0.1, 0.14, 0.1, 'stone', 0);
      slab(b, fr, len(p, q) / 2, 0.8, 0.95, 1.5, 0.05, 'glass', 0.02);
    }
  };
  for (const s of [-1, 1]) {
    chapel(-14.4, 2.95, s, 11.5);
    chapel(-7.0, 2.3, s, 10.9);
    chapel(13.9, 2.95, s, 11.5);
  }

  b.mark?.('shell');   // massing above; everything below is facade/tower detail that must stay attached

  // ---------------------------------------------------------------- west front
  const fF = frame([AF, -4], [AF, 4], [-1, 0]);
  const tF = (bb: number) => at(fF, AF, bb);
  // Heights measured off the 2007 front view (nave eave 12.8 m gives 31.8 px/m at the facade plane): portal 6.0, hood 9.6, triple lancet 8.0-12.4,
  // corbel frieze 14.9, gable apex 19.3, tower plinth 6.8, belfry 17.3-20.1, cone tip 26.7.
  const GB = 15.4, GA = 19.3;                       // gable base and apex
  lbox((AF + NF) / 2, 0, 0, NF - AF, GB, 7.2, 'brick');
  poly(b, fF, tF(0), GB, [[-2.05, 0], [2.05, 0], [0, GA - GB]], 1.2, 'brick', -1.2);
  // stone coping of the gable (two thin sloping strips) and the base cornice with its corbel arches
  for (const k of [-1, 1]) poly(b, fF, tF(0), GB, [[k * 2.05, 0], [k * 2.05 - k * 0.2, 0], [k * 0.05, GA - GB - 0.09], [0, GA - GB]], 0.14, 'stone', 0);
  slab(b, fF, tF(0), GB - 0.3, 4.5, 0.26, 0.2, 'stone', 0);
  for (let k = -4; k <= 4; k++) slab(b, fF, tF(k * 0.5), GB - 0.75, 0.3, 0.34, 0.1, 'greyBrick', 0);
  // spirelet and cross on the gable apex
  lput(new T.ConeGeometry(0.4, 2.3, 8).translate(0, 1.15, 0), 'slate', (AF + NF) / 2 - 0.2, GA - 0.15, 0);
  lbox((AF + NF) / 2 - 0.2, GA + 2.1, 0, 0.07, 1.0, 0.07, 'gold');
  lbox((AF + NF) / 2 - 0.2, GA + 2.7, 0, 0.07, 0.07, 0.5, 'gold');
  // blind arcade and louvred window in the gable
  for (const k of [-1, 1]) {
    pointed(fF, tF(k * 0.85), GB + 0.5, 0.5, 1.45, 'greyBrick', 0.05, 0);
    pointed(fF, tF(k * 1.5), GB + 0.5, 0.36, 0.8, 'greyBrick', 0.05, 0);
    slab(b, fF, tF(k * 1.18), GB + 0.35, 0.1, 0.6, 0.04, 'dark', 0.02);
  }
  slab(b, fF, tF(0), GB + 0.4, 0.9, 2.3, 0.07, 'stone', 0);
  slab(b, fF, tF(0), GB + 0.52, 0.62, 2.06, 0.05, 'frame', 0.06);
  // triple lancet under the corbel frieze, stone sill
  lancet(fF, tF(0), 8.0, 0.95, 4.4, 0);
  for (const k of [-1, 1]) lancet(fF, tF(k * 1.15), 8.0, 0.72, 3.4, 0);
  slab(b, fF, tF(0), 7.8, 4.2, 0.18, 0.14, 'stone', 0);
  // portal: brick moulding, dark recess, red doors with iron bars, oval window, stone hood and cross
  pointed(fF, tF(0), 0, 3.9, 6.0, 'greyBrick', 0.16, 0);
  pointed(fF, tF(0), 0, 2.9, 5.1, 'dark', 0.1, 0.14);
  slab(b, fF, tF(0), 0, 2.0, 3.3, 0.1, 'red', 0.2);
  for (let k = -4; k <= 4; k++) slab(b, fF, tF(k * 0.22), 0.1, 0.035, 3.1, 0.05, 'dark', 0.3);
  const ell = (rx: number, ry: number, cy: number): [number, number][] => Array.from({length: 16}, (_, i) => [rx * Math.cos(i * Math.PI / 8), cy + ry * Math.sin(i * Math.PI / 8)] as [number, number]);
  poly(b, fF, tF(0), 0, ell(0.7, 0.8, 4.2), 0.08, 'stone', 0.17);
  poly(b, fF, tF(0), 0, ell(0.54, 0.64, 4.2), 0.06, 'glass', 0.25);
  for (const k of [-1, 1]) slab(b, fF, tF(k * 1.45), 3.3, 0.3, 0.28, 0.2, 'stone', 0.1);
  poly(b, fF, tF(0), 6.0, [[-2.1, 0], [2.1, 0], [0, 3.6]], 0.3, 'stone', 0);
  poly(b, fF, tF(0), 6.3, [[-1.6, 0], [1.6, 0], [0, 2.75]], 0.05, 'concrete', 0.3);
  slab(b, fF, tF(0), 9.45, 0.1, 0.55, 0.08, 'dark', 0.3);
  slab(b, fF, tF(0), 9.7, 0.36, 0.1, 0.08, 'dark', 0.3);

  // stair towers: tapering octagons, stone corbel band, slits, arcaded belfry, slate cone and cross
  const TA = AF + 1.34;
  for (const s of [-1, 1]) {
    const tb = s * 3.6;
    octPrism(TA, 0, tb, 1.55, 1.5, 6.8, 'brick');
    octPrism(TA, 6.8, tb, 1.65, 1.5, 0.3, 'stone');
    octPrism(TA, 7.1, tb, 1.36, 1.2, 9.9, 'brick');
    octPrism(TA, 17.0, tb, 1.5, 1.4, 0.3, 'stone');
    octPrism(TA, 17.3, tb, 1.22, 1.22, 2.8, 'brick');
    octPrism(TA, 20.1, tb, 1.5, 1.5, 0.32, 'greyBrick');
    octCone(TA, 20.42, tb, 1.47, 6.3, 'slate');
    lbox(TA, 26.5, tb, 0.07, 1.0, 0.07, 'gold');
    lbox(TA, 27.1, tb, 0.07, 0.07, 0.5, 'gold');
    // slits spiral up the shaft; belfry arcades on every face
    const rAt = (y: number) => (y < 6.8 ? 1.55 - 0.05 * y / 6.8 : 1.36 - 0.16 * (y - 7.1) / 9.9) * Math.cos(Math.PI / 8);
    [[2.4, 180], [4.8, 225], [7.8, 180], [10.0, 135], [12.2, 180], [14.4, 225], [16.0, 180]].forEach(([y, deg]) => {
      const al = (deg * Math.PI) / 180, r = rAt(y);
      lbox(TA + r * Math.cos(al), y, tb + r * Math.sin(al), 0.1, 0.85, 0.16, 'dark', -al);
    });
    for (let k = 0; k < 8; k++) {
      const al = k * Math.PI / 4, r = 1.22 * Math.cos(Math.PI / 8) + 0.01;
      for (const o of [-0.3, 0.3]) {
        const tx = -Math.sin(al) * o, tz = Math.cos(al) * o;
        lbox(TA + r * Math.cos(al) + tx, 17.9, tb + r * Math.sin(al) + tz, 0.08, 1.3, 0.3, 'dark', -al);
        lbox(TA + (r + 0.01) * Math.cos(al) + tx, 19.15, tb + (r + 0.01) * Math.sin(al) + tz, 0.1, 0.12, 0.42, 'stone', -al);
      }
    }
  }
  // aisle ends: lancet and low door
  for (const s of [-1, 1]) {
    const f = frame([AISLE_F, s * 5.2], [AISLE_F, s * AW], [-1, 0]);
    lancet(f, at(f, AISLE_F, s * 6.0), 2.4, 0.8, 3.2, 0);
    slab(b, f, at(f, AISLE_F, s * 6.65), 0, 0.8, 1.9, 0.08, 'red', 0.02);
  }

  // ---------------------------------------------------------------- apse, transepts, nave flanks
  // Tall lancets on the three apse faces (two lights each) and three-faced transept ends.
  for (let i = 0; i < 3; i++) {
    const p = apse[i], q = apse[i + 1];
    const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const f = frame(p, q, [mid[0] - 14.4, mid[1]]);
    for (const dt of [-0.95, 0.95]) lancet(f, len(p, q) / 2 + dt, 6.8, 0.9, 5.2, 0);
    slab(b, f, len(p, q) / 2, 6.55, 3.4, 0.16, 0.14, 'stone', 0);
  }
  for (const s of [-1, 1]) {
    const e = tEnd(s);
    for (let i = 1; i < 4; i++) {
      const p = e[i], q = e[i + 1];
      const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      const f = frame(p, q, [mid[0], mid[1] - s * 9.75]);
      const tipFace = i === 2;
      lancet(f, len(p, q) / 2, tipFace ? 3.0 : 3.4, tipFace ? 1.5 : 1.1, tipFace ? 7.6 : 6.4, tipFace ? 1 : 0);
    }
    // flanks of the transept arm beyond the aisle block
    for (const k of [-1, 1]) {
      const f = frame([k * 4.3, s * AW], [k * 4.3, s * 11.53], [k, 0]);
      lancet(f, at(f, k * 4.3, s * 9.4), 0.9, 0.55, 6.4, 0);
    }
  }
  // clerestory lancets above the aisle roofs and aisle-wall lancets between the chapels
  for (const s of [-1, 1]) {
    const fc = frame([NF, s * NW], [A_END, s * NW], [0, s]);
    for (const a of [-20.2, -17.4, -14.6, -11.8, -9.0, -6.2, 6.0, 9.0, 12.0, 15.0]) lancet(fc, at(fc, a, s * NW), 10.5, 0.7, 2.0, 0);
    const fa = frame([AISLE_F, s * AW], [A_END, s * AW], [0, s]);
    for (const a of [-19.6, -10.4, 7.6]) lancet(fa, at(fa, a, s * AW), 1.4, 0.6, 5.2, 0);
  }
  // buttresses at the apse and transept corners, stone-capped
  for (const [a, bb] of [[A_END, -NW], [19.7, -2.2], [19.7, 2.2], [A_END, NW]] as Pt[]) {
    lbox(a, 0, bb, 0.7, 11.2, 0.7, 'brick');
    lbox(a, 11.2, bb, 0.8, 0.25, 0.8, 'stone');
  }
  for (const s of [-1, 1]) for (const [a, bb] of [[-4.3, s * 11.53], [-1.78, s * 14.05], [1.78, s * 14.05], [4.3, s * 11.53]] as Pt[]) {
    lbox(a, 0, bb, 0.7, 12.0, 0.7, 'brick');
    lbox(a, 12.0, bb, 0.8, 0.25, 0.8, 'stone');
  }

  // ---------------------------------------------------------------- crossing tower
  {
    octPrism(0, 12.0, 0, 4.7, 4.7, 8.0, 'brick');
    // steep slate base roof of the octagon with four small gabled lucarnes on the cardinal faces
    lput(new T.CylinderGeometry(3.45, 5.0, 7.0, 8).rotateY(Math.PI / 8).translate(0, 3.5, 0), 'slate', 0, 19.6, 0);
    octPrism(0, 26.5, 0, 3.2, 3.2, 0.5, 'stone');
    octPrism(0, 27.0, 0, 3.5, 3.4, 10.8, 'slate');
    octPrism(0, 37.8, 0, 3.8, 3.8, 0.4, 'stone');
    lput(new T.ConeGeometry(3.0, 9.4, 8).rotateY(Math.PI / 8).translate(0, 4.7, 0), 'slate', 0, 38.2, 0);
    lbox(0, 47.0, 0, 0.09, 1.3, 0.09, 'gold');
    lbox(0, 47.8, 0, 0.09, 0.09, 0.7, 'gold');
    // belfry: two tall lancet louvres on each of the eight faces, clock faces and stone gablets on the cardinal faces
    const rf = 3.45 * Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const al = k * Math.PI / 4;
      for (const o of [-0.62, 0.62]) {
        const tx = -Math.sin(al) * o, tz = Math.cos(al) * o;
        lbox(0 + (rf + 0.02) * Math.cos(al) + tx, 28.6, (rf + 0.02) * Math.sin(al) + tz, 0.1, 5.0, 0.55, 'dark', -al);
        lbox((rf + 0.04) * Math.cos(al) + tx, 33.7, (rf + 0.04) * Math.sin(al) + tz, 0.12, 0.14, 0.75, 'stone', -al);
      }
      if (k % 2 === 0) {
        const cx = (rf + 0.06) * Math.cos(al), cz = (rf + 0.06) * Math.sin(al);
        lput(new T.CylinderGeometry(0.8, 0.8, 0.08, 20).rotateZ(Math.PI / 2).translate(0, 0.0, 0), 'gold', cx, 35.6, cz, -al);
        lput(new T.CylinderGeometry(0.66, 0.66, 0.1, 20).rotateZ(Math.PI / 2), 'white', cx, 35.6, cz, -al);
        // stone gablet above the clock
        const f = frame([Math.cos(al) * rf + Math.sin(al) * -1.15, Math.sin(al) * rf + Math.cos(al) * 1.15], [Math.cos(al) * rf + Math.sin(al) * 1.15, Math.sin(al) * rf - Math.cos(al) * 1.15], [Math.cos(al), Math.sin(al)]);
        poly(b, f, 1.15, 37.8, [[-1.3, 0], [1.3, 0], [0, 2.9]], 0.3, 'stone', 0);
      }
    }
    // four slim corner pinnacles at the base of the belfry
    for (const [sa, sb] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      octPrism(sa * 2.9, 21.5, sb * 2.9, 0.55, 0.42, 9.5, 'slate');
      octCone(sa * 2.9, 31.0, sb * 2.9, 0.62, 4.2, 'slate');
    }
  }
}
