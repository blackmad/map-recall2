/**
 * Turns raw structural metrics for one façade delivery into a single
 * publish/no-publish judgement at the level being claimed.
 *
 * `facadeFeatureScore` measures openings, silhouette and colour and stops
 * there. `registrationStatus` says what a registration status may back, but
 * says nothing about how close the geometry actually is. Extraction passes
 * need one automatic answer: at the level this delivery claims, does the
 * evidence clear the gates?
 *
 * The gates are deliberately stricter as the claim gets stronger:
 *
 * - `city-geometry` trades in massing only, so it publishes on the presence of
 *   a result; no structural dimension is required.
 * - `recognizable-street` requires openings and silhouette to clear their
 *   gates.
 * - `measured-detail` requires openings, silhouette and colour to clear their
 *   gates.
 *
 * Missing evidence for a required dimension fails; present-but-weak evidence
 * fails with a reason naming the missed metric. Deterministic and pure: no DOM,
 * no I/O, no randomness.
 */

import {
  matchOpenings,
  contourDistance,
  colourConfusion,
  type Box,
  type ColourRegion,
} from './facadeFeatureScore.ts';
import type { DeliveryLevel } from './registrationStatus.ts';

export interface OpeningMetrics {
  precision: number;
  recall: number;
}

export interface AppearanceEvidence {
  openings: {
    references: Box[];
    predictions: Box[];
    iouThreshold?: number;
    sameKindOnly?: boolean;
  } | null;
  silhouette: {
    reference: [number, number][];
    predicted: [number, number][];
    closed?: boolean;
  } | null;
  colour: { references: ColourRegion[]; predictions: ColourRegion[] } | null;
}

export interface AppearanceScore {
  openings: OpeningMetrics | null;
  silhouetteMeanM: number | null;
  silhouetteP95M: number | null;
  /** agreements / total, null when no regions. */
  colourAgreement: number | null;
  level: DeliveryLevel;
  publishable: boolean;
  reasons: string[];
}

export interface AppearanceGates {
  minOpeningPrecision?: number;
  minOpeningRecall?: number;
  maxSilhouetteP95M?: number;
  minColourAgreement?: number;
}

/** Initial gates from the plan; every one is overridable per call. */
export const DEFAULT_MIN_OPENING_PRECISION = 0.95;
export const DEFAULT_MIN_OPENING_RECALL = 0.85;
export const DEFAULT_MAX_SILHOUETTE_P95_M = 0.5;
export const DEFAULT_MIN_COLOUR_AGREEMENT = 0.9;

/**
 * Score one delivery's appearance evidence against the gates for the level it
 * claims. `publishable` is true exactly when no required dimension failed.
 */
export function scoreAppearance(
  evidence: AppearanceEvidence,
  level: DeliveryLevel,
  options: AppearanceGates = {},
): AppearanceScore {
  const minOpeningPrecision = options.minOpeningPrecision ?? DEFAULT_MIN_OPENING_PRECISION;
  const minOpeningRecall = options.minOpeningRecall ?? DEFAULT_MIN_OPENING_RECALL;
  const maxSilhouetteP95M = options.maxSilhouetteP95M ?? DEFAULT_MAX_SILHOUETTE_P95_M;
  const minColourAgreement = options.minColourAgreement ?? DEFAULT_MIN_COLOUR_AGREEMENT;

  let openings: OpeningMetrics | null = null;
  let silhouetteMeanM: number | null = null;
  let silhouetteP95M: number | null = null;
  let silhouetteComparable = false;
  let colourAgreement: number | null = null;

  if (evidence.openings !== null) {
    const result = matchOpenings(evidence.openings.references, evidence.openings.predictions, {
      iouThreshold: evidence.openings.iouThreshold,
      sameKindOnly: evidence.openings.sameKindOnly,
    });
    openings = { precision: result.precision, recall: result.recall };
  }

  if (evidence.silhouette !== null) {
    const distance = contourDistance(evidence.silhouette.reference, evidence.silhouette.predicted, {
      closed: evidence.silhouette.closed,
    });
    silhouetteMeanM = distance.meanM;
    silhouetteP95M = distance.p95M;
    silhouetteComparable = distance.samples > 0;
  }

  if (evidence.colour !== null) {
    const confusion = colourConfusion(evidence.colour.references, evidence.colour.predictions);
    colourAgreement = confusion.total === 0 ? null : confusion.agreements / confusion.total;
  }

  // Only the dimensions the claimed level actually trades in are gated. A
  // weak non-required dimension is measured and reported but never blocks.
  const openingsRequired = level !== 'city-geometry';
  const silhouetteRequired = level !== 'city-geometry';
  const colourRequired = level === 'measured-detail';

  const reasons: string[] = [];

  if (openingsRequired) {
    if (openings === null) {
      reasons.push(`openings evidence is missing but required for ${level}`);
    } else {
      if (openings.precision < minOpeningPrecision) {
        reasons.push(
          `opening precision ${openings.precision} is below the ${minOpeningPrecision} gate for ${level}`,
        );
      }
      if (openings.recall < minOpeningRecall) {
        reasons.push(
          `opening recall ${openings.recall} is below the ${minOpeningRecall} gate for ${level}`,
        );
      }
    }
  }

  if (silhouetteRequired) {
    if (silhouetteP95M === null) {
      reasons.push(`silhouette evidence is missing but required for ${level}`);
    } else if (!silhouetteComparable) {
      reasons.push('silhouette contour has too few points to compare');
    } else if (silhouetteP95M > maxSilhouetteP95M) {
      reasons.push(
        `silhouette p95 ${silhouetteP95M} m exceeds the ${maxSilhouetteP95M} m gate for ${level}`,
      );
    }
  }

  if (colourRequired) {
    if (colourAgreement === null) {
      reasons.push(`colour evidence is missing but required for ${level}`);
    } else if (colourAgreement < minColourAgreement) {
      reasons.push(
        `colour agreement ${colourAgreement} is below the ${minColourAgreement} gate for ${level}`,
      );
    }
  }

  return {
    openings,
    silhouetteMeanM,
    silhouetteP95M,
    colourAgreement,
    level,
    publishable: reasons.length === 0,
    reasons,
  };
}
