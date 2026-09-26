import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { buildBuildingGableCandidate } from './building-gable-candidate.js';
import { boundFacadeSource, fitFacadeFeature, previewFacadeSource } from '../../src/canalRecall/facadeDescription.js';
import { compileFacadePatches } from '../../src/canalRecall/cityAppearanceFacadeRecipes.js';

const comparison = JSON.parse(fs.readFileSync('review-data/building-source-comparison/case-24.json', 'utf8'));
const cases = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const baseline = cases.cases.find((entry: any) => entry.caseId === 'case-24').owner;
const sourceWindows = cases.cases.find((entry: any) => entry.caseId === 'case-24').shapeFeatures.full;

test('gable candidate binds source outline and joins it to the retained LoD2.2 roof', () => {
  const before = JSON.stringify(baseline);
  const result = buildBuildingGableCandidate(baseline, comparison);
  assert.equal(JSON.stringify(baseline), before);
  assert.equal(result.provenance.registered, false);
  assert.equal(result.provenance.assumedCapDepthM, 2);
  assert.ok(result.owner.geometryRevision.startsWith(`candidate:${baseline.geometryRevision}:`));
  const wall = result.owner.geometry.building.surfaces[0].rings[0];
  const top = wall.slice(2);
  assert.ok(top.some((p: number[]) => p[1] > 14.5));
  assert.ok(top.some((p: number[]) => p[1] < 13));
  assert.notDeepEqual(result.owner.geometry.building.surfaces[9].rings[0], baseline.geometry.building.surfaces[9].rings[0]);
  assert.ok(result.owner.geometry.building.surfaces.length > baseline.geometry.building.surfaces.length);
  assert.deepEqual(result.provenance.replacedSourceSurfaceIndices, [0]);
  assert.deepEqual(result.provenance.clippedSourceSurfaceIndices, [6, 7, 9]);
  assert.deepEqual(result.provenance.roofCompletion, {
    status: 'topology-derived-preview', registered: false, retainedRoofSurfaceIndex: 9, appendedFacetCount: top.length - 1,
    basis: 'source-derived front outline joined at assumed depth to the clipped boundary of the original LoD2.2 roof',
    originalRoofPlaneMaxResidualM: result.provenance.roofCompletion.originalRoofPlaneMaxResidualM,
  });
  assert.ok(result.provenance.roofCompletion.originalRoofPlaneMaxResidualM < .01);
  assert.ok(result.owner.geometry.building.surfaces[10].rings[0].every((point: number[], index: number) => JSON.stringify(point) === JSON.stringify(baseline.geometry.building.surfaces[10].rings[0][index])), 'rear annex roof must remain unchanged at index 10');
  const leftEave = wall.at(-1), rightEave = wall[2];
  assert.ok(result.owner.geometry.building.surfaces[6].rings[0].some((point: number[]) => JSON.stringify(point) === JSON.stringify(leftEave)));
  assert.ok(result.owner.geometry.building.surfaces[7].rings[0].some((point: number[]) => JSON.stringify(point) === JSON.stringify(rightEave)));
  assert.ok(!result.owner.geometry.building.surfaces[6].rings[0].some((point: number[]) => JSON.stringify(point) === JSON.stringify(baseline.geometry.building.surfaces[0].rings[0][0])));
  assert.ok(!result.owner.geometry.building.surfaces[7].rings[0].some((point: number[]) => JSON.stringify(point) === JSON.stringify(baseline.geometry.building.surfaces[0].rings[0][3])));
  const retainedRoof = result.owner.geometry.building.surfaces[9].rings[0];
  const facets = result.owner.geometry.building.surfaces.slice(baseline.geometry.building.surfaces.length);
  assert.equal(facets.length, top.length - 1);
  const rearFacetPoints = facets.flatMap((surface: any) => surface.rings[0].slice(2));
  const cutEdgePoints = retainedRoof.filter((point: number[]) => rearFacetPoints.some((candidate: number[]) => Math.hypot(point[0] - candidate[0], point[1] - candidate[1], point[2] - candidate[2]) < 1e-8));
  assert.equal(cutEdgePoints.length, 2, 'both retained-roof cut endpoints must be shared exactly with cap facets');
  for (const index of [6, 7]) {
    assert.ok(result.owner.geometry.building.surfaces[index].rings[0].some((point: number[]) => rearFacetPoints.some((candidate: number[]) => Math.hypot(point[0] - candidate[0], point[1] - candidate[1], point[2] - candidate[2]) < 1e-8)), `side wall ${index} must share its inserted roof-join vertex`);
  }
  assert.deepEqual(result.provenance.unresolved, [
    'camera and vertical datum unverified',
    'cap depth remains assumed because no independent cached depth view was found',
    'roof join is topology-derived and not source registered',
  ]);
});

test('reviewed facade openings use an isolated ambiguous preview contract on the candidate owner', () => {
  const result = buildBuildingGableCandidate(baseline, comparison, { sourceWindowEvidence: sourceWindows });
  const record = result.owner.observations[0].payload;
  assert.equal(result.provenance.sourceWindowCandidate.enabled, true);
  assert.equal(record.facadeDescription.extractionVersion, 'case24-source-facade-candidate/v4-doors-and-display');
  assert.deepEqual(result.provenance.sourceWindowCandidate.componentCorrection, {
    featureId: 'full:window-1', scope: 'top bound and dark head infill only; x extents, sill, absolute divider, lower glazing, and all other features preserved',
    sourceRationale: 'The blurry pinned source places the pale outer head near y=149 and the internal divider near y=158.84. These are visual estimates, not validated annotations, and the image does not establish the dark region’s physical material.',
    sourcePixelEstimates: { topY: 149, dividerY: 158.84, uncertainty: 'blurred source; approximate visual placement' },
  });
  assert.equal(record.facadeDescription.sources.full.registration.status, 'ambiguous');
  assert.equal(record.facadeDescription.sources.full.openingsComplete, false);
  assert.equal(record.facadeDescription.sources.full.features.find((feature: any) => feature.id === 'full:window-1').opaqueHeadAboveTransom, true);
  const originalById = new Map(sourceWindows.features.map((feature: any) => [feature.id, feature]));
  for (const feature of record.facadeDescription.sources.full.features) {
    const original = structuredClone(originalById.get(feature.id));
    const copied = structuredClone(feature);
    if (copied.id === 'full:window-1') {
      assert.deepEqual(copied.bounds, [82, 149, 125, 209]);
      assert.ok(Math.abs((copied.bounds[1] + copied.transom * (copied.bounds[3] - copied.bounds[1])) - 158.84) < 1e-9, 'absolute divider source y must remain fixed');
      delete copied.opaqueHeadAboveTransom;
      copied.bounds = original.bounds;
      copied.transom = original.transom;
    }
    assert.deepEqual(copied, original, `${feature.id} source-study geometry and styling must remain unchanged`);
  }
  assert.deepEqual(record.facadeDescription.sources.full.features.map((feature: any) => feature.id), [
    'full:window-1', 'full:window-2', 'full:window-3', 'full:window-4', 'full:window-5', 'full:window-6', 'full:window-7', 'full:door-1', 'full:door-2', 'full:material-2', 'full:review:crown-vent', 'full:review:shop-display',
  ]);
  assert.equal(boundFacadeSource(record, result.owner, 0, 'full'), null);
  const preview = previewFacadeSource(record, result.owner, 0, 'full');
  assert.ok(preview);
  assert.equal(preview!.registration.preview?.kind, 'native-crop-plane');
  assert.equal(preview!.registration.uncertaintyM, .15);
  const fittedUpper = fitFacadeFeature(preview!.features.find((feature: any) => feature.id === 'full:window-1')!, preview!, record);
  assert.ok(fittedUpper);
  assert.ok(Math.abs(fittedUpper!.y - 11.742248381953779) < 1e-6, `expected repaired surface-base height, got ${fittedUpper!.y}`);
  const patches = compileFacadePatches(result.owner, result.owner.geometry.building.surfaces[0], 0, [record], [result.owner], { observed: true, candidateRegistrationPreview: true, procedural: false, contextual: false });
  for (const id of ['full:door-1', 'full:door-2', 'full:review:shop-display']) {
    assert.ok(patches.some((patch: any) => patch.featureId === `${result.owner.id}:${record.id}:${id}` && patch.triangles.length), `${id} must render on the real owner`);
  }
  assert.ok(!patches.some((patch: any) => patch.featureKind === 'shopfront-prior'), 'reviewed storefront must not gain a procedural duplicate');
  const gableFeatureId = `${result.owner.id}:${record.id}:full:window-1`;
  const gableHead = patches.filter((patch: any) => patch.featureId === gableFeatureId && patch.colour === 'windowFrameDark');
  assert.equal(gableHead.length, 1, 'gable window must have one opaque head infill');
  assert.ok(gableHead[0].triangles.length > 0);
  assert.ok(!patches.some((patch: any) => patch.featureId !== gableFeatureId && patch.colour === 'windowFrameDark'), 'opaque treatment must remain isolated to the gable window');
  const featureId = `${result.owner.id}:${record.id}:full:window-2`;
  const glass = patches.filter((patch: any) => patch.featureId === featureId && patch.colour === 'windowGlass').flatMap((patch: any) => patch.triangles);
  const frame = patches.filter((patch: any) => patch.featureId === featureId && patch.colour === '#e8e4d5').flatMap((patch: any) => patch.triangles);
  const axis = [0.384615384615, .923076923077];
  const width = (triangles: number[]) => { const values = []; for (let index = 0; index < triangles.length; index += 3) values.push(triangles[index] * axis[0] + triangles[index + 2] * axis[1]); return Math.max(...values) - Math.min(...values); };
  const projectedBorderWidth = width(frame) - width(glass);
  assert.ok(projectedBorderWidth > .07 && projectedBorderWidth < .11, `expected projected 4px frame near .09m, got ${projectedBorderWidth}`);
  const localBounds = (triangles: number[]) => { const ts = [], ys = [], depths = []; for (let index = 0; index < triangles.length; index += 3) { const x = triangles[index], y = triangles[index + 1], z = triangles[index + 2]; ts.push(x * axis[0] + z * axis[1]); ys.push(y); depths.push((x - 42.48) * -axis[1] + (z - 40.66) * axis[0]); } return { t: Math.max(...ts) - Math.min(...ts), minY: Math.min(...ys), maxY: Math.max(...ys), depth: depths.reduce((sum, value) => sum + value, 0) / depths.length }; };
  const upperJoinery = patches.filter((patch: any) => patch.featureId === featureId && patch.colour === '#e8e4d5').map((patch: any) => localBounds(patch.triangles)).filter(bounds => Math.abs(bounds.depth - .078) < 1e-5);
  const verticalMullion = upperJoinery.find(bounds => bounds.t < .08 && bounds.maxY - bounds.minY > .5);
  assert.ok(verticalMullion, 'upper pair must retain a vertical mullion');
  const fittedPair = fitFacadeFeature(preview!.features.find((feature: any) => feature.id === 'full:window-2')!, preview!, record)!;
  const expectedTransomY = .37 + fittedPair.y + fittedPair.height * (.5 - fittedPair.transom!);
  assert.ok(verticalMullion!.maxY <= expectedTransomY && expectedTransomY - verticalMullion!.maxY < .005, `mullion must join without crossing transom ${expectedTransomY}, got ${verticalMullion!.maxY}`);
  for (const id of ['full:window-4', 'full:window-5', 'full:window-6', 'full:window-7']) {
    const lowerId = `${result.owner.id}:${record.id}:${id}`;
    const lowerJoinery = patches.filter((patch: any) => patch.featureId === lowerId && patch.colour === '#e8e4d5').map((patch: any) => localBounds(patch.triangles)).filter(bounds => Math.abs(bounds.depth - .078) < 1e-5);
    assert.ok(!lowerJoinery.some(bounds => bounds.t < .08 && bounds.maxY - bounds.minY > .5), `${id} must not gain structural mullions`);
  }
  assert.equal(baseline.observations[0].payload.facadeDescription, undefined);
});

test('source and geometry mismatches fail closed', () => {
  assert.throws(() => buildBuildingGableCandidate({ ...baseline, geometryRevision: 'different' }, comparison), /mismatch/);
  assert.throws(() => buildBuildingGableCandidate(baseline, { ...comparison, source: { ...comparison.source, cropSha256: 'different' } }), /source/);
  assert.throws(() => buildBuildingGableCandidate(baseline, comparison, { assumedCapDepthM: 20 }), /depth/);
  assert.throws(() => buildBuildingGableCandidate(baseline, comparison, { sourceWindowEvidence: { ...sourceWindows, cropSha256: 'different' } }), /evidence mismatch/);
});
