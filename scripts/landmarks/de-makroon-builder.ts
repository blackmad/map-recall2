import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {put, setSink, slab, type Frame} from './nearbar-kit';
import {rawWall, topOf, type RawWall} from './big-kit';
import {beginFacade, addShellTess, centredColumns, claimOpening, bottomOf} from './big-facade';
import {raisedLettering} from './ornament-kit';
import type {ShellSource, Surface} from './worship-shell';
import raw from './de-makroon-footprints.json';

/**
 * De Makroon, Nieuwe Passeerdersstraat / Marnixstraat / Singelgracht (BAG pand 0363100012242951, BAG 2015, in use 2016; 165 units:
 * 151 dwellings plus shops, a hotel, care and offices). Architekten Cie. with Pi de Bruijn, on the site of Huize Sint Bernardus
 * (1913-15, demolished 2012); named after the macaron, by the Koekjesbrug (nl.wikipedia "Nieuwe Passeerdersstraat", CC BY-SA 4.0).
 * Massing is the 3DBAG LoD2.2 shell (native east/south metres from the BAG ring centroid): a U-shaped block opening north-west, main
 * roof 21.3 m, taller corner pieces to 23.8 m, the courtyard deck at 4.7 / 8.0 m.
 * Rhythm read from the municipal panoramas (artifacts/landmark-briefs/de-makroon/w01-155.jpg 2023, front on Nieuwe Passeerdersstraat,
 * 21.4 px/m; w04/w07/w08/w09 canal side 2017-2021) and from the uninstalled recipe scripts/building-recipes/houses/passeerdersstraat-242951
 * (palette and notes: U-block, shops on the plinth, four brick storeys with French balconies, yellow-brick top, slate tower over a metal canopy):
 *  - red-brown brick to the band at 14.8 m (the base of 3DBAG's set-back upper wall on the front), yellow brick above, grey stone bands
 *    at 4.3 and 7.8 m and a deeper one at 14.8 m;
 *  - front: shopfronts 0.4-3.9 m in brick piers, then French windows (2.4 x 2.8 m, 2.8 m over the frames as on w01) in fourteen measured columns (about 4.7 m apart), storeys at sills 4.5, 8.1, 11.3
 *    (brick) and 15.2, 18.3 (yellow), black balconettes; dark grey balcony boxes on the top storey;
 *  - the slate-shingle entrance tower (t 34.8-46.9 m along the front, proud 0.6 m, to 23.4 m) with two columns of paired windows,
 *    a slate collar at the band and the metal canopy (t 36-50.7 m) carrying "de MAKROON".
 * INFERRED: the Marnixstraat face (no usable panorama) and the courtyard repeat the front grid; canal-side storeys repeat the same grid
 * on centred columns (the panoramas show the same brick / yellow split and window kind there).
 * Not modelled: the slate-clad bay sections on the canal side, the grey slate panels between shopfronts, awnings, shop signs, the garden.
 */
const src = raw as unknown as ShellSource & {nativeRing: number[][]};
const SPLIT = 14.8;
const R34 = src.nativeRing[34], R36 = src.nativeRing[36];
const FL = Math.hypot(R36[0] - R34[0], R36[1] - R34[1]);
const FT: [number, number] = [(R36[0] - R34[0]) / FL, (R36[1] - R34[1]) / FL];
const FN: [number, number] = [-FT[1], FT[0]];                       // outward (south-south-east): tangent = [n1, -n0]
const FRONT: Frame = {origin: [R34[0], R34[1]], tangent: FT, n: FN};
const TOWER: [number, number] = [34.8, 46.9], TOWER_TOP = 23.4, TOWER_PROUD = 0.6;
const SILLS = [4.5, 8.1, 11.3, 15.2, 18.3], WH = 2.8, WH_TOP = 2.5, WW = 2.4;
/** Window columns measured on w01-155 (m from the west corner): seven either side of the tower. */
const FRONT_COLS = [4.1, 9.9, 14.8, 19.5, 24.4, 29.3, 33.7, 48.4, 52.4, 57.0, 61.5, 66.1, 70.8, 75.2];
/**
 * Slate slices: the entrance tower is a full-depth slice of the block, slate-clad on both faces and 2 m higher than the main roof
 * (3DBAG roofs of 23.1-23.4 m 13 m behind the front); the canal side has a second one (w04-240), whose canal face is 3DBAG wall 457
 * (9.2 m, full height) with its raised top 14.5 m behind (wall 165). Rectangles in a wall frame: t along, d out (+) / in (-).
 */
const CANAL = rawWall(src, 457);
const SLICES: {f: Frame; t0: number; t1: number; d0: number; d1: number}[] = [
  {f: FRONT, t0: TOWER[0], t1: TOWER[1], d0: -16, d1: 1},
  {f: CANAL.f, t0: -0.3, t1: CANAL.len + 0.3, d0: -16, d1: 1},
];
function inSlice(x: number, z: number): boolean {
  return SLICES.some(q => {
    const ox = x - q.f.origin[0], oz = z - q.f.origin[1], t = ox * q.f.tangent[0] + oz * q.f.tangent[1], d = ox * q.f.n[0] + oz * q.f.n[1];
    return t > q.t0 && t < q.t1 && d > q.d0 && d < q.d1;
  });
}
const centroid = (r: number[][]) => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[2], 0) / r.length];

/** Clip a planar 3D ring to y <= c (below) or y >= c. */
function clipY(ring: number[][], c: number, below: boolean): number[][] {
  const inside = (p: number[]) => (below ? p[1] <= c + 1e-9 : p[1] >= c - 1e-9), out: number[][] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], q = ring[(i + 1) % ring.length], ia = inside(a), iq = inside(q);
    if (ia) out.push(a);
    if (ia !== iq) { const k = (c - a[1]) / (q[1] - a[1]); out.push([a[0] + (q[0] - a[0]) * k, c, a[2] + (q[2] - a[2]) * k]); }
  }
  return out.length >= 3 ? out : [];
}
function splitShell(): [ShellSource, ShellSource, ShellSource] {
  const low: Surface[] = [], high: Surface[] = [], slate: Surface[] = [];
  for (const s of src.surfaces) {
    if (s.type !== 'WallSurface' || s.rings.length !== 1) { low.push(s); continue; }
    const [cx, cz] = centroid(s.rings[0]);
    if (inSlice(cx, cz) || Math.min(...s.rings[0].map(p => p[1])) >= 20.5) { slate.push(s); continue; }   // slices and rooftop plant rooms
    const ys = s.rings[0].map(p => p[1]), lo = Math.min(...ys), hi = Math.max(...ys);
    if (hi <= SPLIT + 1e-6) { low.push(s); continue; }
    if (lo >= SPLIT - 1e-6) { high.push(s); continue; }
    const a = clipY(s.rings[0], SPLIT, true), b = clipY(s.rings[0], SPLIT, false);
    if (a.length) low.push({type: s.type, rings: [a]});
    if (b.length) high.push({type: s.type, rings: [b]});
  }
  return [{surfaces: low, nativeRing: src.nativeRing}, {surfaces: high, nativeRing: src.nativeRing}, {surfaces: slate, nativeRing: src.nativeRing}];
}
/** Position of a wall's t = 0 along the front, and its distance in front (+) or behind (-) the front line. */
function onFront(w: RawWall) {
  const ox = w.f.origin[0] - R34[0], oz = w.f.origin[1] - R34[1];
  return {off: ox * FT[0] + oz * FT[1], depth: ox * FN[0] + oz * FN[1], aligned: w.f.n[0] * FN[0] + w.f.n[1] * FN[1] > 0.98};
}
const inTower = (t: number, pad = 0) => t > TOWER[0] - pad && t < TOWER[1] + pad;

/** A French window (white frame, glass, black balconette) or, on the top storey of the street faces, a dark balcony box. */
function french(b: BuildingTools, w: RawWall, t: number, y: number, h: number, box: boolean, WW = 2.4): boolean {
  const top = topOf(w, t), bot = bottomOf(w, t);
  if (!(y + h <= (Number.isFinite(top) ? top : w.top) - 0.25) || y < (Number.isFinite(bot) ? bot : w.base) + 0.2) return false;
  if (!claimOpening(w, t - WW / 2, t + WW / 2, y, y + h, 0.1)) return false;
  framed(b, w.f, t, y, WW, h, 'frame');
  if (box) slab(b, w.f, t, y - 0.25, WW + 0.9, 1.25, 0.95, 'bronze');
  else sheet(b, w.f, t, y, WW, 1.0, 'dark', 0.13);
  return true;
}
/** Flat sheet at an exact offset (no layer rounding). */
function sheet(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, colour: string, out: number) {
  put(b, f, new T.PlaneGeometry(w, h).translate(0, h / 2, 0), t, y, out, colour);
}
/** A window: a 5 cm frame plate rooted in the wall (sunk like every slab) with the glass 3.5 cm in front of it. */
function framed(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, frame: string, out = 0) {
  slab(b, f, t, y - 0.1, w + 0.2, h + 0.2, 0.05, frame, out);
  sheet(b, f, t, y, w, h, 'glass', out + 0.085);
}
function shop(b: BuildingTools, w: RawWall, t: number) {
  const top = Math.min(topOf(w, t - 1.9), topOf(w, t + 1.9)), bot = Math.max(bottomOf(w, t - 1.9), bottomOf(w, t + 1.9));
  if (!(3.9 <= top - 0.25) || 0.45 < bot + 0.2 || !claimOpening(w, t - 1.9, t + 1.9, 0.45, 3.9, 0.08)) return;
  framed(b, w.f, t, 0.45, 3.8, 3.45, 'dark');
}
/** A wall standing 0.1-3 m in front of `w`, parallel and overlapping most of it (3DBAG doubles some faces, e.g. wall 36 behind 34). */
function screened(w: RawWall, all: RawWall[]): boolean {
  const d = w.f.origin[0] * w.f.n[0] + w.f.origin[1] * w.f.n[1], u = w.f.origin[0] * w.f.tangent[0] + w.f.origin[1] * w.f.tangent[1];
  return all.some(o => {
    if (o === w || o.f.n[0] * w.f.n[0] + o.f.n[1] * w.f.n[1] < 0.98 || o.top < w.top - 2) return false;
    const od = o.f.origin[0] * w.f.n[0] + o.f.origin[1] * w.f.n[1] - d;
    if (od < 0.1 || od > 3) return false;
    const ou = o.f.origin[0] * w.f.tangent[0] + o.f.origin[1] * w.f.tangent[1];
    return Math.min(u + w.len, ou + o.len) - Math.max(u, ou) > 0.5 * w.len;
  });
}
function dressWall(b: BuildingTools, w: RawWall, all: RawWall[]) {
  if (screened(w, all)) return;
  const fr = onFront(w);
  if (fr.aligned && fr.depth > -2.5 && fr.depth < 0.5) return;            // the front is drawn by frontSkin()
  const [mx, mz] = centroid(src.surfaces[w.index].rings[0]);
  if (inSlice(mx, mz)) {                                                  // slate slice: two columns of paired windows, no shops
    if (w.len < 7) return;
    for (const t of [w.len / 2 - 2.45, w.len / 2 + 2.45]) for (const [k, y] of [1.0, ...SILLS.slice(1), 20.6].entries()) french(b, w, t, y, y > 20 ? 2.0 : k >= 3 ? WH_TOP : WH, false);
    return;
  }
  const c = centredColumns(w.len, 4.76, 2.0), cols = Array.from({length: c.n}, (_, k) => c.t0 + k * c.pitch);
  if (!cols.length) return;
  const street = w.bearing > 50 && w.bearing < 85;
  // ground floor: shopfronts in brick piers on the streets, French windows on the canal and courtyard
  if (w.base < 0.5) for (const t of cols) {
    if (street) shop(b, w, t);
    else french(b, w, t, 0.6, 2.8, false);
  }
  for (const [k, y] of SILLS.entries()) for (const t of cols) french(b, w, t, y, k >= 3 ? WH_TOP : WH, street && k === 4);
}

export function buildDeMakroon(_w: number, _d: number, b: BuildingTools & {mark?: (n: string) => void}) {
  const [low, high, slate] = splitShell();
  addShellTess(b, low, {wall: 'red', roof: 'concrete'});
  addShellTess(b, high, {wall: 'ochre', roof: 'concrete'});
  addShellTess(b, slate, {wall: 'slate', roof: 'concrete'});
  b.mark?.('shell');
  if (process.env.BIG_SHELL_ONLY) return;
  beginFacade(src);
  setSink(0.3, true);
  const walls: RawWall[] = [];
  src.surfaces.forEach((s, i) => {
    if (s.type !== 'WallSurface') return;
    const w = rawWall(src, i);
    if (!(w.len >= 2.8) || !Number.isFinite(w.f.n[0]) || w.top - w.base < 2.8) return;
    walls.push(w);
  });
  for (const w of walls) dressWall(b, w, walls);
  // stone bands on full-height walls
  for (const w of walls) {
    if (w.base > 0.5 || w.top < SPLIT + 1 || w.len < 3) continue;
    const fr = onFront(w);
    if (fr.aligned && fr.depth > -2.5 && fr.depth < 0.5) continue;
    const [mx, mz] = centroid(src.surfaces[w.index].rings[0]);
    if (inSlice(mx, mz)) continue;
    slab(b, w.f, w.len / 2, SPLIT - 0.3, w.len, 0.4, 0.22, 'stone');
    slab(b, w.f, w.len / 2, 4.15, w.len, 0.25, 0.12, 'stone');
    slab(b, w.f, w.len / 2, 7.75, w.len, 0.2, 0.1, 'stone');
  }
  frontSkin(b);
  entranceTower(b);
  setSink(0);
}

/**
 * The front on Nieuwe Passeerdersstraat. 3DBAG splits it into stepped, partly non-planar pieces (walls 126, 21, 329, 217, 331: set backs of
 * 1.5 m that the panorama does not show), so the front is a 0.3 m brick skin on the BAG ring line (red to the band, yellow above, coping
 * 0.15 m over the 21.3 m roof) carrying the measured columns.
 */
function frontSkin(b: BuildingTools) {
  const D = 0.3, TOP = 21.45;
  for (const [a, c] of [[0, TOWER[0]], [TOWER[1], FL]]) {
    slab(b, FRONT, (a + c) / 2, 0, c - a, SPLIT, D, 'red');
    slab(b, FRONT, (a + c) / 2, SPLIT, c - a, TOP - SPLIT, D, 'ochre');
    slab(b, FRONT, (a + c) / 2, SPLIT - 0.3, c - a - 0.1, 0.4, 0.22, 'stone', D);
    slab(b, FRONT, (a + c) / 2, 4.15, c - a - 0.1, 0.25, 0.12, 'stone', D);
    slab(b, FRONT, (a + c) / 2, 7.75, c - a - 0.1, 0.2, 0.1, 'stone', D);
  }
  for (const t of FRONT_COLS) {
    framed(b, FRONT, t, 0.45, 3.3, 3.45, 'dark', D);                                                     // shopfront
    for (const [k, y] of SILLS.entries()) {
      framed(b, FRONT, t, y, WW, k >= 3 ? WH_TOP : WH, 'frame', D);
      if (k === 4) slab(b, FRONT, t, y - 0.25, WW + 0.9, 1.25, 0.95, 'bronze', D);                       // top-storey balcony box
      else sheet(b, FRONT, t, y, WW, 1.0, 'dark', D + 0.13);                                              // balconette
    }
  }
}

/** Slate-shingle entrance tower on Nieuwe Passeerdersstraat with the canopy and "de MAKROON" (w01-155). */
function entranceTower(b: BuildingTools) {
  const tw = TOWER[1] - TOWER[0], tc = (TOWER[0] + TOWER[1]) / 2;
  slab(b, FRONT, tc, 0, tw, TOWER_TOP, TOWER_PROUD + 2.4, 'slate', -2.4);
  const F: Frame = {origin: [FRONT.origin[0] + FN[0] * TOWER_PROUD, FRONT.origin[1] + FN[1] * TOWER_PROUD], tangent: FT, n: FN};
  // two columns of paired French windows, five storeys plus the top
  for (const t of [tc - 2.45, tc + 2.45]) for (const [k, y] of [...SILLS.slice(1), 21.2].entries()) {
    const h = k >= 2 ? (y > 21 ? 1.9 : WH_TOP) : WH;
    framed(b, F, t, y, WW, h, 'frame');
    sheet(b, F, t, y, WW, 1.0, 'dark', 0.13);                    // balconette
  }
  // glazed entrance hall under the canopy
  framed(b, F, tc, 0.4, 10.0, 3.6, 'dark');
  // slate collar at the band
  slab(b, F, tc, 14.3, tw + 0.6, 0.7, 0.35, 'slate');
  // metal canopy (t 36-50.7) and the lettering standing on it
  slab(b, FRONT, 43.35, 4.25, 14.7, 1.5, 3.2, 'stone', TOWER_PROUD - 0.2);
  const txt = raisedLettering({text: 'de MAKROON', heightM: 0.95, maxWidthM: 8.5, depthM: 0.06});
  const L: Frame = {origin: [FRONT.origin[0] + FN[0] * (TOWER_PROUD + 1.8), FRONT.origin[1] + FN[1] * (TOWER_PROUD + 1.8)], tangent: FT, n: FN};
  put(b, L, txt.geometry, 43.35 - txt.widthM / 2, 5.75, 0, 'bronze');
}
