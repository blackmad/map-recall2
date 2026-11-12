// Untagged rail viaducts over streets (lane rails-classb 2026-11-10, rails class b; feedback 2026-11-09 #10 Sloterdijkerweg,
// #13 Kimpoweg, #16 Radarweg). Pure, dependency-free: groundCell.ts → railTracks.ts railMeshes `spans`.
//
// OSM tags the tram and rail viaduct decks over many Westpoort streets as plain track (no bridge=*): the approach and
// the deck are one way. railProfile.ts levels such a way on the relief's envelope at its grade, so its bed rides over
// the street's dip at the embankments' height, and railMeshes drew it as a raised track: a slab reaching down into the
// ground on both sides (a wall across the street) or the ballast's toes sloping to the road (a mound). Here a piece of
// such a track is a deck span where a street passes under it:
//
//   trigger  a street centreline (at grade: not a bridge, not a tunnel) crosses the track, and the street on both sides
//            of the bed, just outside the deck's footprint, lies at least SPAN_HEADROOM_M (was SPAN_CLEAR_M) under the bed's floor (the
//            median of ROAD_SAMPLES samples per side, so one AHN outlier neither makes nor breaks a span), and the
//            street does not climb towards the track on either side (ROAD_CLIMB_M: a path up an embankment to a level
//            crossing on a dike drops away from the bed too, but it rises to meet it).
//   extent   from the street's strip (its half width over the crossing angle, plus SPAN_MARGIN_M) the span runs on
//            along the track while the land across the bed stays more than SPAN_LAND_M under the floor (hysteresis:
//            SPAN_CLEAR_M to start, SPAN_LAND_M to continue), at most SPAN_REACH_M each side: the deck lands where the
//            approach's fill meets it, so its end is an abutment, not a step.
//   skip     a street the track runs along (it lies in it: an embedded tram, `embedded` here, or the track within the
//            street's strip for ALONG_EXTRA_M more than a crossing would take: the Frans de Wollantstraat tram at the
//            Piet Heinkade, whose bed the profile lifts 1.9 m over its own street), a crossing in a tunnel cut's box (its floor is measured, the track is in the trench), a track on a
//            bridge way (it is a deck already), a street crossing at a shallow angle (< MIN_ANGLE_DEG: a street
//            beside the track, not under it).
//
// Spans of one way that overlap or lie within SPAN_JOIN_M merge (one deck over a junction's two carriageways).

import type { HeightFn, Vec2 } from './surface.js';

/** A street at grade: its centreline and half width (railBridge.ts streetHalfWidth). */
export interface SpanStreet { points: readonly Vec2[]; half: number; /** The track lies in it (OSM embedded_rails): never under it. */ embedded?: boolean }
/** A track as the span rule sees it: its points and whether it is a bridge way. */
export interface SpanTrack { bridge: boolean; points: readonly Vec2[] }
/** One span along a way: distances from its first point, metres, and the street clearance that triggered it. */
export interface RailSpan { s0: number; s1: number; clear: number; at: Vec2 }

/** The street lies at least this far under the bed's floor on both sides to start a span, metres. */
export const SPAN_CLEAR_M = 1.0;
/**
 * A span is a deck a rider passes under: the bed's floor at least this far over the street (the slab's 1.1 m plus a
 * cyclist's 2.5 m), metres (lane rails-uncover 2026-11-10, user report on build 93440cb27 at the Piet Kranenbergpad,
 * 4.85323,52.33879: "worse", torn ground under a 73 m deck whose soffit stood 0.2-0.5 m over the path). Under that the
 * clearance is the profile's grade, not a viaduct (the Kranenbergpad siding runs at the path's level beside it, PDOK
 * orthophoto): the track meets the street at a level crossing (railTracks.ts crossing ramps) instead.
 */
export const SPAN_HEADROOM_M = 3.6;
/** The span continues while the land across the bed lies this far under the floor, metres. */
export const SPAN_LAND_M = 0.5;
/** The span reaches at most this far past the street's strip on each side, metres. */
export const SPAN_REACH_M = 40;
/** Past the street's strip the span always covers this much (its footway, the kerb), metres. */
export const SPAN_MARGIN_M = 1.5;
/** Two spans of one way this close merge, metres. */
export const SPAN_JOIN_M = 6;
/** Road samples on each side, at these distances past the deck's half width (railTracks RAIL_SECTION.slabHalf), metres. */
export const ROAD_SAMPLES = [1, 2, 3, 4, 5] as const;
/** A street rising more than this towards the track between its outer and inner samples is a ramp up to it, metres. */
export const ROAD_CLIMB_M = 0.3;
/** Streets crossing the track at a shallower angle run beside it, degrees. */
export const MIN_ANGLE_DEG = 20;
/** The deck's half width as the road samples see it (railTracks RAIL_SECTION.slabHalf), metres. */
export const DECK_HALF_M = 2.45;
/** The track inside the street's strip this much longer than a crossing at its angle takes: it runs along it, metres. */
export const ALONG_EXTRA_M = 6;
/** Half the bed's top (railTracks RAIL_SECTION.topHalf): the strip test's reach, metres. */
export const BED_TOP_HALF_M = 1.55;
/** Extension step along the track, metres. */
export const EXTEND_STEP_M = 1;

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Where segment ab crosses cd: the fraction along ab and along cd, or null. */
function cross(a: Vec2, b: Vec2, c: Vec2, d: Vec2): [number, number] | null {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1], den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = c[0] - a[0], qy = c[1] - a[1], t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

/** Distance from p to segment ab. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
}

/** The point at distance `s` along a polyline with cumulative distances `cum`, and its unit tangent. */
function pointAt(pts: readonly Vec2[], cum: readonly number[], s: number): { p: Vec2; t: Vec2 } {
  let i = 0;
  while (i + 2 < pts.length && cum[i + 1] < s) i++;
  const a = pts[i], b = pts[i + 1], l = cum[i + 1] - cum[i] || 1, f = Math.max(0, Math.min(1, (s - cum[i]) / l));
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], t: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
}

/**
 * The deck spans of one track off the bridges: where a street passes under its bed (see the header). `floor(s)` is the
 * bed's floor at distance s (railProfile.ts levelAt); `land` the riding surface the street and the land drape on.
 */
export function underpassSpans(track: SpanTrack, floor: (s: number) => number, streets: readonly SpanStreet[], land: HeightFn, measured?: (x: number, y: number) => boolean, headroom = SPAN_HEADROOM_M): RailSpan[] {
  if (track.bridge || track.points.length < 2) return [];
  const pts = track.points, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const across = (s: number) => {
    const { p, t } = pointAt(pts, cum, s), nx = -t[1], ny = t[0];
    return Math.max(land(p[0], p[1]), land(p[0] + nx * 1.55, p[1] + ny * 1.55), land(p[0] - nx * 1.55, p[1] - ny * 1.55));
  };
  const minSin = Math.sin((MIN_ANGLE_DEG * Math.PI) / 180);
  const raw: RailSpan[] = [];
  // Metres of track, within `win` of distance sx along it, that lie inside the street's strip (half + the bed's top).
  const insideStrip = (st: SpanStreet, sx: number, win: number) => {
    let m = 0;
    for (let s = Math.max(0, sx - win); s <= Math.min(total, sx + win); s += 0.5) {
      const { p } = pointAt(pts, cum, s);
      let best = Infinity;
      for (let j = 0; j + 1 < st.points.length; j++) best = Math.min(best, segDist(p, st.points[j], st.points[j + 1]));
      if (best <= st.half + BED_TOP_HALF_M) m += 0.5;
    }
    return m;
  };
  for (const st of streets) for (let j = 0; st.embedded !== true && j + 1 < st.points.length; j++) {
    const c = st.points[j], d = st.points[j + 1], sl = Math.hypot(d[0] - c[0], d[1] - c[1]);
    if (sl < 1e-6) continue;
    for (let i = 0; i + 1 < pts.length; i++) {
      const hit = cross(pts[i], pts[i + 1], c, d);
      if (!hit) continue;
      const a = pts[i], b = pts[i + 1], tl = cum[i + 1] - cum[i] || 1;
      const tx = (b[0] - a[0]) / tl, ty = (b[1] - a[1]) / tl, ux = (d[0] - c[0]) / sl, uy = (d[1] - c[1]) / sl;
      const sin = Math.abs(tx * uy - ty * ux);
      if (sin < minSin) continue;
      const x: Vec2 = [a[0] + (b[0] - a[0]) * hit[0], a[1] + (b[1] - a[1]) * hit[0]];
      if (measured?.(x[0], x[1])) continue;
      const sx = cum[i] + tl * hit[0], bed = floor(sx);
      // The street on each side of the bed, past the deck's footprint measured along the street.
      const reach = DECK_HALF_M / sin;
      const side = (dir: 1 | -1) => ROAD_SAMPLES.map(o => land(x[0] + ux * dir * (reach + o), x[1] + uy * dir * (reach + o)));
      const sides = [side(1), side(-1)];
      const road = Math.max(...sides.map(median));
      if (bed - road < Math.max(SPAN_CLEAR_M, headroom)) continue;
      // Climbing towards the track: inner samples above the outer ones.
      if (sides.some(v => median(v.slice(0, 2)) - median(v.slice(-2)) > ROAD_CLIMB_M)) continue;
      if (insideStrip(st, sx, 40) > (2 * (st.half + BED_TOP_HALF_M)) / sin + ALONG_EXTRA_M) continue;
      const strip = st.half / sin + SPAN_MARGIN_M;
      let s0 = Math.max(0, sx - strip), s1 = Math.min(total, sx + strip);
      for (let k = 0, s = s0 - EXTEND_STEP_M; k < SPAN_REACH_M && s >= 0 && floor(s) - across(s) > SPAN_LAND_M; k += EXTEND_STEP_M, s -= EXTEND_STEP_M) s0 = s;
      for (let k = 0, s = s1 + EXTEND_STEP_M; k < SPAN_REACH_M && s <= total && floor(s) - across(s) > SPAN_LAND_M; k += EXTEND_STEP_M, s += EXTEND_STEP_M) s1 = s;
      raw.push({ s0, s1, clear: +(bed - road).toFixed(2), at: x });
    }
  }
  raw.sort((p, q) => p.s0 - q.s0);
  const out: RailSpan[] = [];
  for (const r of raw) {
    const last = out[out.length - 1];
    if (last && r.s0 <= last.s1 + SPAN_JOIN_M) { last.s1 = Math.max(last.s1, r.s1); if (r.clear < last.clear) { last.clear = r.clear; last.at = r.at; } }
    else out.push({ ...r });
  }
  return out;
}

/** Is distance `s` inside one of the spans (inclusive, with a millimetre's slack)? */
export const inSpan = (spans: readonly RailSpan[], s: number): boolean => spans.some(r => s >= r.s0 - 1e-3 && s <= r.s1 + 1e-3);
