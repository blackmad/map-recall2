import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, put, ringFrame, setSink, slab} from './nearbar-kit';
import {face, flushFaces, opening, resetFaces, type FR} from './modern-front-kit';
import source from './wonderkamer-kanaalstraat-footprints.json';

/**
 * WONDERKAMER, former Cornelisschool, Kanaalstraat 149 (BAG pand 0363100012165328, BAG 1906; gemeentelijk monument 224053).
 * Register: the second Roman Catholic boys' school with a teacher's house, the Cornelisschool, of the parish of St Vincentius
 * a Paolo, given to the boys of the older school at Kanaalstraat 102 in 1906. Today the Wonderkamer coworking space (149A).
 * It stands in the street wall between houses, three storeys of dark red-brown brick with orange bands and segmental
 * relieving arches over large white-framed classroom windows, the two end bays (doors under round arches, the teacher's
 * house) 0.22 m proud of the classroom front, a statue in a niche between the classrooms.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned (front to 14-15 m, the rear courtyard roofs at 2.3 m), except the street front
 * (facade-ring edges 1, 3 and 5: the two end bays and the classroom front), which this builder draws. Read from the
 * rectified Gemeente Amsterdam panorama b_20241129_0829_Track22_Sphere_00096 (2024, w01-338, 50 px/m, ground at 810 px),
 * t along each edge from the viewer's left (ringFrame), y up from the 3DBAG ground:
 *  - classroom front (edge 3, 14.1 m): four bays centred t 2.24, 5.34, 8.6, 11.64; ground-storey windows 2.5 x 2.86 m
 *    (1.1-3.96 m, three lights, two transoms), first floor 2.5 x 2.8 m (5.7-8.5 m), top floor 2.4 x 2.8 m (10.3-13.1 m)
 *    at t 2.3, 5.0, 9.3, 12.1; an orange segmental arch over each; the statue niche at t 6.95, 4.7-7.5 m; a row of small
 *    square vents under each upper storey; orange bands across the piers; the stone cornice at 14.0 m;
 *  - left end bay (edge 1, 4.2 m): the arched door t 1.1-2.7, a three-light window over it, two tall windows on the first
 *    floor and two round-headed ones on the top floor;
 *  - right end bay (edge 5, 4.2 m): the arched double door t 1.1-3.06, a three-light window over it, three tall windows
 *    on the first floor, three round-headed ones under one big orange arch on the top floor.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
const FRONT = [1, 3, 5];
let B: BuildingTools;

const ys = (s: Surface) => s.rings[0].map(p => p[1]);
/** Distance of a wall from a front edge's line, and whether it lies along it. */
function onEdge(s: Surface, F: FR) {
  return s.rings[0].every(p => {
    const dx = p[0] - F.f.origin[0], dz = p[2] - F.f.origin[1];
    const t = dx * F.f.tangent[0] + dz * F.f.tangent[1], d = dx * F.f.n[0] + dz * F.f.n[1];
    return Math.abs(d) < 0.35 && t > -0.4 && t < F.len + 0.4;
  });
}

export function buildWonderkamerKanaalstraat(_w: number, _d: number, b: BuildingTools) {
  B = b;
  resetFaces();
  const fronts = FRONT.map(i => ringFrame(ring, i));
  const tops = fronts.map(() => 0);
  const skip = new Set<number>();
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const k = fronts.findIndex(F => onEdge(s, F));
    if (k < 0) return;
    skip.add(i);
    tops[k] = Math.max(tops[k], ...ys(s));
  });
  addShell(b, src as never, {wall: 'brick', roof: 'slate', skip: (_s, i) => skip.has(i), roofFor: s => (Math.max(...ys(s)) - Math.min(...ys(s)) < 0.4 ? 'dark' : 'slate')});
  const sink0 = getSink();
  setSink(0.08, true);
  classrooms(fronts[1], tops[1]);
  leftBay(fronts[0], tops[0]);
  rightBay(fronts[2], tops[2]);
  // the 0.22 m returns of the end bays (edges 2 and 4) up to their tops
  for (const [i, top] of [[2, tops[0]], [4, tops[2]]]) face(ringFrame(ring, i), 0, top, 'brick');
  flushFaces(b);
  setSink(sink0);
}

/** Bands of orange brick across a face, the stone cornice and the plinth, common to the three front parts. */
function bands(F: FR, top: number) {
  // (only at levels clear of every window and arch, so a band never crosses an opening)
  for (const y of [0.8, 4.62, 5.4, 9.3]) slab(B, F.f, F.len / 2, y, F.len, 0.14, 0.05, 'red', 0);
  slab(B, F.f, F.len / 2, 0, F.len, 0.5, 0.04, 'greyBrick', 0);
  if (top > 14.1) slab(B, F.f, F.len / 2, 13.95, F.len + 0.04, 0.22, 0.12, 'stone', 0);
}

type Win = {t: number; y0: number; y1: number; w: number; cols: number; rows: number; arch?: number; round?: boolean};
function windows(F: FR, W: ReturnType<typeof face>, list: Win[]) {
  for (const o of list) {
    const h = o.y1 - o.y0;
    opening(B, W, o.t, o.y0, o.w, h, {depth: 0.18, frame: 'frame', edge: 0.1, cols: o.cols, rows: o.rows, sill: false});
    // the stone sill 7 cm under the reveal floor (the kit's sill sits flush with it and z-fights)
    slab(B, F.f, o.t, o.y0 - 0.14, o.w + 0.1, 0.07, 0.1, 'stone', 0);
    if (o.round) arch(F, o.t, o.y1 - o.w / 2, o.w, o.w / 2, 0.22);
    else if (o.arch) arch(F, o.t, o.y1, o.w + 0.3, o.arch, 0.3);
  }
}

/** An orange brick relieving arch over a window: a segmental band `thick` deep in the wall plane, springing at y. */
function arch(F: FR, t: number, y: number, span: number, rise: number, thick: number) {
  const R = (span * span / 4 + rise * rise) / (2 * rise), phi = Math.asin(Math.min(1, span / 2 / R));
  const g = new T.RingGeometry(R, R + thick, 12, 1, Math.PI / 2 - phi, 2 * phi);
  put(B, F.f, g.translate(0, rise - R, 0.04), t, y, 0, 'red');
  // the band's own back and edges are hidden by the wall it stands 4 cm proud of
}

function vents(F: FR, ts: number[], y: number) {
  for (const t of ts) slab(B, F.f, t, y, 0.24, 0.24, 0.03, 'dark', 0);
}

function classrooms(F: FR, top: number) {
  const W = face(F, 0, top, 'brick');
  const bays = [2.24, 5.34, 8.6, 11.64], tops = [2.3, 5.0, 9.3, 12.1];
  windows(F, W, [
    ...bays.map(t => ({t, y0: 1.1, y1: 3.96, w: 2.5, cols: 3, rows: 3, arch: 0.35})),
    ...bays.map(t => ({t, y0: 5.7, y1: 8.5, w: 2.5, cols: 2, rows: 3, arch: 0.4})),
    ...tops.map(t => ({t, y0: 10.3, y1: 13.1, w: 2.4, cols: 2, rows: 2, arch: 0.35})),
  ]);
  bands(F, top);
  vents(F, bays.flatMap(t => [t - 0.75, t + 0.75]), 4.75);
  vents(F, bays.flatMap(t => [t - 0.75, t + 0.75]), 9.5);
  // the statue in its niche between the second and third bay
  slab(B, F.f, 6.95, 4.6, 0.6, 3.0, 0.08, 'stone', 0);
  slab(B, F.f, 6.95, 4.75, 0.42, 0.25, 0.3, 'stone', 0.08);
  const body = new T.CylinderGeometry(0.16, 0.22, 1.9, 8).translate(0, 0.95, 0.2);
  put(B, F.f, body, 6.95, 5.0, 0.08, 'stone');
  put(B, F.f, new T.SphereGeometry(0.13, 8, 6).translate(0, 0, 0.2), 6.95, 7.03, 0.08, 'stone');
  slab(B, F.f, 6.95, 7.35, 0.6, 0.2, 0.25, 'stone', 0);
  // the tall pier at the right end rising past the cornice with its stone carving
  slab(B, F.f, F.len - 0.45, 0, 0.9, Math.max(top, 14.9) + 0.3, 0.14, 'brick', 0);
  slab(B, F.f, F.len - 0.45, 12.0, 0.75, 1.6, 0.18, 'stone', 0);
}

function leftBay(F: FR, top: number) {
  const W = face(F, 0, top, 'brick');
  door(F, W, 1.9, 1.6, 2.45);
  windows(F, W, [
    {t: 1.9, y0: 2.8, y1: 3.95, w: 1.7, cols: 3, rows: 1},
    {t: 1.3, y0: 5.8, y1: 8.5, w: 0.8, cols: 1, rows: 3},
    {t: 2.3, y0: 5.8, y1: 8.5, w: 0.8, cols: 1, rows: 3},
    {t: 1.3, y0: 10.0, y1: 12.0, w: 0.75, cols: 1, rows: 2, round: true},
    {t: 2.3, y0: 10.0, y1: 12.0, w: 0.75, cols: 1, rows: 2, round: true},
  ]);
  bands(F, top);
}

function rightBay(F: FR, top: number) {
  const W = face(F, 0, top, 'brick');
  door(F, W, 2.1, 1.9, 2.5);
  windows(F, W, [
    {t: 2.1, y0: 2.8, y1: 3.95, w: 2.0, cols: 3, rows: 1},
    ...[1.3, 2.05, 2.8].map(t => ({t, y0: 5.7, y1: 8.5, w: 0.55, cols: 1, rows: 3})),
    ...[1.25, 2.05, 2.85].map(t => ({t, y0: 9.8, y1: 12.1, w: 0.5, cols: 1, rows: 2, round: true})),
  ]);
  arch(F, 2.05, 12.2, 2.6, 0.7, 0.3);
  bands(F, top);
}

/** A brown double door under a round arch, set 0.3 m into the wall, with an orange arch over it. */
function door(F: FR, W: ReturnType<typeof face>, t: number, w: number, h: number) {
  opening(B, W, t, 0.05, w, h, {depth: 0.3, frame: 'bronze', edge: 0, back: 'bronze', sill: false});
  arch(F, t, h + 0.05, w + 0.3, (w + 0.3) / 2, 0.25);
}

