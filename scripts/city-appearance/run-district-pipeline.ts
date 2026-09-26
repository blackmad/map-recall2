/** Resumable public-geometry coordinator. The area runner it invokes stays offline. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { loadDistrictConfig } from './district-config.mjs';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { planAreaPipeline, executeAreaPipeline } from './run-area-pipeline.js';
import { completeRun } from './publish-area-geometry-demo.js';
import { planRoutingInputs } from './prepare-routing-inputs.mjs';
import { globalBudget } from '../da-costa-block/global-budget.mjs';
import { atomicJson } from '../da-costa-block/pipeline-state.mjs';
import { sha256 } from './compile-block-tiles.js';

const exec = promisify(execFile);
const stages = ['acquisition', 'geometry', 'evidence', 'inference', 'compilation', 'validation', 'local-publication'] as const;
type Stage = typeof stages[number];
const flag = (args:string[], name:string) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const stageList = (args:string[]):Stage[] => {
  const values = (flag(args, 'stages') ?? stages.join(',')).split(',').filter(Boolean) as Stage[];
  if (!values.length || values.some(stage => !stages.includes(stage))) throw Error(`Unknown district stage; choose from ${stages.join(', ')}`);
  return [...new Set(values)];
};
async function sourceState(area:any) {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(area.cacheRoot, 'acquisition.json'), 'utf8'));
    for (const name of ['bag.json', 'panoramas.json', '3dbag.json']) await fs.access(path.join(area.cacheRoot, name));
    if (manifest.areaConfigHash !== area.configHash || manifest.errors?.length) return { ready:false, reason:'stale-or-incomplete-acquisition-manifest' };
    return { ready:true, manifest };
  } catch (error:any) { return { ready:false, reason:error?.code === 'ENOENT' ? 'missing-public-geometry-cache' : String(error?.message ?? error) }; }
}
const bounds = (areas:any[]) => [Math.min(...areas.map(a=>a.area.bbox[0])), Math.min(...areas.map(a=>a.area.bbox[1])), Math.max(...areas.map(a=>a.area.bbox[2])), Math.max(...areas.map(a=>a.area.bbox[3]))];
const reportFile = (plan:any) => path.resolve('.cache/city-appearance/districts', plan.district.id, `${plan.district.configHash}.report.json`);

export async function planDistrictPipeline(args=process.argv.slice(2)) {
  const configFile = flag(args, 'district-config') ?? 'scripts/city-appearance/districts/da-costa-jordaan-v1.json';
  const district = await loadDistrictConfig(configFile), selected = stageList(args), areaEntries = [...district.areas].sort((a,b)=>a.priority-b.priority);
  const areas = await Promise.all(areaEntries.map(async entry => {
    const source = await sourceState({ ...entry.area, configHash: entry.configHash });
    return { id:entry.id, district:entry.district, priority:entry.priority, config:entry.config, cacheRoot:entry.area.cacheRoot, areaConfigHash:entry.configHash,
      status:source.ready?'ready':'awaiting-acquisition', acquisition:source.ready?{status:'reused',bytes:0,manifestHash:sha256(JSON.stringify(source.manifest))}:{status:'needed',bytes:0,reason:source.reason}, error:source.ready?null:source.reason };
  }));
  const spend = Number(flag(args, 'spend-limit-usd') ?? district.spendLimitUsd);
  if (!Number.isFinite(spend) || spend < 0 || spend > district.spendLimitUsd) throw Error(`Spend limit must be 0–${district.spendLimitUsd}`);
  return { version:2, mode:'plan', configFile:path.resolve(configFile), stages:selected,
    district:{id:district.id,name:district.name,configHash:district.configHash,boundaryHash:sha256(JSON.stringify(district.boundary)),boundary:district.boundary,boundarySource:district.boundarySource,coordinateFrame:'WGS84 longitude,latitude; compiled coordinates use RD New',budgets:district.budgets,spendLimitUsd:spend},
    combinedArea:{id:`${district.id}-operational-union`,bounds:bounds(areaEntries),members:areaEntries.map(a=>({areaId:a.id,district:a.district,configHash:a.configHash})),ownership:'Publisher assigns each stable BAG/context source ID once, to the first configured member that contains it.'},
    route:district.route?{file:district.route.file,sha256:district.route.sha256,targetEligibleFrontageCoverage:district.route.value.targetEligibleFrontageCoverage??null}:null,
    areas, downloads:0, paidCalls:0, inference:{allowed:selected.includes('inference')&&spend>0,reason:'Explicit selected inference uses the cumulative journal and additional authorization; plan sends no requests.'} };
}
async function acquire(entry:any) {
  const area={ ...entry.area, configHash: entry.areaConfigHash };
  const before=await sourceState(area); if(before.ready)return {status:'reused',bytes:0,manifestHash:sha256(JSON.stringify(before.manifest))};
  await exec(process.execPath,['scripts/da-costa-block/acquire.mjs',`--area-config=${entry.config}`,'--inventory-only'],{cwd:process.cwd(),maxBuffer:64*1024*1024});
  const after=await sourceState(area); if(!after.ready)throw Error(`Acquisition incomplete: ${after.reason}`);
  return {status:'acquired',bytes:(after.manifest.sources??[]).reduce((n:number,s:any)=>n+(Number(s.bytes)||0),0),manifestHash:sha256(JSON.stringify(after.manifest))};
}
function areaReport(entry:any) {
  const tiles=entry.result?.tiles?.output??{},context=entry.result?.['context-tiles']?.output??{};
  return {id:entry.id,district:entry.district,owner:entry.id,status:entry.status,error:entry.error??null,acquisition:entry.acquisition,buildings:tiles.buildings??0,observations:tiles.observations??0,frontageMetres:null,usableImagery:null,renderedFields:null,unknownFields:null,rejectedBindings:null,buildingTileBytes:tiles.totalGzipBytes??0,contextTileBytes:context.totalGzipBytes??0,downloads:entry.acquisition?.bytes??0,paidCalls:0,artifactDependencies:entry.result?Object.fromEntries(Object.entries(entry.result).map(([key,value]:any)=>[key,value.outputKey])):{}};
}
export async function executeDistrictPipeline(plan:any) {
  const selected=new Set(plan.stages as Stage[]), config=await loadDistrictConfig(plan.configFile), done:any[]=[];
  if(config.configHash!==plan.district.configHash)throw Error('District configuration changed since planning');
  const ledger=globalBudget(),before=await ledger.snapshot(),authorizationFile='.cache/city-appearance/district-route-authorization.json';
  if(selected.has('inference')&&plan.district.spendLimitUsd>0){try{await fs.access(authorizationFile);}catch(error:any){if(error.code!=='ENOENT')throw error;await fs.writeFile(authorizationFile,JSON.stringify({version:1,baselineUsd:before.observedOrReservedCostUsd,additionalLimitUsd:Math.min(1,plan.district.spendLimitUsd),cumulativeLimitUsd:5}),{flag:'wx'});}}
  const stageFile=reportFile(plan).replace('.report.json','.stages.json');let stageState:any={version:1,jobs:{}};try{stageState=JSON.parse(await fs.readFile(stageFile,'utf8'));}catch(error:any){if(error.code!=='ENOENT')throw error;}
  async function stage(entry:any,name:string,commands:any[],artifacts:()=>Promise<string[]>,dependencies:string[]=[]){
    const key=`${entry.id}:${name}`,inputKey=sha256(JSON.stringify({configHash:config.configHash,areaConfigHash:entry.areaConfigHash,runHash:entry.runHash,name,commands,dependencies:await Promise.all(dependencies.map(async file=>({file,sha256:sha256(await fs.readFile(file))}))),code:await Promise.all(commands.map(async (c:any[])=>sha256(await fs.readFile(c[0]))))}));
    const previous=stageState.jobs[key];if(previous?.inputKey===inputKey&&previous.status==='complete'){let valid=true;for(const artifact of previous.artifacts){try{if(sha256(await fs.readFile(artifact.path))!==artifact.sha256)valid=false;}catch{valid=false;}}if(valid)return previous;}
    const job:any={inputKey,status:'running',startedAt:new Date().toISOString()};stageState.jobs[key]=job;await atomicJson(stageFile,stageState);
    try{for(const [script,args]of commands)await runScript(script,args);job.artifacts=await Promise.all((await artifacts()).map(async file=>({path:file,sha256:sha256(await fs.readFile(file))})));job.status='complete';job.completedAt=new Date().toISOString();await atomicJson(stageFile,stageState);return job;}catch(error:any){job.status='failed';job.error=String(error.message);await atomicJson(stageFile,stageState);throw error;}
  }

  const routeStreets=(config.route?.value?.streets??[]).join(',');
  const runScript=async(script:string,args:string[])=>exec(process.execPath,['--import','tsx',script,...args],{cwd:process.cwd(),maxBuffer:64*1024*1024});
  for (const requested of plan.areas) {
    const entry={...requested,area:config.areas.find((candidate:any)=>candidate.id===requested.id)?.area};
    try {
      if(entry.acquisition.status==='needed') { if(!selected.has('acquisition')) { done.push(entry); continue; } entry.acquisition=await acquire(entry); entry.status='ready'; }
      if(['geometry','compilation','validation'].some(stage=>selected.has(stage as Stage))){const areaPlan=await planAreaPipeline([`--area-config=${entry.config}`]);entry.result=await executeAreaPipeline(areaPlan);entry.runHash=areaPlan.runHash;}
      else if(['evidence','inference','local-publication'].some(stage=>selected.has(stage as Stage))){const prior=await completeRun(entry.id);entry.result=prior.state.jobs;entry.runHash=prior.name;}
      else {done.push({...entry,status:'ready'});continue;}entry.status='complete';
      const common=[`--area-config=${entry.config}`,'--mode=coverage',`--streets=${routeStreets}`,'--cap=1000','--include-baseline'];
      const evidenceArtifacts=async()=>{const inputs=await planRoutingInputs(common),manifestFile=path.join(inputs.outputRoot,'manifest.json'),manifest=JSON.parse(await fs.readFile(manifestFile,'utf8')),sourceFile=path.join(inputs.selected.destination,'evidence/manifest.json'),source=JSON.parse(await fs.readFile(sourceFile,'utf8'));
        const images=manifest.items.flatMap((item:any)=>Object.values(item.images).map((image:any)=>path.join(inputs.outputRoot,'images',image.file))),sourceImages=source.records.flatMap((item:any)=>Object.values(item.images??{}).map((image:any)=>path.join(inputs.selected.destination,'evidence/images',image.file)));
        return[path.join(inputs.selected.destination,'selection.json'),sourceFile,path.join(inputs.selected.destination,'automated-preflight.json'),manifestFile,...new Set([...images,...sourceImages]) as Set<string>];};
      if (selected.has('evidence')) {
        await stage(entry,'evidence',[['scripts/city-appearance/materialize-panorama-audit.mjs',[...common,'--run']],['scripts/city-appearance/record-panorama-source-audit.mjs',[...common,'--automated']],['scripts/city-appearance/prepare-routing-inputs.mjs',[...common,'--run']]],evidenceArtifacts);
      }
      if (selected.has('inference')&&plan.district.spendLimitUsd>0)await stage(entry,'inference',[['scripts/city-appearance/infer-route-batches.mjs',[...common,'--batch-size=25','--reuse-cache',`--budget-usd=${Math.min(plan.district.spendLimitUsd,1)}`,`--authorization-file=${authorizationFile}`,'--run']]],async()=>{const inputs=await planRoutingInputs(common);const files=['machine-routing/results.json','reused-frontage-ids.json'].map(file=>path.join(inputs.outputRoot,file));return(await Promise.all(files.map(async file=>{try{await fs.access(file);return file;}catch{return null;}}))).filter(Boolean) as string[];},[...await evidenceArtifacts(),'scripts/city-appearance/infer-routing-inputs.mjs',authorizationFile]);
      done.push(entry);
    } catch(error:any) { done.push({...entry,status:'failed',error:String(error?.message??error)}); }
  }
  const areas=done.map(areaReport), total=areas.reduce((all:any,row:any)=>({buildings:all.buildings+row.buildings,observations:all.observations+row.observations,buildingTileBytes:all.buildingTileBytes+row.buildingTileBytes,contextTileBytes:all.contextTileBytes+row.contextTileBytes,publicGeometryBytes:all.publicGeometryBytes+row.downloads}),{buildings:0,observations:0,buildingTileBytes:0,contextTileBytes:0,publicGeometryBytes:0});
  let publication='local-publication-not-requested';
  if(selected.has('local-publication')&&!done.some(e=>e.status==='failed'||e.status==='awaiting-acquisition')) { await runScript('scripts/city-appearance/publish-district-demo.ts',[`--district-config=${plan.configFile}`]);await runScript('scripts/city-appearance/build-district-evaluation-report.ts',[`--district-config=${plan.configFile}`]);await runScript('scripts/city-appearance/publish-district-evaluation.mjs',[]); publication='published-by-district-publisher'; }
  const after=await ledger.snapshot();
  const report={version:2,generatedAt:new Date().toISOString(),district:plan.district,combinedArea:plan.combinedArea,route:plan.route,stages:plan.stages,areas,coverage:{...total,byDistrict:Object.fromEntries([...new Set(areas.map(a=>a.district))].map(district=>[district,areas.filter(area=>area.district===district)]))},unknowns:areas.filter(a=>a.status!=='complete').map(a=>({areaId:a.id,district:a.district,reason:a.error??a.acquisition?.reason??a.status})),evidence:{byteAndCropPreflight:'not-counted-as-visually-checked',visuallyCheckedIdentity:null,rejectedBindings:null,unknownFields:null,coverageReportCommand:'npm run report:district-evaluation'},stageDisposition:{inference:selected.has('inference')&&plan.district.spendLimitUsd>0?'executed-through-authorized-routing-runner':'not-requested-or-zero-budget',localPublication:publication},cost:{publicGeometryUsd:0,observedUsd:after.observedOrReservedCostUsd,reservedUsd:after.entries.filter(e=>e.status!=='settled').reduce((n,e)=>n+e.reservedUsd,0),limitUsd:plan.district.spendLimitUsd,paidCalls:after.entries.length-before.entries.length},publication};
  const output=reportFile(plan);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2));if(done.some(e=>e.status==='failed'||e.status==='awaiting-acquisition'))throw Error(`District stages failed; see ${output}`);return {...plan,mode:'run',areas:done,coverage:total,reportPath:output,publication:report.publication};
}
async function main(){const args=process.argv.slice(2),plan=await planDistrictPipeline(args);console.log(JSON.stringify((args.includes('--run')||args.includes('--resume'))?await executeDistrictPipeline(plan):plan,null,2));}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});
