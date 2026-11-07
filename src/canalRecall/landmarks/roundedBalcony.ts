/**
 * Cantilevered balcony with rounded front corners and an open bar railing, as pure geometry in a wall's local frame
 * (t along the wall, o out of the wall, y up): the slab's plan outline, the railing's rail runs and its bar positions.
 *
 * Why (2026-11-06, landmarks lane #236, Kinkerstraat 89-105): the 1987 block's loggia slots carry stacks of concrete
 * balconies whose front corners sweep round in quarter circles under thin white bar railings. The kit had square slabs
 * (`slab`), a quarter-round corner balcony with a solid parapet (mercatorplein-kit `cornerBalcony`) and rounded window
 * bands in the wall plane (`roundedBand`), none of which says a free-standing rounded slab with a see-through rail.
 * Railings are returned as runs along the open edges (never along the wall, o = 0) so a builder can draw them as thin
 * ribbons; bars are spaced at most `barSpacing` apart along each run, evenly. No three.js.
 */
import {roundedBandOutline} from './roundedBand';

export type BalconyOpts = {
  /** Radius of the front corner on the viewer's left (t = 0) and right (t = w), metres. */
  rLeft?: number; rRight?: number;
  /** Arc steps per rounded corner. */
  steps?: number;
  /** Railing on the side edges too (true) or only along the front and round its corners (false). */
  sides?: boolean;
  /** Largest gap between bars along a run, metres. */
  barSpacing?: number;
};
export type BalconyRun = {pts: [number, number][]};
export type Balcony = {
  /** Slab outline in (t, o), counter-clockwise, starting at the wall on the left (0, 0). */
  outline: [number, number][];
  /** Railing runs along the open edges, each a polyline in (t, o). */
  runs: BalconyRun[];
  /** Bar foot positions in (t, o) with the run's unit tangent there. */
  bars: {at: [number, number]; tangent: [number, number]}[];
};

export function roundedBalcony(w: number, d: number, o: BalconyOpts = {}): Balcony {
  if (!(w > 0 && d > 0)) throw Error('roundedBalcony: positive width and depth required');
  const steps = o.steps ?? 6, spacing = o.barSpacing ?? 0.3, sides = o.sides ?? true;
  // roundedBand's (t, y) band read as (t, o) in plan: its top edge is the balcony front
  const outline = roundedBandOutline(w, d, {topLeft: o.rLeft, topRight: o.rRight}, steps);
  // the open edge: everything except the wall edge from (0, 0) to (w, 0); walk from (w, 0) round the front to (0, 0)
  const i0 = outline.findIndex(([t, y]) => Math.abs(t - w) < 1e-9 && Math.abs(y) < 1e-9);
  const ring = [...outline.slice(i0), ...outline.slice(0, i0)];
  let open = ring.slice(0, ring.findIndex(([t, y], k) => k > 0 && Math.abs(t) < 1e-9 && Math.abs(y) < 1e-9) + 1);
  if (!sides) {
    // drop the straight side legs: keep from the first point off t = w to the last point off t = 0
    const a = open.findIndex(([t]) => Math.abs(t - w) > 1e-9) - 1, b = open.length - open.slice().reverse().findIndex(([t]) => Math.abs(t) > 1e-9);
    open = open.slice(Math.max(0, a), b + 1);
    open = open.filter(([, y]) => y > d * 0.5 || open.length <= 2);
  }
  const runs: BalconyRun[] = [{pts: open}];
  const bars: Balcony['bars'] = [];
  for (const r of runs) {
    let len = 0; const seg: number[] = [];
    for (let k = 1; k < r.pts.length; k++) { const s = Math.hypot(r.pts[k][0] - r.pts[k - 1][0], r.pts[k][1] - r.pts[k - 1][1]); seg.push(s); len += s; }
    const n = Math.max(1, Math.ceil(len / spacing));
    for (let j = 0; j <= n; j++) {
      let s = (j / n) * len, k = 0;
      while (k < seg.length - 1 && s > seg[k]) { s -= seg[k]; k++; }
      const p = r.pts[k], q = r.pts[k + 1], f = seg[k] > 0 ? s / seg[k] : 0, tx = (q[0] - p[0]) / (seg[k] || 1), ty = (q[1] - p[1]) / (seg[k] || 1);
      bars.push({at: [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f], tangent: [tx, ty]});
    }
  }
  return {outline, runs, bars};
}
