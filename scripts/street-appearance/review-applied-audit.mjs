/** Replay exact resident decorated chunk inputs through production geometry, observing resolved wall recipes.
 * node scripts/street-appearance/review-applied-audit.mjs --input=artifacts/street-appearance/final-front/applied-audit-input.json
 * Instrumentation records selection only; footprint, street visibility and generator logic remain production code.
 */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {build} from 'esbuild';
const argument=process.argv.find(a=>a.startsWith('--input='));
if(!argument)throw Error('Pass captured applied-audit-input.json');
const inputPath=argument.slice(8),inputBytes=await fs.readFile(inputPath),input=JSON.parse(inputBytes);
const audit=[];globalThis.__streetAppearanceAppliedAudit=audit;
const bundle=await build({stdin:{contents:"export {buildFeatureChunk} from './src/canalRecall/threeBuildingFeatures.ts'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{
 name:'observe-resolved-street-wall',setup(builder){builder.onLoad({filter:/streetFacadeRendering\.ts$/},async args=>{
  let source=await fs.readFile(args.path,'utf8');
  const anchor='if (!recipe) return building;';
  if(!source.includes(anchor))throw Error('Audit instrumentation anchor changed');
  source=source.replace(anchor,`${anchor}\n  (globalThis as any).__streetAppearanceAppliedAudit?.push({buildingId:building.id,wall,streetSide,recipe,wallHex:context.mappedWallHex??recipe.wallHex,mappedWallHex:context.mappedWallHex??null});`);
  return {contents:source,loader:'ts'};
 });}
}]});
const module=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
module.buildFeatureChunk(input.source,'photo','walls',Float32Array.from(input.streets),input.profiles);
const summary={};for(const row of audit){const id=row.recipe.profileId;const group=summary[id]??={runs:0,buildingIds:new Set(),palette:{}};group.runs++;group.buildingIds.add(row.buildingId);group.palette[row.wallHex]=(group.palette[row.wallHex]??0)+1;}
for(const group of Object.values(summary))group.buildingIds=[...group.buildingIds];
const sourceNames=['streetAppearance.ts','streetFacadeRendering.ts','threeBuildingFeatures.ts','threeBuildingMesh.ts','bayLook.ts'];
const sourceSha256=Object.fromEntries(await Promise.all(sourceNames.map(async name=>[name,crypto.createHash('sha256').update(await fs.readFile(`src/canalRecall/${name}`)).digest('hex')])));
const report={version:1,inputPath,inputSha256:crypto.createHash('sha256').update(inputBytes).digest('hex'),revision:input.revision,key:input.key,sourceSha256,features:input.source.length,streetSegments:input.streets.length/4,summary,samrat:audit.filter(row=>row.buildingId==='NL.IMBAG.Pand.0363100012178210'),appliedRuns:audit,limits:'Production geometry replay of actual resident decorated source and street inputs; verifies exposed wall-run recipe application, not per-building photo registration.'};
await fs.writeFile('artifacts/street-appearance/applied-wall-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({summary:report.summary,samrat:report.samrat,features:report.features,streetSegments:report.streetSegments},null,2));
