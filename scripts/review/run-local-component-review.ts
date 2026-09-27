/** Local ID-only classification ablation: coordinates remain immutable. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const root='.cache/facade-assessment/components-v1',file=root+'/qwen-id-review.json';
try{await fs.access(file);throw Error('Existing receipt; do not replay');}catch(e:any){if(e.code!=='ENOENT')throw e;}
const components=await fs.readFile('.cache/facade-assessment/banana-head-on-v1/auto-components-strip1/components.json');
const data=JSON.parse(components.toString());
const candidates=data.features.filter((f:any)=>f.kind!=='window').map((f:any)=>({id:f.id,proposedKind:f.kind,bounds:f.bounds}));
const prompt=`Review these fixed component candidates against this drawing. Bounds are immutable normalized [left,top,right,bottom] across the whole image. Do NOT return new coordinates or invent IDs. For each candidate return {id,decision:"keep"|"reject"|"uncertain",kind:"balcony"|"door"|"unknown",reason:"short visual reason"}. A balcony must show a projecting slab plus rail, not just window mullions. A door must clearly be a pedestrian entrance rather than shop glazing. Return JSON {decisions:[],notes:[]}. Candidates: ${JSON.stringify(candidates)}`;
const image=await sharp(await fs.readFile(data.source.imagePath)).resize({width:1280}).png().toBuffer();
const record:any={status:'running',model:'qwen3.5:9b',componentSha256:createHash('sha256').update(components).digest('hex'),prompt,apiCostUsd:0};
await fs.writeFile(file,JSON.stringify(record,null,2));const start=performance.now();
try{const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(240000),body:JSON.stringify({model:'qwen3.5:9b',stream:false,think:false,format:'json',options:{temperature:0,num_ctx:8192,num_predict:1800},messages:[{role:'user',content:prompt,images:[image.toString('base64')]}]})});
 const raw=await response.json(),result=JSON.parse(raw.message?.content??'null');const ids=new Set(candidates.map((c:any)=>c.id));const decisions=result?.decisions;
 const valid=response.ok&&raw.done_reason!=='length'&&Array.isArray(decisions)&&decisions.length===ids.size&&new Set(decisions.map((d:any)=>d.id)).size===ids.size&&decisions.every((d:any)=>ids.has(d.id)&&['keep','reject','uncertain'].includes(d.decision)&&['balcony','door','unknown'].includes(d.kind));
 Object.assign(record,{status:valid?'candidate':'invalid',latencyMs:Math.round(performance.now()-start),result,raw});
}catch(e){Object.assign(record,{status:'failed',error:String(e),latencyMs:Math.round(performance.now()-start)});}
await fs.writeFile(file,JSON.stringify(record,null,2));console.log({status:record.status,latencyMs:record.latencyMs,decisions:record.result?.decisions?.length});
