/** Source-pixel corrections for the unregistered shape-study preview only. */
import {applySourceSilhouette} from './apply-source-silhouette.ts';
import {compileSourceShapePreview} from './source-shape-preview.ts';

export type SourceGeometryInput={cropSha256:string;captureDate:string;width:number;height:number;features:any[]};
export type SourceGeometryCorrection={
 caseId:string;tier:string;source:{sha256:string;captureDate:string;width:number;height:number};
 remove?:string[];replace?:Record<string,Record<string,unknown>>;add?:Record<string,unknown>[];
 silhouetteTopPx?:[number,number][];reason?:string;
};

export function prepareSourceGeometryCorrection(caseId:string,tier:string,input:SourceGeometryInput,corrections:SourceGeometryCorrection[]){
 const correction=corrections.find(c=>c.caseId===caseId&&c.tier===tier);
 if(!correction)return null;
 const {source}=correction;
 if(input.cropSha256!==source.sha256||input.captureDate!==source.captureDate||input.width!==source.width||input.height!==source.height)throw Error(`Stale source geometry correction: ${caseId}/${tier}`);
 const ids=new Set(input.features.map(f=>f.id));
 if(ids.size!==input.features.length)throw Error(`Duplicate source feature: ${caseId}/${tier}`);
 const removed=new Set(correction.remove??[]);
 const replacements=correction.replace??{};
 for(const id of [...removed,...Object.keys(replacements)])if(!ids.has(id))throw Error(`Missing source feature ${id}: ${caseId}/${tier}`);
 for(const id of removed)if(replacements[id])throw Error(`Removed feature also replaced: ${id}`);
 const features=input.features.filter(f=>!removed.has(f.id)).map(f=>{
  const replacement=replacements[f.id];
  if(!replacement)return structuredClone(f);
  if(replacement.id!==undefined&&replacement.id!==f.id)throw Error(`Source feature ID changed: ${f.id}`);
  const updated={...structuredClone(f),...structuredClone(replacement),disposition:'agent-inspected'};
  for(const key of Object.keys(updated))if(updated[key]===null)delete updated[key];
  return updated;
 });
 const featureIds=new Set(features.map(f=>f.id));
 for(const addition of correction.add??[]){
  const id=addition.id;
  if(typeof id!=='string'||!id)throw Error(`Invalid added source feature: ${caseId}/${tier}`);
  if(featureIds.has(id)){
   const old=features.find(f=>f.id===id);
   const updated={...addition,disposition:'agent-inspected'};
   if(JSON.stringify(old)!==JSON.stringify(updated)){
    // A previously published source feature may receive a drawing-only hint
    // without changing its photographed bounds or semantic identity.
    const stripHints=(feature:any)=>Object.fromEntries(Object.entries(feature).filter(([key])=>!['sourceFrameWidthPx','sourceJoineryWidthPx','mullionScope'].includes(key)));
    if(JSON.stringify(stripHints(old))!==JSON.stringify(stripHints(updated)))throw Error(`Conflicting added source feature: ${id}`);
    features[features.findIndex(f=>f.id===id)]=structuredClone(updated);
   }
   continue;
  }
  features.push({...structuredClone(addition),disposition:'agent-inspected'});featureIds.add(id);
 }
 let polygon:[number,number][]|undefined;
 if(correction.silhouetteTopPx){
  const top=correction.silhouetteTopPx;
  if(top.length<3||top.some(p=>p.length!==2||!p.every(Number.isFinite)||p[0]<0||p[0]>input.width||p[1]<0||p[1]>input.height))throw Error(`Invalid source silhouette: ${caseId}/${tier}`);
  polygon=[...top,[top.at(-1)![0],input.height],[top[0][0],input.height]];
 }
 return {input:{...input,features},polygon,source:{...source},reason:correction.reason};
}

export function applyPreparedSourceGeometry(study:any,prepared:NonNullable<ReturnType<typeof prepareSourceGeometryCorrection>>){
 return prepared.polygon?applySourceSilhouette(study,prepared.input,prepared.polygon):study;
}

/** Deterministic packet transform for staging. Leaves every other case and packet metadata intact. */
export function stageSourceGeometryPacket<T extends {cases:any[]}>(packet:T,corrections:SourceGeometryCorrection[]):T{
 const staged=structuredClone(packet);
 for(const record of staged.cases){
  for(const tier of Object.keys(record.shapeFeatures??{})){
   const prepared=prepareSourceGeometryCorrection(record.caseId,tier,record.shapeFeatures[tier],corrections);
   if(!prepared)continue;
   const prior=record.shapeStudy?.[tier];
   if(!prior||prior.mode!=='source-space-shape-study')throw Error(`Unsupported staged source study: ${record.caseId}/${tier}`);
   const supported=new Set(['mode','owner','frame','patches','counts','omissions','sourceSilhouette']);
   if(Object.keys(prior).some(key=>!supported.has(key))||
      prior.patches?.some((patch:any)=>patch.sourceStudyOnly||patch.featureId?.startsWith('source-assembly:')||patch.featureId?.startsWith('source-perspective:'))||
      prior.owner?.geometry?.building?.surfaces?.[0]?.rings?.length!==1||
      (prior.omissions??[]).length)throw Error(`Staged source study has assemblies or unsupported metadata: ${record.caseId}/${tier}`);
   record.shapeFeatures[tier]=prepared.input;
   record.shapeStudy[tier]=applyPreparedSourceGeometry(compileSourceShapePreview(prepared.input),prepared);
   record.shapeStudy[tier].omissions=structuredClone(prior.omissions??[]);
   if(tier==='full'&&prepared.polygon)record.roofReview={status:'source-outline-reviewed',uncertainty:prepared.reason};
  }
 }
 return staged;
}
