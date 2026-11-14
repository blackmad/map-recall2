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

test('a cut chunk installs: an emptied primitive is dropped and the variant goes through compressGlb (integrator 2026-11-14)', async () => {
  const { Document, NodeIO } = await import('@gltf-transform/core');
  const { cutChunkWalls } = await import('./rowWallCut.ts');
  const { compressGlb } = await import('../glb/compressGlb.ts');
  const doc = new Document(), buf = doc.createBuffer();
  // Pand 0: a box x 0..4, z 0..6 (its wall on x = 0); pand 1: a box x 0..4, z 7..12. Frame = RD.
  const quad = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number) => [x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0];
  const prim = (name: string, pos: number[], ranges: number[][]) => {
    const n = pos.length / 3, idx: number[] = [];
    for (let q = 0; q < n / 4; q++) idx.push(4 * q, 4 * q + 1, 4 * q + 2, 4 * q, 4 * q + 2, 4 * q + 3);
    const uv = new Float32Array(2 * n).map((_, i) => (i % 2 ? 1.5 : -0.5));
    return doc.createPrimitive().setMaterial(doc.createMaterial(name))
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(3 * n).fill(0).map((_, i) => (i % 3 === 0 ? -1 : 0))).setBuffer(buf))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(buf))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buf))
      .setExtras({ pandRanges: ranges });
  };
  // Primitive 0 (glass): only pand 0's street wall, so the cut empties it. Primitive 1 (brick): pand 0's wall and side
  // wall, then pand 1's wall.
  const glass = prim('glass', quad(0, 1, 0, 2, 3, 5), [[0, 0, 2]]);
  const brick = prim('brick', [...quad(0, 0, 0, 6, 0, 14), ...quad(0, 6, 4, 6, 0, 14), ...quad(0, 7, 0, 12, 0, 14)], [[0, 0, 4], [1, 4, 2]]);
  const mesh = doc.createMesh().addPrimitive(glass).addPrimitive(brick);
  const pands = [
    { pandId: 'a', triangles: 6, ranges: [{ primitive: 0, firstTriangle: 0, triangleCount: 2 }, { primitive: 1, firstTriangle: 0, triangleCount: 4 }] },
    { pandId: 'b', triangles: 2, ranges: [{ primitive: 1, firstTriangle: 4, triangleCount: 2 }] },
  ];
  doc.createScene().addChild(doc.createNode('chunk').setMesh(mesh).setExtras({ streetChunk: { frame: { midRD: [0, 0], uRD: [1, 0], nRD: [0, 1] }, pands } }));
  const { cuts, triangles } = await cutChunkWalls(doc, [{ pandId: 'a', edgeRD: [[0, 6], [0, 0]], fronts: [{ id: 'f', widthM: 6, eavesM: 14 }] }]);
  assert.equal(cuts[0].removed, 4);
  assert.equal(triangles, 4);
  const node = doc.getRoot().listNodes()[0], left = node.getMesh()!.listPrimitives();
  assert.deepEqual(left.map(p => p.getMaterial()!.getName()), ['brick'], 'the emptied glass primitive is gone');
  assert.deepEqual((node.getExtras() as { streetChunk: { pands: typeof pands } }).streetChunk.pands.map(p => [p.triangles, p.ranges]),
    [[2, [{ primitive: 0, firstTriangle: 0, triangleCount: 2 }]], [2, [{ primitive: 0, firstTriangle: 2, triangleCount: 2 }]]]);
  const installed = await compressGlb(await new NodeIO().writeBinary(doc));
  assert.ok(installed.length > 0);
});
