/** Four explicitly budgeted image-layer trials; resumable receipts, no game publication. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import dotenv from 'dotenv';
import {globalBudget} from '../da-costa-block/global-budget.mjs';
const root='.cache/facade-assessment/block-assemblies-v1';
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const save=async(p:string,v:any)=>{await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p+'.tmp',JSON.stringify(v,null,2)+'\n');await fs.rename(p+'.tmp',p);};
const unknown='request:068099f48543ee8fad1e83e3db344e72d3c28aeec9c35cb0f3e2410e38121068';
const old=JSON.parse(await fs.readFile('.cache/facade-assessment/vector-pilot/authorization.json','utf8'));
const authorization={id:'whole-block-assemblies-approved-2026-09-27',source:'User: Implement the plan. Approved plan includes $2 maximum additional API experiment spend.',maxCeilingUsd:old.maxCeilingUsd+2,scopedContinuation:{id:'whole-block-assemblies-v1',source:'Approved whole-block extraction implementation, $2 additional maximum.',maxNewReservationsUsd:2,maxRequests:10,acknowledgedUnknownIds:[unknown]}};
await save(root+'/authorization.json',authorization);
const budget=globalBudget({ceiling:authorization.maxCeilingUsd,authorization,acknowledgedUnknownIds:[unknown]});
dotenv.config({path:'.cache/facade-rebuild/openrouter-private.env',quiet:true});
const input=await fs.readFile('.cache/facade-assessment/banana-head-on-v1/strip1.png');
const previous=JSON.parse(await fs.readFile('.cache/facade-assessment/banana-head-on-v1/strip1.json','utf8'));
if(previous.pngSha256!==sha(input))throw Error('Input receipt mismatch');
const prompts={
 clean:'Edit this architectural elevation into a clean base-colour layer for 3D reconstruction. Preserve EXACT canvas composition, building widths, roof silhouettes, every opening location and size, trim, wall colours, material bands and shop layout. Remove ALL projecting balcony railings, balcony slabs, brackets and their drawn shadows/perspective; reconstruct the complete unobstructed window/door behind each removed balcony, using the aligned upper opening. Remove only projecting objects, not their associated opening. Remove baked side-reveal perspective at entrances: show each entire door and arched transom front-on within the same fixed outer mouth. Do not add or move windows or doors. No missing lower window panes, no grey rectangular patches, no outlines of removed rails. Flat even illumination; no cast shadows or directional shading. Preserve exact input framing and white sky. Return only the aligned clean colour image, no captions or grid.',
 masks:'Segment this exact architectural elevation into a flat semantic mask. Preserve EXACT canvas framing and pixel locations; do not redraw, straighten, beautify or invent architecture. Encode visible components using these exact solid RGB colours: masonry wall #FFFF00, window/door glazing #FF0000, pedestrian entrance including door leaves #FF8000, balcony railing #8000FF, balcony slab/bracket #FF00FF, entrance side/top reveal #00FFFF, roof #0000FF, awning #008000, foreground stone post #808080, sky #FFFFFF, other/uncertain #000000. No gradients, shadows, antialias decoration, labels or borders. Every component stays where it is in the original; separate railing from glazing behind it. Return only mask image.'
};
const jobs=[{model:'microsoft/mai-image-2.6',provider:'azure',name:'mai'},{model:'google/gemini-3-pro-image',provider:'google-ai-studio/global',name:'banana'}];
for(const job of jobs){
 if(process.argv.includes('--banana-only')&&job.name!=='banana')continue;
 const endpoint=await fetch(`https://openrouter.ai/api/v1/images/models/${job.model}/endpoints`,{signal:AbortSignal.timeout(20000)});if(!endpoint.ok)throw Error('Endpoint discovery failed');const catalog=await endpoint.json();await save(root+`/${job.name}-endpoints.json`,catalog);
 const provider=catalog.endpoints?.find((p:any)=>p.provider_tag===job.provider);if(!provider||!provider.supported_parameters?.input_references||provider.supported_parameters.n?.max!==1||!provider.pricing?.every((p:any)=>Number.isFinite(p.cost_usd)&&p.cost_usd<=.00012))throw Error('Unsupported/changed endpoint');
 for(const [arm,prompt]of Object.entries(prompts)){
  const revision=job.name==='mai'&&arm==='clean'?'-v2':'';
  const file=root+`/${job.name}-${arm}${revision}.json`,key=sha(JSON.stringify({job,arm,prompt,input:sha(input),revision}));
  try{const receipt=JSON.parse(await fs.readFile(file,'utf8'));if(receipt.key!==key||receipt.status!=='ok'||sha(await fs.readFile(root+'/'+receipt.pngPath))!==receipt.pngSha256)throw Error('Changed or unfinished receipt; do not replay');console.log('reuse',job.name,arm);continue;}catch(e:any){if(e.code!=='ENOENT')throw e;}
  if(!process.argv.includes('--run')){console.log('dry-run',job.name,arm);continue;}
  if(!process.env.OPENROUTER_API_KEY)throw Error('Missing credential');
  const reservation=await budget.reserve({key,sourceLedger:file,reservedUsd:.2,metadata:{model:job.model,experiment:'block-assemblies-v1',arm}});
  const record:any={key,reservation,status:'requesting',model:job.model,arm,prompt,inputSha256:sha(input),startedAt:new Date().toISOString()};await save(file,record);const start=performance.now();
  try{
   const body=JSON.stringify({model:job.model,prompt,n:1,aspect_ratio:'16:9',...(job.name==='banana'?{resolution:'2K'}:{}),provider:{only:[job.provider],allow_fallbacks:false},input_references:[{type:'image_url',image_url:{url:'data:image/png;base64,'+input.toString('base64')}}]});
   const response=await fetch('https://openrouter.ai/api/v1/images',{method:'POST',headers:{'content-type':'application/json','content-length':String(Buffer.byteLength(body)),authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},signal:AbortSignal.timeout(240000),body});
   const raw=await response.json();await save(root+`/${job.name}-${arm}${revision}-response.json`,raw);record.latencyMs=Math.round(performance.now()-start);record.generationId=raw.id;let cost=raw.usage?.cost;if(!response.ok&&!raw.id&&[400,401,402,403,404,422,429].includes(response.status))cost=0;
   record.actualCostUsd=cost;record.settlement=await budget.settle(reservation,cost,{generationId:raw.id});await save(file,record);
   if(!response.ok||!Number.isFinite(cost)||cost>.2||record.settlement.exceededCeiling)throw Error('API failed or charge unresolved/exceeded');
   if(raw.data?.length!==1||!raw.data[0].b64_json)throw Error('Missing output');const png=await sharp(Buffer.from(raw.data[0].b64_json,'base64')).png().toBuffer();const meta=await sharp(png).metadata();record.pngPath=`${job.name}-${arm}.png`;record.pngSha256=sha(png);record.width=meta.width;record.height=meta.height;await fs.writeFile(root+'/'+record.pngPath,png);record.status='ok';
  }catch(e){record.error=String(e);record.status='failed';if(!record.settlement)record.settlement=await budget.settle(reservation,undefined);await save(file,record);throw e;}
  await save(file,record);console.log(JSON.stringify({job:job.name,arm,cost:record.actualCostUsd,latencyMs:record.latencyMs}));
 }
}
