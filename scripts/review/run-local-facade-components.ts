/** Local structured extraction trial; never publishes accepted game geometry. */
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const out='.cache/facade-assessment/components-v1';
await fs.mkdir(out,{recursive:true});
const source='.cache/facade-assessment/banana-head-on-v1/strip1.png';
const bytes=await fs.readFile(source), image=await sharp(bytes).resize({width:1536}).png().toBuffer();
const prompt=`Identify architectural components in this generated street elevation. Return JSON only: {"features":[{"id":"unique","kind":"window|door|balcony","bbox":[left,top,right,bottom],"confidence":0.0}],"notes":[]}. Coordinates normalized 0..1 across the ENTIRE supplied image including white sky, origin top-left. Extract all visible windows and ground entrances separately. Balcony bbox encloses only slab+railing, not the tall window behind. Window bbox encloses the whole opening, not individual panes; do not count painted railing bars as windows. Door means pedestrian entrance, not shop glazing. Preserve asymmetry. No metric depth guesses. Omit uncertain hidden openings. Keep JSON compact, maximum 90 features. This is a candidate extraction, not measured geometry.`;
const hash=createHash('sha256').update(bytes).digest('hex');
const file=out+'/qwen-extraction.json';
try{await fs.access(file);throw Error('Existing receipt: preserve it; choose a new trial directory');}catch(e:any){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(out+'/prompt.txt',prompt);
await fs.writeFile(file,JSON.stringify({status:'running',source,sha256:hash,model:'qwen3.5:9b',prompt},null,2));
const start=performance.now();
try{
 const r=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(360000),body:JSON.stringify({model:'qwen3.5:9b',stream:false,think:false,format:'json',options:{temperature:0,num_ctx:16384,num_predict:6000},messages:[{role:'user',content:prompt,images:[image.toString('base64')]}]})});
 const raw=await r.json();const result=JSON.parse(raw.message?.content??'null');
 const valid=r.ok&&raw.done_reason!=='length'&&Array.isArray(result?.features)&&result.features.every((f:any)=>['window','door','balcony'].includes(f.kind)&&Array.isArray(f.bbox)&&f.bbox.length===4&&f.bbox.every((x:any)=>Number.isFinite(x)&&x>=0&&x<=1)&&f.bbox[0]<f.bbox[2]&&f.bbox[1]<f.bbox[3]);
 await fs.writeFile(file,JSON.stringify({status:valid?'candidate':'invalid',source,sha256:hash,model:'qwen3.5:9b',prompt,latencyMs:Math.round(performance.now()-start),apiCostUsd:0,result,raw},null,2));
 console.log(JSON.stringify({valid,count:result?.features?.length,latencyMs:Math.round(performance.now()-start)}));
}catch(e){await fs.writeFile(file,JSON.stringify({status:'failed',source,sha256:hash,error:String(e)},null,2));throw e;}
