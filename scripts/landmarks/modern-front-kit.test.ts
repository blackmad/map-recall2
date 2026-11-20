import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {face, flushFaces, planFrame, resetFaces, slotLoggia, strut} from './modern-front-kit';
import {dropArmAwning} from '../../src/canalRecall/landmarks/dropArmAwning';

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

test('dropArmAwning: cloth from the head rail to the front bar, both windings, arms on the wall', () => {
  const a = dropArmAwning(2, 3, 0.9, 0.7);
  assert.equal(a.cloth.length, 2);
  const top = a.cloth[0].pts;
  assert.ok(top.some(p => p[1] === 3 && p[2] === 0) && top.some(p => Math.abs(p[1] - 2.3) < 1e-9 && p[2] === 0.9));
  // the upper winding faces up and out, the second the reverse
  const n = (pts: [number, number, number][]) => {
    const [a0, a1, a2] = pts, u = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]], v = [a2[0] - a0[0], a2[1] - a0[1], a2[2] - a0[2]];
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  };
  assert.ok(n(top)[1] > 0 && n(top)[2] > 0, `up/out ${n(top)}`);
  assert.ok(n(a.cloth[1].pts)[1] < 0);
  assert.equal(a.valance.length, 2);
  assert.equal(a.arms.length, 4);
  for (const q of a.arms) assert.ok(q.pts.some(p => p[2] === 0) && q.pts.some(p => p[2] === 0.9));
  assert.equal(dropArmAwning(2, 3, 0.9, 0.7, {valance: 0}).valance.length, 0);
  assert.throws(() => dropArmAwning(0, 3, 0.9, 0.7));
});

test('slotLoggia cuts one slot, makes its back face and stacks a balcony per floor', () => {
  resetFaces();
  const {geoms, b} = sink();
  const {fr} = planFrame([0, 0], [1, 0], [0, 1]);
  const F = face(fr([0, 0], [20, 0]), 0, 20, 'brick');
  const back = slotLoggia(b, F, {slot: [6, 10], y: [10, 19], depth: 1.5, back: 'stone', floors: [10.2, 13, 15.8], balcony: [4, 10], out: 1.4, wideFirst: true,
    window: {sill: 0.9, head: 2.3, t: [0.3, 3.7]}, edge: 'blue'});
  assert.deepEqual(F.holes.map(h => [h.t0, h.t1, h.y0, h.y1, h.depth]), [[6, 10, 10, 19, 1.5]]);
  assert.equal(back.y0, 10); assert.equal(back.len, 4);
  // the back face stands 1.5 m into the wall, behind t = 6 of the face
  const expect = [6 * F.f.tangent[0] - 1.5 * F.f.n[0], 6 * F.f.tangent[1] - 1.5 * F.f.n[1]];
  assert.ok(Math.abs(back.f.origin[0] - expect[0]) < 1e-9 && Math.abs(back.f.origin[1] - expect[1]) < 1e-9, `${back.f.origin} vs ${expect}`);
  assert.equal(back.holes.length, 3, 'a window per floor');
  const before = geoms.length;
  flushFaces(b);
  assert.ok(geoms.length > before, 'faces flushed');
  assert.throws(() => slotLoggia(b, F, {slot: [5, 5], y: [0, 1], depth: 1, back: 'stone', floors: [], balcony: [0, 1], out: 1}));
});
