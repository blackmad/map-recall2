// Where a bridge's parapet and railings run (pure; user 2026-10-16, "why do the gates dip into the road?").
//
// The kit (bridgeKit.ts parapet) draws the parapet along each deck edge over the parapet's station range. Measures
// for the audit (scripts/own-ground/audit-bridge-railings.ts) and the named regressions.

import type { Vec2 } from './surface.js';

/** One station of a parapet line: its station along the deck, the edge point, the edge's outward normal. */
export interface ParapetPoint { s: number; p: Vec2; out: Vec2 }

/** A parapet stretch is a "gate" across the deck when it steps more than TURN_M sideways, steeper than 45°. */
export const TURN_M = 0.75;
/** A parapet point counts as inside a traffic surface when the surface reaches INSIDE_M past it on both sides. */
export const INSIDE_M = 0.5;
const SAMPLE_M = 0.25;

/**
 * Measures of one drawn parapet line: `turns` stretches that run across the deck (lateral step > TURN_M, steeper
 * than 45° to the deck axis), their lateral metres; `insideM` metres of line deeper than INSIDE_M inside a traffic
 * polygon (`traffic`: carriage, cycle, foot or pedestrian under the point); the line's length.
 */
export function parapetCrossings(line: readonly ParapetPoint[], traffic: (x: number, y: number) => boolean): { turns: number; turnM: number; insideM: number; lengthM: number } {
  let turns = 0, turnM = 0, insideM = 0, lengthM = 0;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1], dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], len = Math.hypot(dx, dy);
    lengthM += len;
    const o: Vec2 = [(a.out[0] + b.out[0]) / 2, (a.out[1] + b.out[1]) / 2], ol = Math.hypot(o[0], o[1]) || 1;
    const lat = Math.abs((dx * o[0] + dy * o[1]) / ol), along = Math.sqrt(Math.max(0, len * len - lat * lat));
    if (lat > TURN_M && lat > along) { turns++; turnM += lat; }
    const steps = Math.max(1, Math.round(len / SAMPLE_M));
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.5) / steps, x = a.p[0] + dx * t, y = a.p[1] + dy * t, ox = o[0] / ol * INSIDE_M, oy = o[1] / ol * INSIDE_M;
      if (traffic(x, y) && traffic(x + ox, y + oy) && traffic(x - ox, y - oy)) insideM += len / steps;
    }
  }
  return { turns, turnM, insideM, lengthM };
}

/** The row fields railRun reads (bridgeKit KitRow). */
export interface RunRow { s: number; c: Vec2; n: Vec2; L: Vec2; R: Vec2; water: boolean; wL: boolean; wR: boolean; oL?: boolean; oR?: boolean }

/** Water this far outside a deck edge makes it a water-side edge (the water polygon stops at the bridge faces). */
export const RAIL_WATER_PROBE_M = 1.0;
/**
 * The `oL`/`oR` flags of a row, before cleanWater fills the water spans across the deck: water at each edge or
 * RAIL_WATER_PROBE_M outside it (n points to L).
 */
export function waterOutside(L: Vec2, R: Vec2, n: Vec2, overWater: (x: number, y: number) => boolean): { oL: boolean; oR: boolean } {
  const d = RAIL_WATER_PROBE_M;
  return { oL: overWater(L[0], L[1]) || overWater(L[0] + n[0] * d, L[1] + n[1] * d), oR: overWater(R[0], R[1]) || overWater(R[0] - n[0] * d, R[1] - n[1] * d) };
}

/**
 * Is a parapet point on a street or path that crosses the parapet line (`dir`, the line's direction there)? The bridge
 * ways through the deck (their bands' centrelines and half-widths): within half-width − CROSSING_INSET_M of one whose
 * direction is more than 45° off the parapet line's there. A deck measured along the canal (BRU0165 Raampoort) or a
 * footprint cut at a slant (BRU0173) has its edges across the road: those stretches are the street, not a parapet. A
 * way along the deck (a street wider than its deck) counts only with `anyAngle` (railRuns: a side that never meets
 * the water).
 */
export type CrossingTest = (x: number, y: number, dir: Vec2, anyAngle?: boolean) => boolean;
export const CROSSING_INSET_M = 0.5;
export function crossingWays(lines: readonly { points: readonly Vec2[]; half: number }[]): CrossingTest {
  const segs: number[] = [];
  for (const { points, half } of lines) for (let i = 0; i + 1 < points.length; i++) {
    const h = half - CROSSING_INSET_M;
    if (h > 0) segs.push(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], h);
  }
  return (x, y, dir, anyAngle = false) => {
    for (let k = 0; k < segs.length; k += 5) {
      const ax = segs[k], ay = segs[k + 1], dx = segs[k + 2] - ax, dy = segs[k + 3] - ay, h = segs[k + 4];
      if (x < Math.min(ax, ax + dx) - h || x > Math.max(ax, ax + dx) + h || y < Math.min(ay, ay + dy) - h || y > Math.max(ay, ay + dy) + h) continue;
      const l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
      if (Math.hypot(ax + dx * t - x, ay + dy * t - y) > h) continue;
      const dl = Math.hypot(dir[0], dir[1]) || 1;
      if (anyAngle || Math.abs(dx * dir[0] + dy * dir[1]) / (Math.sqrt(l2) * dl) < Math.SQRT1_2) return true;
    }
    return false;
  };
}

/** An edge jog along the water up to this long stays in the parapet; a longer sweep is a gate (BRU0173: 20 m). */
export const JOG_MAX_M = 2;

/** A railing breaks where its edge leaves the water for longer than this along the deck (an island or the street between). */
export const DRY_GAP_M = 4;

/** Audits only (audit-bridge-railings --before): false draws the parapet over the whole deck span, as before 2026-10-16. */
export const RAIL_CLIP = { enabled: true };

/** A railing reaches this far along the deck past the last station whose edge is at the water: onto the quay wall, not along the street. */
export const RAIL_PAST_WATER_M = 1.5;

/**
 * The station ranges one side's parapet and railing stand on (user 2026-10-16, "why do the gates dip into the road?",
 * the Nieuwe-Wercksbrug BRU0063, BRU0166 at the Bilderdijkgracht mouth). The kit drew them over the whole measured
 * deck span, and a span runs metres past its water onto the quay streets (BRU0063: [20.2, 53.9] over water
 * [24.3, 44.3]); there the deck edge (decks.ts deckWidths) steps in from the outline to the road's half-width, so the
 * railing turned across the footway and cycle lane and ran on along the carriageway.
 *
 * A side's railing runs where its edge is at the water (`oL`/`oR`; rows without them, the cleaned `wL`/`wR` and the
 * centre's water), RAIL_PAST_WATER_M further onto each abutment, and never through a gate: a stretch where the edge
 * runs more across the deck (or back along it) than along it, over more than TURN_M, with a dry edge at either end (a
 * jog of the edge along the water up to JOG_MAX_M stays; at the parapet's ends any such step is a gate), and breaks
 * where the edge is dry for more than DRY_GAP_M or stands on a street crossing it (`crossing`, crossingWays). A side
 * that never meets the water follows the water anywhere across the deck; a deck with no water at all keeps [p0, p1],
 * as does one whose water reaches within RAIL_PAST_WATER_M of both ends with no gate (byte-identical kit output
 * there). Pieces under 1 m are dropped.
 */
export function railRuns(rows: readonly RunRow[], p0: number, p1: number, side: 1 | -1, crossing?: CrossingTest): [number, number][] {
  if (!RAIL_CLIP.enabled) return [[p0, p1]];
  const inside = rows.filter(r => r.s >= p0 - 1e-9 && r.s <= p1 + 1e-9);
  if (inside.length < 2) return [[p0, p1]];
  // The parapet's own end stations (bridgeKit rowAt(p0), rowAt(p1)) where they fall between rows: a deck span's end lies
  // between the last station with the road's half-width and the first with the outline's (BRU0257: 19 m apart).
  const at = (s: number): RunRow => {
    let k = 0;
    while (k < rows.length - 2 && rows[k + 1].s < s) k++;
    const a = rows[k], b = rows[Math.min(rows.length - 1, k + 1)], t = b.s > a.s ? Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s))) : 0;
    const l2 = (p: Vec2, q: Vec2): Vec2 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t], near = t < 0.5 ? a : b;
    return { ...near, s, c: l2(a.c, b.c), n: l2(a.n, b.n), L: l2(a.L, b.L), R: l2(a.R, b.R) };
  };
  const on = [...(inside[0].s > p0 + 1e-6 ? [at(p0)] : []), ...inside, ...(inside[inside.length - 1].s < p1 - 1e-6 ? [at(p1)] : [])];
  const raw = (r: RunRow) => (side > 0 ? r.oL : r.oR);
  const hasRaw = on.some(r => raw(r) !== undefined);
  const sideWet = (r: RunRow) => (hasRaw ? !!raw(r) : r.water || (side > 0 ? r.wL : r.wR));
  // A side that never meets the water (a skewed span's dry corner) follows the bridge's water anywhere across.
  const anyWet = (r: RunRow) => r.water || r.wL || r.wR || !!r.oL || !!r.oR;
  const dry = !on.some(sideWet), wet = dry ? anyWet : sideWet;
  if (!on.some(wet)) return [[p0, p1]];
  // A step of the edge from row k to k + 1 is steep when it runs more across the deck than along it (or back along it:
  // the edge folding over where the centreline bends at a deck end).
  const edge = (r: RunRow) => (side > 0 ? r.L : r.R);
  const steep = (k: number) => {
    const a = edge(on[k]), b = edge(on[k + 1]), dx = b[0] - a[0], dy = b[1] - a[1], n = on[k].n;
    return Math.abs(dx * n[0] + dy * n[1]) > dx * n[1] - dy * n[0];
  };
  // The stations standing on a street that crosses the parapet line, by the line's own direction there (a footprint cut
  // at a slant sweeps its edge across the deck, BRU0173).
  const across = on.map((r, k) => {
    if (!crossing) return false;
    const e = edge(r), a = edge(on[Math.max(0, k - 1)]), b = edge(on[Math.min(on.length - 1, k + 1)]);
    const d: Vec2 = Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6 ? [b[0] - a[0], b[1] - a[1]] : [r.n[1], -r.n[0]];
    // A side that never meets the water stands on no street at all, along it or across (BRU0347: a culvert under a
    // wide road, its dry edge down the carriageway).
    return crossing(e[0], e[1], d, dry);
  });
  // Pieces (row index ranges): between the crossing stations, and between the gates: a run of steep steps whose ends lie
  // more than TURN_M apart, longer than JOG_MAX_M, with a dry edge at either end, or at an end of the parapet (a return
  // across the deck end).
  // A gate that runs back along the deck is the edge folding over (the centreline bending at a deck end, BRU0063's
  // south-west corner): of the pieces either side the shorter is the fold's tail, inside the deck, and is dropped.
  const pieces: [number, number][] = [], drop = new Set<number>();
  const span = (q: readonly [number, number]) => on[q[1]].s - on[q[0]].s;
  for (let i0 = 0; i0 < on.length;) {
    if (across[i0]) { i0++; continue; }
    let i1 = i0;
    while (i1 + 1 < on.length && !across[i1 + 1]) i1++;
    let start = i0;
    for (let k = i0; k < i1;) {
      let j = k;
      while (j < i1 && steep(j)) j++;
      const a = edge(on[k]), b = edge(on[j]), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (j > k && d > TURN_M && (d > JOG_MAX_M || !wet(on[k]) || !wet(on[j]) || k === 0 || j === on.length - 1)) {
        pieces.push([start, k]); start = j;
        const n = on[k].n, back = (b[0] - a[0]) * n[1] - (b[1] - a[1]) * n[0] < -TURN_M;
        if (back) drop.add(-pieces.length);
      }
      k = Math.max(j, k + 1);
    }
    pieces.push([start, i1]);
    i0 = i1 + 1;
  }
  // Resolve the folds: -m marks a fold between pieces m - 1 and m.
  for (const f of [...drop].filter(v => v < 0)) { const m = -f; drop.delete(f); drop.add(span(pieces[m - 1]) < span(pieces[m]) ? m - 1 : m); }
  const out: [number, number][] = [];
  for (const [i0, i1] of pieces.filter((_, k) => !drop.has(k))) {
    if (i1 <= i0) continue;
    const lo = on[i0].s, hi = on[i1].s;
    // The wet stations, in groups DRY_GAP_M apart at most (a deck whose profile runs along the canal: water at both
    // ends, the street between, BRU0165 Raampoort).
    let f = -1, l = -1;
    const flush = () => {
      if (f < 0) return;
      const a = Math.max(lo, on[f].s - RAIL_PAST_WATER_M), b = Math.min(hi, on[l].s + RAIL_PAST_WATER_M);
      if (b - a >= 1) out.push([a, b]);
      f = l = -1;
    };
    for (let k = i0; k <= i1; k++) {
      if (!wet(on[k])) continue;
      if (f >= 0 && on[k].s - on[l].s > DRY_GAP_M) flush();
      if (f < 0) f = k;
      l = k;
    }
    flush();
  }
  return out;
}
