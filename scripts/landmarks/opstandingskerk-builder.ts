import type {BuildingTools} from './cultural-builders';
import {extrude, frame, localB, onWall, tris, win, type Col, type Kit, type V2} from './church-kit';
import {poly} from './nearbar-kit';
// Material slots: 'brick' red-brown brick, 'concrete' the light concrete mullions, fascias and the tower's lip,
// 'ochre' the low ring's wooden infill panels, 'slate' the dark roofing, 'bronze' the tower's zinc top, 'glass' glazing,
// 'white' the cross and the name board.

/**
 * Opstandingskerk ("De Kolenkit"), Bos en Lommerplein (M. F. Duintjer, 1956). Built from intent on the BAG plan and
 * 3DBAG heights.
 *
 * Plan (BAG 0363100012133302; plan coordinates (x along the hall, 15.3 degrees clockwise from east; z to the left of it,
 * see localB; the pointed end to the west):
 * a hall whose long walls and pointed west end are pleated in 1 m folds, the fold tops forming a zigzag crown above a
 * low gable roof (eaves 14.6 m, ridge 17.6 m), a plain brick east gable; a single-storey glazed ring (about 4 m)
 * wrapped round the west end and the south side; the slab tower at the north-east corner whose top slopes up to the
 * north from 34.5 m to 45.5 m (the coal scuttle), with a lip; a two-storey parish wing to the south-east.
 * Facade rhythm per wall: scripts/landmarks/opstandingskerk-research.json.
 */
const EAVE = 14.6, RIDGE = 17.6, HALF = 6.6, PLEAT = 0.33;
const roofAt = (b: number) => RIDGE - (RIDGE - EAVE) * Math.min(1, Math.abs(b) / HALF);
const E1: V2 = [14.08, HALF], E2: V2 = [17.53, -HALF], W: V2 = [-12.3, 0], NW: V2 = [-7, HALF], SW: V2 = [-7, -HALF];

/** Pleat the straight run a -> b into folds of about `pitch`, alternating `amp` out (+1) and in (-1) of the line. */
function pleat(a: V2, b: V2, pitch: number, amp: number, outward: V2): {p: V2; out: boolean}[] {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / pitch)), pts: {p: V2; out: boolean}[] = [];
  for (let i = 0; i < n; i++) {
    const f = i / n, o = i % 2 ? amp : -amp;
    pts.push({p: [a[0] + (b[0] - a[0]) * f + outward[0] * o, a[1] + (b[1] - a[1]) * f + outward[1] * o], out: o > 0});
  }
  return pts;
}

/** Closed solid over a polygon between per-vertex bottom and top heights (straight edges, planar faces assumed). */
function slopedSolid(k: Kit, ring: V2[], yb: (p: V2) => number, yt: (p: V2) => number, c: Col, sides: Col = c) {
  const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const quads: number[][][] = [];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    quads.push([[p[0], yb(p), p[1]], [q[0], yb(q), q[1]], [q[0], yt(q), q[1]]], [[p[0], yb(p), p[1]], [q[0], yt(q), q[1]], [p[0], yt(p), p[1]]]);
  }
  tris(k, quads, sides, (cc, n) => n.x * (cc.x - cx) + n.z * (cc.z - cz) > 0);
  const top: number[][][] = [], bot: number[][][] = [];
  for (let i = 1; i + 1 < ring.length; i++) {
    const [a, b, d] = [ring[0], ring[i], ring[i + 1]];
    top.push([[a[0], yt(a), a[1]], [b[0], yt(b), b[1]], [d[0], yt(d), d[1]]]);
    bot.push([[a[0], yb(a), a[1]], [b[0], yb(b), b[1]], [d[0], yb(d), d[1]]]);
  }
  tris(k, top, c, (_c, n) => n.y > 0);
  tris(k, bot, c, (_c, n) => n.y < 0);
}

/** Windows along a wall edge p -> q (outward normal to the right of travel), evenly spaced at about `pitch`. */
function edgeWindows(k: Kit, p: V2, q: V2, pitch: number, o: {y0: number; y1: number; fill?: (i: number) => Col | undefined; inset?: number}) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]), d: V2 = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], n: V2 = [d[1], -d[0]];
  const f = frame(p, n), sign = f.tangent[0] * d[0] + f.tangent[1] * d[1] > 0 ? 1 : -1;
  const m = Math.max(1, Math.floor((L - 2 * (o.inset ?? 0.3)) / pitch)), w = Math.min(pitch - 0.5, (L - 0.6) / m - 0.5);
  for (let i = 0; i < m; i++) {
    const t = sign * ((L - m * pitch) / 2 + pitch * (i + 0.5)), fill = o.fill?.(i);
    win(k, f, t, {w: w > 0.4 ? w : 0.4, y0: o.y0, y1: o.y1, head: 'flat', bars: 1, rowM: 1.6, surround: 'concrete', sill: 'concrete', bar: 'concrete', ...(fill ? {blind: true, fill} : {})});
  }
}

export function buildOpstandingskerk(_w: number, _d: number, b: BuildingTools) {
  const k = localB(b, -15.3);

  // ---- Hall: pleated outline ------------------------------------------------------------------------------------
  const run: {p: V2; out: boolean}[] = [
    ...pleat(W, NW, 1.0, PLEAT, [-0.79, 0.61]),
    ...pleat(NW, [9.8, HALF], 1.0, PLEAT, [0, 1]),
    {p: [9.8, HALF], out: false}, {p: E1, out: false}, {p: E2, out: false},
    ...pleat(E2, SW, 1.0, PLEAT, [0, -1]).slice(1),
    ...pleat(SW, W, 1.0, PLEAT, [-0.79, -0.61]),
  ];
  const ring = run.map(r => r.p);
  extrude(k, ring, 0, EAVE, 'brick');
  // Crown: each fold rises above the roof line, the outer folds highest; the east gable and tower side stay plain.
  for (let i = 0; i < run.length; i++) {
    const a = run[i], c = run[(i + 1) % run.length];
    if ((a.p[0] >= 9.8 && c.p[0] >= 9.8)) continue;
    const L = Math.hypot(c.p[0] - a.p[0], c.p[1] - a.p[1]), d: V2 = [(c.p[0] - a.p[0]) / L, (c.p[1] - a.p[1]) / L], n: V2 = [-d[1], d[0]]; // the hall outline runs clockwise: outward is to the left of travel
    const f = frame(a.p, n), s = f.tangent[0] * d[0] + f.tangent[1] * d[1] > 0 ? 1 : -1;
    const top = (r: {p: V2; out: boolean}) => roofAt(r.p[1]) + (r.out ? 1.5 : 0.1) - EAVE;
    poly(k, f, 0, EAVE, [[0, 0], [s * L, 0], [s * L, top(c)], [0, top(a)]], 0.3, 'brick', -0.3);
  }
  // Roof: two planes from the inner line of the folds to the ridge, the ridge running from the west point to the east gable.
  const RE: V2 = [(E1[0] + E2[0]) / 2, 0];
  const v = (p: V2): number[] => [p[0], roofAt(p[1]), p[1]];
  tris(k, [[v(W), v(RE), v([E1[0], HALF])], [v(W), v([E1[0], HALF]), v(NW)], [v(W), v(SW), v(E2)], [v(W), v(E2), v(RE)]], 'slate', (_c, n) => n.y > 0);
  tris(k, [[[E1[0], EAVE, E1[1]], [E2[0], EAVE, E2[1]], v(RE)]], 'brick', (_c, n) => n.x > 0);
  // Tall glass slits in the inward folds: every fold of the long walls up to the tower, the three central folds of the west point.
  for (let i = 0; i < run.length; i++) {
    const a = run[i], c = run[(i + 1) % run.length];
    const longWall = Math.abs(a.p[1]) >= HALF - 0.5 && a.p[0] >= -6.5 && a.p[0] <= 9.0; // every inward fold up to the tower (RCE 20357073)
    const westEnd = a.p[0] < -9.5 && Math.abs(a.p[1]) < 2.6; // the three central slits of the pointed end (photo 001)
    if (a.out || !(longWall || westEnd)) continue;
    const L = Math.hypot(c.p[0] - a.p[0], c.p[1] - a.p[1]), d: V2 = [(c.p[0] - a.p[0]) / L, (c.p[1] - a.p[1]) / L], n: V2 = [-d[1], d[0]];
    const f = frame(a.p, n), s = f.tangent[0] * d[0] + f.tangent[1] * d[1] > 0 ? 1 : -1;
    const y0 = westEnd || a.p[1] < 0 ? 4.6 : 2.0; // above the low ring on the south; the north side has no ring
    onWall(k, f, s * 0.36, y0, 0.42, (westEnd ? 15.0 : 14.3) - y0, 0.06, 'glass');
  }
  // East gable (RCE 20357069): a diamond lattice of 43 small square windows in nine staggered columns (4, 5 x 7, 4)
  // centred at 9.1 m; three entrance doors at the head of the steps under a name board; a plain brick pier rising
  // behind the south corner.
  {
    const L = Math.hypot(E2[0] - E1[0], E2[1] - E1[1]), d: V2 = [(E2[0] - E1[0]) / L, (E2[1] - E1[1]) / L], n: V2 = [-d[1], d[0]];
    const f = frame(E1, n), s = f.tangent[0] * d[0] + f.tangent[1] * d[1] > 0 ? 1 : -1;
    for (let c = -4; c <= 4; c++) {
      // Rectified pano (TMX7316010203-000293_pano_0000_004613, 50 px/m, 2026-10-13): column pitch 0.84 m, vertical pitch 1.24 m
      // with a half-pitch stagger, window 0.44 m, lattice centre 9.1 m above the landmark ground (it was drawn 1.7 m too high).
      const count = Math.abs(c) === 4 ? 4 : 5, lift = c % 2 ? 0.31 : -0.31;
      for (let j = 0; j < count; j++) onWall(k, f, s * (L / 2 + c * 0.84), 9.1 + lift + (j - (count - 1) / 2) * 1.24 - 0.22, 0.4, 0.45, 0.08, 'glass');
    }
    for (const c of [-1.6, 0, 1.6]) onWall(k, f, s * (L / 2 + c), 1.2, 1.1, 2.2, 0.08, 'dark');
    onWall(k, f, s * L / 2, 4.3, 3.8, 0.6, 0.1, 'white');
  }
  extrude(k, [[15.6, -6.2], [17.1, -6.2], [17.1, -7.6], [15.6, -7.6]], 0, 19.0, 'brick');

  // ---- Low glazed ring round the west end and along the south side -------------------------------------------------
  const C: V2 = [-7.1, -4.3], RA = 11.8, RB = 10.6, N = 14;
  const arc: V2[] = [];
  for (let i = 0; i <= N; i++) { const a = Math.PI / 2 + i * Math.PI / N; arc.push([C[0] + RA * Math.cos(a), C[1] + RB * Math.sin(a)]); }
  const low: V2[] = [...arc, [12.6, -14.9], [12.6, -6.4], [-7.1, -6.4]];
  extrude(k, low, 0, 3.8, 'concrete');
  const lowRoof: V2[] = [];
  for (let i = 0; i <= N; i++) { const a = Math.PI / 2 + i * Math.PI / N; lowRoof.push([C[0] + (RA + 0.5) * Math.cos(a), C[1] + (RB + 0.5) * Math.sin(a)]); }
  lowRoof.push([13.0, -15.4], [13.0, -6.2], [-6.9, -6.2]);
  extrude(k, lowRoof, 3.8, 4.2, 'concrete');
  // Roofing on top; its inner edge stops at z -6.0, clear of the wall and fascia edges at -6.4 and -6.2 inside the hall.
  extrude(k, [...arc, [12.6, -14.9], [12.6, -6.0], [-7.1, -6.0]], 4.2, 4.5, 'slate');
  for (let i = 0; i < N; i++) {
    const [p, q] = [arc[i], arc[i + 1]];
    // The arc runs clockwise seen from above in local x/z, so the outward normal is to the right of travel.
    edgeWindows(k, p, q, 1.4, {y0: 0.5, y1: 3.4, inset: 0.15, fill: j => (i >= 4 && i <= 9 && j % 3 !== 2 ? 'ochre' : undefined)});
  }
  edgeWindows(k, arc[N], [12.6, -14.9], 1.5, {y0: 0.5, y1: 3.4, fill: j => (j % 4 === 1 ? 'ochre' : undefined)});

  // ---- Tower: slab with the sloping top and its lip ----------------------------------------------------------
  // The tower's south face runs 0.4 m into the hall so the two masses join.
  const T: V2[] = [[9.8, 6.4], [14.1, 6.4], [12.5, 10.4], [11.3, 11.05], [10.2, 10.7], [9.8, 9.9]];
  const slope = (p: V2) => 34.5 + 2.6 * (p[1] - 6.8);
  slopedSolid(k, T, () => 0, slope, 'brick');
  const grow = (ring: V2[], d: number): V2[] => { const cx = 11.6, cz = 8.6; return ring.map(([x, z]) => { const l = Math.hypot(x - cx, z - cz); return [x + (x - cx) / l * d, z + (z - cz) / l * d]; }); };
  slopedSolid(k, grow(T, 0.25), p => slope(p) - 0.35, p => slope(p) + 0.1, 'bronze'); // zinc-clad sloping top with its lip
  // Belfry opening with a cross beside it, on the two broad faces.
  for (const [p, q] of [[T[5], T[0]], [T[1], T[2]]] as [V2, V2][]) {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), d: V2 = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], n: V2 = [d[1], -d[0]];
    const f = frame(p, n), s = f.tangent[0] * d[0] + f.tangent[1] * d[1] > 0 ? 1 : -1;
    onWall(k, f, s * L * 0.45, 27.4, 1.3, 3.0, 0.1, 'dark');
    onWall(k, f, s * L * 0.82, 29.0, 0.16, 1.2, 0.12, 'white');
    onWall(k, f, s * L * 0.82, 29.75, 0.6, 0.16, 0.12, 'white');
  }

  // ---- Parish wing to the south-east ---------------------------------------------------------------------------------
  const wing: V2[] = [[12.34, -14.97], [16.09, -26.86], [22.82, -24.85], [19.12, -12.83]];
  extrude(k, wing, 0, 8.2, 'brick');
  extrude(k, wing, 8.2, 8.5, 'slate');
  const link: V2[] = [[12.6, -14.6], [12.6, -6.6], [17.4, -6.6], [18.32, -13.09]];
  extrude(k, link, 0, 6.6, 'brick');
  extrude(k, link, 6.6, 6.9, 'slate');
  edgeWindows(k, wing[2], wing[3], 1.6, {y0: 5.0, y1: 7.4});
  edgeWindows(k, wing[0], wing[1], 1.6, {y0: 5.0, y1: 7.4});
  edgeWindows(k, wing[1], wing[2], 1.6, {y0: 5.0, y1: 7.4});
  edgeWindows(k, wing[1], wing[2], 1.6, {y0: 1.2, y1: 3.4});
}
