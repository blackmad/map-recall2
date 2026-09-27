/** Bounded, resumable photo/vector experiment. Never publishes game geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import dotenv from 'dotenv';
import sharp from 'sharp';
import {globalBudget} from '../da-costa-block/global-budget.mjs';
import {FACADE_SVG_JSON_SCHEMA,validateFacadeSvgExperiment,renderFacadeSvg,toSourceFacadeFeatures} from '../../src/canalRecall/facade/facadeSvgExperiment.ts';
const arg=(n:string,d:string)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const sha=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const json=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const save=async(p:string,v:any)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p+'.tmp',JSON.stringify(v,null,2)+'\n');await fs.rename(p+'.tmp',p);};
const model=arg('model','local/qwen3.5:9b'),local=model.startsWith('local/');
const indices=arg('indices','0,17,30').split(',').map(Number);
const arms=arg('arms','svg,structured,assisted').split(',');
if(indices.length>30||indices.some(v=>!Number.isInteger(v))||new Set(indices).size!==indices.length||arms.some(a=>!['svg','structured','assisted'].includes(a)))throw Error('Invalid cohort/arms');
const root=path.resolve('.cache/facade-assessment/vector-pilot'),manifestFile=path.resolve(arg('manifest','.cache/facade-assessment/vector-inputs-v1/manifest.json'));
const out=path.resolve(arg('out',`${root}/${model.replaceAll(/[^a-z0-9.-]/gi,'_')}`));
if(!out.startsWith(root+'/'))throw Error('Outputs must remain in vector-pilot cache');
const manifestBytes=await fs.readFile(manifestFile),manifest=JSON.parse(manifestBytes.toString());
const catalog=await json(root+'/catalog.json'),info=local?null:catalog.data.find((m:any)=>m.id===model);
if(!local&&!info?.architecture?.input_modalities.includes('image'))throw Error('Model lacks image capability');
const auth=await json(root+'/authorization.json');
const budget=globalBudget({ceiling:auth.maxCeilingUsd,authorization:auth});
dotenv.config({path:'.cache/facade-rebuild/openrouter-private.env',quiet:true});
if(!local&&!process.env.OPENROUTER_API_KEY)throw Error('Missing OpenRouter credential');
const basePrompt=`Reconstruct the visible architectural facade in this photograph as a flat vector study in source-image coordinates. Canvas coordinates: x and y independently normalized to 0..1000 across the ENTIRE original image, origin top left. Preserve visible positions, proportions, window counts, asymmetry, door versus shop glazing, material changes at the ground floor and visible roof outline. Do not turn this into an idealized generic house. Do not fill hidden areas with invented openings. Do not draw cars or vegetation as architectural features. Mark uncertainty. This is an unregistered crop: no metric dimensions or verified building identity are supplied. Colour should convey the observed material family; the photo is not calibrated albedo. Do not draw title text, labels or explanatory paragraphs into the image. Avoid decorative detail that prevents completion of the whole visible facade.`;
const svgPrompt=`Return ONLY one complete SVG, no markdown. Root viewBox="0 0 1000 1000", preserveAspectRatio="none". Use only svg,g,rect,path,polygon,polyline,circle,ellipse,line,title,desc,metadata; hex fill/stroke colours or none. No CSS/style, defs,use,images,fonts,external references, scripts or events. Use at most 150 simple elements, no individual bricks, no repetitive embellishments; prioritize completing all main openings. In SVG rect, x/y are position and width/height are SIZE, not right/bottom coordinates. Group elements by walls, windows, doors, storefronts, roof, with data-visibility="observed|inferred|unknown". Describe uncertainty in desc. Keep the drawing inside the canvas. Include the whole visible facade before adding details.`;
const structuredPrompt=`Return ONLY JSON satisfying this schema; no markdown. IMPORTANT: every opening bounds is [x,y,width,height], NOT corner coordinates. Example: left=200 top=300 right=350 bottom=540 must be bounds [200,300,150,240]. Require x+width<=1000 and y+height<=1000. Individual visible openings must have separate bounds; walls may be polygons. Coordinates are integers. Use notes for uncertain/occluded areas; do not mark unseen features observed. Schema: ${JSON.stringify(FACADE_SVG_JSON_SCHEMA)}`;
const assistPrompt=`The second image is an OccFacade segmentation overlay of exactly the same photograph, not another view. It is fallible evidence, not ground truth. ENPC overlay colours: door orange [255,128,0], shop green [0,255,0], balcony purple [128,0,255], window red [255,0,0], wall yellow [255,255,0], sky cyan [128,255,255], roof blue [0,0,255], background black. Use it only where the original photo supports it; reject tree/glass/shop misclassifications. Original-photo coordinates apply to both.`;
let digest=null;if(local){const tags=await(await fetch('http://127.0.0.1:11434/api/tags')).json();digest=tags.models.find((m:any)=>m.name===model.slice(6))?.digest;if(!digest)throw Error('Missing local model');}
const reasoningConfig=info?.reasoning?.mandatory?{effort:"low"}:{enabled:false};
const experiment={version:3,model,modelDigest:digest,basePrompt,svgPrompt,structuredPrompt,assistPrompt,maxTokens:8192,temperature:0,reasoning:local?false:reasoningConfig,localOptions:{num_ctx:16384,num_predict:8192,seed:17},providerPriceCap:{prompt:.5,completion:2,image:.01,request:0},manifestSha256:sha(manifestBytes),runnerSha256:sha(await fs.readFile(new URL(import.meta.url))),rendererSha256:sha(await fs.readFile('src/canalRecall/facade/facadeSvgExperiment.ts')),sanitizerSha256:sha(await fs.readFile('scripts/facade-eval/sanitize_facade_svg.py')),catalogPricing:info?.pricing??null};
const experimentHash=sha(JSON.stringify(experiment));
await fs.mkdir(out,{recursive:true});
try{const old=await json(out+'/experiment.json');if(old.experimentHash!==experimentHash)throw Error('Experiment changed: choose a new output directory');}catch(e:any){if(e.code!=='ENOENT')throw e;await save(out+'/experiment.json',{experimentHash,experiment});}
const receipts:any[]=[];
for(const index of indices)for(const arm of arms){
 const e=manifest.entries.find((v:any)=>v.index===index);if(!e)throw Error(`Missing input ${index}`);
 const inputs=[{path:path.resolve(path.dirname(manifestFile),e.imagePath),sha256:e.imageSha256},...(arm==='assisted'?[{path:path.resolve(path.dirname(manifestFile),e.overlayPath),sha256:e.overlaySha256}]:[])];
 const images=[];for(const input of inputs){const b=await fs.readFile(input.path);if(sha(b)!==input.sha256)throw Error('Input changed');images.push(b);}
 const key=sha(JSON.stringify({experimentHash,index,arm,inputs})),file=out+`/${index}-${arm}.json`;
 try{const old=await json(file);if(old.key!==key)throw Error('Receipt changed');if(old.status==='requesting')throw Error('Unresolved request; reconcile before retry');if(old.status==='rendered'){for(const kind of ['svg','png']){const b=await fs.readFile(old[kind+'Path']);if(sha(b)!==old[kind+'Sha256'])throw Error('Cached render changed; rebuild from saved response without another API call');}}receipts.push(old);console.log(`reuse ${index} ${arm} ${old.status}`);continue;}catch(err:any){if(err.code!=='ENOENT')throw err;}
 const receipt:any={key,experimentHash,index,arm,model,sourceSha256:e.sourceSha256,buildingId:e.buildingId,identity:'crop-owner-not-certified',inputs,startedAt:new Date().toISOString(),status:'requesting',...(local?{actualCostUsd:0}:{})};
 if(!local)receipt.reservation=await budget.reserve({key,sourceLedger:file,reservedUsd:.06,metadata:{experiment:'facade-vector-pilot',model,index,arm}});
 await save(file,receipt);
 const text=basePrompt+'\n'+(arm==='svg'?svgPrompt:structuredPrompt)+(arm==='assisted'?'\n'+assistPrompt:'');
 const started=performance.now();
 try{
  let raw:any;
  if(local){
   const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(360000),body:JSON.stringify({model:model.slice(6),stream:false,think:false,keep_alive:'20m',...(arm==='svg'?{}:{format:FACADE_SVG_JSON_SCHEMA}),options:{temperature:0,...experiment.localOptions},messages:[{role:'user',content:text,images:images.map(b=>b.toString('base64'))}]})});
   raw=await response.json();receipt.httpStatus=response.status;receipt.rawResponse=raw;await save(file,receipt);if(!response.ok)throw Error(`Local HTTP${response.status}`);
   receipt.output=raw.message?.content;receipt.usage={prompt_tokens:raw.prompt_eval_count,completion_tokens:raw.eval_count,cost:0,totalDurationMs:raw.total_duration/1e6,loadDurationMs:raw.load_duration/1e6};receipt.finishReason=raw.done_reason;
  }else{
   const content:any[]=[{type:'text',text},...images.map((b,i)=>({type:'image_url',image_url:{url:`data:${i?'image/png':'image/jpeg'};base64,${b.toString('base64')}`}}))];
   const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},signal:AbortSignal.timeout(240000),body:JSON.stringify({model,temperature:0,max_tokens:8192,reasoning:reasoningConfig,provider:{sort:'price',max_price:experiment.providerPriceCap},...(arm==='svg'?{}:{response_format:{type:'json_object'}}),messages:[{role:'user',content}]})});
   raw=await response.json();receipt.httpStatus=response.status;receipt.rawResponse=raw;receipt.usage=raw.usage;receipt.generationId=raw.id;await save(file,receipt);
   let cost=raw.usage?.cost;
   if(!response.ok&&!raw.id&&[400,401,402,403,404,422,429].includes(response.status))cost=0;
   if(!Number.isFinite(cost)&&raw.id){const r=await fetch(`https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(raw.id)}`,{headers:{authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`}});const g=await r.json();receipt.generationLookup=g;cost=g.data?.total_cost;}
   receipt.settlement=await budget.settle(receipt.reservation,cost,{generationId:raw.id});receipt.actualCostUsd=cost;await save(file,receipt);
   if(!Number.isFinite(cost)||receipt.settlement.exceededCeiling)throw Error('Unresolved charge or budget exceeded');
   if(!response.ok||raw.error)throw Error(`Provider HTTP${response.status}: ${JSON.stringify(raw.error)}`);
   receipt.output=raw.choices?.[0]?.message?.content;receipt.finishReason=raw.choices?.[0]?.finish_reason;
  }
  receipt.clientLatencyMs=Math.round(performance.now()-started);
  if(receipt.finishReason==='length')throw Error('Output truncated at token limit');
  const output=String(receipt.output??'').trim().replace(/^```(?:json|svg|xml)?\s*/,'').replace(/\s*```$/,'');
  let svg:string;
  if(arm==='svg'){
   const cleaned=spawnSync('python3',['scripts/facade-eval/sanitize_facade_svg.py',String(e.originalWidth),String(e.originalHeight)],{input:output,encoding:'utf8',maxBuffer:1024*1024});
   if(cleaned.status!==0)throw Error('SVG rejected: '+cleaned.stderr.split('\n').slice(-3).join(' '));svg=cleaned.stdout;
  }else{
   const description=validateFacadeSvgExperiment(JSON.parse(output));receipt.description=description;
   receipt.sourceFeatures=toSourceFacadeFeatures(description,{width:e.originalWidth,height:e.originalHeight});
   svg=renderFacadeSvg(description,{width:e.originalWidth,height:e.originalHeight});
  }
  const svgFile=out+`/${index}-${arm}.svg`,pngFile=out+`/${index}-${arm}.png`;
  await fs.writeFile(svgFile,svg);await sharp(Buffer.from(svg)).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).flatten({background:'#ece9e2'}).png().toFile(pngFile);
  receipt.svgPath=svgFile;receipt.pngPath=pngFile;receipt.svgSha256=sha(svg);receipt.pngSha256=sha(await fs.readFile(pngFile));receipt.status='rendered';
 }catch(error:any){receipt.status='failed';receipt.error=error.message;receipt.clientLatencyMs=Math.round(performance.now()-started);}
 await save(file,receipt);receipts.push(receipt);await save(out+'/report.json',{experimentHash,model,receipts});
 console.log(JSON.stringify({index,arm,status:receipt.status,ms:receipt.clientLatencyMs,cost:receipt.actualCostUsd??receipt.usage?.cost,error:receipt.error}));
 if(!local&&receipt.reservation&&!receipt.settlement)throw Error('Unresolved paid request; stop and reconcile');
}
await save(out+'/report.json',{experimentHash,model,receipts});
