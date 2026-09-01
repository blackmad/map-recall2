import assert from 'node:assert/strict';
import {
  bearingDegrees, distanceMetres, facadeFieldOfView, rankFacadeViews, selectDistinctFacadeViews,
} from '../src/canalRecall/building/facadeView.ts';

const target = [4.9, 52.37] as const;
const north = [4.9, 52.3698] as const;
assert.ok(Math.abs(bearingDegrees(north, target)) < 0.01, 'a camera south of the building aims north');
assert.ok(distanceMetres(north, target) > 20 && distanceMetres(north, target) < 23);
assert.equal(facadeFieldOfView(13.9), 110);
assert.equal(facadeFieldOfView(14), 95);
assert.equal(facadeFieldOfView(20), 82);

const ranked = rankFacadeViews([
  { panoId: 'too-near', observedAt: '2026-01-01', camera: [4.9, 52.36999], surfaceType: 'L' },
  { panoId: 'water', observedAt: '2026-01-01', camera: north, surfaceType: 'W' },
  { panoId: 'older-ideal', observedAt: '2025-01-01', camera: north, surfaceType: 'L' },
  { panoId: 'newer-ideal', observedAt: '2026-01-01', camera: north, surfaceType: 'L' },
  { panoId: 'farther', observedAt: '2026-01-01', camera: [4.9, 52.3697], surfaceType: 'L' },
], target);
assert.deepEqual(ranked.map((candidate) => candidate.panoId), ['newer-ideal', 'older-ideal', 'farther']);
assert.equal(ranked[0].fieldOfView, 82);
assert.throws(() => rankFacadeViews([], target, {
  minDistanceMetres: 30, maxDistanceMetres: 20, idealDistanceMetres: 22,
}), /Invalid/);
assert.deepEqual(selectDistinctFacadeViews(ranked, 2).map((candidate) => candidate.panoId),
  ['newer-ideal', 'farther'], 'two missions from one camera position are one viewpoint');

process.stdout.write('Façade view selection checks passed.\n');
