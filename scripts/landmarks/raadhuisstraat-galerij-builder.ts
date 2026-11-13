import * as T from 'three';
import polygonClipping from 'polygon-clipping';
import type {BuildingTools} from './cultural-builders';
import {frame} from './church-kit';
import {archBand, archSlab, ledgeStrip, poly, put, segBand, setSink, slab, letters, type Frame} from './nearbar-kit';
import {roofPrism} from './roof-prism-kit';
import {sweepProfile, type ProfilePoint} from '../../src/canalRecall/landmarks/curvedFront';
import {CUT_CORNER, front} from './raadhuisstraat-galerij-curve';
import source from './raadhuisstraat-galerij-footprints.json' with {type: 'json'};

/**
 * Winkelgalerij Raadhuisstraat, Raadhuisstraat 23-55 / Herengracht 194 / Keizersgracht 197-201 (Rijksmonument 46505;
 * A.L. van Gendt for the Levensverzekering-Maatschappij "Utrecht", completed 1898 according to the two memorial stones;
 * nl.wikipedia credits his sons and gives 1899). 13 BAG pands, bouwjaar 1896/1898 (raadhuisstraat-galerij-footprints.json).
 *
 * Register text (RCE 46505, CC0), in short: a curved row of shop houses of four storeys with a gallery built out over
 * the pavement at ground floor and entresol, brick with natural-stone dressings, under a slate "afgeplat schilddak" laid
 * along the curved building line; the houses end alternately in pointed gables with cross roofs, low brick balustrades
 * with arched openings, and loggias of three arches on small columns, each crowned by stone fabulous beasts. The gallery
 * has stone clustered piers with cube capitals in seventeen bays, iron arches with wrought ironwork on the street side
 * carrying a glass lean-to roof; a stone gate with a balcony at the middle bay (nr 37); dragons and shields over the
 * entrances at both short ends. The corner houses have no gallery: nr 21 / Herengracht 194 has gables on both fronts
 * and winged beasts with a shield on the cut corner; nr 55 / Keizersgracht 197 has a rounded corner under a round tower
 * with a slate spire and a weather vane, and a carved cock beside its Keizersgracht gable.
 *
 * Everything below is read from the rectified Gemeente Amsterdam panorama strip (CC BY 4.0,
 * scripts/landmarks/raadhuisstraat-galerij-strip.ts: one crop per BAG chord, 30 px/m) and AHN4 DSM sections across the
 * gallery (PDOK, CC0): the gallery deck at 7.6 m reaches 1.6 m out, the glass roof falls to 6.2 m at 3.5 m out and the
 * pavement starts 3.6 m from the BAG line. House types per chord (c00 at the tower .. c18 at the Herengracht):
 *   c00 corner 55 (tower) | c01 serre (53) | c02 L | c03 B | c04 G | c05 L | c06 G | c07 B | c08 L | c09 centre gate (37)
 *   c10 L | c11 B | c12 G | c13 L | c14 G | c15 B | c16 L (23) | c17 serre, c18 gable + cut corner (21)
 *   (L loggia, B balustrade, G pointed gable with a timber oriel).
 *
 * Native frame (x east, z south, y up from the mean 3DBAG ground 1.397 m NAP), anchor = the union ring's vertex average.
 * The street front is one smooth curve (src/canalRecall/landmarks/curvedFront.ts) through the BAG chord junctions; every
 * horizontal member along it (cornices, the gallery deck, rails and glass roof, the mansard) is swept along the curve.
 */
type C = 'brick' | 'red' | 'stone' | 'white' | 'frame' | 'glass' | 'dark' | 'slate' | 'green' | 'canopyGlass' | 'bronze' | 'gold' | 'concrete';
type XZ = [number, number];
const SRC = source as unknown as {
  nativeRing: XZ[]; pandNative: Record<string, XZ[]>; roofs: Record<string, number[][][]>;
  neighbours: {id: string; height: number; ring: XZ[]}[];
};

// ---- measured constants (strip crops at 30 px/m; heights above the pavement) -----------------------------------------
const BASE = -0.5;           // walls start below the datum: the pavement falls 0.33 m to nr 43-45
const SHOP_TOP = 4.3;        // shopfront head
const ENT = [4.75, 6.5];     // entresol windows inside the gallery
const DECK = 7.6, DECK_OUT = 1.65;   // gallery deck (balcony floor) and its reach (AHN 7.5 m at 0.5-1.5 m out)
const ROOF_LOW = 6.2, GAL_OUT = 3.55;  // glass roof's outer edge (AHN) and the gallery's street line
const PIER_OUT = 3.25;       // pier centre line
const F1 = [8.35, 10.85];    // first-floor French windows (round heads)
const F2 = [11.65, 14.15];   // second-floor T-windows
const BELT = 15.0;           // stone band under the attic storey
const TOP = 17.45;           // flat roof (3DBAG 17.2-17.7) and the loggia/serre attic line
const MANS = {o0: -0.35, y0: 15.2, o1: -3.0}; // slate mansard behind the attic elements
const SEG = 1.5;             // sweep station spacing (sagitta under 5 mm on the ~60 m radius)

const F = front();
/** The builder's shared triangle sink (set by buildRaadhuisstraatGalerij). */
let M: Mesh;
const J = F.junctionS;
const near = (s: number) => J.reduce((b, x) => (Math.abs(x - s) < Math.abs(b - s) ? x : b), J[0]);
/** Chord boundaries in arc length (strip chords c00..c18). */
/** House and bay boundaries on the BAG line (native x, z): the party-wall junctions read from the rectified strip. */
const CH_XZ: XZ[] = [[-55.842, -42.864], [-48.785, -40.223], [-43.538, -37.097], [-38.743, -33.338], [-34.323, -29.221], [-29.852, -25.078], [-25.483, -20.925], [-21.037, -16.77], [-16.642, -12.644], [-12.186, -8.524], [-6.142, -3.431], [-1.306, 0.073], [3.828, 3.309], [9.165, 6.129], [14.681, 8.696], [20.451, 10.826], [26.145, 12.569], [30.504, 13.799], [38.115, 15.024], [41.931, 15.909]];
const CH = CH_XZ.map((p, i) => (i === 0 ? 0 : near(F.project(p))));
const END = F.length;
type Kind = 'corner55' | 'serre' | 'L' | 'B' | 'G' | 'centre' | 'serre21' | 'gable21';
const KINDS: Kind[] = ['corner55', 'serre', 'L', 'B', 'G', 'L', 'G', 'B', 'L', 'centre', 'L', 'B', 'G', 'L', 'G', 'B', 'L', 'serre21', 'gable21'];
const GAL0 = CH[1], GAL1 = CH[18];        // the gallery runs from the 53/55 party wall to the 21 gable bay
const PIERS = [...CH.slice(1, 18), (CH[17] + CH[18]) / 2 + 0.6, CH[18]].filter((s, i, a) => i === 0 || s - a[i - 1] > 1);

/** Frame on the curve at s, `o` out from the BAG line (church-kit convention: tangent = viewer's right). */
const fr = (s: number, o = 0): Frame => { const a = F.at(s); return frame([a.p[0] + a.n[0] * o, a.p[1] + a.n[1] * o], a.n); };

class Mesh {
  tris = new Map<C, number[]>();
  push(c: C, pos: number[]) { const a = this.tris.get(c) ?? []; for (const v of pos) a.push(v); this.tris.set(c, a); }
  /** Quad a-b-c-d facing `want` (flipped if needed). */
  quad(c: C, a: number[], b: number[], d: number[], e: number[], want: number[]) { this.tri(c, a, b, d, want); this.tri(c, a, d, e, want); }
  tri(c: C, a: number[], b: number[], d: number[], want: number[]) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...n) < 1e-9) return;
    this.push(c, n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0 ? [...a, ...b, ...d] : [...a, ...d, ...b]);
  }
  flush(b: BuildingTools) {
    for (const [c, pos] of this.tris) {
      if (!pos.length) continue;
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      b.add(g, c as never);
    }
    this.tris.clear();
  }
}

/** Swept profile along the curve, s0..s1. */
function sweep(m: Mesh, c: C, s0: number, s1: number, prof: ProfilePoint[], o: {closed?: boolean; caps?: boolean; step?: number} = {}) {
  if (s1 - s0 < 1e-3) return;
  m.push(c, sweepProfile(F, s0, s1, prof, {maxStep: o.step ?? SEG, closed: o.closed ?? true, caps: o.caps ?? true}));
}
/** Vertical ribbon on the curve at offset o from y0 to top(s), facing out (or in with `inward`). */
function ribbon(m: Mesh, c: C, s0: number, s1: number, o: number, y0: number, top: (s: number) => number, breaks: number[] = [], inward = false) {
  const st = F.stations(s0, s1, SEG, breaks);
  for (let i = 0; i + 1 < st.length; i++) {
    const a = F.at(st[i]), b = F.at(st[i + 1]);
    const pa = [a.p[0] + a.n[0] * o, a.p[1] + a.n[1] * o], pb = [b.p[0] + b.n[0] * o, b.p[1] + b.n[1] * o];
    const ya = top(st[i]), yb = top(st[i + 1]);
    const want = [(a.n[0] + b.n[0]) * (inward ? -1 : 1), 0, (a.n[1] + b.n[1]) * (inward ? -1 : 1)];
    m.quad(c, [pa[0], y0, pa[1]], [pb[0], y0, pb[1]], [pb[0], yb, pb[1]], [pa[0], ya, pa[1]], want);
  }
}

/** Wall-mounted relief from an outline in (x, y) around (t, y): front face at out + d and the side walls, no back face
 * (the back sits 4 cm inside the wall). `pts` counter-clockwise or clockwise; flat convex or concave outlines. */
function relief(m: Mesh, f: Frame, t: number, y: number, pts: [number, number][], d: number, c: C, out = 0) {
  const W = (x: number, yy: number, o: number) => [f.origin[0] + f.tangent[0] * (t + x) + f.n[0] * o, y + yy, f.origin[1] + f.tangent[1] * (t + x) + f.n[1] * o];
  const nO = [f.n[0], 0, f.n[1]], front = out + d, back = out - 0.04;
  for (const [i, j, k] of T.ShapeUtils.triangulateShape(pts.map(p => new T.Vector2(p[0], p[1])), [])) m.tri(c, W(pts[i][0], pts[i][1], front), W(pts[j][0], pts[j][1], front), W(pts[k][0], pts[k][1], front), nO);
  const cw = T.ShapeUtils.isClockWise(pts.map(p => new T.Vector2(p[0], p[1])));
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1];
    // outward in (x, y): right of travel for a counter-clockwise outline
    const ox = cw ? -dy : dy, oy = cw ? dx : -dx;
    const want = [f.tangent[0] * ox, oy, f.tangent[1] * ox];
    m.quad(c, W(a[0], a[1], back), W(b[0], b[1], back), W(b[0], b[1], front), W(a[0], a[1], front), want);
  }
}
const arcPts = (cx: number, cy: number, r: number, a0: number, a1: number, n: number) => Array.from({length: n + 1}, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number]; });
/** Round-headed panel w x h (bottom at 0) as an outline. */
const archOutline = (w: number, h: number, n = 4): [number, number][] => [[-w / 2, 0], [w / 2, 0], ...arcPts(0, h - w / 2, w / 2, 0, Math.PI, n)];
/** Round arch ring of thickness th, open at the bottom, outer width w, height h. */
const ringOutline = (w: number, h: number, th: number, n = 4): [number, number][] => {
  const r = w / 2, ri = r - th, yc = h - r;
  return [[-r, yc], ...arcPts(0, yc, ri, Math.PI, 0, n).map(p => p), [r, yc], ...arcPts(0, yc, r, 0, Math.PI, n)].map(p => p as [number, number]).filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 1e-6);
};

// ---- small parts ------------------------------------------------------------------------------------------------------
/** Window with a white frame, glass, glazing bars and a stone sill; round or flat head; red/white brick arch over a round head. */
function window(b: BuildingTools, s: number, y0: number, y1: number, w: number, o: {head?: 'round' | 'flat'; bars?: number; transom?: number; arch?: boolean; sill?: boolean; out?: number} = {}) {
  const f = fr(s, o.out ?? 0), h = y1 - y0, head = o.head ?? 'flat';
  if (head === 'round') {
    relief(M, f, 0, y0 - 0.04, archOutline(w + 0.18, h + 0.1), 0.08, 'frame');
    relief(M, f, 0, y0, archOutline(w, h), 0.13, 'glass');
    if (o.arch ?? true) {
      relief(M, f, 0, y0 - 0.04, ringOutline(w + 0.62, h + 0.32, 0.24), 0.1, 'red');
      ledgeStrip(b, f, 0, y1 + 0.02, 0.26, 0.3, 0.14, 'stone');
    }
  } else {
    slab(b, f, 0, y0 - 0.04, w + 0.18, h + 0.08, 0.08, 'frame');
    slab(b, f, 0, y0, w, h, 0.13, 'glass');
  }
  const rect = head === 'round' ? h - w / 2 : h;
  for (let k = 1; k <= (o.bars ?? 1); k++) ledgeStrip(b, f, -w / 2 + w * k / ((o.bars ?? 1) + 1), y0, 0.05, rect, 0.18, 'frame');
  if (o.transom) ledgeStrip(b, f, 0, y0 + o.transom, w, 0.06, 0.18, 'frame');
  if (o.sill ?? true) ledgeStrip(b, f, 0, y0 - 0.14, w + 0.3, 0.1, 0.2, 'stone');
}
/** A seated fabulous beast (griffin) as two crossed stone silhouettes, ~1.1 m tall, standing at (s, o, y). */
const BEAST: [number, number][] = [[-0.32, 0], [0.32, 0], [0.3, 0.25], [0.18, 0.42], [0.26, 0.72], [0.42, 0.86], [0.36, 0.98], [0.2, 0.94], [0.1, 1.1], [-0.02, 0.96], [-0.1, 0.7], [-0.36, 0.86], [-0.28, 0.5], [-0.34, 0.2]];
function beast(b: BuildingTools, s: number, o: number, y: number, scale = 1) { beastAt(b, fr(s, o), y, scale); }
function beastAt(b: BuildingTools, f: Frame, y: number, scale = 1) {
  const pts = BEAST.map(([x, yy]) => [x * scale, yy * scale] as [number, number]);
  poly(b, f, 0, y, pts, 0.32 * scale, 'stone', -0.16 * scale);
  // the crossing silhouette, turned a quarter, so the beast has body from the side too
  const g = new T.ExtrudeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0] * 0.8, p[1]))), {depth: 0.26 * scale, bevelEnabled: false});
  g.translate(0, 0, -0.13 * scale); g.rotateY(Math.PI / 2);
  put(b, f, g, 0, y, 0, 'stone');
}
/** Pilaster between houses: brick pier with stone blocks and a stone cap, `out` proud of the front. */
function pilaster(b: BuildingTools, s: number, y0: number, y1: number, cap = true) {
  const f = fr(s);
  // fixed back planes 15 / 9 cm inside the wall (not the staggered sink): shaft and cap must never share one
  put(b, f, new T.BoxGeometry(0.5, y1 - y0, 0.35).translate(0, (y1 - y0) / 2, 0.175), 0, y0, -0.15, 'brick');
  for (let y = y0 + 0.6; y < y1 - 0.4; y += 1.25) ledgeStrip(b, f, 0, y, 0.56, 0.24, 0.24, 'stone');
  if (cap) put(b, f, new T.BoxGeometry(0.62, 0.22, 0.39).translate(0, 0.11, 0.195), 0, y1, -0.09, 'stone');
}

// ---- massing -----------------------------------------------------------------------------------------------------------
type Poly = [number, number][][];
const ringPoly = (r: XZ[]): Poly => [[...r, r[0]].map(p => [p[0], p[1]] as [number, number])];
/** Band of the front: from MANS.o1 inside the BAG line out to the street, extended past both ends along the tangent. */
function frontBand(): Poly {
  const st = F.stations(0, END, 1);
  const outer = st.map(s => { const a = F.at(s); return [a.p[0] + a.n[0] * 8, a.p[1] + a.n[1] * 8] as [number, number]; });
  const inner = st.map(s => { const a = F.at(s); return [a.p[0] + a.n[0] * MANS.o1, a.p[1] + a.n[1] * MANS.o1] as [number, number]; }).reverse();
  return [[...outer, ...inner, outer[0]]];
}
const KEIZERS = ['0363100012172351', '0363100012172350', '0363100012172312'];
const LOW = 8; // roof pieces under this are rear annexes

function inside(p: number[], r: number[][]) {
  let c = false;
  for (let i = 0, k = r.length - 1; i < r.length; k = i++) if ((r[i][1] > p[1]) !== (r[k][1] > p[1]) && p[0] < (r[k][0] - r[i][0]) * (p[1] - r[i][1]) / (r[k][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
}

/** Least-squares plane y = ax + bz + c through a roof piece's vertices (pieces are planar in 3DBAG LoD2.2). */
function fitPlane(r: number[][]): (x: number, z: number) => number {
  const n = r.length, mx = r.reduce((s, p) => s + p[0], 0) / n, mz = r.reduce((s, p) => s + p[2], 0) / n, my = r.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxz = 0, szz = 0, sxy = 0, szy = 0;
  for (const [x, y, z] of r) { const dx = x - mx, dz = z - mz, dy = y - my; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; sxy += dx * dy; szy += dz * dy; }
  const det = sxx * szz - sxz * sxz;
  const a = Math.abs(det) < 1e-9 ? 0 : (sxy * szz - szy * sxz) / det, c = Math.abs(det) < 1e-9 ? 0 : (szy * sxx - sxy * sxz) / det;
  return (x, z) => my + a * (x - mx) + c * (z - mz);
}
function massing(b: BuildingTools, m: Mesh) {
  const annexes: number[][][] = [], kgPieces: number[][][] = [];
  for (const [id, roofs] of Object.entries(SRC.roofs)) for (const r of roofs) {
    const ys = r.map(p => p[1]);
    if (Math.max(...ys) < LOW) annexes.push(r);
    else if (KEIZERS.includes(id)) kgPieces.push(r);
  }
  // rear annexes and the three Keizersgracht houses: a closed prism under each 3DBAG LoD2.2 roof piece (CC BY 4.0)
  // each piece clipped to the BAG union first: 3DBAG pieces overhang the BAG line by up to 0.3 m into Keizersgracht 195
  const own = polygonClipping.union(...Object.values(SRC.pandNative).map(r => ringPoly(r)));
  for (const r of [...annexes, ...kgPieces]) {
    const ys = r.map(p => p[1]), plane = fitPlane(r);
    for (const pg of polygonClipping.intersection(ringPoly(r.map(p => [p[0], p[2]] as XZ)), own)) {
      const ring = pg[0].slice(0, -1);
      if (ring.length < 3) continue;
      roofPrism(b, [ring.map(([x, z]) => [x, Math.max(plane(x, z), 0.5), z])], 'brick', Math.max(...ys) - Math.min(...ys) > 0.6 ? 'slate' : 'concrete');
    }
  }
  // the main range: union of the other ten pands minus the annexes and the front band, flat at TOP
  const mainIds = Object.keys(SRC.pandNative).filter(id => !KEIZERS.includes(id));
  let body = polygonClipping.union(...mainIds.map(id => ringPoly(SRC.pandNative[id])));
  const annexPolys = annexes.map(r => ringPoly(r.map(p => [p[0], p[2]] as XZ)));
  if (annexPolys.length) body = polygonClipping.difference(body, ...annexPolys);
  body = polygonClipping.difference(body, frontBand());
  const others: {ring: number[][]; h: number}[] = [
    ...annexes.map(r => ({ring: r.map(p => [p[0], p[2]]), h: Math.max(...r.map(p => p[1]))})),
    ...kgPieces.map(r => ({ring: r.map(p => [p[0], p[2]]), h: Math.min(...r.map(p => p[1]))})),
  ];
  const band = frontBand()[0];
  for (const pg of body) {
    const outer = pg[0].slice(0, -1);
    if (outer.length < 3) continue;
    // walls: everywhere but against the front band or an own piece (party walls stay: a lower or later neighbour must not open a hole)
    for (const ring of pg) {
      const r = ring.slice(0, -1), sgn = Math.sign(r.reduce((a, p, i) => { const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0));
      for (let i = 0; i < r.length; i++) {
        const p = r[i], q = r[(i + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (L < 1e-3) continue;
        const isHole = ring !== pg[0];
        const nx = (q[1] - p[1]) / L * sgn * (isHole ? -1 : 1), nz = -(q[0] - p[0]) / L * sgn * (isHole ? -1 : 1);
        // outward normal: right of travel for a counter-clockwise ring in (x, z)... checked by a probe below
        let ox = nx, oz = nz;
        const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        if (inside([mid[0] + ox * 0.05, mid[1] + oz * 0.05], outer) && !isHole) { ox = -ox; oz = -oz; }
        const probe = [mid[0] + ox * 0.3, mid[1] + oz * 0.3];
        if (inside(probe, band)) continue;
        let foot = BASE;
        for (const o of others) if (inside(probe, o.ring)) foot = Math.max(foot, o.h);
        if (foot >= TOP - 0.05) continue;
        m.quad('brick', [p[0], foot, p[1]], [q[0], foot, q[1]], [q[0], TOP, q[1]], [p[0], TOP, p[1]], [ox, 0, oz]);
      }
    }
    const flat = T.ShapeUtils.triangulateShape(outer.map(p => new T.Vector2(p[0], p[1])), pg.slice(1).map(h => h.slice(0, -1).map(p => new T.Vector2(p[0], p[1]))));
    const all = [outer, ...pg.slice(1).map(h => h.slice(0, -1))].flat();
    for (const [i, j, k] of flat) m.tri('slate', [all[i][0], TOP, all[i][1]], [all[j][0], TOP, all[j][1]], [all[k][0], TOP, all[k][1]], [0, 1, 0]);
  }
  // mansard behind the attic: slate slope from the attic foot back to the flat roof, swept along the curve
  sweep(m, 'slate', 0, END, [[MANS.o0, MANS.y0], [MANS.o1, MANS.y0], [MANS.o1, TOP], [MANS.o0 - 0.02, MANS.y0 + 0.02]], {closed: true});
  // the front wall itself, the BAG line, from the foot to the belt; attic walls per house type follow
  ribbon(m, 'brick', 0, END, 0, BASE, () => BELT + 0.3, J);
  // the strip between the front wall and the mansard foot is closed by the attic walls; under the belt, a floor-to-mansard filler
  sweep(m, 'brick', 0, END, [[0, BELT + 0.3], [MANS.o0, BELT + 0.3], [MANS.o0, MANS.y0], [0, MANS.y0]], {closed: true});
}

// ---- gallery ------------------------------------------------------------------------------------------------------------
function gallery(b: BuildingTools, m: Mesh) {
  const centre = [CH[9], CH[10]];
  // the runs end halfway into the 0.6 m end walls, so their end caps are buried, not coplanar with the walls' faces
  const runs: [number, number][] = [[GAL0 + 0.3, centre[0]], [centre[1], GAL1 - 0.3]];
  for (const [s0, s1] of runs) {
    // deck: masonry vault top with a stone edge; the balcony floor of the houses above
    sweep(m, 'stone', s0, s1, [[0, DECK - 0.35], [DECK_OUT, DECK - 0.35], [DECK_OUT, DECK], [0, DECK]]);
    // glass lean-to roof from under the deck edge to the street line
    sweep(m, 'canopyGlass', s0, s1, [[DECK_OUT - 0.05, DECK - 0.38], [GAL_OUT, ROOF_LOW], [GAL_OUT, ROOF_LOW - 0.06], [DECK_OUT - 0.05, DECK - 0.44]]);
    // iron frieze along the street line under the roof edge, and the gutter
    sweep(m, 'green', s0, s1, [[GAL_OUT - 0.12, ROOF_LOW - 0.5], [GAL_OUT, ROOF_LOW - 0.5], [GAL_OUT, ROOF_LOW + 0.04], [GAL_OUT - 0.12, ROOF_LOW + 0.04]]);
    // balcony railing on the deck: top and bottom rails, balusters every 0.45 m
    sweep(m, 'green', s0, s1, [[DECK_OUT - 0.12, DECK + 0.98], [DECK_OUT - 0.04, DECK + 0.98], [DECK_OUT - 0.04, DECK + 1.06], [DECK_OUT - 0.12, DECK + 1.06]]);
    sweep(m, 'green', s0, s1, [[DECK_OUT - 0.12, DECK + 0.06], [DECK_OUT - 0.04, DECK + 0.06], [DECK_OUT - 0.04, DECK + 0.16], [DECK_OUT - 0.12, DECK + 0.16]]);
    for (let s = s0 + 0.25; s < s1 - 0.2; s += 0.45) {
      const a = F.at(s - 0.02), c = F.at(s + 0.02), o = DECK_OUT - 0.08;
      m.quad('green', [a.p[0] + a.n[0] * o, DECK + 0.16, a.p[1] + a.n[1] * o], [c.p[0] + c.n[0] * o, DECK + 0.16, c.p[1] + c.n[1] * o], [c.p[0] + c.n[0] * o, DECK + 0.98, c.p[1] + c.n[1] * o], [a.p[0] + a.n[0] * o, DECK + 0.98, a.p[1] + a.n[1] * o], [a.n[0], 0, a.n[1]]);
    }
    // ceiling under the glass: the underside is the roof sheet itself; the vault soffit under the deck
  }
  // piers: stone clustered piers on plinths with cube capitals; transverse brick arches back to the front; iron arches between
  for (const s of PIERS) {
    if (s === GAL0 || s === GAL1) continue; // the end walls stand on the end piers' lines
    const f = fr(s, PIER_OUT - 0.3);
    // clustered pier: a core 0.8 m deep (the photos show it deeper than wide) with two engaged shafts on the street face
    slab(b, f, 0, BASE, 0.75, 0.9 - BASE, 1.1, 'stone', -0.5);
    slab(b, f, 0, 0.4, 0.5, 5.1, 0.97, 'stone', -0.42);
    for (const sd of [-1, 1]) slab(b, f, sd * 0.29, 0.4, 0.12, 5.1, 0.3, 'stone', 0.15);
    slab(b, f, 0, 5.5, 0.74, 0.5, 1.08, 'stone', -0.37);
    // transverse arch (schoorboog): brick with stone blocks from the capital back to the front wall
    slab(b, fr(s, 0), 0, 5.6, 0.36, 0.55, PIER_OUT - 0.2, 'brick', -0.02);
  }
  for (let i = 0; i + 1 < PIERS.length; i++) {
    const s0 = PIERS[i], s1 = PIERS[i + 1];
    if (s0 >= CH[9] - 0.01 && s1 <= CH[10] + 0.01) continue; // the stone gate
    // the end bays stop 0.35 m short of the end walls (0.6 m thick on the end-pier line)
    const a0 = s0 === GAL0 ? s0 + 0.35 : s0, a1 = s1 === GAL1 ? s1 - 0.35 : s1;
    const sm = (a0 + a1) / 2, W = a1 - a0 - 0.75;
    const f = fr(sm, GAL_OUT - 0.1);
    segBand(b, f, 0, 4.7, W, 0.85, 0.14, 0.06, 'green');
    // wrought-iron spandrels between the arch and the frieze
    const R = (W * W / 4 + 0.85 * 0.85) / (2 * 0.85), arc: [number, number][] = [];
    for (let i = 0; i <= 12; i++) { const x = -W / 2 + W * i / 12; arc.push([x, 0.85 - R + Math.sqrt(R * R - x * x)]); }
    poly(b, f, 0, 4.7, [...arc, [W / 2, 1.0], [-W / 2, 1.0]], 0.03, 'green', 0.02);
  }
  // shopfronts under the gallery, entresol windows over them
  for (let k = 1; k < 18; k++) {
    const s0 = CH[k], s1 = CH[k + 1];
    if (k === 9) continue;
    const sm = (s0 + s1) / 2, W = s1 - s0 - 0.7, f = fr(sm);
    slab(b, f, 0, BASE, W + 0.1, 0.9 - BASE, 0.2, 'stone');
    // bronze frame and three lights, each light with its own frame piece on its own chord (one straight 5 m frame on the curve
    // drifts 6 cm against the lights at its ends); the low-s end piece frames the door
    const gl = (W - 1.5) / 3, g0 = sm + 0.3 - (W - 1.5) / 2, g1 = g0 + 3 * gl;
    slab(b, fr((sm - W / 2 + g0) / 2), 0, 0.4, g0 - (sm - W / 2), SHOP_TOP - 0.4, 0.08, 'bronze');
    slab(b, fr((g1 + sm + W / 2) / 2), 0, 0.4, sm + W / 2 - g1, SHOP_TOP - 0.4, 0.08, 'bronze');
    for (let i = 0; i < 3; i++) {
      const fi = fr(g0 + gl * (i + 0.5));
      slab(b, fi, 0, 0.4, gl, SHOP_TOP - 0.4, 0.08, 'bronze');
      slab(b, fi, 0, 0.95, gl - 0.1, SHOP_TOP - 1.35, 0.13, 'glass');
    }
    slab(b, fr(sm - W / 2 + 0.55), 0, 0.9, 0.9, 2.0, 0.14, 'dark'); // the door over the stone step, on the end frame piece's chord
    const away = k === 8 ? -0.3 : k === 10 ? 0.3 : 0; // nudged off the gate's walls (they cut the wall plane beside them)
    for (const t0 of [-W / 3, 0, W / 3]) { const t = t0 + away; slab(b, fr(sm + t), 0, ENT[0], W / 3.6, ENT[1] - ENT[0], 0.08, 'frame'); slab(b, fr(sm + t), 0, ENT[0] + 0.06, W / 3.6 - 0.14, ENT[1] - ENT[0] - 0.12, 0.13, 'glass'); }
  }
  // the gallery's short ends: brick end walls across the pavement with an arched passage, a stone gable with the
  // gilded memorial stone, a shield and a dragon on top (register; Commons RCE 20020324 shows the Herengracht end)
  for (const [s, dir] of [[GAL0, -1], [GAL1, 1]] as [number, number][]) {
    // 8 cm past the street line, so the gallery's frieze and roof edge butt into it instead of sharing its face
    const a = F.at(s), mid = [a.p[0] + a.n[0] * (GAL_OUT + 0.08) / 2, a.p[1] + a.n[1] * (GAL_OUT + 0.08) / 2];
    const n: XZ = [a.t[0] * dir, a.t[1] * dir];
    const f = frame([mid[0], mid[1]], n);
    const W = GAL_OUT + 0.08, sh = new T.Shape();
    sh.moveTo(-W / 2, BASE); sh.lineTo(W / 2, BASE); sh.lineTo(W / 2, 8.4); sh.lineTo(0, 9.6); sh.lineTo(-W / 2, 8.4); sh.lineTo(-W / 2, BASE);
    const hole = new T.Path(); hole.moveTo(-1.05, BASE); hole.lineTo(-1.05, 2.9); hole.absarc(0, 2.9, 1.05, Math.PI, 0, true); hole.lineTo(1.05, BASE); hole.lineTo(-1.05, BASE);
    sh.holes.push(hole);
    put(b, f, new T.ExtrudeGeometry(sh, {depth: 0.6, bevelEnabled: false, curveSegments: 8}).translate(0, 0, -0.6), 0, 0, 0, 'brick');
    relief(M, f, 0, 0, ringOutline(2.6, 4.25, 0.3, 8), 0.08, 'stone'); // no back face: it would show through the passage
    slab(b, f, 0, 6.2, 1.5, 1.0, 0.1, 'stone');            // memorial stone
    slab(b, f, 0, 6.55, 1.1, 0.12, 0.14, 'gold');         // its gilded inscription line
    slab(b, f, 0, 6.35, 0.8, 0.12, 0.14, 'gold');
    poly(b, f, 0, 7.45, [[-0.4, 0.6], [0.4, 0.6], [0.4, 0.15], [0, -0.15], [-0.4, 0.15]], 0.12, 'stone'); // shield
    beast(b, s + dir * 0.0, GAL_OUT / 2, 9.4, 1.2);
    for (const sd of [-1, 1]) relief(M, f, sd * (W / 2 - 0.25), BASE, [[-0.3, 0], [0.3, 0], [0.3, 8.5 - BASE], [-0.3, 8.5 - BASE]], 0.12, 'stone');
  }
}

// ---- the centre gate (nr 37, chord c09) --------------------------------------------------------------------------------
function centreGate(b: BuildingTools, m: Mesh) {
  const s0 = CH[9], s1 = CH[10], sm = (s0 + s1) / 2, W = s1 - s0, RIS = 1.0;
  // stone gate block over the pavement: arched opening front and back, an openwork loggia on it, balcony on top
  const fg = fr(sm, GAL_OUT);
  const sh = new T.Shape();
  sh.moveTo(-W / 2, BASE); sh.lineTo(W / 2, BASE); sh.lineTo(W / 2, 8.75); sh.lineTo(-W / 2, 8.75); sh.lineTo(-W / 2, BASE);
  const hole = new T.Path(); hole.moveTo(-2.4, BASE); hole.lineTo(-2.4, 4.3); hole.absarc(0, 4.3, 2.4, Math.PI, 0, true); hole.lineTo(2.4, BASE); hole.lineTo(-2.4, BASE);
  sh.holes.push(hole);
  put(b, fg, new T.ExtrudeGeometry(sh, {depth: 0.7, bevelEnabled: false, curveSegments: 10}).translate(0, 0, -0.7), 0, 0, 0, 'stone');
  archBand(b, fg, 0, 1.0, 5.4, 6.1, 0.45, 0.08, 'stone', 0, 10);
  // loggia: dark openings between small columns over the arch
  for (let i = -2; i <= 2; i++) { slab(b, fg, i * 0.95, 6.65, 0.62, 1.3, 0.04, 'dark'); }
  for (let i = -2.5; i <= 2.5; i += 1) slab(b, fg, i * 0.95, 6.6, 0.16, 1.45, 0.12, 'stone');
  // side walls of the gate block back to the front, and its roof (the balcony floor)
  for (const sd of [-1, 1]) {
    const sx = sm + sd * (W / 2 - 0.2), a = F.at(sx), n: XZ = [a.t[0] * sd, a.t[1] * sd];
    const f = frame([a.p[0] + a.n[0] * (GAL_OUT - 0.35) / 2, a.p[1] + a.n[1] * (GAL_OUT - 0.35) / 2], n);
    slab(b, f, 0, BASE, GAL_OUT - 0.35, 8.75 - BASE, 0.4, 'stone', -0.4);
  }
  // the shopfront under the gate, in the house wall behind the arch (strip c09: glazed front with a dark frame)
  slab(b, fr(sm), 0, BASE, W - 1.6, SHOP_TOP - BASE, 0.15, 'dark');
  slab(b, fr(sm), 0, 0.35, W - 2.2, SHOP_TOP - 0.65, 0.06, 'glass', 0.15);
  ledgeStrip(b, fr(sm), 0, 3.2, W - 2.2, 0.08, 0.08, 'frame', 0.21);
  sweep(m, 'stone', s0 + 0.05, s1 - 0.05, [[0, 8.45], [GAL_OUT + 0.05, 8.45], [GAL_OUT + 0.05, 8.8], [0, 8.8]]);
  // balcony balustrade on the gate
  sweep(m, 'stone', s0 + 0.3, s1 - 0.3, [[GAL_OUT - 0.25, 9.75], [GAL_OUT + 0.02, 9.75], [GAL_OUT + 0.02, 9.95], [GAL_OUT - 0.25, 9.95]]);
  for (let s = s0 + 0.5; s < s1 - 0.35; s += 0.42) ledgeStrip(b, fr(s, GAL_OUT - 0.2), 0, 8.8, 0.13, 0.95, 0.16, 'stone');
  // the risalit: stone-dressed front 1 m proud from the balcony up to the gable, with its own saddle roof (3DBAG 23.2)
  const top = (s: number) => { const t = Math.abs(s - sm) / (W / 2); return t > 0.92 ? 19.6 : 19.6 + (23.2 - 19.6) * Math.min(1, (0.92 - t) / 0.92); };
  ribbon(m, 'brick', s0 + 0.05, s1 - 0.05, RIS, 8.8, top, [sm]);
  for (const sd of [-1, 1]) {
    const sx = sd < 0 ? s0 + 0.05 : s1 - 0.05, a = F.at(sx), n: XZ = [a.t[0] * sd, a.t[1] * sd];
    const f = frame([a.p[0] + a.n[0] * RIS / 2, a.p[1] + a.n[1] * RIS / 2], n);
    slab(b, f, 0, 8.8, RIS, 19.6 - 8.8, 0.02, 'brick', -0.02);
  }
  // risalit roof: saddle from the gable back into the main roof
  {
    const a = F.at(sm), ap = [a.p[0] + a.n[0] * RIS, a.p[1] + a.n[1] * RIS];
    const L = F.at(s0 + 0.05), R = F.at(s1 - 0.05);
    const lp = [L.p[0] + L.n[0] * RIS, L.p[1] + L.n[1] * RIS], rp = [R.p[0] + R.n[0] * RIS, R.p[1] + R.n[1] * RIS];
    const back = -4.5, bk = (p: number[], n: number[]) => [p[0] + n[0] * (back - RIS), p[1] + n[1] * (back - RIS)];
    const ab = bk(ap, a.n), lb = bk(lp, L.n), rb = bk(rp, R.n);
    m.quad('slate', [lp[0], 19.6, lp[1]], [ap[0], 23.2, ap[1]], [ab[0], 23.2, ab[1]], [lb[0], 19.6, lb[1]], [0, 1, 0]);
    m.quad('slate', [rp[0], 19.6, rp[1]], [ap[0], 23.2, ap[1]], [ab[0], 23.2, ab[1]], [rb[0], 19.6, rb[1]], [0, 1, 0]);
    m.tri('brick', [lb[0], 19.6, lb[1]], [ab[0], 23.2, ab[1]], [rb[0], 19.6, rb[1]], [-a.n[0], 0, -a.n[1]]);
    m.quad('brick', [lb[0], TOP, lb[1]], [rb[0], TOP, rb[1]], [rb[0], 19.6, rb[1]], [lb[0], 19.6, lb[1]], [-a.n[0], 0, -a.n[1]]);
    for (const [p, q, sd] of [[lp, lb, -1], [rp, rb, 1]] as [number[], number[], number][]) m.quad('brick', [p[0], TOP, p[1]], [q[0], TOP, q[1]], [q[0], 19.6, q[1]], [p[0], 19.6, p[1]], [a.t[0] * sd, 0, a.t[1] * sd]);
  }
  // stone dressings: corner piers, storey bands, window surrounds, the great arched niche of the gable
  const fo = (s: number) => fr(s, RIS);
  for (const sd of [-1, 1]) { const f = fo(sm + sd * (W / 2 - 0.4)); slab(b, f, 0, 8.8, 0.8, 11.6, 0.2, 'stone'); slab(b, f, 0, 20.3, 0.5, 1.1, 0.25, 'stone'); }
  for (const y of [11.2, 14.7, 16.1]) sweep(m, 'stone', s0 + 0.9, s1 - 0.9, [[RIS, y], [RIS + 0.14, y], [RIS + 0.14, y + 0.28], [RIS, y + 0.28]]);
  for (const t of [-1.8, 0, 1.8]) window(b, sm + t, 9.5, 11.0, 1.15, {head: 'round', out: RIS});
  for (const t of [-1.8, 0, 1.8]) window(b, sm + t, 12.2, 14.55, t === 0 ? 1.3 : 1.05, {out: RIS, transom: 1.7});
  // small arcade band and the great arched loggia niche (dark), its stone ring
  for (let i = -3; i <= 3; i++) archSlab(b, fo(sm + i * 0.62), 0, 16.55, 0.34, 0.6, 0.06, 'dark', 0, 4);
  archSlab(b, fo(sm), 0, 17.4, 4.8, 4.2, 0.05, 'dark', 0, 10);
  archBand(b, fo(sm), 0, 17.4, 5.4, 4.5, 0.32, 0.16, 'stone', 0, 10);
  slab(b, fo(sm), 0, 17.4, 4.9, 0.9, 0.12, 'stone');      // the loggia's balustrade
  beast(b, sm, RIS, 23.15, 1.2);
  for (const sd of [-1, 1]) beast(b, sm + sd * (W / 2 - 0.45), RIS + 0.1, 21.4, 0.9);
}

// ---- house fronts -------------------------------------------------------------------------------------------------------
/** First and second floors common to the gallery houses: three French windows, three T-windows (or two). */
function storeys(b: BuildingTools, s0: number, s1: number, kind: Kind, away = 0) {
  const sm = (s0 + s1) / 2 + away, W = s1 - s0, dt = W / 3.4;
  const ts = kind === 'serre' || kind === 'serre21' ? [-dt * 0.75, dt * 0.75] : [-dt, 0, dt];
  for (const t of [-dt, 0, dt]) window(b, sm + t, F1[0], F1[1], t === 0 && kind === 'L' ? 1.2 : 1.05, {head: 'round', bars: 1, transom: 1.75});
  if (kind === 'L' || kind === 'G') return; // the bay / oriel on the second floor
  for (const t of ts) {
    window(b, sm + t, F2[0], F2[1], 1.05, {bars: 1, transom: 1.65});
    relief(M, fr(sm + t), 0, F2[1] + 0.05, ringOutline(1.5, 0.85, 0.2, 3), 0.1, 'red'); // relieving arch over the T-window
  }
}
/** Brick bay (erker) with three windows on the second floor of a loggia house, on a stone corbel. */
function brickBay(b: BuildingTools, sm: number) {
  const D = 0.55, w = 3.4;
  const f = fr(sm);
  slab(b, f, 0, F2[0] - 0.55, w + 0.2, 0.55, D + 0.12, 'stone');
  slab(b, f, 0, F2[0], w, F2[1] - F2[0] + 0.35, D, 'brick');
  slab(b, f, 0, F2[1] + 0.35, w + 0.2, 0.25, D + 0.1, 'stone');
  for (const t of [-1.1, 0, 1.1]) {
    const g = fr(sm + t, D);
    slab(b, g, 0, F2[0] + 0.1, 0.95, F2[1] - F2[0] - 0.2, 0.08, 'frame');
    slab(b, g, 0, F2[0] + 0.15, 0.82, F2[1] - F2[0] - 0.3, 0.13, 'glass');
    slab(b, g, 0, F2[0] + 1.6, 0.82, 0.06, 0.18, 'frame');
  }
}
/** White timber three-sided oriel on stone consoles (gable houses, nr 21's Raadhuisstraat gable). */
function timberOriel(b: BuildingTools, sm: number, y0 = 12.0, y1 = 14.8) {
  const D = 0.6, Wf = 1.5, Wb = 2.4, f = fr(sm), h = y1 - y0;
  const outline: [number, number][] = [[-Wb / 2, 0], [Wb / 2, 0], [Wf / 2, D], [-Wf / 2, D]];
  // plan prism: build as an extrusion of the trapezoid upward
  const shp = new T.Shape(outline.map(([x, z]) => new T.Vector2(x, -z)));
  const g = new T.ExtrudeGeometry(shp, {depth: h, bevelEnabled: false}); g.rotateX(-Math.PI / 2);
  put(b, f, g, 0, y0, -0.02, 'white');
  const cap = new T.ExtrudeGeometry(new T.Shape([[-Wb / 2 - 0.1, 0.05], [Wb / 2 + 0.1, 0.05], [Wf / 2 + 0.1, -D - 0.12], [-Wf / 2 - 0.1, -D - 0.12]].map(([x, z]) => new T.Vector2(x, z))), {depth: 0.18, bevelEnabled: false});
  cap.rotateX(-Math.PI / 2);
  const capLow = cap.clone();
  put(b, f, cap, 0, y1, -0.02, 'white');
  put(b, f, capLow, 0, y0 - 0.18, -0.02, 'white');
  for (const sd of [-0.5, 0.5]) slab(b, f, sd * 1.2, y0 - 0.85, 0.22, 0.67, 0.5, 'stone');
  // glazing on the front face and both cheeks
  slab(b, fr(sm, D), 0, y0 + 0.35, Wf - 0.3, h - 0.75, 0.06, 'glass');
  slab(b, fr(sm, D), 0, y0 + 1.75, Wf - 0.3, 0.06, 0.1, 'white');
  for (const sd of [-1, 1]) {
    const a = F.at(sm), tx = a.t[0], tz = a.t[1];
    const ang = Math.atan2(D, (Wb - Wf) / 2);
    // the cheek's outward normal: between the tangent side and the front normal
    const nx = sd * tx * Math.sin(ang) + a.n[0] * Math.cos(ang), nz = sd * tz * Math.sin(ang) + a.n[1] * Math.cos(ang);
    const mid = [a.p[0] + tx * sd * (Wb + Wf) / 4 + a.n[0] * D / 2, a.p[1] + tz * sd * (Wb + Wf) / 4 + a.n[1] * D / 2];
    const g2 = frame([mid[0], mid[1]], [nx, nz]);
    slab(b, g2, 0, y0 + 0.35, 0.42, h - 0.75, 0.06, 'glass');
  }
}

function attic(b: BuildingTools, m: Mesh, k: number, kind: Kind) {
  const s0 = CH[k], s1 = CH[k + 1], sm = (s0 + s1) / 2, W = s1 - s0;
  // stone belt under the attic, swept per house
  sweep(m, 'stone', s0, s1, [[0, BELT], [0.14, BELT], [0.14, BELT + 0.3], [0, BELT + 0.3]]);
  if (kind === 'L' || kind === 'corner55') {
    ribbon(m, 'brick', s0, s1, 0, BELT + 0.3, () => TOP);
    sweep(m, 'stone', s0, s1, [[-0.05, TOP - 0.05], [0.16, TOP - 0.05], [0.16, TOP + 0.18], [-0.05, TOP + 0.18]]);
    // loggia: three round arches on small stone columns over a stone balustrade, the recess dark
    // narrow houses (nr 23-27's neighbour, 4.5 m) get a tighter loggia, clear of the party-wall pilasters
    // on nr 55 the turret takes the first 3.3 m of the front: the loggia stands beside it
    const l0 = kind === 'corner55' ? s0 + 3.3 : s0, lm = (l0 + s1) / 2;
    const lw = Math.min(2.2, (s1 - l0) / 2 - 0.55), sp = lw * 2 / 3, aw = Math.min(1.15, sp - 0.3);
    for (const t of [-sp, 0, sp]) { relief(m, fr(lm + t), 0, 16.0, archOutline(aw, 1.2), 0.05, 'dark'); relief(m, fr(lm + t), 0, 16.0, ringOutline(aw + 0.3, 1.35, 0.16), 0.12, 'red'); }
    for (const t of [-lw, -lw / 3, lw / 3, lw]) slab(b, fr(lm + t), 0, 15.5, 0.24, 1.0, 0.16, 'stone');
    sweep(m, 'stone', lm - lw, lm + lw, [[0, 15.55], [0.2, 15.55], [0.2, 16.0], [0, 16.0]]);
    if (kind === 'L') brickBay(b, sm);
  } else if (kind === 'B') {
    ribbon(m, 'brick', s0, s1, 0, BELT + 0.3, () => 16.55);
    sweep(m, 'stone', s0, s1, [[-0.05, 16.5], [0.14, 16.5], [0.14, 16.72], [-0.05, 16.72]]);
    for (let i = -2; i <= 2; i++) relief(m, fr(sm + i * 0.95), 0, 15.75, archOutline(0.5, 0.62, 3), 0.05, 'dark');
  } else if (kind === 'G' || kind === 'gable21') {
    const apex = kind === 'gable21' ? 19.0 : 19.3, half = W / 2 - 0.35, sh = 16.4;
    const top = (s: number) => { const t = Math.abs(s - sm); return t >= half ? sh : sh + (apex - sh) * (1 - t / half); };
    ribbon(m, 'brick', s0, s1, 0, BELT + 0.3, top, [sm, sm - half, sm + half]);
    // stone copings along both rakes, the apex finial and the corner piers (hoekpijlertjes)
    const fm = fr(sm);
    const rake = (sd: number): [number, number][] => [[0, apex - sh + 0.25], [sd * (half + 0.2), -0.05], [sd * (half + 0.2), -0.3], [0, apex - sh - 0.05]];
    for (const sd of [-1, 1]) poly(b, fm, 0, sh, rake(sd), 0.16, 'stone');
    for (const sd of [-1, 1]) { slab(b, fr(sm + sd * (half + 0.12)), 0, BELT + 0.3, 0.45, sh + 0.9 - BELT - 0.3, 0.18, 'brick'); slab(b, fr(sm + sd * (half + 0.12)), 0, sh + 0.9, 0.55, 0.25, 0.24, 'stone'); }
    beast(b, sm, 0.1, apex + 0.2, 0.9);
    // five-light window in an arched stone niche
    archSlab(b, fm, 0, 15.55, 2.4, 2.0, 0.05, 'stone', 0, 8);
    for (let i = -2; i <= 2; i++) slab(b, fr(sm + i * 0.44), 0, 15.7, 0.36, 1.2, 0.12, 'glass');
    slab(b, fm, 0, 15.62, 2.3, 0.08, 0.16, 'stone');
    // the cross roof (insteekkap) back into the mansard
    const a = F.at(sm), L = F.at(sm - half), R = F.at(sm + half), bk = -3.0;
    const P = (q: typeof a, o: number, y: number) => [q.p[0] + q.n[0] * o, y, q.p[1] + q.n[1] * o];
    m.quad('slate', P(L, -0.05, sh), P(a, -0.05, apex), P(a, bk, apex), P(L, bk, sh), [0, 1, 0]);
    m.quad('slate', P(R, -0.05, sh), P(a, -0.05, apex), P(a, bk, apex), P(R, bk, sh), [0, 1, 0]);
    m.tri('brick', P(L, bk, TOP), P(a, bk, apex), P(R, bk, TOP), [-a.n[0], 0, -a.n[1]]);
    if (kind === 'G') timberOriel(b, sm); else timberOriel(b, sm, 11.9, 14.6);
  } else if (kind === 'serre' || kind === 'serre21') {
    ribbon(m, 'brick', s0, s1, 0, BELT + 0.3, () => 15.75);
    // the later timber serre in the top: a white glazed box set back on the parapet
    const w = W - 1.0, f = fr(sm, -0.6), h = TOP + 0.15 - 15.75;
    slab(b, f, 0, 15.75, w, h, 0.6, 'white', -0.05);
    // six lights, kept 1.2 m in from the party walls (the neighbours' attic walls rise beside them)
    // nr 23-27 (serre21): five lights, the west one left blind by the party wall (the audit reads its parapet facet as taller)
    const gw = W - 2.4, n0 = kind === 'serre21' ? 1 : 0;
    for (let i = n0; i < 6; i++) slab(b, fr(sm - gw / 2 + gw * (i + 0.5) / 6, 0), 0, 16.15, gw / 6 - 0.14, 1.15, 0.06, 'glass', 0.0);
    sweep(m, 'stone', s0, s1, [[-0.05, 15.72], [0.14, 15.72], [0.14, 15.9], [-0.05, 15.9]]);
  }
}

function houses(b: BuildingTools, m: Mesh) {
  for (let k = 0; k < KINDS.length; k++) {
    const kind = KINDS[k], s0 = CH[k], s1 = CH[k + 1], sm = (s0 + s1) / 2;
    if (kind === 'centre') { pilaster(b, s0, DECK, TOP + 0.35); continue; }
    attic(b, m, k, kind);
    if (kind === 'corner55') corner55(b, m, s0, s1);
    else if (kind === 'gable21') corner21(b, m, s0, s1);
    else storeys(b, s0, s1, kind, k === 8 ? -0.3 : k === 10 ? 0.3 : 0);
    // the pilasters between houses rise above the attic to carry the beasts
    if (k > 0) pilaster(b, s0, DECK, kind === 'G' ? 16.9 : TOP + 0.35);
    if ((kind === 'L' || kind === 'B') && k > 0) beast(b, s0, 0.1, TOP + 0.57, 0.8);
    void sm;
  }
}

// ---- corner 55 with the round tower (Keizersgracht) and corner 21 (Herengracht) --------------------------------------
function corner55(b: BuildingTools, m: Mesh, s0: number, s1: number) {
  const sm = (s0 + s1) / 2, f = fr(sm);
  // ground: shopfront in a stone surround; entresol: wide segmental window; storeys: two windows each
  slab(b, f, 0, BASE, s1 - s0 - 1.0, 0.9 - BASE, 0.2, 'stone');
  slab(b, f, 0.6, 0.4, 4.2, 3.6, 0.08, 'bronze'); slab(b, f, 0.6, 0.95, 3.9, 2.9, 0.13, 'glass');
  slab(b, f, -2.4, 0.4, 1.0, 2.6, 0.12, 'dark');
  segBand(b, f, 0, 7.6, 4.8, 0.6, 0.28, 0.12, 'red');
  slab(b, f, 0, 5.3, 4.4, 2.3, 0.08, 'frame'); slab(b, f, 0, 5.4, 4.2, 2.1, 0.13, 'glass');
  for (const t of [-0.8, 0.8]) slab(b, f, t, 5.4, 0.06, 2.1, 0.18, 'frame');
  sweep(m, 'stone', s0, s1, [[0, 4.45], [0.16, 4.45], [0.16, 4.75], [0, 4.75]]);
  for (const t of [-1.35, 1.35]) { window(b, sm + t, 9.0, 10.9, 1.0, {head: 'round'}); window(b, sm + t, 11.9, 14.0, 1.0, {transom: 1.5}); }
}

function tower(b: BuildingTools, m: Mesh) {
  // centre and radius from the 3DBAG cone pieces of pand 0363100012169304 (x -56.6..-53.4, z -42.9..-40.2), top 27.2 m
  const cx = -55.0, cz = -41.4, r = 1.65, y0 = 15.2, y1 = 20.8, apex = 27.2, N = 10; // ten facets: each over 1 m wide, a wall its window can stand on
  const ring = (rr: number, y: number) => Array.from({length: N}, (_, i) => [cx + rr * Math.cos(i / N * 2 * Math.PI), y, cz + rr * Math.sin(i / N * 2 * Math.PI)]);
  const band = (c: C, ra: number, ya: number, rb: number, yb: number) => {
    const A = ring(ra, ya), B = ring(rb, yb);
    for (let i = 0; i < N; i++) { const j = (i + 1) % N, mx = (A[i][0] + A[j][0]) / 2 - cx, mz = (A[i][2] + A[j][2]) / 2 - cz; m.quad(c, A[i], A[j], B[j], B[i], [mx, yb > ya ? (ra - rb) : (rb - ra), mz]); }
  };
  band('brick', 0.6, y0 - 1.3, r, y0);            // corbel out of the rounded corner
  band('brick', r, y0, r, y1);                    // the turret
  band('stone', r + 0.12, y1 - 0.15, r + 0.12, y1 + 0.2);
  for (let i = 0; i < N; i++) { const A = ring(r + 0.12, y1 + 0.2), B = ring(r, y1 + 0.2), j = (i + 1) % N; m.quad('stone', A[i], A[j], B[j], B[i], [0, 1, 0]); }
  band('stone', r + 0.12, y1 - 0.15, r, y1 - 0.15);
  // slate spire (flared at the foot) with a weather vane
  const C2 = [cx, apex, cz];
  const foot = ring(r + 0.05, y1 + 0.2), knee = ring(r - 0.25, y1 + 1.0);
  for (let i = 0; i < N; i++) { const j = (i + 1) % N; m.quad('slate', foot[i], foot[j], knee[j], knee[i], [foot[i][0] - cx, 1, foot[i][2] - cz]); m.tri('slate', knee[i], knee[j], C2, [knee[i][0] - cx, 0.5, knee[i][2] - cz]); }
  for (const a of [0.5, 2.1, 3.7, 5.3]) {
    const f = frame([cx + (r - 0.3) * Math.cos(a), cz + (r - 0.3) * Math.sin(a)], [Math.cos(a), Math.sin(a)]);
    archSlab(b, f, 0, y1 + 0.45, 0.45, 0.6, 0.35, 'slate', -0.1, 5); archSlab(b, f, 0, y1 + 0.5, 0.3, 0.42, 0.37, 'glass', -0.1, 5);
  }
  slab(b, frame([cx, cz], [0, -1]), 0, apex - 0.1, 0.06, 1.6, 0.06, 'dark', -0.03);
  slab(b, frame([cx, cz], [0, -1]), 0.25, apex + 1.0, 0.5, 0.3, 0.03, 'dark', -0.015);
  // turret windows
  // turret windows, each centred on one facet of the 16-gon (a window across a facet edge hangs off both)
  for (const a0 of [-0.6, -1.4, -2.2, -3.0]) {
    const a = (Math.round(a0 / (2 * Math.PI / N) - 0.5) + 0.5) * 2 * Math.PI / N, ap = r * Math.cos(Math.PI / N);
    const f = frame([cx + ap * Math.cos(a), cz + ap * Math.sin(a)], [Math.cos(a), Math.sin(a)]);
    slab(b, f, 0, 17.6, 0.55, 2.1, 0.08, 'frame'); slab(b, f, 0, 17.68, 0.45, 1.94, 0.12, 'glass');
    slab(b, f, 0, 19.9, 0.7, 0.2, 0.14, 'stone');
  }
  // rounded corner below: balcony on the entresol and the initialled shield (register)
  const cf = frame([-56.25, -42.55], [-0.6, -0.8]);
  slab(b, cf, 0, 7.3, 2.0, 0.25, 0.9, 'stone');
  slab(b, cf, 0, 7.55, 2.0, 0.95, 0.06, 'green', 0.8);
  poly(b, cf, 0, 10.2, [[-0.45, 0.8], [0.45, 0.8], [0.45, 0.2], [0, -0.25], [-0.45, 0.2]], 0.16, 'stone');
}

function corner21(b: BuildingTools, m: Mesh, s0: number, s1: number) {
  const sm = (s0 + s1) / 2, f = fr(sm);
  // no gallery: stone ground floor with the shop, the big arched entresol window, one window over it, then the oriel
  slab(b, f, 0, BASE, s1 - s0 - 0.4, 1.0 - BASE, 0.2, 'stone');
  slab(b, f, 0, 0.5, s1 - s0 - 0.9, 3.5, 0.08, 'bronze'); slab(b, f, 0, 1.05, s1 - s0 - 1.3, 2.8, 0.13, 'glass');
  archSlab(b, f, 0, 4.6, 2.6, 2.4, 0.08, 'frame', 0, 8); archSlab(b, f, 0, 4.66, 2.45, 2.3, 0.13, 'glass', 0, 8);
  archBand(b, f, 0, 4.6, 3.1, 2.65, 0.25, 0.1, 'red', 0, 8);
  window(b, sm, 9.4, 10.9, 0.95, {head: 'round'});
  // the cut corner: stone pier, winged beasts holding a shield (register), up to the attic
  const cf = frame(CUT_CORNER.mid, CUT_CORNER.n);
  slab(b, cf, 0, BASE, 1.2, 4.6 - BASE, 0.2, 'stone');
  beastAt(b, frame([CUT_CORNER.mid[0] + CUT_CORNER.n[0] * 0.25, CUT_CORNER.mid[1] + CUT_CORNER.n[1] * 0.25], CUT_CORNER.n), 8.4, 1.1);
  poly(b, cf, 0, 7.6, [[-0.45, 0.8], [0.45, 0.8], [0.45, 0.2], [0, -0.25], [-0.45, 0.2]], 0.42, 'stone');
}

// ---- canal fronts -----------------------------------------------------------------------------------------------------
/** Window rows on a straight canal front from p to q (native), outward normal n. */
function canalFront(b: BuildingTools, p: XZ, q: XZ, n: XZ, rows: {y0: number; y1: number; ts: number[]; w: number; head?: 'round' | 'flat'; out?: number}[]) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]), tg: XZ = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
  // church-kit frame: tangent = (n.z, -n.x); place by absolute position along p->q
  for (const r of rows) for (const t of r.ts) {
    const o = r.out ?? 0, at: XZ = [p[0] + tg[0] * t + n[0] * o, p[1] + tg[1] * t + n[1] * o], f = frame(at, n), h = r.y1 - r.y0;
    if (r.head === 'round') { relief(M, f, 0, r.y0 - 0.04, archOutline(r.w + 0.18, h + 0.1), 0.08, 'frame'); relief(M, f, 0, r.y0, archOutline(r.w, h), 0.13, 'glass'); relief(M, f, 0, r.y0 - 0.04, ringOutline(r.w + 0.6, h + 0.3, 0.22), 0.1, 'red'); }
    else { slab(b, f, 0, r.y0 - 0.04, r.w + 0.18, h + 0.08, 0.08, 'frame'); slab(b, f, 0, r.y0, r.w, h, 0.13, 'glass'); }
    ledgeStrip(b, f, 0, r.y0 - 0.14, r.w + 0.3, 0.1, 0.2, 'stone');
    ledgeStrip(b, f, 0, r.y0 + Math.min(1.6, h * 0.6), r.w, 0.06, 0.18, 'frame');
  }
}

function canalFronts(b: BuildingTools, m: Mesh) {
  // Keizersgracht: the long west edge of the union ring (BAG), from the tower corner south to Keizersgracht 201
  const ring = SRC.nativeRing;
  const west = ring.filter(p => p[0] < -56.4).sort((a, c) => a[1] - c[1]);
  const pN = west[0], pS = west[west.length - 1];
  const nW: XZ = (() => { const dx = pS[0] - pN[0], dz = pS[1] - pN[1], L = Math.hypot(dx, dz); return [dz / L, -dx / L]; })();
  const n: XZ = nW[0] < 0 ? nW : [-nW[0], -nW[1]];
  const L = Math.hypot(pS[0] - pN[0], pS[1] - pN[1]);
  // church-kit frame tangent at this face is (n.z, -n.x): facing west, the viewer's right is north, so walk from the south end
  const p = pS, q = pN; void q;
  const at = (z: number) => L - (z - pN[1]) / ((pS[1] - pN[1]) / L); // distance from the south end for a z on the line
  const zs = {k201: [-14.5, -7.2], k199: [-20.8, -14.5], k197: [-32.1, -20.8], c55: [pN[1] + 1.4, -32.1]};
  const mid = (r: number[]) => at((r[0] + r[1]) / 2);
  const span = (r: number[]) => Math.abs(r[1] - r[0]);
  void span;
  const rows = [
    // 55's Keizersgracht side: a wide arched entresol window, two storeys of three windows, the oriel and the gable
    {y0: 5.0, y1: 7.4, ts: [mid(zs.c55) - 2.0, mid(zs.c55) + 2.0], w: 2.6, head: 'round' as const},
    {y0: 8.6, y1: 10.8, ts: [mid(zs.c55) - 2.6, mid(zs.c55), mid(zs.c55) + 2.6], w: 1.0, head: 'round' as const},
    {y0: 11.8, y1: 14.0, ts: [mid(zs.c55) - 2.6, mid(zs.c55) + 2.6], w: 1.0},
    // Keizersgracht 197: two round entresol windows, four round first-floor windows, four square second-floor windows
    {y0: 4.6, y1: 6.6, ts: [mid(zs.k197) - 2.6, mid(zs.k197) + 2.6], w: 1.3, head: 'round' as const},
    {y0: 7.9, y1: 10.2, ts: [-3.9, -1.3, 1.3, 3.9].map(t => mid(zs.k197) + t), w: 1.05, head: 'round' as const},
    {y0: 11.1, y1: 13.3, ts: [-3.9, -1.3, 1.3, 3.9].map(t => mid(zs.k197) + t), w: 1.05},
    // 199: three window axes
    {y0: 5.0, y1: 7.0, ts: [-1.8, 0, 1.8].map(t => mid(zs.k199) + t), w: 1.0, head: 'round' as const},
    {y0: 8.2, y1: 10.4, ts: [-1.8, 0, 1.8].map(t => mid(zs.k199) + t), w: 1.0, head: 'round' as const},
    {y0: 11.4, y1: 13.6, ts: [-1.8, 0, 1.8].map(t => mid(zs.k199) + t), w: 1.0},
    // 201: big arched ground window between two doors, three round windows over it, the five-light top window
    {y0: 1.0, y1: 4.2, ts: [mid(zs.k201)], w: 2.6, head: 'round' as const, out: 0.1},
    {y0: 5.6, y1: 8.0, ts: [-2.0, 0, 2.0].map(t => mid(zs.k201) + t), w: 1.0, head: 'round' as const},
    {y0: 9.0, y1: 11.2, ts: [-2.0, 0, 2.0].map(t => mid(zs.k201) + t), w: 1.0, head: 'round' as const},
    {y0: 12.4, y1: 14.0, ts: [-1.6, -0.8, 0, 0.8, 1.6].map(t => mid(zs.k201) + t), w: 0.62},
  ];
  canalFront(b, p, [pN[0], pN[1]], n, rows);
  // shop and doors at the foot, stone plinth, 201's grey stone ground floor
  const fAt = (t: number) => frame([p[0] + (pN[0] - p[0]) / L * t, p[1] + (pN[1] - p[1]) / L * t], n);
  slab(b, fAt(mid(zs.k201)), 0, BASE, 6.2, 4.6 - BASE, 0.1, 'stone');
  for (const t of [-2.4, 2.4]) slab(b, fAt(mid(zs.k201) + t), 0, 0.3, 0.95, 2.5, 0.14, 'dark');
  slab(b, fAt(mid(zs.k197)), 0, BASE, 9.6, 3.8 - BASE, 0.1, 'stone');
  slab(b, fAt(mid(zs.k197) - 1.0), 0, 0.4, 6.0, 3.0, 0.14, 'glass');
  slab(b, fAt(mid(zs.k197) + 3.6), 0, 0.3, 1.0, 2.6, 0.14, 'dark');
  slab(b, fAt(mid(zs.c55)), 0, BASE, 8.0, 4.2 - BASE, 0.1, 'stone');
  slab(b, fAt(mid(zs.c55)), 0, 0.5, 6.6, 3.3, 0.14, 'glass');
  // 55's Keizersgracht gable with the carved cock beside it (register; Commons 2024-11-25 photo 2)
  {
    const tc = mid(zs.c55), f = fAt(tc), sh = TOP, apex = 20.0, half = 3.6;
    poly(b, f, 0, sh, [[-half, 0], [half, 0], [half, 0.6], [0, apex - sh], [-half, 0.6]], 0.3, 'brick', -0.3);
    poly(b, f, 0, sh, [[0, apex - sh + 0.25], [half + 0.2, 0.55], [half + 0.2, 0.3], [0, apex - sh - 0.05]], 0.14, 'stone', 0.0);
    poly(b, f, 0, sh, [[0, apex - sh + 0.25], [-half - 0.2, 0.55], [-half - 0.2, 0.3], [0, apex - sh - 0.05]], 0.14, 'stone', 0.0);
    relief(M, f, 0, sh + 0.3, archOutline(1.6, 1.4, 6), 0.06, 'glass'); // no sunk back: the 3DBAG roof prism starts right behind the gable
    const ck = fAt(tc + half + 0.4);
    poly(b, ck, 0, sh + 0.55, [[-0.35, 0], [0.3, 0], [0.42, 0.45], [0.2, 0.62], [0.28, 0.95], [0.12, 1.05], [-0.05, 0.85], [-0.4, 0.55]], 0.3, 'stone', -0.15);
  }
  // 199's gable over its three axes and 201's raised top
  {
    // 0.2 m proud of the BAG line: 3DBAG's gable piece reaches to 0.12 m behind it, so a gable on the line sat inside the roof
    const tc = mid(zs.k199), f = fAt(tc), sh = 15.45, apex = 18.9, half = 3.0, go = 0.2;
    poly(b, f, 0, sh, [[-half, 0], [half, 0], [0, apex - sh]], 0.3 + go, 'brick', -0.3);
    poly(b, f, 0, sh, [[0, apex - sh + 0.25], [half + 0.2, -0.05], [half + 0.2, -0.3], [0, apex - sh - 0.05]], 0.14, 'stone', go);
    poly(b, f, 0, sh, [[0, apex - sh + 0.25], [-half - 0.2, -0.05], [-half - 0.2, -0.3], [0, apex - sh - 0.05]], 0.14, 'stone', go);
    relief(M, f, 0, sh + 0.5, archOutline(1.4, 1.5, 6), 0.13, 'glass', go);
  }
  // the painted name plaque on 201 (register: "geschilderde plaquette met naamvermelding")
  slab(b, fAt(mid(zs.k201)), 0, 11.58, 3.6, 0.6, 0.1, 'white', 0.12);
  slab(b, fAt(mid(zs.k201)), 0, 11.73, 3.2, 0.3, 0.06, 'red', 0.22);

  // Herengracht: the east edge of nr 21, with UTRECHT in stone letters over the entresol window
  const east = ring.filter(p => p[0] > 42.25).sort((a, c) => a[1] - c[1]);
  const e0 = east[0], e1 = east[east.length - 1], LE = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
  // BAG draws this front with 0.2-0.3 m stoop and cellar-light jogs either side of the straight line e0-e1; a brick face
  // 0.28 m proud of the line (ahead of every jog) carries the openings, so no window spans a recess
  const HO = 0.28, nE: XZ = [(e1[1] - e0[1]) / LE, -(e1[0] - e0[0]) / LE];
  const eN: XZ = [e0[0] + nE[0] * HO, e0[1] + nE[1] * HO], eS: XZ = [e1[0] + nE[0] * HO, e1[1] + nE[1] * HO];
  const eAt = (t: number) => frame([eN[0] + (eS[0] - eN[0]) / LE * t, eN[1] + (eS[1] - eN[1]) / LE * t], nE);
  const em = LE / 2;
  put(b, eAt(em), new T.BoxGeometry(LE, TOP + 0.15 - BASE, HO + 0.35).translate(0, (TOP + 0.15 - BASE) / 2, -(HO + 0.35) / 2), 0, BASE, 0, 'brick');
  slab(b, eAt(em), 0, BASE, LE - 0.4, 1.4 - BASE, 0.14, 'stone');
  for (const t of [em - 2.2, em + 2.6]) slab(b, eAt(t), 0, 0.3, 1.0, 2.6, 0.22, 'dark');
  archSlab(b, eAt(em - 0.4), 0, 5.4, 3.0, 4.2, 0.08, 'frame', 0, 8); archSlab(b, eAt(em - 0.4), 0, 5.48, 2.84, 4.05, 0.13, 'glass', 0, 8);
  archBand(b, eAt(em - 0.4), 0, 5.4, 3.5, 4.45, 0.25, 0.1, 'red', 0, 8);
  letters(b, eAt(em - 0.4), 'UTRECHT', 0, 10.85, 0.05, 0.075, 0.08, 'stone');
  canalFront(b, eN, eS, nE, [
    {y0: 12.0, y1: 13.7, ts: [em - 2.4, em + 0.0, em + 2.4], w: 1.0, head: 'round'},
    {y0: 14.8, y1: 16.6, ts: [em - 1.4, em + 1.4], w: 0.95},
  ]);
  {
    const f = eAt(em), sh = TOP, apex = 19.6, half = LE / 2 - 0.3;
    poly(b, f, 0, sh, [[-half, 0], [half, 0], [half, 0.7], [0, apex - sh], [-half, 0.7]], 0.3, 'brick', -0.3);
    poly(b, f, 0, sh, [[0, apex - sh + 0.25], [half + 0.2, 0.65], [half + 0.2, 0.4], [0, apex - sh - 0.05]], 0.14, 'stone', 0.0);
    poly(b, f, 0, sh, [[0, apex - sh + 0.25], [-half - 0.2, 0.65], [-half - 0.2, 0.4], [0, apex - sh - 0.05]], 0.14, 'stone', 0.0);
    for (let i = -1; i <= 1; i++) relief(M, eAt(em + i * 0.9), 0, sh + 0.35, archOutline(0.55, 1.0, 4), 0.14, 'dark');
  }
}

export function buildRaadhuisstraatGalerij(_w: number, _d: number, b: BuildingTools) {
  const m = new Mesh();
  M = m;
  // stagger the hidden back planes of layered trims (frame behind glass behind bronze) so they are not coplanar
  setSink(0.04, true);
  massing(b, m);
  gallery(b, m);
  centreGate(b, m);
  houses(b, m);
  tower(b, m);
  canalFronts(b, m);
  m.flush(b);
  setSink(0);
}
