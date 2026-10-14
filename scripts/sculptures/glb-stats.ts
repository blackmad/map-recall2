/**
 * Bounds and triangle count of one or more GLBs (meshopt/quantized landmark GLBs included).
 *
 *   node --import tsx scripts/sculptures/glb-stats.ts [--materials] <a.glb> [b.glb ...]
 *
 * --materials also prints each material's name, extras (materialSlot, tint) and base colour, and whether
 * primitives carry COLOR_0 or TEXCOORD_0 (baked vertex colour or texture).
 */
import {NodeIO, getBounds} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const materials = process.argv.includes('--materials');
for (const file of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const doc = await io.read(file);
  await doc.transform(dequantize());
  const b = getBounds(doc.getRoot().listScenes()[0]);
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) tris += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')!.getCount()) / 3;
  const size = b.max.map((v, i) => (v - b.min[i]).toFixed(2));
  console.log(JSON.stringify({file, size: {x: size[0], y: size[1], z: size[2]}, minY: b.min[1].toFixed(2), tris}));
  if (!materials) continue;
  for (const m of doc.getRoot().listMaterials()) console.log('  material', JSON.stringify({name: m.getName(), extras: m.getExtras(), base: m.getBaseColorFactor().map(v => +v.toFixed(3)), texture: !!m.getBaseColorTexture()}));
  const sem = new Set(doc.getRoot().listMeshes().flatMap(me => me.listPrimitives().flatMap(p => p.listSemantics())));
  console.log('  attributes', [...sem].join(' '));
}
