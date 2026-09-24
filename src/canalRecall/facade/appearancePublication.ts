/**
 * Whether an appearance observation may be drawn, and what earned it that.
 *
 * Until now this was a bare string literal in two publish scripts. Every value
 * ever written was a refusal — `quarantined-machine-preview`,
 * `withheld-source-audit-only`, `revoked-machine-observation`,
 * `candidate-registration-preview` — and no accepted state existed anywhere in
 * the repository. The district release reports `reviewed: 0, accepted: 0` not
 * because nobody has reviewed anything but because nothing could record that
 * they had. A grading desk had nothing to write into.
 *
 * So this module is the missing half: the vocabulary, the one value that means
 * a person looked and agreed, and the rule that decides when a grade still
 * applies.
 *
 * The rule is the part worth reading. A grade is an assertion about *specific
 * pixels* — this hex matches this wall in this crop. Re-run the measurer with a
 * different percentile, a different mask, or a re-cut crop, and the grade now
 * points at pixels its grader never saw. Silently carrying it forward would
 * publish a human-confirmed colour that no human confirmed. So a grade binds to
 * the crop's content hash, and a mismatch demotes rather than promotes. This
 * repeats the check `scripts/review/refresh-reviewed-wall-colour.ts` already
 * makes against `review.source.sha256`; the failure it prevents has bitten this
 * codebase before.
 */

/**
 * Publication states, ordered from least to most permissive.
 *
 * Only `accepted-human-reviewed` may be drawn as measured. Everything else is
 * some flavour of "not yet", and the distinctions between them are about *why*,
 * because a reader deciding whether to spend review effort needs to know
 * whether the evidence was never looked at, looked at and rejected, or
 * withdrawn after the fact.
 */
export type AppearancePublication =
  /** Source was audited but no proposal survived; nothing to review. */
  | 'withheld-source-audit-only'
  /** A machine proposed it and no person has looked. The default. */
  | 'quarantined-machine-preview'
  /** Geometry registration is proposed but unconfirmed. */
  | 'candidate-registration-preview'
  /** A person looked and rejected it, or it was withdrawn after publication. */
  | 'revoked-machine-observation'
  /** A person looked at this evidence and agreed. The only drawable state. */
  | 'accepted-human-reviewed';

/** The only state whose appearance may render as measured. */
export const isDrawableAsMeasured = (publication: AppearancePublication): boolean =>
  publication === 'accepted-human-reviewed';

export type GradeVerdict =
  /** The measurement matches the evidence as-is. */
  | 'accept'
  /** The wall is legible but the measurement is off; `correctedHex` supersedes it. */
  | 'adjust'
  /** Occluded, shadowed or mixed beyond use — publish nothing for this wall. */
  | 'unusable'
  /** Deferred. Carries no opinion and never changes publication. */
  | 'skip';

export interface AppearanceGrade {
  observationId: string;
  verdict: GradeVerdict;
  /** Required when the verdict is `adjust`; ignored otherwise. */
  correctedHex?: string;
  /** Free-form chips from the desk: `occluded`, `shadow`, `mixed-materials`, … */
  reasons?: readonly string[];
  /**
   * Content hash of the crop this grade was given against. The grade is an
   * assertion about these pixels and no others.
   */
  sourceSha256: string;
  /** ISO 8601. */
  gradedAt: string;
  grader: string;
}

export interface PublicationDecision {
  publication: AppearancePublication;
  /** Why, in words a reader of the release can act on. */
  reason: string;
  /** The colour to publish, when one was earned. */
  hex?: string;
  /** True when a grade existed but did not survive the binding check. */
  stale: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;

export interface ResolveInput {
  /** The state the record carries today, before any grade is applied. */
  current: AppearancePublication;
  /** The grade for this observation, if one was exported. */
  grade?: AppearanceGrade;
  /** The crop's content hash *now*, as the current measurement run sees it. */
  sourceSha256: string;
  /** The measured colour this run produced, if any. */
  measuredHex?: string;
}

/**
 * Decide an observation's publication state from its grade.
 *
 * Promotion is the narrow path: a grade that agrees, bound to the pixels it was
 * given against, carrying a usable colour. Everything else leaves the record
 * where it was or demotes it, and says so.
 */
export function resolvePublication(input: ResolveInput): PublicationDecision {
  const { current, grade, sourceSha256, measuredHex } = input;

  if (!grade) {
    return { publication: current, reason: 'no grade recorded', stale: false };
  }

  // The binding check, before anything else is considered. A grade about other
  // pixels is not a weaker grade, it is not a grade.
  if (!grade.sourceSha256 || grade.sourceSha256 !== sourceSha256) {
    return {
      publication: current === 'accepted-human-reviewed' ? 'quarantined-machine-preview' : current,
      reason: `grade was given against crop ${grade.sourceSha256.slice(0, 12) || '(none)'}…, evidence is now ${sourceSha256.slice(0, 12)}…`,
      stale: true,
    };
  }

  switch (grade.verdict) {
    case 'skip':
      return { publication: current, reason: 'deferred by the grader', stale: false };

    case 'unusable':
      return {
        publication: 'revoked-machine-observation',
        reason: grade.reasons?.length
          ? `grader found the wall unusable: ${grade.reasons.join(', ')}`
          : 'grader found the wall unusable',
        stale: false,
      };

    case 'adjust': {
      const hex = grade.correctedHex;
      if (!hex || !HEX.test(hex)) {
        return {
          publication: current,
          reason: 'adjusted without a valid replacement colour',
          stale: false,
        };
      }
      return {
        publication: 'accepted-human-reviewed',
        reason: `grader corrected the measurement to ${hex.toLowerCase()}`,
        hex: hex.toLowerCase(),
        stale: false,
      };
    }

    case 'accept': {
      if (!measuredHex || !HEX.test(measuredHex)) {
        return {
          publication: current,
          reason: 'accepted, but this run produced no valid measured colour to publish',
          stale: false,
        };
      }
      return {
        publication: 'accepted-human-reviewed',
        reason: 'grader confirmed the measurement against the source crop',
        hex: measuredHex.toLowerCase(),
        stale: false,
      };
    }
  }
}

export interface PublicationTally {
  accepted: number;
  revoked: number;
  quarantined: number;
  stale: number;
  ungraded: number;
}

/** A release-level count, so `current.json` can stop reporting `accepted: 0`. */
export function tallyPublications(decisions: readonly PublicationDecision[]): PublicationTally {
  const tally: PublicationTally = { accepted: 0, revoked: 0, quarantined: 0, stale: 0, ungraded: 0 };
  for (const decision of decisions) {
    if (decision.stale) tally.stale += 1;
    if (decision.publication === 'accepted-human-reviewed') tally.accepted += 1;
    else if (decision.publication === 'revoked-machine-observation') tally.revoked += 1;
    else if (decision.reason === 'no grade recorded') tally.ungraded += 1;
    else tally.quarantined += 1;
  }
  return tally;
}
