import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {GL} from './nearbar-kit';
import {Acc, roof, soffit, type C} from './tier-kit';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {shedRoof} from '../../src/canalRecall/landmarks/shedRoof';
import {bathtubShell, roundedRect, type TubTri} from '../../src/canalRecall/landmarks/bathtubShell';

/**
 * Stedelijk Museum, Museumplein 10 / Paulus Potterstraat 13 (Rijksmonument 505840): A.W. Weissman's museum of 1892-1895
 * (BAG pand 0363100012077791) joined to Benthem Crouwel's 2012 wing, the white "bathtub" under its flat roof over a glazed
 * ground storey (BAG 0363100012251804), and the wing's dark service tower with the circular STEDELIJK MUSEUM AMSTERDAM
 * lettering on the Van Baerlestraat side (BAG 0363100012251805, bouwjaar 2012). One model.
 *
 * Native east/south metres from the vertex average of the 1895 pand's BAG ring (stedelijk-museum-footprints.json, PDOK BAG
 * WFS, written by museumplein-north-prepare.ts), y above its 3DBAG ground 0.41 m NAP. Drawn in the old building's frame:
 * u along bearing 66.7 (the Paulus Potterstraat front, its BAG edges), v towards bearing 336.7 (the street); the 1895 plan is
 * symmetric about u = 0.
 *
 * Evidence (scripts/landmarks/stedelijk-museum-inventory.json, -elevations.json):
 *  - BAG rings (CC0): the 1895 block u +-47.9 with four corner pavilions 11.1 x 11.0 m, the wings' fronts at v 14.6, the
 *    central front at v 20.95 and its frontispiece 13.8 m wide at v 21.7, two light wells; the 2012 pand reaching v -45.5;
 *    the service tower 17.4 x 7.3 m at v -65.3..-72.7.
 *  - 3DBAG LoD2.2 roofs (CC BY 4.0): wings 14.2-17.6 (north-light sheds), pavilion pyramids 15.9 -> 25.1, the central
 *    mansard flat at 22.4, the frontispiece tower 27.6-29.2 with its lantern to 33.7, the rear hall ridge 21.5, the 2012
 *    roof 17.65, the service tower 17.6.
 *  - OSM building parts w754299889-898 (ODbL): the tub's rim (w754299890, u -46.8..46.3, v -29.3..-48.5) and the roof
 *    slab's outline (w754299892, u -50.3..50.1, v -19.1..-60.1).
 *  - Gemeente Amsterdam panoramas (CC BY 4.0), rectified at 50 px/m (landmark-brief.ts) and aimed
 *    (museumplein-north-crops.ts): wing fronts TMX7316010203-001156_pano_0000_001072 (4 bays at 6.0 m: plinth to 1.7 m,
 *    ground windows 1.8-5.5 m, string course 6.8 m, relief panels, upper windows 8.8-11.7 m under round tympana, statues in
 *    niches, cornice 14.5 m, white bands 0.18 m every 0.9 m), frontispiece recording_2025-07-30_09-59-09_01520, pavilions
 *    recording_2025-07-30_09-59-09_01109, the tub's ends recording_2025-07-30_11-08-35_00330 and
 *    TMX7316010203-001154_pano_0001_000200, its Museumplein face TMX7316010203-001154_pano_0001_000249 and
 *    TMX7316010203-001154_pano_0001_000185, the tower recording_2025-07-30_11-08-35_00341.
 */

const B = 66.7 * Math.PI / 180;
const UX: [number, number] = [Math.sin(B), -Math.cos(B)];      // u in native (x, z)
const VX: [number, number] = [-Math.cos(B), -Math.sin(B)];     // v in native (x, z)
type UV = [number, number];
type V3 = [number, number, number];
const N = ([u, v]: UV): PlanPoint => [u * UX[0] + v * VX[0], u * UX[1] + v * VX[1]];
const P3 = (u: number, y: number, v: number): V3 => { const [x, z] = N([u, v]); return [x, y, z]; };
const DIR = {N: [0, 1] as UV, S: [0, -1] as UV, E: [1, 0] as UV, W: [-1, 0] as UV};
type Side = keyof typeof DIR;

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A triangle wound so its normal points along `out`. */
function tri(acc: Acc, c: C, a: V3, b: V3, d: V3, out: V3) {
  const n = crs(sub(b, a), sub(d, a));
  if (Math.hypot(...n) < 1e-9) return;
  if (dot(n, out) >= 0) acc.tri(c, a, b, d); else acc.tri(c, a, d, b);
}
function quad(acc: Acc, c: C, a: V3, b: V3, d: V3, e: V3, out: V3) { tri(acc, c, a, b, d, out); tri(acc, c, a, d, e, out); }
function poly(acc: Acc, c: C, pts: V3[], out: V3) { for (let i = 1; i + 1 < pts.length; i++) tri(acc, c, pts[0], pts[i], pts[i + 1], out); }

/** A face seen from outside: t from the viewer's left end to the right end, y up, o outwards. */
type Face = {L: number; P: (t: number, y: number, o: number) => V3; n: V3};
function face(left: UV, right: UV, out: Side): Face {
  const a = N(left), b = N(right), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, n = N(DIR[out]);
  if (-tz * n[0] + tx * n[1] <= 0) throw new Error(`face: ${left} -> ${right} does not run to the viewer's right facing ${out}`);
  return {L, n: [n[0], 0, n[1]], P: (t, y, o) => [a[0] + tx * t + n[0] * o, y, a[1] + tz * t + n[1] * o]};
}
/** The part t0..t1 of a face, moved `o` outwards (a risalit's front). */
function part(f: Face, t0: number, t1: number, o: number): Face {
  return {L: t1 - t0, n: f.n, P: (t, y, oo) => f.P(t + t0, y, oo + o)};
}
const UP: V3 = [0, 1, 0], DOWN: V3 = [0, -1, 0];
function rect(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o = 0) {
  quad(acc, c, f.P(t0, y0, o), f.P(t1, y0, o), f.P(t1, y1, o), f.P(t0, y1, o), f.n);
}
/** A slab standing out of a face from o0 to o1: front, top, bottom, ends. */
function slab(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number, ends = true) {
  rect(acc, c, f, t0, t1, y0, y1, o1);
  quad(acc, c, f.P(t0, y1, o1), f.P(t1, y1, o1), f.P(t1, y1, o0), f.P(t0, y1, o0), UP);
  quad(acc, c, f.P(t0, y0, o0), f.P(t1, y0, o0), f.P(t1, y0, o1), f.P(t0, y0, o1), DOWN);
  if (!ends) return;
  const l = sub(f.P(0, 0, 0), f.P(1, 0, 0));
  quad(acc, c, f.P(t0, y0, o0), f.P(t0, y0, o1), f.P(t0, y1, o1), f.P(t0, y1, o0), l);
  quad(acc, c, f.P(t1, y0, o1), f.P(t1, y0, o0), f.P(t1, y1, o0), f.P(t1, y1, o1), [-l[0], -l[1], -l[2]]);
}
function emit(acc: Acc, c: C, f: Face, q: WallQuad) {
  const [a, b, d, e] = q.pts.map(([t, y, o]) => f.P(t, y, o));
  const nn = q.normal, tdir = sub(f.P(1, 0, 0), f.P(0, 0, 0));
  const out: V3 = [tdir[0] * nn[0] + f.n[0] * nn[2], nn[1], tdir[2] * nn[0] + f.n[2] * nn[2]];
  quad(acc, c, a, b, d, e, out);
}
/** A fan (half disc or disc) on a face: centre (t, y), radius r, from angle a0 to a1 (0 = viewer's right, pi/2 = up). */
function fan(acc: Acc, c: C, f: Face, t: number, y: number, r: number, a0: number, a1: number, o: number, n = 8) {
  const ctr = f.P(t, y, o);
  for (let i = 0; i < n; i++) {
    const p = a0 + (a1 - a0) * i / n, q = a0 + (a1 - a0) * (i + 1) / n;
    tri(acc, c, ctr, f.P(t + r * Math.cos(p), y + r * Math.sin(p), o), f.P(t + r * Math.cos(q), y + r * Math.sin(q), o), f.n);
  }
}
/** A box in the building frame. */
function ubox(b: BuildingTools, c: C, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number) {
  const g = new T.BoxGeometry(u1 - u0, y1 - y0, v1 - v0);
  // the frame is a reflection of (x, z): mirror the box's z and turn it so u maps to UX, v to VX
  g.applyMatrix4(new T.Matrix4().set(UX[0], 0, VX[0], 0, 0, 1, 0, 0, UX[1], 0, VX[1], 0, 0, 0, 0, 1));
  const m = N([(u0 + u1) / 2, (v0 + v1) / 2]);
  g.translate(m[0], (y0 + y1) / 2, m[1]);
  // a reflection flips the winding: swap two indices per triangle
  const ix = g.index!;
  for (let i = 0; i < ix.count; i += 3) { const j = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, j); }
  g.computeVertexNormals();
  b.add(g, c);
}
/** A pyramid (or hipped roof when the ridge is longer than 0) over a building-frame rectangle. */
function hipRoof(acc: Acc, c: C, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, ridgeAlongU = true, ridgeInset?: number, underside = false) {
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const half = ridgeAlongU ? Math.max(0, (u1 - u0) / 2 - (ridgeInset ?? (v1 - v0) / 2)) : Math.max(0, (v1 - v0) / 2 - (ridgeInset ?? (u1 - u0) / 2));
  const r0 = ridgeAlongU ? P3(cu - half, y1, cv) : P3(cu, y1, cv - half), r1 = ridgeAlongU ? P3(cu + half, y1, cv) : P3(cu, y1, cv + half);
  const a = P3(u0, y0, v0), b = P3(u1, y0, v0), d = P3(u1, y0, v1), e = P3(u0, y0, v1);
  if (underside) quad(acc, c, a, b, d, e, DOWN);   // a cap wider than what it sits on: close its eaves so it rests on it
  const out = (pts: V3[]): V3 => { const m = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length, s[2] + p[2] / pts.length], [0, 0, 0] as V3); const ctr = P3(cu, y0, cv); return [m[0] - ctr[0], 0.3, m[2] - ctr[2]]; };
  if (ridgeAlongU) {
    poly(acc, c, [a, b, r1, r0], out([a, b, r1, r0])); poly(acc, c, [d, e, r0, r1], out([d, e, r0, r1]));
    tri(acc, c, b, d, r1, out([b, d, r1])); tri(acc, c, e, a, r0, out([e, a, r0]));
  } else {
    poly(acc, c, [b, d, r1, r0], out([b, d, r1, r0])); poly(acc, c, [e, a, r0, r1], out([e, a, r0, r1]));
    tri(acc, c, a, b, r0, out([a, b, r0])); tri(acc, c, d, e, r1, out([d, e, r1]));
  }
}
/** A gable prism (glass lantern, ridge roof) along u or v over a building-frame rectangle. */
function gablePrism(acc: Acc, c: C, cEnd: C, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number, alongU = true) {
  if (alongU) {
    const vm = (v0 + v1) / 2;
    quad(acc, c, P3(u0, y0, v0), P3(u1, y0, v0), P3(u1, y1, vm), P3(u0, y1, vm), [N(DIR.S)[0], 0.5, N(DIR.S)[1]]);
    quad(acc, c, P3(u0, y0, v1), P3(u1, y0, v1), P3(u1, y1, vm), P3(u0, y1, vm), [N(DIR.N)[0], 0.5, N(DIR.N)[1]]);
    tri(acc, cEnd, P3(u0, y0, v0), P3(u0, y0, v1), P3(u0, y1, vm), [N(DIR.W)[0], 0, N(DIR.W)[1]]);
    tri(acc, cEnd, P3(u1, y0, v0), P3(u1, y0, v1), P3(u1, y1, vm), [N(DIR.E)[0], 0, N(DIR.E)[1]]);
  } else {
    const um = (u0 + u1) / 2;
    quad(acc, c, P3(u0, y0, v0), P3(u0, y0, v1), P3(um, y1, v1), P3(um, y1, v0), [N(DIR.W)[0], 0.5, N(DIR.W)[1]]);
    quad(acc, c, P3(u1, y0, v0), P3(u1, y0, v1), P3(um, y1, v1), P3(um, y1, v0), [N(DIR.E)[0], 0.5, N(DIR.E)[1]]);
    tri(acc, cEnd, P3(u0, y0, v0), P3(u1, y0, v0), P3(um, y1, v0), [N(DIR.S)[0], 0, N(DIR.S)[1]]);
    tri(acc, cEnd, P3(u0, y0, v1), P3(u1, y0, v1), P3(um, y1, v1), [N(DIR.N)[0], 0, N(DIR.N)[1]]);
  }
}
const nativeRing = (r: UV[]) => r.map(N);
const rectRing = (u0: number, u1: number, v0: number, v1: number): UV[] => [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];

// ---- pixel lettering ---------------------------------------------------------------------------------------------------
/** One 5x7 glyph centred at (t, y) on a face, rotated by `rot` (radians, counter-clockwise seen from the front). */
function glyph(acc: Acc, c: C, f: Face, ch: string, t: number, y: number, rot: number, px: number, o: number) {
  const rows = GL[ch] ?? [];
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const at = (x: number, yy: number) => f.P(t + x * cs - yy * sn, y + x * sn + yy * cs, o);
  rows.forEach((row, j) => {
    let k = 0;
    while (k < 5) {
      if (row[k] !== '1') { k++; continue; }
      let e = k; while (e < 5 && row[e] === '1') e++;
      const x0 = (k - 2.5) * px, x1 = (e - 2.5) * px, y0 = (3.5 - j - 1) * px, y1 = (3.5 - j) * px;
      quad(acc, c, at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), f.n);
      k = e;
    }
  });
}
function line(acc: Acc, c: C, f: Face, text: string, tMid: number, y: number, px: number, o: number) {
  const n = [...text].length;
  [...text].forEach((ch, i) => glyph(acc, c, f, ch, tMid + (i - (n - 1) / 2) * 6 * px, y + 3.5 * px, 0, px, o));
}
/** Text on a circle on a face: the run centred on angle `mid` (pi/2 = top), reading left to right; `outward` letters stand on the circle (top arc), otherwise hang from it (bottom arc). */
function arcText(acc: Acc, c: C, f: Face, text: string, t: number, y: number, r: number, mid: number, px: number, o: number, outward: boolean) {
  const n = [...text].length, step = (6 * px) / r;
  [...text].forEach((ch, i) => {
    const k = i - (n - 1) / 2, a = outward ? mid - k * step : mid + k * step;
    const rot = outward ? a - Math.PI / 2 : a + Math.PI / 2;
    glyph(acc, c, f, ch, t + r * Math.cos(a), y + r * Math.sin(a), rot, px, o);
  });
}

// ---- the 1895 building ---------------------------------------------------------------------------------------------
const EAVES = 14.5, PAV_EAVES = 15.6, CEN_EAVES = 15.6, PLINTH = 1.7;
type Op = {t0: number; t1: number; y0: number; y1: number; kind: 'window' | 'niche' | 'door' | 'pui' | 'blind'; head?: 'tympanum' | 'oculus'; panel?: boolean; statue?: boolean};
/** Ground and upper window pair of one bay of the wings (rectified wing front TMX7316010203-001156_pano_0000_001072). */
function bay(t: number, w = 2.5, opts: {upper?: boolean; panel?: boolean; ground?: boolean; blindUpper?: boolean} = {}): Op[] {
  const ops: Op[] = [];
  if (opts.ground !== false) ops.push({t0: t - w / 2, t1: t + w / 2, y0: 1.85, y1: 5.5, kind: 'window'});
  if (opts.upper !== false) ops.push({t0: t - w / 2, t1: t + w / 2, y0: 8.8, y1: 11.7, kind: opts.blindUpper ? 'blind' : 'window', head: 'tympanum', panel: opts.panel});
  return ops;
}
const niche = (t: number, w = 1.2): Op => ({t0: t - w / 2, t1: t + w / 2, y0: 8.6, y1: 11.4, kind: 'niche', statue: true});

/** Red brick with white stone bands, white dressings and a rusticated stone plinth (the Weissman front kit). */
function bandedFront(b: BuildingTools, acc: Acc, f: Face, eaves: number, ops: Op[], o: {cornice?: boolean; string?: boolean; plinth?: number; bandFrom?: number; bandTo?: number; base?: number} = {}) {
  const base = o.base ?? 0, plinth = Math.max(base, o.plinth ?? PLINTH), depth = (k: Op['kind']) => (k === 'niche' ? 0.45 : k === 'pui' ? 0.35 : k === 'blind' ? 0.12 : 0.25);
  const cut = (y0: number, y1: number) => ops.filter(p => p.y0 < y1 && p.y1 > y0).map((p): HoledOpening => ({t0: p.t0, t1: p.t1, y0: Math.max(p.y0, y0), y1: Math.min(p.y1, y1), depth: depth(p.kind)}));
  for (const [y0, y1, c] of [[base, plinth, 'stone'], [plinth, eaves, 'brick']] as [number, number, C][]) {
    if (y1 <= y0) continue;
    const w = holedWall(f.L, y0, y1, cut(y0, y1));
    for (const q of w.face) emit(acc, c, f, q);
    w.reveals.forEach(rs => rs.forEach(q => emit(acc, 'white', f, q)));
  }
  // backs per opening (glass, niche back, door) at the full opening, so a plinth/brick split does not double them
  for (const p of ops) {
    const back: C = p.kind === 'niche' ? 'greyBrick' : p.kind === 'door' ? 'frame' : p.kind === 'blind' ? 'brick' : 'glass';
    rect(acc, back, f, Math.max(0, p.t0), Math.min(f.L, p.t1), p.y0, p.y1, -depth(p.kind));
    if (p.kind === 'window' || p.kind === 'pui') {
      // glazing bars: a transom near the bottom (the photo's lower sash), a mullion in wide openings
      const ty = p.kind === 'pui' ? p.y1 - 1.2 : p.y0 + (p.y1 - p.y0) * 0.22;
      slab(acc, 'white', f, p.t0, p.t1, ty - 0.05, ty + 0.05, -depth(p.kind), -depth(p.kind) + 0.06, false);
    }
    if (p.kind === 'blind') {
      // a blind window (the side wings' upper galleries are top-lit): the white bands run on across its recessed brick
      const from = o.bandFrom ?? plinth + 0.7;
      for (let y = from; y + 0.18 < p.y1; y += 0.9) if (y > p.y0) slab(acc, 'white', f, Math.max(0, p.t0), Math.min(f.L, p.t1), y, y + 0.18, -depth(p.kind), -depth(p.kind) + 0.05, false);
    }
  }
  if (plinth > base) slab(acc, 'stone', f, 0, f.L, plinth - 0.18, plinth, 0, 0.1, true);
  // dressings: jambs, lintel, sill (white stone, 8-14 cm proud)
  const skip: [number, number, number, number][] = [];
  for (const p of ops) {
    if (p.kind === 'window' || p.kind === 'pui' || p.kind === 'door' || p.kind === 'blind') {
      const jw = 0.22;
      slab(acc, 'white', f, p.t0 - jw, p.t0, p.y0, p.y1, 0, 0.08, true);
      slab(acc, 'white', f, p.t1, p.t1 + jw, p.y0, p.y1, 0, 0.08, true);
      slab(acc, 'white', f, p.t0 - 0.35, p.t1 + 0.35, p.y1, p.y1 + 0.3, 0, 0.11, true);
      if (p.kind === 'window' || p.kind === 'blind') slab(acc, 'white', f, p.t0 - 0.3, p.t1 + 0.3, p.y0 - 0.16, p.y0, 0, 0.14, true);
      let top = p.y1 + 0.3;
      if (p.head === 'tympanum') {
        const r = (p.t1 - p.t0) / 2 + 0.25, tc = (p.t0 + p.t1) / 2;
        fan(acc, 'white', f, tc, top, r, 0, Math.PI, 0.07, 10);
        fan(acc, 'stone', f, tc, top + r * 0.45, 0.42, 0, Math.PI * 2, 0.12, 10);
        top += r + 0.05;
      } else if (p.head === 'oculus') {
        const r = (p.t1 - p.t0) / 2 + 0.2, tc = (p.t0 + p.t1) / 2;
        fan(acc, 'white', f, tc, top, r, 0, Math.PI, 0.07, 10);
        fan(acc, 'dark', f, tc, top + r * 0.42, r * 0.42, 0, Math.PI * 2, 0.12, 10);
        top += r + 0.05;
      }
      if (p.panel) {
        // carved panel with a diamond under the window, between the sill and the string course
        slab(acc, 'white', f, p.t0 - 0.2, p.t1 + 0.2, 7.05, p.y0 - 0.28, 0, 0.07, true);
        const tc = (p.t0 + p.t1) / 2, yc = (7.05 + p.y0 - 0.28) / 2, h = (p.y0 - 0.28 - 7.05) / 2 - 0.08;
        poly(acc, 'brick', [f.P(tc, yc - h, 0.11), f.P(tc + h * 1.1, yc, 0.11), f.P(tc, yc + h, 0.11), f.P(tc - h * 1.1, yc, 0.11)], f.n);
      }
      skip.push([p.t0 - 0.4, p.t1 + 0.4, p.panel ? 7.0 : p.y0 - 0.2, top]);
    } else if (p.kind === 'niche') {
      const r = (p.t1 - p.t0) / 2 + 0.15, tc = (p.t0 + p.t1) / 2;
      fan(acc, 'white', f, tc, p.y1, r, 0, Math.PI, 0.07, 8);
      slab(acc, 'white', f, p.t0 - 0.15, p.t1 + 0.15, p.y0 - 0.45, p.y0, 0, 0.28, true);          // console
      if (p.statue) {
        // a standing figure on a plinth in the niche (the statues of artists on the Paulus Potterstraat front)
        const s = f.P(tc, 0, -0.2), [su, sv] = toUV(s);
        const h = (p.y1 - p.y0) * 0.82;
        ubox(b, 'white', su - 0.3, su + 0.3, sv - 0.2, sv + 0.2, p.y0, p.y0 + 0.25);
        ubox(b, 'white', su - 0.24, su + 0.24, sv - 0.15, sv + 0.15, p.y0 + 0.25, p.y0 + 0.25 + h * 0.72);
        ubox(b, 'white', su - 0.12, su + 0.12, sv - 0.11, sv + 0.11, p.y0 + 0.25 + h * 0.72, p.y0 + 0.25 + h * 0.86);
      }
      skip.push([p.t0 - 0.2, p.t1 + 0.2, p.y0 - 0.5, p.y1 + r + 0.05]);
    }
  }
  // white bands: 0.18 m every 0.9 m between the plinth and the cornice, stopping at the dressings
  const from = o.bandFrom ?? plinth + 0.7, to = o.bandTo ?? eaves - 1.0;
  for (let y = from; y + 0.18 < to; y += 0.9) {
    if (o.string !== false && Math.abs(y - 6.8) < 0.45) continue;
    const runs: [number, number][] = [[0, f.L]];
    for (const [a, c, y0, y1] of skip) if (y + 0.18 > y0 && y < y1) {
      for (let i = runs.length - 1; i >= 0; i--) {
        const [r0, r1] = runs[i];
        if (c <= r0 || a >= r1) continue;
        runs.splice(i, 1, ...([[r0, a], [c, r1]] as [number, number][]).filter(([x0, x1]) => x1 - x0 > 0.05));
      }
    }
    for (const [r0, r1] of runs) slab(acc, 'white', f, r0, r1, y, y + 0.18, 0, 0.05, true);   // closed: an open band underside read as a hole
  }
  if (o.string !== false) slab(acc, 'white', f, 0, f.L, 6.72, 7.0, 0, 0.13, true);
  if (o.cornice !== false) {
    slab(acc, 'white', f, 0, f.L, eaves - 0.9, eaves - 0.72, 0, 0.06, false);
    slab(acc, 'white', f, -0.05, f.L + 0.05, eaves - 0.42, eaves, 0, 0.32, true);
  }
}
/** Native point -> building frame (u, v). */
function toUV(p: V3): UV { return [p[0] * UX[0] + p[2] * UX[1], p[0] * VX[0] + p[2] * VX[1]]; }

/** A neo-Renaissance scroll gable above a pavilion's risalit: a stepped brick shield with white copings, bands and an oculus. */
function scrollGable(acc: Acc, f: Face, tc: number, w: number, y0: number, h: number) {
  const steps: [number, number][] = [[w / 2, 0], [w / 2, h * 0.3], [w / 2 - w * 0.17, h * 0.3], [w / 2 - w * 0.17, h * 0.58], [w / 2 - w * 0.31, h * 0.58], [w / 2 - w * 0.31, h * 0.82], [w * 0.1, h]];
  const outline: [number, number][] = [...steps.map(([x, y]) => [tc + x, y0 + y] as [number, number]), ...[...steps].reverse().map(([x, y]) => [tc - x, y0 + y] as [number, number])];
  const front = 0.06, back = -0.55;
  const shape = new T.Shape(outline.map(([t, y]) => new T.Vector2(t, y)));
  const g = new T.ShapeGeometry(shape), pos = g.getAttribute('position'), ix = g.index!;
  for (let i = 0; i < ix.count; i += 3) {
    const p = [0, 1, 2].map(k => f.P(pos.getX(ix.getX(i + k)), pos.getY(ix.getX(i + k)), front));
    tri(acc, 'brick', p[0], p[1], p[2], f.n);
    const q = [0, 1, 2].map(k => f.P(pos.getX(ix.getX(i + k)), pos.getY(ix.getX(i + k)), back));
    tri(acc, 'brick', q[0], q[1], q[2], [-f.n[0], 0, -f.n[2]]);
  }
  for (let i = 0; i < outline.length; i++) {
    const [t0, ya] = outline[i], [t1, yb] = outline[(i + 1) % outline.length];
    if (Math.abs(ya - y0) < 1e-6 && Math.abs(yb - y0) < 1e-6) continue;
    const a = f.P(t0, ya, front), bb = f.P(t1, yb, front), d = f.P(t1, yb, back), e = f.P(t0, ya, back);
    const mid = f.P((t0 + t1) / 2, (ya + yb) / 2, 0), ctr = f.P(tc, y0 + h * 0.4, 0);
    const horizontal = Math.abs(ya - yb) < 1e-6;
    quad(acc, horizontal && ya > y0 ? 'white' : 'brick', a, bb, d, e, sub(mid, ctr));
  }
  // white copings on each step's top, white bands across the shield, an oculus with its stone surround, a finial
  for (const [x, y] of steps.slice(1)) if (y > 0 && y < h) slab(acc, 'white', f, tc - x - 0.12, tc + x + 0.12, y0 + y, y0 + y + 0.16, back, front + 0.08, true);
  for (let y = y0 + 0.5; y < y0 + h * 0.3 - 0.2; y += 0.9) rect(acc, 'white', f, tc - w / 2, tc + w / 2, y, y + 0.18, front + 0.05);
  fan(acc, 'white', f, tc, y0 + h * 0.45, 0.62, 0, Math.PI * 2, front + 0.05, 10);
  fan(acc, 'dark', f, tc, y0 + h * 0.45, 0.4, 0, Math.PI * 2, front + 0.1, 10);
  slab(acc, 'white', f, tc - 0.18, tc + 0.18, y0 + h, y0 + h + 0.9, -0.4, -0.04, true);
  for (const s of [-1, 1]) slab(acc, 'white', f, tc + s * (w / 2 - 0.05) - 0.16, tc + s * (w / 2 - 0.05) + 0.16, y0 + h * 0.3 + 0.16, y0 + h * 0.3 + 1.1, -0.4, -0.08, true);
}

/** A white vertical banner (1.3 m) standing 0.25 m off a face, two columns of dark lettering reading upwards. */
function banner(acc: Acc, f: Face, t: number, y0: number, y1: number) {
  slab(acc, 'white', f, t - 0.65, t + 0.65, y0, y1, 0.2, 0.3, true);
  for (const y of [y0 + 0.3, y1 - 0.3]) slab(acc, 'dark', f, t - 0.06, t + 0.06, y - 0.06, y + 0.06, -0.03, 0.29, true);   // the brackets it hangs from (into the wall, up to the banner's face: a slab has no back)
  const px = 0.085, up = Math.PI / 2;
  const col = (text: string, tt: number, yFrom: number) => [...text].forEach((ch, i) => glyph(acc, 'dark', f, ch, tt, yFrom + i * 6 * px, up, px, 0.33));
  // two columns reading upwards; a third (AMSTERDAM) overlapped MUSEUM on a 7.4 m banner
  col('STEDELIJK', t - 0.28, y0 + 0.6);
  col('MUSEUM', t + 0.3, y0 + 0.6 + 3 * 6 * px);
}
/** A corner pavilion: two street faces (risalit with gable, statue niche and window; side parts one bay each), pyramid with lantern. */
function pavilion(b: BuildingTools, acc: Acc, u0: number, u1: number, v0: number, v1: number, faces: {f: Face; gable: boolean}[]) {
  for (const {f, gable} of faces) {
    const L = f.L, rw = 4.1, r0 = (L - rw) / 2, r1 = r0 + rw;
    const sideOps = (t: number): Op[] => bay(t, 1.7);
    const left = part(f, 0, r0, 0), right = part(f, r1, L, 0), ris = part(f, r0, r1, 0.3);
    bandedFront(b, acc, left, PAV_EAVES, sideOps(r0 / 2));
    bandedFront(b, acc, right, PAV_EAVES, sideOps((L - r1) / 2));
    bandedFront(b, acc, ris, PAV_EAVES, [{t0: rw / 2 - 0.95, t1: rw / 2 + 0.95, y0: 1.85, y1: 5.5, kind: 'window'}, {...niche(rw / 2, 1.3), panel: false}]);
    // the risalit's returns (0.3 m)
    for (const [t, s] of [[r0, -1], [r1, 1]] as const) {
      const a = f.P(t, 0, 0), c = f.P(t, 0, 0.3), out = sub(f.P(t + s, 0, 0), f.P(t, 0, 0));
      quad(acc, 'brick', a, c, [c[0], PAV_EAVES, c[2]], [a[0], PAV_EAVES, a[2]], out);
    }
    if (gable) scrollGable(acc, ris, rw / 2, rw - 0.2, PAV_EAVES, 4.4);
  }
  // pyramid roof (3DBAG 15.9 -> 25.1) and the lantern with its cap and finial
  hipRoof(acc, 'slate', u0, u1, v0, v1, PAV_EAVES, 23.4, true, (u1 - u0) / 2);
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  ubox(b, 'slate', cu - 0.8, cu + 0.8, cv - 0.8, cv + 0.8, 23.0, 24.4);
  hipRoof(acc, 'slate', cu - 1.0, cu + 1.0, cv - 1.0, cv + 1.0, 24.4, 25.3, true, 1.0, true);
  ubox(b, 'white', cu - 0.06, cu + 0.06, cv - 0.06, cv + 0.06, 25.3, 26.2);
}

function oldBuilding(b: BuildingTools, acc: Acc) {
  // Paulus Potterstraat front, east to west (the viewer's left is east)
  const wingFront = (t0: number) => [...bay(t0 + 2.85, 2.5, {panel: true}), niche(t0 + 5.85), ...bay(t0 + 8.85, 2.5, {panel: true}), niche(t0 + 11.85), ...bay(t0 + 14.85, 2.5, {panel: true}), niche(t0 + 17.85), ...bay(t0 + 20.85, 2.5, {panel: true})];
  bandedFront(b, acc, face([38.9, 14.55], [15.2, 14.55], 'N'), EAVES, wingFront(0));
  bandedFront(b, acc, face([-15.35, 14.7], [-39.1, 14.7], 'N'), EAVES, wingFront(0));
  // central parts either side of the frontispiece: one bay each, the return walls one bay
  bandedFront(b, acc, face([15.2, 20.95], [6.9, 20.95], 'N'), CEN_EAVES, bay(4.15, 2.5, {panel: true}));
  bandedFront(b, acc, face([-6.9, 20.95], [-15.35, 20.95], 'N'), CEN_EAVES, bay(4.2, 2.5, {panel: true}));
  bandedFront(b, acc, face([15.2, 14.55], [15.2, 20.95], 'E'), CEN_EAVES, bay(3.2, 2.0));
  bandedFront(b, acc, face([-15.35, 20.95], [-15.35, 14.7], 'W'), CEN_EAVES, bay(3.2, 2.0));
  // frontispiece (13.8 m): three tall glazed entrance openings (1957 pui), relief panels, three windows under oculi
  const fr = face([6.9, 21.7], [-6.9, 21.7], 'N');
  const fOps: Op[] = [2.5, 6.9, 11.3].flatMap((t): Op[] => [{t0: t - 1.2, t1: t + 1.2, y0: 0.45, y1: 5.5, kind: 'pui'}, {t0: t - 1.2, t1: t + 1.2, y0: 7.4, y1: 10.8, kind: 'window', head: 'oculus', panel: false}]);
  bandedFront(b, acc, fr, 13.8, fOps, {plinth: 0.45});
  for (const t of [2.5, 6.9, 11.3]) slab(acc, 'white', fr, t - 1.25, t + 1.25, 5.95, 6.62, 0, 0.09, true);
  for (const [l, r, o] of [[[6.9, 20.95], [6.9, 21.7], 'E'], [[-6.9, 21.7], [-6.9, 20.95], 'W']] as [UV, UV, Side][]) bandedFront(b, acc, face(l, r, o), 13.8, [], {cornice: false, string: false});
  // pinnacles standing on the cornice at the frontispiece's corners (boxes on top, not trims on the wall below)
  for (const u of [6.2, -6.2]) ubox(b, 'white', u - 0.22, u + 0.22, 21.2, 21.64, 13.8, 16.4);
  // the tower attic set back above the frontispiece: two windows, cornice; hipped roof, clock lantern and spire (3DBAG 33.7)
  const at = face([4.8, 21.4], [-4.8, 21.4], 'N');
  bandedFront(b, acc, at, 21.0, [{t0: 2.6, t1: 3.8, y0: 15.2, y1: 18.6, kind: 'window'}, {t0: 5.8, t1: 7.0, y0: 15.2, y1: 18.6, kind: 'window'}], {base: 13.8, string: false, bandFrom: 14.2, bandTo: 20.2});
  for (const [l, r, o] of [[[4.8, 13.0], [4.8, 21.4], 'E'], [[-4.8, 21.4], [-4.8, 13.0], 'W'], [[-4.8, 13.0], [4.8, 13.0], 'S']] as [UV, UV, Side][]) bandedFront(b, acc, face(l, r, o), 21.0, [], {base: 15.0, string: false, cornice: false, bandFrom: 15.4, bandTo: 20.2});   // mostly inside the mansard: a cornice here ran through its slope
  hipRoof(acc, 'slate', -4.9, 4.9, 12.9, 21.5, 21.0, 27.8, false, 2.2);
  ubox(b, 'slate', -1.1, 1.1, 16.1, 18.3, 27.4, 30.6);
  fan(acc, 'white', face([1.1, 18.3], [-1.1, 18.3], 'N'), 1.1, 29.2, 0.6, 0, Math.PI * 2, 0.045, 10);
  fan(acc, 'dark', face([1.1, 18.3], [-1.1, 18.3], 'N'), 1.1, 29.2, 0.45, 0, Math.PI * 2, 0.095, 10);
  hipRoof(acc, 'slate', -1.3, 1.3, 15.9, 18.5, 30.6, 33.7, true, 1.3, true);

  // pavilions (risalit gables on the street faces; the rear faces under the 2012 roof have none)
  pavilion(b, acc, 38.9, 50.0, 7.7, 18.7, [{f: face([50.0, 18.7], [38.9, 18.7], 'N'), gable: true}, {f: face([50.0, 7.7], [50.0, 18.7], 'E'), gable: true}]);
  pavilion(b, acc, -50.1, -39.1, 7.6, 18.7, [{f: face([-39.1, 18.7], [-50.1, 18.7], 'N'), gable: true}, {f: face([-50.1, 18.7], [-50.1, 7.6], 'W'), gable: true}]);
  pavilion(b, acc, -50.1, -39.1, -19.5, -8.45, [{f: face([-50.1, -8.45], [-50.1, -19.5], 'W'), gable: true}, {f: face([-50.1, -19.5], [-39.1, -19.5], 'S'), gable: false}]);
  pavilion(b, acc, 38.9, 50.0, -19.2, -8.3, [{f: face([50.0, -19.2], [50.0, -8.3], 'E'), gable: true}, {f: face([38.9, -19.2], [50.0, -19.2], 'S'), gable: false}]);
  // the white name banners on the north-west pavilion's two street faces, next to the corner
  for (const [f, t] of [[face([-39.1, 18.7], [-50.1, 18.7], 'N'), 9.6], [face([-50.1, 18.7], [-50.1, 7.6], 'W'), 1.5]] as [Face, number][]) banner(acc, f, t, 6.2, 13.6);
  // pavilion walls above the wing roofs (inner faces), and the short returns
  for (const [l, r, o, y0, top] of [
    [[38.9, 18.7], [38.9, 14.55], 'W', 0, PAV_EAVES], [[-39.1, 14.7], [-39.1, 18.7], 'E', 0, PAV_EAVES],
    [[38.9, 14.55], [38.9, 7.7], 'W', EAVES - 0.4, PAV_EAVES], [[38.9, 7.7], [47.9, 7.7], 'S', EAVES - 0.4, PAV_EAVES],
    [[-39.1, 7.6], [-39.1, 14.7], 'E', EAVES - 0.4, PAV_EAVES], [[-47.9, 7.6], [-39.1, 7.6], 'S', EAVES - 0.4, PAV_EAVES],
    [[-39.1, -8.45], [-47.9, -8.45], 'N', EAVES - 0.4, PAV_EAVES], [[-39.1, -16.8], [-39.1, -8.45], 'E', EAVES - 0.4, PAV_EAVES],
    [[47.9, -8.3], [38.9, -8.3], 'N', EAVES - 0.4, PAV_EAVES], [[38.9, -8.3], [38.9, -16.7], 'W', EAVES - 0.4, PAV_EAVES],
    [[-50.1, 7.6], [-47.9, 7.6], 'S', 0, PAV_EAVES], [[-47.9, -8.45], [-50.1, -8.45], 'N', 0, PAV_EAVES],
    [[50.0, -8.3], [47.9, -8.3], 'N', 0, PAV_EAVES], [[47.9, 7.7], [50.0, 7.7], 'S', 0, PAV_EAVES],
    [[-39.1, -19.5], [-39.1, -16.8], 'E', 0, PAV_EAVES], [[38.9, -16.7], [38.9, -19.2], 'W', 0, PAV_EAVES],
  ] as [UV, UV, Side, number, number][]) {
    const f = face(l, r, o);
    // only 0.2 m of these walls clears the wing roofs (15.4 m): a white coping above the roof, not a cornice through it
    if (y0 > 0) { rect(acc, 'brick', f, 0, f.L, y0, top); slab(acc, 'white', f, 0, f.L, EAVES + 0.95, top, 0, 0.12, true); }
    else bandedFront(b, acc, f, top, [], {string: true});
  }
  // side wings (Van Baerlestraat and east): four bays at 4.0 m, a statue between the upper windows
  // (w03-247 / w04-66: two pairs of bays either side of a downpipe; the upper storey is blind brick under the arches,
  // relief panels below; two small stepped gables stand on the cornice over the inner bays)
  const sideOps = [2.0, 5.5, 10.5, 14.0].flatMap(t => bay(t, 2.4, {panel: true, blindUpper: true}));
  for (const f of [face([-47.9, 7.6], [-47.9, -8.45], 'W'), face([47.9, -8.3], [47.9, 7.7], 'E')]) {
    bandedFront(b, acc, f, EAVES, sideOps);
    for (const t of [3.75, 12.3]) scrollGable(acc, f, t, 3.6, EAVES, 4.6);   // w03-247: about 3.9 m wide, cornice to finial about 5 m
  }
  // rear walls in the 2012 glass hall: bands and plain windows
  const rearOps = (L: number) => Array.from({length: Math.floor(L / 6)}, (_, i) => bay(3 + i * 6 + (L - Math.floor(L / 6) * 6) / 2, 2.3)).flat();
  for (const [l, r, o, top] of [[[-39.1, -16.8], [-15.35, -16.8], 'S', EAVES], [[15.2, -16.7], [38.9, -16.7], 'S', EAVES], [[-15.35, -23.7], [15.2, -23.7], 'S', CEN_EAVES], [[-15.35, -16.8], [-15.35, -23.7], 'W', CEN_EAVES], [[15.2, -23.7], [15.2, -16.7], 'E', CEN_EAVES]] as [UV, UV, Side, number][]) {
    const f = face(l, r, o);
    bandedFront(b, acc, f, top, f.L > 8 ? rearOps(f.L) : []);
  }

  // roofs: the wings' north-light sheds (rijksmonument 505840: "De lichttoevoer geschiedt uitsluitend aan de noordzijde")
  // behind a slate slope at the street edges, flat zinc between
  const wing = (u0: number, u1: number, v0: number, v1: number, edges: Side[]) => {
    // the flat stops where each street edge's 2 m slate slope begins (it used to cover the slopes from above)
    const d = 2.0, has = (e: Side) => edges.includes(e) ? d : 0;
    roof(b, [[nativeRing(rectRing(u0 + has('W'), u1 - has('E'), v0 + has('S'), v1 - has('N')))]], EAVES + 0.9, 'slate');
    for (const e of edges) {
      // a 2 m slate slope from the cornice up to the flat roof
      const [a, c, a2, c2] = e === 'N' ? [P3(u0, EAVES, v1), P3(u1, EAVES, v1), P3(u0, EAVES + 0.9, v1 - d), P3(u1, EAVES + 0.9, v1 - d)]
        : e === 'S' ? [P3(u0, EAVES, v0), P3(u1, EAVES, v0), P3(u0, EAVES + 0.9, v0 + d), P3(u1, EAVES + 0.9, v0 + d)]
        : e === 'E' ? [P3(u1, EAVES, v0), P3(u1, EAVES, v1), P3(u1 - d, EAVES + 0.9, v0), P3(u1 - d, EAVES + 0.9, v1)]
        : [P3(u0, EAVES, v0), P3(u0, EAVES, v1), P3(u0 + d, EAVES + 0.9, v0), P3(u0 + d, EAVES + 0.9, v1)];
      const n = N(DIR[e]);
      quad(acc, 'slate', a, c, c2, a2, [n[0], 1, n[1]]);
    }
  };
  // the central block stands 0.2 m above the front wings' roofs: brick steps where they meet (an open seam before)
  for (const f of [face([-15.35, 14.7], [-15.35, -16.8], 'W'), face([15.2, -16.7], [15.2, 14.55], 'E')]) rect(acc, 'brick', f, 0, f.L, EAVES, CEN_EAVES);
  wing(15.2, 38.9, -16.7, 14.55, ['N', 'S']);
  wing(-39.1, -15.35, -16.8, 14.7, ['N', 'S']);
  wing(-47.9, -39.1, -8.45, 7.6, ['W']);
  wing(38.9, 47.9, -8.3, 7.7, ['E']);
  for (const [u0, u1] of [[17.0, 37.2], [-37.4, -17.1]]) {
    for (const t of shedRoof({u0, u1, v0: -12.6, count: 5, pitch: 5.0, y: EAVES + 0.9, rise: 1.8})) {
      const p = t.points.map(([u, v, y]) => P3(u, y, v)) as [V3, V3, V3];
      const o = P3(t.out[0], t.out[2], t.out[1]), z = P3(0, 0, 0);
      tri(acc, t.part === 'glazing' ? 'canopyGlass' : 'slate', p[0], p[1], p[2], sub(o, z));
    }
  }
  for (const [u0, u1] of [[-46.6, -40.4], [40.2, 46.6]]) gablePrism(acc, 'canopyGlass', 'slate', u0, u1, -6.6, 5.8, EAVES + 0.9, EAVES + 2.4, false);
  // centre: flat roof round the two light wells (BAG holes kept open), the stair hall's glass hip, the wells' lanterns
  const holeW: UV[] = rectRing(-14.97, -6.88, -5.08, 3.19), holeE: UV[] = rectRing(7.2, 15.07, -5.1, 3.64);
  roof(b, [[nativeRing(rectRing(-15.35, 15.2, -23.7, 3.8)), nativeRing(holeW).reverse(), nativeRing(holeE).reverse()]], CEN_EAVES, 'slate');
  for (const h of [holeW, holeE]) for (let i = 0; i < 4; i++) {
    const a = h[i], c = h[(i + 1) % 4], m: UV = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], ctr: UV = [(h[0][0] + h[2][0]) / 2, (h[0][1] + h[2][1]) / 2];
    const inward = N([ctr[0] - m[0], ctr[1] - m[1]]);
    quad(acc, 'greyBrick', P3(a[0], 0, a[1]), P3(c[0], 0, c[1]), P3(c[0], CEN_EAVES, c[1]), P3(a[0], CEN_EAVES, a[1]), [inward[0], 0, inward[1]]);
  }
  hipRoof(acc, 'canopyGlass', -6.4, 6.4, -12.6, 2.6, CEN_EAVES, 21.9, false, 3.5);
  for (const s of [-1, 1]) hipRoof(acc, 'canopyGlass', s > 0 ? 7.6 : -14.3, s > 0 ? 14.3 : -7.6, -12.3, -5.6, CEN_EAVES, 19.5, true, 2.0);
  // the rear hall's glazed ridge roof standing through the 2012 roof (3DBAG ridge 21.5)
  gablePrism(acc, 'canopyGlass', 'slate', -12.6, 13.2, -21.9, -16.5, CEN_EAVES, 21.5, true);
  // central mansard (3DBAG flat top 22.4) with two rows of dormers on the street and side slopes
  mansard(b, acc);
}

function mansard(b: BuildingTools, acc: Acc) {
  const u0 = -15.35, u1 = 15.2, v0 = 3.8, v1 = 20.95, d = 2.6, y0 = CEN_EAVES, y1 = 21.8, top = 22.4;
  const A = P3(u0, y0, v0), Bq = P3(u1, y0, v0), Cq = P3(u1, y0, v1), D = P3(u0, y0, v1);
  const a = P3(u0 + d, y1, v0 + d), bq = P3(u1 - d, y1, v0 + d), c = P3(u1 - d, y1, v1 - d), e = P3(u0 + d, y1, v1 - d);
  const sl = (s: Side): V3 => { const n = N(DIR[s]); return [n[0], 0.4, n[1]]; };
  quad(acc, 'slate', D, Cq, c, e, sl('N')); quad(acc, 'slate', A, Bq, bq, a, sl('S'));
  quad(acc, 'slate', Bq, Cq, c, bq, sl('E')); quad(acc, 'slate', A, D, e, a, sl('W'));
  hipRoof(acc, 'slate', u0 + d, u1 - d, v0 + d, v1 - d, y1, top, true, 4);
  // dormers: small gabled boxes on the slope (the photo shows a lower row and a smaller upper row)
  const dormer = (u: number, v: number, s: Side, w: number, h: number, y: number) => {
    const n = N(DIR[s]), tdir = s === 'N' || s === 'S' ? [1, 0] : [0, 1];
    const f = face([u - (s === 'N' ? -1 : s === 'S' ? 1 : 0) * w / 2 * tdir[0] + 0, v + (s === 'E' ? -1 : s === 'W' ? 1 : 0) * w / 2] as UV, [u + (s === 'N' ? -1 : s === 'S' ? 1 : 0) * w / 2, v - (s === 'E' ? -1 : s === 'W' ? 1 : 0) * w / 2] as UV, s);
    rect(acc, 'white', f, 0, w, y, y + h, 0);
    rect(acc, 'dark', f, 0.15, w - 0.15, y + 0.15, y + h - 0.3, 0.05);
    poly(acc, 'white', [f.P(-0.1, y + h, 0.02), f.P(w + 0.1, y + h, 0.02), f.P(w / 2, y + h + w * 0.45, 0.02)], f.n);
    // cheeks and roof back into the slope
    const back = 1.4;
    for (const [t, sgn] of [[0, -1], [w, 1]] as const) quad(acc, 'slate', f.P(t, y, 0), f.P(t, y, -back), f.P(t, y + h, -back), f.P(t, y + h, 0), sub(f.P(t + sgn, y, 0), f.P(t, y, 0)));
    quad(acc, 'slate', f.P(-0.1, y + h, 0.02), f.P(w / 2, y + h + w * 0.45, 0.02), f.P(w / 2, y + h + w * 0.45, -back), f.P(-0.1, y + h, -back), [-(f.n[0]), 1, -(f.n[2])]);
    quad(acc, 'slate', f.P(w + 0.1, y + h, 0.02), f.P(w / 2, y + h + w * 0.45, 0.02), f.P(w / 2, y + h + w * 0.45, -back), f.P(w + 0.1, y + h, -back), [f.n[0], 1, f.n[2]]);
    void n;
  };
  const vAt = (y: number) => v1 - (y - y0) / (y1 - y0) * d;   // the north slope's plane at height y
  for (const u of [-12.6, -9.3, 9.0, 12.3]) dormer(u, vAt(16.2) + 0.1, 'N', 1.0, 1.3, 16.2);
  for (const u of [-11.0, 10.7]) dormer(u, vAt(19.4) + 0.1, 'N', 0.8, 0.9, 19.4);
  const uAt = (y: number, s: number) => (s > 0 ? u1 : u0) - s * (y - y0) / (y1 - y0) * d;
  for (const v of [6.0, 10.5, 15.0]) { dormer(uAt(16.2, 1) + 0.1, v, 'E', 1.0, 1.3, 16.2); dormer(uAt(16.2, -1) - 0.1, v, 'W', 1.0, 1.3, 16.2); }
}

// ---- the 2012 wing ---------------------------------------------------------------------------------------------------
/** The tub's bottom: level 4.4 m from the Van Baerlestraat end to u = -12, then rising to 10.5 m at the east end. */
const tubBottom = (u: number) => (u <= -12 ? 4.4 : 4.4 + (u + 12) * (6.1 / 56));
const RIM = {u0: -46.8, u1: 46.3, v0: -48.5, v1: -29.3, radius: 6};
const TUB_BOTTOM = {u0: -44.6, u1: 44.0, v0: -45.0, v1: -32.0, radius: 3.5};
const ROOF = {u0: -50.3, u1: 50.1, v0: -60.1, v1: -19.6, top: 17.65, under: 17.25};
const GLASS_V = -44.5, GLASS_HEAD = 5.4;

function newWing(b: BuildingTools, acc: Acc) {
  // the tub (white composite), rim at the roof's underside
  const tub = bathtubShell({bottom: TUB_BOTTOM, rim: RIM, top: ROOF.under, bottomAt: tubBottom, breaks: [-12], corner: 4});
  const put = (t: TubTri, c: C) => {
    const p = t.map(([u, v, y]) => P3(u, y, v)) as [V3, V3, V3];
    // bathtubShell winds counter-clockwise in a frame that our (u, v) -> (x, z) reflection keeps: emit as listed
    acc.tri(c, p[0], p[1], p[2]);
  };
  for (const t of tub.sides) put(t, 'concrete');
  for (const t of tub.bottom) put(t, 'concrete');
  // the roof slab: top, edge, soffit outside the tub's rim; a notch for the rear hall's glazed ridge
  const outer: UV[] = [[ROOF.u0, ROOF.v0], [ROOF.u1, ROOF.v0], [ROOF.u1, ROOF.v1], [13.4, ROOF.v1], [13.4, -22.1], [-12.8, -22.1], [-12.8, ROOF.v1], [ROOF.u0, ROOF.v1]];
  roof(b, [[nativeRing(outer)]], ROOF.top, 'concrete');
  soffit(b, [[nativeRing(outer), nativeRing(tub.rimRing as UV[]).reverse()]], ROOF.under, 'concrete');
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], c = outer[(i + 1) % outer.length];
    const m: UV = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], d: UV = [c[0] - a[0], c[1] - a[1]];
    // outward normal of a clockwise-listed ring in (u, v): (d.v, -d.u)
    const nn = N([d[1], -d[0]]);
    void m;
    quad(acc, 'concrete', P3(a[0], ROOF.under, a[1]), P3(c[0], ROOF.under, c[1]), P3(c[0], ROOF.top, c[1]), P3(a[0], ROOF.top, a[1]), [nn[0], 0, nn[1]]);
  }
  // a thin dark gutter line near the Museumplein edge (orthophoto) and the roof's plant enclosure
  // glazed ground storey: Museumplein face to 5.4 m (mullions every 3 m), white skirt up to the rising bottom
  const gl = face([-44.0, GLASS_V], [43.2, GLASS_V], 'S');
  rect(acc, 'dark', gl, 0, gl.L, 0, GLASS_HEAD, 0);
  for (let t = 3; t < gl.L - 0.5; t += 3) slab(acc, 'frame', gl, t - 0.06, t + 0.06, 0, GLASS_HEAD, 0, 0.08, true);
  slab(acc, 'frame', gl, 0, gl.L, GLASS_HEAD - 0.25, GLASS_HEAD, 0, 0.1, true);
  // where the bottom has risen above the glass head, a white skirt closes the gap between them
  const uFrom = -12 + (GLASS_HEAD - 4.4) / (6.1 / 56);
  for (let u = uFrom; u < 43.2 - 1e-6; u += 2.0) {
    const u2 = Math.min(43.2, u + 2.0);
    quad(acc, 'concrete', P3(u, GLASS_HEAD, GLASS_V), P3(u2, GLASS_HEAD, GLASS_V), P3(u2, tubBottom(u2), TUB_BOTTOM.v0), P3(u, tubBottom(u), TUB_BOTTOM.v0), [N(DIR.S)[0], -0.3, N(DIR.S)[1]]);
  }
  // Van Baerlestraat end: glass under the tub to 5.4 m and the hall glass between the old building and the tub to the roof
  const wEnd = face([-43.9, -28.7], [-43.9, GLASS_V], 'W');
  rect(acc, 'dark', wEnd, 0, wEnd.L, 0, GLASS_HEAD, 0);
  for (let t = 3; t < wEnd.L - 0.5; t += 3) slab(acc, 'frame', wEnd, t - 0.06, t + 0.06, 0, GLASS_HEAD, 0, 0.08, true);
  const wHall = face([-42.07, -19.5], [-42.07, -28.7], 'W');
  rect(acc, 'dark', wHall, 0, wHall.L, 0, ROOF.under, 0);
  for (let t = 2.3; t < wHall.L - 0.5; t += 2.3) slab(acc, 'frame', wHall, t - 0.06, t + 0.06, 0, ROOF.under, 0, 0.08, true);
  for (const y of [5.4, 10.8]) slab(acc, 'frame', wHall, 0, wHall.L, y - 0.08, y + 0.08, 0, 0.08, true);
  const wStep = face([-42.07, -28.7], [-43.9, -28.7], 'N');
  rect(acc, 'dark', wStep, 0, wStep.L, 0, ROOF.under, 0);
  // east end: two-storey glass under the tub's raised end (to its bottom, 10.5 m), STEDELIJK MUSEUM AMSTERDAM on the glass
  const eEnd = face([43.2, GLASS_V], [43.2, -25.8], 'E');
  const eTop = tubBottom(44.0);
  rect(acc, 'dark', eEnd, 0, eEnd.L, 0, eTop, 0);
  for (let t = 2.5; t < eEnd.L - 0.5; t += 2.5) slab(acc, 'frame', eEnd, t - 0.06, t + 0.06, 0, eTop, 0, 0.08, true);
  slab(acc, 'frame', eEnd, 0, eEnd.L, 5.3, 5.5, 0, 0.08, true);
  arcText(acc, 'white', eEnd, 'STEDELIJK', 6.5, 8.0, 1.75, Math.PI / 2, 0.075, 0.1, true);
  line(acc, 'white', eEnd, 'MUSEUM', 6.5, 7.7, 0.075, 0.1);
  arcText(acc, 'white', eEnd, 'AMSTERDAM', 6.5, 8.0, 1.75, -Math.PI / 2, 0.075, 0.1, false);
  const eHall = face([41.93, -25.8], [41.93, -19.2], 'E');
  rect(acc, 'dark', eHall, 0, eHall.L, 0, ROOF.under, 0);
  for (const y of [5.4, 10.8]) slab(acc, 'frame', eHall, 0, eHall.L, y - 0.08, y + 0.08, 0, 0.08, true);
  const eStep = face([43.2, -25.8], [41.93, -25.8], 'N');
  rect(acc, 'dark', eStep, 0, eStep.L, 0, ROOF.under, 0);
  // the hall's roof strip between the wings' rear walls and the 2012 roof
  roof(b, [[nativeRing(rectRing(-39.1, -15.35, -19.6, -16.8))], [[...nativeRing(rectRing(15.2, 38.9, -19.6, -16.7))]]], EAVES + 0.45, 'slate');
  // the canopy's slender columns at the Museumplein edge (the overhang's two supports seen under its east end)
  for (const u of [18.0, 38.0]) ubox(b, 'concrete', u - 0.25, u + 0.25, -57.6, -57.1, 0, ROOF.under);
}

/** The 2012 service tower on the Van Baerlestraat corner (BAG 0363100012251805): dark panels, loading door, circular name. */
function serviceTower(b: BuildingTools, acc: Acc) {
  const u0 = -42.7, u1 = -25.3, v0 = -72.7, v1 = -65.3, H = 17.6;
  const faces: [Face, HoledOpening[]][] = [
    [face([u0, v1], [u0, v0], 'W'), [{t0: 1.9, t1: 5.5, y0: 0, y1: 4.6, depth: 0.15}]],
    [face([u1, v1], [u0, v1], 'N'), [{t0: 7.4, t1: 8.4, y0: 0, y1: 2.3, depth: 0.1}, {t0: 10.6, t1: 11.6, y0: 0, y1: 2.3, depth: 0.1}]],
    [face([u1, v0], [u1, v1], 'E'), []],
    [face([u0, v0], [u1, v0], 'S'), [{t0: 3.0, t1: 4.0, y0: 0, y1: 2.3, depth: 0.1}]],
  ];
  for (const [f, ops] of faces) {
    const w = holedWall(f.L, 0, H, ops);
    for (const q of w.face) emit(acc, 'dark', f, q);
    w.reveals.forEach(rs => rs.forEach(q => emit(acc, 'frame', f, q)));
    for (const o of ops) rect(acc, 'frame', f, o.t0, o.t1, o.y0, o.y1, -o.depth);
    // panel joints (dark grey metal panels about 1.2 x 1.8 m): horizontal fins every 1.8 m above the doors
    for (let y = 5.4; y < H - 0.5; y += 1.8) slab(acc, 'frame', f, 0.05, f.L - 0.05, y - 0.04, y + 0.04, 0, 0.06, false);
  }
  roof(b, [[nativeRing(rectRing(u0, u1, v0, v1))]], H, 'dark');
  // the circular lettering on the Van Baerlestraat face: STEDELIJK over the top, MUSEUM across, AMSTERDAM under
  const wf = faces[0][0];
  arcText(acc, 'white', wf, 'STEDELIJK', wf.L / 2, 12.9, 2.55, Math.PI / 2, 0.11, 0.08, true);
  line(acc, 'white', wf, 'MUSEUM', wf.L / 2, 12.5, 0.11, 0.08);
  arcText(acc, 'white', wf, 'AMSTERDAM', wf.L / 2, 12.9, 2.55, -Math.PI / 2, 0.11, 0.08, false);
}

export function buildStedelijkMuseum(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  oldBuilding(b, acc);
  newWing(b, acc);
  serviceTower(b, acc);
  acc.flush();
}
export const STEDELIJK_FRAME = {bearing: 66.7, toNative: N, roundedRect};
