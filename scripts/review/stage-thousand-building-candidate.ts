/** Stage a cached-photo expansion batch as an immutable preview candidate.
 * The wrapper never requests analysis or activates the current release. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {prepareThousandInventoryTargets} from './thousand-building-inventory-targets.ts';
import {prepareThousandBuildingRecords} from './thousand-building-materialize.ts';
import {prepareSupplementalGeometry} from './prepare-supplemental-geometry.ts';
import {buildNeighbourhoodCandidate} from './build-neighbourhood-candidate.ts';
import {compileFacadePatches,facadeRecipeRecords} from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';

const ROOT=path.resolve('.');
const INVENTORIES=['scripts/review/thousand-building-sources.json','scripts/review/thousand-building-sources-supplemental.json'];
const ANALYSES='.cache/city-appearance/fidelity-extraction/analysis-results.json';
const HELDOUT='scripts/city-appearance/fidelity/heldout-source-inspection.json';
const REPORT='scripts/review/thousand-building-candidate-report.json';
const digest=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const parse=(bytes:Buffer)=>JSON.parse(bytes.toString());
const tileOwners=async(release:any)=>{const owners:any[]=[];for(const tile of release.tiles??[]){const bytes=await fs.readFile(path.join('public',String(tile.url).replace(/^\//,'')));let payload:any;try{const {gunzipSync}=await import('node:zlib');payload=parse(gunzipSync(bytes));}catch{payload=parse(bytes);}owners.push(...(payload.owners??[]));}return owners;};
const ownerGeometryHashes=async(release:any,buildingIds:Set<string>)=>Object.fromEntries((await tileOwners(release)).filter(owner=>buildingIds.has(owner.id)).map(owner=>[owner.id,digest(JSON.stringify(owner.geometry))]).sort(([a],[b])=>a.localeCompare(b)));
const compiledObservedCoverage=async(release:any,candidateIds:Set<string>)=>{const owners=await tileOwners(release),observedIds=new Set<string>(),buildings=new Set<string>(),records=facadeRecipeRecords(owners).filter((record:any)=>candidateIds.has(record.id));for(const owner of owners){if(!records.length)continue;owner.geometry.building.surfaces.forEach((surface:any,index:number)=>{for(const patch of compileFacadePatches(owner,surface,index,records,owners,{procedural:true,contextual:true,candidateRegistrationPreview:true}))if(patch.triangles.length&&patch.observationId&&candidateIds.has(patch.observationId)&&patch.featureKind.startsWith('observed-')){observedIds.add(`${patch.observationId}:${patch.featureId}`);buildings.add(owner.id);}});}return {renderableObservedFeatureIds:observedIds.size,renderableObservedUniqueBuildings:buildings.size};};
const fileBinding=async(file:string)=>{const bytes=await fs.readFile(file);return {path:file,sha256:digest(bytes)};};
const countBy=(items:any[],key:(item:any)=>string)=>Object.fromEntries([...items.reduce((out,item)=>{const label=key(item);out.set(label,(out.get(label)??0)+1);return out;},new Map<string,number>())].sort(([a],[b])=>a.localeCompare(b)));

export async function prepareThousandBuildingCandidate(){
 const snapshotFiles=[...INVENTORIES,ANALYSES,HELDOUT],snapshotBytes=await Promise.all(snapshotFiles.map(file=>fs.readFile(file)));
 const snapshots=new Map(snapshotFiles.map((file,index)=>[file,snapshotBytes[index]]));
 const inventories=INVENTORIES.map(file=>parse(snapshots.get(file)!)),cache=parse(snapshots.get(ANALYSES)!),heldout=parse(snapshots.get(HELDOUT)!);
 const bindings=snapshotFiles.map(file=>({path:file,sha256:digest(snapshots.get(file)!)}));
 const geometry=await prepareSupplementalGeometry();
 const targetSets=await Promise.all(INVENTORIES.map((inventoryPath,index)=>prepareThousandInventoryTargets({inventoryPath,inventory:inventories[index],scopeAllRecords:true,extraOwners:geometry.importedOwners})));
 const heldoutIds=new Set((heldout.cases??[]).map((entry:any)=>entry.buildingId).filter(Boolean));
 const candidates:any[]=[],rawSources:any[]=[],evidenceFiles=new Map<string,string>(),targetOmissions:any[]=[],duplicateBuildings:any[]=[];
 const byBuilding=new Set<string>();
 for(let index=0;index<targetSets.length;index++){
  const target=targetSets[index];targetOmissions.push(...target.omissions.map(omission=>({...omission,inventory:INVENTORIES[index]})));
  for(const record of target.targetRecords){
   if(heldoutIds.has(record.buildingId)){targetOmissions.push({observationId:record.id,inventory:INVENTORIES[index],reason:'held-out-building-excluded'});continue;}
   if(byBuilding.has(record.buildingId)){duplicateBuildings.push({observationId:record.id,buildingId:record.buildingId,inventory:INVENTORIES[index]});continue;}
   byBuilding.add(record.buildingId);candidates.push(record);
   for(const source of target.candidateSources.filter(source=>source.observationId===record.id)){rawSources.push(source);const sourcePath=target.evidenceFiles.get(source.cropSha256);if(!sourcePath)throw Error(`Missing target evidence path ${source.cropSha256}`);evidenceFiles.set(source.cropSha256,sourcePath);}
  }
 }
 const sourceGroups=new Map<string,any[]>();for(const source of rawSources){const key=`${source.observationId}:${source.tier}`,list=sourceGroups.get(key)??[];list.push(source);sourceGroups.set(key,list);}
 const sources:any[]=[];for(const [key,entries] of [...sourceGroups.entries()].sort(([a],[b])=>a.localeCompare(b))){const identities=new Map(entries.map(source=>[`${source.cropSha256}:${source.captureDate}:${source.width}:${source.height}`,source]));if(identities.size!==1){targetOmissions.push({observationId:key.split(':')[0],reason:'competing-source-tier-identities'});continue;}sources.push(identities.values().next().value);}
 const batchManifest={version:1,manifestId:'combined-cached-expansion-source-batch-v1',records:candidates,requestedTranche:candidates.length};
 const prepared=prepareThousandBuildingRecords(batchManifest,{results:cache.results,targets:{targetRecords:candidates,candidateSources:sources,omissions:targetOmissions,evidenceFiles}});
 const batchBinding={version:1,mode:'cached-native-crop-candidate-only',inputs:bindings,supplementalGeometry:{...geometry.geometryBinding,candidateBlockSha256:geometry.blockSha256},inventoryTargets:{eligibleBuildings:candidates.length,eligibleSourceTiers:sources.length,duplicateBuildings:duplicateBuildings.length,targetOmissionsSha256:digest(JSON.stringify(targetOmissions))},materialization:{candidateManifest:prepared.candidateManifest,attachedSha256:digest(JSON.stringify(prepared.report.attached)),omittedSha256:digest(JSON.stringify(prepared.report.omitted))},heldoutExclusion:{path:HELDOUT,sha256:bindings.find(binding=>binding.path===HELDOUT)?.sha256,excludedBuildingCount:heldoutIds.size}};
 return {prepared,batchBinding,geometry,targetOmissions,duplicateBuildings,sourceInventoryCounts:inventories.map((inventory:any,index)=>({path:INVENTORIES[index],records:inventory.records?.length??0,declaredBuildings:inventory.counts?.selectedBuildings??inventory.counts?.combinedUniqueBuildings??null}))};
}
function coverage(prepared:any,targetOmissions:any[],duplicateBuildings:any[],sourceInventoryCounts:any[],batchBinding:any,compiled:any){
 const attachedBuildings=new Set(prepared.report.attached.map((entry:any)=>prepared.records.find((record:any)=>record.id===entry.observationId)?.buildingId).filter(Boolean));
 return {processing:{inventory:sourceInventoryCounts,eligibleUniqueBuildings:batchBinding.inventoryTargets.eligibleBuildings,eligibleSourceTiers:batchBinding.inventoryTargets.eligibleSourceTiers,targetOmissions:targetOmissions.length,duplicateBuildingsSkipped:duplicateBuildings.length},attachment:{attachedSourceTiers:prepared.report.attached.length,attachedUniqueBuildings:attachedBuildings.size,omittedSourceTiers:prepared.report.omitted.length,omittedByReason:countBy(prepared.report.omitted,(entry:any)=>entry.reason)},rendered:{compiledCandidateRecords:prepared.records.length,compiledUniqueBuildings:new Set(prepared.records.map((record:any)=>record.buildingId)).size,renderableObservedFeatureIds:compiled?.renderableObservedFeatureIds??0,renderableObservedUniqueBuildings:compiled?.renderableObservedUniqueBuildings??0,excludedFromObservedCount:'generic contextual and procedural prior patches',renderedMeaning:'actual shared compiler patches with non-empty geometry from staged owner tiles'}};
}
export async function stageThousandBuildingCandidate({dryRun=false,writeReport=true}:{dryRun?:boolean;writeReport?:boolean}={}){
 const preparedBatch=await prepareThousandBuildingCandidate();
 const currentBefore=await read('public/data/city-expansion/current.json'),candidateBuildingIds=new Set(preparedBatch.prepared.records.map((record:any)=>record.buildingId));
 const geometryBefore=await ownerGeometryHashes(currentBefore,candidateBuildingIds);
 const importedGeometry=Object.fromEntries(preparedBatch.geometry.importedOwners.filter((owner:any)=>candidateBuildingIds.has(owner.id)).map((owner:any)=>[owner.id,digest(JSON.stringify(owner.geometry))]));
 const expectedGeometry=Object.fromEntries(Object.entries({...geometryBefore,...importedGeometry}).sort(([a],[b])=>a.localeCompare(b)));
 const dry=await buildNeighbourhoodCandidate({batchRecords:preparedBatch.prepared.records,batchEvidenceFiles:preparedBatch.prepared.evidenceFiles,batchBinding:preparedBatch.batchBinding,candidateBlockPath:preparedBatch.geometry.blockPath,candidateBlockSha256:preparedBatch.geometry.blockSha256,writeReport:false,dryRun:true});
 let staged= dry;
 if(!dryRun)staged=await buildNeighbourhoodCandidate({batchRecords:preparedBatch.prepared.records,batchEvidenceFiles:preparedBatch.prepared.evidenceFiles,batchBinding:preparedBatch.batchBinding,candidateBlockPath:preparedBatch.geometry.blockPath,candidateBlockSha256:preparedBatch.geometry.blockSha256,writeReport:false,dryRun:false});
 const currentAfter=await read('public/data/city-expansion/current.json');
 const stagedManifest=dryRun?null:await read(`public/data/city-expansion/releases/${staged.manifest.releaseId}/manifest.json`);
 const stagedGeometry=stagedManifest?await ownerGeometryHashes(stagedManifest,candidateBuildingIds):null;
 const geometryUnchanged=stagedGeometry!==null&&JSON.stringify(expectedGeometry)===JSON.stringify(stagedGeometry)&&Object.keys(expectedGeometry).length===candidateBuildingIds.size;
 if(!dryRun&&!geometryUnchanged)throw Error('Staged candidate changed preserved owner geometry');
 const compiled=stagedManifest?await compiledObservedCoverage(stagedManifest,new Set(preparedBatch.prepared.records.map((record:any)=>record.id))):null;
 const report={version:1,createdAt:new Date().toISOString(),mode:dryRun?'dry-run':'staged-preview-only',batchBinding:preparedBatch.batchBinding,coverage:coverage(preparedBatch.prepared,preparedBatch.targetOmissions,preparedBatch.duplicateBuildings,preparedBatch.sourceInventoryCounts,preparedBatch.batchBinding,compiled),dryRunReleaseId:dry.manifest.releaseId,stagedReleaseId:dryRun?null:staged.manifest.releaseId,releaseUnchanged:dry.report.preservedRelease.unchanged&&currentBefore.releaseId===currentAfter.releaseId,sourceGeometry:{preservedOwnerGeometrySha256:digest(JSON.stringify(geometryBefore)),expectedOwnerGeometrySha256:digest(JSON.stringify(expectedGeometry)),importedOwnerGeometrySha256:digest(JSON.stringify(importedGeometry)),importedCandidateOwners:Object.keys(importedGeometry).length,totalImportedOwners:preparedBatch.geometry.importedOwners.length,stagedOwnerGeometrySha256:stagedGeometry?digest(JSON.stringify(stagedGeometry)):null,verifiedCandidateOwners:Object.keys(expectedGeometry).length,expectedCandidateOwners:candidateBuildingIds.size,unchangedInStagedRelease:geometryUnchanged},inputSnapshots:preparedBatch.batchBinding.inputs,metricRegistrationAccepted:0,photographicAcceptance:'pending',publication:{stagedOnly:!dryRun,activated:false},omissions:{target:preparedBatch.targetOmissions,attachment:preparedBatch.prepared.report.omitted}};
 if(writeReport)await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
 return {report,dry,staged,prepared:preparedBatch.prepared};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)stageThousandBuildingCandidate({dryRun:process.argv.includes('--dry-run')}).then(result=>console.log(JSON.stringify({mode:result.report.mode,dryRunReleaseId:result.report.dryRunReleaseId,stagedReleaseId:result.report.stagedReleaseId,coverage:result.report.coverage},null,2))).catch(error=>{console.error(error);process.exitCode=1;});
