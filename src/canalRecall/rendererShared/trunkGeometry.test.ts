import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { trunkGeometry } from './trunkGeometry';

test('trunkGeometry drops only the downward-facing bottom cap', () => {
    const full = trunkGeometry(THREE, { bottomCap: true }), open = trunkGeometry(THREE);
    assert.equal(full.index.count / 3, 28);
    assert.equal(open.index.count / 3, 21);
    assert.equal(open.groups.length, 0);
    // Every kept triangle is one of the full geometry's, in the same order.
    assert.deepEqual(Array.from(open.index.array), Array.from(full.index.array).slice(0, 63));
    // Every dropped triangle lies on z = −0.5 and faces down.
    const p = full.attributes.position, idx = full.index.array, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 63; t < idx.length; t += 3) {
      a.fromBufferAttribute(p, idx[t]); b.fromBufferAttribute(p, idx[t + 1]); c.fromBufferAttribute(p, idx[t + 2]);
      for (const v of [a, b, c]) assert.ok(Math.abs(v.z + 0.5) < 1e-6);
      assert.ok(new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).z < 0);
    }
});
