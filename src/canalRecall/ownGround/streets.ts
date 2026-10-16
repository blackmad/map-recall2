// Street bands draped on the riding surface (pure).
//
// Each OSM way becomes its cross-section's bands (osmGround.ts). Where
// carriageways meet, the junction is one surface built from the incoming
// cross-sections (`junctionGeometry`): every arm's road edges (carriageway
// plus painted cycle lanes) are intersected with its angular neighbours',
// the arms are trimmed back to those kerb corners, and the polygon between
// them is filled with the main road's surface. So:
//
//   - painted cycle lanes, lane paint and centre lines stop at the junction edge;
//   - sidewalks and cycle tracks stop at the kerb corner on their side only
//     (a T junction's through side keeps its sidewalk), and the corner between
//     two arms' sidewalks is filled at kerb height;
//   - paths (cycleways, footways) end at the kerb of the road they join and
//     are cut where they cross a carriageway without a crossing tag, so no
//     red or pale strips are left lying on the junction;
//   - nothing draws a disc over a junction any more (the round fills pooled
//     into red and grey blobs).

import { crossSection, type BgtWidthDm, type Band, type CrossSection, type OsmWay, type Surface } from './osmGround.js';
import { cutIntervals, disc, drapeTriangles, edgeWall, emptyMesh, endCap, pointAt, ribbon, stations, triangleCount, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';
import earcut from 'earcut';
import { bar, blocks, crossingStation, isSignalCrossing, mouthMarking, rankOf, sharkTeeth, strip, CROSSING_REACH_M, SIGNAL_REACH_M, STOP_LINE_M, type Keep } from './roadMarkings.js';
import type { RoadIndex } from './roadSurfaces.js';

/** Height above the relief per layer (metres): later layers win the depth test. */
/**
 * roads-v1: the carriageway markings sit this far over the surveyed carriageway plane (roadSurfaces ROAD_LIFT.carriage
 * 0.03 plus a float of DRAPE_TOL.carriage.float 0.02 at most): the painted lane ribbons, the paint, the rails. The
 * band model's own lifts (LIFT.cycleLane 0.036, LIFT.paint 0.046, LIFT.rail 0.05) stay for the cells without a survey.
 */
/** roads-v1: no procedural paint (dashes, edge lines, stop lines, teeth, crossing blocks, zebras) on surveyed ground.
 *  User 2026-10-16: "maybe we just stop showing dashes for now? the most important part for this afternoon is that
 *  the roads don't look broken" — prior-based paint clipped to the BGT carriageway shredded into stray fragments.
 *  Paint comes back from data (orthophoto/OSM nodes) in the road-look lane. Cells without the survey keep their paint. */
export const PAINT_ON_SURVEY = false;
export const ROAD_MARK_LIFT = { lane: 0.056, paint: 0.062, rail: 0.066 } as const;
export const LIFT = {
  area: 0.015,
  crossing: 0.025,
  carriageway: 0.03,
  cycleLane: 0.036,
  path: 0.04,
  paint: 0.046,
  rail: 0.05,
  raisedBase: 0.03,
  route: 0.07,
} as const;

export type StreetLayer = Surface | 'paint' | 'kerb' | 'tram' | 'bollard';
export type StreetMeshes = Record<StreetLayer, MeshArrays> & {
  /** Every junction node of the graph (not only the owned ones): the pocket fill looks near them (pockets.ts). */
  junctionPoints: Vec2[];
  stats: { ways: number; bands: number; metres: number; widthFromTags: number; sidewalkFromTags: number; trims: number; junctions: number; corners: number; markings: MarkingStats };
};

/** Junction road markings drawn (roadMarkings.ts). */
export interface MarkingStats { stopLines: number; giveWays: number; teeth: number; laneLinks: number; cycleCrossings: number; blocks: number; /** roads-v1: paint pieces, rail stations and lane-ribbon pieces dropped off the carriageway polygons; node fills skipped inside a polygon; cross-cut stations; covered ways. */ clipped?: { paint: number; rails: number; lanes: number; fills: number; crossCuts: number; coveredWays: number; /** 1 m band stations of part-covered ways dropped over a polygon of the band's kind. */ bandStations: number; /** Red band pieces on a rijbaan drawn as painted lanes, and those dropped as a path's crossing (CYCLE_PAINT_MIN_M). */ cyclePaint: number; cyclePaintDropped: number } }

/**
 * roads-v1 (roadSurfaces.ts) in the street pass: `covered` ways emit no bands (the surveyed polygons are their
 * surface) but stay in the junction graph; node fills and corner patches are skipped where the node lies in a
 * polygon; paint, rails and painted lane ribbons are kept only over carriageway polygons (`index.onRoad`).
 */
export interface RoadsOption { index: RoadIndex; covered: ReadonlySet<number> }

export interface LocalWay { id: number; tags: Record<string, string>; points: Vec2[]; section: CrossSection; bw?: BgtWidthDm }

const key = (p: Vec2) => `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`;
const isCarriage = (w: LocalWay) => w.section.bands[0]?.kind === 'carriageway';
/** A way that is (part of) a bridge: drawn over water, so never cut by the water mask. */
export const isBridgeWay = (w: LocalWay) => !!w.tags.bridge && w.tags.bridge !== 'no';
/** A path that crosses a road on purpose (drawn over the junction as a marking). */
const isCrossing = (w: LocalWay) => w.tags.footway === 'crossing' || w.tags.cycleway === 'crossing' || w.tags.path === 'crossing';

export function prepareWays(ways: readonly OsmWay[], project: (lngLat: [number, number]) => Vec2): LocalWay[] {
  const out: LocalWay[] = [];
  for (const w of ways) {
    const section = crossSection(w.tags, w.bw);
    if (!section || w.g.length < 2) continue;
    out.push({ id: w.id, tags: w.tags, points: w.g.map(project), section, bw: w.bw });
  }
  return out;
}

/**
 * Prior sidewalks that would lie on another mapped way are dropped: a split
 * carriageway's inner side (De Clercqstraat's raised paving strip between the
 * car lane and the tram lane) and the side where a separate cycle path or
 * footway is mapped. Tagged sidewalks are kept as tagged.
 */
export function resolvePriorSidewalks(ways: readonly LocalWay[]): LocalWay[] {
  // A neighbouring carriageway vetoes a prior sidewalk across a median up to MEDIAN_M wide; a path only where it lies.
  const MEDIAN_M = 2.5;
  const G = 20, grid = new Map<string, { way: number; a: Vec2; b: Vec2; half: number }[]>();
  for (const w of ways) {
    if (isCrossing(w)) continue;
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i], b = w.points[i + 1];
      for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) {
        const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ way: w.id, a, b, half: w.section.coreHalfWidth + (isCarriage(w) ? MEDIAN_M : 0) });
      }
    }
  }
  const near = (w: LocalWay, q: Vec2, dir: Vec2, r: number) => {
    const R = r + 10;
    for (let gx = Math.floor((q[0] - R) / G); gx <= Math.floor((q[0] + R) / G); gx++) for (let gy = Math.floor((q[1] - R) / G); gy <= Math.floor((q[1] + R) / G); gy++) {
      for (const s of grid.get(`${gx}:${gy}`) ?? []) {
        if (s.way === w.id) continue;
        const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l2 = dx * dx + dy * dy;
        if (l2 < 1e-6) continue;
        const l = Math.sqrt(l2);
        if (Math.abs((dx * dir[0] + dy * dir[1]) / l) < 0.8) continue; // not parallel
        const t = Math.max(0, Math.min(1, ((q[0] - s.a[0]) * dx + (q[1] - s.a[1]) * dy) / l2));
        if (Math.hypot(s.a[0] + dx * t - q[0], s.a[1] + dy * t - q[1]) <= r + s.half) return true;
      }
    }
    return false;
  };
  return ways.map(w => {
    if (!isCarriage(w) || (w.section.source.sidewalkSides ?? w.section.source.sidewalk) !== 'prior') return w;
    const st = stations(w.points), total = st[st.length - 1];
    if (total < 6) return w;
    const drop = new Set<Band>();
    for (const band of w.section.bands) {
      if (band.kind !== 'sidewalk') continue;
      let hits = 0;
      for (const f of [0.25, 0.5, 0.75]) {
        const p = pointAt(w.points, st, f * total), q2 = pointAt(w.points, st, Math.min(total, f * total + 1)), r2 = pointAt(w.points, st, Math.max(0, f * total - 1));
        const dx = q2[0] - r2[0], dy = q2[1] - r2[1], l = Math.hypot(dx, dy) || 1, dir: Vec2 = [dx / l, dy / l], nl = leftOf(dir);
        const c: Vec2 = [p[0] + nl[0] * band.offset, p[1] + nl[1] * band.offset];
        if (near(w, c, dir, band.width / 2 + 0.3)) hits++;
      }
      if (hits >= 2) drop.add(band);
    }
    if (!drop.size) return w;
    const bands = w.section.bands.filter(b => !drop.has(b));
    const halfWidth = bands.reduce((m, b) => Math.max(m, Math.abs(b.offset) + b.width / 2), 0);
    return { ...w, section: { ...w.section, bands, halfWidth } };
  });
}

/** Road-surface extents of a way either side of its centreline: carriageway plus painted cycle lanes. */
export function roadExtent(section: CrossSection): { left: number; right: number } {
  let left = 0, right = 0;
  for (const b of section.bands) {
    if (b.kind !== 'carriageway' && b.kind !== 'cycle_lane') continue;
    left = Math.max(left, b.offset + b.width / 2);
    right = Math.max(right, -(b.offset - b.width / 2));
  }
  return { left, right };
}

/** A carriageway leaving a node: way, the node's index on it, and which way along it. */
interface Arm {
  way: LocalWay;
  i: number;
  sign: 1 | -1;
  dir: Vec2;
  angle: number;
  /** Road extent to the arm's left / right (as seen leaving the node). */
  left: number;
  right: number;
  /** Trim along the arm (metres from the node) where the junction ends. */
  trim: number;
  /** Station along the arm of the kerb corner on its left / right (null: no corner on that side). */
  cornerLeft: number | null;
  cornerRight: number | null;
}

interface Corner { a: Arm; b: Arm; p: Vec2 }

interface Node {
  p: Vec2;
  ways: Set<number>;
  arms: Arm[];
  /** Max road half-extent of the carriageways at the node (paths are trimmed by it). */
  roadHalf: number;
  kind: 'none' | 'continuation' | 'junction';
  polygon: Vec2[];
  corners: Corner[];
  /** The way that emits the node's fill (smallest id among its arms): one owner across cells and passes. */
  owner: number;
}

const armKey = (way: number, i: number, sign: number) => `${way}:${i}:${sign}`;
const cross2 = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const leftOf = (d: Vec2): Vec2 => [-d[1], d[0]];

/** Direction leaving point i of a polyline toward i + sign, averaged over the first few metres. */
function armDirection(pts: readonly Vec2[], i: number, sign: 1 | -1): Vec2 | null {
  const p = pts[i];
  let j = i + sign, q: Vec2 | null = null;
  while (j >= 0 && j < pts.length) {
    q = pts[j];
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) >= 4) break;
    j += sign;
  }
  if (!q) return null;
  const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy);
  return l > 1e-3 ? [dx / l, dy / l] : null;
}

/** Remaining length of a way from point i in direction sign. */
function armLength(st: readonly number[], i: number, sign: 1 | -1): number {
  return sign > 0 ? st[st.length - 1] - st[i] : st[i];
}

/** Intersect p + u·t + nu·hu with p + v·s − nv·hv (left edge of u, right edge of v). */
function cornerOf(u: Vec2, hu: number, v: Vec2, hv: number): { t: number; s: number } | null {
  const nu = leftOf(u), nv = leftOf(v);
  // u·t − v·s = −nv·hv − nu·hu
  const rx = -nv[0] * hv - nu[0] * hu, ry = -nv[1] * hv - nu[1] * hu;
  const det = u[0] * -v[1] - u[1] * -v[0];
  if (Math.abs(det) < 1e-6) return null;
  const t = (rx * -v[1] - ry * -v[0]) / det, s = (u[0] * ry - u[1] * rx) / det;
  return { t, s };
}

/** Max junction trim along an arm, metres. */
const MAX_TRIM_M = 18;
/** Two arms closer than this (or nearer straight-through than 180° − this) have no kerb corner between them. */
const CORNER_MIN_DEG = 18;
/** Two carriageways meeting at most this far off straight are one street continuing. */
const CONTINUE_DEG = 35;

/** The junction graph of all ways (pure): arms, trims, kerb corners and fill polygons per node. */
export function junctionGeometry(ways: readonly LocalWay[]): Map<string, Node> {
  const nodes = new Map<string, Node>();
  const get = (p: Vec2) => {
    const k = key(p);
    let n = nodes.get(k);
    if (!n) { n = { p, ways: new Set(), arms: [], roadHalf: 0, kind: 'none', polygon: [], corners: [], owner: Infinity }; nodes.set(k, n); }
    return n;
  };
  for (const w of ways) {
    const st = stations(w.points), ext = roadExtent(w.section);
    w.points.forEach((p, i) => {
      const n = get(p);
      n.ways.add(w.id);
      if (!isCarriage(w)) return;
      for (const sign of [1, -1] as const) {
        const j = i + sign;
        if (j < 0 || j >= w.points.length || armLength(st, i, sign) < 0.05) continue;
        const dir = armDirection(w.points, i, sign);
        if (!dir) continue;
        n.arms.push({ way: w, i, sign, dir, angle: Math.atan2(dir[1], dir[0]), left: sign > 0 ? ext.left : ext.right, right: sign > 0 ? ext.right : ext.left, trim: 0, cornerLeft: null, cornerRight: null });
      }
    });
  }
  const minSin = Math.sin(CORNER_MIN_DEG * Math.PI / 180);
  for (const n of nodes.values()) {
    const arms = n.arms;
    n.roadHalf = arms.reduce((m, a) => Math.max(m, a.left, a.right), 0);
    if (arms.length < 2 || arms.every(a => a.way === arms[0].way)) continue; // a way's own vertex (paths may join it)
    n.owner = Math.min(...arms.map(a => a.way.id));
    arms.sort((a, b) => a.angle - b.angle);
    if (arms.length === 2) {
      const dev = 180 - Math.abs(((arms[0].angle - arms[1].angle) * 180 / Math.PI + 540) % 360 - 180);
      if (dev <= CONTINUE_DEG) {
        // One street continuing (a way split): close the mitre wedge, no trim.
        n.kind = 'continuation';
        const pts: { p: Vec2; a: number }[] = [];
        for (const a of arms) {
          const nl = leftOf(a.dir);
          for (const [h, s] of [[a.left, 1], [a.right, -1]] as const) {
            const q: Vec2 = [n.p[0] + nl[0] * h * s, n.p[1] + nl[1] * h * s];
            pts.push({ p: q, a: Math.atan2(q[1] - n.p[1], q[0] - n.p[0]) });
          }
        }
        n.polygon = [n.p, ...pts.sort((x, y) => x.a - y.a).map(x => x.p)];
        continue;
      }
    }
    n.kind = 'junction';
    const m = arms.length;
    for (let k = 0; k < m; k++) {
      const a = arms[k], b = arms[(k + 1) % m];
      // b is the next arm counter-clockwise: a's left edge meets b's right edge.
      const sin = cross2(a.dir, b.dir);
      if (sin < minSin) continue; // reflex or nearly straight through: the kerb runs on
      const c = cornerOf(a.dir, a.left, b.dir, b.right);
      if (!c || c.t < -0.5 || c.s < -0.5) continue;
      const t = Math.max(0, c.t), s = Math.max(0, c.s);
      a.cornerLeft = t; b.cornerRight = s;
      const nl = leftOf(a.dir);
      n.corners.push({ a, b, p: [n.p[0] + a.dir[0] * t + nl[0] * a.left, n.p[1] + a.dir[1] * t + nl[1] * a.left] });
    }
    for (const a of arms) {
      const st = stations(a.way.points), room = armLength(st, a.i, a.sign);
      const want = Math.max(a.cornerLeft ?? 0, a.cornerRight ?? 0, 0.5);
      a.trim = Math.min(want, MAX_TRIM_M, room * 0.45);
    }
    // Fill: around the node, each arm's mouth (right edge, left edge at its trim) and the kerb corners between.
    const poly: Vec2[] = [];
    for (let k = 0; k < m; k++) {
      const a = arms[k], nl = leftOf(a.dir);
      const mouth = (h: number): Vec2 => [n.p[0] + a.dir[0] * a.trim + nl[0] * h, n.p[1] + a.dir[1] * a.trim + nl[1] * h];
      poly.push(mouth(-a.right), mouth(a.left));
      const c = n.corners.find(c => c.a === a);
      if (c) poly.push(c.p);
    }
    n.polygon = poly;
  }
  return nodes;
}

/** Station intervals along `w` the junctions take from its road bands (carriageway, painted lanes, paint). */
function roadCuts(w: LocalWay, nodes: Map<string, Node>, st: readonly number[]): [number, number][] {
  const cuts: [number, number][] = [];
  w.points.forEach((p, i) => {
    const n = nodes.get(key(p));
    if (!n || n.kind !== 'junction') return;
    for (const a of n.arms) if (a.way === w && a.i === i) cuts.push(a.sign > 0 ? [st[i] - 1e-3, st[i] + a.trim] : [st[i] - a.trim, st[i] + 1e-3]);
  });
  return cuts;
}

/** Intervals a side band (way-left: side +1) loses at kerb corners. */
function sideCuts(w: LocalWay, side: 1 | -1, nodes: Map<string, Node>, st: readonly number[]): [number, number][] {
  const cuts: [number, number][] = [];
  w.points.forEach((p, i) => {
    const n = nodes.get(key(p));
    if (!n || n.kind !== 'junction') return;
    for (const a of n.arms) {
      if (a.way !== w || a.i !== i) continue;
      // Leaving forward, the way's left is the arm's left; leaving backward, its right.
      const c = (a.sign > 0) === (side > 0) ? a.cornerLeft : a.cornerRight;
      if (c === null) continue;
      cuts.push(a.sign > 0 ? [st[i] - 1e-3, st[i] + c] : [st[i] - c, st[i] + 1e-3]);
    }
  });
  return cuts;
}

/** Intervals a path loses to the carriageways it meets (ends at their kerb; cut where it crosses one untagged). */
function pathCuts(w: LocalWay, nodes: Map<string, Node>, st: readonly number[]): [number, number][] {
  if (isCrossing(w)) return [];
  const cuts: [number, number][] = [], last = w.points.length - 1;
  w.points.forEach((p, i) => {
    const n = nodes.get(key(p));
    if (!n || !n.arms.length || n.arms.every(a => a.way === w)) return;
    const h = Math.min(n.roadHalf + 0.15, 12);
    cuts.push([i === 0 ? -1 : st[i] - h, i === last ? st[i] + 1 : st[i] + h]);
  });
  return cuts;
}

/** Path pieces left shorter than this by a junction cut are stubs (a red or paved fragment at the kerb), not paths: 3 m with one end cut, 6 m squeezed between two cuts. */
const MIN_PATH_PIECE_M = 3, MIN_PATH_BETWEEN_CUTS_M = 6;
/** A carriageway at most this long lying inside a wider one is a mapping duplicate, not a street. */
const SHADOW_MAX_LEN_M = 30;

const keepPathPiece = (w: LocalWay, pc: readonly Vec2[]) => {
  const first = w.points[0], last = w.points[w.points.length - 1], a = pc[0], b = pc[pc.length - 1];
  const cutStart = Math.hypot(a[0] - first[0], a[1] - first[1]) > 0.1, cutEnd = Math.hypot(b[0] - last[0], b[1] - last[1]) > 0.1;
  return pieceLength(pc) >= (cutStart && cutEnd ? MIN_PATH_BETWEEN_CUTS_M : MIN_PATH_PIECE_M);
};
const pieceLength = (pts: readonly Vec2[]) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };

/**
 * Short carriageways drawn on top of a wider carriageway: OSM maps De
 * Clercqstraat's last 13 m as a 2.4 m klinker one-way stub running through the
 * Rozengracht/Marnixstraat junction, so a brown parallelogram lay on the
 * asphalt (BGT: all rijbaan there). A carriageway of at most SHADOW_MAX_LEN_M,
 * at least 80 % of whose stations lie inside another, wider carriageway's road
 * extent, is the same surface twice: it draws nothing (it still counts as an
 * arm in the junction graph, which only shapes the fill).
 */
export function shadowedWays(ways: readonly LocalWay[]): Set<number> {
  const G = 20, grid = new Map<string, { way: LocalWay; a: Vec2; b: Vec2; half: number }[]>();
  const carriage = ways.filter(w => isCarriage(w) && !isBridgeWay(w));
  for (const w of carriage) {
    const ext = roadExtent(w.section), half = Math.min(ext.left, ext.right);
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i], b = w.points[i + 1];
      for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) {
        const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ way: w, a, b, half });
      }
    }
  }
  const out = new Set<number>();
  for (const w of carriage) {
    const st = stations(w.points), total = st[st.length - 1];
    if (total > SHADOW_MAX_LEN_M || total < 1) continue;
    const own = w.section.coreHalfWidth;
    let inside = 0, n = 0;
    for (let s = 0; s <= total + 1e-6; s += 0.5) {
      const p = pointAt(w.points, st, Math.min(s, total));
      n++;
      let hit = false;
      for (const seg of grid.get(`${Math.floor(p[0] / G)}:${Math.floor(p[1] / G)}`) ?? []) {
        if (seg.way.id === w.id || seg.half < own + 0.8) continue;
        const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], l2 = dx * dx + dy * dy;
        if (l2 < 1e-6) continue;
        const t = Math.max(0, Math.min(1, ((p[0] - seg.a[0]) * dx + (p[1] - seg.a[1]) * dy) / l2));
        if (Math.hypot(seg.a[0] + dx * t - p[0], seg.a[1] + dy * t - p[1]) <= seg.half - own * 0.5) { hit = true; break; }
      }
      if (hit) inside++;
    }
    if (inside >= 0.8 * n) out.add(w.id);
  }
  return out;
}

/**
 * `only` limits which ways emit geometry while the junction graph still sees
 * all of them (the prototype builds bridge ways separately, uncut by the water mask).
 */
export function buildStreets(ways: readonly LocalWay[], height: HeightFn, opts: { step?: number; only?: (w: LocalWay) => boolean; canalSide?: (x: number, y: number) => boolean; acrossStep?: number; /** Junction road markings (roadMarkings.ts); off for the far ring. */ markings?: boolean; /** The surveyed road partition (roads-v1): see RoadsOption. */ roads?: RoadsOption } = {}): StreetMeshes {
  const step = opts.step ?? 3;
  const bgt = opts.roads ?? null;
  const clipped = { paint: 0, rails: 0, lanes: 0, fills: 0, crossCuts: 0, coveredWays: 0, bandStations: 0, cyclePaint: 0, cyclePaintDropped: 0 };
  // roads-v1: the markings sit over the surveyed carriageway plane's float (roadSurfaces ROAD_MARK_LIFT).
  const paintLift = bgt ? ROAD_MARK_LIFT.paint : LIFT.paint, railLift = bgt ? ROAD_MARK_LIFT.rail : LIFT.rail;
  /** Where a way's paint may lie: a carriageway polygon, or no survey (the fallback). */
  const onRoadFor = (w: LocalWay): Keep | undefined => (bgt ? (x, y) => PAINT_ON_SURVEY && bgt.index.onRoad(x, y, isBridgeWay(w)) : undefined);
  const inPolygon = (p: Vec2) => !!bgt && bgt.index.find(p[0], p[1]) >= 0;
  const crossGrid = bgt ? carriageGrid(ways) : null;
  // Vertices across a band (bridge bands: the deck is often narrower than the mapped carriageway, so a band with
  // vertices only on its two edges spans from the relief beside the deck to the relief beside it and sags under the
  // deck top in the middle; BRU0292 Schottenburchsbrug sat 0.15 m under it).
  const acrossOf = (width: number) => (opts.acrossStep ? Math.max(width > 7 ? 2 : 1, Math.ceil(width / opts.acrossStep)) : undefined);
  const out = { asphalt: emptyMesh(), klinker: emptyMesh(), cycle: emptyMesh(), paving: emptyMesh(), gravel: emptyMesh(), paint: emptyMesh(), kerb: emptyMesh(), tram: emptyMesh(), bollard: emptyMesh(), stats: { ways: 0, bands: 0, metres: 0, widthFromTags: 0, sidewalkFromTags: 0, trims: 0, junctions: 0, corners: 0, markings: { stopLines: 0, giveWays: 0, teeth: 0, laneLinks: 0, cycleCrossings: 0, blocks: 0, ...(bgt ? { clipped } : {}) } }, junctionPoints: [] as Vec2[] } as StreetMeshes;
  const nodes = junctionGeometry(ways);
  const byId = new Map(ways.map(w => [w.id, w]));
  const discDone = new Set<string>();
  const shadowed = shadowedWays(ways);
  const signalPoints = ways.filter(w => isSignalCrossing(w.tags)).flatMap(w => w.points);
  const crossingWays = ways.filter(isCrossing);
  for (const w of ways) {
    if (opts.only && !opts.only(w)) continue;
    if (shadowed.has(w.id)) continue;
    out.stats.ways++;
    if (w.section.source.width !== 'prior') out.stats.widthFromTags++;
    if (w.section.source.sidewalk !== 'prior') out.stats.sidewalkFromTags++;
    const st = stations(w.points);
    out.stats.metres += st[st.length - 1];
    // A footway crossing a road is the road's surface plus paint, not a paved strip over it.
    const crossing = w.tags.footway === 'crossing' || (w.tags.cycleway === 'crossing' && w.tags['surface:colour'] !== 'red');
    const carriage = isCarriage(w);
    const road = carriage ? roadCuts(w, nodes, st) : [];
    const path = carriage ? [] : pathCuts(w, nodes, st);
    const sides = { 1: carriage ? sideCuts(w, 1, nodes, st) : [], [-1]: carriage ? sideCuts(w, -1, nodes, st) : [] } as Record<1 | -1, [number, number][]>;
    // roads-v1: a covered way's surface is the surveyed polygons; its painted cycle lanes (markings on the BGT
    // rijbaan, not polygons) come back as red ribbons clipped to the carriageway polygons.
    const covered = !!bgt && bgt.covered.has(w.id);
    if (covered) {
      clipped.coveredWays++;
      if (carriage) for (const band of w.section.bands) if (band.kind === 'cycle_lane') clipped.lanes += laneRibbon(out.cycle, w, band, road, bgt!.index, height, step);
    }
    for (const band of w.section.bands) {
      if (crossing || covered) break;
      out.stats.bands++;
      const m = out[band.surface];
      const onRoad = band.kind === 'carriageway' || band.kind === 'cycle_lane';
      let cuts = !carriage ? path : onRoad ? road : sides[band.offset > 0 ? 1 : -1];
      // roads-v1: a way the polygons cover for part of its length (a cycleway that is fietspad for 60 % and crosses
      // rijbaan for the rest fails the 80 % coverWays rule) keeps its band only off the polygons of its own kind.
      if (bgt) { const cc = coverCuts(w, band, bgt.index); if (cc.length) { clipped.bandStations += cc.length; cuts = [...cuts, ...cc]; } }
      out.stats.trims += cuts.length;
      const pieces = cuts.length ? cutIntervals(w.points, cuts).filter(pc => carriage || keepPathPiece(w, pc)) : [w.points];
      if (band.raised > 0) {
        const top = LIFT.raisedBase + band.raised;
        for (const piece of pieces) {
          if (piece.length < 2) continue;
          ribbon(m, piece, band.offset, band.width, height, top, { step, across: acrossOf(band.width) });
          // Kerb face toward the carriageway (both sides for a mapped sidewalk).
          const inner = band.offset - Math.sign(band.offset || 1) * band.width / 2;
          if (band.kerb === 'both') {
            edgeWall(out.kerb, piece, band.width / 2, height, top, 0, 1, { step });
            edgeWall(out.kerb, piece, -band.width / 2, height, top, 0, -1, { step });
          } else edgeWall(out.kerb, piece, inner, height, top, 0, band.offset > 0 ? -1 : 1, { step });
          // The kerb line: a pale granite strip along the top of each kerb face.
          const into = Math.sign(band.offset || 1);
          if (band.kerb === 'both') { ribbon(out.kerb, piece, band.width / 2 - 0.075, 0.15, height, top + 0.002, { step }); ribbon(out.kerb, piece, -band.width / 2 + 0.075, 0.15, height, top + 0.002, { step }); }
          else if (band.kerb !== 'none') ribbon(out.kerb, piece, inner + into * 0.075, 0.15, height, top + 0.002, { step });
          // Amsterdammertjes along a canal-side pavement's kerb, every 1.6 m.
          if (opts.canalSide && band.kind === 'sidewalk' && band.kerb !== 'none') bollards(out.bollard, piece, band.kerb === 'both' ? band.width / 2 - 0.3 : inner + into * 0.3, height, top, opts.canalSide);
          const n = piece.length, d0 = dirOf(piece[0], piece[1]), d1 = dirOf(piece[n - 2], piece[n - 1]);
          endCap(out.kerb, piece[0], d0, band.offset, band.width, height, top, 0, false);
          endCap(out.kerb, piece[n - 1], d1, band.offset, band.width, height, top, 0, true);
        }
        continue;
      }
      const lift = band.kind === 'carriageway' ? LIFT.carriageway : band.kind === 'cycle_lane' ? LIFT.cycleLane : LIFT.path;
      for (const piece of pieces) {
        if (piece.length < 2) continue;
        // roads-v1: what is left of a red band on the survey lies on a rijbaan or parkeervlak (coversBand cut the
        // rest): a painted lane there, over the carriageway plane, not a band under it; a cycle path's few metres
        // across a road (a cycleway that is part fietspad, part rijbaan) are the crossing's blocks, not red paint.
        if (bgt && band.surface === 'cycle') {
          const { road: onRoadPieces, off } = splitBySurvey(piece, band.offset, bgt.index, isBridgeWay(w));
          for (const r of onRoadPieces) {
            const st = stations(r);
            if (!carriage && st[st.length - 1] < CYCLE_PAINT_MIN_M) { clipped.cyclePaintDropped++; continue; }
            ribbon(m, r, band.offset, band.width, height, ROAD_MARK_LIFT.lane, { step, across: acrossOf(band.width) });
            clipped.cyclePaint++;
          }
          for (const o of off) ribbon(m, o, band.offset, band.width, height, lift, { step, across: acrossOf(band.width) });
          continue;
        }
        ribbon(m, piece, band.offset, band.width, height, lift, { step, across: acrossOf(band.width) });
      }
      // Paths meeting only paths join with a small round fill (no junction polygon is built for them).
      if (!carriage && band.offset === 0) {
        for (const p of [w.points[0], w.points[w.points.length - 1], ...w.points]) {
          const n = nodes.get(key(p));
          if (!n || n.ways.size < 2 || n.arms.length) continue;
          // roads-v1: on the survey the polygons are the join (a disc there was a blob of another surface).
          if (bgt && bgt.index.coversBand(p[0], p[1], band.surface)) continue;
          const k = `${key(p)}:${band.surface}:${band.width.toFixed(1)}`;
          if (discDone.has(k)) continue;
          discDone.add(k);
          disc(m, p, Math.min(band.width / 2, 1.6), height, lift - 0.001, 12);
        }
      }
    }
    for (const line of w.section.paint) {
      // Paint lies on a band and stops where that band stops (road paint at the junction edge).
      const host = w.section.bands.find(b => Math.abs(line.offset - b.offset) <= b.width / 2 + 0.01) ?? w.section.bands[0];
      const onRoad = host.kind === 'carriageway' || host.kind === 'cycle_lane';
      let cuts = crossing ? [] : !carriage ? path : onRoad ? road.map(([a, b]) => [a - 0.3, b + 0.3] as [number, number]) : sides[host.offset > 0 ? 1 : -1];
      // roads-v1: carriageway paint also stops where another carriageway crosses without a shared node (bridge ends,
      // the quay streets at a canal crossing): crossCuts.
      if (crossGrid && carriage && onRoad && !crossing) { const cc = crossCuts(w, nodes, st, crossGrid); if (cc.length) { clipped.crossCuts += cc.length; cuts = [...cuts, ...cc]; } }
      const lift = onRoad || crossing ? paintLift : (host.raised > 0 ? LIFT.raisedBase + host.raised : LIFT.path) + 0.006;
      const keep = onRoadFor(w);
      for (const piece of cuts.length ? cutIntervals(w.points, cuts).filter(pc => carriage || keepPathPiece(w, pc)) : [w.points]) if (piece.length >= 2) clipped.paint += dashed(out.paint, piece, line.offset, line.width, line.dash, height, lift, keep);
    }
    // Tram rails: two per track at standard gauge, through junctions (the tracks do not stop there). roads-v1: a rail
    // is dropped where the survey has no carriageway under it (1 m stations off the rijbaan).
    const railPieces = bgt && w.section.rails?.length ? railIntervals(w, bgt.index, isBridgeWay(w)) : null;
    if (railPieces) clipped.rails += railPieces.dropped;
    for (const o of w.section.rails ?? []) for (const r of [-0.7175, 0.7175]) for (const piece of railPieces ? railPieces.pieces : [w.points]) if (piece.length >= 2) ribbon(out.tram, piece, o + r, 0.07, height, railLift, { step });
    // A separate cycle path crossing a carriageway untagged leaves a gap there (pathCuts): mark it as a cycle crossing.
    if (opts.markings !== false && !carriage && w.section.bands[0]?.kind === 'cycleway' && !isCrossing(w)) out.stats.markings.blocks += cyclePathCrossings(out, w, nodes, st, height, bgt);
  }
  // Junction fills and kerb corners: emitted once, by the node's owner way.
  for (const n of nodes.values()) {
    if (n.kind === 'junction') out.junctionPoints.push(n.p);
    if (n.kind === 'none' || !n.polygon.length) continue;
    const owner = byId.get(n.owner);
    if (!owner || (opts.only && !opts.only(owner))) continue;
    // roads-v1: a node inside a surveyed polygon has its surface already; no fill, no corner patches (the wedges).
    const surveyed = inPolygon(n.p);
    if (surveyed) clipped.fills++;
    else {
      const main = n.arms.reduce((best, a) => (a.left + a.right > best.left + best.right ? a : best), n.arms[0]);
      const surface = main.way.section.bands[0].surface;
      fillPolygon(out[surface], n.polygon, height, LIFT.carriageway, step);
    }
    if (n.kind !== 'junction') continue;
    out.stats.junctions++;
    if (!surveyed) for (const c of n.corners) out.stats.corners += cornerPatches(out, n, c, height, step);
    if (opts.markings !== false) junctionMarkings(out, n, signalPoints, crossingWays, height, bgt && surveyed ? bgt : null);
  }
  return out;
}

/** Arm polyline from the node outward (way points from the node's index in the arm's direction). */
function armLine(a: Arm): Vec2[] {
  const pts: Vec2[] = [];
  for (let j = a.i; j >= 0 && j < a.way.points.length; j += a.sign) pts.push(a.way.points[j]);
  return pts;
}

/**
 * Stop lines or shark teeth across each arm's inbound lanes, and painted cycle
 * lanes carried through to their straight-through partner (roadMarkings.ts).
 */
function junctionMarkings(out: StreetMeshes, n: Node, signals: readonly Vec2[], crossings: readonly LocalWay[], height: HeightFn, bgt: RoadsOption | null): void {
  const st = out.stats.markings;
  // roads-v1 (the node lies in a surveyed polygon): stop lines and teeth stay, clipped to the carriageway polygons;
  // the lane links and their blocks are off (the polygons carry the junction surface; a strip of red through a
  // surveyed junction is the smear the user saw).
  const keep: Keep | undefined = bgt ? (x, y) => PAINT_ON_SURVEY && bgt.index.onRoad(x, y) : undefined;
  const signalised = signals.some(p => Math.hypot(p[0] - n.p[0], p[1] - n.p[1]) <= SIGNAL_REACH_M);
  for (const a of n.arms) {
    const hw = a.way.tags.highway ?? '';
    const otherBest = Math.max(0, ...n.arms.filter(b => b.way !== a.way).map(b => rankOf(b.way.tags.highway)));
    const mark = mouthMarking(hw, otherBest, signalised);
    if (!mark || isBridgeWay(a.way)) continue;
    const cw = a.way.section.bands[0].width, ow = a.way.tags.oneway === 'yes' ? 1 : a.way.tags.oneway === '-1' ? -1 : 0;
    // Inbound lanes: traffic toward the node keeps right, which is the arm's left (leftOf(dir)); a one-way arm is all or nothing.
    if (ow && ow === a.sign) continue;
    const [l0, l1] = ow ? [-cw / 2 + 0.1, cw / 2 - 0.1] : [0.15, cw / 2 - 0.1];
    const line = armLine(a), ls = stations(line), total = ls[ls.length - 1];
    let t = a.trim + 0.5;
    // Before a crossing mapped across the arm (zebra, cycle crossing), as painted.
    for (const c of crossings) for (let i = 0; i + 1 < c.points.length; i++) {
      const s = crossingStation(line, c.points[i], c.points[i + 1]);
      if (s !== null && s <= a.trim + CROSSING_REACH_M) t = Math.max(t, s + c.section.coreHalfWidth + 0.5);
    }
    if (t + 1 > total) continue;
    const o = pointAt(line, ls, t), q = pointAt(line, ls, Math.min(total, t + 1)), d = dirOf(o, q);
    const lift = bgt ? ROAD_MARK_LIFT.paint : LIFT.paint;
    if (mark === 'stop') { if (bar(out.paint, { o, u: d }, l0, l1, STOP_LINE_M, height, lift, keep)) st.stopLines++; }
    else { const teeth = sharkTeeth(out.paint, { o, u: d }, l0, l1, height, lift, keep); st.teeth += teeth; if (teeth) st.giveWays++; }
  }
  if (bgt) return;
  // Painted cycle lanes through the junction: a's left side runs on into b's right side (b roughly opposite a).
  const lane = (a: Arm, side: 'left' | 'right') => a.way.section.bands.find(b => b.kind === 'cycle_lane' && ((a.sign > 0) === (side === 'left') ? b.offset > 0 : b.offset < 0));
  for (const a of n.arms) for (const b of n.arms) {
    if (a === b) continue;
    const dev = 180 - Math.abs(((a.angle - b.angle) * 180 / Math.PI + 540) % 360 - 180);
    if (dev > CONTINUE_DEG) continue;
    const la = lane(a, 'left'), lb = lane(b, 'right');
    if (!la || !lb) continue;
    const na = leftOf(a.dir), nb = leftOf(b.dir), oa = Math.abs(la.offset), ob = Math.abs(lb.offset), w = Math.min(la.width, lb.width);
    const A: Vec2 = [n.p[0] + a.dir[0] * a.trim + na[0] * oa, n.p[1] + a.dir[1] * a.trim + na[1] * oa];
    const B: Vec2 = [n.p[0] + b.dir[0] * b.trim - nb[0] * ob, n.p[1] + b.dir[1] * b.trim - nb[1] * ob];
    strip(out.cycle, A, B, w, height, LIFT.cycleLane);
    st.laneLinks++;
    // A side arm opens between a and b counter-clockwise (on a's left): the lane crosses its mouth.
    const span = (b.angle - a.angle + 2 * Math.PI) % (2 * Math.PI);
    const side = n.arms.some(c => c !== a && c !== b && (c.angle - a.angle + 2 * Math.PI) % (2 * Math.PI) < span - 1e-6 && (c.angle - a.angle + 2 * Math.PI) % (2 * Math.PI) > 1e-6);
    const e = dirOf(A, B), m: Vec2 = [-e[1], e[0]], h = w / 2 - BLOCK_HALF;
    const edge = (k: number): [Vec2, Vec2] => [[A[0] + m[0] * k, A[1] + m[1] * k], [B[0] + m[0] * k, B[1] + m[1] * k]];
    if (side) { for (const k of [h, -h]) { const [p, q] = edge(k); st.blocks += blocks(out.paint, p, q, height, LIFT.paint); } st.cycleCrossings++; }
    else {
      // No side road: the lane just runs on; its line toward the road (the side nearer the junction centre) dashed as on the arms.
      const inner = [h, -h].reduce((best, k) => { const [p] = edge(k); const dd = Math.hypot(p[0] - n.p[0], p[1] - n.p[1]); return dd < best.d ? { k, d: dd } : best; }, { k: h, d: Infinity }).k;
      dashed(out.paint, edge(inner), 0, 0.1, [1, 1], height, LIFT.paint);
    }
  }
}

/** Half a block (centred 0.2 m inside a lane edge). */
const BLOCK_HALF = 0.2;

/**
 * Where a separate cycle path crosses a carriageway at a shared node with no
 * crossing way mapped, pathCuts leaves a gap the width of the road: mark it
 * as a cycle crossing (blocks along both edges; red between them over a side
 * street, class unclassified or lower, where Amsterdam carries the path's red
 * across). Returns the number of blocks.
 */
function cyclePathCrossings(out: StreetMeshes, w: LocalWay, nodes: Map<string, Node>, st: readonly number[], height: HeightFn, bgt: RoadsOption | null): number {
  let count = 0;
  const width = w.section.bands[0].width, last = w.points.length - 1;
  w.points.forEach((p, i) => {
    if (i === 0 || i === last) return;
    const n = nodes.get(key(p));
    if (!n || !n.arms.length || n.arms.every(a => a.way === w)) return;
    const h = Math.min(n.roadHalf + 0.15, 12);
    const a = pointAt(w.points, st, Math.max(0, st[i] - h)), b = pointAt(w.points, st, Math.min(st[last], st[i] + h));
    const e = dirOf(a, b), m: Vec2 = [-e[1], e[0]], k = Math.max(0.3, width / 2 - BLOCK_HALF);
    // roads-v1: no red strip over a surveyed junction, and blocks only where the gap's midpoint is carriageway.
    const surveyed = !!bgt && bgt.index.find(p[0], p[1]) >= 0;
    if (surveyed && !bgt!.index.onRoad((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) return;
    if (!surveyed && Math.max(...n.arms.map(x => rankOf(x.way.tags.highway))) <= 2) strip(out.cycle, a, b, width, height, LIFT.cycleLane);
    const keep: Keep | undefined = bgt ? (x, y) => PAINT_ON_SURVEY && bgt.index.onRoad(x, y) : undefined;
    for (const s of [k, -k]) count += blocks(out.paint, [a[0] + m[0] * s, a[1] + m[1] * s], [b[0] + m[0] * s, b[1] + m[1] * s], height, bgt ? ROAD_MARK_LIFT.paint : LIFT.paint, undefined, undefined, keep);
    out.stats.markings.cycleCrossings++;
  });
  return count;
}

/**
 * roads-v1: a covered carriageway's painted cycle lane (BGT keeps it inside the rijbaan polygon) as a red ribbon
 * at the lane lift, in 2 m pieces kept where the piece's midpoint is on a carriageway polygon and the survey has
 * no separate cycle path a metre outward of the lane's outer edge (then the fietspad polygon is the red). The
 * junction trims (`road`) cut it as they cut the band. Returns the pieces dropped.
 */
function laneRibbon(m: MeshArrays, w: LocalWay, band: Band, road: [number, number][], index: RoadIndex, height: HeightFn, step: number): number {
  const bridge = isBridgeWay(w), outer = band.offset + Math.sign(band.offset || 1) * (band.width / 2 + 1);
  let dropped = 0;
  for (const piece of road.length ? cutIntervals(w.points, road) : [w.points]) {
    if (piece.length < 2) continue;
    for (const part of chop(piece, 2)) {
      const st = stations(part), half = st[st.length - 1] / 2, mid = pointAt(part, st, half), q = pointAt(part, st, Math.min(st[st.length - 1], half + 0.5)), r = pointAt(part, st, Math.max(0, half - 0.5));
      const nl = leftOf(dirOf(r, q)), lane: Vec2 = [mid[0] + nl[0] * band.offset, mid[1] + nl[1] * band.offset], out: Vec2 = [mid[0] + nl[0] * outer, mid[1] + nl[1] * outer];
      if (!index.onRoad(lane[0], lane[1], bridge) || index.classAt(out[0], out[1], bridge) === 'cycle') { dropped++; continue; }
      ribbon(m, part, band.offset, band.width, height, ROAD_MARK_LIFT.lane, { step });
    }
  }
  return dropped;
}

/** A polyline in pieces of at most `len` metres (original vertices kept). */
function chop(pts: readonly Vec2[], len: number): Vec2[][] {
  const st = stations(pts), total = st[st.length - 1];
  if (total <= len) return [[...pts]];
  const cuts: [number, number][] = [];
  for (let s = len; s < total; s += len) cuts.push([s, s]);
  return cutIntervals(pts, cuts);
}

/**
 * roads-v1: station intervals (1 m) of a band of a way the polygons cover only in part, where a polygon of the
 * band's own kind lies under the band's centre (RoadIndex.coversBand): the polygon is the surface there.
 */
function coverCuts(w: LocalWay, band: Band, index: RoadIndex): [number, number][] {
  const st = stations(w.points), total = st[st.length - 1], bridge = isBridgeWay(w), cuts: [number, number][] = [];
  for (let s = 0; s <= total; s += 1) {
    const t = Math.min(s, total), p = pointAt(w.points, st, t), q = pointAt(w.points, st, Math.min(total, t + 0.5)), r = pointAt(w.points, st, Math.max(0, t - 0.5));
    const nl = leftOf(dirOf(r, q)), x = p[0] + nl[0] * band.offset, y = p[1] + nl[1] * band.offset;
    if (index.coversBand(x, y, band.surface, bridge)) cuts.push([s - 0.5, s + 0.5]);
  }
  return cuts;
}

/** roads-v1: a cycle path's red band over a rijbaan shorter than this is its crossing, drawn as blocks, not paint. */
export const CYCLE_PAINT_MIN_M = 6;
/**
 * roads-v1: a band piece split where the band's axis (at `offset`) goes on and off the survey: `road` on a polygon
 * (coverCuts left only rijbaan and parkeervlak there), `off` past the survey's edge. 1 m stations.
 */
function splitBySurvey(piece: readonly Vec2[], offset: number, index: RoadIndex, bridge: boolean): { road: Vec2[][]; off: Vec2[][] } {
  const st = stations(piece), total = st[st.length - 1], onCuts: [number, number][] = [], offCuts: [number, number][] = [];
  for (let s = 0; s <= total; s += 1) {
    const t = Math.min(s, total), p = pointAt(piece, st, t), q = pointAt(piece, st, Math.min(total, t + 0.5)), r = pointAt(piece, st, Math.max(0, t - 0.5));
    const nl = leftOf(dirOf(r, q)), on = index.classAt(p[0] + nl[0] * offset, p[1] + nl[1] * offset, bridge) !== null;
    (on ? offCuts : onCuts).push([s - 0.5, s + 0.5]);
  }
  const keep = (cuts: [number, number][]) => (cuts.length ? cutIntervals(piece as Vec2[], cuts) : [piece as Vec2[]]).filter(p => p.length >= 2);
  return { road: offCuts.length ? keep(onCuts) : [], off: onCuts.length ? keep(offCuts) : [] };
}

/**
 * roads-v1: the parts of a way's rails over a carriageway polygon (or off the survey). Stations every metre; a
 * station whose class is not carriage is dropped with half a metre either side. Returns the pieces and the stations dropped.
 */
function railIntervals(w: LocalWay, index: RoadIndex, bridge: boolean): { pieces: Vec2[][]; dropped: number } {
  const st = stations(w.points), total = st[st.length - 1], cuts: [number, number][] = [];
  let dropped = 0;
  for (let s = 0; s <= total; s += 1) {
    const p = pointAt(w.points, st, Math.min(s, total)), c = index.classAt(p[0], p[1], bridge);
    if (c === null || c === 'carriage') continue;
    dropped++;
    cuts.push([s - 0.5, s + 0.5]);
  }
  return { pieces: cuts.length ? cutIntervals(w.points, cuts) : [w.points], dropped };
}

/** Carriageway segments in a 20 m grid (as shadowedWays), for crossCuts. */
export interface CarriageGrid { G: number; grid: Map<string, { way: LocalWay; a: Vec2; b: Vec2 }[]> }
export function carriageGrid(ways: readonly LocalWay[]): CarriageGrid {
  const G = 20, grid = new Map<string, { way: LocalWay; a: Vec2; b: Vec2 }[]>();
  for (const w of ways) {
    if (!isCarriage(w)) continue;
    for (let i = 0; i + 1 < w.points.length; i++) {
      const a = w.points[i], b = w.points[i + 1];
      for (let gx = Math.floor(Math.min(a[0], b[0]) / G); gx <= Math.floor(Math.max(a[0], b[0]) / G); gx++) for (let gy = Math.floor(Math.min(a[1], b[1]) / G); gy <= Math.floor(Math.max(a[1], b[1]) / G); gy++) {
        const k = `${gx}:${gy}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push({ way: w, a, b });
      }
    }
  }
  return { G, grid };
}

/** Two carriageways closer than this to parallel do not cut each other's paint (dual carriageways, a tram bed beside the road). */
export const CROSS_CUT_MIN_DEG = 20;

/**
 * roads-v1: station intervals of `w` where its centreline passes within `other.coreHalfWidth + 1` m of a
 * carriageway it shares no node with (a bridge end meeting the quay streets, a crossing mapped without a node):
 * the junction model cannot trim there, so the paint is cut by proximity instead. Parallel neighbours are ignored.
 */
export function crossCuts(w: LocalWay, nodes: Map<string, Node>, st: readonly number[], cg: CarriageGrid): [number, number][] {
  const linked = new Set<number>([w.id]);
  for (const p of w.points) for (const id of nodes.get(key(p))?.ways ?? []) linked.add(id);
  const total = st[st.length - 1], minSin = Math.sin(CROSS_CUT_MIN_DEG * Math.PI / 180), cuts: [number, number][] = [];
  for (let s = 0; s <= total; s += 1) {
    const p = pointAt(w.points, st, Math.min(s, total)), q = pointAt(w.points, st, Math.min(total, s + 0.5)), r = pointAt(w.points, st, Math.max(0, s - 0.5)), d = dirOf(r, q);
    let hit = false;
    // The 3 × 3 grid cells around the station: a crossing within reach may lie just over a 20 m cell edge.
    const gx = Math.floor(p[0] / cg.G), gy = Math.floor(p[1] / cg.G);
    search: for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) for (const seg of cg.grid.get(`${ix}:${iy}`) ?? []) {
      if (linked.has(seg.way.id)) continue;
      const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], l2 = dx * dx + dy * dy;
      if (l2 < 1e-6) continue;
      const l = Math.sqrt(l2);
      if (Math.abs(cross2(d, [dx / l, dy / l])) < minSin) continue;
      const t = Math.max(0, Math.min(1, ((p[0] - seg.a[0]) * dx + (p[1] - seg.a[1]) * dy) / l2));
      if (Math.hypot(seg.a[0] + dx * t - p[0], seg.a[1] + dy * t - p[1]) <= seg.way.section.coreHalfWidth + 1) { hit = true; break search; }
    }
    if (hit) cuts.push([s - 0.5, s + 0.5]);
  }
  return cuts;
}

/** Drape a simple polygon (earcut; a degenerate ring is skipped). */
function fillPolygon(m: MeshArrays, ring: readonly Vec2[], height: HeightFn, lift: number, step: number): void {
  if (ring.length < 3) return;
  const flat = ring.flatMap(p => [p[0], p[1]]);
  const tris = earcut(flat);
  if (tris.length) drapeTriangles(m, flat, tris, height, lift, Math.max(2, step));
}

/** Side bands of an arm outward from its road edge on one side (as seen leaving the node). */
function armSideBands(a: Arm, side: 'left' | 'right'): Band[] {
  const wayLeft = (a.sign > 0) === (side === 'left');
  return a.way.section.bands.filter(b => b.kind !== 'carriageway' && b.kind !== 'cycle_lane' && (wayLeft ? b.offset > 0 : b.offset < 0)).sort((p, q) => Math.abs(p.offset) - Math.abs(q.offset));
}

/**
 * The corner between arm a's left side bands and arm b's right side bands:
 * ring k joins a's k-th band outward with b's k-th, from the kerb corner out.
 */
function cornerPatches(out: StreetMeshes, n: Node, c: Corner, height: HeightFn, step: number): number {
  const A = armSideBands(c.a, 'left'), B = armSideBands(c.b, 'right');
  const rings = Math.min(A.length, B.length);
  let count = 0;
  for (let k = 0; k < rings; k++) {
    const ba = A[k], bb = B[k];
    const aIn = Math.abs(ba.offset) - ba.width / 2 - (c.a.left), bIn = Math.abs(bb.offset) - bb.width / 2 - (c.b.right);
    const ha0 = c.a.left + Math.max(0, aIn), ha1 = ha0 + ba.width, hb0 = c.b.right + Math.max(0, bIn), hb1 = hb0 + bb.width;
    const inner = cornerOf(c.a.dir, ha0, c.b.dir, hb0), outer = cornerOf(c.a.dir, ha1, c.b.dir, hb1);
    if (!inner || !outer || inner.t < 0 || inner.s < 0) continue;
    const na = leftOf(c.a.dir), nb = leftOf(c.b.dir), p = n.p;
    const along = (dir: Vec2, nrm: Vec2, t: number, h: number): Vec2 => [p[0] + dir[0] * t + nrm[0] * h, p[1] + dir[1] * t + nrm[1] * h];
    // a's band ends at its corner station; b's likewise (the side cuts above end them there).
    const ta = c.a.cornerLeft ?? inner.t, tb = c.b.cornerRight ?? inner.s;
    const raw: Vec2[] = [along(c.a.dir, na, ta, ha0), along(c.a.dir, na, ta, ha1), along(c.a.dir, na, outer.t, ha1), along(c.b.dir, nb, tb, -hb1), along(c.b.dir, nb, tb, -hb0), along(c.a.dir, na, inner.t, ha0)];
    const ring = raw.filter((q, i) => { const r = raw[(i + raw.length - 1) % raw.length]; return Math.hypot(q[0] - r[0], q[1] - r[1]) > 0.02; });
    const raised = Math.min(ba.raised, bb.raised);
    fillPolygon(out[ba.surface], ring, height, raised > 0 ? LIFT.raisedBase + raised : LIFT.path, step);
    count++;
  }
  return count;
}

/** Amsterdammertjes: small oxblood posts (0.1 m square, 0.8 m tall, a cap) every 1.6 m where `where` holds. */
export function bollards(m: MeshArrays, pts: readonly Vec2[], offset: number, height: HeightFn, base: number, where: (x: number, y: number) => boolean): void {
  const st = stations(pts), total = st[st.length - 1];
  for (let s = 0.8; s < total - 0.4; s += 1.6) {
    const p = pointAt(pts, st, s), q = pointAt(pts, st, Math.min(total, s + 0.3));
    const d = dirOf(p, q), n = leftOf(d), x = p[0] + n[0] * offset, y = p[1] + n[1] * offset;
    if (!where(x, y)) continue;
    const z0 = height(x, y) + base, z1 = z0 + 0.8, h = 0.05;
    const c: Vec2[] = [[x - d[0] * h - n[0] * h, y - d[1] * h - n[1] * h], [x + d[0] * h - n[0] * h, y + d[1] * h - n[1] * h], [x + d[0] * h + n[0] * h, y + d[1] * h + n[1] * h], [x - d[0] * h + n[0] * h, y - d[1] * h + n[1] * h]];
    const i0 = m.positions.length / 3;
    for (const [cx, cy] of c) { m.positions.push(cx, cy, z0, cx, cy, z1); m.uvs.push(cx, cy, cx, cy); }
    const top = m.positions.length / 3;
    m.positions.push(x, y, z1 + 0.06); m.uvs.push(x, y);
    for (let k = 0; k < 4; k++) {
      const a = i0 + k * 2, b = i0 + ((k + 1) % 4) * 2;
      m.indices.push(a, b, b + 1, a, b + 1, a + 1, a + 1, b + 1, top);
    }
  }
}

const dirOf = (a: Vec2, b: Vec2): Vec2 => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };

/**
 * Dashes (or a solid line when `dash` is null) along a polyline. With `keep`, each dash (a solid line in 2 m pieces)
 * is drawn only where its midpoint, on the line's offset, passes (roads-v1: over a carriageway polygon). Returns the pieces dropped.
 */
export function dashed(m: MeshArrays, pts: readonly Vec2[], offset: number, width: number, dash: [number, number] | null, height: HeightFn, lift: number, keep?: Keep): number {
  if (!dash && !keep) { ribbon(m, pts, offset, width, height, lift, { step: 3 }); return 0; }
  const pieces = dash ? (() => { const st = stations(pts), total = st[st.length - 1], [on, off] = dash, cuts: [number, number][] = []; for (let s = on; s < total; s += on + off) cuts.push([s, s + off]); return cutIntervals(pts, cuts); })() : chop(pts, 2);
  let dropped = 0;
  for (const piece of pieces) {
    if (keep) {
      const st = stations(piece), half = st[st.length - 1] / 2, mid = pointAt(piece, st, half), q = pointAt(piece, st, Math.min(st[st.length - 1], half + 0.3)), r = pointAt(piece, st, Math.max(0, half - 0.3));
      const nl = leftOf(dirOf(r, q));
      if (!keep(mid[0] + nl[0] * offset, mid[1] + nl[1] * offset)) { dropped++; continue; }
    }
    ribbon(m, piece, offset, width, height, lift, { step: 3 });
  }
  return dropped;
}

/** A draped route (or highlighted street) ribbon. */
export function routeRibbon(pts: readonly Vec2[], height: HeightFn, width = 1.4, lift: number = LIFT.route): MeshArrays {
  const m = emptyMesh();
  ribbon(m, pts, 0, width, height, lift, { step: 1.5 });
  return m;
}

export const streetTriangles = (s: StreetMeshes) => (['asphalt', 'klinker', 'cycle', 'paving', 'gravel', 'paint', 'kerb', 'tram', 'bollard'] as const).reduce((n, k) => n + triangleCount(s[k]), 0);

export { pointAt };
