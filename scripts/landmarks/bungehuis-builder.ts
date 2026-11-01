import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, put, roofHeightAt, ringFrame, wallProbe, type Frame} from './nearbar-kit';
import {addShellTess} from './big-facade';
import {planarPolygon} from './worship-shell';
import {raisedLettering} from './ornament-kit';
import source from './bungehuis-footprints.json';

/**
 * Bungehuis, Spuistraat 210 (BAG pand 0363100012167624, 1932-1934; Rijksmonument 518486): office building for N.V. Bunge's
 * Handelmaatschappij, designed by A.D.N. van Gendt and completed after his death in 1932 by W.J. Klok (Wikipedia nl "Bungehuis");
 * now Soho House. Free-standing on three sides: Singel (west), Paleisstraat (north) and Spuistraat (east).
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) in the native frame of scripts/landmarks/bungehuis-footprints.json; the street
 * fronts are drawn on the simplified BAG ring (`facadeRing`). Read from the rectified Gemeente Amsterdam panorama crops
 * (CC BY 4.0, 50 px/m: w04-96 shows the full height) and the Commons photographs listed in bungehuis-inventory.json:
 *  - natural stone throughout (no brick), a darker stone plinth 0-2.3 m with basement grilles;
 *  - projecting piers between the bays from the plinth to the cornice (26.6 m), each topped by a stubby pinnacle;
 *  - in every bay: a ground-storey window (2.45-5.1 m), a projecting Greek-key (meander) panel (5.2-6.8 m), then five storeys of
 *    canted steel bay windows with a small dark square in the spandrel above each;
 *  - banded corner zones (horizontal grooves) with one narrow window and a meander panel per storey at the north corners and the
 *    south end of the Singel front;
 *  - the Spuistraat entrance in the 0.5 m recess of ring edge 2: bronze doors in a stone surround with stepped side blocks, lamps
 *    and the raised letters BUNGE-HUIS (Commons "Amsterdam Spui 210 Bungehuis - door", Jane023, CC BY 3.0).
 */
type Src = {surfaces: {type: string; rings: number[][][]}[]; facadeRing: number[][]; nativeRing: number[][]};
const src = source as unknown as Src;
const RING = src.facadeRing;

const PLINTH = 2.3, CORNICE = 26.6;
const STOREYS: [number, number][] = [[6.9, 9.4], [10.7, 13.4], [14.7, 17.4], [18.7, 20.9], [22.3, 24.4]];
type Facade = {edge: number; bays: number[]; piers: number[]; bayW: number; corners: [number, number][]};
/**
 * Bay and pier centres in metres from the viewer's left end of each ring edge, read on the crops:
 *  - Singel (edge 15, w01-278, 39 px/m): bays on 4.065 m from 1.15 m; the south end 36.5-39.2 m is a banded corner zone.
 *  - Paleisstraat (edge 10, w02-351 2022 view, 46 px/m, east end first): banded zones 2.6 m at both corners, seven bays on 3.3 m.
 *  - Spuistraat south of the entrance (edge 28, w03-96): six bays on 3.3 m; north of it (edge 5, w04-96): three bays on 3.45 m
 *    and the banded corner zone from 11.9 m.
 *  - Spuistraat south wing (edge 24, w06-96): one bay.
 */
const FACADES: Facade[] = [
  {edge: 15, bays: [...Array(9)].map((_, k) => 1.15 + 4.065 * k), piers: [...Array(9)].map((_, k) => 3.18 + 4.065 * k), bayW: 2.0, corners: [[36.6, 39.24]]},
  {edge: 10, bays: [...Array(7)].map((_, k) => 4.25 + 3.31 * k), piers: [...Array(8)].map((_, k) => 2.6 + 3.31 * k), bayW: 1.9, corners: [[0, 2.15], [25.8, 28.37]]},
  {edge: 28, bays: [...Array(6)].map((_, k) => 1.75 + 3.3 * k), piers: [0.4, ...[...Array(5)].map((_, k) => 3.4 + 3.3 * k)], bayW: 1.9, corners: []},
  {edge: 5, bays: [3.0, 6.4, 9.8], piers: [1.25, 4.6, 8.1, 11.5], bayW: 1.9, corners: [[11.95, 13.69]]},
  {edge: 24, bays: [2.66], piers: [0.6, 4.7], bayW: 1.9, corners: []},
];

export function buildBungehuis(_w: number, _d: number, b: BuildingTools) {
  addShellTess(b, src as never, {wall: 'stone', roof: 'slate'});
  setSink(0.3, true);
  const probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface' || s.type === 'RoofSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  for (const fa of FACADES) {
    const {f: f0, len} = ringFrame(RING, fa.edge);
    const offs = [0.2, 0.5, 0.8].flatMap(u => [4, 12].map(y => probe.offset(f0, len * u, y))).filter((o): o is number => o !== null).sort((a, c) => a - c);
    const off = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
    const f: Frame = {...f0, origin: [f0.origin[0] + f0.n[0] * off, f0.origin[1] + f0.n[1] * off]};
    // wall head: lowest shell roof 0.6 m inside the edge, so cornice and pinnacles never stand above a lower roof
    const head = Math.min(CORNICE, ...[0.15, 0.5, 0.85].map(u => roofHeightAt(src.surfaces as never, f.origin[0] + f.tangent[0] * len * u - f.n[0] * 0.6, f.origin[1] + f.tangent[1] * len * u - f.n[1] * 0.6) ?? CORNICE));
    facade(b, f, len, head, fa);
  }
  entrance(b);
}

function facade(b: BuildingTools, f: Frame, len: number, head: number, fa: Facade) {
  const c = len / 2;
  slab(b, f, c, 0, len - 0.1, PLINTH, 0.18, 'sandstone' as never); // plinth, ends 5 cm short of the corners
  slab(b, f, c, PLINTH, len - 0.1, 0.14, 0.4, 'sandstone' as never); // plinth cap, 13 cm proud of the window sills over it
  slab(b, f, c, head - 0.6, len - 0.1, 0.5, 0.5, 'stone'); // cornice band
  for (const t of fa.piers) {
    if (t < 0.4 || t > len - 0.4) continue;
    slab(b, f, t, PLINTH + 0.14, 0.9, head - 0.6 - PLINTH - 0.14, 0.38, 'stone');
    // pinnacle over the cornice, reaching back onto the wall head; it stands ~1 m clear of the shell's parapet just behind it
    // (3DBAG puts the parapet up to 1.4 m over the cornice on the Singel, which hid 0.9 m stubs the photos show plainly)
    const roof = roofHeightAt(src.surfaces as never, f.origin[0] + f.tangent[0] * t - f.n[0] * 0.6, f.origin[1] + f.tangent[1] * t - f.n[1] * 0.6) ?? head;
    slab(b, f, t, head - 0.1, 0.7, Math.max(0.9, roof + 1.0 - (head - 0.1)), 0.5, 'stone', -0.4);
  }
  for (const t of fa.bays) bay(b, f, t, fa.bayW, len);
  for (const [z0, z1] of fa.corners) cornerZone(b, f, z0, z1, head);
}

/** One bay: basement grille, ground-storey window, meander panel, five canted bay windows with a dark square above each. */
function bay(b: BuildingTools, f: Frame, t: number, w: number, len: number) {
  const half = Math.min(w / 2, t - 0.15, len - t - 0.15), bw = 2 * half;
  if (bw < 1) return;
  slab(b, f, t, 0.35, bw * 0.75, 0.6, 0.22, 'dark'); // basement grille in the plinth
  if (t < len - 1.3) window(b, f, t, 2.5, bw, 2.6, 0.12, 3); // none beside the entrance block
  meander(b, f, t, 5.2, Math.min(bw + 0.9, 2.6), 1.6);
  for (const [y0, y1] of STOREYS) {
    slab(b, f, t, y0 - 0.22, bw + 0.3, 0.2, 0.5, 'stone'); // sill
    cantedGlass(b, f, t, y0, bw, y1 - y0, 0.36, 0.22);
    const fw = bw - 0.44; // front face of the bay
    // steel bars as thin plates on the front face (deep bars' side faces would turn the assembly's facing axis sideways in the audit)
    for (const k of [-1, 1]) plate(b, f, t + k * fw / 6, y0, 0.06, y1 - y0, 0.36, 0.41, 'frame');
    plate(b, f, t, y0 + (y1 - y0) * 0.5, fw, 0.06, 0.36, 0.41, 'frame'); // transom
    for (const k of [-1, 1]) plate(b, f, t + k * fw / 2, y0, 0.07, y1 - y0, 0.34, 0.41, 'frame'); // front corners of the cants
    slab(b, f, t, y1, bw + 0.2, 0.22, 0.48, 'stone'); // head
    if (y1 < 25) slab(b, f, t, y1 + 0.55, 0.26, 0.26, 0.08, 'bronze'); // the small dark square in the spandrel above (a stone inlay, not an opening)
  }
}
/**
 * Canted bay glazing: front and two cants as three quads from the wall plane, `w` wide at the wall, `proj` out, the front
 * `w - 2*bevel` wide. No back or wall-perpendicular faces (a sunk prism's hidden side faces read as openings on the cross walls);
 * the stone sill and head slabs close top and bottom.
 */
function cantedGlass(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, proj: number, bevel: number) {
  const P = (u: number, o: number, yy: number) => [u, yy, o];
  const a = [-w / 2, 0], c = [-w / 2 + bevel, proj], d = [w / 2 - bevel, proj], e = [w / 2, 0];
  // the cants are drawn in canopyGlass (same tint as glass): the audit then takes the bay's front as the opening and reads its
  // facing from it, instead of from the steep cants, whose normals are mostly along the wall
  const quads: [number[], number[], string][] = [[a, c, 'canopyGlass'], [c, d, 'glass'], [d, e, 'canopyGlass']];
  for (const [p, q, col] of quads) {
    const v = [P(p[0], p[1], 0), P(q[0], q[1], 0), P(q[0], q[1], h), P(p[0], p[1], h)];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute([...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]], 3));
    g.computeVertexNormals();
    put(b, f, g, t, y, 0, col);
  }
}
/** Box from `o0` to `o1` out of the wall, not sunk (setSink would give thin bars deep side faces). */
function plate(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o0: number, o1: number, c: string) {
  put(b, f, new T.BoxGeometry(w, h, o1 - o0).translate(0, h / 2, (o1 - o0) / 2), t, y, o0, c);
}
/** Flat window on the wall: glass 12 cm proud with dark steel frame bars `bars` across. */
function window(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, out: number, bars: number) {
  slab(b, f, t, y, w, h, out, 'glass');
  for (let k = 1; k < bars; k++) plate(b, f, t - w / 2 + k * w / bars, y, 0.06, h, out, out + 0.06, 'frame');
  plate(b, f, t, y + h * 0.62, w, 0.06, out, out + 0.06, 'frame');
  slab(b, f, t, y - 0.16, w + 0.25, 0.16, out + 0.15, 'stone'); // sill
}
/**
 * Greek-key panel: a stone panel `w` x `h` standing 0.32 m proud with the key drawn as raised 9 cm bars (one meander turn on each
 * side of a centre square, as on every bay of the photos).
 */
function meander(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number) {
  slab(b, f, t, y, w, h, 0.32, 'stone');
  const o = 0.32, d = 0.09, s = 0.07, u = (w - 0.3) / 12, v = (h - 0.3) / 4, x0 = t - w / 2 + 0.15, y0 = y + 0.15;
  const bar = (a: number, c: number, e: number, g: number) => slab(b, f, x0 + (a + c) / 2 * u, y0 + Math.min(e, g) * v, Math.max(s, Math.abs(c - a) * u + s), Math.max(s, Math.abs(g - e) * v + s), d, 'stone', o);
  // frame lines top and bottom, then a key on each half, mirrored
  bar(0, 12, 0, 0); bar(0, 12, 4, 4);
  for (const m of [1, -1]) {
    const X = (x: number) => (m > 0 ? x : 12 - x);
    bar(X(1), X(1), 0, 3); bar(X(1), X(4), 3, 3); bar(X(4), X(4), 3, 1); bar(X(4), X(2.5), 1, 1); bar(X(2.5), X(2.5), 1, 2);
  }
  slab(b, f, t, y0 + 1.6 * v, 0.24, 0.24, 0.1, 'sandstone' as never, o); // centre square (darker stone)
}
/** Banded corner zone: horizontal grooves every 0.6 m (raised bands 12 cm proud), one narrow window and a meander panel per storey. */
function cornerZone(b: BuildingTools, f: Frame, z0: number, z1: number, head: number) {
  const w = z1 - z0, c = (z0 + z1) / 2;
  if (w < 1.2) return;
  for (let y = PLINTH + 0.3; y < head - 0.9; y += 0.6) slab(b, f, c, y, w - 0.1, 0.32, 0.14, 'stone');
  const ww = Math.min(1.1, w - 0.5);
  window(b, f, c, 2.5, ww, 2.6, 0.2, 2);
  for (const [y0, y1] of STOREYS) {
    window(b, f, c, y0, ww, y1 - y0, 0.2, 2);
    meander(b, f, c, y0 - 1.25, Math.min(1.4, w - 0.3), 0.95);
  }
}

/**
 * Spuistraat entrance on ring edge 2 (3.2 m, set 0.5 m back): bronze double doors 2.4 x 4.1 m up three steps, stone side blocks
 * stepping back towards the top with lamps and bronze finials, a lintel block carrying BUNGE-HUIS in raised letters, and a stepped
 * meander frieze over it (Commons door photograph; panorama w03-96 right edge).
 */
function entrance(b: BuildingTools) {
  const {f, len} = ringFrame(RING, 2), c = len / 2;
  for (let k = 0; k < 3; k++) slab(b, f, c, k * 0.17, 3.0, 0.17, 1.1 - k * 0.3, 'sandstone' as never);
  slab(b, f, c, 0.51, 2.4, 4.1, 0.12, 'bronze');
  for (let k = 1; k < 6; k++) plate(b, f, c - 1.2 + k * 0.4, 0.8, 0.06, 3.6, 0.12, 0.22, 'bronze'); // key-pattern ribs of the doors
  for (const s of [-1, 1]) {
    const t = c + s * 2.0;
    slab(b, f, t, 0, 1.2, 4.6, 1.2, 'stone');
    slab(b, f, t, 4.6, 1.0, 0.5, 1.0, 'stone');
    slab(b, f, t, 5.1, 0.8, 0.5, 0.8, 'stone');
    put(b, f, new T.CylinderGeometry(0.16, 0.22, 0.4, 10), t, 4.4, 1.45, 'bronze'); // lamp under the block's step
    put(b, f, new T.CylinderGeometry(0.04, 0.08, 0.7, 6).translate(0, 0.35, 0), t, 5.6, 0.4, 'bronze'); // finial
  }
  slab(b, f, c, 4.61, 3.6, 1.5, 0.9, 'stone'); // lintel block
  const txt = raisedLettering({text: 'BUNGE-HUIS', heightM: 0.75, maxWidthM: 3.2, depthM: 0.1});
  put(b, f, txt.geometry, c, 5.36, 0.9, 'stone');
  slab(b, f, c, 6.11, 4.8, 0.5, 0.6, 'stone'); // stepped frieze over the lintel
}
