import assert from 'node:assert/strict';
import test from 'node:test';
import { boundingSphereOf } from '../geometryBounds';
import { measureSpheres, meshSphere } from './meshSpheres';

test('worker spheres (lane E7): the sphere sent with a mesh is the one the install measured before', () => {
  const positions = new Float32Array([0, 0, 0, 10, 2, -1, 4, 9, 3, -2.5, 1, 0.25]);
  const mesh: { positions: Float32Array; sphere?: { center: [number, number, number]; radius: number } } = { positions };
  measureSpheres([mesh, undefined, { positions: new Float32Array(0) }]);
  assert.deepEqual(mesh.sphere, boundingSphereOf(positions));
  // The install takes it as sent (no vertex walk): a doctored sphere comes back unchanged.
  const sent = { center: [1, 2, 3] as [number, number, number], radius: 7 };
  assert.equal(meshSphere({ positions, sphere: sent }), sent);
  assert.deepEqual(meshSphere({ positions }), boundingSphereOf(positions), 'no sphere sent: measured here');
});
