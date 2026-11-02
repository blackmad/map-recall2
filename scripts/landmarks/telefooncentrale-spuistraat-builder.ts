import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, put, poly, roofHeightAt, ringFrame, wallProbe, type Frame} from './nearbar-kit';
import {addShellTess} from './big-facade';
import {planarPolygon} from './worship-shell';
import {simplifyPath, wrapBandFace, type XZ} from '../../src/canalRecall/landmarks/wrapBand';
import source from './telefooncentrale-spuistraat-footprints.json';

/**
 * Former Rijkskantoorgebouw / telephone exchange, Nieuwezijds Voorburgwal 226 / Spuistraat 175 (BAG pand 0363100012165118, BAG
 * year 1927; designed 1924 by rijksbouwmeester J. Crouwel; municipal monument 207033). Built for the Geld- en Telefoonbedrijf,
 * a telephone exchange after 1950; since about 2000 a supermarket on the Nieuwezijds Voorburgwal and KPN offices, since 2015
 * the "Exchange" wing of the W Amsterdam hotel (entrance and rooftop glass box on the Spuistraat). It fills the whole block between
 * the Nieuwezijds Voorburgwal (east), Raadhuisstraat (north), Spuistraat (west) and Paleisstraat (south-east).
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) in the native frame of telefooncentrale-spuistraat-footprints.json (prepared by
 * telefooncentrale-telegraaf-prepare.ts). Facades are drawn on the simplified BAG ring (`facadeRing`), read from the rectified
 * Gemeente Amsterdam panorama crops (CC BY 4.0, ~50 px/m; w03-154 and w04-278 show every band) and the register text
 * (inventory: telefooncentrale-spuistraat-inventory.json):
 *  - dark brown brick in Flemish bond over a high grey granite plinth with basement grilles;
 *  - horizontal storeys: ground windows 2.45-5.85 m, then a projecting brick parapet band with stone edges over every storey
 *    (5.95-7.4, 10.45-11.95, 14.55-16.05 m), landscape windows with green steel frames (two side lights, a transom) between brick
 *    piers on 3.9-4.7 m bays;
 *  - the third floor set back behind deep brick piers under a continuous concrete canopy (19.6-20.05 m, 1.5 m deep), then a blind
 *    brick storey to the flat roof (24.2 m);
 *  - corner bays set back and a little lower, one window per storey per face; the parapet bands and the canopy do not step back
 *    there but run on round the corners as balconies with rounded noses (`wrapBand`, register: "lopen deze hier door als
 *    balkonbalustrades");
 *  - the Nieuwezijds Voorburgwal front: raised shop storey glazed 1.35-5.85 m behind a flight of steps the whole width;
 *  - Spuistraat: hotel entrance with a canopy at the 2.2 m niche and the big gold W sculpture beside it, side doors with canopies;
 *  - gold W logos on the corner parapets; the stretched-hexagon kiosk with a granite plinth, a dark canopy and a ribbon window at
 *    the sharp south-west corner; the glass-panelled box on the roof (3DBAG 32.9 m).
 */
type Surface = {type: string; rings: number[][][]};
type Src = {surfaces: Surface[]; facadeRing: number[][]; nativeRing: number[][]};
const src = closeEastSlot(structuredClone(source) as unknown as Src);

/**
 * 3DBAG cuts a 1.6 m wide, 0.7 m deep slot into the Nieuwezijds Voorburgwal front from 1.8 m to the roof (surfaces 250, 251, 418
 * and a 1.8 m roof 487, z -9.1 to -10.75), where the tram-wire mast stands in front of the wall; the BAG ring and every panorama
 * (w01-85, w01-85 alt) show a straight front there. The slot's walls are dropped, its 1.8 m front wall 252 is raised to the
 * roof and its floor 487 becomes roof at 24.22 m.
 */
function closeEastSlot(d: Src): Src {
  const at = (i: number, type: string) => d.surfaces[i]?.type === type && d.surfaces[i].rings[0].every(p => p[0] > 23 && p[0] < 24.2 && p[2] > -10.8 && p[2] < -9);
  if (![250, 251, 418].every(i => at(i, 'WallSurface')) || !at(252, 'WallSurface') || !at(487, 'RoofSurface')) return d;
  d.surfaces[252].rings[0] = d.surfaces[252].rings[0].map(p => [p[0], p[1] > 1 ? 24.22 : p[1], p[2]]);
  d.surfaces[487].rings[0] = d.surfaces[487].rings[0].map(p => [p[0], 24.22, p[2]]);
  d.surfaces = d.surfaces.filter((_, i) => ![250, 251, 418].includes(i));
  return d;
}
const RING = src.facadeRing;

const GROUND: [number, number] = [2.45, 5.85];
const SHOP: [number, number] = [1.35, 5.85];
const BANDS: [number, number][] = [[5.95, 7.4], [10.45, 11.95], [14.55, 16.05]];
const ROWS: [number, number][] = [[7.45, 10.35], [12.0, 14.5]];
const THIRD: [number, number] = [16.05, 19.6];
const CANOPY: [number, number] = [19.6, 20.05];
const PIER = 0.8;
/** The glass-panelled roof box: 3DBAG walls that rise above 30 m. */
const isBoxWall = (s: Surface) => s.type === 'WallSurface' && Math.max(...s.rings[0].map(p => p[1])) > 30.2;

type Main = {edge: number; bays: number; ground: 'shop' | 'plain' | 'none'; doors?: number[]; steps?: boolean};
/**
 * Bay counts read on the crops: east w01-85 nine (48 px/m, ~3.9 m pitch), north w05-4 three, Spuistraat north w04-278 four
 * (4.6 m pitch), Spuistraat south w02-278 six on the same pitch, Paleisstraat w03-154 six (3.9 m). Doors at t (m from the
 * viewer's left): the side entrances with canopies at the north end of the Spuistraat (w04-278), its south end (w02-278 right
 * edge) and the west end of the Paleisstraat (w03-154).
 */
const MAINS: Main[] = [
  {edge: 45, bays: 9, ground: 'shop', steps: true},
  {edge: 7, bays: 3, ground: 'plain'},
  {edge: 16, bays: 4, ground: 'plain', doors: [1.6]},
  {edge: 18, bays: 0, ground: 'none'},
  {edge: 20, bays: 6, ground: 'plain', doors: [25.9]},
  {edge: 36, bays: 6, ground: 'plain', doors: [1.7]},
];
/** Corner-bay faces with one window per storey (w06-4, w09-278, w11-85, w12-85, w08-154, w14-212). */
const CORNER_FACES = [2, 3, 11, 12, 24, 32, 40, 41];
/** The south-west face behind the kiosk is not on the BAG ring: 3DBAG roof outline above 15 m. */
const SW_FACE: [XZ, XZ] = [[-18.59, 26.12], [-11.38, 31.24]];
/** Corner runs from the end of one main face to the start of the next (facadeRing vertex indices), for the wrapped balconies. */
const CORNERS: XZ[][] = [
  ring(46, 7),
  ring(8, 16),
  [...ring(21, 26), SW_FACE[0], SW_FACE[1], ...ring(31, 36)],
  ring(37, 45),
];
function ring(i0: number, i1: number): XZ[] {
  const out: XZ[] = [];
  for (let i = i0; ; i = (i + 1) % RING.length) { out.push([RING[i][0], RING[i][1]]); if (i === i1) break; }
  return out;
}

let probe: ReturnType<typeof wallProbe>;

export function buildTelefooncentraleSpuistraat(_w: number, _d: number, b: BuildingTools) {
  const shell = {surfaces: src.surfaces.filter(s => !isBoxWall(s)), nativeRing: src.nativeRing};
  addShellTess(b, shell as never, {wall: 'brick', roof: 'slate'});
  roofBox(b);
  setSink(0.3, true);
  probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  for (const m of MAINS) mainFacade(b, m);
  for (const e of CORNER_FACES) { const {f, len} = snapped(e); cornerFace(b, f, len); }
  {
    const len = Math.hypot(SW_FACE[1][0] - SW_FACE[0][0], SW_FACE[1][1] - SW_FACE[0][1]);
    const {f} = snap(ringFrame([SW_FACE[0], SW_FACE[1], [0, 0]], 0).f, len);
    cornerFace(b, f, len, true);
    wLogo(b, f, len / 2, 20.9, 1.5);
  }
  for (const path of CORNERS) cornerBands(b, path);
  kiosk(b);
  // gold W logos on the parapets of the corner bays (w09-278 NW, w01-85 thumb SE, w14-212/w15-153 SW)
  { const {f, len} = snapped(12); wLogo(b, f, len / 2, 20.9, 1.5); }
  { const {f, len} = snapped(41); wLogo(b, f, len / 2, 20.9, 1.5); }
  wSculpture(b);
}

/** Ring edge frame moved onto the shell wall (median probe offset). */
function snapped(edge: number): {f: Frame; len: number} {
  const {f: f0, len} = ringFrame(RING, edge);
  return snap(f0, len);
}
function snap(f0: Frame, len: number): {f: Frame; len: number} {
  const offs = [0.25, 0.5, 0.75].flatMap(u => [4, 12].map(y => probe.offset(f0, len * u, y))).filter((o): o is number => o !== null).sort((a, c) => a - c);
  const off = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
  return {f: {...f0, origin: [f0.origin[0] + f0.n[0] * off, f0.origin[1] + f0.n[1] * off]}, len};
}

/** Window with green steel frame: glass 9 cm proud, two side-light mullions and a transom (every crop: w03-154, w04-278). */
function steelWindow(b: BuildingTools, f: Frame, t: number, y0: number, y1: number, w: number, transom = 0.78) {
  const h = y1 - y0;
  // glass 9 cm proud of the shell wall (4 cm read as z-fighting at range), 5 cm behind the brick piers' faces
  slab(b, f, t, y0, w, h, 0.09, 'glass');
  for (const k of [-1, 1]) plate(b, f, t + k * (w / 2 - w * 0.16), y0, 0.07, h, 0.09, 0.15, 'frame');
  plate(b, f, t, y0 + h * transom, w, 0.07, 0.09, 0.15, 'frame');
}
/** Box from `o0` to `o1` out of the wall, not sunk: thin bars on the glass. */
function plate(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o0: number, o1: number, c: string) {
  put(b, f, new T.BoxGeometry(w, h, o1 - o0).translate(0, h / 2, (o1 - o0) / 2), t, y, o0, c);
}

/** Parapet band: brick 0.25 m proud between a stone strip under it and a stone coping on top. */
function band(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number) {
  const c = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, c, y0, w, 0.2, 0.3, 'stone');
  slab(b, f, c, y0 + 0.1, w, y1 - y0 - 0.2, 0.25, 'brick');
  slab(b, f, c, y1 - 0.17, w, 0.17, 0.34, 'stone');
}

function mainFacade(b: BuildingTools, m: Main) {
  const {f, len} = snapped(m.edge);
  // wall head: the lowest shell roof (over 15 m) just inside the edge, capped at the main roof 24.2 m
  const head = Math.min(24.2, ...[0.2, 0.35, 0.5, 0.65, 0.8].map(u => roofHeightAt(src.surfaces as never, f.origin[0] + f.tangent[0] * len * u - f.n[0] * 0.8, f.origin[1] + f.tangent[1] * len * u - f.n[1] * 0.8) ?? 24.2).filter(h => h > 15));
  // ends 10 cm short of the ring vertices, so slab ends never share a plane with the short BAG jog walls
  const e0 = 0.1, e1 = len - 0.1;
  // plinth: granite, low on the east front (the steps take the height), with basement grilles elsewhere
  const plinthTop = m.ground === 'shop' ? 1.25 : 1.5;
  if (m.ground !== 'none') slab(b, f, len / 2, 0, e1 - e0, plinthTop, 0.15, 'concrete');
  for (const [y0, y1] of BANDS) band(b, f, e0, e1, y0, y1);
  // the deep canopy over the third floor and the stone coping of the blind top storey
  slab(b, f, len / 2, CANOPY[0], e1 - e0, CANOPY[1] - CANOPY[0], 1.5, 'concrete');
  slab(b, f, len / 2, head - 0.4, e1 - e0, 0.28, 0.12, 'stone'); // stone line just under the wall head (w01-85, w03-154)
  if (m.steps) steps(b, f, len);
  if (m.edge === 18) { entrance(b, f, len); return; }
  const pitch = len / m.bays, ww = pitch - PIER;
  const centres = [...Array(m.bays)].map((_, k) => pitch * (k + 0.5));
  for (const t of centres) {
    const door = m.doors?.some(d => Math.abs(d - t) < pitch / 2);
    if (m.ground === 'shop') {
      steelWindow(b, f, t, SHOP[0], SHOP[1], ww, 0.72);
    } else if (m.ground === 'plain') {
      if (!door) slab(b, f, t, 0.3, Math.min(2.0, ww - 0.6), 0.6, 0.2, 'dark'); // basement grille
      const sill = door ? 3.1 : GROUND[0];
      slab(b, f, t, sill - 0.15, ww + 0.2, 0.15, 0.2, 'stone'); // sill
      steelWindow(b, f, t, sill, GROUND[1], ww, 0.7);
    }
    for (const [y0, y1] of ROWS) steelWindow(b, f, t, y0, y1, ww);
    steelWindow(b, f, t, THIRD[0] + 0.1, THIRD[1] - 0.6, ww, 0.75);
  }
  // brick piers between the bays: shallow on the lower storeys, deep under the canopy (the third floor lies deeper, register)
  for (let k = 0; k <= m.bays; k++) {
    const t = Math.min(Math.max(pitch * k, PIER / 2 + e0), e1 - PIER / 2);
    const lower: [number, number][] = [[m.ground === 'shop' ? plinthTop : 1.5, BANDS[0][0]], [BANDS[0][1], BANDS[1][0]], [BANDS[1][1], BANDS[2][0]]];
    for (const [y0, y1] of lower) slab(b, f, t, y0 + 0.02, PIER, y1 - y0 - 0.04, 0.14, 'brick');
    slab(b, f, t, THIRD[0], PIER, THIRD[1] - THIRD[0], 0.55, 'brick');
  }
  // each side door stands on the axis of the bay it is in (w03-154: door and the window over it share one axis)
  for (const d of m.doors ?? []) sideDoor(b, f, centres.reduce((p, c) => (Math.abs(c - d) < Math.abs(p - d) ? c : p)));
}

/** Flight of granite steps along the raised shop storey of the Nieuwezijds Voorburgwal front (w01-85, w01-85 thumb). */
function steps(b: BuildingTools, f: Frame, len: number) {
  for (let k = 0; k < 6; k++) slab(b, f, len / 2, k * 0.2, len - 1.0 - k * 0.1, 0.2, 0.15 + (6 - k) * 0.38, 'concrete');
}

/** Side entrance: dark door in the plinth storey under a thin dark canopy (w03-154 left, w04-278 left). */
function sideDoor(b: BuildingTools, f: Frame, t: number) {
  slab(b, f, t, 0, 2.0, 2.6, 0.24, 'dark');
  slab(b, f, t, 2.6, 3.0, 0.25, 1.1, 'bronze');
}

/** Hotel entrance in the Spuistraat niche: glass doors under a canopy three bays wide (register; w04-278 thumb right). */
function entrance(b: BuildingTools, f: Frame, len: number) {
  slab(b, f, len / 2, 0, len - 0.5, 2.9, 0.08, 'glass');
  for (const k of [-1, 0, 1]) plate(b, f, len / 2 + k * (len - 0.8) / 2, 0, 0.08, 2.9, 0.08, 0.14, 'frame');
  slab(b, f, len / 2, 2.9, len - 0.4, 0.12, 0.12, 'frame');
  slab(b, f, len / 2, 3.1, len + 2.2, 0.35, 1.8, 'bronze');
  slab(b, f, len / 2, 3.1, 0.6, 0.3, 0.14, 'stone'); // wall plate the canopy hangs from, over the doors
}

/** Corner-bay face: one window per storey, centred (w06-4, w09-278 thumbs). `upper` skips the ground storey (kiosk in front). */
function cornerFace(b: BuildingTools, f: Frame, len: number, upper = false) {
  if (len < 3.4) return;
  const ww = Math.min(2.6, len - 1.4), t = len / 2;
  if (!upper) {
    slab(b, f, t, 0, len - 0.06, 1.5, 0.15, 'concrete');
    slab(b, f, t, GROUND[0] - 0.15, ww + 0.2, 0.15, 0.2, 'stone');
    steelWindow(b, f, t, GROUND[0], GROUND[1], ww, 0.7);
  }
  for (const [y0, y1] of ROWS) steelWindow(b, f, t, y0, y1, ww);
  steelWindow(b, f, t, THIRD[0] + 0.1, THIRD[1] - 0.6, ww, 0.75);
}

/**
 * Balconies round a corner: the three parapet bands and the canopy wrap the set-back corner bay as one slab with a rounded
 * nose (wrapBand on the corner run simplified to 0.8 m, its inner edge 0.3 m inside the real wall so it never floats).
 */
function cornerBands(b: BuildingTools, path: XZ[]) {
  const simple = simplifyPath(path, 0.8);
  const outline = (d: number, trim = 0) => {
    const p = trimEnds(path, trim), q = trimEnds(simple, trim);
    return [...wrapBandFace(q, {depth: d, arcSegmentsPerQuarter: 5}), ...wrapBandFace(p, {depth: 0.3, side: -1}).reverse()];
  };
  for (const [y0, y1] of BANDS) {
    extrude(b, outline(1.1), y0, 0.2, 'stone');
    extrude(b, outline(1.05, 0.06), y0 + 0.1, y1 - y0 - 0.2, 'brick'); // ends 6 cm inside the stone ends: no shared end plane
    extrude(b, outline(1.14), y1 - 0.17, 0.17, 'stone');
  }
  extrude(b, outline(1.5), CANOPY[0], CANOPY[1] - CANOPY[0], 'concrete');
}

/** The path with `d` metres cut off each end, along its end segments. */
function trimEnds(path: XZ[], d: number): XZ[] {
  if (!d) return path;
  const p = path.map(v => [...v] as XZ), n = p.length;
  const move = (i: number, j: number) => { const dx = p[j][0] - p[i][0], dz = p[j][1] - p[i][1], l = Math.hypot(dx, dz); if (l > 2 * d) { p[i][0] += dx / l * d; p[i][1] += dz / l * d; } };
  move(0, 1); move(n - 1, n - 2);
  return p;
}

/** Plan outline (native x, z) extruded from y to y + h. */
function extrude(b: BuildingTools, pts: XZ[], y: number, h: number, colour: string) {
  const s = new T.Shape(pts.map(p => new T.Vector2(p[0], -p[1])));
  const g = new T.ExtrudeGeometry(s, {depth: h, bevelEnabled: false, curveSegments: 1});
  g.rotateX(-Math.PI / 2); // shape (x, -z) in the xy plane -> (x, y=depth, z)
  g.translate(0, y, 0);
  b.add(g, colour as never);
}

/**
 * The stretched-hexagon kiosk at the sharp south-west corner (register; w10-278, w13-273, w14-212, w15-153): granite plinth,
 * blind brick, a dark canopy wrapping all sides, a ribbon window on the south faces and a concrete lintel under the zinc roof.
 */
function kiosk(b: BuildingTools) {
  const path: XZ[] = ring(26, 31);
  for (let e = 26; e <= 30; e++) {
    const {f, len} = snapped(e);
    slab(b, f, len / 2, 0, len - 0.04, 2.4, 0.15, 'concrete');
    if (e >= 28) {
      // edge 30 runs on 1.5 m past the kiosk into the main body's south-west corner: the ribbon stays on the kiosk part
      const r0 = 0.3, r1 = e === 30 ? 2.4 : len - 0.3, rc = (r0 + r1) / 2;
      slab(b, f, rc, 3.95, r1 - r0, 0.75, 0.04, 'glass');
      for (let k = 1; k < 4; k++) slab(b, f, r0 + (r1 - r0) * k / 4, 3.95, 0.07, 0.75, 0.06, 'frame', 0.04);
    }
    const head = roofHeightAt(src.surfaces as never, f.origin[0] + f.tangent[0] * len / 2 - f.n[0] * 0.4, f.origin[1] + f.tangent[1] * len / 2 - f.n[1] * 0.4) ?? 5.3;
    slab(b, f, len / 2, Math.min(head, 5.4) - 0.3, len - 0.04, 0.3, 0.12, 'concrete');
    if (e === 26) slab(b, f, len * 0.6, 0.05, 1.0, 2.2, 0.2, 'dark'); // door towards the Spuistraat (w10-278)
  }
  const inner = wrapBandFace(path, {depth: 0.3, side: -1}).reverse();
  extrude(b, [...wrapBandFace(path, {depth: 0.9, arcSegmentsPerQuarter: 3}), ...inner], 3.2, 0.4, 'bronze');
}

/** Gold chevron W logo (four strokes, the middle peak lower), alternating depths so no two stroke faces share a plane. */
function wLogo(b: BuildingTools, f: Frame, t: number, y: number, h: number) {
  const w = h * 1.35, s = h * 0.17;
  const strokes: [number, number, number, number][] = [[-w / 2, h, -w / 4, 0], [0, h * 0.72, -w / 4, 0], [0, h * 0.72, w / 4, 0], [w / 2, h, w / 4, 0]];
  strokes.forEach(([x0, y0, x1, y1], k) => poly(b, f, t, y, [[x1 - s / 2, y1], [x1 + s / 2, y1], [x0 + s / 2, y0], [x0 - s / 2, y0]], k % 2 ? 0.12 : 0.18, 'gold'));
}

/** The big gold lattice W on the Spuistraat pavement beside the hotel entrance (w04-278 thumb), on a dark foot. */
function wSculpture(b: BuildingTools) {
  const {f, len} = snapped(16);
  slab(b, f, len - 2.0, 0, 2.2, 0.15, 1.3, 'dark'); // foot from the plinth out to the sculpture
  wLogoAt(b, f, len - 2.0, 0.15, 1.9, 0.85);
}
function wLogoAt(b: BuildingTools, f: Frame, t: number, y: number, h: number, out: number) {
  const w = h * 1.3, s = h * 0.2;
  const strokes: [number, number, number, number][] = [[-w / 2, h, -w / 4, 0], [0, h * 0.75, -w / 4, 0], [0, h * 0.75, w / 4, 0], [w / 2, h, w / 4, 0]];
  strokes.forEach(([x0, y0, x1, y1], k) => {
    const s2 = new T.Shape([[x1 - s / 2, y1], [x1 + s / 2, y1], [x0 + s / 2, y0], [x0 - s / 2, y0]].map(p => new T.Vector2(p[0], p[1])));
    put(b, f, new T.ExtrudeGeometry(s2, {depth: k % 2 ? 0.22 : 0.3, bevelEnabled: false}).translate(0, 0, k % 2 ? 0.04 : 0), t, y, out, 'gold');
  });
}

/** The glass-panelled box on the roof (register: "langwerpige, doosvormige opbouw ... bekleed met glazen panelen"): its 3DBAG walls in glass with a mullion grid. */
function roofBox(b: BuildingTools) {
  for (const s of src.surfaces.filter(isBoxWall)) {
    const g = planarPolygon(s.rings);
    if (g) b.add(g, 'canopyGlass' as never);
  }
}
