import test from 'node:test';
import assert from 'node:assert/strict';
import {boxOf, cutTriangles, keptTriangles, partsOf, type Tri, type V3} from './kitParts.js';

test('kitParts: keptTriangles drops a builder part only inside a cut of its own material', () => {
  const flat = (ts: Tri[]) => ts.flatMap(t => [...t.a, ...t.b, ...t.c]);
  const figure = flat([...quad(0.5, 1.5, 0.5, 'bronze', 0.5), ...quad(5, 1.5, 5, 'bronze', 0.5)]);
  const cuts = [{box: {min: [-1, 0.5, -1] as V3, max: [3, 4, 3] as V3}, materials: ['bronze']}];
  assert.deepEqual(keptTriangles(figure, 'bronze', cuts), [2, 3]);
  assert.deepEqual(keptTriangles(figure, 'stone', cuts), [0, 1, 2, 3]);
  assert.deepEqual(keptTriangles(figure, 'stone', [{...cuts[0], materials: []}]), [2, 3]);
});

/** Two triangles forming a unit quad in the xz plane at height y, offset by (x, z). */
function quad(x: number, y: number, z: number, material: string, s = 1): Tri[] {
  const p = (dx: number, dz: number): V3 => [x + dx * s, y, z + dz * s];
  return [{a: p(0, 0), b: p(1, 0), c: p(1, 1), material}, {a: p(0, 0), b: p(1, 1), c: p(0, 1), material}];
}

test('kitParts: welded pieces of one material merge when their boxes touch, other materials stay apart', () => {
  const tris = [...quad(0, 0, 0, 'stone', 2), ...quad(0.2, 1, 0.2, 'bronze', 0.5), ...quad(0.2, 1.02, 0.2, 'bronze', 0.5), ...quad(5, 1, 5, 'bronze', 0.5)];
  const parts = partsOf(tris, 0.03);
  assert.equal(parts.length, 3);
  assert.deepEqual(parts.map(p => [p.material, p.count]), [['bronze', 4], ['stone', 2], ['bronze', 2]]);
});

test('kitParts: cuts keep the plinth and give the replaced figure box', () => {
  const tris = [...quad(0, 0, 0, 'stone', 2), ...quad(0.5, 1.5, 0.5, 'bronze', 0.5)];
  const cut = cutTriangles(tris, [{min: [-1, 0.5, -1], max: [3, 4, 3]}], ['bronze']);
  assert.deepEqual([...cut], [2, 3]);
  const b = boxOf(tris, cut)!;
  assert.deepEqual(b.min, [0.5, 1.5, 0.5]);
  assert.deepEqual(b.max, [1, 1.5, 1]);
  assert.equal(cutTriangles(tris, [{min: [-1, -1, -1], max: [3, 4, 3]}], ['gold']).size, 0);
});
