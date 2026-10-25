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
import { convexOverlap, lineAngle } from './crossingAudit.js';
import { traceMark } from './sourceTrace.js';
import { inRuns, zebraEvidenceAt, type PhotoEvidence } from './photoEvidence.js';
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
/** A crossing node draws a zebra only on a carriageway way it lies on (a vertex of it, within this): the nodes of the
 *  same crossing on the cycle path, the tram track or the footway beside it are not on the road (Magna Plaza: five
 *  nodes of one crossing each drew a zebra on the nearest road, 1.3 m apart and at different angles). */
export const NODE_ON_WAY_M = 0.6;
/** The road's direction at a crossing: the chord of its way over ±ROAD_DIR_HALF_M (a kinked short segment splayed it). */
export const ROAD_DIR_HALF_M = 4;
/** Road axis and walking line disagree by more than this: the carriageway polygon's shortest chord decides. */
export const ROAD_WALK_DEG = 25;
/** A crossing's row across the road: at least / at most (longer: measured without bridging islands, else dropped). */
export const MIN_ROW_M = 2.5;
export const MAX_ROW_M = 22;
/** A stripe drawn shorter than this at a kerb is left out. */
export const STRIPE_MIN_M = 1.0;
/** A zebra stops this far short of a tram way's line it has no marked crossing node on (within TRAM_MARK_M of the crossing). */
export const TRAM_CLEAR_M = 1.5;
export const TRAM_MARK_M = 2.0;
/** A crossing on open junction asphalt (no clear chord) with a row longer than this is a footway mapped through the junction: dropped. */
export const JUNCTION_ROW_M = 12;
/** A crossing node this close to a carriageway junction node lies on the junction, not on an arm (with JUNCTION_ROW_M). */
export const JUNCTION_NODE_M = 5;
/** Two crossings closer than this along the same road, rows overlapping by half: one crossing (planCrossings). */
export const ZEBRA_CLUSTER_M = 8;
/** The carriageway's shortest chord through a crossing is clear when under this share of the chord across it. */
export const CHORD_CLEAR = 0.6;

export interface SurveyMarkingStats { /** Planned crossings the photo moved / dropped (photoEvidence zebras). */ photoMoved?: number; photoDropped?: number; /** Cycleway runs over a carriageway with no crossing node or crossing tag: not marked. */ cycleUnbacked?: number; /** Cycle crossings laid parallel to and beside a zebra (alignCycleCrossing). */ cycleAligned?: number; zebras: number; stripes: number; blockLines: number; cycleCrossings: number; blocks: number; stopLines: number; giveWays: number; teeth: number; centreDashes: number; ms: number }

/**
 * A zebra (or block-line crossing) as drawn: what the crossing audit (crossingAudit.ts) measures. `r` is the stripe
 * direction (along the road), the stripes are laid along n = left(r) from `from` to `to` about `centre`; `stripes`
 * holds the clipped pieces of each stripe (index i of the planned row, the pieces drawn of it).
 */
export interface DrawnCrossing {
  kind: 'zebra' | 'blocks';
  source: 'node' | 'way';
  /** The OSM way id of a crossing way; the node position (local metres) of a crossing node. */
  ref: number | Vec2;
  centre: Vec2;
  r: Vec2;
  from: number;
  to: number;
  stripes: { i: number; pieces: [Vec2, Vec2][] }[];
}

/** A crossing planned before drawing: merged from every node and way that maps it. */
export interface CrossingPlan {
  kind: 'zebra' | 'blocks';
  source: DrawnCrossing['source'];
  ref: DrawnCrossing['ref'];
  centre: Vec2;
  /** Stripe direction: along the carriageway. */
  r: Vec2;
  from: number;
  to: number;
  signalised: boolean;
  road: RoadHit | null;
  owned: boolean;
  /** Members merged into it (OSM nodes and ways of the same crossing). */
  merged: number;
}

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
  /** What the orthophoto shows (photoEvidence.ts): given, centre dashes draw only on a way's listed runs. */
  evidence?: PhotoEvidence;
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

export interface RoadHit { way: LocalWay; dir: Vec2; at: Vec2; d: number }

/** Geometry helpers over the survey: what is carriageway, how far it reaches, clipped bars. */
export class SurveyMarker {
  readonly paint = emptyMesh();
  readonly red = emptyMesh();
  readonly crossings: DrawnCrossing[] = [];
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

  /**
   * On a ground carriageway polygon, exactly (no fast raster): the zebras are planned and clipped with it. A 0.5 m
   * raster beside 0.5 m stripes on a 1 m pitch aliased along an oblique kerb and dropped every other stripe, and two
   * cells' rasters disagree at their edge, so the merge of a crossing's nodes would differ between the cells.
   */
  onCarriageExact = (x: number, y: number): boolean => {
    const ix = this.input.index, k = ix.findAll(x, y).find(j => ix.records[j].h === 0);
    return k !== undefined && ix.drawClass(k) === 'carriage';
  };

  /**
   * Carriageway chord through p along ±d (exact): 0.25 m steps to the edge, then bisected to a centimetre, each side
   * up to `max`. (At 0.25 m the chord across an 8 m road is the same length over ±14°, and the shortest chord's
   * direction wandered that far.)
   */
  chord(p: Vec2, d: Vec2, max = 20): number {
    let len = 0;
    for (const sgn of [1, -1]) {
      const on = (t: number) => this.onCarriageExact(p[0] + d[0] * sgn * t, p[1] + d[1] * sgn * t);
      let lo = 0, hi = -1;
      for (let t = 0.25; t <= max; t += 0.25) { if (!on(t)) { hi = t; break; } lo = t; }
      if (hi < 0) { len += lo; continue; }
      for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (on(m)) lo = m; else hi = m; }
      len += lo;
    }
    return len;
  }

  /** The direction of the shortest carriageway chord through p (6° steps, refined to 1°) and its length; null off the carriageway. */
  shortestChord(p: Vec2): { dir: Vec2; len: number } | null {
    if (!this.onCarriageExact(p[0], p[1])) return null;
    const at = (deg: number, max: number) => this.chord(p, [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)], max);
    let best = { deg: 0, len: Infinity };
    for (let deg = 0; deg < 180; deg += 6) { const len = at(deg, Math.min(20, best.len)); if (len < best.len) best = { deg, len }; }
    const coarse = best.deg;
    for (let deg = coarse - 5; deg <= coarse + 5; deg++) { const len = at(deg, best.len + 0.5); if (len < best.len) best = { deg, len }; }
    return { dir: [Math.cos(best.deg * Math.PI / 180), Math.sin(best.deg * Math.PI / 180)], len: best.len };
  }

  /**
   * One zebra stripe centred on c along r, `len` long, clipped exactly to the carriageway: the run (centre line and
   * both edges on it, 0.1 m steps) through the stripe's middle, else its longest run; null under STRIPE_MIN_M.
   */
  stripe(c: Vec2, r: Vec2, len: number, width: number): [Vec2, Vec2] | null {
    // Edges 5 cm inside the stripe's: a stripe along a kerb a hair closer than its half-width is still on the road.
    const n = left(r), h = width / 2 - 0.05, steps = Math.round(len / 0.1);
    const ok: boolean[] = [];
    for (let i = 0; i <= steps; i++) {
      const p = add(c, r, -len / 2 + (i * len) / steps);
      ok.push(this.onCarriageExact(p[0], p[1]) && this.onCarriageExact(p[0] + n[0] * h, p[1] + n[1] * h) && this.onCarriageExact(p[0] - n[0] * h, p[1] - n[1] * h));
    }
    const runs: [number, number][] = [];
    for (let i = 0, start = -1; i <= steps + 1; i++) {
      if (i <= steps && ok[i]) { if (start < 0) start = i; } else if (start >= 0) { runs.push([start, i - 1]); start = -1; }
    }
    const mid = steps / 2, run = runs.find(([a, b]) => a <= mid && b >= mid) ?? runs.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]))[0];
    if (!run || ((run[1] - run[0]) * len) / steps < STRIPE_MIN_M) return null;
    return [add(c, r, -len / 2 + (run[0] * len) / steps), add(c, r, -len / 2 + (run[1] * len) / steps)];
  }

  /** A bar from a to b of `width`, unclipped. */
  quadBar(m: MeshArrays, a: Vec2, b: Vec2, width: number, lift: number): void {
    const u = unit(sub(b, a)), n = left(u), h = width / 2;
    quad(m, [add(a, n, -h), add(b, n, -h), add(b, n, h), add(a, n, h)], this.input.height, lift);
  }

  /** Distance from p along dir to the carriageway's edge (MAX_HALF_M when it does not end there), 0.25 m steps. */
  reach(p: Vec2, dir: Vec2, max = MAX_HALF_M): number {
    for (let s = 0.25; s <= max; s += 0.25) if (!this.onCarriage(p[0] + dir[0] * s, p[1] + dir[1] * s)) return s - 0.125;
    return max;
  }

  /** Like reach, but on across gaps (traffic islands, a tram platform) up to `gap` metres, within `max`. */
  span(p: Vec2, dir: Vec2, gap = ISLAND_GAP_M, max = 24, on: (x: number, y: number) => boolean = this.onCarriage): number {
    let last = 0, off = 0;
    for (let s = 0.25; s <= max; s += 0.25) {
      if (on(p[0] + dir[0] * s, p[1] + dir[1] * s)) { last = s; off = 0; } else if ((off += 0.25) > gap) break;
    }
    return last;
  }

  /**
   * A bar from a to b of `width`, clipped: drawn over the runs (≥ minRun) where its centre and both edges lie on a
   * carriageway. Returns the number of pieces.
   */
  bar(m: MeshArrays, a: Vec2, b: Vec2, width: number, lift: number, minRun = 0.3, out?: [Vec2, Vec2][]): number {
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
        out?.push([p0, p1]);
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
  runs(pts: readonly Vec2[], min: number, on: (x: number, y: number) => boolean = this.onCarriage): { a: Vec2; b: Vec2; s0: number; s1: number }[] {
    const st = stations(pts), total = st[st.length - 1], out: { a: Vec2; b: Vec2; s0: number; s1: number }[] = [];
    let start = -1;
    const n = Math.max(1, Math.ceil(total / 0.25));
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * total, p = pointAt(pts, st, s), here = on(p[0], p[1]);
      if (here && start < 0) start = s;
      if ((!here || i === n) && start >= 0) {
        const end = here ? s : s - total / n;
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

/** A path someone walks across a road on (not a cycle path: a node on one is a cycle crossing, or the cycleway is the street): its line through a crossing node is the crossing's walking line. */
const isWalkWay = (w: LocalWay) => !isCycleWay(w) && (['footway', 'path', 'pedestrian', 'steps'].includes(w.tags.highway) || isCrossingWay(w));

/** The way's direction at foot point `at`: the chord over ±half metres of it. */
export function wayDirAt(points: readonly Vec2[], at: Vec2, half = ROAD_DIR_HALF_M): Vec2 {
  const st = stations(points);
  let best = Infinity, s = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], d = sub(points[i + 1], a), l2 = dot(d, d);
    const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, dot(sub(at, a), d) / l2)), e = dist(add(a, d, t), at);
    if (e < best) { best = e; s = st[i] + t * Math.sqrt(l2); }
  }
  const total = st[st.length - 1];
  return unit(sub(pointAt(points, st, Math.min(total, s + half)), pointAt(points, st, Math.max(0, s - half))));
}

/**
 * The crossing points a footway strip across the road may hold (RoadIndex.crossingStrips): every zebra / block-line
 * node on a carriageway way (within NODE_ON_WAY_M), with the road's direction there.
 */
export function crossingStripPoints(ways: readonly LocalWay[], marks: readonly RoadMark[]): { p: Vec2; r: Vec2 }[] {
  const grid = new SegGrid<LocalWay>(8), out: { p: Vec2; r: Vec2 }[] = [];
  const pts = marks.filter(m => m.kind === 'zebra' || m.kind === 'blocks');
  if (!pts.length) return out;
  for (const w of ways) if (isCarriageWay(w)) for (let i = 0; i + 1 < w.points.length; i++) grid.add(w.points[i], w.points[i + 1], w, 1);
  for (const m of pts) {
    let best: { w: LocalWay; d: number } | null = null;
    for (const sg of grid.near(m.p)) { const d = segDist(m.p, sg.a, sg.b); if (d <= NODE_ON_WAY_M && (!best || d < best.d)) best = { w: sg.item, d }; }
    if (best) out.push({ p: m.p, r: wayDirAt(best.w.points, m.p) });
  }
  return out;
}

/** The planned footprint of a crossing: ±len/2 along r, [from, to] along n. */
function planFoot(c: Pick<CrossingPlan, 'centre' | 'r' | 'from' | 'to'>): Vec2[] {
  const n = left(c.r), at = (u: number, v: number) => add(add(c.centre, c.r, u), n, v), h = ZEBRA.len / 2;
  return [at(-h, c.from), at(h, c.from), at(h, c.to), at(-h, c.to)];
}

export interface CrossingPlanStats { nodes: number; offRoad: number; onCycle: number; tooLong: number; tooShort: number; inJunction: number; ways: number; merged: number }

/**
 * Every zebra / block-line crossing of the neighbourhood, one per real crossing:
 *   - a crossing node counts only on a carriageway way it lies on (NODE_ON_WAY_M), not on a cycle path (the cycle
 *     crossing pass draws those);
 *   - the stripes run along the road's direction there (its way over ±ROAD_DIR_HALF_M); where the walking line
 *     through the node (a footway, path or crossing way) disagrees with it by more than ROAD_WALK_DEG (a node in a
 *     junction's curve, on a way turning into the next street) the carriageway polygon's shortest chord through the
 *     node chooses the closer of the two;
 *   - the row runs across the carriageway (islands up to ISLAND_GAP_M bridged; without them when that is longer than
 *     MAX_ROW_M; dropped when still longer);
 *   - footway crossing ways on the carriageway plan the same way from their middle;
 *   - candidates are taken nodes first, then ways, in coordinate order (the same in every cell): one whose footprint
 *     overlaps an earlier crossing merges into it (its row extends that crossing's row where they run the same way
 *     and the result stays under MAX_ROW_M), so the several OSM nodes and ways of one crossing draw one zebra.
 * Planned with exact polygon tests, so the two cells at an edge plan the same crossings.
 */
export function planCrossings(mk: SurveyMarker, input: SurveyMarkingInput, onCycle: (p: Vec2) => boolean, stats?: CrossingPlanStats): CrossingPlan[] {
  const { ways, marks } = input, exact = mk.onCarriageExact;
  const st: CrossingPlanStats = stats ?? { nodes: 0, offRoad: 0, onCycle: 0, tooLong: 0, tooShort: 0, inJunction: 0, ways: 0, merged: 0 };
  const walks = new SegGrid<LocalWay>(8);
  const bx = input.box, inBox = (p: Vec2) => !bx || (p[0] >= bx[0] && p[0] <= bx[2] && p[1] >= bx[1] && p[1] <= bx[3]);
  for (const w of ways) if (isWalkWay(w) && !isBridge(w)) for (let i = 0; i + 1 < w.points.length; i++) if (inBox(w.points[i]) || inBox(w.points[i + 1])) walks.add(w.points[i], w.points[i + 1], w, 1);
  const cycles = new SegGrid<LocalWay>(8);
  for (const w of ways) if (isCycleWay(w) && !isBridge(w)) for (let i = 0; i + 1 < w.points.length; i++) if (inBox(w.points[i]) || inBox(w.points[i + 1])) cycles.add(w.points[i], w.points[i + 1], w, 1);
  const cycleAt = (p: Vec2): RoadHit | null => {
    let best: RoadHit | null = null;
    for (const sg of cycles.near(p)) {
      const d = sub(sg.b, sg.a), l2 = dot(d, d);
      if (l2 < 1e-6) continue;
      const t = Math.max(0, Math.min(1, dot(sub(p, sg.a), d) / l2)), c = add(sg.a, d, t), e = dist(c, p);
      if (e <= NODE_ON_WAY_M && (!best || e < best.d)) best = { way: sg.item, dir: unit(d), at: c, d: e };
    }
    return best;
  };
  const walkAt = (p: Vec2): Vec2 | null => {
    let best: { w: LocalWay; d: number } | null = null;
    for (const sg of walks.near(p)) { const d = segDist(p, sg.a, sg.b); if (d <= NODE_ON_WAY_M && (!best || d < best.d)) best = { w: sg.item, d }; }
    return best ? wayDirAt(best.w.points, p, 2) : null;
  };
  const align = (v: Vec2, to: Vec2): Vec2 => (dot(v, to) < 0 ? neg(v) : v);
  /** Stripe direction from the road axis r0 and the walking line (if any) at p. */
  /** Whether the last orient() found a clear carriageway chord (false: open junction asphalt, no road direction). */
  let clear = false;
  const orient = (p: Vec2, r0: Vec2, walk: Vec2 | null): Vec2 => {
    const rw = walk ? align(left(walk), r0) : null;
    const ch = mk.shortestChord(p);
    clear = false;
    if (ch) {
      clear = ch.len < CHORD_CLEAR * mk.chord(p, align(left(ch.dir), r0));
      // Where the carriageway's shortest chord is clear (well under the chord across it), the stripes run along the
      // kerbs it measures: the way's line wanders off the kerbs' direction at a junction's curve and by a few
      // degrees anywhere (the Raadhuisstraat zebras by Magna Plaza tilted 15°).
      const along = align(left(ch.dir), r0);
      if (clear && (lineAngle(along, r0) <= ROAD_WALK_DEG || (rw && lineAngle(along, rw) <= ROAD_WALK_DEG) || !rw)) return along;
      if (rw && lineAngle(rw, r0) > ROAD_WALK_DEG) return lineAngle(rw, along) < lineAngle(r0, along) ? rw : r0;
    }
    return r0;
  };
  // Tram and bus lanes: a zebra runs over a way with embedded rails or a busway only where OSM maps a marked crossing on that way too
  // (each way the footway crosses gets its own crossing node); else it stops TRAM_CLEAR_M short of the way's line
  // (Raadhuisstraat by Magna Plaza: the zebras paint the general lanes, not the tram lanes between them). A node on
  // a cycle path (its cycle crossing) does not count.
  const rails: [Vec2, Vec2][] = [];
  for (const w of ways) if ((w.tags.embedded_rails || w.tags.highway === 'busway') && isCarriageWay(w)) for (let i = 0; i + 1 < w.points.length; i++) if (inBox(w.points[i]) || inBox(w.points[i + 1])) rails.push([w.points[i], w.points[i + 1]]);
  const markedAt = new SegGrid<true>(8);
  for (const m of marks) if ((m.kind === 'zebra' || m.kind === 'blocks') && !onCycle(m.p)) markedAt.add(m.p, m.p, true, TRAM_MARK_M);
  const row = (p: Vec2, r: Vec2): [number, number] | null => {
    const n = left(r);
    let to = mk.span(p, n, ISLAND_GAP_M, 24, exact), from = -mk.span(p, neg(n), ISLAND_GAP_M, 24, exact);
    if (to - from > MAX_ROW_M) { to = mk.span(p, n, 0, 24, exact); from = -mk.span(p, neg(n), 0, 24, exact); }
    let cutTo = false, cutFrom = false;
    for (const [a, b] of rails) {
      // Where the row's line meets the rail: v along n from p.
      const d = sub(b, a), den = n[0] * d[1] - n[1] * d[0];
      if (Math.abs(den) < 1e-9) continue;
      const w0 = sub(a, p), v = (w0[0] * d[1] - w0[1] * d[0]) / den, t = (w0[0] * n[1] - w0[1] * n[0]) / den;
      if (t < 0 || t > 1 || v <= from || v >= to || Math.abs(v) < NODE_ON_WAY_M) continue;
      const x = add(p, n, v);
      if (markedAt.near(x).some(q => dist(q.a, x) <= TRAM_MARK_M)) continue;
      if (v > 0) { to = Math.min(to, v - TRAM_CLEAR_M); cutTo = true; } else { from = Math.max(from, v + TRAM_CLEAR_M); cutFrom = true; }
    }
    // Cut short of a tram or bus lane: and at the first gap before it (the separator between the lanes), not over it.
    if (cutTo) to = Math.min(to, mk.span(p, n, 0, Math.max(0, to), exact));
    if (cutFrom) from = Math.max(from, -mk.span(p, neg(n), 0, Math.max(0, -from), exact));
    if (to - from > MAX_ROW_M) { st.tooLong++; return null; }
    if (to - from < MIN_ROW_M) { st.tooShort++; return null; }
    return [from, to];
  };
  const junctionPts = carriageJunctions(ways.filter(w => w.points.some(inBox))).map(j => j.p);
  /** Within JUNCTION_NODE_M of a carriageway junction node: on the junction itself, not on an arm. */
  const nearJunction = (p: Vec2) => junctionPts.some(q => dist(p, q) <= JUNCTION_NODE_M);
  const cands: (CrossingPlan & { prio: number })[] = [];
  for (const m of marks) {
    if (m.kind !== 'zebra' && m.kind !== 'blocks') continue;
    if (!inBox(m.p)) continue;
    st.nodes++;
    let road = mk.roadAt(m.p, NODE_ON_WAY_M);
    if (onCycle(m.p)) {
      // A cycle path's crossing of a road: the cycle crossing pass draws it (red and blocks). But a cycleway on a
      // carriageway polygon with no road way under the node is the street crossed (Paleisstraat by the Dam, a car-free
      // street mapped highway=cycleway on BGT rijbaan, zebra in the photo).
      const cyc = road || !exact(m.p[0], m.p[1]) ? null : cycleAt(m.p);
      if (!cyc) { st.onCycle++; continue; }
      road = cyc;
    }
    if (!road || !exact(road.at[0], road.at[1])) { st.offRoad++; continue; }
    const r0 = align(wayDirAt(road.way.points, road.at), road.dir), r = orient(road.at, r0, walkAt(m.p));
    const span = row(road.at, r);
    if (!span) continue;
    // A node out on open junction asphalt (no clear chord, or on the junction node) with a long row: a footway mapped
    // through the junction, whose zebra would run diagonally across it (Slotermeer: 20 m over the middle). The arms' stay.
    if ((!clear || nearJunction(road.at)) && span[1] - span[0] > JUNCTION_ROW_M) { st.inJunction++; continue; }
    cands.push({ kind: m.kind, source: 'node', ref: m.p, centre: road.at, r, from: span[0], to: span[1], signalised: m.signalised, road: { ...road, dir: align(r, road.dir) }, owned: input.ownsPoint(m.p), merged: 1, prio: m.kind === 'zebra' ? 0 : 1 });
  }
  for (const w of ways) {
    if (!isCrossingWay(w) || isBridge(w) || isCycleWay(w)) continue;
    const kind = crossingPaint(w.tags);
    if (!kind || !w.points.some(inBox)) continue;
    for (const run of mk.runs(w.points, MIN_ROW_M, exact)) {
      st.ways++;
      const mid: Vec2 = [(run.a[0] + run.b[0]) / 2, (run.a[1] + run.b[1]) / 2], d = unit(sub(run.b, run.a));
      const road = mk.roadAt(mid, 6);
      // A crossing way mapped along the road: stripes across it.
      const r0 = road && Math.abs(dot(road.dir, d)) <= 0.85 ? align(wayDirAt(road.way.points, road.at), road.dir) : left(d);
      const r = orient(mid, r0, d), span = row(mid, r);
      if (!span) continue;
      if (!clear && span[1] - span[0] > JUNCTION_ROW_M) { st.inJunction++; continue; }
      cands.push({ kind, source: 'way', ref: w.id, centre: mid, r, from: span[0], to: span[1], signalised: isSignalCrossing(w.tags), road: road ? { ...road, dir: align(r, road.dir) } : null, owned: input.ownsWay(w), merged: 1, prio: 2 });
    }
  }
  cands.sort((a, b) => a.prio - b.prio || a.centre[0] - b.centre[0] || a.centre[1] - b.centre[1]);
  const out: CrossingPlan[] = [], feet: Vec2[][] = [];
  for (const c of cands) {
    const foot = planFoot(c);
    let k = feet.findIndex(f => convexOverlap(f, foot));
    // A cluster: another crossing within ZEBRA_CLUSTER_M along the same road whose row overlaps this one's is the same
    // crossing mapped twice (a node per carriageway half or per tram track): drawn once (Linnaeusstraat, 2026-10-23).
    if (k < 0) k = out.findIndex(a => {
      if (lineAngle(a.r, c.r) >= 15 || Math.abs(dot(sub(c.centre, a.centre), a.r)) >= ZEBRA_CLUSTER_M) return false;
      const n = left(a.r), v = dot(sub(c.centre, a.centre), n), same = dot(a.r, c.r) >= 0;
      const lo = same ? v + c.from : v - c.to, hi = same ? v + c.to : v - c.from;
      return Math.min(hi, a.to) - Math.max(lo, a.from) >= Math.min(hi - lo, a.to - a.from) * 0.5;
    });
    if (k >= 0) {
      const a = out[k], n = left(a.r);
      if (lineAngle(a.r, c.r) < 15 && Math.abs(dot(sub(c.centre, a.centre), a.r)) < ZEBRA.len) {
        // c's row in a's frame (its r may point the other way along the road).
        const v = dot(sub(c.centre, a.centre), n), same = dot(a.r, c.r) >= 0;
        const lo = Math.min(a.from, same ? v + c.from : v - c.to), hi = Math.max(a.to, same ? v + c.to : v - c.from);
        const grown = planFoot({ ...a, from: lo, to: hi });
        // Extended only while it stays plausible and clear of the other crossings (it would grow over a neighbour).
        if (hi - lo <= MAX_ROW_M && !feet.some((f, j) => j !== k && convexOverlap(f, grown))) { a.from = lo; a.to = hi; feet[k] = grown; }
      }
      a.signalised ||= c.signalised; a.merged++; st.merged++;
      continue;
    }
    const { prio: _prio, ...plan } = c;
    out.push(plan); feet.push(foot);
  }
  return out;
}

/**
 * Planned crossings against the orthophoto (photoEvidence zebras, lane roads-lanes 2026-10-23): moved along the road to
 * where the photo's stripes are, or dropped where it shows none. A crossing with no entry stays as planned.
 */
export function placeByPhoto(plans: CrossingPlan[], ev: PhotoEvidence | undefined, st?: SurveyMarkingStats): CrossingPlan[] {
  if (!ev || !ev.zebras.length) return plans;
  const out: CrossingPlan[] = [];
  for (const c of plans) {
    const e = zebraEvidenceAt(ev, c.centre);
    if (!e) { out.push(c); continue; }
    if (e.du === null) { if (st) st.photoDropped = (st.photoDropped ?? 0) + 1; continue; }
    if (e.du !== 0 && st) st.photoMoved = (st.photoMoved ?? 0) + 1;
    out.push(e.du === 0 ? c : { ...c, centre: add(c.centre, c.r, e.du), road: c.road ? { ...c.road, at: add(c.road.at, c.r, e.du) } : null });
  }
  return out;
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

/** A cycle crossing within this of a zebra's edge (along the road) and running within ALIGN_DEG of its walking line is laid beside it. */
export const ALIGN_REACH_M = 2.5, ALIGN_DEG = 25;
/** The gap between a zebra's edge and the red cycle crossing laid beside it. */
export const ALIGN_GAP_M = 0.3;
/**
 * A red cycle crossing beside a zebra, laid parallel to it and abutting it (issue #52, user 2026-10-24 at Haarlemmerplein:
 * "zebras, red cycle-crossing boxes and stop lines are disjointed fragments not aligned to the lanes"). The cycle path's
 * OSM line and the crossing node's road direction disagree by a few degrees and a metre or two, so the two were drawn
 * as separate skewed pieces; on the orthophoto they are one band across the road, zebra then red. Returns the run
 * moved onto the zebra's frame (its own extent across the road kept), or null when no zebra is that close.
 */
export function alignCycleCrossing(plans: readonly Pick<CrossingPlan, 'kind' | 'centre' | 'r' | 'from' | 'to'>[], a: Vec2, b: Vec2, width: number): [Vec2, Vec2] | null {
  const u = unit(sub(b, a)), mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cos = Math.cos(ALIGN_DEG * Math.PI / 180);
  let best: { p: (typeof plans)[number]; along: number } | null = null;
  for (const p of plans) {
    if (p.kind !== 'zebra') continue;
    const n = left(p.r);
    if (Math.abs(dot(u, n)) < cos) continue;
    const d = sub(mid, p.centre), along = dot(d, p.r), lateral = dot(d, n);
    if (Math.abs(along) > ZEBRA.len / 2 + width / 2 + ALIGN_REACH_M || lateral < p.from - 3 || lateral > p.to + 3) continue;
    if (!best || Math.abs(along) < Math.abs(best.along)) best = { p, along };
  }
  if (!best) return null;
  const { p } = best, n = left(p.r), side = best.along >= 0 ? 1 : -1, off = side * (ZEBRA.len / 2 + ALIGN_GAP_M + width / 2);
  const at = (q: Vec2): Vec2 => add(add(p.centre, p.r, off), n, dot(sub(q, p.centre), n));
  return [at(a), at(b)];
}

export function buildSurveyMarkings(input: SurveyMarkingInput): { paint: MeshArrays; red: MeshArrays; stats: SurveyMarkingStats; crossings: DrawnCrossing[]; plan: CrossingPlanStats } {
  const t0 = Date.now();
  const mk = new SurveyMarker(input), { ways, height, lift, marks } = input, st = mk.stats;
  const junctions = carriageJunctions(ways);
  const nearestJunction = (p: Vec2, r: number) => { let best: JNode | null = null; for (const n of junctions) if (dist(n.p, p) <= r && (!best || dist(n.p, p) < dist(best.p, p))) best = n; return best; };
  /** Zebras and cycle crossings drawn: the centre line, stop lines and teeth keep off them. */
  const crossings = new SegGrid<number>(8);
  const addCrossing = (a: Vec2, b: Vec2, half: number) => crossings.add(a, b, half, half + 4);
  const onCrossing = (p: Vec2, pad: number) => crossings.near(p).some(c => segDist(p, c.a, c.b) < c.item + pad);
  const cycleGrid = new SegGrid<true>(8);
  for (const w of ways) if (isCycleWay(w)) for (const p of w.points) cycleGrid.add(p, p, true, 1);
  /** A crossing node on a cycle path (a vertex within NODE_ON_WAY_M): the cycle crossing pass draws it (red and blocks). */
  const cycleVertexNear = (p: Vec2) => cycleGrid.near(p).some(s => dist(s.a, p) <= NODE_ON_WAY_M);
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

  // ---- zebras (and block lines): one per real crossing, from the crossing nodes and footway crossing ways
  // (crossing audit 2026-10-17, crossingAudit.ts). Every candidate is planned first (where, which way the stripes
  // run, how far across), then candidates whose footprints overlap merge into one crossing, then each is drawn once.
  const zebra = (c: CrossingPlan): boolean => {
    const { centre, r, from, to, kind } = c;
    const n = left(r), a = add(centre, n, from), L = to - from;
    if (L < MIN_ROW_M) return false;
    if (kind === 'zebra') {
      const pitch = ZEBRA.stripe + ZEBRA.gap, count = Math.floor((L + ZEBRA.gap) / pitch), s0 = (L - (count * pitch - ZEBRA.gap)) / 2 + ZEBRA.stripe / 2;
      let drawn = 0;
      const rec: DrawnCrossing = { kind, source: c.source, ref: c.ref, centre, r, from, to, stripes: [] };
      for (let i = 0; i < count; i++) {
        const sc = add(a, n, s0 + i * pitch), piece = mk.stripe(sc, r, ZEBRA.len, ZEBRA.stripe);
        if (!piece) continue;
        mk.quadBar(mk.paint, piece[0], piece[1], ZEBRA.stripe, lift.paint);
        rec.stripes.push({ i, pieces: [piece] });
        drawn++;
      }
      if (drawn) { st.zebras++; st.stripes += drawn; mk.crossings.push(rec); }
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
  const plan: CrossingPlanStats = { nodes: 0, offRoad: 0, onCycle: 0, tooLong: 0, tooShort: 0, inJunction: 0, ways: 0, merged: 0 };
  const plans = placeByPhoto(planCrossings(mk, input, cycleVertexNear, plan), input.evidence, st);
  for (const c of plans) {
    const n = left(c.r);
    addCrossing(add(c.centre, n, c.from), add(c.centre, n, c.to), ZEBRA.len / 2);
  }
  traceMark(mk.paint, 'nodePaint');
  for (const c of plans) {
    if (!c.owned) continue;
    if (zebra(c) && c.signalised && c.road) crossingStops(c.centre, c.road);
  }

  // ---- cycle crossings: red with blocks along both edges, where a cycle path crosses a carriageway
  traceMark(mk.paint, 'nodePaint'); traceMark(mk.red, 'cycleCross');
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
      // Node-backed only (R3, lane roads-lanes 2026-10-23): a crossing node on the run (road-marks-v1), or the way is
      // itself mapped as the crossing. A cycleway merely passing over a carriageway polygon drew red and blocks the
      // photo did not show (Kinkerstraat, De Clercqstraat: 14 % and 38 % red in the photo under them).
      const node = marks.find(m => segDist(m.p, run.a, run.b) < 2 && (m.kind === 'zebra' || m.kind === 'blocks'));
      if (!node && !isCrossingWay(w)) { st.cycleUnbacked = (st.cycleUnbacked ?? 0) + 1; continue; }
      // Beside a zebra: parallel to it and abutting it, when the moved red lies on the carriageway as well.
      const aligned = alignCycleCrossing(plans, run.a, run.b, width);
      let ra = run.a, rb = run.b;
      if (aligned && mk.bar(mk.red, aligned[0], aligned[1], width, lift.red, 1.0)) { [ra, rb] = aligned; st.cycleAligned = (st.cycleAligned ?? 0) + 1; }
      else if (!mk.bar(mk.red, run.a, run.b, width, lift.red, 1.0)) continue;
      const ru = unit(sub(rb, ra)), n = left(ru);
      st.cycleCrossings++;
      addCrossing(ra, rb, width / 2);
      const len = dist(ra, rb), pitch = BLOCK.size + BLOCK.gap;
      for (const side of [-1, 1]) {
        const o = (width / 2) * side;
        for (let s = BLOCK.gap / 2; s + BLOCK.size <= len; s += pitch) {
          const a = add(add(ra, n, o), ru, s);
          st.blocks += mk.bar(mk.paint, a, add(a, ru, BLOCK.size), BLOCK.size, lift.paint, BLOCK.size * 0.75);
        }
      }
      if (node?.signalised || isSignalCrossing(w.tags)) crossingStops(mid, road);
    }
  }

  // ---- signal, stop and give-way nodes on the road
  traceMark(mk.paint, 'nodePaint');
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
  traceMark(mk.paint, 'graphPaint');
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
      // With photo evidence only node-backed marks are drawn (R3, lane roads-lanes 2026-10-23): no teeth the graph infers.
      if (signalised || mapped || !input.ownsPoint(j.p) || input.evidence) continue;
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
  traceMark(mk.paint, input.evidence ? 'photoPaint' : 'graphPaint');
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
    // Only where the orthophoto shows a line along the middle (photoEvidence centre; lane roads-lanes 2026-10-23).
    const shown = input.evidence ? input.evidence.centre.get(w.id) : undefined;
    if (input.evidence && !shown) continue;
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
      if (shown && !inRuns(shown, s0 + CENTRE_DASH[0] / 2)) continue;
      const line = pts as Vec2[];
      if (line.some(p => quietAt(p) || nearTram(p))) continue;
      let pieces = 0;
      for (let k = 0; k + 1 < line.length; k++) pieces += mk.bar(mk.paint, line[k], line[k + 1], CENTRE_LINE_M, lift.paint, 0.5);
      if (pieces) st.centreDashes++;
    }
  }
  st.ms = Date.now() - t0;
  return { paint: mk.paint, red: mk.red, stats: st, crossings: mk.crossings, plan };
}

export const surveyMarkingTriangles = (m: { paint: MeshArrays; red: MeshArrays }) => triangleCount(m.paint) + triangleCount(m.red);
