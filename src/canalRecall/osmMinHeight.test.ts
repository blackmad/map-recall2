import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { LARGE_CANOPY_M2, ROOF_CANOPY_TOP_M, ROOF_SLAB_M, isRoofCanopySlab, osmHeightM, osmMinHeightM } from './osmMinHeight';

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

test('an untagged roof outline is a canopy one tall storey up, not a 9 m block (feedback 2c486751)', () => {
  // Danzigerkade "Ydek" w848883149: building=roof, ref:bag, no height; its real canopy rings the ground floor at ~5 m.
  const ydek = { building: 'roof', layer: '1', name: 'Ydek', 'ref:bag': '0363100012239306', source: 'BAG' };
  assert.equal(osmHeightM(ydek, 110), ROOF_CANOPY_TOP_M);
  assert.equal(osmMinHeightM(ydek, osmHeightM(ydek, 110)), ROOF_CANOPY_TOP_M - ROOF_SLAB_M);
  assert.equal(osmHeightM(ydek, LARGE_CANOPY_M2 + 1), 9, 'a station roof keeps the building default');
  assert.equal(osmHeightM({ building: 'roof', height: '12' }, 50), 12);
  assert.equal(osmHeightM({ building: 'roof', 'building:levels': '2' }, 50), 6);
  assert.equal(osmHeightM({ building: 'yes' }, 50), 9, 'other outlines unchanged');
  assert.ok(isRoofCanopySlab({ id: 'w848883149', minHeight: 4, height: 5 }));
  assert.ok(!isRoofCanopySlab({ id: 'NL.IMBAG.Pand.0363100012239306', minHeight: 4, height: 5 }));
});

test('named regression: the Danzigerkade canopy is published at 4-5 m (feedback 2c486751)', () => {
  for (const set of ['building-tiles', 'bag-tiles']) {
    const file = `public/data/extracts/amsterdam/${set}/14/8413/5382.geojson.gz`;
    const f = (JSON.parse(gunzipSync(readFileSync(file)).toString()).features as { properties: Record<string, unknown> }[]).find(x => x.properties.id === 'w848883149');
    assert.ok(f, `${set}: w848883149 present`);
    assert.deepEqual([f!.properties.minHeight, f!.properties.height], [4, 5], set);
  }
});
