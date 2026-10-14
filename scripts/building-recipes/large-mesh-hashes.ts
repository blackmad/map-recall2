/**
 * Mesh hash of every installed-style `kind: large` recipe (compiled block-kit triangles per material slot), to prove a
 * kit change leaves existing large buildings byte-identical. fit-golden covers the fit only; this covers the mesh.
 *
 *   node --import tsx scripts/building-recipes/large-mesh-hashes.ts [--write] [--only=<id>,...]
 *
 * Compares against scripts/building-recipes/large-mesh-golden.json (--write records it).
 */
import fs from 'node:fs';
import path from 'node:path';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {meshHashOf} from './mesh-hash.ts';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';

const HOUSES = 'scripts/building-recipes/houses', GOLDEN = 'scripts/building-recipes/large-mesh-golden.json';
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const ids = fs.readdirSync(HOUSES).filter(id => {
  const f = path.join(HOUSES, id, 'intent.json');
  return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).kind === 'large' && (!only || only.includes(id));
}).sort();
const hashes: Record<string, string> = {};
for (const id of ids) {
  const intent = validateLargeIntent(JSON.parse(fs.readFileSync(path.join(HOUSES, id, 'intent.json'), 'utf8')));
  const facts = JSON.parse(fs.readFileSync(path.join(HOUSES, id, 'facts.json'), 'utf8'));
  const built = compileLargeBuilding(intent, facts, {budget: 1e9});
  hashes[id] = meshHashOf(built.group);
}
const golden: Record<string, string> = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) : {};
if (process.argv.includes('--write')) {
  fs.writeFileSync(GOLDEN, JSON.stringify({...golden, ...hashes}, null, 1) + '\n');
  console.log(`recorded ${Object.keys(hashes).length} large meshes`);
} else {
  let changed = 0;
  for (const [id, h] of Object.entries(hashes)) if (golden[id] !== h) { changed++; console.log(`${golden[id] ? 'CHANGED' : 'NEW'} ${id}: ${golden[id]} -> ${h}`); }
  console.log(changed ? `${changed} large meshes differ` : `all ${ids.length} large meshes identical`);
  if (changed) process.exitCode = 1;
}
