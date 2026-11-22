import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {getSink, letters, put, ringFrame, setSink, slab, type Frame} from './nearbar-kit';
import {paneGrid} from '../../src/canalRecall/landmarks/paneGrid';
import source from './generator-mauritskade-footprints.json';

/**
 * GENERATOR HOSTEL, Mauritskade 57, on the north edge of the Oosterpark (BAG pand 0363100012235952, BAG 1916; gemeentelijk
 * monument 200965). Register: the former university Laboratorium voor Gezondheidsleer (1916), a central block with side
 * wings, massive brick volumes and a taut play of lines related to contemporary German architecture, the wrought-iron work of
 * the entrance, kept intact "despite the changes and the new storey". The new storey is the glass box on the roof
 * (Generator hostel conversion); the tower on the Mauritskade side carries the hostel's lightning logo.
 *
 * Massing: the 3DBAG LoD2.2 shell as scanned: the brick building to 11.35-12.1 m, the glass storey to 17.1 m set back on it,
 * the tower to its 17.9 m gable, the low courtyard wings. Walls are coloured by height: a wall standing on the brick top
 * (lowest point over 10.5 m, top under 17.5 m) is the glass storey, one rising from it above the glass box is plant (grey),
 * the rest brick. Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), y up from the 3DBAG ground:
 *  - Mauritskade (edge 25, w03-342, recording_2025-06-20_10-43-25_02794, 50 px/m; brick top 11.35 m at 413 px gives the
 *    ground at 983 px): lower windows 2.86-5.16 m, upper windows 6.76-9.66 m, a stone string course at 9.9-10.05 m, a
 *    stone coping on the brick top; two groups of three windows (1.2 m wide at a 1.5 m pitch, cream frames, small panes),
 *    the groups 1.9 m apart; the glass storey in two rows of dark reflective panes, mullions at about 2.3 m;
 *  - the park front (edge 0, w01-252, 2025, 48.6 px/m) and the courtyard walls (w06, w09, w10, w11): the same two rows of
 *    window groups and the same glass storey; behind the trees the groups are drawn at the Mauritskade rhythm (INFERRED);
 *  - the tower front (edges 31-32 as one 10.7 m face, w04-26, recording_2025-06-20_10-43-25_02797, 2025, 50 px/m across,
 *    46.4 px/m up from the door sill at 915 px): a door with two side lights, a stone-framed three-row grid of five windows
 *    (4.2-8.95 m), a group of five tall windows between brick piers (10.8-13.6 m), the stone gable face 14.0-16.3 m with
 *    the Generator lightning logo (1.7 x 2.0 m).
 */
type Src = {facadeRing: number[][]; surfaces: Surface[]};
const src = source as unknown as Src;
const ring = src.facadeRing;
let B: BuildingTools;
type W = {f: Frame; len: number};

const LOW = [2.86, 5.16], UP = [6.76, 9.66], STRING = 9.9, WIN_W = 1.2, PITCH = 1.5, GROUP_GAP = 1.9;
/** Tower front: edges 31 and 32 lie on one line. */
const TOWER = [31, 32];
/** Edges that are chords of a curved or stepped wall (the east corner, 23-24; the south-west wing, 51): windows on the chord would stand off the wall. */
const CHORDS = [23, 24, 51];

const ys = (s: Surface) => s.rings[0].map(p => p[1]);
function wallColour(s: Surface): string {
  const lo = Math.min(...ys(s)), hi = Math.max(...ys(s));
  if (lo > 16.8) return 'concrete';
  if (lo > 10.5 && hi < 17.5) return 'glass';
  return 'brick';
}
/** The brick top under the glass storey: 12.05 m on the west wing (x < -18.5, its ledges scan at 12.0), 11.4 m elsewhere. */
const brickTop = (s: Surface) => (Math.max(...s.rings[0].map(p => p[0])) < -18.5 ? 12.05 : 11.4);
/** Sutherland-Hodgman against one horizontal plane: the part of a polygon above (keepAbove) or below y. */
function clipY(r: number[][], y: number, keepAbove: boolean): number[][] {
  const out: number[][] = [], inside = (p: number[]) => (keepAbove ? p[1] >= y : p[1] <= y);
  for (let k = 0; k < r.length; k++) {
    const a = r[k], c = r[(k + 1) % r.length], ia = inside(a), ic = inside(c);
    if (ia) out.push(a);
    if (ia !== ic) { const u = (y - a[1]) / (c[1] - a[1]); out.push([a[0] + (c[0] - a[0]) * u, y, a[2] + (c[2] - a[2]) * u]); }
  }
  return out;
}
/**
 * The scan runs most walls of the brick building and of the glass storey as one face from the ground to the glass top
 * (17.1 m): those are split at the brick top, brick below and glass above. The tower (tops 15.5-17.9 m) and the plant
 * housings keep their walls whole.
 */
function splitSurfaces(): Surface[] {
  const out: Surface[] = [];
  for (const s of src.surfaces) {
    const lo = Math.min(...ys(s)), hi = Math.max(...ys(s));
    if (s.type !== 'WallSurface' || lo > 10.5 || Math.abs(hi - 17.1) > 0.15) { out.push(s); continue; }
    const y = brickTop(s), lower = clipY(s.rings[0], y, false), upper = clipY(s.rings[0], y, true);
    if (lower.length >= 3) out.push({...s, rings: [lower]});
    if (upper.length >= 3) out.push({...s, rings: [upper]});
  }
  return out;
}
const SURFACES = splitSurfaces();

export function buildGeneratorMauritskade(_w: number, _d: number, b: BuildingTools) {
  B = b;
  addShell(b, {surfaces: SURFACES} as never, {wall: 'brick', roof: 'dark', wallFor: s => wallColour(s)});
  glassStoreyBars(b);
  const sink0 = getSink();
  setSink(0.1, true);
  ring.forEach((_, i) => {
    if (TOWER.includes(i) || CHORDS.includes(i)) return;
    const F = ringFrame(ring, i);
    if (F.len < 3.4) return;
    const top = wallTop(F);
    if (top < 5.6) return;
    windowGroups(F, top);
    // the stone coping on the brick top and the string course under it
    if (top > 10.5 && top < 12.6) {
      slab(B, F.f, F.len / 2, top - 0.24, F.len, 0.32, 0.06, 'stone', 0);
      slab(B, F.f, F.len / 2, STRING, F.len, 0.15, 0.05, 'stone', 0);
    }
  });
  tower();
  entrance(ringFrame(ring, 29));
  // the small balcony on the courtyard wing (edge 50, w10-72): a slab with a solid parapet
  const bal = ringFrame(ring, 50);
  slab(B, bal.f, bal.len / 2, 5.25, 2.0, 0.18, 1.0, 'stone', 0);
  slab(B, bal.f, bal.len / 2, 5.43, 2.0, 0.9, 0.1, 'stone', 0.9);
  setSink(sink0);
}

/** The highest point of the shell walls standing on this ring edge from the ground (within 0.5 m of its line). */
function wallTop(F: W): number {
  let top = 0;
  for (const s of SURFACES) {
    if (s.type !== 'WallSurface' || Math.min(...ys(s)) > 1) continue;
    const ok = s.rings[0].every(p => {
      const dx = p[0] - F.f.origin[0], dz = p[2] - F.f.origin[1];
      const t = dx * F.f.tangent[0] + dz * F.f.tangent[1], d = dx * F.f.n[0] + dz * F.f.n[1];
      return Math.abs(d) < 0.5 && t > -0.5 && t < F.len + 0.5;
    });
    if (ok) top = Math.max(top, ...ys(s));
  }
  return top;
}

/** Groups of three windows at the Mauritskade rhythm, centred on the edge; a short edge takes what fits. */
function windowGroups(F: W, top: number) {
  const block = 3 * PITCH;
  let groups = Math.floor((F.len - 1.0 + GROUP_GAP) / (block + GROUP_GAP));
  const ts: number[] = [];
  if (groups >= 1) {
    const span = groups * block + (groups - 1) * GROUP_GAP, t0 = (F.len - span) / 2;
    for (let g = 0; g < groups; g++) for (let k = 0; k < 3; k++) ts.push(t0 + g * (block + GROUP_GAP) + PITCH * (k + 0.5));
  } else {
    groups = Math.max(1, Math.floor((F.len - 0.8) / PITCH));
    const t0 = (F.len - groups * PITCH) / 2;
    for (let k = 0; k < groups; k++) ts.push(t0 + PITCH * (k + 0.5));
  }
  for (const t of ts) {
    if (top > LOW[1] + 0.4) win(F, t, LOW[0], LOW[1], WIN_W, 2, 4);
    if (top > UP[1] + 0.6) win(F, t, UP[0], UP[1], WIN_W, 2, 5);
  }
}

/** A cream-framed window of small panes: frame, glass and a cols x rows bar grid. */
function win(F: W, t: number, y0: number, y1: number, w: number, cols: number, rows: number, out = 0) {
  const h = y1 - y0;
  slab(B, F.f, t, y0 - 0.06, w + 0.12, h + 0.12, 0.08, 'frame', out);
  slab(B, F.f, t, y0 + 0.05, w - 0.1, h - 0.1, 0.04, 'glass', out + 0.08);
  const s0 = getSink();
  setSink(0);
  for (const m of paneGrid({width: w - 0.1, height: h - 0.1, cols, rows, bar: 0.05, frame: 0})) slab(B, F.f, t + m.x, y0 + 0.05 + m.y, m.w, m.h, 0.04, 'frame', out + 0.12);
  setSink(s0, true);
}

/** Mullions (about every 2.3 m) and the mid transom on the glass storey's walls, from each wall's own plane. */
function glassStoreyBars(b: BuildingTools) {
  for (const s of SURFACES) {
    if (s.type !== 'WallSurface' || wallColour(s) !== 'glass') continue;
    const r = s.rings[0], lo = Math.min(...ys(s)), hi = Math.max(...ys(s));
    const base = r.filter(p => p[1] < lo + 0.05);
    if (base.length < 2 || hi - lo < 2) continue;
    let a = base[0], c = base[1], L = 0;
    for (const p of base) for (const q of base) { const l = Math.hypot(q[0] - p[0], q[2] - p[2]); if (l > L) { L = l; a = p; c = q; } }
    if (L < 2.0) continue;
    const tx = (c[0] - a[0]) / L, tz = (c[2] - a[2]) / L;
    const f: Frame = {origin: [a[0], a[2]], tangent: [tx, tz], n: [-tz, tx]};
    // the bars stand 4 cm proud on both sides of the pane (the shell's winding does not say which side is out)
    const n = Math.max(1, Math.round(L / 2.3));
    for (let k = 1; k < n; k++) for (const o of [0.04, -0.1]) slab(b, f, (L * k) / n, lo, 0.08, hi - lo, 0.06, 'bronze', o);
    for (const o of [0.04, -0.1]) slab(b, f, L / 2, lo + (hi - lo) * 0.55, L, 0.08, 0.06, 'bronze', o);
  }
}

/** The tower front on the Mauritskade (w04-26). t from its left (east) end. */
function tower() {
  const F0 = ringFrame(ring, TOWER[0]);
  const end = ring[TOWER[1] + 1];
  const len = Math.hypot(end[0] - F0.f.origin[0], end[1] - F0.f.origin[1]);
  const F: W = {f: F0.f, len};
  // door with two side lights
  slab(B, F.f, 5.24, 0, 1.3, 2.5, 0.06, 'stone', 0);
  slab(B, F.f, 5.24, 0, 1.0, 2.35, 0.08, 'dark', 0.02);
  for (const t of [4.3, 6.2]) win(F, t, 1.0, 2.4, 0.5, 1, 3);
  // the stone-framed grid: three rows of five windows, stone transoms and frame
  const g0 = 2.3, g1 = 8.2, cols = 5, pitch = (g1 - g0) / cols;
  slab(B, F.f, (g0 + g1) / 2, 4.05, g1 - g0 + 0.3, 0.18, 0.1, 'stone', 0);
  slab(B, F.f, (g0 + g1) / 2, 8.95, g1 - g0 + 0.3, 0.25, 0.1, 'stone', 0);
  for (const y of [5.75, 7.4]) slab(B, F.f, (g0 + g1) / 2, y - 0.08, g1 - g0, 0.16, 0.08, 'stone', 0);
  for (const [y0, y1] of [[4.25, 5.65], [5.85, 7.3], [7.5, 8.9]]) for (let k = 0; k < cols; k++) win(F, g0 + pitch * (k + 0.5), y0, y1, 0.9, 2, 3);
  // the upper group of five tall windows between brick piers, a stone sill band and pier caps
  slab(B, F.f, (g0 + g1) / 2, 10.55, g1 - g0 + 0.2, 0.18, 0.1, 'stone', 0);
  for (let k = 0; k < cols; k++) win(F, g0 + pitch * (k + 0.5), 10.8, 13.6, 0.85, 2, 4);
  for (let k = 0; k <= cols; k++) slab(B, F.f, g0 + pitch * k, 10.7, 0.25, 3.3, 0.12, 'brick', 0);
  slab(B, F.f, (g0 + g1) / 2, 13.85, g1 - g0 + 0.2, 0.2, 0.1, 'stone', 0);
  // the outer piers' stone string course and the stone gable face with the logo
  for (const [a, c] of [[0, g0 - 0.3], [g1 + 0.3, len]]) slab(B, F.f, (a + c) / 2, 13.6, c - a, 0.2, 0.06, 'stone', 0);
  slab(B, F.f, len / 2, 14.05, 7.2, 2.25, 0.08, 'stone', 0);
  logo(F, 5.3, 15.5);
}

/** The Generator lightning logo, an extruded outline read from w04-26 (1.67 x 2.05 m), 12 cm proud of the gable stone. */
function logo(F: W, t: number, y: number) {
  // outline in the crop's scaled pixels (420 x 390 for 2.8 x 2.6 m), y down
  const px: [number, number][] = [[270, 42], [245, 40], [80, 210], [95, 245], [225, 245], [195, 325], [215, 320], [330, 195], [320, 175], [165, 215], [160, 200], [275, 60]];
  const sx = 1.67 / 250, sy = 2.05 / 285;
  const shape = new T.Shape(px.map(([x, yy]) => new T.Vector2((x - 205) * sx, -(yy - 183) * sy)));
  const g = new T.ExtrudeGeometry(shape, {depth: 0.12, bevelEnabled: false});
  put(B, F.f, g.translate(0, 0, 0.08), t, y, 0, 'gold');
}


/** The hostel entrance in the courtyard (edge 29, w13-27): a dark steel canopy at 2.6 m with GENERATOR letters on it. */
function entrance(F: W) {
  slab(B, F.f, F.len / 2, 2.55, 3.8, 0.15, 2.6, 'dark', 0);
  for (const t of [F.len / 2 - 1.8, F.len / 2 + 1.8]) slab(B, F.f, t, 0, 0.1, 2.55, 0.1, 'dark', 2.45);
  letters(B, F.f, 'GENERATOR', F.len / 2, 2.72, 2.5, 0.065, 0.05, 'gold');
}

