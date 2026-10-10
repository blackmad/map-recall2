/** Loads a GLB as a material soup (world-space triangles, one material index per triangle); shared by facade-compare and the GLB audit. */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import type {MaterialSoup} from '../../src/canalRecall/landmarks/facadeCompare';

export async function loadMaterialSoup(file: string): Promise<MaterialSoup> {
  await MeshoptDecoder.ready;
  const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).read(file);
  const mats = doc.getRoot().listMaterials();
  const materials = mats.map(m => ({name: m.getName() || 'unnamed', rgb: m.getBaseColorFactor().slice(0, 3).map(c => Math.round(255 * Math.pow(c, 1 / 2.2))) as [number, number, number]}));
  const positions: number[] = [], indices: number[] = [], triMaterial: number[] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue;
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const base = positions.length / 3, v = [0, 0, 0];
      for (let i = 0; i < pos.getCount(); i++) {
        pos.getElement(i, v);
        positions.push(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]);
      }
      const idx = prim.getIndices(), n = idx ? idx.getCount() : pos.getCount();
      const mi = Math.max(0, mats.indexOf(prim.getMaterial()!));
      for (let i = 0; i + 2 < n; i += 3) {
        indices.push(base + (idx ? idx.getScalar(i) : i), base + (idx ? idx.getScalar(i + 1) : i + 1), base + (idx ? idx.getScalar(i + 2) : i + 2));
        triMaterial.push(mi);
      }
    }
  }
  return {positions, indices, triMaterial, materials};
}
