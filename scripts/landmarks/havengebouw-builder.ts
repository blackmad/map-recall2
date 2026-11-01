/**
 * Havengebouw, De Ruijterkade 7 (BAG pand 0363100012179689, 1960; W.M. Dudok with R.M.H. Magnee, opened 1960;
 * municipal monument 216001) and its low entrance block on the quay side (BAG 0363100012179691). Sources:
 * scripts/landmarks/havengebouw-brief.md (register text, Wikipedia nl:Havengebouw (Amsterdam)) and the rectified
 * Gemeente Amsterdam panoramas (CC BY 4.0) plus Wikimedia Commons photographs listed in havengebouw-inventory.json.
 *
 *  - A 35.6 x 22.1 m slab of thirteen storeys (register: "dertien bouwlagen ... plat afgedekt"): a grey square-tiled
 *    plinth to 6.8 m, ten office floors at a 3.46 m pitch (w02-121, 46.3 px/m), and two set-back top floors (canteen
 *    and restaurant) under a white fascia, with the steel columns standing outside them painted red (register: "de
 *    stalen kolommen buiten de gevels uitsteken"; Commons Havengebouw_Amsterdam.jpg, Amsterdam_Havengebouw_001.JPG).
 *  - Long fronts: dark-brown tiled columns on a 4.97 m pitch (seven bays), three windows per bay per floor between
 *    cream-tiled spandrels and fins (register: "kolommen ... donkerkleurige tegels ... borstweringen ... crèmekleurige").
 *  - Short fronts (w03-31, 49.3 px/m): closed dark-tiled flanks with one long horizontal window per floor each side, and
 *    the open centre bay of balconies in a projecting white frame (register: "de uitkragende omlijsting van de balkons in
 *    een opvallende lichte kleur"); the SW front is not photographed and repeats the NE front.
 *  - Plinth openings per w02-121 and w03-31; the blue machine-room penthouse and masts on the roof (3DBAG 53-54.7 m).
 *  - 3DBAG (CC BY 4.0): slab top 44 m, top floors 51 m, penthouse 53.9 m; BAG (CC0) outlines.
 *
 * Frame: x east, z south, y up from the 3DBAG ground (0.74 m NAP), origin = the tower's BAG vertex average.
 */
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import src from './havengebouw-footprints.json';

type V = [number, number];
type C = string;

/** Storey lines (w02-121, w03-31, 3DBAG). */
export const HY = {plinth: 6.8, floor: 3.46, floors: 10, slab: 44.0, walk: [43.9, 44.4], top: [44.3, 50.5], fascia: [50.4, 51.0], pent: [50.9, 53.8]} as const;

export function buildHavengebouw(_w: number, _d: number, b: BuildingTools) {
  const tower = src.pands[0].ring as V[];
  const A = tower[0], B = tower[1], Cc = tower[23], D = tower[24];
  const ux = [(D[0] - A[0]), (D[1] - A[1])], lx = Math.hypot(ux[0], ux[1]);
  const u: V = [ux[0] / lx, ux[1] / lx];                       // long axis, SW end -> NE (IJ) end
  const vz = [(B[0] - A[0]), (B[1] - A[1])], lz = Math.hypot(vz[0], vz[1]);
  const v: V = [vz[0] / lz, vz[1] / lz];                       // short axis, NW front -> SE front
  const M: V = [(A[0] + Cc[0]) / 2, (A[1] + Cc[1]) / 2];
  const HL = lx / 2, HW = lz / 2;
  const th = Math.atan2(-u[1], u[0]);                          // rotateY(th) takes local +x to u and local +z to v
  /** Box in the tower frame: centre (x, z), bottom y, extents w (x) h (y) d (z). */
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: C) => {
    const g = new T.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); g.rotateY(th); g.translate(M[0], 0, M[1]); b.add(g, c as never);
  };
  const geom = (g: T.BufferGeometry, c: C) => { g.rotateY(th); g.translate(M[0], 0, M[1]); b.add(g, c as never); };
  /**
   * A panel on a front, `t` metres from the front's viewer-left edge, standing `out` proud and sunk 0.2 m into the body.
   * Fronts: 'SE' (z = +HW), 'NW' (z = -HW), 'NE' (x = +HL), 'SW' (x = -HL).
   */
  type Front = 'SE' | 'NW' | 'NE' | 'SW';
  const LEN: Record<Front, number> = {SE: 2 * HL, NW: 2 * HL, NE: 2 * HW, SW: 2 * HW};
  const panel = (f: Front, t: number, y: number, w: number, h: number, out: number, c: C, sink = 0.2) => {
    const dz = out + sink, mid = (out - sink) / 2;
    if (f === 'SE') box(-HL + t, y, HW + mid, w, h, dz, c);
    else if (f === 'NW') box(HL - t, y, -HW - mid, w, h, dz, c);
    else if (f === 'NE') box(HL + mid, y, HW - t, dz, h, w, c);
    else box(-HL - mid, y, -HW + t, dz, h, w, c);
  };

  // ---------------------------------------------------------------- body
  box(0, 0, 0, 2 * HL, HY.slab, 2 * HW, 'stone');
  // plinth cladding: grey square tiles (long fronts carry the corners)
  for (const f of ['SE', 'NW'] as Front[]) panel(f, LEN[f] / 2, 0, LEN[f] + 0.2, HY.plinth, 0.1, 'concrete');
  for (const f of ['NE', 'SW'] as Front[]) panel(f, LEN[f] / 2, 0, LEN[f] - 0.42, HY.plinth, 0.1, 'concrete');

  // ---------------------------------------------------------------- long fronts
  const COLS = Array.from({length: 8}, (_, k) => 0.5 + 4.97 * k).map(d => Math.min(d, 2 * HL - 0.3));   // from the NE end
  for (const f of ['SE', 'NW'] as Front[]) {
    const fromNE = (d: number) => (f === 'SE' ? LEN[f] - d : d);                    // SE viewer-left is the SW end
    for (const d of COLS) panel(f, fromNE(d), HY.plinth + 0.05, 0.6, HY.slab - HY.plinth - 0.1, 0.15, 'brick');
    for (let k = 0; k < 7; k++) {
      const c = (COLS[k] + COLS[k + 1]) / 2;
      for (const off of [-1.37, 0, 1.37]) for (let fl = 0; fl < HY.floors; fl++) {
        const y = HY.plinth + fl * HY.floor + 1.4;
        panel(f, fromNE(c + off), y, 1.04, 1.6, 0.08, 'glass');
      }
    }
  }
  // corner returns of the dark tile on the short fronts' edges are the flank panels below

  // ---------------------------------------------------------------- short fronts: dark flanks, slot windows, balcony bay
  const BAY = 9.1;
  for (const f of ['NE', 'SW'] as Front[]) {
    const L = LEN[f], flank = (L - BAY) / 2;
    for (const t of [flank / 2, L - flank / 2]) {
      // flank panels run 0.12 m past the corner so their side faces stand clear of the long fronts
      panel(f, t < L / 2 ? t - 0.06 : t + 0.06, HY.plinth + 0.05, flank + 0.12, HY.slab - HY.plinth - 0.1, 0.12, 'brick');
      for (let fl = 0; fl < HY.floors; fl++) panel(f, t, HY.plinth + fl * HY.floor + 1.55, 3.85, 1.2, 0.2, 'glass');
    }
    // the bay: glazing per floor behind white-railed balconies in a projecting white frame
    for (const s of [-1, 1]) panel(f, L / 2 + s * (BAY / 2 - 0.15), HY.plinth + 0.05, 0.3, HY.slab - HY.plinth - 0.45, 1.3, 'white');
    panel(f, L / 2, HY.slab - 0.5, BAY, 0.45, 1.3, 'white');
    for (let fl = 0; fl < HY.floors; fl++) {
      const y = HY.plinth + fl * HY.floor;
      panel(f, L / 2, y + 0.35, BAY - 0.7, 2.7, 0.06, 'glass');
      panel(f, L / 2, y + 0.07, BAY - 0.7, 0.25, 1.2, 'white');                                            // balcony slab
      panel(f, L / 2, y + 0.3, BAY - 0.7, 0.06, 1.25, 'frame', -1.15);                                    // railing foot rail
      panel(f, L / 2, y + 1.25, BAY - 0.7, 0.06, 1.25, 'frame', -1.15);                                   // hand rail
      for (let k = -4; k <= 4; k++) panel(f, L / 2 + k * 0.95, y + 0.3, 0.05, 0.95, 1.22, 'frame', -1.15); // balusters
    }
  }

  // ---------------------------------------------------------------- top: walkway, set-back glazed floors, fascia, red columns
  box(0, HY.walk[0], 0, 2 * HL + 0.6, HY.walk[1] - HY.walk[0], 2 * HW + 0.6, 'white');
  box(0, HY.top[0], 0, 2 * HL - 2.4, HY.top[1] - HY.top[0], 2 * HW - 2.4, 'glass');
  box(0, 47.25, 0, 2 * HL - 2.3, 0.9, 2 * HW - 2.3, 'white');                                             // spandrel band between canteen and restaurant
  box(0, HY.fascia[0], 0, 2 * HL + 0.2, HY.fascia[1] - HY.fascia[0], 2 * HW + 0.2, 'white');
  for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) box(k * 4.97, HY.top[0], s * (HW - 1.17), 0.12, HY.top[1] - HY.top[0], 0.12, 'frame');   // mullions
  const redAt: [number, number, V][] = [];
  for (const d of COLS) for (const s of [-1, 1]) redAt.push([HL - d, s * (HW + 0.05), [0, -s]]);
  for (const t of [-BAY / 2, BAY / 2]) for (const s of [-1, 1]) redAt.push([s * (HL + 0.05), t, [-s, 0]]);
  for (const [x, z, inward] of redAt) {
    box(x, HY.top[0], z, 0.35, HY.fascia[1] + 0.9 - HY.top[0], 0.35, 'red');
    box(x + inward[0] * 0.9, HY.fascia[1] + 0.55, z + inward[1] * 0.9, inward[0] ? 1.8 : 0.35, 0.35, inward[1] ? 1.8 : 0.35, 'red');
  }
  // walkway railing
  for (const s of [-1, 1]) { box(0, HY.walk[1] + 0.95, s * (HW + 0.25), 2 * HL + 0.5, 0.06, 0.06, 'frame'); box(s * (HL + 0.25), HY.walk[1] + 0.95, 0, 0.06, 0.06, 2 * HW + 0.5, 'frame'); }

  // ---------------------------------------------------------------- roof: penthouse and masts
  box(0, HY.pent[0], 0, 26, HY.pent[1] - HY.pent[0], 8, 'blue');
  box(0, HY.pent[1], 0, 26.4, 0.25, 8.4, 'white');
  for (const [x, z, h] of [[-9, 2, 4.5], [-6, -2.5, 3.2], [5, 2.8, 4], [9.5, -2, 6]] as [number, number, number][]) box(x, HY.pent[1] + 0.25, z, 0.12, h, 0.12, 'frame');

  // ---------------------------------------------------------------- plinth openings
  // SE (w02-121 starts 9.44 m from the SW corner, past the drum; the entrance glazing west of the drum, w02 thumb):
  // the entrance, two shop windows, then square windows on two levels
  panel('SE', 2.9, 0.1, 4.6, 3.0, 0.16, 'glass');
  for (const t of [12.1, 17.25]) panel('SE', t, 1.4, 4.5, 2.9, 0.16, 'glass');
  for (const t of [23.8, 27.4, 30.85]) panel('SE', t, 1.3, 1.4, 1.4, 0.16, 'glass');
  for (const t of [27.4, 30.85]) panel('SE', t, 4.2, 1.4, 1.4, 0.16, 'glass');
  // NE (w03-31, from the SE end; symmetric): squares on two levels and the wide window under the balconies
  for (const t of [4.35, 8.1, 14.2, 17.9]) panel('NE', t, 0.9, 1.4, 1.4, 0.16, 'glass');
  for (const t of [4.35, 17.9]) panel('NE', t, 3.9, 1.4, 1.4, 0.16, 'glass');
  panel('NE', 11.15, 3.4, 5.9, 2.6, 0.16, 'glass');
  // NW (no panorama: inferred) one square window per bay on two levels
  for (let k = 0; k < 7; k++) for (const y of [1.3, 4.2]) panel('NW', (COLS[k] + COLS[k + 1]) / 2, y, 1.4, 1.4, 0.16, 'glass');

  // the semicircular drum on the SE front (BAG outline, 1.7 m radius), plinth height
  const drum = tower.slice(2, 23) as V[];
  const cx = drum.reduce((s, p) => s + p[0], 0) / drum.length, cz = drum.reduce((s, p) => s + p[1], 0) / drum.length;
  const r = Math.max(...drum.map(p => Math.hypot(p[0] - cx, p[1] - cz)));
  const cyl = new T.CylinderGeometry(r, r, HY.plinth - 0.4, 14, 1, false, 0, Math.PI);
  // the half-cylinder bulges along +v (out of the SE front); CylinderGeometry's theta 0..PI spans +z through +x to -z
  cyl.rotateY(-Math.PI / 2); cyl.translate(0, (HY.plinth - 0.4) / 2, 0);
  const local = new T.Vector2(cx - M[0], cz - M[1]);
  const lx2 = local.x * u[0] + local.y * u[1], lz2 = Math.max(HW - 0.2, local.x * v[0] + local.y * v[1]);
  cyl.translate(lx2, 0, lz2); geom(cyl, 'concrete');

  // ---------------------------------------------------------------- the low entrance block (BAG 0363100012179691), 4.2 m
  const low = src.pands[1].ring as V[];
  const shape = new T.Shape(low.map(p => new T.Vector2(p[0], p[1])));
  // its edge 0 is the tower's SW front (BAG vertices shared): no wall there, the tower's face stands in its place
  const walls = openTopPrism(shape, 0, 4.2), pos = walls.getAttribute('position'), keep: number[] = [];
  const onAB = (x: number, z: number) => { const along = (x - A[0]) * v[0] + (z - A[1]) * v[1]; return Math.abs((x - A[0]) * u[0] + (z - A[1]) * u[1]) < 0.05 && along > -0.05 && along < lz + 0.05; };
  for (let i = 0; i < pos.count; i += 3) {
    if ([0, 1, 2].every(k => onAB(pos.getX(i + k), pos.getZ(i + k)))) continue;
    for (let k = 0; k < 3; k++) keep.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
  }
  const lowWalls = new T.BufferGeometry(); lowWalls.setAttribute('position', new T.Float32BufferAttribute(keep, 3)); lowWalls.computeVertexNormals();
  b.add(lowWalls, 'concrete');
  b.add(upwardRoofPlane(shape, 4.2), 'slate');
}
