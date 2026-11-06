import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {frameFromBearing} from './modern-kit';
import {letters, put, setSink, type Frame} from './nearbar-kit';
import {brickLattice, latticeOpenings, type LatticeBay, type LatticePart, type LatticeSpec} from '../../src/canalRecall/landmarks/brickLattice';

/**
 * Xavier, Gustav Mahlerlaan / George Gershwinlaan, Zuidas (K en K Architecten, Pim Köther; built 2016-2019; nl.wikipedia
 * "Xavier (Amsterdam)": 159 flats, a 21-storey front on the Gustav Mahlerlaan and two six-storey blocks on the Gershwinlaan
 * round a courtyard over a garage). BAG pands 0363100012246555 (tower and east wing) and 0363100012246554 (west block).
 * Native east/south metres from the vertex average of the tower pand (scripts/landmarks/xavier-zuidas-footprints.json),
 * y above local ground.
 *
 * Read from Gemeente Amsterdam panoramas (2025) and Wikimedia Commons photographs by MrAronymous (Zuidas Mahler 08, Gershwin 27,
 * 2021, CC BY-SA 4.0), see xavier-zuidas-inventory.json:
 *  - storeys: a 4.6 m ground storey and 3.26 m floors; the 3DBAG roof steps fall on them (tier slabs at 30.7, 47.0, 60.0 m;
 *    crown terraces at 63.3 / 66.5 m; roof 73.1 m, parapet to 74.3 m);
 *  - the tower stands in tiers that each step out over the one below with a thick dark slab edge (floors 8, 13, 17). The BAG
 *    outline is the top-view outline, so it is the widest tier with its slab: tiers sit 2.0 / 1.2 / 0.6 m inside it (estimated from the
 *    Commons photographs; the 3DBAG LoD2.2 walls are a straight extrusion of the outline and cannot show the flares);
 *  - mottled grey-brown brick lattice with square four-pane windows in deep reveals; stacks of projecting balconies (pale slabs,
 *    glass balustrades) on the south, east and west faces; a three-axis zone of recessed loggias on the north face;
 *  - two-storey shop plinth with black steel bands, a cantilevered podium slab with a black railing at 7.9 m;
 *  - crown set back above the top slab, higher in the middle, stepping down to terraces at the south corners;
 *  - the six-storey wings with tall two-pane windows and black steel bands, the courtyard gate with XAVIER letters.
 */
type Rect = {x0: number; x1: number; z0: number; z1: number};
const F = (j: number) => 4.6 + j * 3.26;
const RING: Rect = {x0: -31.1, x1: 13.8, z0: -20.15, z1: -0.4};
const inset = (r: Rect, d: number): Rect => ({x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d});
/** The glass plane lies this far behind the wall line (the lattice's t = 0 / length end faces stand on the wall line). */
const GLASS = 0.05;
/** Tier slab edges stand this far out from the wall line: 15 cm before the brick fronts (clear of the 8 cm near-coplanar band where the slab overlaps
 *  the lattice top below it), and 10 cm or more off every lower front plane (the audit clusters planes within 3 cm into one host wall; a plane
 *  joining the east link at 13.75 m with the top tier at 13.70 m made a 61 m tall host the tier-2 balconies stood outside of). */
const SLAB = 0.5;
const T1 = inset(RING, 2.0), T2 = inset(RING, 1.2), T3 = inset(RING, 0.6), CROWN = inset(RING, 1.4);

const MAT: Record<LatticePart, string> = {pier: 'brick', band: 'brick', bar: 'frame', balconySlab: 'stone', balustrade: 'canopyGlass', loggiaSlab: 'brick', railing: 'bronze'};
type Side = 'N' | 'E' | 'S' | 'W';
/** Frame of a rect face: t from the viewer's left end, n outward (modern-kit frameFromBearing). */
function frameOf(r: Rect, side: Side): {f: Frame; len: number} {
  if (side === 'N') return {f: frameFromBearing([r.x1, r.z0], 0), len: r.x1 - r.x0};
  if (side === 'E') return {f: frameFromBearing([r.x1, r.z1], 90), len: r.z1 - r.z0};
  if (side === 'S') return {f: frameFromBearing([r.x0, r.z1], 180), len: r.x1 - r.x0};
  return {f: frameFromBearing([r.x0, r.z0], 270), len: r.z1 - r.z0};
}
function boxAt(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, out: number, depth: number, c: string) {
  put(b, f, new T.BoxGeometry(t1 - t0, y1 - y0, depth).translate(0, (y1 - y0) / 2, depth / 2), (t0 + t1) / 2, y0, out, c);
}
type FaceSpec = Omit<LatticeSpec, 'length'>;
/** Draw a lattice on a face frame; returns the openings for extras (steel bands). */
function lattice(b: BuildingTools, f: Frame, len: number, spec: FaceSpec, t0 = 0) {
  const full = {...spec, length: len};
  for (const p of brickLattice(full)) boxAt(b, f, t0 + p.t0, t0 + p.t1, p.y0, p.y1, p.out, p.depth, MAT[p.part]);
  return latticeOpenings(full);
}
const W = (n = 1, width = 1): LatticeBay[] => Array.from({length: n}, () => ({kind: 'window' as const, width}));
const bay = (kind: LatticeBay['kind'], width: number): LatticeBay => ({kind, width});

// ---- facade systems (counts from the photos; widths in metres before scaling to the face) ----
const tower: Omit<FaceSpec, 'floors' | 'bays'> = {
  window: {width: 1.7, sill: 0.75, head: 2.75, bars: {vertical: 1, transoms: 1, through: true}}, bayPier: 0.6, doorHead: 2.75,
  pierDepth: 0.3, bandDepth: 0.3, loggia: {depth: 0.9, railing: 1.1}, balcony: {depth: 1.5, slab: 0.22, balustrade: 1.05}, doorBarPitch: 2.6, sink: {bar: 0.05},
};
/** North (Gustav Mahlerlaan), t from the east end: three windows, three loggias, seven windows (panorama 01-09-51-01_00459, Mahler 08). */
const NORTH: LatticeBay[] = [...W(3), ...Array.from({length: 3}, () => bay('loggia', 1)), ...W(7)];
/** East, t from the south: two windows, the balcony stack, a window at the north corner (Mahler 08, panorama 2025-09-29_14-53-32_01590). */
const EAST: LatticeBay[] = [bay('window', 3), bay('window', 3), bay('balcony', 5.5), bay('window', 3)];
/** West, t from the north: one window, the balcony stack, three windows (Mahler 08: window pitch 45 px, balcony bay 113 px on tier 1;
 *  not the east face's mirror, which has two windows south of its stack). */
const WEST: LatticeBay[] = [bay('window', 2.4), bay('balcony', 6.0), bay('window', 2.4), bay('window', 2.4), bay('window', 2.4)];
/** South over the courtyard, t from the west: four wide balcony stacks between window axes (Gershwin 27, measured at 24.4 px/m). */
const SOUTH: LatticeBay[] = [bay('balcony', 7.8), bay('window', 3.3), bay('balcony', 7.4), bay('window', 3.3), bay('window', 3.1), bay('balcony', 6.9), bay('window', 2.9), bay('balcony', 6.5)];
const BAYS: Record<Side, LatticeBay[]> = {N: NORTH, E: EAST, S: SOUTH, W: WEST};

const crownSys: Omit<FaceSpec, 'floors' | 'bays'> = {...tower, window: {width: 2.2, sill: 0.4, head: 2.8, bars: {vertical: 1, transoms: 1, through: true}}};
const wing: Omit<FaceSpec, 'floors' | 'bays'> = {
  window: {width: 1.2, sill: 0.5, head: 2.6, bars: {vertical: 1, transoms: 0}}, bayPier: 0.9, doorHead: 3.4,
  pierDepth: 0.3, bandDepth: 0.3, doorBarPitch: 2.8, sink: {bar: 0.05},
};
const shopBays = (len: number, pitch: number) => Array.from({length: Math.max(1, Math.round(len / pitch))}, () => bay('shop', 1));
const winBays = (len: number, pitch: number) => W(Math.max(1, Math.round(len / pitch)));

/** Solid box in native coordinates. */
const box = (b: BuildingTools, r: Rect, y0: number, y1: number, c: string) =>
  b.add(new T.BoxGeometry(r.x1 - r.x0, y1 - y0, r.z1 - r.z0), c as never, (r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2);
const grow = (r: Rect, d: Partial<Record<Side, number>>): Rect => ({x0: r.x0 - (d.W ?? 0), x1: r.x1 + (d.E ?? 0), z0: r.z0 - (d.N ?? 0), z1: r.z1 + (d.S ?? 0)});
/** A closed core box (core colour) under a closed roof slab whose top lies 10 cm under the lattice tops (a coping, clear of the 8 cm near-coplanar band). */
function volume(b: BuildingTools, r: Rect, y0: number, top: number, core: string, roof: string, abut: Side[] = []) {
  // sides that abut a neighbouring volume run 5 cm into it instead (an inset there would open a slit between the two cores)
  const c = inset(r, GLASS), g = GLASS + 0.05;
  box(b, grow(c, Object.fromEntries(abut.map(s => [s, g]))), y0, top - 0.25, core);
  box(b, inset(r, 0.02), top - 0.32, top - 0.1, roof);
}
/** A dark railing panel round the given sides of a slab, 6 cm inside its edge, standing on it (sunk 5 cm). */
function railing(b: BuildingTools, r: Rect, y: number, sides: Side[], h = 1.1, ins = 0.06, d = 0.05) {
  for (const s of sides) {
    const {f, len} = frameOf(inset(r, ins), s);
    boxAt(b, f, 0, len, y - 0.05, y + h, -d, d, 'bronze');
  }
}

/** Brick posts filling the outside corners of a rect between the lattices of its two faces (they stop at the corner). */
function corners(b: BuildingTools, r: Rect, y0: number, y1: number, d = 0.3, which: [boolean, boolean, boolean, boolean] = [true, true, true, true]) {
  const c: Rect[] = [
    {x0: r.x1, x1: r.x1 + d, z0: r.z0 - d, z1: r.z0}, {x0: r.x1, x1: r.x1 + d, z0: r.z1, z1: r.z1 + d},
    {x0: r.x0 - d, x1: r.x0, z0: r.z1, z1: r.z1 + d}, {x0: r.x0 - d, x1: r.x0, z0: r.z0 - d, z1: r.z0},
  ];
  c.forEach((q, i) => { if (which[i]) box(b, q, y0, y1, 'brick'); });
}

/** The cantilevered podium slab at 7.4-7.9 m: 1.4 m beyond the plinth on the Mahlerlaan (Mahler 08 against the 1.8 m shop bays), about 1.2 m
 *  on the side streets (estimated); the courtyard side only carries the slab edge. */
const POD: Rect = grow(T1, {N: 1.4, E: 1.2, W: 1.2, S: 0.35});
export function buildXavierZuidas(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  setSink(0);
  // ---------------- massing ----------------
  // tower cores (glass behind the brick lattice), each ending inside the slab above it
  // (the glass plane sits 5 cm behind the wall line, so the lattice pieces' end faces at a corner never lie on the next face's glass)
  box(b, inset(T1, GLASS), 0, 30.4, 'glass');
  box(b, inset(T2, GLASS), 30.45, 46.7, 'glass');
  box(b, inset(T3, GLASS), 46.75, 59.75, 'glass');
  // slabs: the thick dark edges of the tiers, the podium slab and the top slab under the crown
  box(b, POD, 7.41, 7.86, 'bronze');
  box(b, inset(T2, -SLAB), F(8) - 0.55, F(8), 'bronze');
  box(b, inset(T3, -SLAB), F(13) - 0.55, F(13), 'bronze');
  box(b, inset(T3, -SLAB), F(17) - 0.55, F(17), 'bronze');
  // crown: the middle to 74.3 m, the ends to 70.3 m, the south corners to 63.7 m (3DBAG roof planes)
  const C = CROWN, XM0 = -23.0, XM1 = 7.0, ZC = -8.0;
  const mid: Rect = {x0: XM0 - 0.05, x1: XM1 + 0.05, z0: C.z0, z1: C.z1};
  const nw: Rect = {x0: C.x0, x1: XM0, z0: C.z0, z1: ZC + 0.05}, sw: Rect = {x0: C.x0, x1: XM0, z0: ZC, z1: C.z1};
  const ne: Rect = {x0: XM1, x1: C.x1, z0: C.z0, z1: ZC + 0.05}, se: Rect = {x0: XM1, x1: C.x1, z0: ZC, z1: C.z1};
  volume(b, mid, 59.8, 74.3, 'glass', 'slate', ['W', 'E']);
  volume(b, nw, 59.8, 70.3, 'glass', 'slate', ['E', 'S']); volume(b, ne, 59.8, 70.3, 'glass', 'slate', ['W', 'S']);
  volume(b, sw, 59.8, 63.7, 'glass', 'slate', ['E', 'N']); volume(b, se, 59.8, 63.7, 'glass', 'slate', ['W', 'N']);
  // low deck over the garage between the tower and the wings, the east link, the two wings
  const deckA: Rect = {x0: RING.x0 - 0.1, x1: -16.85, z0: T1.z1 - 0.2, z1: 9.75}, deckB: Rect = {x0: -16.9, x1: -0.25, z0: T1.z1 - 0.2, z1: 6.1};
  volume(b, deckA, 0, 3.5, 'glass', 'concrete', ['N', 'S', 'E']); volume(b, deckB, 0, 3.5, 'glass', 'concrete', ['N', 'W', 'E']);
  const link: Rect = {x0: -0.3, x1: 13.9, z0: T1.z1 - 0.2, z1: 10.0};
  const west: Rect = {x0: -31.36, x1: -16.3, z0: 9.7, z1: 34.1}, east: Rect = {x0: -1.1, x1: 13.9, z0: 9.95, z1: 34.0};
  volume(b, link, 0, 17.0, 'glass', 'slate', ['N', 'W', 'S']);
  volume(b, west, 0, 23.6, 'glass', 'slate', ['N']); volume(b, east, 0, 23.4, 'glass', 'slate', ['N']);
  b.mark?.('shell');

  // ---------------- tower fronts ----------------
  const tiers: {r: Rect; floors: number[]}[] = [
    {r: T1, floors: [7.63, F(1), F(2), F(3), F(4), F(5), F(6), F(7), 30.4]},
    {r: T2, floors: [30.45, F(8), F(9), F(10), F(11), F(12), 46.7]},
    {r: T3, floors: [46.75, F(13), F(14), F(15), F(16), 59.75]},
  ];
  const slabTops = [7.86, F(8), F(13), F(17)];
  for (const {r, floors} of tiers) for (const side of ['N', 'E', 'S', 'W'] as Side[]) {
    const {f, len} = frameOf(r, side);
    const spec = {...tower, floors, bays: BAYS[side]};
    for (const p of brickLattice({...spec, length: len})) {
      let {y0, y1} = p;
      // a balcony on a tier's first floor would lie level with the tier slab: lift its top 6 cm clear of the slab
      if (p.part === 'balconySlab' && slabTops.some(s => Math.abs(s - y1) < 0.05)) y1 += 0.06;
      if (p.part === 'balustrade' && slabTops.some(s => Math.abs(s + 0.06 - y0) < 0.05 || Math.abs(s - y0) < 0.05)) y0 += 0.06;
      boxAt(b, f, p.t0, p.t1, y0, y1, p.out, p.depth, MAT[p.part]);
    }
  }
  // plinth: shop fronts with a black steel band on the street faces, windows over the deck on the courtyard side
  for (const side of ['N', 'E', 'W', 'S'] as Side[]) {
    const {f, len} = frameOf(T1, side);
    if (side === 'S') { lattice(b, f, len, {...tower, floors: [0, 4.65, 7.63], bays: winBays(len, 3.2)}); continue; }
    lattice(b, f, len, {...wing, doorHead: 3.9, floors: [0, 4.65], bays: shopBays(len, 3.15)});
    lattice(b, f, len, {...tower, floors: [4.65, 7.63], bays: winBays(len, 3.15)});
    boxAt(b, f, 0, len, 3.9, 4.7, -0.15, 0.57, 'bronze');
  }
  for (const {r, floors} of tiers) corners(b, r, floors[0], floors[floors.length - 1]);
  corners(b, T1, 0, 7.63);
  railing(b, POD, 7.86, ['N', 'E', 'W']);
  // at the slab edge (10 cm thick on the south): elsewhere its back face shared a plane with a shop-pier reveal on the link 60 m below, and the
  // audit clustered the two into one tall host wall the balcony balustrades then stood outside of
  railing(b, inset(T3, -SLAB), F(17), ['N', 'E', 'W'], 1.1, 0); railing(b, inset(T3, -SLAB), F(17), ['S'], 1.1, 0, 0.1);

  // ---------------- crown ----------------
  const cfloors = (top: number, from = 59.8) => [from, ...[17, 18, 19, 20].map(F).filter(y => y > from + 0.3 && y < top - 1), top];
  const crownFace = (r: Rect, side: Side, top: number, bays: LatticeBay[], from = 59.8) => {
    const {f, len} = frameOf(r, side);
    lattice(b, f, len, {...crownSys, floors: cfloors(top, from), bays});
  };
  crownFace(mid, 'N', 74.3, winBays(XM1 - XM0, 3.0));
  // south: two raised brick blocks of two big windows each, a band of recessed loggias between them (Gershwin 27)
  crownFace(mid, 'S', 74.3, [bay('window', 4.3), bay('window', 4.3), ...Array.from({length: 4}, () => bay('loggia', 3.4)), bay('window', 4.0), bay('window', 4.0)]);
  crownFace(mid, 'W', 74.3, winBays(mid.z1 - mid.z0, 3.2), 70.25);
  crownFace(mid, 'E', 74.3, winBays(mid.z1 - mid.z0, 3.2), 70.25);
  for (const [r, sideX] of [[nw, 'W'], [ne, 'E']] as [Rect, Side][]) {
    crownFace(r, 'N', 70.3, winBays(r.x1 - r.x0, 3.0));
    crownFace(r, sideX, 70.3, winBays(r.z1 - r.z0, 3.2));
    crownFace(r, 'S', 70.3, winBays(r.x1 - r.x0, 3.0), 63.75);
  }
  for (const [r, sideX] of [[sw, 'W'], [se, 'E']] as [Rect, Side][]) {
    crownFace(r, 'S', 63.7, winBays(r.x1 - r.x0, 3.0));
    crownFace(r, sideX, 63.7, winBays(r.z1 - r.z0, 3.2));
    railing(b, r, 63.64, ['S', sideX]);
  }
  // corners: NE/NW of the middle above the ends, the outer corners of the end blocks
  corners(b, mid, 70.25, 74.3, 0.3, [true, true, true, true]);
  corners(b, nw, 59.8, 70.3, 0.3, [false, false, false, true]); corners(b, ne, 59.8, 70.3, 0.3, [true, false, false, false]);
  corners(b, sw, 59.8, 63.7, 0.3, [false, false, true, false]); corners(b, se, 59.8, 63.7, 0.3, [false, true, false, false]);
  railing(b, nw, 70.24, ['N', 'W', 'S']); railing(b, ne, 70.24, ['N', 'E', 'S']);
  b.mark?.('tower');

  // ---------------- deck, link and wings ----------------
  const wingFloors = (top: number) => [4.05, 7.1, 10.2, 13.3, 16.4, 19.5, 22.6, top].filter((y, i, a) => i === a.length - 1 || y < top - 0.5);
  /** `trimEnd`: stop the steel band short of a free end where the lattice's end faces would share its end plane. */
  const wingFace = (r: Rect, side: Side, top: number, from = 0, shops = true, trimEnd = 0) => {
    const {f, len} = frameOf(r, side);
    if (from < 4) {
      if (shops) { lattice(b, f, len, {...wing, floors: [Math.max(0, from), 4.05], bays: shopBays(len, 2.7)}); boxAt(b, f, 0, len - trimEnd, 3.4, 4.12, -0.15, 0.57, 'bronze'); }
      else lattice(b, f, len, {...wing, floors: [Math.max(0, from), 4.05], bays: winBays(len, 2.7)});
    }
    lattice(b, f, len, {...wing, floors: from < 4 ? wingFloors(top) : [from, ...wingFloors(top).filter(y => y > from + 0.3)], bays: winBays(len, 2.7)});
  };
  // deck: the glazed lobby at the courtyard end (w02-180) and the shop front on the west street
  {
    const {f, len} = frameOf(deckB, 'S');
    lattice(b, f, len, {...wing, doorHead: 3.1, bayPier: 0.25, floors: [0, 3.5], bays: shopBays(len, 1.8)});
    const w = frameOf(deckA, 'W');
    lattice(b, w.f, w.len, {...wing, doorHead: 3.1, floors: [0, 3.5], bays: shopBays(w.len, 3.0)});
  }
  wingFace(link, 'E', 17.0, 0, true, 0.1);
  wingFace(link, 'W', 17.0, 3.5, false);
  for (const s of ['W', 'S', 'E'] as Side[]) wingFace(west, s, 23.6, 0, s !== 'E');
  wingFace(west, 'N', 23.6, 3.5, false);
  for (const s of ['E', 'S', 'W'] as Side[]) wingFace(east, s, 23.4, 0, s !== 'W');
  wingFace(east, 'N', 23.4, 17.0, false);
  corners(b, west, 0, 23.6); corners(b, east, 0, 23.4, 0.3, [true, true, true, false]); corners(b, link, 0, 17.0, 0.3, [false, false, false, false]);
  // first-floor balconies with black railings at the Gershwinlaan ends of both wings (panorama 2025-07-29_09-51-01_00007)
  for (const r of [west, east]) {
    const slab = {x0: r.x0, x1: r.x1, z0: r.z1 - 0.2, z1: r.z1 + 1.3};
    box(b, slab, 6.88, 7.1, 'bronze');
    railing(b, slab, 7.1, ['S', 'E', 'W']);
  }
  b.mark?.('wings');

  // ---------------- courtyard gate with the XAVIER letters ----------------
  const gz = 34.05;
  for (const x of [-15.4, -2.1]) box(b, {x0: x - 0.5, x1: x + 0.5, z0: gz - 0.5, z1: gz + 0.5}, 0, 4.6, 'brick');
  box(b, {x0: -15.9, x1: -1.6, z0: gz - 0.3, z1: gz + 0.3}, 4.6, 5.2, 'bronze');
  box(b, {x0: -14.85, x1: -2.65, z0: gz - 0.03, z1: gz + 0.03}, 0, 2.6, 'bronze');
  const gf = frameFromBearing([-15.9, gz - 0.08], 180);
  letters(b, gf, 'XAVIER', 7.15, 5.15, 0, 0.27, 0.16, 'bronze');
  b.mark?.('gate');
}
