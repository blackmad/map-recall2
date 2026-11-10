import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Document, NodeIO} from '@gltf-transform/core';
import {compressGlb, describeInstalledGlb, glbIO} from './compressGlb.ts';

/** A two-triangle quad with a non-trivial position so quantization has something to round. */
async function tinyGlb(): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('t'), mesh = doc.createMesh('t');
  const positions = new Float32Array([0.1234, 0, 0, 3.4567, 0, 0, 3.4567, 2.5, 0.0009, 0.1234, 2.5, 0.0009]);
  const normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]);
  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
  mesh.addPrimitive(doc.createPrimitive()
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uvs).setBuffer(buffer)));
  scene.addChild(doc.createNode('t').setMesh(mesh));
  return (await glbIO()).writeBinary(doc);
}

test('disabled option returns the input bytes unchanged', async () => {
  const bytes = await tinyGlb();
  assert.equal(await compressGlb(bytes, {enabled: false}), bytes);
});

test('enabled option keeps the triangle count and stays within 1 cm of the source positions', async () => {
  const bytes = await tinyGlb();
  const packed = await compressGlb(bytes);
  const io = await glbIO();
  const [src, out] = [await io.readBinary(bytes), await io.readBinary(packed)];
  const prim = (d: Document) => d.getRoot().listMeshes()[0].listPrimitives()[0];
  assert.equal(prim(out).getIndices()!.getCount(), prim(src).getIndices()!.getCount());
  const a = prim(src).getAttribute('POSITION')!, b = prim(out).getAttribute('POSITION')!;
  const node = out.getRoot().listNodes().find(n => n.getMesh())!;
  const m = node.getMatrix();
  for (let i = 0; i < a.getCount(); i++) {
    const p = a.getElement(i, []), q = b.getElement(i, []);
    const w = [m[0] * q[0] + m[4] * q[1] + m[8] * q[2] + m[12], m[1] * q[0] + m[5] * q[1] + m[9] * q[2] + m[13], m[2] * q[0] + m[6] * q[1] + m[10] * q[2] + m[14]];
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(w[k] - p[k]) <= 0.01, `vertex ${i} axis ${k}: ${w[k]} vs ${p[k]}`);
  }
});

test('describeInstalledGlb re-hashes the bytes that are written', () => {
  const entry = {modelUrl: './models/x/chunk-a.glb?asset=0000000000000000', sha256: 'stale', bytes: 1};
  const out = describeInstalledGlb(entry, Uint8Array.from([1, 2, 3]));
  assert.equal(out.bytes, 3);
  assert.equal(out.sha256.length, 64);
  assert.match(out.modelUrl, /^\.\/models\/x\/chunk-a\.glb\?asset=[0-9a-f]{16}$/);
});
