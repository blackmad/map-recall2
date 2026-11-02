import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {GL} from './nearbar-kit';
import {Acc, roof, soffit, tube, type C} from './tier-kit';
import type {PlanPoint} from '../../src/canalRecall/landmarks/roofTiers';
import {holedWall, type HoledOpening, type WallQuad} from '../../src/canalRecall/landmarks/holedWall';
import {bandedCurtain, storeyBands, type CurtainBand} from '../../src/canalRecall/landmarks/bandedCurtain';
import {pressedMetalGrid, type GridOpening} from '../../src/canalRecall/landmarks/pressedMetalGrid';

/**
 * Gerrit Rietveld Academie and Sandberg Instituut, Fred. Roeskestraat 96-98 (BAG pand 0363100012091838, bouwjaar 2006):
 * the Benthem Crouwel building (2004-2006) on the east, the Fedlev wing (Paulien Bremmer / Studio Fedlev with Rob
 * Hootsmans, opened 2018) on the west, and the footbridge between them. One BAG pand, so one model.
 * Native east/south metres from the BAG ring vertex average (rietveld-academie-2006-footprints.json, PDOK BAG WFS),
 * y above the 3DBAG ground 0.535 m NAP.
 *
 * The building is drawn in its own frame: u along the BAG edges (bearing 87.1), v towards bearing 357.1 (the courtyard).
 *
 * Evidence (scripts/landmarks/rietveld-academie-2006-inventory.json):
 *  - BAG ring: the tower 40.25 x 16.86 m; the Fedlev wing 28.63 x 42.93 m, its south front 1.45 m further south than the
 *    tower's; the footbridge's plan 8.7 x 2.9 m between them.
 *  - 3DBAG LoD2.2 roof parts (CC BY 4.0): the tower's south slab (9.3 m deep) at 32.4 m, the rest at 28.35 m; the Fedlev
 *    roof at 9.9 m, a 14.7 m roof head 5.4 x 15.5 m, and the stair's sloping part on the north side.
 *  - Panorama TMX7316060226-000009_pano_0002_001188 (tower south front, rectified at 38.8 px/m): ground storey to 4.06 m,
 *    three low ribbons at 4.86-6.22 m (t 0-4.3, 11.45-28.0, 36.3 to the corner), two high ribbons at 22.7-23.8 and
 *    26.2-27.3 m over the middle one; the dimples about 0.36 x 0.30 m (FFT of the cladding).
 *  - Panorama TMX7316010203-002476_pano_0001_000908 (Fedlev south front, 2022, 45.9 px/m): glazed ground storey, white
 *    slab band, the expanded-metal screen storey on a 2.0 m panel rhythm with one glazed bay and a folded shutter, white
 *    roof band and railing; the alphabet and GERRIT RIETVELD ACADEMIE / SANDBERG INSTITUUT on the ground-floor glass.
 *  - Commons Fedlev-vleugel (1)-(6) (Ceescamel 2019, CC BY-SA 4.0): the folding mesh shutters, loggias with mesh
 *    balustrades, the north front's stair on a V-shaped concrete pylon and its stair up through the screen storey to the
 *    roof, the sloping mesh-clad footbridge up to the tower, the tower's west ribbons and its glazed north face.
 *  - Commons Frederik Roeskestraat pic2 (Alf van Beem 2016, CC0), Exterior Benthem Crouwel Building circa 2005 (Gerrit
 *    Rietveld Academie, CC BY-SA 4.0), Sandberg instituut.jpg (Branko Collin 2008, public domain): the tower's ribbons
 *    and the step in its roof seen on the east and west faces.
 */

const TH = 2.92 * Math.PI / 180, CS = Math.cos(TH), SN = Math.sin(TH);
type UV = [number, number];
type V3 = [number, number, number];
/** Building frame (u east-ish, v north-ish) to native [x east, z south]. */
const N = ([u, v]: UV): PlanPoint => [u * CS - v * SN, -(u * SN + v * CS)];
const DIR = {N: [0, 1] as UV, S: [0, -1] as UV, E: [1, 0] as UV, W: [-1, 0] as UV};
type Side = keyof typeof DIR;

/**
 * A face seen from outside: t runs from the viewer's left end to the right end, y up, o outwards. (t, y, o) maps to a
 * right-handed world frame, so a quad listed counter-clockwise in (t, y) seen from the front stays front-facing.
 */
type Face = {L: number; P: (t: number, y: number, o: number) => V3};
function face(left: UV, right: UV, out: Side): Face {
  const a = N(left), b = N(right), L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L, n = N(DIR[out]);
  if (-tz * n[0] + tx * n[1] <= 0) throw new Error(`face: ${left} -> ${right} does not run to the viewer's right facing ${out}`);
  return {L, P: (t, y, o) => [a[0] + tx * t + n[0] * o, y, a[1] + tz * t + n[1] * o]};
}
function quad(acc: Acc, c: C, p: V3, q: V3, r: V3, s: V3) { acc.tri(c, p, q, r); acc.tri(c, p, r, s); }
/** Front-facing rectangle on a face, `o` metres out. */
function rect(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o = 0) {
  quad(acc, c, f.P(t0, y0, o), f.P(t1, y0, o), f.P(t1, y1, o), f.P(t0, y1, o));
}
/** A slab standing out of a face from o0 to o1: front, top, bottom and both ends (no back). */
function slab(acc: Acc, c: C, f: Face, t0: number, t1: number, y0: number, y1: number, o0: number, o1: number) {
  rect(acc, c, f, t0, t1, y0, y1, o1);
  quad(acc, c, f.P(t0, y1, o1), f.P(t1, y1, o1), f.P(t1, y1, o0), f.P(t0, y1, o0));   // top
  quad(acc, c, f.P(t0, y0, o0), f.P(t1, y0, o0), f.P(t1, y0, o1), f.P(t0, y0, o1));   // bottom
  quad(acc, c, f.P(t0, y0, o0), f.P(t0, y0, o1), f.P(t0, y1, o1), f.P(t0, y1, o0));   // left end
  quad(acc, c, f.P(t1, y0, o1), f.P(t1, y0, o0), f.P(t1, y1, o0), f.P(t1, y1, o1));   // right end
}
/** holedWall's (t, y, o) quads onto a face. */
function emit(acc: Acc, c: C, f: Face, q: WallQuad) {
  const [a, b, d, e] = q.pts.map(([t, y, o]) => f.P(t, y, o));
  quad(acc, c, a, b, d, e);
}
/** A box in the building frame (BoxGeometry turned onto the building axis). */
function ubox(b: BuildingTools, c: C, u0: number, u1: number, v0: number, v1: number, y0: number, y1: number) {
  const g = new T.BoxGeometry(u1 - u0, y1 - y0, v1 - v0);
  g.rotateY(TH);
  const m = N([(u0 + u1) / 2, (v0 + v1) / 2]);
  g.translate(m[0], (y0 + y1) / 2, m[1]);
  b.add(g, c);
}
const ring = (pts: UV[]) => pts.map(N);
type Rect = {w: number; e: number; s: number; n: number};
/** The soffit between an outer and an inner rectangle as four plain strips (south and north full width, east and west between). */
function frameSoffit(b: BuildingTools, o: Rect, i: Rect, y: number, c: C) {
  const r = (u0: number, u1: number, v0: number, v1: number) => soffit(b, [[ring([[u0, v0], [u1, v0], [u1, v1], [u0, v1]])]], y, c);
  r(o.w, o.e, o.s, i.s); r(o.w, o.e, i.n, o.n); r(o.w, i.w, i.s, i.n); r(i.e, o.e, i.s, i.n);
}

/** Pixel capitals as single quads on a face (tier-kit's glyphs plus F, Q and X for the alphabet on the glass). */
const GLYPHS: Record<string, string[]> = {
  ...GL,
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
};
function letters(acc: Acc, c: C, f: Face, text: string, tMid: number, y: number, o: number, px: number) {
  let t = tMid - ([...text].length * 6 - 1) * px / 2;
  for (const ch of text) {
    (GLYPHS[ch] ?? []).forEach((row, j) => {
      let k = 0;
      while (k < 5) {
        if (row[k] !== '1') { k++; continue; }
        let e = k; while (e < 5 && row[e] === '1') e++;
        const y0 = y + (6 - j) * px;
        rect(acc, c, f, t + k * px, t + e * px, y0, y0 + px, o);
        k = e;
      }
    });
    t += 6 * px;
  }
}

// ---- the Benthem Crouwel building ------------------------------------------------------------------------------------
/** BAG ring in the building frame; the 3DBAG roof step between the high south slab and the rest. */
const TW = {w: 3.21, e: 43.46, s: -11.26, n: 5.6, split: -1.96};
const HI = 32.4, LO = 28.35, GT = 4.06, GREC = 0.5;
/** Floors behind the north studio glazing: the ribbons' storeys (4.5 m, then 3.45 m) on the rectified south front. */
const FLOORS = [4.5, 7.95, 11.4, 14.85, 18.3, 21.75, 25.2];
const RIB = {low: [4.86, 6.22], u2: [22.7, 23.8], u1: [26.2, 27.3]} as const;
const RIB_DEPTH = 0.25;
/** Dimples drawn at twice their measured pitch (0.36 x 0.30 m): a horizontal shadow line under every row, a vertical line between columns. */
const GRID = {pitch: {t: 0.72, y: 0.6}, width: {h: 0.12, v: 0.11}};

function ribbonMullions(acc: Acc, f: Face, o: HoledOpening) {
  const n = Math.max(1, Math.round((o.t1 - o.t0) / 1.35));
  for (let i = 1; i < n; i++) {
    const t = o.t0 + (o.t1 - o.t0) * i / n;
    rect(acc, 'frame', f, t - 0.05, t + 0.05, o.y0, o.y1, -o.depth + 0.04);
  }
}
/**
 * One dimpled cladding face. The wall plane is tiled in horizontal slices, the grid's rows as dark shadow slices between
 * lighter field slices (each slice cut round the ribbons, so nothing overlaps), with recessed glass, dark reveals and
 * mullions in the ribbons; the grid's columns stand 9 cm proud as thin ribs that stop at the ribbons.
 */
function dimpled(acc: Acc, f: Face, t0: number, t1: number, y0: number, y1: number, ribbons: HoledOpening[], gridOnly: GridOpening[] = []) {
  const L = t1 - t0, sh = <O extends {t0: number; t1: number}>(o: O): O => ({...o, t0: o.t0 - t0, t1: o.t1 - t0});
  const sub: Face = {L, P: (t, y, o) => f.P(t + t0, y, o)};
  const ops = ribbons.map(sh);
  const w = holedWall(L, y0, y1, ops);
  for (const r of w.reveals) for (const q of r) emit(acc, 'frame', sub, q);
  for (const q of w.backs) emit(acc, 'glass', sub, q);
  for (const o of ops) ribbonMullions(acc, sub, o);
  // slices: rows from the kit (no openings, so every row spans the face), the field between them
  const rows = pressedMetalGrid({length: L, y0, y1, ...GRID}).filter(l => l.dir === 'h').map(l => [l.y0, l.y1] as [number, number]);
  const cuts = [y0, ...rows.flat(), y1];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const ya = cuts[i], yb = cuts[i + 1];
    if (yb - ya < 1e-4) continue;
    const clipped = ops.filter(o => o.y1 > ya && o.y0 < yb).map(o => ({...o, y0: Math.max(o.y0, ya), y1: Math.min(o.y1, yb)}));
    for (const q of holedWall(L, ya, yb, clipped).face) emit(acc, i % 2 ? 'bronze' : 'slate', sub, q);
  }
  for (const l of pressedMetalGrid({length: L, y0, y1, ...GRID, openings: [...ops, ...gridOnly.map(sh)], margin: 0.04})) {
    if (l.dir !== 'v') continue;
    const d = 0.09;
    rect(acc, 'copper', sub, l.t0, l.t1, l.y0, l.y1, d);
    quad(acc, 'copper', sub.P(l.t0, l.y0, 0), sub.P(l.t0, l.y0, d), sub.P(l.t0, l.y1, d), sub.P(l.t0, l.y1, 0));   // left side
    quad(acc, 'copper', sub.P(l.t1, l.y0, d), sub.P(l.t1, l.y0, 0), sub.P(l.t1, l.y1, 0), sub.P(l.t1, l.y1, d));   // right side
  }
}
const rib = (t0: number, t1: number, [y0, y1]: readonly [number, number] | readonly number[]): HoledOpening => ({t0, t1, y0, y1, depth: RIB_DEPTH});

function tower(acc: Acc, b: BuildingTools) {
  // south front (left = west): t = u - TW.w
  {
    const f = face([TW.w, TW.s], [TW.e, TW.s], 'S'), L = f.L;
    dimpled(acc, f, 0, L, GT, HI, [rib(0, 4.3, RIB.low), rib(11.45, 28.0, RIB.low), rib(36.3, L, RIB.low), rib(11.45, 28.0, RIB.u2), rib(11.45, 28.0, RIB.u1)]);
  }
  // east face (left = south): t = v - TW.s; the high slab to the split, the low part beyond; the corner ribbon wraps 2.5 m
  {
    const f = face([TW.e, TW.s], [TW.e, TW.n], 'E'), k = TW.split - TW.s;
    dimpled(acc, f, 0, k, GT, HI, [rib(0, 2.5, RIB.low)]);
    dimpled(acc, f, k, f.L, GT, LO, [rib(k + 0.76, f.L - 0.7, RIB.u2), rib(k + 0.76, f.L - 0.7, RIB.u1)]);
  }
  // west face (left = north): t = TW.n - v; the footbridge meets it between v -5.22 and -2.3
  {
    const f = face([TW.w, TW.n], [TW.w, TW.s], 'W'), k = TW.n - TW.split;
    dimpled(acc, f, 0, k, GT, LO, [rib(0.7, k - 0.76, RIB.u2), rib(0.7, k - 0.76, RIB.u1)]);
    dimpled(acc, f, k, f.L, GT, HI, [rib(f.L - 2.5, f.L, RIB.low)], [{t0: TW.n + 2.3, t1: TW.n + 5.22, y0: BRIDGE.yT - 0.1, y1: BRIDGE.yT + BRIDGE.h + 0.1}]);
  }
  // the step face of the high slab above the low roof (left = east)
  {
    const f = face([TW.e, TW.split], [TW.w, TW.split], 'N');
    dimpled(acc, f, 0, f.L, LO, HI, []);
  }
  // north face: studio glazing on every storey, black floor spandrels, mullions on 1.25 m (left = east)
  {
    const f = face([TW.e, TW.n], [TW.w, TW.n], 'N');
    const bands: CurtainBand[] = storeyBands(FLOORS, LO - 0.6, 0.85, 0.35);
    bands[0] = {...bands[0], y0: GT};
    bands.push({y0: LO - 0.6, y1: LO, kind: 'spandrel'});
    curtain(acc, f, GT, LO, bands, 1.25, 'dark');
  }
  // ground storey: glazed 0.5 m behind the cladding, a transom at 3.0 m, grey-green panels at the south front's ends
  {
    const r = GREC, g = {w: TW.w + r, e: TW.e - r, s: TW.s + r, n: TW.n - r};
    const gb: CurtainBand[] = [{y0: 0, y1: GT, kind: 'vision', floor: 3.0}];
    const fs = face([g.w, g.s], [g.e, g.s], 'S');
    curtain(acc, fs, 0, GT, gb, 1.6, 'stone', [[3.0, fs.L - 3.0]]);
    curtain(acc, face([g.e, g.s], [g.e, g.n], 'E'), 0, GT, gb, 1.6, 'stone');
    curtain(acc, face([g.e, g.n], [g.w, g.n], 'N'), 0, GT, gb, 1.6, 'stone');
    curtain(acc, face([g.w, g.n], [g.w, g.s], 'W'), 0, GT, gb, 1.6, 'stone');
    frameSoffit(b, TW, g, GT, 'frame');
    for (const [u, v] of [[g.w, g.s], [g.e, g.s], [g.e, g.n], [g.w, g.n]] as UV[]) ubox(b, 'frame', u - 0.15, u + 0.15, v - 0.15, v + 0.15, 0, GT);
  }
  roof(b, [[ring([[TW.w, TW.s], [TW.e, TW.s], [TW.e, TW.split], [TW.w, TW.split]])]], HI, 'ochre');
  roof(b, [[ring([[TW.w, TW.split], [TW.e, TW.split], [TW.e, TW.n], [TW.w, TW.n]])]], LO, 'ochre');
}

/**
 * A banded curtain from the kit onto a face: panes flat, transoms as proud slabs, mullions as fins. Spandrels take
 * `spandrel`; `clear` t ranges keep vision panes in every band (the rest of the ground storey keeps `spandrel` panels
 * only where no clear range is given and the band is a spandrel).
 */
function curtain(acc: Acc, f: Face, y0: number, y1: number, bands: CurtainBand[], module: number, spandrel: C, solid?: [number, number][]) {
  for (const p of bandedCurtain({length: f.L, y0, y1, bands, module, clear: solid})) {
    if (p.part === 'vision' || p.part === 'spandrel') {
      // `solid` on an all-vision band means the reverse: panels outside the clear range (the tower's ground-storey ends)
      const panel = p.part === 'spandrel' || (solid !== undefined && bands.every(b => b.kind === 'vision') && !solid.some(([a, c]) => p.t0 >= a - 1e-6 && p.t1 <= c + 1e-6));
      rect(acc, panel ? spandrel : 'glass', f, p.t0, p.t1, p.y0, p.y1);
    } else if (p.part === 'transom') slab(acc, 'frame', f, p.t0 + 0.05, p.t1 - 0.05, p.y0, p.y1, -0.01, p.depth);
    else slab(acc, 'frame', f, p.t0, p.t1, p.y0, p.y1, -0.01, p.depth);
  }
}

// ---- the Fedlev wing -------------------------------------------------------------------------------------------------
const F = {w: -34.15, e: -5.52, s: -12.71, n: 30.22};
/** Section on the rectified south front, scaled to the 3DBAG roof: glazed ground, slab band, screen storey, roof band. */
const G = 4.55, S1 = 5.35, R0 = 9.4, R1 = 10.1, BAND = 0.25, FREC = 1.5;
type Seg = {t0: number; t1: number; kind: 'mesh' | 'glass' | 'shutter' | 'loggia' | 'slot'};
/** The stair slot and landing on the north front (Fedlev-vleugel 5 and 6; 3DBAG's sloping roof part). */
const SLOT = {u0: F.e - 21.3, u1: F.e - 18.2, depth: 8.6};
const LANDING = {u0: F.e - 22.8, u1: F.e - 15.5, out: 4.5, y0: 2.65, y1: 3.07};
/** The footbridge: BAG plan between the wing's east face and the tower; it climbs from the screen storey's floor. */
const BRIDGE = {v0: -5.22, v1: -2.3, yF: S1, yT: 9.8, h: 3.2};

/** Mesh screen panels with white frames on the panel joints (about 2.0 m). */
function mesh(acc: Acc, f: Face, t0: number, t1: number) {
  rect(acc, 'pink', f, t0, t1, S1, R0);
  const n = Math.max(1, Math.round((t1 - t0) / 2.0));
  for (let i = 0; i <= n; i++) {
    const t = Math.min(t1 - 0.04, Math.max(t0 + 0.04, t0 + (t1 - t0) * i / n));
    slab(acc, 'white', f, t - 0.04, t + 0.04, S1, R0, -0.01, 0.07);
  }
}
/** Glazing on the screen line with mullions on 1.3 m. */
function glazing(acc: Acc, f: Face, t0: number, t1: number, o: number) {
  rect(acc, 'glass', f, t0, t1, S1, R0, o);
  const n = Math.max(1, Math.round((t1 - t0) / 1.3));
  for (let i = 1; i < n; i++) { const t = t0 + (t1 - t0) * i / n; slab(acc, 'white', f, t - 0.04, t + 0.04, S1, R0, o - 0.01, o + 0.06); }
  slab(acc, 'white', f, t0, t1, S1 + 1.05, S1 + 1.12, o - 0.01, o + 0.06);
}
/** A folded mesh shutter: its leaves standing out of the face like fins, glazing behind. */
function shutter(acc: Acc, f: Face, t0: number, t1: number) {
  glazing(acc, f, t0, t1, 0);
  const n = 4;
  for (let i = 0; i < n; i++) {
    const t = t0 + (t1 - t0) * (i + 0.5) / n;
    slab(acc, 'pink', f, t - 0.03, t + 0.03, S1 + 0.05, R0 - 0.05, 0.06, 0.6);
  }
}
/** A loggia 1.2 m deep: glazed back wall, white sides, ceiling and floor, a mesh balustrade on the screen line. */
function loggia(acc: Acc, f: Face, t0: number, t1: number) {
  const d = -1.2;
  glazing(acc, f, t0, t1, d);
  quad(acc, 'concrete', f.P(t0, S1, 0), f.P(t0, S1, d), f.P(t0, R0, d), f.P(t0, R0, 0));   // left side, facing +t
  quad(acc, 'concrete', f.P(t1, S1, d), f.P(t1, S1, 0), f.P(t1, R0, 0), f.P(t1, R0, d));   // right side
  quad(acc, 'concrete', f.P(t0, R0, 0), f.P(t0, R0, d), f.P(t1, R0, d), f.P(t1, R0, 0));   // ceiling, facing down
  quad(acc, 'concrete', f.P(t0, S1, d), f.P(t0, S1, 0), f.P(t1, S1, 0), f.P(t1, S1, d));   // floor, facing up
  rect(acc, 'pink', f, t0, t1, S1, S1 + 1.1, -0.08);
  slab(acc, 'white', f, t0, t1, S1 + 1.1, S1 + 1.16, -0.12, -0.04);
}
/** One side of the screen storey: slab band, the segments, roof band. Bands stand BAND proud of the screen line. */
function screenStorey(acc: Acc, f: Face, segs: Seg[], gapBand: [number, number][] = []) {
  const cuts = [0, f.L, ...gapBand.flat()].sort((a, b) => a - b);
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], c = cuts[i + 1];
    if (c - a < 1e-3 || gapBand.some(([p, q]) => a >= p - 1e-6 && c <= q + 1e-6)) continue;
    slab(acc, 'white', f, a === 0 ? -BAND : a, c, G, S1, 0, BAND);
  }
  // each face's bands run on past its left end over the corner square, so the four corners close once each
  slab(acc, 'white', f, -BAND, f.L, R0, R1, 0, BAND);
  for (const s of segs) {
    if (s.kind === 'mesh') mesh(acc, f, s.t0, s.t1);
    else if (s.kind === 'glass') glazing(acc, f, s.t0, s.t1, 0);
    else if (s.kind === 'shutter') shutter(acc, f, s.t0, s.t1);
    else if (s.kind === 'loggia') loggia(acc, f, s.t0, s.t1);
  }
}

function fedlev(acc: Acc, b: BuildingTools) {
  // ---- screen storey, face by face ----
  // south front (left = west): t = u - F.w; 2022 panorama
  const fS = face([F.w, F.s], [F.e, F.s], 'S');
  screenStorey(acc, fS, [{t0: 0, t1: 17.9, kind: 'mesh'}, {t0: 17.9, t1: 19.3, kind: 'glass'}, {t0: 19.3, t1: 20.1, kind: 'shutter'}, {t0: 20.1, t1: fS.L, kind: 'mesh'}]);
  // north front (left = east): t = F.e - u; Fedlev-vleugel (5)
  const fN = face([F.e, F.n], [F.w, F.n], 'N'), sl: [number, number] = [F.e - SLOT.u1, F.e - SLOT.u0];
  screenStorey(acc, fN, [
    {t0: 0, t1: 3.2, kind: 'mesh'}, {t0: 3.2, t1: 5.1, kind: 'shutter'}, {t0: 5.1, t1: 12.75, kind: 'loggia'},
    {t0: 12.75, t1: 14.2, kind: 'shutter'}, {t0: 14.2, t1: 15.5, kind: 'mesh'}, {t0: 15.5, t1: sl[0], kind: 'loggia'},
    {t0: sl[1], t1: fN.L, kind: 'mesh'},
  ], [sl]);
  // east face (left = south): t = v - F.s; a shutter near the north end (Fedlev-vleugel 4)
  const fE = face([F.e, F.s], [F.e, F.n], 'E');
  screenStorey(acc, fE, [{t0: 0, t1: 37.4, kind: 'mesh'}, {t0: 37.4, t1: 38.9, kind: 'shutter'}, {t0: 38.9, t1: fE.L, kind: 'mesh'}]);
  // west face (left = north): screens all along (Fedlev-vleugel 2)
  const fW = face([F.w, F.n], [F.w, F.s], 'W');
  screenStorey(acc, fW, [{t0: 0, t1: fW.L, kind: 'mesh'}]);

  // ---- the stair slot: white sides from the ground-storey top to the roof, the flight from the landing to the roof ----
  {
    const fs = face([SLOT.u1, F.n], [SLOT.u1, F.n - SLOT.depth], 'W');   // the slot's east side, seen from inside the slot (facing west)
    rect(acc, 'white', fs, 0, SLOT.depth, G, R1);
    const fw = face([SLOT.u0, F.n - SLOT.depth], [SLOT.u0, F.n], 'E');   // the west side, facing east
    rect(acc, 'white', fw, 0, SLOT.depth, G, R1);
    const fb = face([SLOT.u1, F.n - SLOT.depth], [SLOT.u0, F.n - SLOT.depth], 'N');   // back wall, facing north
    rect(acc, 'white', fb, 0, fb.L, R1 - 0.6, R1);
    // the flight: an inclined slab from the landing (2 m out) to the roof at the slot's back
    const w = SLOT.u1 - SLOT.u0 - 0.3, um = (SLOT.u0 + SLOT.u1) / 2;
    const a = N([um, F.n + 2.0]), c = N([um, F.n - SLOT.depth]);
    b.add(stairSlab(a, LANDING.y1, c, R1, w), 'white');
    // balustrades either side of the flight (white rails)
    for (const s of [-1, 1]) b.add(tube(N([um + s * w / 2, F.n + 2.0]), LANDING.y1 + 1.0, N([um + s * w / 2, F.n - SLOT.depth]), R1 + 1.0, 0.03, 4), 'white');
  }
  // ---- the landing on its V-shaped pylon, with a mesh balustrade ----
  {
    const L = LANDING, v1 = F.n + L.out;
    ubox(b, 'concrete', L.u0, L.u1, F.n + 0.02, v1, L.y0, L.y1);
    // the V: two legs from one foot under the landing's front (Fedlev-vleugel 5 and 6: vertex at 19.0 m from the east end)
    const uv = F.e - 19.0;
    for (const u of [F.e - 17.3, F.e - 20.7]) b.add(tube(N([uv, v1 - 0.7]), 0, N([u, v1 - 0.7]), L.y0, 0.2, 4), 'concrete');
    // the concrete wall under the landing's east end (15.5-17.5 m from the east end), drawn as a plain slab
    ubox(b, 'concrete', F.e - 17.5, L.u1, F.n - FREC + 0.02, F.n + 1.0, 0, L.y0);
    // balustrade: mesh on the three open sides, white top rail
    const fo = face([L.u1, v1], [L.u0, v1], 'N'), fe = face([L.u1, F.n], [L.u1, v1], 'E'), fw = face([L.u0, v1], [L.u0, F.n], 'W');
    for (const f of [fo, fe, fw]) {
      rect(acc, 'pink', f, 0, f.L, L.y1, L.y1 + 1.1, -0.05);
      slab(acc, 'white', f, 0, f.L, L.y1 + 1.1, L.y1 + 1.16, -0.09, -0.01);
    }
  }

  // ---- ground storey: glazed 1.5 m behind the screen line, a transom at 2.8 m; soffit under the overhang ----
  const g = {w: F.w + FREC, e: F.e - FREC, s: F.s + FREC, n: F.n - FREC};
  const gb: CurtainBand[] = [{y0: 0, y1: G, kind: 'vision', floor: 2.8}];
  const gS = face([g.w, g.s], [g.e, g.s], 'S'), gN = face([g.e, g.n], [g.w, g.n], 'N');
  curtain(acc, gS, 0, G, gb, 1.5, 'glass');
  curtain(acc, face([g.e, g.s], [g.e, g.n], 'E'), 0, G, gb, 1.5, 'glass');
  curtain(acc, gN, 0, G, gb, 1.5, 'glass');
  curtain(acc, face([g.w, g.n], [g.w, g.s], 'W'), 0, G, gb, 1.5, 'glass');
  frameSoffit(b, F, g, G, 'white');
  // corner posts where the recessed glass walls meet
  for (const [u, v] of [[g.w, g.s], [g.e, g.s], [g.e, g.n], [g.w, g.n]] as UV[]) ubox(b, 'frame', u - 0.15, u + 0.15, v - 0.15, v + 0.15, 0, G);
  // lettering on the south glass: the alphabet block west of the doors, the names to the east (2022 panorama)
  {
    const tA = (F.w + 6.8) - g.w, tB = (F.w + 23.85) - g.w, px = 0.032, step = 0.26, top = 3.05;
    ['ABCDE', 'FGHIJK', 'LMNOP', 'QRSTU', 'VWXYZ'].forEach((s, i) => letters(acc, 'gold', gS, s, tA, top - i * step, 0.13, px));
    ['GERRIT', 'RIETVELD', 'ACADEMIE', '', 'SANDBERG', 'INSTITUUT'].forEach((s, i) => s && letters(acc, 'gold', gS, s, tB, top - i * step, 0.13, 0.028));
    // the name over the north entrance: white capitals on a dark fascia panel (Fedlev-vleugel 5)
    const tN = (F.e - 14.25) - g.e;
    rect(acc, 'dark', gN, -tN - 1.7, -tN + 1.7, 3.55, 4.2, 0.12);
    letters(acc, 'gold', gN, 'GERRIT RIETVELD ACADEMIE', -tN, 3.72, 0.14, 0.02);
  }

  // ---- roof: flat behind the roof band, the stair slot open; the dark roof head and its skylight; railing ----
  roof(b, [[ring([[F.w, F.s], [F.e, F.s], [F.e, F.n], [SLOT.u1, F.n], [SLOT.u1, F.n - SLOT.depth], [SLOT.u0, F.n - SLOT.depth], [SLOT.u0, F.n], [F.w, F.n]])]], R1, 'ochre');
  ubox(b, 'dark', -28.3, -22.9, 5.0, 20.5, R1 - 0.3, 14.7);
  ubox(b, 'glass', -22.9, -19.6, 5.2, 20.3, R1 - 0.3, R1 + 0.45);
  {
    const i = 0.35, r = {w: F.w + i, e: F.e - i, s: F.s + i, n: F.n - i}, top = R1 + 1.1;
    const pts: UV[] = [[r.w, r.s], [r.e, r.s], [r.e, r.n], [r.w, r.n]];
    for (let k = 0; k < 4; k++) {
      const p = pts[k], q = pts[(k + 1) % 4];
      b.add(tube(N(p), top, N(q), top, 0.03, 4), 'white');
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 3.6));
      for (let j = 0; j < n; j++) {
        const s = j / n, uv: UV = [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
        b.add(tube(N(uv), R1, N(uv), top, 0.025, 4), 'white');
      }
    }
  }
}

/** An inclined stair slab of width w between two plan points (its top face from ya to yc), 0.35 m thick. */
function stairSlab(a: PlanPoint, ya: number, c: PlanPoint, yc: number, w: number) {
  const A = new T.Vector3(a[0], ya - 0.175, a[1]), B = new T.Vector3(c[0], yc - 0.175, c[1]), d = B.clone().sub(A);
  const g = new T.BoxGeometry(w, 0.35, d.length());
  const yaw = Math.atan2(d.x, d.z), pitch = -Math.asin(d.y / d.length());
  g.rotateX(pitch);
  g.rotateY(yaw);
  const m = A.add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

// ---- the footbridge ----------------------------------------------------------------------------------------------------
/** A sloping box between the wing's east face and the tower's west face: mesh sides and top, dark underside. */
function bridge(acc: Acc) {
  const u0 = F.e, u1 = TW.w, {v0, v1, yF, yT, h} = BRIDGE;
  const p = (u: number, v: number, y: number): V3 => { const q = N([u, v]); return [q[0], y, q[1]]; };
  const y = (u: number) => yF + (yT - yF) * (u - u0) / (u1 - u0);
  // south side (facing south), north side (facing north), top, underside
  quad(acc, 'pink', p(u0, v0, y(u0)), p(u1, v0, y(u1)), p(u1, v0, y(u1) + h), p(u0, v0, y(u0) + h));
  quad(acc, 'pink', p(u1, v1, y(u1)), p(u0, v1, y(u0)), p(u0, v1, y(u0) + h), p(u1, v1, y(u1) + h));
  quad(acc, 'pink', p(u0, v0, y(u0) + h), p(u1, v0, y(u1) + h), p(u1, v1, y(u1) + h), p(u0, v1, y(u0) + h));
  quad(acc, 'frame', p(u0, v1, y(u0)), p(u1, v1, y(u1)), p(u1, v0, y(u1)), p(u0, v0, y(u0)));
}

export function buildRietveldAcademie2006(_w: number, _d: number, b: BuildingTools) {
  const acc = new Acc(b);
  tower(acc, b);
  fedlev(acc, b);
  bridge(acc);
  acc.flush();
}
