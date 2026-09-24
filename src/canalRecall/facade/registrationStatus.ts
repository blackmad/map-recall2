/**
 * What we are allowed to say about a façade registration, and what we are
 * allowed to publish because of it.
 *
 * The pipeline historically had a single gate: metric registration at
 * uncertainty ≤ 0.15 m, with the identity/wall checks supplied as booleans by
 * the caller. That binary was too coarse in both directions. It forced a
 * recognizable street view — identity confirmed, the right wall confirmed, and
 * a pixel→wall transform fitted to independent anchors — to be called either
 * "registered" (a metric claim it cannot support) or "abstained" (discarding
 * a view that is plainly usable). The result on real data was 24/24
 * abstentions, because `uncertaintyM` was never produced.
 *
 * This module separates three claims:
 *
 * - `registered` — the strong metric claim, ≤ {@link MAX_REGISTERED_UNCERTAINTY_M}
 *   with every alignment check resolved.
 * - `correspondence-verified` — a middle claim for `recognizable-street`
 *   delivery: the building and wall are right and the transform is corroborated
 *   by ≥ {@link MIN_STREET_ANCHORS} independent correspondences within bounded
 *   residual, without asserting 0.15 m.
 * - `preview` — a transform exists, nothing validated it. Usable for massing,
 *   never for appearance.
 *
 * `abstained` is the hard floor: identity or wall unverified, or no transform.
 *
 * Deliberately pure: no DOM, no I/O, no metrics library.
 */

export type RegistrationStatus = 'registered' | 'correspondence-verified' | 'preview' | 'abstained';

/** How much fidelity a consumer is about to claim from a registration. */
export type DeliveryLevel = 'city-geometry' | 'recognizable-street' | 'measured-detail';

export interface RegistrationEvidence {
  /** Correct building. */
  identityVerified: boolean;
  /** Correct wall/elevation. */
  wallVerified: boolean;
  /** A pixel→wall transform was supplied. */
  hasTransform: boolean;
  /** Metric uncertainty for the 'registered' claim. */
  uncertaintyM: number | null;
  /** Independent-anchor residual, in metres. */
  residualM: { median: number; p95: number } | null;
  /** Count of independent correspondences. */
  independentAnchors: number;
  alignmentFlags: {
    wallIdentity: boolean;
    boundaryEvidence: boolean;
    rooflineEvidence: boolean;
    cameraHeightResolved: boolean;
    orientationVerified: boolean;
  } | null;
}

export interface RegistrationDecision {
  status: RegistrationStatus;
  reasons: string[];
}

/** Largest metric uncertainty still called "registered". */
export const MAX_REGISTERED_UNCERTAINTY_M = 0.15;
/** Largest median independent-anchor residual for "correspondence-verified". */
export const MAX_STREET_RESIDUAL_MEDIAN_M = 0.25;
/** Largest p95 independent-anchor residual for "correspondence-verified". */
export const MAX_STREET_RESIDUAL_P95_M = 0.5;
/** Fewest independent anchors that can corroborate a street registration. */
export const MIN_STREET_ANCHORS = 3;

type AlignmentFlags = NonNullable<RegistrationEvidence['alignmentFlags']>;

/** Named in the interface's own order, so reasons read predictably. */
const ALIGNMENT_CHECKS: ReadonlyArray<readonly [keyof AlignmentFlags, string]> = [
  ['wallIdentity', 'wall identity'],
  ['boundaryEvidence', 'boundary evidence'],
  ['rooflineEvidence', 'roofline evidence'],
  ['cameraHeightResolved', 'camera height'],
  ['orientationVerified', 'orientation'],
];

/** Conditions that stop evidence being called `registered`. Empty when it qualifies. */
function registeredFailures(evidence: RegistrationEvidence): string[] {
  const failures: string[] = [];
  if (evidence.uncertaintyM === null) {
    failures.push('metric uncertainty is missing, so the ±0.15 m claim cannot be made');
  } else if (evidence.uncertaintyM > MAX_REGISTERED_UNCERTAINTY_M) {
    failures.push(
      `metric uncertainty ${evidence.uncertaintyM} m exceeds ${MAX_REGISTERED_UNCERTAINTY_M} m`,
    );
  }
  if (evidence.alignmentFlags === null) {
    failures.push('alignment flags were not recorded');
  } else {
    for (const [key, label] of ALIGNMENT_CHECKS) {
      if (!evidence.alignmentFlags[key]) failures.push(`${label} check failed`);
    }
  }
  return failures;
}

/** Conditions that stop evidence being called `correspondence-verified`. Empty when it qualifies. */
function correspondenceFailures(evidence: RegistrationEvidence): string[] {
  const failures: string[] = [];
  if (evidence.independentAnchors < MIN_STREET_ANCHORS) {
    failures.push(
      `only ${evidence.independentAnchors} independent anchor(s), need ${MIN_STREET_ANCHORS}`,
    );
  }
  if (evidence.residualM === null) {
    failures.push('independent-anchor residual is missing');
  } else {
    if (evidence.residualM.median > MAX_STREET_RESIDUAL_MEDIAN_M) {
      failures.push(
        `anchor residual median ${evidence.residualM.median} m exceeds ${MAX_STREET_RESIDUAL_MEDIAN_M} m`,
      );
    }
    if (evidence.residualM.p95 > MAX_STREET_RESIDUAL_P95_M) {
      failures.push(
        `anchor residual p95 ${evidence.residualM.p95} m exceeds ${MAX_STREET_RESIDUAL_P95_M} m`,
      );
    }
  }
  return failures;
}

/**
 * Decide the registration status for one evidence record.
 *
 * Priority: hard gates (identity/wall/transform) → `registered` →
 * `correspondence-verified` → `preview`. `reasons` names the conditions that
 * failed on the way to the returned status, so a reviewer can see which
 * promotion was denied and why.
 */
export function evaluateRegistration(evidence: RegistrationEvidence): RegistrationDecision {
  const hardFailures: string[] = [];
  if (!evidence.identityVerified) hardFailures.push('building identity is not verified');
  if (!evidence.wallVerified) hardFailures.push('wall/elevation is not verified');
  if (hardFailures.length > 0) return { status: 'abstained', reasons: hardFailures };
  if (!evidence.hasTransform) {
    return { status: 'abstained', reasons: ['no pixel→wall transform was supplied'] };
  }

  const registered = registeredFailures(evidence);
  if (registered.length === 0) {
    return {
      status: 'registered',
      reasons: [
        `metric registration within ±${MAX_REGISTERED_UNCERTAINTY_M} m with every alignment check satisfied`,
      ],
    };
  }

  const correspondence = correspondenceFailures(evidence);
  if (correspondence.length === 0) {
    return {
      status: 'correspondence-verified',
      reasons: [
        ...registered,
        `corroborated by ${evidence.independentAnchors} independent anchors within residual bounds`,
      ],
    };
  }

  return {
    status: 'preview',
    reasons: [...registered, ...correspondence, 'transform exists but is not validated'],
  };
}

/**
 * Whether a registration may back a given delivery level.
 *
 * `city-geometry` trades on massing only and may use a preview transform;
 * `recognizable-street` needs identity/wall plus a corroborated transform;
 * `measured-detail` needs the full metric claim. `abstained` publishes nothing.
 */
export function canPublish(level: DeliveryLevel, status: RegistrationStatus): boolean {
  switch (level) {
    case 'measured-detail':
      return status === 'registered';
    case 'recognizable-street':
      return status === 'registered' || status === 'correspondence-verified';
    case 'city-geometry':
      return status !== 'abstained';
    default: {
      const exhaustive: never = level;
      throw new Error(`unknown delivery level: ${String(exhaustive)}`);
    }
  }
}
