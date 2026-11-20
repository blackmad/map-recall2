import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archSlab, facePanel, getSink, ledgeStrip, letters, poly, put, ringFrame, sashWindows, segBand, setSink, slab, type Frame} from './nearbar-kit';
import {frameCoords, reshapeShell} from './shell-gable-fit';
import source from './kadijksplein-17-18-footprints.json';

/**
 * FORMER ZEEMANSHUIS, Kadijksplein 17-18 (A.N. Godefroy 1856-1858; closed square plan, the extra storey under a flat roof
 * and the taller south-east corner tower by H.A.J. Baanders 1915-1923; gemeentelijk monument 202016, register text in
 * scripts/landmarks/kadijksplein-17-18-inventory.json sources). BAG pand 0363100012164985 (BAG year 1856).
 *
 * Massing: the 3DBAG LoD2.2 shell (kadijksplein-17-18-footprints.json, bag-shell-prepare.ts), its scan-noisy flat tops
 * snapped to one line each (reshapeShell `snap`): the central blocks at 18.3 m, the three 1856 corner towers at 19.4 m (3DBAG 18.3-18.6 and 19.0-19.2; the 2024 front panorama reads a 1.1 m step),
 * and Baanders' south-east tower at 21.4 m (the 3DBAG draws it at 24.2 m, the roof of the glazed penthouse set back on
 * it; the penthouse is drawn on top).
 *
 * Fronts read from rectified Gemeente Amsterdam panoramas (CC BY 4.0, 50 px/m): Kadijksplein (NW) b_20241210_1246_Track15_
 * Sphere_00047 (2024) and TMX7316010203-001181_pano_0000_001188 (2019); harbour side (NE) recording_2025-06-19_08-30-47_00263
 * and b_20241210_1246_Track08_Sphere_00082; Hoogte Kadijk (SW) b_20241210_1246_Track08_Sphere_00059. One storey grid all
 * round, as the register says: hardstone basement with cellar lights, a low ground floor, a tall first floor, two low
 * "mezzanine" storeys, hardstone water courses over the ground and first floors; dark purple-brown brick, white frames.
 * - Kadijksplein front: nine axes between the corner towers, the first-floor windows under segmental heads; each tower has
 *   its entrance in a sandstone surround, a balcony on stone consoles under a white timber surround with two tall
 *   balcony doors, three windows, a name board (ZEEMANS-HUIS left, ANNO 1856 right) and five round-arched windows.
 * - Side fronts: 15 axes (NE) and 14 axes (SW) of plain rectangular windows between towers with three axes and the
 *   five arched windows on top.
 * - The south-east tower on the harbour side: the brick double portico of three round arches on a raised grey plinth, the
 *   door and two arched windows in its loggia, a grey concrete cap band and the glazed penthouse.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
type Col = string;

// storey grid (metres above the 3DBAG ground), read off the w03/w01 crops against the 3DBAG eaves
const GF = {y: 1.2, h: 2.55};
const FF = {y: 5.55, h: 3.6};
const M1 = {y: 11.45, h: 1.8};
const M2 = {y: 15.0, h: 1.75};
const TOWER_ARCH = {y: 15.3, h: 2.6, w: 0.9};
const CENTRAL_TOP = 18.3, TOWER_TOP = 19.4, SE_TOP = 21.4;

/** Segment-headed window: rectangle of height h with a segmental top of rise `rise` (white frame, glass, bars). */
function segWindow(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, rise: number) {
  const shape = (W: number, H: number, R: number): [number, number][] => {
    const rad = (W * W / 4 + R * R) / (2 * R), pts: [number, number][] = [[-W / 2, 0], [W / 2, 0]];
    for (let i = 0; i <= 10; i++) { const x = W / 2 - W * i / 10; pts.push([x, H + R - rad + Math.sqrt(rad * rad - x * x)]); }
    return pts;
  };
  poly(b, f, t, y - 0.06, shape(w + 0.2, h + 0.06, rise), 0.07, 'frame');
  poly(b, f, t, y, shape(w, h, rise), 0.12, 'glass');
  facePanel(b, f, t, y, 0.05, h + rise, 'frame', 0.17);
  for (const k of [0.33, 0.62, 0.8]) facePanel(b, f, t, y + h * k, w, 0.05, 'frame', 0.17);
  ledgeStrip(b, f, t, y - 0.17, w + 0.3, 0.1, 0.2, 'stone');
  segBand(b, f, t, y + h + 0.02, w + 0.4, rise + 0.04, 0.22, 0.05, 'brick');
}

/** Round-arched window (the tower tops): frame, glass, a mullion and two bars, a stone sill. */
function arched(b: BuildingTools, f: Frame, ts: number[]) {
  const {y, h, w} = TOWER_ARCH;
  for (const t of ts) {
    archSlab(b, f, t, y - 0.05, w + 0.18, h + 0.12, 0.07, 'frame', 0, 6);
    archSlab(b, f, t, y, w, h, 0.12, 'glass', 0, 6);
    facePanel(b, f, t, y, 0.05, h - w / 2, 'frame', 0.17);
    for (const k of [0.36, 0.72]) facePanel(b, f, t, y + (h - w / 2) * k, w, 0.05, 'frame', 0.17);
    ledgeStrip(b, f, t, y - 0.16, w + 0.25, 0.1, 0.2, 'stone');
  }
}

const sash = (b: BuildingTools, f: Frame, ts: number[], y: number, h: number, w: number, rows = 3) =>
  sashWindows(b, f, ts, {lean: true, y, h, w, cols: 2, rows, frame: 'frame', glass: 'glass', sill: 'stone'});

/** Hardstone courses and coping along a run [t0, t1] of a front. */
function courses(b: BuildingTools, f: Frame, t0: number, t1: number, top: number, plinth = 0.55, coping = true) {
  const mid = (t0 + t1) / 2, w = t1 - t0 - 0.1;
  slab(b, f, mid, 0, w, plinth, 0.08, 'stone');
  slab(b, f, mid, 4.42, w, 0.2, 0.12, 'stone');
  slab(b, f, mid, 10.3, w, 0.2, 0.12, 'stone');
  if (coping) slab(b, f, mid, top - 0.25, w - 0.04, 0.3, 0.1, 'stone');
}

/** One central block: cellar lights, ground, first (rectangular or segment-headed) and two mezzanine storeys per axis. */
function central(b: BuildingTools, f: Frame, axes: number[], t0: number, t1: number, o: {firstW: number; seg?: boolean; mezzW: number}) {
  courses(b, f, t0, t1, CENTRAL_TOP);
  for (const t of axes) slab(b, f, t, 0.3, 0.9, 0.45, 0.14, 'dark');
  sash(b, f, axes, GF.y, GF.h, 1.25);
  if (o.seg) for (const t of axes) segWindow(b, f, t, FF.y, o.firstW, FF.h - 0.18, 0.18);
  else sash(b, f, axes, FF.y, FF.h, o.firstW, 4);
  sash(b, f, axes, M1.y, M1.h, o.mezzW, 2);
  sash(b, f, axes, M2.y, M2.h, o.mezzW, 2);
}

/** A tower face of length L: tower window set (`ground` false where the entrance or the portico takes the ground floor). */
function towerFace(b: BuildingTools, f: Frame, L: number, top: number, o: {t0?: number; ground?: boolean; first?: boolean; cornice?: boolean} = {}) {
  const t0 = o.t0 ?? 0, s = L / 7.8, three = [1.3, 3.9, 6.5].map(t => t0 + t * s), five = [1.3, 2.6, 3.9, 5.2, 6.5].map(t => t0 + t * s);
  courses(b, f, t0, t0 + L, top, 0.55, o.cornice !== false);
  // stone band at the arch springing, between the arched windows
  const half = (TOWER_ARCH.w + 0.18) / 2, edges = [t0 + 0.05, ...five.flatMap(t => [t - half, t + half]), t0 + L - 0.05];
  for (let k = 0; k + 1 < edges.length; k += 2) if (edges[k + 1] - edges[k] > 0.05) ledgeStrip(b, f, (edges[k] + edges[k + 1]) / 2, 17.35, edges[k + 1] - edges[k], 0.14, 0.1, 'stone');
  if (o.cornice !== false) slab(b, f, t0 + L / 2, top - 0.75, L + 0.05, 0.25, 0.22, 'stone');
  if (o.ground !== false) { sash(b, f, three, GF.y, GF.h, 1.2); for (const t of three) slab(b, f, t, 0.3, 0.9, 0.45, 0.14, 'dark'); }
  if (o.first !== false) sash(b, f, three, FF.y, FF.h, 1.3, 4);
  sash(b, f, three, M1.y + 0.1, M1.h - 0.05, 0.85, 2);
  arched(b, f, five);
}

/** Kadijksplein tower front: entrance, balcony, white timber surround, name board. */
function entranceTower(b: BuildingTools, f: Frame, L: number, board: string) {
  const c = L / 2;
  towerFace(b, f, L, TOWER_TOP, {ground: false, first: false});
  // sandstone surround, double door with a fanlight and a circular glazing pattern, step
  slab(b, f, c, 0, 4.0, 4.5, 0.16, 'sandstone');
  slab(b, f, c, 0.15, 1.75, 2.9, 0.2, 'red');
  facePanel(b, f, c, 0.15, 0.05, 2.88, 'dark', 0.235);
  slab(b, f, c, 3.12, 1.75, 0.88, 0.2, 'glass');
  for (const t of [c - 0.95, c + 0.95]) slab(b, f, t, 0.15, 0.15, 3.95, 0.25, 'frame');
  slab(b, f, c, 3.97, 2.05, 0.14, 0.25, 'frame');
  slab(b, f, c, 3.04, 1.75, 0.08, 0.25, 'frame');
  const ring = new T.RingGeometry(0.26, 0.32, 16);
  put(b, f, ring.translate(0, 0, 0.27), c, 3.56, 0, 'frame');
  slab(b, f, c, 0, 2.3, 0.15, 0.55, 'stone');
  sash(b, f, [c - 2.9 * L / 7.8, c + 2.9 * L / 7.8], 1.3, 1.7, 0.6, 2);
  // balcony on stone consoles, white timber balustrade
  for (const t of [c - 2.0, c, c + 2.0]) slab(b, f, t, 4.0, 0.3, 0.55, 0.9, 'sandstone');
  slab(b, f, c, 4.55, 4.7, 0.25, 1.05, 'white');
  slab(b, f, c, 4.8, 4.7, 0.12, 0.1, 'white', 0.92);
  slab(b, f, c, 5.6, 4.7, 0.1, 0.12, 'white', 0.9);
  for (let i = 0; i <= 14; i++) slab(b, f, c - 2.25 + i * 4.5 / 14, 4.92, 0.07, 0.68, 0.07, 'white', 0.94);
  // white timber surround: posts, centre column, two tall balcony doors with transoms, frieze and water course
  for (const t of [c - 2.0, c + 2.0]) slab(b, f, t, 4.8, 0.32, 5.1, 0.16, 'white');
  slab(b, f, c, 4.8, 0.3, 4.55, 0.2, 'white');
  for (const t of [c - 1.0, c + 1.0]) {
    slab(b, f, t, 4.82, 1.55, 4.4, 0.07, 'frame');
    facePanel(b, f, t, 4.88, 1.4, 4.25, 'glass', 0.12);
    facePanel(b, f, t, 8.1, 1.4, 0.07, 'frame', 0.17);
    facePanel(b, f, t, 4.88, 0.05, 4.25, 'frame', 0.17);
  }
  slab(b, f, c, 9.35, 4.6, 0.55, 0.18, 'white');
  slab(b, f, c, 9.9, 4.9, 0.18, 0.36, 'white');
  // name board with gilt letters under the arched windows
  slab(b, f, c, 14.12, 4.5, 0.62, 0.08, 'dark');
  letters(b, f, board, c, 14.2, 0.08, board.length > 10 ? 0.055 : 0.062, 0.03, 'gold', 0.064);
}

/** Baanders' brick double portico: three round arches on a raised grey plinth, door and two arched windows in the loggia. */
function portico(b: BuildingTools, f: Frame, t0: number, L: number) {
  const c = t0 + L / 2, depth = 2.0, base = 1.8, spring = 4.1, top = 5.9;
  slab(b, f, c, 0, L + 0.2, base, depth + 0.1, 'concrete');
  // arcade front with three arches (one extruded outline with arched holes)
  const s = new T.Shape([[-L / 2, -0.15], [L / 2, -0.15], [L / 2, top - base], [-L / 2, top - base]].map(([x, y]) => new T.Vector2(x, y)));
  const span = (L - 4 * 0.5) / 3;
  for (let k = 0; k < 3; k++) {
    const x0 = -L / 2 + 0.5 + k * (span + 0.5), r = span / 2, h = new T.Path();
    h.moveTo(x0, -0.1); h.lineTo(x0, spring - base); h.absarc(x0 + r, spring - base, r, Math.PI, 0, true); h.lineTo(x0 + span, -0.1); h.lineTo(x0, -0.1);
    s.holes.push(h);
  }
  put(b, f, new T.ExtrudeGeometry(s, {depth: 0.45, bevelEnabled: false, curveSegments: 8}), c, base, depth - 0.45, 'brick');
  // side walls (solid brick, the photo shows a side arch only in shadow) and the loggia ceiling
  for (const t of [t0 + 0.25, t0 + L - 0.25]) slab(b, f, t, base - 0.15, 0.5, top - base + 0.15, depth - 0.45, 'brick');
  slab(b, f, c, 5.0, L - 1.0, top - 5.0, depth - 0.45, 'brick');
  slab(b, f, c, top - 0.15, L + 0.12, 0.25, depth + 0.1, 'stone');
  // in the loggia: the door under an arched fanlight and two arched windows
  slab(b, f, c, base, 1.4, 2.1, 0.18, 'red');
  archSlab(b, f, c, base + 2.1, 1.4, 1.0, 0.16, 'glass', 0, 6);
  for (const t of [c - 2.0, c + 2.0]) { archSlab(b, f, t, base + 0.45, 1.1, 1.95, 0.08, 'frame', 0, 6); archSlab(b, f, t, base + 0.5, 0.95, 1.85, 0.13, 'glass', 0, 6); }
}

/** Area railing in front of a run: two rails and posts on a 1.2 m pitch, `out` metres off the wall. */
function railing(b: BuildingTools, f: Frame, t0: number, t1: number, out = 1.1) {
  const mid = (t0 + t1) / 2, w = t1 - t0;
  slab(b, f, mid, 1.0, w, 0.04, 0.04, 'bronze', out);
  for (let t = t0; t <= t1 + 1e-6; t += w / Math.round(w / 1.2)) slab(b, f, t, 0, 0.035, 1.1, 0.035, 'bronze', out);
}

export function buildKadijksplein1718(_w: number, _d: number, b: BuildingTools) {
  const raw = source as unknown as Src;
  const ring = raw.facadeRing;
  const se = ringFrame(ring, 0).f;
  // the south-east tower: the 3DBAG's 24.2 m penthouse roof covers the tower; its extent in the harbour-front frame
  const pent = raw.surfaces.find(s => s.type === 'RoofSurface' && s.rings[0].every(p => p[1] > 23.5))!;
  const pc = pent.rings[0].map(p => frameCoords(se, p[0], p[2]));
  const inSE = (x: number, z: number) => { const {t, d} = frameCoords(se, x, z); return t > Math.min(...pc.map(p => p.t)) - 0.5 && t < Math.max(...pc.map(p => p.t)) + 0.5 && d > -0.5 && d < Math.max(...pc.map(p => p.d)) + 0.5; };
  const surfaces = reshapeShell(raw.surfaces, {snap: [
    {inside: inSE, lo: 23.5, hi: 25.0, to: SE_TOP},
    // the stair houses at the inner corners behind the north and west towers (3DBAG 21.4-21.6 m; the 8 cm orthophoto shows
    // them, no street panorama does): drawn at the tower line, so the gallery skyline is the photographed one
    {inside: () => true, lo: 21.3, hi: 21.7, to: TOWER_TOP},
    {inside: () => true, lo: 18.9, hi: 19.35, to: TOWER_TOP},
    {inside: () => true, lo: 18.2, hi: 18.75, to: CENTRAL_TOP},
  ]});
  addShell(b, {...raw, surfaces} as never, {wall: 'brick', roof: 'slate'});
  const sink0 = getSink();
  setSink(0.12, true);

  // Harbour side (NE, ring edge 0, 43.5 m): Baanders' tower over t 0-7.8, then 15 axes; the 1856 north tower (edge 2)
  {
    const {f, len} = ringFrame(ring, 0);
    towerFace(b, f, 7.8, SE_TOP, {ground: false, cornice: false});
    portico(b, f, 0.14, 7.56);
    const axes = Array.from({length: 15}, (_, k) => 8.95 + k * (len - 7.8 - 2.3) / 14);
    central(b, f, axes, 7.8, len, {firstW: 1.35, mezzW: 1.4});
    const n = ringFrame(ring, 2);
    towerFace(b, n.f, n.len, TOWER_TOP);
  }
  // Kadijksplein front (NW): towers on edges 3 and 7, nine axes on edge 5
  {
    const l = ringFrame(ring, 3), r = ringFrame(ring, 7), m = ringFrame(ring, 5);
    entranceTower(b, l.f, l.len, 'ZEEMANS-HUIS');
    entranceTower(b, r.f, r.len, 'ANNO 1856');
    const axes = Array.from({length: 9}, (_, k) => 1.12 + k * (m.len - 2.24) / 8);
    central(b, m.f, axes, 0, m.len, {firstW: 1.6, seg: true, mezzW: 1.65});
    railing(b, m.f, 0.3, m.len - 0.3);
  }
  // Hoogte Kadijk (SW): west tower (edge 8), 14 axes (edge 10), south tower (edge 12); the south tower's back (edge 13, inferred)
  {
    for (const e of [8, 12, 13]) { const {f, len} = ringFrame(ring, e); towerFace(b, f, len, TOWER_TOP); }
    const {f, len} = ringFrame(ring, 10);
    const axes = Array.from({length: 14}, (_, k) => 1.22 + k * (len - 2.44) / 13);
    central(b, f, axes, 0, len, {firstW: 1.4, mezzW: 1.4});
    railing(b, f, 0.3, len - 0.3);
  }
  // the south-east tower's grey concrete cap band, round every face of the tower that stands above the 18.3 m roofs
  {
    const tr = pent.rings[0].map(p => [p[0], p[2]]);
    if (tr.length > 3 && tr[0][0] === tr.at(-1)![0] && tr[0][1] === tr.at(-1)![1]) tr.pop();
    tr.forEach((_, i) => { const {f, len} = ringFrame(tr, i); if (len > 0.6) slab(b, f, len / 2, 20.3, len + 0.1, SE_TOP - 20.25, 0.1, 'concrete'); });
  }
  // the glazed penthouse on it, set back 0.9 m from the front and sides, over the tower's rectangular front part
  {
    const t0 = 0.9, t1 = 6.2, d0 = 0.9, d1 = 6.0, tm = (t0 + t1) / 2, w = t1 - t0;
    setSink(0);
    slab(b, se, tm, SE_TOP - 0.1, w, 2.1, d1 - d0, 'concrete', -d1);
    setSink(0.12, true);
    // glazed all round: a pane per bay on each face, with concrete mullions
    const at = (t: number, d: number) => [se.origin[0] + se.tangent[0] * t - se.n[0] * d, se.origin[1] + se.tangent[1] * t - se.n[1] * d];
    const box = [at(t0, d0), at(t1, d0), at(t1, d1), at(t0, d1)];
    box.forEach((_, i) => {
      const {f, len} = ringFrame(box, i), bays = Math.max(1, Math.round(len / 1.8));
      for (let k = 0; k < bays; k++) slab(b, f, (k + 0.5) * len / bays, SE_TOP + 0.15, len / bays - 0.16, 1.7, 0.05, 'glass');
    });
    slab(b, se, tm, SE_TOP + 2.0, w + 0.8, 0.3, d1 - d0 + 0.8, 'concrete', -d1 - 0.4);
    slab(b, se, tm, SE_TOP + 3.15, w + 0.8, 0.05, 0.05, 'concrete', -d0 + 0.3);
    for (let k = 0; k <= 4; k++) slab(b, se, t0 - 0.35 + k * (w + 0.7) / 4, SE_TOP + 2.3, 0.05, 0.85, 0.05, 'concrete', -d0 + 0.3);
  }
  setSink(sink0);
}
