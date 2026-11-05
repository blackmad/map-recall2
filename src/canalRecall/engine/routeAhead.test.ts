import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingAheadTiles, nearestOnRoute, routeAheadTiles, tileKeyAt, withAhead } from './routeAhead.ts';

// Regression location: the seeded default ride (Willemspark → Van Gogh Museum) runs east along the Koninginneweg.
const M_LNG = 111_320 * Math.cos(52.355 * Math.PI / 180);
const east = (m: number): [number, number] => [4.8640 + m / M_LNG, 52.3550];
const north = (from: [number, number], m: number): [number, number] => [from[0], from[1] + m / 111_320];

test('route-ahead names the tiles the next stretch of route crosses, in order, and stops at the distance', () => {
  const corner = east(400), route = [east(0), east(200), corner, north(corner, 600)];
  const rider = east(150);
  const z = 17;
  const tiles = routeAheadTiles(route, rider, z, 500)!;
  assert.equal(tiles[0], tileKeyAt(rider[0], rider[1], z), 'the rider\'s own tile first');
  assert.ok(tiles.includes(tileKeyAt(corner[0], corner[1], z)), 'round the corner');
  const end = north(corner, 250);
  assert.ok(tiles.includes(tileKeyAt(end[0], end[1], z)));
  const beyond = north(corner, 520);
  assert.ok(!tiles.includes(tileKeyAt(beyond[0], beyond[1], z)), 'not past aheadM');
  // Off the route (a detour), there is no route answer: the heading leads instead.
  assert.equal(routeAheadTiles(route, north(rider, 200), z, 500), null);
  assert.equal(routeAheadTiles(null, rider, z, 500), null);
});

test('the cursor keeps the search near the rider, and a far cursor still finds the rider', () => {
  const route = Array.from({ length: 400 }, (_, i) => east(i * 10));
  const cursor = { index: 0 };
  routeAheadTiles(route, east(1505), 16, 300, cursor);
  assert.equal(cursor.index, 150);
  assert.equal(nearestOnRoute(route, east(3005), 10)!.index, 300);
});

test('heading-ahead and the merge with the block', () => {
  const tiles = headingAheadTiles(east(0), [1, 0], 17, 400);
  assert.equal(tiles[0], tileKeyAt(...east(0), 17));
  assert.equal(tiles[tiles.length - 1], tileKeyAt(...east(400), 17));
  assert.deepEqual(withAhead(['a', 'b'], ['a', 'c', 'd', 'e'], 2), ['a', 'b', 'c', 'd']);
  assert.deepEqual(withAhead(['a'], null, 2), ['a']);
});
