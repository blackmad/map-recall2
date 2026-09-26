/** Stage the source-informed development facades inside the full Da Costa/Jordaan release.
 * This is deliberately a reversible preview: ambiguous native crop planes are compiled,
 * but no registration, fidelity, runtime, or release gate is promoted by this script.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {loadDistrictConfig} from '../city-appearance/district-config.mjs';
import {publishAreaGeometryDemo} from '../city-appearance/publish-area-geometry-demo.js';
import {sha256} from '../city-appearance/compile-block-tiles.js';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.js';

const ROOT=path.resolve('.');
const CURRENT='public/data/city-expansion/current.json';
const CASES='public/data/facade-repair-preview/cases.json';
const DISTRICT='scripts/city-appearance/districts/da-costa-jordaan-v1.json';
const REPORT='scripts/review/neighbourhood-candidate.json';
const read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const digestFile=async(file:string)=>sha256(await fs.readFile(file));
const exactDate=(value:any)=>typeof value==='string'&&Number.isFinite(Date.parse(value));

export function prepareCandidateRecords(casesFile:any,baselineRecords:any[]){
  if(casesFile?.version!==1||!Array.isArray(casesFile.cases))throw Error('Invalid facade preview cases');
  const baseline=new Map(baselineRecords.map(record=>[record.id,record]));
  const replacements=new Map<string,any[]>(),omissions:any[]=[];
  for(const item of casesFile.cases){
    if(!/^case-\d{2}$/.test(item.caseId??''))throw Error('Facade preview case lacks stable caseId');
    const observations=Array.isArray(item.candidateObservations)?item.candidateObservations:[];
    if(!observations.length){omissions.push({caseId:item.caseId,address:item.address,reason:item.omissions?.join('; ')||'no-candidate-observation'});continue;}
    for(const candidate of observations){
      const original=baseline.get(candidate.id);
      if(!original)throw Error(`${item.caseId}: source observation ${candidate.id} is absent from the preserved release`);
      if(candidate.machineRevocation?.revoked||original.machineRevocation?.revoked)throw Error(`${item.caseId}: revoked observation cannot enter candidate`);
      if(candidate.buildingId!==original.buildingId||candidate.renderBuildingId!==original.renderBuildingId||candidate.evidenceKey!==original.evidenceKey||candidate.derivationKey!==original.derivationKey)throw Error(`${item.caseId}: observation identity changed`);
      for(const field of ['localStart','localEnd','mid'])if(JSON.stringify(candidate[field])!==JSON.stringify(original[field]))throw Error(`${item.caseId}: observation coordinate frame changed`);
      const description=candidate.facadeDescription,sources=description?.sources??{};
      const tiers=Object.entries(sources);
      if(!tiers.length){omissions.push({caseId:item.caseId,address:item.address,sourceObservationId:candidate.id,reason:'candidate-description-has-no-usable-source-tier'});continue;}
      if(description.buildingId!==candidate.renderBuildingId||description.evidenceKey!==candidate.evidenceKey)throw Error(`${item.caseId}: facade description binding changed`);
      if(!Array.isArray(candidate.renderSurfaceIndices)||candidate.renderSurfaceIndices.length!==1)throw Error(`${item.caseId}: candidate must bind one wall`);
      const surfaceIndex=candidate.renderSurfaceIndices[0];
      for(const [tier,source] of tiers as [string,any][]){
        const image=candidate.images?.[tier];
        if(!image||source.cropSha256!==image.sha256||source.captureDate!==image.date||source.imageDimensions?.width!==image.width||source.imageDimensions?.height!==image.height)throw Error(`${item.caseId}/${tier}: source hash, date, or dimensions changed`);
        if(!exactDate(source.captureDate))throw Error(`${item.caseId}/${tier}: invalid source date`);
        const registration=source.registration;
        if(registration?.status!=='ambiguous'||registration.surfaceIndex!==surfaceIndex||registration.preview?.kind!=='native-crop-plane'||registration.preview?.cropSha256!==source.cropSha256||registration.preview?.imageDimensions?.width!==source.imageDimensions.width||registration.preview?.imageDimensions?.height!==source.imageDimensions.height||!Array.isArray(registration.preview?.imageToWall)||registration.preview.imageToWall.length!==9||!registration.preview.imageToWall.every(Number.isFinite))throw Error(`${item.caseId}/${tier}: invalid native-plane preview binding`);
      }
      const list=replacements.get(candidate.id)??[];list.push({...candidate,facadeDescription:structuredClone(description),sourceObservationId:candidate.id,developmentCaseId:item.caseId,appearancePublication:'candidate-registration-preview'});replacements.set(candidate.id,list);
    }
  }
  const records=[] as any[];
  for(const record of baselineRecords){const candidates=replacements.get(record.id);if(!candidates){records.push(record);continue;}candidates.sort((a,b)=>a.renderSurfaceIndices[0]-b.renderSurfaceIndices[0]);candidates.forEach((candidate,index)=>{if(index){const id=`${candidate.id}:candidate-surface-${candidate.renderSurfaceIndices[0]}`;candidate.id=id;}records.push(candidate);});}
  const candidateRecords=records.filter(record=>record.appearancePublication==='candidate-registration-preview');
  const ids=new Set<string>();for(const record of records){if(ids.has(record.id))throw Error(`Duplicate staged observation ${record.id}`);ids.add(record.id);}
  return {records,candidateRecords,omissions};
}

async function recordsFromRelease(manifest:any){
  const records=new Map<string,any>();
  for(const tile of manifest.tiles){const file=path.join('public',tile.url.replace(/^\//,'')),payload=JSON.parse(gunzipSync(await fs.readFile(file)).toString());for(const owner of payload.owners)for(const observation of owner.observations??[]){const record=observation.payload;if(records.has(record.id)&&JSON.stringify(records.get(record.id))!==JSON.stringify(record))throw Error(`Conflicting preserved observation ${record.id}`);records.set(record.id,record);}}
  return [...records.values()].sort((a,b)=>a.id.localeCompare(b.id));
}

export async function buildNeighbourhoodCandidate(options:{dryRun?:boolean;writeReport?:boolean;batchRecords?:any[];batchEvidenceFiles?:Map<string,string>;batchBinding?:any;candidateBlockPath?:string;candidateBlockSha256?:string}={}){
  const [pointerBytes,casesBytes,ledgerBefore]=await Promise.all([fs.readFile(CURRENT),fs.readFile(CASES),digestFile('.cache/city-appearance/spend.json')]);
  const preserved=JSON.parse(pointerBytes.toString()),casesFile=JSON.parse(casesBytes.toString());
  if(preserved.areaId!=='da-costa-jordaan-v1')throw Error('Preserved release is not the configured district');
  const baselineRecords=await recordsFromRelease(preserved),prepared=prepareCandidateRecords(casesFile,baselineRecords);
  if(options.batchRecords){
    const protectedBuildings=new Set(prepared.candidateRecords.map((r:any)=>r.buildingId));
    const byId=new Map(prepared.records.map((r:any)=>[r.id,r]));
    for(const record of options.batchRecords){
      if(protectedBuildings.has(record.buildingId)||!record.facadeDescription)continue;
      const prior:any=byId.get(record.id);
      if(record.machineRevocation?.revoked||prior?.machineRevocation?.revoked)continue;
      if(prior?.facadeDescription&&Object.values(prior.facadeDescription.sources??{}).some((s:any)=>s.features?.some((f:any)=>['human-reviewed','revoked'].includes(f.disposition))))continue;
      if(record.facadeDescription.buildingId!==record.buildingId||record.facadeDescription.evidenceKey!==record.evidenceKey)throw Error('Batch facade binding changed');
      for(const source of Object.values(record.facadeDescription.sources) as any[])if(source.registration.status!=='ambiguous')throw Error('Batch can stage only explicit ambiguous previews');
      byId.set(record.id,{...record,appearancePublication:'candidate-registration-preview'});
    }
    prepared.records=[...byId.values()].sort((a:any,b:any)=>a.id.localeCompare(b.id));
    prepared.candidateRecords=prepared.records.filter((r:any)=>r.appearancePublication==='candidate-registration-preview');
  }
  const district=await loadDistrictConfig(DISTRICT),blockPath=path.resolve('.cache/city-appearance/districts',district.id,preserved.runHash,'block.json'),block=await read(blockPath);
  if(block.areaConfigHash!==district.configHash)throw Error('Cached district block does not match district config');
  const bbox=[Math.min(...district.areas.map((e:any)=>e.area.bbox[0])),Math.min(...district.areas.map((e:any)=>e.area.bbox[1])),Math.max(...district.areas.map((e:any)=>e.area.bbox[2])),Math.max(...district.areas.map((e:any)=>e.area.bbox[3]))];
  const area={id:district.id,configHash:district.configHash,bbox,origin:rdToLngLat(block.origin)};
  const run={name:preserved.runHash,state:{jobs:Object.fromEntries(Object.entries(preserved.pipeline.jobs).map(([id,job]:any)=>[id,{...job,status:'complete',output:{blockPath}}]))}};
  const evidenceFiles=new Map<string,string>();for(const record of prepared.records)for(const tier of ['full','ground']){const image=record.images?.[tier];if(!image)continue;const file=options.batchEvidenceFiles?.get(image.sha256)??path.resolve('public/data/city-expansion/evidence',`${image.sha256}.jpg`);try{await fs.access(file);evidenceFiles.set(image.sha256,file);}catch{throw Error(`Missing preserved evidence image ${image.sha256}`);}}
  const candidateMeta={version:1,mode:'native-crop-plane-development-preview',sourceCasesSha256:sha256(casesBytes),sourceReleaseId:preserved.releaseId,metricRegistrationAccepted:0,previewOnly:true};
  const manifest=await publishAreaGeometryDemo({area,run,candidateBlockPath:options.candidateBlockPath,candidateBlockSha256:options.candidateBlockSha256,evidenceAreaFile:'scripts/city-appearance/areas/da-costa-tranche-400m-v1.json',district:{...preserved.district,developmentCandidateSourceReleaseId:preserved.releaseId},waypoints:district.route?.value.waypoints,records:()=>prepared.records,evidenceFiles,additionalEvidenceHashes:[...(preserved.additionalEvidenceHashes??[]),{kind:'facade-development-cases',sha256:sha256(casesBytes)},...(options.batchBinding?[{kind:'thousand-building-batch',sha256:sha256(JSON.stringify(options.batchBinding))}]:[])],appearanceCoverage:{preservedObservations:baselineRecords.length,candidatePreviewCases:new Set(prepared.candidateRecords.map(r=>r.developmentCaseId).filter(Boolean)).size,candidatePreviewBuildings:new Set(prepared.candidateRecords.map(r=>r.buildingId)).size,candidatePreviewWallObservations:prepared.candidateRecords.length,candidatePreviewSourceTiers:prepared.candidateRecords.reduce((n,r)=>n+Object.keys(r.facadeDescription.sources).length,0),metricRegisteredFrontages:0},developmentCandidate:true,candidateRegistrationPreview:candidateMeta,stageOnly:true,dryRun:options.dryRun===true});
  const pointerAfter=await fs.readFile(CURRENT),ledgerAfter=await digestFile('.cache/city-appearance/spend.json');
  if(!pointerBytes.equals(pointerAfter))throw Error('Candidate staging changed current release pointer');
  if(!options.batchRecords&&ledgerBefore!==ledgerAfter)throw Error('Candidate staging changed extraction ledger');
  const report={version:1,createdAt:new Date().toISOString(),districtId:district.id,candidateReleaseId:manifest.releaseId,viewerUrl:`/canal-drive/city-appearance.html?area=expansion&release=${manifest.releaseId}`,preservedRelease:{releaseId:preserved.releaseId,pointerSha256:sha256(pointerBytes),unchanged:true},inputs:{cases:{path:CASES,sha256:sha256(casesBytes)},cachedDistrictBlock:{path:path.relative(ROOT,blockPath),sha256:await digestFile(blockPath)},costLedger:{sha256:ledgerAfter,priorSha256:ledgerBefore,changed:ledgerBefore!==ledgerAfter,paidCallsByStager:0,concurrentExtractionAllowed:!!options.batchRecords}},coverage:{geometryBuildings:manifest.buildings,baselineObservations:baselineRecords.length,candidateObservations:manifest.observations,candidatePreviewCases:manifest.appearanceCoverage.candidatePreviewCases,candidatePreviewBuildings:manifest.appearanceCoverage.candidatePreviewBuildings,candidatePreviewWallObservations:manifest.appearanceCoverage.candidatePreviewWallObservations,candidatePreviewSourceTiers:manifest.appearanceCoverage.candidatePreviewSourceTiers,compiledFacadeFeatures:{baseline:{windows:preserved.studyFacades.windows,doors:preserved.studyFacades.doors,signs:preserved.studyFacades.signs},candidate:{windows:manifest.studyFacades.windows,doors:manifest.studyFacades.doors,signs:manifest.studyFacades.signs},delta:{windows:manifest.studyFacades.windows-preserved.studyFacades.windows,doors:manifest.studyFacades.doors-preserved.studyFacades.doors,signs:manifest.studyFacades.signs-preserved.studyFacades.signs}}},evidenceStatus:{geometry:'district-wide cached source geometry',candidateFacades:'source-hash/date/dimension-bound native crop-plane preview',metricRegistrationAccepted:0,photographicFidelity:'not accepted'},omissions:prepared.omissions,blockedGates:['metric registration: 0 accepted','held-out precision/recall not evaluated','photographic visual acceptance not passed','14-camera candidate runtime not completed','original twelve image-numbered examples remain outstanding'],publication:{stagedOnly:true,activated:false,releasePath:`public/data/city-expansion/releases/${manifest.releaseId}/manifest.json`}};
  if(options.writeReport!==false&&!options.dryRun)await fs.writeFile(REPORT,JSON.stringify(report,null,2)+'\n');
  return {manifest,report,prepared};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)buildNeighbourhoodCandidate({dryRun:process.argv.includes('--dry-run')}).then(({report})=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error(error);process.exitCode=1;});
