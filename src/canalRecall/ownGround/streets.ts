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

/** Height above the relief per layer (metres): later layers win the depth test. */
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
  stats: { ways: number; bands: number; metres: number; widthFromTags: number; sidewalkFromTags: number; trims: number; junctions: number; corners: number };
};

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
export function buildStreets(ways: readonly LocalWay[], height: HeightFn, opts: { step?: number; only?: (w: LocalWay) => boolean; canalSide?: (x: number, y: number) => boolean } = {}): StreetMeshes {
  const step = opts.step ?? 3;
  const out = { asphalt: emptyMesh(), klinker: emptyMesh(), cycle: emptyMesh(), paving: emptyMesh(), gravel: emptyMesh(), paint: emptyMesh(), kerb: emptyMesh(), tram: emptyMesh(), bollard: emptyMesh(), stats: { ways: 0, bands: 0, metres: 0, widthFromTags: 0, sidewalkFromTags: 0, trims: 0, junctions: 0, corners: 0 } } as StreetMeshes;
  const nodes = junctionGeometry(ways);
  const byId = new Map(ways.map(w => [w.id, w]));
  const discDone = new Set<string>();
  const shadowed = shadowedWays(ways);
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
    for (const band of w.section.bands) {
      if (crossing) break;
      out.stats.bands++;
      const m = out[band.surface];
      const onRoad = band.kind === 'carriageway' || band.kind === 'cycle_lane';
      const cuts = !carriage ? path : onRoad ? road : sides[band.offset > 0 ? 1 : -1];
      out.stats.trims += cuts.length;
      const pieces = cuts.length ? cutIntervals(w.points, cuts).filter(pc => carriage || keepPathPiece(w, pc)) : [w.points];
      if (band.raised > 0) {
        const top = LIFT.raisedBase + band.raised;
        for (const piece of pieces) {
          if (piece.length < 2) continue;
          ribbon(m, piece, band.offset, band.width, height, top, { step });
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
      for (const piece of pieces) if (piece.length >= 2) ribbon(m, piece, band.offset, band.width, height, lift, { step });
      // Paths meeting only paths join with a small round fill (no junction polygon is built for them).
      if (!carriage && band.offset === 0) {
        for (const p of [w.points[0], w.points[w.points.length - 1], ...w.points]) {
          const n = nodes.get(key(p));
          if (!n || n.ways.size < 2 || n.arms.length) continue;
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
      const cuts = crossing ? [] : !carriage ? path : onRoad ? road.map(([a, b]) => [a - 0.3, b + 0.3] as [number, number]) : sides[host.offset > 0 ? 1 : -1];
      const lift = onRoad || crossing ? LIFT.paint : (host.raised > 0 ? LIFT.raisedBase + host.raised : LIFT.path) + 0.006;
      for (const piece of cuts.length ? cutIntervals(w.points, cuts).filter(pc => carriage || keepPathPiece(w, pc)) : [w.points]) if (piece.length >= 2) dashed(out.paint, piece, line.offset, line.width, line.dash, height, lift);
    }
    // Tram rails: two per track at standard gauge, through junctions (the tracks do not stop there).
    for (const o of w.section.rails ?? []) for (const r of [-0.7175, 0.7175]) ribbon(out.tram, w.points, o + r, 0.07, height, LIFT.rail, { step });
  }
  // Junction fills and kerb corners: emitted once, by the node's owner way.
  for (const n of nodes.values()) {
    if (n.kind === 'none' || !n.polygon.length) continue;
    const owner = byId.get(n.owner);
    if (!owner || (opts.only && !opts.only(owner))) continue;
    const main = n.arms.reduce((best, a) => (a.left + a.right > best.left + best.right ? a : best), n.arms[0]);
    const surface = main.way.section.bands[0].surface;
    fillPolygon(out[surface], n.polygon, height, LIFT.carriageway, step);
    if (n.kind !== 'junction') continue;
    out.stats.junctions++;
    for (const c of n.corners) out.stats.corners += cornerPatches(out, n, c, height, step);
  }
  return out;
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
function bollards(m: MeshArrays, pts: readonly Vec2[], offset: number, height: HeightFn, base: number, where: (x: number, y: number) => boolean): void {
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

/** Dashes (or a solid line when `dash` is null) along a polyline. */
export function dashed(m: MeshArrays, pts: readonly Vec2[], offset: number, width: number, dash: [number, number] | null, height: HeightFn, lift: number): void {
  if (!dash) { ribbon(m, pts, offset, width, height, lift, { step: 3 }); return; }
  const st = stations(pts), total = st[st.length - 1], [on, off] = dash;
  const cuts: [number, number][] = [];
  for (let s = on; s < total; s += on + off) cuts.push([s, s + off]);
  for (const piece of cutIntervals(pts, cuts)) ribbon(m, piece, offset, width, height, lift, { step: 3 });
}

/** A draped route (or highlighted street) ribbon. */
export function routeRibbon(pts: readonly Vec2[], height: HeightFn, width = 1.4, lift: number = LIFT.route): MeshArrays {
  const m = emptyMesh();
  ribbon(m, pts, 0, width, height, lift, { step: 1.5 });
  return m;
}

export const streetTriangles = (s: StreetMeshes) => (['asphalt', 'klinker', 'cycle', 'paving', 'gravel', 'paint', 'kerb', 'tram', 'bollard'] as const).reduce((n, k) => n + triangleCount(s[k]), 0);

export { pointAt };
