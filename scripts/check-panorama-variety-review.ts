import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

type Strip = { pandId: string; sourceSha256: string };
type ReviewCase = Strip & { disposition: string; review: string };

const fixturePath = path.resolve('src/canalRecall/facade/fixtures/panorama-variety-development.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
  schemaVersion: number;
  sourceRun: string;
  sourceManifestSha256: string;
  reviewMethod: string;
  cases: ReviewCase[];
  rejectedPredecessors: Array<{ pandId: string; reason: string }>;
};
const manifestPath = path.resolve(fixture.sourceRun, 'manifest.json');
const manifestBytes = fs.readFileSync(manifestPath);
const manifest = JSON.parse(manifestBytes.toString('utf8')) as { strips: Strip[] };
const digest = crypto.createHash('sha256').update(manifestBytes).digest('hex');

assert.equal(fixture.schemaVersion, 2);
assert.equal(digest, fixture.sourceManifestSha256, 'review fixture must pin the exact source manifest');
assert.ok(fixture.reviewMethod.includes('raw municipal panorama'));
assert.equal(new Set(fixture.cases.map((item) => item.pandId)).size, fixture.cases.length);
assert.equal(new Set(fixture.rejectedPredecessors.map((item) => item.pandId)).size, fixture.rejectedPredecessors.length);
assert.deepEqual(
  new Set(fixture.cases.map((item) => item.sourceSha256)),
  new Set(manifest.strips.map((item) => item.sourceSha256)),
  'every source strip must have exactly one registration-review disposition',
);

const sourceByHash = new Map(manifest.strips.map((item) => [item.sourceSha256, item]));
const allowed = new Set(['usable-development', 'usable-hard-negative', 'diagnostic-only']);
for (const item of fixture.cases) {
  assert.ok(allowed.has(item.disposition), `unknown disposition for ${item.pandId}`);
  assert.equal(sourceByHash.get(item.sourceSha256)?.pandId, item.pandId, `review/source mismatch for ${item.pandId}`);
  assert.ok(item.review.length >= 20, `review rationale missing for ${item.pandId}`);
}
for (const item of fixture.rejectedPredecessors) {
  assert.ok(!fixture.cases.some((candidate) => candidate.pandId === item.pandId));
  assert.ok(item.reason.length >= 20, `rejection rationale missing for ${item.pandId}`);
}

const usable = fixture.cases.filter((item) => item.disposition.startsWith('usable-')).length;
const diagnostic = fixture.cases.filter((item) => item.disposition === 'diagnostic-only').length;
assert.equal(usable, 10);
assert.equal(diagnostic, 2);
console.log(`panorama variety review: ${usable} usable, ${diagnostic} diagnostic, ${fixture.rejectedPredecessors.length} rejected predecessors`);
