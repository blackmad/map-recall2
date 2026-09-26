/** Reviewed source-bound opening frame clearances.
 *
 * Why this exists: the facade compiler draws every observed opening with its
 * own frame border (default .14 m / 14 source pixels per side). Some real
 * windows sit only a couple of pixels apart — case-05 Lauriergracht 67/69
 * returns a 1.9 px glazing gap between a narrow window and the wide bay beside
 * it — so the two frames protrude across each other and the pair reads as one
 * overlapping blob in the source-shape study. The reviewed correction declares,
 * per opening, a clearance in source pixels: the frame may not extend further
 * than that, so the frames meet at the measured gap instead of crossing.
 *
 * This is deliberately opt-in and per feature. It changes only the openings a
 * reviewer names, so every other source study and metric candidate is
 * byte-stable, and it is not a measured frame width or a registration claim.
 * The applier fails closed on a stale crop binding and never mutates its input.
 */
import type { FacadeFeature } from '../facadeDescription.ts';

export type OpeningFrameTier = 'full' | 'ground';

export interface OpeningFrameClearance {
  featureId: string;
  /** Measured same-row glazing gap in source pixels; the frame is capped here. */
  clearancePx: number;
}

export interface OpeningFrameCorrection {
  source: { cropSha256: string; captureDate: string };
  clearances: OpeningFrameClearance[];
  reason: string;
}

export interface OpeningFrameCorrectionSet {
  version: 1;
  scope: string;
  coordinateConvention: string;
  cases: Record<string, Partial<Record<OpeningFrameTier, OpeningFrameCorrection>>>;
}

export interface OpeningFrameInput {
  features: FacadeFeature[];
  cropSha256: string;
  captureDate: string;
}

/** Apply one tier's reviewed frame clearances. Idempotent by feature id; with no
 * correction the input array is returned unchanged so other cases stay stable. */
export function applyOpeningFrameCorrections(
  correction: OpeningFrameCorrection | undefined,
  input: OpeningFrameInput,
): FacadeFeature[] {
  if (!correction) return input.features;
  if (correction.source.cropSha256 !== input.cropSha256 || correction.source.captureDate !== input.captureDate)
    throw Error('Stale opening-frame correction');
  if (!correction.clearances.length) return input.features;
  const known = new Set(input.features.map((feature) => feature.id));
  for (const entry of correction.clearances) {
    if (!(entry.clearancePx > 0)) throw Error(`Opening-frame clearance ${entry.featureId} must be positive`);
    if (!known.has(entry.featureId)) throw Error(`Opening-frame clearance ${entry.featureId} has no feature`);
  }
  const byId = new Map(correction.clearances.map((entry) => [entry.featureId, entry.clearancePx]));
  return input.features.map((feature) => {
    const clearancePx = byId.get(feature.id);
    return clearancePx === undefined ? feature : { ...feature, frameClearancePx: clearancePx };
  });
}
