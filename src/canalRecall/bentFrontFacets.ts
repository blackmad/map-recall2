/**
 * Narrow facets of a bent front (feedback 1a223c, Jacob van Lennepkade r3674867).
 *
 * A front that turns through jogs, oriel cants or corner chamfers is split into runs at every turn of RUN_TURN_DEG or
 * more (threeBuildingMesh wallRuns). A run shorter than a bay was laid out as one whole bay: the window cell squeezed
 * onto the facet, so a 1-2 m cant drew two slivers of window against the corner, as if the windows of the face beside
 * it were cut by the turn. Here such a facet samples the cell at its natural width instead, centred on one window
 * (the one nearest the cell's middle), and draws as plain wall when no whole window fits with a pier either side.
 *
 * Scope: a run under FACET_MAX_M (the walls the 3D window extras skip, so the texture is all there is) and under one
 * natural cell, whose ring neighbours at both ends are exposed walls it turns off: a facet of a bent front. A narrow
 * front between party walls (a 2 m canal house) is not a facet and keeps its cell. Absent a facet span, every caller
 * draws exactly as before.
 */
import type { OpeningRow } from './facadeOpenings.js';

/** Runs at least this long keep their whole-bay layout (the 3D window extras start at 2.5 m walls). */
export const FACET_MAX_M = 2.5;
/** Plain wall each side of a facet's window, metres. */
export const FACET_PIER_M = 0.15;
/** A window this wide (share of the cell) is a glazing band: a facet narrower than it samples the band's middle. */
export const FACET_BAND_WIDTH = 0.6;

type RingEdge = { x0: number; y0: number; x1: number; y1: number };

/** The cell span a facet samples: u0..u1 in cell units (1 = one cell), or 'plain' for bare wall. */
export type FacetSpan = { u0: number; u1: number } | 'plain';

/**
 * Whether a run (consecutive ring edges) is bounded at both ends by exposed walls it turns off: a jog, cant or chamfer
 * of a bent front rather than a whole front between party walls. `hidden` is the run builder's party-wall test.
 */
export function bentFrontFacet<E extends RingEdge>(rings: readonly (readonly E[])[], hidden: (e: E) => boolean, run: readonly { e: E }[]): boolean {
  if (!run.length) return false;
  const first = run[0].e, last = run[run.length - 1].e;
  for (const ring of rings) {
    const i = ring.indexOf(first), j = ring.indexOf(last);
    if (i < 0 || j < 0) continue;
    const n = ring.length;
    if (n < 3) return false;
    const before = ring[(i - 1 + n) % n], after = ring[(j + 1) % n];
    if (before === last || after === first) return false;
    const meets = (a: RingEdge, b: RingEdge) => Math.hypot(a.x1 - b.x0, a.y1 - b.y0) < 0.05;
    return !hidden(before) && !hidden(after) && meets(before, first) && meets(last, after);
  }
  return false;
}

/**
 * The span of the cell a facet `lenM` long samples, the cell being `cellM` wide at its natural scale and its window
 * row `row`; null when the facet is not narrow or its row is unknown (it keeps the whole-bay layout).
 */
export function facetSpan(lenM: number, cellM: number, row: OpeningRow | undefined): FacetSpan | null {
  if (!(lenM > 0) || !(cellM > 0) || lenM >= FACET_MAX_M || lenM >= cellM) return null;
  if (!row) return null;
  if (!row.axes.length) return 'plain';
  const widthOf = (k: number) => row.widths?.[k] ?? row.width;
  // The window nearest the cell's middle.
  let k = 0;
  row.axes.forEach((a, i) => { if (Math.abs(a - 0.5) < Math.abs(row.axes[k] - 0.5) - 1e-9) k = i; });
  const a = row.axes[k], w = widthOf(k), half = lenM / cellM / 2;
  if (w >= FACET_BAND_WIDTH) return { u0: a - Math.min(half, w / 2), u1: a + Math.min(half, w / 2) };
  if (lenM < w * cellM + 2 * FACET_PIER_M) return 'plain';
  // Never into the next window (the cell repeats, so the row's windows recur a cell either side).
  const edges = [-1, 0, 1].flatMap(shift => row.axes.map((x, i) => ({ x: x + shift, w: widthOf(i) }))).filter(o => Math.abs(o.x - a) > 1e-9);
  const lo = Math.max(a - half, ...edges.filter(o => o.x < a).map(o => o.x + o.w / 2));
  const hi = Math.min(a + half, ...edges.filter(o => o.x > a).map(o => o.x - o.w / 2));
  return { u0: lo, u1: hi };
}

/** u at metre `m` along a facet `lenM` long that samples `span` (a facet's walls share one span, left to right). */
export function facetU(span: { u0: number; u1: number }, m: number, lenM: number): number {
  return span.u0 + (span.u1 - span.u0) * Math.max(0, Math.min(1, m / lenM));
}

/**
 * Stepped fronts (feedback f8f282, Prinsengracht 136-138, pand 0363100012165018): BAG draws one street front as parallel
 * pieces offset by sub-metre jogs (0.1-0.5 m) where the old plots met. Every jog turns 90 deg, so each 1-3 m piece was a
 * run of its own and drew a whole bay squeezed onto it: narrow paired windows between stripes. Runs that continue a
 * front across a single jog shorter than JOG_MAX_M (parallel within the run turn) are one run; the jog itself is listed
 * so it draws as plain wall and takes no length in the bay layout.
 */
export const JOG_MAX_M = 0.6;

type RunEdge = RingEdge & { len: number };

export function mergeSteppedRuns<E extends RunEdge>(runs: ReadonlyArray<ReadonlyArray<{ e: E }>>, cosTurn: number): { runs: Array<Array<{ e: E }>>; jogs: Set<E> } {
  const out: Array<Array<{ e: E }>> = [], jogs = new Set<E>();
  const meets = (a: RingEdge, b: RingEdge) => Math.hypot(a.x1 - b.x0, a.y1 - b.y0) < 0.05;
  const parallel = (a: RunEdge, b: RunEdge) => ((a.x1 - a.x0) * (b.x1 - b.x0) + (a.y1 - a.y0) * (b.y1 - b.y0)) / (a.len * b.len) >= cosTurn;
  let i = 0;
  while (i < runs.length) {
    const cur = [...runs[i]];
    let j = i + 1;
    while (j + 1 < runs.length) {
      const jog = runs[j], next = runs[j + 1], last = cur[cur.length - 1].e;
      if (jog.length !== 1 || !(jog[0].e.len < JOG_MAX_M) || !meets(last, jog[0].e) || !meets(jog[0].e, next[0].e) || !parallel(last, next[0].e)) break;
      // A jog is a step across the front, not a piece of it: it must turn off both sides.
      if (parallel(last, jog[0].e) || parallel(jog[0].e, next[0].e)) break;
      jogs.add(jog[0].e);
      cur.push(jog[0], ...next);
      j += 2;
    }
    out.push(cur);
    i = j;
  }
  return { runs: out, jogs };
}

/**
 * mergeSteppedRuns is off by default: in its blind (10 frames, photo | A | B, sides randomised) it won 1 and lost 2 of
 * the stepped fronts it changed (Rozengracht-area pands 0363100012173122, 0363100012172546: one run gets the nominal
 * bay, so a front of several narrow plots lost its narrow paired windows and its doors). STEPPED_FRONTS=1 (node: the
 * world compile, tests) or `?steppedFronts=1` where the mesh runs on the page turns it on for review; the browser's chunk
 * worker sees only its own script URL, so the page query does not reach it (measured: flag on == off at ?world=live).
 */
let steppedNow: boolean | undefined;
export function steppedFrontsOn(): boolean {
  if (steppedNow !== undefined) return steppedNow;
  const g = globalThis as { location?: { search?: string }; process?: { env?: Record<string, string | undefined> } };
  try {
    const q = new URLSearchParams(g.location?.search ?? '').get('steppedFronts');
    steppedNow = q !== null ? q === '1' : g.process?.env?.STEPPED_FRONTS === '1';
  } catch { steppedNow = false; }
  return steppedNow;
}
/** Tests and harnesses: forget the cached flag. */
export const resetSteppedFronts = () => { steppedNow = undefined; };
