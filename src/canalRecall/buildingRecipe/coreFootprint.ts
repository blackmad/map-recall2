/**
 * Core footprint (large tier, `footprint: "core"`; Blend, Haarlemmerweg 518A-776, MVRDV 2023).
 *
 * BAG draws a pand's outline as seen from above, so a tower whose rooms step out of the facade on different storeys
 * (stacked offset blocks) gets an outline of shallow bumps: the union of every storey's projections. 3DBAG then
 * extrudes that outline to the roof, and the shell carries full-height grooves where the photo shows a staggered
 * chequer of blocks on a flat core wall. This module recovers the core: it retracts every outward step of at most
 * `maxStepM` (a facade segment whose two end turns are both convex, beside a short perpendicular step) onto the line
 * behind it, until none is left. Concave notches and the building's own corners are kept, so a plain outline comes
 * back unchanged (a notch no deeper than `maxStepM` is the same shape as two bumps and its flanks retract to its floor). The blocks themselves are drawn per storey by `blockBuilding/stackedBlocks.ts`.
 *
 * Pure 2D geometry on one ring (any planar coordinates, open or closed, either winding); unit-tested in
 * `coreFootprint.test.ts`.
 */

export type P2 = [number, number];

/** Default deepest step retracted (m): Blend's BAG bumps are 1.83-1.86 m. */
export const CORE_MAX_STEP_M = 2.5;
/** A step shorter than this after a retraction is closed (m). */
const VANISH_M = 0.05;
/** A vertex this close to the line through its neighbours is dropped (m). */
const COLLINEAR_M = 0.08;
/** |cos| under which two edges count as perpendicular, and over which as parallel. */
const PERP_COS = 0.17, PAR_COS = 0.95;

const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const len = (a: P2) => Math.hypot(a[0], a[1]);
const cross = (a: P2, b: P2) => a[0] * b[1] - a[1] * b[0];
const dot = (a: P2, b: P2) => a[0] * b[0] + a[1] * b[1];
const unit = (a: P2): P2 => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const area2 = (r: P2[]) => r.reduce((s, p, i) => s + cross(p, r[(i + 1) % r.length]), 0);

function lineDist(p: P2, a: P2, b: P2) { const d = sub(b, a), l = len(d); return l < 1e-9 ? len(sub(p, a)) : Math.abs(cross(d, sub(p, a))) / l; }

/** Drop repeated vertices and vertices on the line through their neighbours. */
function clean(r: P2[]): P2[] {
  let out = r.slice(), changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const a = out[(i - 1 + out.length) % out.length], p = out[i], b = out[(i + 1) % out.length];
      if (len(sub(p, a)) < VANISH_M || lineDist(p, a, b) < COLLINEAR_M) { out.splice(i, 1); changed = true; i--; }
    }
  }
  return out;
}

export interface CoreReport {
  /** retractions applied (each closes at least one step) */
  steps: number;
  /** plan area removed from the ring (m2) */
  removedM2: number;
}

/**
 * The core of one outline ring: outward steps of at most `maxStepM` retracted onto the facade behind them.
 * Returns the ring in the input's winding and closedness.
 */
export function coreRing(input: P2[], maxStepM = CORE_MAX_STEP_M): {ring: P2[]; report: CoreReport} {
  const closed = input.length > 3 && len(sub(input[0], input[input.length - 1])) < 1e-9;
  const open = (closed ? input.slice(0, -1) : input.slice()).map(p => [p[0], p[1]] as P2);
  const ccw = area2(open) > 0, sign = ccw ? 1 : -1;
  const a0 = Math.abs(area2(open)) / 2;
  let r = clean(open), steps = 0;
  for (let guard = 0; guard < 500; guard++) {
    const n = r.length;
    if (n < 5) break;
    let best: {i: number; t: number} | null = null;
    for (let i = 0; i < n; i++) {
      const a = r[(i - 1 + n) % n], b = r[i], c = r[(i + 1) % n], d = r[(i + 2) % n];
      const prev = sub(b, a), s = sub(c, b), next = sub(d, c), lp = len(prev), ls = len(s), ln = len(next);
      if (ls < VANISH_M) continue;
      // both end turns convex (the segment stands out), both neighbours perpendicular to it and parallel to each other (a U or an L step)
      if (sign * cross(prev, s) <= 0 || sign * cross(s, next) <= 0) continue;
      if (Math.abs(dot(unit(prev), unit(s))) > PERP_COS || Math.abs(dot(unit(next), unit(s))) > PERP_COS) continue;
      if (dot(unit(prev), unit(next)) > -PAR_COS) continue;
      const shorts = [lp, ln].filter(l => l <= maxStepM);
      if (!shorts.length) continue;
      const t = Math.min(...shorts);
      if (!best || t < best.t - 1e-9 || (Math.abs(t - best.t) < 1e-9 && i < best.i)) best = {i, t};
    }
    if (!best) break;
    const i = best.i, t = best.t;
    const a = r[(i - 1 + n) % n], b = r[i], c = r[(i + 1) % n], d = r[(i + 2) % n];
    // move b back along prev (towards a) and c along next (towards d) by t: the segment shifts inward by t
    const lp = len(sub(b, a)), ln = len(sub(d, c));
    const b2: P2 = lp - t < VANISH_M ? a : [b[0] - unit(sub(b, a))[0] * t, b[1] - unit(sub(b, a))[1] * t];
    const c2: P2 = ln - t < VANISH_M ? d : [c[0] + unit(sub(d, c))[0] * t, c[1] + unit(sub(d, c))[1] * t];
    r[i] = b2; r[(i + 1) % n] = c2;
    r = clean(r);
    steps++;
  }
  const ring = sign * area2(r) > 0 ? r : r.slice().reverse();
  const report = {steps, removedM2: +(a0 - Math.abs(area2(ring)) / 2).toFixed(2)};
  return {ring: closed ? [...ring, ring[0]] : ring, report};
}
