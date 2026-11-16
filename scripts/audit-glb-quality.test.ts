import assert from 'node:assert/strict';
import {test} from 'node:test';
import {argValue, missingIds} from './audit-glb-quality.ts';

test('argValue reads --id=x and --id x alike', () => {
  assert.equal(argValue(['node', 's', '--id=de-mirandabad'], 'id'), 'de-mirandabad');
  assert.equal(argValue(['node', 's', '--id', 'de-mirandabad'], 'id'), 'de-mirandabad');
  assert.equal(argValue(['node', 's', '--quiet'], 'id'), undefined);
});
test('argValue throws on a valued option without its value (no silent every-model run)', () => {
  assert.throws(() => argValue(['node', 's', '--id'], 'id'), /needs a value/);
  assert.throws(() => argValue(['node', 's', '--id', '--quiet'], 'id'), /needs a value/);
});
test('missingIds names ids with no GLB', () => {
  assert.deepEqual(missingIds(['a', 'b'], [{id: 'a'}]), ['b']);
  assert.deepEqual(missingIds([], []), []);
});
