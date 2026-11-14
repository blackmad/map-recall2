import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {poly, setSink, slab, type Frame} from './nearbar-kit';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import source from './lofi-footprints.json' with {type: 'json'};

/**
 * Lofi, Basisweg 63 (BAG pand 0363100012092649, bouwjaar 1967; verblijfsobject 0363010000578112, 1,523 m2,
 * bijeenkomstfunctie). A club and culture venue in a former bus garage in Sloterdijk / Westpoort (Holland Festival venue
 * page https://hollandfestival.nl/en/lofi; amsterdamnow.com "Lofi club Sloterdijk").
 *
 * Read from Gemeente Amsterdam panoramas (CC BY 4.0, lofi-inventory.json names each one), rectified at 50 px/m by
 * landmark-brief.ts (ground at 360 px, wall top at 55 px = 6.1 m, 3DBAG roof 6.05-6.31 m):
 *  - east front (w01-91, 2025-07 and 2022-03): the garage hall. Silver horizontally ribbed metal cladding from the door
 *    heads (4.1 m) to the roof edge; four red folding doors of four glazed leaves (three pane rows over a solid kick
 *    panel) and two black doors under black fascia panels, a 4.1-4.2 m bay rhythm; at the north end the two-storey office
 *    wing, its cladding down to 2.5 m over red panels with windows and a black plinth (the 2022 capture had them yellow).
 *  - north front (w02-0, 2025-07; 2022-03 for the frames): the office wing painted black, a ribbon of 2 m windows on the
 *    upper floor (3.8-4.9 m), a transom strip and, below it, a painted mural on the east two thirds and yellow glazing in
 *    two rows on the west third. A brick chimney stack stands on the roof behind it.
 *  - north front, west part (w07-0, 2017-05 / 2018): silver cladding, a red folding door of eight glazed leaves under a
 *    light head panel and a yellow entrance door with side light.
 *  - south (w03-181, 2024-09, mostly behind a hedge and containers): dark corrugated cladding under the silver band.
 *  - west walls (w04/w05/w06): no panorama reaches them (yard behind the neighbouring garage); drawn as plain silver
 *    cladding, inferred.
 * The 2022 roof truss and the 2017 roof sign frame are gone in the 2025 captures and are not modelled.
 *
 * Native frame of lofi-footprints.json (bag-shell-prepare.ts): x east, z south, y up from the 0.86 m NAP ground.
 */
type XZ = [number, number];
const RING = (source as unknown as {facadeRing: XZ[]}).facadeRing;
const TOP = 6.15;            // flat roof (3DBAG 6.05-6.31 m)
const HEAD = 4.1;            // door heads / underside of the cladding band
const RIB = 0.32;            // cladding rib pitch

/** Wall frame from a to b; the outward normal is the side away from the footprint. */
function edge(a: XZ, b: XZ): {f: Frame; len: number} {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), t: XZ = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const n: XZ = [-t[1], t[0]], mid: XZ = [(a[0] + b[0]) / 2 + n[0] * 0.5, (a[1] + b[1]) / 2 + n[1] * 0.5];
  return inRing(mid) ? {f: {origin: b, tangent: [-t[0], -t[1]], n: [t[1], -t[0]]}, len} : {f: {origin: a, tangent: t, n}, len};
}
function inRing(p: XZ) {
  let yes = false;
  for (let i = 0, j = RING.length - 1; i < RING.length; j = i++) {
    const a = RING[i], c = RING[j];
    if ((a[1] > p[1]) !== (c[1] > p[1]) && p[0] < (c[0] - a[0]) * (p[1] - a[1]) / (c[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
/** Horizontal cladding ribs over [t0, t1] x [y0, y1]. */
function ribs(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, c: string, out = 0) {
  for (let y = y0 + RIB / 2; y < y1 - 0.05; y += RIB) slab(b, f, (t0 + t1) / 2, y, t1 - t0, 0.06, 0.06, c, out);
}
/** A folding garage door of `leaves` glazed leaves: glass behind, red rails, stiles and a solid kick panel proud of it. */
function foldingDoor(b: BuildingTools, f: Frame, t0: number, t1: number, leaves: number, rows = 3) {
  const w = t1 - t0, lw = w / leaves, kick = 1.0;
  slab(b, f, (t0 + t1) / 2, kick, w, HEAD - 0.16 - kick, 0.1, 'glass');    // glass between the kick panel and the head rail
  slab(b, f, (t0 + t1) / 2, 0, w, kick, 0.2, 'red');                      // kick panels
  slab(b, f, (t0 + t1) / 2, HEAD - 0.16, w, 0.16, 0.2, 'red');            // head rail
  for (let k = 0; k <= leaves; k++) slab(b, f, t0 + k * lw, kick, k % leaves === 0 ? 0.2 : 0.12, HEAD - kick - 0.16, 0.2, 'red'); // stiles, one pane per leaf and row
  const ph = (HEAD - 0.16 - kick) / rows;
  for (let r = 1; r < rows; r++) slab(b, f, (t0 + t1) / 2, kick + r * ph - 0.04, w - 0.1, 0.08, 0.16, 'red');      // pane rails
}
/** A black service door bay: black fascia panel over black doors (w01-91). */
function blackBay(b: BuildingTools, f: Frame, t0: number, t1: number) {
  const w = t1 - t0, m = (t0 + t1) / 2;
  slab(b, f, m, 0, w, HEAD, 0.1, 'dark');
  slab(b, f, m, 2.35, w - 0.1, 0.06, 0.18, 'stone');                        // joint between door and fascia
  for (const t of [t0 + w * 0.36, t0 + w * 0.64]) slab(b, f, t, 0.05, 0.04, 2.25, 0.18, 'stone'); // door leaf joints
}

export function buildLofi(_w: number, _d: number, b: BuildingTools) {
  // ---- shell on the BAG ring ----
  const shape = new T.Shape(RING.map(([x, z]) => new T.Vector2(x, z)));
  b.add(openTopPrism(shape, -0.3, TOP), 'stone');
  b.add(upwardRoofPlane(shape, TOP), 'slate');
  // a low parapet cap along every edge (the roof edge trim seen against the sky in w01/w02)
  for (let i = 0; i < RING.length; i++) {
    const {f, len} = edge(RING[i], RING[(i + 1) % RING.length]);
    if (len < 0.5) continue;
    slab(b, f, len / 2, TOP - 0.18, len + 0.12, 0.22, 0.08, 'concrete');
  }
  setSink(0.05);

  // ---- east front: garage hall (w01-91), t from the south corner (RING[6]) to the north corner (RING[1]) ----
  {
    const {f, len} = edge(RING[6], RING[1]);
    ribs(b, f, 0, 25.9, HEAD, TOP - 0.2, 'stone');
    slab(b, f, 0.15, 0, 0.3, HEAD, 0.14, 'red');                            // south corner post
    foldingDoor(b, f, 0.3, 4.5, 4);
    blackBay(b, f, 4.5, 8.6);
    foldingDoor(b, f, 8.6, 12.9, 4);
    foldingDoor(b, f, 12.9, 17.1, 4);
    foldingDoor(b, f, 17.1, 21.2, 4);
    slab(b, f, 21.5, 0, 0.6, HEAD + 0.05, 0.18, 'red');                    // the heavy pier
    blackBay(b, f, 21.8, 25.8);
    slab(b, f, 25.85, 0, 0.12, HEAD + 0.05, 0.16, 'red');
    // north end: office wing, cladding down to 2.5 m over red window panels and a black plinth
    const t0 = 25.9, t1 = len - 0.15;
    ribs(b, f, t0, t1, 2.5, TOP - 0.2, 'stone');
    slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 1.0, 0.08, 'dark');
    slab(b, f, (t0 + t1) / 2, 1.0, t1 - t0, 1.5, 0.08, 'red');
    for (let t = t0 + 0.6; t + 0.9 < t1 - 0.4; t += 1.0) slab(b, f, t + 0.45, 1.12, 0.85, 1.25, 0.14, 'glass');
  }

  // ---- north front: black office wing (w02-0), t from the east corner (RING[1]) westward ----
  {
    const {f} = edge(RING[1], RING[2]);
    const L = 24.5;
    slab(b, f, (L - 0.1) / 2, -0.3, L + 0.1, TOP - 0.2 + 0.3, 0.1, 'bronze');  // wraps 0.1 m past the east corner            // black paint over the whole wing front
    ribs(b, f, 0, L, 4.95, TOP - 0.2, 'bronze', 0.1);
    ribs(b, f, 0, L, 2.5, 3.75, 'bronze', 0.1);
    // upper ribbon: 2 m windows, 3.8-4.9 m
    slab(b, f, L / 2, 3.82, L - 1.0, 1.06, 0.17, 'glass');
    for (let t = 0.6; t <= L - 0.4; t += 2.0) slab(b, f, t, 3.8, 0.1, 1.12, 0.24, 'bronze');
    slab(b, f, L / 2, 3.7, L - 0.9, 0.08, 0.24, 'bronze');                   // sill
    // ground floor: transom strip over a mural (east two thirds) and yellow glazing (west third)
    slab(b, f, 8.1, 1.96, 15.9, 0.5, 0.17, 'glass');
    for (let t = 0.2; t <= 16.2; t += 2.0) slab(b, f, t, 1.94, 0.08, 0.54, 0.24, 'bronze');
    mural(b, f, 0.2, 16.2);
    slab(b, f, 20.25, 0.7, 7.9, 1.76, 0.17, 'gold');
    slab(b, f, 20.25, 1.78, 7.84, 0.06, 0.24, 'bronze');
    for (let t = 16.3; t <= 24.3; t += 2.0) slab(b, f, t, 0.72, 0.08, 1.72, 0.24, 'bronze');
    // brick chimney stack on the roof, behind the front (w02-0 2025: at 15.6 m, top 6.8 m)
    const c: XZ = [f.origin[0] + f.tangent[0] * 15.6 - f.n[0] * 1.6, f.origin[1] + f.tangent[1] * 15.6 - f.n[1] * 1.6];
    b.add(new T.BoxGeometry(0.9, 0.85, 0.9).translate(0, 0.425, 0), 'brick', c[0], TOP - 0.05, c[1]);
    b.add(new T.BoxGeometry(1.05, 0.12, 1.05).translate(0, 0.06, 0), 'concrete', c[0], TOP + 0.75, c[1]);
  }

  // ---- north front, west part (w07-0): silver cladding, red eight-leaf folding door, yellow entrance ----
  {
    const {f} = edge(RING[1], RING[2]);
    const t0 = 24.5, t1 = 36.6;
    ribs(b, f, t0, t1, HEAD + 0.7, TOP - 0.2, 'stone');                      // over the head panel
    ribs(b, f, t0, t0 + 1.9, 2.6, HEAD + 0.7, 'stone');                       // over the entrance
    ribs(b, f, t0 + 10.2, t1, 0, HEAD + 0.7, 'stone');                        // west of the door
    slab(b, f, t0 + 1.0, 0, 1.9, 2.6, 0.1, 'gold');                         // yellow entrance surround
    slab(b, f, t0 + 0.7, 0, 0.95, 2.2, 0.15, 'glass');                       // door
    slab(b, f, t0 + 1.55, 0.9, 0.55, 1.3, 0.15, 'glass');                    // side light
    slab(b, f, t0 + 6.05, HEAD, 8.4, 0.7, 0.12, 'frame');                    // light head panel
    slab(b, f, t0 + 1.0, 3.4, 1.7, 0.8, 0.1, 'glass');                       // window over the entrance
    foldingDoor(b, f, t0 + 1.9, t0 + 10.2, 8);
  }

  // ---- south (w03-181): dark corrugated cladding under the silver band ----
  {
    const {f, len} = edge(RING[5], RING[6]);
    slab(b, f, len / 2, -0.3, len, HEAD + 0.3, 0.1, 'greyBrick');
    for (let t = 0.3; t < len; t += 0.3) slab(b, f, t, -0.25, 0.1, HEAD + 0.2, 0.18, 'greyBrick');
    ribs(b, f, 0, len, HEAD, TOP - 0.2, 'stone');
  }
  // ---- west and inner walls (inferred): plain silver cladding ----
  for (const [i, j] of [[2, 3], [3, 4], [4, 5]] as const) {
    const {f, len} = edge(RING[i], RING[j]);
    ribs(b, f, 0, len, 0, TOP - 0.2, 'stone');
  }
  setSink(0);
}

/** The painted mural on the north front (w02-0, 2025): a dark ground with large purple, blue and yellow forms, simplified to flat colour shapes. */
function mural(b: BuildingTools, f: Frame, t0: number, t1: number) {
  const y0 = 0.08, h = 1.82;
  slab(b, f, (t0 + t1) / 2, y0, t1 - t0, h, 0.17, 'dark');
  const shapes: [string, [number, number][]][] = [
    ['blue', [[0.4, 0.2], [3.6, 0.3], [4.6, 1.1], [3.2, 1.7], [0.9, 1.6], [0.3, 1.0]]],          // coiled blue form, east end
    ['pink', [[4.4, 0.25], [7.8, 0.2], [9.4, 0.9], [8.6, 1.75], [5.2, 1.7], [4.6, 1.1]]],        // purple scales
    ['blue', [[6.0, 0.9], [7.4, 0.6], [8.2, 1.2], [7.0, 1.6]]],
    ['ochre', [[9.6, 0.3], [12.4, 0.2], [13.8, 1.0], [12.6, 1.75], [10.4, 1.6], [9.2, 1.0]]],     // yellow head and mane
    ['pink', [[11.0, 0.7], [12.2, 0.6], [12.6, 1.2], [11.4, 1.3]]],
    ['blue', [[14.0, 0.3], [15.9, 0.25], [15.9, 1.7], [14.3, 1.5]]],                              // blue ground, west end
  ];
  // the small forms lie over the large ones, 5 cm proud of them
  shapes.forEach(([c, pts], k) => poly(b, f, t0, y0, pts, k === 2 || k === 4 ? 0.3 : 0.24, c));
}
