import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { MANUAL_LANDMARKS } from '../src/canalRecall/landmarks/manualModels';
import hospitals from './landmarks/hospital-footprints.json';
import { Matrix4, Vector3, Matrix3 } from 'three';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
for (const site of hospitals.sites) {
  const spec = MANUAL_LANDMARKS.find(s => s.id === site.id)!;
  const mapped = site.buildings.filter(f => f.properties.building !== 'construction');
  assert.equal(spec.spatialSuppression, false, `${site.id}: exact identities only`);
  const expected = mapped.flatMap(f => [f.id, `NL.IMBAG.Pand.${f.properties['ref:bag']}`]);
  assert.deepEqual([...spec.suppressOsmIds].sort(), expected.sort(), `${site.id}: hide both source identities of each replaced physical building`);
  const doc = await io.read(`public/canal-drive/models/${site.id}.glb`);
  const heights = mapped.map(f => {
    const main = f.properties.building === 'hospital' || f.id === 'w44451612';
    return Number(f.properties.height) || (main ? (site.id === 'olvg-west' ? 9.5 : 19) : 4);
  });
  let roofTriangles = 0;
  for (const node of doc.getRoot().listNodes().filter(n => n.getMesh())) for (const primitive of node.getMesh()!.listPrimitives()) {
    // meshopt quantizes positions and compensates in the owning node transform.
    const matrix = new Matrix4().fromArray(node.getWorldMatrix()), normalMatrix = new Matrix3().getNormalMatrix(matrix);
    const p = primitive.getAttribute('POSITION')!, n = primitive.getAttribute('NORMAL')!;
    const indices = primitive.getIndices();
    const count = indices?.getCount() ?? p.getCount();
    const at = (i: number) => indices ? indices.getScalar(i) : i;
    for (let i = 0; i < count; i += 3) {
      const ys = [0, 1, 2].map(j => new Vector3().fromArray(p.getElement(at(i + j), [])).applyMatrix4(matrix).y);
      const normalY = (j: number) => new Vector3().fromArray(n.getElement(at(i + j), [])).applyNormalMatrix(normalMatrix).y;
      if (primitive.getMaterial()?.getName() === 'slate' && heights.some(h => ys.every(y => Math.abs(y - h - .04) < .012))) {
        roofTriangles++;
        assert.ok([0, 1, 2].every(j => normalY(j) > .99), `${site.id}: horizontal slate roof faces upwards`);
      }
      if (primitive.getMaterial()?.getName() === (site.id === 'olvg-west' ? 'white' : 'brick') && heights.some(h => ys.every(y => Math.abs(y - h) < .012))) {
        assert.ok([0, 1, 2].every(j => normalY(j) < .9), `${site.id}: no wall-colored cap underneath the explicit slate roof`);
      }
    }
  }
  assert.ok(roofTriangles > 0, `${site.id}: source footprint roof exists`);
  console.log(`${site.id}: exact OSM/BAG replacement and ${roofTriangles} upward roof triangles verified.`);
}
