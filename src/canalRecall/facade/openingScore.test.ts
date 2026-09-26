import assert from 'node:assert/strict';
import { clearsThresholds, poolScores, scoreOpenings, type ScoredBox, type WallRect } from './openingScore.ts';

let checks = 0;
const check = (condition: boolean, label: string) => { checks += 1; assert.ok(condition, label); };

const gold: WallRect[] = [
  { along: 1, up: 3, width: 1, height: 2 },
  { along: 4, up: 3, width: 1, height: 2 },
];
const box = (along: number, up: number, width = 1, height = 2, kind = 'window', score = 0.9): ScoredBox => ({ along, up, width, height, kind, score });

// Perfect predictions: precision 1, recall 1, no centre error.
const perfect = scoreOpenings(gold, [box(1, 3), box(4, 3)]);
check(perfect.truePositives === 2 && perfect.falsePositives === 0 && perfect.falseNegatives === 0, 'perfect match counts');
check(perfect.precision === 1 && perfect.recall === 1, 'perfect rates');
check(perfect.medianCentreErrorM === 0, 'perfect centre error');

// A shifted prediction still matches at IoU >= 0.5 and reports its centre error.
const shifted = scoreOpenings(gold, [box(1.3, 3), box(4, 3)]);
check(shifted.truePositives === 2, 'shifted boxes still match at IoU 0.5');
check(Math.abs((shifted.medianCentreErrorM ?? 0) - 0.15) < 1e-9, `centre error 0.15 m, got ${shifted.medianCentreErrorM}`);

// A miss plus a spurious box: one of each.
const mixed = scoreOpenings(gold, [box(1, 3), box(7, 3)]);
check(mixed.truePositives === 1 && mixed.falsePositives === 1 && mixed.falseNegatives === 1, 'mixed counts');
check(Math.abs((mixed.precision ?? 0) - 0.5) < 1e-9 && Math.abs((mixed.recall ?? 0) - 0.5) < 1e-9, 'mixed rates');
check(mixed.unmatchedMeasured.length === 1 && mixed.unmatchedPredictions.length === 1, 'unmatched lists');

// Nothing predicted: recall 0, precision undefined (not 1.0).
const silent = scoreOpenings(gold, []);
check(silent.recall === 0 && silent.precision === null, 'silent model has undefined precision');
check(silent.medianCentreErrorM === null, 'no matches, no centre error');

// A prediction of another class is unknown, not a negative.
const otherClass = scoreOpenings(gold, [box(1, 3), box(4, 3, 1, 2, 'other')], { kinds: ['window'] });
check(otherClass.predicted === 1 && otherClass.truePositives === 1, 'other-class box is not scored');
check(otherClass.falsePositives === 0 && otherClass.falseNegatives === 1, 'other-class box is not a false positive');

// Below-threshold IoU does not match.
const noOverlap = scoreOpenings(gold, [box(1.6, 3)]);
check(noOverlap.truePositives === 0 && noOverlap.falsePositives === 1 && noOverlap.falseNegatives === 2, 'no overlap, no match');

// Pooling keeps denominators.
const pooled = poolScores([perfect, mixed, silent]);
check(pooled.measured === 6 && pooled.predicted === 4, `pooled denominators, got ${pooled.measured}/${pooled.predicted}`);
check(pooled.truePositives === 3 && pooled.falsePositives === 1 && pooled.falseNegatives === 3, 'pooled counts');

// The adoption rule is a conjunction, and a silent model never clears it.
const pass = scoreOpenings(gold, [box(1, 3), box(4, 3)]);
check(Object.values(clearsThresholds(pass)).every(Boolean), 'perfect model clears every threshold');
check(!Object.values(clearsThresholds(silent)).some((v, i) => i > 0 && v), 'silent model clears nothing but recall-false');

process.stdout.write(`opening score checks passed (${checks} assertions).\n`);
