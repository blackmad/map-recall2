import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, ringFrame, type Frame} from './nearbar-kit';
import {upwardRoofPlane} from './house-geometry';
import {raisedLettering} from './ornament-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import source from './marnixbad-footprints.json';

/**
 * Zwembad Het Marnix, Marnixplein 1 (BAG pand 0363100012169393, 2006, Mecanoo; Wikipedia nl "Marnixbad"): pools, sports hall,
 * wellness club and grand café on the site of the 1955 Marnixbad, between the Marnixstraat and the Singelgracht.
 * Native frame of scripts/landmarks/marnixbad-footprints.json (x east, z south, y up from the 3DBAG ground 0.62 m NAP).
 *
 * Three volumes, each from the 3DBAG LoD2.2 roof planes of the pand (clustered by height, edges snapped to the BAG ring):
 *  - BIG (ring 4-9, roof 14.4-14.8 m -> 14.6): pool + sports hall. Brick box on the Marnixstraat (w02-112) and the south (w04, w07),
 *    a silver ribbed-aluminium box on the Singelgracht (w03-292), white panels where it rises over the link (w09-23). The upper box
 *    oversails a glazed ground storey: 1.5 m on the canal (clear glass, the pool), 1.2 m on the Marnixstraat (frosted glass).
 *  - LINK (ring 3-4 and 9-15, roof 11.1-11.6 -> 11.3): glass hall between the two brick volumes, with a 5.2 m curved glass
 *    bulge (3DBAG plane at 5.2 m over the ring's arc 10-14) on the Marnixstraat side.
 *  - NORTH (ring 15-17, 0-2, roof 13.5-14.2 -> 14.0): brick box on the Marnixplein (w01-22) with a two-storey curtain wall.
 * Heights and openings read on the 50 px/m rectified panorama crops of scripts/landmarks/landmark-brief.ts (Gemeente Amsterdam,
 * CC BY 4.0) and Wikimedia Commons "Amsterdam - Het Marnix II.JPG" (Picasdre, CC BY 3.0); see marnixbad-inventory.json.
 */
type V2 = [number, number];
type C = 'bronze' | 'greyBrick' | 'stone' | 'brick' | 'white' | 'glass' | 'dark' | 'frame' | 'concrete' | 'slate' | 'canopyGlass' | 'gold' | 'pink' | 'blue' | 'green';
const R = (source as {facadeRing: number[][]}).facadeRing.map(p => [p[0], p[1]] as V2);

const H_BIG = 14.6, H_NORTH = 14.0, H_LINK = 11.3, H_BULGE = 5.2, SOFFIT = 5.0;

/** Polygon with edge i (i -> i+1) moved inward by off[i] metres; vertices are the intersections of neighbouring edge lines. */
function inset(poly: V2[], off: number[]): V2[] {
  const n = poly.length, lines = poly.map((a, i) => {
    const c = poly[(i + 1) % n], {f} = ringFrame(poly, i);
    return {p: [a[0] - f.n[0] * off[i], a[1] - f.n[1] * off[i]] as V2, d: [c[0] - a[0], c[1] - a[1]] as V2};
  });
  return poly.map((_, i) => meet(lines[(i + n - 1) % n], lines[i]));
}
function meet(l1: {p: V2; d: V2}, l2: {p: V2; d: V2}): V2 {
  const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
  if (Math.abs(den) < 0.01 * Math.hypot(...l1.d) * Math.hypot(...l2.d)) return l2.p; // (near-)collinear edges keep the shared vertex
  const s = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
  return [l1.p[0] + l1.d[0] * s, l1.p[1] + l1.d[1] * s];
}
const centroid = (p: V2[]): V2 => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
const along = (f: Frame, p: V2) => (p[0] - f.origin[0]) * f.tangent[0] + (p[1] - f.origin[1]) * f.tangent[1];

/** Collects triangles per colour and hands each colour to BuildingTools once. */
class Mesh {
  private tris = new Map<C, number[]>();
  quad(f: Frame, q: WallQuad, c: C, t0 = 0) {
    const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * (t + t0) + f.n[0] * o, y, f.origin[1] + f.tangent[1] * (t + t0) + f.n[1] * o]);
    const a = this.tris.get(c) ?? [];
    a.push(...w[0], ...w[1], ...w[2], ...w[0], ...w[2], ...w[3]);
    this.tris.set(c, a);
  }
  flush(b: BuildingTools) {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c);
    }
    this.tris.clear();
  }
}
type Cut = HoledOpening & {back: C; reveal?: C};

/**
 * Wall on polygon edge i from y0 to y1, optionally only the part t in [ta, tb] (metres from the viewer's left end), with
 * openings cut through it (t relative to the clipped part). Returns the frame of the clipped part.
 */
function wall(m: Mesh, poly: V2[], i: number, y0: number, y1: number, c: C, cuts: Cut[] = [], ta?: number, tb?: number, awayFrom?: V2): {f: Frame; len: number} {
  const {f, len} = awayFrom ? frameAway(poly[i], poly[(i + 1) % poly.length], awayFrom) : ringFrame(poly, i), a = ta ?? 0, z = tb ?? len;
  const g: Frame = {...f, origin: [f.origin[0] + f.tangent[0] * a, f.origin[1] + f.tangent[1] * a]};
  const hw = holedWall(z - a, y0, y1, cuts);
  for (const q of hw.face) m.quad(g, q, c);
  hw.reveals.forEach((qs, k) => qs.forEach(q => m.quad(g, q, cuts[k].reveal ?? c)));
  hw.backs.forEach((q, k) => m.quad(g, q, cuts[k].back));
  return {f: g, len: z - a};
}
/** Frame on a -> c whose outward normal points away from `away` (for slivers too thin for ringFrame's inside probe). */
function frameAway(a: V2, c: V2, away: V2): {f: Frame; len: number} {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len;
  let n: V2 = [-tz, tx];
  const mx = (a[0] + c[0]) / 2 - away[0], mz = (a[1] + c[1]) / 2 - away[1];
  if (n[0] * mx + n[1] * mz < 0) n = [tz, -tx];
  const tangent: V2 = [n[1], -n[0]], o = (c[0] - a[0]) * tangent[0] + (c[1] - a[1]) * tangent[1] > 0 ? a : c;
  return {f: {origin: o, tangent, n}, len};
}
/** Box on a wall frame: t centre, y bottom, from `o0` to `o1` out of the wall. */
function bar(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o0: number, o1: number, c: C) {
  put(b, f, new T.BoxGeometry(w, h, o1 - o0).translate(0, h / 2, (o1 - o0) / 2), t, y, o0, c);
}
/** Vertical mullions every `pitch` across [t0, t1] (none at the ends), and transoms at the given heights. */
function grid(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, pitch: number, transoms: number[], o0: number, o1: number, c: C = 'frame') {
  const n = Math.max(1, Math.round((t1 - t0) / pitch)), p = (t1 - t0) / n;
  // mullions stop 0.3 m under the top: the coping (and the soffit or roof over a recess) owns the wall head
  for (let k = 1; k < n; k++) bar(b, f, t0 + k * p, y0 + 0.02, 0.07, y1 - y0 - 0.32, o0, o1, c);
  for (const y of transoms) if (y > y0 && y < y1) bar(b, f, (t0 + t1) / 2, y - 0.04, t1 - t0, 0.08, o0, o1, c);
}
function roof(b: BuildingTools, poly: V2[], h: number, c: C) {
  b.add(upwardRoofPlane(new T.Shape(poly.map(p => new T.Vector2(p[0], p[1]))), h), c);
}
function soffit(b: BuildingTools, poly: V2[], h: number, c: C) {
  b.add(new T.ShapeGeometry(new T.Shape(poly.map(p => new T.Vector2(p[0], p[1])))).rotateX(Math.PI / 2).translate(0, h, 0), c);
}
/** Plant box on the roof: four walls and a lid, standing on `base`. */
function plantBox(b: BuildingTools, m: Mesh, poly: V2[], base: number, top: number) {
  poly.forEach((_, i) => wall(m, poly, i, base, top, 'concrete'));
  roof(b, poly, top, 'concrete');
}
/** Metal coping on every top edge of a polygon: 10 cm proud, 15 cm over the roof. */
function coping(b: BuildingTools, poly: V2[], h: number, skip: number[] = []) {
  poly.forEach((_, i) => {
    if (skip.includes(i)) return;
    const {f, len} = ringFrame(poly, i);
    bar(b, f, len / 2, h - 0.18, len + 0.2, 0.33, -0.3, 0.1, 'stone'); // top 15 cm over the roof, 30 cm deep: clear of the roof plane
  });
}

export function buildMarnixbad(_w: number, _d: number, b: BuildingTools) {
  const m = new Mesh();
  const BIG: V2[] = [R[4], R[5], R[6], R[7], R[8], R[9]];
  // edges: 0 north stub (w09), 1 Singelgracht (w03), 2 south (w04/w07), 3 Marnixstraat (w02), 4 north-east stub, 5 under the link
  const LOW = inset(BIG, [0, 1.5, 0, 1.2, 0, 0]); // edge 4 is collinear with edge 5 (one straight north side), so it stays put
  const LINK: V2[] = [R[3], R[4], R[9], R[10], R[14], R[15]];
  const BULGE: V2[] = [R[10], R[11], R[12], R[13], R[14]];
  const NORTH: V2[] = [R[1], R[2], R[15], R[16], R[17], R[0]];

  // ---- BIG: upper box over the soffit
  wall(m, BIG, 0, SOFFIT, H_BIG, 'white');
  const west = wall(m, BIG, 1, SOFFIT, H_BIG, 'concrete');
  aluminium(b, west.f, west.len);
  const south = wall(m, BIG, 2, SOFFIT, H_BIG, 'brick', [{t0: 19.7, t1: 34.9, y0: 5.9, y1: 8.5, depth: 0.3, back: 'dark'}]);
  for (let t = 20.2; t < 34.6; t += 0.5) bar(b, south.f, t, 5.92, 0.04, 2.56, -0.35, -0.15, 'frame'); // louvre blades in the dark band (w04)
  const east = wall(m, BIG, 3, SOFFIT, H_BIG, 'brick', [{t0: 1.35, t1: 29.6, y0: 6.0, y1: 8.4, depth: 0.3, back: 'glass', reveal: 'dark'}]);
  grid(b, east.f, 1.35, 29.6, 6.0, 8.7, 2.2, [], -0.35, -0.15, 'dark');
  logo(b, east.f);
  wall(m, BIG, 4, SOFFIT, H_BIG, 'brick');
  wall(m, BIG, 5, H_LINK, H_BIG, 'white'); // over the link roof (w09: white panels above the glass)
  soffit(b, BIG, SOFFIT, 'brick');
  roof(b, BIG, H_BIG, 'slate');
  coping(b, BIG, H_BIG);
  plantBox(b, m, [[-18.2, 8.0], [-17.4, 6.3], [-20.3, 5.9], [-19.6, 7.5]], H_BIG, 16.5);
  plantBox(b, m, [[-12.3, 13.2], [-13.6, 12.7], [-15.0, 17.3], [-13.7, 17.4]], H_BIG, 16.0);

  // ---- BIG: glazed ground storey under the soffit
  wall(m, LOW, 0, 0, SOFFIT, 'white');
  const pool = wall(m, LOW, 1, 0, SOFFIT, 'glass');
  grid(b, pool.f, 0, pool.len, 0, SOFFIT, 1.5, [4.75], -0.05, 0.1);
  const sLow = wall(m, LOW, 2, 0, SOFFIT, 'brick', [
    {t0: 0, t1: 11.5, y0: 0, y1: 4.5, depth: 0.3, back: 'glass'},
    {t0: 18.2, t1: 33.4, y0: 0, y1: 2.7, depth: 0.15, back: 'dark'},
  ]);
  grid(b, sLow.f, 0, 11.5, 0, 4.8, 1.3, [], -0.35, -0.15);
  const street = wall(m, LOW, 3, 0, SOFFIT, 'canopyGlass');
  grid(b, street.f, 0, street.len, 0, SOFFIT, 1.6, [], -0.05, 0.1);
  bar(b, street.f, street.len / 2, 0, street.len, 0.7, -0.05, 0.5, 'brick'); // low brick plinth of the ramp (w02 alt)
  const ne = wall(m, LOW, 4, 0, SOFFIT, 'canopyGlass');
  grid(b, ne.f, 0, ne.len, 0, SOFFIT, 1.6, [], -0.05, 0.1);

  // ---- LINK and its curved bulge
  const lw = wall(m, LINK, 0, 0, H_LINK, 'glass');
  grid(b, lw.f, 0, lw.len, 0, H_LINK, 2.5, [2.6, 3.95, 5.3, 6.65, 8.0, 9.35, 10.7], -0.05, 0.1);
  for (const i of [2, 4]) {
    const g = wall(m, LINK, i, 0, H_LINK, 'glass');
    grid(b, g.f, 0, g.len, 0, H_LINK, 1.7, [3.8, 7.6], -0.05, 0.1);
  }
  const chord = wall(m, LINK, 3, H_BULGE, H_LINK, 'glass');
  grid(b, chord.f, 0, chord.len, H_BULGE, H_LINK, 1.7, [7.6], -0.05, 0.1);
  roof(b, LINK, H_LINK, 'slate');
  coping(b, LINK, H_LINK, [1, 5]);
  for (let i = 0; i < 4; i++) {
    const g = wall(m, BULGE, i, 0, H_BULGE, 'glass', [], undefined, undefined, centroid(LINK));
    bar(b, g.f, 0.04, 0, 0.07, H_BULGE, -0.05, 0.1, 'frame');
  }
  roof(b, BULGE, H_BULGE, 'frame');

  // ---- NORTH
  wall(m, NORTH, 0, 0, H_NORTH, 'brick');
  {
    const {f} = ringFrame(NORTH, 1), tLink = along(f, R[3]), tEnd = along(f, R[15]);
    const [lo, hi] = tLink < tEnd ? [tLink, tEnd] : [tEnd, tLink];
    const {len} = ringFrame(NORTH, 1);
    // ring 2 -> 3 is a 1.33 m return beside the link (full height); along the link only the part over its roof shows
    if (lo > 0.05) wall(m, NORTH, 1, 0, H_NORTH, 'brick', [], 0, lo);
    if (hi < len - 0.05) wall(m, NORTH, 1, 0, H_NORTH, 'brick', [], hi, len);
    wall(m, NORTH, 1, H_LINK, H_NORTH, 'brick', [], lo, hi);
  }
  wall(m, NORTH, 2, 0, H_NORTH, 'brick');
  wall(m, NORTH, 3, 0, H_NORTH, 'brick', [{t0: 5.7, t1: 9.8, y0: 1.0, y1: 4.1, depth: 0.35, back: 'glass', reveal: 'white'}]);
  const front = wall(m, NORTH, 4, 0, H_NORTH, 'brick', [
    {t0: 0.8, t1: 4.0, y0: 0, y1: 3.6, depth: 2.5, back: 'dark'},
    {t0: 0.8, t1: 4.0, y0: 3.6, y1: 8.6, depth: 0.3, back: 'glass'},
    {t0: 4.0, t1: 30.9, y0: 0, y1: 8.6, depth: 0.3, back: 'glass'},
  ]);
  grid(b, front.f, 4.0, 30.9, 0, 8.9, 1.55, [4.7, 6.4], -0.35, -0.15);
  grid(b, front.f, 0.8, 4.0, 3.6, 8.9, 1.6, [4.7, 6.4], -0.35, -0.15);
  bar(b, front.f, 2.4, 0, 1.8, 2.4, -2.55, -2.4, 'glass'); // doors at the back of the recess
  wall(m, NORTH, 5, 0, H_NORTH, 'brick');
  roof(b, NORTH, H_NORTH, 'slate');
  coping(b, NORTH, H_NORTH);
  plantBox(b, m, [[6.6, -13.6], [5.6, -14.0], [4.0, -10.1], [5.6, -9.5]], H_NORTH, 15.6);

  terrace(b, m);
  m.flush(b);
}

/** Singelgracht box (w03-292): vertical ribs on 0.45 m and two horizontal joint strips at 8.2 and 11.4 m. */
function aluminium(b: BuildingTools, f: Frame, len: number) {
  for (let t = 0.3; t < len - 0.2; t += 0.45) bar(b, f, t, SOFFIT + 0.15, 0.05, H_BIG - SOFFIT - 0.45, -0.05, 0.1, 'concrete');
  for (const y of [SOFFIT, 8.2, 11.4]) bar(b, f, len / 2, y, len + 0.2, 0.12, -0.05, 0.14, 'frame');
}

/**
 * Logo on the Marnixstraat brick (w02-112 and its 2024 view; Commons "Amsterdam - Het Marnix II"): a ribbon wave in four
 * colours (orange, pink, blue, green) 24.6-30.0 m from the south end at 12.0-14.0 m, "hetmarnix" under it at 10.6-11.6 m.
 */
function logo(b: BuildingTools, f: Frame) {
  const x0 = 24.6, W = 5.4, y0 = 11.95, H = 2.0, th = 0.55; // ribbon about 0.55 m wide on the 2024 crop
  // centreline through the photo's turning points (fractions of the logo box): up the left leg, over the first crest, down to the trough, up to the second crest, out to the tail
  const pts = [[0.03, 0.0], [0.03, 0.55], [0.14, 0.93], [0.3, 0.78], [0.45, 0.35], [0.58, 0.18], [0.72, 0.5], [0.84, 0.88], [0.94, 0.8], [1.0, 0.62]];
  const curve = new T.CatmullRomCurve3(pts.map(([u, v]) => new T.Vector3(x0 + u * W, y0 + v * H, 0)), false, 'centripetal');
  const segs: [number, number, C][] = [[0, 0.32, 'gold'], [0.32, 0.55, 'pink'], [0.55, 0.84, 'blue'], [0.84, 1, 'green']];
  for (const [a, z, c] of segs) {
    const n = 14, left: T.Vector2[] = [], right: T.Vector2[] = [];
    for (let k = 0; k <= n; k++) {
      const u = a + (z - a) * k / n, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      left.push(new T.Vector2(p.x - tg.y * th / 2, p.y + tg.x * th / 2));
      right.push(new T.Vector2(p.x + tg.y * th / 2, p.y - tg.x * th / 2));
    }
    const shape = new T.Shape([...left, ...right.reverse()]);
    const g = new T.ExtrudeGeometry(shape, {depth: 0.4, bevelEnabled: false, curveSegments: 1});
    put(b, f, g.translate(0, 0, 0), 0, 0, -0.3, c); // 0.3 m sunk into the brick, 8 cm proud
  }
  const het = raisedLettering({text: 'HET', heightM: 0.9, maxWidthM: 1.6, depthM: 0.1});
  put(b, f, het.geometry, x0 + 0.8, 11.1, 0.0, 'gold');
  const marnix = raisedLettering({text: 'MARNIX', heightM: 0.9, maxWidthM: 3.4, depthM: 0.1});
  put(b, f, marnix.geometry, x0 + 3.45, 11.1, 0.0, 'bronze'); // anthracite letters; not 'dark', which counts as an opening
}

/**
 * Canal terrace (w06-292, w08-292, w09-23): a dark brick platform about 1.0 m above the quay in front of the north block and the
 * link, outside the BAG ring, 1.6 m deep in front of the north block, ending against the big block's north stub, with a steel
 * railing on its edge.
 */
function terrace(b: BuildingTools, m: Mesh) {
  const {f: f1} = ringFrame([R[1], R[2], R[15], R[16], R[17], R[0]], 0);
  const D = 1.6, TOP = 1.0;
  const out = (p: V2): V2 => [p[0] + f1.n[0] * D, p[1] + f1.n[1] * D];
  const a = out(R[1]), z = meet({p: a, d: [R[2][0] - R[1][0], R[2][1] - R[1][1]]}, {p: R[4], d: [R[5][0] - R[4][0], R[5][1] - R[4][1]]});
  const T0: V2[] = [R[1], a, z, R[4], R[3], R[2]];
  for (const i of [0, 1]) wall(m, T0, i, 0, TOP, 'greyBrick'); // edge 2 stands against the big block's stub, 3-5 against the building
  roof(b, T0, TOP, 'greyBrick');
  const {f, len} = ringFrame(T0, 1);
  for (let t = 0.05; t <= len; t += 1.5) bar(b, f, t, TOP, 0.05, 1.0, -0.12, -0.07, 'frame');
  for (const y of [TOP + 0.5, TOP + 0.95]) bar(b, f, len / 2, y, len, 0.05, -0.12, -0.07, 'frame');
}
