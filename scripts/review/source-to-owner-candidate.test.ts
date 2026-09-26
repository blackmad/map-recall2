import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildSourceFacadeOwnerCandidate } from './source-to-owner-candidate.js';
import { clipTrianglesToFace, compileFacadePatches, facadeWallFrame } from '../../src/canalRecall/cityAppearanceFacadeRecipes.js';

const cases = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const item = cases.cases.find((entry: any) => entry.caseId === 'case-22');
// This rejected visual experiment exercises topology contracts only. Passing
// these tests must not promote it into the active, visually reviewed recipe.
const correction = JSON.parse(fs.readFileSync('scripts/review/case22-topology-rejected-experiment.json', 'utf8'));
const activeCorrection = JSON.parse(fs.readFileSync('scripts/review/case22-stepped-gable-correction.json', 'utf8'));
const case25 = cases.cases.find((entry: any) => entry.caseId === 'case-25');
const case25Correction = JSON.parse(fs.readFileSync('scripts/review/case25-flat-parapet-correction.json', 'utf8'));
const case20 = cases.cases.find((entry: any) => entry.caseId === 'case-20');
const case20Correction = JSON.parse(fs.readFileSync('scripts/review/case20-dormer-correction.json', 'utf8'));
const case30 = cases.cases.find((entry: any) => entry.caseId === 'case-30');
const case30Correction = JSON.parse(fs.readFileSync('scripts/review/case30-glazed-balcony-door-correction.json', 'utf8'));

test('case30 source-bound correction renders three near-full glazed balcony doors and preserves ground evidence', () => {
  const baseline = structuredClone(case30.owner);
  const observation = case30.candidateObservations.find((entry: any) => entry.id === case30Correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const pending=case30Correction.sourceFeatureOverrides.filter((override:any)=>hash(case30.shapeFeatures.full.features.find((feature:any)=>feature.id===override.featureId))===override.expectedFeatureSha256);
  const result = buildSourceFacadeOwnerCandidate(baseline, { ...case30Correction, sourceFeatureOverrides:pending, sources: {
    full: source(case30.shapeFeatures.full, observation.images.full), ground: source(case30.shapeFeatures.ground, observation.images.ground),
  } });
  assert.equal(result.provenance.sourceFeatureOverrides.length, pending.length);
  const description = result.owner.observations[0].payload.facadeDescription;
  const upperDoors = description.sources.full.features.filter((feature: any) => /^full:door_[123]$/.test(feature.id));
  assert.equal(upperDoors.length, 3);
  assert.ok(upperDoors.every((feature: any) => feature.kind === 'door' && feature.doorStyle === 'glazed' && feature.doorGlazingRatio === .95 && feature.paired === true && feature.doorFurniture === 'none' && feature.disposition === 'agent-inspected' && feature.sourceFrameWidthPx === 4 && feature.sourceJoineryWidthPx === 2));
  assert.deepEqual(description.sources.ground.features, case30.shapeFeatures.ground.features, 'ground source remains byte-for-byte unchanged');
  assert.deepEqual(baseline, case30.owner, 'builder does not mutate the case30 baseline owner');
  const facadeIndex = result.provenance.appendedFacadeSurfaceIndex;
  const patches = compileFacadePatches(result.owner, result.owner.geometry.building.surfaces[facadeIndex], facadeIndex, result.owner.observations.map((entry: any) => entry.payload), [result.owner], { observed: true, candidateRegistrationPreview: true, procedural: false, contextual: false });
  for (const feature of upperDoors) {
    const emitted = patches.filter((patch: any) => patch.featureId.endsWith(`:${feature.id}`));
    assert.ok(emitted.some((patch: any) => patch.colour === 'windowGlass' && patch.triangles.length), `${feature.id} emits glazing`);
    assert.ok(emitted.some((patch: any) => patch.colour === '#ffffff' && patch.triangles.length), `${feature.id} uses its pale source frame`);
    assert.ok(!emitted.some((patch: any) => patch.heuristics?.includes('door-panel-grammar')), `${feature.id} does not fall back to solid panel grammar`);
  }
});

test('active case22 recipe emits explicit roof triangles while retaining delivered facade components', () => {
  const observation = item.candidateObservations.find((entry: any) => entry.id === activeCorrection.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const result = buildSourceFacadeOwnerCandidate(item.owner, { ...activeCorrection, sources: {
    full: source(item.shapeFeatures.full, observation.images.full), ground: source(item.shapeFeatures.ground, observation.images.ground),
  } });
  assert.deepEqual(result.provenance.candidateReplacedSurfaceIndices, [5, 25, 32]);
  const roofJoin = result.provenance.nativeTopologyJoins.find((join: any) => join.name === 'stepped-front-explicit-roof-facets');
  assert.equal(roofJoin.facetCount, 9);
  assert.equal(roofJoin.appendedFacetSurfaceIndices.length, 8);
  const roofFacetIndices = [32, ...roofJoin.appendedFacetSurfaceIndices];
  assert.ok(roofFacetIndices.every((index: number) => result.owner.geometry.building.surfaces[index].rings[0].length === 3), 'roof hypothesis must reach the renderer as explicit triangles');
  const nativeA = item.owner.geometry.building.surfaces[32].rings[0][0];
  assert.ok(roofFacetIndices.every((index: number) => result.owner.geometry.building.surfaces[index].rings[0].some((point: number[]) => JSON.stringify(point) === JSON.stringify(nativeA))), 'every triangle remains anchored to exact native A');
  assert.deepEqual(result.owner.geometry.building.surfaces[24], item.owner.geometry.building.surfaces[24], 'native A-C contact wall remains exact');
  assert.equal(result.provenance.componentAssemblies.length, 3);
  const masonryHeads = result.provenance.componentSurfaces.filter((surface: any) => surface.role === 'masonry-head-observed-outline-inferred-relief');
  assert.deepEqual(masonryHeads.map((surface: any) => surface.name), ['highest-right-flat-masonry-head', 'middle-right-arched-masonry-head', 'lower-right-arched-masonry-head']);
  assert.ok(masonryHeads.every((surface: any) => surface.colour === '#4d3836' && surface.inferredNormalOffsetsM.length === 1 && surface.inferredNormalOffsetsM[0] === .04 && /inferred/i.test(surface.basis)));
  for (const [row, component] of activeCorrection.componentSurfaces.entries()) {
    const opening = item.shapeFeatures.full.features.find((feature: any) => feature.id === `full:review:row-${row}-right`);
    assert.ok(component.vertices.every((vertex: any) => vertex.y <= opening.bounds[1]), 'masonry heads must not paint over retained glazing');
  }
  assert.equal(result.provenance.sourceFeatureOverrides.length, 3);
  assert.ok(result.provenance.sourceFeatureOverrides.every((entry: any) => entry.sourceCropSha256 === activeCorrection.source.cropSha256));
  assert.deepEqual(result.provenance.sourceFeatureOverrides.map((entry: any) => entry.featureId), activeCorrection.sourceFeatureOverrides.map((entry: any) => entry.featureId));
  assert.ok(result.provenance.sourceFeatureOverrides.every((entry: any) => entry.before !== entry.after && entry.basis));
  const effectiveFull = result.owner.observations[0].payload.facadeDescription.sources.full.features;
  const upperRight = effectiveFull.filter((feature: any) => /^full:review:row-[012]-right$/.test(feature.id));
  assert.ok(upperRight.every((feature: any) => feature.head === 'rectangular'), 'upper glazing stays rectangular');
  assert.equal(upperRight[0].lintelHead, 'rectangular', 'highest right opening keeps its observed flat masonry lintel');
  assert.ok(upperRight.slice(1).every((feature: any) => feature.lintelHead === 'segmental' && feature.surroundColour === '#765852'), 'middle and lower masonry arches stay separate from glazing');
  assert.equal(result.owner.observations[0].payload.facadeDescription.sources.ground.features.find((feature: any) => feature.id === 'ground:review:door-pair-assembly').head, 'segmental', 'ground paired door keeps its genuinely arched transom');
  const facadeIndex = result.provenance.appendedFacadeSurfaceIndex;
  const patches = compileFacadePatches(result.owner, result.owner.geometry.building.surfaces[facadeIndex], facadeIndex, result.owner.observations.map((entry: any) => entry.payload), [result.owner], { observed: true, candidateRegistrationPreview: true, procedural: false, contextual: false });
  for (const feature of upperRight) {
    const emitted = patches.filter((patch: any) => patch.featureId.endsWith(feature.id) && patch.triangles.length);
    assert.ok(emitted.some((patch: any) => patch.colour === 'windowGlass'), `${feature.id} emits rectangular glazing`);
    assert.ok(emitted.some((patch: any) => patch.colour === '#765852'), `${feature.id} emits separate source-bound masonry`);
  }
  assert.ok(patches.some((patch: any) => patch.featureId.endsWith('ground:review:door-pair-assembly') && patch.colour === 'windowGlass' && patch.triangles.length), 'ground paired door remains compiled');
  const originalById = new Map(item.shapeFeatures.full.features.map((feature: any) => [feature.id, feature]));
  for (const entry of result.provenance.sourceFeatureOverrides) assert.deepEqual(entry.before, originalById.get(entry.featureId), `${entry.featureId} preserves its original observation in override provenance`);
  assert.deepEqual(result.owner.observations[0].payload.facadeDescription.sources.ground.features, item.shapeFeatures.ground.features);
});

test('case20 dormer candidate preserves native geometry and labels its shallow component depth as inferred', () => {
  const baseline = structuredClone(case20.owner);
  const observation = case20.candidateObservations.find((entry: any) => entry.id === case20Correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const result = buildSourceFacadeOwnerCandidate(baseline, { ...case20Correction, sources: {
    full: source(case20.shapeFeatures.full, observation.images.full),
    ground: source(case20.shapeFeatures.ground, observation.images.ground),
  } });
  assert.equal(result.provenance.registered, false);
  assert.equal(result.provenance.roofDepth.status, 'abstained');
  assert.equal(baseline.geometry.building.surfaces.length, 23);
  assert.equal(result.owner.geometry.building.surfaces.length, 35);
  assert.deepEqual(result.owner.geometry.building.surfaces.slice(0, 23), baseline.geometry.building.surfaces);
  assert.deepEqual(Object.keys(result.provenance.appendedComponentSurfaceIndices), case20Correction.componentSurfaces.map((surface: any) => surface.name));
  assert.deepEqual(new Set(result.provenance.componentSurfaces.map((surface: any) => surface.role)), new Set(['dormer-front', 'dormer-side', 'dormer-cap', 'dormer-opening', 'dormer-frame']));
  assert.ok(result.owner.geometry.building.surfaces.slice(24).every((surface: any) => /^#[a-f0-9]{6}$/i.test(surface.previewAppearance.colour) && surface.previewAppearance.sourceCropSha256 === case20Correction.source.cropSha256 && surface.previewAppearance.disposition === 'inferred-preview'));
  assert.ok(result.provenance.componentSurfaces.every((surface: any) => surface.inferredNormalOffsetsM.every(Number.isFinite)));
  assert.deepEqual(result.owner.observations.map((entry: any) => entry.id), baseline.observations.map((entry: any) => entry.id));
  const description = result.owner.observations[0].payload.facadeDescription;
  // Reviewed source-feature overrides (the glazed doors) are applied by the
  // builder, so only non-overridden features must equal their raw source shape.
  const overridden = new Set(case20Correction.sourceFeatureOverrides.map((override: any) => override.featureId));
  for (const [tier, shape] of [['full', case20.shapeFeatures.full], ['ground', case20.shapeFeatures.ground]] as const) {
    const actual = description.sources[tier].features;
    for (const feature of shape.features) {
      const found = actual.find((entry: any) => entry.id === feature.id);
      assert.ok(found, `${tier} ${feature.id} preserved`);
      if (!overridden.has(feature.id)) assert.deepEqual(found, feature, `${tier} ${feature.id} unchanged`);
    }
  }
  assert.equal(description.sources.full.features.find((feature: any) => feature.id === 'full:door-1').disposition, 'agent-inspected', 'reviewed glazed-door override applied');
  assert.equal(description.sources.full.registration.status, 'ambiguous');
  assert.equal(description.sources.ground.registration.status, 'ambiguous');
  assert.ok(description.sources.full.features.some((feature: any) => feature.id === 'full:review:dormer'));
  assert.equal(description.sources.full.features.filter((feature: any) => feature.kind === 'door').length, 4);
  assert.equal(description.sources.ground.features.filter((feature: any) => feature.kind === 'door').length, 2);
  const wall = result.owner.geometry.building.surfaces[23];
  assert.equal(wall.rings[0].length, case20Correction.silhouetteTopPx.length + 2);
  const patches = compileFacadePatches(result.owner, wall, 23, result.owner.observations.map((entry: any) => entry.payload), [result.owner], { observed: true, candidateRegistrationPreview: true, procedural: false, contextual: false });
  const emitted = new Set(patches.filter((patch: any) => patch.triangles.length).map((patch: any) => patch.featureId));
  assert.ok([...emitted].some(id => id.endsWith(':full:review:dormer')), 'reviewed dormer opening must render');
  for (const id of ['full:window-1', 'full:window-2', 'full:window-3', 'full:window-4', 'full:door-1', 'full:window-5', 'full:window-6', 'full:door-2', 'full:window-7', 'full:review:dormer', 'ground:door-left', 'ground:window-display', 'ground:door-right']) {
    assert.ok([...emitted].some(featureId => featureId.endsWith(`:${id}`)), `${id} must render`);
  }
  assert.ok(![...emitted].some(id => /:full:(window-8|door-[34])$/.test(id)), 'newer ground openings replace only the overlapping older storefront records');
  assert.ok(!patches.some((patch: any) => patch.featureKind === 'observed-material'), 'case20 concave finishes remain withheld without an explicit reviewed opt-in');
  assert.deepEqual(baseline, case20.owner, 'builder must not mutate the case20 owner');
});

test('case22 source facade candidate preserves owner topology, observations, and every reviewed opening', () => {
  const baseline = structuredClone(item.owner);
  const observation = item.candidateObservations.find((entry: any) => entry.id === correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const sources = { full: source(item.shapeFeatures.full, observation.images.full), ground: source(item.shapeFeatures.ground, observation.images.ground) };
  const result = buildSourceFacadeOwnerCandidate(baseline, { ...correction, sources });
  assert.equal(result.provenance.registered, false);
  assert.equal(result.provenance.roofDepth.status, 'topology-derived-preview');
  const expectedAssemblySurfaces = correction.componentAssemblies.reduce((sum: number, assembly: any) => sum + assembly.verticalRailCount + 5, 0);
  assert.equal(result.owner.geometry.building.surfaces.length, baseline.geometry.building.surfaces.length + 1 + expectedAssemblySurfaces);
  const replaced = new Set([5, 25, 32]);
  baseline.geometry.building.surfaces.forEach((surface: any, index: number) => { if (!replaced.has(index)) assert.deepEqual(result.owner.geometry.building.surfaces[index], surface); });
  assert.deepEqual(result.owner.geometry.building.surfaces.slice(33, baseline.geometry.building.surfaces.length), baseline.geometry.building.surfaces.slice(33));
  assert.equal(result.provenance.nativeTopologyJoins.length, 3);
  assert.deepEqual(result.provenance.candidateReplacedSurfaceIndices, [5, 25, 32]);
  assert.deepEqual(result.owner.geometry.building.surfaces[5].rings[0], baseline.geometry.building.surfaces[5].rings[0].slice(1));
  assert.deepEqual(result.owner.geometry.building.surfaces[24], baseline.geometry.building.surfaces[24]);
  assert.deepEqual([result.owner.geometry.building.surfaces[32].rings[0][0], result.owner.geometry.building.surfaces[32].rings[0].at(-1)], [baseline.geometry.building.surfaces[32].rings[0][0], baseline.geometry.building.surfaces[32].rings[0][2]]);
  assert.equal(result.owner.geometry.building.surfaces[32].previewAppearance.role, 'roof-join-topology-derived');
  assert.equal(result.provenance.componentAssemblies.length, 3);
  assert.match(correction.scopeNote, /three balcony rail fronts/);
  assert.deepEqual(result.provenance.componentAssemblies.map((assembly: any) => assembly.observedBoundsPx), correction.componentAssemblies.map((assembly: any) => assembly.boundsPx));
  assert.ok(result.provenance.componentAssemblies.every((assembly: any) => assembly.projection.status === 'inferred' && assembly.projection.depthM > 0 && /does not measure projection/.test(assembly.projection.reason)));
  assert.equal(new Set(result.provenance.componentSurfaces.filter((surface: any) => surface.role === 'balcony-rail-observed').map((surface: any) => surface.name.split('-balcony-')[0])).size, 3);
  assert.equal(result.owner.observations.length, baseline.observations.length);
  const description = result.owner.observations[0].payload.facadeDescription;
  assert.deepEqual(description.sources.full.features, item.shapeFeatures.full.features);
  assert.deepEqual(description.sources.ground.features, item.shapeFeatures.ground.features);
  assert.equal(description.sources.full.features.length, 18);
  assert.equal(description.sources.ground.features.length, 7);
  assert.ok(description.sources.full.features.some((feature: any) => feature.kind === 'door'));
  assert.ok(description.sources.ground.features.some((feature: any) => feature.kind === 'door'));
  assert.equal(description.sources.full.registration.status, 'ambiguous');
  assert.equal(description.sources.ground.registration.status, 'ambiguous');
  assert.deepEqual(description.concaveMaterialPreview, correction.concaveMaterialPreview);
  const facadeIndex = result.provenance.appendedFacadeSurfaceIndex;
  const patches = compileFacadePatches(result.owner, result.owner.geometry.building.surfaces[facadeIndex], facadeIndex, result.owner.observations.map((entry: any) => entry.payload), [result.owner], { observed: true, candidateRegistrationPreview: true, procedural: false, contextual: false });
  const renderedUpper = new Set(patches.filter((patch: any) => patch.triangles.length && /full:review:/.test(patch.featureId)).map((patch: any) => patch.featureId.split(':full:review:')[1]));
  const renderedGround = new Set(patches.filter((patch: any) => patch.triangles.length && /ground:review:/.test(patch.featureId)).map((patch: any) => patch.featureId.split(':ground:review:')[1]));
  assert.equal(renderedUpper.size, 13, 'all upper inspected openings must compile on the candidate owner');
  assert.equal(renderedGround.size, 4, 'the newer ground tier must compile its three windows and door instead of duplicating the four full-crop ground openings');
  const frameAxis = description.sources.full.registration.imageToWall;
  assert.ok(frameAxis[0] < 0, 'source x must run opposite the sorted city wall axis for case22');
  const groundDoor = patches.find((patch: any) => patch.featureId.endsWith('ground:review:door-pair-assembly') && patch.triangles.length);
  const groundLeft = patches.find((patch: any) => patch.featureId.endsWith('ground:review:window-left') && patch.triangles.length);
  assert.ok(groundDoor && groundLeft);
  const along = (patch: any) => patch.triangles.filter((_: number, index: number) => index % 3 === 0).reduce((sum: number, value: number) => sum + value, 0) / (patch.triangles.length / 3);
  assert.ok(along(groundDoor) < along(groundLeft), 'right-hand source door must remain on the physical right after wall-axis normalization');
  const brick = patches.find((patch: any) => patch.featureId.endsWith('full:mat-1'));
  assert.ok(brick && brick.material === 'brick' && brick.triangles.length > 0, 'broad source brick must render after concave-safe clipping');
  const frame = facadeWallFrame(result.owner.geometry.building.surfaces[facadeIndex], result.owner, [result.owner])!;
  const local = (index: number): [number, number] => [(brick.triangles[index] - frame.a[0]) * frame.u[0] + (brick.triangles[index + 2] - frame.a[1]) * frame.u[1], brick.triangles[index + 1]];
  const area = (ring: number[][]) => Math.abs(ring.reduce((sum, point, index) => { const next = ring[(index + 1) % ring.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0)) / 2;
  const pointInside = (point: number[], ring: number[][]) => ring.some((a, index) => { const b = ring[(index + 1) % ring.length], cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]); return Math.abs(cross) < 1e-7 && point[0] >= Math.min(a[0], b[0]) - 1e-7 && point[0] <= Math.max(a[0], b[0]) + 1e-7 && point[1] >= Math.min(a[1], b[1]) - 1e-7 && point[1] <= Math.max(a[1], b[1]) + 1e-7; }) || (() => { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > point[1]) !== (ring[j][1] > point[1]) && point[0] < (ring[j][0] - ring[i][0]) * (point[1] - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) inside = !inside; return inside; })();
  let brickArea = 0;
  for (let index = 0; index < brick.triangles.length; index += 9) {
    const triangle = [local(index), local(index + 3), local(index + 6)];
    brickArea += area(triangle);
    const samples = [...triangle, ...triangle.map((point, vertex) => [(point[0] + triangle[(vertex + 1) % 3][0]) / 2, (point[1] + triangle[(vertex + 1) % 3][1]) / 2])];
    assert.ok(samples.every(point => pointInside(point, frame.polygon)), 'no emitted brick triangle may bridge the stepped-face notch');
    for (let vertex = index; vertex < index + 9; vertex += 3) assert.ok(Math.abs((brick.triangles[vertex] - frame.a[0]) * frame.n[0] + (brick.triangles[vertex + 2] - frame.a[1]) * frame.n[1] - .008) < 1e-8, 'brick depth must survive both clipping stages');
  }
  assert.ok(Math.abs(brickArea - area(frame.polygon)) < 1e-7, 'full-crop brick must cover the concave face exactly without a diagonal stripe or gap');
  assert.ok(!patches.some((patch: any) => /ground:material_0[12]$/.test(patch.featureId)), 'unreviewed ground finishes stay withheld instead of overlapping the full-crop brick');
  const world = (point: number[], depth: number) => [frame.a[0] + frame.u[0] * point[0] + frame.n[0] * depth, point[1], frame.a[1] + frame.u[1] * point[0] + frame.n[1] * depth];
  const retainedEdgeOn = [...world(frame.polygon[11], .08), ...world(frame.polygon[12], .16), ...world(frame.polygon[12], .24)];
  assert.deepEqual(clipTrianglesToFace(retainedEdgeOn, frame), retainedEdgeOn, 'a contained edge-on canopy side must retain all depth-varying vertices');
  const notchBridge = [...world(frame.polygon[11], .08), ...world(frame.polygon[15], .16), ...world(frame.polygon[15], .24)];
  assert.deepEqual(clipTrianglesToFace(notchBridge, frame), [], 'an edge-on chord crossing the stepped notch must not survive merely because its vertices lie on the boundary');
  assert.deepEqual(baseline, item.owner, 'builder must not mutate its input');
});

test('source correction fails closed on crop and owner bindings', () => {
  const observation = item.candidateObservations.find((entry: any) => entry.id === correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const sources = { full: source(item.shapeFeatures.full, observation.images.full), ground: source(item.shapeFeatures.ground, observation.images.ground) };
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, source: { ...correction.source, cropSha256: 'wrong' }, sources }), /binding mismatch/);
  const activeSources = { full: source(item.shapeFeatures.full, observation.images.full), ground: source(item.shapeFeatures.ground, observation.images.ground) };
  const staleOverride = structuredClone(activeCorrection);
  staleOverride.sourceFeatureOverrides[0].expectedFeatureSha256 = '0'.repeat(64);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...staleOverride, sources: activeSources }), /override binding mismatch/);
  const wrongCropOverride = structuredClone(activeCorrection);
  wrongCropOverride.sourceFeatureOverrides[0].sourceCropSha256 = '0'.repeat(64);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...wrongCropOverride, sources: activeSources }), /Invalid source feature override/);
  assert.throws(() => buildSourceFacadeOwnerCandidate({ ...item.owner, id: 'wrong' }, { ...correction, sources }), /owner identity/);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, componentAssemblies: [{ ...correction.componentAssemblies[0], verticalRailCount: Infinity }], sources }), /Invalid source balcony assembly/);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, componentAssemblies: [{ ...correction.componentAssemblies[0], verticalRailCount: 65 }], sources }), /Invalid source balcony assembly/);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, componentAssemblies: [{ ...correction.componentAssemblies[0], boundsPx: [-1, 348, 143, 408] }], sources }), /Invalid source balcony assembly/);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, nativeTopologyJoins: [{ ...correction.nativeTopologyJoins[2], replaceSurfaceIndex: 5 }], sources }), /replacement type mismatch/);
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, nativeTopologyJoins: [{ ...correction.nativeTopologyJoins[2], vertices: [{ native: { surfaceIndex: 31, ringIndex: 0, vertexIndex: 999 } }, ...correction.nativeTopologyJoins[2].vertices.slice(1)] }], sources }), /Invalid native topology join reference/);
  const changedTopology = structuredClone(item.owner);
  changedTopology.geometry.building.surfaces[31].rings[0][0][1] += .01;
  assert.throws(() => buildSourceFacadeOwnerCandidate(changedTopology, { ...correction, sources }), /Native topology surface binding mismatch/);
  const incompleteBinding = structuredClone(correction.nativeTopologyBinding);
  delete incompleteBinding.surfaceSha256['31'];
  assert.throws(() => buildSourceFacadeOwnerCandidate(item.owner, { ...correction, nativeTopologyBinding: incompleteBinding, sources }), /Missing native topology surface binding/);
});

test('partial facade bounds retain full-source sampling-plane coordinates', () => {
  const observation = item.candidateObservations.find((entry: any) => entry.id === correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const sources = { full: source(item.shapeFeatures.full, observation.images.full), ground: source(item.shapeFeatures.ground, observation.images.ground) };
  const left = 20, right = 276;
  const spec = { ...correction, facadeBoundsPx: { left, right, bottom: 936 }, silhouetteTopPx: [[left, 210], [72, 125], [132, 96], [right, 251]], sources };
  const result = buildSourceFacadeOwnerCandidate(item.owner, spec);
  const wall = result.owner.geometry.building.surfaces[result.provenance.appendedFacadeSurfaceIndex].rings[0], origin = item.owner.geometry.frame.originRD, plane = correction.source.plane;
  const expected = (x: number) => [plane.start.x + x / correction.source.dimensions.width * (plane.end.x - plane.start.x) - origin.x, origin.y - (plane.start.y + x / correction.source.dimensions.width * (plane.end.y - plane.start.y))];
  assert.deepEqual([wall[0][0], wall[0][2]], expected(left));
  assert.deepEqual([wall[1][0], wall[1][2]], expected(right));
});

test('case25 flat negative control preserves reviewed masonry and every door and window', () => {
  const baseline = structuredClone(case25.owner);
  const observation = case25.candidateObservations.find((entry: any) => entry.id === case25Correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const sources = { full: source(case25.shapeFeatures.full, observation.images.full), ground: source(case25.shapeFeatures.ground, observation.images.ground) };
  const result = buildSourceFacadeOwnerCandidate(baseline, { ...case25Correction, sources });
  assert.equal(result.provenance.registered, false);
  assert.equal(result.provenance.placement.status, 'inferred');
  assert.match(result.provenance.placement.reason, /no measured registration/i);
  assert.deepEqual(result.owner.geometry.building.surfaces.slice(0, baseline.geometry.building.surfaces.length), baseline.geometry.building.surfaces);
  const expectedAssemblySurfaces = case25Correction.componentAssemblies.reduce((sum: number, assembly: any) => sum + assembly.verticalRailCount + 5, 0);
  assert.equal(result.owner.geometry.building.surfaces.length, baseline.geometry.building.surfaces.length + 1 + expectedAssemblySurfaces);
  assert.equal(result.provenance.componentAssemblies.length, 1);
  assert.equal(result.provenance.componentAssemblies[0].name, 'central-balcony-front');
  assert.equal(result.owner.observations.length, baseline.observations.length);
  const description = result.owner.observations[0].payload.facadeDescription;
  assert.deepEqual(description.sources.full.features, case25.shapeFeatures.full.features);
  assert.deepEqual(description.sources.ground.features, case25.shapeFeatures.ground.features);
  assert.equal(description.sources.full.registration.status, 'ambiguous');
  assert.equal(description.sources.ground.registration.status, 'ambiguous');
  const full = description.sources.full.features;
  assert.equal(full.filter((feature: any) => feature.kind === 'window').length, 10);
  assert.equal(full.filter((feature: any) => feature.kind === 'door').length, 1);
  assert.equal(full.filter((feature: any) => feature.region === 'cornice').length, 1);
  assert.equal(full.filter((feature: any) => feature.region === 'masonry-band').length, 12);
  assert.equal(full.filter((feature: any) => feature.region === 'sill').length, 9);
  assert.ok(full.filter((feature: any) => feature.kind === 'window' && feature.row <= 3).every((feature: any) => feature.head === 'rectangular'));
  const ground = description.sources.ground.features;
  assert.ok(ground.some((feature: any) => feature.kind === 'door' && feature.id === 'ground:review:left-entrance'));
  assert.ok(ground.some((feature: any) => feature.kind === 'window' && feature.id === 'ground:review:broad-ground-window'));
  const patches = compileFacadePatches(result.owner, result.owner.geometry.building.surfaces[baseline.geometry.building.surfaces.length], baseline.geometry.building.surfaces.length, result.owner.observations.map((entry: any) => entry.payload), [result.owner], { observed: true, candidateRegistrationPreview: true, procedural: false, contextual: false });
  assert.ok(patches.some((patch: any) => patch.featureId.endsWith('full:review:cornice') && patch.triangles.length));
  assert.equal(new Set(patches.filter((patch: any) => /full:review:band-/.test(patch.featureId) && patch.triangles.length).map((patch: any) => patch.featureId)).size, 12);
  assert.equal(new Set(patches.filter((patch: any) => /full:review:sill-/.test(patch.featureId) && patch.triangles.length).map((patch: any) => patch.featureId)).size, 9);
  const emitted = new Set(patches.filter((patch: any) => patch.triangles.length).map((patch: any) => patch.featureId));
  for (let index = 1; index <= 9; index++) assert.ok([...emitted].some(id => id.endsWith(`:full:w${index}`)), `complete full:w${index} must render`);
  assert.ok([...emitted].some(id => id.endsWith(':ground:review:left-entrance')), 'inspected older ground door must render');
  assert.ok([...emitted].some(id => id.endsWith(':ground:review:broad-ground-window')), 'inspected older broad ground window must render');
  assert.ok(![...emitted].some(id => /:ground:window-upper-[123]$/.test(id)), 'older top-edge crop fragments must not replace complete full-source windows');
  const frame = facadeWallFrame(result.owner.geometry.building.surfaces[baseline.geometry.building.surfaces.length], result.owner, [result.owner]);
  assert.ok(frame);
  const depth = (patch: any) => patch.triangles.filter((_: number, index: number) => index % 3 === 0).reduce((sum: number, x: number, vertex: number) => sum + (x - frame!.a[0]) * frame!.n[0] + (patch.triangles[vertex * 3 + 2] - frame!.a[1]) * frame!.n[1], 0) / (patch.triangles.length / 3);
  const base = patches.find((patch: any) => patch.featureId.endsWith(':ground:material-brick'));
  const sill = patches.find((patch: any) => patch.featureId.endsWith(':full:review:sill-3a'));
  const glass = patches.find((patch: any) => patch.featureId.endsWith(':full:w7') && patch.colour === 'windowGlass');
  assert.ok(base && sill && glass, 'depth-order fixtures must all render');
  assert.ok(depth(base) < depth(sill) && depth(sill) < depth(glass), 'reviewed trim must sit above broad material and behind glazing');
  const components = result.provenance.componentSurfaces;
  assert.equal(components.filter((surface: any) => surface.role === 'balcony-rail-observed').length, 15);
  assert.equal(components.filter((surface: any) => surface.role === 'balcony-slab-observed-front').length, 1);
  assert.equal(components.filter((surface: any) => surface.role === 'balcony-slab-inferred-depth').length, 1);
  assert.ok(components.every((surface: any) => surface.inferredNormalOffsetsM.every((offset: number) => offset >= 0 && offset <= .1)));
  assert.ok(components.every((surface: any) => /oblique side return.*excluded/i.test(surface.basis)), 'front-only component must not claim the side return');
  assert.deepEqual(baseline, case25.owner, 'builder must not mutate the case25 owner');
});

test('flat parapets need only their two real endpoints', () => {
  const observation = case25.candidateObservations.find((entry: any) => entry.id === case25Correction.observationId);
  const source = (features: any, image: any) => ({ ...features, projection: { plane: image.plane, localToNAPOffsetM: .65 } });
  const sources = { full: source(case25.shapeFeatures.full, observation.images.full), ground: source(case25.shapeFeatures.ground, observation.images.ground) };
  const result = buildSourceFacadeOwnerCandidate(case25.owner, { ...case25Correction, silhouetteTopPx: [[0, 66], [255, 66]], sources });
  assert.deepEqual(result.owner.geometry.building.surfaces[case25.owner.geometry.building.surfaces.length].rings[0].slice(2).map((point: number[]) => point[1]), result.owner.geometry.building.surfaces[case25.owner.geometry.building.surfaces.length].rings[0].slice(2).map(() => result.owner.geometry.building.surfaces[case25.owner.geometry.building.surfaces.length].rings[0][2][1]));
  assert.throws(() => buildSourceFacadeOwnerCandidate(case25.owner, { ...case25Correction, silhouetteTopPx: [[0, 66]], sources }), /Invalid source silhouette/);
});
