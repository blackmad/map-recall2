import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Document } from '@gltf-transform/core';

import { lod2IsCurrent, LOD2_BUILD_VERSION, type LandmarkLodEntry } from '../../src/canalRecall/landmarks/landmarkLod';
import { bakeChunkLod2, collectFaces, groupTrianglesByPand, hasRecipeSlots, lodTable, mergeForLod2, pointTriangleDistanceSq, recolourFaces, shareVertexStreams, trimMaterials } from './build-landmark-lods';

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

test('shareVertexStreams: per-material primitives draw from one position/normal stream; trimMaterials keeps the slot extras', () => {
  const doc = new Document(), buffer = doc.createBuffer();
  const mesh = doc.createMesh();
  for (let k = 0; k < 2; k++) {
    const p = doc.createAccessor().setType('VEC3').setArray(new Float32Array([k, 0, 0, k + 1, 0, 0, k, 1, 0])).setBuffer(buffer);
    const n = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1])).setBuffer(buffer);
    const material = doc.createMaterial(`m${k}`).setBaseColorFactor([0.123456, 0.5, 0.5, 1]).setRoughnessFactor(0.9).setExtras({ materialSlot: 'brick', tint: '#aa0000', materialSlotSource: 'inferred' });
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', p).setAttribute('NORMAL', n)
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0, 1, 2])).setBuffer(buffer)).setMaterial(material));
  }
  shareVertexStreams(doc, mesh);
  const [a, b] = mesh.listPrimitives();
  assert.equal(a.getAttribute('POSITION'), b.getAttribute('POSITION'));
  assert.equal(a.getAttribute('NORMAL'), b.getAttribute('NORMAL'));
  assert.equal(a.getAttribute('POSITION')!.getCount(), 6);
  assert.deepEqual(Array.from(b.getIndices()!.getArray()!), [3, 4, 5]);
  assert.deepEqual(Array.from(b.getAttribute('POSITION')!.getElement(3, [])), [1, 0, 0]);
  trimMaterials(doc);
  const m = a.getMaterial()!;
  assert.equal(m.getName(), '');
  assert.equal(m.getRoughnessFactor(), 1);
  assert.equal(m.getBaseColorFactor()[0], 0.1235);
  assert.deepEqual(m.getExtras(), { materialSlot: 'brick', tint: '#aa0000', materialSlotSource: 'inferred' });
});

test('groupTrianglesByPand: triangles of a pand become contiguous (stable), ranges written, no-pand triangles last', () => {
  const doc = new Document(), buffer = doc.createBuffer();
  const p = new Float32Array(15 * 3);
  const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(Array.from({ length: 15 }, (_, i) => i))).setBuffer(buffer));
  doc.createMesh().addPrimitive(prim);
  const pands = [2, 0, -1, 2, 0];
  groupTrianglesByPand(doc, (_k, t) => pands[t]);
  assert.deepEqual(Array.from(prim.getIndices()!.getArray()!), [3, 4, 5, 12, 13, 14, 0, 1, 2, 9, 10, 11, 6, 7, 8]);
  assert.deepEqual((prim.getExtras() as { pandRanges: number[][] }).pandRanges, [[0, 0, 2], [2, 2, 2]]);
});

test('bakeChunkLod2: a real chunk at <= 1,500 triangles, every primitive ranged, faces sit inside their pand (lane R4-C)', async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } = await import('meshoptimizer');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const id = 'chunk-face-bilder-080336-090492';
  const source = `public/canal-drive/models/ordinary-buildings/chunks/${id}.glb`;
  const row = (JSON.parse(fs.readFileSync('public/canal-drive/ordinary-buildings-data/chunks.json', 'utf8')).chunks as { id: string; pands: { bounds: { min: number[]; max: number[] } }[] }[]).find(c => c.id === id)!;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chunk-lod2-')), `${id}.lod2.glb`);
  const result = (await bakeChunkLod2(io, id, source, out))!;
  assert.ok(result.triangles <= 1500 && result.triangles > 100, `${result.triangles} triangles`);
  assert.equal(result.pands, row.pands.length);
  const doc = await io.read(out);
  const faces = collectFaces(doc);
  assert.equal(faces.facePands.length, result.triangles);
  assert.ok(faces.facePands.every(p => p >= 0), 'every lod2 face has a pand');
  // Each primitive's ranges tile its triangles exactly.
  for (const prim of doc.getRoot().listMeshes()[0].listPrimitives()) {
    const ranges = (prim.getExtras() as { pandRanges: number[][] }).pandRanges;
    let next = 0;
    for (const [, first, count] of ranges) { assert.equal(first, next); next += count; }
    assert.equal(next, prim.getIndices()!.getCount() / 3);
  }
  // A face's centroid lies within its pand's bounds along the frontage (x), a 1.5 m margin for the simplifier.
  let inside = 0;
  for (let f = 0; f < faces.facePands.length; f++) {
    const x = [0, 1, 2].reduce((a, j) => a + faces.positions[faces.indices[f * 3 + j] * 3], 0) / 3;
    const b = row.pands[faces.facePands[f]].bounds;
    if (x >= b.min[0] - 1.5 && x <= b.max[0] + 1.5) inside++;
  }
  assert.ok(inside / faces.facePands.length > 0.97, `${inside}/${faces.facePands.length} faces inside their pand`);
});

test('ordinary installs (R4-H): lodTable carries ordinary rows over a landmark rebuild, the manifest wins on a clash', async () => {
  const { lodTable } = await import('./build-landmark-lods');
  const row = { sourceHash: 'f'.repeat(64), buildVersion: 1, bytes: 9, triangles: 3, texelsPerMetre: 4, ordinary: true as const };
  const kept = { 'ordinary-1': row, 'gone-landmark': { sourceHash: 'x', buildVersion: 2, bytes: 1, triangles: 1 }, both: row };
  const table = lodTable({ models: { both: { lod2: { sourceHash: 'b', buildVersion: LOD2_BUILD_VERSION, bytes: 3, triangles: 1 } } } }, kept);
  assert.deepEqual(table['ordinary-1'], row);
  assert.ok(!('gone-landmark' in table), 'only ordinary rows are carried');
  assert.equal(table.both.sourceHash, undefined, 'a manifest model keeps its own row');
});

test('ordinary installs (R4-H): area-weighted colour clusters, deterministic, at most k', async () => {
  const { clusterColours } = await import('./build-landmark-lods');
  // Two big brick faces, one small white frame, one dark window band.
  const colours = [0.3, 0.1, 0.05, 0.31, 0.1, 0.05, 0.9, 0.9, 0.9, 0.02, 0.02, 0.03];
  const areas = [10, 12, 0.5, 3];
  const a = clusterColours(colours, areas, 3), b = clusterColours(colours, areas, 3);
  assert.deepEqual(a, b);
  assert.equal(a.centres.length, 3);
  assert.equal(a.cluster[0], a.cluster[1], 'the brick faces share a colour');
  assert.notEqual(a.cluster[2], a.cluster[3]);
  assert.equal(clusterColours(colours, areas, 1).centres.length, 1);
  // One colour only: no empty extra clusters.
  assert.equal(clusterColours([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [1, 1], 4).centres.length, 1);
});

test('ordinary installs (R4-H): sparse texel density reads the least detailed 5 % of the textured area', async () => {
  const { sparseTexelsPerMetre, largestImagePx } = await import('./build-landmark-lods');
  const doc = new Document(), buffer = doc.createBuffer();
  // A 1 x 1 PNG header is enough for getSize: build one by hand (IHDR width/height at bytes 16..24).
  const png = (w: number, h: number) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b; };
  const texture = doc.createTexture().setImage(png(512, 64)).setMimeType('image/png');
  const material = doc.createMaterial().setBaseColorTexture(texture);
  // Quad A: 10 m x 10 m wall mapped to u 0..0.5, v 0..1 -> 256 x 64 texels over 100 m2 -> sqrt(163.84) = 12.8 texels/m.
  // Quad B: 1 m x 1 m mapped to the other half -> 256 x 64 over 1 m2 -> 128 texels/m (dense, 1 % of the area).
  const quad = (x0: number, s: number, u0: number) => doc.createPrimitive().setMaterial(material)
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setBuffer(buffer).setArray(new Float32Array([x0, 0, 0, x0 + s, 0, 0, x0 + s, s, 0, x0, s, 0])))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setBuffer(buffer).setArray(new Float32Array([u0, 1, u0 + 0.5, 1, u0 + 0.5, 0, u0, 0])))
    .setIndices(doc.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(new Uint16Array([0, 1, 2, 0, 2, 3])));
  doc.createScene().addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(quad(0, 10, 0)).addPrimitive(quad(20, 1, 0.5))));
  assert.equal(largestImagePx(doc), 512);
  assert.ok(Math.abs(sparseTexelsPerMetre(doc)! - 12.8) < 1e-6, `${sparseTexelsPerMetre(doc)}`);
  assert.equal(sparseTexelsPerMetre(new Document()), null);
});
