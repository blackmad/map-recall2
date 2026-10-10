import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrismIndex, pickPrism, rayPrism } from './prismPick.ts';

const origin = { lng: 4.9, lat: 52.37 };
const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
/** A square footprint `size` metres across, centred `cx`, `cy` metres from the origin. */
const square = (id: string, cx: number, cy: number, size: number, height: number, minHeight = 0) => {
  const h = size / 2;
  const ring = [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]]
    .map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
  return { geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id, height, minHeight } };
};

test('a horizontal ray hits the nearer wall of the nearer building', () => {
  const index = buildPrismIndex([square('far', 100, 0, 10, 20), square('near', 50, 0, 10, 20)], origin);
  const hit = pickPrism(index, [0, 0, 5], [1, 0, 0]);
  assert.equal(hit?.entry.id, 'near');
  assert.ok(Math.abs(hit!.t - 45) < 0.01, String(hit?.t));
});

test('a ray over a low building reaches the tower behind it', () => {
  const index = buildPrismIndex([square('low', 50, 0, 10, 10), square('tower', 100, 0, 20, 80)], origin);
  assert.equal(pickPrism(index, [0, 0, 30], [1, 0, 0])?.entry.id, 'tower');
});

test('a downward ray hits the roof cap; a ray past the footprint misses', () => {
  const [entry] = buildPrismIndex([square('roof', 0, 0, 10, 12)], origin);
  const t = rayPrism([0, 0, 100], [0, 0, -1], entry);
  assert.ok(t != null && Math.abs(t - 88) < 1e-6);
  assert.equal(rayPrism([20, 0, 100], [0, 0, -1], entry), null);
});

test('a floating part (minHeight) is missed underneath and hit at its height', () => {
  const [entry] = buildPrismIndex([square('part', 50, 0, 10, 99, 83)], origin);
  assert.equal(rayPrism([0, 0, 40], [1, 0, 0], entry), null);
  assert.ok(rayPrism([0, 0, 90], [1, 0, 0], entry) != null);
  assert.ok(rayPrism([0, 0, 130], [1, 0, 0], entry, 45) != null, 'lift raises the prism');
});

test('skip passes over a hidden building to the one behind', () => {
  const index = buildPrismIndex([square('hidden', 50, 0, 10, 20), square('behind', 80, 0, 10, 20)], origin);
  assert.equal(pickPrism(index, [0, 0, 5], [1, 0, 0], () => 0, id => id === 'hidden')?.entry.id, 'behind');
});
