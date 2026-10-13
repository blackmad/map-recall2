/**
 * Triangle accounting for a `kind: large` recipe without the GLB export or the 12k budget: triangles per mesh
 * (material slot), opening and component counts, the fitted groups and warnings. For budgeting before `large.ts`.
 *
 *   node --import tsx scripts/building-recipes/large-stats.ts --house=<id>
 */
import fs from 'node:fs';
import {validateLargeIntent} from '../../src/canalRecall/buildingRecipe/largeIntent.ts';
import {compileLargeBuilding} from '../../src/canalRecall/buildingRecipe/largeCompile.ts';

const id = process.argv.find(a => a.startsWith('--house='))?.slice(8);
if (!id) throw Error('--house=<id>');
const dir = `scripts/building-recipes/houses/${id}`;
const intent = validateLargeIntent(JSON.parse(fs.readFileSync(`${dir}/intent.json`, 'utf8')));
const facts = JSON.parse(fs.readFileSync(`${dir}/facts.json`, 'utf8'));
const built = compileLargeBuilding(intent, facts, {budget: 1e9});
const slots: Record<string, number> = {};
for (const g of built.group.children) slots[g.name] = (g as unknown as {geometry: {getAttribute(n: string): {count: number}}}).geometry.getAttribute('position').count / 3;
console.log(JSON.stringify({id, stats: built.stats, components: built.components, slots, groups: built.fit.groups, warnings: built.fit.warnings, blockGates: {ok: built.blockGates.ok, tris: built.blockGates.triangles, gap: built.blockGates.maxGapCm, floating: built.blockGates.floatingDetail}}, null, 1));
