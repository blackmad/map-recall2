/**
 * Does the tile grid address the right squares?
 *
 * An off-by-one here is not a crash, it is a strip of the city that never
 * loads — and because features are placed by centroid, the missing strip moves
 * as the camera moves. Worth pinning against arithmetic that is easy to write
 * from memory slightly wrong, especially the y axis, which runs south.
 */

import assert from 'node:assert/strict';
import { tileBounds, tileFor, tileKey, tilesCovering } from '../src/canalRecall/slippyTiles.js';

// Zoom 0 is one tile holding the world.
assert.deepEqual(tileFor(0, 0, 0), { z: 0, x: 0, y: 0 }, 'the whole world is tile 0/0/0');
const world = tileBounds({ z: 0, x: 0, y: 0 });
assert.ok(Math.abs(world[0] + 180) < 1e-9 && Math.abs(world[2] - 180) < 1e-9, 'tile 0/0/0 spans every longitude');

// Null Island is the corner of the four middle tiles at any zoom; just east and
// south of it is the tile below-right of centre.
assert.deepEqual(tileFor(0.001, -0.001, 1), { z: 1, x: 1, y: 1 }, 'south-east of the origin is the lower-right quadrant');
assert.deepEqual(tileFor(-0.001, 0.001, 1), { z: 1, x: 0, y: 0 }, 'north-west of the origin is the upper-left quadrant');

// y runs south: a more northerly point is in a lower-numbered row.
const north = tileFor(4.9, 52.4, 13);
const south = tileFor(4.9, 52.3, 13);
assert.ok(north.y < south.y, 'tile y increases southwards');
assert.equal(north.x, south.x, 'the same meridian stays in the same column');

// A tile contains its own centre, and its bounds are the right way up.
for (const tile of [{ z: 13, x: 4204, y: 2690 }, { z: 14, x: 8409, y: 5381 }]) {
  const [west, south2, east, north2] = tileBounds(tile);
  assert.ok(west < east && south2 < north2, `${tileKey(tile)} has bounds the right way round`);
  assert.deepEqual(tileFor((west + east) / 2, (south2 + north2) / 2, tile.z), tile, `${tileKey(tile)} contains its own centre`);
}

// Amsterdam's drivable area, at the zoom the city is cut on.
const amsterdam = { west: 4.709, south: 52.2746, east: 5.1025, north: 52.4311 };
const covering = tilesCovering(amsterdam, 13);
assert.ok(covering.length > 20 && covering.length < 400, `drivable Amsterdam is a sane number of z13 tiles (${covering.length})`);
for (const corner of [[amsterdam.west, amsterdam.south], [amsterdam.east, amsterdam.north]] as const) {
  const tile = tileFor(corner[0], corner[1], 13);
  assert.ok(covering.some(other => other.x === tile.x && other.y === tile.y), 'the cover includes every corner of the box');
}
assert.ok(tilesCovering(amsterdam, 13, 1).length > covering.length, 'a margin adds a ring of neighbours');

process.stdout.write(`Slippy tile checks passed (drivable Amsterdam is ${covering.length} tiles at z13)\n`);
