/** Small, resumable image experiments. All configurations share one spend ledger. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { globalBudget, DEFAULT_BUDGET_LEDGER, LEGACY_BUDGET_LEDGER } from './global-budget.mjs';
const arg=(n,d)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const root=arg('root','.cache/da-costa-neighbourhood'), mode=arg('mode','multi');
const model=arg('model','google/gemini-3.1-flash-lite'), limit=Number(arg('limit','100'));
dotenv.config({path:arg('env-file','.cache/facade-rebuild/openrouter-private.env'),quiet:true});
// Explicit task budget supersedes an older local credential-file default.
const ceiling=Math.min(5,Number(arg('budget-usd',process.env.OPENROUTER_SPEND_LIMIT_USD||'3')));
if(!Number.isFinite(ceiling)||ceiling<=0||!['full','multi','aerial','roof'].includes(mode))throw Error('Invalid budget or mode');
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
export const fields={
  family:['historic-narrow','apartment-row','institutional','modern','warehouse-workshop','other','unknown'],
  wallMaterial:['brick','plaster','stone','concrete','panels','glass','mixed','unknown'],
  wallColour:['brown','red','buff','grey','white','black','other','unknown'],
  shopfront:['yes','no','unknown'],awning:['yes','no','unknown'],
  groundUsable:['yes','partial','no'],wholeUsable:['yes','partial','no'],
  roofShape:['flat','pitched-gable','hipped','mansard','complex','unknown'],
  facadeTop:['straight','stepped','bell','neck','pointed','unknown'],
  roofMaterial:['tile-red','tile-dark','slate','metal','bitumen','other','unknown'],
  roofVisible:['yes','partial','no'],
};
const roofFields={roofShape:[...fields.roofShape,'flat-with-front-pitch'],roofMaterial:fields.roofMaterial,roofVisible:fields.roofVisible,facadeTop:fields.facadeTop};
const outputFields=mode==='roof'?roofFields:fields;
const schema=mode==='roof'?{type:'object',additionalProperties:false,required:[...Object.keys(roofFields),'evidence'],properties:{...Object.fromEntries(Object.entries(roofFields).map(([k,v])=>[k,{type:'string',enum:v}])),evidence:{type:'string'}}}:{type:'object',additionalProperties:false,required:[...Object.keys(fields),'visibleSignText','storefrontColour'],properties:{...Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{type:'string',enum:v}])),visibleSignText:{type:'string'},storefrontColour:{type:'string',enum:['red','green','blue','black','white','grey','brown','other','unknown']}}};
const prompt='Describe only the TARGET central building facade in these Amsterdam municipal street images. Images are: full-height wall, then (if present) close ground floor, then roof/top detail. These can be different dates. Report only visible evidence, no invented tenant names or hidden roofs. All crops target the same wall, but placement is provisional: return unknown when another building intrudes or target is ambiguous. A historic building can contain a shop. Commercial display windows, services, grocery, cafe, bar, salon and a shop entrance all count as shopfront even without legible text. Use no only when a usable ground floor visibly lacks a shop; obscured means unknown. Awning means a projecting fabric canopy. Dominant UPPER wall colour excludes glazing and shop paint. Roof shape means roof volume, not decorative facade-top silhouette: a straight cornice can hide a pitched roof. A gable is not proof of roof shape. Separate facadeTop and roofShape, report unknown for hidden roof slopes. Mansard requires visible change of roof slope. Read visibleSignText exactly as visible on the target shop only, or empty string if unreadable; do not infer names from location or context. Ignore text on vehicles and neighbours. Do not complete partial letters into a known business. Return JSON only.';
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json')));
const aerial=['aerial','roof'].includes(mode)?JSON.parse(await fs.readFile(path.join(root,'aerial.json'))).records:[];
const requestPrompt=mode==='roof'?'Identify the roof of the ONE building inside the yellow footprint in image 1 (PDOK 2025 orthophoto). Image 2 shows the street-facing top; image 3 is wider aerial context of the SAME footprint. Determine shape from visible ridge lines and sloping or level planes, not neighbourhood expectations or decorative facade shape. Flat, pitched and mixed forms are all possible. Distinguish neighbouring roofs, shadows, terraces and dormers from main roof surfaces. flat-with-front-pitch means a broad flat roof behind a SINGLE steep street-facing roof apron; a full gable has two opposing slopes; a mansard has a change in pitch angle. Use complex for mixed volumes without a dominant form, and unknown when evidence cannot discriminate. roofVisible describes visibility in EITHER source. facadeTop describes the decorative facade only. Do not infer material from colour alone when tiles or seams cannot be resolved. Give a short evidence sentence citing the visible features supporting the answer and any uncertainty. Return the required JSON.':prompt+(mode==='aerial'?' A FOURTH image is an independent 2025 aerial orthophoto. The yellow polygon marks the target building. Use roof slopes/ridges visible INSIDE that polygon to resolve roofShape and roofMaterial, separating main roof from dormers and rear extensions. Do not classify the neighbouring roof. Overhead visibility may resolve roofVisible even when the street view hides the roof. An aerial ridge is evidence of pitch; a flat facade cornice is not evidence of a flat roof. Keep facadeTop based on the street image. Images do not necessarily depict the same year.':'');
let records=manifest.records;
if(process.argv.includes('--unique-buildings'))records=records.filter((r,i,all)=>all.findIndex(s=>s.buildingId===r.buildingId)===i);
if(process.argv.includes('--spread'))records=Array.from({length:Math.min(limit,records.length)},(_,i)=>records[Math.floor(i*records.length/Math.min(limit,records.length))]);
else records=records.slice(0,limit);
const lock=await fs.open(path.join(root,'inference.lock'),'wx');
const ledgerPath=path.join(root,'spend.json');
// Explicit alternate journal/import paths support isolated tests. Normal runs share
// the canonical city journal and import all existing Da Costa charges, irrespective of --root.
const budget=globalBudget({file:arg('budget-ledger',DEFAULT_BUDGET_LEDGER),ceiling,legacyLedgers:[arg('legacy-budget-ledger',LEGACY_BUDGET_LEDGER),ledgerPath]});
try{
  let ledger={version:1,ceiling,results:[]};
  try{ledger=JSON.parse(await fs.readFile(ledgerPath));}catch(e){if(e.code!=='ENOENT')throw e;}
  ledger.ceiling=ceiling;
  const save=async()=>{await fs.writeFile(ledgerPath+'.tmp',JSON.stringify(ledger,null,2));await fs.rename(ledgerPath+'.tmp',ledgerPath);};
  const cost=()=>ledger.results.reduce((s,r)=>s+(Number.isFinite(r.usage?.cost)?r.usage.cost:r.reservedUsd),0);
  if(ledger.results.some(r=>!Number.isFinite(r.usage?.cost)))throw Error('Unresolved previous charge; reconcile before more calls');
  await budget.assertReady();
  const response=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Catalog unavailable');
  const info=(await response.json()).data.find(m=>m.id===model);
  if(!info?.architecture.input_modalities.includes('image'))throw Error('Vision model unavailable');
  const prices=info.pricing,maxTokens=Number(arg('max-tokens','850'));
  const requestedReasoning=arg('reasoning',null);
  if(requestedReasoning&&!info.reasoning?.supported_efforts?.includes(requestedReasoning))throw Error('Unsupported reasoning effort');
  if(!Number.isInteger(maxTokens)||maxTokens<300||maxTokens>8192)throw Error('Invalid output budget');
  const tiers=[prices,...(prices.overrides||[]).filter(p=>p.min_prompt_tokens<=32768)];
  const inputPrice=Math.max(...tiers.map(p=>Number(p.prompt??prices.prompt)));
  const outputPrice=Math.max(...tiers.map(p=>Number(p.completion??prices.completion)));
  const reservedUsd=32768*inputPrice+maxTokens*outputPrice+Number(prices.request||0)+4*Number(prices.image||0);
  if(!Number.isFinite(reservedUsd)||reservedUsd<=0)throw Error('Unusable pricing');
  for(const r of records){
    const air=aerial.find(a=>a.buildingId===r.buildingId);
    if(['aerial','roof'].includes(mode)&&!air)continue;
    const legacyKey=hash(JSON.stringify({derivation:r.derivationKey,mode,model,prompt:requestPrompt,schema,...(air?{aerialSha256:air.sha256}:{}),...(mode==='roof'?{contextSha256:air.context?.sha256,maxTokens}:{}),...(requestedReasoning?{reasoning:requestedReasoning}:{})}));
    // Preserve paid legacy results; newly issued requests bind the actual resized
    // image bytes and output settings, so preprocessing changes cannot reuse them.
    if(ledger.results.some(x=>x.key===legacyKey&&!x.requestImages))continue;
    const content=[{type:'text',text:requestPrompt}],requestImages=[];
    const inputs=mode==='roof'?[air,r.images.roof,air.context]:mode==='full'?[r.images.full]:[r.images.full,r.images.ground,r.images.roof,...(air?[air]:[])];
    for(const meta of inputs){
      const bytes=await fs.readFile(path.join(root,'images',meta.file));
      if(hash(bytes)!==meta.sha256)throw Error('Source changed');
      const image=await sharp(bytes).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).jpeg({quality:86}).toBuffer();
      requestImages.push({sourceSha256:meta.sha256,requestSha256:hash(image),preprocessingVersion:'fit-1024-jpeg86-v1',sharpVersion:sharp.versions.sharp});
      content.push({type:'image_url',image_url:{url:'data:image/jpeg;base64,'+image.toString('base64')}});
    }
    const key=hash(JSON.stringify({version:2,legacyKey,maxTokens,requestImages}));
    if(ledger.results.some(x=>x.key===key))continue;
    if(cost()+reservedUsd>ceiling)throw Error('Local spend reservation exceeds ceiling');
    const globalReservationId=await budget.reserve({key,sourceLedger:ledgerPath,reservedUsd,metadata:{model,mode,frontageId:r.id}});
    const result={key,legacyKey,id:r.id,derivationKey:r.derivationKey,model,canonicalModel:info.canonical_slug,mode,promptVersion:hash(requestPrompt),aerialSha256:air?.sha256,contextSha256:mode==='roof'?air.context?.sha256:undefined,maxTokens,requestedReasoning,status:'pending',reservedUsd,prices,globalReservationId,requestImages,startedAt:new Date().toISOString()};
    ledger.results.push(result);await save();const start=Date.now();
    try{
      const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(90000),headers:{'content-type':'application/json',authorization:'Bearer '+process.env.OPENROUTER_API_KEY},body:JSON.stringify({model,...(info.supported_parameters.includes('temperature')?{temperature:0}:{}),max_tokens:maxTokens,...(info.supported_parameters.includes('reasoning')?{reasoning:requestedReasoning?{effort:requestedReasoning}:info.reasoning?.mandatory?{effort:'low'}:{enabled:false}}:{}),provider:{require_parameters:true,sort:'price',max_price:{prompt:inputPrice*1e6,completion:outputPrice*1e6,request:Number(prices.request||0),image:Number(prices.image||0)}},response_format:{type:'json_schema',json_schema:{name:'neighbourhood',strict:true,schema}},messages:[{role:'user',content}]})});
      const value=await response.json();if(!response.ok)throw Error('Inference HTTP '+response.status);
      result.usage=value.usage;result.generationId=value.id;result.responseModel=value.model;
      result.proposal=JSON.parse(value.choices[0].message.content);
      if(Object.entries(outputFields).some(([k,v])=>!v.includes(result.proposal[k]))||(mode==='roof'?typeof result.proposal.evidence!=='string':typeof result.proposal.visibleSignText!=='string'||!schema.properties.storefrontColour.enum.includes(result.proposal.storefrontColour)))throw Error('Invalid proposal schema');
      result.status='ok';
    }catch(e){result.status='error';result.error=String(e);}
    result.seconds=(Date.now()-start)/1000;ledger.observedOrReservedCostUsd=cost();await save();
    const settlement=await budget.settle(globalReservationId,result.usage?.cost,{generationId:result.generationId});
    console.log(JSON.stringify({id:r.id,mode,model,status:result.status,cost:result.usage?.cost,total:cost(),proposal:result.proposal}));
    if(!Number.isFinite(result.usage?.cost))throw Error('Unknown charge retained; stopping');
    if(settlement.exceededCeiling)throw Error('Provider cost exceeded reserved ceiling; charge retained and further calls stopped');
  }
}finally{await lock.close();await fs.unlink(path.join(root,'inference.lock'));}
