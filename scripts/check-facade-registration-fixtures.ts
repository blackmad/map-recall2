import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registrationFixtureIsAgreed, type RegistrationGoldFixture } from '../src/canalRecall/facade/registrationGold.ts';

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

const review = (passId: 'pass-1' | 'pass-2', verdict: 'accepted' | 'uncertain') => ({
  passId, reviewer: passId, reviewedAt: '2026-09-04T00:00:00Z', identityVerdict: verdict,
  elevationVerdict: verdict, note: 'fixture-only test',
});
const fixture = { selectedElevationId: 'pand:e:wall', reviewPasses: [review('pass-1', 'accepted'), review('pass-2', 'accepted')] } as RegistrationGoldFixture;
assert.equal(registrationFixtureIsAgreed(fixture), true);
assert.equal(registrationFixtureIsAgreed({ ...fixture, reviewPasses: [review('pass-1', 'accepted')] }), false, 'one pass cannot certify registration');
assert.equal(registrationFixtureIsAgreed({ ...fixture, reviewPasses: [review('pass-1', 'accepted'), review('pass-2', 'uncertain')] }), false, 'uncertainty fails closed');
assert.equal(registrationFixtureIsAgreed({
  ...fixture,
  reviewPasses: [
    { ...review('pass-1', 'accepted'), reviewer: 'Same Person' },
    { ...review('pass-2', 'accepted'), reviewer: ' same person ' },
  ],
}), false, 'one reviewer cannot certify both independent passes');

console.log('Façade registration fixture checks passed (16-building coverage, invalidation, two-pass agreement).');
