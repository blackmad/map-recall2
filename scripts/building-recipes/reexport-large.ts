/**
 * Re-export installed `kind: large` GLBs from their intents after a material-only intent change (e.g. `roof.flatHex`
 * from roof-flat.ts), without re-running the likeness review.
 *
 *   node --import tsx scripts/building-recipes/reexport-large.ts --house=<id>[,<id>...] [--write]
 *
 * Compiles and exports each house exactly as large.ts does (same exporter, same options), then refuses any house whose
 * mesh changed: the compiled `meshHash` must equal the catalogue entry's (or, for an entry without one, the golden's), so only materials can differ from the
 * reviewed install. Reports per house whether the GLB bytes are identical to the installed file (nothing to do) or
 * which materials changed. `--write` copies a changed GLB over the install and updates the catalogue entry's
 * hash/sha256/bytes/materials/triangles. Rebuild covers afterwards (build-covers + check:covers).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {canalhouseGroupToGlb} from '../canalhouse-recipes/export-glb.ts';
import {compileBuilding} from '../../src/canalRecall/buildingRecipe/compile.ts';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {trustFactsGround, type BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {sharedTerrain} from '../lib/terrainField.ts';
import {meshHashOf} from './mesh-hash.ts';

const HOUSES = 'scripts/building-recipes/houses', CATALOGUE = 'public/canal-drive/ordinary-buildings-data/catalogue.json', MODELS = 'public/canal-drive/models/ordinary-buildings';
const ids = (process.argv.find(a => a.startsWith('--house='))?.slice(8) ?? '').split(',').filter(Boolean);
if (!ids.length) throw Error('usage: reexport-large.ts --house=<id>[,<id>...] [--write]');
const write = process.argv.includes('--write');
const readJson = async (p: string) => JSON.parse(await fs.readFile(p, 'utf8'));

/** Material names of a GLB's JSON chunk. */
function materialNames(bytes: Uint8Array): string[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), len = view.getUint32(12, true);
  return (JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len))).materials ?? []).map((m: {name?: string}) => m.name ?? '');
}

const catalogue = await readJson(CATALOGUE);
/** Entries installed before `meshHash` was recorded: the golden (large-mesh-hashes.ts; stale-installs.ts checks it against the install). */
const golden: Record<string, string> = await readJson('scripts/building-recipes/large-mesh-golden.json');
let changed = 0, identical = 0, refused = 0;
for (const id of ids) {
  const intent = validateLargeIntent(await readJson(path.join(HOUSES, id, 'intent.json')));
  const facts: BuildingFacts = trustFactsGround(await readJson(path.join(HOUSES, id, 'facts.json')), sharedTerrain());
  const entry = catalogue.models.find((m: any) => m.id === `ordinary-${intent.pandId}`);
  const file = path.join(MODELS, `recipe-large-${id}.glb`);
  if (!entry || entry.modelUrl !== `./models/ordinary-buildings/recipe-large-${id}.glb`) { console.log(`${id}: not installed`); continue; }
  const meshHash = meshHashOf(compileLargeBuilding(intent, facts, {budget: 1e9}).group);
  const expected = entry.meshHash ?? golden[id];
  if (meshHash !== expected) { console.log(`${id}: REFUSED, mesh changed (${expected} -> ${meshHash}); reinstall with install-large.ts`); refused++; continue; }
  const built = compileBuilding(intent, facts);
  const glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: (m: any) => m.userData.materialSlot as string, maxBytes: 2_000_000});
  const installed = new Uint8Array(await fs.readFile(file));
  const sha256 = createHash('sha256').update(glb.bytes).digest('hex');
  if (sha256 === entry.sha256 && Buffer.compare(Buffer.from(installed), Buffer.from(glb.bytes)) === 0) { console.log(`${id}: identical`); identical++; continue; }
  const before = new Set(materialNames(installed)), after = new Set(materialNames(glb.bytes));
  console.log(`${id}: materials -[${[...before].filter(m => !after.has(m)).join(', ')}] +[${[...after].filter(m => !before.has(m)).join(', ')}], ${installed.length} -> ${glb.bytes.length} bytes, ${entry.triangles} -> ${glb.triangles} tris`);
  changed++;
  if (!write) continue;
  await fs.writeFile(file, glb.bytes);
  Object.assign(entry, {hash: sha256, sha256, bytes: glb.bytes.length, materials: glb.materials, triangles: glb.triangles, updatedAt: new Date().toISOString()});
}
if (write && changed) await fs.writeFile(CATALOGUE, JSON.stringify(catalogue, null, 2) + '\n');
console.log(`${changed} changed${write ? ' (written)' : ''}, ${identical} identical, ${refused} refused`);
