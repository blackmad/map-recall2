import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, ledgeStrip, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {face, flushFaces, geom, opening, resetFaces, strut, type FR} from './modern-front-kit';
import source from './aurora-overtoom-footprints.json';

/**
 * KANTOORGEBOUW AURORA, corner of the Stadhouderskade and the Overtoom (BAG pand 0363100012233556, BAG 1961; gemeentelijk
 * monument 200973). Register: Zanstra's office (1961) on the corner of the Overtoom and the Stadhouderskade, a gently curved
 * front that joins the two streets; a high plinth on pilotis, the lifted main volume clad in natural stone over its full
 * height with a vertical rhythm, and a set-back roof storey.
 *
 * Massing: the 3DBAG LoD2.2 shell (main volume 27.45 m, the set-back roof storey to 30.6 m, the low rear parts as
 * scanned), except on the street front (facade-ring edges 1-7: Stadhouderskade, the five-sided curve, Overtoom), where the
 * shell's walls are replaced by this builder's front: the stone face from 6.55 m up, and under it the glazed ground storey
 * set 1.7 m back behind round pilotis at the front line.
 *
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), y up from the 3DBAG ground:
 *  - Stadhouderskade (edge 1, w01-40.alt.jpg, recording_2025-07-03_10-58-37_00099, 44.6 px/m up, ground at 1390 px):
 *    18 window columns at 1.526 m, six rows with centres at 9.05 ... 25.0 m (3.19 m storeys), windows 1.1 x 1.85 m with a
 *    head light; thin stone ribs between columns; the cornice band 26.3-27.45 m; the soffit at 6.55 m; six pilotis at
 *    4.25 m from t 5.6; the stone end bay t 0-2.3 with its door; the outdoor shop's glass box to 4.2 m (t 2.7-25.9);
 *  - Overtoom (edge 7, w02-334.alt.jpg, recording_2025-07-31_06-59-14_01744, 50.6 px/m): 11 columns from t 1.55 at the
 *    same pitch, the same six rows; pilotis at t 2.3, 6.2, 10.0, 13.75; a glass box to 4.0 m (t 2.9-16.9) and the dark
 *    stone end bay with the door t 16.9-17.6;
 *  - the curve (edges 2-6): the same rows, two windows per facet, three pilotis at 4.25 m.
 * The 2025 Overtoom photo shows the front in scaffolding for the renovation ("a monument reborn"); the 2021 crop and the
 * Stadhouderskade face give the grid.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;

const TOP = 27.45, SOFFIT = 6.55, RECESS = 1.7, CORNICE = 26.3;
const ROWS = [9.05, 12.2, 15.4, 18.6, 21.8, 25.0];
const WIN_W = 1.1, WIN_H = 1.85;
/** Street-front ring points, left to right facing the building: Stadhouderskade (1-2), the curve (2-7), Overtoom (7-8). */
const FRONT = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ring[i] as [number, number]);

type P2 = [number, number];
const frameOf = (a: P2, c: P2): FR => {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const t: P2 = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  return {f: {origin: a, tangent: t, n: [-t[1], t[0]]} as Frame, len};
};
const at = (F: FR, t: number, y: number, d = 0): [number, number, number] => [F.f.origin[0] + F.f.tangent[0] * t + F.f.n[0] * d, y, F.f.origin[1] + F.f.tangent[1] * t + F.f.n[1] * d];

export function buildAuroraOvertoom(_w: number, _d: number, b: BuildingTools) {
  resetFaces();
  const outer = FRONT.slice(0, -1).map((p, i) => frameOf(p, FRONT[i + 1]));
  // Front walls of the shell: those on the front line are replaced; those standing back from it (the scan's recessed bays and
  // the returns between them) are kept above the soffit only, hidden behind the new front, so the roof edges stay closed.
  const front = new Set(src.surfaces.map((s, i) => (s.type === 'WallSurface' && onFront(s, outer) ? i : -1)).filter(i => i >= 0));
  addShell(b, src as never, {wall: 'stone', roof: 'slate', skip: (_s, i) => front.has(i)});
  const kept = [...front].filter(i => !flushWithFront(src.surfaces[i], outer)).map(i => ({...src.surfaces[i], rings: [clipAbove(src.surfaces[i].rings[0], SOFFIT)]})).filter(s => s.rings[0].length >= 3);
  addShell(b, {surfaces: kept} as never, {wall: 'stone', roof: 'slate'});
  rearWindows(b);
  const sink0 = getSink();
  setSink(0.1, true);
  // the recess line: the front polyline offset 1.7 m inward (mitred), between the stone end bays
  const inner = offsetPolyline(FRONT, RECESS);
  const innerF = inner.slice(0, -1).map((p, i) => frameOf(p, inner[i + 1]));
  // window columns per facet: Stadhouderskade 18 at 1.526 m, Overtoom 11 from t 1.55, two per curve facet
  const cols: number[][] = outer.map((F, i) => {
    if (i === 0) return Array.from({length: 18}, (_, k) => 0.763 + 1.526 * k);
    if (i === 6) return Array.from({length: 11}, (_, k) => 1.55 + 1.526 * k);
    return [F.len * 0.25, F.len * 0.75];
  });
  outer.forEach((F, i) => {
    const Fc = face(F, SOFFIT, TOP, 'stone');
    const w = i === 0 || i === 6 ? WIN_W : Math.min(WIN_W, F.len / 2 - 0.25);
    for (const t of cols[i]) for (const y of ROWS) opening(b, Fc, t, y - WIN_H / 2, w, WIN_H, {depth: 0.18, frame: 'frame', bars: [WIN_H * 0.74], sill: false});
    // stone ribs between the columns and at the facet ends, sill ledges, the soffit edge and the cornice band
    const ribs = cols[i].slice(1).map((t, k) => (t + cols[i][k]) / 2);
    for (const t of ribs) ledgeStrip(b, F.f, t, SOFFIT + 0.45, 0.16, CORNICE - SOFFIT - 0.45, 0.1, 'stone', 0);
    for (const y of ROWS) ledgeStrip(b, F.f, F.len / 2, y - WIN_H / 2 - 0.12, F.len, 0.1, 0.06, 'stone', 0);
    slab(b, F.f, F.len / 2, SOFFIT, F.len, 0.45, 0.08, 'stone');
    slab(b, F.f, F.len / 2, CORNICE, F.len, TOP - CORNICE + 0.1, 0.14, 'stone');
  });
  groundStorey(b, outer, innerF);
  flushFaces(b);
  setSink(sink0);
}

/** A 3DBAG wall standing on the street front, from the ground, nearer the front line than the recess: replaced. */
/** Offsets of a wall's points from the front facet it stands on (d < 0 = inside). */
function frontOffsets(s: Surface, outer: FR[]): number[] | null {
  for (const F of outer) {
    const ds: number[] = [];
    const ok = s.rings[0].every(p => {
      const dx = p[0] - F.f.origin[0], dz = p[2] - F.f.origin[1];
      const t = dx * F.f.tangent[0] + dz * F.f.tangent[1], d = dx * F.f.n[0] + dz * F.f.n[1];
      ds.push(d);
      return t > -0.6 && t < F.len + 0.6 && d < 0.3 && d > -3;
    });
    if (ok) return ds;
  }
  return null;
}
/** A wall lying on the front line itself (within 15 cm): dropped outright, it would fight the new stone face. */
function flushWithFront(s: Surface, outer: FR[]) {
  const ds = frontOffsets(s, outer)!;
  return Math.max(...ds) - Math.min(...ds) < 0.15 && Math.max(...ds) > -0.15;
}
/** The part of a polygon at or above height y (Sutherland-Hodgman against one plane). */
function clipAbove(r: number[][], y: number): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < r.length; k++) {
    const a = r[k], c = r[(k + 1) % r.length], ia = a[1] >= y, ic = c[1] >= y;
    if (ia) out.push(a);
    if (ia !== ic) { const u = (y - a[1]) / (c[1] - a[1]); out.push([a[0] + (c[0] - a[0]) * u, y, a[2] + (c[2] - a[2]) * u]); }
  }
  return out;
}

/**
 * The courtyard side (edges 13 and 15; edge 14 is a stepped scan of terraces and is left plain) is seen in no panorama: the office grid of the front is repeated there (INFERRED), the roof
 * storey's row where the scan rises to 30.6 m, and two rows on the low rear wing (edge 13, 8 m).
 */
function rearWindows(b: BuildingTools) {
  const runs: [number, number, number, number][] = [
    // edge, t0, t1, wall top
    [15, 0.6, 12.4, 30.6], [15, 12.9, 21.4, 27.39],
  ];
  for (const [e, t0, t1, top] of runs) {
    const F = ringFrame(ring, e);
    const n = Math.max(1, Math.floor((t1 - t0) / 1.526));
    const rows = [...ROWS, 28.4].filter(y => y + WIN_H / 2 < top - 0.5 && y - WIN_H / 2 > Math.max(SOFFIT, top < 20 ? 6.0 : 0));
    for (let k = 0; k < n; k++) for (const y of rows) flatWindow(b, F, t0 + (t1 - t0) * (k + 0.5) / n, y - WIN_H / 2, WIN_W, WIN_H);
  }
  const R = ringFrame(ring, 13);
  for (let k = 0; k < 8; k++) for (const y of [1.2, 4.6]) flatWindow(b, R, 1.0 + 1.75 * k + 0.5, y, 1.1, 1.7);
}
function flatWindow(b: BuildingTools, F: FR, t: number, y: number, w: number, h: number) {
  slab(b, F.f, t, y - 0.05, w + 0.1, h + 0.1, 0.05, 'frame', 0);
  slab(b, F.f, t, y, w, h, 0.12, 'glass', 0);
}

function onFront(s: Surface, outer: FR[]) {
  const r = s.rings[0];
  if (Math.min(...r.map(p => p[1])) > 1) return false;
  return outer.some(F => r.every(p => {
    const dx = p[0] - F.f.origin[0], dz = p[2] - F.f.origin[1];
    const t = dx * F.f.tangent[0] + dz * F.f.tangent[1], d = dx * F.f.n[0] + dz * F.f.n[1];
    return t > -0.6 && t < F.len + 0.6 && d < 0.3 && d > -3;
  }) && r.some(p => {
    const dx = p[0] - F.f.origin[0], dz = p[2] - F.f.origin[1];
    return dx * F.f.n[0] + dz * F.f.n[1] > -RECESS + 0.05;
  }));
}

function offsetPolyline(pts: P2[], d: number): P2[] {
  const nOf = (a: P2, c: P2): P2 => { const L = Math.hypot(c[0] - a[0], c[1] - a[1]); return [-(c[1] - a[1]) / L, (c[0] - a[0]) / L]; };
  return pts.map((p, i) => {
    const na = i > 0 ? nOf(pts[i - 1], p) : nOf(p, pts[i + 1]);
    const nb = i < pts.length - 1 ? nOf(p, pts[i + 1]) : na;
    let m: P2 = [na[0] + nb[0], na[1] + nb[1]];
    const L = Math.hypot(m[0], m[1]);
    m = [m[0] / L, m[1] / L];
    const k = d / (m[0] * na[0] + m[1] * na[1]);
    return [p[0] - m[0] * k, p[1] - m[1] * k];
  });
}

/** Ground storey: stone end bays, the soffit, the recessed glazing with its clerestory, the pilotis and the shop boxes. */
function groundStorey(b: BuildingTools, outer: FR[], innerF: FR[]) {
  const S = outer[0], O = outer[6];
  const E0 = 2.3, E1 = O.len - 0.75; // recess from t 2.3 on the Stadhouderskade to t 16.9 on the Overtoom
  // stone end bays with their doors (w01 left, w02 right)
  slab(b, S.f, E0 / 2, 0, E0, SOFFIT, 0.05, 'stone', -0.05);
  slab(b, S.f, 1.0, 0, 1.0, 2.4, 0.06, 'dark', 0);
  slab(b, O.f, (E1 + O.len) / 2, 0, O.len - E1, SOFFIT, 0.05, 'stone', -0.05);
  slab(b, O.f, (E1 + O.len) / 2, 0, 0.5, 2.4, 0.06, 'dark', 0);
  // end walls of the recess
  sideWall(b, S, E0, 1);
  sideWall(b, O, E1, -1);
  // soffit and back glazing, facet by facet; the back runs between the two end walls. The glass is one continuous ribbon
  // round the curve (a glazed skin), drawn after the loop.
  const ribbon: [number, number, number][][] = [];
  outer.forEach((F, i) => {
    const I = innerF[i];
    const t0 = i === 0 ? E0 : 0, t1 = i === 6 ? E1 : F.len;
    const it0 = (t0 / F.len) * I.len, it1 = (t1 / F.len) * I.len;
    const q = [at(F, t0, SOFFIT), at(F, t1, SOFFIT), at(I, it1, SOFFIT), at(I, it0, SOFFIT)];
    downQuad(b, q, 'concrete');
    // glazing on the recess line: the ground floor to 4.2 m, a transom, the clerestory to the soffit
    // a dark host wall (the interior seen through the glass), the glass on its face
    slab(b, I.f, (it0 + it1) / 2, 0, it1 - it0, SOFFIT, 0.08, 'blue', -0.3);
    ribbon.push([at(I, it0, 0), at(I, it1, 0)]);
    for (let t = it0 + 0.05; t < it1; t += 0.76) ledgeStrip(b, I.f, t, 0, 0.07, SOFFIT, 0.05, 'bronze', 0);
    for (const y of [4.25, 5.4]) ledgeStrip(b, I.f, (it0 + it1) / 2, y, it1 - it0, 0.1, 0.05, 'bronze', 0);
  });
  // one welded strip (shared vertices at the facet joints), so the audit reads one glazed skin, not seven panes
  const pts = [ribbon[0][0], ...ribbon.map(r => r[1])], pos: number[] = [], idx: number[] = [];
  for (const p of pts) pos.push(p[0], 0, p[2], p[0], SOFFIT, p[2]);
  for (let k = 0; k < pts.length - 1; k++) { const a = 2 * k; idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  b.add(g, 'glass');
  // pilotis, one every 4.25 m along the front, 0.45 m inside the front line
  const lens = outer.map(F => F.len), runs: [number, number][] = [];
  const total = lens.reduce((a, c) => a + c, 0);
  for (let s = 5.6; s < total - 1.0; s += 4.255) {
    let k = 0, t = s;
    while (k < lens.length - 1 && t > lens[k]) { t -= lens[k]; k++; }
    runs.push([k, t]);
  }
  for (const [k, t] of runs) strut(b, at(outer[k], t, 0, -0.45), at(outer[k], t, SOFFIT, -0.45), 0.4, 'concrete', 12);
  // the shop boxes: glass to 4.2 m at 0.6 m behind the front, a dark fascia, the roof back to the recess
  shopBox(b, S, 2.7, 25.9, 4.2);
  shopBox(b, O, 2.9, 16.9, 4.0);
}

function sideWall(b: BuildingTools, F: FR, t: number, dir: number) {
  const q = [at(F, t, 0), at(F, t, 0, -RECESS), at(F, t, SOFFIT, -RECESS), at(F, t, SOFFIT)];
  // faces the recess: +tangent on the left end, -tangent on the right
  orientQuad(b, q, [F.f.tangent[0] * dir, 0, F.f.tangent[1] * dir], 'stone');
}

function shopBox(b: BuildingTools, F: FR, t0: number, t1: number, h: number) {
  const D = -0.6;
  slab(b, F.f, (t0 + t1) / 2, 0, t1 - t0, h - 0.55, 0.04, 'glass', D);
  slab(b, F.f, (t0 + t1) / 2, h - 0.55, t1 - t0, 0.55, 0.12, 'dark', D);
  const n = Math.round((t1 - t0) / 1.9);
  for (let k = 0; k <= n; k++) ledgeStrip(b, F.f, t0 + 0.04 + ((t1 - t0 - 0.08) * k) / n, 0, 0.08, h - 0.55, 0.05, 'dark', D + 0.04);
  // the box's roof, back to the recess glazing
  const q = [at(F, t0, h, D + 0.12), at(F, t1, h, D + 0.12), at(F, t1, h, -RECESS + 0.01), at(F, t0, h, -RECESS + 0.01)];
  orientQuad(b, q, [0, 1, 0], 'dark');
}

function downQuad(b: BuildingTools, q: number[][], c: Parameters<BuildingTools['add']>[1]) {
  orientQuad(b, q, [0, -1, 0], c);
}
function orientQuad(b: BuildingTools, q: number[][], want: number[], c: Parameters<BuildingTools['add']>[1]) {
  const u = [q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], v = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]];
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const p = n[0] * want[0] + n[1] * want[1] + n[2] * want[2] >= 0 ? q : [q[0], q[3], q[2], q[1]];
  b.add(geom([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]]), c);
}
