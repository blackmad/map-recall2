import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';

const base = 'public/canal-drive/models/jordaan-pois/';
const manifest = JSON.parse(await fs.readFile(base + 'manifest.json', 'utf8'));
assert.equal(manifest.models.length, 5);
const io = new NodeIO();
const results = [];
for (const model of manifest.models) {
  const bytes = await fs.readFile(base + model.id + '.glb');
  assert.equal(bytes.length, model.bytes);
  const document = await io.readBinary(bytes);
  let triangles = 0, primitives = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives()) {
      primitives++;
      const positions = primitive.getAttribute('POSITION');
      assert(positions && positions.getCount() > 0, model.id + ': empty geometry');
      for (const value of positions.getArray()) assert(Number.isFinite(value), model.id + ': nonfinite vertex');
      const indices = primitive.getIndices();
      assert(indices && indices.getCount() % 3 === 0, model.id + ': invalid triangle indices');
      for (const index of indices.getArray()) assert(index < positions.getCount(), model.id + ': out of range index');
      triangles += indices.getCount() / 3;
      assert(primitive.getMaterial(), model.id + ': missing material');
    }
  }
  assert(triangles < 15000, model.id + ': game triangle budget');
  assert(primitives <= 20, model.id + ': game draw call budget');
  assert(model.depthMetres > 8 && model.heightMetres > 10, model.id + ': full building dimensions');
  for (const tier of ['full', 'ground']) {
    const source = await fs.readFile(base + model.id + '-' + tier + '.jpg');
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), model.sourcePhotos[tier].sha256);
  }
  results.push({ id: model.id, triangles, drawCalls: primitives, kilobytes: Math.round(bytes.length / 1024) });
}
console.table(results);
