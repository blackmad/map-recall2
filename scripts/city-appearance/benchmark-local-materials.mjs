/** Local Ollama wall-material benchmark. Diagnostic receipts only; no publication. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

export const MATERIAL_FAMILIES = ['brick', 'painted-brick', 'render', 'stone', 'concrete', 'other', 'unknown'];
export const COLOUR_FAMILIES = ['red', 'brown', 'buff', 'cream', 'white', 'grey', 'black', 'other', 'unknown'];
export const VISIBILITY = ['clear', 'partial', 'occluded'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const PROMPT = 'Inspect the selected building facade in this rectified Amsterdam street photograph. Classify only the dominant visible UPPER WALL, excluding glass, roof, shopfront, signs, trees and neighbouring buildings. Choose the broad material family and colour family from the JSON schema. Visibility is clear, partial, or occluded for the target wall. If representative wall is too dark, cropped, obstructed or ambiguous, set abstain true and both families unknown. Do not infer hidden surfaces or a precise colour. Return only JSON.';
const SCHEMA = { type:'object', additionalProperties:false, required:['materialFamily','colourFamily','visibility','abstain'], properties:{
  materialFamily:{type:'string',enum:MATERIAL_FAMILIES}, colourFamily:{type:'string',enum:COLOUR_FAMILIES},
  visibility:{type:'string',enum:VISIBILITY}, abstain:{type:'boolean'},
} };
const OPTIONS = { temperature:0, seed:17, num_predict:160, num_ctx:2048 };
const flag = (args, name) => args.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const flags = (args, name) => args.filter(value => value.startsWith(`--${name}=`)).flatMap(value => value.slice(name.length + 3).split(',').filter(Boolean));
const bounded = (value, name, min, max) => { const n=Number(value); if(!Number.isInteger(n)||n<min||n>max)throw Error(`${name} must be ${min}–${max}`); return n; };
const safeImageName = value => typeof value === 'string' && value === path.basename(value) && /^[-a-zA-Z0-9_.]+\.jpe?g$/.test(value);

export function validateLabel(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== ['abstain','colourFamily','materialFamily','visibility'].join(','))
    return { valid:false, reason:'schema-keys' };
  if (!MATERIAL_FAMILIES.includes(value.materialFamily) || !COLOUR_FAMILIES.includes(value.colourFamily) ||
      !VISIBILITY.includes(value.visibility) || typeof value.abstain !== 'boolean') return { valid:false, reason:'schema-enum' };
  if (value.abstain && (value.materialFamily !== 'unknown' || value.colourFamily !== 'unknown')) return { valid:false, reason:'abstain-must-be-unknown' };
  if (value.visibility === 'occluded' && !value.abstain) return { valid:false, reason:'occluded-must-abstain' };
  return { valid:true, reason:null };
}

export function recordsFromEvidenceManifest(manifest, manifestPath, imageKind='full') {
  if (!Array.isArray(manifest?.records) || !validHash(manifest.sourceHash)) throw Error(`Invalid source-bound evidence manifest: ${manifestPath}`);
  const root=path.dirname(manifestPath), seen=new Set();
  return manifest.records.map(record => {
    const image=record.images?.[imageKind], id=record.elevationId;
    if (!record.buildingId || typeof id!=='string' || record.id!==id.replaceAll(':','_') || !image ||
        !safeImageName(image.file) || !validHash(image.sha256) || !validHash(image.panoramaSha256) ||
        !Array.isArray(image.sourceDimensions) || image.sourceDimensions.length!==2 ||
        !image.sourceDimensions.every(n=>Number.isInteger(n)&&n>0) || seen.has(id))
      throw Error(`Unbound or duplicate evidence record: ${record.id}`);
    seen.add(id);
    if ((manifest.sourceProfile??'full') !== (image.sourceProfile??'full')) throw Error(`Mixed panorama profile: ${id}`);
    return { buildingId:String(record.buildingId), elevationId:id, imageKind, imagePath:path.join(root,'images',image.file),
      sourceSha256:image.sha256, panoramaSha256:image.panoramaSha256, sourceDimensions:image.sourceDimensions,
      panoramaProfile:manifest.sourceProfile??'full', sourceManifestPath:manifestPath, sourceManifestSha256:null,
      sourceIdentityUnverified:true };
  });
}

export function recordsFromCohort(cohort, cohortPath) {
  if (!Array.isArray(cohort?.entries)) throw Error('Cohort needs entries[]');
  const seen=new Set();
  return cohort.entries.map(entry => {
    if (!entry.buildingId || !entry.observationId || !validHash(entry.sourceSha256) ||
        typeof entry.crop !== 'string' || !/^\/data\/city-expansion\/evidence\/[a-f0-9]{64}\.jpg$/.test(entry.crop) ||
        path.basename(entry.crop, '.jpg') !== entry.sourceSha256 || seen.has(entry.observationId))
      throw Error(`Unbound or duplicate cohort reference: ${entry.observationId}`);
    seen.add(entry.observationId);
    return { buildingId:String(entry.buildingId), elevationId:String(entry.observationId), imageKind:'reference',
      imagePath:path.resolve('public',entry.crop.slice(1)), sourceSha256:entry.sourceSha256,
      panoramaSha256:null, sourceDimensions:null, panoramaProfile:'published-reference',
      sourceManifestPath:cohortPath, sourceManifestSha256:null, sourceIdentityUnverified:true };
  });
}

export function recordsFromReference(reference, referencePath) {
  if (!Array.isArray(reference?.entries) || reference.sourceIdentityUnverified !== true) throw Error('Reference selection needs entries[] and unverified identity provenance');
  const seen=new Set();
  return reference.entries.map(entry => {
    const source=entry.source,key=`${source?.buildingId}:${source?.elevationId}:${source?.imageKind}`;
    if (!source || !source.buildingId || !source.elevationId || !['full','ground'].includes(source.imageKind) ||
        !validHash(source.sha256) || !Array.isArray(source.sourceDimensions) || source.sourceDimensions.length!==2 ||
        !source.sourceDimensions.every(n=>Number.isInteger(n)&&n>0) ||
        typeof source.path!=='string' || !/^\.cache\/city-appearance\/areas\/[-a-zA-Z0-9_/]+\/evidence\/images\/[-a-zA-Z0-9_.]+\.jpe?g$/.test(source.path) ||
        seen.has(key)) throw Error(`Unbound or duplicate reference source: ${key}`);
    seen.add(key);
    return { buildingId:String(source.buildingId), elevationId:String(source.elevationId), imageKind:source.imageKind,
      imagePath:path.resolve(source.path), sourceSha256:source.sha256, panoramaSha256:null,
      sourceDimensions:source.sourceDimensions, panoramaProfile:'reference-selection',
      sourceManifestPath:referencePath, sourceManifestSha256:null, sourceIdentityUnverified:true };
  });
}

async function evidenceFiles(directory) {
  const absolute=path.resolve(directory), found=[];
  const maybe=async file => { try { const stat=await fs.stat(file); if(stat.isFile())found.push(file); } catch(error) { if(error.code!=='ENOENT')throw error; } };
  await maybe(path.join(absolute,'manifest.json'));
  await maybe(path.join(absolute,'evidence','manifest.json'));
  for (const name of await fs.readdir(absolute)) {
    const child=path.join(absolute,name), stat=await fs.stat(child);
    if(stat.isDirectory())await maybe(path.join(child,'evidence','manifest.json'));
  }
  return found;
}

export async function loadSources(args) {
  const files=new Set(flags(args,'manifest').map(value=>path.resolve(value)));
  for(const directory of flags(args,'manifest-dir'))for(const file of await evidenceFiles(directory))files.add(file);
  const cohortFiles=flags(args,'cohort');
  const referenceFiles=flags(args,'reference');
  if(!files.size&&!cohortFiles.length&&!referenceFiles.length)cohortFiles.push('public/data/wall-materials/assignments.json');
  const kind=flag(args,'image-kind')??'full';if(!['full','ground'].includes(kind))throw Error('Image kind must be full or ground');
  const records=[];
  for(const file of [...files].sort()){
    const bytes=await fs.readFile(file), manifest=JSON.parse(bytes);
    for(const record of recordsFromEvidenceManifest(manifest,file,kind))records.push({...record,sourceManifestSha256:hash(bytes)});
  }
  for(const value of cohortFiles){const file=path.resolve(value),bytes=await fs.readFile(file),cohort=JSON.parse(bytes);
    for(const record of recordsFromCohort(cohort,file))records.push({...record,sourceManifestSha256:hash(bytes)});
  }
  for(const value of referenceFiles){const file=path.resolve(value),bytes=await fs.readFile(file),reference=JSON.parse(bytes);
    for(const record of recordsFromReference(reference,file))records.push({...record,sourceManifestSha256:hash(bytes)});
  }
  if(!records.length)throw Error('No source-bound images found');
  const seen=new Set();
  for(const record of records){const key=`${record.buildingId}:${record.elevationId}:${record.imageKind}:${record.sourceSha256}`;
    if(seen.has(key))throw Error(`Duplicate benchmark source: ${key}`);seen.add(key);}
  return records.sort((a,b)=>a.buildingId.localeCompare(b.buildingId)||a.elevationId.localeCompare(b.elevationId)||a.imageKind.localeCompare(b.imageKind));
}

async function modelDigest(baseUrl,model,timeoutMs) {
  const response=await fetch(`${baseUrl}/api/tags`,{signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error(`Local Ollama model catalog HTTP ${response.status}`);
  const value=await response.json(),entry=value.models?.find(item=>item.name===model||item.model===model);
  if(!entry||!/(?:^|:)\b[a-f0-9]{64}$/.test(entry.digest??''))throw Error(`Local model missing or has no digest: ${model}`);
  return entry.digest;
}
const percentile=(values,p)=>values.length?values[Math.min(values.length-1,Math.floor((values.length-1)*p))]:null;
export function speedSummary(receipts) {
  const attempted=receipts.filter(r=>r.status!=='dry-run'),good=attempted.filter(r=>r.status==='ok'&&r.schema?.valid&&Number.isFinite(r.clientLatencyMs));
  const times=good.map(r=>r.clientLatencyMs).sort((a,b)=>a-b),loads=good.map(r=>r.server?.loadDurationMs).filter(Number.isFinite).sort((a,b)=>a-b);
  return { successfulSamples:good.length, excludedErrors:attempted.length-good.length,
    latencyMs:{ median:percentile(times,.5), p90:percentile(times,.9), min:times[0]??null, max:times.at(-1)??null },
    modelLoadMs:{ median:percentile(loads,.5), p90:percentile(loads,.9) } };
}
const atomicJson=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});const temporary=`${file}.${process.pid}.${crypto.randomUUID()}.tmp`;await fs.writeFile(temporary,JSON.stringify(value,null,2));await fs.rename(temporary,file);};

export async function runBenchmark(args=process.argv.slice(2)) {
  const model=flag(args,'model')??'qwen3.5:9b',imageSize=bounded(flag(args,'image-size')??768,'Image size',512,768);
  if(![512,768].includes(imageSize))throw Error('Image size must be 512 or 768');
  const limit=bounded(flag(args,'limit')??20,'Limit',1,500),offset=bounded(flag(args,'offset')??0,'Offset',0,1000000);
  const timeoutMs=bounded(flag(args,'timeout-ms')??90000,'Timeout',1000,300000);
  const base=new URL(flag(args,'base-url')??'http://127.0.0.1:11434');
  if(base.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(base.hostname)||base.username||base.password||base.pathname!=='/')
    throw Error('Ollama endpoint must be a loopback HTTP origin');
  const sources=await loadSources(args),selected=sources.slice(offset,offset+limit);
  if(!selected.length)throw Error(`Offset ${offset} is past ${sources.length} available sources`);
  const dryRun=args.includes('--dry-run');
  const digest=dryRun?null:await modelDigest(base.origin,model,Math.min(timeoutMs,10000));
  const experiment={version:1,model,modelDigest:digest,prompt:PROMPT,schema:SCHEMA,think:false,
    options:OPTIONS,imageEncoding:'sharp-fit-inside-no-upscale-jpeg85',imageSize,timeoutMs,provider:'ollama-local-only'};
  const experimentHash=hash(JSON.stringify(experiment)),out=path.resolve(flag(args,'out')??`.cache/city-appearance/local-material-benchmark/${experimentHash}`);
  const receipts=[];
  for(const source of selected){
    const bytes=await fs.readFile(source.imagePath);if(hash(bytes)!==source.sourceSha256)throw Error(`Source image hash changed: ${source.imagePath}`);
    const original=await sharp(bytes).metadata();if(!original.width||!original.height)throw Error(`Source image has no dimensions: ${source.imagePath}`);
    const {data:image,info}=await sharp(bytes).resize({width:imageSize,height:imageSize,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer({resolveWithObject:true});
    const binding={...source,originalDimensions:[original.width,original.height],inputDimensions:[info.width,info.height],inputSha256:hash(image),inputBytes:image.length};
    if(dryRun){receipts.push({binding,status:'dry-run'});continue;}
    const key=hash(JSON.stringify({experimentHash,buildingId:source.buildingId,elevationId:source.elevationId,imageKind:source.imageKind,
      sourceSha256:source.sourceSha256,sourceManifestSha256:source.sourceManifestSha256,inputSha256:binding.inputSha256}));
    const file=path.join(out,'receipts',`${key}.json`);
    let priorReceipt=null;
    try { const prior=JSON.parse(await fs.readFile(file,'utf8'));
      if(prior.key!==key||prior.experimentHash!==experimentHash||prior.binding?.sourceSha256!==source.sourceSha256)throw Error(`Receipt binding mismatch: ${file}`);
      if(prior.status==='ok'&&prior.schema?.valid&&!args.includes('--rerun')){receipts.push({...prior,reused:true});continue;}
      priorReceipt=prior;
    } catch(error){if(error.code!=='ENOENT')throw error;}
    const previousAttempts=priorReceipt?[...(priorReceipt.previousAttempts??[]),Object.fromEntries(Object.entries(priorReceipt).filter(([field])=>field!=='previousAttempts'))]:[];
    const receipt={version:1,key,experimentHash,model,modelDigest:digest,binding,previousAttempts,attempt:previousAttempts.length+1,
      startedAt:new Date().toISOString(),status:'error'};
    const request={model,stream:false,think:false,format:SCHEMA,keep_alive:'10m',options:OPTIONS,
      messages:[{role:'user',content:PROMPT,images:[image.toString('base64')]}]};
    const started=performance.now();
    try {
      const response=await fetch(`${base.origin}/api/chat`,{method:'POST',signal:AbortSignal.timeout(timeoutMs),headers:{'content-type':'application/json'},body:JSON.stringify(request)});
      receipt.httpStatus=response.status;
      const responseText=await response.text();receipt.responseText=responseText;
      if(!response.ok)throw Error(`Local Ollama chat HTTP ${response.status}`);
      const value=JSON.parse(responseText);receipt.response=value;receipt.rawOutput=value.message?.content??null;
      let label;try{label=JSON.parse(receipt.rawOutput);}catch{label=null;}
      receipt.label=label;receipt.schema=validateLabel(label);
      receipt.server={totalDurationMs:value.total_duration/1e6,loadDurationMs:value.load_duration/1e6,
        promptEvalDurationMs:value.prompt_eval_duration/1e6,evalDurationMs:value.eval_duration/1e6,
        promptTokens:value.prompt_eval_count??null,outputTokens:value.eval_count??null,doneReason:value.done_reason??null};
      receipt.status=receipt.schema.valid?'ok':'invalid-schema';
    } catch(error){receipt.error={name:error.name??'Error',message:String(error.message??error)};}
    receipt.clientLatencyMs=Math.round(performance.now()-started);receipt.completedAt=new Date().toISOString();
    await atomicJson(file,receipt);receipts.push(receipt);
    process.stderr.write(`${receipts.length}/${selected.length} ${source.buildingId} ${receipt.status} ${receipt.clientLatencyMs}ms\n`);
  }
  const summary={version:1,experiment,experimentHash,generatedAt:new Date().toISOString(),sourceCount:sources.length,
    selectedCount:selected.length,offset,limit,dryRun,receipts:receipts.map(r=>({key:r.key??null,status:r.status,
      sourceSha256:r.binding.sourceSha256,sourceManifestSha256:r.binding.sourceManifestSha256,imagePath:r.binding.imagePath,
      buildingId:r.binding.buildingId,elevationId:r.binding.elevationId,imageKind:r.binding.imageKind,
      label:r.label??null,clientLatencyMs:r.clientLatencyMs??null,schema:r.schema??null,reused:r.reused??false})),speed:speedSummary(receipts),
    policy:'Local diagnostic predictions only. Source identity is not visually certified; no publication or accepted appearance grades.',paidCalls:0};
  if(!dryRun)await atomicJson(path.join(out,'report.json'),summary);
  return {out,...summary};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
  runBenchmark().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{process.stderr.write(`${error.stack??error.message}\n`);process.exitCode=1;});
