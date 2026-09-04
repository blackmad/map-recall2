import assert from 'node:assert/strict';
import { buildElevations, inFrontOf, normaliseFootprintRing, ringIsCounterClockwise } from '../src/canalRecall/facade/elevations.ts';
import { generateElevationCandidates, selectElevationCandidates, type ElevationEvidence } from '../src/canalRecall/facade/elevationCandidates.ts';

const redundant = [
  { x: 0, y: 0 }, { x: 0, y: 4 }, { x: 0, y: 10 }, { x: 6, y: 10 },
  { x: 6, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 0 },
];
const canonical = normaliseFootprintRing(redundant);
assert.equal(ringIsCounterClockwise(canonical), true, 'normalised BAG rings are CCW');
const walls = buildElevations(redundant, { pandId: 'pand-a' });
assert.equal(walls.length, 4, 'redundant collinear survey vertices merge without erasing corners');
assert.equal(walls.some(wall => wall.lengthM === 10 && wall.sourceVertexRange.edgeIndices.length === 2), true, 'merged walls retain original edge lineage');
assert.equal(new Set(walls.map(wall => wall.elevationId)).size, 4);

const open = redundant.slice(0, -1);
const rotatedOpen = open.slice(2).concat(open.slice(0, 2));
const rotated = [...rotatedOpen, rotatedOpen[0]];
const reversedOpen = [...open].reverse();
const reversed = [...reversedOpen, reversedOpen[0]];
assert.deepEqual(buildElevations(rotated, { pandId: 'pand-a' }).map(wall => wall.elevationId).sort(), walls.map(wall => wall.elevationId).sort(), 'ring start does not change elevation IDs');
assert.deepEqual(buildElevations(reversed, { pandId: 'pand-a' }).map(wall => wall.elevationId).sort(), walls.map(wall => wall.elevationId).sort(), 'ring direction does not change elevation IDs');
assert.equal(walls.every(wall => inFrontOf(wall, { x: wall.midpoint.x + wall.normal.x, y: wall.midpoint.y + wall.normal.y })), true, 'every normal points outward');
assert.notEqual(buildElevations(redundant, { pandId: 'pand-b' })[0].elevationId, walls[0].elevationId, 'pand identity is part of every elevation ID');

const facts = (elevationId: string, overrides: Partial<ElevationEvidence> = {}): ElevationEvidence => ({
  elevationId, addressSide: 'unknown', streetAdjacencyM: null, canalAdjacencyM: null, quayAdjacencyM: null,
  visiblePanoramaCount: 0, bestPanoramaObliquityDeg: null, occludedFraction: null, osmFrontage: null, ...overrides,
});
const single = generateElevationCandidates(walls, [facts(walls[0].elevationId, { addressSide: 'supports', canalAdjacencyM: 2, visiblePanoramaCount: 4, bestPanoramaObliquityDeg: 8 })]);
assert.deepEqual(selectElevationCandidates(single).selected.map(candidate => candidate.elevation.elevationId), [walls[0].elevationId]);
const multi = generateElevationCandidates(walls, [
  facts(walls[0].elevationId, { addressSide: 'supports', canalAdjacencyM: 2, visiblePanoramaCount: 3 }),
  facts(walls[1].elevationId, { addressSide: 'supports', streetAdjacencyM: 2, visiblePanoramaCount: 3 }),
]);
assert.equal(selectElevationCandidates(multi).verdict, 'selected');
assert.equal(selectElevationCandidates(multi).selected.length, 2, 'corner/multi-front panden retain multiple supported elevations');
const ambiguous = generateElevationCandidates(walls, [
  facts(walls[0].elevationId, { canalAdjacencyM: 2, visiblePanoramaCount: 3 }),
  facts(walls[1].elevationId, { streetAdjacencyM: 2, visiblePanoramaCount: 3 }),
]);
assert.equal(selectElevationCandidates(ambiguous, { minimumScore: 35 }).verdict, 'ambiguous', 'a close geometry-only race is rejected instead of guessed');

console.log('Façade elevation checks passed (canonical rings, stable IDs, source ranges, normals, multi-front ambiguity).');
