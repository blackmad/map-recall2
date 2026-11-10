/**
 * Mesh hash of every installed-style `kind: large` recipe (compiled block-kit triangles per material slot), to prove a
 * kit change leaves existing large buildings byte-identical. fit-golden covers the fit only; this covers the mesh.
 *
 *   node --import tsx scripts/building-recipes/large-mesh-hashes.ts [--write] [--only=<id>,...] [--allow=<id,id>]
 *
 * --allow=<house dirs>: house:publish's flag. A changed (or new) mesh in the list is re-recorded; one outside it fails
 * (exit 1, nothing recorded). docs/house-line.md section 3.
 *
 * Compares against scripts/building-recipes/large-mesh-golden.json (--write records it).
 */
import fs from 'node:fs';
import path from 'node:path';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {meshHashOf} from './mesh-hash.ts';
import {parseAllow, partitionChanged} from '../../src/canalRecall/houseSpec/allow.ts';
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
  const differing: string[] = [];
  for (const [id, h] of Object.entries(hashes)) if (golden[id] !== h) { changed++; differing.push(id); console.log(`${golden[id] ? 'CHANGED' : 'NEW'} ${id}: ${golden[id]} -> ${h}`); }
  const allow = parseAllow(process.argv);
  if (allow && changed) {
    const {allowed, outside} = partitionChanged(differing, allow);
    if (outside.length) { console.log(`OUTSIDE the allow-list (${outside.length}): ${outside.join(', ')}`); process.exitCode = 1; }
    else {
      fs.writeFileSync(GOLDEN, JSON.stringify({...golden, ...Object.fromEntries(allowed.map(id => [id, hashes[id]]))}, null, 1) + '\n');
      console.log(`re-recorded ${allowed.length} allowed large meshes: ${allowed.join(', ')}`);
    }
    process.exit(process.exitCode ?? 0);
  }
  console.log(changed ? `${changed} large meshes differ` : `all ${ids.length} large meshes identical`);
  if (changed) process.exitCode = 1;
}
