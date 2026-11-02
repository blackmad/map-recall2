import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {archOpeningWall, type ArchOpening} from '../../src/canalRecall/landmarks/archOpeningWall';

/**
 * Watertoren Amstelveenseweg, Amsterdam-Zuid (Buitenveldert side of the A10). BAG pand 0363100012216977 (bouwjaar 1965,
 * in gebruik). Designed by Piet Elling and built 1964-1965 for the municipal water works; about 40 m high with one steel
 * reservoir of 2,335 m3 in an aluminium casing; still in use by Waternet (nl.wikipedia "Watertoren Amstelveenseweg",
 * CC BY-SA 4.0; Nationaal Archief / Anefo construction photographs of 1964 on Wikimedia Commons, CC0).
 *
 * Read from the city panoramas around the tower (Gemeente Amsterdam, CC BY 4.0; staging/landmarks/<id>/sources.md) and
 * Commons photographs "Amsterdam Watertoren Amstelveenseweg.jpg" (2009, CC BY-SA 3.0) and "Watertoren Amstelveenseweg -
 * panoramio.jpg" (2007, CC BY 3.0):
 * - an inverted cone (frustum) reservoir clad in standing-seam aluminium, 17.5 m across at the top (the BAG ring is its
 *   plan, a circle of radius 8.73 m), about 13.4 m at the bottom, from about 19.4 m to the 3DBAG roof at 36.1 m, with a
 *   dark rim and small dark hatches just under it;
 * - under it a concrete ring beam and a central concrete shaft (a red door at its foot, a strip window high up) inside a
 *   ring of six slender round concrete columns;
 * - on top, set back behind a railing, the octagonal glazed control cabin with a dark overhanging roof (to about 39 m).
 * Heights are scaled on the panorama view from 57 m east (r03-90.alt), which shows the whole tower from the foot.
 *
 * Native east/south metres from the BAG ring's vertex average; the circle fitted to the ring is centred at (0.48, -0.82).
 */
type C = 'stone' | 'bronze' | 'slate' | 'glass' | 'dark';
let b: BuildingTools;
const CX = 0.48, CZ = -0.82;
const RES = {y0: 19.4, y1: 36.1, r0: 6.7, r1: 8.73, ribs: 120, rib: 0.08};
const BEAM = {r: 6.0, y0: 18.6, y1: 19.6};
const SHAFT = {r: 2.4, sides: 12, top: 18.6};
const COLS = {n: 6, R: 5.2, r: 0.58, top: 18.75};
const RIM = {r: 8.88, y0: 36.0, y1: 36.25};
const CAB = {apo: 2.98, y0: RIM.y1, y1: 38.7, glass0: 37.25, glass1: 38.5, roofApo: 3.65, roofTop: 39.1};

function add(g: T.BufferGeometry, c: C) { b.add(g, c as never); }
function tris(pos: number[], c: C) {
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  add(g, c);
}
/** Closed prism (or cylinder) about the tower axis. */
function drum(r: number, y0: number, y1: number, seg: number, c: C, rot = 0) {
  const g = new T.CylinderGeometry(r, r, y1 - y0, seg, 1, false, rot).translate(CX, (y0 + y1) / 2, CZ);
  add(g, c);
}

export function buildWatertorenAmstelveenseweg(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  reservoir();
  understructure();
  cabin();
}

/* ------------------------------------------------------------------ the ribbed reservoir, its rim and hatches */
function reservoir() {
  // Standing-seam casing: per rib a seam ridge `rib` proud of the cone and a flat panel; one closed ruled surface with caps.
  const {y0, y1, r0, r1, ribs, rib} = RES, ring: [number, number][] = [];   // [angle, extra radius]
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2, da = (Math.PI * 2) / ribs;
    ring.push([a, rib], [a + da * 0.12, 0], [a + da * 0.88, 0]);
  }
  const P = (a: number, r: number, y: number): [number, number, number] => [CX + Math.cos(a) * r, y, CZ + Math.sin(a) * r];
  const side: number[] = [], cap: number[] = [], under: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [a, e] = ring[i], [b2, f] = ring[(i + 1) % ring.length];
    const A0 = P(a, r0 + e, y0), B0 = P(b2, r0 + f, y0), A1 = P(a, r1 + e, y1), B1 = P(b2, r1 + f, y1);
    // outward: angles increase from +x towards +z (clockwise seen from above), so A0 -> A1 -> B1 faces out
    side.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0);
    cap.push(CX, y1, CZ, ...B1, ...A1);
    under.push(CX, y0, CZ, ...A0, ...B0);
  }
  tris(side, 'bronze');
  tris(cap, 'slate');
  tris(under, 'stone');
  // dark rim: a low disc proud of the seams round the top
  drum(RIM.r, RIM.y0, RIM.y1, 96, 'slate');
  // small dark-grey hatches under the rim, in the rim's slot (the 'dark' slot carries the red door) (eight round the casing; Commons 2009 shows four on the near half)
  for (let k = 0; k < 8; k++) {
    const a = ((k + 0.5) / 8) * Math.PI * 2, y = 35.0, rr = r0 + (r1 - r0) * (y - y0) / (y1 - y0);
    const g = new T.BoxGeometry(0.34, 0.72, 0.16).translate(0, 0, 0.02);
    const tilt = Math.atan2(r1 - r0, y1 - y0);
    g.rotateX(tilt).rotateY(-a + Math.PI / 2).translate(CX + Math.cos(a) * rr, y, CZ + Math.sin(a) * rr);
    add(g, 'slate');
  }
}

/* ------------------------------------------------------------------ ring beam, shaft, columns */
function understructure() {
  drum(BEAM.r, BEAM.y0, BEAM.y1, 64, 'stone');
  // the central shaft: twelve flat faces with the red door (east, towards the Amstelveenseweg) and a strip window high up
  const {r, sides, top} = SHAFT, side = 2 * r * Math.sin(Math.PI / sides);
  for (let k = 0; k < sides; k++) {
    // face k centred on angle a (from +x towards +z); seen from outside its larger-angle end p is on the left
    const a = (k / sides) * Math.PI * 2, a0 = a + Math.PI / sides, a1 = a - Math.PI / sides;
    const p = [CX + Math.cos(a0) * r, CZ + Math.sin(a0) * r], q = [CX + Math.cos(a1) * r, CZ + Math.sin(a1) * r];
    const cuts: (ArchOpening & {back: C})[] = [];
    if (k === 0) cuts.push({t0: side / 2 - 0.48, t1: side / 2 + 0.48, y0: 0.08, y1: 2.25, depth: 0.12, arch: 0, back: 'dark'});
    if (k === 9) cuts.push({t0: 0.1, t1: side - 0.1, y0: 15.6, y1: 16.45, depth: 0.1, arch: 0, back: 'glass'});
    face(p as [number, number], q as [number, number], 0, top, cuts);
  }
  // six slender round columns on a 5.2 m ring (two abeam north and south, as on the east panorama)
  for (let k = 0; k < COLS.n; k++) {
    const a = Math.PI / 2 + (k / COLS.n) * Math.PI * 2;
    add(new T.CylinderGeometry(COLS.r, COLS.r, COLS.top, 20).translate(CX + Math.cos(a) * COLS.R, COLS.top / 2, CZ + Math.sin(a) * COLS.R), 'stone');
  }
}
/** Flat wall face from a to c (left to right seen from outside) with openings cut through it. */
function face(a: [number, number], c: [number, number], y0: number, y1: number, cuts: (ArchOpening & {back: C})[], col: C = 'stone') {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]), t = [(c[0] - a[0]) / len, (c[1] - a[1]) / len], n = [-t[1], t[0]];
  const w = archOpeningWall(len, y0, y1, cuts);
  const W = (p: [number, number, number]) => [a[0] + t[0] * p[0] + n[0] * p[2], p[1], a[1] + t[1] * p[0] + n[1] * p[2]];
  const emit = (list: {pts: [number, number, number][]}[], c2: C) => tris(list.flatMap(x => x.pts.flatMap(W)), c2);
  emit(w.face, col);
  w.reveals.forEach(r => emit(r, col));
  w.backs.forEach((r, k) => emit(r, cuts[k].back));
}

/* ------------------------------------------------------------------ the control cabin on the roof */
function cabin() {
  const {apo, y0, y1, glass0, glass1, roofApo, roofTop} = CAB, n = 8, R = apo / Math.cos(Math.PI / n), side = 2 * apo * Math.tan(Math.PI / n);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2, a0 = a + Math.PI / n, a1 = a - Math.PI / n;
    const p: [number, number] = [CX + Math.cos(a0) * R, CZ + Math.sin(a0) * R], q: [number, number] = [CX + Math.cos(a1) * R, CZ + Math.sin(a1) * R];
    face(p, q, y0, y1, [{t0: 0.12, t1: side - 0.12, y0: glass0, y1: glass1, depth: 0.08, arch: 0, back: 'glass'}]);
  }
  // flat roof over the cabin (its underside covers the wall tops) and the railing round it on the reservoir roof
  drum(roofApo / Math.cos(Math.PI / n), y1, roofTop, n, 'slate', Math.PI / 2 - Math.PI / n);
  const rr = 4.0, posts = 16;
  for (let k = 0; k < posts; k++) {
    const a = (k / posts) * Math.PI * 2;
    add(new T.BoxGeometry(0.06, 1.0, 0.06).translate(CX + Math.cos(a) * rr, RIM.y1 + 0.5, CZ + Math.sin(a) * rr), 'slate');
    const a2 = ((k + 1) / posts) * Math.PI * 2, x0 = Math.cos(a) * rr, z0 = Math.sin(a) * rr, x1 = Math.cos(a2) * rr, z1 = Math.sin(a2) * rr;
    const L = Math.hypot(x1 - x0, z1 - z0);
    for (const y of [RIM.y1 + 0.98, RIM.y1 + 0.5]) {
      const g = new T.BoxGeometry(L + 0.06, 0.05, 0.05).rotateY(-Math.atan2(z1 - z0, x1 - x0)).translate(CX + (x0 + x1) / 2, y, CZ + (z0 + z1) / 2);
      add(g, 'slate');
    }
  }
}
