import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClickPoiRow, PolygonGeometry } from './clickPoiInfo';
import { footprintAreaM2, insideLine, isBuildingScaleKind, titlePlace } from './placeTitle';

const box = (w: number, h: number): PolygonGeometry => {
  const x = 4.84, y = 52.34, dx = w / (111320 * Math.cos(y * Math.PI / 180)), dy = h / 110540;
  return { type: 'Polygon', coordinates: [[[x, y], [x + dx, y], [x + dx, y + dy], [x, y + dy], [x, y]]] };
};
const row = (name: string, kind: string): ClickPoiRow => ['n1', name, 4.84, 52.34, 'food', kind, 'Teststraat 1', '', ''];

test('area of a metre box', () => assert.ok(Math.abs(footprintAreaM2(box(20, 10)) - 200) < 3));
test('Arepa slab: a restaurant in a nine-storey slab does not title it', () => {
  const arepa = row('Arepa Shop Amsterdam', 'a restaurant');
  assert.equal(titlePlace({ places: [arepa], footprint: box(60, 20), heightMetres: 29 }), null);
  assert.equal(insideLine([arepa, row('B', 'a cafe'), row('C', 'a shop')]), 'Inside: Arepa Shop Amsterdam (restaurant) + 2 more');
});
test('a small low building with one place is titled by it', () => {
  const cafe = row('Het Hoekje', 'a cafe');
  assert.equal(titlePlace({ places: [cafe], footprint: box(12, 10), heightMetres: 9 }), cafe);
  assert.equal(titlePlace({ places: [cafe, row('x', 'a shop'), row('y', 'a shop')], footprint: box(12, 10), heightMetres: 9 }), null);
  assert.equal(titlePlace({ places: [cafe], footprint: box(12, 10), heightMetres: 20 }), null);
});
test('a mall and a hotel title their large building; a name match does too', () => {
  const mall = row('Villa ArenA', 'a mall');
  assert.equal(titlePlace({ places: [row('Shop', 'a shop'), mall], footprint: box(200, 80), heightMetres: 20 }), mall);
  assert.ok(isBuildingScaleKind(row('H', 'a hotel')));
  assert.ok(!isBuildingScaleKind(row('R', 'a restaurant')));
  const named = row('De Zon', 'a bar');
  assert.equal(titlePlace({ places: [named], buildingName: 'de zon', footprint: box(80, 40), heightMetres: 30 }), named);
});
test('inside line hides spoiler names and is empty with nothing left', () => {
  assert.equal(insideLine([row('Herengracht Cafe', 'a cafe')], n => /gracht/i.test(n)), '');
});
