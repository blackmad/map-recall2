import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registrationFixtureIsReviewed, registrationObservationHash, mergeRegistrationDraft, type RegistrationGoldFixture } from '../src/canalRecall/facade/registrationGold.ts';

const invalidation = JSON.parse(readFileSync('src/canalRecall/facade/fixtures/street-derived-invalidation.json', 'utf8'));
assert.equal(invalidation.knownRegression.pandId, '0363100012164989');
assert.equal(invalidation.knownRegression.panoramaId, 'TMX7316010203-001543_pano_0000_003628');
assert.equal(invalidation.invalidArtifactClasses.length >= 8, true);
assert.equal(invalidation.forbiddenInputs.some((entry: string) => entry.includes('measured')), true);

const catalog = JSON.parse(readFileSync('src/canalRecall/facade/fixtures/registration-gold-candidates.json', 'utf8')) as {
  candidates: Array<{ pandId: string; label: string; intendedCoverage: string[] }>;
};
assert.equal(catalog.candidates.length, 16, 'the initial gold set has the planned 16 buildings');
assert.equal(new Set(catalog.candidates.map(candidate => candidate.pandId)).size, catalog.candidates.length, 'every gold pand is unique');
for (const pandId of ['0363100012164989', '0363100012169587', '0363100012177213', '0363100012176355', '0363100012168556']) {
  assert.equal(catalog.candidates.some(candidate => candidate.pandId === pandId), true, `required fixture ${pandId} is present`);
}
for (const coverage of ['east-bank', 'west-bank', 'north-bank', 'south-edge', 'corner-building-review', 'irregular-footprint-review', 'multi-address-review']) {
  assert.equal(catalog.candidates.some(candidate => candidate.intendedCoverage.includes(coverage)), true, `gold set covers ${coverage}`);
}


const { buildElevations } = await import('../src/canalRecall/facade/elevations.ts');
const footprintRd = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 20 }, { x: 0, y: 20 }];
const pandId = '0363100012164989';
const elevations = buildElevations(footprintRd, { pandId });
const fixture: RegistrationGoldFixture = {
  fixtureId: 'regression', pandId, label: 'Synthetic gate fixture', status: 'candidate', rationale: '', intendedCoverage: [],
  addresses: [], footprintRd, elevations, selectedElevationId: elevations[0].elevationId, elevationSelectionBasis: null,
  panorama: { panoramaId: 'synthetic', lngLat: [4.88, 52.37], cameraRd: { x: 4, y: -20 }, cameraHeight: 2,
    headingDeg: 0, pitchDeg: 0, rollDeg: 0, capturedAt: '2026-09-04T00:00:00Z', imageUrl: 'https://example.invalid/pano.jpg',
    previewUrl: null, missionYear: 'synthetic', mission: 'synthetic', localImageUrl: 'local/pano.jpg' },
  identityVersion: 'synthetic-bag/v1', sourceVersion: { sha256: 'a'.repeat(64), width: 8000, height: 4000, schema: 'synthetic/v1' },
  cameraModelVersion: null, sourceQuad: null, rectifiedPreviewUrl: null, anchors: [], reviewPasses: [],
};
const accepted = { passId: '1', reviewer: 'tester', reviewedAt: '2026-09-04T00:00:00Z',
  identityVerdict: 'accepted' as const, elevationVerdict: 'accepted' as const, note: 'Synthetic review',
  observationHash: await registrationObservationHash(fixture) };
fixture.reviewPasses.push(accepted);
assert.equal(await registrationFixtureIsReviewed(fixture), true, 'one version-bound identity review suffices without metric anchors');
for (const [label, change] of [
  ['no wall', { selectedElevationId: null }], ['invalid wall', { selectedElevationId: 'missing' }],
  ['unusable', { status: 'rejected' }], ['stale', { status: 'stale' }], ['no source', { panorama: null }],
  ['old source', { sourceVersion: undefined }], ['no identity version', { identityVersion: undefined }],
  ['new source bytes', { sourceVersion: { ...fixture.sourceVersion!, sha256: 'b'.repeat(64) } }],
  ['new pose', { panorama: { ...fixture.panorama!, headingDeg: 180 } }],
  ['new wall geometry', { elevations: elevations.map(wall => ({ ...wall, lengthM: wall.lengthM + 1 })) }],
  ['new identity', { pandId: '0363100012164990' }],
  ['missing review hash', { reviewPasses: [{ ...accepted, observationHash: undefined }] }],
  ['missing reviewer', { reviewPasses: [{ ...accepted, reviewer: ' ' }] }],
  ['invalid time', { reviewPasses: [{ ...accepted, reviewedAt: 'yesterday' }] }],
] as Array<[string, Partial<RegistrationGoldFixture>]>) {
  assert.equal(await registrationFixtureIsReviewed({ ...fixture, ...change }), false, label);
}
for (const verdict of ['rejected', 'uncertain'] as const) {
  const later = { ...accepted, passId: '2', reviewedAt: '2026-09-05T00:00:00Z', identityVerdict: verdict };
  assert.equal(await registrationFixtureIsReviewed({ ...fixture, reviewPasses: [accepted, later] }), false, `later ${verdict} revokes`);
  assert.equal(await registrationFixtureIsReviewed({ ...fixture, reviewPasses: [later, accepted] }), false, 'import order cannot resurrect old approval');
}
const fresh = { ...fixture, sourceVersion: { ...fixture.sourceVersion!, sha256: 'b'.repeat(64) } };
const merged = mergeRegistrationDraft(fresh, fixture);
assert.equal(merged.sourceVersion?.sha256, fresh.sourceVersion.sha256, 'browser draft cannot replace refreshed source');
assert.equal(await registrationFixtureIsReviewed(merged), false, 'old draft cannot restore acceptance');
assert.equal(await registrationObservationHash({ ...fixture, rectifiedPreviewUrl: 'new-preview.jpg' }), accepted.observationHash,
  'output preview changes do not invalidate source registration');
console.log('Façade registration fixtures passed: catalog structure, latest decision, source/wall revocation and draft merge. No real registrations certified.');

const equalTimeRejection = { ...accepted, passId: 'same-time-rejection', identityVerdict: 'rejected' as const };
for (const history of [[accepted, equalTimeRejection], [equalTimeRejection, accepted]]) {
  assert.equal(await registrationFixtureIsReviewed({ ...fixture, reviewPasses: history }), false, 'conflicting equal-time imports fail closed');
}
const forgedWall = { ...fixture, selectedElevationId: 'invented', elevations: [{ ...elevations[0], elevationId: 'invented' }] };
forgedWall.reviewPasses = [{ ...accepted, observationHash: await registrationObservationHash(forgedWall) }];
assert.equal(await registrationFixtureIsReviewed(forgedWall), false, 'even a new review cannot accept a wall absent from the footprint');

const relocated = { ...fixture, panorama: { ...fixture.panorama!, localImageUrl: 'another-local-cache/pano.jpg' } };
assert.equal(await registrationFixtureIsReviewed(mergeRegistrationDraft(relocated, fixture)), true,
  'moving identical cached source bytes does not revoke the review');
