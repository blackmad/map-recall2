import test from 'node:test';
import assert from 'node:assert/strict';
import { houseSpecsStamp } from './extractStamp.js';

const enc = (s: string) => new TextEncoder().encode(s);

test('off records only houseSpecs: off, whatever the directory holds', () => {
  assert.deepEqual(houseSpecsStamp(false, 'house-specs', [['14/1/2.json.gz', enc('a')]]), { houseSpecs: 'off' });
});

test('on hashes names and contents, independent of listing order', () => {
  const a = houseSpecsStamp(true, 'house-specs', [['14/1/2.json.gz', enc('a')], ['14/1/3.json.gz', enc('b')]]);
  const b = houseSpecsStamp(true, 'house-specs', [['14/1/3.json.gz', enc('b')], ['14/1/2.json.gz', enc('a')]]);
  assert.equal(a.houseSpecs, 'on');
  assert.deepEqual(a, b);
  assert.equal(a.houseSpecsExtract?.tiles, 2);
  assert.match(a.houseSpecsExtract!.hash, /^[0-9a-f]{64}$/);
});

test('a changed tile, or a renamed one, changes the hash', () => {
  const base = houseSpecsStamp(true, 'house-specs', [['14/1/2.json.gz', enc('a')]]).houseSpecsExtract!.hash;
  assert.notEqual(houseSpecsStamp(true, 'house-specs', [['14/1/2.json.gz', enc('A')]]).houseSpecsExtract!.hash, base);
  assert.notEqual(houseSpecsStamp(true, 'house-specs', [['14/1/9.json.gz', enc('a')]]).houseSpecsExtract!.hash, base);
});

test('on with a missing or empty directory records absent, 0 tiles', () => {
  assert.deepEqual(houseSpecsStamp(true, 'staging/house-specs', []), { houseSpecs: 'on', houseSpecsExtract: { dir: 'staging/house-specs', tiles: 0, hash: 'absent' } });
});
