/** Diagnostic: print the fit report and the opening/crown extents per front, without compiling. */
import fs from 'node:fs';
import {fitIntent} from '../../src/canalRecall/buildingRecipe/fit.ts';
import {loadIntent} from './compile.ts';

const id = process.argv[2];
const {intent} = await loadIntent(id);
const {recipe, report} = fitIntent(intent, JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8')));
console.log(JSON.stringify(report, null, 1));
for (const e of recipe.elevations) {
  const tops = e.openings.value.map(o => +(o.bottomM + o.heightM).toFixed(2));
  console.log(e.id, 'edge', e.edgeIndex, e.endEdgeIndex, 'max opening top', Math.max(...tops), 'crown min', e.crown ? Math.min(...e.crown.value.profile.map(p => p[1])).toFixed(2) : '-', 'plan', JSON.stringify(e.frontagePlan?.value ?? null), 'tol', e.frontageToleranceM?.value);
}
console.log('shellTop', recipe.shellTopM?.value, 'house eaves', recipe.house.eavesHeightM.value);
