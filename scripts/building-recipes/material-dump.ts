/** List each primitive's material slot, surface, colour and triangle count in recipe GLBs.
 *   node --import tsx scripts/building-recipes/material-dump.ts <glb>... */
import {NodeIO} from '@gltf-transform/core';
import {KHRMeshQuantization} from '@gltf-transform/extensions';

const io = new NodeIO().registerExtensions([KHRMeshQuantization]);
for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  console.log(file);
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const m = p.getMaterial()!, extras = m.getExtras() as Record<string, unknown>;
    const hex = m.getBaseColorFactor().slice(0, 3).map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
    console.log(`  ${String(extras.materialSlot).padEnd(9)} ${String(extras.canalhouseSurface).padEnd(8)} #${hex} ${(p.getIndices()?.getCount() ?? p.getAttribute('POSITION')!.getCount()) / 3} tris`);
  }
}
