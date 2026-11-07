import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Document } from '@gltf-transform/core';

import { lod2IsCurrent, LOD2_BUILD_VERSION, type LandmarkLodEntry } from '../../src/canalRecall/landmarks/landmarkLod';
import { hasRecipeSlots, lodTable, mergeForLod2, pointTriangleDistanceSq, recolourFaces } from './build-landmark-lods';

test('lodTable: lod1 fields stay at the top level, lod2 beside them, lod2-only models get a row, and it round-trips', () => {
  const lod1 = { sourceHash: 'a', buildVersion: 2, bytes: 10, triangles: 5 };
  const lod2 = { sourceHash: 'a', buildVersion: LOD2_BUILD_VERSION, bytes: 3, triangles: 1 };
  const table = lodTable({ models: { both: { lod1, lod2 }, small: { lod2: { ...lod2, sourceHash: 'b' } }, old: { lod1 }, none: {} } });
  assert.deepEqual(Object.keys(table), ['both', 'small', 'old']);
  assert.deepEqual(table.old, lod1, 'a lod1-only row is byte-identical to before');
  const parsed = JSON.parse(JSON.stringify(table, null, 1)) as Record<string, LandmarkLodEntry>;
  assert.deepEqual(parsed, table);
  assert.ok(lod2IsCurrent(parsed.both.lod2, 'a'));
  assert.ok(lod2IsCurrent(parsed.small.lod2, 'b'));
  assert.ok(!('sourceHash' in parsed.small), 'no lod1 fields for a model under the lod1 threshold');
});

function twoBoxes(): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  const box = (colour: number[], x: number, alphaMode: 'OPAQUE' | 'BLEND' = 'OPAQUE') => {
    const p: number[] = [], idx: number[] = [];
    // A unit quad pair (two triangles) facing +z at x.
    p.push(x, 0, 0, x + 1, 0, 0, x + 1, 1, 0, x, 1, 0);
    idx.push(0, 1, 2, 0, 2, 3);
    const material = doc.createMaterial().setBaseColorFactor(colour).setAlphaMode(alphaMode);
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(p)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(idx)).setBuffer(buffer))
      .setMaterial(material);
    return doc.createMesh().addPrimitive(prim);
  };
  scene.addChild(doc.createNode('red').setMesh(box([1, 0, 0, 1], 0)));
  // Translated node: the merge must bake the node transform.
  scene.addChild(doc.createNode('blue').setMesh(box([0, 0, 1, 1], 0)).setTranslation([5, 0, 0]));
  scene.addChild(doc.createNode('faint glass').setMesh(box([0.1, 0.2, 0.3, 0.2], 10, 'BLEND')));
  scene.addChild(doc.createNode('solid glass').setMesh(box([0.6, 0.6, 0.5, 0.8], 20, 'BLEND')));
  return doc;
}

test('mergeForLod2: one primitive, colours per vertex, node transforms baked, faint glass left out', () => {
  const merged = mergeForLod2(twoBoxes())!;
  const meshes = merged.getRoot().listMeshes();
  assert.equal(meshes.length, 1);
  const prim = meshes[0].listPrimitives()[0];
  assert.equal(meshes[0].listPrimitives().length, 1);
  const pos = prim.getAttribute('POSITION')!, col = prim.getAttribute('COLOR_0')!;
  assert.equal(pos.getCount(), 12, 'red, blue and the opaque-enough glass; the 0.2-alpha glass is dropped');
  assert.deepEqual(pos.getElement(4, []), [5, 0, 0]);
  assert.deepEqual(col.getElement(0, []), [1, 0, 0]);
  assert.deepEqual(col.getElement(4, []), [0, 0, 1]);
  assert.equal(prim.getIndices()!.getCount(), 18);
  assert.equal(prim.getMaterial()!.getDoubleSided(), true);
});

test('hasRecipeSlots: explicit slots (recipe look at runtime) yes, inferred no', () => {
  const doc = new Document();
  doc.createMaterial().setExtras({ materialSlot: 'brick', materialSlotSource: 'inferred' });
  assert.equal(hasRecipeSlots(doc), false);
  doc.createMaterial().setExtras({ materialSlot: 'brick' });
  assert.equal(hasRecipeSlots(doc), true);
});

test('pointTriangleDistanceSq: inside, edge and vertex regions', () => {
  const a = [0, 0, 0], b = [1, 0, 0], c = [0, 1, 0];
  assert.equal(pointTriangleDistanceSq([0.2, 0.2, 2], a, b, c), 4);
  assert.ok(Math.abs(pointTriangleDistanceSq([0.5, -1, 0], a, b, c) - 1) < 1e-12);
  assert.ok(Math.abs(pointTriangleDistanceSq([-1, -1, 0], a, b, c) - 2) < 1e-12);
  assert.ok(Math.abs(pointTriangleDistanceSq([1, 1, 0], a, b, c) - 0.5) < 1e-12);
});

test('recolourFaces: a simplified face takes the colour of the source face under it, preferring one facing the same way', () => {
  // Source: a red wall (z = 0 plane) and a blue roof (y = 1 plane) meeting at the eave.
  const positions = [0, 0, 0, 4, 0, 0, 4, 1, 0, 0, 1, 0, /* roof */ 0, 1, 0, 4, 1, 0, 4, 1, -3, 0, 1, -3];
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];
  const colours = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  // Output: one wall triangle hugging the eave (its centroid is as near the roof as the wall) and one roof triangle.
  const out = { positions: [0, 0.9, 0, 4, 0.9, 0, 2, 1, 0, /* roof */ 0, 1, -0.2, 4, 1, -0.2, 2, 1, -3], indices: [0, 1, 2, 3, 4, 5] };
  const result = recolourFaces({ positions, indices, colours }, out);
  assert.deepEqual([...result.subarray(0, 3)], [1, 0, 0], 'wall stays red');
  assert.deepEqual([...result.subarray(3, 6)], [0, 0, 1], 'roof stays blue');
});
