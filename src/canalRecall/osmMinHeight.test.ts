import { test } from 'node:test';
import assert from 'node:assert/strict';
import { osmMinHeightM } from './osmMinHeight';

test('building:min_level is storeys, min_height is metres', () => {
  // Kerkstraat bridging building w1489746221: min_level 4, 15 m tall.
  assert.equal(osmMinHeightM({ 'building:part': 'yes', 'building:min_level': '4' }, 15), 12);
  assert.equal(osmMinHeightM({ 'building:min_level': '1' }, 9), 3);
  assert.equal(osmMinHeightM({ min_height: '6.5', 'building:min_level': '4' }, 20), 6.5);
  assert.equal(osmMinHeightM({ 'building:min_level': '2', 'building:levels': '6', height: '24' }), 8);
  assert.equal(osmMinHeightM({ 'building:min_level': '4' }, 9), 8, 'capped below the top');
  assert.equal(osmMinHeightM({ building: 'yes' }, 12), 0);
});

test('a roof outline is a canopy slab, not a block (Overkapping IJsei w506192827)', () => {
  assert.equal(osmMinHeightM({ 'building:part': 'roof', layer: '3', name: 'Overkapping IJsei' }, 9), 8);
  assert.equal(osmMinHeightM({ building: 'roof' }, 6), 5);
  assert.equal(osmMinHeightM({ building: 'roof' }, 2.5), 0, 'too low to lift');
  assert.equal(osmMinHeightM({ building: 'roof', min_height: '3' }, 6), 3);
});
