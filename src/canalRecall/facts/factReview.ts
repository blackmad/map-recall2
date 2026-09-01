// What a human has said about generated facts, and what may therefore ship.
//
// The generator is a 4B model writing sentences from Wikipedia sections. Its
// deterministic checks prove every number occurs in the source, while a
// separate local-model pass checks that the evidence entails the complete
// paraphrase. A person still reads the review sheet before publication.
//
// It fails closed, in the same shape as `facadeEvidence.ts`: a feature with no
// label does not ship, a label written against a different generator version
// does not ship, and an individually struck sentence does not ship even though
// its feature was approved. Silence is never approval — an unreviewed batch
// publishing itself is precisely how a learning game starts teaching things
// nobody checked.

import type { Fact, FeatureFacts } from './factTypes';

export interface FeatureFactLabel {
  /** `approved` publishes the feature's facts; `rejected` publishes none. */
  verdict: 'approved' | 'rejected';
  /**
   * Sentences struck by the reviewer, matched by exact text. Kept as text
   * rather than an index so that regenerating the batch cannot silently move
   * a strike onto a different sentence.
   */
  drop?: string[];
  /** Free-text note from the reviewer, for the next person reading the file. */
  note?: string;
}

export interface FactReviewFile {
  reviewedAt?: string;
  /** The generator whose output was read. A later generator has not been
   *  reviewed, whatever this file says. */
  generatorVersion?: string;
  features?: Record<string, FeatureFactLabel | undefined>;
}

export type FactRejectionReason =
  | 'unreviewed'
  | 'human-rejected'
  | 'invalid-verdict'
  | 'review-predates-this-generator'
  | 'invalid-provenance'
  | 'struck-by-reviewer';

export interface FactRejection {
  id: string;
  reason: FactRejectionReason;
  /** Set when one sentence was struck rather than a whole feature. */
  text?: string;
}

export interface ReviewedFacts {
  published: FeatureFacts[];
  rejected: FactRejection[];
}

/**
 * Select the facts a reviewer's labels permit publishing.
 *
 * `generatorVersion` is the version of the *staged batch*. A review file that
 * names a different one was written about different sentences, so every
 * feature in the batch counts as unreviewed rather than approved — which is
 * the difference between a stale review being caught and a stale review
 * shipping.
 */
export function selectReviewedFacts(
  staged: readonly FeatureFacts[],
  review: FactReviewFile,
  generatorVersion: string,
): ReviewedFacts {
  const published: FeatureFacts[] = [];
  const rejected: FactRejection[] = [];
  const stale = Boolean(review.generatorVersion) && review.generatorVersion !== generatorVersion;

  for (const feature of staged) {
    if (stale) {
      rejected.push({ id: feature.id, reason: 'review-predates-this-generator' });
      continue;
    }
    const label = review.features?.[feature.id];
    if (!label) {
      rejected.push({ id: feature.id, reason: 'unreviewed' });
      continue;
    }
    if (label.verdict !== 'approved' && label.verdict !== 'rejected') {
      rejected.push({ id: feature.id, reason: 'invalid-verdict' });
      continue;
    }
    if (label.verdict === 'rejected') {
      rejected.push({ id: feature.id, reason: 'human-rejected' });
      continue;
    }
    const struck = new Set((label.drop || []).map((text) => text.trim()));
    const facts: Fact[] = [];
    for (const fact of feature.facts) {
      if (struck.has(fact.text.trim())) {
        rejected.push({ id: feature.id, reason: 'struck-by-reviewer', text: fact.text });
        continue;
      }
      if (!fact.text || !fact.sourceQuote
        || !/^https:\/\/[^/]+\.wikipedia\.org\//.test(fact.sourceUrl)
        || !fact.license || !fact.retrievedAt || !fact.model
        || fact.verification !== 'grounded' || !fact.verifierModel) {
        rejected.push({ id: feature.id, reason: 'invalid-provenance', text: fact.text });
        continue;
      }
      facts.push(fact);
    }
    // Approving a feature and striking every one of its sentences is a
    // rejection with extra steps; publishing an empty entry would leave the
    // runtime a feature that opens a card with nothing in it.
    if (!facts.length) {
      rejected.push({ id: feature.id, reason: 'human-rejected' });
      continue;
    }
    published.push({ ...feature, facts });
  }
  return { published, rejected };
}

/** Count rejections by reason, for the publish script's report. */
export function summariseRejections(rejections: readonly FactRejection[]): Map<FactRejectionReason, number> {
  const counts = new Map<FactRejectionReason, number>();
  for (const rejection of rejections) {
    counts.set(rejection.reason, (counts.get(rejection.reason) || 0) + 1);
  }
  return counts;
}
