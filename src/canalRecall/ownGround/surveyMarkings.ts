// Road markings on the surveyed (roads-v1) carriageway, from OSM data (pure).
//
// User 2026-10-16 evening: "not gonna lie, our roads still don't look great" — with the procedural band paint off on
// surveyed ground (streets.ts PAINT_ON_SURVEY, "maybe we just stop showing dashes for now"), carriageways were flat
// slabs and the city read as a vector map. The band paint shredded because it was placed from priors (offsets from a
// centreline) and then clipped; here each mark is placed from what is mapped and measured on the polygon it lies on:
//
//   zebra          an OSM crossing node (road-marks-v1, roadMarks.ts) or a footway crossing way whose markings say
//                  zebra: 0.5 m stripes with 0.5 m gaps, ZEBRA.len long along the road, across the whole carriageway
//                  at the node (islands up to ISLAND_GAP_M are bridged; the stripes are clipped to the polygons);
//                  `dashes` / `dots` crossings: two lines of blocks instead.
//   cycle crossing a cycleway running across a carriageway polygon (in and out of it, ≤ CYCLE_CROSS_MAX_M on it): red
//                  under the path's width with white blocks along both edges (blokmarkering).
//   stop line      at a traffic_signals / stop node (toward its `direction`, else toward the nearest junction), and
//                  before a signalised crossing on its approach side: across the inbound half of the carriageway (all
//                  of it on a one-way), set back STOP_GAP_M before any zebra.
//   give-way teeth at a give_way node; and where no node says anything within NODE_REACH_M, on a carriageway arm of a
//                  lower class than the junction's best other arm (roadMarkings mouthMarking), at the mouth where the
//                  arm leaves the major road's measured carriageway: haaientanden across its inbound half.
//   centre line    3 m dashes, 6 m gaps along two-way carriageway ways whose measured polygon width is ≥ 6 m, on the
//                  measured middle (not the OSM centreline), no tram track on or beside it, cut CENTRE_CUT_M before every
//                  junction mouth and around crossings.
//
// Every mark is clipped to ground carriageway polygons (class carriage, h = 0): a bar is sampled along its length every
// CLIP_STEP_M and only the runs where its centre and both edges lie on a carriageway are drawn, so no paint lands on a
// pavement, cycle path, parking bay or inrit. Bridges carry none (their decks are drawn on the deck surface).

import { drapeTriangles, emptyMesh, pointAt, stations, triangleCount, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';
import type { RoadIndex } from './roadSurfaces.js';
import type { LocalWay } from './streets.js';
import type { RoadMark } from './roadMarks.js';
import { BLOCK, isSignalCrossing, mouthMarking, rankOf, sharkTeeth, SIGNAL_REACH_M, STOP_LINE_M, type MarkFrame } from './roadMarkings.js';

/** The surveyed carriageway draws these marks (streets.ts PAINT_ON_SURVEY keeps the old band paint off there). */
export const SURVEY_MARKINGS = true;

export const ZEBRA = { stripe: 0.5, gap: 0.5, len: 3.0 } as const;
export const CENTRE_DASH: readonly [number, number] = [3, 6];
export const CENTRE_LINE_M = 0.12;
export const CENTRE_MIN_WIDTH_M = 6;
/** Centre dashes stop this far before a junction mouth. */
export const CENTRE_CUT_M = 8;
/** A stop line or teeth sit this far before a zebra's edge. */
export const STOP_GAP_M = 1.0;
export const CLIP_STEP_M = 0.2;
/** A zebra runs on across a traffic island up to this wide. */
export const ISLAND_GAP_M = 4;
/** Cycle crossing: a run of the path on the carriageway longer than this is a lane along it, not a crossing. */
export const CYCLE_CROSS_MAX_M = 24;
/** Graph-derived teeth only where no mapped node (give_way, stop, signals) lies this close to the junction. */
export const NODE_REACH_M = 30;
const CYCLE_CROSS_WIDTH_M = 2.0;
/** A cycle crossing passes no carriageway junction node closer than this (it crosses an arm, not the middle). */
export const CYCLE_CROSS_JUNCTION_M = 5;
const MAX_HALF_M = 14;

export interface SurveyMarkingStats { zebras: number; stripes: number; blockLines: number; cycleCrossings: number; blocks: number; stopLines: number; giveWays: number; teeth: number; centreDashes: number; ms: number }

export interface SurveyMarkingInput {
  /** Ways of the cell and its neighbourhood (the junction graph sees all of them). */
  ways: readonly LocalWay[];
  /** road-marks-v1 nodes of the neighbourhood. */
  marks: readonly RoadMark[];
  /** Does this cell draw the way's marks (crossing ways, cycle crossings, centre lines)? */
  ownsWay: (w: LocalWay) => boolean;
  /** Does this cell draw the marks of a node or junction here? */
  ownsPoint: (p: Vec2) => boolean;
  index: RoadIndex;
  height: HeightFn;
  /** Where marks can be (the cell and the reach of its own ways); the carriageway lookup is built over it only. */
  box?: readonly [number, number, number, number];
  /** Lifts over the relief: paint, and the red of a cycle crossing (streets.ts ROAD_MARK_LIFT). */
  lift: { paint: number; red: number };
}

const isBridge = (w: LocalWay) => !!w.tags.bridge && w.tags.bridge !== 'no';
const isCarriageWay = (w: LocalWay) => w.section.bands[0]?.kind === 'carriageway' && !isBridge(w);
const isCrossingWay = (w: LocalWay) => w.tags.footway === 'crossing' || w.tags.cycleway === 'crossing' || w.tags.path === 'crossing' || (!!w.tags.crossing && ['footway', 'cycleway', 'path'].includes(w.tags.highway));
const isCycleWay = (w: LocalWay) => w.tags.highway === 'cycleway' || (w.tags.highway === 'path' && w.tags.bicycle === 'designated');
const oneway = (w: LocalWay): 1 | -1 | 0 => (['yes', 'true', '1'].includes(w.tags.oneway) ? 1 : w.tags.oneway === '-1' ? -1 : 0);

/** What a footway crossing way paints: zebra stripes, two block lines, or nothing (roadMarks markOf for ways). */
export function crossingPaint(tags: Record<string, string>): 'zebra' | 'blocks' | null {
  const m = tags['crossing:markings'], c = tags.crossing;
  if (c === 'unmarked' || c === 'no' || c === 'informal' || m === 'no' || m === 'surface') return null;
  if (m === 'zebra' || m === 'yes') return 'zebra';
  if (m === 'dashes' || m === 'dots' || m === 'ladder' || m === 'lines') return 'blocks';
  return c === 'zebra' || c === 'marked' || c === 'uncontrolled' || c === 'traffic_signals' || isSignalCrossing(tags) ? 'zebra' : null;
}

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2, k = 1): Vec2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const neg = (a: Vec2): Vec2 => [-a[0], -a[1]];
const unit = (v: Vec2): Vec2 => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const left = (v: Vec2): Vec2 => [-v[1], v[0]];
const rightOf = (v: Vec2): Vec2 => [v[1], -v[0]];
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Distance from p to segment a–b. */
export function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const d = sub(b, a), l2 = dot(d, d);
  const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / l2));
  return dist(p, add(a, d, t));
}

const NONE: readonly never[] = [];
/** Segments bucketed on a square grid, for point queries within `pad` of them. */
export class SegGrid<T> {
  private readonly cells = new Map<number, { a: Vec2; b: Vec2; item: T }[]>();
  constructor(private readonly size = 8) {}
  add(a: Vec2, b: Vec2, item: T, pad: number): void {
    const G = this.size;
    for (let gx = Math.floor((Math.min(a[0], b[0]) - pad) / G); gx <= Math.floor((Math.max(a[0], b[0]) + pad) / G); gx++)
      for (let gy = Math.floor((Math.min(a[1], b[1]) - pad) / G); gy <= Math.floor((Math.max(a[1], b[1]) + pad) / G); gy++) {
        const k = (gx + 32768) * 65536 + gy + 32768; (this.cells.get(k) ?? this.cells.set(k, []).get(k)!).push({ a, b, item });
      }
  }
  near(p: Vec2): readonly { a: Vec2; b: Vec2; item: T }[] { return this.cells.get((Math.floor(p[0] / this.size) + 32768) * 65536 + Math.floor(p[1] / this.size) + 32768) ?? NONE; }
}

function quad(m: MeshArrays, q: readonly Vec2[], height: HeightFn, lift: number): void {
  drapeTriangles(m, q.flatMap(p => [p[0], p[1]]), q.length === 3 ? [0, 1, 2] : [0, 1, 2, 0, 2, 3], height, lift, 3);
}

interface RoadHit { way: LocalWay; dir: Vec2; at: Vec2; d: number }

/** Geometry helpers over the survey: what is carriageway, how far it reaches, clipped bars. */
export class SurveyMarker {
  readonly paint = emptyMesh();
  readonly red = emptyMesh();
  readonly stats: SurveyMarkingStats = { zebras: 0, stripes: 0, blockLines: 0, cycleCrossings: 0, blocks: 0, stopLines: 0, giveWays: 0, teeth: 0, centreDashes: 0, ms: 0 };
  private readonly carriage = new SegGrid<LocalWay>(10);
  constructor(private readonly input: SurveyMarkingInput) {
    const bx = input.box, inBox = (p: Vec2, q: Vec2) => !bx || !(Math.max(p[0], q[0]) < bx[0] || Math.min(p[0], q[0]) > bx[2] || Math.max(p[1], q[1]) < bx[1] || Math.min(p[1], q[1]) > bx[3]);
    for (const w of input.ways) if (isCarriageWay(w)) for (let i = 0; i + 1 < w.points.length; i++) if (inBox(w.points[i], w.points[i + 1])) this.carriage.add(w.points[i], w.points[i + 1], w, 8);
  }

  /** On a ground carriageway polygon. */
  onCarriage = (x: number, y: number): boolean => {
    const ix = this.input.index, k = ix.findAtLevel(x, y, false);
    return k >= 0 && ix.records[k].h === 0 && ix.drawClass(k) === 'carriage';
  };

  /** Distance from p along dir to the carriageway's edge (MAX_HALF_M when it does not end there), 0.25 m steps. */
  reach(p: Vec2, dir: Vec2, max = MAX_HALF_M): number {
    for (let s = 0.25; s <= max; s += 0.25) if (!this.onCarriage(p[0] + dir[0] * s, p[1] + dir[1] * s)) return s - 0.125;
    return max;
  }

  /** Like reach, but on across gaps (traffic islands, a tram platform) up to `gap` metres, within `max`. */
  span(p: Vec2, dir: Vec2, gap = ISLAND_GAP_M, max = 24): number {
    let last = 0, off = 0;
    for (let s = 0.25; s <= max; s += 0.25) {
      if (this.onCarriage(p[0] + dir[0] * s, p[1] + dir[1] * s)) { last = s; off = 0; } else if ((off += 0.25) > gap) break;
    }
    return last;
  }

  /**
   * A bar from a to b of `width`, clipped: drawn over the runs (≥ minRun) where its centre and both edges lie on a
   * carriageway. Returns the number of pieces.
   */
  bar(m: MeshArrays, a: Vec2, b: Vec2, width: number, lift: number, minRun = 0.3): number {
    const d = sub(b, a), len = Math.hypot(d[0], d[1]);
    if (len < 1e-3) return 0;
    const u: Vec2 = [d[0] / len, d[1] / len], n = left(u), h = width / 2;
    const ok = (s: number) => { const p = add(a, u, s); return this.onCarriage(p[0], p[1]) && this.onCarriage(p[0] + n[0] * h, p[1] + n[1] * h) && this.onCarriage(p[0] - n[0] * h, p[1] - n[1] * h); };
    const steps = Math.max(1, Math.ceil(len / CLIP_STEP_M)), ds = len / steps;
    let pieces = 0, start = -1;
    const flush = (end: number) => {
      if (start < 0) return;
      const s0 = start * ds, s1 = Math.min(len, end * ds);
      if (s1 - s0 >= minRun) {
        const p0 = add(a, u, s0), p1 = add(a, u, s1);
        quad(m, [add(p0, n, -h), add(p1, n, -h), add(p1, n, h), add(p0, n, h)], this.input.height, lift);
        pieces++;
      }
      start = -1;
    };
    for (let i = 0; i <= steps; i++) {
      if (ok(i * ds)) { if (start < 0) start = i; } else flush(i - 1);
    }
    flush(steps);
    return pieces;
  }

  /** Runs of `pts` over a ground carriageway, each at least `min` long. */
  runs(pts: readonly Vec2[], min: number): { a: Vec2; b: Vec2; s0: number; s1: number }[] {
    const st = stations(pts), total = st[st.length - 1], out: { a: Vec2; b: Vec2; s0: number; s1: number }[] = [];
    let start = -1;
    const n = Math.max(1, Math.ceil(total / 0.25));
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * total, p = pointAt(pts, st, s), on = this.onCarriage(p[0], p[1]);
      if (on && start < 0) start = s;
      if ((!on || i === n) && start >= 0) {
        const end = on ? s : s - total / n;
        if (end - start >= min) out.push({ a: pointAt(pts, st, start), b: pointAt(pts, st, end), s0: start, s1: end });
        start = -1;
      }
    }
    return out;
  }

  /** The nearest carriageway way segment within `within` metres of p: the way, its direction there, the foot point. */
  roadAt(p: Vec2, within: number): RoadHit | null {
    let best: RoadHit | null = null;
    for (const s of this.carriage.near(p)) {
      const d = sub(s.b, s.a), l2 = dot(d, d);
      if (l2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, dot(sub(p, s.a), d) / l2)), c = add(s.a, d, t), e = dist(c, p);
      if (e <= within && (!best || e < best.d)) best = { way: s.item, dir: unit(d), at: c, d: e };
    }
    return best;
  }
}

interface Arm { way: LocalWay; i: number; sign: 1 | -1; dir: Vec2 }
interface JNode { p: Vec2; arms: Arm[] }

/** Carriageway junction nodes (≥ 3 arms) of the neighbourhood. */
export function carriageJunctions(ways: readonly LocalWay[]): JNode[] {
  const at = new Map<string, JNode>();
  for (const w of ways) {
    if (!isCarriageWay(w)) continue;
    w.points.forEach((p, i) => {
      const k = `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`;
      const node = at.get(k) ?? at.set(k, { p, arms: [] }).get(k)!;
      for (const sign of [1, -1] as const) {
        const j = i + sign;
        if (j < 0 || j >= w.points.length) continue;
        node.arms.push({ way: w, i, sign, dir: unit(sub(w.points[j], p)) });
      }
    });
  }
  return [...at.values()].filter(n => n.arms.length >= 3);
}

/** Polyline of an arm from its node outward, up to `len` metres. */
function armLine(a: Arm, len: number): Vec2[] {
  const pts: Vec2[] = [a.way.points[a.i]];
  let acc = 0;
  for (let j = a.i + a.sign; j >= 0 && j < a.way.points.length; j += a.sign) {
    const p = a.way.points[j], q = pts[pts.length - 1];
    acc += Math.hypot(p[0] - q[0], p[1] - q[1]);
    pts.push(p);
    if (acc >= len) break;
  }
  return pts;
}

export function buildSurveyMarkings(input: SurveyMarkingInput): { paint: MeshArrays; red: MeshArrays; stats: SurveyMarkingStats } {
  const t0 = Date.now();
  const mk = new SurveyMarker(input), { ways, height, lift, marks } = input, st = mk.stats;
  const junctions = carriageJunctions(ways);
  const nearestJunction = (p: Vec2, r: number) => { let best: JNode | null = null; for (const n of junctions) if (dist(n.p, p) <= r && (!best || dist(n.p, p) < dist(best.p, p))) best = n; return best; };
  /** Zebras and cycle crossings drawn: the centre line, stop lines and teeth keep off them. */
  const crossings = new SegGrid<number>(8);
  const addCrossing = (a: Vec2, b: Vec2, half: number) => crossings.add(a, b, half, half + 4);
  const onCrossing = (p: Vec2, pad: number) => crossings.near(p).some(c => segDist(p, c.a, c.b) < c.item + pad);
  const cycleVertices = new Set(ways.filter(isCycleWay).flatMap(w => w.points.map(p => `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`)));
  const lineDone: { p: Vec2; t: Vec2 }[] = [];

  /** Travel direction a node's mark applies to: its `direction` along the road, else toward the nearest junction. */
  const travelAt = (p: Vec2, road: RoadHit, dir: 1 | -1 | 0): Vec2 | null => {
    if (dir) return dir === 1 ? road.dir : neg(road.dir);
    const j = nearestJunction(p, 60);
    if (!j || dist(j.p, p) < 3) return null;
    return dot(sub(j.p, p), road.dir) >= 0 ? road.dir : neg(road.dir);
  };
  /** A line across the inbound half of the carriageway for travel `t` at q (all of it on a one-way). Returns the lateral range or null. */
  const inbound = (q: Vec2, t: Vec2, road: RoadHit): [number, number] | null => {
    const ow = oneway(road.way);
    if (ow && (ow === 1) !== (dot(road.dir, t) > 0)) return null; // one-way the other way: no inbound lanes
    const r = rightOf(t), toR = mk.reach(q, r), toL = mk.reach(q, neg(r));
    if (toR >= MAX_HALF_M || toL >= MAX_HALF_M) return null;
    const from = ow ? -toL : (toR - toL) / 2;
    return toR - from >= 1.2 ? [from + 0.15, toR - 0.15] : null;
  };
  /** Back a stop position off any zebra in front of it, along -t. */
  const setBack = (q: Vec2, t: Vec2): Vec2 => {
    for (let i = 0; i < 16 && onCrossing(q, STOP_GAP_M); i++) q = add(q, t, -0.5);
    return q;
  };
  const stopLine = (q0: Vec2, t: Vec2, road: RoadHit): boolean => {
    const q = setBack(q0, t);
    if (!mk.onCarriage(q[0], q[1]) || lineDone.some(l => dist(l.p, q) < 4 && dot(l.t, t) > 0.7)) return false;
    const range = inbound(q, t, road);
    if (!range) return false;
    const r = rightOf(t);
    // The line's long axis is across the road (r); its 0.4 m width along t.
    if (!mk.bar(mk.paint, add(q, r, range[0]), add(q, r, range[1]), STOP_LINE_M, lift.paint, 1.0)) return false;
    lineDone.push({ p: q, t });
    st.stopLines++;
    return true;
  };
  const teeth = (q0: Vec2, t: Vec2, road: RoadHit): boolean => {
    const q = setBack(q0, t);
    if (!mk.onCarriage(q[0], q[1]) || lineDone.some(l => dist(l.p, q) < 4 && dot(l.t, t) > 0.7)) return false;
    const range = inbound(q, t, road);
    if (!range) return false;
    // sharkTeeth: base on u = 0, apex at +u toward the driver who gives way (who comes along t): u = -t; lateral n = left(u) = right of t.
    const f: MarkFrame = { o: q, u: neg(t) };
    const n = sharkTeeth(mk.paint, f, range[0], range[1], height, lift.paint, (x, y) => mk.onCarriage(x, y));
    if (!n) return false;
    lineDone.push({ p: q, t });
    st.giveWays++; st.teeth += n;
    return true;
  };

  // ---- zebras (and block lines) from the crossing nodes
  const zebra = (centre: Vec2, r: Vec2, from: number, to: number, kind: 'zebra' | 'blocks'): boolean => {
    const n = left(r), a = add(centre, n, from), b = add(centre, n, to), L = to - from;
    if (L < 2.5) return false;
    addCrossing(a, b, ZEBRA.len / 2);
    if (kind === 'zebra') {
      const pitch = ZEBRA.stripe + ZEBRA.gap, count = Math.floor((L + ZEBRA.gap) / pitch), s0 = (L - (count * pitch - ZEBRA.gap)) / 2 + ZEBRA.stripe / 2;
      let drawn = 0;
      for (let i = 0; i < count; i++) {
        const c = add(a, n, s0 + i * pitch);
        drawn += mk.bar(mk.paint, add(c, r, -ZEBRA.len / 2), add(c, r, ZEBRA.len / 2), ZEBRA.stripe, lift.paint, 0.8);
      }
      if (drawn) { st.zebras++; st.stripes += drawn; }
      return drawn > 0;
    }
    let drawn = 0;
    for (const side of [-1, 1]) {
      const o = (ZEBRA.len / 2 - BLOCK.size / 2) * side, pitch = BLOCK.size + BLOCK.gap;
      for (let s = BLOCK.gap / 2; s + BLOCK.size <= L; s += pitch) drawn += mk.bar(mk.paint, add(add(a, r, o), n, s), add(add(a, r, o), n, s + BLOCK.size), BLOCK.size, lift.paint, BLOCK.size * 0.75);
    }
    st.blocks += drawn;
    if (drawn) st.blockLines++;
    return drawn > 0;
  };
  /** Stop lines before a signalised crossing: on the approach toward the junction, or both sides mid-block. */
  const crossingStops = (centre: Vec2, road: RoadHit) => {
    const j = nearestJunction(centre, 40);
    for (const t of [road.dir, neg(road.dir)]) {
      if (j && dot(sub(j.p, centre), t) <= 0) continue; // traffic leaving the junction meets no stop line here
      stopLine(add(centre, t, -(ZEBRA.len / 2 + STOP_GAP_M + STOP_LINE_M / 2)), t, road);
    }
  };
  const nodeCrossings = marks.filter(m => m.kind === 'zebra' || m.kind === 'blocks');
  for (const m of nodeCrossings) {
    const key = `${Math.round(m.p[0] * 10)}:${Math.round(m.p[1] * 10)}`;
    if (cycleVertices.has(key)) continue; // a cycle path's crossing: red and blocks below
    const road = mk.roadAt(m.p, 2.5);
    if (!road || !mk.onCarriage(road.at[0], road.at[1])) continue;
    const n = left(road.dir), to = mk.span(road.at, n), from = -mk.span(road.at, neg(n));
    if (!input.ownsPoint(m.p)) { addCrossing(add(road.at, n, from), add(road.at, n, to), ZEBRA.len / 2); continue; }
    if (zebra(road.at, road.dir, from, to, m.kind as 'zebra' | 'blocks') && m.signalised) crossingStops(road.at, road);
  }

  // ---- zebras from footway crossing ways (where no node says it already)
  for (const w of ways) {
    if (!isCrossingWay(w) || isBridge(w) || isCycleWay(w) || !input.ownsWay(w)) continue;
    const kind = crossingPaint(w.tags);
    if (!kind) continue;
    for (const run of mk.runs(w.points, 2.5)) {
      if (nodeCrossings.some(m => segDist(m.p, run.a, run.b) < 4)) continue;
      const mid: Vec2 = [(run.a[0] + run.b[0]) / 2, (run.a[1] + run.b[1]) / 2];
      const road = mk.roadAt(mid, 6);
      const d = unit(sub(run.b, run.a));
      let r: Vec2 = road ? road.dir : left(d);
      if (Math.abs(dot(r, d)) > 0.85) r = left(d); // a crossing way along the road: stripes across it
      const n = left(r), from = dot(sub(run.a, mid), n), to = dot(sub(run.b, mid), n);
      if (zebra(mid, r, Math.min(from, to), Math.max(from, to), kind) && isSignalCrossing(w.tags) && road) crossingStops(mid, road);
    }
  }

  // ---- cycle crossings: red with blocks along both edges, where a cycle path crosses a carriageway
  for (const w of ways) {
    if (!isCycleWay(w) || isBridge(w) || !input.ownsWay(w)) continue;
    if (w.tags.crossing === 'unmarked' || w.tags['crossing:markings'] === 'no') continue;
    const width = Math.max(1.6, Math.min(3, w.bw && w.bw[0] >= 10 ? w.bw[0] / 10 : CYCLE_CROSS_WIDTH_M));
    for (const run of mk.runs(w.points, 2)) {
      if (run.s1 - run.s0 > CYCLE_CROSS_MAX_M) continue;
      const u = unit(sub(run.b, run.a)), out0 = add(run.a, u, -0.6), out1 = add(run.b, u, 0.6);
      // A crossing enters and leaves the carriageway (a cycle path ending on the road is a junction mouth).
      if (mk.onCarriage(out0[0], out0[1]) || mk.onCarriage(out1[0], out1[1])) continue;
      const mid: Vec2 = [(run.a[0] + run.b[0]) / 2, (run.a[1] + run.b[1]) / 2], road = mk.roadAt(mid, 8);
      // Across one road at an arm, not a turning path mapped through a junction's middle (Bilderdijkstraat × De
      // Clercqstraat: a cycleway through the node drew red over the junction asphalt).
      if (!road || Math.abs(dot(road.dir, u)) > 0.7) continue;
      if (junctions.some(j => segDist(j.p, run.a, run.b) < CYCLE_CROSS_JUNCTION_M)) continue;
      const n = left(u);
      if (!mk.bar(mk.red, run.a, run.b, width, lift.red, 1.0)) continue;
      st.cycleCrossings++;
      addCrossing(run.a, run.b, width / 2);
      const len = dist(run.a, run.b), pitch = BLOCK.size + BLOCK.gap;
      for (const side of [-1, 1]) {
        const o = (width / 2) * side;
        for (let s = BLOCK.gap / 2; s + BLOCK.size <= len; s += pitch) {
          const a = add(add(run.a, n, o), u, s);
          st.blocks += mk.bar(mk.paint, a, add(a, u, BLOCK.size), BLOCK.size, lift.paint, BLOCK.size * 0.75);
        }
      }
      const kind = marks.find(m => segDist(m.p, run.a, run.b) < 2 && (m.kind === 'zebra' || m.kind === 'blocks'));
      if (kind?.signalised || isSignalCrossing(w.tags)) crossingStops(mid, road);
    }
  }

  // ---- signal, stop and give-way nodes on the road
  for (const m of marks) {
    if (m.kind !== 'signals' && m.kind !== 'stop' && m.kind !== 'giveWay') continue;
    if (!input.ownsPoint(m.p)) continue;
    const road = mk.roadAt(m.p, 2.5);
    if (!road) continue;
    const t = travelAt(m.p, road, m.dir);
    if (!t) continue;
    if (m.kind === 'giveWay') teeth(road.at, t, road); else stopLine(road.at, t, road);
  }

  // ---- junction mouths: give-way teeth on the minor arms of junctions nothing is mapped at
  const signalPts = [...ways.filter(w => isSignalCrossing(w.tags)).flatMap(w => w.points), ...marks.filter(m => m.signalised).map(m => m.p)];
  const ruled = marks.filter(m => m.kind === 'signals' || m.kind === 'stop' || m.kind === 'giveWay').map(m => m.p);
  const mouths: { p: Vec2; r: number }[] = [];
  for (const j of junctions) {
    const signalised = signalPts.some(p => dist(p, j.p) <= SIGNAL_REACH_M);
    const mapped = ruled.some(p => dist(p, j.p) <= NODE_REACH_M);
    let mouthR = 0;
    for (const a of j.arms) {
      const others = j.arms.filter(o => o.way !== a.way || o.sign !== a.sign);
      const major = others.reduce<Arm | null>((best, o) => (rankOf(o.way.tags.highway) > (best ? rankOf(best.way.tags.highway) : -1) ? o : best), null);
      if (!major) continue;
      const mn = left(major.dir), sin = Math.abs(dot(a.dir, mn));
      if (sin < 0.35) continue; // the major road's own continuation
      // The major road's half-width toward the arm, measured beside the mouth (at the node the arm itself continues).
      const side = dot(a.dir, mn) >= 0 ? 1 : -1, toward: Vec2 = [mn[0] * side, mn[1] * side];
      let half = MAX_HALF_M;
      for (const o of [6, -6, 9, -9, 12, -12]) { const q = add(j.p, major.dir, o); if (mk.onCarriage(q[0], q[1])) half = Math.min(half, mk.reach(q, toward)); }
      if (half >= MAX_HALF_M) continue;
      const s = Math.min(20, half / sin + 0.6);
      mouthR = Math.max(mouthR, s);
      if (signalised || mapped || !input.ownsPoint(j.p)) continue;
      const otherBest = Math.max(...others.filter(o => o.way !== a.way).map(o => rankOf(o.way.tags.highway)), -1);
      if (mouthMarking(a.way.tags.highway, otherBest, false) !== 'giveWay') continue;
      const line = armLine(a, s + 2), lst = stations(line);
      if (lst[lst.length - 1] < s) continue;
      const q = pointAt(line, lst, s), road: RoadHit = { way: a.way, dir: unit(sub(pointAt(line, lst, Math.min(lst[lst.length - 1], s + 1)), q)), at: q, d: 0 };
      // The driver comes in toward the node: t = -arm direction. The arm's own way direction decides one-way-ness.
      const wayDir = a.sign === 1 ? road.dir : neg(road.dir);
      teeth(q, neg(road.dir), { ...road, dir: wayDir });
    }
    mouths.push({ p: j.p, r: mouthR || 6 });
  }

  // ---- centre lines on wide two-way carriageways
  const trams = new SegGrid<true>(8);
  for (const w of ways) if (w.tags.railway || w.tags.embedded_rails) for (let i = 0; i + 1 < w.points.length; i++) trams.add(w.points[i], w.points[i + 1], true, 3);
  const nearTram = (p: Vec2) => trams.near(p).some(s => segDist(p, s.a, s.b) < 2.5);
  const quiet = new SegGrid<number>(10);
  for (const m of mouths) quiet.add(m.p, m.p, m.r + CENTRE_CUT_M, m.r + CENTRE_CUT_M);
  for (const l of lineDone) quiet.add(l.p, l.p, 6, 6);
  const quietAt = (p: Vec2) => quiet.near(p).some(q => dist(q.a, p) < q.item) || onCrossing(p, 1.5);
  for (const w of ways) {
    if (!isCarriageWay(w) || !input.ownsWay(w) || oneway(w) !== 0 || rankOf(w.tags.highway) < 1) continue;
    if (w.tags.cyclestreet === 'yes' || w.tags.bicycle_road === 'yes' || w.tags.junction === 'roundabout') continue;
    const wst = stations(w.points), total = wst[wst.length - 1];
    if (total < CENTRE_DASH[0] + 2 * CENTRE_CUT_M) continue;
    // Measured middle every metre (null where narrower than the minimum, or off the carriageway).
    const mids: (Vec2 | null)[] = [];
    for (let s = 0; s <= total; s += 1) {
      const p = pointAt(w.points, wst, s);
      if (!mk.onCarriage(p[0], p[1])) { mids.push(null); continue; }
      const n = left(unit(sub(pointAt(w.points, wst, Math.min(total, s + 0.5)), pointAt(w.points, wst, Math.max(0, s - 0.5)))));
      const a = mk.reach(p, n), b = mk.reach(p, neg(n));
      mids.push(a + b >= CENTRE_MIN_WIDTH_M && a < MAX_HALF_M && b < MAX_HALF_M ? add(p, n, (a - b) / 2) : null);
    }
    // Smoothed over ±2 m (BGT edges step at parking bays and bus stops).
    const smooth = mids.map((m, i) => {
      if (!m) return null;
      const near = mids.slice(Math.max(0, i - 2), i + 3).filter((x): x is Vec2 => !!x);
      return [near.reduce((s, x) => s + x[0], 0) / near.length, near.reduce((s, x) => s + x[1], 0) / near.length] as Vec2;
    });
    const period = CENTRE_DASH[0] + CENTRE_DASH[1];
    for (let s0 = CENTRE_DASH[1] / 2; s0 + CENTRE_DASH[0] <= total; s0 += period) {
      const pts = smooth.slice(Math.round(s0), Math.round(s0 + CENTRE_DASH[0]) + 1);
      if (pts.length < 2 || pts.some(p => !p)) continue;
      const line = pts as Vec2[];
      if (line.some(p => quietAt(p) || nearTram(p))) continue;
      let pieces = 0;
      for (let k = 0; k + 1 < line.length; k++) pieces += mk.bar(mk.paint, line[k], line[k + 1], CENTRE_LINE_M, lift.paint, 0.5);
      if (pieces) st.centreDashes++;
    }
  }
  st.ms = Date.now() - t0;
  return { paint: mk.paint, red: mk.red, stats: st };
}

export const surveyMarkingTriangles = (m: { paint: MeshArrays; red: MeshArrays }) => triangleCount(m.paint) + triangleCount(m.red);
