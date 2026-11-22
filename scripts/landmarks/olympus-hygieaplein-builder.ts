import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, letters, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './olympus-hygieaplein-footprints.json';

/**
 * Europaschool and Buurtcentrum Olympus, Hygiëaplein 8-10, Stadionbuurt (BAG pand 0363100012109215, BAG 1924; municipal
 * monument 222125 "Montessorischool", Dienst der Publieke Werken (N. Lansdorp), 1921-1923, built for the Christelijke
 * School Vereeniging Aeneas Mackay; later the Vincent van Gogh school/MAVO). OSM way 119458809 names the building Olympus;
 * the Europaschool (Hygiëaplein 8) and Buurtcentrum Olympus (Hygiëaplein 10, a Huis van de Wijk) use it today.
 *
 * Amsterdam School front to the square, three bays in buff brick under flat roofs: two plain three-storey side bays and a
 * middle bay set between two round stair towers. The towers are banded with projecting brick courses, carry curved
 * three-light stair windows on white sills and rise over the parapet in a toothed crown; tall piers with two iron spires
 * each flank the middle bay, whose parapet carries a row of brick teeth and whose ground floor projects as a one-storey
 * block on a dark purple-brown plinth with two wide windows under screen hoods. Every window is a white three-light school
 * window: three narrow panes over two large ones per light. White concrete canopies over the entrances at the tower feet,
 * the SW one with the red HUIS VAN DE WIJK sign; dark brick planter walls in front of the side bays.
 *
 * The front is straight in plan (the curved look of the panorama crops is their projection): edges 29, 7 and 17 of the
 * 3DBAG facade ring are collinear, so everything is placed in one front frame `u` (metres along the front from the SW
 * corner) and `n` (metres out of the side-bay wall plane). Measured from the BAG ring and the 3DBAG LoD2.2 shell:
 * towers R 1.25 m centred at u 17.14 / 35.54, n -0.12 (least-squares fit of the BAG arcs); the middle bay's ground-floor
 * projection front at n 1.44 (edge 7), u 18.64-34.0; its upper wall at n 0.2-0.57 in the shell (drawn as a brick face at
 * n 0.62). Heights from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) at 50 px/m, anchored on the 3DBAG parapet
 * (14.45 m over ground): w02-124 TMX7316010203-002459_pano_0003_000360 (2022) and b_20241105_1332_Track14_Sphere_00032
 * (2024, the SW bay), w03-122 TMX7316010203-002120_pano_0000_000401 (2021, the NE bay), w05-124
 * TMX7316010203-000777_pano_0000_002949 (2018) and recording_2025-07-29_12-06-07_02614 (2025, the middle bay); the towers,
 * canopies and sign from Commons "Europaschool, voorheen Vincent van Gogh MAVO, Hygieaplein 8 pic1-3" (Alf van Beem, CC0).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

let B: BuildingTools;
/** The front frame (edge 29's): t = u along the front from the SW corner, out = n. */
const F0: Frame = ringFrame(ring, 29).f;
const fr = (n: number): Frame => ({...F0, origin: [F0.origin[0] + F0.n[0] * n, F0.origin[1] + F0.n[1] * n]});
/** Native (x, z) of front coordinates (u, n). */
const at = (u: number, n: number): [number, number] => [F0.origin[0] + F0.tangent[0] * u + F0.n[0] * n, F0.origin[1] + F0.tangent[1] * u + F0.n[1] * n];

const TOWERS = [{c: [-4.7822, 7.8605] as [number, number], u: 17.14}, {c: [5.3444, -7.5024] as [number, number], u: 35.54}];
const R = 1.25;
/** Native angle (atan2 z, x) of the front's outward normal; the BAG arcs run 69.5 deg either side of it. */
const FRONT = Math.atan2(F0.n[1], F0.n[0]);
const ARC = (69.5 * Math.PI) / 180;

/** Storeys (y over the 3DBAG ground): side bays and middle bay. */
const GF: [number, number] = [1.6, 4.15], F1: [number, number] = [5.45, 8.0], F2: [number, number] = [9.65, 12.4];
const M1: [number, number] = [5.75, 8.2];
const PARAPET = 14.45, CONSOLE = 10.6, PROJ_TOP = 5.5;
const MID_N = 0.62, PROJ_N = 1.44, PROJ_U: [number, number] = [18.64, 34.0], MID_U: [number, number] = [18.13, 34.55];
const MID_C = (MID_U[0] + MID_U[1]) / 2;

export function buildOlympusHygieaplein(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, src as never, {wall: 'brick', roof: 'slate', wallFor: s => (onTower(s) ? 'sandstone' : 'brick')});
  const sink0 = getSink();
  setSink(0.12, true);
  sideBay(15.9, -1);
  sideBay(36.78, 1);
  middleBay();
  for (const t of TOWERS) tower(t.c);
  entrances();
  setSink(sink0);
}

/** A shell wall on one of the tower arcs (every vertex within 0.2 m of the circle). */
function onTower(s: Surface) {
  return TOWERS.some(t => s.rings[0].every(p => Math.abs(Math.hypot(p[0] - t.c[0], p[2] - t.c[1]) - R) < 0.2));
}

// ---- kit ------------------------------------------------------------------------------------------------------------

/** A bar standing on the pane's face (no sink). */
function bar(f: Frame, t: number, y: number, w: number, h: number, out: number) {
  const s0 = getSink();
  setSink(0);
  slab(B, f, t, y, w, h, 0.04, 'frame', out);
  setSink(s0, true);
}
/**
 * The school window of this building (w02-124 2024, w03-122, w05-124 2025, Commons pic3): a white frame of `lights` lights
 * between 10 cm mullions; each light has three narrow panes in its upper third over two large panes, a heavier transom
 * between them. Set 12 cm back in a brick reveal (jambs and head 0.2 m proud of the frame plane), on a brick sill.
 */
function schoolWindow(f: Frame, c: number, width: number, y0: number, y1: number, lights = 3, rv = 'brick') {
  const h = y1 - y0;
  slab(B, f, c, y0 - 0.05, width + 0.1, h + 0.1, 0.08, 'frame', 0);
  slab(B, f, c, y0 + 0.05, width - 0.1, h - 0.1, 0.05, 'glass', 0.08);
  const lw = (width - 0.1) / lights, t0 = c - width / 2;
  for (let k = 0; k < lights; k++) {
    const lt = t0 + 0.05 + lw * (k + 0.5);
    if (k > 0) bar(f, t0 + 0.05 + lw * k, y0 + 0.05, 0.13, h - 0.1, 0.13);
    const grid = paneGrid({width: lw - 0.1, height: h - 0.1, cols: 1, rows: 5, bar: 0.07, frame: 0, transomRows: [2], transom: 0.12, rowWeights: [0.34, 0.34, 0.107, 0.107, 0.107]});
    for (const m of grid) bar(f, lt + m.x, y0 + 0.05 + m.y, m.w, m.h, 0.13);
  }
  for (const s of [-1, 1]) slab(B, f, c + s * (width / 2 + 0.1), y0 - 0.05, 0.1, h + 0.15, 0.2, rv);
  slab(B, f, c, y1 + 0.05, width + 0.3, 0.1, 0.2, rv);
  slab(B, f, c, y0 - 0.15, width + 0.3, 0.1, 0.24, rv);
}
/** The parapet band laid with a lattice of darker headers (w02-124, w03-122, w05-124 2025): staggered dots on 0.22 m. */
function diaperBand(f: Frame, u0: number, u1: number, y0: number, y1: number) {
  const step = 0.44, rows = Math.floor((y1 - y0) / 0.22);
  for (let j = 0; j < rows; j++) {
    const off = j % 2 ? step / 2 : 0;
    for (let u = u0 + 0.15 + off; u < u1 - 0.15; u += step) ledgeStrip(B, f, u, y0 + j * 0.22, 0.12, 0.08, 0.025, 'ochre');
  }
}
/** Dark brick coping on a parapet top (rowlock), 6 cm proud. */
function coping(f: Frame, u0: number, u1: number, y: number, back = 0.3) {
  slab(B, {...f, origin: [f.origin[0] - f.n[0] * back, f.origin[1] - f.n[1] * back]}, (u0 + u1) / 2, y - 0.22, u1 - u0, 0.27, back + 0.06, 'greyBrick', 0);
}
/** A flat pier 12 cm proud from the ground to the console (a dark brick corbel block) at 10.6 m. */
function pier(f: Frame, u0: number, u1: number, top = CONSOLE, bottom = 0) {
  slab(B, f, (u0 + u1) / 2, bottom, u1 - u0, top - bottom, 0.12, 'brick');
  slab(B, f, (u0 + u1) / 2, top - 0.05, 0.34, 0.28, 0.26, 'greyBrick');
}

// ---- side bays ------------------------------------------------------------------------------------------------------

/**
 * A side bay, laid out from its tower edge (u `edge`) away from the tower (`dir` -1 for the SW bay, +1 for the NE bay):
 * tower pier 0.2-1.0 m, window 1.2-6.0 m, centre pier 6.2-8.1 m, window 8.3-13.2 m, end pier from 13.4 m to the bay end
 * (w02-124 2022/2024 measured from the SW tower's edge at 735 px; w03-122 from the NE tower at 15 px; the end of the NE bay
 * is hidden by the projecting neighbour block in the crop, its last 1.7 m read from the 3DBAG length). Three storeys of
 * three-light windows, the dark plinth, the parapet band and coping, and the dark brick planter wall in front.
 */
function sideBay(edge: number, dir: number) {
  const f = fr(0), u = (d: number) => edge + dir * d, span = (a: number, c: number): [number, number] => [Math.min(u(a), u(c)), Math.max(u(a), u(c))];
  const end = dir < 0 ? 0 : 52.6, endD = Math.abs(end - edge) - 0.07;
  const [b0, b1] = span(0, endD);
  slab(B, f, (b0 + b1) / 2, 0, b1 - b0, 1.45, 0.05, 'red');
  for (const [a, c] of [[0.2, 1.0], [6.2, 8.1], [13.4, endD]]) { const [p0, p1] = span(a, c); pier(f, p0, p1); }
  for (const [a, c] of [[1.2, 6.0], [8.3, 13.2]]) {
    const [w0, w1] = span(a, c);
    for (const [y0, y1] of [GF, F1, F2]) schoolWindow(f, (w0 + w1) / 2, w1 - w0, y0, y1);
  }
  diaperBand(f, b0, b1, 12.85, 14.15);
  coping(f, b0, b1, PARAPET);
  // planter wall 1.15-1.45 m out (w02-124, w03-122): dark brick, 0.85 m high, hedge behind it
  const [q0, q1] = span(1.4, endD - 0.6);
  slab(B, fr(1.15), (q0 + q1) / 2, 0, q1 - q0, 0.85, 0.3, 'red', 0);
  slab(B, fr(1.12), (q0 + q1) / 2, 0.85, q1 - q0, 0.06, 0.36, 'greyBrick', 0);
  slab(B, fr(0.05), (q0 + q1) / 2, 0, q1 - q0 - 0.4, 1.05, 1.05, 'green', 0);
}

// ---- middle bay -----------------------------------------------------------------------------------------------------

/**
 * The middle bay between the towers (w05-124 2018 and 2025, Commons pic3): the upper wall at n 0.62 with two three-light
 * windows per storey (centres 3.4 m either side of the bay centre, 4.9 m wide: 3.6 m in the 2018 crop, 3.3 m in Commons pic3, which also shows them a little wider apart than the projection windows) either side of a 1.8 m centre pier, the parapet
 * band and a row of brick teeth (14 in 14.9 m in the 2025 crop), the two spire piers; the one-storey projection to n 1.44
 * with its plinth, two wide windows under grey screen hoods, vent grilles and the name boards at its SW end.
 */
function middleBay() {
  const f = fr(MID_N), [m0, m1] = MID_U;
  slab(B, fr(0.2), MID_C, PROJ_TOP - 0.2, m1 - m0, PARAPET - PROJ_TOP - 0.05, MID_N - 0.2, 'brick', 0);
  for (const s of [-1, 1]) for (const [y0, y1] of [M1, F2]) schoolWindow(f, MID_C + s * 3.4, 4.9, y0, y1);
  pier(f, MID_C - 0.9, MID_C + 0.9, CONSOLE, PROJ_TOP);
  diaperBand(f, m0, m1, 12.85, 14.15);
  coping(f, m0, m1, PARAPET, MID_N - 0.2);
  // brick teeth on the coping, 0.26 wide, 0.3 high, on a 1.06 m pitch
  for (let u = m0 + 1.2; u < m1 - 1.0; u += 1.06) slab(B, f, u, PARAPET, 0.26, 0.3, 0.3, 'greyBrick', -0.24);
  // the two spire piers (w05-124 2025: 20-110 px and 640-700 px, rising ~1.2 m over the parapet, two iron spires each)
  for (const p of [m0 + 0.5, m1 - 0.5]) {
    slab(B, fr(0.3), p, PROJ_TOP, 0.9, 15.6 - PROJ_TOP, MID_N + 0.25 - 0.3, 'brick', 0);
    slab(B, fr(0.25), p, 15.6, 1.0, 0.12, MID_N + 0.35 - 0.25, 'greyBrick', 0);
    for (const s of [-1, 1]) {
      const g = new T.ConeGeometry(0.05, 0.95, 4).translate(0, 0.475, 0);
      put(B, fr(0.3), g, p + s * 0.27, 15.72, (MID_N + 0.25 - 0.3) / 2, 'dark');
      put(B, fr(0.3), new T.SphereGeometry(0.06, 6, 4), p + s * 0.27, 16.05, (MID_N + 0.25 - 0.3) / 2, 'dark');
    }
  }
  projection();
}

function projection() {
  const [p0, p1] = PROJ_U, c = (p0 + p1) / 2, f = fr(PROJ_N);
  slab(B, fr(0.3), c, 0, p1 - p0, PROJ_TOP, PROJ_N - 0.3, 'brick', 0);
  slab(B, f, c, 0, p1 - p0 - 0.08, 0.45, 0.06, 'concrete');
  slab(B, f, c, 0.45, p1 - p0 - 0.08, 1.35, 0.04, 'red');
  // the dark brick top band and coping (w05-124 497-510 px)
  slab(B, f, c, PROJ_TOP - 0.32, p1 - p0 - 0.08, 0.14, 0.06, 'greyBrick');
  slab(B, fr(0.3), c, PROJ_TOP, p1 - p0 + 0.1, 0.12, PROJ_N - 0.3 + 0.08, 'greyBrick', 0);
  for (const s of [-1, 1]) {
    const wc = c + s * 2.98;
    schoolWindow(f, wc, 5.1, 1.3, 4.0);
    slab(B, f, wc, 4.1, 5.3, 0.17, 0.26, 'concrete');
    slab(B, f, c + s * 7.0, 3.4, 0.55, 0.35, 0.04, 'concrete');
  }
  // name boards at the SW end (Commons pic3: a small white house-number plaque over the Poort Zuid board)
  slab(B, f, p0 + 0.85, 2.0, 0.9, 0.55, 0.05, 'white');
  slab(B, f, p0 + 0.75, 2.75, 0.5, 0.28, 0.05, 'white');
  // the projection's short ends back to the upper wall
  for (const [u, s] of [[p0, -1], [p1, 1]] as const) {
    const g = new T.BoxGeometry(0.06, 1.35, PROJ_N - MID_N).translate(0, 0.675, (PROJ_N - MID_N) / 2);
    put(B, fr(MID_N), g, u + s * 0.03, 0.45, 0, 'red');
  }
}

// ---- towers ---------------------------------------------------------------------------------------------------------

/** Outer face + top face of an annular sector (rib course): x/z native, angles native atan2(z, x). */
function arcBand(c: [number, number], r0: number, r1: number, a0: number, a1: number, y: number, h: number, colour: string, segs = 12, top = true) {
  const pos: number[] = [];
  const P = (r: number, a: number, yy: number) => [c[0] + r * Math.cos(a), yy, c[1] + r * Math.sin(a)];
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs, e = a0 + ((a1 - a0) * (i + 1)) / segs;
    const q = [P(r1, a, y), P(r1, e, y), P(r1, e, y + h), P(r1, a, y + h)];
    pos.push(...q[0], ...q[2], ...q[1], ...q[0], ...q[3], ...q[2]);
    if (top) { const t = [P(r0, a, y + h), P(r0, e, y + h)]; pos.push(...q[3], ...t[1], ...q[2], ...q[3], ...t[0], ...t[1]); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  orient(g, c);
  g.computeVertexNormals();
  B.add(g, colour as never);
}
/** Flip any triangle whose face normal points into the tower axis (outer faces) or downward (top faces). */
function orient(g: T.BufferGeometry, c: [number, number]) {
  const p = g.getAttribute('position') as T.BufferAttribute, A = new T.Vector3(), Bv = new T.Vector3(), C = new T.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    A.fromBufferAttribute(p, i); Bv.fromBufferAttribute(p, i + 1); C.fromBufferAttribute(p, i + 2);
    const n = Bv.clone().sub(A).cross(C.clone().sub(A)), m = A.clone().add(Bv).add(C).divideScalar(3);
    const radial = n.x * (m.x - c[0]) + n.z * (m.z - c[1]);
    if (Math.abs(n.y) > Math.hypot(n.x, n.z) ? n.y < 0 : radial < 0) { p.setXYZ(i + 1, C.x, C.y, C.z); p.setXYZ(i + 2, Bv.x, Bv.y, Bv.z); }
  }
}
/** A frame tangent to the tower at native angle a (n radial, t viewer's right). */
function towerFrame(c: [number, number], a: number, r = R): Frame {
  const n: [number, number] = [Math.cos(a), Math.sin(a)];
  return {origin: [c[0] + n[0] * r, c[1] + n[1] * r], n, tangent: [n[1], -n[0]]};
}

/**
 * A round stair tower (Commons pic1-3, w05-124): projecting brick courses every 0.36 m from the canopy to the crown, two
 * curved three-light stair windows (5.9-7.4 m and 10.2-11.7 m, 32 deg per light) on white ring sills, the drum carried
 * 0.85 m over the roof as a full cylinder with a corbelled ring and eleven brick teeth.
 */
function tower(c: [number, number]) {
  const A0 = FRONT - ARC, A1 = FRONT + ARC, WIN = (52 * Math.PI) / 180;
  const wins: [number, number][] = [[5.9, 7.4], [10.2, 11.7]];
  for (let y = 3.45; y < PARAPET - 0.2; y += 0.36) {
    const hit = wins.some(([a, b]) => y + 0.09 > a - 0.2 && y < b + 0.1);
    if (hit) { arcBand(c, R - 0.05, R + 0.05, A0, FRONT - WIN, y, 0.09, 'sandstone', 4); arcBand(c, R - 0.05, R + 0.05, FRONT + WIN, A1, y, 0.09, 'sandstone', 4); }
    else arcBand(c, R - 0.05, R + 0.05, A0, A1, y, 0.09, 'sandstone', 12);
  }
  for (const [y0, y1] of wins) {
    // The 3DBAG drum has 35-degree facets; each light stands on its own brick facet (1.0 m wide, 5 cm proud of R, so the audit reads it as a wall; sill and head per light) so the
    // flat frame is backed by a wall face across its whole width.
    const s0 = getSink();
    setSink(0);
    for (const k of [-1, 0, 1]) {
      const f = towerFrame(c, FRONT + (k * 32 * Math.PI) / 180, R + 0.05);
      slab(B, f, 0, y0 - 0.2 - 0.02 * Math.abs(k), 1.0, y1 - y0 + 0.35 + 0.04 * Math.abs(k), 0.14, 'sandstone', -0.14);
      slab(B, f, 0, y0, 0.6, y1 - y0, 0.06, 'frame', 0);
      slab(B, f, 0, y0 + 0.06, 0.48, y1 - y0 - 0.12, 0.04, 'glass', 0.06);
      bar(f, 0, y0 + (y1 - y0) * 0.72, 0.48, 0.06, 0.1);
      slab(B, f, 0, y0 - 0.14, 0.64, 0.14, 0.16, 'white', 0);
      slab(B, f, 0, y1, 0.6, 0.08, 0.06, 'white', 0);
    }
    setSink(s0, true);
  }
  // drum over the roof, corbelled ring, teeth and a flat top
  const drum = new T.CylinderGeometry(R, R, 0.95, 20, 1, true).translate(c[0], PARAPET - 0.2 + 0.475, c[1]);
  B.add(drum, 'sandstone' as never);
  const ringG = new T.CylinderGeometry(R + 0.1, R + 0.1, 0.22, 20, 1, false).translate(c[0], PARAPET + 0.64, c[1]);
  B.add(ringG, 'greyBrick' as never);
  for (let k = 0; k < 11; k++) {
    const a = FRONT + Math.PI + ((k + 0.5) / 11) * Math.PI * 2 - Math.PI;
    slab(B, towerFrame(c, a, R - 0.15), 0, PARAPET + 0.86, 0.24, 0.26, 0.25, 'greyBrick', 0);
  }
}

// ---- entrances ------------------------------------------------------------------------------------------------------

/**
 * The entrances at the tower feet (Commons pic1-3, w02-124 2024, w05-124 2018): white concrete canopies at 3.0-3.25 m from
 * the side bay to the projection, dark doors in the recess under them, and the red HUIS VAN DE WIJK sign on the SW canopy.
 */
function entrances() {
  for (const [u0, u1] of [[15.55, 18.6], [34.05, 37.1]]) {
    slab(B, fr(-0.1), (u0 + u1) / 2, 3.0, u1 - u0, 0.25, 1.62, 'white', 0);
  }
  for (const t of TOWERS) {
    // the porch face under the canopy: a flat brick front on the tower foot carrying the door (the drum's facets are too
    // narrow to back a 1.5 m door)
    const f = towerFrame(t.c, FRONT, R + 0.05);
    slab(B, f, 0, 0, 1.9, 3.0, 0.12, 'sandstone', -0.12);
    slab(B, f, 0, 0, 1.5, 2.75, 0.04, 'dark', 0);
    slab(B, f, 0, 2.75, 1.6, 0.08, 0.06, 'frame', 0);
  }
  // the red sign standing on the SW canopy's front edge (Commons pic3, w05-124 2018)
  const f = fr(1.4), c = 17.05;
  slab(B, f, c, 3.25, 2.3, 0.5, 0.1, 'pink', 0);
  letters(B, f, 'HUIS', c - 0.6, 3.36, 0.1, 0.038, 0.02, 'white');
  letters(B, f, 'WIJK', c + 0.6, 3.36, 0.1, 0.038, 0.02, 'white');
}
