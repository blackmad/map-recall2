// How far a view may move before a model outside it can enter (#129: signature-landmarks `_requestModels` walked its
// whole list on every frame that moved the view, ~0.8 s a minute at 4x, to find nothing to load). withinView's test,
// turned round: the margin by which an anchor lies outside the padded view, so a caller that found nothing near can
// skip the walk while the view's edges have moved less than the smallest margin.
import { DEFAULT_RESIDENCY_PAD, METRES_PER_DEGREE_LAT, type LngLatBounds } from './worldStreamer.js';

/**
 * Degrees by which withinView(view, anchor, radiusM, pad) is false: the larger of the lng and lat overshoots past the
 * padded, radius-widened view. <= 0 (or NaN) when the anchor is within it; Infinity without a finite anchor (never in
 * view). While no edge of the view moves by this much or more, withinView stays false.
 */
export function outsideSlack(view: LngLatBounds, anchor: readonly [number, number] | null | undefined, radiusM = 0, pad: { lng: number; lat: number } = DEFAULT_RESIDENCY_PAD): number {
  if (!anchor || !Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return Infinity;
  const dy = radiusM / METRES_PER_DEGREE_LAT;
  const dx = dy / Math.max(0.1, Math.cos((anchor[1] * Math.PI) / 180));
  const sx = Math.max(view.west - pad.lng - dx - anchor[0], anchor[0] - (view.east + pad.lng + dx));
  const sy = Math.max(view.south - pad.lat - dy - anchor[1], anchor[1] - (view.north + pad.lat + dy));
  return Math.max(sx, sy);
}

/** The largest move of any edge between two views, degrees (Infinity when either is missing). */
export function viewMove(a: LngLatBounds | null | undefined, b: LngLatBounds | null | undefined): number {
  if (!a || !b) return Infinity;
  return Math.max(Math.abs(a.west - b.west), Math.abs(a.east - b.east), Math.abs(a.south - b.south), Math.abs(a.north - b.north));
}

/**
 * Whether a walk that found no model near `then` can be skipped at `now`: every edge moved by less than half the
 * smallest slack (half: a margin for rounding at the edge, so the skip never decides differently from the walk).
 */
export function canSkipWalk(then: LngLatBounds | null | undefined, now: LngLatBounds | null | undefined, minSlack: number): boolean {
  const m = viewMove(then, now);
  return m === m && m < minSlack / 2;
}
