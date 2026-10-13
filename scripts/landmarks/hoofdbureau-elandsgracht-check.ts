/**
 * Hard gates for the Hoofdbureau builder, on the decoded landmark GLB (the file build-manual-landmarks writes):
 *
 *   node --import tsx scripts/landmarks/hoofdbureau-elandsgracht-check.ts [--glb=public/canal-drive/models/hoofdbureau-elandsgracht.glb] [--budget=40000]
 *
 * The large-tier gates (footprint IoU, ridge and eaves vs 3DBAG, storey height, floating parts, open edges, block-kit
 * attachment) with the triangle budget of the hand-built landmark tier instead of the large tier's 12k.
 */
import fs from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {evaluateLargeGates} from '../../src/canalRecall/buildingRecipe/largeGates';
import type {Tri} from '../../src/canalRecall/buildingRecipe/gates';
import {compileHoofdbureau} from './hoofdbureau-elandsgracht-builder';

const arg = (k: string, d: string) => process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const glbPath = arg('glb', 'public/canal-drive/models/hoofdbureau-elandsgracht.glb'), budget = Number(arg('budget', '40000'));

await MeshoptDecoder.ready;
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder': MeshoptDecoder}).readBinary(fs.readFileSync(glbPath));
const tris: Tri[] = [];
const materials = new Map<string, {slot: unknown; tint: unknown; tris: number}>();
for (const node of doc.getRoot().listNodes()) for (const prim of node.getMesh()?.listPrimitives() ?? []) {
  // build-manual-landmarks quantizes positions: the node carries translation + uniform scale (no rotation).
  const p = prim.getAttribute('POSITION')!, idx = prim.getIndices(), mat = prim.getMaterial()!, ex = mat.getExtras() as {materialSlot?: string; tint?: string};
  const surface = mat.getName() === 'slate' ? 'roof' : 'wall', count = idx ? idx.getCount() : p.getCount();
  const t = node.getTranslation(), sc = node.getScale();
  const get = (k: number) => (p.getElement(idx ? idx.getScalar(k) : k, []) as number[]).map((v, i) => t[i] + v * sc[i]);
  for (let k = 0; k < count; k += 3) tris.push({a: get(k), b: get(k + 1), c: get(k + 2), surface, metallic: mat.getMetallicFactor()});
  const m = materials.get(mat.getName()) ?? {slot: ex.materialSlot, tint: ex.tint, tris: 0}; m.tris += count / 3; materials.set(mat.getName(), m);
}
const {built, stats} = compileHoofdbureau();
if (process.argv.includes('--raw')) {
  // Diagnostic: gates on the compiled geometry before the exporter's position quantization.
  tris.length = 0;
  built.group.traverse(o => {
    const m = o as {isMesh?: boolean; geometry?: {getAttribute(n: string): {array: ArrayLike<number>}}; userData: {surface?: string}};
    if (!m.isMesh) return;
    const a = m.geometry!.getAttribute('position').array;
    for (let i = 0; i < a.length; i += 9) tris.push({a: [a[i], a[i + 1], a[i + 2]], b: [a[i + 3], a[i + 4], a[i + 5]], c: [a[i + 6], a[i + 7], a[i + 8]], surface: m.userData.surface === 'roof' ? 'roof' : 'wall', metallic: 0});
  });
}
const {gates, topology} = evaluateLargeGates(tris, built);
if (process.argv.includes("--samples")) console.log(JSON.stringify(topology.openEdgeSamples));
for (const g of gates) if (g.id === 'triangle-budget') { g.pass = tris.length <= budget; g.limit = `<= ${budget} (hand-built landmark tier)`; }
for (const g of gates) console.log(`${g.pass ? 'PASS' : 'FAIL'} ${g.id} ${JSON.stringify(g.value)} (${g.limit})`);
console.log(`triangles ${tris.length}; hand parts: ${JSON.stringify(stats)}; materials ${JSON.stringify(Object.fromEntries(materials))}`);
if (gates.some(g => !g.pass)) process.exitCode = 1;
