/** Immutable compact routing inputs from visually usable, source-bound crops.
 * Default is a read-only plan. --run writes hash-addressed local artifacts only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';
import { DEFAULT_AREA, selectPanoramaAudit } from './select-panorama-audit.mjs';
import { loadAreaConfig } from '../da-costa-block/area-config.mjs';
import { atomicJson, digest } from '../da-costa-block/pipeline-state.mjs';
import { globalBudget } from '../da-costa-block/global-budget.mjs';

const PREPROCESSING='fit-inside-512-jpeg85-no-upscale/v1', COST_CEILING=0.04;
const flag=(name,args)=>args.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const readJson=async file=>JSON.parse(await fs.readFile(file,'utf8'));

export async function planRoutingInputs(args=process.argv.slice(2)){
  const areaFile=path.resolve(flag('area-config',args)??DEFAULT_AREA),area=await loadAreaConfig([`--area-config=${areaFile}`]);
  const selected=await selectPanoramaAudit(area,{cap:Number(flag('cap',args)??24)}),auditPath=path.join(selected.destination,'agent-visual-audit.json');
  const [selectionBytes,auditBytes,manifestBytes]=await Promise.all([fs.readFile(path.join(selected.destination,'selection.json')),fs.readFile(auditPath),fs.readFile(path.join(selected.destination,'evidence/manifest.json'))]);
  const audit=JSON.parse(auditBytes),manifest=JSON.parse(manifestBytes),accepted=new Set(audit.assessments.filter(item=>item.disposition==='usable').map(item=>item.id));
  const records=manifest.records.filter(record=>accepted.has(record.id));
  if(records.length!==audit.summary.usable)throw Error('Usable audit decisions do not match evidence manifest');
  const sourcePins=records.flatMap(record=>['full','ground'].map(kind=>({id:record.id,kind,file:record.images[kind].file,sha256:record.images[kind].sha256})));
  const identity={version:'city-routing-inputs/1',areaId:area.id,areaConfigHash:area.configHash,selectionSha256:digest(selectionBytes),auditSha256:digest(auditBytes),manifestSha256:digest(manifestBytes),preprocessing:PREPROCESSING,sourcePins};
  const inputSetHash=digest(identity),outputRoot=path.join(selected.destination,'routing-inputs',inputSetHash);
  return {area,selected,audit,manifest,records,identity,inputSetHash,outputRoot,paidCalls:0,plannedCostCeilingUsd:COST_CEILING};
}

async function writeImmutable(file,bytes){
  try{const current=await fs.readFile(file);if(!current.equals(bytes))throw Error(`Immutable artifact differs: ${file}`);return;}
  catch(error){if(error.code!=='ENOENT')throw error;}
  await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes,{flag:'wx'});
}

export async function executeRoutingInputs(plan){
  const items=[];
  for(const record of plan.records){
    const images={};for(const kind of ['full','ground']){
      const source=record.images[kind],bytes=await fs.readFile(path.join(plan.selected.destination,'evidence/images',source.file));
      if(digest(bytes)!==source.sha256)throw Error(`Source crop changed: ${source.file}`);
      const compact=await sharp(bytes).resize({width:512,height:512,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
      const name=`${record.id}-${kind}.jpg`;await writeImmutable(path.join(plan.outputRoot,'images',name),compact);
      images[kind]={file:name,sha256:digest(compact),bytes:compact.length,sourceFile:source.file,sourceSha256:source.sha256,panoramaId:source.panoramaId,date:source.date};
    }
    items.push({id:record.id,buildingId:record.buildingId,address:record.address,street:record.street,wallWidthM:record.wallWidthM,images});
  }
  const artifactIdentity={...plan.identity,items},manifest={...artifactIdentity,inputSetHash:plan.inputSetHash,items,
    totals:{frontages:items.length,images:items.length*2,bytes:items.reduce((sum,item)=>sum+item.images.full.bytes+item.images.ground.bytes,0),facadeLengthM:items.reduce((sum,item)=>sum+item.wallWidthM,0)},
    inferenceStatus:'not-run',humanReferenceData:false,paidCalls:0,plannedCostCeilingUsd:plan.plannedCostCeilingUsd,
    warning:'Compact routing inputs only. No proposal, approval, human label or publication is implied.'};
  await atomicJson(path.join(plan.outputRoot,'manifest.json'),manifest);return manifest;
}

async function main(){
  const args=process.argv.slice(2),plan=await planRoutingInputs(args),budget=globalBudget({ceiling:5}),snapshot=await budget.snapshot();
  const budgetPlan={journal:budget.file,currentObservedOrReservedUsd:snapshot.observedOrReservedCostUsd,authorizedUsd:snapshot.ceilingUsd,
    unresolved:snapshot.entries.filter(entry=>entry.status==='unknown').length,plannedRunCeilingUsd:plan.plannedCostCeilingUsd,
    fitsAuthorization:snapshot.observedOrReservedCostUsd+plan.plannedCostCeilingUsd<=snapshot.ceilingUsd};
  if(budgetPlan.unresolved)throw Error('Spend dry-run found unresolved charges');if(!budgetPlan.fitsAuthorization)throw Error('Spend dry-run exceeds cumulative authorization');
  if(!args.includes('--run'))return console.log(JSON.stringify({mode:'dry-run',inputSetHash:plan.inputSetHash,frontages:plan.records.length,images:plan.records.length*2,outputRoot:plan.outputRoot,budgetPlan,paidCalls:0},null,2));
  const manifest=await executeRoutingInputs(plan);console.log(JSON.stringify({mode:'prepared',inputSetHash:plan.inputSetHash,outputRoot:plan.outputRoot,totals:manifest.totals,budgetPlan,paidCalls:0},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{process.stderr.write(`${error.stack??error.message}\n`);process.exitCode=1;});
