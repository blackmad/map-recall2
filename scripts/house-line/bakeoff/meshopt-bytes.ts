/**
 * Lane BK: bytes of a compiled recipe GLB after meshopt (EXT_meshopt_compression, gltf-transform's `meshopt()` at its
 * default level), the delivery form a recipe chunk would ship in. Read only; prints one JSON row per GLB.
 *
 *   node --import tsx scripts/house-line/bakeoff/meshopt-bytes.ts <model.glb ...>
 */
import fs from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

await MeshoptEncoder.ready; await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
for (const file of process.argv.slice(2)) {
  const raw = fs.readFileSync(file);
  const doc = await io.readBinary(new Uint8Array(raw));
  await doc.transform(meshopt({ encoder: MeshoptEncoder }));
  const out = await io.writeBinary(doc);
  console.log(JSON.stringify({ file, bytes: raw.length, meshoptBytes: out.byteLength }));
}
