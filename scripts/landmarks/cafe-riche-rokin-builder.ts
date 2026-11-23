import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, disc, getSink, letters, ledgeStrip, poly, put, ringSlab, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {archOpeningWall, headAt, springing, type ArchOpening, type Tri} from '../../src/canalRecall/landmarks/archOpeningWall';
import {mansardDormers, mansardEnd, type MansardPoly} from '../../src/canalRecall/landmarks/mansardDormers';
import {balustrade} from '../../src/canalRecall/landmarks/balustrade';
import {archAwningOn, stripedAwningOn} from './striped-awning-kit';
import source from './cafe-riche-rokin-footprints.json';

/**
 * FORMER CAFE-RESTAURANT RICHE, ROKIN 84 (BAG pand 0363100012168347; rijksmonument 5009: "V.m. Cafe-Restaurant Riche (1883,
 * door A.L. van Gendt). Rijk bewerkte gevel in de laat-19e eeuwse internationale eclectische bouwtrant"), today Het Lagerhuys.
 * The BAG pand also holds two later Rokin fronts (Rokin 86, brick with white windows; Rokin 88-90, a stone office with an ING
 * branch) and, on the side lane to the north, a brick office over a stone arcade (the Rock Inn): all four fronts are drawn.
 *
 * Massing: the 3DBAG LoD2.2 shell (footprints.json, bag-shell-prepare.ts). Every front is a face standing a few cm proud of the
 * 3DBAG wall with its openings cut (archOpeningWall), so the windows have reveals.
 *
 * Coordinates. Rokin: T metres along the front from the north corner (facade ring vertex 29) southwards; the Riche is T 0-9.28
 * (ring jogs: door-bay pilasters at T 6.56-7.17 and 8.71-9.28, the door recess between), Rokin 86 T 9.28-16.15, Rokin 88-90
 * T 16.15-29.4. North side: s metres from the same corner westwards; the Riche's return is s 0-2.8, the Rock Inn s 2.8-32.15.
 *
 * Riche front read from the rectified Gemeente Amsterdam panoramas recording_2025-06-19_03-28-47_01404 (2025, frontal, w04-102,
 * 50 px/m; T = (330 - x) / 50, h = (1012 - y) / 50) and TMX7316010203-002857_pano_0002_000054 (2022, frontal, the same rows
 * within 10 px), the door bay from the 2025 aimed view (51 px/m across). Four equal bays 2.0 m apart (T 1.72, 3.72, 5.72 and
 * the door bay 7.92):
 *  - grey granite plinth to 2.14 m with three basement lights; rusticated stone ground storey with V-jointed courses and
 *    voussoirs round three tall round-arched windows (2.3-5.65 m, wooden lower panels behind iron rails), carved keystone
 *    masks, the arched door with a carved hood and a framed mezzanine light over it between rusticated pilasters;
 *  - the ground cornice (6.3-6.5) and a band of relief panels; first storey windows (7.22-9.68) between carved consoles that
 *    become the corbels of the long iron balcony (10.66-11.8) across the whole front;
 *  - second storey windows (11.0-13.36) between engaged columns with Corinthian capitals, corner piers with relief panels,
 *    oval oculi in carved cartouches over every window, the garland frieze and a dentil-and-modillion cornice at 16.85 m;
 *  - red fabric markiezen on every window: scalloped valances with side drapes over the upper windows, and on the three
 *    arched windows a red cloth that follows the arch and comes down the jambs (archAwning.ts, new in this lane);
 *  - the slate mansard with a white stone dormer pavilion: two arched windows, cornice, the attic carrying "1883", urns and
 *    a crest.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
type Col = string;
type V2 = [number, number];
type Fr = Frame & {len: number; loc: (x: number) => number};

const R = src.facadeRing;
const P29 = R[29] as V2, P28 = R[28] as V2, P1 = R[1] as V2;
const unit = (a: V2, b: V2): V2 => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
const U = unit(P28, P29), NR: V2 = [-U[1], U[0]]; // Rokin: tangent north (viewer's right), normal east
const VW = unit(P29, P1), NN: V2 = [-VW[1], VW[0]]; // north side: tangent west (viewer's right), normal north

/** Rokin frame over T in [tn, ts] (ts the south, viewer-left end), plane `off` out from the shell. */
function rokin(tn: number, ts: number, off: number): Fr {
  return {origin: [P29[0] - U[0] * ts + NR[0] * off, P29[1] - U[1] * ts + NR[1] * off], tangent: U, n: NR, len: ts - tn, loc: x => ts - x};
}
/** North-side frame over s in [a, b] (a the east, viewer-left end). */
function north(a: number, b: number, off: number): Fr {
  return {origin: [P29[0] + VW[0] * a + NN[0] * off, P29[1] + VW[1] * a + NN[1] * off], tangent: VW, n: NN, len: b - a, loc: x => x - a};
}

let B: BuildingTools;
const geom = (pos: number[]) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g; };
const world = (f: Frame, [u, y, o]: number[]) => [f.origin[0] + f.tangent[0] * u + f.n[0] * o, y, f.origin[1] + f.tangent[1] * u + f.n[1] * o];

// ---- faces with cut openings --------------------------------------------------------------------------------------------
type Cut = ArchOpening & {back: Col};
type Face = Fr & {y0: number; y1: number; c: Col; cuts: Cut[]};
let FACES: Face[] = [];
function face(fr: Fr, y0: number, y1: number, c: Col): Face { const F = {...fr, y0, y1, c, cuts: []}; FACES.push(F); return F; }
function flushFaces() {
  for (const F of FACES) {
    for (const c of F.cuts) if (c.t0 < -1e-9 || c.t1 > F.len + 1e-9 || c.y0 < F.y0 - 1e-9 || c.y1 > F.y1 + 1e-9) throw Error(`cafe-riche-rokin: opening ${JSON.stringify(c)} outside face len ${F.len.toFixed(2)} y ${F.y0}-${F.y1}`);
    const w = archOpeningWall(F.len, F.y0, F.y1, F.cuts);
    const tris = (ts: Tri[]) => ts.flatMap(t => t.pts.flatMap(p => world(F, p)));
    const area = (t: Tri) => { const [a, b, c] = t.pts; return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])); };
    B.add(geom(tris([...[...w.face].sort((p, q) => area(q) - area(p)), ...w.reveals.flat()])), F.c as never);
    const byBack = new Map<Col, Tri[]>();
    F.cuts.forEach((h, i) => byBack.set(h.back, [...(byBack.get(h.back) ?? []), ...w.backs[i]]));
    for (const [c, ts] of byBack) B.add(geom(tris(ts)), c as never);
  }
  FACES = [];
}
type Win = {depth?: number; back?: Col; frame?: Col; cols?: number; transoms?: number[]; arch?: boolean; rise?: number; edge?: number};
/** Opening centred on x (face coordinate T or s), sill y, width w, head/apex y + h; frame members in the reveal. */
function win(F: Face, x: number, y: number, w: number, h: number, o: Win = {}) {
  const depth = o.depth ?? 0.22, frame = o.frame ?? 'frame', fw = o.edge ?? 0.08, d = Math.min(0.08, depth - 0.03), out = -depth;
  const t = F.loc(x);
  const cut: Cut = {t0: t - w / 2, t1: t + w / 2, y0: y, y1: y + h, depth, back: o.back ?? 'glass', ...(o.rise ? {rise: o.rise, segments: 8} : o.arch ? {arch: 0.5, segments: 9} : {arch: 0})};
  F.cuts.push(cut);
  if (fw <= 0) return cut;
  const sink0 = getSink();
  setSink(0); // frame members stand on the opening's back, never through it
  const top = o.arch || o.rise ? springing(cut) : y + h;
  ledgeStrip(B, F, t, y, w, fw, d, frame, out);
  if (!o.arch && !o.rise) ledgeStrip(B, F, t, top - fw, w, fw, d, frame, out);
  for (const s of [-1, 1]) ledgeStrip(B, F, t + s * (w - fw) / 2, y + fw, fw, top - y - fw - (o.arch || o.rise ? 0 : fw), d, frame, out);
  const cols = o.cols ?? 1;
  for (let k = 1; k < cols; k++) {
    const tc = t - w / 2 + w * k / cols;
    ledgeStrip(B, F, tc, y + fw, 0.07, headAt(cut, tc) - y - fw - 0.02, d, frame, out);
  }
  for (const yb of o.transoms ?? []) ledgeStrip(B, F, t, yb - 0.035, w - 2 * fw, 0.07, d, frame, out);
  if (o.arch || o.rise) ledgeStrip(B, F, t, top - 0.035, w - 2 * fw, 0.07, d, frame, out);
  setSink(sink0);
  return cut;
}

/** Mansard / attic polygons (pts in t, y, o) into one geometry per colour. */
function polys(f: Frame, ps: MansardPoly[], c: Col) {
  const pos: number[] = [];
  for (const p of ps) for (let i = 1; i + 1 < p.pts.length; i++) for (const v of [p.pts[0], p.pts[i], p.pts[i + 1]]) pos.push(...world(f, v));
  if (pos.length) B.add(geom(pos), c as never);
}

// ---- shell colours ------------------------------------------------------------------------------------------------------
const Tof = (x: number, z: number) => -((x - P29[0]) * U[0] + (z - P29[1]) * U[1]);
const offR = (x: number, z: number) => (x - P29[0]) * NR[0] + (z - P29[1]) * NR[1];
const offN = (x: number, z: number) => (x - P29[0]) * NN[0] + (z - P29[1]) * NN[1];
function wallColour(s: Surface): Col {
  const r = s.rings[0], cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  if (Math.abs(offR(cx, cz)) < 1.5 && Tof(cx, cz) > -0.5 && Tof(cx, cz) < 29.6 && Math.abs(offN(cx, cz)) > 0.3) {
    const t = Tof(cx, cz);
    return t < 9.28 ? 'slate' : t < 16.15 ? 'brick' : 'pink';
  }
  return 'copper';
}

/**
 * The 3DBAG reads the Riche's mansard and dormer as walls rising to 20-21 m in the front plane; both frontal crops show the
 * slate meeting the sky at about 19 m with only the dormer above it. Shell vertices behind the Riche front (T -0.5..9.4, up to
 * 3 m in) are lowered to 19.2 m at the front line rising 0.8 m per metre inwards (never raised), so the mansard's top meets
 * the roof and the shell no longer stands 1-2 m above the cornice line as a dark wall.
 */
function lowerRicheRoof(s: Surface): Surface {
  return {...s, rings: s.rings.map(r => r.map(p => {
    const t = Tof(p[0], p[2]), o = offR(p[0], p[2]);
    if (t < -0.5 || t > 9.4 || o < -3 || p[1] <= 19.2) return p;
    return [p[0], Math.min(p[1], 19.2 + Math.max(0, -o) * 0.8), p[2]];
  }))};
}

export function buildCafeRicheRokin(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, {...src, surfaces: src.surfaces.map(lowerRicheRoof)} as never, {wall: 'copper', roof: 'green', wallFor: s => wallColour(s)});
  const sink0 = getSink();
  setSink(0.04);
  riche();
  richeNorth();
  rockInn();
  rokin86();
  office();
  flushFaces();
  setSink(sink0);
}

// ================================ the Riche front (Rokin 84) ============================================================
const BAY = [1.72, 3.72, 5.72];
const DB = 7.92; // the door bay, between its pilasters (T 6.56-7.17 and 8.71-9.28)
const ALL4 = [...BAY, DB];
const TS = 9.28, TN = -0.3; // the north end runs 0.3 past the corner to meet the side's face plane
const SPRING = 4.98, ARCH_R = 0.67, DOOR_SPRING = 3.27, DOOR_HALF = 0.6;
const F1 = [7.22, 9.68] as const, F2 = [11.0, 13.36] as const;

function riche() {
  const plinth = face(rokin(TN, TS, 0.38), 0, 2.14, 'stone');
  const rustic = face(rokin(TN, TS, 0.34), 2.14, 6.3, 'greyBrick');
  const upper = face(rokin(TN, TS, 0.34), 6.3, 16.85, 'sandstone');

  // granite plinth with three basement lights (2025: x 17-62 px under each arch, y 940-978)
  for (const c of BAY) win(plinth, c, 0.68, 0.9, 0.76, {depth: 0.16, frame: 'white', cols: 2, edge: 0.06});
  win(plinth, DB, 0, 1.2, 2.14, {depth: 0.42, back: 'ochre', edge: 0});
  ledgeStrip(B, plinth, plinth.loc((TN + TS) / 2), 2.08, TS - TN, 0.08, 0.06, 'stone', 0);

  // rusticated ground storey: three round-arched windows, the door's arched head, the mezzanine light
  for (const c of BAY) {
    win(rustic, c, 2.3, 2 * ARCH_R, SPRING + ARCH_R - 2.3, {arch: true, depth: 0.28, cols: 2});
    // wooden lower panel behind an iron rail (2.3-3.06)
    slab(B, rustic, rustic.loc(c), 2.3, 2 * ARCH_R, 0.76, 0.05, 'frame', -0.23);
    rail(rustic, c, 2.3, 2 * ARCH_R - 0.1, 0.76, -0.08);
  }
  win(rustic, DB, 2.14, 2 * DOOR_HALF, DOOR_SPRING + DOOR_HALF - 2.14, {arch: true, depth: 0.38, back: 'ochre', edge: 0});
  win(rustic, DB, 5.45, 0.66, 0.75, {depth: 0.15, cols: 2});
  rustication(rustic);
  for (const c of BAY) {
    voussoirs(rustic, c, SPRING, ARCH_R + 0.02, ARCH_R + 0.44, 9);
    // carved keystone mask (2025: x 95-125 px zoomed / 2.4, y 695-726)
    slab(B, rustic, rustic.loc(c), 5.62, 0.42, 0.68, 0.16, 'sandstone');
    put(B, rustic, new T.SphereGeometry(0.15, 8, 6).scale(1, 1.2, 0.7), rustic.loc(c), 5.98, 0.18, 'sandstone');
  }
  voussoirs(rustic, DB, DOOR_SPRING, DOOR_HALF + 0.02, DOOR_HALF + 0.3, 7);
  door(rustic);
  // door-bay pilasters, rusticated, from the pavement to the ground cornice
  for (const [a, c] of [[6.56, 7.17], [8.71, 9.28]]) {
    slab(B, rustic, rustic.loc((a + c) / 2), 0, c - a, 6.3, 0.2, 'sandstone');
    for (let y = 0.6; y < 6.2; y += 0.6) slab(B, rustic, rustic.loc((a + c) / 2), y, c - a + 0.02, 0.04, 0.17, 'greyBrick');
  }
  // the ground cornice and the band of relief panels under the first storey
  slab(B, upper, upper.loc((TN + TS) / 2), 6.3, TS - TN, 0.2, 0.25, 'sandstone');
  for (const c of ALL4) {
    slab(B, upper, upper.loc(c), 6.58, 1.45, 0.56, 0.05, 'greyBrick');
    for (const dx of [-0.45, 0, 0.45]) diamond(upper, c + dx, 6.86, 0.2, 0.09);
    slab(B, upper, upper.loc(c), 6.84, 1.2, 0.05, 0.11, 'sandstone');
  }
  // first storey: windows with stone architraves; carved consoles between them carry the balcony corbels
  for (const c of ALL4) {
    win(upper, c, F1[0], 1.33, F1[1] - F1[0], {depth: 0.25, cols: 2, transoms: [9.05]});
    architrave(upper, c, F1[0], 1.33, F1[1] - F1[0]);
  }
  for (const [c, w] of [[0.32, 0.72], [2.72, 0.42], [4.72, 0.42], [6.86, 0.5], [9.0, 0.5]] as const) {
    slab(B, upper, upper.loc(c), 6.5, w + 0.1, 0.72, 0.14, 'sandstone'); // pedestal in the relief band
    slab(B, upper, upper.loc(c), 7.22, w, 2.68, 0.12, 'sandstone');
    slab(B, upper, upper.loc(c), 9.9, w * 0.85, 0.4, 0.36, 'sandstone');
    slab(B, upper, upper.loc(c), 10.3, w, 0.36, 0.62, 'sandstone');
    put(B, upper, new T.SphereGeometry(0.11, 8, 6).scale(1, 1.3, 0.8), upper.loc(c), 10.05, 0.4, 'sandstone');
  }
  balcony(upper);
  // second storey: windows between engaged Corinthian columns, corner piers with relief panels
  for (const c of ALL4) win(upper, c, F2[0], 1.16, F2[1] - F2[0], {depth: 0.25, cols: 2, transoms: [12.75]});
  for (const c of [2.72, 4.72, 6.86]) column(upper, c);
  for (const [a, c] of [[TN, 0.72], [8.62, TS]]) {
    const m = (a + c) / 2, w = c - a;
    slab(B, upper, upper.loc(m), 10.95, w, 3.95, 0.1, 'sandstone');
    slab(B, upper, upper.loc(m), 11.3, w - 0.24, 3.2, 0.05, 'greyBrick', 0.1);
    slab(B, upper, upper.loc(m), 11.45, 0.14, 2.9, 0.05, 'sandstone', 0.15);
    for (const y of [11.8, 12.6, 13.4, 14.1]) diamond(upper, m, y, 0.26, 0.2);
  }
  // oval oculi in carved cartouches over every window (2025: centre y 323 px, r 15 px; shell crest above)
  for (const c of ALL4) {
    const t = upper.loc(c);
    ringSlab(B, upper, t, 13.86, 0.27, 0.38, 0.12, 'sandstone', 0, 14);
    put(B, upper, new T.CylinderGeometry(0.27, 0.27, 0.05, 14).rotateX(Math.PI / 2).scale(1, 0.9, 1).translate(0, 0, 0.025), t, 13.86, 0.02, 'concrete');
    archSlab(B, upper, t, 14.2, 0.5, 0.3, 0.1, 'sandstone', 0.04, 4);
    for (const s of [-1, 1]) put(B, upper, new T.SphereGeometry(0.1, 6, 4), t + s * 0.44, 13.66, 0.06, 'sandstone');
  }
  // entablature: architrave, garland frieze, dentils, modillions, corona and crown (cornice top 16.85)
  const mid = upper.loc((TN + TS) / 2), W = TS - TN;
  slab(B, upper, mid, 14.9, W, 0.15, 0.16, 'sandstone');
  slab(B, upper, mid, 15.05, W, 0.7, 0.08, 'sandstone');
  for (let x = TN + 0.35; x < TS - 0.2; x += 0.62) swag(upper, x, 15.42);
  slab(B, upper, mid, 15.75, W, 0.2, 0.3, 'sandstone');
  for (let x = TN + 0.1; x < TS - 0.05; x += 0.17) slab(B, upper, upper.loc(x), 15.95, 0.09, 0.15, 0.42, 'sandstone');
  slab(B, upper, mid, 15.95, W, 0.15, 0.3, 'greyBrick');
  for (let x = TN + 0.2; x < TS - 0.1; x += 0.45) slab(B, upper, upper.loc(x), 16.1, 0.16, 0.22, 0.66, 'sandstone');
  slab(B, upper, mid, 16.1, W, 0.22, 0.32, 'greyBrick');
  slab(B, upper, mid, 16.32, W, 0.28, 0.78, 'sandstone');
  slab(B, upper, mid, 16.6, W, 0.25, 0.84, 'sandstone');
  // red markiezen: valances with side drapes on the upper windows, the arch cloth on the ground windows
  for (const c of ALL4) {
    upperAwning(upper, c, 1.33, F1[1], 1.1);
    upperAwning(upper, c, 1.16, F2[1], 1.4);
  }
  for (const c of BAY) archAwningOn(B, rustic, {t: rustic.loc(c), ySpring: SPRING, r: ARCH_R + 0.03, segs: 9, proj: 0.24, drop: 0.1, valance: 0.13, scallop: 0.05, legs: 0.6, colours: ['red', 'red']});
  mansard();
}

/** Rusticated courses, V-jointed (blocks 4 cm apart on the darker joint face), cut round the openings and voussoir rings. */
function rustication(F: Face) {
  const course = (6.3 - 2.16) / 7;
  for (let k = 0; k < 7; k++) {
    const y0 = 2.16 + k * course, y1 = y0 + course - 0.04;
    const cuts: [number, number][] = [];
    for (const c of BAY) {
      const h = Math.max(0, y0 - SPRING), Ro = ARCH_R + 0.46;
      if (y1 > 2.3 && h < Ro) cuts.push([c - (y0 > SPRING ? Math.sqrt(Ro * Ro - h * h) : ARCH_R + 0.02), c + (y0 > SPRING ? Math.sqrt(Ro * Ro - h * h) : ARCH_R + 0.02)]);
    }
    { const h = Math.max(0, y0 - DOOR_SPRING), Ro = DOOR_HALF + 0.32; if (h < Ro) { const hw = y0 > DOOR_SPRING ? Math.sqrt(Ro * Ro - h * h) : DOOR_HALF + 0.02; cuts.push([DB - hw, DB + hw]); } }
    if (y1 > 5.3) cuts.push([DB - 0.5, DB + 0.5]);
    cuts.push([6.56, 7.17], [8.71, 9.28]);
    cuts.sort((p, q) => p[0] - q[0]);
    let p0 = TN, stagger = k % 2 ? 0.5 : 0;
    for (const [c0, c1] of [...cuts, [TS, TS] as [number, number]]) {
      if (c0 - p0 > 0.08) {
        const n = Math.max(1, Math.round((c0 - p0) / 1.0)), seg = (c0 - p0) / n;
        let a = p0;
        for (let i = 0; i < n; i++) {
          const e = i === n - 1 ? c0 : Math.min(c0, a + seg + (i === 0 ? stagger - 0.25 : 0));
          if (e - a > 0.1) slab(B, F, F.loc((a + e) / 2), y0, e - a - 0.04, y1 - y0, 0.06, 'sandstone');
          a = e;
        }
      }
      p0 = Math.max(p0, c1);
    }
  }
}

/** Radiating wedge blocks round an arch head (centre x, springing y), r0..r1, n stones. */
function voussoirs(F: Face, x: number, ys: number, r0: number, r1: number, n: number) {
  const rm = (r0 + r1) / 2, tw = Math.PI * rm / n - 0.04;
  for (let k = 0; k < n; k++) {
    const a = Math.PI * (k + 0.5) / n;
    const g = new T.BoxGeometry(tw, r1 - r0, 0.07).translate(0, 0, 0.035).rotateZ(a - Math.PI / 2);
    put(B, F, g, F.loc(x) + Math.cos(a) * rm, ys + Math.sin(a) * rm, 0, 'sandstone');
  }
}

function door(F: Face) {
  const t = F.loc(DB);
  // varnished double door: raised panels, meeting stile (the leaves stand in the 0.6 m recess)
  for (const s of [-1, 1]) for (const [y0, y1] of [[0.3, 1.5], [1.8, 3.0]]) slab(B, F, t + s * 0.3, y0, 0.4, y1 - y0, 0.03, 'ochre', -0.35);
  slab(B, F, t, 0, 0.05, 3.2, 0.04, 'bronze', -0.35);
  // carved hood with scrolls over the door, the framed mezzanine light, scrolls either side
  slab(B, F, t, 4.0, 1.7, 0.95, 0.2, 'sandstone');
  slab(B, F, t, 4.95, 1.9, 0.18, 0.28, 'sandstone');
  for (const s of [-1, 1]) disc(B, F, t + s * 0.82, 4.35, 0.17, 0.1, 'sandstone', 0.2);
  for (const s of [-1, 1]) slab(B, F, t + s * 0.42, 5.4, 0.12, 0.85, 0.12, 'sandstone');
  slab(B, F, t, 6.17, 0.96, 0.12, 0.12, 'sandstone');
  for (const s of [-1, 1]) disc(B, F, t + s * 0.62, 5.75, 0.14, 0.08, 'sandstone', 0.04);
  // wall lamp beside the door (2025 aimed view: x 215 px, y 690)
  slab(B, F, F.loc(6.4), 3.0, 0.16, 0.35, 0.3, 'bronze', 0.18);
}

/** Black iron rail (top and bottom rails, bars at 0.12 m), centred on x. */
function rail(F: Face, x: number, y: number, w: number, h: number, out: number) {
  const t = F.loc(x);
  slab(B, F, t, y + h - 0.05, w, 0.05, 0.04, 'bronze', out);
  slab(B, F, t, y + 0.06, w, 0.04, 0.04, 'bronze', out);
  const n = Math.max(2, Math.round(w / 0.12));
  for (let k = 0; k <= n; k++) slab(B, F, t - w / 2 + w * k / n, y, 0.02, h, 0.02, 'bronze', out + 0.01);
}

function architrave(F: Face, x: number, y: number, w: number, h: number) {
  const t = F.loc(x);
  for (const s of [-1, 1]) slab(B, F, t + s * (w / 2 + 0.06), y, 0.12, h + 0.12, 0.05, 'sandstone');
  slab(B, F, t, y + h, w + 0.24, 0.12, 0.06, 'sandstone');
  slab(B, F, t, y - 0.1, w + 0.3, 0.1, 0.12, 'sandstone');
}

function diamond(F: Face, x: number, y: number, s: number, out: number) {
  put(B, F, new T.BoxGeometry(s, s, 0.05).translate(0, 0, 0.025).rotateZ(Math.PI / 4), F.loc(x), y, out, 'sandstone');
}

/** A garland swag: two tilted strips meeting under a rosette. */
function swag(F: Face, x: number, y: number) {
  const t = F.loc(x);
  for (const s of [-1, 1]) put(B, F, new T.BoxGeometry(0.3, 0.07, 0.05).translate(0, 0, 0.025).rotateZ(s * 0.35), t + s * 0.14, y - 0.05, 0.08, 'sandstone');
  put(B, F, new T.BoxGeometry(0.1, 0.1, 0.05).translate(0, 0, 0.025).rotateZ(Math.PI / 4), t + 0.31, y + 0.12, 0.08, 'sandstone');
}

/** The long iron balcony across the front on its corbels: slab, rails, bars, posts and end returns. */
function balcony(F: Face) {
  const mid = F.loc((TN + TS) / 2), W = TS - TN, P = 0.78;
  slab(B, F, mid, 10.66, W, 0.29, 0.86, 'sandstone');
  slab(B, F, mid, 10.6, W, 0.06, 0.8, 'greyBrick');
  slab(B, F, mid, 11.75, W, 0.06, 0.05, 'bronze', P);
  slab(B, F, mid, 11.0, W, 0.05, 0.04, 'bronze', P);
  slab(B, F, mid, 11.4, W, 0.03, 0.03, 'bronze', P);
  const n = Math.round(W / 0.115);
  for (let k = 0; k <= n; k++) slab(B, F, F.loc(TN) - W * k / n, 10.95, 0.02, 0.8, 0.02, 'bronze', P + 0.01);
  for (const c of [0.32, 2.72, 4.72, 6.86, 9.0]) slab(B, F, F.loc(c), 10.95, 0.06, 0.86, 0.06, 'bronze', P - 0.01);
  for (const x of [TN + 0.03, TS - 0.03]) {
    slab(B, F, F.loc(x), 11.75, 0.04, 0.06, P, 'bronze', 0);
    for (let k = 1; k <= 5; k++) slab(B, F, F.loc(x), 10.95, 0.02, 0.8, 0.02, 'bronze', P * k / 6);
  }
}

function column(F: Face, x: number) {
  const t = F.loc(x);
  slab(B, F, t, 10.95, 0.56, 0.3, 0.5, 'sandstone');
  put(B, F, new T.CylinderGeometry(0.19, 0.21, 3.15, 12).translate(0, 3.15 / 2, 0), t, 11.25, 0.14, 'sandstone');
  slab(B, F, t, 14.4, 0.5, 0.3, 0.46, 'sandstone');
  slab(B, F, t, 14.7, 0.64, 0.2, 0.54, 'sandstone');
}

/** Red markies over a square-headed window: scalloped valance, cheeks, and the side drapes hanging in the opening. */
function upperAwning(F: Face, x: number, w: number, top: number, drape: number) {
  const tl = F.loc(x + w / 2), tr = F.loc(x - w / 2), y = top + 0.06;
  stripedAwningOn(B, F, {head: [[tl - 0.05, 0], [tr + 0.05, 0]], proj: 0.3, yHead: y, drop: 0.2, stripe: 0.2, valance: 0.16, scallop: 0.06, cheeks: true, cheekHem: y - 0.55, colours: ['red', 'red']});
  for (const s of [-1, 1]) {
    const t = F.loc(x) + s * (w / 2 - 0.1);
    slab(B, F, t, y - drape, 0.15, drape - 0.1, 0.03, 'red', -0.02);
    slab(B, F, t - s * 0.02, y - drape - 0.3, 0.09, 0.3, 0.03, 'red', -0.02);
  }
}

/** Slate mansard over the cornice with the white dormer pavilion (two arched windows, cornice, attic with 1883, crest). */
function mansard() {
  const fr = rokin(-0.6, TS, 0);
  const d0 = fr.loc(6.5), d1 = fr.loc(2.9);
  const opts = {yFoot: 16.85, oFoot: 0.6, yTop: 19.2, depth: 0.6};
  const run = mansardDormers(fr.len, {...opts, dormers: [{t0: d0, t1: d1, top: 19.0, front: 0.78}], capOverhang: 0.14, capThickness: 0.2});
  polys(fr, run.slope, 'slate');
  polys(fr, run.cheeks, 'concrete');
  polys(fr, run.caps, 'concrete');
  polys(fr, [mansardEnd(0, -1, opts)], 'slate');
  const f = run.fronts[0];
  const df: Fr = {origin: [fr.origin[0] + NR[0] * f.o + U[0] * f.t0, fr.origin[1] + NR[1] * f.o + U[1] * f.t0], tangent: U, n: NR, len: f.t1 - f.t0, loc: x => fr.loc(x) - f.t0};
  const D = face(df, f.y0, f.y1, 'concrete');
  for (const c of [5.25, 4.15]) win(D, c, 16.95, 0.6, 0.85, {arch: true, depth: 0.16, cols: 2});
  const tc = D.loc(4.7), half = (d1 - d0) / 2;
  for (const s of [-1, 1]) {
    slab(B, D, tc + s * (half - 0.15), f.y0, 0.3, 19.0 - f.y0, 0.1, 'concrete');
    // scrolled volutes at the dormer's foot
    const sc: [number, number][] = s < 0 ? [[0, 0], [-0.45, 0], [0, 0.9]] : [[0, 0], [0, 0.9], [0.45, 0]];
    poly(B, D, tc + s * half, f.y0, sc, 0.3, 'concrete', -0.32);
  }
  // attic, the date, segmental crest, urns
  slab(B, D, tc, 19.2, 2.6, 0.7, 0.62, 'concrete', -0.5);
  letters(B, D, '1883', tc, 19.38, 0.12, 0.032, 0.02, 'bronze');
  segBand(B, D, tc, 19.9, 1.6, 0.35, 0.3, 0.4, 'concrete', -0.3);
  slab(B, D, tc, 19.9, 1.0, 0.25, 0.4, 'concrete', -0.3);
  slab(B, D, tc, 20.25, 0.18, 0.3, 0.18, 'concrete', -0.18);
  put(B, D, new T.SphereGeometry(0.11, 8, 6), tc, 20.62, -0.1, 'concrete');
  for (const s of [-1, 1]) {
    put(B, D, new T.CylinderGeometry(0.1, 0.07, 0.3, 8).translate(0, 0.15, 0), tc + s * (half - 0.15), 19.2, 0.0, 'concrete');
    put(B, D, new T.SphereGeometry(0.1, 8, 6), tc + s * (half - 0.15), 19.6, 0.0, 'concrete');
  }
}

// ================================ the Riche's return on the side lane ====================================================
function richeNorth() {
  const a = -0.42, b = 2.8;
  const plinth = face(north(a, b, 0.34), 0, 2.14, 'stone');
  const wall = face(north(a, b, 0.3), 2.14, 16.85, 'copper');
  // w01-9 (2016, 45 deg): one window axis at s 1.65-2.55 beside the stone corner quoins
  win(plinth, 2.1, 0.9, 0.7, 0.7, {depth: 0.14, frame: 'white', edge: 0.05});
  win(wall, 2.1, 3.0, 0.9, 2.6, {arch: true, depth: 0.18, cols: 2});
  win(wall, 2.1, 7.4, 0.9, 2.3, {depth: 0.18, cols: 2, transoms: [9.1]});
  win(wall, 2.1, 11.3, 0.9, 2.0, {depth: 0.18, cols: 2});
  for (let k = 0, y = 2.14; y < 16.2; k++, y += 0.6) slab(B, wall, wall.loc(a + (k % 2 ? 0.25 : 0.4)), y, k % 2 ? 0.55 : 0.8, 0.56, 0.06, 'sandstone');
  for (const [y, h, d] of [[6.3, 0.2, 0.25], [10.66, 0.29, 0.14], [14.9, 0.85, 0.12], [15.75, 0.57, 0.3], [16.32, 0.28, 0.78], [16.6, 0.25, 0.84]]) slab(B, wall, wall.loc((a + b) / 2), y, b - a, h, d, 'sandstone');
  const fr = north(-0.6, b, 0), opts = {yFoot: 16.85, oFoot: 0.6, yTop: 19.2, depth: 0.6};
  const run = mansardDormers(fr.len, opts);
  polys(fr, run.slope, 'slate');
  polys(fr, [mansardEnd(fr.len, 1, opts)], 'slate');
}

// ================================ the Rock Inn: brick office over a stone arcade (side lane) =============================
function rockInn() {
  const g = face(north(2.8, 32.15, 0.3), 0, 8.6, 'blue');
  const arches: [number, number, number, number][] = [[3.3, 11.9, 7.6, 1.4], [15.6, 27.6, 7.6, 1.6], [29.6, 31.95, 7.0, 0.5]];
  for (const [a, c, top, rise] of arches) {
    const cut = win(g, (a + c) / 2, 0.3, c - a, top - 0.3, {rise, depth: 0.12, frame: 'bronze', edge: 0.1, transoms: [4.4]});
    // shopfront: the fascia board at the transom and mullions in the fanlight and the glazing
    slab(B, g, g.loc((a + c) / 2), 3.85, c - a - 0.2, 0.55, 0.06, 'bronze', -0.1);
    const n = Math.max(1, Math.round((c - a) / 1.1));
    for (let k = 1; k < n; k++) {
      const t = cut.t0 + (cut.t1 - cut.t0) * k / n;
      ledgeStrip(B, g, t, 0.4, 0.07, headAt(cut, t) - 0.45, 0.05, 'bronze', -0.1);
    }
  }
  slab(B, g, g.loc(17.5), 8.2, 29.35, 0.4, 0.25, 'blue');
  // the lion with a shield on a corbel over the pier between the first two arches (w01-9: x 600-720 px)
  const t = g.loc(13.75);
  slab(B, g, t, 7.2, 1.1, 1.0, 0.35, 'blue');
  slab(B, g, t, 8.6, 0.9, 0.5, 0.55, 'blue');
  slab(B, g, t, 9.1, 0.7, 1.2, 0.45, 'blue', 0.05);
  put(B, g, new T.SphereGeometry(0.22, 8, 6), t, 10.45, 0.35, 'blue');
  slab(B, g, t, 9.2, 0.55, 0.75, 0.06, 'blue', 0.5);
  // brick storeys: three wall tops (3DBAG 19.3 to s 20.83, 18.5 to 28.04, 16.2 to the west end)
  const parts: [number, number, number][] = [[2.8, 20.83, 19.3], [20.83, 28.04, 18.5], [28.04, 32.15, 16.2]];
  const cols: [number, number][] = [[5.0, 0.8], [7.6, 1.9], [10.2, 0.8], [13.75, 0.8], [16.5, 0.8], [18.6, 1.9], [20.2, 0.8], [22.3, 0.8], [24.4, 1.9], [26.5, 0.8], [30.8, 0.8]];
  const rows: [number, number][] = [[9.2, 12.0], [12.8, 15.0], [15.8, 17.6]];
  for (const [a, c, top] of parts) {
    const F = face(north(a, c, 0.3), 8.6, top, 'copper');
    for (const [x, w] of cols) {
      if (x - w / 2 < a + 0.2 || x + w / 2 > c - 0.2) continue;
      rows.forEach(([y0, y1], r) => {
        if (y1 > top - 0.5 || (x === 13.75 && r === 0)) return;
        win(F, x, y0, w, y1 - y0, {depth: 0.14, frame: 'white', cols: w > 1.5 ? 3 : 1, transoms: [y0 + (y1 - y0) * 0.72]});
        slab(B, F, F.loc(x), y0 - 0.14, w + 0.2, 0.14, 0.12, 'blue');
        slab(B, F, F.loc(x), y1, w + 0.1, 0.16, 0.06, 'blue');
      });
    }
    for (const q of [2.8, 12.1, 15.4, 27.8, 29.4]) if (q > a && q < c) for (let k = 0, y = 8.6; y < top - 0.4; k++, y += 0.55) slab(B, F, F.loc(q + (k % 2 ? 0.1 : 0.2)), y, k % 2 ? 0.4 : 0.6, 0.5, 0.05, 'blue');
    slab(B, F, F.loc((a + c) / 2), top - 0.3, c - a, 0.3, 0.25, 'blue');
  }
}

// ================================ Rokin 86 ==============================================================================
function rokin86() {
  const a = 9.28, c = 16.15;
  const g = face(rokin(a, c, 0.22), 0, 5.7, 'stone');
  win(g, 10.29, 0, 0.78, 2.7, {depth: 1.2, back: 'ochre', edge: 0});
  win(g, 10.3, 2.9, 0.9, 1.7, {depth: 0.18, frame: 'white', edge: 0.05});
  win(g, 13.22, 0.3, 4.3, 4.5, {depth: 0.12, back: 'gold', frame: 'white', edge: 0.05});
  slab(B, g, g.loc(12.4), 0.9, 0.55, 0.9, 0.12, 'gold'); // the two cash machines in the orange panel (w03-103: x 300-335, 380-420)
  slab(B, g, g.loc(14.0), 0.9, 0.55, 0.9, 0.12, 'gold');
  const F = face(rokin(a, c, 0.22), 5.7, 14.1, 'brick');
  const COLS = [10.8, 12.85, 14.9], ROWS: [number, number][] = [[5.9, 8.24], [8.74, 11.04], [11.74, 13.54]];
  for (const x of COLS) ROWS.forEach(([y0, y1], r) => {
    win(F, x, y0, 1.4, y1 - y0, {depth: 0.15, frame: 'white', cols: 2, transoms: [y0 + (y1 - y0) * 0.74], edge: 0.1});
    slab(B, F, F.loc(x), y0 - 0.1, 1.6, 0.1, 0.1, 'concrete');
    if (x === 12.85) rail(F, x, y0, 1.45, 0.9, 0.05);
    if ((x === 12.85 && r > 0) || (x === 14.9 && r === 0)) {
      const tl = F.loc(x + 0.72), tr = F.loc(x - 0.72);
      stripedAwningOn(B, F, {head: [[tl, 0], [tr, 0]], proj: 0.25, yHead: y1 + 0.02, drop: 0.14, stripe: 0.2, valance: 0.12, colours: ['red', 'red']});
    }
  });
  segBand(B, F, F.loc(12.85), 13.62, 1.7, 0.4, 0.15, 0.08, 'concrete');
  // white cornice on brackets and the roof balustrade (w03-103: y 225-310)
  const m = F.loc((a + c) / 2), W = c - a;
  slab(B, F, m, 14.04, W, 0.26, 0.15, 'concrete');
  for (let x = a + 0.3; x < c - 0.1; x += 0.7) slab(B, F, F.loc(x), 14.1, 0.14, 0.3, 0.32, 'concrete');
  slab(B, F, m, 14.4, W, 0.2, 0.36, 'concrete');
  slab(B, F, m, 14.6, W, 0.24, 0.42, 'concrete');
  const lay = balustrade({width: W - 0.2, height: 0.9, post: 0.26, plinth: 0.12, rail: 0.12, baluster: 0.1, pitch: 0.2, bays: 3});
  for (const p of lay.posts) slab(B, F, m + p.x, 14.84 + p.y, p.w, p.h, 0.3, 'concrete', 0.06);
  for (const k of lay.balusters) slab(B, F, m + k.x, 14.84 + k.y, k.w, k.h, 0.12, 'concrete', 0.15);
  slab(B, F, m, 14.84, W - 0.2, 0.12, 0.3, 'concrete', 0.06);
  slab(B, F, m, 15.62, W - 0.1, 0.12, 0.34, 'concrete', 0.04);
}

// ================================ Rokin 88-90 ===========================================================================
function office() {
  const a = 16.15, c = 29.4;
  const g = face(rokin(a, c, 0.22), 0, 5.4, 'stone');
  win(g, 17.4, 0.4, 1.25, 4.1, {depth: 0.12, frame: 'white', edge: 0.06});
  win(g, 19.9, 0, 2.4, 4.5, {depth: 0.15, frame: 'white', cols: 2, transoms: [3.4], edge: 0.06});
  win(g, 22.6, 0, 1.9, 3.6, {depth: 1.4, frame: 'white', cols: 2, edge: 0.06});
  win(g, 25.62, 0.4, 2.95, 4.1, {depth: 0.12, frame: 'white', edge: 0.06});
  win(g, 28.45, 0, 1.1, 2.5, {depth: 0.1, back: 'bronze', edge: 0});
  const F = face(rokin(a, c, 0.22), 5.4, 15.75, 'pink');
  const BAYO = [17.44, 19.49, 21.75, 24.0, 26.26, 28.34];
  const ROWS: [number, number][] = [[6.4, 8.5], [9.7, 11.6], [12.8, 14.7]];
  for (const x of BAYO) {
    for (const [y0, y1] of ROWS) {
      win(F, x, y0, 1.4, y1 - y0, {depth: 0.15, frame: 'white', transoms: [y1 - 0.3], edge: 0.06});
      spandrel(F, x, y0 - 0.55);
    }
    spandrel(F, x, 14.95);
  }
  const PIERS = [16.45, 18.47, 20.62, 22.88, 25.13, 27.3, 29.1];
  for (const x of PIERS) slab(B, F, F.loc(x), 5.4, 0.42, 10.35, 0.1, 'pink');
  slab(B, F, F.loc((a + c) / 2), 5.4, c - a, 0.2, 0.14, 'pink');
  slab(B, F, F.loc((a + c) / 2), 15.75, c - a, 0.2, 0.22, 'pink');
  // the attic: raised stone bays over the second and fifth axes between peaked piers, slate mansard between them
  const fr = rokin(a, c, 0), opts = {yFoot: 15.95, oFoot: 0.44, yTop: 18.7, depth: 0.44};
  const dorm = [[18.47, 20.62], [25.13, 27.3]].map(([p, q]) => ({t0: fr.loc(q) + 0.21, t1: fr.loc(p) - 0.21, top: 18.4}));
  const run = mansardDormers(fr.len, {...opts, dormers: dorm, capOverhang: 0.06, capThickness: 0.15});
  polys(fr, run.slope, 'slate');
  polys(fr, run.cheeks, 'pink');
  polys(fr, run.caps, 'pink');
  polys(fr, [mansardEnd(0, -1, opts), mansardEnd(fr.len, 1, opts)], 'slate');
  run.fronts.forEach(f => {
    const df: Fr = {origin: [fr.origin[0] + NR[0] * f.o + U[0] * f.t0, fr.origin[1] + NR[1] * f.o + U[1] * f.t0], tangent: U, n: NR, len: f.t1 - f.t0, loc: x => fr.loc(x) - f.t0};
    const D = face(df, f.y0, f.y1, 'pink');
    const x = c - (f.t0 + f.t1) / 2;
    win(D, x, 16.0, 1.3, 1.4, {depth: 0.14, frame: 'white', edge: 0.06});
    spandrel(D, x, 17.6);
  });
  for (const x of [18.47, 20.62, 25.13, 27.3]) {
    slab(B, fr, fr.loc(x), 15.95, 0.42, 2.45, 0.56, 'pink');
    poly(B, fr, fr.loc(x), 18.4, [[-0.21, 0], [0.21, 0], [0, 0.45]], 0.56, 'pink');
  }
}

/** Light stone spandrel panel with three carved roundels (drawn as lozenges), centred on x, bottom y. */
function spandrel(F: Face, x: number, y: number) {
  const t = F.loc(x);
  slab(B, F, t, y, 1.45, 0.42, 0.04, 'pink');
  for (const dx of [-0.45, 0, 0.45]) put(B, F, new T.BoxGeometry(0.22, 0.22, 0.04).translate(0, 0, 0.02).rotateZ(Math.PI / 4), t + dx, y + 0.21, 0.04, 'pink');
}

