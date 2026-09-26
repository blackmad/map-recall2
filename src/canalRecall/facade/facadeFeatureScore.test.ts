import assert from 'node:assert/strict';
import {
  iou,
  matchOpenings,
  contourDistance,
  colourConfusion,
  type Box,
} from './facadeFeatureScore.ts';

let checks = 0;
const close = (actual: number, expected: number, label: string, epsilon = 1e-9) => {
  checks++;
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${label}: expected ${expected}, got ${actual}`,
  );
};

// 1. Perfect overlap: iou 1, precision/recall 1.
const perfect: Box[] = [{ id: 'r1', kind: 'window', bounds: [10, 20, 110, 220] }];
const perfectMatch = matchOpenings(perfect, [{ id: 'p1', kind: 'window', bounds: [10, 20, 110, 220] }]);
close(iou(perfect[0].bounds, [10, 20, 110, 220]), 1, 'perfect iou');
assert.equal(perfectMatch.matches.length, 1, 'perfect has one match');
close(perfectMatch.precision, 1, 'perfect precision');
close(perfectMatch.recall, 1, 'perfect recall');
assert.deepEqual(perfectMatch.unmatchedReferences, [], 'perfect no unmatched references');
assert.deepEqual(perfectMatch.unmatchedPredictions, [], 'perfect no unmatched predictions');

// 2. Disjoint: iou 0, precision/recall 0, both unmatched.
const disjointReference: Box[] = [{ kind: 'window', bounds: [0, 0, 10, 10] }];
const disjointPrediction: Box[] = [{ kind: 'window', bounds: [100, 100, 110, 110] }];
close(iou(disjointReference[0].bounds, disjointPrediction[0].bounds), 0, 'disjoint iou');
const disjoint = matchOpenings(disjointReference, disjointPrediction);
assert.equal(disjoint.matches.length, 0, 'disjoint has no matches');
close(disjoint.precision, 0, 'disjoint precision');
close(disjoint.recall, 0, 'disjoint recall');
assert.equal(disjoint.unmatchedReferences.length, 1, 'disjoint one unmatched reference');
assert.equal(disjoint.unmatchedPredictions.length, 1, 'disjoint one unmatched prediction');

// 3. Two references, one prediction: recall 0.5, precision 1.
const twoReferences: Box[] = [
  { kind: 'window', bounds: [0, 0, 10, 10] },
  { kind: 'window', bounds: [20, 0, 30, 10] },
];
const onePrediction: Box[] = [{ kind: 'window', bounds: [0, 0, 10, 10] }];
const partial = matchOpenings(twoReferences, onePrediction);
assert.equal(partial.matches.length, 1, 'partial one match');
close(partial.recall, 0.5, 'partial recall');
close(partial.precision, 1, 'partial precision');
assert.equal(partial.unmatchedReferences.length, 1, 'partial one unmatched reference');
assert.equal(partial.unmatchedPredictions.length, 0, 'partial no unmatched prediction');

// 4. sameKindOnly prevents a door from matching a window at identical bounds.
const doorReference: Box[] = [{ kind: 'door', bounds: [0, 0, 50, 100] }];
const windowPrediction: Box[] = [{ kind: 'window', bounds: [0, 0, 50, 100] }];
const loose = matchOpenings(doorReference, windowPrediction);
assert.equal(loose.matches.length, 1, 'loose allows cross-kind match');
const strict = matchOpenings(doorReference, windowPrediction, { sameKindOnly: true });
assert.equal(strict.matches.length, 0, 'sameKindOnly blocks cross-kind match');
close(strict.precision, 0, 'sameKindOnly precision');
close(strict.recall, 0, 'sameKindOnly recall');
assert.equal(strict.unmatchedReferences.length, 1, 'sameKindOnly unmatched reference');
assert.equal(strict.unmatchedPredictions.length, 1, 'sameKindOnly unmatched prediction');

// 5. contourDistance: identical contours are 0; a translated contour equals the translation.
const contour: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10]];
const identical = contourDistance(contour, contour);
close(identical.meanM, 0, 'identical mean');
close(identical.p95M, 0, 'identical p95');
close(identical.maxM, 0, 'identical max');
assert.ok(identical.samples > 0, 'identical has samples');

const translated = contour.map(([x, y]) => [x + 3, y + 4] as [number, number]);
const shifted = contourDistance(contour, translated);
close(shifted.meanM, 5, 'translated mean equals distance');
close(shifted.p95M, 5, 'translated p95 equals distance');
close(shifted.maxM, 5, 'translated max equals distance');
assert.equal(shifted.samples, 64, 'default sample count');

const closedShifted = contourDistance(contour, translated, { closed: true, samples: 32 });
close(closedShifted.meanM, 5, 'closed translated mean equals distance');
assert.equal(closedShifted.samples, 32, 'closed custom sample count');

const degenerate = contourDistance([[0, 0]], [[0, 0], [1, 1]]);
assert.deepEqual(degenerate, { meanM: 0, p95M: 0, maxM: 0, samples: 0 }, 'degenerate zeros');

// 6. colourConfusion: one agreement and one mismatch reported.
const colours = colourConfusion(
  [
    { region: 'wall', colour: '#ffffff' },
    { region: 'door', colour: '#000000' },
  ],
  [
    { region: 'wall', colour: '#ffffff' },
    { region: 'door', colour: '#ff0000' },
  ],
);
assert.equal(colours.agreements, 1, 'one colour agreement');
assert.equal(colours.total, 2, 'two colour regions');
assert.equal(colours.confusion.length, 1, 'one colour mismatch');
assert.deepEqual(
  colours.confusion[0],
  { region: 'door', reference: '#000000', prediction: '#ff0000' },
  'mismatch details',
);

console.log(
  `facade feature score: ${checks} checks passed (iou, matchOpenings, contourDistance, colourConfusion).`,
);
