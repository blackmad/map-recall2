import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {faceWall} from './modern-kit';
import {setSink, slab, type Frame} from './nearbar-kit';
import {gridFacade, type GridOptions} from './roof-prism-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import type {Wall} from './worship-walls';

/**
 * Gebouw Parnas / Parnassustoren, Locatellikade 1 (BAG pand 0363100012110783, BAG year 1967; one pand of 4,615 m2 with 110
 * units). The former Van Gelder Papier complex on the Parnassusweg (nl.wikipedia "Parnassusweg"): two long four-storey
 * wings either side of the Parnassusweg joined by a glazed bridge building the traffic drives under, residential slabs
 * on the wings, and the 57 m office tower (Parnassustoren, Herman Bakker, 1975 per nl.wikipedia "Herman Bakker";
 * re-clad and renovated 2017-2021) at the north-west corner by the Zuider Amstelkanaal.
 *
 * Native east/south metres from the BAG vertex average (scripts/landmarks/gebouw-parnas-footprints.json,
 * bag-shell-prepare.ts), y above the 3DBAG ground (0.50 m NAP). The BAG ring is turned 2.93 deg clockwise from the RD
 * grid; everything here is authored in that building frame (u along the bridge, v along the wings) and turned by THETA.
 * Building frame extents from the BAG ring and the 3DBAG LoD2.2 roof planes:
 *  - west wing u -35.5..-19.2, v -51.1..54.0; east wing u 37.5..53.8, v -51.4..53.9; bridge u -19.2..37.5, v 4.1..16.6;
 *    the glazed band 4.5-14.1 m (3DBAG roofs 266/267 at 14.1-14.2 m), cantilevered ~0.8 m over a tile-clad ground storey;
 *  - residential slabs to 31.5 m (3DBAG 255, 273): east u 39.2..53.8, v -50.0..21.6; west u -33.7..-19.2, v -0.9..52.5;
 *  - the tower u -54.2..-31.3, v -51.1..-26.4 to 57.0 m (3DBAG 264) with roof plant to 59.5 m (258) and two top-storey
 *    notches at 49.3 m on its north and south faces (259, 253).
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0) listed in gebouw-parnas-inventory.json: w03-357 / w04-177 (bridge
 * fronts, A-frame pylons), w05-267 / w06-87 (wing fronts), w09-357 / w11-177 (tower base), w13-177 (south end of the west
 * wing), and pitched views ref-tower-nne.jpg / ref-south.jpg cut from recording_2025-09-29_14-53-32_02052 and _02231.
 */
type Box = {u0: number; u1: number; v0: number; v1: number};
export const THETA = Math.atan2(2.9, 56.7);

/** Every geometry the builder makes is authored in the building frame and turned into native coordinates here. */
function local(b: BuildingTools): BuildingTools {
  return {
    ...b,
    add(g, c, x = 0, y = 0, z = 0, angle = 0) {
      g.rotateY(angle); g.translate(x, y, z); g.rotateY(THETA);
      b.add(g, c);
    },
  };
}
const rectShape = (r: Box) => new T.Shape([new T.Vector2(r.u0, r.v0), new T.Vector2(r.u1, r.v0), new T.Vector2(r.u1, r.v1), new T.Vector2(r.u0, r.v1)]);
/** A closed volume: walls and (when lifted) the soffit in `wall`, the roof in `roof`. */
function vol(b: BuildingTools, r: Box, y0: number, y1: number, wall: string, roof: string) {
  b.add(openTopPrism(rectShape(r), y0, y1), wall as never);
  b.add(upwardRoofPlane(rectShape(r), y1), roof as never);
}
/** The four faces of a box as walls (origin at the viewer's left end, outward bearings in the building frame). */
function faces(r: Box, y0: number, y1: number): Record<'n' | 'e' | 's' | 'w', Wall> {
  return {
    n: faceWall([r.u1, r.v0], 0, r.u1 - r.u0, y0, y1),
    e: faceWall([r.u1, r.v1], 90, r.v1 - r.v0, y0, y1),
    s: faceWall([r.u0, r.v1], 180, r.u1 - r.u0, y0, y1),
    w: faceWall([r.u0, r.v0], 270, r.v1 - r.v0, y0, y1),
  };
}

// ---- measured volumes (building frame) ----
const WEST: Box = {u0: -35.5, u1: -19.2, v0: -51.0, v1: 54.0};
const EAST: Box = {u0: 37.5, u1: 53.8, v0: -51.4, v1: 53.9};
const BRIDGE: Box = {u0: -19.5, u1: 37.8, v0: 4.1, v1: 16.6};
const WEST_SLAB: Box = {u0: -33.7, u1: -19.2, v0: -0.9, v1: 52.5};
const EAST_SLAB: Box = {u0: 39.2, u1: 53.8, v0: -50.0, v1: 21.6};
const TOWER: Box = {u0: -54.2, u1: -31.3, v0: -51.1, v1: -26.4};
const BAND0 = 4.5, BAND1 = 14.1, SLAB_TOP = 31.5, TOWER_TOP = 57.0, NOTCH_Y = 49.5, FLOOR = 3.0; // tower: ground 4.5 m + 17 storeys of 3.0 m (18 floors); notch floor 49.5 (3DBAG 49.3)
const CANT = 0.8; // the glazed band oversails the ground storey (w13-177, ref-south)
const inset = (r: Box, d: number): Box => ({u0: r.u0 + d, u1: r.u1 - d, v0: r.v0 + d, v1: r.v1 - d});

/** Aluminium curtain grid of the glazed band (w03-357 at 35 px/m: 1.8 m mullions, floors 4.5 / 8.4 / 12.3 m, transoms 6.1 / 10.0, a low top light 12.45-13.6). */
const BAND_GRID: GridOptions = {y0: BAND0, pitch: 3.9, colPitch: 1.8, pierW: 0.09, pierD: 0.1, winBottom: 0.12, winH: 3.62, pier: 'frame', glass: 'canopyGlass', margin: 0.25};
function bandFace(b: BuildingTools, w: Wall, y0 = BAND0) {
  gridFacade(b, w, {...BAND_GRID, y0});
  slab(b, w, w.length / 2, 12.45, w.length - 0.5, 1.15, 0.06, 'canopyGlass'); // the low top light under the roof edge
  for (const y of [y0 + 1.6, y0 + 5.5]) slab(b, w, w.length / 2, y, w.length - 0.5, 0.08, 0.11, 'frame'); // transoms
  slab(b, w, w.length / 2, 12.3, w.length - 0.5, 0.1, 0.11, 'frame');
}

/** Residential slab long face: loggias, a white floor edge and a rail per 2.9 m storey (ref-south, w03-357 upper right). */
function loggiaFace(b: BuildingTools, w: Wall) {
  gridFacade(b, w, {y0: BAND1, pitch: 2.9, colPitch: 3.6, pierW: 0.35, pierD: 0.32, winBottom: 0.35, winH: 2.25, pier: 'white', glass: 'glass', margin: 0.6});
  for (let y = BAND1 + 2.9; y < SLAB_TOP - 0.5; y += 2.9) {
    slab(b, w, w.length / 2, y - 0.16, w.length - 0.3, 0.34, 0.45, 'white');     // floor edge
    slab(b, w, w.length / 2, y + 0.95, w.length - 1.0, 0.07, 0.42, 'frame');      // rail
  }
}

/** Tower face: dark frame, a dark spandrel each 3.05 m storey, blue glass, heavy piers at the thirds and corners (ref-tower-nne). */
function towerFace(b: BuildingTools, w: Wall, notch?: [number, number], base = 0) {
  const L = w.length;
  for (let y = 4.5; y + FLOOR <= TOWER_TOP - 0.5; y += FLOOR) {
    const yb = y + 0.55, h = 2.4;
    if (yb < base) continue;
    if (notch && yb >= NOTCH_Y - 0.2) {
      slab(b, w, notch[0] / 2, yb, notch[0] - 0.3, h, 0.06, 'glass');
      slab(b, w, (notch[1] + L) / 2, yb, L - notch[1] - 0.3, h, 0.06, 'glass');
    } else slab(b, w, L / 2, yb, L - 0.6, h, 0.06, 'glass');
  }
  const top = TOWER_TOP - 0.4;
  const y0 = Math.max(base, 4.3);
  for (const t of [0.35, L - 0.35]) slab(b, w, t, base, 0.7, top - base, 0.22, 'bronze');       // corner piers
  for (const t of [L / 3, 2 * L / 3]) {
    const inNotch = notch && t > notch[0] && t < notch[1];
    slab(b, w, t, y0, 0.5, (inNotch ? NOTCH_Y : top) - y0, 0.2, 'bronze');      // section piers
  }
  for (let k = 1; k < 9; k++) {
    if (k % 3 === 0) continue;
    const t = k * L / 9, inNotch = notch && t > notch[0] && t < notch[1];
    slab(b, w, t, y0, 0.12, (inNotch ? NOTCH_Y - 0.3 : top) - y0, 0.12, 'bronze'); // mullions
  }
  if (base > 0) return;
  // glazed base pavilion in black frames (w09-357, w11-177)
  slab(b, w, L / 2, 0.15, L - 1.4, 3.95, 0.06, 'glass');
  for (let t = 2.4; t < L - 1.5; t += 2.4) slab(b, w, t, 0.15, 0.14, 3.95, 0.14, 'bronze');
  slab(b, w, L / 2, 4.1, L - 0.3, 0.4, 0.24, 'bronze');
}

/** The black A-frame trestles under the bridge, one at each kerb (w03-357, w04-177): two splayed legs at each bridge face and a head beam. */
function trestle(b: BuildingTools, uc: number) {
  const base = 4.6, head = 1.3, H = 4.3;
  for (const v of [BRIDGE.v0 + 0.9, BRIDGE.v1 - 0.9]) {
    for (const s of [-1, 1]) {
      const x0 = uc + s * base / 2, x1 = uc + s * head / 2, len = Math.hypot(x1 - x0, H);
      const g = new T.BoxGeometry(0.55, len, 0.7);
      g.rotateZ(Math.atan2(x0 - x1, H));
      b.add(g, 'bronze' as never, (x0 + x1) / 2, H / 2 + 0.15, v);
    }
  }
  b.add(new T.BoxGeometry(head + 0.6, 0.6, BRIDGE.v1 - BRIDGE.v0 - 1.0), 'bronze' as never, uc, H - 0.3 + 0.01, (BRIDGE.v0 + BRIDGE.v1) / 2);
}

export function buildGebouwParnas(_w: number, _d: number, b0: BuildingTools & {mark?: (n: string) => void}) {
  const b = local(b0);
  // ---- massing ----
  const westGround = inset(WEST, CANT);
  const eastGround = inset(EAST, CANT);
  vol(b, westGround, 0, BAND0, 'concrete', 'slate');
  vol(b, eastGround, 0, BAND0, 'concrete', 'slate');
  vol(b, WEST, BAND0, BAND1, 'frame', 'slate');
  vol(b, EAST, BAND0, BAND1, 'frame', 'slate');
  vol(b, BRIDGE, 4.3, BAND1 - 0.05, 'frame', 'slate');
  vol(b, WEST_SLAB, BAND1, SLAB_TOP, 'white', 'slate');
  vol(b, EAST_SLAB, BAND1, SLAB_TOP, 'white', 'slate');
  // tower with its two notches at the top storeys
  // North notch: 3DBAG roof 259 puts it at u -50.2..-40.9, but ref-tower-nne shows the recessed top storeys exactly in the
  // centre third between the heavy piers; the photo decides.
  const TL = TOWER.u1 - TOWER.u0;
  const northNotch: Box = {u0: TOWER.u1 - 2 * TL / 3 + 0.25, u1: TOWER.u1 - TL / 3 - 0.25, v0: TOWER.v0, v1: TOWER.v0 + 2.5};
  const southNotch: Box = {u0: -51.8, u1: -38.6, v0: TOWER.v1 - 2.2, v1: TOWER.v1};
  vol(b, TOWER, 0, NOTCH_Y, 'bronze', 'slate');
  const crown: [number, number][] = [
    [TOWER.u0, TOWER.v0], [northNotch.u0, TOWER.v0], [northNotch.u0, northNotch.v1], [northNotch.u1, northNotch.v1], [northNotch.u1, TOWER.v0],
    [TOWER.u1, TOWER.v0], [TOWER.u1, TOWER.v1], [southNotch.u1, TOWER.v1], [southNotch.u1, southNotch.v0], [southNotch.u0, southNotch.v0],
    [southNotch.u0, TOWER.v1], [TOWER.u0, TOWER.v1],
  ];
  const crownShape = new T.Shape(crown.map(([u, v]) => new T.Vector2(u, v)));
  b.add(openTopPrism(crownShape, NOTCH_Y - 0.01, TOWER_TOP), 'bronze' as never);
  b.add(upwardRoofPlane(crownShape, TOWER_TOP), 'slate' as never);
  vol(b, {u0: -45.7, u1: -38.7, v0: -46.0, v1: -33.7}, TOWER_TOP - 0.05, 59.5, 'concrete', 'slate'); // roof plant
  // the enclosed ground rooms under the bridge ends, behind the trestles (w03-357, w04-177)
  const rooms: Box[] = [{u0: -20.3, u1: -9.6, v0: BRIDGE.v0 + 1.6, v1: BRIDGE.v1 - 1.6}, {u0: 27.2, u1: 38.6, v0: BRIDGE.v0 + 1.6, v1: BRIDGE.v1 - 1.6}];
  for (const r of rooms) vol(b, r, 0, 4.25, 'concrete', 'slate');
  b0.mark?.('shell');

  setSink(0.05);
  // ---- glazed band: every free face of the wings and both bridge fronts ----
  const wf = faces(WEST, BAND0, BAND1), ef = faces(EAST, BAND0, BAND1), bf = faces(BRIDGE, 4.3, BAND1);
  const span = (w: Wall, a: number, c: number) => faceWall([w.origin[0] + w.tangent[0] * a, w.origin[1] + w.tangent[1] * a], bearingOfWall(w), c - a, w.base, BAND1);
  bandFace(b, span(wf.w, TOWER.v1 - WEST.v0 + 0.1, WEST.v1 - WEST.v0)); // west front south of the tower
  bandFace(b, span(wf.n, 0, WEST.u1 - TOWER.u1 - 0.2));                // north end, east of the tower
  bandFace(b, wf.s);
  bandFace(b, span(wf.e, 0, WEST.v1 - BRIDGE.v1));                     // road side south of the bridge
  bandFace(b, span(wf.e, WEST.v1 - BRIDGE.v0, WEST.v1 - WEST.v0));    // road side north of the bridge
  bandFace(b, ef.e); bandFace(b, ef.n); bandFace(b, ef.s);
  bandFace(b, span(ef.w, 0, BRIDGE.v0 - EAST.v0));                     // road side north of the bridge
  bandFace(b, span(ef.w, BRIDGE.v1 - EAST.v0, EAST.v1 - EAST.v0));     // road side south of the bridge
  bandFace(b, span(bf.n, 0.3, BRIDGE.u1 - BRIDGE.u0 - 0.3), 4.3);
  bandFace(b, span(bf.s, 0.3, BRIDGE.u1 - BRIDGE.u0 - 0.3), 4.3);

  // ---- ground storey: tile cladding with a clerestory ribbon on the road sides (w05-267, w06-87) and plain tiles on the ends (w13-177) ----
  const ground: GridOptions = {y0: 0, pitch: 10, colPitch: 2.4, pierW: 0.1, pierD: 0.1, winBottom: 1.55, winH: 2.3, pier: 'frame', glass: 'glass', margin: 4};
  const wg = faces(westGround, 0, BAND0), eg = faces(eastGround, 0, BAND0);
  for (const w of [wg.e, wg.w, eg.e, eg.w]) gridFacade(b, w, ground);
  for (const r of rooms) { const rf = faces(r, 0, 4.25); for (const w of [rf.n, rf.s]) gridFacade(b, w, {...ground, margin: 1.2}); } // windows under the bridge (w03-357)
  for (const w of [wg.s, eg.s, eg.n, span2(wg.n, 0, WEST.u1 - TOWER.u1 - CANT - 0.3, 0)]) {
    slab(b, w, w.length / 2, 0, 3.2, 2.6, 0.08, 'dark');               // service doors in the tile ends (w12-177, w13-177)
    slab(b, w, w.length / 2, 3.0, 1.6, 0.9, 0.06, 'glass');
    for (let t = 2.2; t < w.length - 1; t += 2.2) slab(b, w, t, 0.05, 0.05, 4.3, 0.05, 'frame'); // tile panel joints
  }

  // ---- residential slabs ----
  const ws = faces(WEST_SLAB, BAND1, SLAB_TOP), es = faces(EAST_SLAB, BAND1, SLAB_TOP);
  for (const w of [ws.w, ws.e, es.w, es.e]) loggiaFace(b, w);
  for (const w of [ws.n, ws.s, es.n, es.s]) for (let y = BAND1 + 2.9; y < SLAB_TOP; y += 2.9) slab(b, w, w.length / 2, y - 0.06, w.length - 0.3, 0.12, 0.06, 'stone'); // panel courses on the blank ends (w13-177)

  // ---- tower ----
  const tf = faces(TOWER, 0, TOWER_TOP);
  towerFace(b, tf.n, [TOWER.u1 - northNotch.u1, TOWER.u1 - northNotch.u0]);
  towerFace(b, tf.s, [southNotch.u0 - TOWER.u0, southNotch.u1 - TOWER.u0]);
  towerFace(b, tf.w);
  towerFace(b, span2(tf.e, 0, TOWER.v1 - TOWER.v0, BAND1 + 0.1), undefined, BAND1 + 0.1); // east face above the wing roof
  // glass on the recessed faces of the two top-storey notches
  for (const [w, len] of [[faceWall([northNotch.u1, northNotch.v1], 0, northNotch.u1 - northNotch.u0, NOTCH_Y, TOWER_TOP), northNotch.u1 - northNotch.u0], [faceWall([southNotch.u0, southNotch.v0], 180, southNotch.u1 - southNotch.u0, NOTCH_Y, TOWER_TOP), southNotch.u1 - southNotch.u0]] as [Wall, number][]) {
    for (let y = NOTCH_Y; y + FLOOR <= TOWER_TOP - 0.5; y += FLOOR) slab(b, w, len / 2, y + 0.55, len - 0.4, 2.4, 0.06, 'glass');
    for (let t = len / 4; t < len - 0.5; t += len / 4) slab(b, w, t, NOTCH_Y, 0.12, TOWER_TOP - 0.4 - NOTCH_Y, 0.12, 'bronze');
  }
  // entrance canopy on the south front (w11-177)
  slab(b, tf.s, (TOWER.u1 - TOWER.u0) / 2 + 1.0, 4.0, 6.2, 0.35, 2.0, 'bronze');

  // ---- bridge: trestles under the kerbs ----
  setSink(0);
  trestle(b, -5.5);
  trestle(b, 22.2);
}

function bearingOfWall(w: Wall) { return (Math.atan2(w.n[0], -w.n[1]) * 180 / Math.PI + 360) % 360; }
function span2(w: Wall, a: number, c: number, y0: number): Wall {
  return faceWall([w.origin[0] + w.tangent[0] * a, w.origin[1] + w.tangent[1] * a], bearingOfWall(w), c - a, y0, w.poly[2][1]);
}
export type {Frame};
