import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bladeBounds, bladeFor, cityObjectToFeature, mapBuildingAttributes, pandsNear, UNMAPPED_3DBAG_ATTRIBUTES, type CityJsonTile} from './pdokLod2.ts';
import {decodeThreeDBag, decodeWalls} from './facts.ts';

const tile = JSON.parse(fs.readFileSync(new URL('./fixtures/pdok-tile-mini.json', import.meta.url), 'utf8')) as CityJsonTile;
const A = '0363100012160948', B = '0363100012156177';

test('bladeFor names the 2 km RD square by its south-west corner', () => {
  assert.equal(bladeFor(118057.75, 487780.92), '118000_486000');
  assert.equal(bladeFor(120000, 485999.999), '120000_484000');
  assert.deepEqual(bladeBounds('120000_486000'), [120000, 486000, 122000, 488000]);
  assert.throws(() => bladeBounds('25dn2'));
});

test('cityObjectToFeature cuts one pand into the 3DBAG item shape decodeThreeDBag reads', () => {
  const item = cityObjectToFeature(tile, A)!;
  assert.ok(item);
  assert.deepEqual(Object.keys(item.feature.CityObjects).sort(), [`NL.IMBAG.Pand.${A}`, `NL.IMBAG.Pand.${A}-0`]);
  assert.ok(item.feature.vertices.length < tile.vertices.length, 'only the pand\'s own vertices');
  assert.deepEqual(item.metadata.transform, tile.transform);
  const {attributes, bag, ground, roofs} = decodeThreeDBag(item);
  const src = tile.CityObjects[`NL.IMBAG.Pand.${A}`].attributes!;
  assert.equal(attributes.b3_h_maaiveld, src.rf_h_ground);
  assert.equal(attributes.b3_h_dak_max, src.rf_roof_elevation_max);
  assert.equal(attributes.b3_h_nok, src.rf_h_roof_ridge);
  assert.equal(attributes.oorspronkelijkbouwjaar, src.oorspronkelijkBouwjaar);
  assert.equal(attributes.identificatie, `NL.IMBAG.Pand.${A}`);
  assert.equal(bag.length, 1);
  assert.ok(ground.length >= 1 && roofs.length >= 2);
  // RD coordinates, not quantised integers.
  assert.ok(bag[0].every(([x, y]) => x > 118000 && x < 120000 && y > 486000 && y < 488000));
  const walls = decodeWalls(item, Number(attributes.b3_h_maaiveld));
  assert.ok(walls.length >= 4 && walls.some(w => w.onFootprintEdge));
  assert.ok(walls.every(w => w.topM > w.bottomM && w.topM < 40));
  // Roof surface semantics renamed onto the 3DBAG names.
  const g = item.feature.CityObjects[`NL.IMBAG.Pand.${A}-0`].geometry!.find(x => String(x.lod) === '2.2')!;
  const roof = g.semantics!.surfaces.find(s => s.type === 'RoofSurface') as Record<string, unknown>;
  assert.ok('b3_azimut' in roof && 'b3_hellingshoek' in roof && !('rf_azimuth' in roof));
});

test('cityObjectToFeature returns null for a pand outside the tile', () => {
  assert.equal(cityObjectToFeature(tile, '0363100012999999'), null);
});

test('mapBuildingAttributes renames rf_* and BAG fields, keeps unmapped rf_*', () => {
  const m = mapBuildingAttributes({rf_h_ground: -0.9, rf_pc_source: 'AHN5', oorspronkelijkBouwjaar: 1890, beginGeldigheid: '2010/09/09',
    tijdstipRegistratie: '2010/11/04 16:55:13', geconstateerd: '0', rf_h_pc_98p: 1.5});
  assert.deepEqual(m, {b3_h_maaiveld: -0.9, b3_pw_bron: 'ahn5', oorspronkelijkbouwjaar: 1890, begingeldigheid: '2010-09-09',
    tijdstipregistratie: '2010-11-04T16:55:13Z', geconstateerd: false, rf_h_pc_98p: 1.5});
  assert.ok(UNMAPPED_3DBAG_ATTRIBUTES.includes('b3_bouwlagen'));
});

test('pandsNear lists the tile neighbours by footprint distance', () => {
  const item = cityObjectToFeature(tile, A)!, [[x, y]] = decodeThreeDBag(item).bag[0];
  assert.deepEqual(pandsNear(tile, x, y, 200).sort(), [A, B].sort());
  assert.deepEqual(pandsNear(tile, x + 5000, y, 10), []);
});
