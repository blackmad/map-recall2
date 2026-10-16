/**
 * Fit report of the two Mercatorplein builders: kit groups (system, panels, bays, storey lines), the kit gates, the
 * triangles kept / dropped / hand-drawn.
 *
 *   node --import tsx scripts/mercatorplein/report.ts
 */
import * as T from 'three';
import {compileNoordtoren} from '../landmarks/mercatorplein-noordtoren-builder.ts';
import {compileZuidtoren} from '../landmarks/mercatorplein-zuidtoren-builder.ts';

for (const [name, compile] of [['noordtoren', compileNoordtoren], ['zuidtoren', compileZuidtoren]] as const) {
  const {built, H} = compile();
  console.log(`== ${name}: kit triangles ${built.stats.triangles ?? '?'} hand ${H.triangles}`);
  for (const g of built.recipe.groups) console.log(`  group ${g.index} ${g.system} ground ${g.ground} surfaces [${g.surfaces}] panels [${g.panels}] main ${g.mainPanel} bays ${g.bays} pitch ${g.pitchM.toFixed(2)} lines ${g.lines.map(v => v.toFixed(2)).join(',')}`);
  console.log('  components', JSON.stringify(built.components));
  console.log('  gates', JSON.stringify(built.blockGates).slice(0, 600));
  let n = 0; built.group.traverse(o => { if (o instanceof T.Mesh) n++; });
  console.log('  meshes', n, 'stats', JSON.stringify(built.stats).slice(0, 300));
}
