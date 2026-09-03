/**
 * Pin the calibration gate.
 *
 * The failure this guards against is a pipeline whose 0.9 really means 0.6,
 * auto-accepting its way through a neighbourhood with the review queue empty
 * and every dashboard green. Each case below is one way that could happen and
 * go unnoticed.
 */
import assert from 'node:assert/strict';
import {
  AUTOMATION_RATIO_TOLERANCE, DEFAULT_THRESHOLDS, calibrationBins, confidenceBias,
  evaluateStopRules, expansionReport, expectedCalibrationError, fieldAccuracy,
  fieldVerdict, wilsonInterval, type ReviewOutcome, type TierHealth,
} from '../src/canalRecall/facade/calibration.ts';

const outcome = (field: string, confidence: number, correct: boolean, index = 0): ReviewOutcome =>
  ({ pandId: `036310001216${String(index).padStart(4, '0')}`, field, confidence, source: 'streetlevel-measured', correct });

/** `hits` correct out of `total`, all claiming `confidence`. */
const run = (field: string, confidence: number, hits: number, total: number): ReviewOutcome[] =>
  Array.from({ length: total }, (_, index) => outcome(field, confidence, index < hits, index));

// ---------------------------------------------------------------------------
// Wilson intervals — the part that stops a small sample speaking confidently

{
  // 18 of 20 looks like 90% and is consistent with 70%. That gap is the whole
  // reason verdicts are taken against the bound rather than the point estimate.
  const [lower, upper] = wilsonInterval(18, 20);
  assert.equal(Math.round(lower * 100) / 100 < 0.75, true, `18/20 lower bound was ${lower.toFixed(3)}`);
  assert.equal(upper > 0.97, true);

  // The same rate over a real sample is genuinely 90%.
  const [tightLower, tightUpper] = wilsonInterval(900, 1000);
  assert.equal(tightLower > 0.87, true);
  assert.equal(tightUpper < 0.92, true);

  // No reviews is no information, not 0% accuracy.
  assert.deepEqual(wilsonInterval(0, 0), [0, 1]);

  // Never runs outside [0,1], which is where the normal approximation breaks
  // and where the interesting fields actually sit.
  const [perfectLower, perfectUpper] = wilsonInterval(50, 50);
  assert.equal(perfectUpper <= 1, true);
  assert.equal(perfectLower > 0.9 && perfectLower < 1, true, 'even a perfect small sample is not certainty');
}

// ---------------------------------------------------------------------------
// Reliability: does a claimed confidence mean anything?

{
  // A pipeline that is right 60% of the time while claiming 0.9.
  const overconfident = run('gable', 0.9, 60, 100);
  assert.equal(Math.abs(expectedCalibrationError(overconfident) - 0.3) < 0.001, true);
  assert.equal(Math.abs(confidenceBias(overconfident) - 0.3) < 0.001, true, 'positive bias means it claims more than it delivers');

  // A pipeline that is right 90% of the time while claiming 0.9.
  const honest = run('gable', 0.9, 90, 100);
  assert.equal(expectedCalibrationError(honest) < 0.001, true);
  assert.equal(Math.abs(confidenceBias(honest)) < 0.001, true);

  // Underconfidence is a different failure and must not average away against
  // overconfidence into one number that looks fine.
  const timid = run('bays', 0.5, 90, 100);
  assert.equal(confidenceBias(timid) < -0.35, true);

  const mixed = [...run('gable', 0.9, 30, 50), ...run('gable', 0.1, 20, 50)];
  assert.equal(confidenceBias(mixed) < 0.01, true, 'the means cancel...');
  assert.equal(expectedCalibrationError(mixed) > 0.25, true, '...but the calibration error does not');

  assert.equal(expectedCalibrationError([]), 0);
  assert.equal(confidenceBias([]), 0);

  // Bucketing: confidence 1.0 belongs in the top bin, not off the end.
  const bins = calibrationBins(run('gable', 1, 4, 5), 10);
  assert.equal(bins.length, 10);
  assert.equal(bins[9].count, 5);
  assert.equal(bins[9].observedAccuracy, 0.8);
  assert.equal(bins[0].count, 0);
  assert.equal(bins[0].observedAccuracy, 0, 'an empty bin contributes nothing rather than counting as perfect');
}

// ---------------------------------------------------------------------------
// Per-field verdicts

{
  const accuracy = (outcomes: ReviewOutcome[]) => fieldAccuracy(outcomes)[0];

  // Comfortably accurate over a real sample, and honestly scored.
  assert.equal(fieldVerdict(accuracy(run('gable', 0.95, 194, 200))), 'accept');

  // The same rate over 20 reviews is not evidence yet.
  assert.equal(fieldVerdict(accuracy(run('gable', 0.95, 19, 20))), 'needs-review',
    'an under-reviewed field never silently ships');

  // A flawless small sample is the case the sample floor exists for, and the
  // only one that isolates it: 25 of 25 is perfectly calibrated and its Wilson
  // lower bound clears 0.85, so every other guard would wave it through.
  const flawlessSmall = accuracy(run('gable', 1, 25, 25));
  assert.equal(flawlessSmall.lower > DEFAULT_THRESHOLDS.minimumAccuracy, true, `lower bound was ${flawlessSmall.lower.toFixed(3)}`);
  assert.equal(flawlessSmall.expectedCalibrationError, 0);
  assert.equal(flawlessSmall.reviewed < DEFAULT_THRESHOLDS.minimumSample, true);
  assert.equal(fieldVerdict(flawlessSmall), 'needs-review', 'the sample floor still holds it back');
  // One more review over the floor and the same evidence ships.
  assert.equal(fieldVerdict(accuracy(run('gable', 1, 30, 30))), 'accept');

  // Clearly below the bar over a real sample: demote, and do not "fix" it by
  // lowering the confidence bar until it passes.
  assert.equal(fieldVerdict(accuracy(run('gable', 0.95, 100, 200))), 'demote');

  // Straddling the bar is a request for more reviews, not a decision either way.
  assert.equal(fieldVerdict(accuracy(run('gable', 0.86, 86, 100))), 'needs-review');

  // Accurate but badly calibrated is still unsafe to auto-accept, because the
  // confidence score is what routes a building past review in the first place.
  const accurateButTimid = [...run('gable', 0.2, 190, 200)];
  const timidAccuracy = accuracy(accurateButTimid);
  assert.equal(timidAccuracy.lower > DEFAULT_THRESHOLDS.minimumAccuracy, true, 'it really is accurate');
  assert.equal(fieldVerdict(timidAccuracy), 'needs-review', 'and still must not auto-accept');

  // Reporting shape: worst-bounded field first, so the gaps lead the report.
  const report = fieldAccuracy([...run('gable', 0.9, 50, 100), ...run('brick', 0.9, 95, 100)]);
  assert.deepEqual(report.map(entry => entry.field), ['gable', 'brick']);
  assert.equal(report[0].reviewed, 100);
  assert.equal(report[0].correct, 50);
}

// ---------------------------------------------------------------------------
// The two metrics that must be published together

{
  // The failure this shape exists to prevent: 97% automation over a
  // neighbourhood where one building in three has ever been looked at.
  const thin = expansionReport({ neighbourhood: 'jordaan-edge', buildings: 900, observed: 300, autoAccepted: 291 });
  assert.equal(Math.round(thin.automationRatio * 100), 97, 'automation is denominated in observations...');
  assert.equal(Math.round(thin.observationCoverage * 100), 33, '...and coverage says how little that covers');
  assert.equal(Math.round(thin.measuredShare * 100), 32, 'the share of the neighbourhood actually shipped detailed');

  const solid = expansionReport({ neighbourhood: 'negen-straatjes', buildings: 900, observed: 860, autoAccepted: 800 });
  assert.equal(solid.observationCoverage > 0.95, true);
  assert.equal(Math.round(solid.automationRatio * 100), 93);

  // An unobserved neighbourhood reads as unseen, never as fully automated.
  const empty = expansionReport({ neighbourhood: 'unstarted', buildings: 500, observed: 0, autoAccepted: 0 });
  assert.equal(empty.automationRatio, 0);
  assert.equal(empty.observationCoverage, 0);
  assert.deepEqual(expansionReport({ neighbourhood: 'nowhere', buildings: 0, observed: 0, autoAccepted: 0 }).measuredShare, 0);
}

// ---------------------------------------------------------------------------
// Stop rules

const health = (overrides: Partial<TierHealth> = {}): TierHealth => ({
  automationTarget: 0.85,
  report: expansionReport({ neighbourhood: 'herengracht-west', buildings: 400, observed: 390, autoAccepted: 340 }),
  accuracy: fieldAccuracy(run('gable', 0.9, 190, 200)),
  sustainedFps: 58,
  cacheBytes: 40_000_000,
  cacheBudgetBytes: 60_000_000,
  regressedLocations: [],
  ...overrides,
});

{
  assert.deepEqual(evaluateStopRules(health()), [], 'a healthy tier raises nothing');

  const ratios = evaluateStopRules(health({
    report: expansionReport({ neighbourhood: 'de-pijp', buildings: 1000, observed: 1000, autoAccepted: 600 }),
    automationTarget: 0.95,
  }));
  assert.equal(ratios.some(signal => signal.rule === 'automation-ratio'), true);
  assert.match(ratios[0].detail, /not the confidence bar/, 'the remedy is named in the signal');

  // Exactly at the tolerance edge does not fire; past it does.
  assert.deepEqual(evaluateStopRules(health({
    automationTarget: 0.95,
    report: expansionReport({ neighbourhood: 'edge', buildings: 1000, observed: 1000, autoAccepted: (0.95 - AUTOMATION_RATIO_TOLERANCE) * 1000 }),
  })).filter(signal => signal.rule === 'automation-ratio'), []);

  // A structural field below the floor stops the tier; a cosmetic one does not.
  assert.equal(evaluateStopRules(health({ accuracy: fieldAccuracy(run('gable', 0.9, 120, 200)) }))
    .some(signal => signal.rule === 'sampled-accuracy'), true);
  assert.equal(evaluateStopRules(health({ accuracy: fieldAccuracy(run('brick', 0.9, 120, 200)) }))
    .some(signal => signal.rule === 'sampled-accuracy'), false,
    'a brick colour two shades off is a blemish; a wrong gable is a wrong building');

  // An unreviewed field is not a failing field.
  assert.deepEqual(evaluateStopRules(health({ accuracy: fieldAccuracy([]) })), []);

  assert.equal(evaluateStopRules(health({ sustainedFps: 41 })).some(signal => signal.rule === 'frame-rate'), true);
  assert.equal(evaluateStopRules(health({ sustainedFps: 45 })).some(signal => signal.rule === 'frame-rate'), false);
  assert.equal(evaluateStopRules(health({ cacheBytes: 90_000_000 })).some(signal => signal.rule === 'cache-budget'), true);

  const regressed = evaluateStopRules(health({ regressedLocations: ['Keizersgracht 268', 'Herengracht 386'] }));
  assert.equal(regressed.some(signal => signal.rule === 'tier-regression'), true);
  assert.match(regressed.find(signal => signal.rule === 'tier-regression')!.detail, /Keizersgracht 268/);

  // Several failures report as several signals: a tier does not stop once.
  assert.equal(evaluateStopRules(health({ sustainedFps: 30, cacheBytes: 90_000_000, regressedLocations: ['Singel 7'] })).length, 3);
}

console.log('All façade calibration checks passed.');
