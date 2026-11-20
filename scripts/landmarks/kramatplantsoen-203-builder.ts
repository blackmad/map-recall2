import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, roofHeightAt, slab, type Frame} from './nearbar-kit';
import {
  addPolys, band, fabricAwning, face, flushFaces, opening, resetFaces, slotLoggia, strut,
  type Col, type Face, type FR, type OpenOpts,
} from './modern-front-kit';
import source from './kramatplantsoen-203-footprints.json';

/**
 * FLEVOHUIS, KRAMATPLANTSOEN 203-263 (BAG pand 0363100012087570, 1997, Indische Buurt): the care home and the housing
 * slab on its east side, north of the Flevopoort block (kramatplantsoen-builder.ts). Architect not found in open sources.
 * Massing: the 3DBAG LoD2.2 shell (kramatplantsoen-203-footprints.json, bag-shell-prepare.ts): every vertical rectangular
 * wall is rebuilt as a holed face (modern-front-kit.ts) so windows and loggias are cut, the rest of the shell (roofs, the odd
 * stepped wall) is drawn as it is. Fronts read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed per wall in
 * kramatplantsoen-203-inventory.json:
 *  - the U-shaped three-storey care home in buff brick over a dark red-brown plinth: on the Kramatplantsoen front (w02-283)
 *    brick piers every 6.3 m through the two lower storeys under a grey ledge, window pairs in every bay, the recessed
 *    entrance and the glazed common rooms; on the south street (w01-193) a two-storey front with a cream drop-arm awning over
 *    every window; plain end walls with one window per storey and a white rendered stair panel at the north end (w10, w14);
 *  - the eight-storey slab: three buff storeys (the third a continuous window ribbon between grey ledges) under five storeys
 *    of red brick with white-framed window pairs and recessed slot loggias whose concrete balconies with grey mesh panels
 *    stack out over the brick beside them (w03-90, w04-270, w11-90, w09-90); end walls with one slot window per storey
 *    (w12-192, w13-0) and white rendered stair towers with a glazed side at both ends (w15-0, w12-192 2022, w11-90);
 *  - the grey ribbed plant room on the slab roof, the roof terrace with its canopy on the low east part (w09-90), the curved
 *    glass entrance canopy (w03-90 2022) and the glazed one-storey link to the Flevopoort block (w06-192).
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// ---- palette names (materialOverrides in the spec give the measured colours) -------------------------------------
const BUFF: Col = 'sandstone', RED: Col = 'brick', PLINTH: Col = 'red', RENDER: Col = 'stone', LEDGE: Col = 'concrete';
const SPANDREL: Col = 'dark', LOGGIA: Col = 'greyBrick', METAL: Col = 'bronze', CLOTH: Col = 'pink', ROOF: Col = 'slate';

// ---- levels (y above the 0.75 m NAP ground) ------------------------------------------------------------------------
/** Slab: buff up to the ledge at 9.4 m, red brick over it; five red storeys (balcony slab tops) on a 2.75 m pitch (w11-90). */
const SLAB_BUFF_TOP = 9.4, FLOORS = [11.0, 13.75, 16.5, 19.25, 22.0], RECESS: [number, number] = [10.85, 24.7];
/** Red-zone windows: 1.4 m lights, sill 1.2 m over the floor, 1.4 m tall (w04-270 at 50 px/m). */
const RW = 1.4, R_SILL = 1.2, R_H = 1.4;
/** Slab buff storeys (w03-90 2016, scaled on the ledge pitch): ground windows with grey spandrels, first floor, the ribbon. */
const S1: [number, number] = [0.6, 3.0], S2: [number, number] = [4.6, 6.1], RIBBON: [number, number] = [7.4, 9.0];
const SLAB_LEDGES: [number, number][] = [[6.3, 6.5], [9.2, 9.4]];
/** Care home storeys (w02-283 2018 at 28.8 px/m vertical): window rows and the grey ledge over the piers. */
const L_ROWS: [number, number][] = [[0.6, 2.4], [4.3, 6.1], [8.1, 9.9]], L_LEDGE: [number, number] = [6.35, 6.6];

// ---- the shell's walls ---------------------------------------------------------------------------------------------
type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; brg: number; rect: boolean};
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
function wallInfo(s: Surface, i: number): WallInfo | null {
  const r = s.rings[0], ys = r.map(p => p[1]), yt = Math.max(...ys), yb = Math.min(...ys);
  let nx = 0, nz = 0;
  for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
  const nl = Math.hypot(nx, nz);
  if (nl < 1e-6) return null;
  let n: [number, number] = [nx / nl, nz / nl];
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  // outward is the side with the lower (or no) roof
  const front = roofHeightAt(src.surfaces, cx + n[0] * 0.5, cz + n[1] * 0.5) ?? -1, back = roofHeightAt(src.surfaces, cx - n[0] * 0.5, cz - n[1] * 0.5) ?? -1;
  if (front > back) n = [-n[0], -n[1]];
  const tangent: [number, number] = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts), t1 = Math.max(...ts), len = t1 - t0;
  const off = cx * n[0] + cz * n[1];
  const f: Frame = {origin: [tangent[0] * t0 + n[0] * off, tangent[1] * t0 + n[1] * off], tangent, n};
  // a rectangle in (t, y) up to a few centimetres (3DBAG ends differ slightly; extra vertices sit on the vertical edges):
  // every vertex on a vertical edge, the polygon filling its bounding box, and the wall plane flat
  let area = 0;
  for (let k = 0; k < r.length; k++) { const a = k, c = (k + 1) % r.length; area += ts[a] * r[c][1] - ts[c] * r[a][1]; }
  const rect = r.every((_, k) => Math.abs(ts[k] - t0) < 0.05 || Math.abs(ts[k] - t1) < 0.05)
    && Math.abs(area / 2) > 0.985 * len * (yt - yb) && r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08);
  return {i, f, len, yb, yt, cx, cz, brg: (Math.atan2(n[0], -n[1]) * 180 / Math.PI + 360) % 360, rect};
}

type Zone = 'slab' | 'white' | 'plant' | 'low' | 'link' | 'lowWhite';
/** White rendered stair towers: the slab's north (x 18.2-21.2) and south (x 23.4-26.4) ends, the care home's north end. */
const whiteN = (x: number, z: number) => x > 18.0 && x < 21.4 && z < -32.0;
const whiteS = (x: number, z: number) => x > 23.2 && x < 26.6 && z > 45.0;
const whiteL = (x: number, z: number) => x > -20.7 && x < -16.7 && z < -31.9;
function zoneOf(w: WallInfo): Zone {
  if (w.yb > 25.9) return 'plant';
  if (w.cx > 33.6 && w.yt < 5) return 'link';
  if (whiteN(w.cx, w.cz) || whiteS(w.cx, w.cz)) return 'white';
  if (whiteL(w.cx, w.cz)) return 'lowWhite';
  return w.yt > 20 ? 'slab' : 'low';
}
const near = (w: WallInfo, x: number, z: number, tol = 1.2) => Math.hypot(w.cx - x, w.cz - z) < tol;

export function buildKramatplantsoen203(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const rebuilt = new Set(infos.filter((w): w is WallInfo => !!w && w.rect && w.len > 0.3).map(w => w.i));
  addShell(b, src as never, {
    wall: BUFF, roof: ROOF,
    skip: (_s, i) => rebuilt.has(i),
    wallFor: (_s, i) => { const w = infos[i]; if (!w) return BUFF; const z = zoneOf(w); return z === 'plant' ? METAL : z === 'slab' ? RED : z === 'white' || z === 'lowWhite' ? RENDER : BUFF; },
  });
  resetFaces();
  for (const w of infos) {
    if (!w || !rebuilt.has(w.i)) continue;
    const z = zoneOf(w);
    if (z === 'slab') slabWall(b, w);
    else if (z === 'low') lowWall(b, w);
    else if (z === 'white') whiteTower(b, w);
    else if (z === 'lowWhite') plainFace(b, w, RENDER, true);
    else if (z === 'link') linkWall(b, w);
    else plantWall(b, w);
  }
  flushFaces(b);
  for (const w of infos) if (w && !rebuilt.has(w.i) && zoneOf(w) === 'plant') plantRibs(b, frOf(w), w.yb, w.yt);
  towerCaps(b);
  roofTerrace(b);
}

const frOf = (w: WallInfo): FR => ({f: w.f, len: w.len});
/** The wall's face split into colour bands (bottom to top), each clipped to the wall; returns the face covering y. */
function bands(w: WallInfo, cuts: [number, Col][]): (y: number) => Face {
  const F = frOf(w), faces: Face[] = [];
  let y = w.yb;
  for (const [top, c] of cuts) {
    const y1 = Math.min(top, w.yt);
    if (y1 - y > 0.02) faces.push(face(F, y, y1, c));
    y = Math.max(y, y1);
    if (y >= w.yt - 1e-6) break;
  }
  if (w.yt - y > 0.02) faces.push(face(F, y, w.yt, cuts[cuts.length - 1][1]));
  return yy => faces.find(f => yy >= f.y0 - 1e-6 && yy < f.y1 - 1e-6) ?? faces[faces.length - 1];
}
/** A white-framed window cut into whichever band face holds its sill. */
function win(b: BuildingTools, at: (y: number) => Face, t: number, y0: number, y1: number, w: number, o: OpenOpts = {}) {
  const F = at(y0 + 0.01);
  if (y0 < F.y0 - 1e-6 || y1 > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  opening(b, F, t, y0, w, y1 - y0, {depth: 0.14, cols: w > 1.7 ? 2 : 1, frame: 'frame', sill: false, ...o});
}
/** Coping on every wall top, a thin grey strip. */
const coping = (b: BuildingTools, w: WallInfo, c: Col = LEDGE) => band(b, frOf(w), 0, w.len, w.yt - 0.18, w.yt, 0.06, c);

// ---- the slab -----------------------------------------------------------------------------------------------------
type Slot = {slot: [number, number]; balc: [number, number]; wide?: boolean};
type SlabLayout = {pairs?: number[]; singles?: number[]; slots?: Slot[]; slotsRed?: number[]; lobby?: [number, number]; buff?: (b: BuildingTools, at: (y: number) => Face, w: WallInfo) => void};

function slabWall(b: BuildingTools, w: WallInfo) {
  const at = bands(w, [[0.4, PLINTH], [SLAB_BUFF_TOP, BUFF], [99, RED]]);
  const L = layoutFor(w);
  // red storeys
  for (const fl of FLOORS) {
    const y0 = fl + R_SILL, y1 = y0 + R_H;
    for (const t of L.pairs ?? []) for (const s of [-1, 1]) win(b, at, t + s * (RW / 2 + 0.5), y0, y1, RW, {bars: [0.3]});
    for (const t of L.singles ?? []) win(b, at, t, y0, y1, RW - 0.2, {bars: [0.3]});
    for (const t of L.slotsRed ?? []) win(b, at, t, fl + 1.5, fl + 1.95, 2.0);
  }
  for (const s of L.slots ?? []) {
    slotLoggia(b, at(RECESS[0] + 0.1), {slot: s.slot, y: RECESS, depth: 1.5, back: LOGGIA, floors: FLOORS, balcony: s.balc, out: 1.4, wideFirst: s.wide,
      window: {sill: 0.15, head: 2.35, t: [0.25, s.slot[1] - s.slot[0] - 0.25]}, edge: 'blue', slab: LEDGE, rail: METAL});
  }
  if (L.lobby) {
    // dark glazed lobby strip in a shallow recess, one frame bar per storey (w09-90), cut through every band it crosses
    const [a, c] = L.lobby;
    for (let y = w.yb + 0.2; y < w.yt - 0.7;) {
      const F = at(y), y0 = Math.max(y, F.y0 + 0.1), y1 = Math.min(w.yt - 0.6, F.y1 - 0.1);
      if (y1 - y0 > 0.4) opening(b, F, (a + c) / 2, y0, c - a, y1 - y0, {depth: 0.35, frame: SPANDREL, edge: 0.1, bars: FLOORS.map(f => f - y0).filter(v => v > 0.3 && v < y1 - y0 - 0.3)});
      y = F.y1 + 0.01;
    }
  }
  L.buff?.(b, at, w);
  for (const [y0, y1] of SLAB_LEDGES) if (w.yb < y0 && w.yt > y1) band(b, frOf(w), 0, w.len, y0, y1, 0.12, LEDGE);
  coping(b, w);
}

/** Buff storeys of the long slab faces: ground windows with grey spandrels, first-floor windows, the continuous ribbon. */
function buffStoreys(groups: [number, number][], ribbonSpan?: [number, number], piers: number[] = []) {
  return (b: BuildingTools, at: (y: number) => Face, w: WallInfo) => {
    for (const [a, c] of groups) {
      const n = Math.max(1, Math.round((c - a) / 1.5));
      if (at(S1[0]).y0 <= S1[0]) {
        win(b, at, (a + c) / 2, S1[0], S1[1], c - a, {cols: n, bars: [0.7]});
        const F = at(S1[0]);
        if (S1[0] >= F.y0 && S1[1] <= F.y1) slab(b, F.f, (a + c) / 2, S1[0] + 0.1, c - a - 0.14, 0.6, 0.05, SPANDREL, -0.14);
      }
      win(b, at, (a + c) / 2, S2[0], S2[1], c - a, {cols: n});
    }
    const [r0, r1] = ribbonSpan ?? [0.4, w.len - 0.4];
    const y0 = Math.max(RIBBON[0], w.yb + 0.15);
    if (r1 - r0 > 1 && y0 < RIBBON[1] - 0.5) {
      // the ribbon in pieces of at most 6 m with 0.4 m grey panels between them
      const pieces = Math.max(1, Math.ceil((r1 - r0) / 6)), pw = (r1 - r0) / pieces;
      for (let k = 0; k < pieces; k++) win(b, at, r0 + (k + 0.5) * pw, y0, RIBBON[1], pw - 0.4, {cols: Math.max(2, Math.round(pw / 1.3)), depth: 0.12});
    }
    for (const t of piers) if (at(0.5).y0 <= 0.5) slab(b, frOf(w).f, t, 0.4, 0.7, SLAB_LEDGES[0][0] - 0.4, 0.2, BUFF);
  };
}

function layoutFor(w: WallInfo): SlabLayout {
  const L = w.len;
  // east face (w03-90, 2022 at 36.7 px/m), t from the south end
  if (near(w, 33.35, 23.25, 2)) return {
    pairs: [2.3, 15.95, 28.95, 41.95],
    slots: [{slot: [7.8, 11.7], balc: [4.6, 11.7], wide: true}, {slot: [21.4, 24.8], balc: [18.6, 24.8], wide: true}, {slot: [35.1, 38.7], balc: [32.3, 38.7], wide: true}, {slot: [45.4, 47.9], balc: [44.6, 47.9]}],
    buff: (b, at, ww) => {
      buffStoreys([[0.6, 5.6], [6.6, 12.0], [13.0, 18.9], [19.9, 25.2], [37.9, 43.6], [44.6, 47.8]], undefined, [6.1, 12.5, 19.4, 25.55, 37.55, 44.1])(b, at, ww);
      // the entrance zone (t 25.9-37.3): recessed glazed doors under the curved glass canopy, windows beside them
      const F = at(1);
      opening(b, F, 29.7, 0.4, 3.0, 2.6, {depth: 1.2, cols: 2, frame: 'frame', bars: [2.1]});
      win(b, at, 34.6, S1[0], S1[1], 3.2, {cols: 2});
      win(b, at, 28.0, S2[0], S2[1], 3.0, {cols: 2});
      win(b, at, 34.6, S2[0], S2[1], 3.2, {cols: 2});
      entranceCanopy(b, frOf(ww), 30.2, 7.4, 3.4, 3.6);
    },
  };
  // west face of the north part (w04-270 at 50 px/m), t from the north end
  if (near(w, 11.2, -20.15, 2)) return {
    pairs: [2.7, 15.8], singles: [25.4],
    slots: [{slot: [6.2, 11.8], balc: [6.2, 9.5], wide: true}, {slot: [19.0, 24.4], balc: [19.0, 22.6], wide: true}],
    buff: buffStoreys([[0.6, 5.4], [6.4, 12.2], [13.2, 18.6], [19.6, 25.6]]),
  };
  // north-east loggia face (w11-90), t from the south end
  if (near(w, 28.2, -27.5, 1.5)) return {
    slots: [{slot: [0.15, 6.45], balc: [0.15, 3.9], wide: true}],
    buff: buffStoreys([[0.3, 6.9]], [0.3, 6.9]),
  };
  // east face over the low east wing (w09-90), t from the south end
  if (near(w, 29.8, -16.9, 1.5)) return {
    lobby: [0.2, 1.8], pairs: [3.8], singles: [10.6, 12.3],
    slots: [{slot: [6.6, 9.4], balc: [5.6, 9.4]}],
    buff: buffStoreys([], [2.2, L - 0.3]),
  };
  // courtyard face (seen over the south wing in w01-193 2019/2022), t from the north end
  if (near(w, 16.5, 18.35, 2)) return {
    pairs: [2.0, 23.6],
    slots: [{slot: [5.0, 21.4], balc: [15.6, 21.4], wide: true}],
    buff: buffStoreys([[0.6, 6.0], [7.0, 12.8], [13.8, 19.2], [20.2, 25.4]]),
  };
  // the slab's end walls: one slot window per storey (w13-0, w12-192) or one square window (w15-0, south end from w01 2022)
  if (near(w, 14.65, -33.35, 1.5)) return {slotsRed: [3.6], buff: endBuff(3.6)};
  if (near(w, 29.95, 46.6, 1.5)) return {slotsRed: [4.2], buff: endBuff(4.2, [0.85])};
  if (near(w, 24.7, -31.15, 1.5)) return {singles: [3.5], buff: endBuff(3.5)};
  if (near(w, 19.8, 44.4, 1.5)) return {singles: [3.6], buff: endBuff(3.6)};
  // courtyard north-east face (x 11.3) and anything else: pairs along it where it is long enough
  if (L >= 6) return {pairs: Array.from({length: Math.floor(L / 4.5)}, (_, k) => (k + 0.5) * L / Math.floor(L / 4.5)), buff: buffStoreys(L >= 8 ? [[0.6, L - 0.6]] : [])};
  return {};
}
/** Buff end-wall storeys: a slot window under the ledge, one window per storey below (w13-0, w12-192). */
function endBuff(t: number, extra: number[] = []) {
  return (b: BuildingTools, at: (y: number) => Face) => {
    win(b, at, t, 8.5, 9.0, 2.0);
    for (const tt of [t, ...extra]) for (const [y0, y1] of [[4.6, 6.0], [1.0, 2.4]] as [number, number][]) win(b, at, tt, y0, y1, tt === t ? 1.7 : 0.8);
  };
}

/** Curved glass entrance canopy on two posts (w03-90 2022 alt): a shallow barrel 7.4 m wide standing `out` m off the face. */
function entranceCanopy(b: BuildingTools, F: FR, t: number, w: number, out: number, y: number) {
  const rise = 0.5, R = (w * w / 4 + rise * rise) / (2 * rise), n = 8, quads: {pts: [number, number, number][]}[] = [];
  const yAt = (u: number) => y + rise - (R - Math.sqrt(R * R - u * u));
  for (let k = 0; k < n; k++) {
    const u0 = -w / 2 + (k * w) / n, u1 = -w / 2 + ((k + 1) * w) / n;
    const q: [number, number, number][] = [[t + u0, yAt(u0), out], [t + u1, yAt(u1), out], [t + u1, yAt(u1), 0], [t + u0, yAt(u0), 0]];
    quads.push({pts: q}, {pts: q.slice().reverse()});
  }
  addPolys(b, F.f, quads, 'glass');
  for (const s of [-1, 1]) {
    const tt = t + s * (w / 2 - 0.15), x = F.f.origin[0] + F.f.tangent[0] * tt + F.f.n[0] * (out - 0.15), z = F.f.origin[1] + F.f.tangent[1] * tt + F.f.n[1] * (out - 0.15);
    strut(b, [x, 0, z], [x, y - 0.02, z], 0.07, 'frame', 6);
  }
}

// ---- the care home ------------------------------------------------------------------------------------------------
function lowWall(b: BuildingTools, w: WallInfo) {
  const plinthTop = near(w, -4.1, 39.0, 3) ? 0.8 : 0.5;
  const F = frOf(w);
  // the garden side of the north wing (w07-0, w08-103 behind the reed fence): grey horizontal cladding with a glazed band per storey
  if (w.yt <= 8.1 && (near(w, 0, -6.9, 2) || near(w, -9.0, -16.2, 2))) {
    face(F, w.yb, plinthTop, PLINTH);
    const G = face(F, plinthTop, w.yt, METAL);
    for (const [y0, y1] of [[0.9, 2.7], [4.5, 6.3]] as [number, number][]) {
      const pieces = Math.max(1, Math.ceil((w.len - 0.6) / 5)), pw = (w.len - 0.6) / pieces;
      for (let k = 0; k < pieces; k++) opening(b, G, 0.3 + (k + 0.5) * pw, y0, pw - 0.3, y1 - y0, {depth: 0.12, cols: Math.max(2, Math.round(pw / 1.3)), frame: 'frame'});
    }
    for (let y = 0.6; y < w.yt - 0.3; y += 0.45) if (y < 0.85 || (y > 2.75 && y < 4.45) || y > 6.35) ledgeStrip(b, F.f, w.len / 2, y, w.len - 0.1, 0.04, 0.05, METAL);
    coping(b, w);
    return;
  }
  const at = bands(w, [[plinthTop, PLINTH], [99, BUFF]]);
  // Kramatplantsoen front (w02-283 2018/2025), t from the north end: piers every 6.3 m through the two lower storeys
  if (near(w, -34.9, -0.5, 2)) {
    const piers = [6.9, 13.2, 19.5, 25.8, 32.2, 38.4, 44.7, 50.8, 56.9, 62.9];
    const bays = [0.3, ...piers].map((p, k, a) => k + 1 < a.length ? [p + 0.5, a[k + 1] - 0.5] : null).filter((v): v is number[] => !!v);
    bays.forEach(([a, c], k) => {
      const m = (a + c) / 2;
      // storey 3: window pairs flush in the wall over the ledge
      for (const s of [-1, 1]) win(b, at, m + s * 1.4, L_ROWS[2][0], L_ROWS[2][1], 1.9, {bars: [1.35]});
      for (const s of [-1, 1]) win(b, at, m + s * 1.4, L_ROWS[1][0], L_ROWS[1][1], 1.9, {bars: [1.35]});
      if (k === 4) opening(b, at(1), m, 0.5, c - a - 0.3, 2.25, {depth: 1.8, cols: 3, bars: [2.1 - 0.4], frame: 'frame'}); // entrance hall
      else if (k >= 5 && k <= 7) { opening(b, at(1), m, 0.5, c - a - 0.3, 2.25, {depth: 0.9, cols: 4, bars: [0.6], frame: 'frame'}); }
      else for (const s of [-1, 1]) win(b, at, m + s * 1.4, L_ROWS[0][0], L_ROWS[0][1], 1.9, {bars: [1.35]});
    });
    for (const p of piers.slice(0, -1)) slab(b, F.f, p, plinthTop, 1.0, L_LEDGE[0] - plinthTop, 0.25, BUFF);
    band(b, F, 0, w.len, L_LEDGE[0], L_LEDGE[1], 0.3, LEDGE);
    coping(b, w);
    return;
  }
  // the south street front (w01-193 2019/2022), t from the west end: ground windows with grey spandrels, window pairs over them, an awning on each
  if (near(w, -4.1, 39.0, 3)) {
    for (let k = 0; k < 6; k++) {
      const m = 3.7 + 6.4 * k;
      for (const s of [-1, 1]) {
        const t = m + s * 1.25;
        win(b, at, t, 0.85, 2.85, 2.4, {cols: 2, bars: [0.7]});
        slab(b, F.f, t, 0.9, 2.26, 0.62, 0.05, SPANDREL, -0.14);
        fabricAwning(b, F, t - 1.2, 2.4, 3.2, 0.95, 0.65, CLOTH, METAL);
        win(b, at, t, 4.4, 6.2, 1.9);
        fabricAwning(b, F, t - 1.0, 2.0, 6.55, 0.8, 0.55, CLOTH, METAL);
      }
    }
    band(b, F, 0, w.len, 3.35, 3.5, 0.05, LEDGE);
    coping(b, w);
    return;
  }
  // its west end, three storeys high but with windows in the lower two only (w01-193 2019/2022), t from the west end
  if (near(w, -33.0, 32.6, 2)) {
    for (const m of [3.0, 8.8, 14.6]) {
      for (const s of [-1, 1]) {
        const t = m + s * 1.2;
        win(b, at, t, 0.85, 2.85, 2.2, {cols: 2, bars: [0.7]});
        slab(b, F.f, t, 0.9, 2.06, 0.62, 0.05, SPANDREL, -0.14);
        fabricAwning(b, F, t - 1.1, 2.2, 3.2, 0.95, 0.65, CLOTH, METAL);
        win(b, at, t, 4.4, 6.2, 1.9);
        fabricAwning(b, F, t - 1.0, 2.0, 6.55, 0.8, 0.55, CLOTH, METAL);
      }
    }
    band(b, F, 0, w.len, 3.35, 3.5, 0.05, LEDGE);
    coping(b, w);
    return;
  }
  // the low east wing's street face (w09-90), t from the south end: two storeys of windows under the roof terrace
  if (near(w, 33.05, -16.2, 1.5)) {
    for (const t of [1.3, 3.6, 5.9, 8.2, 10.5, 12.4]) { win(b, at, t, 0.8, 2.6, 1.6, {bars: [1.3]}); win(b, at, t, 4.4, 6.2, 1.6, {bars: [1.3]}); }
    band(b, F, 0, w.len, 3.35, 3.5, 0.05, LEDGE);
    coping(b, w);
    return;
  }
  // end walls (w10-0, w14-0, w18-11 and the short ones): one window per storey in the middle
  if (w.len < 8.5 && w.yb < 1) {
    const m = w.len / 2;
    if (w.len > 2.6) for (const [y0, y1] of L_ROWS) if (y1 < w.yt - 0.5) win(b, at, m, y0, y1, Math.min(1.7, w.len - 0.8));
    for (const y of [3.4, 6.45]) if (y < w.yt - 0.3) ledgeStrip(b, F.f, w.len / 2, y, w.len, 0.08, 0.05, LEDGE);
    coping(b, w);
    return;
  }
  // courtyard faces and the setback storeys (inferred: no panorama reaches them): window pairs on a 6.3 m pitch per storey
  const nb = Math.max(1, Math.floor(w.len / 6.3)), pitch = w.len / nb;
  const rows: [number, number][] = w.yb > 7 ? [[w.yb + 0.8, w.yb + 2.4]] : L_ROWS;
  for (let k = 0; k < nb; k++) {
    const m = (k + 0.5) * pitch;
    for (const [y0, y1] of rows) if (y0 >= w.yb + 0.3 && y1 <= w.yt - 0.4) for (const s of [-1, 1]) win(b, at, m + s * 1.3, y0, y1, 1.8, {bars: [1.3]});
  }
  for (const y of [3.4, 6.45]) if (y > w.yb + 0.2 && y < w.yt - 0.3) ledgeStrip(b, F.f, w.len / 2, y, w.len, 0.08, 0.05, LEDGE);
  coping(b, w);
}

/** A face in one colour; a coping when asked. */
function plainFace(b: BuildingTools, w: WallInfo, c: Col, cope = false) {
  face(frOf(w), w.yb, w.yt, c);
  if (cope) coping(b, w);
}

/** The white stair towers at the slab ends: solid white render facing the street, the stair glazed on the sides (w15-0, w11-90, w12-192 2022). */
function whiteTower(b: BuildingTools, w: WallInfo) {
  // dark base course, white render above
  const at = bands(w, [[0.35, PLINTH], [99, RENDER]]);
  const facingNS = angDiff(w.brg, 0) < 30 || angDiff(w.brg, 180) < 30;
  if (!facingNS && w.len > 2) {
    // glazed stair side: one glazed panel per storey between white render bands, a bar at the half landing (w11-90, w12-192)
    const lv = [0.4, 3.3, 6.5, ...FLOORS.slice(1), FLOORS[4] + 2.75];
    for (let k = 0; k + 1 < lv.length; k++) {
      const y0 = lv[k] + 0.15, y1 = Math.min(lv[k + 1] - 0.15, w.yt - 0.6);
      if (y1 - y0 > 1) opening(b, at(y0), w.len / 2, y0, w.len - 0.5, y1 - y0, {depth: 0.2, frame: 'frame', edge: 0.1, rows: 2, back: 'glass'});
    }
  }
}

/** The glazed one-storey link to the Flevopoort block (w06-192 2021): glass bays on slim grey mullions under a grey fascia. */
function linkWall(b: BuildingTools, w: WallInfo) {
  const F = face(frOf(w), w.yb, w.yt, SPANDREL);
  const bay = 1.6, n = Math.max(1, Math.round((w.len - 0.4) / bay)), bw = (w.len - 0.4) / n;
  for (let k = 0; k < n; k++) opening(b, F, 0.2 + (k + 0.5) * bw, 0.15, bw - 0.12, 3.35, {depth: 0.1, frame: METAL, edge: 0.04, bars: [2.6]});
  coping(b, w, METAL);
}

/** The grey ribbed plant room on the slab roof (w09-90): vertical ribs on the metal walls. */
function plantWall(b: BuildingTools, w: WallInfo) {
  face(frOf(w), w.yb, w.yt, METAL);
  plantRibs(b, frOf(w), w.yb, w.yt);
}
function plantRibs(b: BuildingTools, F: FR, y0: number, y1: number) {
  for (let t = 0.4; t < F.len - 0.2; t += 0.6) ledgeStrip(b, F.f, t, y0 + 0.05, 0.08, y1 - y0 - 0.15, 0.05, METAL);
}

/** Axis-aligned box in native (x, z) from its plan extents and heights. */
const box = (b: BuildingTools, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: Col) =>
  b.add(new T.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), c);

/** The stair towers stand about 0.9 m over the slab parapet with a grey coping (w15-0). */
function towerCaps(b: BuildingTools) {
  for (const [x0, x1, z0, z1] of [[18.3, 21.15, -34.55, -31.4], [23.45, 26.35, 45.5, 48.15]]) {
    box(b, x0 - 0.05, x1 + 0.05, 26.05, 26.85, z0 - 0.05, z1 + 0.05, RENDER);
    box(b, x0 - 0.1, x1 + 0.1, 26.85, 27.0, z0 - 0.1, z1 + 0.1, LEDGE);
  }
}

/** Roof terrace on the low east wing (w09-90): a mesh railing round its street edges and a flat dark canopy on posts by the slab. */
function roofTerrace(b: BuildingTools) {
  const y = 8.0;
  box(b, 32.75, 32.85, y, y + 1.05, -22.75, -9.7, METAL);
  box(b, 29.95, 32.75, y, y + 1.05, -22.75, -22.65, METAL);
  // canopy: a dark flat roof 25 cm thick spanning from the slab wall (x 29.7) to two posts (x 32.5)
  const x0 = 29.75, x1 = 32.6, z0 = -15.0, z1 = -10.6, top = 10.6;
  box(b, x0, x1, top - 0.25, top, z0, z1, SPANDREL);
  for (const z of [z0 + 0.1, z1 - 0.1]) strut(b, [x1 - 0.1, y, z], [x1 - 0.1, top - 0.25, z], 0.06, METAL, 6);
}
