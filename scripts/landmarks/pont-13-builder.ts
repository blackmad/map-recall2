import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, setSink, slab, type Frame} from './nearbar-kit';
import {quad} from './big-facade';
import {sill, wallLetters} from './houthavens-shell';

/**
 * Pont 13, the 1927 IJ ferry moored at the Haparandadam as a restaurant (BAG ligplaats 0363020012061235, Haparandadam 50;
 * OSM way 274005173, building=boat, with the venue's phone number; the venue now trades as "Ferry").
 *
 * Identity: "PONT 13" and "ETEN & DRINKEN" on the bulwark of the water side (panorama TMX7316010203-001972_pano_0000_001021,
 * 2021-01-21) and a "ferry" board on the dam side (recording_2024-10-09_07-28-34_01032, 2024-10-09); the ship fills the BAG
 * ligplaats and the PDOK 2025 orthophoto (CC BY 4.0) at the same spot.
 *
 * No 3DBAG shell (a ship): drawn by hand on the ligplaats axis (NE-SW, 37.6 x 9.5 m berth). The hull runs about 40 m on the
 * 2025 orthophoto (12 px/m), 9.6 m wide. Heights from the 2021 water-side panorama (about 26 px/m), y = 0 at the water line:
 *  - grey rubbing strake 0-0.6, the navy enclosed main deck 0.6-4.8 with a row of wide windows (3.7 m, 4.8 m pitch) at
 *    2.8-3.8;
 *  - a white bulwark band 4.8-6.6 carrying the lettering;
 *  - a white barrel-roofed saloon set back on it to 8.3 m, 34 m long;
 *  - a white raised box amidships to 9.2 m (the "PONT 13" logo on the 2021 photo, the "ferry" board on the 2024 one) under
 *    a dark glazed wheelhouse to 10.4 m with an overhanging roof;
 *  - a lattice mast near the SW end to 12.6 m, a flag pole on the box;
 *  - a beige tent over the SW deck end and a brown canopy over the NE end (orthophoto).
 * INFERRED: the hull's underwater form (not drawn), the saloon roof's skylights (strips, not modelled).
 */
type V2 = [number, number];
const C: V2 = [0, 0];
const E1: V2 = [14.5, -12.0], E2: V2 = [-14.5, 12.0];                       // NE and SW ends of the berth (native metres)
const AX = Math.hypot(E1[0] - E2[0], E1[1] - E2[1]);
const U: V2 = [(E1[0] - E2[0]) / AX, (E1[1] - E2[1]) / AX];                 // along the ship, towards NE
const SE: V2 = [-U[1], U[0]];                                                // across, towards the water side (SE)
const LEN = 40, W = 9.6, R = 3.0;
let b: BuildingTools;

/** Rounded-rectangle plan in ship coordinates (s along, c across), inset `i`. */
function plan(i: number, len = LEN, w = W, r = R): T.Shape {
  const a = len / 2 - i, h = w / 2 - i, rr = Math.max(0.2, r - i), s = new T.Shape();
  s.moveTo(-a + rr, -h);
  s.lineTo(a - rr, -h);
  s.absarc(a - rr, -h + rr, rr, -Math.PI / 2, 0, false);
  s.lineTo(a, h - rr);
  s.absarc(a - rr, h - rr, rr, 0, Math.PI / 2, false);
  s.lineTo(-a + rr, h);
  s.absarc(-a + rr, h - rr, rr, Math.PI / 2, Math.PI, false);
  s.lineTo(-a, -h + rr);
  s.absarc(-a + rr, -h + rr, rr, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * Place a geometry built in ship coordinates (x along the ship towards NE, y up, z across towards SE) into the native
 * frame (x east, z south).
 */
function ship(g: T.BufferGeometry, colour: string) {
  // ship x -> U, ship z -> SE
  const m = new T.Matrix4().set(
    U[0], 0, SE[0], C[0],
    0, 1, 0, 0,
    U[1], 0, SE[1], C[1],
    0, 0, 0, 1,
  );
  g.applyMatrix4(m);
  // a mirroring map (det < 0) would turn faces inward: flip the winding back
  if (U[0] * SE[1] - U[1] * SE[0] < 0) {
    const idx = g.getIndex();
    if (idx) { const a = idx.array as Uint16Array | Uint32Array; for (let k = 0; k < a.length; k += 3) { const t = a[k + 1]; a[k + 1] = a[k + 2]; a[k + 2] = t; } idx.needsUpdate = true; }
    else {
      const p = g.getAttribute('position') as T.BufferAttribute;
      for (let k = 0; k < p.count; k += 3) for (let c = 0; c < 3; c++) { const t = p.getComponent(k + 1, c); p.setComponent(k + 1, c, p.getComponent(k + 2, c)); p.setComponent(k + 2, c, t); }
    }
    g.computeVertexNormals();
  }
  b.add(g, colour as never);
}

/** A plan shape extruded from y0 to y1 (ship coordinates: the shape's x along the ship, its y across). */
function prism(s: T.Shape, y0: number, y1: number, colour: string) {
  const g = new T.ExtrudeGeometry(s, {depth: y1 - y0, bevelEnabled: false, curveSegments: 5});
  // shape (x, y) extruded along z  ->  ship (x, z = y, y = up): rotate -90 deg about x sends shape y to -z, so mirror after
  g.rotateX(Math.PI / 2).translate(0, y1, 0);                                 // shape y -> +z (across), extrusion downwards
  ship(g, colour);
}

/** Side frame of the straight part of a long side, at half-width `h`: t from the SW end of the straight part. */
function side(h: number, water: boolean): {f: Frame; len: number} {
  const L = LEN - 2 * R, n: V2 = water ? SE : [-SE[0], -SE[1]];
  const tangent: V2 = [n[1], -n[0]];                                          // viewer's right
  const along = tangent[0] * U[0] + tangent[1] * U[1] > 0 ? 1 : -1;          // +1: t runs towards NE
  const o: V2 = [C[0] - U[0] * (L / 2) * along + n[0] * h, C[1] - U[1] * (L / 2) * along + n[1] * h];
  return {f: {origin: o, tangent, n}, len: L};
}

function hull() {
  prism(plan(0), 0, 0.6, 'concrete');                                         // grey rubbing strake
  prism(plan(0.15), 0.6, 4.8, 'blue');                                        // navy main deck
  prism(plan(0.12), 4.8, 6.6, 'pink');                                        // white bulwark band
  // main-deck windows on both long sides: frame ring, sill, glass, centre mullion
  for (const water of [true, false]) {
    const {f, len} = side(W / 2 - 0.15, water);
    for (let t = 2.6; t + 3.7 <= len - 0.3; t += 4.8) {
      const c = t + 1.85;
      quad(b, f, c, 2.75, 3.8, 1.1, 'frame', 0.045);
      sill(b, f, c, 2.75, 3.8, 'frame');
      quad(b, f, c, 2.82, 3.66, 0.96, 'glass', 0.09);
      quad(b, f, c, 2.82, 0.07, 0.96, 'frame', 0.135);
    }
  }
}

/** The white barrel-roofed saloon on the bulwark, 34 m long, 8 m wide, rising 1.7 m. */
function saloon() {
  const s = new T.Shape(), half = 4.0, rise = 1.7, n = 10;
  s.moveTo(-half, 0);
  for (let k = 1; k < n; k++) { const a = Math.PI * (1 - k / n); s.lineTo(half * Math.cos(a), rise * Math.sin(a)); }
  s.lineTo(half, 0);
  s.closePath();
  // cross-section in (across, up), extruded along the ship
  const g = new T.ExtrudeGeometry(s, {depth: 34, bevelEnabled: false, curveSegments: 1});
  g.translate(0, 0, -17);                                                     // shape x across, y up, z along
  g.rotateY(Math.PI / 2);                                                     // z along -> x along; x across -> -z
  g.translate(0, 6.6, 0);
  ship(g, 'pink');
}

/** Raised box amidships, wheelhouse, mast, flag pole, end canopies. */
function topside() {
  const box = (x: number, z: number, lx: number, lz: number, y0: number, y1: number, colour: string) =>
    ship(new T.BoxGeometry(lx, y1 - y0, lz).translate(x, (y0 + y1) / 2, z), colour);
  box(2.0, 0, 3.6, 3.2, 7.6, 9.2, 'pink');                                    // the raised white box
  box(2.0, 0, 3.2, 2.8, 9.2, 10.3, 'slate');                                  // glazed wheelhouse (dark glass read as a body)
  box(2.0, 0, 3.9, 3.4, 10.3, 10.5, 'copper');                                // its overhanging roof
  box(-11.5, 0, 0.25, 0.25, 8.0, 12.6, 'pink');                               // mast
  box(-11.5, 0, 0.12, 1.6, 11.6, 11.7, 'pink');                               // radar yard
  box(3.4, 1.0, 0.08, 0.08, 9.2, 12.4, 'pink');                               // flag pole on the box
  box(3.4, 1.0, 0.03, 0.9, 11.6, 12.3, 'blue');                               // flag
  // the beige tent over the SW deck end and a brown canopy over the NE end (2025 orthophoto)
  const tent = new T.Shape();
  tent.moveTo(-4.2, 0); tent.lineTo(4.2, 0); tent.lineTo(0, 1.6); tent.closePath();
  const tg = new T.ExtrudeGeometry(tent, {depth: 2.6, bevelEnabled: false}).translate(0, 0, -1.3).rotateY(Math.PI / 2).translate(-18.2, 6.6, 0);
  ship(tg, 'ochre');
  box(18.4, 0, 2.2, 7.6, 8.4, 8.6, 'bronze');                                 // NE canopy roof
  for (const x of [17.36, 19.44]) for (const z of [-3.74, 3.74]) box(x, z, 0.12, 0.12, 6.6, 8.4, 'bronze');   // posts under the roof corners
}

/** Lettering on the bulwark: "PONT 13" and "ETEN & DRINKEN" on the water side (2021), "FERRY" on the dam side (2024). */
function lettering() {
  const water = side(W / 2 - 0.12, true), dam = side(W / 2 - 0.12, false);
  // t along the straight part from its SW end (photo: ship SW tip at px 25, 26 px/m; straight part starts 3 m in)
  const tw = (m: number) => (water.f.tangent[0] * U[0] + water.f.tangent[1] * U[1] > 0 ? m - R : water.len - (m - R));
  wallLetters(b, water.f, 'PONT 13', tw(17.3), 5.25, 0.8, 4.0, 'blue', 0.0, 0.04);
  wallLetters(b, water.f, 'ETEN & DRINKEN', tw(23.4), 5.3, 0.7, 6.6, 'blue', 0.0, 0.04);
  void dam;
  // the "ferry" board on the dam-side (NW) face of the raised box amidships, above the saloon roof
  const n: V2 = [-SE[0], -SE[1]], f: Frame = {origin: [C[0] + U[0] * 2.0 + n[0] * 1.6, C[1] + U[1] * 2.0 + n[1] * 1.6], tangent: [n[1], -n[0]], n};
  setSink(0);
  slab(b, f, 0, 8.3, 2.6, 0.75, 0.05, 'sandstone', 0);
  setSink(0.3, true);
  wallLetters(b, f, 'FERRY', 0, 8.42, 0.5, 2.3, 'blue', 0.05, 0.03);
}

export function buildPont13(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  setSink(0.3, true);
  hull();
  saloon();
  topside();
  lettering();
  setSink(0);
}
