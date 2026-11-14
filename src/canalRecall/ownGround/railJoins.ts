// City-wide rail join check (pure; scripts/own-ground/check-rail-joins.ts, railJoins.test.ts). Lane R2-A 2026-11-13.
//
// Player notes bc28e25e ("rails don't connect to bridges", the tram decks on the Cornelis Lelylaan viaduct over the
// Ringweg-West) and 3997ffb6 ("I thought we fixed rails & overpasses everywhere? do we need a bigger regression
// check?", the Haarlem line's viaduct over the Zaanstraat) were both at places no named pin covered: the earlier rail
// lanes pinned 14 hand-picked spots and railRegressions.deckBreaks measured about 12 of the 922 bridge ways (no trams).
// This module finds every place a bridge bed must meet something, from rail-v1 alone, so the check covers the city:
//
//   join      a bridge way's end that meets a track off the bridges (a shared point, or within SNAP_M): the bed is
//             sampled every SAMPLE_M over JOIN_REACH_M either side (along the ground track away from the join, along
//             the bridge track into it, continuing onto the next way where one is shorter). It fails on a sample with
//             no ballast (a gap), a step between neighbours over STEP_MAX_M, or a slope over SLOPE_FACTOR × RAIL_GRADE
//             over SLOPE_WINDOW_M.
//   free      a bridge way's end that meets no other track: the bed must meet land (any ground or road surface within
//             FREE_LAND_M of the end at the bed's floor, within FREE_TOL_M) or another bed.
//   crossing  an OSM highway crossing a rail way in plan where one of the two is a bridge: the upper one's top stands at
//             least CLEAR_MIN_M over the lower one's (road deck over the ballast, or ballast over the road).
//
// The script builds the production cells and samples them; this module holds the geometry and the verdicts.

import { RAIL_GRADE, SNAP_M } from './railProfile.js';
import type { RailKind, RailWay } from './railTracks.js';
import type { Vec2 } from './surface.js';

/** Sample spacing along a join, metres. */
export const SAMPLE_M = 0.5;
/** Reach either side of a join, metres. */
export const JOIN_REACH_M = 8;
/** Largest step between neighbouring samples, metres. */
export const STEP_MAX_M = 0.15;
/** Steepest slope allowed, as a multiple of the kind's RAIL_GRADE (measured over SLOPE_WINDOW_M). */
export const SLOPE_FACTOR = 1.5;
export const SLOPE_WINDOW_M = 2;
/** A free end meets land within this distance (metres) at the bed's floor within FREE_TOL_M. */
export const FREE_LAND_M = 3, FREE_TOL_M = 0.6;
/** The upper of a road and a rail bed crossing on different levels stands at least this far over the lower, metres. */
export const CLEAR_MIN_M = 3;
/** Continuity: a ballast sample more than this from the previous one belongs to another bed (a track over or under). */
export const TRACK_JUMP_M = 1.2;

export type JoinClass = 'join' | 'free' | 'crossing';

export interface JoinSite {
  /** Stable id: class, kind and the join point in decimetres (game frame). */
  id: string;
  cls: 'join' | 'free';
  kind: RailKind;
  at: Vec2;
  /** Sample points along the path, every SAMPLE_M; `join` is the index of the join point. */
  path: Vec2[];
  join: number;
  /** Bridge dead end snapped to a track off the bridges (OSM split gap), metres; 0 when they share a point. */
  gap: number;
}

const key = (p: Vec2) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
const len = (a: Vec2, b: Vec2) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A way's identity (the same way decoded from two cells is one). */
export const wayId = (w: RailWay): string => `${w.kind}${w.bridge ? 'b' : ''}:${w.points.map(key).join(';')}`;

/** Unique ways of a list (cells list a way in every cell it passes through). */
export function uniqueWays(ways: readonly RailWay[]): RailWay[] {
  const seen = new Set<string>(), out: RailWay[] = [];
  for (const w of ways) { const k = wayId(w); if (!seen.has(k)) { seen.add(k); out.push(w); } }
  return out;
}

interface VertexRef { way: number; i: number }

/** Index of every way vertex by its decimetre key. */
function vertexIndex(ways: readonly RailWay[]): Map<string, VertexRef[]> {
  const m = new Map<string, VertexRef[]>();
  ways.forEach((w, way) => w.points.forEach((p, i) => { const k = key(p); (m.get(k) ?? m.set(k, []).get(k)!).push({ way, i }); }));
  return m;
}

/**
 * Walk `dist` metres from vertex `i` of way `way` in direction `dir` (+1 / −1 along its points), continuing at the
 * way's end onto the connected way that runs on straightest (any kind, bridge or not). The returned polyline starts
 * at the start vertex.
 */
export function walkFrom(ways: readonly RailWay[], index: Map<string, VertexRef[]>, way: number, i: number, dir: 1 | -1, dist: number): Vec2[] {
  const out: Vec2[] = [ways[way].points[i]];
  let left = dist, w = way, j = i, d = dir;
  const visited = new Set<number>([way]);
  for (let guard = 0; guard < 64 && left > 1e-6; guard++) {
    const pts = ways[w].points;
    while (left > 1e-6 && j + d >= 0 && j + d < pts.length) {
      const a = pts[j], b = pts[j + d], l = len(a, b);
      if (l >= left) { const f = left / l; out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); left = 0; break; }
      out.push(b); left -= l; j += d;
    }
    if (left <= 1e-6) break;
    // At the way's end: the connected way running on straightest.
    const end = pts[j], prev = pts[j - d], hx = end[0] - prev[0], hy = end[1] - prev[1], hl = Math.hypot(hx, hy) || 1;
    let best: { way: number; i: number; dir: 1 | -1; cos: number } | null = null;
    for (const r of index.get(key(end)) ?? []) {
      if (visited.has(r.way)) continue;
      const q = ways[r.way].points;
      for (const nd of [1, -1] as const) {
        const n = q[r.i + nd];
        if (!n) continue;
        const nx = n[0] - end[0], ny = n[1] - end[1], cos = (nx * hx + ny * hy) / ((Math.hypot(nx, ny) || 1) * hl);
        if (cos > 0.5 && (!best || cos > best.cos)) best = { way: r.way, i: r.i, dir: nd, cos };
      }
    }
    if (!best) break;
    visited.add(best.way); w = best.way; j = best.i; d = best.dir;
  }
  return out;
}

/** Points every `step` metres along a polyline (its first point first; the last only when it falls on a step). */
export function resample(pts: readonly Vec2[], step: number): Vec2[] {
  const out: Vec2[] = [pts[0]];
  let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], l = len(a, b);
    let t = step - carry;
    while (t <= l + 1e-9) { out.push([a[0] + (b[0] - a[0]) * t / (l || 1), a[1] + (b[1] - a[1]) * t / (l || 1)]); t += step; }
    carry = l - (t - step);
  }
  return out;
}

/** Nearest point on segment ab to p, and its parameter. */
function project(p: Vec2, a: Vec2, b: Vec2): { q: Vec2; t: number; d: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  const q: Vec2 = [a[0] + dx * t, a[1] + dy * t];
  return { q, t, d: len(p, q) };
}

/**
 * Every bridge-to-ground join and every free bridge end of `ways` (deduplicated). `inside` keeps the sites whose
 * join point it accepts (a cell's own, so cells partition the city).
 */
export function joinSites(ways: readonly RailWay[], inside: (p: Vec2) => boolean = () => true): JoinSite[] {
  const index = vertexIndex(ways), out: JoinSite[] = [], seen = new Set<string>();
  const half = Math.round(JOIN_REACH_M / SAMPLE_M);
  ways.forEach((w, wi) => {
    if (!w.bridge) return;
    for (const end of [0, w.points.length - 1]) {
      const p = w.points[end];
      if (!inside(p)) continue;
      const into: 1 | -1 = end === 0 ? 1 : -1;
      const bridgeSide = walkFrom(ways, index, wi, end, into, JOIN_REACH_M);
      const refs = (index.get(key(p)) ?? []).filter(r => r.way !== wi);
      // Ground tracks meeting this end; the straightest continuation away from the bridge.
      const hx = p[0] - w.points[end + into][0], hy = p[1] - w.points[end + into][1], hl = Math.hypot(hx, hy) || 1;
      let best: { way: number; i: number; dir: 1 | -1; cos: number } | null = null;
      for (const r of refs) {
        if (ways[r.way].bridge) continue;
        const q = ways[r.way].points;
        for (const nd of [1, -1] as const) {
          const n = q[r.i + nd];
          if (!n) continue;
          const cos = ((n[0] - p[0]) * hx + (n[1] - p[1]) * hy) / ((Math.hypot(n[0] - p[0], n[1] - p[1]) || 1) * hl);
          if (!best || cos > best.cos) best = { way: r.way, i: r.i, dir: nd, cos };
        }
      }
      let groundSide: Vec2[] | null = null, gap = 0;
      if (best) groundSide = walkFrom(ways, index, best.way, best.i, best.dir, JOIN_REACH_M);
      else if (!refs.length) {
        // A dead end: the nearest track off the bridges within SNAP_M (railProfile joins it).
        let snap: { way: number; seg: number; q: Vec2; d: number } | null = null;
        ways.forEach((g, gi) => {
          if (g.bridge || gi === wi) return;
          for (let s = 0; s + 1 < g.points.length; s++) { const r = project(p, g.points[s], g.points[s + 1]); if (r.d < SNAP_M && (!snap || r.d < snap.d)) snap = { way: gi, seg: s, q: r.q, d: r.d }; }
        });
        if (snap) {
          const s = snap as { way: number; seg: number; q: Vec2; d: number }, g = ways[s.way].points;
          // Away from the bridge: the segment direction that runs on from the bridge's heading.
          const fwd = (g[s.seg + 1][0] - g[s.seg][0]) * hx + (g[s.seg + 1][1] - g[s.seg][1]) * hy >= 0;
          const tail = fwd ? walkFrom(ways, index, s.way, s.seg + 1, 1, JOIN_REACH_M) : walkFrom(ways, index, s.way, s.seg, -1, JOIN_REACH_M);
          groundSide = [s.q, ...tail];
          gap = s.d;
        }
      }
      if (groundSide) {
        const id = `join:${w.kind}:${key(p)}:${key(groundSide[Math.min(1, groundSide.length - 1)])}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const g = resample(groundSide, SAMPLE_M).slice(0, half + 1).reverse(), b = resample(gap ? [p, ...bridgeSide] : bridgeSide, SAMPLE_M).slice(0, half + 1);
        // gap: the join point is the ground track's snapped point, then the bridge's end.
        const path = [...g, ...(gap ? b : b.slice(1))];
        out.push({ id, cls: 'join', kind: w.kind, at: p, path, join: g.length - 1, gap: +gap.toFixed(2) });
      } else if (!refs.length) {
        const id = `free:${w.kind}:${key(p)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ id, cls: 'free', kind: w.kind, at: p, path: resample(bridgeSide, SAMPLE_M).slice(0, half + 1), join: 0, gap: 0 });
      }
    }
  });
  return out;
}

/** The bed tops (ballast) at a point, any order; empty: no bed drawn there. */
export type BedSampler = (x: number, y: number) => number[];

export interface JoinMeasure { zs: number[]; missing: number; maxStep: number; maxSlope: number; /** Where (index into path) the worst step is. */ stepAt: number }

/**
 * The bed along a join path: from the join point outward each way, the ballast top nearest the previous sample (a
 * bed over or under it belongs to another track). At the join point itself the topmost.
 */
export function measureJoin(path: readonly Vec2[], join: number, bed: BedSampler): JoinMeasure {
  const zs = new Array<number>(path.length).fill(NaN);
  const pick = (i: number, prev: number) => {
    const c = bed(path[i][0], path[i][1]);
    if (!c.length) return NaN;
    if (!Number.isFinite(prev)) return Math.max(...c);
    let best = NaN;
    for (const z of c) if (Number.isNaN(best) || Math.abs(z - prev) < Math.abs(best - prev)) best = z;
    return best;
  };
  zs[join] = pick(join, NaN);
  for (let i = join + 1, prev = zs[join]; i < path.length; i++) { zs[i] = pick(i, prev); if (Number.isFinite(zs[i])) prev = zs[i]; }
  for (let i = join - 1, prev = zs[join]; i >= 0; i--) { zs[i] = pick(i, prev); if (Number.isFinite(zs[i])) prev = zs[i]; }
  let missing = 0, maxStep = 0, maxSlope = 0, stepAt = -1;
  const w = Math.max(1, Math.round(SLOPE_WINDOW_M / SAMPLE_M));
  for (let i = 0; i < zs.length; i++) {
    if (!Number.isFinite(zs[i])) { missing++; continue; }
    if (i > 0 && Number.isFinite(zs[i - 1])) { const s = Math.abs(zs[i] - zs[i - 1]); if (s > maxStep) { maxStep = s; stepAt = i; } }
    if (i >= w && Number.isFinite(zs[i - w])) { const run = len(path[i], path[i - w]) || SAMPLE_M * w; maxSlope = Math.max(maxSlope, Math.abs(zs[i] - zs[i - w]) / run); }
  }
  return { zs, missing, maxStep: +maxStep.toFixed(3), maxSlope: +maxSlope.toFixed(3), stepAt };
}

export interface JoinFailure { id: string; cls: JoinClass; kind: RailKind | string; at: Vec2; reasons: string[]; /** Ranking: the worst excess. */ score: number; detail?: Record<string, number | string> }

/** The verdict for a join: why it fails (empty: it passes). */
export function judgeJoin(site: JoinSite, m: JoinMeasure): JoinFailure | null {
  const reasons: string[] = [], cap = SLOPE_FACTOR * RAIL_GRADE[site.kind];
  let score = 0;
  if (m.missing) { reasons.push(`${m.missing} samples without ballast`); score = Math.max(score, m.missing * SAMPLE_M); }
  if (m.maxStep > STEP_MAX_M) { reasons.push(`step ${m.maxStep.toFixed(2)} m`); score = Math.max(score, m.maxStep); }
  if (m.maxSlope > cap) { reasons.push(`slope ${m.maxSlope.toFixed(3)} > ${cap.toFixed(3)}`); score = Math.max(score, (m.maxSlope - cap) * JOIN_REACH_M); }
  return reasons.length ? { id: site.id, cls: 'join', kind: site.kind, at: site.at, reasons, score: +score.toFixed(2), detail: { gap: site.gap, maxStep: m.maxStep, maxSlope: m.maxSlope, missing: m.missing } } : null;
}

/** Surfaces at a point: z of every non-rail ground or road surface (land, streets, road decks, quays). */
export type LandSampler = (x: number, y: number) => number[];

/**
 * A free end: the bed's floor at the end meets land (within FREE_TOL_M) somewhere within FREE_LAND_M of it, or
 * another bed (a track the profile snapped). `bedEnd`: the ballast top at the end (NaN: none), `topLift` the bed's
 * height over its floor.
 */
export function judgeFree(site: JoinSite, bedTop: number, topLift: number, land: LandSampler, bed: BedSampler): JoinFailure | null {
  if (!Number.isFinite(bedTop)) return { id: site.id, cls: 'free', kind: site.kind, at: site.at, reasons: ['no ballast at the end'], score: 1 };
  const floor = bedTop - topLift, [x, y] = site.at;
  // Directions: around the end, every 45 degrees, at 0.5 m steps.
  let nearest = Infinity;
  for (let r = 0; r <= FREE_LAND_M + 1e-9; r += 0.5) for (let a = 0; a < (r ? 8 : 1); a++) {
    const px = x + r * Math.cos(a * Math.PI / 4), py = y + r * Math.sin(a * Math.PI / 4);
    for (const z of land(px, py)) nearest = Math.min(nearest, Math.abs(z - floor));
    if (r > 0) for (const z of bed(px, py)) nearest = Math.min(nearest, Math.abs(z - bedTop));
  }
  if (nearest <= FREE_TOL_M) return null;
  return { id: site.id, cls: 'free', kind: site.kind, at: site.at, reasons: [Number.isFinite(nearest) ? `floats ${nearest.toFixed(2)} m off the nearest land` : 'no land near the end'], score: +(Number.isFinite(nearest) ? nearest : 10).toFixed(2), detail: { bedTop: +bedTop.toFixed(2) } };
}

/** A road crossing a rail way in plan. */
export interface RoadLine { id: string; highway: string; bridge: boolean; tunnel: boolean; layer: number; name?: string; points: Vec2[] }
export interface RailRoadCrossing { id: string; at: Vec2; rail: RailWay; road: RoadLine; /** Which one is meant to be on top. */ upper: 'road' | 'rail' }

/** Highways the crossing check skips: no surface drawn (steps, corridors, planned, under construction). */
export const CROSSING_SKIP_HIGHWAYS: ReadonlySet<string> = new Set(['steps', 'corridor', 'elevator', 'proposed', 'construction', 'platform', 'bus_stop', 'raceway', 'escape']);

function segX(a: Vec2, b: Vec2, c: Vec2, d: Vec2): Vec2 | null {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
}

/**
 * Plan crossings of roads and rail ways on different levels: a road bridge over a track off the bridges (or a road on
 * layer ≥ 2 over a rail bridge), a rail bridge over a road off the bridges (or a road tunnel under a track). Level
 * crossings (neither on a bridge) are left out; so is a road and a rail bridge on unknown relative layers.
 */
export function railRoadCrossings(rails: readonly RailWay[], roads: readonly RoadLine[], inside: (p: Vec2) => boolean = () => true): RailRoadCrossing[] {
  const out: RailRoadCrossing[] = [], seen = new Set<string>();
  for (const road of roads) {
    if (CROSSING_SKIP_HIGHWAYS.has(road.highway)) continue;
    for (const rail of rails) {
      let upper: 'road' | 'rail' | null = null;
      if (road.bridge && !rail.bridge) upper = 'road';
      else if (road.bridge && rail.bridge) upper = road.layer >= 2 ? 'road' : null;
      else if (!road.bridge && rail.bridge) upper = road.layer >= 1 ? null : 'rail';
      else if (road.tunnel) upper = 'rail';
      if (!upper) continue;
      for (let i = 0; i + 1 < road.points.length; i++) for (let j = 0; j + 1 < rail.points.length; j++) {
        const x = segX(road.points[i], road.points[i + 1], rail.points[j], rail.points[j + 1]);
        if (!x || !inside(x)) continue;
        const id = `crossing:${upper}:${rail.kind}:${key(x)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ id, at: x, rail, road, upper });
      }
    }
  }
  return out;
}

/**
 * A crossing's verdict: the upper surface at least CLEAR_MIN_M over the lower one. `bed`: ballast tops at the point,
 * `road`: road surface tops (carriageways, cycle tracks, footways, road decks), `relief`: the land when the lower road
 * draws no surface.
 */
export function judgeCrossing(c: RailRoadCrossing, bed: number[], road: number[], relief: number): JoinFailure | null {
  const base = { id: c.id, cls: 'crossing' as const, kind: c.rail.kind, at: c.at };
  const detail: Record<string, string | number> = { road: c.road.name ?? c.road.highway, upper: c.upper };
  if (!bed.length) return { ...base, reasons: ['no ballast at the crossing'], score: CLEAR_MIN_M, detail };
  if (c.upper === 'road') {
    const lower = Math.min(...bed), top = road.length ? Math.max(...road) : -Infinity, clear = top - lower;
    detail.clear = Number.isFinite(clear) ? +clear.toFixed(2) : 'no road surface';
    return clear >= CLEAR_MIN_M ? null : { ...base, reasons: [Number.isFinite(clear) ? `road deck ${clear.toFixed(2)} m over the ballast` : 'no road deck over the track'], score: +(CLEAR_MIN_M - (Number.isFinite(clear) ? clear : 0)).toFixed(2), detail };
  }
  const upper = Math.max(...bed), lower = road.length ? Math.min(...road) : relief, clear = upper - lower;
  detail.clear = +clear.toFixed(2);
  return clear >= CLEAR_MIN_M ? null : { ...base, reasons: [`ballast ${clear.toFixed(2)} m over the road`], score: +(CLEAR_MIN_M - clear).toFixed(2), detail };
}

/** The allow-list ratchet: ids allowed to fail; the list may only shrink. */
export interface RailJoinAllow { id: string; reason: string }
export function ratchet(failures: readonly JoinFailure[], allow: readonly RailJoinAllow[]): { fresh: JoinFailure[]; fixed: string[] } {
  const ids = new Set(failures.map(f => f.id)), allowed = new Set(allow.map(a => a.id));
  return { fresh: failures.filter(f => !allowed.has(f.id)), fixed: allow.filter(a => !ids.has(a.id)).map(a => a.id) };
}
