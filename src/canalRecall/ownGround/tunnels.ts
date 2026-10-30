// Tunnels in the own ground: the open cuts that lead into them and the slots that ride through them (pure, no DOM).
//
// The ground drew no tunnel way (osmGround crossSection), and the relief carried the rest as AHN measured it:
//
//   ramps   A motor tunnel's approach is a cut with vertical retaining walls. The 2 m DTM smears each wall into a
//           2-4 m slope, and the 5 m land grid drew it as green verges running down to an ordinary road: at
//           Foeliestraat the IJ-tunnel's ramp toward NEMO read as a street the rider could take (user report
//           2026-10-30; bikes are banned there, bikeAccess.ts). Cycle and road underpasses have the same sunken
//           approaches (Molukkenstraat, Mauritskade).
//   slots   A short underpass through a rail embankment or a dike: the DTM measures the embankment over it, so a
//           rider on the routed way climbed 3-4 m over the embankment and down again (Wibautstraat cycle tunnel
//           +3.6 m, Overschiestraat +3.9 m, Molukkenstraat +5.5 m).
//
// One mechanism serves both, a *cut*: a strip along a way where the riding surface is a floor below the land, with a
// wall wherever the land stands above it. Ramps are measured from the DTM (no list of sites): from every tunnel
// portal the connected ways are scanned across, and a wall stands where the relief rises steeply at least
// MIN_RISE_M above the road within a few metres of its edge. Slots are rideable tunnel runs at most SLOT_MAX_M long
// whose relief rises SLOT_MIN_EXCESS_M over the line between their two portal levels; their floor is that line.
//
// The cut acts on the shared surface (surface.ts addCut): the riding height is the floor; the relief inside the
// strip is the wall-top level (the land grid stays flat across the wall line, and the cell's mask discards it inside
// the strip, as the water mask does at a quay), and in DIP_M behind each wall it is lifted to the wall top (the
// DTM's smear). The cell draws the walls (concrete face, coping, a parapet), a floor under the bands, and where a
// motor-only tunnel's roof begins a portal: a dark mouth under a concrete headwall.

import { crossSection, type OsmWay } from './osmGround.js';
import { emptyMesh, vertex, type MeshArrays } from './drape.js';
import type { Vec2 } from './surface.js';
import { isBicycleRestricted, isBikeRoutingHighway, isMotorOnlyHighway } from '../routing/bikeAccess.js';

type HeightFn = (x: number, y: number) => number;
type RGB = [number, number, number];

/** Station spacing along a scanned way, metres. */
export const STATION_M = 2;
/** Lateral scan reach from the centreline, metres, and its step. */
export const SCAN_M = 24;
const SCAN_STEP_M = 0.5;
/** A wall needs the relief to rise at least this far above the road (metres) beside it. */
export const MIN_RISE_M = 0.45;
/** A run of cut stations is kept only if somewhere along it the walls stand at least this high (metres). */
export const MIN_RUN_DEPTH_M = 1.2;
/** And only if it is at least this long, metres. */
export const MIN_RUN_M = 10;
/** The rise must begin within this distance of the road's edge (metres): a dike or a mound farther off is no wall. */
export const WALL_REACH_M = 6;
/** A wall's DTM rise (foot to top) spans at most this plus `WALL_SPAN_PER_M` per metre of height; wider is a sloped bank (talud). */
export const WALL_SPAN_M = 4;
export const WALL_SPAN_PER_M = 1.5;
/** Behind a wall, the relief is lifted to its top over this width (the DTM's smear of the wall), metres. */
export const DIP_M = 4;
/** Past a portal the relief over the tunnel is lifted to the headwall's top over this length, metres. */
export const LID_M = 6;
/** A rideable tunnel run this long at most may be opened as a slot, metres. */
export const SLOT_MAX_M = 150;
/** A slot opens where the relief over the run rises at least this far above the line between its portal levels, metres. */
export const SLOT_MIN_EXCESS_M = 1;
/** A slot runs on this far past each portal (the DTM's smear of the embankment face lies over the road there), metres. */
export const SLOT_EXT_M = 6;
/** A slot's walls stand this far outside the way's drawn half-width (metres), at least SLOT_MIN_HALF_M from the centre. */
export const SLOT_MARGIN_M = 0.5;
export const SLOT_MIN_HALF_M = 1.6;
/** A run on a tunnel way continues a ramp only if its floor at the portal is within this of the open road's (metres). */
export const TUNNEL_FLOOR_TOL_M = 1;
/** Parapet on the wall top, metres high and thick. */
export const PARAPET_M = 1.0;
export const PARAPET_T = 0.3;
/** Clear height of a portal's mouth (motor tunnel), metres. */
export const PORTAL_CLEAR_M = 4.6;
/** Floor under the bands: lift over the floor (the carriageway's 0.03 stays on top). */
export const FLOOR_LIFT_M = 0.012;

/** Colours (sRGB): in-situ concrete for walls and headwall, a lighter coping, the mouth's dark interior. */
export const TUNNEL_COLOURS = { wall: [0.46, 0.45, 0.43] as RGB, coping: [0.84, 0.83, 0.8] as RGB, parapet: [0.6, 0.59, 0.56] as RGB, mouth: [0.05, 0.055, 0.06] as RGB, headwall: [0.56, 0.56, 0.54] as RGB };

/** Highways that are no way through a tunnel's portal for this purpose (indoor, vertical, or not built). */
const NOT_A_ROAD = new Set(['steps', 'corridor', 'elevator', 'platform', 'proposed', 'construction', 'bus_stop', 'raceway', 'abandoned', 'disused', 'razed']);

export const isTunnelTags = (t: Record<string, string>): boolean => !!t.tunnel && t.tunnel !== 'no' && t.tunnel !== 'building_passage' && t.tunnel !== 'culvert';
const isBridgeTags = (t: Record<string, string>): boolean => !!t.bridge && t.bridge !== 'no';
const roadLike = (t: Record<string, string>): boolean => !!t.highway && !NOT_A_ROAD.has(t.highway) && t.area !== 'yes';

/** Closed to bikes by law (motorways, trunk autowegen) or by a `bicycle=no` on a road. */
export function motorOnlyTags(t: Record<string, string>): boolean {
  return isMotorOnlyHighway(t.highway) || (t.bicycle === 'no' && !['cycleway', 'path', 'footway', 'pedestrian'].includes(t.highway));
}

/** The rider may take it (street mode's graph): slots are opened only for these. */
export function rideableTags(t: Record<string, string>): boolean {
  return isBikeRoutingHighway(t) && !motorOnlyTags(t) && !isBicycleRestricted(t);
}

/** Half-width the ground would draw for this way (tunnel tags dropped: a tunnel way draws no bands of its own). */
export function drawnHalfWidth(t: Record<string, string>): number {
  const { tunnel: _t, layer: _l, level: _v, ...open } = t;
  return crossSection(open)?.halfWidth ?? 2;
}

export interface CutPortal {
  /** Station index of the portal (0 or the last). */
  at: number;
  /** Unit direction into the tunnel. */
  dir: Vec2;
  /** Ground level over the tunnel just past the portal (the headwall's top), scene z. */
  top: number;
}

/** One cut: a polyline with per-station floor, reach and walls either side (left = counter-clockwise of the direction). */
export interface Cut {
  id: string;
  /** The OSM way scanned (ramps), or the first of the run (slots). */
  way: number;
  kind: 'ramp' | 'slot';
  /** The way is closed to bikes (portal mouths and parapets read as a motor road). */
  motor: boolean;
  x: number[]; y: number[]; s: number[];
  /** Riding level, scene z. */
  floor: number[];
  /** The strip's reach from the centreline each side, metres. */
  left: number[]; right: number[];
  /** 1: a wall stands at that edge; 0: the strip runs on into a neighbouring cut way's strip there. */
  wallL: number[]; wallR: number[];
  /** Wall tops (the land level beside the cut), scene z. */
  rimL: number[]; rimR: number[];
  portals: CutPortal[];
  bbox: [number, number, number, number];
}

const median = (v: number[]): number => { const s = v.filter(x => x === x).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };

/** Running median over `r` stations either side (NaN entries ignored), then a 3-tap mean. */
export function smoothRun(v: readonly number[], r = 2): number[] {
  const m = v.map((_, i) => median(v.slice(Math.max(0, i - r), i + r + 1) as number[]));
  return m.map((x, i) => (x === x ? ((m[i - 1] ?? x) === (m[i - 1] ?? x) ? (m[i - 1] ?? x) : x) + x + ((m[i + 1] ?? x) === (m[i + 1] ?? x) ? (m[i + 1] ?? x) : x) : NaN) / 3);
}

/** Points every `step` along a polyline with their stations and unit tangents. */
export function stationsAlong(pts: readonly Vec2[], step: number): { p: Vec2[]; s: number[]; t: Vec2[] } {
  const p: Vec2[] = [], s: number[] = [], t: Vec2[] = [];
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    const n = Math.max(1, Math.round(l / step));
    for (let k = 0; k < n; k++) { const f = k / n; p.push([a[0] + dx * f, a[1] + dy * f]); s.push(acc + l * f); t.push([dx / l, dy / l]); }
    acc += l;
  }
  const last = pts[pts.length - 1], a = pts[pts.length - 2];
  const l = Math.hypot(last[0] - a[0], last[1] - a[1]) || 1;
  p.push([last[0], last[1]]); s.push(acc); t.push([(last[0] - a[0]) / l, (last[1] - a[1]) / l]);
  return { p, s, t };
}

/** Distance from (x, y) to a polyline. */
function polylineDistance(pts: readonly Vec2[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], dx = pts[i + 1][0] - ax, dy = pts[i + 1][1] - ay, l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(ax + dx * t - x, ay + dy * t - y));
  }
  return best;
}

export interface SideScan { reach: number; wall: boolean; rim: number; depth: number }

/**
 * Scan one side of a station: the relief `g(t)` at t = SCAN_STEP_M … SCAN_M from the centreline. A wall is where the
 * relief rises from the floor by at least MIN_RISE_M, its foot within WALL_REACH_M of the edge `half` and its rise
 * steep (WALL_SPAN_M + WALL_SPAN_PER_M per metre); it stands at the half-height crossing, its top the rise's plateau.
 * Before any rise, a neighbouring road `shared(t)` on the floor (within 0.5 m) ends the side without a wall: the strip
 * runs on into that road's own cut. Null: neither (the side is not a cut).
 */
export function scanSide(g: (t: number) => number, floor: number, half: number, shared: (t: number) => boolean): SideScan | null {
  let foot = 0;
  for (let t = SCAN_STEP_M; t <= SCAN_M; t += SCAN_STEP_M) {
    const z = g(t);
    if (z === z && z - floor <= 0.25) foot = t;
    if (t > 1 && shared(t) && Math.abs(z - floor) < 0.5) return { reach: t, wall: false, rim: z, depth: 0 };
    if (!(z - floor >= MIN_RISE_M)) continue;
    if (foot > half + WALL_REACH_M) return null;
    // The plateau: keep climbing while the relief still rises.
    let top = t, zt = z;
    for (let u = t + SCAN_STEP_M; u <= Math.min(SCAN_M + 6, t + 8); u += SCAN_STEP_M) { const zu = g(u); if (!(zu > zt + 0.04)) break; top = u; zt = zu; }
    const depth = zt - floor;
    if (top - foot > WALL_SPAN_M + WALL_SPAN_PER_M * depth) return null;
    // Half-height crossing between the foot and the plateau.
    const mid = floor + depth / 2;
    let at = foot;
    for (let u = foot; u <= top; u += SCAN_STEP_M) { if (g(u) >= mid) { const z0 = g(u - SCAN_STEP_M); at = u - SCAN_STEP_M + SCAN_STEP_M * Math.max(0, Math.min(1, (mid - z0) / ((g(u) - z0) || 1))); break; } }
    // The rim: the land a little past the plateau (the median of a few samples, so a kerb or a hedge does not count).
    const rim = median([0, 1, 2, 3].map(k => g(top + k * SCAN_STEP_M)));
    return { reach: Math.max(Math.min(half, 1), at), wall: true, rim: Math.max(rim, mid), depth: Math.max(rim, mid) - floor };
  }
  return null;
}

export interface CutWay { id: number; tags: Record<string, string>; points: Vec2[]; half: number; tunnel: boolean }

/**
 * Scan a way for ramp cuts: stations every STATION_M, each side scanned (scanSide), runs of stations with a wall on
 * either side kept when at least MIN_RUN_M long and MIN_RUN_DEPTH_M deep somewhere. `others` are the candidate roads
 * around (their centrelines end a side as shared), `ground` the raw relief.
 */
export function scanWay(way: CutWay, ground: HeightFn, others: readonly CutWay[], motor: boolean, box?: readonly [number, number, number, number]): Cut[] {
  const inBox = (p: Vec2) => !box || (p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3]);
  const st = stationsAlong(way.points, STATION_M), n = st.p.length;
  const near = others.filter(o => o.id !== way.id);
  const bb = way.points.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const close = near.filter(o => o.points.some(p => p[0] > bb[0] - SCAN_M - 5 && p[0] < bb[2] + SCAN_M + 5 && p[1] > bb[1] - SCAN_M - 5 && p[1] < bb[3] + SCAN_M + 5));
  // The neighbours' segments, each with its box: a station tests only those within reach of its scan line (the same
  // answer as testing every polyline, at a fraction of the cost on a dense road graph).
  const segs: [number, number, number, number][] = [];
  for (const o of close) for (let k = 0; k + 1 < o.points.length; k++) segs.push([o.points[k][0], o.points[k][1], o.points[k + 1][0], o.points[k + 1][1]]);
  const R = SCAN_M + 1;
  const floor: number[] = [], sides: [SideScan | null, SideScan | null][] = [];
  for (let i = 0; i < n; i++) {
    if (!inBox(st.p[i])) { floor.push(NaN); sides.push([null, null]); continue; }
    const [cx, cy] = st.p[i], [tx, ty] = st.t[i], nx = -ty, ny = tx;
    const fs: number[] = [];
    for (let t = -way.half * 0.5; t <= way.half * 0.5 + 1e-6; t += Math.max(0.5, way.half * 0.25)) fs.push(ground(cx + nx * t, cy + ny * t));
    const f = median(fs);
    floor.push(f);
    const local = segs.filter(([ax, ay, bx, by]) => Math.max(ax, bx) > cx - R && Math.min(ax, bx) < cx + R && Math.max(ay, by) > cy - R && Math.min(ay, by) < cy + R);
    const onNeighbour = (x: number, y: number) => local.some(([ax, ay, bx, by]) => polylineDistance([[ax, ay], [bx, by]], x, y) < 0.75);
    const side = (sg: 1 | -1) => scanSide(t => ground(cx + nx * sg * t, cy + ny * sg * t), f, way.half, t => local.length > 0 && onNeighbour(cx + nx * sg * t, cy + ny * sg * t));
    sides.push([side(1), side(-1)]);
  }
  fillWallGaps(sides, floor, GAP_STATIONS);
  // Runs of stations with a wall on at least one side.
  const cuts: Cut[] = [];
  let i = 0;
  while (i < n) {
    const isCut = (k: number) => inBox(st.p[k]) && !!(sides[k][0]?.wall || sides[k][1]?.wall);
    if (!isCut(i)) { i++; continue; }
    let j = i;
    while (j + 1 < n && isCut(j + 1)) j++;
    const idx = Array.from({ length: j - i + 1 }, (_, k) => i + k);
    const len = st.s[j] - st.s[i];
    const deepest = Math.max(...idx.map(k => Math.max(sides[k][0]?.depth ?? 0, sides[k][1]?.depth ?? 0)));
    if (len >= MIN_RUN_M && deepest >= MIN_RUN_DEPTH_M) cuts.push(buildCut(`ramp:${way.id}:${i}`, 'ramp', motor, idx.map(k => st.p[k]), idx.map(k => st.s[k]), idx.map(k => floor[k]), idx.map(k => sides[k]), way.half));
    i = j + 1;
  }
  return cuts;
}

/** Wall gaps up to this many stations between two walled stations on the same side are bridged (a junction mouth, a lamp post, a DTM hole). */
export const GAP_STATIONS = 6;

/**
 * Bridge short gaps in each side's walls: stations between two walled stations at most `gap` apart get a wall
 * interpolated between them (reach and rim), so one bad DTM sample or a gully does not split the cut.
 */
export function fillWallGaps(sides: [SideScan | null, SideScan | null][], floor: readonly number[], gap: number): void {
  for (const k of [0, 1] as const) {
    let last = -1;
    for (let i = 0; i < sides.length; i++) {
      if (!sides[i][k]?.wall) continue;
      if (last >= 0 && i - last > 1 && i - last <= gap + 1) {
        const a = sides[last][k]!, b = sides[i][k]!;
        for (let j = last + 1; j < i; j++) {
          if (sides[j][k]?.wall || !(floor[j] === floor[j])) continue;
          const f = (j - last) / (i - last), rim = a.rim + (b.rim - a.rim) * f;
          sides[j][k] = { reach: a.reach + (b.reach - a.reach) * f, wall: true, rim, depth: Math.max(0, rim - floor[j]) };
        }
      }
      last = i;
    }
  }
}

function buildCut(id: string, kind: Cut['kind'], motor: boolean, p: Vec2[], s: number[], floorRaw: number[], sides: [SideScan | null, SideScan | null][], half: number): Cut {
  // A side with neither wall nor shared neighbour at a station keeps the way's own edge (the bands cover it).
  const reach = (k: 0 | 1) => smoothRun(sides.map(sd => sd[k]?.reach ?? half));
  const wall = (k: 0 | 1) => { const w = sides.map(sd => (sd[k]?.wall ? 1 : 0)); return w.map((v, i) => (median([w[i - 1] ?? v, v, w[i + 1] ?? v]) >= 0.5 ? 1 : 0)); };
  const rim = (k: 0 | 1) => smoothRun(sides.map((sd, i) => (sd[k]?.wall ? sd[k]!.rim : NaN)));
  const floor = smoothRun(floorRaw, 1);
  const rimL = rim(0), rimR = rim(1);
  const cut: Cut = {
    id, way: Number(id.split(':')[1].split('+')[0]), kind, motor, x: p.map(q => q[0]), y: p.map(q => q[1]), s: s.map(v => v - s[0]), floor,
    left: reach(0), right: reach(1), wallL: wall(0), wallR: wall(1),
    rimL: rimL.map((v, i) => (v === v ? Math.max(v, floor[i]) : floor[i])), rimR: rimR.map((v, i) => (v === v ? Math.max(v, floor[i]) : floor[i])),
    portals: [], bbox: [0, 0, 0, 0],
  };
  cut.bbox = cutBox(cut);
  return cut;
}

export function cutBox(c: Cut): [number, number, number, number] {
  const r = Math.max(...c.left, ...c.right) + DIP_M + PARAPET_T + LID_M;
  return [Math.min(...c.x) - r, Math.min(...c.y) - r, Math.max(...c.x) + r, Math.max(...c.y) + r];
}

/** A cut's stations [i, j] as a cut of its own (s re-based to 0). */
export function sliceCut(c: Cut, i: number, j: number): Cut {
  const pick = <T>(a: T[]) => a.slice(i, j + 1);
  const out: Cut = { ...c, id: i === 0 && j === c.x.length - 1 ? c.id : `${c.id}/${i}`, x: pick(c.x), y: pick(c.y), s: pick(c.s).map(v => v - c.s[i]), floor: pick(c.floor), left: pick(c.left), right: pick(c.right), wallL: pick(c.wallL), wallR: pick(c.wallR), rimL: pick(c.rimL), rimR: pick(c.rimR), portals: c.portals.filter(p => p.at >= i && p.at <= j).map(p => ({ ...p, at: p.at - i })) };
  out.bbox = cutBox(out);
  return out;
}

/** Where `w` crosses the polyline (x, y): stations along it and the sine of the crossing angle. */
function crossings(c: Cut, w: readonly Vec2[]): { s: number; sin: number }[] {
  const out: { s: number; sin: number }[] = [];
  for (let i = 0; i + 1 < c.x.length; i++) {
    const ax = c.x[i], ay = c.y[i], bx = c.x[i + 1], by = c.y[i + 1], ux = bx - ax, uy = by - ay, lu = Math.hypot(ux, uy) || 1;
    for (let k = 0; k + 1 < w.length; k++) {
      const [px, py] = w[k], vx = w[k + 1][0] - px, vy = w[k + 1][1] - py, den = ux * vy - uy * vx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((px - ax) * vy - (py - ay) * vx) / den, u = ((px - ax) * uy - (py - ay) * ux) / den;
      if (t < 0 || t > 1 || u < 0 || u > 1) continue;
      out.push({ s: c.s[i] + t * lu, sin: Math.abs(den) / (lu * (Math.hypot(vx, vy) || 1)) });
    }
  }
  return out;
}

/**
 * Break a cut where a street at the land's level crosses its centreline (`over`: roads that are neither tunnels nor
 * cut themselves): the stations within the street's half-width (+1 m, along the crossing angle) go; each piece says
 * which of its ends lies under a crossing.
 */
export function splitAtCrossings(c: Cut, over: readonly CutWay[]): { cut: Cut; crossed: [boolean, boolean] }[] {
  const gaps: [number, number][] = [];
  const [x0, y0, x1, y1] = c.bbox;
  for (const w of over) {
    let wx0 = Infinity, wy0 = Infinity, wx1 = -Infinity, wy1 = -Infinity;
    for (const [px, py] of w.points) { wx0 = Math.min(wx0, px); wy0 = Math.min(wy0, py); wx1 = Math.max(wx1, px); wy1 = Math.max(wy1, py); }
    if (wx1 < x0 || wx0 > x1 || wy1 < y0 || wy0 > y1) continue;
    for (const k of crossings(c, w.points)) { const r = (w.half + 1) / Math.max(0.3, k.sin); gaps.push([k.s - r, k.s + r]); }
  }
  if (!gaps.length) return [{ cut: c, crossed: [false, false] }];
  const keep = c.s.map(s => !gaps.some(([a, b]) => s >= a && s <= b));
  const out: { cut: Cut; crossed: [boolean, boolean] }[] = [];
  for (let i = 0; i < keep.length;) {
    if (!keep[i]) { i++; continue; }
    let j = i;
    while (j + 1 < keep.length && keep[j + 1]) j++;
    if (j > i) out.push({ cut: sliceCut(c, i, j), crossed: [i > 0, j < keep.length - 1] });
    i = j + 1;
  }
  return out;
}

/** Rounded key of a point (0.1 m), for portal and junction matching. */
const pkey = (p: Vec2) => `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`;

export interface Portal { at: Vec2; /** Unit direction into the tunnel. */ dir: Vec2; tunnel: CutWay; motor: boolean }

/** Where a tunnel way ends at a vertex of an open (non-tunnel) road: the portals. */
export function findPortals(ways: readonly CutWay[]): Portal[] {
  const open = new Set<string>();
  for (const w of ways) if (!w.tunnel) for (const p of w.points) open.add(pkey(p));
  const out: Portal[] = [];
  for (const w of ways) {
    if (!w.tunnel) continue;
    for (const end of [0, w.points.length - 1]) {
      const p = w.points[end], q = w.points[end === 0 ? 1 : end - 1];
      if (!open.has(pkey(p))) continue;
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      out.push({ at: p, dir: [(q[0] - p[0]) / l, (q[1] - p[1]) / l], tunnel: w, motor: motorOnlyTags(w.tags) });
    }
  }
  return out;
}

/** Candidate roads from OSM ways: road-like, not bridges, with their drawn half-widths. */
export function cutWays(ways: readonly OsmWay[], project: (p: [number, number]) => Vec2): CutWay[] {
  const out: CutWay[] = [];
  const seen = new Set<number>();
  for (const w of ways) {
    if (seen.has(w.id) || w.g.length < 2 || !roadLike(w.tags) || isBridgeTags(w.tags)) continue;
    seen.add(w.id);
    out.push({ id: w.id, tags: w.tags, points: w.g.map(project), half: drawnHalfWidth(w.tags), tunnel: isTunnelTags(w.tags) });
  }
  return out;
}

/**
 * Tunnel runs: tunnel ways chained end to end (same rideability), with the portal at each end if there is one.
 */
export function tunnelRuns(ways: readonly CutWay[]): { ways: CutWay[]; points: Vec2[]; ends: [boolean, boolean] }[] {
  const tunnels = ways.filter(w => w.tunnel);
  const open = new Set<string>();
  for (const w of ways) if (!w.tunnel) for (const p of w.points) open.add(pkey(p));
  const byEnd = new Map<string, CutWay[]>();
  for (const w of tunnels) for (const p of [w.points[0], w.points[w.points.length - 1]]) (byEnd.get(pkey(p)) ?? byEnd.set(pkey(p), []).get(pkey(p))!).push(w);
  const used = new Set<number>(), runs: { ways: CutWay[]; points: Vec2[]; ends: [boolean, boolean] }[] = [];
  for (const w of tunnels) {
    if (used.has(w.id)) continue;
    used.add(w.id);
    let pts = w.points.slice();
    const chain = [w];
    // Grow at both ends while exactly one other tunnel way of the same rideability continues there.
    for (const atStart of [false, true]) {
      for (;;) {
        const end = atStart ? pts[0] : pts[pts.length - 1];
        const next = (byEnd.get(pkey(end)) ?? []).filter(q => !used.has(q.id) && rideableTags(q.tags) === rideableTags(w.tags));
        if (next.length !== 1 || open.has(pkey(end))) break;
        const q = next[0];
        used.add(q.id); chain.push(q);
        const fwd = pkey(q.points[0]) === pkey(end), seg = fwd ? q.points : q.points.slice().reverse();
        pts = atStart ? [...seg.slice().reverse(), ...pts.slice(1)] : [...pts, ...seg.slice(1)];
      }
    }
    runs.push({ ways: chain, points: pts, ends: [open.has(pkey(pts[0])), open.has(pkey(pts[pts.length - 1]))] });
  }
  return runs;
}

const lengthOf = (pts: readonly Vec2[]) => pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);

/**
 * A slot through a rideable tunnel run (both ends portals, at most SLOT_MAX_M): the floor is the line between the
 * relief just outside its two portals, and it opens where the relief over the run rises SLOT_MIN_EXCESS_M over it.
 */
export function slotCut(run: { ways: CutWay[]; points: Vec2[]; ends: [boolean, boolean] }, ground: HeightFn): Cut | null {
  if (!run.ends[0] || !run.ends[1] || !run.ways.every(w => rideableTags(w.tags))) return null;
  const L = lengthOf(run.points);
  if (L > SLOT_MAX_M || L < 4) return null;
  // The run on SLOT_EXT_M past each portal: the DTM smears the embankment's face over the road outside it.
  const p0 = run.points[0], p1 = run.points[1], q0 = run.points[run.points.length - 1], q1 = run.points[run.points.length - 2];
  const l0 = Math.hypot(p0[0] - p1[0], p0[1] - p1[1]) || 1, l1 = Math.hypot(q0[0] - q1[0], q0[1] - q1[1]) || 1;
  const a: Vec2 = [p0[0] + (p0[0] - p1[0]) / l0 * SLOT_EXT_M, p0[1] + (p0[1] - p1[1]) / l0 * SLOT_EXT_M], b: Vec2 = [q0[0] + (q0[0] - q1[0]) / l1 * SLOT_EXT_M, q0[1] + (q0[1] - q1[1]) / l1 * SLOT_EXT_M];
  const st = stationsAlong([a, ...run.points, b], STATION_M), n = st.p.length, Lx = st.s[n - 1];
  // Portal levels: the lowest relief at the portal and 3, 6, 9 m outside it, along the run's axis.
  const level = (p: Vec2, d: Vec2) => Math.min(...[0, 3, 6, 9].map(m => ground(p[0] + d[0] * m, p[1] + d[1] * m)));
  const za = level(p0, [(p0[0] - p1[0]) / l0, (p0[1] - p1[1]) / l0]), zb = level(q0, [(q0[0] - q1[0]) / l1, (q0[1] - q1[1]) / l1]);
  const floor = st.s.map(s => za + (zb - za) * Math.max(0, Math.min(1, (s - SLOT_EXT_M) / (L || 1))));
  void Lx;
  const excess = Math.max(...st.p.map((p, i) => ground(p[0], p[1]) - floor[i]));
  if (excess < SLOT_MIN_EXCESS_M) return null;
  const half = Math.max(SLOT_MIN_HALF_M, Math.max(...run.ways.map(w => w.half)) + SLOT_MARGIN_M);
  const sides: [SideScan | null, SideScan | null][] = st.p.map((p, i) => {
    const nx = -st.t[i][1], ny = st.t[i][0];
    const side = (sg: number): SideScan => {
      const rim = median([1, 1.5, 2, 3].map(d => ground(p[0] + nx * sg * (half + d), p[1] + ny * sg * (half + d))));
      return { reach: half, wall: true, rim: Math.max(rim, floor[i]), depth: Math.max(0, rim - floor[i]) };
    };
    return [side(1), side(-1)];
  });
  const cut = buildCut(`slot:${run.ways.map(w => w.id).join('+')}`, 'slot', false, st.p, st.s, floor, sides, half);
  // A slot's floor is the line, unsmoothed; its reach the fixed half.
  cut.floor = floor; cut.left = cut.left.map(() => half); cut.right = cut.right.map(() => half);
  return cut;
}

/**
 * Plan every cut around a set of portals. `ways` are the candidate roads of the neighbourhood (cutWays), `ground` the
 * raw relief (no cuts). Ramps: the open ways at each portal and the tunnel ways themselves (open in the DTM where a
 * louvred roof lets it see the road) are scanned, then every candidate road near a found cut, three rounds at most;
 * `skip` holds way ids scanned by an earlier plan (each way is scanned once). Slots: rideable tunnel runs (slotCut).
 * Motor-only tunnels get a portal where a ramp cut ends against the tunnel's roof.
 */
export function planCuts(ways: readonly CutWay[], ground: HeightFn, within: (p: Vec2) => boolean, skip: Set<number> = new Set(), box?: readonly [number, number, number, number]): Cut[] {
  const portals = findPortals(ways).filter(p => within(p.at));
  const cuts: Cut[] = [];
  const motorAt = (w: CutWay) => motorOnlyTags(w.tags);
  // Seeds: ways with a vertex at a portal, and the tunnel ways themselves.
  const keys = new Set(portals.map(p => pkey(p.at)));
  let queue = ways.filter(w => !skip.has(w.id) && (w.points.some(p => keys.has(pkey(p)))));
  for (let round = 0; round < 4 && queue.length; round++) {
    const found: Cut[] = [];
    for (const w of queue) {
      if (skip.has(w.id)) continue;
      skip.add(w.id);
      const scanned = scanWay(w, ground, ways, motorAt(w) || (w.tunnel && portals.some(p => p.tunnel.id === w.id && p.motor)), box);
      // On a tunnel way only the part the DTM sees open (a louvred roof) continues a ramp: a run that starts at one of
      // its portals, on the floor of the open road just outside (within TUNNEL_FLOOR_TOL_M). Elsewhere the DTM over a
      // tunnel is the ground over it (a quay, a plaza, NEMO's stairs), and stays.
      found.push(...(w.tunnel ? scanned.filter(c => portals.some(p => {
        if (p.tunnel.id !== w.id) return false;
        const open = ground(p.at[0] - p.dir[0] * 4, p.at[1] - p.dir[1] * 4);
        // Every station stays on (or under) the open road's level: a run climbing onto the embankment over the tunnel is its roof.
        return [0, c.x.length - 1].some(e => Math.hypot(c.x[e] - p.at[0], c.y[e] - p.at[1]) < 3 && Math.abs(c.floor[e] - open) < TUNNEL_FLOOR_TOL_M)
          && c.floor.every(f => f <= open + TUNNEL_FLOOR_TOL_M);
      })) : scanned));
    }
    cuts.push(...found);
    // Next round: candidate roads with a vertex on a found cut's strip (a neighbouring carriageway, a slip road
    // merging into the ramp) or at its ends (the way continuing past a junction).
    queue = found.length ? ways.filter(w => !skip.has(w.id) && found.some(c => w.points.some(p => {
      if (p[0] < c.bbox[0] || p[0] > c.bbox[2] || p[1] < c.bbox[1] || p[1] > c.bbox[3]) return false;
      const h = locateCut(c, p[0], p[1]);
      return !!h && h.s >= -1 && h.s <= c.s[c.s.length - 1] + 1 && h.lateral <= h.left + 1 && h.lateral >= -h.right - 1;
    }))) : [];
  }
  // A street crossing the strip at the land's level (not a bridge, not in a cut itself) passes over the ramp: the strip
  // breaks under it (the ground under a road over a sunken trunk is the DTM's view under its deck, Prins Hendrikkade).
  const cutIds = new Set(cuts.map(c => c.way));
  const pieces = cuts.flatMap(c => splitAtCrossings(c, ways.filter(w => !w.tunnel && !cutIds.has(w.id))));
  // Portals: a motor tunnel's portal (or the end of its DTM-open part) where a ramp cut ends against the roof, and
  // a motor ramp's end under a crossing street.
  for (const { cut: c, crossed } of pieces) {
    if (c.kind !== 'ramp') continue;
    for (const at of [0, c.x.length - 1]) {
      const k = at === 0 ? 1 : at - 1, dx = c.x[at] - c.x[k], dy = c.y[at] - c.y[k], l = Math.hypot(dx, dy) || 1, d: Vec2 = [dx / l, dy / l];
      const probe: Vec2 = [c.x[at] + d[0] * 4, c.y[at] + d[1] * 4];
      const tunnel = ways.find(w => w.tunnel && motorOnlyTags(w.tags) && polylineDistance(w.points, probe[0], probe[1]) < Math.max(2, w.half));
      const under = crossed[at === 0 ? 0 : 1];
      if (!tunnel && !(under && c.motor)) continue;
      const top = under ? Math.max(c.rimL[at], c.rimR[at]) : median([3, 4, 5, 6].map(m => ground(c.x[at] + d[0] * m, c.y[at] + d[1] * m)));
      if (!(top - c.floor[at] > 2.5)) continue;
      c.portals.push({ at, dir: d, top });
      c.motor = true;
    }
  }
  cuts.length = 0;
  cuts.push(...pieces.map(p => p.cut).filter(c => c.s[c.s.length - 1] >= 4));
  // Slots.
  for (const run of tunnelRuns(ways)) {
    if (run.ways.some(w => skip.has(-w.id)) || !run.points.some(within)) continue;
    const slot = slotCut(run, ground);
    for (const w of run.ways) skip.add(-w.id);
    if (slot) cuts.push(slot);
  }
  dropSharedWalls(cuts);
  return cuts;
}

/**
 * Walls between two cuts that meet (a road tunnel beside its cycle tunnel, two carriageways of one ramp) are not
 * walls: a wall whose outside (0.5 m past its edge) lies in another cut's strip goes, and with it the parapet.
 */
export function dropSharedWalls(cuts: readonly Cut[]): number {
  let dropped = 0;
  for (const c of cuts) for (let i = 0; i < c.x.length; i++) for (const sg of [1, -1] as const) {
    const w = sg > 0 ? c.wallL : c.wallR;
    if (!w[i]) continue;
    const [nx, ny] = normalAt(c, i), r = (sg > 0 ? c.left[i] : c.right[i]) + 0.5, px = c.x[i] + nx * sg * r, py = c.y[i] + ny * sg * r;
    if (cuts.some(o => o !== c && px >= o.bbox[0] && px <= o.bbox[2] && py >= o.bbox[1] && py <= o.bbox[3] && (() => { const h = locateCut(o, px, py); return !!h && insideCut(o, h); })())) { w[i] = 0; dropped++; }
  }
  return dropped;
}

// ------------------------------------------------------------------ queries

export interface CutHit {
  /** Station (metres along) and the segment's interpolation. */
  s: number; i: number; f: number;
  /** Signed lateral offset (+ left). */
  lateral: number;
  floor: number; left: number; right: number; rimL: number; rimR: number; wallL: number; wallR: number;
}

/** Nearest point of the cut's centreline to (x, y), with the interpolated cross-section there (null past either end). */
export function locateCut(c: Cut, x: number, y: number): CutHit | null {
  const n = c.x.length;
  let best = Infinity, bi = -1, bt = 0, side = 0;
  for (let i = 0; i + 1 < n; i++) {
    const ax = c.x[i], ay = c.y[i], dx = c.x[i + 1] - ax, dy = c.y[i + 1] - ay, l2 = dx * dx + dy * dy || 1e-9;
    const t = ((x - ax) * dx + (y - ay) * dy) / l2;
    const tc = Math.max(0, Math.min(1, t)), ex = x - ax - dx * tc, ey = y - ay - dy * tc, d2 = ex * ex + ey * ey;
    if (d2 < best) { best = d2; bi = i; bt = t; side = dx * ey - dy * ex; }
  }
  if (bi < 0) return null;
  const f = Math.max(0, Math.min(1, bt)), lerp = (a: number[]) => a[bi] + (a[bi + 1] - a[bi]) * f;
  const seg = Math.hypot(c.x[bi + 1] - c.x[bi], c.y[bi + 1] - c.y[bi]);
  // Past an end (only the end segments extrapolate): s outside [0, length].
  const s = c.s[bi] + seg * ((bi === 0 && bt < 0) || (bi === n - 2 && bt > 1) ? bt : f);
  return { s, i: bi, f, lateral: Math.sign(side) * Math.sqrt(best), floor: lerp(c.floor), left: lerp(c.left), right: lerp(c.right), rimL: lerp(c.rimL), rimR: lerp(c.rimR), wallL: lerp(c.wallL), wallR: lerp(c.wallR) };
}

/** Is a hit inside the strip (between its edges, within its stations)? */
export const insideCut = (c: Cut, h: CutHit): boolean => h.s >= 0 && h.s <= c.s[c.s.length - 1] && h.lateral <= h.left && h.lateral >= -h.right;

/**
 * The relief a cut implies at a point, or NaN where it says nothing: inside the strip the wall-top level of the
 * nearer side (the raw relief on a side without a wall); behind a wall, over DIP_M, at least its top; past a portal,
 * over LID_M, at least the headwall's top.
 */
export function cutRelief(c: Cut, h: CutHit, raw: number): number {
  const end = c.s[c.s.length - 1];
  for (const p of c.portals) {
    const past = p.at === 0 ? -h.s : h.s - end;
    if (past >= 0 && past <= LID_M && h.lateral <= h.left + DIP_M && h.lateral >= -h.right - DIP_M) return Math.max(raw, p.top);
  }
  if (h.s < 0 || h.s > end) return NaN;
  if (h.lateral >= 0) {
    if (h.lateral <= h.left) return h.wallL >= 0.5 ? h.rimL : NaN;
    return h.wallL >= 0.5 && h.lateral <= h.left + DIP_M ? Math.max(raw, h.rimL) : NaN;
  }
  if (-h.lateral <= h.right) return h.wallR >= 0.5 ? h.rimR : NaN;
  return h.wallR >= 0.5 && -h.lateral <= h.right + DIP_M ? Math.max(raw, h.rimR) : NaN;
}

// ------------------------------------------------------------------ meshes

/** The strip's outline (left edge out, right edge back), for the cell's land mask. */
export function cutRing(c: Cut): Vec2[] {
  const left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < c.x.length; i++) {
    const [nx, ny] = normalAt(c, i);
    left.push([c.x[i] + nx * c.left[i], c.y[i] + ny * c.left[i]]);
    right.push([c.x[i] - nx * c.right[i], c.y[i] - ny * c.right[i]]);
  }
  return [...left, ...right.reverse()];
}

/** Unit left normal at station i (mean of the adjacent segments' directions). */
function normalAt(c: Cut, i: number): Vec2 {
  const a = Math.max(0, i - 1), b = Math.min(c.x.length - 1, i + 1), dx = c.x[b] - c.x[a], dy = c.y[b] - c.y[a], l = Math.hypot(dx, dy) || 1;
  return [-dy / l, dx / l];
}

function quad(m: MeshArrays, p: [number, number, number][], toward: [number, number, number], colour: RGB): void {
  const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
  const nrm = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], flip = nrm[0] * toward[0] + nrm[1] * toward[1] + nrm[2] * toward[2] < 0;
  const k = p.map(q => vertex(m, q[0], q[1], q[2], colour));
  if (flip) m.indices.push(k[0], k[2], k[1], k[0], k[3], k[2]); else m.indices.push(k[0], k[1], k[2], k[0], k[2], k[3]);
}

export interface CutMeshes { walls: MeshArrays; floor: MeshArrays; walled: number; portals: number }

/**
 * A cut's geometry for one cell (`owns(x, y)`: the segment midpoints it draws): per walled side a concrete face from
 * under the floor to the wall top and a parapet on it (face, top, back), the coping over the land's cut edge; a floor
 * strip edge to edge just under the bands; a portal (dark mouth, headwall up to the land over the tunnel plus the
 * parapet) where one was found. Walls are vertex-coloured (deckBody), the floor plain (asphalt).
 */
export function cutMeshes(c: Cut, owns: (x: number, y: number) => boolean): CutMeshes {
  const walls = emptyMesh(true), floor = emptyMesh();
  const C = TUNNEL_COLOURS, n = c.x.length, parapet = PARAPET_M;
  let walled = 0;
  const edge = (i: number, sg: 1 | -1, extra = 0): Vec2 => { const [nx, ny] = normalAt(c, i), r = (sg > 0 ? c.left[i] : c.right[i]) + extra; return [c.x[i] + nx * sg * r, c.y[i] + ny * sg * r]; };
  for (let i = 0; i + 1 < n; i++) {
    const mx = (c.x[i] + c.x[i + 1]) / 2, my = (c.y[i] + c.y[i + 1]) / 2;
    if (!owns(mx, my)) continue;
    // Floor: edge to edge at the floor (the bands' own lifts sit above it).
    const fl = [edge(i, 1), edge(i + 1, 1), edge(i + 1, -1), edge(i, -1)];
    const zf = [c.floor[i], c.floor[i + 1], c.floor[i + 1], c.floor[i]].map(z => z + FLOOR_LIFT_M);
    const k = fl.map((p, q) => vertex(floor, p[0], p[1], zf[q]));
    // Up-facing: left edge (a, b) then right edge (b', a'): a, b, b', a' runs clockwise from above when the left normal is left.
    floor.indices.push(k[0], k[2], k[1], k[0], k[3], k[2]);
    for (const sg of [1, -1] as const) {
      const w = sg > 0 ? c.wallL : c.wallR, rim = sg > 0 ? c.rimL : c.rimR;
      if (!w[i] || !w[i + 1]) continue;
      const a = edge(i, sg), b = edge(i + 1, sg), into: [number, number, number] = [-(normalAt(c, i)[0]) * sg, -(normalAt(c, i)[1]) * sg, 0];
      if (rim[i] - c.floor[i] < 0.15 && rim[i + 1] - c.floor[i + 1] < 0.15) continue;
      const ta = rim[i] + parapet, tb = rim[i + 1] + parapet;
      // Face: from under the floor up to the parapet's top.
      quad(walls, [[a[0], a[1], c.floor[i] - 0.3], [b[0], b[1], c.floor[i + 1] - 0.3], [b[0], b[1], tb], [a[0], a[1], ta]], into, C.wall);
      // Parapet top and back face (down to just under the land).
      const a2 = edge(i, sg, PARAPET_T), b2 = edge(i + 1, sg, PARAPET_T);
      quad(walls, [[a[0], a[1], ta], [b[0], b[1], tb], [b2[0], b2[1], tb], [a2[0], a2[1], ta]], [0, 0, 1], C.coping);
      quad(walls, [[a2[0], a2[1], ta], [b2[0], b2[1], tb], [b2[0], b2[1], rim[i + 1] - 0.4], [a2[0], a2[1], rim[i] - 0.4]], [-into[0], -into[1], 0], C.parapet);
      walled++;
    }
  }
  let portals = 0;
  for (const p of c.portals) {
    const i = p.at;
    if (!owns(c.x[i], c.y[i])) continue;
    const l = edge(i, 1, PARAPET_T), r = edge(i, -1, PARAPET_T), out: [number, number, number] = [-p.dir[0], -p.dir[1], 0];
    const f = c.floor[i], clear = Math.min(PORTAL_CLEAR_M, p.top - f - 0.6), top = Math.max(p.top, c.rimL[i], c.rimR[i]) + parapet;
    if (clear < 1.5) continue;
    const back = (q: Vec2, d: number): Vec2 => [q[0] + p.dir[0] * d, q[1] + p.dir[1] * d];
    const lm = edge(i, 1), rm = edge(i, -1);
    // The mouth: a dark face a little inside the portal (the tunnel's interior), and its soffit.
    const li = back(lm, 0.6), ri = back(rm, 0.6);
    quad(walls, [[li[0], li[1], f - 0.3], [ri[0], ri[1], f - 0.3], [ri[0], ri[1], f + clear], [li[0], li[1], f + clear]], out, C.mouth);
    quad(walls, [[lm[0], lm[1], f + clear], [rm[0], rm[1], f + clear], [ri[0], ri[1], f + clear], [li[0], li[1], f + clear]], [0, 0, -1], C.mouth);
    // Reveals: the mouth's sides between the portal plane and the dark face.
    for (const [q, qi, sg] of [[lm, li, 1], [rm, ri, -1]] as [Vec2, Vec2, number][]) {
      const nrm = normalAt(c, i);
      quad(walls, [[q[0], q[1], f - 0.3], [qi[0], qi[1], f - 0.3], [qi[0], qi[1], f + clear], [q[0], q[1], f + clear]], [-nrm[0] * sg, -nrm[1] * sg, 0], C.mouth);
    }
    // The headwall: above the mouth up to the land over the tunnel plus the parapet, edge to edge over the walls; its top.
    quad(walls, [[l[0], l[1], f + clear], [r[0], r[1], f + clear], [r[0], r[1], top], [l[0], l[1], top]], out, C.headwall);
    const lb = back(l, PARAPET_T), rb = back(r, PARAPET_T);
    quad(walls, [[l[0], l[1], top], [r[0], r[1], top], [rb[0], rb[1], top], [lb[0], lb[1], top]], [0, 0, 1], C.coping);
    quad(walls, [[lb[0], lb[1], top], [rb[0], rb[1], top], [rb[0], rb[1], p.top - 0.4], [lb[0], lb[1], p.top - 0.4]], [p.dir[0], p.dir[1], 0], C.parapet);
    portals++;
  }
  return { walls, floor, walled, portals };
}
