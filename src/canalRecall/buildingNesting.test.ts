// dropNestedDuplicates' slender-part rule (feedback fc427560, IJdok; lane part-overlap-20261110,
// docs/reports/part-overlap-20261110.md). Run: node --import tsx --test src/canalRecall/buildingNesting.test.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { dropNestedDuplicates } from './buildingNesting.js';
import type { BuildingFeature } from './buildingTileSource.js';

const M = 1 / 111_320, KX = 1 / (111_320 * Math.cos(52.37 * Math.PI / 180));
/** A box `w` x `d` metres east/north of (4.9, 52.37) offset by (x, y) metres. */
function box(id: string, x: number, y: number, w: number, d: number, base: number, top: number, extra: Record<string, unknown> = {}): BuildingFeature {
  const x0 = 4.9 + x * KX, y0 = 52.37 + y * M, x1 = x0 + w * KX, y1 = y0 + d * M;
  return { type: 'Feature', properties: { id, minHeight: base, height: top, ...extra }, geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } };
}
const ids = (features: BuildingFeature[]) => features.map(f => String(f.properties.id));

test('a 0.5 m fin against a host that covers its height is dropped', () => {
  const host = box('w-host', 0, 0, 20, 12, 0, 24), fin = box('w-fin', 5, 12, 5, 0.46, 8, 24);
  assert.deepEqual(ids(dropNestedDuplicates([host, fin])), ['w-host']);
});

test('kept: a coloured slender part, a fin taller than its host, a generated piece, a deep bay, an infill', () => {
  const host = box('w-host', 0, 0, 20, 12, 0, 24);
  const kept = [
    box('w-glass', 5, 12, 6.6, 0.9, 14.5, 18, { colour: '#5a81a0' }), // IJdok's glass oriel: the mapper said glass
    box('w-tall', 12, 12, 5, 0.5, 0, 30), // rises above the host
    box('passage:w-x:0', 0, -0.5, 6, 0.5, 0, 24), // a piece the pipeline cut
    box('w-bay', 14, 12, 4, 2, 3, 12), // 2 m deep: a building element, not a fin
  ];
  assert.deepEqual(ids(dropNestedDuplicates([host, ...kept])), ['w-host', ...ids(kept)]);
  // A 0.8 m infill between two houses closes a slot in the row.
  const left = box('w-left', 0, 0, 10, 12, 0, 15), right = box('w-right', 10.8, 0, 10, 12, 0, 15), infill = box('w-infill', 10, 0, 0.8, 12, 0, 12);
  assert.deepEqual(ids(dropNestedDuplicates([left, infill, right])), ['w-left', 'w-infill', 'w-right']);
});

test('without slender parts the output is the slender:false output, feature for feature', () => {
  const features = [box('w-a', 0, 0, 20, 12, 0, 24), box('w-b', 0, 0, 20, 12, 0, 23), box('w-c', 30, 0, 10, 10, 0, 9)];
  const on = dropNestedDuplicates(features), off = dropNestedDuplicates(features, { slender: false });
  assert.equal(on.length, off.length);
  on.forEach((f, i) => assert.equal(f, off[i]));
});

// Named regressions on the published building tiles (the census sites).
const tile = (key: string) => JSON.parse(gunzipSync(fs.readFileSync(`public/data/extracts/amsterdam/building-tiles/14/${key}.geojson.gz`)).toString()).features as BuildingFeature[];
const ruleDrops = (key: string) => {
  const features = tile(key), kept = new Set(ids(dropNestedDuplicates(features)));
  return ids(dropNestedDuplicates(features, { slender: false })).filter(id => !kept.has(id));
};

test('IJdok passage (fc427560, 52.38415 4.89501): the maroon fin goes, the glass oriel and bridge stay', () => {
  assert.deepEqual(ruleDrops('8414/5383'), ['w1088847358']);
  const kept = new Set(ids(dropNestedDuplicates(tile('8414/5383'))));
  for (const id of ['w1088847352', 'w1088847353', 'w1088847356', 'w1088833542', 'w1088833546', 'w1088833547']) assert.ok(kept.has(id), id);
});

test('NDSM / Buiksloterham (52.40212 4.89275): the two 42 m fins on the east front go', () => {
  assert.deepEqual(ruleDrops('8414/5382'), ['w1038324511', 'w1193318910', 'w1193318911']);
});

test('Overhoeks (52.38416 4.90284): fins, roof lips and slender sheds, and nothing else', () => {
  const drops = ruleDrops('8415/5383');
  for (const id of ['w1207525451', 'w1207525452', 'w1207505549', 'w1202249617']) assert.ok(drops.includes(id), id);
  assert.equal(drops.length, 26);
});
