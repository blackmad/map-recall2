import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {ringFrame, roofHeightAt, slab, ledgeStrip, setSink, put, type Frame} from './nearbar-kit';
import {addShellTess, beginFacade, quad} from './big-facade';
import type {RawWall} from './big-kit';
import type {ShellSource} from './worship-shell';
import {columns, hostOn, shellGroups, shellRows, shellWalls, shellWindow, sill, wallLetters} from './houthavens-shell';
import raw from './de-rede-footprints.json';

/**
 * De Rede, Haparandaweg 708-744 / Houthavenkade (BAG pand 0363100012243292, bouwjaar 2015), part of Houthaven Blok 0.
 *
 * Identity: "de Rede 710-744" in white letters on the entrance transom of the Haparandaweg front (panorama
 * recording_2024-10-09_07-28-34_00521); OSM way 401424728 is named "de Rede"; BAG lists Haparandaweg 708-744 and Houthavenkade
 * addresses in this pand; Blok 0 plots 8/9 (blok0-ij4you, 650-706) stands against its SW side.
 *
 * Massing is the 3DBAG LoD2.2 shell (CC BY 4.0; native east/south metres, ground 0.68 m NAP): a deep narrow block from
 * the street to the quay, a shallow gable to 30.8 m on the street and two gabled quay houses to 17.5 m.
 * Facades measured on rectified Gemeente Amsterdam panoramas (CC BY 4.0; scripts/landmarks/de-rede-inventory.json):
 *  - Haparandaweg front (w01-320, 2024, 49.9 px/m both ways): white, ground storey 3.65 m then storeys of 3.0 m, gable
 *    shoulders 28.7, apex 30.8; three bays of white-framed full-height glazing set out irregularly per storey, black sliding
 *    louvre shutters in front of some lights, four olive-framed glazed boxes projecting about 0.6 m (storeys 2, 3, 5, 6),
 *    milky white panels with a clear strip in the top two storeys and the gable, entrance with the lettering, a garage grille;
 *  - quay front (w02-140, 2017, 50.2 px/m): two narrow gabled houses, light render, floor bands, per storey a mix of
 *    French windows with black Juliet rails, fixed lights and timber louvre shutters, timber boarding in the gables
 *    behind white mullions, white bargeboards, white doors with a glass top, a dark plinth under the solid piers;
 *  - SW recess cheek (w03-230): one French window with a Juliet rail high up.
 * INFERRED: the party walls (blank), the quay gables' boarding count.
 */
const src = raw as unknown as ShellSource & {facadeRing: number[][]};
type V2 = [number, number];
const R = src.facadeRing.map(p => [p[0], p[1]] as V2);
let b: BuildingTools;
let WALLS: RawWall[] = [];

/** Wall top at t on a ring-edge frame: the highest roof just inside the wall. */
function topAt(f: Frame, t: number): number {
  const x = f.origin[0] + f.tangent[0] * t - f.n[0] * 0.4, z = f.origin[1] + f.tangent[1] * t - f.n[1] * 0.4;
  return roofHeightAt(src.surfaces as never, x, z) ?? 0;
}

/**
 * A skin over a whole ring-edge front: 3DBAG splits each front into pieces (NW at t 6.1, SE per house) that a full-width
 * window would straddle, while the panoramas show one flush face; the skin runs 0.55 m into the shell and stands `O` proud,
 * its top following the shell's roof line 0.12 m above it, its ends 6 cm inside the side walls (no coplanar faces).
 */
function skin(f: Frame, len: number, O: number, colour: string) {
  const s = new T.Shape(), step = 0.25, n = Math.ceil((len - 0.12) / step);
  s.moveTo(0.06, 0);
  s.lineTo(len - 0.06, 0);
  for (let k = n; k >= 0; k--) {
    const t = 0.06 + (len - 0.12) * k / n;
    s.lineTo(t, topAt(f, Math.min(len - 0.3, Math.max(0.3, t))) + 0.12);
  }
  s.closePath();
  const g = new T.ExtrudeGeometry(s, {depth: 0.55 + O, bevelEnabled: false, curveSegments: 1});
  put(b, f, g, 0, 0, -0.55, colour);
}

type Item = [kind: string, x0: number, x1: number, top: number, bottom: number];
/** Photo item -> wall rectangle (t0, t1, y0, y1) for a crop with its own scale. */
type Map2 = (it: Item) => [number, number, number, number];

/** A glazed run: frame ring, sill, glass, mullions about every 1.25 m; `rail` adds a black Juliet balustrade. */
function glazing(f: Frame, O: number, t0: number, t1: number, y0: number, y1: number, o: {rail?: boolean; panel?: boolean; door?: boolean} = {}) {
  const w = t1 - t0, h = y1 - y0, c = (t0 + t1) / 2, ring = 0.07;
  quad(b, f, c, y0, w, h, 'frame', O + 0.045);
  sill(b, f, c, y0, w, 'frame', O);
  if (o.door) {
    quad(b, f, c, y0 + ring, w - 2 * ring, h - 1.2 - ring, 'white', O + 0.09);                    // white door leaf
    quad(b, f, c, y1 - 1.1, w - 2 * ring, 1.1 - ring, 'glass', O + 0.09);
    return;
  }
  if (o.panel) {
    // milky white panel with a clear strip at the top (the NW front's upper storeys and gable)
    quad(b, f, c, y0 + ring, w - 2 * ring, h - 2 * ring - 0.32, 'pink', O + 0.09);
    quad(b, f, c, y1 - ring - 0.25, w - 2 * ring, 0.25, 'glass', O + 0.09);
  } else quad(b, f, c, y0 + ring, w - 2 * ring, h - 2 * ring, 'glass', O + 0.09);
  const lights = Math.max(1, Math.round(w / 1.25));
  for (let k = 1; k < lights; k++) quad(b, f, t0 + (w * k) / lights, y0 + ring, 0.07, h - 2 * ring, 'frame', O + 0.135);
  if (o.rail) {
    // Juliet rail: top and bottom bars and balusters every 11 cm (copper slot = black metal)
    julietRail(f, c, w - 0.1, y0, O);
  }
}

/**
 * A black Juliet rail standing 0.15-0.2 m in front of the glazing: top and bottom bars and balusters every 11 cm (copper slot =
 * black metal). Not sunk: a bar run back into the wall would pierce the glass behind it.
 */
function julietRail(f: Frame, c: number, w: number, y0: number, O: number) {
  setSink(0);
  slab(b, f, c, y0 + 0.95, w, 0.04, 0.05, 'copper', O + 0.15);
  slab(b, f, c, y0 + 0.12, w, 0.04, 0.05, 'copper', O + 0.15);
  for (let t = c - w / 2 + 0.05; t < c + w / 2 - 0.04; t += 0.11) quad(b, f, t, y0 + 0.12, 0.018, 0.85, 'copper', O + 0.17);
  setSink(0.3, true);
}

/** A louvre shutter in front of the glazing: a panel with horizontal slats. */
function louvre(f: Frame, O: number, t0: number, t1: number, y0: number, y1: number, panel: string, slats: string, out = 0.18) {
  const c = (t0 + t1) / 2, w = t1 - t0;
  quad(b, f, c, y0, w, y1 - y0, panel, O + out);
  for (let y = y0 + 0.08; y < y1 - 0.05; y += 0.13) quad(b, f, c, y, w - 0.06, 0.035, slats, O + out + 0.045);
}

/** An olive-framed glazed box projecting `d` from the front, glass at its front rim (accent slot, not a wall window). */
function box(f: Frame, O: number, t0: number, t1: number, y0: number, y1: number, d: number, shutter?: [number, number]) {
  const w = t1 - t0, c = (t0 + t1) / 2, fr = 0.2;
  slab(b, f, c, y0, w, 0.3, d, 'green', O);
  slab(b, f, c, y1 - 0.25, w, 0.25, d, 'green', O);
  for (const e of [t0 + fr / 2, t1 - fr / 2]) slab(b, f, e, y0 + 0.3, fr, y1 - y0 - 0.55, d, 'green', O);
  const gy = y0 + 0.3, gh = y1 - y0 - 0.55;
  quad(b, f, c, gy, w - 2 * fr, gh, 'blue', O + d - 0.08);
  const lights = Math.max(1, Math.round((w - 2 * fr) / 1.1));
  for (let k = 1; k < lights; k++) quad(b, f, t0 + fr + ((w - 2 * fr) * k) / lights, gy, 0.06, gh, 'pink', O + d - 0.035);
  if (shutter) louvre(f, O, shutter[0], shutter[1], gy, gy + gh, 'slate', 'copper', d + 0.01);
}

/** The Haparandaweg front (ring edge 1). Items in crop pixels of w01-320 (49.9 px/m, ground at py 1510). */
function streetFront() {
  const {f, len} = ringFrame(R, 1), O = 0.1, s = 49.9;
  skin(f, len, O, 'white');
  const m: Map2 = it => [it[1] / s, Math.min(len - 0.08, it[2] / s), (1510 - it[4]) / s, (1510 - it[3]) / s];
  const items: Item[] = [
    // ground storey: glass and door of the SW bay, the entrance bay, the NE door, (garage below)
    ['g', 45, 170, 1340, 1505], ['g', 220, 355, 1335, 1505], ['d', 405, 475, 1335, 1505],
    ['g', 45, 170, 1190, 1320], ['g', 220, 350, 1190, 1320], ['g', 405, 615, 1190, 1320],
    ['g', 40, 370, 1040, 1170], ['g', 420, 470, 1040, 1170],
    ['g', 215, 375, 890, 1020], ['g', 405, 620, 890, 1020],
    ['g', 40, 170, 740, 870], ['g', 215, 370, 740, 870], ['g', 415, 620, 740, 870],
    ['g', 40, 350, 590, 725], ['g', 400, 465, 590, 725],
    ['w', 40, 185, 440, 575], ['w', 420, 620, 440, 575],
    ['w', 35, 250, 290, 420], ['g', 255, 375, 290, 420], ['w', 420, 615, 290, 420],
    ['w', 35, 190, 75, 265], ['g', 255, 370, 145, 265], ['w', 420, 620, 75, 265],
  ];
  for (const it of items) {
    const [t0, t1, y0, y1] = m(it);
    if (it[0] === 'd') glazing(f, O, t0, t1, y0, y1, {door: true});
    else glazing(f, O, t0, t1, y0, y1, {panel: it[0] === 'w'});
  }
  // black sliding louvres in front of single lights
  const louvres: [number, number, number, number][] = [
    [130, 160, 1190, 1320], [578, 610, 1190, 1320], [55, 82, 1040, 1170], [560, 620, 890, 1020], [55, 80, 740, 870],
    [500, 530, 740, 870], [125, 155, 590, 725], [255, 282, 290, 420], [330, 368, 145, 265],
  ];
  for (const [x0, x1, top, bot] of louvres) louvre(f, O, x0 / s, x1 / s, (1510 - bot) / s, (1510 - top) / s, 'slate', 'copper');
  // olive glazed boxes, 0.6 m deep
  const boxes: [number, number, number, number, [number, number] | undefined][] = [
    [475, 640, 1010, 1175, [490, 550]], [15, 185, 850, 1030, undefined], [470, 640, 545, 725, [575, 605]], [222, 390, 395, 580, [330, 360]],
  ];
  // each box stops 5 cm under the floor line above it (the glazing of the next storey starts there) and 0.15 m inside the corner
  const floors = [3.65, 6.65, 9.62, 12.67, 15.67, 18.68, 21.74, 24.8];
  for (const [x0, x1, top, bot, sh] of boxes) {
    const y0 = (1510 - bot) / s, y1 = Math.min((1510 - top) / s, floors.find(y => y > y0 + 1)! - 0.05);
    box(f, O, Math.max(0.15, x0 / s), Math.min(len - 0.15, x1 / s), y0, y1, 0.6, sh ? [sh[0] / s, sh[1] / s] : undefined);
  }
  // garage grille (NE bay)
  const g0 = 490 / s, g1 = 615 / s, gh = (1510 - 1360) / s;
  quad(b, f, (g0 + g1) / 2, 0.02, g1 - g0, gh, 'dark', O + 0.045);
  for (let t = g0 + 0.12; t < g1 - 0.05; t += 0.15) quad(b, f, t, 0.02, 0.025, gh, 'copper', O + 0.09);
  for (let y = 0.15; y < gh; y += 0.3) quad(b, f, (g0 + g1) / 2, y, g1 - g0, 0.025, 'copper', O + 0.09);
  // the name and numbers on a dark transom panel over the entrance (in the photo across the upper glass of the entrance bay)
  const lt = (275 + 350) / 2 / s, ly = (1510 - 1430) / s;
  setSink(0);
  slab(b, f, lt, ly, 1.9, 1.0, 0.08, 'dark', O + 0.1);                                           // panel in front of the entrance glass
  setSink(0.3, true);
  wallLetters(b, f, 'de Rede', lt, ly + 0.55, 0.32, 1.6, 'sandstone', O + 0.18, 0.03);
  wallLetters(b, f, '710-744', lt, ly + 0.12, 0.3, 1.6, 'sandstone', O + 0.18, 0.03);
}

/** Pre-drawn rake board from (t0, y0) to (t1, y1): a white box 0.28 m high and 0.12 m proud. */
function rake(f: Frame, O: number, t0: number, y0: number, t1: number, y1: number) {
  const L = Math.hypot(t1 - t0, y1 - y0), a = Math.atan2(y1 - y0, t1 - t0);
  const g = new T.BoxGeometry(L + 0.2, 0.28, 0.16).translate(0, -0.1, 0.08).rotateZ(a).translate((t0 + t1) / 2, (y0 + y1) / 2, 0);
  put(b, f, g, 0, 0, O, 'sandstone');                                                  // not the 'white' opening slot: a bargeboard rides past the wall
}

/** The quay front (ring edge 9): two gabled houses. Items in crop pixels of w02-140 (50.2 px/m, centred on the valley). */
function quayFront() {
  const {f, len} = ringFrame(R, 9), O = 0.1, s = 50.2;
  skin(f, len, O, 'stone');
  const T0 = (px: number) => Math.max(0.12, Math.min(len - 0.12, 4.75 + (px - 222) / s)), Y = (py: number) => (1515 - py) / 51.2;
  type Q = [kind: 'g' | 'r' | 'l' | 'd', x0: number, x1: number, top: number, bot: number];
  const F = [[1330, 1510], [1175, 1305], [1020, 1150], [870, 1000], [725, 850]];
  const rows: [number, ['g' | 'r' | 'l' | 'd', number, number][]][] = [
    [0, [['l', 8, 48], ['g', 50, 118], ['d', 155, 208], ['d', 237, 285], ['g', 323, 392], ['l', 395, 435]]],
    [1, [['l', 8, 48], ['g', 50, 118], ['r', 128, 168], ['r', 280, 318], ['g', 320, 375], ['l', 378, 416], ['g', 418, 436]]],
    [2, [['r', 8, 85], ['g', 88, 166], ['l', 170, 210], ['l', 242, 282], ['g', 284, 355], ['r', 360, 437]]],
    [3, [['r', 8, 43], ['l', 45, 85], ['r', 130, 210], ['r', 280, 322], ['g', 324, 360], ['l', 363, 398], ['r', 400, 437]]],
    [4, [['g', 8, 45], ['r', 48, 125], ['g', 128, 165], ['l', 168, 210], ['l', 240, 278], ['g', 280, 316], ['r', 318, 395], ['g', 397, 432]]],
  ];
  const all: Q[] = rows.flatMap(([k, list]) => list.map(([kind, x0, x1]) => [kind, x0, x1, F[k][0], F[k][1]] as Q));
  for (const [kind, x0, x1, top, bot] of all) {
    const t0 = T0(x0), t1 = T0(x1), y0 = kind === 'd' || bot >= 1505 ? 0.06 : Y(bot), y1 = Y(top);
    if (kind === 'l') {
      quad(b, f, (t0 + t1) / 2, y0, t1 - t0, y1 - y0, 'frame', O + 0.045);
      sill(b, f, (t0 + t1) / 2, y0, t1 - t0, 'frame', O);
      louvre(f, O, t0 + 0.05, t1 - 0.05, y0 + 0.05, y1 - 0.05, 'ochre', 'bronze', 0.09);
    } else glazing(f, O, t0, t1, y0, y1, {rail: kind === 'r', door: kind === 'd'});
  }
  // floor bands under each storey's sills
  for (const k of [1, 2, 3, 4]) ledgeStrip(b, f, len / 2, Y(F[k][1]) - 0.3, len - 0.14, 0.16, 0.06, 'stone', O);
  // dark plinth under the solid piers
  for (const [x0, x1] of [[122, 155], [208, 237], [285, 322], [436, 470]]) quad(b, f, (T0(x0) + T0(x1)) / 2, 0, T0(x1) - T0(x0), 0.8, 'dark', O + 0.045);
  // gables: shoulders, apexes and the valley from the shell, timber boarding behind white mullions, white bargeboards
  const sh = topAt(f, 0.3), ap1 = 2.45, ap2 = 7.1, va = 4.75, apY = Math.max(topAt(f, ap1), topAt(f, ap1 + 0.25)), vaY = topAt(f, va);
  for (const [a, c, p] of [[0, va, ap1], [va, len, ap2]] as const) {
    const ya = a === 0 ? sh : vaY, yc = c === len ? topAt(f, len - 0.3) : vaY, yp = apY;
    const base = Y(715), inset = 0.45;
    const s2 = new T.Shape();
    s2.moveTo(a + inset, base);
    s2.lineTo(c - inset, base);
    s2.lineTo(c - inset, yc - inset * 0.9);
    s2.lineTo(p, yp - inset * 1.1);
    s2.lineTo(a + inset, ya - inset * 0.9);
    s2.closePath();
    put(b, f, new T.ShapeGeometry(s2), 0, 0, O + 0.045, 'ochre');
    for (let t = a + inset + 0.8; t < c - inset - 0.3; t += 0.8) {
      const top = t < p ? ya + (yp - ya) * (t - a) / (p - a) : yp + (yc - yp) * (t - p) / (c - p);
      quad(b, f, t, base, 0.07, top - inset - base - 0.05, 'frame', O + 0.09);
    }
    ledgeStrip(b, f, (a + c) / 2, base - 0.12, c - a - 2 * inset, 0.12, 0.08, 'white', O);
    rake(f, O + 0.04, a, ya + 0.12, p, yp + 0.12);
    rake(f, O + 0.04, p, yp + 0.12, c, yc + 0.12);
  }
}

/** The SW recess cheek (ring edge 8, w03-230): one French window with a Juliet rail on the top storey. */
function recessCheek() {
  const {f, len} = ringFrame(R, 8);
  const h = hostOn(WALLS, f, len / 2 + 0.6, 12.6, 2.3, 0.55);
  if (!h) return;
  if (shellWindow(b, h.w, h.tw, 12.6, 0.9, 2.3, {frame: 'frame', mullion: true})) {
    julietRail(h.w.f, h.tw, 0.9, 12.6, 0);
  }
}

/**
 * The tall block's rear faces stepping down to the courtyard and the quay houses (bearing 100-180, above the 4.3 m deck): INFERRED rows of
 * French windows with the street front's storey heights, since the panoramas see them only from far below.
 */
function rearFaces() {
  const floors = [3.65, 6.65, 9.62, 12.67, 15.67, 18.68, 21.74, 24.8];
  for (const w of shellWalls(src, 2.4, 2.4)) {
    if (Math.abs(((w.bearing - 140 + 540) % 360) - 180) > 40 || w.base < 4) continue;              // 3DBAG splits them at odd bearings
    const cols = columns(w.len, 2.6, 1.0), sills = floors.map(y => y + 0.25).filter(y => y >= w.base + 0.25);
    shellRows(b, w, cols, sills, 1.5, 2.3, {frame: 'frame', mullion: true, rail: 'frame'});
  }
}

export function buildDeRede(_w: number, _d: number, tools: BuildingTools) {
  b = tools;
  for (const [key, g] of shellGroups(src, () => 'white', () => 'concrete')) addShellTess(b, g, {wall: key.slice(2), roof: key.slice(2)});
  beginFacade(src);
  WALLS = shellWalls(src, 0.8, 1.5);
  setSink(0.3, true);
  streetFront();
  quayFront();
  recessCheek();
  rearFaces();
  setSink(0);
}
