/** Reviewed source-bound inferred upper-floor rows.
 *
 * Why this exists: the source-space extractor reports `openingsComplete: true`
 * while sometimes missing a whole upper-floor window row (case-12 Rozengracht
 * 160 has two clear rows below its gable, the extraction found only the upper
 * one). The facade compiler deliberately never invents architecture inside a
 * described tier, so a missing row stays a blank wall in both the shape study
 * and the metric candidate. This module reconciles a measured gap with the
 * observed row rhythm: a reviewed correction names the observed anchor row, the
 * measured storey pitch and the ground-band top, and supplies pixel-measured
 * inferred openings. Their bounds are only accepted when the anchor-to-ground
 * gap is materially larger than one storey and the inferred row sits between
 * the anchor row and the ground band, so an inferred row cannot be placed over
 * masonry the source already explains.
 *
 * An inferred row is a declared *development* observation (`agent-inspected`)
 * with an explicit `inference` provenance. It is never a measurement or an
 * accepted registration, and it is confined to the reviewed 25-case set.
 */
import type { Bounds, FacadeFeature } from '../facadeDescription.ts';

export type FloorRowTier = 'full' | 'ground';

export interface InferredRowOpening {
  id: string;
  kind: 'window' | 'door';
  bounds: Bounds;
  head?: FacadeFeature['head'];
  frameColour?: string;
}

export interface FloorRowCorrection {
  /** The exact cached crop this correction was measured on. */
  source: { cropSha256: string; captureDate: string };
  /** Observed opening ids that form the rhythm the inferred row continues. */
  anchorRowIds: string[];
  /** Vertical pitch between the observed upper rows, in crop pixels. */
  pitchPx: number;
  /** Top of the ground band (shopfront/fascia); an inferred row stops above it. */
  groundBandTopPx: number;
  inferred: InferredRowOpening[];
  reason: string;
}

export interface FloorRowCorrectionSet {
  version: 1;
  scope: string;
  coordinateConvention: string;
  cases: Record<string, Partial<Record<FloorRowTier, FloorRowCorrection>>>;
}

export interface FloorRowInput {
  features: FacadeFeature[];
  cropSha256: string;
  captureDate: string;
}

/** Apply a reviewed floor-row correction to one tier's source features.
 *
 * Idempotent by feature id: a feature already carrying an inferred id is
 * replaced, never duplicated. Throws on a stale crop binding, a missing anchor,
 * a gap that is not materially larger than one storey, or a row that would not
 * sit in the measured gap, so a bad correction fails closed instead of painting
 * over masonry. With no correction the input array is returned unchanged, which
 * keeps every other case byte-identical. */
export function applyFloorRowCorrections(
  correction: FloorRowCorrection | undefined,
  input: FloorRowInput,
): FacadeFeature[] {
  if (!correction) return input.features;
  if (correction.source.cropSha256 !== input.cropSha256 || correction.source.captureDate !== input.captureDate)
    throw Error('Stale floor-row correction');
  if (!(correction.pitchPx > 0) || !(correction.groundBandTopPx > 0))
    throw Error('Floor-row correction needs a positive pitch and ground-band top');
  const anchors = correction.anchorRowIds.map((id) => input.features.find((feature) => feature.id === id));
  if (anchors.some((anchor) => !anchor)) throw Error('Floor-row correction anchor row is missing');
  const anchorBottom = Math.max(...anchors.map((anchor) => anchor!.bounds[3]));
  // The systematic precondition: the gap the observed rows leave to the ground
  // band is more than one storey, so a whole floor is unaccounted for.
  if (!(correction.groundBandTopPx - anchorBottom > correction.pitchPx * 1.5))
    throw Error('Floor-row correction gap is not larger than one storey');
  const inferredIds = new Set(correction.inferred.map((row) => row.id));
  if (inferredIds.size !== correction.inferred.length) throw Error('Floor-row correction has duplicate ids');
  for (const row of correction.inferred) {
    const [x0, y0, x1, y1] = row.bounds;
    if (!(x1 > x0 && y1 > y0)) throw Error(`Inferred floor row ${row.id} has invalid bounds`);
    // A separate floor below the anchor glass, still clear of the ground band.
    if (!(y0 >= anchorBottom && y1 <= correction.groundBandTopPx))
      throw Error(`Inferred floor row ${row.id} does not fit the measured gap`);
  }
  const kept = input.features.filter((feature) => !inferredIds.has(feature.id));
  for (const row of correction.inferred) {
    kept.push({
      ...row,
      head: row.head ?? 'rectangular',
      disposition: 'agent-inspected',
      // Provenance survives in the packet so a reader can tell a measured
      // opening from one reconciled against the observed rhythm.
      inference: 'observed-row-rhythm',
    } as FacadeFeature & { inference: string });
  }
  return kept;
}
