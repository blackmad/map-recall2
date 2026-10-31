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
/**
 * …and for a motor road, within this (metres): motorway and trunk cuts carry shoulders and verges inside the walls
 * (Piet Hein east, the A10 at Watergraafsmeer: the wall foot 12-15 m from the carriageway's centreline).
 */
export const WALL_REACH_MOTOR_M = 10;
/** A rise lower than this (metres) that the relief falls back from is a kerb island or barrier, not a wall. */
export const BUMP_MAX_M = 1;
/** A covered span: a motor ramp ending where the relief steps up at least the portal height, a motor tunnel's portal this far beyond it at most (metres; the IJsei bus station over the Michiel de Ruijtertunnel). */
export const COVER_REACH_M = 40;
/** A wall's DTM rise (foot to top) spans at most this plus `WALL_SPAN_PER_M` per metre of height; wider is a sloped bank (talud). */
export const WALL_SPAN_M = 4;
export const WALL_SPAN_PER_M = 1.5;
/** Behind a wall, the relief is lifted to its top over this width (the DTM's smear of the wall), metres. */
export const DIP_M = 4;
/** Past a portal the relief over the tunnel is lifted to the headwall's top over this length, metres. */
export const LID_M = 6;
/** Ramps are scanned this far from their portal at most, metres (the IJ-tunnel's south ramp: ~330 m). */
export const RAMP_REACH_M = 500;
/** A road open to the rider is scanned this far from a portal at most, metres. */
export const RIDE_RAMP_REACH_M = 120;
/** …and only where bounded on both sides for at least this share of the run. */
export const BOTH_SIDES_MIN = 0.5;
/**
 * The wall line is smoothed by a running median over REACH_MEDIAN_R stations either side and a mean over
 * REACH_MEAN_R (~30 m in all): a retaining wall is straight or gently curved, while the DTM's half-height line
 * wanders with steps, stairs and planters beside it (the IJ ramp's east wall drew a sinuous coping line).
 */
export const REACH_MEDIAN_R = 8;
export const REACH_MEAN_R = 6;
/** A tunnel way is scanned this far from its own portals at most (its DTM-open, louvred stretch), metres. */
export const TUNNEL_SCAN_M = 200;
/** A rideable tunnel run this long at most may be opened as a slot, metres (probe-slot-lengths.ts: no rideable run over it climbs). */
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
export const PARAPET_T = 0.45;
/**
 * The shade band on the floor along a wall (the wall's own shadow and the occlusion of its corner): this share of the
 * wall's depth wide, within [SHADE_MIN_M, SHADE_MAX_M], darkest at the foot. It lies over the carriageway's bands (at
 * SHADE_LIFT_M over the floor, above their 0.03 m), which otherwise cover the foot to the wall (round 3's gutter did not
 * show on the phone frame for that reason).
 */
export const SHADE_PER_M = 0.35;
export const SHADE_MIN_M = 0.6;
export const SHADE_MAX_M = 2.5;
export const SHADE_LIFT_M = 0.06;
/** Clear height of a portal's mouth (motor tunnel), metres. */
export const PORTAL_CLEAR_M = 4.6;
/** A slot's portal lintel: the embankment must stand this far over the floor at the tunnel's end, metres; its clear height. */
export const SLOT_PORTAL_MIN_M = 3;
export const SLOT_CLEAR_M = 2.8;
/** Floor under the bands: lift over the floor (the carriageway's 0.03 stays on top). */
export const FLOOR_LIFT_M = 0.012;

/** A run is carried on past its ends while a side still shows a rise of at least this (metres): the ramp's shallow taper. */
export const TAPER_RISE_M = 0.15;
/** …for this far at most, metres: the last 0.45 m of a ramp at 2-4 % is 11-23 m; farther, a 0.15 m rise is a kerb. */
export const TAPER_MAX_M = 30;
/** Two cuts side by side (the carriageways of one ramp) merge across a gap this wide at most (metres)… */
export const MERGE_GAP_M = 12;
/** …when their floors agree within this (metres)… */
export const MERGE_FLOOR_M = 1.2;
/** …and the relief between them stands at most this over the higher floor (a median island or barrier, not a berm). */
export const MERGE_BERM_M = 1.6;
/** A wider gap (up to this, metres) merges only when its relief lies flat on the floors (within MERGE_FLAT_M): a
 *  sunken verge where the carriageways part toward the portal (the IJ-tunnel south ramp's 12-14 m wedge, round 4). */
export const MERGE_WIDE_GAP_M = 20;
export const MERGE_FLAT_M = 0.5;
/** Coping lip on the trench face, metres, and its overhang. */
export const COPING_LIP_M = 0.18;
export const COPING_OVER_M = 0.08;

/**
 * Colours (sRGB): weathered in-situ concrete, stained dark at the foot (run-off, tyre spray) and paler toward the
 * top, under a dark grey coping. The panoramas (data.amsterdam.nl, IJ-tunnel south ramp) show a paler face in
 * sunlight, but at the chase camera's distance on a phone the cut reads only by contrast with the pale pavement around
 * it, so the face and coping are kept darker than the photo. The land-side face of the parapet is the paler concrete;
 * the mouth is dark.
 */
export const TUNNEL_COLOURS = {
  wallFoot: [0.2, 0.195, 0.185] as RGB, wallTop: [0.38, 0.375, 0.36] as RGB, coping: [0.42, 0.415, 0.4] as RGB, parapet: [0.64, 0.63, 0.6] as RGB,
  /** The parapet's top: dark weathered grey. From the chase camera the wall nearest it shows only its top, so the
   *  coping and cap draw the trench's edge as a dark line against the pale pavement (round 4: a pale coping and a
   *  pale face vanished into the quay on the phone frame). */
  cap: [0.34, 0.335, 0.32] as RGB,
  /** The shade band: darkest at the wall's foot, its outer edge still darker than the carriageway. */
  shadeFoot: [0.07, 0.07, 0.08] as RGB, shadeEdge: [0.2, 0.2, 0.21] as RGB,
  mouth: [0.04, 0.045, 0.05] as RGB, headwall: [0.52, 0.515, 0.495] as RGB,
};

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
  /** A slot's portal: the passage runs on open-topped through the embankment, so a headwall spans it with no dark mouth. */
  open?: boolean;
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
  /**
   * Merged with a neighbouring cut across that side (mergeNeighbours): the gap to the neighbour's strip, metres (0: not
   * merged), and the neighbour's floor there. The gap (a median between carriageways) lies on the floors.
   */
  gapL?: number[]; gapR?: number[]; nfL?: number[]; nfR?: number[];
  /**
   * A raised median toward a neighbouring cut of the same trench that did not merge (its relief stands over
   * MERGE_BERM_M): the width from this strip's edge to the neighbour's, metres (0: none). Drawn as grass on the land
   * between the two walls (cutMedianQuads).
   */
  medL?: number[]; medR?: number[];
  portals: CutPortal[];
  bbox: [number, number, number, number];
}

const median = (v: number[]): number => { const s = v.filter(x => x === x).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : NaN; };

/** Running median over `r` stations either side (NaN entries ignored), then a 3-tap mean. */
export function smoothRun(v: readonly number[], r = 2): number[] {
  const m = v.map((_, i) => median(v.slice(Math.max(0, i - r), i + r + 1) as number[]));
  return m.map((x, i) => (x === x ? ((m[i - 1] ?? x) === (m[i - 1] ?? x) ? (m[i - 1] ?? x) : x) + x + ((m[i + 1] ?? x) === (m[i + 1] ?? x) ? (m[i + 1] ?? x) : x) : NaN) / 3);
}

/** Mean over `r` stations either side (NaN entries ignored; the window shrinks at the ends so they stay put). */
export function boxMean(v: readonly number[], r: number): number[] {
  return v.map((x, i) => {
    const w = Math.min(r, i, v.length - 1 - i);
    let s = 0, c = 0;
    for (let k = i - w; k <= i + w; k++) if (v[k] === v[k]) { s += v[k]; c++; }
    return c ? s / c : x;
  });
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
export function scanSide(g: (t: number) => number, floor: number, half: number, shared: ((t: number) => boolean) | null, minRise = MIN_RISE_M, wallReach = WALL_REACH_M, skipBumps = true): SideScan | null {
  let foot = 0, skipped = false;
  const none = () => (skipped ? scanSide(g, floor, half, shared, minRise, wallReach, false) : null);
  for (let t = SCAN_STEP_M; t <= SCAN_M; t += SCAN_STEP_M) {
    const z = g(t);
    if (z === z && z - floor <= (minRise >= MIN_RISE_M ? 0.25 : minRise * 0.5)) {
      foot = t;
      // Past the reach with no neighbouring road to meet: any rise from here has its foot too far off (exact exit).
      if (!shared && foot > half + wallReach) return none();
    }
    if (t > 1 && shared && shared(t) && Math.abs(z - floor) < 0.5) return skipped ? none() : { reach: t, wall: false, rim: z, depth: 0 };
    if (!(z - floor >= minRise)) continue;
    if (foot > half + wallReach) return none();
    // The plateau: keep climbing while the relief still rises.
    let top = t, zt = z;
    for (let u = t + SCAN_STEP_M; u <= Math.min(SCAN_M + 6, t + 8); u += SCAN_STEP_M) { const zu = g(u); if (!(zu > zt + 0.04)) break; top = u; zt = zu; }
    const depth = zt - floor;
    // A low rise the relief falls back from within a few metres (a kerb island, a barrier, a planter between the
    // carriageway and the wall) is no wall: the scan carries on past it (Piet Hein east: a 0.5 m island 4-8 m out hid
    // the 8 m wall at 14-18 m). With no wall behind it after all (a taper's end), or the neighbouring carriageway behind it
    // (a median kerb: the strips merge over it), the low rise is the side's wall.
    if (skipBumps && depth < BUMP_MAX_M && Math.min(...[2, 3, 4, 5, 6].map(m => g(top + m))) - floor < depth * 0.8) {
      let back = top + 2;
      while (back < top + 6 && g(back) - floor >= depth * 0.8) back += SCAN_STEP_M;
      foot = back; t = foot - SCAN_STEP_M; skipped = true; continue;
    }
    if (top - foot > WALL_SPAN_M + WALL_SPAN_PER_M * depth) return none();
    // Half-height crossing between the foot and the plateau.
    const mid = floor + depth / 2;
    let at = foot;
    for (let u = foot; u <= top; u += SCAN_STEP_M) { if (g(u) >= mid) { const z0 = g(u - SCAN_STEP_M); at = u - SCAN_STEP_M + SCAN_STEP_M * Math.max(0, Math.min(1, (mid - z0) / ((g(u) - z0) || 1))); break; } }
    // The rim: the land a little past the plateau (the median of a few samples, so a kerb or a hedge does not count).
    const rim = median([0, 1, 2, 3].map(k => g(top + k * SCAN_STEP_M)));
    return { reach: Math.max(Math.min(half, 1), at), wall: true, rim: Math.max(rim, mid), depth: Math.max(rim, mid) - floor };
  }
  return none();
}

export interface CutWay { id: number; tags: Record<string, string>; points: Vec2[]; half: number; tunnel: boolean }

/**
 * Scan a way for ramp cuts: stations every STATION_M, each side scanned (scanSide), runs of stations with a wall on
 * either side kept when at least MIN_RUN_M long and MIN_RUN_DEPTH_M deep somewhere. `others` are the candidate roads
 * around (their centrelines end a side as shared), `ground` the raw relief.
 */
export function scanWay(way: CutWay, ground: HeightFn, others: readonly CutWay[], motor: boolean, box?: readonly [number, number, number, number], reach?: (p: Vec2) => boolean): Cut[] {
  const inBox = (p: Vec2) => (!box || (p[0] >= box[0] && p[0] <= box[2] && p[1] >= box[1] && p[1] <= box[3])) && (!reach || reach(p));
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
  const scanAt = (i: number, minRise: number): [SideScan | null, SideScan | null] => {
    const [cx, cy] = st.p[i], [tx, ty] = st.t[i], nx = -ty, ny = tx, f = floor[i];
    const local = segs.filter(([ax, ay, bx, by]) => Math.max(ax, bx) > cx - R && Math.min(ax, bx) < cx + R && Math.max(ay, by) > cy - R && Math.min(ay, by) < cy + R);
    const onNeighbour = (x: number, y: number) => local.some(([ax, ay, bx, by]) => polylineDistance([[ax, ay], [bx, by]], x, y) < 0.75);
    const side = (sg: 1 | -1) => scanSide(t => ground(cx + nx * sg * t, cy + ny * sg * t), f, way.half, local.length ? t => onNeighbour(cx + nx * sg * t, cy + ny * sg * t) : null, minRise, motor ? WALL_REACH_MOTOR_M : WALL_REACH_M);
    return [side(1), side(-1)];
  };
  for (let i = 0; i < n; i++) {
    if (!inBox(st.p[i])) { floor.push(NaN); sides.push([null, null]); continue; }
    const [cx, cy] = st.p[i], [tx, ty] = st.t[i], nx = -ty, ny = tx;
    const fs: number[] = [];
    for (let t = -way.half * 0.5; t <= way.half * 0.5 + 1e-6; t += Math.max(0.5, way.half * 0.25)) fs.push(ground(cx + nx * t, cy + ny * t));
    floor.push(median(fs));
    sides.push(scanAt(i, MIN_RISE_M));
  }
  fillWallGaps(sides, floor, GAP_STATIONS);
  // Runs of stations with a wall on at least one side.
  const isCut = (k: number) => inBox(st.p[k]) && !!(sides[k][0]?.wall || sides[k][1]?.wall);
  const runs: [number, number][] = [];
  for (let i = 0; i < n;) {
    if (!isCut(i)) { i++; continue; }
    let j = i;
    while (j + 1 < n && isCut(j + 1)) j++;
    const idx = Array.from({ length: j - i + 1 }, (_, k) => i + k);
    const deepest = Math.max(...idx.map(k => Math.max(sides[k][0]?.depth ?? 0, sides[k][1]?.depth ?? 0)));
    // A road open to the rider is a ramp only where it is bounded on both sides (a wall, or a neighbouring road on the
    // floor) for at least BOTH_SIDES_MIN of its run: a path at the foot of a rail embankment or a dike has its "wall" on
    // one side and open land on the other (Westerpark, 2026-10-30).
    const both = idx.filter(k => sides[k][0] && sides[k][1]).length / idx.length;
    if (st.s[j] - st.s[i] >= MIN_RUN_M && deepest >= MIN_RUN_DEPTH_M && (motor || both >= BOTH_SIDES_MIN)) runs.push([i, j]);
    i = j + 1;
  }
  // A kept run carries on past its ends while a side still rises TAPER_RISE_M (the ramp's shallow start, where the
  // walls sink to nothing); only from a run already deep enough, so no new cut starts from a shallow dip.
  const taken = new Set<number>();
  for (const r of runs) for (let k = r[0]; k <= r[1]; k++) taken.add(k);
  for (const r of runs) {
    for (const dir of [-1, 1] as const) {
      const from = dir < 0 ? r[0] : r[1];
      for (let k = from + dir; k >= 0 && k < n && !taken.has(k) && inBox(st.p[k]) && floor[k] === floor[k] && Math.abs(st.s[k] - st.s[from]) <= TAPER_MAX_M; k += dir) {
        const sd = scanAt(k, TAPER_RISE_M);
        if (!sd[0]?.wall && !sd[1]?.wall) break;
        sides[k] = sd; taken.add(k);
        if (dir < 0) r[0] = k; else r[1] = k;
      }
    }
  }
  return runs.map(([i, j]) => {
    const idx = Array.from({ length: j - i + 1 }, (_, k) => i + k);
    return buildCut(`ramp:${way.id}:${i}`, 'ramp', motor, idx.map(k => st.p[k]), idx.map(k => st.s[k]), idx.map(k => floor[k]), idx.map(k => sides[k]), way.half);
  });
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
  // The wall line: a wider running median and a box mean (the DTM's half-height line wanders ±0.5 m station to station,
  // which drew a wobbling wall).
  // Walled and open stations are smoothed apart: a wall's line follows only its own stations (the open side's reach
  // runs to the next road's centreline, and mixing it in bulged the IJ ramp's east wall out at the foot, 2026-10-30).
  const wall = (k: 0 | 1) => { const w = sides.map(sd => (sd[k]?.wall ? 1 : 0)); return w.map((v, i) => (median([w[i - 1] ?? v, v, w[i + 1] ?? v]) >= 0.5 ? 1 : 0)); };
  const reach = (k: 0 | 1) => {
    const w = wall(k), raw = sides.map(sd => sd[k]?.reach ?? half);
    const part = (on: number) => boxMean(smoothRun(raw.map((v, i) => (w[i] === on ? v : NaN)), REACH_MEDIAN_R), REACH_MEAN_R);
    const walled = part(1), open = part(0);
    return raw.map((v, i) => { const r = w[i] ? walled[i] : open[i]; return r === r ? r : v; });
  };
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
  const r = Math.max(...c.left, ...c.right) + Math.max(DIP_M + PARAPET_T + LID_M, ...(c.gapL ?? []), ...(c.gapR ?? []));
  return [Math.min(...c.x) - r, Math.min(...c.y) - r, Math.max(...c.x) + r, Math.max(...c.y) + r];
}

/** A cut's stations [i, j] as a cut of its own (s re-based to 0). */
export function sliceCut(c: Cut, i: number, j: number): Cut {
  const pick = <T>(a: T[]) => a.slice(i, j + 1);
  const out: Cut = { ...c, id: i === 0 && j === c.x.length - 1 ? c.id : `${c.id}/${i}`, x: pick(c.x), y: pick(c.y), s: pick(c.s).map(v => v - c.s[i]), floor: pick(c.floor), left: pick(c.left), right: pick(c.right), wallL: pick(c.wallL), wallR: pick(c.wallR), rimL: pick(c.rimL), rimR: pick(c.rimR), ...(c.gapL ? { gapL: pick(c.gapL), gapR: pick(c.gapR!), nfL: pick(c.nfL!), nfR: pick(c.nfR!) } : {}), portals: c.portals.filter(p => p.at >= i && p.at <= j).map(p => ({ ...p, at: p.at - i })) };
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
const pkey = (p: Vec2): number => (Math.round(p[0] * 10) + 4194304) * 8388608 + (Math.round(p[1] * 10) + 4194304);

/** The tunnel ways' end vertices that are also vertices of an open (non-tunnel) road: where portals can be. */
function openEnds(ways: readonly CutWay[]): Set<number> {
  const ends = new Set<number>();
  for (const w of ways) if (w.tunnel) { ends.add(pkey(w.points[0])); ends.add(pkey(w.points[w.points.length - 1])); }
  const open = new Set<number>();
  if (!ends.size) return open;
  for (const w of ways) if (!w.tunnel) for (const p of w.points) { const k = pkey(p); if (ends.has(k)) open.add(k); }
  return open;
}

export interface Portal { at: Vec2; /** Unit direction into the tunnel. */ dir: Vec2; tunnel: CutWay; motor: boolean }

/** Where a tunnel way ends at a vertex of an open (non-tunnel) road: the portals. */
export function findPortals(ways: readonly CutWay[]): Portal[] {
  const open = openEnds(ways);
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
  const open = openEnds(ways);
  const byEnd = new Map<number, CutWay[]>();
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
  // Its portals: where the embankment over the tunnel's end stands a real headwall above the floor, a lintel spans
  // the slot there (open: no dark mouth, the passage stays in view).
  for (const [sAt, sg] of [[SLOT_EXT_M, 1], [SLOT_EXT_M + L, -1]] as const) {
    let at = 0;
    for (let i = 0; i < n; i++) if (Math.abs(st.s[i] - sAt) < Math.abs(st.s[at] - sAt)) at = i;
    const d: Vec2 = [st.t[at][0] * sg, st.t[at][1] * sg];
    const top = median([2, 3, 4, 5].map(m => ground(st.p[at][0] + d[0] * m, st.p[at][1] + d[1] * m)));
    if (top - floor[at] >= SLOT_PORTAL_MIN_M) cut.portals.push({ at, dir: d, top, open: true });
  }
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
  // Only stations within RAMP_REACH_M of one of these portals are scanned: a ramp is never longer, and a long trunk
  // way through the neighbourhood is not scanned end to end.
  const nearPortal = (q: Vec2) => portals.some(p => (q[0] - p.at[0]) ** 2 + (q[1] - p.at[1]) ** 2 <= RAMP_REACH_M * RAMP_REACH_M);
  // A road the rider may take is scanned only near a portal (a cycle or street underpass's ramp is short; farther on, a
  // path at the foot of a dike or a rail embankment has a "wall" on one side: Westerpark, 2026-10-30).
  const nearPortalRide = (q: Vec2) => portals.some(p => (q[0] - p.at[0]) ** 2 + (q[1] - p.at[1]) ** 2 <= RIDE_RAMP_REACH_M * RIDE_RAMP_REACH_M);
  const motorAt = (w: CutWay) => motorOnlyTags(w.tags);
  // Seeds: ways with a vertex at a portal, and the tunnel ways themselves.
  const keys = new Set(portals.map(p => pkey(p.at)));
  let queue = ways.filter(w => !skip.has(w.id) && (w.points.some(p => keys.has(pkey(p)))));
  for (let round = 0; round < 4 && queue.length; round++) {
    const found: Cut[] = [];
    for (const w of queue) {
      if (skip.has(w.id)) continue;
      skip.add(w.id);
      // A tunnel way is scanned only near its own portals (a run on it must start at one: TUNNEL_SCAN_M covers the
      // longest louvred open stretch, Piet Hein east).
      const own = w.tunnel ? portals.filter(p => p.tunnel.id === w.id) : [];
      const reach = w.tunnel ? (q: Vec2) => own.some(p => (q[0] - p.at[0]) ** 2 + (q[1] - p.at[1]) ** 2 <= TUNNEL_SCAN_M * TUNNEL_SCAN_M) : motorAt(w) ? nearPortal : nearPortalRide;
      const scanned = scanWay(w, ground, ways, motorAt(w) || (w.tunnel && portals.some(p => p.tunnel.id === w.id && p.motor)), box, reach);
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
      // The motor tunnel just beyond the end, or (a covered span: the ramp runs on under a deck or a station roof that
      // the DTM measures as ground) its portal up to COVER_REACH_M beyond, the relief stepping up at the end.
      const tunnelAt = (m: number) => { const q: Vec2 = [c.x[at] + d[0] * m, c.y[at] + d[1] * m]; return ways.find(w => w.tunnel && motorOnlyTags(w.tags) && polylineDistance(w.points, q[0], q[1]) < Math.max(2, w.half)); };
      let tunnel = tunnelAt(4), coverM = 0;
      for (let m = 8; !tunnel && c.motor && m <= COVER_REACH_M; m += 4) { tunnel = tunnelAt(m); if (tunnel) coverM = m; }
      const under = crossed[at === 0 ? 0 : 1];
      if (!tunnel && !(under && c.motor)) continue;
      const ahead = (m: number) => ground(c.x[at] + d[0] * m, c.y[at] + d[1] * m);
      let top = under ? Math.max(c.rimL[at], c.rimR[at]) : coverM ? NaN : median([3, 4, 5, 6].map(ahead));
      // The roof further on: a sun screen or truss over the carriageway (Piet Hein east: OSM's tunnel starts 10 m
      // before the DTM's roof edge) or a covered span: the mouth stands at the cut's end at the level of the roof
      // where the relief first steps up within COVER_REACH_M.
      if (!under && !(top - c.floor[at] > 2.5)) {
        for (let m = 4; m <= COVER_REACH_M; m += 2) if (ahead(m) - c.floor[at] > 2.5) { top = Math.max(...[0, 2, 4, 6, 8].map(k => ahead(m + k))); break; }
      }
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
  mergeNeighbours(cuts, ground);
  return cuts;
}

/**
 * Cuts side by side (two carriageways of one ramp, a road tunnel beside its cycle tunnel) are one trench: across each
 * side, the nearest other strip within MERGE_GAP_M whose floor agrees within MERGE_FLOOR_M, over relief standing at
 * most MERGE_BERM_M above the floors (a median island, a barrier: the DTM measures them, and they drew a ridge between
 * the carriageways), merges with it. The wall on that side goes, and the gap is recorded (gapL/gapR, the neighbour's
 * floor nfL/nfR) so the relief there lies on the floors (cutRelief). Single stations are smoothed out of either state.
 * `ground` is the raw relief. Returns the stations merged.
 */
export function mergeNeighbours(cuts: readonly Cut[], ground?: HeightFn): number {
  let merged = 0;
  for (const c of cuts) {
    const G = MERGE_WIDE_GAP_M, n = c.x.length, others = cuts.filter(o => o !== c && o.bbox[0] <= c.bbox[2] + G && o.bbox[2] >= c.bbox[0] - G && o.bbox[1] <= c.bbox[3] + G && o.bbox[3] >= c.bbox[1] - G);
    c.gapL = new Array(n).fill(0); c.gapR = new Array(n).fill(0); c.nfL = c.floor.slice(); c.nfR = c.floor.slice();
    c.medL = new Array(n).fill(0); c.medR = new Array(n).fill(0);
    if (!others.length) continue;
    for (const sg of [1, -1] as const) {
      const gap = sg > 0 ? c.gapL : c.gapR, nf = sg > 0 ? c.nfL : c.nfR, med = sg > 0 ? c.medL : c.medR;
      for (let i = 0; i < n; i++) {
        const [nx, ny] = normalAt(c, i), r = sg > 0 ? c.left[i] : c.right[i];
        for (let d = 0.25; d <= MERGE_WIDE_GAP_M; d += 0.5) {
          const px = c.x[i] + nx * sg * (r + d), py = c.y[i] + ny * sg * (r + d);
          let hit: CutHit | null = null;
          for (const o of others) {
            if (px < o.bbox[0] || px > o.bbox[2] || py < o.bbox[1] || py > o.bbox[3]) continue;
            const h = locateCut(o, px, py);
            if (h && insideCut(o, h)) { hit = h; break; }
          }
          if (!hit) continue;
          if (Math.abs(hit.floor - c.floor[i]) > MERGE_FLOOR_M) break;
          let rise = 0;
          if (ground) for (let e = 0.5; e < d; e += 1) rise = Math.max(rise, ground(c.x[i] + nx * sg * (r + e), c.y[i] + ny * sg * (r + e)) - Math.max(hit.floor, c.floor[i]));
          if (rise > (d > MERGE_GAP_M ? MERGE_FLAT_M : MERGE_BERM_M)) { if (d <= MERGE_GAP_M) med[i] = d; break; }
          gap[i] = Math.max(d, 0.01); nf[i] = hit.floor;
          break;
        }
      }
      // One station alone in either state follows its neighbours (a gap interpolated, a lone merge dropped).
      for (let i = 1; i + 1 < n; i++) {
        if (!gap[i] && gap[i - 1] && gap[i + 1]) { gap[i] = (gap[i - 1] + gap[i + 1]) / 2; nf[i] = (nf[i - 1] + nf[i + 1]) / 2; }
        else if (gap[i] && !gap[i - 1] && !gap[i + 1]) gap[i] = 0;
      }
      const wall = sg > 0 ? c.wallL : c.wallR;
      for (let i = 0; i < n; i++) if (gap[i]) { wall[i] = 0; merged++; }
    }
    c.bbox = cutBox(c);
  }
  return merged;
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
    if (p.open) continue;
    const past = p.at === 0 ? -h.s : h.s - end;
    if (past >= 0 && past <= LID_M && h.lateral <= h.left + DIP_M && h.lateral >= -h.right - DIP_M) return Math.max(raw, p.top);
  }
  if (h.s < 0 || h.s > end) return NaN;
  // A merged side: the strip's half and the gap to the neighbour lie on the floors (the neighbour's own cut answers
  // the same across the gap, so the median meets both).
  if (c.gapL && c.gapR && c.nfL && c.nfR) {
    const gl = (a: number[]) => a[h.i] + (a[h.i + 1] - a[h.i]) * h.f;
    const sideGap = h.lateral >= 0 ? gl(c.gapL) : gl(c.gapR), edge = h.lateral >= 0 ? h.left : h.right, off = Math.abs(h.lateral);
    if (sideGap > 0.005 && off <= edge + sideGap) {
      if (off <= edge) return h.floor;
      const nf = h.lateral >= 0 ? gl(c.nfL) : gl(c.nfR);
      return h.floor + (nf - h.floor) * Math.min(1, (off - edge) / sideGap);
    }
  }
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

function quad(m: MeshArrays, p: [number, number, number][], toward: [number, number, number], colour: RGB | RGB[]): void {
  const ux = p[1][0] - p[0][0], uy = p[1][1] - p[0][1], uz = p[1][2] - p[0][2], vx = p[2][0] - p[0][0], vy = p[2][1] - p[0][1], vz = p[2][2] - p[0][2];
  const nrm = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx], flip = nrm[0] * toward[0] + nrm[1] * toward[1] + nrm[2] * toward[2] < 0;
  const k = p.map((q, j) => vertex(m, q[0], q[1], q[2], Array.isArray(colour[0]) ? (colour as RGB[])[j] : (colour as RGB)));
  if (flip) m.indices.push(k[0], k[2], k[1], k[0], k[3], k[2]); else m.indices.push(k[0], k[1], k[2], k[0], k[2], k[3]);
}

/** The wall face's colour at height `z` over a wall from `foot` to `top`: stained at the foot, paler upward. */
function wallTint(z: number, foot: number, top: number): RGB {
  const C = TUNNEL_COLOURS, t = Math.max(0, Math.min(1, (z - foot) / Math.max(0.5, top - foot)));
  const u = Math.sqrt(t);
  return [0, 1, 2].map(k => C.wallFoot[k] + (C.wallTop[k] - C.wallFoot[k]) * u) as RGB;
}

/** A merged gap at least this wide (metres) is a verge and draws as grass; narrower, a barrier on the ground. */
export const MEDIAN_GRASS_MIN_M = 1.5;

/**
 * The cut's half of each merged gap (mergeNeighbours) at least MEDIAN_GRASS_MIN_M wide, as quads per segment whose
 * midpoint `owns` accepts: the verges between the carriageways of one trench (the IJ-tunnel's south ramp: grass
 * wedges tapering to the portal). The neighbour's cut draws the other half. The cell drapes them on the land, which
 * lies on the floors there (cutRelief).
 */
export function cutMedianQuads(c: Cut, owns: (x: number, y: number) => boolean): Vec2[][] {
  const out: Vec2[][] = [];
  if (!c.gapL || !c.gapR) return out;
  for (const sg of [1, -1] as const) {
    const gap = sg > 0 ? c.gapL : c.gapR, med = (sg > 0 ? c.medL : c.medR) ?? [], wall = sg > 0 ? c.wallL : c.wallR, reach = sg > 0 ? c.left : c.right;
    for (let i = 0; i + 1 < c.x.length; i++) {
      if (!owns((c.x[i] + c.x[i + 1]) / 2, (c.y[i] + c.y[i + 1]) / 2)) continue;
      const at = (k: number, extra: number): Vec2 => { const [nx, ny] = normalAt(c, k), r = reach[k] + extra; return [c.x[k] + nx * sg * r, c.y[k] + ny * sg * r]; };
      if (gap[i] >= MEDIAN_GRASS_MIN_M && gap[i + 1] >= MEDIAN_GRASS_MIN_M) out.push([at(i, 0), at(i + 1, 0), at(i + 1, gap[i + 1] / 2 + 0.05), at(i, gap[i] / 2 + 0.05)]);
      // A raised median between two walls: grass from behind this wall's parapet to the middle.
      else if (wall[i] && wall[i + 1] && Math.min(med[i] ?? 0, med[i + 1] ?? 0) / 2 - PARAPET_T >= MEDIAN_GRASS_MIN_M / 2) out.push([at(i, PARAPET_T), at(i + 1, PARAPET_T), at(i + 1, med[i + 1] / 2 + 0.05), at(i, med[i] / 2 + 0.05)]);
    }
  }
  return out;
}

export interface CutMeshes { walls: MeshArrays; floor: MeshArrays; walled: number; portals: number }

/**
 * A cut's geometry for one cell (`owns(x, y)`: the segment midpoints it draws): per walled side a concrete face from
 * under the floor to under the coping (stained at the foot, paler upward), a pale coping over the parapet with a lip
 * overhanging the trench (the edge reads as a line at chase distance), and the parapet's land face; a floor strip edge
 * to edge just under the bands; a portal where one was found: a motor tunnel's dark mouth under a concrete headwall,
 * or over a slot an open lintel. A portal on a merged side spans the gap to the neighbour's strip. Walls are
 * vertex-coloured (deckBody), the floor plain (asphalt).
 */
export function cutMeshes(c: Cut, owns: (x: number, y: number) => boolean): CutMeshes {
  const walls = emptyMesh(true), floor = emptyMesh();
  const C = TUNNEL_COLOURS, n = c.x.length, parapet = PARAPET_M;
  let walled = 0;
  const edge = (i: number, sg: 1 | -1, extra = 0): Vec2 => { const [nx, ny] = normalAt(c, i), r = (sg > 0 ? c.left[i] : c.right[i]) + extra; return [c.x[i] + nx * sg * r, c.y[i] + ny * sg * r]; };
  const gapAt = (i: number, sg: 1 | -1) => ((sg > 0 ? c.gapL : c.gapR)?.[i] ?? 0);
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
      if (rim[i] - c.floor[i] < 0.15 && rim[i + 1] - c.floor[i + 1] < 0.15) continue;
      const a = edge(i, sg), b = edge(i + 1, sg), into: [number, number, number] = [-(normalAt(c, i)[0]) * sg, -(normalAt(c, i)[1]) * sg, 0];
      const ta = rim[i] + parapet, tb = rim[i + 1] + parapet, la = ta - COPING_LIP_M, lb = tb - COPING_LIP_M;
      const fa = c.floor[i] - 0.3, fb = c.floor[i + 1] - 0.3;
      // Face: from under the floor up to the coping's lip, stained at the foot.
      quad(walls, [[a[0], a[1], fa], [b[0], b[1], fb], [b[0], b[1], lb], [a[0], a[1], la]], into,
        [wallTint(fa, c.floor[i], ta), wallTint(fb, c.floor[i + 1], tb), wallTint(lb, c.floor[i + 1], tb), wallTint(la, c.floor[i], ta)]);
      // The coping: a pale lip over the trench, its top across the parapet, and the parapet's land face.
      const ao = edge(i, sg, -COPING_OVER_M), bo = edge(i + 1, sg, -COPING_OVER_M);
      quad(walls, [[ao[0], ao[1], la], [bo[0], bo[1], lb], [bo[0], bo[1], tb], [ao[0], ao[1], ta]], into, C.coping);
      const a2 = edge(i, sg, PARAPET_T), b2 = edge(i + 1, sg, PARAPET_T);
      const am = edge(i, sg, 0.06), bm = edge(i + 1, sg, 0.06);
      quad(walls, [[ao[0], ao[1], ta], [bo[0], bo[1], tb], [bm[0], bm[1], tb], [am[0], am[1], ta]], [0, 0, 1], C.coping);
      quad(walls, [[am[0], am[1], ta], [bm[0], bm[1], tb], [b2[0], b2[1], tb], [a2[0], a2[1], ta]], [0, 0, 1], C.cap);
      quad(walls, [[a2[0], a2[1], ta], [b2[0], b2[1], tb], [b2[0], b2[1], rim[i + 1] - 0.4], [a2[0], a2[1], rim[i] - 0.4]], [-into[0], -into[1], 0], C.parapet);
      // The shade band: on the floor along the foot, over the carriageway's bands, as wide as a share of the depth.
      const wa = Math.max(SHADE_MIN_M, Math.min(SHADE_MAX_M, SHADE_PER_M * (rim[i] - c.floor[i]))), wb = Math.max(SHADE_MIN_M, Math.min(SHADE_MAX_M, SHADE_PER_M * (rim[i + 1] - c.floor[i + 1])));
      const ag = edge(i, sg, -wa), bg = edge(i + 1, sg, -wb), za = c.floor[i] + SHADE_LIFT_M, zb = c.floor[i + 1] + SHADE_LIFT_M;
      quad(walls, [[ag[0], ag[1], za], [bg[0], bg[1], zb], [b[0], b[1], zb], [a[0], a[1], za]], [0, 0, 1], [C.shadeEdge, C.shadeEdge, C.shadeFoot, C.shadeFoot]);
      walled++;
    }
  }
  let portals = 0;
  for (const p of c.portals) {
    const i = p.at;
    if (!owns(c.x[i], c.y[i])) continue;
    // Across a merged side the portal runs on over half the gap, and on a side shared with a neighbouring road (no
    // wall: the strip reaches that road's centreline) to the midpoint between the two; the neighbour's portal meets it
    // there (a headwall spanning the next carriageway drew staggered pieces beside the IJ-tunnel's mouths).
    const walledAt = (sg: 1 | -1) => !!(sg > 0 ? c.wallL : c.wallR)[i], reachAt = (sg: 1 | -1) => (sg > 0 ? c.left : c.right)[i];
    const reachOut = (sg: 1 | -1) => (gapAt(i, sg) > 0 ? gapAt(i, sg) / 2 + 0.05 : walledAt(sg) ? PARAPET_T : -reachAt(sg) / 2 + 0.05);
    const reachIn = (sg: 1 | -1) => (gapAt(i, sg) > 0 ? gapAt(i, sg) / 2 + 0.05 : walledAt(sg) ? 0 : -reachAt(sg) / 2 + 0.05);
    const l = edge(i, 1, reachOut(1)), r = edge(i, -1, reachOut(-1)), out: [number, number, number] = [-p.dir[0], -p.dir[1], 0];
    const f = c.floor[i];
    const clear = p.open ? Math.min(SLOT_CLEAR_M, p.top - f - 0.6) : Math.min(PORTAL_CLEAR_M, p.top - f - 0.6);
    const top = Math.max(p.top, c.rimL[i], c.rimR[i]) + (p.open ? 0.4 : parapet);
    if (clear < 1.5) continue;
    const back = (q: Vec2, d: number): Vec2 => [q[0] + p.dir[0] * d, q[1] + p.dir[1] * d];
    if (!p.open) {
      // The mouth: a dark face a little inside the portal (the tunnel's interior), its soffit and reveals.
      const lm = edge(i, 1, reachIn(1)), rm = edge(i, -1, reachIn(-1));
      const li = back(lm, 0.6), ri = back(rm, 0.6);
      quad(walls, [[li[0], li[1], f - 0.3], [ri[0], ri[1], f - 0.3], [ri[0], ri[1], f + clear], [li[0], li[1], f + clear]], out, C.mouth);
      quad(walls, [[lm[0], lm[1], f + clear], [rm[0], rm[1], f + clear], [ri[0], ri[1], f + clear], [li[0], li[1], f + clear]], [0, 0, -1], C.mouth);
      for (const [q, qi, sg] of [[lm, li, 1], [rm, ri, -1]] as [Vec2, Vec2, number][]) {
        const nrm = normalAt(c, i);
        quad(walls, [[q[0], q[1], f - 0.3], [qi[0], qi[1], f - 0.3], [qi[0], qi[1], f + clear], [q[0], q[1], f + clear]], [-nrm[0] * sg, -nrm[1] * sg, 0], C.mouth);
      }
    }
    // The headwall over the mouth (or the lintel over a slot): its face, coping, back face and, over a slot, its soffit.
    const depth = p.open ? 0.7 : PARAPET_T;
    const lb = back(l, depth), rb = back(r, depth);
    quad(walls, [[l[0], l[1], f + clear], [r[0], r[1], f + clear], [r[0], r[1], top - COPING_LIP_M], [l[0], l[1], top - COPING_LIP_M]], out,
      [wallTint(f + clear, f, top), wallTint(f + clear, f, top), wallTint(top, f, top), wallTint(top, f, top)].map(t => t.map((v, k) => (v + C.headwall[k]) / 2) as RGB));
    quad(walls, [[l[0], l[1], top - COPING_LIP_M], [r[0], r[1], top - COPING_LIP_M], [r[0], r[1], top], [l[0], l[1], top]], out, C.coping);
    quad(walls, [[l[0], l[1], top], [r[0], r[1], top], [rb[0], rb[1], top], [lb[0], lb[1], top]], [0, 0, 1], C.coping);
    quad(walls, [[lb[0], lb[1], top], [rb[0], rb[1], top], [rb[0], rb[1], p.open ? f + clear : p.top - 0.4], [lb[0], lb[1], p.open ? f + clear : p.top - 0.4]], [p.dir[0], p.dir[1], 0], C.parapet);
    if (p.open) quad(walls, [[l[0], l[1], f + clear], [r[0], r[1], f + clear], [rb[0], rb[1], f + clear], [lb[0], lb[1], f + clear]], [0, 0, -1], C.headwall);
    portals++;
  }
  return { walls, floor, walled, portals };
}
