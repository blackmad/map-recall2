import assert from 'node:assert/strict';
import {
  isDrawableAsMeasured,
  resolvePublication,
  tallyPublications,
  type AppearanceGrade,
  type PublicationDecision,
} from './appearancePublication.ts';

let checks = 0;
const check = (condition: boolean, message: string) => {
  assert.ok(condition, message);
  checks += 1;
};

const SHA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const grade = (over: Partial<AppearanceGrade> = {}): AppearanceGrade => ({
  observationId: 'obs-1',
  verdict: 'accept',
  sourceSha256: SHA,
  gradedAt: '2026-09-24T10:00:00Z',
  grader: 'owner',
  ...over,
});

// Only the accepted state may be drawn as measured.
check(isDrawableAsMeasured('accepted-human-reviewed'), 'accepted draws');
for (const state of ['quarantined-machine-preview', 'revoked-machine-observation',
  'withheld-source-audit-only', 'candidate-registration-preview'] as const) {
  check(!isDrawableAsMeasured(state), `${state} does not draw`);
}

// An ungraded record is left exactly where it was.
{
  const out = resolvePublication({ current: 'quarantined-machine-preview', sourceSha256: SHA, measuredHex: '#883322' });
  check(out.publication === 'quarantined-machine-preview', 'ungraded stays quarantined');
  check(out.stale === false, 'ungraded is not stale');
  check(out.hex === undefined, 'ungraded publishes no colour');
}

// The binding check: a grade against other pixels is not a grade.
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ sourceSha256: OTHER }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.stale === true, 'a grade against a different crop is stale');
  check(out.publication === 'quarantined-machine-preview', 'stale grade does not promote');
  check(out.hex === undefined, 'stale grade publishes no colour');
  check(out.reason.includes('bbbbbbbbbbbb'), 'the reason names the crop the grade was given against');
}

// An already-accepted record whose evidence moved underneath it is demoted.
{
  const out = resolvePublication({
    current: 'accepted-human-reviewed',
    grade: grade({ sourceSha256: OTHER }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.publication === 'quarantined-machine-preview', 'a stale acceptance is demoted, not kept');
  check(out.stale === true, 'the demotion is reported as stale');
}

// An empty sourceSha256 on the grade never passes the binding check.
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ sourceSha256: '' }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.stale === true, 'a grade with no binding hash is stale');
}

// Accept promotes and publishes the measured colour, lowercased.
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade(),
    sourceSha256: SHA,
    measuredHex: '#8B3A2F',
  });
  check(out.publication === 'accepted-human-reviewed', 'accept promotes');
  check(out.hex === '#8b3a2f', 'accept publishes the measured colour, lowercased');
  check(out.stale === false, 'a bound accept is not stale');
}

// Accept cannot promote when the run produced nothing to publish.
{
  const out = resolvePublication({ current: 'quarantined-machine-preview', grade: grade(), sourceSha256: SHA });
  check(out.publication === 'quarantined-machine-preview', 'accept without a measured colour does not promote');
  check(out.reason.includes('no valid measured colour'), 'and says why');
}
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview', grade: grade(), sourceSha256: SHA, measuredHex: 'red',
  });
  check(out.publication === 'quarantined-machine-preview', 'a non-hex measured colour does not promote');
}

// Adjust supersedes the measurement with the grader's colour.
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ verdict: 'adjust', correctedHex: '#5C4033' }),
    sourceSha256: SHA,
    measuredHex: '#3f6b6e',
  });
  check(out.publication === 'accepted-human-reviewed', 'adjust promotes');
  check(out.hex === '#5c4033', 'adjust publishes the grader colour, not the measured one');
}
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ verdict: 'adjust' }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.publication === 'quarantined-machine-preview', 'adjust without a replacement colour does not promote');
  check(out.hex === undefined, 'and publishes nothing');
}
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ verdict: 'adjust', correctedHex: '#xyzxyz' }),
    sourceSha256: SHA,
  });
  check(out.publication === 'quarantined-machine-preview', 'a malformed replacement colour does not promote');
}

// Unusable revokes, and carries the grader's reasons.
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ verdict: 'unusable', reasons: ['occluded', 'shadow'] }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.publication === 'revoked-machine-observation', 'unusable revokes');
  check(out.hex === undefined, 'a revoked wall publishes no colour');
  check(out.reason.includes('occluded') && out.reason.includes('shadow'), 'the reasons survive into the record');
}

// Skip is explicitly an absence of opinion.
{
  const out = resolvePublication({
    current: 'quarantined-machine-preview',
    grade: grade({ verdict: 'skip' }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.publication === 'quarantined-machine-preview', 'skip changes nothing');
  check(out.hex === undefined, 'skip publishes nothing');
}
{
  const out = resolvePublication({
    current: 'accepted-human-reviewed',
    grade: grade({ verdict: 'skip' }),
    sourceSha256: SHA,
    measuredHex: '#883322',
  });
  check(out.publication === 'accepted-human-reviewed', 'skip does not demote an existing acceptance');
}

// The tally is what lets a release stop reporting accepted: 0.
{
  const decisions: PublicationDecision[] = [
    { publication: 'accepted-human-reviewed', reason: 'ok', hex: '#883322', stale: false },
    { publication: 'accepted-human-reviewed', reason: 'ok', hex: '#7a2b20', stale: false },
    { publication: 'revoked-machine-observation', reason: 'unusable', stale: false },
    { publication: 'quarantined-machine-preview', reason: 'no grade recorded', stale: false },
    { publication: 'quarantined-machine-preview', reason: 'grade was given against crop …', stale: true },
  ];
  const tally = tallyPublications(decisions);
  check(tally.accepted === 2, 'two accepted');
  check(tally.revoked === 1, 'one revoked');
  check(tally.ungraded === 1, 'one never graded');
  check(tally.stale === 1, 'one stale');
  check(tally.quarantined === 1, 'the stale one counts as quarantined, not accepted');
}

console.log(`appearance publication checks passed (${checks} assertions).`);
