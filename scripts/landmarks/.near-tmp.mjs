import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
await MeshoptDecoder.ready;
const [,, file, x, y, z, r] = process.argv;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).read(file);
for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
  const pos = p.getAttribute('POSITION').getArray(), idx = p.getIndices()?.getArray(), mat = p.getMaterial()?.getName();
  const n = idx ? idx.length : pos.length / 3;
  for (let i = 0; i < n; i += 3) {
    const v = [0,1,2].map(k => { const j = idx ? idx[i+k] : i+k; return [pos[3*j], pos[3*j+1], pos[3*j+2]]; });
    const c = [0,1,2].map(a => (v[0][a]+v[1][a]+v[2][a])/3);
    if (Math.hypot(c[0]-x, c[1]-y, c[2]-z) < +r) console.log(mat, v.map(q=>q.map(t=>t.toFixed(2)).join(',')).join(' | '));
  }
}
