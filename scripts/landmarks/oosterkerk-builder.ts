import type {BuildingTools} from './cultural-builders';
import {balustrade, block, clockFace, door, extrude, facets, flare, frame, hipRoof, lathe, local, octagon, onWall, rect, win, type Col, type Kit, type V2, type Win} from './church-kit';
import {archSlab} from './nearbar-kit';

/**
 * Oosterkerk, Wittenburgergracht (Daniel Stalpaert, 1669-1671). Built from intent, not from survey roof planes.
 *
 * Plan (BAG 0363100012170274, native east/south metres from the BAG centroid): a 29.6 x 29.9 m square on a 45 degree
 * grid (local x towards the north east), with a 4.5 m porch block on the south-west (Wittenburgergracht) front and a 5 m
 * single-storey annex (consistory) on the north-east back, both 14 m wide on the cross axis.
 * Massing (3DBAG LoD2.2 heights, photographs): an equal-armed cross of 14 m arms rising to a 22.5 m cornice under hipped
 * slate roofs that meet at 31.7 m; the four corners between the arms are lower blocks (14 m cornice) whose roofs lean
 * against the arms; the porch has a flat top at 13.8 m behind a balustrade; on the crossing a lead-clad square base, an open
 * octagonal belfry with four clock faces, an ogee dome and a small lantern (3DBAG 43.8 m at the dome).
 * Facade rhythm: scripts/landmarks/oosterkerk-research.json (per wall, with the photo each count comes from).
 */
const ZC = -0.6; // centre line of the north-east/south-west arm
const XS = 14.8, ZN = -15.5, ZS = 14.4; // square: x in [-XS, XS], z in [ZN, ZS]
const AW = 7; // half width of the arms
const A0 = ZC - AW, A1 = ZC + AW; // arm A (along x) z-range
const EAVE_LOW = 14, EAVE_ARM = 22.5, RIDGE = 31.7, PORCH = 14.9, PORCH_X = -19.3, ANNEX_X = 19.9, ANNEX_EAVE = 7.3, ANNEX_TOP = 9.6;

const BR: Partial<Win> = {surround: 'brick', bar: 'frame'};
const W_UP: Win = {w: 2.2, y0: 16.3, y1: 21.0, bars: 2, ...BR};
const W_TALL: Win = {w: 2.2, y0: 6.0, y1: 12.5, bars: 2, ...BR};
const W_RECT: Win = {w: 2.2, y0: 1.9, y1: 3.9, head: 'flat', bars: 2, ...BR};
const W_OVER_ANNEX: Win = {w: 2.2, y0: 9.9, y1: 12.7, bars: 2, ...BR};

/** Frame on an axis-aligned wall plane; `at(u)` maps the local x or z coordinate along the wall to the frame's t. */
function face(n: V2, plane: number) {
  if (n[1] === 0) return {f: frame([plane, 0], n), at: (z: number) => (n[0] < 0 ? z : -z)};
  return {f: frame([0, plane], n), at: (x: number) => (n[1] > 0 ? x : -x)};
}

/** Corner roof: two planes rising at `slope` from the outer eaves (x = xo, z = zo) meet on the diagonal and stop at the arm walls. */
function cornerRoof(k: Kit, xo: number, xi: number, zo: number, zi: number, y: number, slope: number, c: Col) {
  const sx = Math.sign(xi - xo), sz = Math.sign(zi - zo), dx = Math.abs(xi - xo), dz = Math.abs(zi - zo), m = Math.min(dx, dz);
  const R = [xo + sx * m, y + slope * m, zo + sz * m];
  const O = [xo, y, zo];
  if (dx <= dz) {
    facets(k, [[O, [xo, y, zi], [xi, y + slope * dx, zi], R], [O, R, [xi, y, zo]]], c);
  } else {
    facets(k, [[O, [xo, y, zi], R], [O, R, [xi, y + slope * dz, zi], [xi, y, zo]]], c);
  }
}

/** Lean-to with hipped ends against a higher wall: eaves on x = xe and on the two z sides, the wall at x = xw. */
function leanHip(k: Kit, xe: number, xw: number, z0: number, z1: number, y: number, top: number, c: Col) {
  const inset = Math.min(Math.abs(xe - xw), (z1 - z0) / 2); // hips at the same pitch as the main slope
  const za = z0 + inset, zb = z1 - inset;
  facets(k, [
    [[xe, y, z0], [xe, y, z1], [xw, top, zb], [xw, top, za]],
    [[xe, y, z0], [xw, top, za], [xw, y, z0]],
    [[xe, y, z1], [xw, y, z1], [xw, top, zb]],
  ], c);
}

/**
 * A small dormer on a roof slope that rises inward from an eave line at `eaveY` with `slope`: the cheek box starts where
 * the slope reaches its sill and runs back until the slope covers its top, so it never floats or pokes out behind.
 */
function dormer(k: Kit, n: V2, eaveLine: number, u: number, eaveY: number, slope: number, y: number, h = 1.5) {
  const fi = (y - eaveY) / slope + 0.1, bi = (y + h + 0.25 - eaveY) / slope, D = bi - fi;
  const fr = face(n, eaveLine - n[0] * bi - n[1] * bi), t = fr.at(u);
  onWall(k, fr.f, t, y, 1.3, h, D, 'brick');
  onWall(k, fr.f, t, y + 0.2, 0.8, h - 0.45, D + 0.04, 'glass');
  onWall(k, fr.f, t, y + 0.2, 0.06, h - 0.45, D + 0.1, 'frame');
  onWall(k, fr.f, t, y + h, 1.5, 0.16, D + 0.12, 'stone');
}

export function buildOosterkerk(_w: number, _d: number, b: BuildingTools) {
  const k = local(b, 45);

  // ---- Masonry volumes --------------------------------------------------------------------------------------------
  const cross: V2[] = [[-XS, A0], [-AW, A0], [-AW, ZN], [AW, ZN], [AW, A0], [XS, A0], [XS, A1], [AW, A1], [AW, ZS], [-AW, ZS], [-AW, A1], [-XS, A1]];
  extrude(k, cross, 0, EAVE_ARM, 'brick');
  const corners: [number, number, number, number][] = [[-XS, -AW, ZN, A0], [AW, XS, ZN, A0], [-XS, -AW, A1, ZS], [AW, XS, A1, ZS]];
  for (const [x0, x1, z0, z1] of corners) extrude(k, rect(x0, x1, z0, z1), 0, EAVE_LOW, 'brick');
  extrude(k, rect(PORCH_X, -XS, A0, A1), 0, PORCH - 0.1, 'brick');
  extrude(k, rect(PORCH_X, -XS, A0, A1), PORCH - 0.1, PORCH, 'bronze'); // lead-covered flat roof
  extrude(k, rect(XS, ANNEX_X, A0, A1), 0, ANNEX_EAVE, 'brick');

  // ---- Cornices (cream stone) -------------------------------------------------------------------------------------
  const off = (ring: V2[], d: number): V2[] => ring.map((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length], c = ring[(i + 1) % ring.length];
    const n1: V2 = [p[1] - a[1], -(p[0] - a[0])], n2: V2 = [c[1] - p[1], -(c[0] - p[0])];
    const u = (v: V2): V2 => { const L = Math.hypot(v[0], v[1]); return [v[0] / L, v[1] / L]; };
    const [m1, m2] = [u(n1), u(n2)];
    return [p[0] - (m1[0] + m2[0]) * d, p[1] - (m1[1] + m2[1]) * d];
  });
  // `cross` is clockwise in (x, z) seen from above with z south... the offset sign is checked by its area below.
  const area = (r: V2[]) => r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0) / 2;
  const grow = (r: V2[], d: number) => { const o = off(r, d); return Math.abs(area(o)) > Math.abs(area(r)) ? o : off(r, -d); };
  extrude(k, grow(cross, 0.5), EAVE_ARM - 0.65, EAVE_ARM, 'stone');
  for (const [x0, x1, z0, z1] of corners) {
    const xo = x0 === -XS ? x0 : x1, zo = z0 === ZN ? z0 : z1, xi = xo === x0 ? x1 : x0, zi = zo === z0 ? z1 : z0;
    const sx = Math.sign(xo - xi), sz = Math.sign(zo - zi), d = 0.45;
    extrude(k, [[xi, zo], [xo, zo], [xo, zi], [xo + sx * d, zi], [xo + sx * d, zo + sz * d], [xi, zo + sz * d]], EAVE_LOW - 0.6, EAVE_LOW, 'stone');
  }
  extrude(k, [[PORCH_X - 0.4, A0 - 0.4], [-XS, A0 - 0.4], [-XS, A0], [PORCH_X, A0], [PORCH_X, A1], [-XS, A1], [-XS, A1 + 0.4], [PORCH_X - 0.4, A1 + 0.4]], PORCH - 0.9, PORCH, 'stone');
  extrude(k, [[ANNEX_X + 0.3, A0 - 0.3], [ANNEX_X + 0.3, A1 + 0.3], [XS, A1 + 0.3], [XS, A1], [ANNEX_X, A1], [ANNEX_X, A0], [XS, A0], [XS, A0 - 0.3]], ANNEX_EAVE - 0.4, ANNEX_EAVE, 'stone');

  // ---- Roofs from intent ------------------------------------------------------------------------------------------
  hipRoof(k, -XS, XS, A0, A1, EAVE_ARM, RIDGE - EAVE_ARM, 'slate');
  hipRoof(k, -AW, AW, ZN, ZS, EAVE_ARM, RIDGE - EAVE_ARM, 'slate');
  for (const [x0, x1, z0, z1] of corners) {
    const xo = x0 === -XS ? x0 : x1, zo = z0 === ZN ? z0 : z1;
    cornerRoof(k, xo, xo === x0 ? x1 : x0, zo, zo === z0 ? z1 : z0, EAVE_LOW, 0.9, 'slate');
  }
  leanHip(k, ANNEX_X, XS, A0, A1, ANNEX_EAVE, ANNEX_TOP, 'slate');

  // ---- Porch top: balustrade on three sides ------------------------------------------------------------------------
  {
    const fr = face([-1, 0], PORCH_X);
    balustrade(k, fr.f, fr.at(A0) + 0.3, fr.at(A1) - 0.3, PORCH, {out: -0.55});
    const fs = face([0, -1], A0), fn = face([0, 1], A1);
    balustrade(k, fs.f, fs.at(-XS), fs.at(PORCH_X) - 0.3, PORCH, {out: -0.55});
    balustrade(k, fn.f, fn.at(PORCH_X) + 0.3, fn.at(-XS), PORCH, {out: -0.55});
  }

  // ---- Openings ---------------------------------------------------------------------------------------------------
  const along = (n: V2, plane: number, us: number[], o: Win) => { const fr = face(n, plane); for (const u of us) win(k, fr.f, fr.at(u), o); };
  const armA = [ZC - 4.2, ZC, ZC + 4.2], armB = [-4.2, 0, 4.2];
  // Upper arm ends, all four: three tall round-arched windows (photos: SW RCE 20013327, NE Commons back, SE Commons 2017).
  along([-1, 0], -XS, armA, W_UP); along([1, 0], XS, armA, W_UP);
  along([0, -1], ZN, armB, W_UP); along([0, 1], ZS, armB, W_UP);
  // Corner blocks: one tall window over a low rectangle, centred on each outer face (pano 001177: S corner, both faces).
  // On the north-east back the low windows sit higher, level with the annex sashes (Commons back photo, 2020).
  for (const z of [(ZN + A0) / 2, (A1 + ZS) / 2]) for (const [n, x] of [[[-1, 0], -XS], [[1, 0], XS]] as [V2, number][]) { along(n, x, [z], W_TALL); along(n, x, [z], x > 0 ? {...W_RECT, y0: 3.5, y1: 5.3} : W_RECT); }
  const cornerSE = [-(XS + AW) / 2, (XS + AW) / 2];
  for (const [n, z] of [[[0, -1], ZN], [[0, 1], ZS]] as [V2, number][]) {
    along(n, z, [...cornerSE, ...armB], W_TALL);
    along(n, z, [...cornerSE, ...armB], W_RECT);
  }
  // NE arm above the annex roof: three shorter arched windows.
  along([1, 0], XS, armA, W_OVER_ANNEX);
  // SW porch front: three bays between pilasters; tall window over the 1671 doorway in the middle, blind arches beside it.
  {
    const fr = face([-1, 0], PORCH_X);
    win(k, fr.f, fr.at(ZC), W_TALL);
    for (const z of [ZC - 4.2, ZC + 4.2]) { win(k, fr.f, fr.at(z), {...W_TALL, blind: true}); win(k, fr.f, fr.at(z), W_RECT); }
    door(k, fr.f, fr.at(ZC), {w: 1.7, y1: 3.4, fan: true, pediment: true});
    onWall(k, fr.f, fr.at(ZC), 4.75, 2.6, 0.55, 0.06, 'stone'); // inscription tablet CIDIDCLXXI
    for (const z of [A0 + 0.5, ZC - 2.3, ZC + 2.3, A1 - 0.5]) onWall(k, fr.f, fr.at(z), 0, 0.9, PORCH - 0.9, 0.12, 'brick');
    for (const [n, z] of [[[0, -1], A0], [[0, 1], A1]] as [V2, number][]) { along(n, z, [(PORCH_X - XS) / 2], W_TALL); along(n, z, [(PORCH_X - XS) / 2], W_RECT); }
  }
  // NE annex: two sash windows over low cellar doors, a doorway with a fanlight in the middle, a dormer on the roof.
  {
    const fr = face([1, 0], ANNEX_X);
    for (const z of [ZC - 3.4, ZC + 3.4]) {
      win(k, fr.f, fr.at(z), {w: 1.3, y0: 3.4, y1: 6.2, head: 'flat', bars: 1, rowM: 0.7, surround: 'frame'});
      door(k, fr.f, fr.at(z), {w: 1.2, y1: 2.2});
    }
    door(k, fr.f, fr.at(ZC), {w: 1.5, y1: 3.4, fan: true});
    dormer(k, [1, 0], ANNEX_X, ZC, ANNEX_EAVE, (ANNEX_TOP - ANNEX_EAVE) / (ANNEX_X - XS), ANNEX_EAVE + 0.35, 1.1);
  }

  // ---- Pilaster strips and flared footings ------------------------------------------------------------------------
  const strip = (n: V2, plane: number, u: number, y0: number, y1: number) => { const fr = face(n, plane); onWall(k, fr.f, fr.at(u), y0, 0.8, y1 - y0, 0.12, 'brick'); };
  for (const [n, plane, lo, hi] of [[[-1, 0], -XS, A0, A1], [[1, 0], XS, A0, A1]] as [V2, number, number, number][]) {
    strip(n, plane, lo + 0.5, EAVE_LOW, EAVE_ARM - 0.65); strip(n, plane, hi - 0.5, EAVE_LOW, EAVE_ARM - 0.65);
  }
  for (const [n, plane] of [[[0, -1], ZN], [[0, 1], ZS]] as [V2, number][]) { strip(n, plane, -AW + 0.5, 0, EAVE_ARM - 0.65); strip(n, plane, AW - 0.5, 0, EAVE_ARM - 0.65); }
  for (const [n, plane, us] of [
    [[-1, 0], -XS, [ZN + 0.5, ZS - 0.5]], [[1, 0], XS, [ZN + 0.5, ZS - 0.5]], [[0, -1], ZN, [-XS + 0.5, XS - 0.5]], [[0, 1], ZS, [-XS + 0.5, XS - 0.5]],
  ] as [V2, number, number[]][]) {
    for (const u of us) { strip(n, plane, u, 0, EAVE_LOW - 0.6); const fr = face(n, plane); flare(k, fr.f, fr.at(u), 0.9, 3.2, 0.9, 'brick'); }
  }
  for (const [n, plane] of [[[0, -1], ZN], [[0, 1], ZS]] as [V2, number][]) for (const u of [-AW + 0.5, AW - 0.5]) { const fr = face(n, plane); flare(k, fr.f, fr.at(u), 0.9, 3.2, 1.2, 'brick'); }

  // ---- Arm-end dormers (one per hipped end, just above the cornice) -----------------------------------------------
  {
    const slope = (RIDGE - EAVE_ARM) / AW;
    for (const [n, plane, u] of [[[-1, 0], -XS, ZC], [[1, 0], XS, ZC], [[0, -1], ZN, 0], [[0, 1], ZS, 0]] as [V2, number, number][]) dormer(k, n, plane, u, EAVE_ARM, slope, EAVE_ARM + 0.5);
  }

  // ---- Crossing tower ---------------------------------------------------------------------------------------------
  const tx = 0, tz = ZC;
  block(k, tx - 3.1, tx + 3.1, tz - 3.1, tz + 3.1, 27.5, 33.0, 'bronze');
  block(k, tx - 3.25, tx + 3.25, tz - 3.25, tz + 3.25, 32.8, 33.2, 'bronze');
  octagon(k, tx, tz, 6.0, 33.2, 39.6, 'bronze');
  octagon(k, tx, tz, 6.6, 39.6, 40.2, 'bronze');
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, n: V2 = [Math.cos(a), Math.sin(a)], r = 3.0;
    const f = frame([tx + n[0] * r, tz + n[1] * r], n);
    archSlab(k, f, 0, 35.2, 1.55, 3.9, 0.1, 'dark', -0.04);
    if (i % 2 === 1) clockFace(k, f, 0, 34.1, 0.85);
  }
  lathe(k, tx, tz, [[3.3, 40.2], [3.25, 40.6], [3.0, 41.3], [2.5, 42.0], [1.7, 42.6], [1.0, 42.85], [0, 42.9]], 'bronze');
  octagon(k, tx, tz, 1.7, 42.8, 44.4, 'bronze');
  for (let i = 0; i < 8; i += 2) { const a = i * Math.PI / 4, n: V2 = [Math.cos(a), Math.sin(a)]; archSlab(k, frame([tx + n[0] * 0.85, tz + n[1] * 0.85], n), 0, 43.2, 0.45, 0.95, 0.08, 'dark', -0.02); }
  octagon(k, tx, tz, 2.0, 44.4, 44.6, 'bronze');
  lathe(k, tx, tz, [[1.0, 44.6], [0.85, 45.0], [0.5, 45.35], [0.12, 45.55], [0, 45.6]], 'bronze');
  block(k, tx - 0.06, tx + 0.06, tz - 0.06, tz + 0.06, 45.5, 47.6, 'dark');
  lathe(k, tx, tz, [[0.001, 45.75], [0.18, 45.82], [0.25, 46.0], [0.18, 46.18], [0.001, 46.25]], 'gold', 10);
  block(k, tx - 0.5, tx + 0.5, tz - 0.04, tz + 0.04, 46.9, 47.0, 'gold');
  block(k, tx - 0.04, tx + 0.04, tz - 0.5, tz + 0.5, 46.9, 47.0, 'gold');
}
