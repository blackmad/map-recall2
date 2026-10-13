import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell} from './worship-shell';
import {letters, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import source from './booking-hq-footprints.json';
import {band, chordS, frameAt, offsetPt, posts, roundedPath, sheet, straightPath, type Offset, type Path} from './booking-hq-curve';

/**
 * Booking.com headquarters, Oosterdokskade 163 (UNStudio, completed 2023). BAG pand 0363100012250152 holds the whole complex: the
 * 51,543 m2 kantoorfunctie verblijfsobject at Oosterdokskade 163 (12 storeys) plus ~60 dwellings in the same building (Ton de Leeuwstraat),
 * 8,443 m2 footprint, roof 37 to 51 m. Massing is the 3DBAG LoD2.2 shell (native east/south metres from the footprint vertex mean).
 * Read from the municipal panoramas of 2025-06-17 and 2025-10-01 (artifacts/landmark-lanes/booking-hq/ref-*.jpg). The BAG outline is the
 * OUTERMOST line of the stacked floor plates. Walls of 14 m or more that are rectangular and ground-standing are replaced by a plate recipe
 * (3DBAG wall dropped by `skip`; thin glass sheets with posts and transoms standing proud of them, bronze plates and end piers); shorter or
 * irregular walls keep the shell wall and get banding cut to where the wall really reaches (`bandWall`, 4 m minimum, plant boxes plain).
 *  - SOUTH OFFICE FRONT (3DBAG walls 72 + 14, `southFront`, helpers in booking-hq-curve.ts): the ring is a straight chord turning north at a
 *    sharp corner, the photos show a bowed, stepped front, so the corner is rounded inside the ring and every floor plate and glass band is
 *    its own inward offset curve d_k(s) of that path: straight 1.6 m slab (9.4-11 m) cantilevered over a glazed lobby (two tiers round a
 *    lintel); sign band glass 3 m (west) to 8 m (east) behind the slab edge on a terrace; thin plate B (19.5 m, steps in, bows 5.5 m); glass
 *    with a terrace cut (14.5 m wide, 3.5 m deep, 24.4-30.3 m); plate C (30.6 m, bows 7 m); top glass and parapet. Roof edge trimmed to it.
 *  - LOBBY RECESS (measured, not chosen): pinhole sketch on ref-south (door threshold, lobby-head transom and slab underside rows, camera
 *    2.5 m) puts the glass about 1.5-2 m behind the slab edge at the centre; the soffit width in ref-south-east / ref-east gives about
 *    5-6 m round the east corner. The model uses 1.7 m at the west growing to 5.7 m at the corner. That exceeds the old 2.5 m cantilever
 *    rule of the audit, a false positive: see the lobby-under-cantilever rule in glbQuality.ts (UNDERCROFT_MAX_RECESS_M).
 *  - residential tower (west block, 48-51 m): glazed podium 0-11.5 m set back, plate 11.5-13.2 m, eleven storeys on a 3.2 m pitch of
 *    glass ribbon between dark floor edges, dark piers every 3.3 m, alternating balcony rails on the east and south faces;
 *  - the white "Booking.com" wordmark (lower case, kit glyphs, one frame per letter along the curve) on the sign-band glass, about 11.5 m
 *    along the front, 14.9-16.8 m high.
 * Colours sampled from sunlit crops of ref-south / ref-south-east: glass #78a5c1, bronze plates #2b2927, frames #3b3633, timber soffits #9c6b3b.
 * INFERRED: every wall not photographed (north, east beyond the restaurant corner, courtyards) uses the same plate recipe; the slanted fins of
 * the terrace cuts, the irregular window sizes of the tower and the curved east face are not modelled. 3DBAG wall 52 is a single
 * triangle with its companion missing, repaired below.
 */
const surfaces = (source as {surfaces: {type: string; rings: number[][][]}[]}).surfaces;

function outward(i: number): RawWall {
  const w = rawWall(source as never, i), t = w.len / 2;
  const mx = w.f.origin[0] + w.f.tangent[0] * t, mz = w.f.origin[1] + w.f.tangent[1] * t;
  const a = roofHeightAt(surfaces as never, mx + w.f.n[0] * 0.7, mz + w.f.n[1] * 0.7) ?? -1;
  const c = roofHeightAt(surfaces as never, mx - w.f.n[0] * 0.7, mz - w.f.n[1] * 0.7) ?? -1;
  if (a <= c + 0.15) return w;
  const f: Frame = {origin: [w.f.origin[0] + w.f.tangent[0] * w.len, w.f.origin[1] + w.f.tangent[1] * w.len], tangent: [-w.f.tangent[0], -w.f.tangent[1]], n: [-w.f.n[0], -w.f.n[1]]};
  return {...w, f, poly: w.poly.map(p => [w.len - p[0], p[1]] as [number, number]), bearing: (w.bearing + 180) % 360};
}

/** Rectangular, ground-standing tall wall that the plate recipe replaces. */
function replaceable(w: RawWall): 'tower' | 'office' | null {
  if (w.len < 14 || w.base > 0.5 || w.top < 36) return null;
  for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) { const t = topOf(w, w.len * u); if (!Number.isFinite(t) || Math.abs(t - w.top) > 0.35) return null; }
  return w.top >= 46.5 ? 'tower' : 'office';
}
const inArc = (b: number, lo: number, hi: number) => lo <= hi ? b >= lo && b <= hi : b >= lo || b <= hi;

type Bld = BuildingTools & {mark?: (n: string) => void};

/** Plate on the BAG line: a closed box from the wall plane back `deep` metres. */
/** Per-wall height nudge (1.5 cm steps): plates of neighbouring walls overlap at corners and must not share a plane. */
let JY = 0, ON = 0, RJ = 0;
const plate = (b: Bld, f: Frame, L: number, y: number, th: number, deep: number, colour: string, t0 = 0, t1 = L, proud = 0) =>
  slab(b, f, (t0 + t1) / 2, y + JY, t1 - t0, th, deep + proud, colour, -deep + ON);
/** Glass set `r` metres behind the BAG line: a thin sheet with posts and transoms standing proud of it (same primitives as the curved front). */
const glass = (b: Bld, f: Frame, t0: number, t1: number, y0: number, y1: number, r: number) => sheet(b, straightPath(f, t1 + 0.01), t0, t1, () => r + RJ, y0, y1, 'glass', 0.12, [t0, t1]);
function mullions(b: Bld, f: Frame, t0: number, t1: number, y0: number, y1: number, r: number, pitch: number, transom: number) {
  const path = straightPath(f, t1 + 0.01);
  posts(b, path, [t0, t1], () => r + RJ, y0, y1, 0.13, 0.08, 'frame', Math.max(1, Math.round((t1 - t0) / pitch)));
  for (let y = y0 + transom; y < y1 - 0.5; y += transom) sheet(b, path, t0, t1, () => r + RJ - 0.05, y, y + 0.08, 'frame', 0.05, [t0, t1]);
}

function officeWall(b: Bld, w: RawWall) {
  JY = (w.index % 4) * 0.015; ON = (w.index % 3) * 0.012; RJ = (w.index % 5) * 0.017;
  const f = w.f, L = w.len, top = w.top, R = 2.0, r = 0.8, EM = 0.3;
  slab(b, f, L / 2, 0, L, 0.5, 0.4, 'concrete', -0.4); // sill on the ground edge
  plate(b, f, L, top - 0.7, 0.95, 0.6, 'dark', 0.04, L - 0.04); // parapet edge
  plate(b, f, L, 0, top + 0.3, 0.6, 'frame', -0.02, 0.32, 0.04); plate(b, f, L, 0, top + 0.3, 0.6, 'frame', L - 0.32, L + 0.02, 0.04); // end piers
  // ground floor: glazed lobby under the cantilever plate
  glass(b, f, EM, L - EM, 0.5, 9.5, R); mullions(b, f, EM, L - EM, 0.5, 9.5, R, 2.0, 4.8);
  plate(b, f, L, 9.4, 1.6, R + 0.2, 'dark', EM, L - EM);
  slab(b, f, L / 2, 9.3, L - 2 * EM, 0.1, 0.3, 'red', -R); // copper-coloured soffit strip
  const bands: [number, number][] = [[11, 19.5], [20.4, 30.6]];
  const plates: [number, number][] = [[19.5, 0.9], [30.6, 0.9]];
  // upper storeys: a plate every 5.4 m while more than 6.5 m of wall remain (the 41-44 m wings)
  let y = 31.5;
  while (top - 0.7 - y > 6.5) { bands.push([y, y + 4.2]); plates.push([y + 4.2, 0.9]); y += 5.4; }
  bands.push([y, top - 0.7]);
  // terrace cut on a south-facing wide front: deeper, 14.5 m wide, 24.4-30.3 m
  const cut = L > 30 && inArc(w.bearing, 150, 210) ? [0.0, 14.5] : null;
  bands.forEach(([y0, y1], k) => {
    if (y1 - y0 < 1) return;
    if (k === 1 && cut) {
      glass(b, f, EM, L - EM, y0, 24.4, r); mullions(b, f, EM, L - EM, y0, 24.4, r, 1.5, 4.2);
      plate(b, f, L, 24.4, 0.6, 3.7, 'dark', cut[0] + EM, cut[1]); // terrace floor
      glass(b, f, cut[0] + EM, cut[1], 25.0, y1, 3.5); mullions(b, f, cut[0] + EM, cut[1], 25.0, y1, 3.5, 1.5, 4.2);
      glass(b, f, cut[1], L - EM, 24.4, y1, r); mullions(b, f, cut[1], L - EM, 24.4, y1, r, 1.5, 4.2);
      return;
    }
    glass(b, f, EM, L - EM, y0, y1, r); mullions(b, f, EM, L - EM, y0, y1, r, 1.5, 4.2);
  });
  for (const [py, th] of plates) { plate(b, f, L, py, th, r + 0.4, 'dark', EM, L - EM); slab(b, f, L / 2, py - 0.08, L - 2 * EM, 0.08, 0.3, 'red', -r); }
}

function towerWall(b: Bld, w: RawWall) {
  JY = (w.index % 4) * 0.015; ON = (w.index % 3) * 0.012; RJ = (w.index % 5) * 0.017;
  const f = w.f, L = w.len, top = w.top, R = 2.0, EM = 0.3;
  const east = inArc(w.bearing, 45, 135), south = inArc(w.bearing, 135, 225);
  slab(b, f, L / 2, 0, L, 0.5, 0.4, 'concrete', -0.4);
  plate(b, f, L, top - 0.7, 0.95, 0.6, 'dark', 0.04, L - 0.04);
  plate(b, f, L, 0, top + 0.3, 0.6, 'frame', -0.02, 0.32, 0.04); plate(b, f, L, 0, top + 0.3, 0.6, 'frame', L - 0.32, L + 0.02, 0.04);
  glass(b, f, EM, L - EM, 0.5, 11.6, R); mullions(b, f, EM, L - EM, 0.5, 11.6, R, 2.0, 4.2);
  plate(b, f, L, 11.5, 1.7, R + 0.2, 'dark', EM, L - EM);
  const P = 3.2, n = Math.floor((top - 0.7 - 13.2) / P);
  for (let k = 0; k < n; k++) {
    const y = 13.2 + k * P;
    plate(b, f, L, y, 0.45, 0.4, 'dark', EM, L - EM); // floor edge
    glass(b, f, EM, L - EM, y + 0.45, y + P, 0.4);
    if ((east || south) && k % 2 === 1) for (let t = 2.0; t < L - 2.0; t += 6.6) slab(b, f, t, y + 0.45, 2.6, 1.0, 0.5, 'frame', 0);
  }
  const np = Math.max(1, Math.round((L - 2 * EM) / 3.3));
  for (let c = 1; c < np; c++) plate(b, f, L, 13.2, top - 0.7 - 13.2, 0.4, 'frame', EM + c * (L - 2 * EM) / np - 0.14, EM + c * (L - 2 * EM) / np + 0.14, 0.04);
}

/** Lowest wall y at tangent position t (NaN outside the wall). */
function botOf(w: RawWall, t: number): number {
  let best = Infinity;
  const p = w.poly;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], q = p[(i + 1) % p.length];
    if ((a[0] - t) * (q[0] - t) > 0) continue;
    if (Math.abs(a[0] - q[0]) < 1e-6) { best = Math.min(best, a[1], q[1]); continue; }
    best = Math.min(best, a[1] + (q[1] - a[1]) * (t - a[0]) / (q[0] - a[0]));
  }
  return Number.isFinite(best) ? best : NaN;
}

/** Where the wall reaches at least height `y` (and starts at or below `y0`): contiguous t-intervals, inset `inset` m, at least `min` m long. */
function spans(w: RawWall, y: number, inset = 0.06, min = 0.5, yLow = y): [number, number][] {
  const out: [number, number][] = [];
  let a = -1;
  const n = Math.ceil(w.len / 0.2);
  for (let i = 0; i <= n; i++) {
    const t = Math.min(w.len, i * 0.2), ok = Number.isFinite(topOf(w, t)) && topOf(w, t) >= y && (w.base < 2 || botOf(w, t) <= yLow + 0.02);
    if (ok && a < 0) a = t;
    if ((!ok || i === n) && a >= 0) { const e = ok ? t : Math.max(a, t - 0.2); if (e - a - 2 * inset >= min) out.push([a + inset, e - inset]); a = -1; }
  }
  return out;
}

/** Fallback for walls that are not rectangular/ground-standing: banding on the existing shell wall, cut to where the wall really reaches. */
function bandWall(b: Bld, w: RawWall) {
  const f = w.f, L = w.len;
  if (L < 4 && !(L >= 2.5 && w.base < 2 && w.top < 12)) return; // slivers and jogs stay plain shell; the 3 m door bays of the low entrance link are glazed
  setSink(0.06); // thin bands on a real shell wall: sunk deeper they would touch the neighbouring wall's bands at concave corners and merge into one assembly
  const mid = topOf(w, L / 2), top = Number.isFinite(mid) ? Math.min(mid, w.top) : w.top;
  const y0 = Math.max(w.base, 0), h = top - y0;
  if (h < 2.5 || (y0 > 2 && h < 4.5)) return; // rooftop plant boxes (under 4.5 m high) stay plain
  const tower = w.top >= 46.5 && w.base < 2 && L >= 2, P = tower ? 3.2 : 4.2, yb = y0 < 2 ? 4.2 : y0 + 0.6, n0 = Math.max(1, Math.floor((top - yb) / P));
  // thicknesses vary a little per wall so that the faces of neighbouring, slightly stepped walls never share a plane
  const gD = 0.06 + ((w.index * 7) % 11) * 0.009, mD = gD + 0.07;
  // each kind of part sinks to its own depth: the hidden back faces of bands, glass and posts must not share a plane either
  const SK: Record<string, number> = {glass: 0.06, dark: 0.075, frame: 0.09, red: 0.105};
  const seg = (y1: number, hh: number, d: number, colour: string, shrink = 0) => { setSink(SK[colour] ?? 0.06); for (const [a, e] of spans(w, y1 + hh, 0.25, 0.5, y1)) slab(b, f, (a + e) / 2, y1, e - a - shrink, hh, d, colour); };
  if (y0 < 2) seg(y0, Math.min(4.2, h), gD, 'glass', 0.04);
  for (let k = 0; k < n0; k++) {
    const y = yb + k * P;
    if (y + 1 > top) break;
    seg(y, 0.5, 0.2, 'dark');
    seg(y + 0.5, Math.min(P - 0.5, top - y - 0.5), gD, 'glass', 0.04);
  }
  const n = Math.max(1, Math.round(L / (tower ? 3 : 1.5)));
  const live = spans(w, y0 + h - 0.3, 0, 0.2, y0);
  for (let c = 0; c <= n; c++) { const t = Math.min(L - 0.04, Math.max(0.04, c * L / n)); if (live.some(([a, e]) => t >= a && t <= e)) { const col = c === 0 || c === n ? 'red' : 'frame'; setSink(SK[col]); slab(b, f, t, y0, 0.08, h - 0.3, mD, col); } }
  setSink(0.3);
}

/** Smooth 0..1 ramp. */
const ramp = (x: number, a: number, c: number) => { const t = Math.min(1, Math.max(0, (x - a) / (c - a))); return t * t * (3 - 2 * t); };

/**
 * South office front as stacked plan-curved plates (walls 72 + 14 together, corner rounded inside the ring). Plate and glass outlines are
 * offset curves d_k(s) = o_k + a_k * bow_k(s): each floor plate has its own bow and offset, so the plates overhang and step against each
 * other like the photos (ref-south: lobby set back under one straight cantilever slab, the next plates stepping in/out above it).
 */
function southFront(b: Bld, w72: RawWall, w14: RawWall, onlyRoofEdge = false): {edge: [number, number][]; A: [number, number]; B: [number, number]; far: [number, number]} {
  const L = w72.len, A: [number, number] = w72.f.origin;
  const B: [number, number] = [A[0] + w72.f.tangent[0] * L, A[1] + w72.f.tangent[1] * L];
  const t14: [number, number] = [w14.f.origin[0], w14.f.origin[1]], e14: [number, number] = [t14[0] + w14.f.tangent[0] * w14.len, t14[1] + w14.f.tangent[1] * w14.len];
  const [near, far] = Math.hypot(t14[0] - B[0], t14[1] - B[1]) < Math.hypot(e14[0] - B[0], e14[1] - B[1]) ? [t14, e14] : [e14, t14];
  if (Math.hypot(near[0] - B[0], near[1] - B[1]) > 1) throw new Error('walls 72 and 14 do not meet');
  const path: Path = roundedPath(A, B, far, 13);
  const S = path.length;
  // bow: 0 at the (straight) west end growing quadratically toward the east, then relaxing to the ring over the last 22 m so the corner keeps a gentle inner radius (wall 12 step)
  const bow = (c: number): Offset => s => ((Math.max(0, s - c) / (S - c)) ** 2) * (1 - ramp(s, S - 22, S));
  const ofs = (o: number, a: number, c = 0): Offset => { const f = bow(c); return s => o + a * f(s); };
  const top = w72.top, EM = 0.3;
  const Y = {slabA0: 9.4, slabA1: 11, b1: 11, plB: 19.5, b2: 20.4, plC: 30.6};
  // measured recess: lobby glass 1.7 m behind the slab edge at the west (ref-south centre) growing to about 6 m around the east corner
  const dLobby = ofs(1.7, 4.0, 6);
  const dBal: Offset = () => 0.25;                       // balustrade on the slab edge
  const dB1 = ofs(3.0, 5.0);                              // sign band glass, behind the terrace on slab A
  const dPlB = ofs(1.6, 5.5, 6);                          // plate B
  const dB2: Offset = s => dPlB(s) + 2.2;
  const dPlC = ofs(0.4, 7.0, 0);                          // plate C
  const dB3: Offset = s => dPlC(s) + 2.0;
  const dTop: Offset = s => dPlC(s) + 0.3;
  const zero: Offset = () => 0;
  const backOf = (front: Offset, ref: Offset, over = 0.2): Offset => s => Math.max(front(s) + 0.5, ref(s) + over);
  const cap = (sa: number, sb: number, d0: number, d1: number, y0: number, y1: number, colour = 'glass') => band(b, path, sa, sb, () => d0, () => d1, y0, y1, colour, 0.3);
  const glazed = (d: Offset, s0: number, s1: number, y0: number, y1: number, pitch: number, transom: number) => {
    // equal chords of >= 1 m along the offset curve (a shorter facet is not a wall to the opening audit), posts flat on the middle of each
    const ss = chordS(path, s0, s1, d, pitch);
    sheet(b, path, s0, s1, d, y0, y1, 'glass', 0.12, ss);
    posts(b, path, ss, d, y0, y1, 0.12, 0.08, 'frame');
    for (let y = y0 + transom; y < y1 - 0.5; y += transom) sheet(b, path, s0, s1, s => d(s) - 0.05, y, y + 0.07, 'frame', 0.05, ss);
    if (s0 <= 0.03) cap(0.02, 0.3, 0.45, d(0), y0, y1);
    if (s1 >= S - 0.03) cap(S - 0.3, S - 0.02, 0.45, d(S), y0, y1);
  };
  cap(-0.02, 0.36, -0.04, 0.45, 0, top + 0.3, 'frame'); cap(S - 0.36, S + 0.02, -0.04, 0.45, 0, top + 0.3, 'frame'); // end piers where the front meets the neighbouring walls
  const roofEdge: [number, number][] = [];
  for (let i = 0; i <= 60; i++) { const sx = S * i / 60; roofEdge.push(offsetPt(path, sx, backOf(dTop, dB3)(sx) - 0.02)); }
  const ret = {edge: roofEdge, A, B, far};
  if (onlyRoofEdge) return ret;
  const s0 = 0.02, s1 = S - 0.02;
  // plinth under the lobby glass
  band(b, path, s0, s1, s => dLobby(s) - 0.35, s => dLobby(s) + 0.2, 0, 0.5, 'concrete', 1.0);
  // lobby: two glass tiers around a bronze lintel (the inner entrance bay), under slab A
  glazed(dLobby, s0, s1, 0.5, 5.6, 2.0, 4.8);
  band(b, path, s0, s1, s => dLobby(s) - 0.05, s => dLobby(s) + 0.2, 5.6, 6.2, 'frame', 1.0);
  glazed(dLobby, s0, s1, 6.2, Y.slabA0, 2.0, 3.4);
  // slab A: straight cantilever on the ring line, rounded around the corner, orange timber soffit
  band(b, path, s0, s1, zero, s => Math.max(dLobby(s) + 0.3, dB1(s) + 0.6), Y.slabA0, Y.slabA1, 'dark', 1.5);
  band(b, path, s0 + 0.2, s1 - 0.2, s => zero(s) + 0.3, s => dLobby(s) + 0.1, Y.slabA0 - 0.08, Y.slabA0, 'red', 1.5);
  // terrace on slab A: glass balustrade, sign band behind it
  band(b, path, s0, s1, () => 0.1, () => 0.3, Y.slabA1, Y.slabA1 + 1.1, 'glass', 1.0);
  band(b, path, s0, s1, () => 0.05, () => 0.35, Y.slabA1 + 1.05, Y.slabA1 + 1.15, 'frame', 1.0);
    glazed(dB1, s0, s1, Y.b1, Y.plB, 1.5, 4.2);
  // plate B (thin, steps in over the sign band) and its soffit
  band(b, path, s0, s1, dPlB, backOf(dPlB, dB1), Y.plB, Y.plB + 0.7, 'dark', 1.5);
  band(b, path, s0 + 0.2, s1 - 0.2, s => dPlB(s) + 0.2, s => dB1(s) + 0.1, Y.plB - 0.07, Y.plB, 'red', 1.5);
  // band 2: glass with a terrace cut at the west (14.5 m wide, 3.5 m deep, 24.4-30.3 m)
  const cutS = 14.5;
  const dB2c: Offset = s => dB2(s) + 3.5;
  glazed(dB2, s0, s1, Y.b2, 24.4, 1.5, 4.2);
  band(b, path, s0, cutS, dB2, dB2c, 24.4, 25.0, 'dark', 1.0);
  glazed(dB2c, s0, cutS, 25.0, Y.plC, 1.5, 4.2);
  cap(cutS - 0.3, cutS, dB2(cutS), dB2c(cutS), 25.0, Y.plC); // side wall of the terrace cut
  glazed(dB2, cutS, s1, 24.4, Y.plC, 1.5, 4.2);
  // plate C
  band(b, path, s0, s1, dPlC, backOf(dPlC, dB2), Y.plC, Y.plC + 0.7, 'dark', 1.5);
  band(b, path, s0 + 0.2, s1 - 0.2, s => dPlC(s) + 0.2, s => dB2(s) + 0.1, Y.plC - 0.07, Y.plC, 'red', 1.5);
  // top glass to the parapet and parapet edge
  glazed(dB3, s0, s1, Y.plC + 0.7, top - 0.6, 1.5, 4.2);
  band(b, path, s0, s1, dTop, backOf(dTop, dB3), top - 0.6, top + 0.25, 'dark', 1.5);
  for (const [sa, sb] of [[0.02, 0.3], [S - 0.3, S - 0.02]]) cap(sa, sb, 0, backOf(dTop, dB3)(sa === 0 ? 0 : S), top - 0.6, top + 0.25, 'dark');
  // wordmark on the sign-band glass (centre 11.5 m along the south front, 14.9 m up)
  { const px = 0.26, word = 'Booking.com', total = (word.length * 6 - 1) * px;
    setSink(0);
    [...word].forEach((ch, i) => { const sc = 11.5 - total / 2 + (i * 6 + 2.5) * px; letters(b, frameAt(path, sc, dB1(sc)), ch, 0, 14.9, 0, px, 0.12, 'white'); });
    setSink(0.3); }
  return ret;
}

/**
 * The 3DBAG 37 m roof runs to the straight ring chord, past the bowed top plate: replace the ring vertices of the south chain (wall 72's west
 * end to wall 14's north end) by the roof edge that follows the parapet, so no roof flange hangs over the curved glass.
 */
function trimRoof({edge, A: w72start, B: w72end, far: w14end}: {edge: [number, number][]; A: [number, number]; B: [number, number]; far: [number, number]}) {
  const near = (r: number[][], x: number, z: number) => { let bi = 0, bd = 1e9; r.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[2] - z); if (d < bd) { bd = d; bi = i; } }); return bd < 0.5 ? bi : -1; };
  const surfs = surfaces.map(sf => {
    if (sf.type !== 'RoofSurface') return sf;
    const r = sf.rings[0].length > 1 && sf.rings[0][0].every((v, i) => v === sf.rings[0][sf.rings[0].length - 1][i]) ? sf.rings[0].slice(0, -1) : sf.rings[0];
    const ia = near(r, w72start[0], w72start[1]), ie = near(r, w14end[0], w14end[1]);
    if (ia < 0 || ie < 0 || r.length < 4) return sf;
    const y = r[ia][1], n = r.length, pts = [r[ia], ...edge.map(p => [p[0], y, p[1]]), r[ie]];
    // walk from ia to ie either forward or backward, whichever passes the ring corner (wall 72/14 junction)
    const walk = (dir: number) => { const out: number[] = [ia]; for (let i = (ia + dir + n) % n; i !== ie; i = (i + dir + n) % n) out.push(i); out.push(ie); return out; };
    const fw = walk(1), bw = walk(-1);
    const hasCorner = (w: number[]) => w.some(i => Math.hypot(r[i][0] - w72end[0], r[i][2] - w72end[1]) < 0.5);
    const chain = hasCorner(fw) ? fw : bw, forward = chain === fw;
    const rest: number[][] = [];
    if (forward) { for (let i = (ie + 1) % n; i !== ia; i = (i + 1) % n) rest.push(r[i]); return {...sf, rings: [[...pts, ...rest]]}; }
    for (let i = (ia + 1) % n; i !== ie; i = (i + 1) % n) rest.push(r[i]);
    return {...sf, rings: [[...pts.slice().reverse(), ...rest]]};
  });
  return {...(source as object), surfaces: surfs} as never;
}

export function buildBookingHq(_w: number, _d: number, b: Bld) {
  const walls = new Map<number, RawWall>();
  surfaces.forEach((s, i) => { if (s.type === 'WallSurface') walls.set(i, outward(i)); });
  const replaced = new Map<number, 'tower' | 'office'>();
  for (const [i, w] of walls) { const k = replaceable(w); if (k) replaced.set(i, k); }
  replaced.set(72, 'office'); replaced.set(14, 'office'); // the curved south front (walls 72 + 14) replaces both ring walls
  const w72 = walls.get(72), w14 = walls.get(14);
  addShell(b, w72 && w14 ? trimRoof(southFront(b, w72, w14, true)) : source as never, {wall: 'dark', roof: 'concrete', skip: (_s, i) => replaced.has(i)});
  b.mark?.('shell');
  // Shell repair: 3DBAG wall 52 is a single triangle (A, B, C of the quad A-B-D-C); its companion triangle B-D-C is missing from the
  // LoD2.2 data and leaves an open slit in the shell. Add it, wound like the surviving triangle, so the wall is whole again.
  { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([-24.16, 0, -25.81, -23.27, 0, -15.84, -23.27, 47.94, -15.84], 3)); g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1], 2)); g.computeVertexNormals(); b.add(g, 'dark' as never); }
  if (process.env.BIG_SHELL_ONLY) return;
  setSink(0.3);
  for (const [i, w] of walls) {
    const k = replaced.get(i);
    if (i === 72 || i === 14) continue;
    if (k === 'office') officeWall(b, w); else if (k === 'tower') towerWall(b, w); else bandWall(b, w);
  }
  if (w72 && w14) southFront(b, w72, w14);
  setSink(0);
}
