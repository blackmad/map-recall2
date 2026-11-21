import type {BuildingTools} from './cultural-builders';
import {addShell, type Surface} from './worship-shell';
import {ledgeStrip, roofHeightAt, slab, type Frame} from './nearbar-kit';
import {balcony, band, face, flushFaces, opening, resetFaces, type Col, type Face, type FR, type OpenOpts} from './modern-front-kit';
import source from './rinus-michelslaan-1-footprints.json';

/**
 * RINUS MICHELSLAAN 1-343 (+ Jan van Galenstraat side streets; BAG pand 0363100012252166, 2020-21): one BAG pand that is a
 * courtyard block of several architects' buildings (lane hand-blocks-b-20261121, triage block-sized-triage-20261121 #23).
 * Massing: the 3DBAG LoD2.2 shell (rinus-michelslaan-1-footprints.json, bag-shell-prepare.ts): a 28.6 m curved slab on the
 * south, a 13.6 m low block on the north, a 49.5 m tower at the north-east corner and a 19.4 m east wing. Every vertical
 * rectangular shell wall is rebuilt as a holed face in the system of the front it belongs to (modern-front-kit.ts); fronts
 * read from the rectified Gemeente Amsterdam panoramas (CC BY 4.0) listed per wall in rinus-michelslaan-1-inventory.json:
 *  - south slab (w02-194 2022, w06-197, w09-194, w10-207): west part pale grey brick with a deep square window grid and black
 *    French rails over a dark double-height glazed ground; middle part a beige concrete frame of 7.6 m bays with recessed
 *    glazing and staggered cantilevered balcony boxes over glazed ground units; east part red-brown brick, curved, with
 *    wide windows (w05-196) over shops;
 *  - north low block (w01-6 2021): east half mixed brown-grey brick townhouses (doors with a tall window above, pairs of
 *    windows, pale surrounds at the top), west half a pale grey brick pilaster grid with double-height ground openings;
 *  - east wing (w03-105 2025): dark mixed brick frame with a loggia and a narrow window per bay over a recessed two-storey
 *    glazed ground; the corner tower (w07-6, w08-3): red-brown brick with punched windows and rails.
 * Courtyard faces (no panorama) get the window grid of their volume (inferred).
 * Windows sit on a global rhythm per front (metres along a fixed tangent), so the jagged 3DBAG strips keep one pattern.
 */
type Src = {surfaces: Surface[]; nativeRing: number[][]};
const src = source as unknown as Src;

// palette names; materialOverrides in the spec give the measured colours
const PALE: Col = 'greyBrick', MIXED: Col = 'ochre', BEIGE: Col = 'sandstone', RED: Col = 'red', EAST: Col = 'brick';
const LOGGIA: Col = 'stone', DARK: Col = 'dark', INFILL: Col = 'pink', FRAMEB: Col = 'bronze', SLABC: Col = 'concrete', RAIL: Col = 'blue', TIMBER: Col = 'copper', SURROUND: Col = 'stone';

type P2 = [number, number];
type Win = {s: number; w: number; y: [number, number]; o?: OpenOpts};
type WallInfo = {i: number; f: Frame; len: number; yb: number; yt: number; cx: number; cz: number; rect: boolean};
type Sys = {wall: Col; T?: P2; wins: (w: WallInfo, T: P2) => Win[]; extra?: (b: BuildingTools, F: FR, s0: number, w: WallInfo) => void};

/** Normal of an outward bearing in the native frame (x east, z south). */
const nb = (deg: number): P2 => [Math.sin(deg * Math.PI / 180), -Math.cos(deg * Math.PI / 180)];
const tan = (n: P2): P2 => [n[1], -n[0]];
const T_S = tan(nb(194)), T_N = tan(nb(6)), T_E = tan(nb(105)), T_W = tan(nb(276));

/** Columns at pitch p (phase ph) over the global range of a wall, one opening of width ww per row. */
function grid(w: WallInfo, T: P2, p: number, ph: number, ww: number, rows: [number, number][], o?: OpenOpts): Win[] {
  const s0 = w.f.origin[0] * T[0] + w.f.origin[1] * T[1], out: Win[] = [];
  for (let k = Math.floor((s0 - ph) / p) - 1; ph + k * p < s0 + w.len + p; k++) {
    for (const y of rows) if (y[1] < w.yt - 0.5) out.push({s: ph + k * p, w: ww, y, o});
  }
  return out;
}
/** Clearance of openings from the ends of a shell strip (see paint). */
const M = 0.4;
const storeys = (y0: number, step: number, h: number, top: number): [number, number][] =>
  Array.from({length: Math.max(0, Math.floor((top - y0 - h) / step) + 1)}, (_, k) => [y0 + k * step, y0 + k * step + h] as [number, number]);

// ---- the systems ---------------------------------------------------------------------------------------------------
const paleGround: OpenOpts = {depth: 0.3, frame: DARK, cols: 1, bars: [2.6]};
const paleUpper: OpenOpts = {depth: 0.3, frame: DARK, cols: 2};
const SYS: Record<string, Sys> = {
  // south slab, west part (w06-197, w09-194, w10-207; triage front.jpg left)
  paleS: {wall: PALE, T: T_S, wins: (w, T) => [
    ...grid(w, T, 3.0, 0, 2.2, [[0.1, 5.2]], paleGround),
    ...grid(w, T, 3.0, 0, 1.6, storeys(6.3, 3.05, 2.2, w.yt), paleUpper),
  ]},
  // west end (w04-276): the slab's end in the same grid, the low courtyard wall with dark gates
  paleW: {wall: PALE, T: T_W, wins: (w, T) => [
    ...(w.yt > 20 ? grid(w, T, 3.0, 0, 2.2, [[0.1, 5.2]], paleGround) : grid(w, T, 5.0, 1.0, 2.0, [[0.05, 2.6]], {depth: 0.2, frame: DARK, back: DARK, edge: 0.05})),
    ...grid(w, T, 3.0, 0, 1.6, storeys(6.3, 3.05, 2.2, w.yt), paleUpper),
  ]},
  // south slab, middle: beige concrete frame, 7.6 m bays, the glazing 1.4 m behind the frame, balcony boxes (w02-194)
  beige: {wall: BEIGE, T: T_S, wins: (w, T) => [
    ...grid(w, T, 7.6, 1.9, 7.0, [[0.1, 4.2]], {depth: 0.3, frame: FRAMEB, cols: 4}),
    ...grid(w, T, 7.6, 1.9, 7.0, storeys(4.75, 3.1, 2.65, w.yt), {depth: 1.4, back: INFILL, edge: 0}),
  ], extra: (b, F, s0, w) => {
    // staggered cantilevered boxes: a 3.2 m box on the bay's left or right, alternating bay by bay and every other storey
    for (let k = Math.floor((s0 - 1.9) / 7.6) - 1; 1.9 + k * 7.6 < s0 + w.len + 7.6; k++) {
      const c = 1.9 + k * 7.6;
      storeys(4.75, 3.1, 2.65, w.yt - 0.5).forEach(([y0], j) => {
        // the glazing at the back of the bay: three 9 cm thick panes standing on the taupe infill
        const a = Math.max(M, c - 3.5 - s0), e = Math.min(w.len - M, c + 3.5 - s0);
        if (e - a >= 0.45) for (const d of [-2.3, 0, 2.3]) {
          const t = c + d - s0;
          if (t - 1.05 > a + 0.05 && t + 1.05 < e - 0.05) slab(b, F.f, t, y0 + 0.1, 2.1, 2.35, 0.09, 'glass', -1.4);
        }
        const left = (k + j) % 2 === 0, t0 = c + (left ? -3.5 : 0.3) - s0;
        if (t0 < 0.05 || t0 + 3.2 > w.len - 0.05) return;
        balcony(b, F, t0, 3.2, 1.7, y0 - 0.05, {rail: RAIL, slab: SLABC, sides: true, slabT: 0.45});
      });
    }
  }},
  // south slab, east part: red-brown brick, wide windows over shops (w05-196)
  redS: {wall: RED, T: T_S, wins: (w, T) => [
    ...grid(w, T, 3.2, 0, 2.6, [[0.1, 4.0]], {depth: 0.3, frame: DARK, cols: 2}),
    ...grid(w, T, 3.2, 0, 2.5, storeys(5.3, 3.0, 1.7, w.yt), {depth: 0.2, frame: 'frame', cols: 2, bars: [0.6]}),
  ], extra: (b, F, _s0, w) => { if (w.len > 1) band(b, F, 0.1, Math.min(w.len - 0.1, 14.5), 4.2, 4.45, 0.9, DARK); }},
  // north low block, east half: mixed brown-grey brick townhouses (w01-6 left half)
  mixed: {wall: MIXED, T: T_N, wins: (w, T) => [
    ...grid(w, T, 5.4, 1.3, 1.1, [[0.05, 2.4]], {depth: 0.2, frame: TIMBER, back: TIMBER, edge: 0.05}),
    ...grid(w, T, 5.4, 1.3, 2.0, [[2.95, 5.9]], {depth: 0.25, frame: SURROUND, cols: 2}),
    ...grid(w, T, 5.4, 4.0, 1.1, [[0.6, 2.4], [3.0, 5.9]], {depth: 0.2, frame: 'frame'}),
    ...grid(w, T, 2.7, 1.3, 0.95, [[6.8, 9.0], [9.9, 12.1]], {depth: 0.2, frame: 'frame', bars: [1.4]}),
  ], extra: (b, F, s0, w) => {
    // pale jamb panels beside the top-storey windows of each house
    for (let k = Math.floor((s0 - 1.3) / 5.4) - 1; 1.3 + k * 5.4 < s0 + w.len + 5.4; k++) {
      const t = 1.3 + k * 5.4 - s0;
      if (t - 0.8 > 0.05 && t + 0.8 < w.len - 0.05 && w.yt > 12.6) for (const d of [-0.62, 0.62]) slab(b, F.f, t + d, 9.75, 0.22, 2.5, 0.06, SURROUND);
    }
  }},
  // north low block, west half: pale grey brick pilaster grid (w01-6 right half)
  paleN: {wall: PALE, T: T_N, wins: (w, T) => [
    ...grid(w, T, 2.4, 0, 1.2, [[0.05, 2.6], [2.9, 5.8]], {depth: 0.25, frame: DARK}),
    ...grid(w, T, 2.4, 0, 1.0, [[6.8, 8.9], [9.8, 11.8]], {depth: 0.25, frame: DARK}),
  ]},
  // east wing: dark mixed brick frame with a loggia and a narrow window per bay, recessed glazed ground (w03-105)
  // east wing: dark mixed brick frame, per 3DBAG strip (the strips are the 3.7 m bays) a loggia and a narrow window per
  // storey over a recessed two-storey glazed ground (w03-105)
  east: {wall: EAST, T: T_E, extra: (b, F, _s0, w) => {
    const u = w.len - 2 * M, lw = Math.min(1.9, u - 1.1);
    if (lw < 0.9) return;
    // a glazed door at the back of each loggia, a rail across its front
    for (const [y0] of storeys(7.8, 3.05, 2.2, w.yt - 0.5)) {
      slab(b, F.f, M + lw / 2, y0 + 0.05, lw - 0.5, 2.05, 0.09, 'glass', -1.2);
      ledgeStrip(b, F.f, M + lw / 2, y0 + 0.95, lw, 0.06, 0.05, DARK, -0.05);
    }
  }, wins: (w, T) => {
    const s0 = w.f.origin[0] * T[0] + w.f.origin[1] * T[1], u = w.len - 2 * M, lw = Math.min(1.9, u - 1.1);
    if (u < 0.6) return [];
    const ys = storeys(7.8, 3.05, 2.2, w.yt).filter(y => y[1] < w.yt - 0.5);
    return [
      {s: s0 + w.len / 2, w: u, y: [0.1, 6.6], o: {depth: 1.2, back: INFILL, edge: 0}},
      ...(lw >= 0.9 ? [
        ...ys.map(y => ({s: s0 + M + lw / 2, w: lw, y, o: {depth: 1.2, back: LOGGIA, edge: 0}})),
        ...ys.map(y => ({s: s0 + w.len - M - 0.4, w: 0.8, y, o: {depth: 0.2, frame: 'frame' as Col}})),
      ] : ys.map(y => ({s: s0 + w.len / 2, w: Math.min(1.2, u), y, o: {depth: 0.2, frame: 'frame' as Col}}))),
    ];
  }},
  // north-east tower: red-brown brick, punched windows with rails (w07-6, w08-3, w03-105 right), one per 3DBAG strip
  tower: {wall: RED, wins: (w, T) => {
    const s0 = w.f.origin[0] * T[0] + w.f.origin[1] * T[1], u = w.len - 2 * M;
    if (u < 0.8) return [];
    if (u > 4) return grid(w, T, 3.1, 0.3, 1.7, storeys(7.6, 3.0, 1.75, w.yt), {depth: 0.15, frame: 'frame', cols: 2});
    return storeys(4.6, 3.0, 1.75, w.yt).filter(y => y[1] < w.yt - 0.5).map(y => ({s: s0 + w.len / 2, w: Math.min(2.4, u), y, o: {depth: 0.15, frame: 'frame' as Col, cols: u > 1.6 ? 2 : 1}}));
  }},
  // courtyard faces (inferred): punched grid in the volume's brick
  court: {wall: PALE, wins: (w, T) => grid(w, T, 4.0, 0.4, 1.6, storeys(0.9, 3.05, 2.0, w.yt), {depth: 0.15, edge: 0})},
};

function sysOf(w: WallInfo): Sys {
  const [nx, nz] = w.f.n;
  if (w.yt > 35 || (w.cx > 44 && w.cz < 12)) return SYS.tower;
  if (nz > 0.7) { // south-facing
    if (w.cz < 5) return {...SYS.court, wall: w.yt < 15 ? PALE : BEIGE};
    return w.cx < -22 ? SYS.paleS : w.cx < 30.5 ? SYS.beige : SYS.redS;
  }
  if (nz < -0.7) { // north-facing
    if (w.cz > -15) return {...SYS.court, wall: w.yt > 25 ? BEIGE : EAST};
    return w.cx > -3 ? SYS.mixed : SYS.paleN;
  }
  if (nx > 0.7 && w.cx > 50) return SYS.east;
  if (nx < -0.7 && w.cx < -55) return SYS.paleW;
  return {...SYS.court, wall: w.cx > 20 ? (w.cz > 5 ? RED : EAST) : PALE};
}

// ---- the shell's walls (machinery as valkenburgerstraat-69-builder.ts) ------------------------------------------------
function wallInfo(s: Surface, i: number): WallInfo | null {
  const r = s.rings[0], ys = r.map(p => p[1]), yt = Math.max(...ys), yb = Math.min(...ys);
  let nx = 0, nz = 0;
  for (let k = 0; k < r.length; k++) { const a = r[k], c = r[(k + 1) % r.length]; nx += (a[1] - c[1]) * (a[2] + c[2]); nz += (a[0] - c[0]) * (a[1] + c[1]); }
  const nl = Math.hypot(nx, nz);
  if (nl < 1e-6) return null;
  let n: P2 = [nx / nl, nz / nl];
  const cx = r.reduce((a, p) => a + p[0], 0) / r.length, cz = r.reduce((a, p) => a + p[2], 0) / r.length;
  const front = roofHeightAt(src.surfaces, cx + n[0] * 0.5, cz + n[1] * 0.5) ?? -1, back = roofHeightAt(src.surfaces, cx - n[0] * 0.5, cz - n[1] * 0.5) ?? -1;
  if (front > back) n = [-n[0], -n[1]];
  const tangent: P2 = [n[1], -n[0]];
  const ts = r.map(p => p[0] * tangent[0] + p[2] * tangent[1]), t0 = Math.min(...ts), t1 = Math.max(...ts), len = t1 - t0;
  const off = cx * n[0] + cz * n[1];
  const f: Frame = {origin: [tangent[0] * t0 + n[0] * off, tangent[1] * t0 + n[1] * off], tangent, n};
  let area = 0;
  for (let k = 0; k < r.length; k++) { const c = (k + 1) % r.length; area += ts[k] * r[c][1] - ts[c] * r[k][1]; }
  const rect = r.every((_, k) => Math.abs(ts[k] - t0) < 0.05 || Math.abs(ts[k] - t1) < 0.05)
    && Math.abs(area / 2) > 0.985 * len * (yt - yb) && r.every(p => Math.abs(p[0] * n[0] + p[2] * n[1] - off) < 0.08);
  return {i, f, len, yb, yt, cx, cz, rect};
}

const frOf = (w: WallInfo): FR => ({f: w.f, len: w.len});
/** An opening cut into the face when it fits and touches no earlier opening. */
function cut(F: Face, b: BuildingTools, t: number, win: Win) {
  const w = win.w;
  if (win.y[0] < F.y0 - 1e-6 || win.y[1] > F.y1 + 1e-6 || t - w / 2 < 0.05 || t + w / 2 > F.len - 0.05) return;
  if (F.holes.some(h => h.t0 < t + w / 2 + 0.05 && t - w / 2 - 0.05 < h.t1 && h.y0 < win.y[1] + 0.05 && win.y[0] - 0.05 < h.y1)) return;
  opening(b, F, t, win.y[0], w, win.y[1] - win.y[0], {depth: 0.18, frame: 'frame', sill: false, ...win.o});
}

function paint(b: BuildingTools, w: WallInfo, sys: Sys) {
  const F = face(frOf(w), w.yb, w.yt, sys.wall);
  // the front's fixed tangent when it has one (one rhythm over the jagged, curved strips), else the strip's own
  const T: P2 = sys.T && w.f.tangent[0] * sys.T[0] + w.f.tangent[1] * sys.T[1] > 0.9 ? sys.T : [w.f.tangent[0], w.f.tangent[1]];
  const s0 = w.f.origin[0] * T[0] + w.f.origin[1] * T[1];
  if (w.len > 0.6) {
    // an opening that crosses the strip's end keeps its share of the lights (the 3DBAG strips break the rhythm)
    // 0.4 m clear of each strip end: the 3DBAG strips step in and out by 0.3-0.6 m at pilasters and on the curve, and a
    // recessed opening next to a deeper strip would read as standing in front of that strip, outside its silhouette
    const lo = s0 + M, hi = s0 + w.len - M;
    for (const win of sys.wins(w, T)) {
      const a = Math.max(lo, win.s - win.w / 2), c = Math.min(hi, win.s + win.w / 2);
      if (c - a < Math.min(0.45, win.w * 0.6)) continue;
      const share = (c - a) / win.w, cols = win.o?.cols ? Math.max(1, Math.round(win.o.cols * share)) : undefined;
      cut(F, b, (a + c) / 2 - s0, {...win, w: c - a, o: {...win.o, ...(cols ? {cols} : {})}});
    }
    sys.extra?.(b, frOf(w), s0, w);
  }
  // coping, lifted 5 cm over the 3DBAG roof line
  if (w.yt - w.yb > 2 && w.len > 0.3) band(b, frOf(w), 0, w.len, w.yt - 0.15, w.yt + 0.05, 0.06, SLABC, [false, false]);
}

export function buildRinusMichelslaan1(_w: number, _d: number, b: BuildingTools) {
  const infos = src.surfaces.map((s, i) => (s.type === 'WallSurface' ? wallInfo(s, i) : null));
  const rebuilt = infos.filter((w): w is WallInfo => !!w && w.rect && w.len > 0.05);
  const ids = new Set(rebuilt.map(w => w.i));
  addShell(b, src as never, {
    wall: PALE, roof: 'slate',
    skip: (_s, i) => ids.has(i),
    wallFor: (_s, i) => { const w = infos[i]; return w ? sysOf(w).wall : PALE; },
  });
  resetFaces();
  for (const w of rebuilt) paint(b, w, sysOf(w));
  flushFaces(b);
}
