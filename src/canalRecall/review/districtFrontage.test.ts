import assert from 'node:assert/strict';
import {
  footprintRings,
  pointInRings,
  selectStreetFrontage,
  widestWall,
  type OwnerLike,
} from './districtFrontage.ts';

// Wall ring convention from the compiled tiles: [x, height, north].
const wallAlongX = (x0: number, x1: number, height: number, z: number): number[][] => [
  [x0, height, z],
  [x0, 0, z],
  [x1, 0, z],
  [x1, height, z],
];

const owner = (
  id: string,
  center: [number, number],
  wall: number[][],
  footprint: number[][],
  street = `${id}-straat`,
): OwnerLike => ({
  geometry: {
    frame: { originRD: { x: 0, y: 0 } },
    building: {
      id,
      street,
      center,
      groundNAP: 0,
      surfaces: [{ type: 'wall', rings: [wall] }],
      footprint: { type: 'MultiPolygon', coordinates: [[footprint]] },
    },
  },
});

const rect = (x0: number, z0: number, x1: number, z1: number): number[][] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
  [x0, z0],
];

// 1. The chosen building must be a usable wall, and the camera must not land
//    inside the blocker across the (narrow) street.
{
  const target = owner('target', [10, 0], wallAlongX(0, 20, 12, 0), rect(0, 0, 20, 1));
  const blocker = owner('blocker', [10, 16], wallAlongX(0, 20, 10, 16), rect(-100, 15, 100, 16));
  const frontage = selectStreetFrontage([target, blocker], { x: 0, y: 0 });
  assert.ok(frontage, 'a frontage is selected');
  assert.equal(frontage.building, 'target');
  assert.equal(frontage.street, 'target-straat');
  // Narrow street: camera stays in the open, short of the blocker at z=15.
  assert.ok(frontage.blocked, 'the opposite building blocks the sightline');
  assert.equal(frontage.clearDistance, 13.5);
  assert.equal(frontage.standoff, 13.5);
  assert.ok(frontage.position[2] < 15, 'camera must not be inside the blocker');
  assert.ok(frontage.position[2] > 1, 'camera must be off the target wall');
  assert.ok(frontage.fov > 45 && frontage.fov <= 72, 'field of view widens to fit the street');
  assert.equal(frontage.target[2], 0);
}

// 2. With an open frontage the standoff is the desired frontage distance, capped
//    so a very long slab is viewed as a street stretch, not a distant object.
{
  const open = owner('open', [10, 0], wallAlongX(0, 20, 10, 0), rect(0, 0, 20, 1));
  const frontage = selectStreetFrontage([open], { x: 0, y: 0 });
  assert.ok(frontage);
  assert.equal(frontage.blocked, false);
  assert.equal(frontage.clearDistance, 90);
  // desired = clamp(20 * 1.15 + 8, 10, 50) = 31
  assert.equal(frontage.standoff, 31);

  const slab = owner('slab', [50, 0], wallAlongX(0, 100, 25, 0), rect(0, 0, 100, 10));
  const slabFrontage = selectStreetFrontage([slab], { x: 0, y: 0 });
  assert.ok(slabFrontage);
  assert.equal(slabFrontage.standoff, 50, 'long frontages cap at the standoff ceiling');
  assert.equal(slabFrontage.wallWidth, 100);
}

// 3. Selection is deterministic and prefers the substantial wall near the
//    district centroid over a small far one.
{
  const near = owner('near', [5, 0], wallAlongX(0, 18, 12, 0), rect(0, 0, 18, 1));
  const far = owner('far', [400, 0], wallAlongX(0, 4, 4, 0), rect(400, 0, 404, 1));
  const owners = [far, near];
  const a = selectStreetFrontage(owners, { x: 0, y: 0 });
  const b = selectStreetFrontage(owners, { x: 0, y: 0 });
  assert.ok(a && b);
  assert.equal(a.building, 'near');
  assert.deepEqual(a.position, b.position);
  assert.deepEqual(a.target, b.target);
}

// 4. Footprint helpers work in render space and feed the obstruction test.
{
  const o = owner('foot', [50, 50], wallAlongX(50, 60, 10, 50), rect(40, 40, 60, 60));
  const rings = footprintRings(o, { x: 0, y: 0 });
  assert.equal(rings.length, 1);
  assert.ok(pointInRings(50, 50, rings), 'a point inside the footprint is detected');
  assert.ok(!pointInRings(0, 0, rings), 'a point outside the footprint is rejected');
}

// 5. widestWall picks the largest wall and orients its normal away from the
//    building centre.
{
  const o = owner('two', [10, 0], wallAlongX(0, 20, 10, 0), rect(0, 0, 20, 1));
  o.geometry!.building!.surfaces!.push({ type: 'wall', rings: [wallAlongX(0, 6, 4, 0)] });
  const wall = widestWall(o, { x: 0, y: 0 });
  assert.ok(wall);
  assert.equal(wall.width, 20);
  assert.equal(wall.normal.z, 1);
}

console.log('districtFrontage: all checks passed');
