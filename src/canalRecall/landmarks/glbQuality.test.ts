import assert from 'node:assert/strict';
import test from 'node:test';
import {Accessor, Document} from '@gltf-transform/core';
import {soupFromDocument} from '../../../scripts/audit-glb-quality';
import {analyseSoup} from './glbQuality';

type Quad = [number, number, number][];

/** Axis-aligned box as 6 quads (12 triangles), outward CCW; `omit` removes faces by name. */
function boxQuads(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, omit: string[] = []): Record<string, Quad> {
  const f: Record<string, Quad> = {
    top: [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]],
    bottom: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    south: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    north: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]],
    east: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]],
    west: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
  };
  for (const o of omit) delete f[o];
  return f;
}

/** Build a GLB document from quad lists via the same path the CLI uses. */
function soup(...quadSets: Record<string, Quad>[]) {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const set of quadSets) for (const q of Object.values(set)) {
    const b = pos.length / 3;
    for (const p of q) pos.push(...p);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const doc = new Document();
  const buf = doc.createBuffer();
  const position = doc.createAccessor().setType(Accessor.Type.VEC3).setArray(new Float32Array(pos)).setBuffer(buf);
  const indices = doc.createAccessor().setType(Accessor.Type.SCALAR).setArray(new Uint32Array(idx)).setBuffer(buf);
  const prim = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices);
  const node = doc.createNode('n').setMesh(doc.createMesh('m').addPrimitive(prim));
  doc.createScene().addChild(node);
  return soupFromDocument(doc);
}

// A 10 x 8 x 10 m house on the ground.
const house = (omit: string[] = []) => boxQuads(0, 0, 0, 10, 8, 10, omit);

test('closed box passes with no findings that fail', () => {
  const r = analyseSoup(soup(house()));
  assert.equal(r.pass, true, JSON.stringify(r.findings));
  assert.equal(r.holes.loops, 0);
  assert.equal(r.seeThrough.rays, 0);
  assert.equal(r.detached.count, 0);
  assert.ok(r.seeThrough.tested > 0, 'wall rays must actually be tested');
});

test('box with a missing wall fails (hole loop and see-through rays)', () => {
  const r = analyseSoup(soup(house(['south'])));
  assert.equal(r.pass, false);
  assert.ok(r.holes.largestLoopPerimeter > 20, `loop ${r.holes.largestLoopPerimeter}`);
  assert.ok(r.seeThrough.rays > 3, `rays ${r.seeThrough.rays}`);
  assert.ok(r.findings.some(f => f.kind === 'holes' && f.severity === 'fail'));
  assert.ok(r.findings.some(f => f.kind === 'see-through' && f.severity === 'fail'));
});

test('floating facade slab 15 cm in front of the wall fails as detached', () => {
  const slab = boxQuads(0, 2, 10.15, 10, 8, 10.35);
  const r = analyseSoup(soup(house(), slab));
  assert.equal(r.pass, false);
  const d = r.findings.find(f => f.kind === 'detached');
  assert.ok(d && d.severity === 'fail', JSON.stringify(r.findings));
  assert.ok(Math.abs(r.detached.parts[0].gap - 0.15) < 0.03, `gap ${r.detached.parts[0].gap}`);
});

test('slab touching the wall, boxes without undersides on the ground, and flat decals pass', () => {
  const attached = boxQuads(0, 2, 10, 10, 8, 10.2);
  const porch = boxQuads(2, 0, 10.2, 4, 3, 12, ['bottom']);
  const decal = {sign: [[3, 2, 12.05], [4, 2, 12.05], [4, 3, 12.05], [3, 3, 12.05]] as Quad};
  const r = analyseSoup(soup(house(), attached, porch, decal));
  assert.equal(r.pass, true, JSON.stringify(r.findings));
  assert.equal(r.holes.loops, 0);
});

test('inverted roof, below-ground and far-outside parts are reported', () => {
  const flipped = house();
  flipped.top = [...flipped.top].reverse();
  const roofOnly = {r: [[0, 8, 0], [10, 8, 0], [10, 8, 10], [0, 8, 10]] as Quad}; // faces down
  const r1 = analyseSoup(soup(house(['top']), roofOnly));
  assert.ok(r1.invertedRoof.area > 50, `inverted ${r1.invertedRoof.area}`);
  assert.ok(r1.findings.some(f => f.kind === 'inverted-roof' && f.severity === 'fail'));
  const r2 = analyseSoup(soup(house(), boxQuads(2, -1.5, 2, 4, 0, 4), boxQuads(20, 0, 20, 21, 1, 21)));
  assert.ok(r2.belowGround.vertices > 0 && r2.belowGround.minY < -1);
  assert.ok(r2.farOutside.vertices > 0 || r2.findings.some(f => f.kind === 'detached'));
});

test('triangle cap is enforced', () => {
  const r = analyseSoup(soup(house()), {triangleCap: 10});
  assert.ok(r.findings.some(f => f.kind === 'triangle-cap'));
});
