import assert from 'node:assert/strict';
import {
  basemapBuildingFilter,
  buildingColorExpression,
  buildingOpacity,
  encodeBasemapBuildingId,
} from '../src/canalRecall/buildingStyle';

const clean = JSON.stringify(buildingColorExpression('clean'));
assert.match(clean, /colour/);
assert.match(clean, /material/);
assert.match(clean, /#bd8161/);
assert.match(clean, /render_height/);
assert.match(clean, /#DED9D0/);
assert.match(clean, /#AAA095/);
assert.doesNotMatch(clean, /null/);
assert.equal(buildingColorExpression('cyberpunk'), '#25114D');
assert.equal(buildingOpacity('cyberpunk'), 0.98);
// Opaque: a translucent extrusion blends with whatever it overlaps instead of
// resolving the depth tie, which is what the coplanar walls showed as stripes.
assert.equal(buildingOpacity('clean'), 1);

// Feature ids observed in OpenFreeMap's z14 building tile over the Singel,
// paired against the extract by footprint: way 751683818 -> 7516838182,
// way 751698384 -> 7516983842.
assert.equal(encodeBasemapBuildingId('w751683818'), 7516838182);
assert.equal(encodeBasemapBuildingId('w751698384'), 7516983842);
assert.equal(encodeBasemapBuildingId('r17967'), 179673);
assert.equal(encodeBasemapBuildingId('n123'), null, 'nodes are not buildings in this layer');
assert.equal(encodeBasemapBuildingId('751683818'), null, 'an unprefixed id has no known type');
assert.equal(encodeBasemapBuildingId('wnope'), null);

const filter = basemapBuildingFilter(['w751683818', 'r17967', 'n5', 'w751683818']);
const encoded = JSON.stringify(filter);
assert.match(encoded, /7516838182/);
assert.match(encoded, /179673/);
assert.doesNotMatch(encoded, /\b50\b/, 'node ids must not reach the filter');
// Type 0 shares the way numbering but names unrelated features a median 27 m
// away, so the plain id must never be matched.
assert.doesNotMatch(encoded, /7516838180/);
assert.equal(JSON.parse(encoded).filter((clause: unknown) => JSON.stringify(clause).includes('7516838182')).length, 1,
  'ids are de-duplicated into a single match clause');
assert.match(encoded, /hide_3d/, 'OpenMapTiles marks part-covered buildings itself');

const wrapped = JSON.stringify(basemapBuildingFilter(['w1'], ['==', ['get', 'class'], 'building']));
assert.match(wrapped, /"class"/, 'an existing basemap filter is preserved');
assert.equal(JSON.parse(wrapped)[0], 'all');
assert.deepEqual(JSON.parse(wrapped)[1], ['==', ['get', 'class'], 'building']);

const empty = basemapBuildingFilter([]);
assert.equal(JSON.stringify(empty).includes('match'), false, 'an empty id list produces no match clause');

process.stdout.write('Canal Recall building-style checks passed.\n');
