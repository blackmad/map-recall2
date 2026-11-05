import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORIGIN, type Feature } from './threeBuildingFeatures.js';
import { ThreeBuildings } from './threeBuildingsBrowser.js';
// setFeatures' grouping memo (lane E5, #218, `?featureGroupCache=0`): the same groups, lists, order and queued
// rebuilds as the uncached loop, across a detail-centre move, a tile flush and a restyled (new) feature object.

const kx = 111320 * Math.cos(ORIGIN.lat * Math.PI / 180);
const ll = (x: number, y: number): [number, number] => [ORIGIN.lng + x / kx, ORIGIN.lat + y / 110540];
const box = (id: string, x: number, y: number): Feature => ({
  type: 'Feature', properties: { id, height: 12 },
  geometry: { type: 'Polygon', coordinates: [[ll(x, y), ll(x + 8, y), ll(x + 8, y + 10), ll(x, y + 10), ll(x, y)]] },
} as unknown as Feature);

function city(): Feature[] {
  const out: Feature[] = [];
  for (let i = 0; i < 40; i++) for (let j = 0; j < 20; j++) out.push(box(`way/${i}-${j}`, i * 90 - 1800, j * 90 - 900));
  return out;
}

function run(cached: boolean): string[] {
  (globalThis as { __canalRecallFeatureGroupCache?: boolean }).__canalRecallFeatureGroupCache = cached;
  const map = { getZoom: () => 17, triggerRepaint() {}, getCanvas: () => ({}) } as never;
  const tb = new ThreeBuildings(map, {} as never, 'photo', { detail: 'full' }) as any;
  tb.pump = () => {}; // no THREE: record the queue instead of building
  const snap = () => [...tb.sourceGroups].map(([k, l]: [string, Feature[]]) => `${k}=${l.map(f => f.properties.id).join(',')}`).join(' | ') + ` || queued ${tb.pending.size ?? ''}`;
  const out: string[] = [];
  const features = city();
  tb.setFeatures(features); out.push(snap());
  tb.setDetailCentre(...ll(0, 0)); out.push(snap());
  tb.setDetailCentre(...ll(900, 300)); out.push(snap());
  const flushed = features.slice(100).concat(city().slice(0, 50)); // tiles left, tiles (new objects) arrived
  tb.setFeatures(flushed); out.push(snap());
  flushed[200] = { ...flushed[200], geometry: box('way/moved', 5, 5).geometry } as Feature; // restyled/moved feature
  tb.setFeatures(flushed.slice()); out.push(snap());
  delete (globalThis as { __canalRecallFeatureGroupCache?: boolean }).__canalRecallFeatureGroupCache;
  return out;
}

test('the cached grouping equals the uncached loop across detail moves and tile flushes', () => {
  const on = run(true), off = run(false);
  assert.equal(on.length, off.length);
  on.forEach((s, i) => assert.equal(s, off[i], `step ${i}`));
  assert.ok(on[1].includes('near:'), 'the detail centre made near groups');
});
