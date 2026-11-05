import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {GL} from './nearbar-kit';
import {Acc, type C} from './tier-kit';
import {slopedLawnEdge, type LawnEdgeZone} from '../../src/canalRecall/landmarks/slopedLawnEdge';

/**
 * Albert Heijn Museumplein and the Q-Park garage under the "ezelsoor" (BAG pand 0363100012082824, 1999; Sven-Ingvar
 * Andersson's Museumplein redesign): the north corner of the Museumplein lawn is lifted into a tilted triangle of grass that
 * rises from the plain to about 7.5 m over the Van Baerlestraat, edged in green copper. Under its raised tip stand the
 * supermarket's glass fronts (blue "Albert Heijn" lettering), a light granite corner pier, dark stone cladding and the garage
 * entrance; further along, the edge falls to a granite retaining wall. Two small garage stair kiosks stand on the plaza in
 * front of the Stedelijk: a mirrored steel cube (pand 0363100012225637, 4.8 m) and a black glass box (pand 0363100012225636).
 *
 * Sources: BAG rings (PDOK BAG WFS, CC0) and the 3DBAG LoD2.2 roof (CC BY 4.0) in scripts/landmarks/albert-heijn-museumplein-
 * footprints.json; the lawn plane through the 3DBAG roof points (tip 7.5 m, the south and north-east corners 0.3 m, checked
 * against (-32.2, 39.8) at 1.1 m). Fronts measured on Gemeente Amsterdam panoramas (CC BY 4.0): the tip from the Van
 * Baerlestraat recording_2025-07-30_11-08-35_00343, the north-west front recording_2025-09-29_08-09-56_01107, the retaining
 * wall b_20250115_1006_Track23_Sphere_00028, the garage side recording_2025-07-30_09-59-09_01078, the kiosks
 * b_20250115_1006_Track23_Sphere_00015. Native frame: x east, z south, metres from the BAG ring's RD vertex average.
 */

type V3 = [number, number, number];
type P2 = [number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crs = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function tri(acc: Acc, c: C, a: V3, b: V3, d: V3, out: V3) {
  const n = crs(sub(b, a), sub(d, a));
  if (Math.hypot(...n) < 1e-9) return;
  if (dot(n, out) >= 0) acc.tri(c, a, b, d); else acc.tri(c, a, d, b);
}
const quad = (acc: Acc, c: C, a: V3, b: V3, d: V3, e: V3, out: V3) => { tri(acc, c, a, b, d, out); tri(acc, c, a, d, e, out); };

/** The lawn plane (3DBAG roof points): y = A x + B z + C0, never below the plaza kerb. */
const lawnY = (x: number, z: number) => Math.max(0.18, -0.17704 * x - 0.13089 * z + 0.61862);
const TIP: P2 = [-55.8, 22.9], NE: P2 = [19.1, -23.4], S: P2 = [-29.4, 42.2];
/** BAG 0363100012082824 outer ring (native), the lawn's outline. */
const RING: P2[] = [[19.2, -23.3], [19.1, -23.4], [-55.8, 22.9], [-32.8, 39.8], [-29.4, 42.2], [-27.8, 39.8], [-27.4, 40.1], [10.9, -11.9], [11.7, -10.1], [11.3, -9.6], [11.9, -9.2], [23.2, -24.8], [22.9, -25.0], [22.6, -25.2], [20.5, -22.3]];

/** A line of 5x7 glyphs on a vertical plane: origin o, along unit t (horizontal), normal n, pixel px. */
function lettering(acc: Acc, c: C, text: string, o: V3, t: P2, n: P2, px: number, off: number) {
  const at = (x: number, y: number): V3 => [o[0] + t[0] * x + n[0] * off, o[1] + y, o[2] + t[1] * x + n[1] * off];
  const out: V3 = [n[0], 0, n[1]];
  [...text].forEach((ch, i) => (GL[ch] ?? []).forEach((row, j) => {
    let k = 0;
    while (k < 5) {
      if (row[k] !== '1') { k++; continue; }
      let e = k; while (e < 5 && row[e] === '1') e++;
      const x0 = (i * 6 + k) * px, x1 = (i * 6 + e) * px, y1 = (6 - j) * px + px, y0 = y1 - px;
      quad(acc, c, at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1), out);
      k = e;
    }
  }));
}

/** A box on a plan quadrilateral (four corners counter-clockwise or clockwise), y0..y1, closed. */
function prism(acc: Acc, c: C, ring: P2[], y0: number, y1: number, cTop: C = c) {
  const cx = ring.reduce((s, p) => s + p[0] / ring.length, 0), cz = ring.reduce((s, p) => s + p[1] / ring.length, 0);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const out: V3 = [(a[0] + b[0]) / 2 - cx, 0, (a[1] + b[1]) / 2 - cz];
    quad(acc, c, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], out);
  }
  for (let i = 1; i + 1 < ring.length; i++) tri(acc, cTop, [ring[0][0], y1, ring[0][1]], [ring[i][0], y1, ring[i][1]], [ring[i + 1][0], y1, ring[i + 1][1]], [0, 1, 0]);
}

function lawn(acc: Acc) {
  // the grass: the BAG ring on the lawn plane
  const tris = T.ShapeUtils.triangulateShape(RING.map(([x, z]) => new T.Vector2(x, z)), []);
  for (const [i, j, k] of tris) tri(acc, 'green', ...([RING[i], RING[j], RING[k]].map(([x, z]) => [x, lawnY(x, z), z] as V3) as [V3, V3, V3]), [0, 1, 0]);
  // the south-east edge lies on the plaza: a granite kerb under the grass, from the south corner round to the north-east end
  const se = RING.slice(3).concat([RING[0], RING[1]]);
  for (let i = 0; i + 1 < se.length; i++) {
    const [a, b] = [se[i], se[i + 1]];
    const out: V3 = [b[1] - a[1], 0, -(b[0] - a[0])];   // the ring runs clockwise in (x, z) here: right-hand normal points out
    quad(acc, 'stone', [a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], lawnY(...b), b[1]], [a[0], lawnY(...a), a[1]], out);
  }
}

/** The two raised edges: copper fascia, soffit and the fronts under it, from the tip outwards. */
function edges(acc: Acc) {
  const nw: LawnEdgeZone[] = [
    {s0: 0, s1: 3.6, kind: 'wall', material: 'stone'},                       // the light granite corner pier
    {s0: 3.6, s1: 26.4, kind: 'glass', mullion: 1.9},                          // the supermarket front
    {s0: 26.4, s1: 29.4, kind: 'wall', material: 'dark'},
    {s0: 29.4, s1: 88.06, kind: 'wall', material: 'stone'},                    // the granite retaining wall
  ];
  const sw: LawnEdgeZone[] = [
    {s0: 0, s1: 3.6, kind: 'wall', material: 'stone'},
    {s0: 3.6, s1: 11.6, kind: 'glass', mullion: 1.9},                          // the second entrance
    {s0: 11.6, s1: 13.4, kind: 'wall', material: 'dark'},
    {s0: 13.4, s1: 19.6, kind: 'opening'},                                     // Q-Park garage entrance
    {s0: 19.6, s1: 32.7, kind: 'wall', material: 'stone'},
  ];
  for (const [b, zones, sign] of [[NE, nw, 1], [S, sw, -1]] as [P2, LawnEdgeZone[], number][]) {
    const e = slopedLawnEdge({a: TIP, b, heightAt: lawnY, zones, outSign: sign, fascia: 0.6, proud: 0.25, setback: 0.9, step: 2.0});
    for (const q of e.quads) quad(acc, q.material as C, q.pts[0], q.pts[1], q.pts[2], q.pts[3], q.out);
  }
  // lettering on the glass: "Albert Heijn" over "supermarkt" (blue, the brand's own lettering, 0.7 m capitals)
  for (const [b, s, sign] of [[NE, 16.2, 1], [S, 4.4, -1]] as [P2, number, number][]) {
    const L = Math.hypot(b[0] - TIP[0], b[1] - TIP[1]), t: P2 = [(b[0] - TIP[0]) / L, (b[1] - TIP[1]) / L];
    const n: P2 = [sign * t[1], -sign * t[0]];
    // the glass stands `setback` behind the edge line
    const o: V3 = [TIP[0] + t[0] * s - n[0] * 0.9, 4.1, TIP[1] + t[1] * s - n[1] * 0.9];
    // read left to right from outside: a viewer facing the north-west front has -t on the right, the south-west one +t
    const flip = sign > 0;
    const tt: P2 = flip ? [-t[0], -t[1]] : t, oo: V3 = flip ? [o[0] + t[0] * 7.0, o[1], o[2] + t[1] * 7.0] : o;
    lettering(acc, 'blue', 'ALBERT HEIJN', oo, tt, n, 0.095, 0.04);
    lettering(acc, 'blue', 'SUPERMARKT', [oo[0] + tt[0] * 1.4, 3.35, oo[2] + tt[1] * 1.4], tt, n, 0.06, 0.04);
  }
}

/** The garage stair kiosks on the plaza (BAG rings). */
function kiosks(acc: Acc) {
  // 0363100012225637: a mirrored steel cube, 4.8 m (3DBAG), its panels in a 4 x 4 grid
  const cube: P2[] = [[34.18, -39.914], [31.927, -41.57], [29.431, -38.157], [31.685, -36.502]];
  prism(acc, 'bronze', cube, 0, 4.8, 'dark');
  const cx = 31.81, cz = -39.04;
  for (let i = 0; i < 4; i++) {
    const a = cube[i], b = cube[(i + 1) % 4], out: P2 = [(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cz];
    const L = Math.hypot(out[0], out[1]), n: P2 = [out[0] / L, out[1] / L];
    for (const f of [0.25, 0.5, 0.75]) {
      // vertical and horizontal panel joints, 4 cm wide, 3.5 cm proud (closer z-fights with the steel at range)
      const p: P2 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], tl = Math.hypot(b[0] - a[0], b[1] - a[1]), t: P2 = [(b[0] - a[0]) / tl, (b[1] - a[1]) / tl];
      const at = (dt: number, y: number): V3 => [p[0] + t[0] * dt + n[0] * 0.035, y, p[1] + t[1] * dt + n[1] * 0.035];
      quad(acc, 'frame', at(-0.02, 0), at(0.02, 0), at(0.02, 4.8), at(-0.02, 4.8), [n[0], 0, n[1]]);
      const y = 4.8 * f, ap = (q: P2, dy: number): V3 => [q[0] + n[0] * 0.035, y + dy, q[1] + n[1] * 0.035];
      quad(acc, 'frame', ap(a, -0.02), ap(b, -0.02), ap(b, 0.02), ap(a, 0.02), [n[0], 0, n[1]]);
    }
  }
  // 0363100012225636: the black glass stair box with its glazed door (no 3DBAG roof; about 3 m on the panorama)
  const box: P2[] = [[46.8, -30.9], [46.5, -31.7], [41.2, -29.4], [41.7, -28.3], [43.5, -24.2], [48.8, -26.4], [48.1, -27.8]];
  prism(acc, 'dark', box, 0, 3.0);
  // the door on the face to the plaza (41.2,-29.4)-(41.7,-28.3)... the long south-west face (41.7,-28.3)-(43.5,-24.2)
  const a: P2 = [41.7, -28.3], b: P2 = [43.5, -24.2], L = Math.hypot(b[0] - a[0], b[1] - a[1]), t: P2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n: P2 = [-t[1], t[0]];
  const nOut: P2 = dot([n[0], 0, n[1]], [a[0] - 45, 0, a[1] + 28]) > 0 ? n : [-n[0], -n[1]];
  const at = (s: number, y: number): V3 => [a[0] + t[0] * s + nOut[0] * 0.035, y, a[1] + t[1] * s + nOut[1] * 0.035];
  quad(acc, 'glass', at(1.2, 0), at(3.0, 0), at(3.0, 2.4), at(1.2, 2.4), [nOut[0], 0, nOut[1]]);
}

export function buildAlbertHeijnMuseumplein(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  lawn(acc);
  edges(acc);
  kiosks(acc);
  acc.flush();
}
