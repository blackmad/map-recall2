import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeReplacedEntry} from '../../../scripts/building-recipes/install-large.ts';

const fresh = {id: 'ordinary-1', name: 'New', triangles: 10, source: 'building-recipes-large'};

test('re-installing a large-recipe entry keeps every field the installer does not own', () => {
  const old = {id: 'ordinary-1', name: 'Old', triangles: 99, source: 'building-recipes-large', bagYear: 1931, aliases: ['ordinary-2'], extra: {a: 1}};
  const merged = mergeReplacedEntry(old, fresh);
  assert.equal(merged.bagYear, 1931);
  assert.deepEqual(merged.aliases, ['ordinary-2']);
  assert.deepEqual(merged.extra, {a: 1});
  assert.equal(merged.triangles, 10);
  assert.equal(merged.name, 'New');
  assert.deepEqual(Object.keys(merged).slice(0, 4), ['id', 'name', 'triangles', 'source']);
});

test('replacing a hand-built entry or adding a new one hands over nothing else', () => {
  assert.deepEqual(mergeReplacedEntry({id: 'ordinary-1', source: 'other', instance: {x: 1}, bagYear: 1900}, fresh), fresh);
  assert.deepEqual(mergeReplacedEntry(null, fresh), fresh);
});
