/** Bounded experimental routing proposals for immutable compact inputs.
 * Default is a dry run. --run uses the global atomic journal and never publishes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { globalBudget } from '../da-costa-block/global-budget.mjs';
import { planRoutingInputs } from './prepare-routing-inputs.mjs';
import { atomicJson } from '../da-costa-block/pipeline-state.mjs';

const args=process.argv.slice(2),flag=name=>args.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3),model=flag('model')??'google/gemini-3.1-flash-lite';
const limit=Number(flag('limit')??20),runCeiling=Number(flag('budget-usd')??.04),reservationUsd=.002,maxTokens=220;
if(!Number.isInteger(limit)||limit<1||limit>1000||!Number.isFinite(runCeiling)||runCeiling<=0)throw Error('Limit must be 1–1000 and budget must be positive');
const reusedIds=new Set(flag('reuse-result-ids')?JSON.parse(await fs.readFile(flag('reuse-result-ids'),'utf8')):[]);
const plan=await planRoutingInputs(args),inputManifest=JSON.parse(await fs.readFile(path.join(plan.outputRoot,'manifest.json'),'utf8')),onlyStreets=flag('only-streets')?.split(',').map(value=>value.trim()),selected=inputManifest.items.filter(item=>(!onlyStreets||onlyStreets.includes(item.street))&&!reusedIds.has(item.id)).sort((a,b)=>b.wallWidthM-a.wallWidthM||a.id.localeCompare(b.id)).slice(0,limit);
const schema={type:'object',additionalProperties:false,required:['family','wallMaterial','wallColour','groundType','upperUsable','groundUsable','exception','signText','signTextEligible','evidence'],properties:{
  family:{type:'string',enum:['historic-narrow','apartment-row','institutional','modern','warehouse-workshop','other','unknown']},wallMaterial:{type:'string',enum:['brick','plaster','stone','concrete','panels','glass','mixed','unknown']},wallColour:{type:'string',enum:['brown','red','buff','grey','white','black','other','unknown']},groundType:{type:'string',enum:['residential','storefront','mixed','other','unknown']},upperUsable:{type:'string',enum:['yes','partial','no']},groundUsable:{type:'string',enum:['yes','partial','no']},exception:{type:'string',enum:['ordinary','distinctive-colour','irregular-openings','institutional-scale','obscured','other','unknown']},signText:{type:'string'},signTextEligible:{type:'string',enum:['yes','no','unknown']},evidence:{type:'string'}}};
const prompt='Inspect only the target Amsterdam facade shown in two source-bound crops: full facade, then ground floor. They may have different capture dates. Return conservative routing fields, not precise geometry. Do not infer hidden roofs, unseen materials, or details from the address. wallColour means dominant upper wall, excluding windows and ground-floor paint. groundType storefront requires visible commercial display/service frontage; obstruction means unknown. exception identifies whether richer follow-up may add value. signText is literal, legibly visible business or shop name text on THIS target wall only; never include neighbouring shops, street signs, traffic signs, or text guessed from the address. Use an empty signText when no such text is legibly visible. signTextEligible is yes when target-wall business/shop name text is legible, no when the target wall clearly has no signage, and unknown when signage may be obscured. Use unknown when pixels do not support a field. Return JSON only.';
const output=path.join(plan.outputRoot,'machine-routing'),reportPath=path.join(output,'results.json'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
let report={version:1,inputSetHash:plan.inputSetHash,model,promptSha256:hash(prompt),schemaSha256:hash(JSON.stringify(schema)),results:[]};
try{const previous=JSON.parse(await fs.readFile(reportPath,'utf8'));if(previous.inputSetHash!==report.inputSetHash||previous.model!==model||previous.promptSha256!==report.promptSha256||previous.schemaSha256!==report.schemaSha256)throw Error('Existing routing run has different immutable inputs');report=previous;}catch(error){if(error.code!=='ENOENT')throw error;}
const observed=()=>report.results.reduce((sum,item)=>sum+(Number.isFinite(item.usage?.cost)?item.usage.cost:item.reservedUsd),0);
const authorizationFile=flag('authorization-file');
const authorization=authorizationFile?JSON.parse(await fs.readFile(authorizationFile,'utf8')):null;
if(authorization&&(!Number.isFinite(authorization.baselineUsd)||authorization.baselineUsd<0||!Number.isFinite(authorization.additionalLimitUsd)||authorization.additionalLimitUsd<=0||authorization.additionalLimitUsd>1))throw Error('Invalid additional inference authorization');
const cumulativeCeiling=authorization?Math.min(5,authorization.baselineUsd+authorization.additionalLimitUsd):5;
const budget=globalBudget({ceiling:cumulativeCeiling}),snapshot=await budget.snapshot();if(snapshot.entries.some(entry=>entry.status==='unknown'))throw Error('Unresolved global charge');
const summary={inputSetHash:plan.inputSetHash,model,frontages:selected.length,maxRequests:selected.length,reservationPerRequestUsd:reservationUsd,runCeilingUsd:runCeiling,currentGlobalUsd:snapshot.observedOrReservedCostUsd,cumulativeCeilingUsd:cumulativeCeiling,paidCalls:args.includes('--run')?'bounded-run':'dry-run'};
if(!args.includes('--run')){console.log(JSON.stringify(summary,null,2));process.exit(0);}
dotenv.config({path:flag('env-file')??'.cache/facade-rebuild/openrouter-private.env',quiet:true});if(!process.env.OPENROUTER_API_KEY)throw Error('Missing OpenRouter credential');
await budget.assertReady();const catalogResponse=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(20000)});if(!catalogResponse.ok)throw Error('Model catalog unavailable');
const info=(await catalogResponse.json()).data.find(item=>item.id===model);if(!info?.architecture?.input_modalities?.includes('image'))throw Error('Requested vision model unavailable');
await fs.mkdir(output,{recursive:true});
for(const item of selected){
  const images=await Promise.all(['full','ground'].map(async kind=>{const meta=item.images[kind],bytes=await fs.readFile(path.join(plan.outputRoot,'images',meta.file));if(hash(bytes)!==meta.sha256)throw Error(`Compact input changed: ${meta.file}`);return{kind,meta,bytes};}));
  const key=hash(JSON.stringify({version:1,inputSetHash:plan.inputSetHash,id:item.id,model,prompt,schema,maxTokens,images:images.map(value=>value.meta.sha256)}));if(report.results.some(result=>result.key===key))continue;
  if(observed()+reservationUsd>runCeiling+1e-12)throw Error(`Routing run reservation exceeds its $${runCeiling} ceiling`);
  const globalReservationId=await budget.reserve({key,sourceLedger:reportPath,reservedUsd:reservationUsd,metadata:{areaId:plan.area.id,stage:'compact-facade-routing',frontageId:item.id,model}});
  const result={key,id:item.id,buildingId:item.buildingId,model,status:'pending',reservedUsd:reservationUsd,globalReservationId,requestImages:images.map(value=>({kind:value.kind,sha256:value.meta.sha256,bytes:value.bytes.length})),startedAt:new Date().toISOString()};report.results.push(result);await atomicJson(reportPath,report);
  try{const content=[{type:'text',text:prompt},...images.map(value=>({type:'image_url',image_url:{url:`data:image/jpeg;base64,${value.bytes.toString('base64')}`}}))];
    const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal:AbortSignal.timeout(90000),headers:{'content-type':'application/json',authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`},body:JSON.stringify({model,temperature:0,max_tokens:maxTokens,reasoning:{enabled:false},provider:{require_parameters:true,sort:'price'},response_format:{type:'json_schema',json_schema:{name:'facade_router',strict:true,schema}},messages:[{role:'user',content}]})});
    const value=await response.json();if(!response.ok)throw Error(`Inference HTTP ${response.status}`);result.usage=value.usage;result.generationId=value.id;result.responseModel=value.model;result.proposal=JSON.parse(value.choices[0].message.content);
    if(Object.entries(schema.properties).some(([key,property])=>property.enum&&!property.enum.includes(result.proposal[key]))||typeof result.proposal.evidence!=='string'||typeof result.proposal.signText!=='string')throw Error('Invalid proposal schema');result.status='ok';
  }catch(error){result.status='error';result.error=String(error);}result.completedAt=new Date().toISOString();await atomicJson(reportPath,report);
  const settlement=await budget.settle(globalReservationId,result.usage?.cost,{generationId:result.generationId});await atomicJson(reportPath,report);
  console.log(JSON.stringify({id:item.id,status:result.status,cost:result.usage?.cost,runTotalUsd:observed()}));
  if(!Number.isFinite(result.usage?.cost))throw Error('Unknown charge retained; stopping');if(observed()>runCeiling+1e-12)throw Error('Actual routing spend exceeded run ceiling; stopping');if(settlement.exceededCeiling)throw Error('Global spend exceeded authorization; stopping');
}
console.log(JSON.stringify({...summary,completed:report.results.filter(item=>item.status==='ok').length,observedUsd:observed(),reportPath},null,2));
