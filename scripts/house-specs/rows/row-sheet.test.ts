import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { knownDifferences } from './row-sheet.ts';

test('known differences are ordered by how many fronts share them', () => {
  const o = knownDifferences([{ front: 'a', what: 'x', sharedBy: ['1'], kitCanSay: false }, { front: 'b', what: 'y', sharedBy: ['1', '2', '3'], kitCanSay: true }, { front: 'c', what: 'z', sharedBy: 2, kitCanSay: 'partly' }]);
  assert.deepEqual(o.map(k => k.what), ['y', 'z', 'x']);
});
test('the seeded known-differences files parse and carry the required fields', () => {
  const dir = path.join(path.dirname(new URL(import.meta.url).pathname), 'known-differences');
  for (const f of fs.readdirSync(dir)) for (const k of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) { assert.ok(k.front && k.what && k.sharedBy && k.kitCanSay !== undefined, `${f}: ${JSON.stringify(k)}`); }
});
