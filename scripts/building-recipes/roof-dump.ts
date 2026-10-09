/** Print each 3DBAG roof surface of a recipe house: area, slope, height range.
 *   node --import tsx scripts/building-recipes/roof-dump.ts <house id>... */
import fs from 'node:fs/promises';
import type {BuildingFacts} from '../../src/canalRecall/buildingRecipe/facts.ts';

for (const id of process.argv.slice(2)) {
  const facts: BuildingFacts = JSON.parse(await fs.readFile(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
  const g = facts.heights.groundNAP;
  console.log(id, 'roofMax', facts.heights.roofMaxM.toFixed(2), 'ridge', facts.heights.ridgeM.toFixed(2));
  for (const r of facts.roofsRD) {
    const z = r.vertices.map(v => v[2] - g);
    console.log(`  ${r.surfaceId.padEnd(8)} area ${r.areaM2.toFixed(2).padStart(7)} slope ${r.slopeDeg.toFixed(1).padStart(5)} z ${Math.min(...z).toFixed(2)}..${Math.max(...z).toFixed(2)} n=${r.vertices.length}`);
  }
}
