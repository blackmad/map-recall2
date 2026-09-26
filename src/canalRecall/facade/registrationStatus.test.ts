import assert from 'node:assert/strict';
import {
  canPublish,
  evaluateRegistration,
  MAX_REGISTERED_UNCERTAINTY_M,
  MAX_STREET_RESIDUAL_MEDIAN_M,
  MAX_STREET_RESIDUAL_P95_M,
  MIN_STREET_ANCHORS,
  type RegistrationEvidence,
} from './registrationStatus.ts';

const perfectEvidence = (): RegistrationEvidence => ({
  identityVerified: true,
  wallVerified: true,
  hasTransform: true,
  uncertaintyM: 0.1,
  residualM: { median: 0.1, p95: 0.2 },
  independentAnchors: 5,
  alignmentFlags: {
    wallIdentity: true,
    boundaryEvidence: true,
    rooflineEvidence: true,
    cameraHeightResolved: true,
    orientationVerified: true,
  },
});

// Named thresholds are the shared contract; a change here changes every test.
assert.equal(MAX_REGISTERED_UNCERTAINTY_M, 0.15);
assert.equal(MAX_STREET_RESIDUAL_MEDIAN_M, 0.25);
assert.equal(MAX_STREET_RESIDUAL_P95_M, 0.5);
assert.equal(MIN_STREET_ANCHORS, 3);

// 1. Perfect evidence is metric-registered and publishable as measured detail.
{
  const decision = evaluateRegistration(perfectEvidence());
  assert.equal(decision.status, 'registered');
  assert.ok(decision.reasons.length > 0, 'registered carries an explanatory reason');
  assert.equal(canPublish('measured-detail', decision.status), true);
  assert.equal(canPublish('recognizable-street', decision.status), true);
  assert.equal(canPublish('city-geometry', decision.status), true);
}

// 2. Identity + wall + transform + 3 anchors within residual: the middle status.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    alignmentFlags: null,
  };
  const decision = evaluateRegistration(evidence);
  assert.equal(decision.status, 'correspondence-verified');
  assert.equal(canPublish('recognizable-street', decision.status), true);
  assert.equal(canPublish('measured-detail', decision.status), false);
  assert.equal(canPublish('city-geometry', decision.status), true);
}

// 3. Transform but no anchors: preview, street-refused, city-geometry allowed.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    alignmentFlags: null,
    independentAnchors: 0,
    residualM: null,
  };
  const decision = evaluateRegistration(evidence);
  assert.equal(decision.status, 'preview');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('anchor')),
    'preview names the missing anchors',
  );
  assert.equal(canPublish('recognizable-street', decision.status), false);
  assert.equal(canPublish('city-geometry', decision.status), true);
  assert.equal(canPublish('measured-detail', decision.status), false);
}

// 4. Identity false abstains even with an otherwise perfect transform.
{
  const decision = evaluateRegistration({ ...perfectEvidence(), identityVerified: false });
  assert.equal(decision.status, 'abstained');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('identity')),
    'abstention names the identity gate',
  );
  assert.equal(canPublish('city-geometry', decision.status), false);
  assert.equal(canPublish('recognizable-street', decision.status), false);
  assert.equal(canPublish('measured-detail', decision.status), false);
}

// 5. Wall false abstains, independently of the identity gate.
{
  const decision = evaluateRegistration({ ...perfectEvidence(), wallVerified: false });
  assert.equal(decision.status, 'abstained');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('wall')),
    'abstention names the wall gate',
  );
}

// 6. No transform abstains even when identity and wall are verified.
{
  const decision = evaluateRegistration({ ...perfectEvidence(), hasTransform: false });
  assert.equal(decision.status, 'abstained');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('transform')),
    'abstention names the missing transform',
  );
}

// 7. Residual median just over the bound falls from verified to preview.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    independentAnchors: 4,
    residualM: { median: MAX_STREET_RESIDUAL_MEDIAN_M + 0.01, p95: 0.4 },
  };
  assert.equal(evaluateRegistration(evidence).status, 'preview');
}

// 8. Residual p95 just over the bound falls from verified to preview.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    independentAnchors: 4,
    residualM: { median: 0.2, p95: MAX_STREET_RESIDUAL_P95_M + 0.01 },
  };
  assert.equal(evaluateRegistration(evidence).status, 'preview');
}

// 9. Exactly at the registered uncertainty boundary passes.
{
  const decision = evaluateRegistration({
    ...perfectEvidence(),
    uncertaintyM: MAX_REGISTERED_UNCERTAINTY_M,
  });
  assert.equal(decision.status, 'registered');
}

// 10. Exactly at the correspondence residual and anchor boundaries passes.
{
  const decision = evaluateRegistration({
    ...perfectEvidence(),
    uncertaintyM: MAX_REGISTERED_UNCERTAINTY_M + 0.01,
    independentAnchors: MIN_STREET_ANCHORS,
    residualM: { median: MAX_STREET_RESIDUAL_MEDIAN_M, p95: MAX_STREET_RESIDUAL_P95_M },
  });
  assert.equal(decision.status, 'correspondence-verified');
  assert.equal(canPublish('recognizable-street', decision.status), true);
}

// 11. One anchor below the minimum is not verified.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    independentAnchors: MIN_STREET_ANCHORS - 1,
    residualM: { median: 0.05, p95: 0.1 },
  };
  assert.equal(evaluateRegistration(evidence).status, 'preview');
}

// 12. A missing residual is not verified even with enough anchors.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    independentAnchors: 5,
    residualM: null,
  };
  const decision = evaluateRegistration(evidence);
  assert.equal(decision.status, 'preview');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('residual')),
    'preview names the missing residual',
  );
}

// 13. A null uncertainty does not block the middle status when anchors corroborate.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: null,
    alignmentFlags: null,
  };
  assert.equal(evaluateRegistration(evidence).status, 'correspondence-verified');
}

// 14. A failed alignment flag blocks registration but not corroboration.
{
  const flagged: RegistrationEvidence = {
    ...perfectEvidence(),
    alignmentFlags: { ...perfectEvidence().alignmentFlags!, orientationVerified: false },
  };
  const decision = evaluateRegistration(flagged);
  assert.equal(decision.status, 'correspondence-verified');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('orientation')),
    'reasons name the failed alignment check',
  );
}

// 15. A missing alignment record cannot claim registration.
{
  const decision = evaluateRegistration({ ...perfectEvidence(), alignmentFlags: null });
  assert.notEqual(decision.status, 'registered');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('alignment')),
    'reasons name the missing alignment record',
  );
}

// 16. An over-bound uncertainty alone still leaves the middle status reachable.
{
  const evidence: RegistrationEvidence = {
    ...perfectEvidence(),
    uncertaintyM: MAX_REGISTERED_UNCERTAINTY_M + 0.5,
  };
  const decision = evaluateRegistration(evidence);
  assert.equal(decision.status, 'correspondence-verified');
  assert.ok(
    decision.reasons.some((reason) => reason.includes('uncertainty')),
    'reasons name the metric uncertainty that denied registration',
  );
}

console.log('Registration status: gates, threshold inclusivity and delivery levels passed.');
