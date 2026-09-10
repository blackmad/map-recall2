import crypto from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const arg=(name:string)=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const panels=path.resolve(arg('panels') ?? '.cache/facade-rebuild/reports/expansion-grid-review-panels-02');
const output=path.resolve(arg('out') ?? '.cache/facade-rebuild/reports/expansion-grid-llm-critique-01');
const provider=arg('provider') ?? 'ollama';
const models=(arg('models') ?? (provider==='ollama'?'qwen2.5vl:7b,gemma3:4b':'google/gemini-3.1-pro-preview,anthropic/claude-sonnet-4.6')).split(',').filter(Boolean);
if(!['ollama','openrouter'].includes(provider))throw Error('provider must be ollama or openrouter');
if(provider==='openrouter'&&!process.env.OPENROUTER_API_KEY)throw Error('OPENROUTER_API_KEY is required for the OpenRouter critic');

const schema={type:'object',additionalProperties:false,required:['targetVisible','facadeOwnership','observedTruePositiveIds','inferredSupportedIds','likelyFalsePositiveIds','missedOpenings','estimatedVisibleOpeningCount','familyAssessment','gridAssessment','recommendedAction','completenessScore','precisionScore','confidence','rationale'],properties:{
  targetVisible:{type:'boolean'},facadeOwnership:{type:'string',enum:['coherent','ambiguous','wrong-wall']},
  observedTruePositiveIds:{type:'array',maxItems:100,items:{type:'string'}},inferredSupportedIds:{type:'array',maxItems:100,items:{type:'string'}},likelyFalsePositiveIds:{type:'array',maxItems:100,items:{type:'string'}},
  missedOpenings:{type:'array',maxItems:30,items:{type:'object',additionalProperties:false,required:['location','reason','visibility'],properties:{location:{type:'string'},reason:{type:'string'},visibility:{type:'string',enum:['visible','partial','occluded-inferred']}}}},
  estimatedVisibleOpeningCount:{type:'integer',minimum:0,maximum:100},familyAssessment:{type:'string'},gridAssessment:{type:'string'},
  recommendedAction:{type:'array',items:{type:'string'}},completenessScore:{type:'number',minimum:0,maximum:1},precisionScore:{type:'number',minimum:0,maximum:1},confidence:{type:'number',minimum:0,maximum:1},rationale:{type:'string'}
}};
const prompt=`Act as a strict facade-opening detection critic. The panel has the clean rectified source on the LEFT and the same source with labelled boxes on the RIGHT. Cyan means observed and rendered, amber means inferred and rendered, purple means partial, red means omitted or needs review. Review only the intended central facade; ignore neighboring buildings. Count windows and doors as architectural openings, treating paired panes inside one outer frame as one opening. Check every labelled ID against pixels. Find visible, partial, or strongly grid-implied missed openings. A regular grid may justify an occluded inferred cell, but do not hallucinate behind opaque walls or extend into another building. Explain whether window families differ in size or height. Use IDs exactly as supplied in the machine inventory. Put cyan or purple IDs only in observedTruePositiveIds, amber IDs only in inferredSupportedIds, and any supplied ID in likelyFalsePositiveIds. A missed opening has no supplied ID: describe its image location, never an existing ID. Scores must be decimals from 0 to 1. Scores are visual estimates, not acceptance. Return only the required JSON.`;
const promptSha256=crypto.createHash('sha256').update(prompt).digest('hex');
const manifestBytes=await readFile(path.join(panels,'manifest.json'));
type InventoryItem={id:string;status:'observed'|'inferred'|'partial'|'review';kind:string;box:number[]};
type PanelRecord={pandId:string;address:string;file:string;sha256:string;openingInventory?:InventoryItem[]};
const manifest=JSON.parse(manifestBytes.toString()) as {records:Array<PanelRecord>};
await mkdir(output,{recursive:false});
let observedCostUsd=0;const results:unknown[]=[];

const unique=(values:unknown)=>[...new Set(Array.isArray(values)?values.filter((value):value is string=>typeof value==='string'):[])];
const unitScore=(value:unknown)=>{const score=Number(value);return Number.isFinite(score)?Math.max(0,Math.min(1,score>1?score/100:score)):0};

function validateLabel(label:any,record:PanelRecord){
  const inventory=record.openingInventory ?? [];const byId=new Map(inventory.map(item=>[item.id,item]));
  const observed=new Set(inventory.filter(item=>item.status==='observed'||item.status==='partial').map(item=>item.id));
  const inferred=new Set(inventory.filter(item=>item.status==='inferred').map(item=>item.id));
  const issues:string[]=[];
  const exact=(field:string,allowed:Set<string>)=>{
    const values=unique(label[field]);const unknown=values.filter(id=>!byId.has(id));
    const wrong=values.filter(id=>byId.has(id)&&!allowed.has(id));
    if(unknown.length)issues.push(`${field}: ${unknown.length} unknown IDs (${unknown.slice(0,5).join(', ')}${unknown.length>5?', …':''})`);
    if(wrong.length)issues.push(`${field}: ${wrong.length} IDs in wrong status category (${wrong.slice(0,5).map(id=>`${id}:${byId.get(id)?.status}`).join(', ')}${wrong.length>5?', …':''})`);
    return values.filter(id=>byId.has(id)&&allowed.has(id));
  };
  const missed=(Array.isArray(label.missedOpenings)?label.missedOpenings:[]).filter((item:any)=>{
    if(byId.has(item?.location)){issues.push(`missedOpenings: ${item.location} is an existing candidate ID`);return false;}
    return item&&typeof item.location==='string';
  });
  return {label:{...label,
    observedTruePositiveIds:exact('observedTruePositiveIds',observed),
    inferredSupportedIds:exact('inferredSupportedIds',inferred),
    likelyFalsePositiveIds:exact('likelyFalsePositiveIds',new Set(byId.keys())),missedOpenings:missed,
    completenessScore:unitScore(label.completenessScore),precisionScore:unitScore(label.precisionScore),confidence:unitScore(label.confidence)},
    validationIssues:issues};
}

async function classify(model:string,image:Buffer,record:PanelRecord){
  const encoded=image.toString('base64');const started=performance.now();
  const inventoryPrompt=`\n\nMachine inventory for ${record.address}: ${JSON.stringify(record.openingInventory ?? [])}`;
  if(provider==='ollama'){
    const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',signal:AbortSignal.timeout(180_000),headers:{'content-type':'application/json'},body:JSON.stringify({model,stream:false,format:schema,options:{temperature:0,num_ctx:8192},messages:[{role:'user',content:prompt+inventoryPrompt,images:[encoded]}]})});
    const body=await response.json() as {message?:{content?:string};error?:string;prompt_eval_count?:number;eval_count?:number};
    if(!response.ok)throw Error(`${model}: ${body.error ?? `HTTP ${response.status}`}`);
    const modelLabel=JSON.parse(body.message?.content ?? '{}');const validated=validateLabel(modelLabel,record);
    return {...validated,modelLabel,elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(3)),usage:{promptTokens:body.prompt_eval_count,completionTokens:body.eval_count},raw:body.message?.content};
  }
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'content-type':'application/json','http-referer':'https://github.com/map-recall','x-title':'Map Recall opening critic'},body:JSON.stringify({model,temperature:0,max_tokens:3000,reasoning:{effort:'medium'},provider:{require_parameters:true},response_format:{type:'json_schema',json_schema:{name:'opening_critique',strict:true,schema}},messages:[{role:'user',content:[{type:'text',text:prompt+inventoryPrompt},{type:'image_url',image_url:{url:`data:image/png;base64,${encoded}`}}]}]})});
  const body=await response.json() as {choices?:Array<{message?:{content?:string}}> ;usage?:{cost?:number};error?:{message?:string}};
  if(!response.ok)throw Error(`${model}: ${body.error?.message ?? `HTTP ${response.status}`}`);
  observedCostUsd+=Number(body.usage?.cost ?? 0);
  const raw=body.choices?.[0]?.message?.content ?? '{}';const modelLabel=JSON.parse(raw);const validated=validateLabel(modelLabel,record);
  return{...validated,modelLabel,elapsedSeconds:Number(((performance.now()-started)/1000).toFixed(3)),usage:body.usage,raw};
}

for(const record of manifest.records){
  const image=await readFile(path.join(panels,record.file));
  if(crypto.createHash('sha256').update(image).digest('hex')!==record.sha256)throw Error(`Panel changed: ${record.file}`);
  const critiques=[];
  for(const model of models){
    try{const critique=await classify(model,image,record);critiques.push({model,...critique});process.stdout.write(`${record.address} · ${model}: ${critique.label.estimatedVisibleOpeningCount} openings, completeness ${critique.label.completenessScore}, ${critique.validationIssues.length} validation issues\n`);}
    catch(error){critiques.push({model,error:String(error)});process.stdout.write(`${record.address} · ${model}: ${String(error)}\n`);}
  }
  results.push({pandId:record.pandId,address:record.address,panel:record.file,panelSha256:record.sha256,critiques});
}
const report={schemaVersion:1,generatedAt:new Date().toISOString(),provider,models,prompt,promptSha256,sourcePanels:path.relative(process.cwd(),panels),sourceManifestSha256:crypto.createHash('sha256').update(manifestBytes).digest('hex'),observedCostUsd,results,policy:{reviewStatus:'machine-proposal',acceptedForNow:false,note:'Multimodal critiques guide development and annotation. Model agreement does not establish an opening or facade identity.'}};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const cards=(results as any[]).map(result=>`<article><h2>${result.address}</h2><img src="../${path.basename(panels)}/${result.panel}">${result.critiques.map((item:any)=>item.label?`<section><h3>${item.model}</h3><p>${item.label.estimatedVisibleOpeningCount} visible openings · completeness ${item.label.completenessScore} · precision ${item.label.precisionScore} · confidence ${item.label.confidence}</p><p><strong>Missed:</strong> ${item.label.missedOpenings.map((miss:any)=>`${miss.location} (${miss.visibility})`).join('; ')||'none'}</p><p><strong>False positives:</strong> ${item.label.likelyFalsePositiveIds.join(', ')||'none'}</p><p><strong>Validation:</strong> ${item.validationIssues.join('; ')||'clean'}</p><p>${item.label.gridAssessment}</p><ul>${item.label.recommendedAction.map((action:string)=>`<li>${action}</li>`).join('')}</ul></section>`:`<section><h3>${item.model}</h3><p>${item.error}</p></section>`).join('')}</article>`).join('');
await writeFile(path.join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening detection critic</title><style>body{font:14px system-ui;margin:24px;background:#eeeae2;color:#24332d}main{max-width:1400px;margin:auto}article{background:#fff;border:1px solid #ccd2cd;padding:18px;margin:18px 0}img{max-width:100%;max-height:720px;display:block;margin:auto}section{border-top:1px solid #ddd;margin-top:12px}p,li{line-height:1.45}</style><main><h1>Multimodal opening-detection critique</h1><p>Machine proposals for development. No critique is accepted ground truth.</p>${cards}</main></html>`);
console.log(output);
