/** Recheck installed profiles after a mesh change, without resampling elevation. */
import {readFile,writeFile} from 'node:fs/promises';
import {preflightBridge} from './preflight.ts';
const root='public/data/extracts/amsterdam/',surfaceFile=root+'bridge-surfaces.json',reportFile=root+'bridge-surface-review.json';
const data=JSON.parse(await readFile(surfaceFile,'utf8')),report=JSON.parse(await readFile(reportFile,'utf8')),kept=[];
for(const bridge of data.bridges){
  try{bridge.review={...bridge.review,...preflightBridge(bridge)};kept.push(bridge);}
  catch(error){const entry=report.entries.find((e:any)=>e.id===bridge.id);entry.status='review';entry.reasons.push(String(error).replace(/^Error: /,''));console.log(`${bridge.id}: ${entry.reasons.at(-1)}`);}
}
if(!kept.length)throw Error('All models failed; retaining installed data');
data.bridges=kept;report.summary={};for(const entry of report.entries)report.summary[entry.status]=(report.summary[entry.status]||0)+1;
await writeFile(surfaceFile,JSON.stringify(data,null,2)+'\n');await writeFile(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
