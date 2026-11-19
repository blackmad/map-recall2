/**
 * Projecting masses against the window grid (feedback d99e51, 2026-11-13, Postjesweg pand 0363100012104321: "this
 * extrusion looks bad because it cuts into windows"; the 2026-11-19 verify re-opened it with 18a9d3, e058c8, 1a223c).
 *
 * The dice oriel and bay window (facadeOrnaments.ts `oriel`, facadeExtras.ts `bay-window`) stood at a fixed share of the
 * wall (the middle, or 30 % along) whatever the window axes were, so on an even bay count the mass covered half of two
 * windows and left the other halves showing beside it. A projecting mass may cover a window whole or leave it whole,
 * never part of it.
 *
 * `fitProjection`: the wanted centre and half width unchanged when no window is cut there (byte-identical); else the
 * nearest window axis (or pier) where the mass, narrowed at most to MIN_SCALE of its width, covers whole windows only;
 * else null (draw no mass). Pure, no DOM: the extras builders call it with their wall's window spans.
 */

/** A window opening along the wall: its axis and half width (m), as facadeOrnaments.ts `windowSpans` gives it. */
export interface WallWindow { x: number; hw: number }
export interface ProjectionFit {
  /** the mass's centre along the wall (m) */
  x: number;
  /** its widths multiplied by this (1 = as designed) */
  scale: number;
  /** what moved: 'kept' (no window was cut), 'moved' or 'narrowed' */
  how: 'kept' | 'moved' | 'narrowed';
}

/** Overlap below this is touching, not cutting (m). */
export const CUT_EPS_M = 0.02;
/** A moved mass keeps this much wall between its side and the next window (m). */
export const CLEAR_M = 0.08;
/** A mass narrower than this share of its design is dropped rather than drawn as a sliver. */
export const MIN_SCALE = 0.6;

/** The windows the span [x0, x1] covers only in part. */
export function cutWindows(x0: number, x1: number, windows: readonly WallWindow[]): WallWindow[] {
  return windows.filter(w => {
    const a = w.x - w.hw, b = w.x + w.hw, over = Math.min(x1, b) - Math.max(x0, a);
    if (over <= CUT_EPS_M) return false;
    return a < x0 - CUT_EPS_M || b > x1 + CUT_EPS_M;
  });
}

/**
 * Where a mass of half width `halfW` wanted at `at` along a wall `len` long may stand without cutting a window, or null.
 * `windows` are every storey's spans the mass stands in front of (one list: the same axes repeat up the front).
 */
export function fitProjection(at: number, halfW: number, windows: readonly WallWindow[], len: number): ProjectionFit | null {
  if (!windows.length || !cutWindows(at - halfW, at + halfW, windows).length) return { x: at, scale: 1, how: 'kept' };
  const axes = [...new Set(windows.map(w => +w.x.toFixed(3)))].sort((p, q) => p - q);
  // Candidates: the window axes first (an oriel stands over a window, as built), nearest first; then the piers between
  // them (a narrower mass on blank wall), nearest first.
  const byDistance = (xs: number[]) => xs.sort((p, q) => Math.abs(p - at) - Math.abs(q - at) || p - q);
  const cands = [...byDistance([...axes]), ...byDistance(axes.slice(1).map((x, i) => (x + axes[i]) / 2))];
  for (const x of cands) {
    // The widest half width up to the design's that cuts no window: shrink to the near edge of each window cut, less a
    // clearance, until nothing is cut (each step only narrows, so it ends).
    let room = Math.min(halfW, x, len - x);
    // A window cut by the span, or cut by it widened by the clearance (an edge closer than CLEAR_M to its side).
    const near = (r: number) => [...cutWindows(x - r, x + r, windows), ...cutWindows(x - r - CLEAR_M, x + r + CLEAR_M, windows)];
    for (let cuts = near(room); cuts.length && room > 0; cuts = near(room))
      room = Math.min(...cuts.map(w => Math.abs(w.x - x) - w.hw - CLEAR_M));
    const own = windows.filter(w => Math.abs(w.x - x) < 1e-3).reduce((m, w) => Math.max(m, w.hw), 0);
    if (room < halfW * MIN_SCALE || (own && room < own)) continue;
    const scale = room >= halfW ? 1 : room / halfW;
    return { x, scale, how: scale === 1 ? 'moved' : 'narrowed' };
  }
  return null;
}

/** A probe for the regression gate (scripts/check-projection-windows.ts): every projection fitted, with its wall. */
export interface ProjectionProbeRow { id: string; kind: string; wantedX: number; halfW: number; len: number; windows: WallWindow[]; fit: ProjectionFit | null }
export const projectionProbe: { sink?: (row: ProjectionProbeRow) => void } = {};

/** fitProjection, reported to the probe when one listens. */
export function fitProjectionFor(id: string, kind: string, at: number, halfW: number, windows: readonly WallWindow[], len: number): ProjectionFit | null {
  const fit = fitProjection(at, halfW, windows, len);
  projectionProbe.sink?.({ id, kind, wantedX: at, halfW, len, windows: windows.map(w => ({ x: w.x, hw: w.hw })), fit });
  return fit;
}
