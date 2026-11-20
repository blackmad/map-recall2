import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, getSink, ledgeStrip, poly, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {pinnacle, pointedGable, reshapeShell} from './shell-gable-fit';
import {crocketedSpire, openworkLantern, openworkParapet, rusticatedBase} from './gothic-tower-kit';
import {polygonRing} from '../../src/canalRecall/landmarks/gothicCrown';
import source from './magna-plaza-footprints.json';

/**
 * MAGNA PLAZA, the former Hoofdpostkantoor (C.H. Peters 1895-1899, rijksmonument 5989), Nieuwezijds Voorburgwal 182.
 * BAG pand 0363100012167578 (BAG year 1899).
 *
 * Massing: the 3DBAG LoD2.2 shell (magna-plaza-footprints.json, bag-shell-prepare.ts). The scanned tops of the two
 * entrance towers (3DBAG 40.1 and 46.3 m) are cut at their belfry line and the corner pavilion's roof (24-54 m) at its
 * eaves; both are redrawn (belfries, pear-shaped crowns, spires, the corner pavilion's octagonal roof and lantern), as the
 * scan blurs them into lumps.
 *
 * Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), positions in metres along each ring edge from the
 * viewer's left (ringFrame), per item in magna-plaza-inventory.json. The old venue model (venue-builders.ts until
 * 2026-11-20) repeated one 5.3 m bay all round; the panoramas show (lane retail-fit-20261120, docs/reports/
 * magna-plaza-bay-rhythm-20261120.md):
 *  - bays of 3.5-3.8 m: NZV south wing w01-107 (b_20250109_1300_Track02_Sphere_00170, 45.4 px/m) 3.79 ... 25.13 m, seven;
 *    NZV north wing w02-107 (b_20250109_1300_Track05_Sphere_00113, 46.3 px/m) 2.16 ... 23.15 m, seven; Spuistraat
 *    (b_20250109_1300_Track02_Sphere_00101/_00103/_00106, TMX7316010203-002932_pano_0001_000121) 3.5-3.8 m; the south
 *    front (b_20241216_0911_Track30_Sphere_00081/_00084) 3.6 m;
 *  - a two-tier street storey: a grey granite basement to 2.6 m with paired small round-arched windows per bay, then the
 *    tall round-arched windows of the ground storey (sill 2.75, crown 7.4 m) in stone surrounds and archivolts, the brick
 *    piers banded with stone, wrought-iron anchors between the arches;
 *  - two arched upper storeys (sills 9.6 and 14.9 m) under voussoirs striped brick and stone, stone balconettes under the
 *    first-floor windows, the piers striped every 0.42 m; a frieze of stone squares and diamonds, a corbelled cornice
 *    (21.45 m) and a balustrade to 22.85 m (the 3DBAG eaves are 22.8-23.2 m);
 *  - a dormer with a pointed stone-coped gable and corner pinnacles over the bays (over the piers on the south front);
 *  - the entrance block on the NZV: a large round entrance arch under a glass canopy, a pointed gable between two square
 *    towers with tiers of lancets in giant arches, octagonal belfries, pear-shaped crowns and spires; pointed gables on
 *    the Spuistraat risalit and over the south front's east bays; the corbelled corner turret at the south-east corner;
 *    the octagonal corner pavilion (Spuistraat / south front) with its roof, lantern and crown (3DBAG 53.8 m);
 *  - the oval cartouche window on the south front's first bay.
 * Heights are the w01-107 profile (whose cornice reads the 3DBAG eaves to 0.1 m); the Spuistraat crops (camera 8 m) read
 * 12 % tall and were scaled to the 3DBAG eaves.
 *
 * Ground-storey panes are `glass` (slot glass), one flat face per opening, so retail fit can read them as shop windows.
 */
type Src = {facadeRing: number[][]; nativeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
type Col = string;
type P2 = [number, number];

// ---- storey grid (m above the 3DBAG ground) -------------------------------------------------------------------------
const BASE_TOP = 2.6;
const GF = {y: 2.75, w: 1.85, h: 4.65};
const CORNICE1 = 8.3;
const F1 = {y: 9.6, w: 1.85, h: 3.4};
const BAND2 = 14.25;
const F2 = {y: 14.9, w: 1.85, h: 4.3};
const FRIEZE = 20.0;
const CORNICE = 21.45;
const EAVES = 22.85;

// ---- small geometry helpers ---------------------------------------------------------------------------------------------
function inRing(x: number, z: number) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], c = ring[j];
    if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
/** Frame on the line a -> c (native metres), outward away from the ring, origin at the viewer's left. */
function lineFrame(a: number[], c: number[]): {f: Frame; len: number} {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]), tx = (c[0] - a[0]) / len, tz = (c[1] - a[1]) / len;
  let n: P2 = [-tz, tx], tangent: P2 = [tx, tz], o = a;
  if (inRing((a[0] + c[0]) / 2 + n[0] * 0.4, (a[1] + c[1]) / 2 + n[1] * 0.4)) { n = [tz, -tx]; tangent = [-tx, -tz]; o = c; }
  return {f: {origin: [o[0], o[1]], tangent, n}, len};
}
const shift = (f: Frame, d: number): Frame => ({...f, origin: [f.origin[0] + f.n[0] * d, f.origin[1] + f.n[1] * d]});
const local = (f: Frame, x: number, z: number) => ({t: (x - f.origin[0]) * f.tangent[0] + (z - f.origin[1]) * f.tangent[1], d: (x - f.origin[0]) * f.n[0] + (z - f.origin[1]) * f.n[1]});
const world = (f: Frame, t: number, d: number): P2 => [f.origin[0] + f.tangent[0] * t + f.n[0] * d, f.origin[1] + f.tangent[1] * t + f.n[1] * d];
/** Flat single-sided face (front only) in the wall's (t, y) plane, `out` in front of it. */
function flat(b: BuildingTools, f: Frame, t: number, y: number, pts: P2[], out: number, colour: Col) {
  put(b, f, new T.ShapeGeometry(new T.Shape(pts.map(p => new T.Vector2(p[0], p[1])))).translate(0, 0, out), t, y, 0, colour);
}
/** Round-headed outline (width w, height h to the crown), bottom at 0. */
function archPts(w: number, h: number, seg = 6): P2[] {
  const r = w / 2, pts: P2[] = [[-r, 0], [r, 0]];
  for (let i = 0; i <= seg; i++) { const a = Math.PI * i / seg; pts.push([r * Math.cos(a), h - r + r * Math.sin(a)]); }
  return pts;
}
/** Voussoirs striped stone and brick: `n` flat wedges round a semicircle of inner radius r0, outer r1, centre (t, yc). */
function voussoirs(b: BuildingTools, f: Frame, t: number, yc: number, r0: number, r1: number, n: number, out = 0.1) {
  for (let k = 0; k < n; k++) {
    const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n, pts: P2[] = [];
    for (const a of [a0, (a0 + a1) / 2, a1]) pts.push([r1 * Math.cos(a), r1 * Math.sin(a)]);
    for (const a of [a1, a0]) pts.push([r0 * Math.cos(a), r0 * Math.sin(a)]);
    flat(b, f, t, yc, pts, out, k % 2 === 0 ? 'stone' : 'brick');
  }
}
/** Arched window: dark-brown frame, glass (one flat face), mullion and transom at the springing. */
function archWindow(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, glass: Col = 'glass') {
  flat(b, f, t, y - 0.07, archPts(w + 0.16, h + 0.12, 5), 0.07, 'frame');
  flat(b, f, t, y, archPts(w, h, 5), 0.12, glass);
  const spring = h - w / 2;
  flat(b, f, t, y, [[-0.04, 0], [0.04, 0], [0.04, spring], [-0.04, spring]], 0.16, 'frame');
  flat(b, f, t, y + spring - 0.05, [[-w / 2, 0], [w / 2, 0], [w / 2, 0.09], [-w / 2, 0.09]], 0.16, 'frame');
}
/** Stone stripes (speklagen) on a run of wall [t0, t1] between y0 and y1, every `pitch` metres. */
function stripes(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number, pitch = 0.42, h = 0.13) {
  if (t1 - t0 < 0.08) return;
  // front faces only, 5 cm proud (clear of the 2-3 cm z-fight band): the strips' tops were never seen from the street and
  // cost twice the vertices of the whole banding
  const w = (t1 - t0) / 2;
  for (let y = y0 + pitch - h; y + h <= y1; y += pitch) flat(b, f, (t0 + t1) / 2, y, [[-w, 0], [w, 0], [w, h], [-w, h]], 0.05, 'stone');
}
/** A stone course along [t0, t1] in pieces of at most 12 m (long ledge strips fail the holes gate). */
/**
 * Rock-faced granite rustication on a basement course whose face is `out` proud of the wall: blocks in 0.5 m courses,
 * 1.25 m long in running bond, 5 cm proud with 2.5 cm V-joints, stopping round `holes` ([t0, y0, t1, y1] in the frame).
 */
function rustic(b: BuildingTools, f: Frame, t0: number, t1: number, y1: number, holes: [number, number, number, number][], out = 0.15) {
  rusticatedBase(b, f, {t0: t0 + 0.09, t1: t1 - 0.09, y0: 0.02, y1, course: 0.5, block: 1.25, holes, depth: 0.05, joint: 0.025, out}, 'concrete');
}
function course(b: BuildingTools, f: Frame, t0: number, t1: number, y: number, h: number, d: number, colour: Col = 'stone', out = 0) {
  // ends held 9 cm in from the run's ends, so an end face never lies in the plane of the scanned step wall beside it
  t0 += 0.09; t1 -= 0.09;
  const n = Math.max(1, Math.ceil((t1 - t0) / 12)), w = (t1 - t0) / n;
  for (let k = 0; k < n; k++) slab(b, f, t0 + w * (k + 0.5), y, w, h, d, colour, out);
}

// ---- one street front ---------------------------------------------------------------------------------------------------
interface FrontOpts {
  bays: number[];
  /** Run of the front that carries the courses (default 0..len). */
  t0?: number; t1?: number;
  /** Bays with no ground-storey window (doors, cartouche); the caller draws them. */
  groundSkip?: number[];
  dormers?: number[];
  /** balustrade (NZV, south) or a pinnacled parapet (Spuistraat). */
  crown?: 'balustrade' | 'pinnacles' | 'none';
  winW?: number;
}
/** The ground-storey shop window: stone surround and archivolt, glass, mullion and transom. */
function groundArch(b: BuildingTools, f: Frame, t: number) {
  const gw = GF.w;
  archSlab(b, f, t, GF.y - 0.15, gw + 0.6, GF.h + 0.4, 0.08, 'stone', 0, 5);
  archBand(b, f, t, GF.y - 0.15, gw + 0.9, GF.h + 0.55, 0.18, 0.14, 'stone', 0, 6);
  flat(b, f, t, GF.y, archPts(gw, GF.h), 0.12, 'glass');
  const spring = GF.h - gw / 2;
  flat(b, f, t, GF.y, [[-0.05, 0], [0.05, 0], [0.05, spring], [-0.05, spring]], 0.16, 'frame');
  flat(b, f, t, GF.y + 3.05, [[-gw / 2, 0], [gw / 2, 0], [gw / 2, 0.1], [-gw / 2, 0.1]], 0.16, 'frame');
}
function front(b: BuildingTools, f: Frame, len: number, o: FrontOpts) {
  const t0 = o.t0 ?? 0, t1 = o.t1 ?? len, ww = o.winW ?? F1.w, fw = ww + 0.16, gw = GF.w;
  // granite basement and its paired small arched windows
  course(b, f, t0, t1, 0, BASE_TOP, 0.15, 'concrete');
  course(b, f, t0, t1, BASE_TOP - 0.05, 0.2, 0.22, 'concrete');
  const cellars: [number, number, number, number][] = [];
  for (const t of o.bays) for (const s of [-0.58, 0.58]) {
    flat(b, f, t + s, 0.45, archPts(0.66, 1.75, 3), 0.21, 'dark');
    cellars.push([t + s - 0.42, 0.37, t + s + 0.42, 2.28]);
  }
  rustic(b, f, t0, t1, BASE_TOP - 0.05, cellars);
  // ground storey
  o.bays.forEach((t, i) => { if (!o.groundSkip?.includes(i)) groundArch(b, f, t); });
  const piers = (w: number): [number, number][] => {
    const edges: [number, number][] = [], ts = [...o.bays].sort((a, c) => a - c);
    let prev = t0 + 0.05;
    for (const t of ts) { edges.push([prev, t - w / 2]); prev = t + w / 2; }
    edges.push([prev, t1 - 0.05]);
    return edges.filter(([a, c]) => c - a > 0.1);
  };
  for (const [a, c] of piers(gw + 0.9)) stripes(b, f, a, c, GF.y, CORNICE1 - 0.1, 0.62, 0.22);
  for (let i = 0; i + 1 < o.bays.length; i++) anchor(b, f, (o.bays[i] + o.bays[i + 1]) / 2, 7.45);
  // first cornice and the balconettes
  course(b, f, t0, t1, CORNICE1 - 0.14, 0.14, 0.14);
  course(b, f, t0, t1, CORNICE1, 0.32, 0.3);
  for (const t of o.bays) balconette(b, f, t, CORNICE1 + 0.32, ww + 0.4);
  // upper storeys
  for (const S of [F1, F2]) for (const t of o.bays) {
    archWindow(b, f, t, S.y, ww, S.h);
    voussoirs(b, f, t, S.y + S.h - ww / 2, fw / 2, fw / 2 + 0.42, 9);
  }
  for (const [a, c] of piers(fw + 0.86)) { stripes(b, f, a, c, F1.y - 0.2, BAND2 - 0.1); stripes(b, f, a, c, BAND2 + 0.3, FRIEZE - 0.05); }
  for (const t of o.bays) { stripes(b, f, t - fw / 2 - 0.43, t + fw / 2 + 0.43, F1.y + F1.h + 0.43, BAND2 - 0.05); stripes(b, f, t - fw / 2 - 0.43, t + fw / 2 + 0.43, F2.y + F2.h + 0.43, FRIEZE - 0.05); }
  course(b, f, t0, t1, BAND2 - 0.12, 0.12, 0.12);
  course(b, f, t0, t1, BAND2, 0.3, 0.2);
  // frieze: stone squares and diamonds, corbels, cornice
  course(b, f, t0, t1, FRIEZE, 0.15, 0.1);
  for (let t = t0 + 0.45; t < t1 - 0.3; t += 0.875) {
    const k = Math.round((t - t0) / 0.875) % 2;
    if (k === 0) slab(b, f, t, FRIEZE + 0.45, 0.34, 0.34, 0.06, 'stone');
    else flat(b, f, t, FRIEZE + 0.62, [[0, -0.2], [0.2, 0], [0, 0.2], [-0.2, 0]], 0.05, 'stone');
    if (k === 0) slab(b, f, t, CORNICE - 0.42, 0.24, 0.42, 0.32, 'stone');
  }
  course(b, f, t0, t1, CORNICE, 0.5, 0.55);
  if (o.crown === 'balustrade') balustrade(b, f, t0, t1, o.bays);
  else if (o.crown === 'pinnacles') {
    course(b, f, t0, t1, CORNICE + 0.5, 0.4, 0.3);
    for (let t = t0 + 0.7; t < t1 - 0.4; t += 1.75) pinnacle(b, f, t, CORNICE + 0.9, 0.5, 0.3, 'stone', 'stone', 0.05);
  }
  for (const t of o.dormers ?? []) dormer(b, f, t);
}

/** Wrought-iron anchor between the ground-storey arches (a cross with a heart). */
function anchor(b: BuildingTools, f: Frame, t: number, y: number) {
  poly(b, f, t, y, [[-0.04, 0], [0.04, 0], [0.04, 0.9], [-0.04, 0.9]], 0.05, 'bronze', 0.06);
  poly(b, f, t, y + 0.5, [[-0.3, 0], [0.3, 0], [0.3, 0.07], [-0.3, 0.07]], 0.05, 'bronze', 0.06);
  poly(b, f, t, y + 0.1, [[0, 0], [0.22, 0.25], [0.12, 0.38], [0, 0.28], [-0.12, 0.38], [-0.22, 0.25]], 0.05, 'bronze', 0.06);
}
/** Stone balconette: base, rail, end posts, balusters (single faces, shallower than they are wide). */
function balconette(b: BuildingTools, f: Frame, t: number, y: number, w: number) {
  slab(b, f, t, y, w, 0.12, 0.42, 'stone');
  slab(b, f, t, y + 0.72, w, 0.12, 0.42, 'stone');
  for (const s of [-1, 1]) slab(b, f, t + s * (w / 2 - 0.09), y + 0.12, 0.18, 0.6, 0.4, 'stone');
  for (let k = 1; k <= 6; k++) flat(b, f, t - w / 2 + 0.18 + (w - 0.36) * (k - 0.5) / 6, y + 0.12, [[-0.05, 0], [0.05, 0], [0.05, 0.6], [-0.05, 0.6]], 0.34, 'stone');
}
/** Eaves balustrade on the cornice: base, rail, posts at the piers, balusters. */
function balustrade(b: BuildingTools, f: Frame, t0: number, t1: number, bays: number[]) {
  const y = CORNICE + 0.5;
  course(b, f, t0, t1, y, 0.15, 0.45, 'stone', 0.05);
  course(b, f, t0, t1, EAVES - 0.14, 0.14, 0.45, 'stone', 0.05);
  const ts = [...bays].sort((a, c) => a - c), posts = [t0 + 0.35, ...ts.slice(1).map((t, i) => (t + ts[i]) / 2), t1 - 0.35];
  for (const p of posts) slab(b, f, p, y, 0.32, EAVES - y + 0.25, 0.48, 'stone', 0.03);
  for (let t = t0 + 0.4; t < t1 - 0.3; t += 0.38) if (posts.every(p => Math.abs(p - t) > 0.25)) flat(b, f, t, y + 0.15, [[-0.05, 0], [0.05, 0], [0.05, EAVES - y - 0.29], [-0.05, EAVES - y - 0.29]], 0.4, 'stone');
}
/** Dormer: brick body set back on the roof, arched window, pointed stone-coped gable with corner pinnacles and a finial. */
function dormer(b: BuildingTools, f: Frame, t: number) {
  // on the wall plane: the scan draws the dormers as lumps of the front wall (3DBAG 26-28.5 m at the dormer axes), which a
  // set-back dormer would sit inside
  const g = shift(f, 0.06), foot = EAVES + 1.75, half = 1.0;
  slab(b, g, t, EAVES - 0.3, 2.0, foot - EAVES + 0.3, 2.0, 'brick', -2.0);
  archSlab(b, g, t, EAVES + 0.25, 1.0, 1.4, 0.06, 'stone', 0, 5);
  // the pane is drawn in the dark bronze tint, not glass: the dormer stands in the scanned roof plane, which the opening
  // gate reads as a window past its wall (the dormer's own front is too small to host it)
  flat(b, g, t, EAVES + 0.3, archPts(0.8, 1.3, 5), 0.1, 'bronze');
  slab(b, g, t, EAVES + 0.1, 2.15, 0.12, 0.12, 'stone');
  pointedGable(b, g, {axis: t, half, footY: foot, apexY: foot + 1.55}, {wall: 'brick', coping: 'stone', thick: 1.6, out: 0.04, finial: 0.7});
}

// ---- towers and crowns ------------------------------------------------------------------------------------------------
/** Yaw that turns an 8-sided CylinderGeometry so that a flat face looks along frame f's outward normal. */
const octYaw = (f: Frame) => Math.atan2(f.n[0], f.n[1]) + Math.PI / 8;
function octPrism(b: BuildingTools, c: P2, yaw: number, y0: number, y1: number, rBot: number, rTop: number, colour: Col, seg = 8) {
  const g = new T.CylinderGeometry(rTop, rBot, y1 - y0, seg).rotateY(yaw).translate(c[0], (y0 + y1) / 2, c[1]);
  b.add(g, colour as never);
}
/** Pear-shaped crown (lathe) from y0 (radius r) bulging and drawing in to a neck at y1. */
function pear(b: BuildingTools, c: P2, y0: number, y1: number, r: number, colour: Col) {
  const H = y1 - y0, pts = [[0.01, 0], [r * 0.92, 0], [r * 1.08, H * 0.18], [r * 1.0, H * 0.4], [r * 0.62, H * 0.66], [r * 0.3, H * 0.84], [r * 0.18, H]].map(p => new T.Vector2(p[0], p[1]));
  b.add(new T.LatheGeometry(pts, 8).translate(c[0], y0, c[1]), colour as never);
}
function spire(b: BuildingTools, c: P2, y0: number, y1: number, r: number) {
  b.add(new T.ConeGeometry(r, y1 - y0 - 0.6, 8).translate(c[0], (y0 + y1 - 0.6) / 2, c[1]), 'slate' as never);
  b.add(new T.CylinderGeometry(0.05, 0.05, 0.9, 4).translate(c[0], y1 - 0.45, c[1]), 'gold' as never);
}
/** Arched openings on the 8 faces of an octagonal stage of apothem `a` (bronze louvres, stone heads). */
function octOpenings(b: BuildingTools, c: P2, f: Frame, a: number, y: number, w: number, h: number, colour: Col = 'bronze') {
  const yaw0 = Math.atan2(f.n[0], f.n[1]);
  for (let k = 0; k < 8; k++) {
    const yaw = yaw0 + k * Math.PI / 4, n: P2 = [Math.sin(yaw), Math.cos(yaw)], tg: P2 = [n[1], -n[0]];
    const g: Frame = {origin: [c[0] + n[0] * a, c[1] + n[1] * a], tangent: tg, n};
    archSlab(b, g, 0, y - 0.1, w + 0.3, h + 0.2, 0.04, 'stone', 0, 4);
    flat(b, g, 0, y, archPts(w, h, 4), 0.1, colour);
  }
}

/**
 * An entrance tower's top (pitched 2025 panorama recording_2025-06-16_06-42-40_02393, heights by the camera's elevation
 * angles at 25-27 m): on the shell cut at 27 m, the square stage with two lancets a face to 31.3 m; a gallery with an
 * openwork parapet and crocketed corner pinnacles; the octagonal open belfry (3.3 m across) to 36.9 m; a second gallery;
 * the copper openwork lantern (2.6 m across) to 41.6 m under a dome; the crocketed needle and finial to about 50 m.
 */
const TOWER_CUT = 27.0;
function towerTop(b: BuildingTools, f: Frame, len: number) {
  const c = world(f, len / 2, -len / 2), yaw0 = Math.atan2(f.n[0], f.n[1]), yaw = octYaw(f), a = len / 2 - 0.15;
  slab(b, f, len / 2, TOWER_CUT - 0.05, len + 0.3, 0.4, len + 0.3, 'stone', -len - 0.15);
  // square stage: banded brick, two lancets on every face
  b.add(new T.BoxGeometry(2 * a, 31.3 - 27.3, 2 * a).rotateY(yaw0).translate(c[0], (27.3 + 31.3) / 2, c[1]), 'brick' as never);
  for (let k = 0; k < 4; k++) {
    const ang = yaw0 + k * Math.PI / 2, n: P2 = [Math.sin(ang), Math.cos(ang)], tg: P2 = [n[1], -n[0]];
    const g: Frame = {origin: [c[0] + n[0] * a - tg[0] * a, c[1] + n[1] * a - tg[1] * a], tangent: tg, n};
    stripes(b, g, 0.05, 2 * a - 0.05, 27.3, 31.2);
    for (const s of [-0.62, 0.62]) {
      archSlab(b, g, a + s, 27.75, 0.86, 3.0, 0.08, 'stone', 0, 4);
      flat(b, g, a + s, 27.85, archPts(0.6, 2.8, 4), 0.12, 'bronze');
    }
  }
  // first gallery: stone floor, openwork parapet, crocketed pinnacles on the corners
  b.add(new T.BoxGeometry(len + 0.3, 0.25, len + 0.3).rotateY(yaw0).translate(c[0], 31.3 + 0.125, c[1]), 'stone' as never);
  const sq = polygonRing(c, a + 0.2, 4, yaw0 + Math.PI / 4);
  openworkParapet(b, {ring: sq, y0: 31.55, y1: 32.4, pitch: 0.36, baluster: 0.09}, 'stone');
  for (const p of sq) {
    b.add(new T.BoxGeometry(0.34, 1.1, 0.34).rotateY(yaw0).translate(p[0], 31.55 + 0.55, p[1]), 'stone' as never);
    crocketedSpire(b, p, {y0: 32.65, y1: 34.3, apothem: 0.17, sides: 4, yaw: yaw0 + Math.PI / 4, crockets: {pitch: 0.42, size: 0.16}, finial: {height: 0.3}}, {shaft: 'stone'});
  }
  // octagonal open belfry
  openworkLantern(b, c, {y0: 31.55, y1: 36.9, apothem: 1.65, yaw, post: 0.42, base: 0.35, top: 0.5, core: 1.0}, {ring: 'stone', post: 'brick', core: 'bronze'});
  // second gallery and its pinnacles
  octPrism(b, c, yaw, 36.9, 37.1, 2.0, 2.0, 'stone');
  const oct = polygonRing(c, 1.75, 8, yaw);
  openworkParapet(b, {ring: oct, y0: 37.1, y1: 37.75, pitch: 0.3, baluster: 0.07}, 'stone');
  for (const p of oct) crocketedSpire(b, p, {y0: 37.1, y1: 38.6, apothem: 0.09, sides: 4, yaw: yaw0, crockets: {pitch: 0.4, size: 0.11}}, {shaft: 'stone'});
  // copper openwork lantern, dome, crocketed needle and finial
  openworkLantern(b, c, {y0: 37.1, y1: 41.6, apothem: 1.2, yaw, post: 0.2, base: 0.3, top: 0.35, core: 0.62, cap: {kind: 'dome', height: 1.6}}, {ring: 'copper', post: 'copper', core: 'bronze', cap: 'copper'});
  crocketedSpire(b, c, {y0: 43.1, y1: 47.6, apothem: 0.2, yaw, crockets: {pitch: 0.75, size: 0.22}, finial: {height: 2.6, ball: 0.13}}, {shaft: 'copper'});
}
/** Entrance tower face (4.9 m): side door, lancet group, the giant arch with three tiers of paired lancets, blind arches. */
function towerFace(b: BuildingTools, f: Frame, len: number) {
  const c = len / 2;
  course(b, f, 0, c - 1.2, 0, BASE_TOP, 0.15, 'concrete'); course(b, f, c + 1.2, len, 0, BASE_TOP, 0.15, 'concrete');
  rustic(b, f, 0, c - 1.2, BASE_TOP, []); rustic(b, f, c + 1.2, len, BASE_TOP, []);
  archSlab(b, f, c, 0.15, 2.3, 4.0, 0.16, 'stone', 0, 5);
  archSlab(b, f, c, 0.25, 1.6, 3.6, 0.2, 'dark', 0, 5);
  archSlab(b, f, c, 5.7, 2.0, 2.0, 0.07, 'stone', 0, 4);
  for (const s of [-0.75, -0.25, 0.25, 0.75]) flat(b, f, c + s, 5.8, archPts(0.36, 1.7, 4), 0.12, 'glass');
  archBand(b, f, c, 5.6, 2.3, 2.6, 0.15, 0.14, 'stone', 0, 5);
  stripes(b, f, 0.05, len - 0.05, BASE_TOP, 5.5, 0.62, 0.22);
  for (const [y, h] of [[8.9, 2.3], [11.8, 4.4], [16.6, 2.2]]) for (const s of [-0.55, 0.55]) archWindow(b, f, c + s, y, 0.8, h);
  for (const y of [11.3, 16.2]) slab(b, f, c, y, 2.6, 0.4, 0.3, 'stone');
  voussoirs(b, f, c, 8.6 + 11.4 - 1.65, 1.65, 2.1, 11, 0.1);
  for (const [a, d] of [[0.05, c - 2.15], [c + 2.15, len - 0.05]] as [number, number][]) stripes(b, f, a, d, 8.3, 21.1);
  course(b, f, 0, len, 21.1, 0.45, 0.35);
  for (const s of [-1.1, 1.1]) { archSlab(b, f, c + s, 22.3, 1.5, 3.6, 0.04, 'stone', 0, 4); flat(b, f, c + s, 22.4, archPts(1.2, 3.4, 4), 0.1, 'brick'); }
  stripes(b, f, 0.05, len - 0.05, 21.6, TOWER_CUT - 0.1);
}

// ---- shell cuts ---------------------------------------------------------------------------------------------------------
const E54 = ringFrame(ring, 54), E56 = ringFrame(ring, 56), E58 = ringFrame(ring, 58);
/** The tower square itself: only roofs wholly inside it are dropped above the cut (a lid strip behind it would open a crack). */
const inSquare = (e: {f: Frame; len: number}) => (x: number, z: number) => { const {t, d} = local(e.f, x, z); return t > -0.3 && t < e.len + 0.3 && d < 0.7 && d > -e.len - 0.3; };
const sqT54 = inSquare(E54), sqT58 = inSquare(E58);
/** The entrance block between and behind the towers: the scan's tower flanks reach 31-46 m there; cut at the gable apex. */
const BLOCK_CUT = 31.0;
const inBlock = (x: number, z: number) => { const {t, d} = local(E56.f, x, z); return t > -7 && t < E56.len + 7 && d < 1.5 && d > -8; };
/** The corner pavilion (Spuistraat / south front): octagon of apothem 6.5 m about PAV (from its four 4 m faces). */
const PAV: P2 = [-11.8, 19.9], PAV_A = 6.5, PAV_CUT = 24.0;
const inPav = (x: number, z: number) => Math.hypot(x - PAV[0], z - PAV[1]) < PAV_A / Math.cos(Math.PI / 8) + 0.6;

export function buildMagnaPlaza(_w: number, _d: number, b: BuildingTools) {
  const roofAbove = (s: Surface, inside: (x: number, z: number) => boolean, y: number) => s.type === 'RoofSurface' && s.rings[0].every(p => inside(p[0], p[2])) && Math.max(...s.rings[0].map(p => p[1])) > y + 0.05;
  const surfaces = reshapeShell(src.surfaces, {snap: [
    {inside: sqT54, lo: TOWER_CUT, hi: 60, to: TOWER_CUT},
    {inside: sqT58, lo: TOWER_CUT, hi: 60, to: TOWER_CUT},
    {inside: inPav, lo: PAV_CUT, hi: 60, to: PAV_CUT},
    {inside: inBlock, lo: BLOCK_CUT, hi: 60, to: BLOCK_CUT},
  ]}).filter(s => !roofAbove(s, sqT54, TOWER_CUT - 0.2) && !roofAbove(s, sqT58, TOWER_CUT - 0.2) && !roofAbove(s, inPav, PAV_CUT - 0.2) && !(s.type === 'RoofSurface' && s.rings[0].every(p => inBlock(p[0], p[2]) && p[1] >= BLOCK_CUT)));
  addShell(b, {...src, surfaces} as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);

  // Nieuwezijds Voorburgwal, south wing (edge 52, w01-107): seven bays; the corner turret over t 0-2.4
  {
    const {f, len} = ringFrame(ring, 52), bays = [3.79, 7.28, 10.8, 14.44, 18.03, 21.6, 25.13];
    front(b, f, len, {bays, t0: 1.6, crown: 'balustrade', dormers: bays});
  }
  // NZV north wing (edges 60 + 0, one line, w02-107): seven bays, dormers over the last six
  {
    const {f, len} = lineFrame(ring[60], ring[1]), bays = [2.16, 5.62, 9.07, 12.63, 16.2, 19.65, 23.15];
    front(b, f, len, {bays, crown: 'balustrade', dormers: bays.slice(1)});
  }
  // Entrance block: towers (edges 54, 58) and the central gable (edge 56, w06-105, w08-108)
  // the scanned tower walls stand 2-3 cm proud of the BAG ring: the tower faces are drawn 4 cm out
  for (const e of [E54, E58]) { towerFace(b, shift(e.f, 0.04), e.len); towerTop(b, e.f, e.len); }
  {
    // drawn 4 cm out: the scanned wall bows up to 6 cm out of the merged chord here (native vertex 99)
    const {len} = E56, f = shift(E56.f, 0.04), c = len / 2, bays = [c - 2.3, c, c + 2.3];
    course(b, f, 0, c - 3.25, 0, BASE_TOP, 0.15, 'concrete'); course(b, f, c + 3.25, len, 0, BASE_TOP, 0.15, 'concrete');
    rustic(b, f, 0, c - 3.25, BASE_TOP, []); rustic(b, f, c + 3.25, len, BASE_TOP, []);
    archSlab(b, f, c, 0, 5.9, 8.1, 0.08, 'stone', 0, 8);
    archBand(b, f, c, 0, 6.3, 8.3, 0.25, 0.16, 'stone', 0, 8);
    archSlab(b, f, c, 0.15, 4.9, 7.5, 0.12, 'dark', 0, 8);
    flat(b, f, c, 3.9, archPts(4.5, 3.5, 8), 0.16, 'frame');
    stripes(b, f, 0.05, c - 3.2, BASE_TOP, CORNICE1 - 0.1, 0.62, 0.22); stripes(b, f, c + 3.2, len - 0.05, BASE_TOP, CORNICE1 - 0.1, 0.62, 0.22);
    course(b, f, 0, len, CORNICE1 + 0.2, 0.32, 0.3);
    for (const S of [F1, F2]) for (const t of bays) { archWindow(b, f, t, S.y, 1.4, S.h); voussoirs(b, f, t, S.y + S.h - 0.7, 0.78, 1.12, 7); }
    for (const [a, d] of [[0.05, bays[0] - 1.13], [bays[0] + 1.13, bays[1] - 1.13], [bays[1] + 1.13, bays[2] - 1.13], [bays[2] + 1.13, len - 0.05]] as [number, number][]) stripes(b, f, a, d, F1.y - 0.2, FRIEZE - 0.05);
    course(b, f, 0, len, BAND2, 0.3, 0.2);
    course(b, f, 0, len, FRIEZE, 0.15, 0.1);
    course(b, f, 0, len, CORNICE, 0.5, 0.55);
    balustrade(b, f, 0, len, bays);
    pointedGable(b, f, {axis: c, half: len / 2 - 0.1, footY: EAVES, apexY: 31.0}, {wall: 'brick', coping: 'stone', thick: 0.6, finial: 1.2});
    for (const s of [-1.2, 0, 1.2]) archWindow(b, shift(f, 0.1), c + s, 24.2, 0.7, s === 0 ? 4.2 : 3.2);
    for (let y = EAVES + 0.5; y < 30; y += 0.6) { const w = (len - 0.4) * (1 - (y + 0.13 - EAVES) / (31.0 - EAVES)); if (w > 0.4) ledgeStrip(b, f, c, y, w, 0.13, 0.08, 'stone', 0.03); }
    // canopy over the entrance (2025 panorama): a metal-framed glass roof on two posts, as a solid bronze slab
    const cf = shift(f, 0.1);
    slab(b, cf, c, 5.0, len - 0.4, 0.14, 1.4, 'bronze', 0);
    for (const s of [-1, 1]) slab(b, cf, c + s * (len / 2 - 0.4), 0, 0.16, 5.0, 0.16, 'bronze', 1.15);
  }

  // South front (edges 49 and 51, w03-186, w04-185b, w08-184b): four bays, the oval cartouche on bay 1, two bays under the gable
  {
    const {f, len} = ringFrame(ring, 49), bays = [2.1, 5.8, 9.35, 12.9];
    front(b, f, len, {bays, crown: 'balustrade', dormers: [3.9, 7.55, 11.15], groundSkip: [0]});
    // the cartouche: an oval window in a carved stone frame
    const t = bays[0];
    poly(b, f, t, 3.1, [[-0.9, 0.3], [0.9, 0.3], [1.05, 2.0], [0.8, 3.8], [0, 4.5], [-0.8, 3.8], [-1.05, 2.0]], 0.14, 'stone');
    put(b, f, new T.CylinderGeometry(0.62, 0.62, 0.1, 12).rotateX(Math.PI / 2).scale(1, 1.25, 1).translate(0, 0, 0.2), t, 5.3, 0, 'dark');
  }
  {
    // the native ring bows 7-14 cm out of the merged chord here (vertices 84-87): frame on the native chord
    const {f, len} = lineFrame(src.nativeRing[84], src.nativeRing[87]), bays = [2.2, 5.7];
    front(b, f, len, {bays, t1: 7.4, crown: 'balustrade'});
    const c = 4.0;
    pointedGable(b, f, {axis: c, half: 3.9, footY: EAVES, apexY: 31.3}, {wall: 'brick', coping: 'stone', thick: 0.6, finial: 0});
    slab(b, f, c, 29.0, 0.9, 4.3, 0.75, 'brick', -0.5);
    slab(b, f, c, 33.25, 1.1, 0.25, 0.85, 'stone', -0.55);
    for (const s of [-1.0, 1.0]) archWindow(b, shift(f, 0.1), c + s, 24.0, 0.6, 1.7);
    archWindow(b, shift(f, 0.1), c, 26.6, 0.6, 1.8);
    for (let y = EAVES + 0.5; y < 30.8; y += 0.6) { const w = 7.6 * (1 - (y + 0.13 - EAVES) / (31.3 - EAVES)); if (w > 0.4) ledgeStrip(b, f, c, y, w, 0.13, 0.08, 'stone', 0.03); }
  }

  // Spuistraat (west): edge 12 (w06-288b), edge 16 (w05-288b), the gabled risalit edge 18 (w07-288b), edge 20 (w03-288b)
  {
    const e12 = ringFrame(ring, 12);
    front(b, e12.f, e12.len, {bays: [1.76, 5.5, 9.34], crown: 'pinnacles', dormers: [5.5, 9.34]});
    const e16 = ringFrame(ring, 16);
    front(b, e16.f, e16.len, {bays: [3.9, 7.7, 11.5], crown: 'pinnacles', dormers: [3.9, 7.7]});
    const e20 = ringFrame(ring, 20);
    front(b, e20.f, e20.len, {bays: [1.9, 5.4, 8.94, 12.44, 15.9], crown: 'pinnacles', dormers: [5.4, 8.94, 12.44]});
    const {f, len} = ringFrame(ring, 18), c = len / 2;
    front(b, f, len, {bays: [2.5, 5.36, 8.2], groundSkip: [0, 1, 2], winW: 1.5, crown: 'none'});
    for (const t of [3.1, 7.5]) groundArch(b, f, t);
    pointedGable(b, f, {axis: c, half: c - 0.1, footY: CORNICE + 0.5, apexY: 31.1}, {wall: 'brick', coping: 'stone', thick: 0.6, finial: 1.0});
    for (const s of [-1.6, 0, 1.6]) archWindow(b, shift(f, 0.1), c + s, 23.4, 0.7, s === 0 ? 3.6 : 2.6);
    for (let y = CORNICE + 1.0; y < 30.5; y += 0.6) { const w = (len - 0.4) * (1 - (y + 0.13 - CORNICE - 0.5) / (31.1 - CORNICE - 0.5)); if (w > 0.4) ledgeStrip(b, f, c, y, w, 0.13, 0.08, 'stone', 0.03); }
  }

  // The corner pavilion's four 4 m faces (edges 30, 35, 40, 46; w09-319, w11-275, w12-229, w10-184): a tall arched shop
  // window or entrance per face, one window on each upper storey, the balustrade; then its octagonal roof and lantern
  for (const e of [30, 35, 40, 46]) {
    const {f, len} = ringFrame(ring, e), c = len / 2;
    course(b, f, 0, c - 1.75, 0, 1.2, 0.15, 'concrete'); course(b, f, c + 1.75, len, 0, 1.2, 0.15, 'concrete');
    rustic(b, f, 0, c - 1.75, 1.2, []); rustic(b, f, c + 1.75, len, 1.2, []);
    archSlab(b, f, c, 0.6, 3.4, 7.0, 0.08, 'stone', 0, 6);
    flat(b, f, c, 0.75, archPts(2.9, 6.6), 0.12, 'glass');
    flat(b, f, c, 3.4, [[-1.45, 0], [1.45, 0], [1.45, 0.1], [-1.45, 0.1]], 0.16, 'frame');
    course(b, f, 0, len, CORNICE1, 0.32, 0.3);
    balconette(b, f, c, CORNICE1 + 0.32, 2.6);
    for (const S of [F1, F2]) { archWindow(b, f, c, S.y, 2.2, S.h); voussoirs(b, f, c, S.y + S.h - 1.1, 1.18, 1.6, 9); }
    for (const [a, d] of [[0.05, c - 1.65], [c + 1.65, len - 0.05]] as [number, number][]) stripes(b, f, a, d, F1.y - 0.2, FRIEZE - 0.05);
    course(b, f, 0, len, BAND2, 0.3, 0.2);
    course(b, f, 0, len, FRIEZE, 0.15, 0.1);
    course(b, f, 0, len, CORNICE, 0.5, 0.55);
    balustrade(b, f, 0, len, [c]);
  }
  {
    const f = ringFrame(ring, 46).f, yaw = octYaw(f), R = (PAV_A - 0.25) / Math.cos(Math.PI / 8), k = 1 / Math.cos(Math.PI / 8);
    octPrism(b, PAV, yaw, PAV_CUT + 0.05, 36.0, R, 2.9 * k, 'slate');
    octPrism(b, PAV, yaw, 36.0, 43.6, 2.6 * k, 2.6 * k, 'brick');
    octOpenings(b, PAV, f, 2.6, 37.2, 1.2, 4.6);
    octPrism(b, PAV, yaw, 43.6, 44.1, 3.0 * k, 3.0 * k, 'stone');
    pear(b, PAV, 44.1, 50.6, 2.3, 'slate');
    spire(b, PAV, 50.5, 53.8, 0.3);
  }

  // The corbelled corner turret at the south-east corner (w01-107 left, w08-184b right): banded octagon from the first
  // cornice to the eaves, small arched windows, an ogee slate roof and spire to the 3DBAG 33.4 m
  {
    const e51 = ringFrame(ring, 51).f, e52 = ringFrame(ring, 52).f, corner = ring[52];
    const cc: P2 = [corner[0] - (e51.n[0] + e52.n[0]) * 1.2, corner[1] - (e51.n[1] + e52.n[1]) * 1.2];
    const yaw = octYaw(e52), R = 2.05;
    octPrism(b, cc, yaw, 6.6, CORNICE1 + 0.3, 0.6, R, 'stone');
    octPrism(b, cc, yaw, CORNICE1 + 0.3, EAVES, R, R, 'brick');
    for (let y = CORNICE1 + 0.8; y < EAVES - 0.5; y += 0.84) octPrism(b, cc, yaw, y, y + 0.13, R + 0.08, R + 0.08, 'stone');
    for (const y of [CORNICE1, BAND2, CORNICE]) octPrism(b, cc, yaw, y, y + 0.4, R + 0.2, R + 0.2, 'stone');
    const a = R * Math.cos(Math.PI / 8) + 0.03, out = Math.atan2(e51.n[0] + e52.n[0], e51.n[1] + e52.n[1]);
    for (let k = -1; k <= 1; k++) {
      const ang = out + k * Math.PI / 4, n: P2 = [Math.sin(ang), Math.cos(ang)], g: Frame = {origin: [cc[0] + n[0] * a, cc[1] + n[1] * a], tangent: [n[1], -n[0]], n};
      for (const S of [F1, F2]) archWindow(b, g, 0, S.y + 0.3, 0.75, S.h - 0.6);
    }
    octPrism(b, cc, yaw, EAVES, EAVES + 0.5, R + 0.15, R + 0.15, 'stone');
    octPrism(b, cc, yaw, EAVES + 0.5, 25.6, R - 0.15, R - 0.15, 'brick');
    pear(b, cc, 25.6, 31.4, 1.85, 'slate');
    spire(b, cc, 31.3, 33.4, 0.22);
  }
  setSink(sink0);
}
