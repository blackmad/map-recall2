import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutPrimitive, inZone, rdToChunk, wallZone } from './rowWallCut.ts';

// A pand on z in [0, 8] with its wall on the edge x = 0 (z 0..6) facing -x; a second pand behind (x 10).
const zone = wallZone([0, 0], [0, 6], [4, 3], 14);

test('the zone faces out of the pand and keeps the roof storey, the end walls and the inside', () => {
  assert.deepEqual(zone.out.map(v => Math.round(v)), [-1, 0]);
  assert.ok(inZone(zone, [0, 5, 3]), 'the wall plane');
  assert.ok(inZone(zone, [-1.1, 3, 3]), 'a sign 1.1 m proud');
  assert.ok(inZone(zone, [0.3, 8, 3]), 'a window reveal');
  assert.ok(!inZone(zone, [0, 14.5, 3]), 'the mansard and its dormer stay');
  assert.ok(!inZone(zone, [2, 5, 3]), 'a party wall inside stays');
  assert.ok(!inZone(zone, [0, 5, 6.4]), 'past the edge end: the corner stays');
});

test('cutPrimitive removes only the pand\'s zone triangles and re-bases the ranges', () => {
  // Four triangles: pand 0 wall (cut), pand 0 roof (kept), pand 1 wall on the same plane (kept: another pand), pand 0 wall.
  const tri = (x: number, y: number, z: number) => [x, y, z, x, y + 0.1, z, x, y, z + 0.1];
  const positions = [...tri(0, 5, 3), ...tri(0, 15, 3), ...tri(0, 5, 2), ...tri(0, 2, 1)];
  const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const out = cutPrimitive({ positions, indices, ranges: [[0, 0, 2], [1, 2, 1], [0, 3, 1]] }, 0, zone);
  assert.equal(out.removed, 2);
  assert.deepEqual(out.indices, [3, 4, 5, 6, 7, 8]);
  assert.deepEqual(out.ranges, [[0, 0, 1], [1, 1, 1], [0, 2, 0]]);
});

test('rdToChunk: x along uRD, z along nRD from midRD', () => {
  const frame = { midRD: [100, 200], uRD: [0, 1], nRD: [1, 0] };
  assert.deepEqual(rdToChunk(frame, [103, 205]), [5, 3]);
});
