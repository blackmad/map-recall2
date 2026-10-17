// Crossing audit (pure): what is wrong with the zebras the survey markings draw (surveyMarkings.ts DrawnCrossing).
//
// User 2026-10-17, ride screenshots at the Nieuwezijds Voorburgwal / Magna Plaza / Dam junction: stripes splayed in
// fans and overlapped at different angles, one crossing had every other stripe missing at an angle, crossings sat on
// cobbles and in odd places. Each crossing is measured against the carriageway it is drawn on with exact polygon
// tests (not the 0.5 m fast raster the renderer clips with), in six categories:
//
//   splay      the stripes of one crossing are not parallel (any two pieces more than SPLAY_DEG apart);
//   skew       the stripes are not along the carriageway: the shortest chord across the carriageway polygon (the
//              walking line) is more than SKEW_DEG off the stripes' normal at two of three points of the row, where
//              the chord is well defined (shorter than CHORD_CLEAR × the chord along the stripes), and the stripes
//              are more than SKEW_DEG off the road way's direction there too;
//   overlap    the crossing's footprint overlaps another crossing's (several OSM nodes or ways for one crossing);
//   off        more than OFF_SHARE of its paint lies off a ground carriageway polygon (pavement, cycle path, island);
//   cobbles    more than COBBLE_SHARE of its paint lies on a klinker carriageway (reported, see the lane notes);
//   gaps       a stripe of the row is missing or cut short where the carriageway runs on under it (alternate or
//              missing stripes), or the drawn stripes are unevenly spaced;
//   length     the row across the road is shorter than MIN_ROW_M or longer than MAX_ROW_M.

import type { DrawnCrossing } from './surveyMarkings.js';
import type { Vec2 } from './surface.js';

export const AUDIT = {
  SPLAY_DEG: 2,
  SKEW_DEG: 20,
  CHORD_CLEAR: 0.6,
  OFF_SHARE: 0.04,
  COBBLE_SHARE: 0.5,
  MIN_ROW_M: 2.5,
  MAX_ROW_M: 22,
  /** A stripe whose centre line is on the carriageway for at least this share must be drawn, at least STRIPE_KEEP of it. */
  STRIPE_ON: 0.8,
  STRIPE_KEEP: 0.7,
  /** Spacing between neighbouring drawn stripes may differ from the pitch by this much. */
  PITCH_TOL_M: 0.05,
} as const;

/**
 * City-wide ceilings (scripts/own-ground/audit-crossings.ts --check and crossingAudit.test.ts): the remaining
 * flagged crossings are listed and explained in the lane notes (2026-10-17). `cobbles` is reported, not capped:
 * Amsterdam paints zebras on klinker streets (Nieuwezijds Voorburgwal, Paleisstraat) where OSM and the photo say so.
 */
export const CROSSING_AUDIT_MAX: Partial<Record<AuditCategory, number>> = { splay: 0, skew: 5, overlap: 0, off: 0, gaps: 4, length: 0 };

export type AuditCategory = 'splay' | 'skew' | 'overlap' | 'off' | 'cobbles' | 'gaps' | 'length';
export const AUDIT_CATEGORIES: readonly AuditCategory[] = ['splay', 'skew', 'overlap', 'off', 'cobbles', 'gaps', 'length'];

/** What lies under a point: a ground (h = 0) polygon's class and mesh, or null. Exact, not rastered. */
export type GroundAt = (x: number, y: number) => { cls: string; mesh: string } | null;

export interface CrossingFinding { at: Vec2; source: DrawnCrossing['source']; ref: DrawnCrossing['ref']; categories: AuditCategory[]; notes: string[] }
export interface CrossingAuditResult { crossings: number; counts: Record<AuditCategory, number>; flagged: CrossingFinding[] }

const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const add = (a: Vec2, b: Vec2, k = 1): Vec2 => [a[0] + b[0] * k, a[1] + b[1] * k];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const left = (v: Vec2): Vec2 => [-v[1], v[0]];
const unit = (v: Vec2): Vec2 => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const DEG = 180 / Math.PI;
/** Angle between two undirected lines, degrees in [0, 90]. */
export const lineAngle = (a: Vec2, b: Vec2) => Math.acos(Math.min(1, Math.abs(dot(unit(a), unit(b))))) * DEG;

/** Stripe width the renderer draws (surveyMarkings ZEBRA.stripe); the audit takes it as an input so it stays pure. */
export interface AuditSpec { stripe: number; gap: number; len: number }

/** The oriented footprint of a drawn crossing: along r over its stripes' extent, along n over its drawn row. */
export function footprint(c: DrawnCrossing, spec: AuditSpec): Vec2[] | null {
  const n = left(c.r);
  let a0 = Infinity, a1 = -Infinity, l0 = Infinity, l1 = -Infinity;
  for (const s of c.stripes) for (const [p, q] of s.pieces) for (const x of [p, q]) {
    const d = sub(x, c.centre), u = dot(d, c.r), v = dot(d, n);
    a0 = Math.min(a0, u); a1 = Math.max(a1, u); l0 = Math.min(l0, v - spec.stripe / 2); l1 = Math.max(l1, v + spec.stripe / 2);
  }
  if (!Number.isFinite(a0)) return null;
  const at = (u: number, v: number) => add(add(c.centre, c.r, u), n, v);
  return [at(a0, l0), at(a1, l0), at(a1, l1), at(a0, l1)];
}

/** Do two convex polygons overlap by more than `eps` metres along every separating axis (SAT)? */
export function convexOverlap(A: readonly Vec2[], B: readonly Vec2[], eps = 0.05): boolean {
  for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
    const e = sub(P[(i + 1) % P.length], P[i]), ax = unit(left(e));
    const pa = A.map(p => dot(p, ax)), pb = B.map(p => dot(p, ax));
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= eps) return false;
  }
  return true;
}

/** Length of the carriageway chord through p along ±d (stops where it leaves the carriageway), 0.1 m steps. */
function chord(p: Vec2, d: Vec2, onCarriage: (x: number, y: number) => boolean, max = 30): number {
  let len = 0;
  for (const s of [1, -1]) for (let t = 0.1; t <= max; t += 0.1) { const q = add(p, d, s * t); if (!onCarriage(q[0], q[1])) break; len += 0.1; }
  return len;
}

/** Audit drawn crossings; `owned` restricts which are counted (others still take part in the overlap test). */
/**
 * `roadDir`: the direction of the carriageway way at a point (null where none is near). A crossing is skewed only
 * when it disagrees with it too: the chord is cut short by a cycle path across the road or a bridge deck's edge
 * beside a crossing (Weteringschans bridge), and the way alone wanders in a junction's curve.
 */
export function auditCrossings(all: readonly DrawnCrossing[], groundAt: GroundAt, spec: AuditSpec, owned: (c: DrawnCrossing) => boolean = () => true, roadDir: (p: Vec2) => Vec2 | null = () => null): CrossingAuditResult {
  const counts = Object.fromEntries(AUDIT_CATEGORIES.map(k => [k, 0])) as Record<AuditCategory, number>;
  const flagged: CrossingFinding[] = [];
  const onCarriage = (x: number, y: number) => groundAt(x, y)?.cls === 'carriage';
  const feet = all.map(c => footprint(c, spec));
  let crossings = 0;
  all.forEach((c, ci) => {
    if (!owned(c) || !c.stripes.length) return;
    crossings++;
    const cats = new Set<AuditCategory>(), notes: string[] = [];
    const n = left(c.r), pitch = spec.stripe + spec.gap;
    // splay
    let worst = 0;
    const dirs = c.stripes.flatMap(s => s.pieces.map(([p, q]) => sub(q, p))).filter(d => Math.hypot(d[0], d[1]) > 0.3);
    for (let i = 0; i < dirs.length; i++) for (let j = i + 1; j < dirs.length; j++) worst = Math.max(worst, lineAngle(dirs[i], dirs[j]));
    if (worst > AUDIT.SPLAY_DEG) { cats.add('splay'); notes.push(`splay ${worst.toFixed(1)}°`); }
    // skew: the walking line is the carriageway's shortest chord, measured through the row at a quarter, the middle
    // and three quarters of it; skewed when at least two of the three clear chords say so (one chord alone is fooled
    // by a polygon corner or a deck edge beside the crossing).
    const mids = c.stripes.map(s => s.pieces.map(([p, q]) => add(p, sub(q, p), 0.5))).flat();
    const lv = mids.map(m => dot(sub(m, c.centre), n)), v0 = Math.min(...lv), v1 = Math.max(...lv);
    const mid = add(c.centre, n, (v0 + v1) / 2);
    let votes = 0, worstOff = 0, note = '';
    for (const f of [0.25, 0.5, 0.75]) {
      const q = add(c.centre, n, v0 + (v1 - v0) * f);
      if (!onCarriage(q[0], q[1])) continue;
      let best = Infinity, bestDir: Vec2 = n;
      for (let deg = 0; deg < 180; deg += 3) { const d: Vec2 = [Math.cos(deg / DEG), Math.sin(deg / DEG)], l = chord(q, d, onCarriage, Math.min(best, 30)); if (l < best) { best = l; bestDir = d; } }
      const along = chord(q, c.r, onCarriage), off = lineAngle(bestDir, n);
      if (best < AUDIT.CHORD_CLEAR * along && off > AUDIT.SKEW_DEG) { votes++; if (off > worstOff) { worstOff = off; note = `skew ${off.toFixed(0)}° (chord ${best.toFixed(1)} m vs ${along.toFixed(1)} m along)`; } }
    }
    // The road way at the crossing's own foot point (the row's middle may lie over an island, metres off it).
    const way = roadDir(c.centre) ?? roadDir(mid), wayOff = way ? lineAngle(way, c.r) : 90;
    if (votes >= 2 && wayOff > AUDIT.SKEW_DEG) { cats.add('skew'); notes.push(`${note}; ${way ? `${wayOff.toFixed(0)}° off the road way` : 'no road way'}`); }
    // overlap
    const f = feet[ci];
    if (f) all.forEach((o, oi) => {
      if (oi === ci || !feet[oi]) return;
      if (convexOverlap(f, feet[oi]!)) { cats.add('overlap'); notes.push(`overlaps ${o.source} ${typeof o.ref === 'number' ? o.ref : o.ref.map(v => v.toFixed(1)).join(',')} at ${lineAngle(c.r, o.r).toFixed(0)}°`); }
    });
    // off-carriage and cobbles, sampled over every piece at 0.1 m along, at the centre and ±0.2 m across
    let samples = 0, offN = 0, cobble = 0;
    for (const s of c.stripes) for (const [p, q] of s.pieces) {
      const d = sub(q, p), len = Math.hypot(d[0], d[1]), u = unit(d), w = left(u);
      for (let t = 0.05; t < len; t += 0.1) for (const k of [-0.2, 0, 0.2]) {
        const x = add(add(p, u, t), w, k * spec.stripe / 0.5), g = groundAt(x[0], x[1]);
        samples++;
        if (g?.cls !== 'carriage') offN++; else if (g.mesh === 'klinker') cobble++;
      }
    }
    if (samples && offN / samples > AUDIT.OFF_SHARE) { cats.add('off'); notes.push(`off carriageway ${(100 * offN / samples).toFixed(0)}%`); }
    if (samples && cobble / samples > AUDIT.COBBLE_SHARE) { cats.add('cobbles'); notes.push(`on klinker ${(100 * cobble / samples).toFixed(0)}%`); }
    // gaps: every planned stripe from the first drawn to the last, whose centre line is on the carriageway, is drawn
    const drawn = new Map(c.stripes.map(s => [s.i, s]));
    const is = c.stripes.map(s => s.i), i0 = Math.min(...is), i1 = Math.max(...is);
    const ref = c.stripes[0], refV = dot(sub(add(ref.pieces[0][0], sub(ref.pieces[0][1], ref.pieces[0][0]), 0.5), c.centre), n) - ref.i * pitch;
    let missing = 0, short = 0;
    for (let i = i0; i <= i1; i++) {
      const v = refV + i * pitch, base = add(c.centre, n, v);
      let on = 0, k = 0;
      // On the carriageway: the centre line and both edges (a stripe straddling a kerb is not owed).
      const e = spec.stripe / 2 - 0.05;
      for (let t = -spec.len / 2 + 0.05; t < spec.len / 2; t += 0.1, k++) { const x = add(base, c.r, t); if (onCarriage(x[0], x[1]) && onCarriage(x[0] + n[0] * e, x[1] + n[1] * e) && onCarriage(x[0] - n[0] * e, x[1] - n[1] * e)) on++; }
      const share = on / k, s = drawn.get(i);
      if (share < AUDIT.STRIPE_ON) continue;
      if (!s) { missing++; continue; }
      const got = s.pieces.reduce((acc, [p, q]) => acc + Math.hypot(q[0] - p[0], q[1] - p[1]), 0);
      if (got < AUDIT.STRIPE_KEEP * share * spec.len) short++;
    }
    let uneven = 0;
    const vs = c.stripes.map(s => dot(sub(add(s.pieces[0][0], sub(s.pieces[0][1], s.pieces[0][0]), 0.5), c.centre), n)).sort((a, b) => a - b);
    for (let i = 1; i < vs.length; i++) { const g = vs[i] - vs[i - 1], m = Math.round(g / pitch); if (m < 1 || Math.abs(g - m * pitch) > AUDIT.PITCH_TOL_M) uneven++; }
    if (missing || short || uneven) { cats.add('gaps'); notes.push(`${missing} missing, ${short} short, ${uneven} uneven of ${i1 - i0 + 1}`); }
    // length of the row
    const row = Math.max(...lv) - Math.min(...lv) + spec.stripe;
    if (row < AUDIT.MIN_ROW_M - 0.05 || row > AUDIT.MAX_ROW_M + 0.05) { cats.add('length'); notes.push(`row ${row.toFixed(1)} m`); }
    for (const k of cats) counts[k]++;
    if (cats.size) flagged.push({ at: mid, source: c.source, ref: c.ref, categories: [...cats], notes });
  });
  return { crossings, counts, flagged };
}
