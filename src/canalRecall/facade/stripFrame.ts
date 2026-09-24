/**
 * Copied verbatim from `feat/roofline-strips` commit `eaf084b` (worktree
 * `.worktrees/roofline-strips`), which isn't merged here. Update by re-copying
 * from that branch, not by editing independently.
 *
 * The exact frame a rectified façade strip was rendered in.
 *
 * A strip is a resampling, and every downstream measurement in metres depends
 * on knowing *which* metres. The generator used to certify a strip with a
 * rounded `size` and a requested pixels-per-metre, which is not enough: a
 * reader had to reconstruct the wall endpoints, the vertical extent and the
 * horizontal margin from the building record, and a reconstruction is where the
 * openings run lost its offsets. So the generator records the frame here, from
 * the same numbers it handed the renderer, and nobody reconstructs anything.
 *
 * The convention matches §3 of the rooflines plan: `along` runs from the wall's
 * `start` towards its `end`, and `up` is absolute NAP. This module does not
 * choose a wall; it describes the one that was chosen, including which of its
 * two endpoints the strip's left edge sits on.
 */
import type { ProjectedPoint } from './sources.ts';

export interface StripFrameInput {
  /** The wall's RD endpoints, in the order the renderer walked them. */
  wallStart: ProjectedPoint;
  wallEnd: ProjectedPoint;
  /** NAP of the strip's bottom edge, as passed to the renderer. */
  bottomNap: number;
  /** NAP of the strip's top edge, as passed to the renderer. */
  topNap: number;
  /** Total width multiplier the renderer applied to the wall length. */
  marginFactor: number;
  /** Pixels per metre the renderer was asked for, before any downscale. */
  requestedPixelsPerMetre: number;
  /** Width of the JPEG actually returned. */
  renderedWidth: number;
  /** Height of the JPEG actually returned. */
  renderedHeight: number;
}

export interface StripFrame {
  start: ProjectedPoint;
  end: ProjectedPoint;
  /** Which endpoint of the wall the strip's leftmost column sits on. */
  leftEdge: 'start' | 'end';
  bottomNap: number;
  topNap: number;
  marginFactor: number;
  /** Horizontal margin beyond each end of the wall, in metres. */
  marginM: number;
  requestedPixelsPerMetre: number;
  /** Exact horizontal pixels per metre in the returned image. */
  pixelsPerMetreX: number;
  /** Exact vertical pixels per metre in the returned image. */
  pixelsPerMetreY: number;
}

/** Describe, not choose: the frame of a wall the renderer already cut. */
export function stripFrame(input: StripFrameInput): StripFrame {
  const wallWidthM = Math.hypot(input.wallEnd.x - input.wallStart.x, input.wallEnd.y - input.wallStart.y);
  const coveredWidthM = wallWidthM * input.marginFactor;
  const coveredHeightM = input.topNap - input.bottomNap;
  return {
    start: { x: input.wallStart.x, y: input.wallStart.y },
    end: { x: input.wallEnd.x, y: input.wallEnd.y },
    // `rectifyWall` samples from `start` along the wall towards `end`, with a
    // symmetric margin, so the strip's left edge is always the start side.
    leftEdge: 'start',
    bottomNap: input.bottomNap,
    topNap: input.topNap,
    marginFactor: input.marginFactor,
    marginM: (wallWidthM * (input.marginFactor - 1)) / 2,
    requestedPixelsPerMetre: input.requestedPixelsPerMetre,
    pixelsPerMetreX: coveredWidthM > 0 ? input.renderedWidth / coveredWidthM : 0,
    pixelsPerMetreY: coveredHeightM > 0 ? input.renderedHeight / coveredHeightM : 0,
  };
}

export interface Positioned {
  readonly point: ProjectedPoint;
}

/** Are two capture positions far enough apart to count as different views? */
export function isAtLeastApart(a: Positioned, b: Positioned, minSeparationM: number): boolean {
  return Math.hypot(a.point.x - b.point.x, a.point.y - b.point.y) >= minSeparationM;
}

/**
 * The best `count` candidates no two of which were captured within
 * `minSeparationM` of each other.
 *
 * Taking the top `n` by quality alone can return `n` frames of one pass on one
 * afternoon: they agree with each other because they share a pose and an
 * obstruction, so a consensus between them is not evidence. Requiring a
 * separation in *position* is the cheapest way to make the set genuinely
 * independent before spending a render on it. Order is preserved, so the best
 * view is still the first.
 */
export function pickDistinctViews<T extends Positioned>(
  ordered: readonly T[], count: number, minSeparationM = 3,
): T[] {
  const chosen: T[] = [];
  for (const candidate of ordered) {
    if (chosen.length >= count) break;
    if (chosen.some(c => !isAtLeastApart(c, candidate, minSeparationM))) continue;
    chosen.push(candidate);
  }
  return chosen;
}
