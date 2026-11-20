import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, planarPolygon, type Surface} from './worship-shell';
import {facePanel, getSink, leanSlab, letters, put, roofHeightAt, setSink, slab, wallProbe, type Frame} from './nearbar-kit';
import source from './kramatplantsoen-footprints.json';

/**
 * FLEVOPOORT, KRAMATPLANTSOEN 1-201 / ZEEBURGERDIJK (BAG pand 0363100012098925, 1998, Indische Buurt): the 36 m housing
 * block over the Flevopoort service centre and the Gezondheidscentrum Oosthoek. Architect not found in open sources
 * (kramatplantsoen-brief.md). Massing: the 3DBAG LoD2.2 shell (kramatplantsoen-footprints.json, bag-shell-prepare.ts).
 * Read from rectified Gemeente Amsterdam panoramas (CC BY 4.0), per item in kramatplantsoen-inventory.json; the state drawn
 * is the 2024 one (recording_2024-09-16_07-18-19_03199): the 2025 panoramas show the west slab wrapped in scaffolding for
 * the Ymere facade renovation, whose result no open panorama shows yet.
 *  - three staggered eleven-storey slabs in sand-ochre render, every long face a grid of white-framed windows in pairs, one
 *    of each pair a French window with a railing, alternating side storey by storey (w02-270, w07-270, v01 2024);
 *  - red-brown brick stair and lift shafts at the slab junctions, rising above the roofs, with dark grey glazed lobby
 *    strips beside them (w01-90 2017, w14-179, w15-270, w10-180);
 *  - blank greyer render end walls; on the north end a white flue shaft standing proud and above the roof between two
 *    dark glazed slots (w03-0, recording_2025-06-16_08-26-12_00956);
 *  - the one-storey plinth: glass ribbons with a thin white canopy band and a frit-glass clerestory over it (w01-90,
 *    w07-270, w10-180, w18-359), an anthracite brick box at the north-east corner (w13-90, w18-359), and the north wing
 *    in grey horizontally ribbed metal with the giant FLEVOPOORT letters along the Flevoweg (w03-0).
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;
type Col = Parameters<BuildingTools['add']>[1];

/** Housing floors: the first floor line over the 4.2 m plinth roof, storey height, count (w02-270: 11 window rows). */
const FLOOR0 = 4.3, STOREY = 2.85, FLOORS = 11;
/** Window pairs (w02-270 rectified at the storey scale): windows 1.9 m wide, 0.5 m apart, pairs about 6.8 m apart. */
const WIN_W = 1.9, PAIR_GAP = 0.5, PAIR_PITCH = 6.8;
/**
 * Every opening part is a solid standing on the wall (the audit joins parts within 3 cm and wants each assembly to touch its
 * wall): frame sheet 4.5 cm deep, glass 9 cm, mullion 13.5 cm, rail 18 cm, so no two facing planes come under 3 cm apart even
 * after the export's position quantisation (about 7 mm over this 120 m model).
 */
const SHEET = 0.045, GLASS_D = 0.09, BAR_D = 0.135, RAIL_D = 0.18;

const P = (f: Frame, t: number, o = 0): [number, number] => [f.origin[0] + f.tangent[0] * t + f.n[0] * o, f.origin[1] + f.tangent[1] * t + f.n[1] * o];
const bearingOf = (f: Frame) => (Math.atan2(f.n[0], -f.n[1]) * 180 / Math.PI + 360) % 360;
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const eastWest = (brg: number) => angDiff(brg, 90) < 30 || angDiff(brg, 270) < 30;

const probe = wallProbe(src.surfaces.filter(s => s.type === 'WallSurface').map(s => planarPolygon(s.rings)).filter((g): g is T.BufferGeometry => !!g));
/** True when the shell wall lies within 6 cm of frame f over the rectangle (corners, edge midpoints, centre). */
function walled(f: Frame, t0: number, t1: number, y0: number, y1: number): boolean {
  for (const t of [t0, (t0 + t1) / 2, t1]) for (const y of [y0, (y0 + y1) / 2, y1]) {
    const o = probe.offset(f, t, y);
    if (o === null || Math.abs(o) > 0.06) return false;
  }
  return true;
}

/** The north flue shaft standing proud of the north end wall (3DBAG roof piece at 35.5-35.7 m, x -9.3..-6.3, z -52.6..-46.1). */
const SHAFT = {x0: -9.3, x1: -6.3, z0: -52.6, z1: -46.1};
const inShaft = (x: number, z: number) => x > SHAFT.x0 - 0.2 && x < SHAFT.x1 + 0.2 && z > SHAFT.z0 - 0.2 && z < SHAFT.z1 + 0.05;
/** North wing (FLEVOPOORT, roof 3.5 m) and the north-east anthracite brick box. */
const northWing = (x: number, z: number) => z < -45.5 && x < 9.5;
const brickBox = (x: number, z: number) => x > 28.5 && z < -38.9;

type WallInfo = {f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; brg: number; lower: number | null};
function wallInfo(s: Surface): WallInfo | null {
  const r = s.rings[0], ys = r.map(p => p[1]), yt = Math.max(...ys), yb = Math.min(...ys);
  let nx = 0, nz = 0;
  for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
  const nl = Math.hypot(nx, nz);
  if (nl < 1e-6) return null;
  let n: [number, number] = [nx / nl, nz / nl];
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  const front0 = roofHeightAt(src.surfaces, cx + n[0] * 0.5, cz + n[1] * 0.5), back0 = roofHeightAt(src.surfaces, cx - n[0] * 0.5, cz - n[1] * 0.5);
  const swap = (front0 ?? -1) > (back0 ?? -1);
  if (swap) n = [-n[0], -n[1]];
  const lower = swap ? back0 : front0;
  const tangent: [number, number] = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts), len = Math.max(...ts) - t0;
  const off = cx * n[0] + cz * n[1];
  const f: Frame = {origin: [tangent[0] * t0 + n[0] * off, tangent[1] * t0 + n[1] * off], tangent, n};
  return {f, len, yb, yt, cx, cz, brg: bearingOf(f), lower};
}

type Kind = 'facade' | 'lobby' | 'end' | 'brick' | 'shaft' | 'plant' | 'plinth' | 'metal' | 'anthracite';
function kindOf(w: WallInfo): Kind {
  if (inShaft(w.cx, w.cz) && w.yt > 30) return 'shaft';
  if (w.yt > 38.5 && w.yb > 36) return w.yt < 39.6 ? 'plant' : 'brick';
  if (w.yt > 37.4) return 'brick';
  if (w.yt < 8) return northWing(w.cx, w.cz) ? 'metal' : brickBox(w.cx, w.cz) && !(angDiff(w.brg, 90) < 30 && w.cx > 34) ? 'anthracite' : 'plinth';
  if (w.yb > 36) return 'facade'; // the 1 m parapet step on the north slab: render
  if (eastWest(w.brg)) return w.len >= 6 ? 'facade' : 'lobby';
  return 'end';
}
const COLOUR: Record<Kind, Col> = {
  facade: 'sandstone', lobby: 'dark', end: 'stone', brick: 'brick', shaft: 'concrete', plant: 'bronze', plinth: 'concrete', metal: 'bronze', anthracite: 'greyBrick',
};

export function buildKramatplantsoen(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map(s => (s.type === 'WallSurface' ? wallInfo(s) : null));
  addShell(b, src as never, {
    wall: 'sandstone', roof: 'slate',
    wallFor: (_s, i) => { const w = infos[i]; return w ? COLOUR[kindOf(w)] as string : 'sandstone'; },
  });
  const sink0 = getSink();
  setSink(0.06, true);
  infos.forEach(w => {
    if (!w || w.len < 1) return;
    const k = kindOf(w);
    if (k === 'facade' && w.yb < 30) facade(b, w);
    else if (k === 'lobby') lobby(b, w);
    else if (k === 'end') endWall(b, w);
    else if (k === 'plinth') plinth(b, w);
    else if (k === 'metal') metal(b, w);
  });
  northShaft(b);
  setSink(sink0);
}

/** Ground storey under a slab that comes down to the pavement (south end, w08-179): grey ribbed cladding like the north wing. */
function groundUnder(b: BuildingTools, w: WallInfo) {
  if (w.yb > 1 || w.len < 2) return;
  if (eastWest(w.brg)) glazing(b, w.f, 0.2, w.len - 0.2, 4.1);
  else ribs(b, w.f, 0, w.len, 0.2, 4.0);
}

/** Long render face: eleven storeys of window pairs, one French window with a railing per pair, alternating per storey. */
function facade(b: BuildingTools, w: WallInfo) {
  groundUnder(b, w);
  const {f, len} = w;
  const margin = 1.3, nb = Math.max(1, Math.round((len - 2 * margin) / PAIR_PITCH)), pitch = (len - 2 * margin) / nb;
  for (let j = 0; j < nb; j++) {
    const c = margin + (j + 0.5) * pitch;
    for (let s = 0; s < FLOORS; s++) {
      const y0 = FLOOR0 + s * STOREY;
      for (const side of [-1, 1]) {
        const t = c + side * (WIN_W + PAIR_GAP) / 2;
        // French window on the left of the pair on even storeys, on the right on odd ones; every third pair starts the other way
        const french = (side < 0) === ((s + j) % 2 === 0);
        window(b, f, t, y0, french);
      }
    }
  }
}

function window(b: BuildingTools, f: Frame, t: number, y0: number, french: boolean) {
  const sill = french ? y0 + 0.1 : y0 + 0.85, h = french ? 2.1 : 1.35, w = WIN_W;
  if (!walled(f, t - w / 2 - 0.05, t + w / 2 + 0.05, sill - 0.05, sill + h + 0.05)) return;
  // onto the 3DBAG wall itself (its plane wanders a few cm from the polygon's mean plane)
  const o = probe.offset(f, t, sill + h / 2) ?? 0;
  // white frame sheet, the glass over it inset 10 cm, one mullion splitting a wide fixed light from the casement
  slab(b, f, t, sill, w, h, SHEET, 'frame', o);
  leanSlab(b, f, t, sill + 0.1, w - 0.2, h - 0.2, GLASS_D, 'glass', o);
  leanSlab(b, f, t - w / 2 + 0.62 * w, sill + 0.1, 0.09, h - 0.2, BAR_D, 'frame', o);
  if (french) {
    // railing over the lower part: top rail and mid rail in front of the mullion
    leanSlab(b, f, t, sill + 0.95, w - 0.1, 0.05, RAIL_D, 'frame', o);
    leanSlab(b, f, t, sill + 0.5, w - 0.1, 0.04, RAIL_D, 'frame', o);
  } else {
    slab(b, f, t, sill - 0.06, w + 0.1, 0.06, SHEET + 0.04, 'stone', o);
  }
}

/** Dark grey lobby strip beside the brick shafts: dark panels with a glazed band per storey (w01-90 2017, w14-179). */
function lobby(b: BuildingTools, w: WallInfo) {
  groundUnder(b, w);
  const {f, len} = w;
  if (len < 1) return;
  for (let s = 0; s < FLOORS; s++) {
    const y0 = FLOOR0 + s * STOREY;
    if (!walled(f, 0.15, len - 0.15, y0 + 0.2, y0 + STOREY - 0.2)) continue;
    const o = probe.offset(f, len / 2, y0 + STOREY / 2) ?? 0;
    slab(b, f, len / 2, y0 + 0.1, len - 0.1, STOREY - 0.2, SHEET, 'dark', o);
    leanSlab(b, f, len / 2, y0 + 1.0, len - 0.4, 1.5, GLASS_D, 'glass', o);
  }
}

/** Blank end walls; on the north end the two dark glazed slots beside the white flue shaft (w03-0). */
function endWall(b: BuildingTools, w: WallInfo) {
  groundUnder(b, w);
  const {f, len} = w;
  if (Math.abs(w.cz + 46) < 0.6 && w.yt > 30) {
    // slot at the end of this wall nearest the shaft
    const a = P(f, 0), c = P(f, len);
    const sx = (SHAFT.x0 + SHAFT.x1) / 2;
    const tSlot = Math.abs(a[0] - sx) < Math.abs(c[0] - sx) ? 0.15 + 0.65 : len - 0.15 - 0.65;
    for (let s = 0; s < FLOORS; s++) {
      const y0 = FLOOR0 + s * STOREY;
      if (!walled(f, tSlot - 0.65, tSlot + 0.65, y0, y0 + STOREY)) continue;
      const o = probe.offset(f, tSlot, y0 + STOREY / 2) ?? 0;
      slab(b, f, tSlot, y0 + 0.02, 1.3, STOREY - 0.04, SHEET, 'dark', o);
      leanSlab(b, f, tSlot, y0 + 0.9, 1.0, 1.6, GLASS_D, 'glass', o);
    }
  }
  // the roof edge: a thin coping, 5 cm over the 3DBAG roof
  if (w.yt > 30 && w.yt < 37) slab(b, f, len / 2, w.yt - 0.3 + 0.05, len, 0.3, 0.06, 'stone');
}

/** Plinth fronts: glass ribbon on grey mullions, thin white canopy band, frit-glass clerestory, coping (w01-90, w07-270). */
function plinth(b: BuildingTools, w: WallInfo) {
  const {f, len, yt} = w;
  if (len < 2 || yt < 2.8) return;
  glazing(b, f, 0.15, len - 0.15, yt);
}
function glazing(b: BuildingTools, f: Frame, t0: number, t1: number, yt: number) {
  const len = t1 - t0, bay = 1.6, nb = Math.max(1, Math.round(len / bay)), bw = len / nb;
  const canopy = Math.min(3.0, yt - 0.9);
  for (let j = 0; j < nb; j++) {
    const a = t0 + j * bw, c = a + bw, m = (a + c) / 2;
    if (!walled(f, a - 0.02, c + 0.02, 0.1, yt - 0.3)) continue;
    const o = probe.offset(f, m, canopy / 2) ?? 0;
    // each bay a grey frame sheet on the wall with its glass inset 5 cm proud of it (the mullions are the sheet borders)
    slab(b, f, m, 0.1, bw - 0.02, canopy - 0.1, SHEET, 'frame', o);
    leanSlab(b, f, m, 0.18, bw - 0.16, canopy - 0.26, GLASS_D, 'glass', o);
    // frit-glass clerestory panels, the bay joints left as wall
    if (yt - canopy > 0.7) leanSlab(b, f, m, canopy + 0.18, bw - 0.12, yt - canopy - 0.56, SHEET, 'blue', o);
  }
  // canopy band and coping in pieces of at most 12 m
  const pieces = Math.max(1, Math.ceil(len / 12)), pw = len / pieces;
  for (let k = 0; k < pieces; k++) {
    const m = t0 + (k + 0.5) * pw;
    if (!walled(f, m - 0.3, m + 0.3, canopy - 0.2, canopy + 0.2)) continue;
    slab(b, f, m, canopy, pw, 0.14, 0.75, 'concrete');
    slab(b, f, m, yt - 0.3 + 0.05, pw, 0.3, 0.08, 'concrete');
  }
}

/** Grey horizontally ribbed metal of the north wing; FLEVOPOORT along its Flevoweg face (w03-0, recording_2025-06-16_08-26-12_00956). */
function metal(b: BuildingTools, w: WallInfo) {
  const {f, len, yt} = w;
  if (len < 1.5) return;
  ribs(b, f, 0.1, len - 0.1, 0.25, yt - 0.25);
  if (angDiff(w.brg, 0) < 20 && len > 25) {
    // ten letters about 2.1 m tall over the whole face, a letter's gap between FLEVO and POORT
    const word = 'FLEVOPOORT', step = (len - 3) / 11;
    [...word].forEach((ch, i) => letters(b, f, ch, 1.5 + step * (i + (i >= 5 ? 1 : 0)) + step / 2, 0.6, 0.06, 0.3, 0.03, 'dark', 0.3));
  }
}
function ribs(b: BuildingTools, f: Frame, t0: number, t1: number, y0: number, y1: number) {
  const len = t1 - t0, pieces = Math.max(1, Math.ceil(len / 12)), pw = len / pieces;
  for (let y = y0; y < y1; y += 0.42) for (let k = 0; k < pieces; k++) {
    const m = t0 + (k + 0.5) * pw;
    if (!walled(f, m - pw / 2 + 0.1, m + pw / 2 - 0.1, y, y + 0.05)) continue;
    leanSlab(b, f, m, y, pw, 0.06, 0.04, 'bronze');
  }
}

/** The north flue shaft carried above the roof (the 3DBAG roof stops it at 35.7 m; w03-0 shows it standing clear of the
 * slab top) with three flue pipes. */
function northShaft(b: BuildingTools) {
  const top = 38.6, x = (SHAFT.x0 + SHAFT.x1) / 2, z = (SHAFT.z0 + 0.3 + SHAFT.z1) / 2;
  const w = SHAFT.x1 - SHAFT.x0 - 0.04, d = SHAFT.z1 - SHAFT.z0 - 0.34;
  b.add(new T.BoxGeometry(w, top - 35.6, d).translate(x, (top + 35.6) / 2, z), 'concrete');
  for (const dx of [-0.7, 0, 0.7]) b.add(new T.CylinderGeometry(0.16, 0.16, 1.4, 8).translate(x + dx, top + 0.7, z + d / 2 - 0.5), 'bronze');
}
void put;
