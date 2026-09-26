/** Local source review gallery. Model proposals never alter the game or accepted colours. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateLabel} from '../city-appearance/benchmark-local-materials.mjs';

const args=process.argv.slice(2);
const values=(name:string)=>args.filter(v=>v.startsWith(`--${name}=`)).map(v=>v.slice(name.length+3));
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
const read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const optional=async(file:string)=>{try{return await read(file);}catch(e:any){if(e.code==='ENOENT')return null;throw e;}};
const root=path.resolve(values('out')[0]??'public/data/district-materials');
const progressDir='.cache/city-appearance/districts/da-costa-jordaan-v1/rectification';
const referenceFile=values('reference')[0]??'review-data/district-rectification/local-material-reference.json';
const benchmarks=values('benchmark');
const publicRoot=path.resolve('public');
if(!root.startsWith(publicRoot+path.sep))throw Error('Gallery output must be inside public');
const urlRoot='/'+path.relative(publicRoot,root).split(path.sep).join('/');
const identity=(b:string,e:string,h:string)=>`${b}:${e}:${h}`;

async function build(){
 const names=(await fs.readdir(progressDir)).filter(n=>n.endsWith('-material-4000-batch-100.json'));
 if(names.length!==1)throw Error('Expected exactly one district 4K progress report');
 const progress=await read(path.join(progressDir,names[0]));
 const reference=await optional(referenceFile);
 const refs=new Map<string,any>((reference?.entries??[]).map((e:any)=>[identity(e.source.buildingId,e.source.elevationId,e.source.sha256),e]));
 const predictions=new Map<string,any>();
 const experiments=new Set<string>();
 for(const directory of benchmarks){
  let files:string[];try{files=await fs.readdir(path.join(directory,'receipts'));}catch(e:any){if(e.code==='ENOENT')continue;throw e;}
  for(const name of files.filter(n=>n.endsWith('.json')).sort()){
   const receipt=await read(path.join(directory,'receipts',name));
   const b=receipt.binding;
   if(!b||b.imageKind!=='full'||receipt.status!=='ok'||!receipt.schema?.valid||!validateLabel(receipt.label).valid)continue;
   experiments.add(receipt.experimentHash);
   if(experiments.size>1)throw Error('Select one classifier experiment for the gallery; differing model/prompt/size receipts cannot be combined');
   const key=identity(b.buildingId,b.elevationId,b.sourceSha256),previous=predictions.get(key);
   if(previous&&JSON.stringify(previous.label)!==JSON.stringify(receipt.label))throw Error(`Conflicting predictions for ${key}`);
   if(!previous||receipt.startedAt>previous.startedAt)predictions.set(key,receipt);
  }
 }
 const manifests=new Map<string,string>();
 for(const batch of progress.batches??[]){
  manifests.set(path.resolve('.cache/city-appearance/areas',batch.areaId,'panorama-audit',batch.selectionHash,'evidence/manifest.json'),batch.areaId==='da-costabuurt-v1'?'Da Costabuurt':'Jordaan');
 }
 for(const e of reference?.entries??[]){
  const file=path.resolve(path.dirname(e.source.path),'../manifest.json');
  manifests.set(file,e.source.path.includes('jordaan-sample-v1')?'Jordaan':'Da Costabuurt');
 }
 const entries:any[]=[];const seen=new Set<string>();
 const rectifiedIds=new Set<string>(),omittedIds=new Set<string>();
 const errors:any[]=[];
 await fs.mkdir(path.join(root,'images'),{recursive:true});
 const copied=new Set<string>();
 async function publishImage(directory:string,image:any){
  if(!image?.file||!image?.sha256)return null;
  const bytes=await fs.readFile(path.join(directory,'images',image.file));
  if(sha(bytes)!==image.sha256)throw Error(`Image hash mismatch: ${image.file}`);
  const destination=path.join(root,'images',`${image.sha256}.jpg`);
  if(!copied.has(destination)){
   let existing:Buffer|null=null;try{existing=await fs.readFile(destination);}catch(e:any){if(e.code!=='ENOENT')throw e;}
   if(!existing||sha(existing)!==image.sha256||(await fs.stat(destination)).nlink>1){
    // Keep public evidence independent of a cache inode which may be regenerated.
    const temporary=`${destination}.${randomUUID()}.tmp`;
    await fs.writeFile(temporary,bytes,{flag:'wx'});await fs.rename(temporary,destination);
   }
   copied.add(destination);
  }
  return `${urlRoot}/images/${image.sha256}.jpg`;
 }
 const queuePaths=new Set((progress.batches??[]).map((b:any)=>path.resolve('.cache/city-appearance/areas',b.areaId,'panorama-audit',b.selectionHash,'evidence/manifest.json')));
 for(const [file,district] of manifests){
  const manifest=await optional(file);if(!manifest)continue;
  if(queuePaths.has(file))for(const o of manifest.omitted??[])omittedIds.add(`${o.buildingId}:${o.elevationId}`);
  for(const record of manifest.records){
   const source=record.images?.full;if(!source)continue;
   const key=identity(record.buildingId,record.elevationId,source.sha256);
   // Other-profile manifests contribute only the explicitly selected reference cases.
   if(!queuePaths.has(file)&&!refs.has(key))continue;
   if(seen.has(key))continue;seen.add(key);
   const ref=refs.get(key),p=predictions.get(key);
   try{
    const photo=await publishImage(path.dirname(file),source);
    const contextPhoto=await publishImage(path.dirname(file),record.images.context);
    if(queuePaths.has(file))rectifiedIds.add(`${record.buildingId}:${record.elevationId}`);
    let comparison='unreviewed';
    if(p?.label.abstain)comparison='withheld';
    else if(p&&ref)comparison=['materialFamily','colourFamily'].every(k=>p.label[k]===ref.label[k])?'agree':'disagree';
    entries.push({id:key,buildingId:record.buildingId,elevationId:record.elevationId,address:record.address,street:record.street,district,
     photo,contextPhoto,sourceSha256:source.sha256,sourceDate:source.date,sourceProfile:manifest.sourceProfile??'full',
     point:record.wall?.midpoint?[record.wall.midpoint.x,record.wall.midpoint.y]:null,
     classification:p?{...p.label,seconds:p.clientLatencyMs/1000,model:p.model,modelDigest:p.modelDigest}:null,
     reference:ref?{...ref.label,reason:ref.reason,uncertainty:ref.uncertainty}:null,
     comparison,sourceIdentityUnverified:true});
   }catch(e:any){errors.push({id:key,error:e.message});}
  }
 }
 entries.sort((a,b)=>Number(Boolean(b.reference))-Number(Boolean(a.reference))||a.district.localeCompare(b.district)||String(a.address).localeCompare(String(b.address))||a.id.localeCompare(b.id));
 const classified=entries.filter(e=>e.classification),reviewed=classified.filter(e=>e.reference);
 const knownReviewed=reviewed.filter(e=>e.reference.materialFamily!=='unknown');
 const acceptedReviewed=knownReviewed.filter(e=>!e.classification.abstain);
 const agreement=acceptedReviewed.filter(e=>e.comparison==='agree');
 const times=classified.map(e=>e.classification.seconds).filter(Number.isFinite).sort((a,b)=>a-b);
 const summary={districtOwners:progress.districtOwners,eligibleOwners:progress.frontageOwners,eligibleFrontages:progress.eligibleFrontages,
  rectifiedFrontages:rectifiedIds.size,omittedFrontages:omittedIds.size,pendingFrontages:progress.eligibleFrontages-rectifiedIds.size-omittedIds.size,
  noCandidateOwners:progress.districtOwners-progress.frontageOwners,classified:classified.length,abstained:classified.filter(e=>e.classification.abstain).length,
  reviewed:reviewed.length,agreement:acceptedReviewed.length?agreement.length/acceptedReviewed.length:null,
  agreementDenominator:acceptedReviewed.length,knownReferenceCount:knownReviewed.length,
  referenceAbstentions:reviewed.filter(e=>e.reference.materialFamily==='unknown').length,
  correctAbstentions:reviewed.filter(e=>e.reference.materialFamily==='unknown'&&e.classification.abstain).length,
  falseAcceptances:reviewed.filter(e=>e.reference.materialFamily==='unknown'&&!e.classification.abstain).length,
  model:[...new Set(classified.map(e=>e.classification.model))].join(', ')||null,speedMedianSeconds:times.length?times[Math.floor(times.length/2)]:null};
 const report={version:1,generatedAt:new Date().toISOString(),summary,entries,errors,
  policy:'Model classifications are proposals. Reference agreement is not source-to-owner verification or rendered colour acceptance. Swatches are illustrative colour families, not measured albedo.',
  provenance:{rectificationReport:path.join(progressDir,names[0]),benchmarkDirectories:benchmarks,referenceFile,visuallyAcceptedFrontages:0}};
 const temp=path.join(root,`report.${process.pid}.${randomUUID()}.tmp`);await fs.writeFile(temp,JSON.stringify(report)+'\n');await fs.rename(temp,path.join(root,'report.json'));
 console.log(JSON.stringify({at:report.generatedAt,...summary,entries:entries.length,errors:errors.length}));
}
await build();
if(args.includes('--watch')){
 const next=()=>setTimeout(async()=>{try{await build();}catch(e){console.error(String(e));}next();},60000);
 next();
}
