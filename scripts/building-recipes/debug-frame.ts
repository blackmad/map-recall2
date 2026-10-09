/** node --import tsx scripts/building-recipes/debug-frame.ts <id> ...: BAG footprint rings in the frontage frame. */
import fs from 'node:fs';
import {frontFrame, ringToFrame} from '../../src/canalRecall/buildingRecipe/instances.ts';
for (const id of process.argv.slice(2)) {
  const facts = JSON.parse(fs.readFileSync(`scripts/building-recipes/houses/${id}/facts.json`, 'utf8'));
  const frame = frontFrame(facts.fronts[0]);
  console.log(id, JSON.stringify(facts.bagFootprintRD.map((r: number[][]) => ringToFrame(r, frame).map(p => p.map(v => +v.toFixed(2))))));
}
