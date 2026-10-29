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

export interface ThroughStats { drawn: number; skipped: { long: number; bent: number; unbracketed: number }; metres: number }
export const emptyThroughStats = (): ThroughStats => ({ drawn: 0, skipped: { long: 0, bent: 0, unbracketed: 0 }, metres: 0 });

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
export function cycleThrough(m: MeshArrays, ways: readonly LocalWay[], own: (w: LocalWay) => boolean, index: RoadIndex, height: HeightFn): ThroughStats {
  const stats = emptyThroughStats();
  const cycle = ways.filter(isCycleway);
  const ends = new Map<string, LocalWay[]>();
  for (const w of cycle) for (const p of [w.points[0], w.points[w.points.length - 1]]) (ends.get(key(p)) ?? ends.set(key(p), []).get(key(p))!).push(w);
  const cosMax = Math.cos(THROUGH_MAX_TURN_DEG * Math.PI / 180);
  for (const w of cycle) {
    if (!own(w) || w.points.length < 2 || (w.tags.bridge && w.tags.bridge !== 'no') || w.tags.tunnel === 'yes') continue;
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
      const from = m.indices.length;
      ribbon(m, sub(w.points, st, c0, c1), 0, throughWidth(w), height, ROAD_MARK_LIFT.lane, { step: STEP });
      clipToCarriage(m, from, index);
      const onRaised: HeightFn = (x, y) => height(x, y) + raisedLift;
      for (const [a0, a1] of [[s0, c0], [c1, s1]]) {
        if (a1 - a0 < 0.5) continue;
        const at = m.indices.length;
        ribbon(m, sub(w.points, st, a0, a1), 0, throughWidth(w), onRaised, ROAD_MARK_LIFT.lane, { step: STEP });
        clipToCarriage(m, at, index, true);
      }
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
