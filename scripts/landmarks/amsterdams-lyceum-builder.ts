import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {Acc, roof, type C} from './tier-kit';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {bar, face, glazing, outline, quad, shape, wall, type Face, type Op, type V3} from './face-kit';

/**
 * Het Amsterdams Lyceum, Valeriusplein 15 (BAG pand 0363100012149878; rijksmonument 504650, part of complex 504647).
 * H.A.J. and J. Baanders for the Vereeniging 'Het Amsterdamsch Lyceum', 1918-1920, built over the south end of the
 * Valeriusplein as a city gate (RCE register text, CC0; nl.wikipedia Amsterdams Lyceum). Register: a symmetric brick
 * school of cubic volumes under flat roofs, a corps de logis with two lower side wings; the corps de logis over the
 * Valeriusplein is a middle part between two projecting towers; at the ground two round-arched carriage passages and two
 * rectangular footways; the pilaster front over the passages two storeys high and six window axes wide; over the main
 * passages in high relief POTIUS DEFICERE QUAM DESPERARE (Valeriusplein) and IN HET EERSTE VREDESJAAR (the canal side);
 * the towers with eight-pane windows on the Valeriusplein side, a clock face with the year 1920 in the right-hand tower,
 * three coupled tall windows on every storey on the canal side; the wings of two storeys with higher corner parts; a
 * decorative brick frieze all round.
 *
 * Tower, wing and pavilion plans follow the BAG ring (its fronts are slightly asymmetric about the axis); the middle's
 * fronts follow the 3DBAG roof edges.
 * Native east/south metres from the BAG ring vertex average (amsterdams-lyceum-footprints.json), y above the 3DBAG ground
 * +0.46 m NAP, laid out in the building's own frame: a along its axis towards the east (bearing 65.4 deg), c towards the
 * Valeriusplein (north-west). Heights from the 3DBAG LoD2.2 parts (middle 17.7 m, towers 19.2-19.3 m, the links between
 * the towers 17.0-17.2 m, the wings 12.9-14.1 m, the end pavilions 15.1-15.2 m). The middle's fronts stand on the 3DBAG
 * roof edge (the BAG outline runs 3 m further out there, an overhang the photos do not show).
 *
 * Evidence (amsterdams-lyceum-inventory.json): recording_2025-07-29_12-06-07_02111 (2025, the canal side, w01) and
 * TMX7316010203-000259_pano_0008_000142 (2017, the Valeriusplein side, w02): the arches on a stout pier between stepped
 * buttresses, the footways, the four relief panels, the light HET AMSTERDAMS LYCEUM legend, six window axes over two
 * storeys between pilasters, the ribbed cornice; TMX7316010203-001160_pano_0000_001143 / _002080 (2019, w14/w15: the canal
 * towers' coupled windows); TMX7316010203-000259_pano_0008_000142 aimed view (the clock on the west tower);
 * TMX7316060226-000012_pano_0000_006548 and b_20241106_1111_Track22_Sphere_00022 (the wings); recording_2025-07-29_12-06-07_02118
 * and TMX7316060226-000012_pano_0000_006537 (the end pavilions); TMX7316010203-002118_pano_0000_008423 (the west end).
 */

// ---- the building frame ---------------------------------------------------------------------------------------------------
const E: PlanPoint = [0.9093, -0.4161], N: PlanPoint = [-0.4161, -0.9093];
const P = (a: number, c: number): PlanPoint => [E[0] * a + N[0] * c, E[1] * a + N[1] * c];
const R = (a0: number, a1: number, c0: number, c1: number): PlanPoint[] => [P(a0, c0), P(a1, c0), P(a1, c1), P(a0, c1)];
const NEG = (v: PlanPoint): PlanPoint => [-v[0], -v[1]];
function F(a0: number, c0: number, a1: number, c1: number, out: PlanPoint): Face {
  const f = face(P(a0, c0), P(a1, c1)), p = f.P(0, 0, 0), q = f.P(0, 0, 1);
  return (q[0] - p[0]) * out[0] + (q[2] - p[2]) * out[1] > 0 ? f : face(P(a1, c1), P(a0, c0));
}
/** t on face f of the building coordinate a (the face runs along a). */
function tOf(f: Face, a: number) {
  const p = f.P(0, 0, 0), q = f.P(1, 0, 0), a0 = p[0] * E[0] + p[2] * E[1], da = (q[0] - p[0]) * E[0] + (q[2] - p[2]) * E[1];
  return (a - a0) / da;
}
const ANGLE = Math.atan2(-E[1], E[0]);
const signAngle = (f: Face) => { const a = f.P(0, 0, 0), b = f.P(0, 0, 1); return Math.atan2(b[0] - a[0], b[2] - a[2]); };

// ---- plan -----------------------------------------------------------------------------------------------------------------
const MID = {a0: -9.9, a1: 9.8, c0: -9.9, c1: 7.9, h: 17.7};
const TOWERS = [
  {a0: -15.8, a1: -9.9, c0: 2.2, c1: 9.6, h: 19.2, nw: true, west: true}, {a0: -15.8, a1: -9.9, c0: -10.55, c1: -3.6, h: 19.2, nw: false, west: true},
  {a0: 9.8, a1: 15.5, c0: 2.2, c1: 8.6, h: 19.3, nw: true, west: false}, {a0: 9.8, a1: 15.5, c0: -11.25, c1: -3.6, h: 19.3, nw: false, west: false},
];
const LINKS = [{a0: -15.8, a1: -9.9, h: 17.0}, {a0: 9.8, a1: 15.5, h: 17.2}];
const WINGS = [{a0: -27.6, a1: -15.8, c0: -8.75, c1: 7.8, h: 13.5}, {a0: 15.5, a1: 27.4, c0: -10.0, c1: 6.75, h: 13.3}];
const ENDS = [{a0: -38.2, a1: -27.6, c0: -10.0, c1: 9.8, h: 15.2}, {a0: 27.4, a1: 38.0, c0: -11.8, c1: 7.95, h: 15.1}];
/** The passages through the middle (w01/w02, both sides alike): a centres and half widths. */
const ARCHES = [{a: -3.12, hw: 2.27}, {a: 3.12, hw: 2.27}], ARCH_SPRING = 2.85, ARCH_TOP = 5.12;
const FOOTWAYS = [{a0: -9.3, a1: -7.15}, {a0: 7.15, a1: 9.3}], FOOT_TOP = 2.55;
const BUTTRESSES = [-6.27, 0, 6.27];

// ---- shared details --------------------------------------------------------------------------------------------------------
/** The ribbed brick cornice: four courses, each standing further out (w01). */
function cornice(acc: Acc, f: Face, top: number) {
  [[top - 2.1, top - 1.85, 0.09], [top - 1.5, top - 1.25, 0.18], [top - 0.95, top - 0.7, 0.27], [top - 0.4, top, 0.36]].forEach(([y0, y1, o]) => bar(acc, 'brick', f, -0.02, f.L + 0.02, y0, y1, 0, o));
}
/** White-framed multi-pane windows: openings with white reveals, a grid of white bars, a stone sill. */
function windowRow(acc: Acc, f: Face, ops: Op[], cols: number, rows: number) {
  for (const o of ops) {
    glazing(acc, f, o, 'white', cols, rows);
    bar(acc, 'greyBrick', f, o.t0 - 0.08, o.t1 + 0.08, o.y0 - 0.16, o.y0, 0, 0.1);
  }
}
const win = (t0: number, t1: number, y0: number, y1: number, depth = 0.22): Op => ({t0, t1, y0, y1, depth, back: 'glass', rev: 'white'});

// ---- the middle over the Valeriusplein -------------------------------------------------------------------------------------
const WIN_A = [-7.9, -4.76, -1.65, 1.48, 4.56, 7.66], WIN_W = 1.65, ROWS: [number, number][] = [[7.3, 10.4], [12.3, 15.35]];
function archRing(f: Face, a: number, hw: number, o = 0): [number, number][] {
  // a hole, clockwise as seen from outside: up the right side, over the arch, down the left side
  const tl = tOf(f, a - hw), tr = tOf(f, a + hw), t0 = Math.min(tl, tr), t1 = Math.max(tl, tr), r = (t1 - t0) / 2, tc = (t0 + t1) / 2;
  const pts: [number, number][] = [[t0, 0], [t0, ARCH_SPRING]];
  for (let k = 1; k < 12; k++) { const th = Math.PI - Math.PI * k / 12; pts.push([tc + r * Math.cos(th), ARCH_SPRING + (ARCH_TOP - ARCH_SPRING) * Math.sin(th)]); }
  pts.push([t1, ARCH_SPRING], [t1, 0]);
  void o;
  return pts;
}
function middleFront(acc: Acc, b: BuildingTools, f: Face, plaques: string[]) {
  const Z = 7.2;
  // the ground zone with the arches and the footways cut through
  const holes: [number, number][][] = ARCHES.map(x => archRing(f, x.a, x.hw));
  for (const fw of FOOTWAYS) { const t0 = Math.min(tOf(f, fw.a0), tOf(f, fw.a1)), t1 = Math.max(tOf(f, fw.a0), tOf(f, fw.a1)); holes.push([[t0, 0], [t0, FOOT_TOP], [t1, FOOT_TOP], [t1, 0]]); }
  outline(acc, 'brick', f, [[0, 0], [f.L, 0], [f.L, Z], [0, Z]], 0, holes);
  // the stepped buttresses between the openings
  for (const a of BUTTRESSES) {
    const t = tOf(f, a), w = a === 0 ? 0.85 : 0.82;
    bar(acc, 'brick', f, t - w, t + w, 0, 3.9, 0, 0.9, true);
    bar(acc, 'brick', f, t - w + 0.12, t + w - 0.12, 3.9, 4.35, 0, 0.65, true);
    bar(acc, 'brick', f, t - w + 0.25, t + w - 0.25, 4.35, 4.7, 0, 0.4, true);
  }
  // the arch rings: a brick band 0.45 m wide, 6 cm proud, round each carriage arch
  for (const x of ARCHES) {
    const ring = archRing(f, x.a, x.hw), outer = archRing(f, x.a, x.hw + 0.45).map(([t, y]) => [t, y >= ARCH_SPRING ? ARCH_SPRING + (y - ARCH_SPRING) * (ARCH_TOP + 0.45 - ARCH_SPRING) / (ARCH_TOP - ARCH_SPRING) : y] as [number, number]);
    const band: [number, number][] = [...outer.slice(1, -1).reverse(), ...ring.slice(1, -1)];
    outline(acc, 'greyBrick', f, band.reverse(), 0.06);
  }
  // the four relief panels and the legend (light Amsterdam School capitals)
  const PL = [-4.9, -1.68, 1.52, 4.72];
  PL.forEach((a, i) => {
    const t = tOf(f, a);
    bar(acc, 'greyBrick', f, t - 0.95, t + 0.95, 6.3, 6.9, 0, 0.08);
    const p = f.P(t, 6.42, 0.1); b.sign(plaques[i], p[0], p[1], p[2], 0.05, 'stone', 1.7, signAngle(f));
  });
  { const p = f.P(tOf(f, 0), 5.5, 0.04); b.sign('HET AMSTERDAMS LYCEUM', p[0], p[1], p[2], 0.06, 'stone', 7.6, signAngle(f)); }
  // the pilaster front: two storeys of six window axes, brick panels between, the ribbed cornice
  const ops: Op[] = ROWS.flatMap(([y0, y1]) => WIN_A.map(a => { const t = tOf(f, a); return win(t - WIN_W / 2, t + WIN_W / 2, y0, y1); }));
  wall(acc, f, Z, MID.h, 'brick', ops);
  windowRow(acc, f, ops, 4, 3);
  for (let i = 0; i <= WIN_A.length; i++) {
    const a = i === 0 ? WIN_A[0] - 1.55 : i === WIN_A.length ? WIN_A[5] + 1.55 : (WIN_A[i - 1] + WIN_A[i]) / 2, t = tOf(f, a);
    bar(acc, 'brick', f, t - 0.55, t + 0.55, Z, 15.5, 0, 0.18);   // the pilasters
    bar(acc, 'greyBrick', f, t - 0.65, t + 0.65, Z, Z + 0.45, 0, 0.3);   // their bases on the sill band
  }
  bar(acc, 'greyBrick', f, 0, f.L, Z - 0.2, Z, 0, 0.12);   // the sill band
  cornice(acc, f, MID.h);
}
/** The passages' vaults and side walls (the register's cross vaults drawn as barrels). */
function passages(acc: Acc) {
  const c0 = MID.c0, c1 = MID.c1;
  const V = (a: number, y: number, c: number): V3 => { const p = P(a, c); return [p[0], y, p[1]]; };
  for (const x of ARCHES) {
    const l = x.a - x.hw, r = x.a + x.hw, rr = x.hw;
    quad(acc, 'brick', V(l, 0, c0), V(l, 0, c1), V(l, ARCH_SPRING, c1), V(l, ARCH_SPRING, c0));
    quad(acc, 'brick', V(r, 0, c1), V(r, 0, c0), V(r, ARCH_SPRING, c0), V(r, ARCH_SPRING, c1));
    for (let k = 0; k < 12; k++) {
      const t0 = Math.PI * k / 12, t1 = Math.PI * (k + 1) / 12;
      const a0 = x.a - rr * Math.cos(t0), y0 = ARCH_SPRING + (ARCH_TOP - ARCH_SPRING) * Math.sin(t0);
      const a1 = x.a - rr * Math.cos(t1), y1 = ARCH_SPRING + (ARCH_TOP - ARCH_SPRING) * Math.sin(t1);
      quad(acc, 'brick', V(a0, y0, c0), V(a0, y0, c1), V(a1, y1, c1), V(a1, y1, c0));
    }
  }
  for (const fw of FOOTWAYS) {
    quad(acc, 'brick', V(fw.a0, 0, c0), V(fw.a0, 0, c1), V(fw.a0, FOOT_TOP, c1), V(fw.a0, FOOT_TOP, c0));
    quad(acc, 'brick', V(fw.a1, 0, c1), V(fw.a1, 0, c0), V(fw.a1, FOOT_TOP, c0), V(fw.a1, FOOT_TOP, c1));
    quad(acc, 'brick', V(fw.a0, FOOT_TOP, c0), V(fw.a0, FOOT_TOP, c1), V(fw.a1, FOOT_TOP, c1), V(fw.a1, FOOT_TOP, c0));
  }
}

// ---- the towers, links, wings and end pavilions -------------------------------------------------------------------------------
function towerFace(acc: Acc, f: Face, from: number, top: number, kind: 'canal' | 'plein' | 'side', skipRow = -1) {
  const ops: Op[] = [], tc = f.L / 2;
  const rows: [number, number][] = kind === 'canal' ? [[1.0, 2.6], [4.4, 7.0], [8.3, 10.9], [12.2, 14.8], [16.0, 17.2]] : [[4.6, 6.9], [8.4, 10.7], [12.2, 14.5], [15.6, 16.9]];
  rows.forEach(([y0, y1], k) => {
    if (y0 < from + 0.3 || k === skipRow) return;
    if (kind === 'canal') for (const d of [-1.05, 0, 1.05]) ops.push(win(tc + d - 0.36, tc + d + 0.36, y0, y1, 0.25));
    else if (kind === 'plein') ops.push(win(tc - 0.6, tc + 0.6, y0, y1, 0.25));
    else if (k < 3 && f.L > 4.5) for (const d of [-1.3, 1.3]) ops.push(win(tc + d - 0.55, tc + d + 0.55, y0, y1, 0.25));
  });
  wall(acc, f, from, top, 'brick', ops);
  windowRow(acc, f, ops, 2, 4);
  // the canal fronts' ribbed brick strips between and beside the coupled windows (w14, w15)
  if (kind === 'canal') for (const d of [-1.575, -0.525, 0.525, 1.575]) bar(acc, 'brick', f, tc + d - 0.12, tc + d + 0.12, 0.8, top - 2.2, 0, 0.1);
  cornice(acc, f, top);
}
function clock(b: BuildingTools, f: Face) {
  // the clock face with the year 1920 in the west tower on the Valeriusplein side, in place of its third-storey window
  // (register; the 2017 view w02 shows the disc level with the middle's upper window row)
  const t = f.L / 2, y = 13.4, ang = signAngle(f);
  const disc = new T.CylinderGeometry(0.62, 0.62, 0.08, 20); disc.rotateX(Math.PI / 2); disc.rotateY(ang);
  const p = f.P(t, y, 0.05); disc.translate(p[0], p[1], p[2]); b.add(disc, 'gold');
  const ring = new T.TorusGeometry(0.64, 0.05, 4, 20); ring.rotateY(ang); const q = f.P(t, y, 0.09); ring.translate(q[0], q[1], q[2]); b.add(ring, 'brick');
  for (const [len, th] of [[0.42, 0.3], [0.3, 2.2]] as const) {
    const h = new T.BoxGeometry(0.05, len, 0.03); h.translate(0, len / 2, 0); h.rotateZ(-th); h.rotateY(ang);
    const r = f.P(t, y, 0.11); h.translate(r[0], r[1], r[2]); b.add(h, 'dark');
  }
  const s = f.P(t, y - 0.38, 0.1); b.sign('1920', s[0], s[1], s[2], 0.035, 'dark', 0.5, ang);
}
function towers(acc: Acc, b: BuildingTools) {
  for (const tw of TOWERS) {
    const outC = tw.nw ? N : NEG(N), cf = tw.nw ? tw.c1 : tw.c0, cb = tw.nw ? tw.c0 : tw.c1;
    const front = F(tw.a0, cf, tw.a1, cf, outC);
    towerFace(acc, front, 0, tw.h, tw.nw ? 'plein' : 'canal', tw.nw && tw.west ? 2 : -1);
    if (tw.nw && tw.west) clock(b, front);
    // the outer side (over the wing) and the inner side (beside the middle)
    const outer = tw.west ? tw.a0 : tw.a1, inner = tw.west ? tw.a1 : tw.a0, outA = tw.west ? NEG(E) : E;
    const wing = WINGS[tw.west ? 0 : 1];
    // the part of the outer side in front of the wing (the wing reaches c0..c1)
    const cw = tw.nw ? wing.c1 : wing.c0;
    if (Math.abs(cf - cw) > 0.3) towerFace(acc, F(outer, cf, outer, cw, outA), 0, tw.h, 'side');
    towerFace(acc, F(outer, cw, outer, cb, outA), wing.h, tw.h, 'side');
    const mc = tw.nw ? MID.c1 : MID.c0;
    wall(acc, F(inner, cf, inner, mc, NEG(outA)), 0, tw.h, 'brick', []);
    wall(acc, F(inner, mc, inner, cb, NEG(outA)), MID.h, tw.h, 'brick', []);
    cornice(acc, F(inner, cf, inner, mc, NEG(outA)), tw.h);
    // its back over the link
    const link = LINKS[tw.west ? 0 : 1];
    wall(acc, F(tw.a0, cb, tw.a1, cb, NEG(outC)), link.h, tw.h, 'brick', []);
    roof(b, shape(R(tw.a0, tw.a1, tw.c0, tw.c1)), tw.h, 'slate');
  }
  for (const [i, l] of LINKS.entries()) {
    const outA = i === 0 ? NEG(E) : E, x = i === 0 ? l.a0 : l.a1;
    wall(acc, F(x, -3.6, x, 2.2, outA), WINGS[i].h, l.h, 'brick', []);
    roof(b, shape(R(l.a0, l.a1, -3.6, 2.2)), l.h, 'slate');
  }
}
/**
 * The wings' long fronts (w04, w07, fitted to the 3DBAG 13.3-13.5 m eaves): basement lights, two storeys of four
 * white-framed windows between proud ribbed piers, a brick band between the storeys, the stepped cornice right above
 * the upper windows.
 */
function wingFace(acc: Acc, f: Face, top: number, n: number) {
  const ops: Op[] = [], bw = f.L / n, w = Math.min(1.85, bw - 0.9);
  for (let i = 0; i < n; i++) {
    const tc = (i + 0.5) * bw;
    ops.push(win(tc - w / 2, tc + w / 2, 0.3, 1.2, 0.18), win(tc - w / 2, tc + w / 2, 3.2, 6.2), win(tc - w / 2, tc + w / 2, 8.2, 11.2));
  }
  wall(acc, f, 0, top, 'brick', ops);
  windowRow(acc, f, ops, 4, 3);
  for (let i = 0; i <= n; i++) { const t = Math.min(f.L - 0.4, Math.max(0.4, i * bw)); bar(acc, 'brick', f, t - 0.4, t + 0.4, 2.9, top - 2.1, 0, 0.16); }
  bar(acc, 'greyBrick', f, 0, f.L, 6.75, 7.0, 0, 0.1);   // the band between the storeys
  cornice(acc, f, top);
}
function wingsAndEnds(acc: Acc, b: BuildingTools) {
  for (const [i, w] of WINGS.entries()) {
    wingFace(acc, F(w.a0, w.c1, w.a1, w.c1, N), w.h, 4);
    wingFace(acc, F(w.a0, w.c0, w.a1, w.c0, NEG(N)), w.h, 4);
    roof(b, shape(R(w.a0, w.a1, w.c0, w.c1)), w.h, 'slate');
    void i;
  }
  for (const [i, e] of ENDS.entries()) {
    const outA = i === 0 ? NEG(E) : E, x = i === 0 ? e.a0 : e.a1, inner = i === 0 ? e.a1 : e.a0, w = WINGS[i];
    // the long fronts of the corner pavilions (w08, w10): two coupled windows per storey, three storeys
    for (const [cc, out] of [[e.c1, N], [e.c0, NEG(N)]] as [number, PlanPoint][]) {
      const f = F(e.a0, cc, e.a1, cc, out), ops: Op[] = [];
      for (const [y0, y1] of [[0.35, 1.25], [2.9, 5.7], [6.9, 9.5], [10.8, 12.9]] as [number, number][]) for (const d of [-1.6, 1.6]) ops.push(win(f.L / 2 + d - 1.0, f.L / 2 + d + 1.0, y0, y1, y0 < 1 ? 0.18 : 0.22));
      wall(acc, f, 0, e.h, 'brick', ops); windowRow(acc, f, ops, 3, 3); cornice(acc, f, e.h);
    }
    // the street end (w12): five windows a storey
    { const f = F(x, e.c0, x, e.c1, outA), ops: Op[] = [], n = 5, bw = f.L / n;
      for (let k = 0; k < n; k++) for (const [y0, y1] of [[0.35, 1.25], [2.9, 5.7], [6.9, 9.5], [10.8, 12.9]] as [number, number][]) ops.push(win((k + 0.5) * bw - 0.95, (k + 0.5) * bw + 0.95, y0, y1, y0 < 1 ? 0.18 : 0.22));
      wall(acc, f, 0, e.h, 'brick', ops); windowRow(acc, f, ops, 3, 3); cornice(acc, f, e.h); }
    // the inner end: blank where the wing stands against it, brick above and beside it
    const fi = (c0: number, c1: number) => F(inner, c0, inner, c1, NEG(outA));
    wall(acc, fi(w.c0, w.c1), w.h, e.h, 'brick', []);
    if (e.c1 - w.c1 > 0.3) wall(acc, fi(w.c1, e.c1), 0, e.h, 'brick', []);
    if (w.c0 - e.c0 > 0.3) wall(acc, fi(e.c0, w.c0), 0, e.h, 'brick', []);
    roof(b, shape(R(e.a0, e.a1, e.c0, e.c1)), e.h, 'slate');
  }
}

/**
 * The brick lattice garden walls in front of the wings on the Valeriusplein side (w05, w06, w09, w11: about 2.4 m high,
 * piers every ~3 m, panels of open stretcher lattice); outside the pand, placed about 3 m in front of the towers' fronts
 * from the panoramas (no OSM barrier way was available), declared as detached structures in the spec.
 */
export const GARDEN_WALL = {c: 12.6, a0: 16.0, a1: 36.0, h: 2.4, th: 0.34};
function gardenWalls(acc: Acc) {
  const {c, h, th} = GARDEN_WALL;
  for (const s of [-1, 1]) {
    const a0 = s * GARDEN_WALL.a0, a1 = s * GARDEN_WALL.a1;
    const front = F(a0, c + th, a1, c + th, N), back = F(a0, c, a1, c, NEG(N));
    const n = Math.round(front.L / 3.1), pw = front.L / n, ops: Op[] = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) for (const [y0, y1] of [[0.75, 1.1], [1.25, 1.6], [1.75, 2.1]]) {
      const t0 = i * pw + 0.5 + k * (pw - 1.0) / 4;
      ops.push({t0: t0 + 0.06, t1: t0 + (pw - 1.0) / 4 - 0.06, y0, y1, depth: 0.12, back: 'dark', rev: 'brick'});
    }
    wall(acc, front, 0, h, 'brick', ops);
    wall(acc, back, 0, h, 'brick', []);
    for (const a of [a0, a1]) wall(acc, F(a, c, a, c + th, s * (a === a1 ? 1 : -1) > 0 ? E : NEG(E)), 0, h, 'brick', []);
    bar(acc, 'greyBrick', front, -0.04, front.L + 0.04, h, h + 0.12, -th - 0.04, 0.04, true);
    for (let i = 0; i <= n; i++) bar(acc, 'brick', front, i * pw - 0.25, i * pw + 0.25, 0, h + 0.2, 0, 0.1);
  }
}

export function buildAmsterdamsLyceum(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  middleFront(acc, b, F(MID.a0, MID.c1, MID.a1, MID.c1, N), ['POTIUS', 'DEFICERE', 'QUAM', 'DESPERARE']);
  middleFront(acc, b, F(MID.a0, MID.c0, MID.a1, MID.c0, NEG(N)), ['IN HET', 'EERSTE', 'VREDES', 'JAAR']);
  passages(acc);
  roof(b, shape(R(MID.a0, MID.a1, MID.c0, MID.c1)), MID.h, 'slate');
  towers(acc, b);
  wingsAndEnds(acc, b);
  gardenWalls(acc);
  acc.flush();
  void ANGLE;
}
