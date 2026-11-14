import type {BuildingTools} from './cultural-builders';
import {ringFrame, roofHeightAt, slab, ledgeStrip, setSink, eaveOffset, type Frame} from './nearbar-kit';
import {addShellTess, beginFacade, claimOpening, quad} from './big-facade';
import type {RawWall} from './big-kit';
import type {ShellSource, Surface} from './worship-shell';
import {centroidXZ, columns, hostOn, sill, lineDist, midOf, shellGroups, shellRows, shellWalls, shellWindow, sideOf, slabBalcony, stairFlight, wallLetters, type V2} from './houthavens-shell';
import raw from './blok0-ij4you-footprints.json';

/**
 * Houthaven Blok 0, plots 8 and 9 ("IJ4you"), Haparandaweg 650-706 / Houthavenkade (BAG pand 0363100012242823, bouwjaar
 * 2015): Marcel Lok_Architect. "As part of blok0 the project IJ4you covers the final plots 8 and 9, the southern end part of
 * this 'superblock'. The complex consists of a 9-layered building with apartments at the Haparandaweg and a 4 to 5-layered
 * building part with apartments to the quay of the future Houthavenkade ... The building encloses a double layered parking
 * garage with a collective roof garden on top ... The corner block is designed in an industrially manufactured brick with a
 * clear brick grid of vertical and horizontal layers with an apparent depth. The block attached is designed in a natural
 * limestone with horizontal cantilevered edges." (arch2o.com/?p=873805, ArchDaily 787541, 2016; quoted as fact citation.)
 *
 * Identity: the brick front carries "650-678" and the stone front "680-706" over their entrances (panoramas
 * 2025_09_29_07_54_42_00174 and TMX7316010203-002366_pano_0003_000742); BAG lists Haparandaweg 650-706 and Houthavenkade
 * in this pand; De Rede (708-744) stands against its NE side.
 *
 * Massing is the 3DBAG LoD2.2 shell (native east/south metres from the BAG ring's vertex average; ground 0.78 m NAP):
 * the brick corner block at the SW end of the Haparandaweg front to 28.8 m, the stone block NE of it to 26.5 m with a set-back
 * top storey to 28.8, the garden deck on the garage at 4.2 m, the quay blocks to 13.4-13.8 m with set-back tops to 16.8.
 * Facades measured on rectified Gemeente Amsterdam panoramas (CC BY 4.0; scripts/landmarks/blok0-ij4you-inventory.json):
 *  - brick Haparandaweg front (w02-320, 2025, 50 px/m): ground storey 3.8 m, then eight storeys at 2.9 m; five columns,
 *    two-light windows 1.55 x 2.15 with glass balustrades in a grid of piers and floor bands 0.2 m proud, a dark recess over
 *    each window; the top window is taller;
 *  - stone Haparandaweg front (w03-320, 2021): limestone panels with a cantilevered ledge at every floor (3.8 ... 21.2),
 *    five columns of 1.75 x 2.0 windows, glazed ground storey;
 *  - SW face (w01-230, 2024 + 2020): the tall block's end with one column, a three-storey middle (doors on the ground,
 *    two rows) and the four-storey quay block's end with one column;
 *  - quay fronts (w04-140 2018 brick, w05-140 2017 stone): four columns, glazed ground storey, glass-railed balconies on
 *    the first floor (two on the brick block, one long one on the stone block);
 *  - the stair from the quay up to the garden deck between them (w06-140, 2021);
 *  - long white balconies with glass rails on the tall blocks' courtyard faces (w01-230, w06-140).
 * INFERRED: the courtyard faces' window rhythm (seen only obliquely), the garden deck's planting.
 */
const src = raw as unknown as ShellSource & {facadeRing: number[][]};
const R = src.facadeRing.map(p => [p[0], p[1]] as V2);
/** The split between the brick corner block (SW, positive side) and the limestone block (NE): the jog in the Haparandaweg
 * front (ring vertex 2) and the stair recess on the quay (between vertices 11 and 12). */
const SPLIT_A: V2 = [-10.4, -15.1], SPLIT_B: V2 = [13.3, 15.6];
const isBrick = (p: V2) => sideOf(p, SPLIT_A, SPLIT_B) > 0;
/** Party wall with De Rede: ring edge 17 -> 0. */
const PARTY_A = R[17], PARTY_B = R[0];
const FLOORS = [3.8, 6.7, 9.6, 12.5, 15.4, 18.3, 21.2, 24.1];
const roofs = src.surfaces.filter(s => s.type === 'RoofSurface');

let b: BuildingTools;

/** Wall top at t on a ring-edge frame: the highest roof just inside the wall. */
function topAt(f: Frame, t: number): number {
  const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.4, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.4;
  return roofHeightAt(src.surfaces as never, x, z) ?? 0;
}
/** Ring-edge frame moved onto the shell wall (3DBAG eaves offset). */
function front(i: number): {f: Frame; len: number} {
  const {f, len} = ringFrame(R, i), off = eaveOffset(R, roofs, i);
  return {f: {...f, origin: [f.origin[0] + f.n[0] * off, f.origin[1] + f.n[1] * off]}, len};
}
let WALLS: RawWall[] = [];
const hostAt = (f: Frame, t: number, y: number, h: number, half: number) => hostOn(WALLS, f, t, y, h, half);
/** A French window (frame ring, glass, mullion, balustrade rail) hosted on the shell piece at ring-edge position t; where
 * the opening straddles a seam between two coplanar 3DBAG pieces it is drawn on the edge frame itself (moved onto the
 * shell by its eaves offset), so a split front keeps its full column count. */
function win(f: Frame, t: number, y: number, w: number, h: number, frame = 'frame', head = false, fallback = true) {
  const host = hostAt(f, t, y, h + (head ? 0.4 : 0), w / 2 + 0.1);
  let F = f, T = t;
  if (!host && !fallback) return false;
  if (host) {
    if (!shellWindow(b, host.w, host.tw, y, w, h, {frame, mullion: true, rail: frame})) return false;
    F = host.w.f; T = host.tw;
  } else {
    quad(b, f, t, y - 0.09, w + 0.18, h + 0.18, frame, 0.02);
    sill(b, f, t, y - 0.09, w + 0.18, frame);
    quad(b, f, t, y, w, h, 'glass', 0.04);
    quad(b, f, t, y, 0.08, h, frame, 0.06);
    quad(b, f, t, y + 0.95, w, 0.06, frame, 0.06);
  }
  if (head) quad(b, F, T, y + h + 0.09, w + 0.4, 0.3, 'dark', 0.02);                               // shadowed recess head
  return true;
}
function groundBay(f: Frame, t: number, w: number, h = 3.2, frame = 'dark', fallback = true) {
  const host = hostAt(f, t, 0.1, h, w / 2 + 0.1);
  let F = f, T = t;
  if (!host && !fallback) return;
  if (host) {
    if (!claimOpening(host.w, host.tw - w / 2, host.tw + w / 2, 0.1, 0.1 + h, 0.08)) return;
    F = host.w.f; T = host.tw;
  }
  quad(b, F, T, 0.05, w + 0.16, h + 0.08, frame, 0.02);
  sill(b, F, T, 0.05, w + 0.16, frame);
  quad(b, F, T, 0.1, w, h - 0.05, 'glass', 0.04);
  for (const k of [-0.25, 0.25]) quad(b, F, T + k * w, 0.1, 0.07, h - 0.05, frame, 0.06);
}

/** House numbers in light metal digits on a dark transom panel over an entrance bay. */
function numbers(f: Frame, t: number, text: string) {
  const host = hostAt(f, t, 0.1, 3.2, 1.0), F = host ? host.w.f : f, T = host ? host.tw : t;
  quad(b, F, T, 2.5, 1.8, 0.65, 'dark', 0.07);
  wallLetters(b, F, text, T, 2.6, 0.32, 1.6, 'gold', 0.2, 0.03);
}

/**
 * Brick Haparandaweg front (ring edge 3): 3DBAG cuts it into pieces 0.0-0.13 m off the BAG line, so it is a 0.6 m brick skin
 * 0.25 m proud of the line (covering the pieces) carrying the grid of piers and bands, five columns, eight storeys.
 */
function brickFront() {
  const {f, len} = ringFrame(R, 3), cols = columns(len, 2.9, 1.5), O = 0.25;
  const top = Math.min(...[0.5, len / 2, len - 0.5].map(t => topAt(f, t)));
  slab(b, f, len / 2, 0, len - 0.12, top + 0.08, 0.6 + O, 'brick', -0.6);   // ends 6 cm inside the side walls, top 8 cm over the roof (no coplanar faces)
  const W = (t: number, y: number, w: number, h: number, frame: string) => {
    quad(b, f, t, y - 0.09, w + 0.18, h + 0.18, frame, O + 0.045);
    sill(b, f, t, y - 0.09, w + 0.18, frame, O);
    quad(b, f, t, y, w, h, 'glass', O + 0.09);
    quad(b, f, t, y, 0.08, h, frame, O + 0.135);
  };
  for (const t of cols) for (const [k, y] of FLOORS.entries()) {
    const h = k === FLOORS.length - 1 ? 2.75 : 2.15;
    if (y + 0.3 + h > top - 0.45) continue;
    W(t, y + 0.3, 1.55, h, 'frame');
    quad(b, f, t, y + 0.3 + h + 0.09, 1.95, 0.3, 'dark', O + 0.045);                              // shadowed recess head
  }
  // the grid: piers between and beside the columns, a band at every floor, a coping
  const edges = [0.15, ...cols.slice(1).map((t, k) => (t + cols[k]) / 2), len - 0.15];
  for (const t of edges) slab(b, f, t, FLOORS[0], t === edges[0] || t === edges.at(-1) ? 0.3 : 0.6, top - 0.35 - FLOORS[0], 0.2, 'brick', O);
  for (const y of FLOORS.slice(0, -1)) ledgeStrip(b, f, len / 2, y - 0.05, len - 0.1, 0.32, 0.24, 'brick', O);
  ledgeStrip(b, f, len / 2, top - 0.45, len - 0.1, 0.45, 0.26, 'brick', O);
  // glazed ground storey: entrance in the middle bay with the house numbers over it, glass bays either side
  for (const t of cols) {
    quad(b, f, t, 0.05, 2.36, 3.28, 'dark', O + 0.045);
    sill(b, f, t, 0.05, 2.36, 'dark', O);
    quad(b, f, t, 0.1, 2.2, 3.15, 'glass', O + 0.09);
    for (const k of [-0.25, 0.25]) quad(b, f, t + k * 2.2, 0.1, 0.07, 3.15, 'dark', O + 0.135);
  }
  quad(b, f, cols[2], 2.5, 1.8, 0.65, 'dark', O + 0.18);
  wallLetters(b, f, '650-678', cols[2], 2.6, 0.32, 1.6, 'gold', O + 0.225, 0.03);
}

/** Limestone Haparandaweg front (ring edge 1): cantilevered ledge at every floor, five columns of wider windows. */
function stoneFront() {
  const {f, len} = front(1), cols = columns(len, 2.8, 1.5);
  const top = Math.min(...[0.5, len / 2, len - 0.5].map(t => topAt(f, t)));
  const ledges = FLOORS.filter(y => y < top - 4);
  for (const y of ledges) slab(b, f, len / 2, y - 0.12, len, 0.24, 0.45, 'stone');
  for (const t of cols) for (const y of [...ledges, ledges.at(-1)! + 2.9]) {
    if (y + 0.12 + 2.0 > top - 0.5) continue;
    win(f, t, y + 0.12, 1.75, 2.0);
  }
  cols.forEach((t, k) => groundBay(f, t, k === 2 ? 1.6 : 2.3, 3.3));
  numbers(f, cols[2], '680-706');
}

/**
 * Quay fronts (ring edges 9 brick, 13 stone): 3DBAG sets their upper parts 0.3-0.44 m behind the ground storey in pieces
 * (the balconies read as a set-back), while the panoramas show one flush face, so each is a 0.55 m skin on the BAG line,
 * 0.1 m proud of the shell, to the parapet (13.6 / 13.5 m), carrying four columns, three rows, the glazed ground storey
 * and the first-floor balconies.
 */
function quayFront(i: number, brick: boolean) {
  const {f, len} = ringFrame(R, i), cols = columns(len, 2.8, 1.5), top = brick ? 13.6 : 13.5, O = 0.1;
  const wall = brick ? 'brick' : 'stone';
  slab(b, f, len / 2, 0, len - 0.12, top + 0.12, 0.55 + O, wall, -0.55);
  slab(b, f, len / 2, top + 0.12, len - 0.04, 0.1, 0.1, 'concrete', O - 0.05);                       // coping
  for (const t of cols) {
    for (const y of FLOORS.slice(0, 3)) {
      quad(b, f, t, y + 0.3 - 0.09, 1.78, 2.28, 'frame', O + 0.045);
      sill(b, f, t, y + 0.3 - 0.09, 1.78, 'frame', O);
      quad(b, f, t, y + 0.3, 1.6, 2.1, 'glass', O + 0.09);
      quad(b, f, t, y + 0.3, 0.08, 2.1, 'frame', O + 0.135);
    }
    quad(b, f, t, 0.05, 2.36, 3.0, brick ? 'frame' : 'dark', O + 0.045);
    sill(b, f, t, 0.05, 2.36, brick ? 'frame' : 'dark', O);
    quad(b, f, t, 0.1, 2.2, 2.9, 'glass', O + 0.09);
    for (const k of [-0.25, 0.25]) quad(b, f, t + k * 2.2, 0.1, 0.07, 2.9, brick ? 'frame' : 'dark', O + 0.135);
  }
  if (brick) {
    slabBalcony(b, f, cols[0] - 1.25, cols[1] + 1.25, FLOORS[0], 1.25 + O, {slab: 'pink'});
    slabBalcony(b, f, cols[2] - 1.25, cols[3] + 1.25, FLOORS[0], 1.25 + O, {slab: 'pink'});
    for (const y of FLOORS.slice(1, 3)) ledgeStrip(b, f, len / 2, y - 0.05, len - 0.1, 0.2, 0.08, 'brick', O);
  } else slabBalcony(b, f, 0.1, len - 0.1, FLOORS[0], 1.2 + O, {slab: 'pink'});
}

/** SW face (ring edge 8): measured columns on w01-230 (m from the NW corner), rows where the wall stands. */
function swFace() {
  const {f} = front(8);
  for (const t of [2.0, 7.2, 10.3, 13.4, 16.6, 20.6, 24.4]) {
    const top = topAt(f, t);
    for (const y of FLOORS) if (y + 0.05 + 2.15 <= top - 0.5) win(f, t, y + 0.05, 1.45, 2.15, 'frame', false, false);
    if (t !== 24.4) { const h = hostAt(f, t, 0.15, 2.6, 0.55); if (h) shellWindow(b, h.w, h.tw, 0.15, 0.9, 2.6, {frame: 'frame', glass: 'dark'}); }
  }
  for (const y of FLOORS.slice(0, 2)) ledgeStrip(b, f, 12, y - 0.4, 12.5, 0.25, 0.1, 'brick');            // under the sills
}

/** The steps from the quay up to the garden deck, in the recess between the two quay blocks (w06-140). */
function stair() {
  const mouthA = R[10], mouthB = R[13], back = R[11];
  const len = Math.hypot(mouthB[0] - mouthA[0], mouthB[1] - mouthA[1]);
  const tangent: V2 = [(mouthB[0] - mouthA[0]) / len, (mouthB[1] - mouthA[1]) / len];
  let n: V2 = [tangent[1], -tangent[0]];
  if ((back[0] - mouthA[0]) * n[0] + (back[1] - mouthA[1]) * n[1] > 0) n = [-n[0], -n[1]];       // n points out of the recess
  // keep the viewer's-right convention: tangent = (n.z, -n.x)
  const t2: V2 = [n[1], -n[0]], origin: V2 = t2[0] * tangent[0] + t2[1] * tangent[1] > 0 ? mouthA : mouthB;
  const f: Frame = {origin, tangent: t2, n};
  const run = Math.abs((back[0] - mouthA[0]) * n[0] + (back[1] - mouthA[1]) * n[1]);
  stairFlight(b, f, 0.05, len - 0.05, run - 0.05, 4.2, 'stone', 16);
}

/** Generic dressing of the remaining shell walls (courtyard faces, set-back tops, recess cheeks). */
function otherWalls() {
  const dressed = [1, 3, 8, 9, 13].map(i => [R[i], R[(i + 1) % R.length]] as [V2, V2]);
  for (const w of shellWalls(src, 2.4, 2.4)) {
    const m = midOf(w);
    if (lineDist(m, PARTY_A, PARTY_B) < 0.7 && Math.abs(((w.bearing - 50 + 540) % 360) - 180) < 10) continue;   // party wall
    if (dressed.some(([a, c]) => lineDist(m, a, c) < 0.8 && Math.min(Math.hypot(m[0] - a[0], m[1] - a[1]), Math.hypot(m[0] - c[0], m[1] - c[1])) < Math.hypot(c[0] - a[0], c[1] - a[1]))) continue;
    if (w.base > 28) continue;                                                                     // plant rooms on the roof
    const brick = isBrick(m), cols = columns(w.len, 2.9, 1.1);
    const sills = FLOORS.map(y => y + 0.3).filter(y => y >= w.base + 0.25);
    shellRows(b, w, cols, sills, brick ? 1.5 : 1.7, 2.1, {mullion: true, rail: 'frame'});
    if (w.base < 0.5) for (const t of cols) shellWindow(b, w, t, 0.1, 1.2, 2.6, {frame: 'dark'});
    // long balconies on the tall blocks' courtyard faces
    const court = Math.abs(((w.bearing - 140 + 540) % 360) - 180) < 15 && w.base >= 4 && w.top > 15;
    if (court && w.len > 3.5) for (const y of FLOORS) if (y >= w.base + 2.4 && y + 1.2 < w.top - 0.3) slabBalcony(b, w.f, 0.3, w.len - 0.3, y, 1.6, {slab: 'pink'});
  }
}

export function buildBlok0Ij4you(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  const wallCol = (s: Surface) => (isBrick(centroidXZ(s)) ? 'brick' : 'stone');
  const roofCol = (s: Surface) => (Math.max(...s.rings[0].map(p => p[1])) < 6 ? 'green' : 'concrete');
  for (const [key, g] of shellGroups(src, wallCol, roofCol)) addShellTess(b, g, {wall: key.slice(2), roof: key.slice(2)});
  beginFacade(src);
  WALLS = shellWalls(src, 0.8, 1.5);
  setSink(0.3, true);
  brickFront();
  stoneFront();
  quayFront(9, true);
  quayFront(13, false);
  swFace();
  stair();
  otherWalls();
  setSink(0);
}
