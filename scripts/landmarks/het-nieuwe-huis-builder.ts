import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {setSink, slab, ledgeStrip, put, disc, roofHeightAt, ringFrame, wallProbe, type Frame} from './nearbar-kit';
import {quad, addShellTess, beginFacade, claimOpening, planeDeviation} from './big-facade';
import {rawWall, topOf, type RawWall} from './big-kit';
import {planarPolygon} from './worship-shell';
import {raisedLettering} from './ornament-kit';
import source from './het-nieuwe-huis-footprints.json';

/**
 * Het Nieuwe Huis, Roelof Hartplein 50 (BAG pand 0363100012148010, 1927-1928, B. van den Nieuwen Amstel; Rijksmonument 527856):
 * a U-shaped block of flats for single people with a public library, shops and a tower, in the streamlined Amsterdam School
 * ("verstrakte Amsterdamse School", register text). Massing is the 3DBAG LoD2.2 shell (CC BY 4.0) in the native frame of
 * scripts/landmarks/het-nieuwe-huis-footprints.json; facades are drawn on the simplified BAG ring (`facadeRing`). Read from the
 * Gemeente Amsterdam panoramas (CC BY 4.0) and Commons photographs listed in scripts/landmarks/het-nieuwe-huis-inventory.json:
 *  - dark red-brown brick throughout, a grey stone plinth, cream window frames (every crop);
 *  - storeys of single cream-framed windows on a 2.95 m pitch above a glazed shop storey, a cream band at 3.7 m over the shops
 *    (w01-33, w08-290, w19, w20: 42 px/m crop of w01: sills 5.8 / 8.8 / 11.7 / 14.7 / 17.6 / 20.6 m);
 *  - Roelof Hartplein front (w01-33): a continuous balcony band from 3.7 to 8.9 m (brick parapet 3.7-5.5 m and brick fascia
 *    7.45-8.9 m, cream edge lines, recessed windows between) along the plein, rounding off at the north-west end;
 *  - library front on Gerard Terborgstraat corner (w03-337): three two-storey glazed bays under a brick canopy band with
 *    OPENBARE BIBLIOTHEEK in raised letters (8.3-9.8 m) between two rounded corner towers with bow windows;
 *  - the low one-storey front along the south (w12-197, w13-197): tall narrow cream-framed windows in groups;
 *  - the tower (3DBAG 38.9 m, Commons "Het Nieuwe Huis, Roelof Hartplein"): a square brick shaft with a cream band and a row of
 *    openings under its flat top, and a flagpole.
 * INFERRED (no photograph): the courtyard walls (w02, w04, w05, w09, w11, w14), drawn with the same storey windows and no shops.
 */
type Src = {surfaces: {type: string; rings: number[][][]}[]; facadeRing: number[][]; nativeRing: number[][]};
const src = flattenLibraryAttic(structuredClone(source) as unknown as Src);

/**
 * 3DBAG roof plane 320 over the library front (w03-337) slopes sideways from 19.0 m at the west end to 28.9 m at the east end, so the
 * front would end in a raked gable. The photo (48 px/m crop) shows a flat-topped central block: cornice at 17.4 m, a set-back top
 * storey to 22.7 m, the corner towers higher. The plane is replaced by a flat roof at 22.7 m; the walls that met its sloping edges
 * are replaced by a front wall from the ground to 22.7 m and step walls from 22.7 m to whatever roof stands beyond each other edge.
 */
function flattenLibraryAttic(d: Src): Src {
  const R = 320, H = 22.7, ring = d.surfaces[R].rings[0];
  if (d.surfaces[R].type !== 'RoofSurface' || Math.max(...ring.map(p => p[1])) < 28) return d;
  const key = (p: number[]) => p.join(','), own = new Set(ring.map(key)); // shared 3DBAG vertices are identical triples
  d.surfaces.forEach((s, i) => { if (i === R || (s.type === 'WallSurface' && s.rings[0].filter(p => own.has(key(p))).length >= 2)) s.type = 'Replaced'; });
  d.surfaces.push({type: 'RoofSurface', rings: [ring.map(p => [p[0], H, p[2]])]});
  const cx = ring.reduce((a, p) => a + p[0], 0) / ring.length, cz = ring.reduce((a, p) => a + p[2], 0) / ring.length;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], mx = (a[0] + c[0]) / 2, mz = (a[2] + c[2]) / 2;
    const L = Math.hypot(c[0] - a[0], c[2] - a[2]);
    let ox = (c[2] - a[2]) / L, oz = -(c[0] - a[0]) / L;
    if ((mx - cx) * ox + (mz - cz) * oz < 0) { ox = -ox; oz = -oz; }
    const beyond = roofHeightAt(d.surfaces.filter(q => q.type === 'RoofSurface' && q.rings[0] !== d.surfaces.at(-1)!.rings[0]) as never, mx + ox * 0.4, mz + oz * 0.4) ?? 0;
    const lo = Math.min(H, beyond), hi = Math.max(H, beyond);
    if (hi - lo < 0.05) continue;
    // face away from the higher side: outward when the strip is higher, inward (over the strip) when the neighbour is
    const quadRing = [[a[0], lo, a[2]], [c[0], lo, c[2]], [c[0], hi, c[2]], [a[0], hi, a[2]]];
    let nx = 0, nz = 0;
    for (let k = 0; k < 4; k++) { const p = quadRing[k], q = quadRing[(k + 1) % 4]; nx += (p[1] - q[1]) * (p[2] + q[2]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
    const want = H >= beyond ? 1 : -1, has = Math.sign(nx * ox + nz * oz) || 1;
    d.surfaces.push({type: 'WallSurface', rings: [has === want ? quadRing : [...quadRing].reverse()]});
  }
  return d;
}
const RING = src.facadeRing;
const WIN_W = 1.25, WIN_H = 1.45, COL = 1.8;

/** Wall top 0.5 m inside the edge at tangent t (null where no roof covers it). */
function topAt(f: Frame, t: number): number {
  const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.5, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.5;
  return roofHeightAt(src.surfaces as never, x, z) ?? 0;
}
/** Courtyard side: a ray 30 m outward from the edge midpoint crosses the ring again. */
function courtyard(f: Frame, len: number): boolean {
  const ox = f.origin[0] + f.tangent[0] * len / 2 + f.n[0] * 0.3, oz = f.origin[1] + f.tangent[1] * len / 2 + f.n[1] * 0.3;
  const ex = ox + f.n[0] * 30, ez = oz + f.n[1] * 30;
  const r = src.nativeRing;
  for (let i = 0; i < r.length; i++) {
    const a = r[i], c = r[(i + 1) % r.length];
    const d = (ex - ox) * (c[1] - a[1]) - (ez - oz) * (c[0] - a[0]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((a[0] - ox) * (c[1] - a[1]) - (a[1] - oz) * (c[0] - a[0])) / d, v = ((a[0] - ox) * (ez - oz) - (a[1] - oz) * (ex - ox)) / d;
    if (u > 0.01 && u <= 1 && v >= 0 && v <= 1) return true;
  }
  return false;
}
/** Runs of constant wall top along an edge: [t0, t1, top]. */
function runsOf(f: Frame, len: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const step = 0.25;
  for (let t = 0; t < len - 1e-6; t += step) {
    const t1 = Math.min(len, t + step), h = topAt(f, (t + t1) / 2), last = out.at(-1);
    if (last && Math.abs(last[2] - h) < 0.5) { last[1] = t1; last[2] = Math.min(last[2], h); } else out.push([t, t1, h]);
  }
  return out.filter(r => r[1] - r[0] > 0.3 && r[2] > 2);
}
/** A cream-framed window: frame sheet, glass sheet, mullions, a cream sill strip sunk into the wall. */
function win(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, mullions = 1, transom = false) {
  ledgeStrip(b, f, t, y - 0.13, w + 0.2, 0.08, 0.1, 'concrete');
  quad(b, f, t, y - 0.07, w + 0.14, h + 0.14, 'white', 0.02);
  quad(b, f, t, y, w, h, 'glass', 0.04);
  for (let m = 1; m <= mullions; m++) quad(b, f, t - w / 2 + m * w / (mullions + 1), y, 0.07, h, 'white', 0.06);
  if (transom) quad(b, f, t, y + h * 0.72, w, 0.07, 'white', 0.06);
}
/** Columns on a run: groups of windows on COL m, centred, leaving 0.45 m at the ends. */
function columns(t0: number, t1: number, pitch = COL, w = WIN_W): number[] {
  const L = t1 - t0;
  if (L < w + 0.5) return [];
  const n = Math.max(1, Math.floor((L - 0.9 - w) / pitch) + 1);
  const s = t0 + (L - (n - 1) * pitch) / 2;
  return [...Array(n)].map((_, k) => s + k * pitch);
}

/** Storey columns: walls of 10 m and more carry groups of three on 1.8 m with 6.2 m between group centres (w01-33 main block,
 * 42 px/m: groups at px 400-580, 650-860, 915-1130); shorter walls a plain 1.8 m row. */
function storeyColumns(len: number): number[] {
  if (len < 10) return columns(0, len);
  const G = 6.2, gw = 2 * COL + WIN_W, n = Math.max(1, Math.floor((len - 0.9 - gw) / G) + 1), s0 = (len - (n - 1) * G) / 2;
  return [...Array(n)].flatMap((_, k) => [-COL, 0, COL].map(d => s0 + k * G + d));
}

type Edge = {i: number; f: Frame; len: number; court: boolean; runs: [number, number, number][]};
const SILLS = [5.8, 9.0, 11.95, 14.9, 17.85, 20.8];

export function buildHetNieuweHuis(_w: number, _d: number, b: BuildingTools) {
  addShellTess(b, {...src, surfaces: src.surfaces.filter(q => q.type !== 'Replaced')} as never, {wall: 'brick', roof: 'slate'});
  beginFacade(src as never);
  setSink(0.3);
  const probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface' || s.type === 'RoofSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
  // ring edges snapped onto the shell wall (median probe offset at 2 m and 6 m)
  const edges: Edge[] = RING.map((_, i) => {
    const {f, len} = ringFrame(RING, i);
    const offs = [0.2, 0.5, 0.8].flatMap(u => [2, 6].map(y => probe.offset(f, len * u, y))).filter((o): o is number => o !== null).sort((a, c) => a - c);
    const off = offs.length ? offs[Math.floor(offs.length / 2)] : 0;
    const g: Frame = {...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]};
    return {i, f: g, len, court: courtyard(f, len), runs: runsOf(f, len)};
  });
  const lib = edges[0];
  const onLibrary = (w: RawWall) => {
    if (w.f.n[0] * lib.f.n[0] + w.f.n[1] * lib.f.n[1] < 0.97) return false;
    const mx = w.f.origin[0] + w.f.tangent[0] * w.len / 2, mz = w.f.origin[1] + w.f.tangent[1] * w.len / 2;
    const u = (mx - lib.f.origin[0]) * lib.f.tangent[0] + (mz - lib.f.origin[1]) * lib.f.tangent[1];
    const v = (mx - lib.f.origin[0]) * lib.f.n[0] + (mz - lib.f.origin[1]) * lib.f.n[1];
    return u > -0.5 && u < lib.len + 0.5 && Math.abs(v) < 1.5;
  };

  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(src as never, i);
    if (w.len < 0.8 || w.top > 30 || onLibrary(w) || planeDeviation(src as never, w) > 0.06) return; // tower walls: tower()
    const mid = w.len / 2, top = topOf(w, mid), court = courtyard(w.f, w.len);
    if (w.base < 0.5) {
      slab(b, w.f, mid, 0, w.len - 0.1, 0.9, 0.06, 'stone'); // ends 5 cm short of the corners: no end face in a neighbouring wall's plane
      if (top < 7.5) { lowFront(b, w, top); return; }
      if (!court) {
        // shop windows: 2.2 m on a 2.7 m pitch; the 3DBAG splits the curved plein front into 2-3 m planes, so a narrower plane gets one window
        const sw = w.len >= 2.7 ? 2.2 : w.len - 0.5;
        if (sw >= 1.1) for (const t of w.len >= 2.7 ? columns(0, w.len, 2.7, 2.2) : [w.len / 2]) if (claimOpening(w, t - sw / 2, t + sw / 2, 1.0, 3.4, 0.08)) win(b, w.f, t, 1.0, sw, 2.4, 2, true);
        slab(b, w.f, mid, 3.62, w.len - 0.1, 0.16, 0.1, 'concrete');
      } else for (const t of columns(0, w.len)) if (claimOpening(w, t - WIN_W / 2, t + WIN_W / 2, 1.3, 1.3 + WIN_H, 0.08)) win(b, w.f, t, 1.3, WIN_W, WIN_H);
    }
    for (const y of SILLS) for (const t of storeyColumns(w.len)) {
      if (y < w.base + 0.6 || y + WIN_H > topOf(w, t) - 1.0) continue;
      if (claimOpening(w, t - WIN_W / 2, t + WIN_W / 2, y, y + WIN_H, 0.08)) win(b, w.f, t, y, WIN_W, WIN_H);
    }
  });
  plein(b, edges);
  library(b, lib);
  tower(b);
}

/** One-storey south front (w12-197, w13-197): groups of tall narrow windows. */
function lowFront(b: BuildingTools, w: RawWall, top: number) {
  const h = Math.min(3.0, top - 1.8);
  if (h < 1 || w.len < 2) return; // narrow niche walls stay plain
  for (const t of columns(0, w.len, 0.95, 0.62)) if (claimOpening(w, t - 0.31, t + 0.31, 1.0, 1.0 + h, 0.15)) win(b, w.f, t, 1.0, 0.62, h, 0, true);
  slab(b, w.f, w.len / 2, top - 0.45, w.len - 0.1, 0.12, 0.06, 'concrete');
}

/**
 * Roelof Hartplein front (w01-33, edges 78-81 of the facade ring, t from the tower end): balcony band 3.7-8.9 m from t 7 on
 * edge 78 to the north-west end, 1.2 m deep: brick parapet 3.7-5.5, brick fascia 7.45-8.9, cream lines under both. The same
 * stacked balconies on the rounded west corner (w08-290, edge 7).
 */
function plein(b: BuildingTools, edges: Edge[]) {
  const D = 1.2;
  for (const [i, from] of [[78, 7.0], [79, 0], [80, 0], [81, 0], [7, 0]] as [number, number][]) {
    const e = edges[i];
    if (!e) continue;
    const t0 = from + 0.05, t1 = e.len - 0.05, c = (t0 + t1) / 2, L = t1 - t0;
    slab(b, e.f, c, 3.7, L, 1.8, D, 'brick');
    slab(b, e.f, c, 3.58, L, 0.12, D + 0.06, 'concrete');
    slab(b, e.f, c, 7.45, L, 1.45, D, 'brick');
    slab(b, e.f, c, 7.33, L, 0.12, D + 0.06, 'concrete');
  }
}

/**
 * Library front (w03-337, facade-ring edge 0, 30.1 m, 48 px/m crop; t = len/2 + (px - 712) / 48): three glazed bays at
 * t 7.9-11.6, 12.8-16.5, 18.1-21.4 (ground 1.25-4.2 m, first floor 5.45-7.8 m), a brick canopy band 8.1-9.75 m with
 * OPENBARE BIBLIOTHEEK, cream line under it; bow windows on the corner towers; two storeys of triple windows (sills 11.5, 14.4 m),
 * a brick cornice at 17.4 m and nine small windows in three groups in the top storey (sill 18.75 m).
 */
function library(b: BuildingTools, e: Edge) {
  const f = e.f, L = e.len, at = (px: number) => L / 2 + (px - 712) / 48;
  for (const [t0, t1, top] of e.runs) slab(b, f, (t0 + t1) / 2, 0, t1 - t0, 1.2, 0.06, 'stone');
  const bays: [number, number][] = [[380, 555], [615, 790], [870, 1025]];
  for (const [p0, p1] of bays) {
    const t0 = at(p0), t1 = at(p1), c = (t0 + t1) / 2, w = t1 - t0;
    slab(b, f, c, 1.2, w + 0.2, 6.8, 0.55, 'brick');
    for (const [y, h] of [[1.3, 2.8], [5.45, 2.35]] as [number, number][]) {
      ledgeStrip(b, f, c, y - 0.12, w - 0.1, 0.1, 0.12, 'concrete', 0.55);
      put(b, f, new T.PlaneGeometry(w - 0.3, h).translate(0, h / 2, 0), c, y, 0.6, 'white');
      put(b, f, new T.PlaneGeometry(w - 0.5, h - 0.2).translate(0, h / 2, 0), c, y + 0.1, 0.64, 'glass');
      for (let m = 1; m < 4; m++) put(b, f, new T.PlaneGeometry(0.07, h - 0.2).translate(0, h / 2, 0), c - (w - 0.5) / 2 + m * (w - 0.5) / 4, y + 0.1, 0.68, 'white');
      for (let m = 1; m < 3; m++) put(b, f, new T.PlaneGeometry(w - 0.5, 0.06).translate(0, 0.03, 0), c, y + 0.1 + m * (h - 0.2) / 3, 0.68, 'white');
    }
  }
  // brick piers between the bays and stone capitals
  for (const px of [585, 830]) { slab(b, f, at(px), 1.2, 1.0, 6.9, 0.45, 'brick'); slab(b, f, at(px), 7.2, 0.7, 0.7, 0.6, 'stone'); }
  const c0 = at(270), c1 = at(1135), cm = (c0 + c1) / 2;
  slab(b, f, (at(355) + at(1045)) / 2, 17.3, at(1045) - at(355), 0.3, 0.25, 'brick'); // cornice under the top storey
  slab(b, f, cm, 7.95, c1 - c0, 0.16, 1.2, 'concrete');
  slab(b, f, cm, 8.1, c1 - c0, 1.65, 1.1, 'brick');
  const txt = raisedLettering({text: 'OPENBARE BIBLIOTHEEK', heightM: 0.5, maxWidthM: 10.8, depthM: 0.05});
  put(b, f, txt.geometry, at(712), 8.7, 1.1, 'white');
  // upper storeys (sills 11.5 and 14.4 m; the 10 m row hides behind the canopy band): triple windows with a narrow single either side
  for (const y of [11.5, 14.4]) {
    for (const px of [475, 700, 925]) win(b, f, at(px), y, 2.2, 1.35, 2);
    for (const px of [372, 612, 790, 1030]) win(b, f, at(px), y, 0.42, 1.2, 0);
  }
  for (const px of [438, 488, 543, 650, 700, 752, 860, 910, 962]) win(b, f, at(px), 18.75, 0.8, 1.2, 0);
  // corner towers: bow windows on four storeys, entrances in the stone ground storey
  for (const px of [130, 1270]) {
    const t = at(px);
    for (const y of [4.8, 8.4, 11.3, 14.2, 17.2]) {
      slab(b, f, t, y - 0.2, 3.0, 0.2, 0.55, 'concrete');
      win(b, f, t, y, 2.6, 1.45, 2);
    }
    for (const d of [-1.75, 1.75]) slab(b, f, t + d, 8.2, 0.5, 0.9, 0.35, 'stone'); // corbels beside the 8.4 m bow window
    slab(b, f, t, 0, 4.0, 3.6, 0.1, 'stone');
    slab(b, f, t, 0.9, 1.6, 2.4, 0.14, 'dark');
    slab(b, f, t, 3.6, 4.4, 0.16, 1.0, 'concrete');
  }
}

/**
 * Tower: the 3DBAG tower is split into slivers with sloping tops, so it is drawn as one clean brick box over the oriented
 * bounds of its roof planes (> 33 m; faces on bearings 26/116/206/296) from the ground to 39.2 m (over the 3DBAG 39.1 m maximum, so no shell roof shares its top). A projecting cream ledge
 * 4.2 m under the top, a clock face (white disc, dark hands) centred in the top stage of each face, slit windows on the shaft
 * above whatever stands in front of each face, a flagpole on top (Commons "Het Nieuwe Huis, Roelof Hartplein").
 */
function tower(b: BuildingTools) {
  const pts = src.surfaces.filter(s => s.type === 'RoofSurface' && Math.min(...s.rings[0].map(p => p[1])) > 37.5).flatMap(s => s.rings[0]);
  const a = 26 * Math.PI / 180, n1: [number, number] = [Math.sin(a), -Math.cos(a)], n2: [number, number] = [Math.cos(a), Math.sin(a)];
  const u = pts.map(p => p[0] * n1[0] + p[2] * n1[1]), v = pts.map(p => p[0] * n2[0] + p[2] * n2[1]);
  const u0 = Math.min(...u) - 0.1, u1 = Math.max(...u) + 0.1, v0 = Math.min(...v) - 0.1, v1 = Math.max(...v) + 0.1;
  const TOP = 39.2, BASE = 18, cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const cx = n1[0] * cu + n2[0] * cv, cz = n1[1] * cu + n2[1] * cv;
  b.add(new T.BoxGeometry(v1 - v0, TOP - BASE, u1 - u0).translate(0, (TOP + BASE) / 2, 0).rotateY(Math.atan2(n1[0], n1[1])).translate(cx, 0, cz), 'brick' as never);
  const ring = (y: number, h: number, grow: number) => b.add(new T.BoxGeometry(v1 - v0 + grow, h, u1 - u0 + grow).translate(0, y + h / 2, 0).rotateY(Math.atan2(n1[0], n1[1])).translate(cx, 0, cz), 'concrete' as never);
  ring(TOP - 4.2, 0.3, 0.6); // projecting ledge under the top stage
  ring(TOP - 0.3, 0.25, 0.2); // coping
  const faces: {n: [number, number]; half: number; width: number}[] = [
    {n: n1, half: (u1 - u0) / 2, width: v1 - v0}, {n: [-n1[0], -n1[1]], half: (u1 - u0) / 2, width: v1 - v0},
    {n: n2, half: (v1 - v0) / 2, width: u1 - u0}, {n: [-n2[0], -n2[1]], half: (v1 - v0) / 2, width: u1 - u0},
  ];
  for (const {n, half, width} of faces) {
    const tangent: [number, number] = [n[1], -n[0]];
    const mx = cx + n[0] * half, mz = cz + n[1] * half;
    const f: Frame = {origin: [mx - tangent[0] * width / 2, mz - tangent[1] * width / 2], tangent, n};
    const c = width / 2;
    const front = Math.max(0, roofHeightAt(src.surfaces as never, mx + n[0] * 0.6, mz + n[1] * 0.6) ?? 0);
    if (front > TOP - 6) continue; // the south-east face: 3DBAG's sloping roof plane rises against it nearly to the top
    disc(b, f, c, TOP - 2.0, Math.min(1.25, width / 2 - 0.4), 0.08, 'white', 0.02);
    put(b, f, new T.PlaneGeometry(0.1, 0.95).translate(0, 0.42, 0), c, TOP - 2.0, 0.14, 'dark');
    put(b, f, new T.PlaneGeometry(0.7, 0.1).translate(0.3, 0, 0), c, TOP - 2.0, 0.15, 'dark');
    for (let y = Math.max(3, front + 1.2); y + 1.6 < TOP - 5; y += 4.5) {
      quad(b, f, c, y - 0.08, 0.66, 1.76, 'white', 0.02);
      quad(b, f, c, y, 0.5, 1.6, 'glass', 0.04);
      ledgeStrip(b, f, c, y - 0.16, 0.8, 0.08, 0.1, 'concrete');
    }
  }
  b.add(new T.CylinderGeometry(0.05, 0.08, 7, 6).translate(cx, TOP + 3.5, cz), 'white' as never);
}
