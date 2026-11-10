// Lane H7 r3: bake a staged block-face chunk's far-tier lod2 exactly as build-landmark-lods --chunks does
// (bakeChunkLod2, CHUNK_LOD2_MAX_ERROR_M) and run the geometry audit's z-fight + opening checks on it.
//   node --import tsx scripts/house-specs/pilot-20261110/audit/far-tier.ts <chunk.glb> <out.lod2.glb>
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier} from 'meshoptimizer';
import {bakeChunkLod2} from '../../../../scripts/landmarks/build-landmark-lods.ts';
import {loadMaterialSoup} from '../../../../scripts/landmarks/material-soup';
import {auditZFight, geometryAudit} from '../../../../src/canalRecall/landmarks/geometryAudit.ts';
const [src, out] = process.argv.slice(2);
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder});
const r = await bakeChunkLod2(io, 'h7-far', src, out);
console.log('lod2', r);
for (const [label, f] of [['near (lod0)', src], ['far (lod2)', out]] as const) {
  const soup = await loadMaterialSoup(f), z = auditZFight(soup), g = geometryAudit(soup) as any;
  console.log(`${label}: coplanar ${z.area} m2, tight ${z.tightArea} m2, near ${z.nearArea} m2; opening-outside ${g.withinWalls.outside.filter((o: any) => o.outsideM2 > 0.02).length} parts ${g.withinWalls.outsideM2} m2`);
  for (const p of z.patches) if (!p.near || p.tight) console.log('   ', p.tight ? 'tight' : 'copl ', p.materials.join('/'), p.area, 'gap', p.gap, 'y', p.min[1].toFixed(2), '-', p.max[1].toFixed(2), 'x', p.min[0].toFixed(1), '-', p.max[0].toFixed(1));
}
