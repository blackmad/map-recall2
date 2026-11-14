import test from 'node:test';
import assert from 'node:assert/strict';
import { PENDING_CAP_MS, pendingDone, pendingFilter, pendingLayer, wallsPerAreaEnabled } from './pendingWalls.ts';
import { buildingTile14, stampTile } from './buildingTilesBrowser.ts';

test('the stand-in filter keeps the original filter and drops buildings in drawn tiles', () => {
  assert.deepEqual(pendingFilter(null, ['1/2']), ['!', ['in', ['coalesce', ['get', 't14'], ''], ['literal', ['1/2']]]]);
  const f = pendingFilter(['==', ['get', 'roofShape'], 'flat'], []) as unknown[];
  assert.equal(f[0], 'all');
  assert.deepEqual(f[1], ['==', ['get', 'roofShape'], 'flat']);
});

test('the stand-in layer copies source, paint and zoom range, draws visible at the given opacity', () => {
  const spec = { id: 'osm-colored-buildings', type: 'fill-extrusion', source: 'osm-building-appearance', minzoom: 14, layout: { visibility: 'visible' }, paint: { 'fill-extrusion-color': '#fff', 'fill-extrusion-opacity': 0 } };
  const l = pendingLayer(spec, ['8414/5384'], 1);
  assert.equal(l.id, 'osm-colored-buildings-pending');
  assert.equal(l.source, 'osm-building-appearance');
  assert.equal(l.minzoom, 14);
  assert.equal(l.paint?.['fill-extrusion-opacity'], 1);
  assert.equal(l.paint?.['fill-extrusion-color'], '#fff');
  assert.equal(spec.paint['fill-extrusion-opacity'], 0, 'the original spec is untouched');
});

test('done when every resident tile is drawn, or after the cap; never with nothing resident and no cap', () => {
  assert.equal(pendingDone(3, 3, 0, 10), true);
  assert.equal(pendingDone(2, 3, 0, 10), false);
  assert.equal(pendingDone(0, 0, null, 1e9), false);
  assert.equal(pendingDone(0, 3, 0, PENDING_CAP_MS + 1), true);
});

test('t14 is the facade layer\'s coarse key: the first vertex at z14 (Polygon and MultiPolygon)', () => {
  const ring = [[4.90115, 52.37665], [4.9012, 52.3767], [4.90115, 52.37665]];
  const n = 2 ** 14, rad = 52.37665 * Math.PI / 180;
  const want = `${Math.floor((4.90115 + 180) / 360 * n)}/${Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n)}`;
  assert.equal(buildingTile14({ type: 'Polygon', coordinates: [ring] }), want);
  assert.equal(buildingTile14({ type: 'MultiPolygon', coordinates: [[ring]] }), want);
  assert.equal(buildingTile14({ type: 'Point', coordinates: [4.9, 52.3] }), null);
  const features = [{ type: 'Feature' as const, properties: {} as Record<string, unknown>, geometry: { type: 'Polygon', coordinates: [ring] } }];
  stampTile(features);
  assert.equal(features[0].properties.t14, want);
});

test('the flag is off unless asked', () => {
  assert.equal(wallsPerAreaEnabled(''), false);
  assert.equal(wallsPerAreaEnabled('?wallsPerArea=1'), true);
});
