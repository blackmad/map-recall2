/** CPU-only hypothetical budget comparison. Source is patched in-memory, never on disk. */
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { ORIGIN } from '../../src/canalRecall/threeBuildingFeatures.ts';
import { streetSegments } from '../../src/canalRecall/streetFronts.ts';
import { sha256 } from './pipeline.ts';
const catalogBytes=await fs.readFile('public/data/street-appearance/profiles.json');
const catalog=JSON.parse(catalogBytes.toString());
const architectureStreets=streetSegments(catalog.streetFrontPaths,ORIGIN);
const sourceBytes=await fs.readFile('src/canalRecall/facadeExtras.ts');
const snapshots=[];
for(const budget of [{name:'current',wall:180,sideWall:30,building:230,streetReserve:160},{name:'double-near',wall:360,sideWall:30,building:460,streetReserve:320}]){
 const bundle=await build({stdin:{contents:"export {buildFeatureChunk} from './src/canalRecall/threeBuildingFeatures.ts'",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'observe-extra-budget',setup(builder){builder.onLoad({filter:/facadeExtras\.ts$/},async()=>{
  let source=sourceBytes.toString();
  source=source.replace(/export const EXTRA_BUDGET = .*? as const;/,`export const EXTRA_BUDGET = ${JSON.stringify(budget)} as const;`);
  source=source.replace('const used: string[] = [], groups = new Set<string>();','const wallStart = sink.tris.length; const used: string[] = [], groups = new Set<string>();');
  source=source.replace('extraUsage.record?.(c, used);',`(globalThis as any).__extraBudgetRows?.push({id:c.id,wallKey:c.wallKey,street,assembly:c.recipe?.facadeAssembly??null,entrance:c.recipe?.entranceAssembly??null,triangles:sink.tris.length-wallStart,used}); extraUsage.record?.(c, used);`);
  return {contents:source,loader:'ts'};
 });}}]});
 const module=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
 const targets=[];
 for(const target of ['overtoom','de-wallen','de-wallen-holdout']){
  const input=JSON.parse(await fs.readFile(`artifacts/street-appearance/stage-inputs/${target}.json`,'utf8'));
  const rows:any[]=[];(globalThis as any).__extraBudgetRows=rows;
  let chunk;try{chunk=module.buildFeatureChunk(input.features,'photo','extras',architectureStreets,catalog.profiles);}finally{delete(globalThis as any).__extraBudgetRows;}
  const values=(a:number[])=>{const sorted=a.slice().sort((a,b)=>a-b);return {count:sorted.length,total:sorted.reduce((a,b)=>a+b,0),p50:sorted[Math.floor(sorted.length*.5)]??0,p90:sorted[Math.floor(sorted.length*.9)]??0,max:sorted.at(-1)??0};};
  const buildings=chunk.ranges.map((r:any)=>({id:r.id,triangles:r.count/3}));
  targets.push({target,features:input.features.length,triangles:chunk.vertexCount/3,buildingDistribution:values(buildings.map((r:any)=>r.triangles)),wallDistribution:values(rows.map(r=>r.triangles)),streetWallDistribution:values(rows.filter(r=>r.street).map(r=>r.triangles)),componentUsage:rows.reduce((sum:Record<string,number>,r)=>{for(const id of r.used)sum[id]=(sum[id]??0)+1;return sum;},{}),buildings,rows});
 }
 snapshots.push({budget,bundleSha256:sha256(bundle.outputFiles[0].contents),targets});
}
await fs.mkdir('artifacts/street-appearance/budget-study',{recursive:true});
await fs.writeFile('artifacts/street-appearance/budget-study/audit.json',JSON.stringify({schemaVersion:1,catalogRevision:catalog.revision,catalogSha256:sha256(catalogBytes),facadeExtrasSha256:sha256(sourceBytes),snapshots,limits:'CPU geometry only, actual resident source features and current catalog. Hypothetical in-memory budgets do not alter runtime. Full local stage neighborhood is detailed, not actual near LOD ownership. No GPU cost or architectural acceptance is implied.'},null,2)+'\n');
console.log(JSON.stringify(snapshots.map(s=>({budget:s.budget,targets:s.targets.map(({target,triangles,buildingDistribution,streetWallDistribution})=>({target,triangles,buildingDistribution,streetWallDistribution}))})),null,2));
