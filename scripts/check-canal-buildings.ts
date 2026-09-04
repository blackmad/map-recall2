import assert from 'node:assert/strict';
import {
  basemapBuildingFilter,
  buildingColorExpression,
  buildingOpacity,
  collectEncodedBasemapHideIds,
  coloredBuildingLayerFilter,
  dedupeAppearanceFeatures,
  encodeBasemapBuildingId,
  flatRoofFilter,
} from '../src/canalRecall/buildingStyle';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

assert.deepEqual(
  collectEncodedBasemapHideIds(['w751683818', 'r17967', 'n5', 'w751683818', 'bad']),
  [179673, 7516838182],
  'hide-id collection is sorted, unique, and skips unsafe id types',
);
assert.deepEqual(
  collectEncodedBasemapHideIds([]),
  [],
  'an empty extract produces an empty hide-id list',
);

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

const withExtra = basemapBuildingFilter(['w751683818'], null, [42, 7516838182, 42]);
const withExtraJson = JSON.stringify(withExtra);
assert.match(withExtraJson, /42/, 'raw encoded basemap ids from proximity scans are accepted');
assert.equal(
  JSON.parse(withExtraJson).filter((clause: unknown) => JSON.stringify(clause).includes('7516838182')).length,
  1,
  'an id already encoded from an osmId is not duplicated by the proximity list',
);

// Parent outline inside a multi-height composition must not be drawn.
const shell = {
  type: 'Feature',
  properties: { osmId: 'w-shell', height: 9, minHeight: 0 },
  geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] },
};
const nave = {
  type: 'Feature',
  properties: { osmId: 'w-nave', height: 20, minHeight: 0, isPart: true },
  geometry: { type: 'Polygon', coordinates: [[[0.1, 0.1], [0.6, 0.1], [0.6, 0.6], [0.1, 0.6], [0.1, 0.1]]] },
};
const tower = {
  type: 'Feature',
  properties: { osmId: 'w-tower', height: 40, minHeight: 0, isPart: true },
  geometry: { type: 'Polygon', coordinates: [[[0.7, 0.7], [0.9, 0.7], [0.9, 0.9], [0.7, 0.9], [0.7, 0.7]]] },
};
const deduped = dedupeAppearanceFeatures([shell, nave, tower]);
assert.deepEqual(
  deduped.map(feature => feature.properties?.osmId).sort(),
  ['w-nave', 'w-tower'],
  'dedupeAppearanceFeatures drops the parent outline',
);

// The roof-cap layer must keep its own filter when the signature suppression
// is refreshed with nothing to hide. Losing it capped every pand in the city
// with the fallback lid colour and z-fought the roof beneath.
assert.deepEqual(coloredBuildingLayerFilter(flatRoofFilter(), []), flatRoofFilter(),
  'an empty suppression list leaves the base filter untouched');
assert.equal(coloredBuildingLayerFilter(null, []), null, 'walls with nothing to hide have no filter');
const suppressed = coloredBuildingLayerFilter(flatRoofFilter(), ['w1', 'w2']) as unknown[];
assert.equal(suppressed[0], 'all');
assert.deepEqual(suppressed[1], flatRoofFilter(), 'the base filter is kept alongside the suppression');
const suppressedJson = JSON.stringify(suppressed);
assert.match(suppressedJson, /"w1"/);
assert.match(suppressedJson, /"osmId"/);
assert.match(suppressedJson, /"id"/, 'streamed LoD1 features carry their OSM id under `id`');
const wallsOnly = coloredBuildingLayerFilter(null, ['w1']) as unknown[];
assert.equal(wallsOnly[0], '!', 'walls with suppression get the suppression clause alone');

// Published hide-id sidecar must match the extract it names. Missing sidecar
// is fine (fallback encodes at runtime); a present sidecar with a missing or
// mismatched extract is not.
const hideIdsPath = path.resolve('public/data/extracts/amsterdam/basemap-hide-ids.json');
const appearancePath = path.resolve('public/data/extracts/amsterdam/buildings-colored.geojson');
let hideRaw: string | null = null;
try {
  hideRaw = await readFile(hideIdsPath, 'utf8');
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (hideRaw !== null) {
  const hidePayload = JSON.parse(hideRaw) as { encodedIds?: number[]; count?: number };
  const appearance = JSON.parse(await readFile(appearancePath, 'utf8')) as {
    features?: Array<{ properties?: { osmId?: string } }>;
  };
  const expected = collectEncodedBasemapHideIds(
    (appearance.features || [])
      .map((feature) => feature.properties?.osmId)
      .filter((id): id is string => typeof id === 'string'),
  );
  assert.equal(hidePayload.count, expected.length);
  assert.deepEqual(hidePayload.encodedIds, expected,
    'basemap-hide-ids.json must match buildings-colored.geojson encodings');
}

process.stdout.write('Canal Recall building-style checks passed.\n');
