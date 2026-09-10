import assert from 'node:assert/strict';
import {
  externalAssessmentIsActionable,
  externalIdentityDecision,
  externalPhotoLicenseIsReusable,
  normalizeIdentityText,
  scoreExternalPhotoCandidate,
  type ExternalIdentityAssessment,
  type ExternalPhotoCandidate,
} from '../src/canalRecall/facade/externalIdentityReview.ts';

assert.equal(normalizeIdentityText('File:Hérengracht 270.JPG'), 'herengracht 270 jpg');
for (const license of ['CC0 1.0', 'Public domain', 'CC BY 4.0', 'CC BY-SA 3.0']) {
  assert.equal(externalPhotoLicenseIsReusable(license), true, `${license} is reusable`);
}
for (const license of ['', 'All rights reserved', 'Copyrighted free use', 'CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-SA-NC 4.0', 'CC BY 4.0 extra', 'CC BY', 'PD-unknown', 'CC0 1.0 copyrighted']) {
  assert.equal(externalPhotoLicenseIsReusable(license), false, `${license || 'missing license'} fails closed`);
}

const exact: ExternalPhotoCandidate = {
  pageId: 1, title: 'File:Herengracht 270.JPG', description: 'Herengracht 270, Amsterdam',
  licenseShortName: 'CC BY-SA 4.0', mime: 'image/jpeg',
};
const nearby: ExternalPhotoCandidate = {
  ...exact, pageId: 2, title: 'File:Herengracht 272.JPG', description: 'Canal houses in Amsterdam',
};
const interior: ExternalPhotoCandidate = {
  ...exact, pageId: 3, title: 'File:Herengracht 270 interior.JPG', description: 'Interior floor plan of Herengracht 270',
};
assert.equal(scoreExternalPhotoCandidate(exact, 'Herengracht 270').score > scoreExternalPhotoCandidate(nearby, 'Herengracht 270').score, true);
assert.equal(scoreExternalPhotoCandidate(exact, 'Herengracht 270').score > scoreExternalPhotoCandidate(interior, 'Herengracht 270').score, true);


const context = { fixtureId: 'fixture', pandId: 'pand', observationHash: 'a'.repeat(64), evidence: [
  { title: 'one', evidenceId: 'commons-1', sha256: '1'.repeat(64), sourceSha1: 'first-original', licenseShortName: 'CC BY 4.0' },
  { title: 'two', evidenceId: 'commons-2', sha256: '2'.repeat(64), sourceSha1: 'second-original', licenseShortName: 'CC BY-SA 4.0' },
] };
const assessment: ExternalIdentityAssessment = {
  fixtureId: 'fixture', pandId: 'pand', conclusion: 'supports', reviewer: 'test', reviewedAt: '2026-09-05T00:00:00Z',
  evidenceTitles: ['one', 'two'], rationale: 'Two distinct views show the cited gable and entrance correspondences.',
  correspondences: ['stepped gable', 'entrance'], observationHash: context.observationHash,
  evidenceHashes: { one: '1'.repeat(64), two: '2'.repeat(64) },
};
assert.equal(externalAssessmentIsActionable(assessment, context), true);
assert.equal(externalIdentityDecision({ ...assessment, conclusion: 'contradicts' }, context), 'contradicts');
for (const change of [
  { evidenceTitles: ['one', 'one'] }, { reviewer: ' ' }, { reviewedAt: 'invalid' }, { pandId: 'wrong' },
  { fixtureId: 'wrong' }, { observationHash: 'b'.repeat(64) }, { evidenceHashes: {} },
  { correspondences: ['entrance', 'entrance'] }, { conclusion: 'invented' },
]) assert.equal(externalIdentityDecision({ ...assessment, ...change } as ExternalIdentityAssessment, context), 'insufficient');
for (const change of [
  { title: 'one' }, { evidenceId: 'commons-1' }, { sha256: '1'.repeat(64) }, { sourceSha1: 'first-original' },
  { sourceSha1: null }, { licenseShortName: 'CC BY-NC 4.0' },
]) assert.equal(externalIdentityDecision(assessment, { ...context, evidence: [context.evidence[0], { ...context.evidence[1], ...change }] }), 'insufficient');
assert.equal(externalIdentityDecision(assessment, { ...context, evidence: context.evidence.slice(0, 1) }), 'insufficient');
console.log('External identity checks passed: exact licenses, distinct bytes/originals, version-bound advisory assessments.');
