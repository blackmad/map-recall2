// Round 7 (lane retail-look-20261114): address-first shop hosting. `node --import tsx --test src/canalRecall/retailAddress.test.ts`
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addressPand, matchAddress, parseHouseNumber, type Vbo } from './retailAddress.js';
import { insideRing } from './retailHosting.js';

test('house numbers: letter, toevoeging and ranges', () => {
  assert.deepEqual(parseHouseNumber('88'), { nr: 88, letter: '', add: '' });
  assert.deepEqual(parseHouseNumber('252-H'), { nr: 252, letter: '', add: 'H' });
  assert.deepEqual(parseHouseNumber('54B-H'), { nr: 54, letter: 'B', add: 'H' });
  assert.deepEqual(parseHouseNumber('1E'), { nr: 1, letter: 'E', add: '' });
  assert.deepEqual(parseHouseNumber('86-88'), { nr: 86, letter: '', add: '' });
  assert.equal(parseHouseNumber('Hoek'), null);
});

// Eerste Constantijn Huygensstraat 88-H, Het Zwarte Fietsenplan (OSM node 2423888957): the 90 m2 shop VBO lies in
// pand 0363100012236373; the flat above shares the number and the shop next door is 92.
const vbos: Vbo[] = [
  { street: 'Eerste Constantijn Huygensstraat', short: '1e C Huygensstr', nr: 88, add: 'H', use: 'winkelfunctie', m2: 90, at: [1, 1] },
  { street: 'Eerste Constantijn Huygensstraat', short: '1e C Huygensstr', nr: 88, add: '1', use: 'woonfunctie', m2: 60, at: [1, 1.5] },
  { street: 'Eerste Constantijn Huygensstraat', short: '1e C Huygensstr', nr: 92, add: 'H', use: 'winkelfunctie', m2: 57, at: [6, 1] },
];
const pands = [{ id: 'a', ring: [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]] as [number, number][] }, { id: 'b', ring: [[4, 0], [9, 0], [9, 4], [4, 4], [4, 0]] as [number, number][] }];

test('the shop VBO with the address picks its pand, not the neighbour', () => {
  const hits = matchAddress('Eerste Constantijn Huygensstraat', '88-H', vbos);
  assert.deepEqual(hits.map(v => v.m2), [90]);
  assert.equal(addressPand(hits, pands, insideRing)?.id, 'a');
  assert.equal(addressPand(matchAddress('1e C Huygensstr', '92', vbos), pands, insideRing)?.id, 'b');
});

test('no street, unknown number or a letter that does not exist: no address host', () => {
  assert.deepEqual(matchAddress(undefined, '88', vbos), []);
  assert.deepEqual(matchAddress('Eerste Constantijn Huygensstraat', '90', vbos), []);
  assert.deepEqual(matchAddress('Eerste Constantijn Huygensstraat', '88A', vbos), []);
  assert.equal(addressPand([], pands, insideRing), null);
});

import { atOnStreetWall } from './retailAddress.js';
test('round 8: a corner pand is fronted on the wall facing the addr:street, not the nearest wall', () => {
  // A 10 x 10 m corner pand; Main Street runs along y = -3 (south), Side Street along x = 13 (east). The node stands
  // near the east wall but its address is Main Street.
  const ring: [number, number][] = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const segs = [{ name: 'Main Street', x0: -20, y0: -3, x1: 30, y1: -3 }, { name: 'Side Street', x0: 13, y0: -20, x1: 13, y1: 30 }];
  const at = atOnStreetWall(ring, 9, 4, 'Main Street', segs)!;
  assert.ok(Math.abs(at[1]) < 1e-9 && at[0] >= 1 && at[0] <= 9, `${at}`);
  assert.equal(atOnStreetWall(ring, 9, 4, 'Elsewhere', segs), null);
  // Already on the street's wall: no move.
  assert.equal(atOnStreetWall(ring, 5, 0.5, 'Main Street', segs), null);
});
