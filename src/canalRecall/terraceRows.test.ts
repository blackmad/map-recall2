import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { terraceSeeds, terraceSeedOf, withTerraceSeeds, type TerraceFeature } from './terraceRows.ts';

const KX = 111_320 * Math.cos(52.37 * Math.PI / 180), KY = 110_540;
/** A w x d m rectangle with its south-west corner x m east of 4.78, 52.33. */
const house = (id: string, x: number, w = 5.4, d = 9, year = 1955, height = 8): TerraceFeature => {
  const lng = (m: number) => 4.78 + m / KX, lat = (m: number) => 52.33 + m / KY;
  return { type: 'Feature', properties: { id, constructionYear: year, height }, geometry: { type: 'Polygon', coordinates: [[[lng(x), lat(0)], [lng(x + w), lat(0)], [lng(x + w), lat(d)], [lng(x), lat(d)], [lng(x), lat(0)]]] } };
};
const nowhere = () => false;

test('a row of party-walled houses of one year shares one seed; a detached house and another year do not', () => {
  const row = [house('A3', 10.8), house('A1', 0), house('A2', 5.4)];
  const seeds = terraceSeeds([...row, house('B', 30), house('C', 16.2, 5.4, 9, 1972)], nowhere);
  assert.deepEqual([...seeds.entries()].sort(), [['A1', 'terrace:A1'], ['A2', 'terrace:A1'], ['A3', 'terrace:A1']]);
});

test('a lower garage against the row, a shed, a stated pand and a pre-war row stay out', () => {
  const shed = { ...house('S', 16.2, 3, 3, 1955, 2.4) };
  const stated = house('R', 16.2); stated.properties.rowSeries = 'x';
  const old = [house('O1', 40, 5, 9, 1910), house('O2', 45, 5, 9, 1910)];
  const seeds = terraceSeeds([house('A1', 0), house('A2', 5.4), house('G', 10.8, 3, 6, 1955, 2.6), shed, stated, ...old], nowhere);
  assert.deepEqual([...seeds.keys()].sort(), ['A1', 'A2']);
});

test('pands under a buurt profile keep their own draw', () => {
  assert.equal(terraceSeeds([house('A1', 0), house('A2', 5.4)], () => true).size, 0);
});

test('a 0.3 m survey gap still reads as one party wall; a 1 m alley does not', () => {
  assert.equal(terraceSeeds([house('A1', 0), house('A2', 5.7)], nowhere).size, 2);
  assert.equal(terraceSeeds([house('A1', 0), house('A2', 6.4)], nowhere).size, 0);
});

test('flag off: the same array, untouched (byte-identical); on: only row members are stamped', () => {
  const fs = [house('A1', 0), house('A2', 5.4), house('B', 30)];
  const g = globalThis as { __canalRecallTerraceRows?: boolean };
  g.__canalRecallTerraceRows = false;
  assert.equal(withTerraceSeeds(fs, nowhere), fs);
  g.__canalRecallTerraceRows = true;
  const on = withTerraceSeeds(fs, nowhere);
  assert.deepEqual(on.map(f => terraceSeedOf(f.properties)), ['terrace:A1', 'terrace:A1', null]);
  assert.equal(on[2], fs[2]);
  // A context neighbour joins the row but is not stamped (it is another chunk's).
  const ctx = withTerraceSeeds([house('A2', 5.4)], nowhere, [house('A1', 0)]);
  assert.deepEqual(ctx.map(f => terraceSeedOf(f.properties)), ['terrace:A1']);
  delete g.__canalRecallTerraceRows;
});

test('feedback 0046bb: Badhoevedorp 1955 row of pand 0394100000219929 is one terrace, its garages are not', () => {
  // The building tiles carry ids, footprints and heights; the BAG tiles the year.
  const tile = 'public/data/extracts/amsterdam/bag-tiles/14/8409/5387.geojson.gz';
  const features = (JSON.parse(gunzipSync(readFileSync(tile)).toString()).features as { properties: Record<string, unknown>; geometry: unknown }[])
    .map(f => ({ type: 'Feature' as const, geometry: f.geometry, properties: { id: f.properties.id, height: f.properties.height, constructionYear: f.properties.year } }));
  const seeds = terraceSeeds(features, nowhere);
  const seed = seeds.get('NL.IMBAG.Pand.0394100000219929');
  assert.ok(seed, 'grouped');
  const members = [...seeds].filter(([, s]) => s === seed).map(([id]) => id);
  assert.ok(members.length >= 4 && members.length <= 16, `${members.length} members`);
  const byId = new Map(features.map(f => [String(f.properties.id), f.properties]));
  for (const id of members) {
    assert.ok(Number(byId.get(id)!.height) > 6, `${id} is a house, not a garage`);
    assert.ok(Math.abs(Number(byId.get(id)!.constructionYear) - 1955) <= 2, id);
  }
});
