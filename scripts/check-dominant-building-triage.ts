import assert from 'node:assert/strict';
import { triageDominantBuilding, type FidelityReview } from './landmarks/dominant-building-triage';
const ordinary = { heightMetres: 22, holes: 0, outlines: 1, vertices: 4, raisedParts: false, roofShape: 'flat', poiNames: [] };
assert.equal(triageDominantBuilding(ordinary).workflow, 'standard-eligibility-review');
assert.equal(triageDominantBuilding(ordinary).treatment, 'unreviewed', 'geometry must never approve reduced fidelity');
for (const changes of [{ holes: 1 }, { raisedParts: true }, { heightMetres: 70 }, { vertices: 22 }, { roofShape: 'dome' }, { poiNames: ['ING House'] }]) {
  assert.equal(triageDominantBuilding({ ...ordinary, ...changes }).workflow, 'recognition-review');
}
const review: FidelityReview = { treatment: 'standard', reviewedOn: '2026-10-04', sourceUrls: ['https://example.com/reference'], referenceImage: 'source-facade.jpg', reason: 'Ordinary repeated bays and flat silhouette', checks: { ordinarySilhouette: true, repetitiveFacade: true, noDefiningDetailsLost: true, openSpacesUnderstood: true } };
assert.equal(triageDominantBuilding(ordinary, review).workflow, 'standard-building');
assert.throws(() => triageDominantBuilding(ordinary, { ...review, referenceImage: '' }));
assert.throws(() => triageDominantBuilding(ordinary, { ...review, checks: { ...review.checks, noDefiningDetailsLost: false } }));
assert.throws(() => triageDominantBuilding({ ...ordinary, poiNames: ['ING House'] }, review));
assert.throws(() => triageDominantBuilding({ ...ordinary, raisedParts: true }, review));
assert.equal(triageDominantBuilding({ ...ordinary, raisedParts: true }, { ...review, treatment: 'landmark' }).workflow, 'full-landmark');
console.log('Fidelity triage: suggestions never approve simplification; visual evidence and POI/open-structure guards passed.');
