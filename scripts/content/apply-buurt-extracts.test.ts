import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeBuurtExtracts, type Hood } from './apply-buurt-extracts.ts';

const staged: Hood[] = [
  { name: 'A', wikipediaExtract: 'New text.', sources: ['https://x'], original: ['nl'] },
  { name: 'B', wikipediaExtract: 'Never overwrite.', sources: ['https://x'] },
  { name: 'C', wikipediaExtract: 'Brand new.', sources: ['https://x'] },
  { name: 'D', wikipediaExtract: 'No sources.', sources: [] },
];
const published: Hood[] = [
  { name: 'A', imageUrl: 'i' },
  { name: 'B', wikipediaExtract: 'Existing.' },
];

test('fills blanks, keeps existing, appends missing, skips unsourced', () => {
  const r = mergeBuurtExtracts(published, staged);
  assert.deepEqual(r.filled, ['A']);
  assert.deepEqual(r.added, ['C']);
  assert.deepEqual(r.skipped, ['D']);
  assert.equal(r.merged[0].wikipediaExtract, 'New text.');
  assert.equal(r.merged[0].imageUrl, 'i');
  assert.equal(r.merged[1].wikipediaExtract, 'Existing.');
  assert.equal(published[0].wikipediaExtract, undefined);
});

test('idempotent', () => {
  const once = mergeBuurtExtracts(published, staged).merged;
  const twice = mergeBuurtExtracts(once, staged);
  assert.deepEqual(twice.merged, once);
  assert.deepEqual(twice.filled, []);
  assert.deepEqual(twice.added, []);
});

test('replace overwrites only when flagged, and is idempotent', () => {
  const pub: Hood[] = [{ name: 'A', wikipediaExtract: 'Old.', sources: ['https://old'] }, { name: 'B', wikipediaExtract: 'Old B.' }];
  const rows: Hood[] = [
    { name: 'A', wikipediaExtract: 'Fuller.', sources: ['https://x'], replace: true },
    { name: 'B', wikipediaExtract: 'Unflagged.', sources: ['https://x'] },
  ];
  const once = mergeBuurtExtracts(pub, rows);
  assert.equal(once.merged[0].wikipediaExtract, 'Fuller.');
  assert.deepEqual(once.merged[0].sources, ['https://x']);
  assert.equal(once.merged[1].wikipediaExtract, 'Old B.');
  assert.equal('replace' in once.merged[0], false);
  assert.deepEqual(once.filled, ['A']);
});
