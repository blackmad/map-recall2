import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { ShapeUtils, Vector2 } from 'three';
import { compileRecipe, RECIPE_COMPILER_VERSION, type Triangulate } from '../../src/canalRecall/facade/recipe.ts';
import { recipeDevelopmentFixtures } from '../../src/canalRecall/facade/recipeFixtures.ts';
import { canonicalJson } from '../../src/canalRecall/facade/registrationGold.ts';

const triangulate: Triangulate = (outer, holes) => ShapeUtils.triangulateShape(outer.map(p => new Vector2(...p)), holes.map(h => h.map(p => new Vector2(...p))));
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve(process.argv.find(v => v.startsWith('--output='))?.slice(9) ?? `.cache/facade-rebuild/reports/recipes-${runId}`);
await mkdir(path.dirname(output), { recursive: true });
await mkdir(output); // Runs are immutable; an existing output directory is an error.
const recipes = await recipeDevelopmentFixtures();
const results = [];
for (const recipe of recipes) {
  const asset = await compileRecipe(recipe, triangulate);
  const stem = recipe.buildingId.replaceAll(':', '-');
  const data = `${canonicalJson(asset)}\n`;
  await writeFile(path.join(output, `${stem}.recipe.json`), `${canonicalJson(recipe)}\n`);
  await writeFile(path.join(output, `${stem}.mesh.json`), data);
  results.push({ buildingId: recipe.buildingId, recipeHash: asset.recipeHash, meshHash: asset.meshHash,
    triangles: asset.triangleCount, meshDraws: asset.meshes.length, bytes: Buffer.byteLength(data), gzipBytes: gzipSync(data).byteLength,
    identity: recipe.identity.state, disposition: asset.disposition });
}
const wrong = structuredClone(recipes[0]); wrong.elevations[0].elevationId = 'other-building:wrong-wall';
let rejected = false;
try { await compileRecipe(wrong, triangulate); } catch { rejected = true; }
if (!rejected) throw new Error('Wrong-wall regression unexpectedly compiled');
await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, runId, generatedAt: new Date().toISOString(),
  compilerVersion: RECIPE_COMPILER_VERSION, offline: true, results, wrongWallRejected: rejected,
  acceptedRealAppearances: 0, scope: 'Compiler development fixtures; no identity, camera, extraction or hardware-performance acceptance.' }, null, 2)}\n`);
console.log(`Recipe fixtures: ${output}`);
console.table(results.map(({ buildingId, triangles, meshDraws, gzipBytes }) => ({ buildingId, triangles, meshDraws, gzipBytes })));
