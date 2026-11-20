import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {archBand, archSlab, facePanel, getSink, leanSlab, ledgeStrip, letters, ringFrame, roofHeightAt, setSink, slab, type Frame} from './nearbar-kit';
import {frameCoords} from './shell-gable-fit';
import source from './technische-school-meeuwenlaan-footprints.json';

/**
 * VIJFDE TECHNISCHE SCHOOL, Meeuwenlaan 132, Amsterdam-Noord (C.B. Posthumus Meyjes jr. and L. van der Linden, 1931-1935,
 * for the Vereeniging voor den Werkenden Stand; extended 1998-2001 by B. Mastenbroek and D. van Gameren for the Bredero
 * College, re-clad in stripes about 2024). Gemeentelijk monument 200704; BAG pand 0363100012101771 (BAG year 1936).
 *
 * Massing: the 3DBAG LoD2.2 shell (technische-school-meeuwenlaan-footprints.json, bag-shell-prepare.ts): the U of hipped
 * smoked-tile wings in yellow brick (three storeys on the Meeuwenlaan, two along the plantsoen and at the back), the stair
 * tower with its saddle roof (ridge 27.5 m), the gabled risaliet of the former main entrance, the one-storey auto
 * workshop, and the flat-roofed 2001 wing with the roof playground. Fronts read from rectified Gemeente Amsterdam
 * panoramas (CC BY 4.0), per wall in technische-school-meeuwenlaan-inventory.json: recording_2024-10-22_10-41-53_00306
 * (plantsoen, 30 px/m), recording_2025-09-22_10-53-43_00033 and TMX7316010203-002572_pano_0000_002738 (Meeuwenlaan, 45 px/m),
 * recording_2024-10-22_10-41-53_00314 and _00344 (risaliet, east end), recording_2025-09-22_10-53-43_00030 (tower),
 * recording_2024-09-10_07-51-45_00148 and recording_2025-09-22_10-53-43_00778 (2001 wing). t is metres along a ring edge
 * from the viewer's left, heights above the 3DBAG ground.
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
type Col = string;
const raw = source as unknown as Src;
/**
 * The 3DBAG draws the tower roof over the BAG ring's 1.1 m step between the tower's west face and the Meeuwenlaan front
 * (x -17.8..-16.6, z -39.9..-39.1): a 24 m sliver standing proud of the tower on the 2019 and 2022 views of a flat face.
 * Its tops come down to the wing's 13.3 m eaves.
 */
const src: Src = {...raw, surfaces: raw.surfaces.map(s => ({...s, rings: s.rings.map(r => r.map(p => (p[0] < -16.65 && p[2] > -40.2 && p[2] < -38.9 && p[1] > 13.6 ? [p[0], 13.3, p[2]] : p)))}))};
const ring = src.facadeRing;
/**
 * Ring edge frame moved out onto the 3DBAG wall where the shell stands proud of the facade ring (the 2001 wing's
 * Meeuwenlaan wall leans 0.13 m out of the BAG chord at its north end; a pane on the chord would sit behind it).
 */
const E = (i: number) => {
  const {f, len} = ringFrame(ring, i);
  let out = 0;
  for (const s of src.surfaces) {
    if (s.type !== 'WallSurface') continue;
    for (const p of s.rings[0]) {
      const {t, d} = frameCoords(f, p[0], p[2]);
      if (t > 0.3 && t < len - 0.3 && d < 0 && d > -0.35) out = Math.max(out, -d);
    }
  }
  return {f: out > 0.005 ? {...f, origin: [f.origin[0] + f.n[0] * out, f.origin[1] + f.n[1] * out] as [number, number]} : f, len};
};
/** The frame moved `d` metres into the building (a face set back behind the ring line: dormer fronts). */
const back = (f: Frame, d: number): Frame => ({...f, origin: [f.origin[0] - f.n[0] * d, f.origin[1] - f.n[1] * d]});
/** Native (x, z) of a point t along and d behind a frame. */
const at = (f: Frame, t: number, d: number): [number, number] => [f.origin[0] + f.tangent[0] * t - f.n[0] * d, f.origin[1] + f.tangent[1] * t - f.n[1] * d];
const roofY = (x: number, z: number, fallback: number) => roofHeightAt(src.surfaces, x, z) ?? fallback;

/** Deterministic pseudo-random sequence (stripe widths and colours repeat from build to build). */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

/**
 * Classroom window (register: three lower lights and three multi-pane top lights, the side ones narrow turning or hopper
 * sashes): white frame, glass, mullions, a transom at 62 % and a 3 x 2 bar grid in every top light, tile sill.
 * `lights` 1 for the narrow end windows; `multi` false for the single-pane infill on the schoolplein side.
 */
function classWin(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number, o: {lights?: number; multi?: boolean; sill?: boolean; out?: number} = {}) {
  const z = o.out ?? 0, lights = o.lights ?? (w > 2.4 ? 3 : 1), ty = y + h * 0.62;
  leanSlab(b, f, t, y - 0.07, w + 0.2, h + 0.14, 0.07, 'frame', z);
  facePanel(b, f, t, y, w, h, 'glass', 0.12 + z);
  facePanel(b, f, t, ty - 0.04, w, 0.08, 'frame', 0.17 + z);
  for (let k = 1; k < lights; k++) facePanel(b, f, t - w / 2 + w * k / lights, y, 0.08, h, 'frame', 0.17 + z);
  if (o.multi !== false) {
    const lw = w / lights, top = y + h - ty - 0.04;
    for (let k = 0; k < lights; k++) {
      const c = t - w / 2 + lw * (k + 0.5), cols = lights === 1 ? 3 : 3;
      for (let j = 1; j < cols; j++) facePanel(b, f, c - lw / 2 + lw * j / cols, ty + 0.04, 0.035, top, 'frame', 0.17 + z);
      facePanel(b, f, c, ty + 0.04 + top / 2 - 0.018, lw, 0.035, 'frame', 0.17 + z);
    }
  } else if (lights === 1) facePanel(b, f, t, y, 0.06, h, 'frame', 0.17 + z);
  if (o.sill !== false) ledgeStrip(b, f, t, y - 0.17, w + 0.3, 0.1, 0.16, 'stone');
}

/** Tall stair window of the tower: frame, glass, a mullion and horizontal bars about every 0.6 m. */
function tallWin(b: BuildingTools, f: Frame, t: number, y: number, w: number, h: number) {
  slab(b, f, t, y - 0.07, w + 0.16, h + 0.14, 0.05, 'frame');
  // the pane in two sheets (each under the 30 m open-outline limit), split under a bar; bars 3 cm proud of the pane
  const n = Math.round(h / 0.6), half = Math.floor(n / 2) * h / n;
  facePanel(b, f, t, y, w, half - 0.01, 'glass', 0.085);
  facePanel(b, f, t, y + half + 0.01, w, h - half - 0.01, 'glass', 0.085);
  facePanel(b, f, t, y, 0.05, h, 'frame', 0.125);
  for (let k = 1; k < n; k++) facePanel(b, f, t, y + h * k / n - 0.02, w, 0.04, 'frame', 0.125);
  ledgeStrip(b, f, t, y - 0.17, w + 0.25, 0.1, 0.16, 'stone');
}

/** Dark brick plinth along a run of a wall. */
const plinth = (b: BuildingTools, f: Frame, t0: number, t1: number, h = 0.95) => slab(b, f, (t0 + t1) / 2, 0, t1 - t0, h, 0.04, 'greyBrick');

/**
 * Wide boxed eaves (register: breed overstekende houten bakgoten): a pale gutter box 0.7 m out along every low, level edge
 * of every sloped 3DBAG roof plane, running 0.55 m past both ends so hips close and the gutters poke through at the gable
 * feet (the doorgestoken goten of the risaliet).
 */
function eaves(b: BuildingTools) {
  for (const s of src.surfaces) {
    if (s.type !== 'RoofSurface') continue;
    const r = s.rings[0].slice(0, s.rings[0].length - (s.rings[0][0].every((v, i) => v === s.rings[0].at(-1)![i]) ? 1 : 0));
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); ny += (a[2] - c[2]) * (a[0] + c[0]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
    const L = Math.hypot(nx, ny, nz); if (L < 1e-9) continue;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    if (ny / L > 0.95) continue; // flat roofs have no eaves box
    const hn = Math.hypot(nx, nz), out: [number, number] = [nx / hn, nz / hn];
    const minY = Math.min(...r.map(p => p[1]));
    if (minY < 2.0) continue;
    for (let i = 0; i < r.length; i++) {
      const a = r[i], c = r[(i + 1) % r.length], len = Math.hypot(c[0] - a[0], c[2] - a[2]);
      if (len < 1.2 || Math.abs(a[1] - minY) > 0.25 || Math.abs(c[1] - minY) > 0.25) continue;
      const tg: [number, number] = [(c[0] - a[0]) / len, (c[2] - a[2]) / len];
      // only edges square to the downslope direction are eaves (a hip line also touches minY at one end)
      if (Math.abs(tg[0] * out[0] + tg[1] * out[1]) > 0.2) continue;
      const f: Frame = {origin: [a[0], a[2]], tangent: tg, n: out};
      const y = (a[1] + c[1]) / 2;
      slab(b, f, len / 2, y - 0.3, len + 1.1, 0.36, 0.75, 'concrete', -0.05);
    }
  }
}

/** Flat-roofed dormer set into the slope behind a wall: pale cheeks and roof, a two-light window. */
function dormer(b: BuildingTools, f: Frame, t: number, w: number, eaveY: number, d0 = 1.1, faceH = 1.45) {
  const [x0, z0] = at(f, t, d0), yr = roofY(x0, z0, eaveY + 0.8), top = yr + faceH;
  let d1 = d0 + 0.5;
  while (d1 < d0 + 6 && roofY(...at(f, t, d1), top + 1) < top + 0.15) d1 += 0.25;
  slab(b, f, t, eaveY + 0.1, w, top - eaveY - 0.1, d1 - d0, 'concrete', -d1);
  slab(b, f, t, top, w + 0.3, 0.14, d1 - d0 + 0.3, 'concrete', -d1);
  classWin(b, back(f, d0), t, yr + 0.18, w - 0.55, faceH - 0.38, {lights: 2, sill: false, out: 0.04});
}

/** A flat quad 4 cm over the roof slope: t0..t1 along the frame, d0..d1 behind the wall line (roof lights, glazed strips). */
function roofQuad(b: BuildingTools, f: Frame, t0: number, t1: number, d0: number, d1: number, colour: Col) {
  const pts = [[t0, d0], [t1, d0], [t1, d1], [t0, d1]].map(([t, d]) => { const [x, z] = at(f, t, d); return [x, roofY(x, z, 0) + 0.12, z]; });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pts.flat(), 3));
  const A = new T.Vector3(...pts[0]), B = new T.Vector3(...pts[1]), C = new T.Vector3(...pts[2]);
  const up = B.sub(A).cross(C.sub(A)).y > 0;
  g.setIndex(up ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  b.add(g, colour as never);
}

// ------------------------------------------------------------------ 1931-1935 wings
/** Two-storey wings (plantsoen front, east end): storey windows, from the 2024 crops. */
const ROWS2: [number, number][] = [[1.25, 2.8], [5.9, 2.8]];
/** Three-storey Meeuwenlaan wing (w05-280, 45 px/m). */
const ROWS3: [number, number][] = [[1.2, 2.8], [5.45, 2.85], [9.65, 2.75]];

function plantsoenFront(b: BuildingTools) {
  // edge 0, 68.2 m, t from the east end: 17 axes measured on the 2024 crop (30.2 px/m), narrow ends, 15 wide
  const {f, len} = E(0);
  plinth(b, f, 0.1, len - 0.1);
  const axes = [2.9, ...Array.from({length: 15}, (_, k) => 6.15 + k * 3.98), 65.3];
  for (const [y, h] of ROWS2) axes.forEach((t, k) => classWin(b, f, t, y, k === 0 || k === 16 ? 1.8 : 3.2, h));
  for (const t of [7.3, 15.3, 23.0, 30.5, 38.2, 45.8, 53.3, 60.8]) dormer(b, f, t, 2.4, 9.6);
}

function meeuwenlaanFront(b: BuildingTools) {
  // edges 7 (16.4 m) and 8 (14.5 m), t from the north: eight axes measured on w05-280
  const e7 = E(7), e8 = E(8);
  plinth(b, e7.f, 0.05, e7.len); plinth(b, e8.f, 0, e8.len - 0.1);
  const put = (m: number) => (m < e7.len ? {f: e7.f, t: m} : {f: e8.f, t: m - e7.len});
  const axes = [3.15, 6.44, 10.44, 14.4, 18.36, 22.3, 26.3, 29.6];
  for (const [y, h] of ROWS3) axes.forEach((m, k) => { const p = put(m); classWin(b, p.f, p.t, y, k === 0 || k === 7 ? 1.8 : 3.3, h); });
  for (const m of [3.1, 6.9, 10.8, 14.5, 18.3, 22.0, 25.8]) { const p = put(m); roofQuad(b, p.f, p.t - 0.35, p.t + 0.35, 1.2, 1.75, 'canopyGlass'); }
}

function eastEnd(b: BuildingTools) {
  // edge 38, 24.2 m, t from the south: five wide axes and a narrow one (w07-93), the continuous dormer band in the roof
  const {f, len} = E(38);
  plinth(b, f, 0.05, len - 0.05);
  const axes = [1.9, 5.9, 9.9, 13.9, 17.8, 20.9];
  for (const [y, h] of ROWS2) axes.forEach((t, k) => classWin(b, f, t, y, k === 5 ? 1.2 : 3.25, h));
  // the dormer band is in the 3DBAG shell (a flat strip at 11.9 m flush with the wall): its pale timber front and nine windows
  slab(b, f, 10.05, 9.8, 19.5, 2.05, 0.04, 'concrete');
  for (let k = 0; k < 9; k++) classWin(b, f, 1.3 + k * 2.15, 10.1, 1.6, 1.45, {lights: 2, sill: false, out: 0.04});
}

/** Courtyard side of the north wing (edge 33, inferred): plain two-storey rows (register: new single-pane infill). */
function courtyardSide(b: BuildingTools) {
  const {f, len} = E(33);
  plinth(b, f, 0.1, len - 0.1);
  for (const [y, h] of ROWS2) for (let t = 3.0; t < len - 2; t += 3.98) classWin(b, f, t, y, 3.0, h, {multi: false});
}

/** The former main entrance: risaliet front (edge 2), its west side (edge 3) and the tower's west face (edge 5). */
function entrance(b: BuildingTools) {
  {
    const {f, len} = E(2), c = len / 2;
    plinth(b, f, 0.05, c - 2.35); plinth(b, f, c + 2.35, len - 0.05);
    // round-arched portal: brick arch band, oak double door, semicircular fanlight, granite steps
    archBand(b, f, c, 0, 4.5, 5.1, 0.55, 0.14, 'brick');
    archSlab(b, f, c, 0.6, 2.5, 3.85, 0.05, 'copper');
    archSlab(b, f, c, 0.6 + 2.6, 2.5, 1.25, 0.03, 'glass', 0.05);
    facePanel(b, f, c, 0.6, 0.06, 2.6, 'bronze', 0.07);
    facePanel(b, f, c, 3.17, 2.5, 0.06, 'copper', 0.09);
    slab(b, f, c, 0, 3.2, 0.2, 1.2, 'stone');
    slab(b, f, c, 0.2, 3.0, 0.2, 0.8, 'stone');
    slab(b, f, c, 0.4, 2.8, 0.2, 0.4, 'stone');
    // TECHNISCHE SCHOOL in iron letters round the arch (upright glyphs stepped along the band)
    const text = 'TECHNISCHE SCHOOL', R = 1.97, yc = 5.1 - 2.25, n = text.length;
    [...text].forEach((ch, k) => {
      if (ch === ' ') return;
      const a = Math.PI * (0.94 - 0.88 * k / (n - 1));
      letters(b, f, ch, c + R * Math.cos(a), yc + R * Math.sin(a) - 0.13, 0.14, 0.038, 0.03, 'bronze');
    });
    classWin(b, f, c - 3.1, 6.0, 1.6, 2.7, {lights: 1});
    classWin(b, f, c, 6.0, 3.2, 2.7);
    classWin(b, f, c + 3.1, 6.0, 1.6, 2.7, {lights: 1});
    classWin(b, f, c - 1.05, 10.2, 1.5, 2.2, {lights: 1});
    classWin(b, f, c + 1.05, 10.2, 1.5, 2.2, {lights: 1});
    classWin(b, f, c - 3.5, 1.9, 1.6, 1.1, {lights: 1, multi: false});
    classWin(b, f, c + 3.7, 1.9, 1.6, 1.1, {lights: 1, multi: false});
  }
  {
    const {f, len} = E(3);
    plinth(b, f, 0.05, len - 0.05);
    for (const t of [3.05, 6.3]) classWin(b, f, t, 1.7, 2.6, 1.3, {lights: 2, multi: false});
    for (const t of [3.6, 5.9]) classWin(b, f, t, 6.0, 1.6, 2.6, {lights: 1});
  }
  {
    const {f, len} = E(5), c = len / 2;
    plinth(b, f, 0.05, len - 0.05);
    for (const dt of [-1.3, 0, 1.3]) {
      tallWin(b, f, c + dt, 4.5, 0.85, 14.5);
      classWin(b, f, c + dt, 1.0, 0.75, 1.3, {lights: 1, multi: false});
    }
    for (const dt of [-1.65, -0.55, 0.55, 1.65]) classWin(b, f, c + dt, 20.6, 0.6, 0.9, {lights: 1, multi: false, sill: false});
  }
}

/** One-storey auto workshop (edges 36 gable, 37 north side): red car door under a brick arch, roof glazing. */
function workshop(b: BuildingTools) {
  {
    const {f, len} = E(36), c = len / 2;
    plinth(b, f, 0.05, c - 2.25, 0.6); plinth(b, f, c + 2.25, len - 0.05, 0.6);
    archBand(b, f, c, 0, 4.4, 4.5, 0.4, 0.12, 'brick');
    archSlab(b, f, c, 0, 3.6, 4.1, 0.06, 'red');
    facePanel(b, f, c, 0, 0.06, 4.0, 'bronze', 0.07);
    for (const dt of [-0.45, 0.45]) classWin(b, f, c + dt, 6.0, 0.4, 0.8, {lights: 1, multi: false, sill: false});
  }
  {
    const {f, len} = E(37);
    plinth(b, f, 0.05, len - 0.05, 0.6);
    for (const t of [2.0, 5.2, 8.4]) classWin(b, f, t, 0.9, 2.2, 1.3, {lights: 2, multi: false});
    roofQuad(b, f, 0.8, len - 0.8, 0.9, 3.4, 'canopyGlass');
  }
}

// ------------------------------------------------------------------ 1998-2001 wing, re-clad about 2024
const CLAD: Col[] = ['pink', 'blue', 'sandstone', 'ochre', 'pink', 'sandstone', 'blue'];
/** Edges of the flat 2001 wing: the street sides (9-19) and its courtyard faces (20-28, inferred). */
const NEW_EDGES = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];

function newWing(b: BuildingTools) {
  const rand = rng(200704);
  for (const i of NEW_EDGES) {
    const {f, len: L} = E(i);
    if (L < 0.3) continue;
    // edge 9's first 2.6 m is the end wall of the Meeuwenlaan wing
    const t0 = i === 9 ? 2.6 : 0, len = L - t0, mid = t0 + len / 2;
    // the lowest roof along the edge: the courtyard ramp (talud) is left plain
    const top = Math.min(6.7, ...[0.15, 0.32, 0.5, 0.68, 0.85].map(k => roofY(...at(f, t0 + len * k, 0.6), 0)));
    if (top < 4.5) continue;
    const band = 2.55;
    // glazed ground storey with brown posts at about 1.95 m (the short facets of the rounded corner get the posts only)
    // one pane per bay, 9 cm out, the posts over the joints (separate sheets, never one long open outline)
    const posts = Math.max(1, Math.round(len / 1.95)), bay = len / posts;
    if (len > 2.5) for (let k = 0; k < posts; k++) facePanel(b, f, t0 + bay * (k + 0.5) + (k === 0 ? 0.08 : 0) - (k === posts - 1 ? 0.08 : 0), 0.05, bay - 0.06 - (k === 0 ? 0.16 : 0) - (k === posts - 1 ? 0.16 : 0), band - 0.1, 'green', 0.09);
    for (let k = 0; k <= posts; k++) slab(b, f, t0 + Math.min(len - 0.14, Math.max(0.14, bay * k)), 0, 0.1, band, 0.14, 'bronze');
    slab(b, f, mid, band - 0.06, len, 0.12, 0.15, 'bronze');
    // the striped cladding band
    let t = 0;
    while (t < len - 0.01) {
      const w = Math.min(len - t, 0.6 + rand() * 1.8), col = CLAD[Math.floor(rand() * CLAD.length)];
      // panels 9 cm out with 1 cm joints: clear of the shell wall (no tight z-fight) and separate outlines
      facePanel(b, f, t0 + t + w / 2, band + 0.06, w - 0.01, top - band - 0.06, col, 0.09);
      t += w;
    }
    slab(b, f, mid, top - 0.1 + 0.05, len + 0.06, 0.15, 0.15, 'sandstone');
  }
  // METROPOLIS board over the stair entrance at the east end of the Zamenhofstraat corner wall (w10-168, 2025)
  {
    const {f, len} = E(14), t = len - 1.4;
    slab(b, f, t, 2.65, 2.3, 0.72, 0.06, 'concrete', 0.12);
    letters(b, f, 'METROPOLIS', t, 2.87, 0.18, 0.036, 0.02, 'bronze');
  }
  // the roof playground's fence: posts and rails round the deck, a taller ball cage over its east half (w03-168)
  const deck = src.surfaces.find(s => s.type === 'RoofSurface' && s.rings[0].every(p => p[1] > 6.0 && p[1] < 6.8) && Math.max(...s.rings[0].map(p => p[0])) > 30);
  if (deck) {
    const pts = deck.rings[0].map(p => [p[0], p[2]]);
    if (pts[0][0] === pts.at(-1)![0] && pts[0][1] === pts.at(-1)![1]) pts.pop();
    // merge near-collinear vertices so the posts run along straight sides
    const keep = pts.filter((p, i) => {
      const a = pts[(i + pts.length - 1) % pts.length], c = pts[(i + 1) % pts.length];
      const cr = Math.abs((p[0] - a[0]) * (c[1] - a[1]) - (p[1] - a[1]) * (c[0] - a[0])) / (Math.hypot(c[0] - a[0], c[1] - a[1]) || 1);
      return cr > 0.3;
    });
    keep.forEach((_, i) => {
      const {f, len} = ringFrame(keep, i);
      if (len < 1) return;
      const [mx] = at(f, len / 2, 0), h = mx > 8 ? 5.5 : 3.0, y0 = roofY(...at(f, len / 2, 0.3), 6.3) - 0.02;
      const n = Math.max(1, Math.round(len / 3));
      for (let k = 0; k <= n; k++) slab(b, f, len * k / n, y0, 0.07, h, 0.07, 'sandstone', -0.3);
      slab(b, f, len / 2, y0 + h - 0.06, len, 0.06, 0.06, 'sandstone', -0.3);
      slab(b, f, len / 2, y0 + 1.1, len, 0.05, 0.05, 'sandstone', -0.3);
    });
  }
}

export function buildTechnischeSchoolMeeuwenlaan(_w: number, _d: number, b: BuildingTools) {
  const isNew = (s: Surface) => {
    const r = s.rings[0], ys = r.map(p => p[1]);
    const cz = r.reduce((a, p) => a + p[2], 0) / r.length;
    return Math.max(...ys) <= 7.0 && cz > -20;
  };
  addShell(b, src as never, {
    wall: 'brick', roof: 'slate',
    wallFor: s => (isNew(s) ? 'sandstone' : 'brick'),
    roofFor: s => {
      const r = s.rings[0], ys = r.map(p => p[1]);
      if (Math.max(...ys) - Math.min(...ys) > 0.6) return 'slate';
      return Math.max(...ys) > 6.0 && Math.max(...ys) < 6.8 ? 'dark' : 'dark';
    },
  });
  const s0 = getSink();
  setSink(0);
  eaves(b);
  setSink(0.1, true);
  plantsoenFront(b);
  meeuwenlaanFront(b);
  eastEnd(b);
  courtyardSide(b);
  entrance(b);
  workshop(b);
  newWing(b);
  setSink(s0);
}
