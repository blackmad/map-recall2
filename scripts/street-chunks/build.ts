/**
 * Street chunks CLI: block faces of recipe houses → one GLB each (staging).
 *
 *   node --import tsx scripts/street-chunks/build.ts [--prefix=bilder-] [--min=2] [--out=artifacts/street-chunks] [--url-base=./models/ordinary-buildings/chunks]
 *
 * Writes, under --out (untracked staging; nothing is installed):
 *   <name>.glb              the chunk (party walls dropped, grounded, eaves aligned)
 *   control/<name>.glb      same houses merged into one mesh with nothing changed (render control)
 *   <name>.report.json      triangles/draw calls/bytes before vs after, party walls, joints, eaves
 *   manifest.json           what the loader consumes (see src/canalRecall/streetChunks/manifest.ts)
 *   report.json             all chunks + totals
 *
 * --install copies the GLBs to public/canal-drive/models/ordinary-buildings/chunks/ and the manifest to
 * public/canal-drive/ordinary-buildings-data/chunks.json (the loader reads them only with ?streetChunks=1).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {loadIntent, HOUSES} from '../building-recipes/compile.ts';
import {buildChunkManifest, compileChunk, groupBlockFaces, type ChunkHouseInput, type ChunkResult} from '../../src/canalRecall/streetChunks/index.ts';

const arg = (n: string) => process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const prefix = arg('prefix') ?? 'bilder-', out = arg('out') ?? 'artifacts/street-chunks', min = Number(arg('min') ?? 2), urlBase = arg('url-base') ?? './models/ordinary-buildings/chunks';

const ids = (await fs.readdir(HOUSES)).filter(d => d.startsWith(prefix) && /\d$/.test(d)).sort();
const houses: ChunkHouseInput[] = [];
for (const id of ids) houses.push({id, intent: (await loadIntent(id)).intent, facts: JSON.parse(await fs.readFile(path.join(HOUSES, id, 'facts.json'), 'utf8'))});
const faces = groupBlockFaces(houses);
await fs.mkdir(path.join(out, 'control'), {recursive: true});
await fs.mkdir(path.join(out, 'grounded'), {recursive: true});

const results: ChunkResult[] = [], skipped: string[][] = [];
for (const face of faces) {
  if (face.length < min) { skipped.push(face.map(h => h.id)); continue; }
  const name = `${prefix.replace(/-$/, '')}-${face.map(h => h.intent.pandId.slice(-6)).sort()[0]}-x${face.length}`;
  const result = await compileChunk(face, {name});
  const control = await compileChunk(face, {name: `${name}-control`, maxRegroundM: 0, eavesSnapStepM: 0, trimPartyWalls: false});
  const grounded = await compileChunk(face, {name: `${name}-grounded`, trimPartyWalls: false});
  await fs.writeFile(path.join(out, 'grounded', `${name}.glb`), grounded.glb);
  await fs.writeFile(path.join(out, `${name}.glb`), result.glb);
  await fs.writeFile(path.join(out, 'control', `${name}.glb`), control.glb);
  await fs.writeFile(path.join(out, `${name}.report.json`), JSON.stringify({...result.report, order: result.order, frame: result.frame, controlBytes: control.glb.length}, null, 1) + '\n');
  results.push(result);
  const r = result.report;
  console.log(`${name}: ${r.houses} houses | tris ${r.triangles.individual} -> ${r.triangles.chunk} (party walls ${r.triangles.partyWallDropped >= 0 ? '-' : '+'}${Math.abs(r.triangles.partyWallDropped)}) | primitives ${r.primitives.individual} -> ${r.primitives.chunk} | bytes ${r.bytes.individual} -> ${r.bytes.chunk} | ${r.partyWalls.length} contacts | eaves clusters ${JSON.stringify(r.eaves.clusters.map(c => c.length))} | ${r.timingsMs.compile + r.timingsMs.trim + r.timingsMs.write} ms${r.warnings.length ? ' | warnings: ' + r.warnings.join('; ') : ''}`);
}
await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify(buildChunkManifest(results, name => `${urlBase}/chunk-${name}.glb`), null, 1) + '\n');
const sum = <K extends string>(pick: (r: ChunkResult['report']) => number) => results.reduce((s, r) => s + pick(r.report), 0);
const totals = {chunks: results.length, houses: sum(r => r.houses), skippedFaces: skipped,
  triangles: {individual: sum(r => r.triangles.individual), chunk: sum(r => r.triangles.chunk)}, primitives: {individual: sum(r => r.primitives.individual), chunk: sum(r => r.primitives.chunk)}, bytes: {individual: sum(r => r.bytes.individual), chunk: sum(r => r.bytes.chunk)}};
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({totals, chunks: results.map(r => r.report)}, null, 1) + '\n');
console.log(JSON.stringify(totals));
if (process.argv.includes('--install')) {
  // Publish for the loader: GLBs next to the ordinary models, manifest next to the catalogue. Review first; integrator commits.
  const models = 'public/canal-drive/models/ordinary-buildings/chunks';
  await fs.mkdir(models, {recursive: true});
  for (const r of results) await fs.copyFile(path.join(out, `${r.name}.glb`), path.join(models, `chunk-${r.name}.glb`));
  await fs.copyFile(path.join(out, 'manifest.json'), 'public/canal-drive/ordinary-buildings-data/chunks.json');
  console.log(`installed ${results.length} chunks to ${models} and ordinary-buildings-data/chunks.json`);
}
