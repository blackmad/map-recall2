import assert from 'node:assert/strict';
import { selectReviewedFacadeInputs } from '../src/canalRecall/building/facadeEvidence.ts';

const source = [{ buildingId: 'bag:1', bagId: '1' }, { buildingId: 'bag:2', bagId: '2' }];
const crops = [
  { buildingId: 'bag:1', panoId: 'p1', observedAt: '2025-01-01', image: 'wide-images/1.jpg' },
  { buildingId: 'bag:1', panoId: 'p2', observedAt: '2025-01-02', image: 'wide-images/2.jpg' },
];
const result = selectReviewedFacadeInputs(source, crops, [
  { buildingId: 'bag:1', quality: 'full', selectedPanoId: 'p2', selectedImage: 'wide-images/2.jpg' },
  { buildingId: 'bag:2', quality: 'unusable', selectedPanoId: null },
  { buildingId: 'bag:3', quality: 'partial', selectedPanoId: 'p3' },
]);
assert.deepEqual(result.inputs, [{
  ...crops[1], bagId: '1', viewQuality: 'full', viewReviewedAt: null,
}]);
assert.deepEqual(result.rejected, [
  { buildingId: 'bag:2', reason: 'human-marked-no-usable-view' },
  { buildingId: 'bag:3', reason: 'building-not-in-source-manifest' },
]);

const mismatch = selectReviewedFacadeInputs(source, crops, [{
  buildingId: 'bag:1', quality: 'partial', selectedPanoId: 'p1', selectedImage: 'wrong.jpg',
}]);
assert.equal(mismatch.inputs.length, 0);
assert.equal(mismatch.rejected[0].reason, 'selected-image-does-not-match-panorama');

const unreviewed = selectReviewedFacadeInputs(source, crops, [{
  buildingId: 'bag:1', quality: 'unreviewed', selectedPanoId: 'p1', selectedImage: 'wide-images/1.jpg',
}]);
assert.equal(unreviewed.inputs.length, 0);
assert.equal(unreviewed.rejected[0].reason, 'invalid-or-unreviewed-quality');

const malformed = selectReviewedFacadeInputs(source, crops, [{
  buildingId: 'bag:1', quality: 'looks-good', selectedPanoId: 'p1',
} as never]);
assert.equal(malformed.inputs.length, 0);
assert.equal(malformed.rejected[0].reason, 'invalid-or-unreviewed-quality');

process.stdout.write('Reviewed façade evidence checks passed.\n');
