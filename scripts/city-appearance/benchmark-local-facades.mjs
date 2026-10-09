/** Bounded multi-signal local vision experiment. Never writes game appearance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {FACADE_SCHEMA,FACADE_PROMPT,validateFacadeAssessment,GROUND_SCHEMA,GROUND_PROMPT,validateGroundAssessment} from './facade-assessment-schema.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const flag=(args,k)=>args.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3);
const atomic=async(file,data)=>{await fs.mkdir(path.dirname(file),{recursive:true});const temp=`${file}.${randomUUID()}.tmp`;
 await fs.writeFile(temp,JSON.stringify(data,null,2)+'\n');await fs.rename(temp,file);};
export async function runFacadeBenchmark(args=process.argv.slice(2)){
 const packetFile=path.resolve(flag(args,'packet')??'.cache/facade-assessment/cohort.json');
 const bytes=await fs.readFile(packetFile),packet=JSON.parse(bytes.toString());
 const indices=(flag(args,'indices')??'0,1,3,10,11,13,17,30,52,64').split(',').map(Number);
 if(indices.length>20||!indices.length||new Set(indices).size!==indices.length||indices.some(i=>!Number.isInteger(i)||i<0))throw Error('Select1–20 distinct cohort indices');
 const entries=indices.map(i=>{const e=packet.entries.find(e=>e.index===i);if(!e)throw Error(`Missing index ${i}`);return e;});
 const out=path.resolve(flag(args,'out')??'.cache/facade-assessment/pilot-v1');
 if(!out.startsWith(path.resolve('.cache')+path.sep))throw Error('Benchmark output must stay under local .cache');
 const run=args.includes('--run');
 const profile=flag(args,'profile')??'facade';if(!['facade','ground'].includes(profile))throw Error('Unknown profile');
 const schema=profile==='ground'?GROUND_SCHEMA:FACADE_SCHEMA,prompt=profile==='ground'?GROUND_PROMPT:FACADE_PROMPT;
 const validate=profile==='ground'?validateGroundAssessment:validateFacadeAssessment;
 const model='qwen3.5:9b',endpoint='http://127.0.0.1:11434';
 const options={temperature:0,seed:17,num_predict:profile==='ground'?320:900,num_ctx:4096};
 let digest=null;
 if(run){const response=await fetch(`${endpoint}/api/tags`,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error(`Local model catalog HTTP ${response.status}`);
  const tags=await response.json();digest=tags.models?.find(m=>m.name===model)?.digest;
  if(!/^[a-f0-9]{64}$/.test(digest??''))throw Error('Local model missing');}
 const experiment={model,modelDigest:digest,profile,prompt,schema,options,think:false,
  imageSize:768,encoding:'jpeg85-fit-inside-no-upscale',implementationSha256:sha(await fs.readFile(new URL(import.meta.url))),
  validatorSha256:sha(await fs.readFile(new URL('./facade-assessment-schema.mjs',import.meta.url)))};
 const experimentHash=sha(JSON.stringify(experiment));
 if(!run)return {mode:'plan',entries:entries.length,indices,packetSha256:sha(bytes),out,paidCalls:0};
 try{const prior=JSON.parse(await fs.readFile(path.join(out,'experiment.json'),'utf8'));
  if(prior.experimentHash!==experimentHash)throw Error('Experiment changed; use new output directory');}
 catch(e){if(e.code!=='ENOENT')throw e;await atomic(path.join(out,'experiment.json'),{experimentHash,experiment});}
 const receipts=[];
 for(const entry of entries){
  const inputs=[];
  for(const source of entry.images.filter(i=>profile==='facade'||i.kind==='ground')){const imageBytes=await fs.readFile(source.path);
   if(sha(imageBytes)!==source.sha256)throw Error(`Source image hash mismatch ${entry.index}/${source.kind}`);
   const image=await sharp(imageBytes).resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
   inputs.push({kind:source.kind,path:source.path,sourceSha256:source.sha256,inputSha256:sha(image),capturedAt:source.capturedAt,image});}
  if(inputs[0]?.kind!==(profile==='ground'?'ground':'full'))throw Error('Required input view missing');
  const binding={packetSha256:sha(bytes),buildingId:entry.buildingId,observationId:entry.observationId,index:entry.index,
   inputs:inputs.map(({image,...rest})=>rest)};
  const key=sha(JSON.stringify({experimentHash,binding})),file=path.join(out,'receipts',`${key}.json`);
  let previous=null;
  try{previous=JSON.parse(await fs.readFile(file,'utf8'));
   if(previous.key!==key||previous.experimentHash!==experimentHash||JSON.stringify(previous.binding)!==JSON.stringify(binding))throw Error('Receipt binding changed');
   if(previous.status==='ok'&&validate(previous.assessment).valid){receipts.push({...previous,reused:true});continue;}}
  catch(e){if(e.code!=='ENOENT')throw e;}
  const receipt={key,experimentHash,binding,startedAt:new Date().toISOString(),status:'error',previousAttempts:previous?[...(previous.previousAttempts??[]),{status:previous.status,rawOutput:previous.rawOutput,error:previous.error,startedAt:previous.startedAt}]:[]};
  const started=performance.now();
  try{const response=await fetch(`${endpoint}/api/chat`,{method:'POST',signal:AbortSignal.timeout(180000),headers:{'content-type':'application/json'},
   body:JSON.stringify({model,stream:false,think:false,format:schema,options,keep_alive:'10m',messages:[{role:'user',
    content:prompt+'\nInput views: '+JSON.stringify(inputs.map(({kind,capturedAt})=>({kind,capturedAt}))),images:inputs.map(i=>i.image.toString('base64'))}]})});
   receipt.responseText=await response.text();if(!response.ok)throw Error(`Local model HTTP ${response.status}`);
   const raw=JSON.parse(receipt.responseText);receipt.rawOutput=raw.message?.content;receipt.assessment=JSON.parse(receipt.rawOutput);
   receipt.validation=validate(receipt.assessment);receipt.status=receipt.validation.valid?'ok':'invalid-schema';
   receipt.server={totalMs:raw.total_duration/1e6,loadMs:raw.load_duration/1e6,promptTokens:raw.prompt_eval_count,outputTokens:raw.eval_count,doneReason:raw.done_reason};
  }catch(e){receipt.error=String(e.message??e);}
  receipt.clientLatencyMs=Math.round(performance.now()-started);await atomic(file,receipt);receipts.push(receipt);
  await atomic(path.join(out,'report.json'),{version:1,experimentHash,packetFile,packetSha256:sha(bytes),requested:indices,
   receipts,policy:'Multi-signal model proposals; no visual acceptance, box coordinates or game publication',paidCalls:0});
  process.stderr.write(`${receipts.length}/${entries.length} index${entry.index} ${receipt.status} ${receipt.clientLatencyMs}ms\n`);
 }
 await atomic(path.join(out,'report.json'),{version:1,experimentHash,profile,packetFile,packetSha256:sha(bytes),requested:indices,
  receipts,policy:'Local model proposals only; no accepted geometry or game publication',paidCalls:0});
 const times=receipts.filter(r=>r.status==='ok').map(r=>r.clientLatencyMs).sort((a,b)=>a-b);
 return {selected:entries.length,valid:times.length,medianMs:times[Math.floor((times.length-1)/2)]??null,out,experimentHash,paidCalls:0};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 runFacadeBenchmark().then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
