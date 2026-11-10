// Red through the junction (lane road-look-continuity 2026-10-29, step 4; look over accuracy, as the brief says).
//
// BGT maps the crossing of a fietspad over a side street as rijbaan, so on the survey the red path stops in a notch at
// every junction mouth and the carriageway grey runs through (user, Witte de Withstraat × Van Kinsbergenstraat: "why
// isn't the grey continuous?", the red is not either). In Amsterdam the fietspad's red runs on across the mouth. Where
// an OSM cycleway (highway=cycleway, its crossing ways included) crosses a carriageway polygon for at most
// THROUGH_MAX_M with the fietspad on both sides, and runs straight (THROUGH_MAX_TURN_DEG) across, the run draws a red
// band the cycleway's width at the lane-ribbon lift, clipped to the carriageway polygons. The zebra paint lies above
// it (ROAD_MARK_LIFT.paint over .lane). Pure; the cell build calls it after the street pass.
//
// Not covered: a road way's `cycleway=track` sides (the track is an offset band, not its own way; the separately
// mapped cycleways carry most of the city's fietspad), and a run that spans two ways' carriage (rare at a mouth).
import { pointAt, ribbon, stations, type MeshArrays } from './drape.js';
import type { HeightFn, Vec2 } from './surface.js';
import { SIDEWALK_TOP, type RoadIndex } from './roadSurfaces.js';
import { LIFT, ROAD_MARK_LIFT, type LocalWay } from './streets.js';

/**
 * Longest carriageway run a red band bridges: a side street's mouth with its kerb radii. The brief's 25 m bridged whole
 * junctions: the Bilderdijkstraat fietspad, mapped through the De Clercqstraat junction's centre, drew red over 14 of
 * its 49 interior probes (check-ground-cells JUNCTIONS bilderdijkstraat-de-clercqstraat, asphalt pinned at 0.9).
 */
export const THROUGH_MAX_M = 15;
/** Largest turn between the run's entry and exit directions. */
export const THROUGH_MAX_TURN_DEG = 30;
/** How far either side of the run the fietspad must be met (station class `cycle`). */
export const THROUGH_REACH_M = 4;
/**
 * The fietspad met at either end runs on for this long: a cycle sliver inside the junction (the Bilderdijkstraat
 * fietspad, mapped through the De Clercqstraat junction's centre, meets 2 m strips there) does not bracket a run.
 */
export const THROUGH_SOLID_M = 4;
/** The band's width when the cycleway has no tag or prior: a one-way fietspad. */
export const THROUGH_WIDTH_M = 2.0;
/**
 * Raised mouth pieces a band runs over (round 2, Witte de Withstraat × Van Kinsbergenstraat: the east fietspad meets
 * 3 m of BGT berm, then 11 m of rijbaan, then 3 m of berm; the orthophoto shows the red unbroken across the mouth).
 * At most this long on either side of the carriage run; the band lies on them at the sidewalk top.
 */
export const THROUGH_RAISED_M = 4;
const RAISED = new Set(['berm', 'island']);
const STEP = 1;

export interface ThroughStats { drawn: number; skipped: { long: number; bent: number; unbracketed: number; /** redDedupe: the run lay on the survey's cycle-crossing red. */ owned?: number }; metres: number; /** Runs on bridge ways (bridgeCarry). */ bridges?: number; /** Runs whose width came from the adjoining BGT fietspad (redDedupe). */ bgtWidth?: number }
export const emptyThroughStats = (): ThroughStats => ({ drawn: 0, skipped: { long: 0, bent: 0, unbracketed: 0 }, metres: 0 });

/**
 * Lane R5-C1 (issue #262) options, each off by default (the build before it):
 *   bridges   the red runs on across a bridge way when the way continues (bridgeCarry), on `deckHeight` there;
 *   owned     a run whose triangles lie on the survey's cycle-crossing red for over THROUGH_OWNED_SHARE is not drawn:
 *             one red owner per junction mouth (redDedupe; surveyMarkings' crossing is aligned with the zebra);
 *   bgtWidth  the band's width is the adjoining BGT fietspad's measured width, not the OSM tag or prior (redDedupe).
 */
export interface ThroughOptions { bridges?: boolean; deckHeight?: HeightFn; owned?: (x: number, y: number) => boolean; bgtWidth?: boolean }
/** A run is the survey crossing's when this share of its triangles' centroids lies on that red. */
export const THROUGH_OWNED_SHARE = 0.25;
/** The fietspad's width is read this far out of the run (past the mouth's kerb radius), clamped to a fietspad's range. */
export const BGT_WIDTH_PROBE_M = 1.5, BGT_WIDTH_MIN_M = 1.2, BGT_WIDTH_MAX_M = 4.0;

/**
 * The BGT fietspad's width at `p` across direction `d`: the contiguous `cycle` class through the point's nearest cycle
 * station, sampled every 0.1 m up to 3 m either side. Null when no fietspad lies under or within 1 m of the point.
 */
export function fietspadWidthAt(index: RoadIndex, p: Vec2, d: Vec2, bridge = false): number | null {
  const n: Vec2 = [-d[1], d[0]], at = (t: number) => index.classAt(p[0] + n[0] * t, p[1] + n[1] * t, bridge) === 'cycle';
  let c: number | null = null;
  for (const t of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1]) if (at(t)) { c = t; break; }
  if (c === null) return null;
  let a = c, b = c;
  while (b - c < 3 && at(b + 0.1)) b += 0.1;
  while (c - a < 3 && at(a - 0.1)) a -= 0.1;
  return b - a + 0.1;
}

/** A point test over a mesh's triangles in plan (the survey's cycle-crossing red): 4 m buckets. */
export function meshCover(m: MeshArrays): (x: number, y: number) => boolean {
  const B = 4, grid = new Map<string, number[]>(), p = m.positions, idx = m.indices;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    for (let i = Math.floor(Math.min(p[a], p[b], p[c]) / B); i <= Math.floor(Math.max(p[a], p[b], p[c]) / B); i++)
      for (let j = Math.floor(Math.min(p[a + 1], p[b + 1], p[c + 1]) / B); j <= Math.floor(Math.max(p[a + 1], p[b + 1], p[c + 1]) / B); j++) {
        const k = `${i}:${j}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(t);
      }
  }
  return (x, y) => {
    for (const t of grid.get(`${Math.floor(x / B)}:${Math.floor(y / B)}`) ?? []) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const d = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((p[b + 1] - p[c + 1]) * (x - p[c]) + (p[c] - p[b]) * (y - p[c + 1])) / d, v = ((p[c + 1] - p[a + 1]) * (x - p[c]) + (p[a] - p[c]) * (y - p[c + 1])) / d;
      if (u >= 0 && v >= 0 && u + v <= 1) return true;
    }
    return false;
  };
}

const isCycleway = (w: LocalWay) => w.tags.highway === 'cycleway';
const key = (p: Vec2) => `${Math.round(p[0] * 10)}:${Math.round(p[1] * 10)}`;

/** The cycleway's width: its tag, else its cross-section's first band (the priors), clamped to a fietspad's range. */
export function throughWidth(w: LocalWay): number {
  const tag = parseFloat(w.tags.width ?? '');
  const band = w.section.bands[0]?.width;
  const v = Number.isFinite(tag) && tag > 0 ? tag : band && band > 0 ? band : THROUGH_WIDTH_M;
  return Math.max(1.6, Math.min(3.2, v));
}

/**
 * The class of the surface `reach` metres past an end of `w` (`atStart`: before its first point, along the straightest
 * cycleway continuing from that node; null when none continues within THROUGH_MAX_TURN_DEG or nothing is there).
 */
function beyondEnd(w: LocalWay, atStart: boolean, ends: Map<string, LocalWay[]>, index: RoadIndex, reach: number): boolean {
  const p = atStart ? w.points[0] : w.points[w.points.length - 1], q = atStart ? w.points[1] : w.points[w.points.length - 2];
  const out: Vec2 = norm([p[0] - q[0], p[1] - q[1]]);
  let best: LocalWay | null = null, bestCos = Math.cos(THROUGH_MAX_TURN_DEG * Math.PI / 180), bestFromStart = true;
  for (const o of ends.get(key(p)) ?? []) {
    if (o.id === w.id) continue;
    for (const fromStart of [true, false]) {
      const a = fromStart ? o.points[0] : o.points[o.points.length - 1], b = fromStart ? o.points[1] : o.points[o.points.length - 2];
      if (key(a) !== key(p)) continue;
      const d = norm([b[0] - a[0], b[1] - a[1]]), c = d[0] * out[0] + d[1] * out[1];
      if (c >= bestCos) { bestCos = c; best = o; bestFromStart = fromStart; }
    }
  }
  if (!best) return false;
  const pts = bestFromStart ? best.points : [...best.points].reverse(), st = stations(pts), total = st[st.length - 1];
  for (let s = STEP; s <= Math.min(reach, total); s += STEP) {
    const x = pointAt(pts, st, s);
    if (index.classAt(x[0], x[1]) !== 'cycle') continue;
    for (let j = 1; j < THROUGH_SOLID_M && s + j * STEP <= total; j++) { const q = pointAt(pts, st, s + j * STEP); if (index.classAt(q[0], q[1]) !== 'cycle') return false; }
    return true;
  }
  return false;
}
const norm = (v: Vec2): Vec2 => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };

/**
 * Red bands across the carriageway where the cycleways of `ways` (only those `own` accepts are drawn; all of them link
 * the ends) cross it between two fietspad stretches. Emits into `m` (the cell's `cycle` layer) and returns the stats.
 */
export function cycleThrough(m: MeshArrays, ways: readonly LocalWay[], own: (w: LocalWay) => boolean, index: RoadIndex, height0: HeightFn, opts: ThroughOptions = {}): ThroughStats {
  const stats = emptyThroughStats();
  const cycle = ways.filter(isCycleway);
  const ends = new Map<string, LocalWay[]>();
  for (const w of cycle) for (const p of [w.points[0], w.points[w.points.length - 1]]) (ends.get(key(p)) ?? ends.set(key(p), []).get(key(p))!).push(w);
  const cosMax = Math.cos(THROUGH_MAX_TURN_DEG * Math.PI / 180);
  for (const w of cycle) {
    const onBridge = !!w.tags.bridge && w.tags.bridge !== 'no';
    if (!own(w) || w.points.length < 2 || (onBridge && !opts.bridges) || w.tags.tunnel === 'yes') continue;
    const height = onBridge && opts.deckHeight ? opts.deckHeight : height0;
    const st = stations(w.points), total = st[st.length - 1];
    const n = Math.floor(total / STEP) + 1, cls: (string | null)[] = [];
    for (let i = 0; i < n; i++) { const p = pointAt(w.points, st, Math.min(i * STEP, total)); cls.push(index.classAt(p[0], p[1])); }
    // The fietspad on either side of a run: within THROUGH_REACH_M along the way, or past its end along the
    // continuing cycleway. `from`: the run's boundary station index, `dir` the way out of the run.
    const side = (from: number, dir: 1 | -1): boolean => {
      for (let k = 1; k <= THROUGH_REACH_M; k++) {
        const at = from + dir * k;
        if (at < 0 || at >= n) return beyondEnd(w, at < 0, ends, index, THROUGH_REACH_M - k + 1);
        if (cls[at] === 'cycle') {
          // A fietspad, not a crossing strip inside the junction: THROUGH_SOLID_M of cycle on from there (to the way's end).
          for (let j = 1; j < THROUGH_SOLID_M; j++) { const q = at + dir * j; if (q < 0 || q >= n) break; if (cls[q] !== 'cycle') return false; }
          return true;
        }
        if (cls[at] !== 'carriage' && cls[at] !== 'parking' && cls[at] !== null && !RAISED.has(cls[at]!)) return false;
      }
      return false;
    };
    for (let i = 0; i < n;) {
      if (cls[i] !== 'carriage') { i++; continue; }
      let i0 = i;
      let j = i; while (j + 1 < n && cls[j + 1] === 'carriage') j++;
      i = j + 1;
      const carriageLen = Math.min(total, (j + 0.5) * STEP) - Math.max(0, (i0 - 0.5) * STEP);
      if (carriageLen < 1.5) continue;
      if (carriageLen > THROUGH_MAX_M) { stats.skipped.long++; continue; }
      // The raised mouth pieces either side, when the fietspad lies past them.
      const raisedOut = (from: number, dir: 1 | -1): number => {
        let k = 0; while (k < THROUGH_RAISED_M && from + dir * (k + 1) >= 0 && from + dir * (k + 1) < n && RAISED.has(cls[from + dir * (k + 1)] ?? '')) k++;
        const next = from + dir * (k + 1);
        return k > 0 && next >= 0 && next < n && cls[next] === 'cycle' ? k : 0;
      };
      const before = raisedOut(i0, -1), after = raisedOut(j, 1);
      i0 -= before; j += after;
      const s0 = Math.max(0, (i0 - 0.5) * STEP), s1 = Math.min(total, (j + 0.5) * STEP), len = s1 - s0;
      // Straight across: the directions a metre into the run at either end.
      const a0 = pointAt(w.points, st, s0), a1 = pointAt(w.points, st, Math.min(s1, s0 + 1)), b0 = pointAt(w.points, st, Math.max(s0, s1 - 1)), b1 = pointAt(w.points, st, s1);
      const da = norm([a1[0] - a0[0], a1[1] - a0[1]]), db = norm([b1[0] - b0[0], b1[1] - b0[1]]);
      if (da[0] * db[0] + da[1] * db[1] < cosMax) { stats.skipped.bent++; continue; }
      if (!side(i0, -1) || !side(j, 1)) { stats.skipped.unbracketed++; continue; }
      // The carriage stretch at the lane lift, the raised mouth pieces either side at the sidewalk top.
      const c0 = Math.max(0, (i0 + before - 0.5) * STEP), c1 = Math.min(total, (j - after + 0.5) * STEP), raisedLift = SIDEWALK_TOP - LIFT.carriageway;
      const from = m.indices.length, fromPos = m.positions.length;
      // redDedupe: the adjoining fietspad's measured width (the narrower of the two ends), else the tag or prior.
      let width = throughWidth(w);
      if (opts.bgtWidth) {
        const ends: number[] = [];
        for (const [s, dir] of [[s0 - BGT_WIDTH_PROBE_M, 1], [s1 + BGT_WIDTH_PROBE_M, 1]] as const) {
          if (s < 0 || s > total) continue;
          const q = pointAt(w.points, st, s), q2 = pointAt(w.points, st, Math.min(total, Math.max(0, s + dir)));
          const dd = norm([q2[0] - q[0], q2[1] - q[1]]), v = fietspadWidthAt(index, q, dd, onBridge);
          if (v !== null) ends.push(v);
        }
        if (ends.length) { width = Math.max(BGT_WIDTH_MIN_M, Math.min(BGT_WIDTH_MAX_M, Math.min(...ends))); stats.bgtWidth = (stats.bgtWidth ?? 0) + 1; }
      }
      ribbon(m, sub(w.points, st, c0, c1), 0, width, height, ROAD_MARK_LIFT.lane, { step: STEP });
      clipToCarriage(m, from, index);
      const onRaised: HeightFn = (x, y) => height(x, y) + raisedLift;
      for (const [a0, a1] of [[s0, c0], [c1, s1]]) {
        if (a1 - a0 < 0.5) continue;
        const at = m.indices.length;
        ribbon(m, sub(w.points, st, a0, a1), 0, width, onRaised, ROAD_MARK_LIFT.lane, { step: STEP });
        clipToCarriage(m, at, index, true);
      }
      // redDedupe: one red owner per mouth. The survey's cycle crossing (surveyMarkings) is laid beside the zebra with
      // its blocks; where it already covers the run, the ribbon is not drawn over it a second time.
      if (opts.owned && m.indices.length > from) {
        let on = 0, n = 0;
        const p = m.positions, idx = m.indices;
        for (let t = from; t < idx.length; t += 3) {
          const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
          n++; if (opts.owned((p[A] + p[B] + p[C]) / 3, (p[A + 1] + p[B + 1] + p[C + 1]) / 3)) on++;
        }
        if (on >= THROUGH_OWNED_SHARE * n) { idx.length = from; p.length = fromPos; m.uvs.length = fromPos / 3 * 2; if (m.colors) m.colors.length = fromPos; stats.skipped.owned = (stats.skipped.owned ?? 0) + 1; continue; }
      }
      if (onBridge) stats.bridges = (stats.bridges ?? 0) + 1;
      stats.drawn++; stats.metres += len;
    }
  }
  return stats;
}

/** The part of a polyline between stations s0 and s1. */
function sub(pts: readonly Vec2[], st: readonly number[], s0: number, s1: number): Vec2[] {
  const out: Vec2[] = [pointAt(pts, st, s0)];
  for (let i = 1; i < pts.length - 1; i++) if (st[i] > s0 && st[i] < s1) out.push([pts[i][0], pts[i][1]]);
  out.push(pointAt(pts, st, s1));
  return out;
}

/** Drop the band's triangles (from `from`) whose centroid is off the carriageway polygons. */
function clipToCarriage(m: MeshArrays, from: number, index: RoadIndex, raised = false): void {
  const idx = m.indices, p = m.positions;
  let w = from;
  for (let t = from; t < idx.length; t += 3) {
    const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
    const c = index.classAt((p[A] + p[B] + p[C]) / 3, (p[A + 1] + p[B + 1] + p[C + 1]) / 3);
    if (c !== 'carriage' && !(raised && RAISED.has(c ?? ''))) continue;
    if (w !== t) { idx[w] = idx[t]; idx[w + 1] = idx[t + 1]; idx[w + 2] = idx[t + 2]; }
    w += 3;
  }
  idx.length = w;
}
