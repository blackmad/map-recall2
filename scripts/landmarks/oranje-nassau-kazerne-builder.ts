import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {local, facets, tris, type Kit} from './church-kit';
import {slab, poly, put, ledgeStrip, letters, type Frame} from './nearbar-kit';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import source from './oranje-nassau-kazerne-footprints.json';

/**
 * Oranje-Nassau Kazerne, Sarphatistraat (Rijksmonument 5140; 1810-1813 by city architect Abraham van der Hart and the
 * French engineer officer Picot de Moras; converted to flats and offices in 1990 by Joop and André van Stigt). The 16 BAG
 * pands of the one range (bouwjaar 1813) are listed in oranje-nassau-kazerne-footprints.json; the register: "Enorm
 * langgerekt sober bakstenen gebouw ... de gevels geleed door hoeken middenrisalieten met geblokte lisenen en frontons."
 *
 * Everything below is read from rectified Gemeente Amsterdam panoramas (CC BY 4.0) made by
 * oranje-nassau-kazerne-crops.ts along every front with a metre ruler in the building frame; window axes are the crop
 * readings (u along the range from the anchor towards the north-east end, v across it towards the Sarphatistraat).
 *  - Sarphatistraat (NW) front: three storeys of cream-framed cross windows; since 1990 most are flanked by a narrow
 *    window each side (narrow-wide-narrow units on a ~7.2 m room grid), stair units with a fanlit door and a single
 *    window above, four narrow doors; brick dormers with white segmental hoods; brick chimney stacks in the wall plane.
 *  - Central risalit (27 m, 0.45 m proud both sides): five bays between rusticated lisenes under a full-width pediment;
 *    NW tympanum with the painted Orange-Nassau arms (crowned helm, red mantling, gold-bordered quartered shield, motto
 *    band) between two oculi; the passage (onderdoorgang, 1990) in a stone surround lettered ORANJE-NASSAU. SE tympanum
 *    with a large white wheel window round a small red shield, between two oculi, over the square passage mouth.
 *  - End pavilions (22 x 27 m): rusticated corner and risalit lisenes, a three-bay risalit with a pediment and a white
 *    trophy relief on the Sarphatistraat face and on the end face (the SW end tympanum carries the 1990 "Timpaan" by
 *    Wendela Gevers Deynoot, a white oval with gilded forms), stone door surrounds, the end doors lettered ORANJE-NASSAU.
 *  - Courtyard (SE) front: pairs of wide sash windows on the same grid, stair units with fanlit doors, basement grilles.
 * Roof: 3DBAG LoD2.2 (CC BY 4.0) gives a 34 deg saddle (eaves 13.5 m, ridge 18.85 m) over the range, truncated 34 deg
 * hips on the pavilions (flat at 19.1 m), a 22 deg cross gable over the central risalit; dark tiles in the panoramas.
 *
 * Frame: native (x east, z south, y up from the pavement, 3DBAG maaiveld 1.45 m NAP), anchor = the union ring's vertex
 * average. The builder authors in X = u, Z = -v through church-kit `local` (rotation only).
 */
type C = 'brick' | 'greyBrick' | 'white' | 'frame' | 'stone' | 'slate' | 'glass' | 'dark' | 'red' | 'gold' | 'blue' | 'concrete';
type UV = [number, number];
const SRC = source as unknown as {axis: {localDeg: number}};

const EAVES = 13.5; // top of the cornice = wall top = roof eaves (3DBAG roof planes start at 13.4-13.55)
const RIDGE = 18.85; // main saddle and central cross gable ridge (3DBAG 18.6-18.8 + roof cover)
const PAV_TOP = 19.1; // flat top of the pavilion hips (3DBAG flat plane 19.0-19.1)
const HIP = 0.6745; // tan 34 deg
const ROWS: [number, number][] = [[1.1, 3.65], [5.4, 8.0], [9.6, 12.0]]; // window heads/sills per storey (crop nw-94_116, 36 px/m)
const CORNICE = {y0: 12.85, out: 0.5};
const STEP = 0.18; // door thresholds: one stone step above the pavement (panoramas); the brick runs under it

/** Authoring point (X = u, Z = -v). */
const P = (u: number, v: number): [number, number] => [u, -v];

/** Triangles per colour, added once through the kit. */
class Mesh {
  tris = new Map<C, number[]>();
  tri(c: C, a: number[], b: number[], d: number[]) { const arr = this.tris.get(c) ?? []; arr.push(...a, ...b, ...d); this.tris.set(c, arr); }
  quadW(f: Frame, q: WallQuad, c: C, t0 = 0) {
    const w = q.pts.map(([t, y, o]) => [f.origin[0] + f.tangent[0] * (t + t0) + f.n[0] * o, y, f.origin[1] + f.tangent[1] * (t + t0) + f.n[1] * o]);
    this.tri(c, w[0], w[1], w[2]); this.tri(c, w[0], w[2], w[3]);
  }
  triW(f: Frame, ...args: [...[number, number, number][], C]) {
    const c = args.pop() as C, w = (args as [number, number, number][]).map(([t, y, o]) => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, y, f.origin[1] + f.tangent[1] * t + f.n[1] * o]);
    this.tri(c, w[0], w[1], w[2]);
  }
  /** Front-facing rectangle in a wall frame (t0..t1, y0..y1) at offset o. */
  rect(f: Frame, t0: number, t1: number, y0: number, y1: number, o: number, c: C) {
    this.quadW(f, {pts: [[t0, y0, o], [t1, y0, o], [t1, y1, o], [t0, y1, o]], normal: [0, 0, 1]}, c);
  }
  flush(k: Kit) {
    for (const [c, pos] of this.tris) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      k.add(g, c);
    }
    this.tris.clear();
  }
}

type Face = {name: string; a: UV; b: UV; f: Frame; len: number; along: 'u' | 'v'};
/** Wall frame from a (viewer's left end) to b; outward normal n = tangent turned so (t, y, o) is right-handed. */
function face(name: string, a: UV, b: UV): Face {
  const A = P(...a), B = P(...b), L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const tg: [number, number] = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
  return {name, a, b, len: L, along: a[1] === b[1] ? 'u' : 'v', f: {origin: A, tangent: tg, n: [-tg[1], tg[0]]}};
}
/** t on a face of a building coordinate (u on faces running along u, v on the end faces). */
const tOf = (F: Face, s: number) => (F.along === 'u' ? Math.abs(s - F.a[0]) : Math.abs(s - F.a[1]));

// Faces in ring order (each b is the next a), outward normals checked in the self-test below.
const FACES = [
  face('nw-ne-pavilion', [116, 14.6], [94, 14.6]),
  face('step-nw-94', [94, 14.6], [94, 14.35]),
  face('nw-c', [94, 14.35], [-10.3, 14.35]),
  face('step-nw-r-ne', [-10.3, 14.35], [-10.3, 14.8]),
  face('nw-risalit', [-10.3, 14.8], [-37.35, 14.8]),
  face('step-nw-r-sw', [-37.35, 14.8], [-37.35, 14.35]),
  face('nw-a', [-37.35, 14.35], [-141.7, 14.35]),
  face('step-nw-141', [-141.7, 14.35], [-141.7, 14.6]),
  face('nw-sw-pavilion', [-141.7, 14.6], [-163.7, 14.6]),
  face('sw-end', [-163.7, 14.6], [-163.7, -12.6]),
  face('se-sw-pavilion', [-163.7, -12.6], [-141.7, -12.6]),
  face('sw-pavilion-inner', [-141.7, -12.6], [-141.7, -1.4]),
  face('se-a', [-141.7, -1.4], [-37.35, -1.4]),
  face('step-se-r-sw', [-37.35, -1.4], [-37.35, -1.84]),
  face('se-risalit', [-37.35, -1.84], [-10.3, -1.84]),
  face('step-se-r-ne', [-10.3, -1.84], [-10.3, -1.4]),
  face('se-c', [-10.3, -1.4], [94, -1.4]),
  face('ne-pavilion-inner', [94, -1.4], [94, -12.6]),
  face('se-ne-pavilion', [94, -12.6], [116, -12.6]),
  face('ne-end', [116, -12.6], [116, 14.6]),
];
const FACE = Object.fromEntries(FACES.map(F => [F.name, F])) as Record<string, Face>;
const RING = FACES.map(F => P(...F.a));
function insideRing(p: [number, number]) {
  let c = false;
  for (let i = 0, j = RING.length - 1; i < RING.length; j = i++) {
    const a = RING[i], b = RING[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
for (const F of FACES) {
  const m: [number, number] = [F.f.origin[0] + F.f.tangent[0] * F.len / 2, F.f.origin[1] + F.f.tangent[1] * F.len / 2];
  if (insideRing([m[0] + F.f.n[0] * 0.1, m[1] + F.f.n[1] * 0.1]) || !insideRing([m[0] - F.f.n[0] * 0.1, m[1] - F.f.n[1] * 0.1])) throw Error(`face ${F.name}: normal not outward`);
}

// ---------------------------------------------------------------- openings
type Kind = 'W' | 'N' | 'S' | 's' | 'P' | 'E' | 'door' | 'narrowDoor' | 'grille' | 'passage' | 'fan' | 'recess';
type Cut = HoledOpening & {kind: Kind; back: C | null; tc: number};
const CUTS = new Map<string, Cut[]>();
const WIDTH: Record<string, number> = {W: 1.72, N: 0.72, S: 1.65, s: 1.15, P: 1.28, E: 1.2, e: 0.55};
/** Glazing bars per window kind: vertical and horizontal positions as fractions of the opening. */
const BARS: Record<string, {v: number[]; h: number[]}> = {
  W: {v: [0.5], h: [0.62, 0.31]}, // cross window, lower lights subdivided
  N: {v: [], h: [0.72]},
  S: {v: [0.5], h: [0.5]}, // courtyard sash pairs
  s: {v: [], h: [0.5]},
  P: {v: [1 / 3, 2 / 3], h: [0.5]}, // pavilion six-over-six sashes
  E: {v: [1 / 3, 2 / 3], h: [0.5]},
  e: {v: [], h: [0.5]},
};
function cut(F: Face, kind: Kind, s: number, w: number, y0: number, y1: number, depth: number, back: C | null) {
  const tc = tOf(F, s);
  const list = CUTS.get(F.name) ?? [];
  list.push({t0: tc - w / 2, t1: tc + w / 2, y0, y1, depth, kind, back, tc});
  CUTS.set(F.name, list);
}
type Dress = {F: Face; kind: string; tc: number; w: number; y0: number; y1: number};
const DRESS: Dress[] = [];
/** A window in every storey (rows), kind W/N/S/s/P/E/e; `skip` lists storey indices without one (0 = ground). */
function column(F: Face, kind: string, s: number, skip: number[] = []) {
  const w = WIDTH[kind];
  ROWS.forEach(([y0, y1], i) => {
    if (skip.includes(i)) return;
    cut(F, kind as Kind, s, w, y0, y1, 0.2, 'glass');
    DRESS.push({F, kind, tc: tOf(F, s), w, y0, y1});
  });
}
/** Fanlit front door: leaf opening 0-2.85 m, fanlight 2.85-3.57 m (a semicircle over the leaf in a brick spandrel). */
const DOORS: {F: Face; tc: number; w: number; narrow?: boolean; surround?: 'stone' | 'passage'; label?: boolean}[] = [];
function fanDoor(F: Face, s: number, w = 1.45) {
  cut(F, 'door', s, w, STEP, 2.85, 0.3, 'dark');
  cut(F, 'fan', s, w, 2.85, 2.85 + w / 2, 0.2, 'glass');
  DOORS.push({F, tc: tOf(F, s), w});
}
function narrowDoor(F: Face, s: number) {
  cut(F, 'narrowDoor', s, 0.95, STEP, 2.4, 0.3, 'dark');
  cut(F, 'fan', s, 0.95, 2.4, 3.05, 0.2, 'glass');
  DOORS.push({F, tc: tOf(F, s), w: 0.95, narrow: true});
}
function grille(F: Face, s: number, w: number) { cut(F, 'grille', s, w, 0.2, 0.75, 0.12, 'dark'); }

// Sarphatistraat (NW) front, main range: crop readings (artifacts/landmark-lanes/oranje-nassau-kazerne/crops/nw-*).
const NW_A_W = [-139.4, -134.7, -127.2, -122.05, -116.6, -109.3, -102.15, -94.75, -89.3, -83.85, -76.6, -69.5, -62.25, -56.7, -51.3, -44.15, -39.2];
const NW_A_N = [-136.5, -132.9, -129.1, -125.4, -118.4, -114.8, -111.1, -107.5, -103.9, -100.2, -96.5, -93.0, -85.7, -82.0, -78.4, -74.8, -71.3, -67.7, -64.0, -60.3, -53.0, -49.5, -45.9, -42.2];
const NW_A_DOORS = [-139.4, -122.05, -89.3, -56.7, -39.2], NW_A_NO_GROUND = [-107.5, -103.9], NW_A_NARROW_DOORS = [-105.8, -73.0];
const NW_C_W = [-7.85, -3.15, 4.05, 9.47, 14.95, 22.2, 29.4, 36.7, 42.0, 47.4, 54.7, 62.0, 69.2, 74.7, 80.25, 87.4, 92.05];
const NW_C_N = [-4.95, -1.4, 2.33, 5.85, 13.1, 16.75, 20.45, 24.0, 27.6, 31.2, 34.9, 38.4, 45.6, 49.2, 52.8, 56.45, 60.2, 63.8, 67.4, 71.0, 78.5, 82.0, 85.6, 89.2];
const NW_C_DOORS = [-7.85, 9.47, 42.0, 74.7, 92.05], NW_C_NO_GROUND = [24.0, 27.6, 56.45, 60.2], NW_C_NARROW_DOORS = [25.8, 58.25];
// Courtyard (SE) front: pairs of sashes, three triples with narrower sashes, stair units (door below, window above).
const SE_A_S = [-136.0, -133.7, -129.0, -126.8, -118.2, -115.8, -111.0, -108.65, -103.4, -101.1, -96.0, -93.7, -85.4, -83.0, -77.55, -75.2, -70.5, -68.1, -63.1, -60.8, -51.1, -45.0, -42.7];
const SE_A_s = [-53.55, -48.7], SE_A_DOORS = [-139.3, -122.7, -89.6, -56.5, -39.6];
const SE_C_S = [-4.6, -2.2, 4.0, 13.7, 16.1, 20.75, 23.1, 27.95, 30.35, 35.2, 37.55, 46.05, 48.4, 53.3, 55.65, 61.15, 63.45, 69.5, 79.0, 81.25, 86.1, 88.5];
const SE_C_s = [1.6, 6.45, 67.1, 71.95], SE_C_DOORS = [-8.2, 9.45, 41.9, 91.95];
const SE_NARROW_ABOVE_DOOR = 74.55; // narrow sashes over the door (crop se-56_80)

function nwRange(F: Face, W: number[], N: number[], doors: number[], noGround: number[], narrowDoors: number[]) {
  for (const s of W) { column(F, 'W', s, doors.includes(s) ? [0] : []); if (doors.includes(s)) fanDoor(F, s); }
  for (const s of N) column(F, 'N', s, noGround.includes(s) ? [0] : []);
  for (const s of narrowDoors) narrowDoor(F, s);
}
function seRange(F: Face, S: number[], s2: number[], doors: number[]) {
  for (const s of S) { column(F, 'S', s); grille(F, s, 1.2); }
  for (const s of s2) { column(F, 's', s); grille(F, s, 0.9); }
  for (const s of doors) { column(F, 'S', s, [0]); fanDoor(F, s); }
}
nwRange(FACE['nw-a'], NW_A_W, NW_A_N, NW_A_DOORS, NW_A_NO_GROUND, NW_A_NARROW_DOORS);
nwRange(FACE['nw-c'], NW_C_W, NW_C_N, NW_C_DOORS, NW_C_NO_GROUND, NW_C_NARROW_DOORS);
seRange(FACE['se-a'], SE_A_S, SE_A_s, SE_A_DOORS);
seRange(FACE['se-c'], SE_C_S, SE_C_s, SE_C_DOORS);
column(FACE['se-c'], 's', SE_NARROW_ABOVE_DOOR, [0]);
narrowDoor(FACE['se-c'], SE_NARROW_ABOVE_DOOR);

// Central risalit. NW: five bays between lisenes, the passage under the middle window (crops nw--46_-22, nw--26_-2).
const PASS_NW = -23.55, PASS_SE = -23.85;
{
  const F = FACE['nw-risalit'];
  for (const s of [-12.95, -18.3, -28.85, -34.15]) { column(F, 'W', s); grille(F, s, 1.2); }
  for (const s of [-16.65, -19.95, -27.2, -30.5]) column(F, 'N', s);
  column(F, 'W', PASS_NW, [0]);
  // the passage: 1.6 m wide, open through the building to the SE recess; a fanlight in the arch over it
  cut(F, 'passage', PASS_NW, 1.6, 0, 2.9, 16.04, null);
  cut(F, 'fan', PASS_NW, 1.6, 3.0, 3.8, 0.2, 'glass');
  DOORS.push({F, tc: tOf(F, PASS_NW), w: 1.6, surround: 'passage', label: true});
}
{
  const F = FACE['se-risalit'];
  for (const s of [-34.4, -30.2, -28.05, -19.6, -17.45, -13.25]) { column(F, 'S', s); grille(F, s, 1.2); }
  column(F, 'S', PASS_SE, [0]);
  cut(F, 'recess', PASS_SE, 3.0, 0, 3.15, 0.6, null);
}
// Pavilion Sarphatistraat faces (crops nw--164_-142, nw-94_116): five six-over-six sashes per storey, the stone-framed door
// under the middle one, narrow windows either side of the inner bay's window.
for (const [name, Ws, Ns, door] of [['nw-sw-pavilion', [-144.5, -149.4, -152.6, -155.8, -160.7], [-142.98, -146.06], -152.6], ['nw-ne-pavilion', [97.1, 102.0, 105.2, 108.3, 113.3], [95.6, 98.6], 105.2]] as [string, number[], number[], number][]) {
  const F = FACE[name];
  for (const s of Ws) column(F, 'P', s, s === door ? [0] : []);
  for (const s of Ns) column(F, 'e', s);
  cut(F, 'door', door, 1.4, STEP, 2.8, 0.3, 'dark');
  cut(F, 'fan', door, 1.4, 2.8, 3.5, 0.2, 'glass');
  DOORS.push({F, tc: tOf(F, door), w: 1.4, surround: 'stone'});
}
grille(FACE['nw-sw-pavilion'], -144.5, 1.0);
// Pavilion courtyard (SE) faces: five sashes per storey (crops pav-sw-se, pav-ne-se).
for (const s of [-160.2, -155.4, -152.3, -149.3, -144.7]) column(FACE['se-sw-pavilion'], 'P', s);
for (const s of [96.7, 101.55, 104.7, 107.8, 112.55]) column(FACE['se-ne-pavilion'], 'P', s);
// Pavilion inner faces (crops pav-sw-ne, pav-ne-sw): window, two narrow ones, window.
for (const [name, Ws, Ns] of [['sw-pavilion-inner', [-9.05, -2.6], [-7.4, -4.2]], ['ne-pavilion-inner', [-2.6, -9.0], [-4.2, -7.4]]] as [string, number[], number[]][]) {
  for (const s of Ws) column(FACE[name], 'P', s);
  for (const s of Ns) column(FACE[name], 'e', s);
}
// End faces (crops sw-end, ne-end): three bays of narrow-wide-narrow, the middle bay a risalit with the lettered door.
for (const [name, Es, es, door] of [
  ['sw-end', [11.25, 5.1, 1.1, -2.9, -8.8], [12.9, 9.6, 6.8, 3.5, -1.4, -4.5, -7.3, -10.4], 1.1],
  ['ne-end', [-9.1, -3.1, 0.87, 4.9, 11.0], [-10.65, -7.45, -4.7, -1.5, 3.3, 6.55, 9.4, 12.6], 0.87],
] as [string, number[], number[], number][]) {
  const F = FACE[name];
  for (const s of Es) column(F, 'E', s, s === door ? [0] : []);
  for (const s of es) column(F, 'e', s);
  cut(F, 'door', door, 1.4, STEP, 2.8, 0.3, 'dark');
  cut(F, 'fan', door, 1.4, 2.8, 3.5, 0.2, 'glass');
  DOORS.push({F, tc: tOf(F, door), w: 1.4, surround: 'stone', label: true});
}

// ---------------------------------------------------------------- lisenes, pediments, dormers (positions in u or v)
const LISENES: Record<string, [number, number][]> = {
  'nw-sw-pavilion': [[-141.7, -142.4], [-146.4, -147.5], [-157.8, -158.9], [-162.8, -163.7]],
  'nw-ne-pavilion': [[116, 115.3], [111.4, 110.3], [100.0, 99.0], [95.0, 94.0]],
  'nw-risalit': [[-10.3, -11.3], [-15.2, -16.2], [-20.6, -21.6], [-25.6, -26.7], [-31.0, -32.0], [-36.35, -37.35]],
  'se-risalit': [[-37.35, -36.4], [-32.2, -31.25], [-27.0, -25.9], [-21.75, -20.7], [-16.4, -15.4], [-11.2, -10.3]],
  'se-sw-pavilion': [[-163.7, -162.7], [-158.3, -157.2], [-147.3, -146.3], [-142.6, -141.7]],
  'se-ne-pavilion': [[94.0, 94.8], [98.6, 99.7], [109.8, 110.9], [115.1, 116.0]],
  'sw-end': [[14.6, 13.8], [9.0, 7.9], [-5.4, -6.5], [-11.6, -12.6]],
  'ne-end': [[-12.6, -11.8], [-6.35, -5.4], [7.4, 8.5], [13.6, 14.6]],
  'sw-pavilion-inner': [[-12.6, -11.6]],
  'ne-pavilion-inner': [[-11.6, -12.6]],
};
/** Pediments: face, centre (u or v), half-span at the wall, rise. */
const PEDIMENTS: {face: string; c: number; half: number; rise: number}[] = [
  {face: 'nw-risalit', c: -23.825, half: 13.525, rise: RIDGE - EAVES},
  {face: 'se-risalit', c: -23.825, half: 13.525, rise: RIDGE - EAVES},
  {face: 'nw-sw-pavilion', c: -152.65, half: 7.0, rise: 3.2},
  {face: 'nw-ne-pavilion', c: 105.2, half: 7.0, rise: 3.2},
  {face: 'sw-end', c: 1.0, half: 8.5, rise: 3.7},
  {face: 'ne-end', c: 0.3, half: 8.2, rise: 3.8}, // crop ne-end: feet at v -7.9 / 8.4, apex 3.8 m over the cornice
];
const DORMERS: Record<string, number[]> = {
  'nw-a': [-134.95, -120.6, -109.6, -94.7, -84.0, -69.7, -55.4, -43.5],
  'nw-c': [-3.4, 8.35, 22.5, 36.6, 47.3, 62.3, 73.1, 87.6],
  'nw-sw-pavilion': [-146.1, -159.2],
  'nw-ne-pavilion': [98.7, 111.6],
  'se-a': [-139.2, -128.3, -122.8, -101.4, -89.0, -76.0, -61.9, -55.2, -51.1, -40.6],
  'se-c': [-9.25, 4.35, 8.5, 14.3, 29.0, 41.6, 53.9, 69.4, 73.5, 79.1, 92.0],
  'se-sw-pavilion': [-158.5, -149.0],
  'sw-pavilion-inner': [-5.4],
  'ne-pavilion-inner': [-5.8],
  'ne-end': [7.7, 9.6],
};
const STACKS: Record<string, number[]> = {'nw-a': [-122.9, -58.5], 'nw-c': [11.2, 76.6], 'se-a': [-124.4, -58.5]};

// ---------------------------------------------------------------- geometry helpers
/** Flat shape (x along the frame tangent, y up) facing out of the wall at offset o. */
function flat(k: Kit, f: Frame, shape: T.Shape, t: number, y: number, o: number, c: C, seg = 6) {
  put(k, f, new T.ShapeGeometry(shape, seg), t, y, o, c);
}
const ellipse = (rx: number, ry: number, n = 14) => { const s = new T.Shape(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; (i ? s.lineTo.bind(s) : s.moveTo.bind(s))(rx * Math.cos(a), ry * Math.sin(a)); } return s; };
/** Round window in a tympanum (no hole in the wall): white ring solid, glass disc solid inside it, cross bars on the glass. */
function oculus(k: Kit, f: Frame, t: number, y: number, r: number) {
  const ring = ellipse(r, r, 20), hole = new T.Path(ellipse(r - 0.15, r - 0.15, 20).getPoints(20).reverse());
  ring.holes.push(hole);
  put(k, f, new T.ExtrudeGeometry(ring, {depth: 0.2, bevelEnabled: false}), t, y, 0, 'white');
  put(k, f, new T.ExtrudeGeometry(ellipse(r - 0.15, r - 0.15, 18), {depth: 0.09, bevelEnabled: false}), t, y, 0, 'glass');
  slab(k, f, t, y - 0.035, 2 * (r - 0.15), 0.07, 0.09, 'white', 0.09);
  slab(k, f, t - 0.035 + 0.035, y - (r - 0.15), 0.07, r - 0.15 - 0.035, 0.09, 'white', 0.09);
  slab(k, f, t, y + 0.035, 0.07, r - 0.15 - 0.035, 0.09, 'white', 0.09);
}
const shapeOf = (pts: [number, number][]) => new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])));
/** Solid flat-faced relief piece: polygon extruded d out of the wall from o. */
const relief = (k: Kit, f: Frame, pts: [number, number][], t: number, y: number, d: number, c: C, o = 0) => poly(k, f, t, y, pts, d, c, o);

/** Rusticated lisene ("geblokte lisene"): blocks 0.42 m tall 0.13 proud, joints 0.08 m at 0.08 proud. */
function lisene(m: Mesh, f: Frame, t0: number, t1: number, y1 = 12.55) {
  const course = 0.5, joint = 0.08, B = 0.2, J = 0.11;
  for (let y = 0; y < y1 - 1e-6; y += course) {
    const yj = Math.min(y + joint, y1), yt = Math.min(y + course, y1);
    m.rect(f, t0, t1, y, yj, J, 'greyBrick');
    if (yt > yj) {
      m.rect(f, t0, t1, yj, yt, B, 'brick');
      // the block's underside, seen from the street (faces down)
      m.quadW(f, {pts: [[t0, yj, J], [t0, yj, B], [t1, yj, B], [t1, yj, J]], normal: [0, -1, 0]}, 'brick');
    }
  }
  // sides and top cap
  m.quadW(f, {pts: [[t0, 0, 0], [t0, 0, B], [t0, y1, B], [t0, y1, 0]], normal: [-1, 0, 0]}, 'brick');
  m.quadW(f, {pts: [[t1, 0, B], [t1, 0, 0], [t1, y1, 0], [t1, y1, B]], normal: [1, 0, 0]}, 'brick');
  m.quadW(f, {pts: [[t0, y1, B], [t1, y1, B], [t1, y1, 0], [t0, y1, 0]], normal: [0, 1, 0]}, 'brick');
}

/** Cream frame ring inside an opening, glazing bars and a white sill. */
function dressWindow(m: Mesh, k: Kit, d: Dress) {
  const {F, tc, w, y0, y1} = d, f = F.f, a = tc - w / 2, b = tc + w / 2, fw = 0.09, o = -0.04;
  m.rect(f, a, b, y0, y0 + fw, o, 'frame');
  m.rect(f, a, b, y1 - fw, y1, o, 'frame');
  m.rect(f, a, a + fw, y0 + fw, y1 - fw, o, 'frame');
  m.rect(f, b - fw, b, y0 + fw, y1 - fw, o, 'frame');
  const bars = BARS[d.kind];
  for (const v of bars.v) m.rect(f, a + w * v - 0.035, a + w * v + 0.035, y0 + fw, y1 - fw, -0.08, 'frame');
  const cuts = [a + fw, ...bars.v.flatMap(v => [a + w * v - 0.035, a + w * v + 0.035]), b - fw];
  for (const h of bars.h) { const y = y0 + (y1 - y0) * h; for (let i = 0; i < cuts.length; i += 2) m.rect(f, cuts[i], cuts[i + 1], y - 0.035, y + 0.035, -0.08, 'frame'); }
  if (y0 > 0.5) ledgeStrip(k, f, tc, y0 - 0.12, w + 0.2, 0.12, 0.1, 'white');
}
/** Spandrel filling the corners of a rectangular fanlight opening above a semicircular arch (front face only). */
function spandrel(k: Kit, f: Frame, tc: number, w: number, y: number, o: number) {
  const r = w / 2, s = new T.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, r); s.lineTo(r, r); s.lineTo(r, 0);
  for (let i = 1; i < 8; i++) { const a = i / 8 * Math.PI; s.lineTo(r * Math.cos(a), r * Math.sin(a)); }
  s.lineTo(-r, 0);
  flat(k, f, s, tc, y, o, 'brick', 8);
}
/** Dormer standing on a roof of slope ~34 deg behind a wall frame: slate cheeks, recessed glazing in a white frame with
 * a mullion, a white segmental hood run back into the roof. Bottom and back are buried in the roof. */
function dormer(m: Mesh, k: Kit, f: Frame, t: number, w = 2.0, front = -0.5) {
  const y0 = EAVES + (0.16 - front) * HIP + 0.04, y1 = y0 + 1.0, rise = 0.55, back = front - 2.9, a = t - w / 2, b = t + w / 2;
  // cheeks (slate), running from the frame plane back into the roof
  const yb = EAVES - front * HIP - 0.3;
  m.quadW(f, {pts: [[a, yb, back], [a, yb, front], [a, y1, front], [a, y1, back]], normal: [-1, 0, 0]}, 'slate');
  m.quadW(f, {pts: [[b, yb, front], [b, yb, back], [b, y1, back], [b, y1, front]], normal: [1, 0, 0]}, 'slate');
  // front: a slate face with the window cut into it (white reveals, glass at the back), white frame ring and mullion
  const fr: Frame = {origin: [f.origin[0] + f.tangent[0] * a + f.n[0] * front, f.origin[1] + f.tangent[1] * a + f.n[1] * front], tangent: f.tangent, n: f.n};
  const win = {t0: 0.12, t1: w - 0.12, y0, y1: y1 - 0.06, depth: 0.14};
  const hw = holedWall(w, yb, y1, [win]);
  for (const q of hw.face) m.quadW(fr, q, 'slate');
  for (const q of hw.reveals[0]) m.quadW(fr, q, 'white');
  m.quadW(fr, hw.backs[0], 'glass');
  const ring = 0.08, o = -0.05;
  m.rect(fr, win.t0, win.t1, win.y0, win.y0 + ring, o, 'white');
  m.rect(fr, win.t0, win.t1, win.y1 - ring, win.y1, o, 'white');
  m.rect(fr, win.t0, win.t0 + ring, win.y0 + ring, win.y1 - ring, o, 'white');
  m.rect(fr, win.t1 - ring, win.t1, win.y0 + ring, win.y1 - ring, o, 'white');
  m.rect(fr, w / 2 - 0.04, w / 2 + 0.04, win.y0 + ring, win.y1 - ring, o, 'white');
  // hood: circular segment over the body, run back into the roof
  const half = w / 2 + 0.1, R = (half * half + rise * rise) / (2 * rise), s = new T.Shape(), n = 6;
  const a0 = Math.asin(half / R);
  s.moveTo(-half, 0);
  for (let i = 1; i < n; i++) { const ang = -a0 + 2 * a0 * i / n; s.lineTo(R * Math.sin(ang), R * Math.cos(ang) - (R - rise)); }
  s.lineTo(half, 0); s.lineTo(-half, 0);
  put(k, f, new T.ExtrudeGeometry(s, {depth: (front + 0.14) - back, bevelEnabled: false}), t, y1, back, 'white');
}

// ---------------------------------------------------------------- build
export function buildOranjeNassauKazerne(_w: number, _d: number, b: BuildingTools) {
  const k = local(b, SRC.axis.localDeg);
  const m = new Mesh();

  // walls with every opening cut through them
  for (const F of FACES) {
    const cuts = CUTS.get(F.name) ?? [];
    const hw = holedWall(F.len, 0, EAVES, cuts);
    for (const q of hw.face) m.quadW(F.f, q, 'brick');
    hw.reveals.forEach((qs, i) => qs.forEach(q => m.quadW(F.f, q, cuts[i].kind === 'passage' ? 'concrete' : 'brick')));
    hw.backs.forEach((q, i) => { const c = cuts[i].back; if (c) m.quadW(F.f, q, c); });
  }
  // the SE passage recess: back wall round the 1.6 m tunnel mouth (the tunnel is the NW opening's reveals)
  {
    const F = FACE['se-risalit'], tc = tOf(F, PASS_SE), tn = tOf(F, PASS_NW), o = -0.6;
    m.rect(F.f, tc - 1.5, tn - 0.8, 0, 3.15, o, 'concrete');
    m.rect(F.f, tn + 0.8, tc + 1.5, 0, 3.15, o, 'concrete');
    m.rect(F.f, tn - 0.8, tn + 0.8, 2.9, 3.15, o, 'concrete');
    // white stone surround: pilasters, lintel, entablature (crop se--24_0)
    for (const sg of [-1, 1]) slab(k, F.f, tc + sg * 1.775, 0, 0.55, 3.75, 0.16, 'white', 0);
    slab(k, F.f, tc, 3.15, 3.0, 0.6, 0.16, 'white', 0);
    slab(k, F.f, tc, 3.75, 4.5, 0.5, 0.24, 'white', 0);
  }
  for (const d of DRESS) dressWindow(m, k, d);

  // doors: white frame, transom bar, brick spandrels round the fanlight; stone surrounds with entablature and lettering
  for (const d of DOORS) {
    const f = d.F.f, a = d.tc - d.w / 2, bb = d.tc + d.w / 2, fw = 0.1, top = d.surround === 'passage' ? 3.0 : d.narrow ? 2.4 : d.w === 1.4 ? 2.8 : 2.85;
    const fanTop = d.surround === 'passage' ? 3.8 : d.narrow ? 3.05 : top + d.w / 2;
    if (d.surround !== 'passage') {
      m.rect(f, a, a + fw, STEP, top - 0.06, -0.04, 'frame');
      m.rect(f, bb - fw, bb, STEP, top - 0.06, -0.04, 'frame');
      m.rect(f, a + fw, d.tc - 0.02, STEP, top - 0.06, -0.12, 'dark');
      m.rect(f, d.tc + 0.02, bb - fw, STEP, top - 0.06, -0.12, 'dark');
      slab(k, f, d.tc, 0, d.w + 0.3, STEP, 0.32, 'stone', 0); // the step
    }
    if (d.surround !== 'passage') m.rect(f, a, bb, top - 0.06, top, -0.06, 'frame');
    if (!d.narrow) spandrel(k, f, d.tc, d.w, top, -0.01);
    if (d.surround) {
      const pw = d.surround === 'passage' ? 0.75 : 0.42, H = d.surround === 'passage' ? 4.3 : 4.1, half = d.w / 2 + pw;
      for (const s of [-1, 1]) slab(k, f, d.tc + s * (d.w / 2 + pw / 2), 0, pw, H, 0.18, 'white', 0);
      slab(k, f, d.tc, H, 2 * half + 0.1, 0.5, 0.2, 'white', 0); // frieze
      slab(k, f, d.tc, H + 0.5, 2 * half + 0.5, 0.18, 0.38, 'white', 0); // cornice
      if (d.label) letters(k, f, 'ORANJE-NASSAU', d.tc, H + 0.1, 0.2, Math.min(0.034, (2 * half - 0.3) / 77), 0.09, 'dark');
    } else if (!d.narrow) {
      ledgeStrip(k, f, d.tc, fanTop + 0.02, d.w + 0.3, 0.12, 0.06, 'white');
    }
  }

  // lisenes
  for (const [name, list] of Object.entries(LISENES)) {
    const F = FACE[name];
    for (const [s0, s1] of list) { const t0 = Math.min(tOf(F, s0), tOf(F, s1)), t1 = Math.max(tOf(F, s0), tOf(F, s1)); lisene(m, F.f, t0, t1); }
  }
  // string courses and the architrave under the cornice, stopped short of the corners
  for (const F of FACES) {
    if (F.len < 2) continue;
    for (const y of [4.45, 8.5]) slab(k, F.f, F.len / 2, y, F.len - 0.3, 0.1, 0.09, 'greyBrick');
    slab(k, F.f, F.len / 2, 12.6, F.len - 0.3, 0.16, 0.12, 'white');
  }
  // cornice: one ring round the whole outline (no overlapping corner pieces)
  {
    const n = FACES.length, out = CORNICE.out;
    const lines = FACES.map(F => ({p: [F.f.origin[0] + F.f.n[0] * out, F.f.origin[1] + F.f.n[1] * out] as [number, number], d: F.f.tangent}));
    const meet = (l1: typeof lines[0], l2: typeof lines[0]): [number, number] => {
      const den = l1.d[0] * l2.d[1] - l1.d[1] * l2.d[0];
      if (Math.abs(den) < 1e-9) return l2.p;
      const s = ((l2.p[0] - l1.p[0]) * l2.d[1] - (l2.p[1] - l1.p[1]) * l2.d[0]) / den;
      return [l1.p[0] + l1.d[0] * s, l1.p[1] + l1.d[1] * s];
    };
    const outer = FACES.map((_, i) => meet(lines[(i + n - 1) % n], lines[i]));
    const inner = RING;
    const tri = T.ShapeUtils.triangulateShape(outer.map(p => new T.Vector2(p[0], p[1])), [inner.map(p => new T.Vector2(p[0], p[1]))]);
    const pts = [...outer, ...inner];
    for (const [i, j, l] of tri) {
      const A = pts[i], B = pts[j], D = pts[l];
      const up = (B[0] - A[0]) * (D[1] - A[1]) - (B[1] - A[1]) * (D[0] - A[0]); // >0: the (x,z) triangle is clockwise seen from +y
      const top = (p: [number, number]) => [p[0], EAVES, p[1]], bot = (p: [number, number]) => [p[0], CORNICE.y0, p[1]];
      if (up < 0) { m.tri('white', top(A), top(B), top(D)); m.tri('white', bot(A), bot(D), bot(B)); } else { m.tri('white', top(A), top(D), top(B)); m.tri('white', bot(A), bot(B), bot(D)); }
    }
    for (let i = 0; i < n; i++) {
      const A = outer[i], B = outer[(i + 1) % n], F = FACES[i];
      const q = [[A[0], CORNICE.y0, A[1]], [B[0], CORNICE.y0, B[1]], [B[0], EAVES, B[1]], [A[0], EAVES, A[1]]];
      // wind so the face points along the face's outward normal
      const nrm = new T.Vector3(q[1][0] - q[0][0], 0, q[1][2] - q[0][2]).cross(new T.Vector3(0, 1, 0));
      if (nrm.x * F.f.n[0] + nrm.z * F.f.n[1] > 0) { m.tri('white', q[0], q[1], q[2]); m.tri('white', q[0], q[2], q[3]); } else { m.tri('white', q[0], q[2], q[1]); m.tri('white', q[0], q[3], q[2]); }
    }
  }

  // roofs (authoring coords [X = u, y, Z = -v])
  const R3 = (u: number, y: number, v: number) => [u, y, -v];
  {
    // main saddle, run into both pavilion hips
    const v0 = -1.4, v1 = 14.35, vm = (v0 + v1) / 2, uA = -150.0, uB = 102.3;
    facets(k, [[R3(uA, EAVES, v1), R3(uB, EAVES, v1), R3(uB, RIDGE, vm), R3(uA, RIDGE, vm)], [R3(uA, EAVES, v0), R3(uA, RIDGE, vm), R3(uB, RIDGE, vm), R3(uB, EAVES, v0)]], 'slate');
    for (const u of [uA, uB]) tris(k, [[R3(u, EAVES, v0), R3(u, EAVES, v1), R3(u, RIDGE, vm)]], 'slate', (_c, n) => n.x * (u < 0 ? -1 : 1) > 0);
    // central cross gable over the risalit, ridge level with the saddle's
    const c = -23.825, h = 13.525, r0 = -1.84, r1 = 14.8;
    facets(k, [[R3(c - h, EAVES, r0), R3(c - h, EAVES, r1), R3(c, RIDGE, r1), R3(c, RIDGE, r0)], [R3(c + h, EAVES, r1), R3(c + h, EAVES, r0), R3(c, RIDGE, r0), R3(c, RIDGE, r1)]], 'slate');
    // pavilions: truncated hips (no overhang: the cornice ring is the eave)
    for (const [u0, u1] of [[-163.7, -141.7], [94.0, 116.0]]) {
      const pv0 = -12.6, pv1 = 14.6, dd = (PAV_TOP - EAVES) / HIP;
      const a = [R3(u0, EAVES, pv0), R3(u1, EAVES, pv0), R3(u1, EAVES, pv1), R3(u0, EAVES, pv1)];
      const t = [R3(u0 + dd, PAV_TOP, pv0 + dd), R3(u1 - dd, PAV_TOP, pv0 + dd), R3(u1 - dd, PAV_TOP, pv1 - dd), R3(u0 + dd, PAV_TOP, pv1 - dd)];
      facets(k, [[a[0], a[1], t[1], t[0]], [a[1], a[2], t[2], t[1]], [a[2], a[3], t[3], t[2]], [a[3], a[0], t[0], t[3]], [t[0], t[1], t[2], t[3]]], 'slate');
    }
    // pavilion pediment roofs: short gables from the tympanum back into the hip
    // pavilion pediment roofs: the gable behind each tympanum, cut along its valleys where it meets the 34 deg hip
    const gableBack = (F: Face, c2: number, half: number, rise: number) => {
      const top = EAVES + rise, dR = rise / HIP;
      const up = (_c: T.Vector3, n: T.Vector3) => n.y > 0;
      if (F.along === 'u') {
        const v = F.a[1], vb = v - Math.sign(v) * dR;
        tris(k, [[R3(c2 - half, EAVES, v), R3(c2, top, v), R3(c2, top, vb)], [R3(c2 + half, EAVES, v), R3(c2, top, vb), R3(c2, top, v)]], 'slate', up);
      } else {
        const u = F.a[0], ub = u + (u < 0 ? dR : -dR);
        tris(k, [[R3(u, EAVES, c2 - half), R3(ub, top, c2), R3(u, top, c2)], [R3(u, EAVES, c2 + half), R3(u, top, c2), R3(ub, top, c2)]], 'slate', up);
      }
    };
    for (const p of PEDIMENTS.slice(2)) gableBack(FACE[p.face], p.c, p.half, p.rise);
  }

  // pediments: tympanum (brick), raking cornices (white chevron, the roof's overhang)
  for (const p of PEDIMENTS) {
    const F = FACE[p.face], f = F.f, tc = tOf(F, p.c), s = p.rise / p.half;
    m.triW(f, [tc - p.half, EAVES, 0], [tc + p.half, EAVES, 0], [tc, EAVES + p.rise, 0], 'brick');
    const ov = 0.45, th = 0.36, W = p.half + ov, Hc = p.rise + ov * s, e = th / s;
    relief(k, f, [[-W, 0], [0, Hc], [W, 0], [W - e, 0], [0, Hc - th], [-(W - e), 0]], tc, EAVES - ov * s, 0.4, 'white');
  }

  // ---- tympanum ornament
  const tymp = (name: string) => FACE[name];
  // NW centre: the Orange-Nassau arms between two oculi (crops nw--46_-22, nw--26_-2)
  {
    const F = tymp('nw-risalit'), f = F.f, tc = tOf(F, -23.55), y = EAVES + 0.25;
    for (const s of [-28.8, -18.4]) oculus(k, f, tOf(F, s), 14.95, 0.95);
    // red mantling: a tent of drapery from the crown down both sides, tied back at the foot
    relief(k, f, [[-2.75, 0.2], [-2.3, 0.0], [-1.6, 1.2], [-0.6, 3.1], [0, 3.45], [0.6, 3.1], [1.6, 1.2], [2.3, 0.0], [2.75, 0.2], [2.4, 1.5], [1.2, 3.4], [0, 3.85], [-1.2, 3.4], [-2.4, 1.5]], tc, y, 0.12, 'red');
    relief(k, f, [[-2.4, 1.5], [-1.2, 3.4], [0, 3.85], [1.2, 3.4], [2.4, 1.5], [1.5, 1.0], [0, 1.2], [-1.5, 1.0]], tc, y, 0.06, 'red');
    // blue banners (left) and the gold sunburst (right), the trophies behind the mantle
    relief(k, f, [[-2.5, 2.2], [-1.9, 3.6], [-1.6, 3.4], [-2.2, 2.0]], tc, y, 0.2, 'blue');
    relief(k, f, ellipse(0.42, 0.42, 10).getPoints(10).map(p => [p.x + 1.95, p.y + 3.35]) as [number, number][], tc, y, 0.2, 'gold');
    // shield: gold border, quartered blue/red/gold field, inescutcheon
    const shield: [number, number][] = [[-1.05, 3.0], [1.05, 3.0], [1.05, 1.6], [0.8, 1.0], [0, 0.6], [-0.8, 1.0], [-1.05, 1.6]];
    relief(k, f, shield, tc, y, 0.2, 'gold');
    for (const [qx, qy, c] of [[-0.48, 2.35, 'blue'], [0.48, 2.35, 'red'], [-0.48, 1.45, 'red'], [0.48, 1.45, 'blue']] as [number, number, C][]) slab(k, f, tc + qx, y + qy - 0.35, 0.78, 0.7, 0.05, c, 0.2);
    slab(k, f, tc, y + 1.65, 0.45, 0.55, 0.06, 'gold', 0.25);
    // crowned helm on top
    relief(k, f, [[-0.45, 3.0], [0.45, 3.0], [0.38, 3.55], [0, 3.75], [-0.38, 3.55]], tc, y, 0.24, 'gold');
    relief(k, f, [[-0.55, 3.75], [0.55, 3.75], [0.6, 4.05], [0.3, 3.95], [0, 4.25], [-0.3, 3.95], [-0.6, 4.05]], tc, y, 0.24, 'gold');
    // motto band (JE MAINTIENDRAI) under the shield
    relief(k, f, [[-1.7, 0.15], [-0.8, 0.35], [0.8, 0.35], [1.7, 0.15], [1.65, 0.55], [0.8, 0.75], [-0.8, 0.75], [-1.65, 0.55]], tc, y, 0.28, 'white');
    m.rect(f, tc - 1.1, tc + 1.1, y + 0.5, y + 0.58, 0.37, 'dark');
  }
  // SE centre: wheel window round a red shield, two oculi (crops se--44_-20, se--24_0)
  {
    const F = tymp('se-risalit'), f = F.f, tc = tOf(F, -23.9), yc = 16.2;
    const ring = ellipse(2.0, 2.0, 28); ring.holes.push(new T.Path(ellipse(1.72, 1.72, 28).getPoints(28).reverse()));
    put(k, f, new T.ExtrudeGeometry(ring, {depth: 0.22, bevelEnabled: false}), tc, yc, 0, 'white');
    put(k, f, new T.ExtrudeGeometry(ellipse(1.72, 1.72, 24), {depth: 0.09, bevelEnabled: false}), tc, yc, 0, 'dark');
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, g = new T.BoxGeometry(0.1, 1.12, 0.1).translate(0, 0.58 + 0.56, 0.05).rotateZ(a); put(k, f, g, tc, yc, 0.09, 'white'); }
    put(k, f, new T.ExtrudeGeometry(ellipse(0.62, 0.62, 14), {depth: 0.2, bevelEnabled: false}), tc, yc, 0.09, 'white');
    relief(k, f, [[-0.28, 0.32], [0.28, 0.32], [0.28, -0.05], [0, -0.38], [-0.28, -0.05]], tc, yc, 0.09, 'red', 0.29);
    for (const s of [-29.2, -18.45]) oculus(k, f, tOf(F, s), 15.3, 0.88);
  }
  // pavilion Sarphatistraat pediments: white trophy relief, a head in a cartouche between fanned banners and arms
  for (const [name, c] of [['nw-sw-pavilion', -152.65], ['nw-ne-pavilion', 105.2]] as [string, number][]) {
    const F = tymp(name), f = F.f, tc = tOf(F, c), y = EAVES + 0.1;
    relief(k, f, ellipse(0.55, 0.75, 12).getPoints(12).map(p => [p.x, p.y + 1.1]) as [number, number][], tc, y, 0.25, 'stone');
    relief(k, f, [[-0.3, 1.85], [0.3, 1.85], [0, 2.3]], tc, y, 0.2, 'stone');
    for (const s of [-1, 1]) {
      relief(k, f, [[s * 0.4, 0.1], [s * 2.4, 0.1], [s * 2.2, 0.6], [s * 1.5, 1.2], [s * 0.6, 1.6]], tc, y, 0.1, 'stone');
      for (const [x, yy] of [[1.0, 1.95], [1.6, 1.6], [2.1, 1.05]]) relief(k, f, [[s * 0.45, 1.0], [s * (x + 0.1), yy], [s * (x - 0.15), yy + 0.15]], tc, y, 0.18, 'stone');
    }
  }
  // SW end tympanum: the 1990 "Timpaan", a white oval with a row of gilded forms (crop sw-end)
  {
    const F = tymp('sw-end'), f = F.f, tc = tOf(F, 1.0), y = 15.0;
    relief(k, f, ellipse(1.85, 1.1, 18).getPoints(18).map(p => [p.x, p.y]) as [number, number][], tc, y, 0.1, 'stone');
    relief(k, f, [[-1.6, -0.6], [-1.25, 0.5], [-0.95, -0.1], [-0.6, 0.65], [-0.3, -0.05], [0.05, 0.7], [0.35, -0.05], [0.7, 0.65], [1.0, -0.1], [1.35, 0.55], [1.6, -0.6]], tc, y, 0.28, 'gold', 0.1);
  }
  // NE end tympanum: white trophy relief, an oval shield between two ships and banners (crop ne-end)
  {
    const F = tymp('ne-end'), f = F.f, tc = tOf(F, 0.7), y = EAVES + 0.1;
    relief(k, f, ellipse(0.6, 0.8, 12).getPoints(12).map(p => [p.x, p.y + 1.2]) as [number, number][], tc, y, 0.25, 'stone');
    for (const s of [-1, 1]) {
      relief(k, f, [[s * 0.8, 0.15], [s * 2.6, 0.15], [s * 2.3, 0.55], [s * 1.0, 0.55]], tc, y, 0.18, 'stone'); // hull
      relief(k, f, [[s * 1.4, 0.55], [s * 1.55, 0.55], [s * 1.5, 1.9]], tc, y, 0.16, 'stone'); // mast
      relief(k, f, [[s * 1.55, 1.75], [s * 2.3, 1.3], [s * 1.55, 0.9]], tc, y, 0.14, 'stone'); // sail
      relief(k, f, [[s * 0.55, 1.5], [s * 1.2, 2.6], [s * 0.9, 2.65]], tc, y, 0.16, 'stone'); // banner
    }
  }

  // dormers, chimney stacks
  for (const [name, list] of Object.entries(DORMERS)) {
    const F = FACE[name];
    const nearPediment = (s: number) => PEDIMENTS.some(p => (FACE[p.face].along === F.along) && Math.abs(Math.abs(s - p.c) - p.half) < 2.2 && (p.face === name || (p.face.includes('risalit') && name.slice(0, 2) === p.face.slice(0, 2))));
    for (const s of list) dormer(m, k, F.f, tOf(F, s), name === 'ne-end' ? 1.6 : 2.0, nearPediment(s) ? -1.3 : -0.5);
  }
  for (const [name, list] of Object.entries(STACKS)) {
    const F = FACE[name];
    for (const s of list) { const t = tOf(F, s); slab(k, F.f, t, EAVES, 0.95, 15.4 - EAVES, 1.35, 'brick', -1.4); slab(k, F.f, t, 15.4, 1.15, 0.2, 1.55, 'greyBrick', -1.5); }
  }

  m.flush(k);
}
