import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(process.argv[2]);
const r = doc.getRoot();
for (const m of r.listMaterials()) console.log('mat', m.getName(), m.getBaseColorFactor(), m.getMetallicFactor(), m.getRoughnessFactor(), !!m.getBaseColorTexture(), !!m.getMetallicRoughnessTexture(), !!m.getNormalTexture(), m.getAlphaMode(), m.getDoubleSided());
for (const t of r.listTextures()) console.log('tex', t.getMimeType(), t.getSize());
for (const me of r.listMeshes()) for (const p of me.listPrimitives()) console.log('prim', p.listSemantics(), p.getAttribute('POSITION').getCount(), !!p.getMaterial());
