/**
 * ARTIS Planetarium (Zeiss planetarium, opened 1988), Plantage Kerklaan, inside ARTIS: BAG pand 0363100012164980.
 *
 * Everything below comes from the Gemeente Amsterdam panoramas (CC BY 4.0) and Wikimedia Commons photographs (CC0 /
 * CC BY-SA 3.0) listed in scripts/landmarks/artis-planetarium-inventory.json, the PDOK orthophoto and the BAG/3DBAG ring
 * and roofs (artis-planetarium-footprints.json). Nothing is described from memory.
 *
 *  - The dome: a near-hemisphere of brown-grey standing-seam metal (Heijnsbroek 2008, panoramio 26, w04-300 2024).
 *    3DBAG roof facets fit a sphere of radius 13.0 m centred 2.6 m above the ground on the centre of the square hall
 *    (r 6 m -> 14.1 m, r 10 m -> 10.9 m, r 12 m -> 7.6 m, top 15.6 m); the orthophoto shows the same 26 m circle.
 *  - Under it a short drum of pale brick with a white cornice and white piers (Heijnsbroek 2008, w04-300).
 *  - Around it the one-storey glazed hall, a 29 m square (BAG) with a small glazed prow in the middle of three sides,
 *    floor-to-fascia glass between slim pale mullions under a pale fascia; flat roof 3.4 m (3DBAG).
 *  - A glazed link to the south-west with a glass lantern (3DBAG 4.3 m, dark glass in the orthophoto) and the
 *    two-storey entrance/office block on the Plantage Kerklaan (6.8 m, w09-300 2024): curtain wall with dark-blue panels.
 *
 * Geometry is authored in the plan frame (u along the north-east wall towards ESE, v along the north-west wall towards
 * SSW, origin at the north corner) and placed into the native frame (x east, z south) by rotateY(planFrameDeg) and a
 * translation to planOrigin; see artis-planetarium-prepare.ts.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {slab, type Frame} from './nearbar-kit';
import plan from './artis-planetarium-footprints.json';

type V = [number, number];
const ANGLE = (plan.planFrameDeg * Math.PI) / 180;
const [OX, OZ] = plan.planOrigin;
let b: BuildingTools;

// ---------------------------------------------------------------------------------------------------- measurements
const HALL = 3.4;                 // flat roof of the glazed hall and link (3DBAG 3.39-3.43)
const FASCIA = 0.42;              // pale fascia band under the hall roof edge (Heijnsbroek 2008)
const LANTERN = 4.3;              // glass lantern over the link (3DBAG 4.30-4.33)
const BLOCK = 6.8;                // two-storey block (3DBAG 6.81)
const C: V = [14.53, 14.5];       // dome centre: centre of the 29 m square (BAG) = centre of the orthophoto circle
const R = 13.0, Y0 = 2.6;         // sphere fitted to the 3DBAG dome facets
const DRUM_R = 12.72, DRUM_TOP = 4.6, CORNICE = 0.36;
const DOME_BASE = DRUM_TOP + CORNICE;


/** The one-storey part (hall + link), BAG ring with the two-storey block cut off at v 45.5 (2 cm inside the block). */
const LOW: V[] = [[0, 0], [13.34, 0], [14.55, -1.19], [15.74, -0.04], [29.05, 0], [29.03, 13.36], [30.17, 14.49], [29.02, 15.61],
  [28.98, 28.97], [19.66, 28.94], [19.62, 45.5], [4.82, 45.5], [4.82, 28.98], [0.01, 28.98], [0, 15.64], [-1.14, 14.5], [0, 13.35]];
/** The two-storey block (BAG ring south of v 45.58; 3DBAG roof 128); its north-east edge runs 0.1 m into the hall solid. */
const HIGH: V[] = [[0.01, 45.48], [4.82, 45.48], [19.62, 45.48], [19.42, 55.39], [14.6, 55.39], [14.6, 58.54], [4.83, 58.54], [4.83, 51.8], [0.01, 51.8]];

// ---------------------------------------------------------------------------------------------------- helpers
function inside(p: V, ring: V[]) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], q = ring[j];
    if ((a[1] > p[1]) !== (q[1] > p[1]) && p[0] < ((q[0] - a[0]) * (p[1] - a[1])) / (q[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** Wall frame for the ring edge p0 -> p1, normal pointing out of `ring`; t runs 0..len along the viewer's right. */
function edgeFrame(p0: V, p1: V, ring: V[]): {fr: Frame; len: number} {
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  let d: V = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len], o = p0;
  let n: V = [-d[1], d[0]];
  const m: V = [(p0[0] + p1[0]) / 2 + n[0] * 0.05, (p0[1] + p1[1]) / 2 + n[1] * 0.05];
  if (inside(m, ring)) { d = [-d[0], -d[1]]; o = p1; n = [-d[1], d[0]]; }
  return {fr: {origin: o, n, tangent: [n[1], -n[0]]}, len};
}
/** Closed prism over a plan ring from y0 to y1. */
function prism(ring: V[], y0: number, y1: number, colour: string) {
  const sh = new T.Shape(ring.map(p => new T.Vector2(p[0], p[1])));
  const g = new T.ExtrudeGeometry(sh, {depth: y1 - y0, bevelEnabled: false}).rotateX(Math.PI / 2).translate(0, y1, 0);
  b.add(g, colour as never);
}
const at = (g: T.BufferGeometry, u: number, y: number, v: number, colour: string) => { g.translate(u, y, v); b.add(g, colour as never); };

// ---------------------------------------------------------------------------------------------------- glazed hall
/** Floor-to-fascia glazing along one edge: dark glass, slim pale mullions, pale fascia, low plinth. */
function glazedRun(fr: Frame, len: number, y0: number, y1: number, pitch = 1.45) {
  const n = Math.max(1, Math.round(len / pitch)), top = y1 - FASCIA - 0.04;
  slab(b, fr, len / 2, y0, len, 0.22, 0.08, 'concrete');
  slab(b, fr, len / 2, y0 + 0.22, len - 0.16, top - y0 - 0.22, 0.06, 'glass');
  for (let k = 0; k <= n; k++) slab(b, fr, Math.min(len - 0.08, Math.max(0.08, (len * k) / n)), y0 + 0.22, 0.09, top - y0 - 0.22, 0.14, 'frame');
  slab(b, fr, len / 2, top, len - 0.02, FASCIA, 0.22, 'white');               // fascia, 4 cm under the roof edge
}
function hall() {
  // Roof of the hall and link; the drum and dome stand on it.
  prism(LOW, 0, HALL, 'concrete');
  for (let i = 0; i < LOW.length; i++) {
    const p0 = LOW[i], p1 = LOW[(i + 1) % LOW.length];
    if (p0[1] === 45.5 && p1[1] === 45.5) continue;           // inside the two-storey block
    const {fr, len} = edgeFrame(p0, p1, LOW);
    glazedRun(fr, len, 0, HALL, len < 2 ? len : 1.45);
  }
  // Glass lantern over the link (3DBAG roof 140, u 12.0-17.6, v 27.2-44.5): low glazed box with ribs.
  const [u0, u1, v0, v1] = [12.05, 17.55, 29.1, 44.45];
  at(new T.BoxGeometry(u1 - u0, LANTERN - HALL + 0.1, v1 - v0), (u0 + u1) / 2, (HALL - 0.1 + LANTERN) / 2, (v0 + v1) / 2, 'canopyGlass');
  for (let k = 0; k <= 10; k++) at(new T.BoxGeometry(u1 - u0 - 0.1, 0.08, 0.08), (u0 + u1) / 2, LANTERN + 0.03, v0 + 0.1 + ((v1 - v0 - 0.2) * k) / 10, 'concrete');
  at(new T.BoxGeometry(u1 - u0 + 0.12, 0.25, v1 - v0 + 0.12), (u0 + u1) / 2, HALL + 0.025, (v0 + v1) / 2, 'concrete');
}

// ---------------------------------------------------------------------------------------------------- two-storey block
/**
 * Two storeys of curtain wall (w09-300 2024, rectified ~60 px/m vertically): ground glass to 2.45 m, a pale floor band,
 * a dark-blue spandrel band 2.9-4.3 m, upper glass 4.35-6.34 m, pale fascia. Mullions ~1.5 m; on the notch face
 * (u 4.83, w09-300) at the measured positions, on the street face (u 0, w08-300) with two dark-blue ground bays.
 */
function block() {
  prism(HIGH, 0, BLOCK, 'concrete');
  const BAND0 = 2.45, SPAN0 = 2.9, GL0 = 4.35, TOP = BLOCK - 0.46;
  for (let i = 0; i < HIGH.length; i++) {
    const p0 = HIGH[i], p1 = HIGH[(i + 1) % HIGH.length];
    const {fr, len} = edgeFrame(p0, p1, HIGH);
    const overLink = p0[1] === 45.48 && p1[1] === 45.48 && Math.min(p0[0], p1[0]) >= 4.8;
    const street = p0[0] < 0.1 && p1[0] < 0.1, notch = Math.abs(p0[0] - 4.83) < 0.02 && Math.abs(p1[0] - 4.83) < 0.02;
    const n = Math.max(1, Math.round(len / 1.5));
    const ts = notch ? [0, 0.117, 0.342, 0.625, 0.79, 1].map(f => f * len) : Array.from({length: n + 1}, (_, k) => (len * k) / n);
    const mull = (y: number, h: number) => { for (const t of ts) slab(b, fr, Math.min(len - 0.08, Math.max(0.08, t)), y, 0.09, h, 0.14, 'white'); };
    if (!overLink) {
      slab(b, fr, len / 2, 0, len, 0.22, 0.08, 'concrete');
      slab(b, fr, len / 2, 0.22, len - 0.16, BAND0 - 0.22, 0.06, 'glass');
      if (street) for (let k = 0; k < Math.min(2, n); k++) slab(b, fr, (ts[k] + ts[k + 1]) / 2, 0.3, ts[k + 1] - ts[k] - 0.2, BAND0 - 0.5, 0.1, 'blue');
      mull(0.22, BAND0 - 0.22);
      slab(b, fr, len / 2, BAND0, len - 0.02, SPAN0 - BAND0, 0.14, 'white');           // floor band
      slab(b, fr, len / 2, SPAN0, len - 0.02, GL0 - SPAN0, 0.1, 'blue');                // spandrel band
    } else slab(b, fr, len / 2, HALL + 0.15, len - 0.02, GL0 - HALL - 0.15, 0.1, 'blue');
    slab(b, fr, len / 2, GL0, len - 0.16, TOP - GL0, 0.06, 'glass');
    mull(GL0, TOP - GL0);
    slab(b, fr, len / 2, TOP, len - 0.02, 0.42, 0.2, 'white');                          // fascia, 4 cm under the roof edge
  }
  // Roof plant (orthophoto: two pale units on the block roof).
  at(new T.BoxGeometry(2.2, 1.2, 1.4), 9.0, BLOCK + 0.5, 50.5, 'concrete');
  at(new T.BoxGeometry(1.4, 1.0, 1.4), 13.5, BLOCK + 0.4, 53.0, 'concrete');
}

// ---------------------------------------------------------------------------------------------------- drum and dome
function domeAndDrum() {
  const SEG = 72;
  // Pale brick drum with white piers, white cornice ring: closed solids, each sunk into the one below.
  at(new T.CylinderGeometry(DRUM_R, DRUM_R, DRUM_TOP - HALL + 0.1, SEG), C[0], (HALL - 0.1 + DRUM_TOP) / 2, C[1], 'greyBrick');
  const corR = 12.98;
  at(new T.CylinderGeometry(corR, corR, CORNICE + 0.05, SEG), C[0], DRUM_TOP - 0.05 + (CORNICE + 0.05) / 2, C[1], 'white');
  const PIERS = 16;
  for (let k = 0; k < PIERS; k++) {
    const a = ((k + 0.5) / PIERS) * Math.PI * 2;
    const g = new T.BoxGeometry(0.75, DRUM_TOP - HALL + 0.05, 0.32).translate(0, 0, DRUM_R + 0.04).rotateY(a);
    at(g, C[0], (HALL - 0.1 + DRUM_TOP) / 2, C[1], 'white');
  }
  // The dome: closed solid of revolution, the sphere cap from the cornice to the top (its foot sunk into the cornice).
  const theta = Math.acos((DOME_BASE - Y0) / R), ROWS = 18, prof: T.Vector2[] = [new T.Vector2(0, DOME_BASE - 0.1)];
  const baseR = R * Math.sin(theta);
  prof.push(new T.Vector2(baseR, DOME_BASE - 0.1));
  for (let i = ROWS; i >= 0; i--) { const th = (theta * i) / ROWS; prof.push(new T.Vector2(Math.max(1e-3, R * Math.sin(th)), Y0 + R * Math.cos(th))); }
  prof[prof.length - 1].x = 0;
  at(new T.LatheGeometry(prof, SEG), C[0], 0, C[1], 'copper');
  // Standing seams: 36 meridian ribs and three horizontal courses (Heijnsbroek 2008, 1988 construction photo).
  const RIBS = 36, t0 = 0.1, t1 = theta - 0.03;
  for (let k = 0; k < RIBS; k++) {
    const sh = new T.Shape();
    sh.absarc(0, 0, R + 0.035, Math.PI / 2 - t0, Math.PI / 2 - t1, true);
    sh.absarc(0, 0, R - 0.08, Math.PI / 2 - t1, Math.PI / 2 - t0, false);
    const g = new T.ExtrudeGeometry(sh, {depth: 0.07, bevelEnabled: false, curveSegments: 14}).translate(0, 0, -0.035);
    g.rotateY((k / RIBS) * Math.PI * 2);
    at(g, C[0], Y0, C[1], 'bronze');
  }
  for (const th of [0.45, 0.85, 1.15]) {
    const rr = R * Math.sin(th), y = R * Math.cos(th);
    at(new T.TorusGeometry(rr, 0.045, 4, SEG).rotateX(Math.PI / 2), C[0], Y0 + y, C[1], 'bronze');
  }
  // Apex hatch (orthophoto: small dark disc at the top).
  at(new T.CylinderGeometry(0.75, 0.85, 0.35, 16), C[0], Y0 + R - 0.08, C[1], 'bronze');
}

// ---------------------------------------------------------------------------------------------------- entry
export function buildArtisPlanetarium(_w: number, _d: number, tools: BuildingTools) {
  b = {...tools, add: (g: T.BufferGeometry, c: never, x?: number, y?: number, z?: number, angle?: number) => {
    if (angle) g.rotateY(angle);
    if (x !== undefined) g.translate(x, y ?? 0, z ?? 0);
    g.rotateY(ANGLE);
    g.translate(OX, 0, OZ);
    tools.add(g, c);
  }} as BuildingTools;
  hall();
  block();
  domeAndDrum();
}
