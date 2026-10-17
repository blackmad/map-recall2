/**
 * Parts of a kit landmark GLB, to find the figure a reconstruction replaces: triangles are welded into connected pieces, pieces of
 * one material whose boxes touch (within --touch m) are merged, and every part is printed with its material, triangle count and box
 * (landmark frame: x east, y up, z south).
 *
 *   node --import tsx scripts/sculptures/kit-parts.ts public/canal-drive/models/lieverdje.glb [--material=bronze] [--touch=0.03]
 */
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dequantize} from '@gltf-transform/functions';
import {MeshoptDecoder} from 'meshoptimizer';
import {kitTriangles, partsOf} from './kit-compose.js';

const argv = process.argv.slice(2);
const arg = (k: string, d = '') => argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder});
const doc = await io.read(argv.find(a => !a.startsWith('--'))!);
await doc.transform(dequantize());
const tris = kitTriangles(doc);
const only = arg('material');
for (const p of partsOf(tris, Number(arg('touch', '0.03')))) {
  if (only && !p.material.includes(only)) continue;
  if (p.count < Number(arg('min', '8'))) continue;
  const f = (v: number[]) => v.map(x => x.toFixed(2)).join(',');
  console.log(`${p.material.padEnd(14)} ${String(p.count).padStart(6)}  min ${f(p.min)}  max ${f(p.max)}  size ${f(p.max.map((v, i) => v - p.min[i]))}`);
}
