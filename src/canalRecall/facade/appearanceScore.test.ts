import assert from 'node:assert/strict';
import {
  scoreAppearance,
  DEFAULT_MIN_COLOUR_AGREEMENT,
  DEFAULT_MIN_OPENING_PRECISION,
  DEFAULT_MIN_OPENING_RECALL,
  DEFAULT_MAX_SILHOUETTE_P95_M,
  type AppearanceEvidence,
} from './appearanceScore.ts';
import type { DeliveryLevel } from './registrationStatus.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks++;
  assert.ok(condition, label);
};

const close = (actual: number | null, expected: number, label: string, epsilon = 1e-9) => {
  checks++;
  assert.ok(actual !== null, `${label}: expected ${expected}, got null`);
  assert.ok(
    Math.abs((actual as number) - expected) < epsilon,
    `${label}: expected ${expected}, got ${actual}`,
  );
};

// 0. Gates mirror the plan's stated initial values.
assert.equal(DEFAULT_MIN_OPENING_PRECISION, 0.95);
assert.equal(DEFAULT_MIN_OPENING_RECALL, 0.85);
assert.equal(DEFAULT_MAX_SILHOUETTE_P95_M, 0.5);
assert.equal(DEFAULT_MIN_COLOUR_AGREEMENT, 0.9);

const perfectEvidence = (): AppearanceEvidence => ({
  openings: {
    references: [{ id: 'r1', kind: 'window', bounds: [10, 20, 110, 220] }],
    predictions: [{ id: 'p1', kind: 'window', bounds: [10, 20, 110, 220] }],
  },
  silhouette: {
    reference: [
      [0, 0],
      [0, 10],
      [6, 10],
      [6, 0],
    ],
    predicted: [
      [0, 0],
      [0, 10],
      [6, 10],
      [6, 0],
    ],
  },
  colour: {
    references: [{ region: 'wall', colour: 'brick' }],
    predictions: [{ region: 'wall', colour: 'brick' }],
  },
});

// 1. Perfect evidence publishes at every level.
for (const level of ['city-geometry', 'recognizable-street', 'measured-detail'] as DeliveryLevel[]) {
  const score = scoreAppearance(perfectEvidence(), level);
  check(score.publishable, `perfect evidence publishes at ${level}`);
  check(score.reasons.length === 0, `perfect evidence has no reasons at ${level}`);
  close(score.openings?.precision ?? null, 1, `perfect precision at ${level}`);
  close(score.openings?.recall ?? null, 1, `perfect recall at ${level}`);
  close(score.silhouetteP95M, 0, `perfect silhouette p95 at ${level}`);
  close(score.colourAgreement, 1, `perfect colour agreement at ${level}`);
}

// 2. Openings below recall at street level fail, and the reason names recall.
{
  const evidence = perfectEvidence();
  evidence.openings = {
    references: [
      { kind: 'window', bounds: [0, 0, 10, 10] },
      { kind: 'window', bounds: [20, 0, 30, 10] },
    ],
    predictions: [{ kind: 'window', bounds: [0, 0, 10, 10] }],
  };
  const score = scoreAppearance(evidence, 'recognizable-street');
  assert.equal(score.publishable, false, 'low recall is not publishable at street level');
  check(
    score.reasons.some((reason) => reason.includes('recall')),
    'reason names recall',
  );
  close(score.openings?.recall ?? null, 0.5, 'recall is 0.5');
  check(score.level === 'recognizable-street', 'score reports the claimed level');
}

// 3. Silhouette p95 above 0.50 m fails even with perfect openings.
{
  const evidence = perfectEvidence();
  evidence.silhouette = {
    reference: [
      [0, 0],
      [0, 10],
      [6, 10],
      [6, 0],
    ],
    predicted: [
      [1, 0],
      [1, 10],
      [7, 10],
      [7, 0],
    ],
  };
  const score = scoreAppearance(evidence, 'recognizable-street');
  assert.equal(score.publishable, false, 'silhouette over 0.50 m is not publishable');
  check(
    score.reasons.some((reason) => reason.includes('p95')),
    'reason names p95',
  );
  check((score.silhouetteP95M ?? 0) > 0.5, 'measured p95 is above the gate');
}

// 4. Colour missing at measured-detail fails; colour is not required at street.
{
  const missing = perfectEvidence();
  missing.colour = null;
  const detail = scoreAppearance(missing, 'measured-detail');
  assert.equal(detail.publishable, false, 'missing colour blocks measured-detail');
  check(
    detail.reasons.some((reason) => reason.includes('colour')),
    'missing-colour reason names colour',
  );
  assert.equal(detail.colourAgreement, null, 'missing colour reports null agreement');

  const street = scoreAppearance(missing, 'recognizable-street');
  assert.equal(street.publishable, true, 'missing colour does not block street level');

  // A present-but-weak colour is likewise non-blocking below measured-detail.
  const weak = perfectEvidence();
  weak.colour = {
    references: [{ region: 'wall', colour: 'brick' }],
    predictions: [{ region: 'wall', colour: 'plaster' }],
  };
  const weakStreet = scoreAppearance(weak, 'recognizable-street');
  assert.equal(weakStreet.publishable, true, 'weak colour does not block street level');
  close(weakStreet.colourAgreement, 0, 'weak colour agreement is 0');
  assert.equal(
    scoreAppearance(weak, 'measured-detail').publishable,
    false,
    'weak colour blocks measured-detail',
  );
}

// 5. city-geometry with all-null evidence still publishes (massing only).
{
  const score = scoreAppearance(
    { openings: null, silhouette: null, colour: null },
    'city-geometry',
  );
  assert.equal(score.publishable, true, 'city-geometry publishes with no metrics');
  assert.equal(score.openings, null, 'openings stay null');
  assert.equal(score.silhouetteMeanM, null, 'silhouette mean stays null');
  assert.equal(score.silhouetteP95M, null, 'silhouette p95 stays null');
  assert.equal(score.colourAgreement, null, 'colour agreement stays null');
  assert.deepEqual(score.reasons, [], 'no reasons at city-geometry');
}

// 6. Missing openings/silhouette at street level fail with named dimensions.
{
  const score = scoreAppearance(
    { openings: null, silhouette: null, colour: null },
    'recognizable-street',
  );
  assert.equal(score.publishable, false, 'all-null street level fails');
  check(
    score.reasons.some((reason) => reason.includes('openings')),
    'reason names openings',
  );
  check(
    score.reasons.some((reason) => reason.includes('silhouette')),
    'reason names silhouette',
  );
}

// 7. Options override the gates; a relaxed recall gate publishes.
{
  const evidence = perfectEvidence();
  evidence.openings = {
    references: [
      { kind: 'window', bounds: [0, 0, 10, 10] },
      { kind: 'window', bounds: [20, 0, 30, 10] },
    ],
    predictions: [{ kind: 'window', bounds: [0, 0, 10, 10] }],
  };
  const score = scoreAppearance(evidence, 'recognizable-street', { minOpeningRecall: 0.4 });
  assert.equal(score.publishable, true, 'relaxed recall gate publishes');
}

// 8. Determinism: identical input, identical result.
{
  const a = scoreAppearance(perfectEvidence(), 'measured-detail');
  const b = scoreAppearance(perfectEvidence(), 'measured-detail');
  assert.deepEqual(a, b, 'scoreAppearance is deterministic');
}

console.log(`appearanceScore.test.ts: ${checks} checks passed`);
