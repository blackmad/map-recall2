import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Acc} from './tier-kit';
import {bar, edges, face, outline, pl} from './face-kit';
import type {BuildingTools} from './cultural-builders';

/** An Acc that only counts triangles per material (flush is never called). */
const counter = () => {
  const acc = new Acc({} as BuildingTools);
  const tris = new Map<string, number[][]>();
  acc.tri = (c, a, b, d) => { const l = tris.get(c) ?? []; l.push(a, b, d); tris.set(c, l); };
  return {acc, tris};
};
const near = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

test('face runs t from the edge end b (viewer\'s left) towards a, o outwards', () => {
  const f = face([10, 0], [0, 0]);   // an edge running west; its outward side is north for a ccw ring walked a -> b
  assert.equal(f.L, 10);
  assert.ok(near(f.P(0, 2, 0), [0, 2, 0]));
  assert.ok(near(f.P(10, 0, 0), [10, 0, 0]));
  const p = pl(f, 5, 1);
  assert.equal(p[0], 5);
  assert.equal(Math.abs(p[1]), 1);
});

test('edges wind any ring counter-clockwise and every normal points away from the centre', () => {
  const sq: [number, number][] = [[0, 0], [0, 4], [4, 4], [4, 0]];
  for (const {a, b, n} of edges(sq)) {
    const mx = (a[0] + b[0]) / 2 - 2, mz = (a[1] + b[1]) / 2 - 2;
    assert.ok(mx * n[0] + mz * n[1] > 0, `edge ${a} -> ${b} normal ${n} points inwards`);
  }
});

test('bar draws five faces, six with its back, all in its own material', () => {
  const f = face([4, 0], [0, 0]);
  const a = counter(); bar(a.acc, 'stone', f, 0, 1, 0, 1, 0, 0.2);
  assert.equal(a.tris.get('stone')!.length / 3, 10);
  const b = counter(); bar(b.acc, 'stone', f, 0, 1, 0, 1, 0, 0.2, true);
  assert.equal(b.tris.get('stone')!.length / 3, 12);
});

test('outline triangulates a profiled end in the face plane, o metres out', () => {
  const f = face([6, 0], [0, 0]);
  const {acc, tris} = counter();
  outline(acc, 'glass', f, [[0, 0], [6, 0], [6, 3], [3, 4.5], [0, 3]], 0.5);
  const v = tris.get('glass')!;
  assert.equal(v.length / 3, 3);
  for (const p of v) assert.equal(Math.abs(p[2]), 0.5);
  const area = [0, 1, 2].reduce((s, k) => { const [p, q, r] = v.slice(k * 3, k * 3 + 3); return s + Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) / 2; }, 0);
  assert.ok(Math.abs(area - (18 + 4.5)) < 1e-9);
});
