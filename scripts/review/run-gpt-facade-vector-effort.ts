/** Bounded GPT-6 reasoning-effort photo/vector experiment. Never publishes game geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import dotenv from 'dotenv';
import sharp from 'sharp';
import {globalBudget} from '../da-costa-block/global-budget.mjs';
import {readChatStream} from './openrouter-chat-stream.mjs';
import {FACADE_SVG_JSON_SCHEMA,validateFacadeSvgExperiment,renderFacadeSvg,toSourceFacadeFeatures} from '../../src/canalRecall/facade/facadeSvgExperiment.ts';
const arg=(n:string,d:string)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const json=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const save=async(p:string,v:any)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p+'.tmp',JSON.stringify(v,null,2)+'\n');await fs.rename(p+'.tmp',p);};
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function lookupCompletedCost(id:string){
 let last:any=null;
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(id)}`,{
   headers:{authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},signal:AbortSignal.timeout(15000)});
  last=await response.json();
  const data=last.data,cost=data?.total_cost;
  if(response.ok&&Number.isFinite(cost)&&cost>=0&&(data.finish_reason||data.cancelled))return {cost,lookup:last};
  if(attempt<2)await pause(2000*(attempt+1));
 }
 return {cost:undefined,lookup:last};
}
const model=arg('model','openai/gpt-6-luna'),local=false;
const effort=arg('reasoning-effort','');
if(!['low','medium','high'].includes(effort)||!['openai/gpt-6-luna','openai/gpt-6-sol'].includes(model))
 throw Error('Use --reasoning-effort=low|medium|high with GPT-6 Luna or Sol');
const indices=arg('indices','0,17,80').split(',').map(Number);
const arms=arg('arms','svg').split(',');
if(indices.length>30||indices.some(v=>!Number.isInteger(v))||new Set(indices).size!==indices.length||arms.some(a=>!['svg','structured','assisted'].includes(a)))throw Error('Invalid cohort/arms');
const root=path.resolve('.cache/facade-assessment/vector-pilot'),manifestFile=path.resolve(arg('manifest','.cache/facade-assessment/vector-inputs-v1/manifest.json'));
const out=path.resolve(arg('out',`${root}/gpt-effort-v1/${model.replaceAll(/[^a-z0-9.-]/gi,'_')}-${effort}`));
if(!out.startsWith(root+'/'))throw Error('Outputs must remain in vector-pilot cache');
const manifestBytes=await fs.readFile(manifestFile),manifest=JSON.parse(manifestBytes.toString());
const catalog=await json(root+'/catalog.json'),info=local?null:catalog.data.find((m:any)=>m.id===model);
if(!local&&!info?.architecture?.input_modalities.includes('image'))throw Error('Model lacks image capability');
const auth=await json(root+'/authorization.json');
const budget=globalBudget({ceiling:auth.maxCeilingUsd,authorization:auth});
const basePrompt=`Reconstruct the visible architectural facade in this photograph as a flat vector study in source-image coordinates. Canvas coordinates: x and y independently normalized to 0..1000 across the ENTIRE original image, origin top left. Preserve visible positions, proportions, window counts, asymmetry, door versus shop glazing, material changes at the ground floor and visible roof outline. Do not turn this into an idealized generic house. Do not fill hidden areas with invented openings. Do not draw cars or vegetation as architectural features. Mark uncertainty. This is an unregistered crop: no metric dimensions or verified building identity are supplied. Colour should convey the observed material family; the photo is not calibrated albedo. Do not draw title text, labels or explanatory paragraphs into the image. Avoid decorative detail that prevents completion of the whole visible facade.`;
const svgPrompt=`This is a controlled qualitative facade reconstruction experiment. Reconstruct the one attached photograph as a standalone inert SVG of the observed facade in NATIVE image pixel coordinates, viewBox="0 0 {WIDTH} {HEIGHT}" matching the original image. Preserve actual framing, silhouette, opening count, bounds, window frame/lintel distinctions, door proportions, material bands and visible balconies/signage. Use observed colour; no palette legend. No external assets, text annotations, scripts or animation. Use simple SVG rect,path,polygon,line,circle,ellipse groups only, at most 150 elements. No invented repeated floors or gables. Occluded uncertain areas should remain plain, not invented openings. Make one initial reconstruction, without iteration. Return ONLY one complete SVG, no markdown. Describe uncertainty in a desc element. Use hex fill/stroke colours or none. In SVG rect, x/y are position and width/height are SIZE, not right/bottom coordinates. Keep all geometry inside the native image canvas.`;
const structuredPrompt=`Return ONLY JSON satisfying this schema; no markdown. IMPORTANT: every opening bounds is [x,y,width,height], NOT corner coordinates. Example: left=200 top=300 right=350 bottom=540 must be bounds [200,300,150,240]. Require x+width<=1000 and y+height<=1000. Individual visible openings must have separate bounds; walls may be polygons. Coordinates are integers. Use notes for uncertain/occluded areas; do not mark unseen features observed. Schema: ${JSON.stringify(FACADE_SVG_JSON_SCHEMA)}`;
const assistPrompt=`The second image is an OccFacade segmentation overlay of exactly the same photograph, not another view. It is fallible evidence, not ground truth. ENPC overlay colours: door orange [255,128,0], shop green [0,255,0], balcony purple [128,0,255], window red [255,0,0], wall yellow [255,255,0], sky cyan [128,255,255], roof blue [0,0,255], background black. Use it only where the original photo supports it; reject tree/glass/shop misclassifications. Original-photo coordinates apply to both.`;
let digest=null;if(local){const tags=await(await fetch('http://127.0.0.1:11434/api/tags')).json();digest=tags.models.find((m:any)=>m.name===model.slice(6))?.digest;if(!digest)throw Error('Missing local model');}
if(!info?.reasoning?.supported_efforts?.includes(effort))throw Error('Catalog does not support this reasoning effort');
const reasoningConfig={effort};
const providerPriceCap=effort&&model==='openai/gpt-6-sol'?{prompt:2.5,completion:12,image:.01,request:0}:{prompt:.5,completion:2,image:.01,request:0};
const reserveUsd=effort&&model==='openai/gpt-6-sol'?.12:.06;
const experiment={version:4,model,modelDigest:digest,basePrompt,svgPrompt,structuredPrompt,assistPrompt,maxTokens:8192,temperature:null,reasoning:reasoningConfig,providerPriceCap,manifestSha256:sha(manifestBytes),runnerSha256:sha(await fs.readFile(new URL(import.meta.url))),streamHelperSha256:sha(await fs.readFile(new URL('./openrouter-chat-stream.mjs',import.meta.url))),rendererSha256:sha(await fs.readFile('src/canalRecall/facade/facadeSvgExperiment.ts')),sanitizerSha256:sha(await fs.readFile('scripts/facade-eval/sanitize_facade_svg.py')),catalogPricing:info?.pricing??null};
const experimentHash=sha(JSON.stringify(experiment));
if(arg('plan','0')==='1'){
 console.log(JSON.stringify({out,model,effort:effort||null,indices,arms,experimentHash,unitReservationUsd:local?0:reserveUsd,
  estimatedMaximumNewReservationUsd:local?0:reserveUsd,requests:indices.length*arms.length}));
 process.exit(0);
}
dotenv.config({path:'.cache/facade-rebuild/openrouter-private.env',quiet:true});
if(!process.env.OPENROUTER_API_KEY)throw Error('Missing OpenRouter credential');
await fs.mkdir(out,{recursive:true});
try{const old=await json(out+'/experiment.json');if(old.experimentHash!==experimentHash)throw Error('Experiment changed: choose a new output directory');}catch(e:any){if(e.code!=='ENOENT')throw e;await save(out+'/experiment.json',{experimentHash,experiment});}
const receipts:any[]=[];
for(const index of indices)for(const arm of arms){
 const e=manifest.entries.find((v:any)=>v.index===index);if(!e)throw Error(`Missing input ${index}`);
 const inputs=[{path:path.resolve(path.dirname(manifestFile),e.imagePath),sha256:e.imageSha256},...(arm==='assisted'?[{path:path.resolve(path.dirname(manifestFile),e.overlayPath),sha256:e.overlaySha256}]:[])];
 const images=[];for(const input of inputs){const b=await fs.readFile(input.path);if(sha(b)!==input.sha256)throw Error('Input changed');images.push(b);}
 const key=sha(JSON.stringify({experimentHash,index,arm,inputs})),file=out+`/${index}-${arm}.json`;
 try{const old=await json(file);if(old.key!==key)throw Error('Receipt changed');if(old.status==='requesting'||old.reservation&&!old.settlement)throw Error('Unresolved request; reconcile before retry');if(old.status==='rendered'){for(const kind of ['svg','png']){const b=await fs.readFile(old[kind+'Path']);if(sha(b)!==old[kind+'Sha256'])throw Error('Cached render changed; rebuild from saved response without another API call');}}receipts.push(old);console.log(`reuse ${index} ${arm} ${old.status}`);continue;}catch(err:any){if(err.code!=='ENOENT')throw err;}
 const receipt:any={key,experimentHash,index,arm,model,sourceSha256:e.sourceSha256,buildingId:e.buildingId,identity:'crop-owner-not-certified',inputs,startedAt:new Date().toISOString(),status:'requesting',...(local?{actualCostUsd:0}:{})};
 if(!local)receipt.reservation=await budget.reserve({key,sourceLedger:file,reservedUsd:reserveUsd,metadata:{experiment:'facade-vector-pilot',model,index,arm,...(effort?{effort}:{})}});
 await save(file,receipt);
 const text=arm==='svg'?svgPrompt.replace('{WIDTH}',String(e.originalWidth)).replace('{HEIGHT}',String(e.originalHeight)):
  basePrompt+'\n'+structuredPrompt+(arm==='assisted'?'\n'+assistPrompt:'');
 const started=performance.now();
 try{
  let raw:any;
  if(local){
   const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(360000),body:JSON.stringify({model:model.slice(6),stream:false,think:false,keep_alive:'20m',...(arm==='svg'?{}:{format:FACADE_SVG_JSON_SCHEMA}),options:{temperature:0,...experiment.localOptions},messages:[{role:'user',content:text,images:images.map(b=>b.toString('base64'))}]})});
   raw=await response.json();receipt.httpStatus=response.status;receipt.rawResponse=raw;await save(file,receipt);if(!response.ok)throw Error(`Local HTTP${response.status}`);
   receipt.output=raw.message?.content;receipt.usage={prompt_tokens:raw.prompt_eval_count,completion_tokens:raw.eval_count,cost:0,totalDurationMs:raw.total_duration/1e6,loadDurationMs:raw.load_duration/1e6};receipt.finishReason=raw.done_reason;
  }else{
   const content:any[]=[{type:'text',text},...images.map((b,i)=>({type:'image_url',image_url:{url:`data:${i?'image/png':'image/jpeg'};base64,${b.toString('base64')}`}}))];
   const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},signal:AbortSignal.timeout(240000),body:JSON.stringify({model,...(effort?{}:{temperature:0}),max_tokens:8192,reasoning:reasoningConfig,provider:{sort:'price',max_price:experiment.providerPriceCap},...(arm==='svg'?{}:{response_format:{type:'json_object'}}),...(effort?{stream:true,stream_options:{include_usage:true}}:{}),messages:[{role:'user',content}]})});
   receipt.httpStatus=response.status;
   if(effort&&response.ok){
    raw=await readChatStream(response.body,async(id:string)=>{receipt.generationId=id;await save(file,receipt);});
    receipt.output=raw.content;receipt.usage=raw.usage;receipt.finishReason=raw.finishReason;
    receipt.streamSummary={generationId:raw.generationId,reasoningCharacters:raw.reasoning.length,providerError:raw.providerError};
   }else{
    raw=await response.json();receipt.rawResponse=raw;receipt.usage=raw.usage;receipt.generationId=raw.id;
   }
   await save(file,receipt);
   let cost=raw.usage?.cost;
   if(!response.ok&&!raw.id&&[400,401,402,403,404,422,429].includes(response.status))cost=0;
   if(!Number.isFinite(cost)&&receipt.generationId){const result=await lookupCompletedCost(receipt.generationId);receipt.generationLookup=result.lookup;cost=result.cost;}
   receipt.settlement=await budget.settle(receipt.reservation,cost,{generationId:receipt.generationId});receipt.actualCostUsd=cost;await save(file,receipt);
   if(!Number.isFinite(cost)||receipt.settlement.exceededCeiling)throw Error('Unresolved charge or budget exceeded');
   if(!response.ok||raw.error||raw.providerError)throw Error(`Provider HTTP${response.status}: ${JSON.stringify(raw.error??raw.providerError)}`);
   if(!effort){receipt.output=raw.choices?.[0]?.message?.content;receipt.finishReason=raw.choices?.[0]?.finish_reason;}
  }
  receipt.clientLatencyMs=Math.round(performance.now()-started);
  if(receipt.finishReason==='length')throw Error('Output truncated at token limit');
  const output=String(receipt.output??'').trim().replace(/^```(?:json|svg|xml)?\s*/,'').replace(/\s*```$/,'');
  let svg:string;
  if(arm==='svg'){
   const cleaned=spawnSync('python3',['scripts/facade-eval/sanitize_facade_svg.py',String(e.originalWidth),String(e.originalHeight),'--native'],{input:output,encoding:'utf8',maxBuffer:1024*1024});
   if(cleaned.status!==0)throw Error('SVG rejected: '+cleaned.stderr.split('\n').slice(-3).join(' '));svg=cleaned.stdout;
  }else{
   const description=validateFacadeSvgExperiment(JSON.parse(output));receipt.description=description;
   receipt.sourceFeatures=toSourceFacadeFeatures(description,{width:e.originalWidth,height:e.originalHeight});
   svg=renderFacadeSvg(description,{width:e.originalWidth,height:e.originalHeight});
  }
  const svgFile=out+`/${index}-${arm}.svg`,pngFile=out+`/${index}-${arm}.png`;
  await fs.writeFile(svgFile,svg);await sharp(Buffer.from(svg)).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).flatten({background:'#ece9e2'}).png().toFile(pngFile);
  receipt.svgPath=svgFile;receipt.pngPath=pngFile;receipt.svgSha256=sha(svg);receipt.pngSha256=sha(await fs.readFile(pngFile));receipt.status='rendered';
 }catch(error:any){
  if(!local&&effort&&receipt.generationId&&!receipt.settlement){
   try{
    const result=await lookupCompletedCost(receipt.generationId);receipt.generationLookup=result.lookup;
    if(Number.isFinite(result.cost)){receipt.settlement=await budget.settle(receipt.reservation,result.cost,{generationId:receipt.generationId});receipt.actualCostUsd=result.cost;}
   }catch(lookupError:any){receipt.generationLookupError=lookupError.message;}
  }
  receipt.status='failed';receipt.error=error.message;receipt.clientLatencyMs=Math.round(performance.now()-started);
 }
 await save(file,receipt);receipts.push(receipt);await save(out+'/report.json',{experimentHash,model,receipts});
 console.log(JSON.stringify({index,arm,status:receipt.status,ms:receipt.clientLatencyMs,cost:receipt.actualCostUsd??receipt.usage?.cost,error:receipt.error}));
 if(!local&&receipt.reservation&&!receipt.settlement)throw Error('Unresolved paid request; stop and reconcile');
}
await save(out+'/report.json',{experimentHash,model,receipts});
