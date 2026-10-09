/** Print each 3DBAG roof surface of a recipe house (area, slope, height range) and the clean-up decision.
 *   node --import tsx scripts/building-recipes/roof-dump.ts <house id>... */
import fs from 'node:fs/promises';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';
import {cleanRoof} from '../../src/canalRecall/buildingRecipe/roofCleanup.ts';
import {loadIntent} from './compile.ts';

const verbose = process.argv.includes('--surfaces');
for (const id of process.argv.slice(2).filter(a => !a.startsWith('--'))) {
  const facts: BuildingFacts = JSON.parse(await fs.readFile(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
  const {intent} = await loadIntent(id);
  const g = facts.heights.groundNAP;
  const {report} = cleanRoof(facts, {horizontalFronts: intent.fronts.filter(f => f.gable === 'cornice' || f.gable === 'flat').map(f => f.street)});
  console.log(id, 'roofMax', facts.heights.roofMaxM.toFixed(2), '->', report.roofMaxM, JSON.stringify(report.actions.map(a => ({...a, surfaceIds: a.surfaceIds.map(s => s.split(':').at(-1))}))));
  if (verbose) for (const r of facts.roofsRD) {
    const z = r.vertices.map(v => v[2] - g);
    console.log(`  ${r.surfaceId.split(':').at(-1)!.padEnd(4)} area ${r.areaM2.toFixed(2).padStart(7)} slope ${r.slopeDeg.toFixed(1).padStart(5)} z ${Math.min(...z).toFixed(2)}..${Math.max(...z).toFixed(2)} n=${r.vertices.length}`);
  }
}
