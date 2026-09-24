import assert from 'node:assert/strict';
import {
  canonicalJson,
  isRooflineGradeExport,
  isRooflineGradeRecord,
  gradeMatchesProfile,
  mergeRooflineGradeImport,
  parseRooflineGrades,
  profileContentHash,
  rooflineReviewProgress,
  serializeRooflineGrades,
  type RooflineGradeExport,
  type RooflineGradeRecord,
  type RooflineProfile,
} from './rooflineGrade.ts';

let checks = 0;
const check = (condition: boolean, label: string) => {
  checks += 1;
  assert.ok(condition, label);
};

function fixtureProfile(pandId = '0363100012164991'): RooflineProfile {
  return {
    pandId,
    address: 'Herengracht 242',
    wall: { start: [120916.68, 487247.3], end: [120917.12, 487253.07] },
    views: [{
      file: 'Herengracht-242__0363100012164991__2021-01-22.jpg',
      panoramaId: 'TMX7316010203-001975_pano_0000_000458',
      capturedAt: '2021-01-22',
      coarsePx: [10, 11, null, 13],
      snappedPx: [9, 11, null, 14],
      profile: [[0, 15.1], [0.1, 15.0], [0.2, null], [0.3, 13.9]],
    }],
    consensus: [[0, 15.1], [0.1, 15.0], [0.2, null], [0.3, 13.9]],
    shape: 'shaped',
    profileSha256: 'unset',
    imageUrl: 'roofline-review/local/x.jpg',
    fixture: true,
  };
}

// 1. Canonical JSON ignores key order.
check(canonicalJson({ a: 1, b: { c: 2, d: 3 } }) === canonicalJson({ b: { d: 3, c: 2 }, a: 1 }), 'canonical json is order independent');

// 2. The content hash is stable and ignores materialisation extras.
const profile = fixtureProfile();
const hashA = await profileContentHash(profile);
const hashB = await profileContentHash({ ...profile, imageUrl: 'roofline-review/local/other.jpg', fixture: false });
check(hashA === hashB, 'hash ignores imageUrl and fixture flag');
const mutated = fixtureProfile();
mutated.views[0].snappedPx[1] = 99;
const hashC = await profileContentHash(mutated);
check(hashA !== hashC, 'hash changes when a snapped row changes');
check(/^[a-f0-9]{64}$/.test(hashA), 'hash is a sha256 hex digest');

// 3. Record validation.
const valid: RooflineGradeRecord = {
  pandId: profile.pandId, profileSha256: hashA, grade: 3, wrongReason: 'tree', note: 'branch over the eaves', gradedAt: '2026-09-22T10:00:00.000Z',
};
check(isRooflineGradeRecord(valid), 'valid record passes');
check(!isRooflineGradeRecord({ ...valid, grade: 5 }), 'grade 5 rejected');
check(!isRooflineGradeRecord({ ...valid, grade: 0 }), 'grade 0 rejected');
check(!isRooflineGradeRecord({ ...valid, profileSha256: 'nope' }), 'bad hash rejected');
check(!isRooflineGradeRecord({ ...valid, wrongReason: 'weather' }), 'unknown wrong reason rejected');
check(!isRooflineGradeRecord({ ...valid, gradedAt: 'not-a-date' }), 'bad timestamp rejected');
check(isRooflineGradeRecord({ ...valid, wrongReason: null }), 'null wrong reason allowed');

// 4. Export/import round trip.
const payload: RooflineGradeExport = { schemaVersion: 1, kind: 'roofline-grades', exportedAt: '2026-09-22T10:05:00.000Z', grades: [valid] };
const parsed = parseRooflineGrades(serializeRooflineGrades(payload));
check(JSON.stringify(parsed) === JSON.stringify(payload), 'round trip preserves the payload');
assert.throws(() => parseRooflineGrades('{"schemaVersion":2}'), /Not a roofline-grades export/);
check(isRooflineGradeExport(payload), 'export validator accepts a valid envelope');

// 5. Import binds to the profile hash.
const matching = mergeRooflineGradeImport([], payload, [{ pandId: profile.pandId, profileSha256: hashA }]);
check(matching.accepted.length === 1 && matching.rejected.length === 0, 'matching hash is accepted');
const mismatched = mergeRooflineGradeImport([], payload, [{ pandId: profile.pandId, profileSha256: hashC }]);
check(mismatched.accepted.length === 0 && mismatched.rejected[0]?.reason === 'hash-mismatch', 'changed profile rejects the grade');
const unknown = mergeRooflineGradeImport([], payload, [{ pandId: '0363100012160000', profileSha256: hashA }]);
check(unknown.rejected[0]?.reason === 'unknown-profile', 'unseen pand is rejected');
const existing: RooflineGradeRecord = { ...valid, grade: 1, wrongReason: null, note: '' };
const overwritten = mergeRooflineGradeImport([existing], payload, [{ pandId: profile.pandId, profileSha256: hashA }]);
check(overwritten.grades.length === 1 && overwritten.grades[0].grade === 3, 'import replaces the current grade for the same pand');

// 6. Progress counts stale grades separately.
const progress = rooflineReviewProgress(
  [{ pandId: profile.pandId, profileSha256: hashA }],
  [valid, { ...valid, profileSha256: hashC }],
);
check(progress.graded === 1 && progress.stale === 1 && progress.byValue[3] === 1, 'progress separates graded from stale');
check(gradeMatchesProfile(valid, { profileSha256: hashA }), 'grade matches its profile');
check(!gradeMatchesProfile(valid, { profileSha256: hashC }), 'grade does not match a changed profile');

process.stdout.write(`Roofline grade-state checks passed (${checks} assertions).\n`);
