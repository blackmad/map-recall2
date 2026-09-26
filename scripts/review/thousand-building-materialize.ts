/**
 * Deterministic staging materializer for a large cached-photo batch.
 *
 * This creates in-memory candidate records only. It never writes a release,
 * current pointer, geometry, or a registered transform. Native crop planes are
 * carried as explicitly ambiguous preview bindings for the shared compiler.
 */
import {createHash} from 'node:crypto';

type Tier='full'|'ground';
type CandidateSource={
 observationId:string; buildingId:string; geometryRevision:string; evidenceKey:string;
 frontage:[number[],number[]]; surfaceIndex:number; tier:Tier;
 cropSha256:string; captureDate:string; width:number; height:number; path?:string;
 imageToWall:number[]; wallDirection:[number,number]; cropMarginsPx?:{left:number;top:number;right:number;bottom:number};
 analysisKey?:string; abstention?:string;
};
type CachedAnalysis={key:string;status:string;source:{cropSha256:string;width:number;height:number};proposal?:{openingsComplete:boolean;features:any[]}};
const clone=<T>(value:T):T=>structuredClone(value);
const equal=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validHash=(value:any)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const validDate=(value:any)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const finiteVector=(value:any,length:number)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
const protectedFeature=(feature:any)=>feature?.disposition==='human-reviewed'||feature?.disposition==='revoked';
const imageDate=(image:any)=>image?.date??image?.captureDate??image?.capturedAt;
function validProposal(proposal:any,width:number,height:number){
 if(!proposal||typeof proposal.openingsComplete!=='boolean'||!Array.isArray(proposal.features)||new Set(proposal.features.map((f:any)=>f?.id)).size!==proposal.features.length)return false;
 return proposal.features.every((feature:any)=>typeof feature?.id==='string'&&feature.id.length>0&&['door','window','material','awning','fascia'].includes(feature.kind)&&finiteVector(feature.bounds,4)&&feature.bounds[0]>=0&&feature.bounds[1]>=0&&feature.bounds[2]>feature.bounds[0]&&feature.bounds[3]>feature.bounds[1]&&feature.bounds[2]<=width&&feature.bounds[3]<=height);
}
function nativePreview(source:CandidateSource){
 if(!finiteVector(source.imageToWall,9)||!finiteVector(source.wallDirection,2)||Math.hypot(...source.wallDirection)<.999||!Number.isInteger(source.surfaceIndex))return null;
 const margins=source.cropMarginsPx??{left:0,top:0,right:0,bottom:0};
 if(!['left','top','right','bottom'].every(key=>Number.isFinite((margins as any)[key])&&(margins as any)[key]>=0))return null;
 return {status:'ambiguous' as const,uncertaintyM:999,imageToWall:[...source.imageToWall],surfaceIndex:source.surfaceIndex,wallDirection:[...source.wallDirection] as [number,number],sourceDatum:'NAP' as const,canonicalDatum:'surface-base' as const,pixelConvention:'pixel-edge' as const,cropMarginsPx:{...margins},abstention:source.abstention??'metric-registration-unresolved',preview:{kind:'native-crop-plane',cropSha256:source.cropSha256,imageDimensions:{width:source.width,height:source.height},imageToWall:[...source.imageToWall],note:'Cached native crop transform for candidate inspection only; metric registration remains unresolved.'}};
}
function mergeFeatures(existing:any[],proposal:any[],tier:Tier){
 const protectedById=new Map(existing.filter(protectedFeature).map(feature=>[feature.id,clone(feature)]));
 const generated=proposal.filter(feature=>!protectedById.has(`${tier}:${feature.id}`)).map(feature=>({...clone(feature),id:`${tier}:${feature.id}`,disposition:'machine-observed-unreviewed'}));
 return [...protectedById.values(),...generated].sort((a,b)=>a.id.localeCompare(b.id));
}
function sourceBindingMatches(record:any,source:CandidateSource){
 return record&&(record.id===source.observationId||record.observationId===source.observationId)
  &&record.buildingId===source.buildingId&&record.geometryRevision===source.geometryRevision&&record.evidenceKey===source.evidenceKey
  &&equal([record.localStart,record.localEnd],source.frontage)
  &&(record.renderBuildingId??record.buildingId)===source.buildingId
  &&Array.isArray(record.renderSurfaceIndices)&&record.renderSurfaceIndices.includes(source.surfaceIndex);
}
export type ThousandBuildingMaterializeInput={records:any[];sources:CandidateSource[];analyses:CachedAnalysis[];extractionVersion?:string};
/** Materialize a candidate-only batch. Omitted entries are explicit and stable. */
export function materializeThousandBuildingCandidates({records,sources,analyses,extractionVersion='facade-description-v2'}:ThousandBuildingMaterializeInput){
 if(!Array.isArray(records)||!Array.isArray(sources)||!Array.isArray(analyses))throw Error('Candidate materializer requires records, sources and analyses arrays');
 const output=clone(records),byObservation=new Map(output.map(record=>[record.id,record]));
 const complete=analyses.filter(analysis=>analysis?.status==='complete'&&validHash(analysis.source?.cropSha256)&&Number.isInteger(analysis.source?.width)&&Number.isInteger(analysis.source?.height));
 const report:{version:number;stage:string;attached:any[];omitted:any[];candidateRecordCount:number;releaseMutation:false}={version:1,stage:'cached-native-crop-candidate',attached:[],omitted:[],candidateRecordCount:0,releaseMutation:false};
 const ordered=clone(sources).sort((a,b)=>`${a.observationId}:${a.tier}:${a.captureDate}:${a.cropSha256}`.localeCompare(`${b.observationId}:${b.tier}:${b.captureDate}:${b.cropSha256}`));
 const grouped=new Map<string,CandidateSource[]>();for(const source of ordered){const key=`${source.observationId}:${source.tier}`,list=grouped.get(key)??[];list.push(source);grouped.set(key,list);}
 for(const [key,group] of [...grouped.entries()].sort(([a],[b])=>a.localeCompare(b))){
  if(group.length!==1){report.omitted.push({key,reason:'competing-candidate-captures'});continue;}
  const source=group[0],record=byObservation.get(source.observationId);
  if(!validHash(source.cropSha256)||!validDate(source.captureDate)||!Number.isInteger(source.width)||!Number.isInteger(source.height)||source.width<=0||source.height<=0){report.omitted.push({key,reason:'invalid-source-identity'});continue;}
  if(!sourceBindingMatches(record,source)){report.omitted.push({key,reason:'stale-observation-binding'});continue;}
  if(record.machineRevocation?.revoked){report.omitted.push({key,reason:'observation-revoked'});continue;}
  const registration=nativePreview(source);if(!registration){report.omitted.push({key,reason:'invalid-native-candidate-transform'});continue;}
  const matches=complete.filter(analysis=>analysis.source.cropSha256===source.cropSha256&&analysis.source.width===source.width&&analysis.source.height===source.height&&(source.analysisKey?analysis.key===source.analysisKey:true));
  if(matches.length!==1||!validProposal(matches[0].proposal,source.width,source.height)){report.omitted.push({key,reason:matches.length?'invalid-cached-analysis':'cached-analysis-missing-or-ambiguous'});continue;}
  const description=record.facadeDescription?clone(record.facadeDescription):{version:1,extractionVersion,buildingId:source.buildingId,geometryRevision:source.geometryRevision,evidenceKey:source.evidenceKey,frontage:clone(source.frontage),surfaceIndices:[...record.renderSurfaceIndices],sources:{}};
  if(description.buildingId!==source.buildingId||description.geometryRevision!==source.geometryRevision||description.evidenceKey!==source.evidenceKey||!equal(description.frontage,source.frontage)){report.omitted.push({key,reason:'existing-description-has-different-binding'});continue;}
  const image=record.images?.[source.tier];
  if(image&&(image.sha256!==source.cropSha256||imageDate(image)!==source.captureDate||(Number.isFinite(image.width)&&image.width!==source.width)||(Number.isFinite(image.height)&&image.height!==source.height))){report.omitted.push({key,reason:'existing-image-is-another-capture'});continue;}
  const existing=description.sources?.[source.tier];
  if(existing&&(existing.cropSha256!==source.cropSha256||existing.captureDate!==source.captureDate)){report.omitted.push({key,reason:'existing-description-source-is-another-capture'});continue;}
  description.extractionVersion=extractionVersion;description.sources??={};description.sources[source.tier]={cropSha256:source.cropSha256,captureDate:source.captureDate,imageDimensions:{width:source.width,height:source.height},registration,openingsComplete:matches[0].proposal!.openingsComplete,features:mergeFeatures(existing?.features??[],matches[0].proposal!.features,source.tier)};
  record.facadeDescription=description;record.images??={};if(!image)record.images[source.tier]={sha256:source.cropSha256,date:source.captureDate,width:source.width,height:source.height,...(source.path?{path:source.path}:{})};
  record.appearancePublication='candidate-registration-preview';record.candidateRegistrationPreview=true;
  report.attached.push({observationId:source.observationId,tier:source.tier,analysisKey:matches[0].key,cropSha256:source.cropSha256,captureDate:source.captureDate,registration:'ambiguous'});
 }
 report.attached.sort((a,b)=>`${a.observationId}:${a.tier}`.localeCompare(`${b.observationId}:${b.tier}`));report.omitted.sort((a,b)=>`${a.key}:${a.reason}`.localeCompare(`${b.key}:${b.reason}`));report.candidateRecordCount=output.filter(record=>record.candidateRegistrationPreview===true).length;
 const candidateManifest={version:1,stage:'candidate-only',activated:false,releaseMutation:false,recordsSha256:hash(output),attachedSha256:hash(report.attached),omittedSha256:hash(report.omitted),sourceCount:sources.length,attachedCount:report.attached.length};
 return {records:output,report,candidateManifest};
}

type NativeRegistration={observationId:string;tier:Tier;cropSha256:string;captureDate:string;imageDimensions:{width:number;height:number};status:'ambiguous';surfaceIndex:number;wallDirection:[number,number];imageToWall?:number[];cropMarginsPx?:CandidateSource['cropMarginsPx'];preview?:{kind:string;cropSha256:string;imageDimensions:{width:number;height:number};imageToWall:number[]};abstention?:string};
/**
 * Join the raw cached-source inventory to the actual target observations only
 * after a registration preparer supplies a native candidate transform. The
 * inventory's `wall.index` is deliberately never treated as a render surface.
 */
export function prepareInventoryCandidateSources(inventory:any,observations:any[],registrations:NativeRegistration[]){
 if(!Array.isArray(inventory?.records)||!Array.isArray(observations)||!Array.isArray(registrations))throw Error('Inventory preparation requires records, observations and registrations arrays');
 const byObservation=new Map(observations.map(record=>[record.id,record]));
 const byRegistration=new Map(registrations.map(registration=>[`${registration.observationId}:${registration.tier}`,registration]));
 const sources:CandidateSource[]=[],omitted:any[]=[];
 for(const item of inventory.records.slice().sort((a:any,b:any)=>String(a.observationId).localeCompare(String(b.observationId)))){
  const record=byObservation.get(item.observationId);
  for(const tier of ['full','ground'] as Tier[]){
   const raw=item.sources?.[tier]??item.tiers?.[tier],registration=byRegistration.get(`${item.observationId}:${tier}`);
   const key=`${item.observationId}:${tier}`;
   if(!raw){omitted.push({key,reason:'inventory-tier-missing'});continue;}
   if(!record||record.machineRevocation?.revoked){omitted.push({key,reason:record?'observation-revoked':'target-observation-not-found'});continue;}
   if(!registration||registration.status!=='ambiguous'||registration.cropSha256!==raw.sha256||registration.captureDate!==raw.captureDate||registration.imageDimensions?.width!==raw.width||registration.imageDimensions?.height!==raw.height){omitted.push({key,reason:'native-registration-missing-or-stale'});continue;}
   const transform=registration.preview?.kind==='native-crop-plane'?registration.preview.imageToWall:registration.imageToWall;
   if(!finiteVector(transform,9)||!Array.isArray(record.renderSurfaceIndices)||!record.renderSurfaceIndices.includes(registration.surfaceIndex)){omitted.push({key,reason:'native-registration-surface-unverified'});continue;}
   if(!record.geometryRevision||!record.evidenceKey||!finiteVector(record.localStart,2)||!finiteVector(record.localEnd,2)){omitted.push({key,reason:'target-observation-binding-incomplete'});continue;}
   sources.push({observationId:item.observationId,buildingId:record.buildingId,geometryRevision:record.geometryRevision,evidenceKey:record.evidenceKey,frontage:[record.localStart,record.localEnd],surfaceIndex:registration.surfaceIndex,tier,cropSha256:raw.sha256,captureDate:raw.captureDate,width:raw.width,height:raw.height,path:raw.path,imageToWall:[...transform],wallDirection:registration.wallDirection,cropMarginsPx:registration.cropMarginsPx,abstention:registration.abstention});
  }
 }
 return {sources:sources.sort((a,b)=>`${a.observationId}:${a.tier}`.localeCompare(`${b.observationId}:${b.tier}`)),omitted:omitted.sort((a,b)=>a.key.localeCompare(b.key))};
}

type ThousandAnalysisInput={records?:any[];observations?:any[];results?:CachedAnalysis[];analyses?:CachedAnalysis[];registrations?:NativeRegistration[]};
/**
 * Convert a source-inventory manifest plus cached analysis into the exact
 * record/evidence pair accepted by `publishAreaGeometryDemo({records,
 * evidenceFiles, stageOnly:true})`. `analysis.records` must be target-owner
 * observations from the compiled area; raw source wall coordinates are never
 * projected into that frame here.
 */
export function prepareThousandBuildingRecords(manifest:any,analysis:ThousandAnalysisInput&{targets?:{targetRecords:any[];candidateSources:CandidateSource[];omissions:any[];evidenceFiles:Map<string,string>}}){
 if(manifest?.version!==1||!Array.isArray(manifest.records))throw Error('Invalid thousand-building source manifest');
 const results=analysis?.results??analysis?.analyses;
 if(!Array.isArray(results))throw Error('Thousand-building preparation requires cached results');
 const records=analysis.targets?.targetRecords??analysis?.records??analysis?.observations;
 let normalized:{sources:CandidateSource[];omitted:any[]};let sourcePaths:Map<string,string>;
 if(analysis.targets){
  normalized={sources:analysis.targets.candidateSources,omitted:analysis.targets.omissions};sourcePaths=analysis.targets.evidenceFiles;
 }else{
  const registrations=analysis?.registrations;
  if(!Array.isArray(records)||!Array.isArray(registrations))throw Error('Thousand-building preparation requires target records and native registrations');
  const declaredTranche=Array.isArray(manifest.trancheObservationIds)&&manifest.trancheObservationIds.every((value:any)=>typeof value==='string'&&value.length>0);
  const scoped={...manifest,records:declaredTranche?manifest.records.filter((item:any)=>manifest.trancheObservationIds.includes(item.observationId)):manifest.records.slice(0,Number.isInteger(manifest.requestedTranche)?manifest.requestedTranche:manifest.records.length)};
  normalized=prepareInventoryCandidateSources(scoped,records,registrations);sourcePaths=new Map(normalized.sources.flatMap(source=>source.path?[[source.cropSha256,source.path] as [string,string]]:[]));
 }
 if(!Array.isArray(records))throw Error('Thousand-building preparation has no target records');
 const materialized=materializeThousandBuildingCandidates({records,sources:normalized.sources,analyses:results});
 const attachedIds=new Set(materialized.report.attached.map(entry=>entry.observationId));
 const candidateRecords=materialized.records.filter(record=>attachedIds.has(record.id)&&record.candidateRegistrationPreview===true);
 const pathByHash=new Map<string,string>();
 for(const source of normalized.sources){if(!attachedIds.has(source.observationId))continue;const sourcePath=sourcePaths.get(source.cropSha256)??source.path;if(!sourcePath)throw Error(`Attached source ${source.cropSha256} lacks cached path`);const previous=pathByHash.get(source.cropSha256);if(previous&&previous!==sourcePath)throw Error(`Conflicting cached paths for ${source.cropSha256}`);pathByHash.set(source.cropSha256,sourcePath);}
 const report={...materialized.report,inventoryOmissions:normalized.omitted,inventoryManifestId:manifest.manifestId??null,requestedBuildings:manifest.requestedTranche??manifest.records.length,candidateRecords:candidateRecords.length};
 return {records:candidateRecords,evidenceFiles:pathByHash,report,candidateManifest:{...materialized.candidateManifest,inventoryManifestId:manifest.manifestId??null,inventoryOmissionsSha256:hash(normalized.omitted),stageOnly:true}};
}
