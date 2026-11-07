import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {planFrame, strut} from './modern-front-kit';

const sink = () => { const geoms: T.BufferGeometry[] = []; return {geoms, b: {add: (g: T.BufferGeometry) => { geoms.push(g); }} as unknown as BuildingTools}; };

test('strut spans its two end points with radius r', () => {
  const {geoms, b} = sink();
  strut(b, [0, 0, 0], [3, 4, 0], 0.2, 'bronze');
  const g = geoms[0]; g.computeBoundingBox();
  const bb = g.boundingBox!;
  assert.ok(Math.abs(bb.min.y + 0.2 * 0.6) < 0.2 && Math.abs(bb.max.y - 4) < 0.2, `y ${bb.min.y}..${bb.max.y}`);
  assert.ok(bb.max.x > 2.9 && bb.min.x < 0.1);
  assert.ok(Math.abs(bb.max.z - 0.2) < 1e-6 && Math.abs(bb.min.z + 0.2) < 1e-6);
  assert.throws(() => strut(b, [1, 1, 1], [1, 1, 1], 0.2, 'bronze'));
});

test('capDown faces down, capUp faces up, over the same polygon', () => {
  const {geoms, b} = sink();
  const {capUp, capDown} = planFrame([0, 0], [1, 0], [0, -1]);
  const ring: [number, number][] = [[0, 0], [4, 0], [4, 3], [0, 3]];
  capUp(b, ring, 5, 'slate'); capDown(b, ring, 5, 'stone');
  const ny = (g: T.BufferGeometry) => {
    const p = g.getAttribute('position'), i = g.index!; const a = new T.Vector3(), c = new T.Vector3(), d = new T.Vector3();
    a.fromBufferAttribute(p, i.getX(0)); c.fromBufferAttribute(p, i.getX(1)); d.fromBufferAttribute(p, i.getX(2));
    return c.sub(a).cross(d.sub(a)).y;
  };
  assert.ok(ny(geoms[0]) > 0, 'capUp up');
  assert.ok(ny(geoms[1]) < 0, 'capDown down');
});
