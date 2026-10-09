/** Publish a read-only review packet; inference and acceptance remain separate. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {validateFacadeAssessment} from '../city-appearance/facade-assessment-schema.mjs';
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const packetFile='.cache/facade-assessment/cohort.json',runDir='.cache/facade-assessment/pilot-v1';
const packetBytes=await fs.readFile(packetFile),packet=JSON.parse(packetBytes.toString());
const report=JSON.parse(await fs.readFile(path.join(runDir,'report.json'),'utf8'));
if(report.packetSha256!==sha(packetBytes))throw Error('Assessment packet changed');
const assessments=new Map<number,any>();
for(const r of report.receipts){
 const e=packet.entries.find((e:any)=>e.index===r.binding.index);
 if(!e||r.binding.buildingId!==e.buildingId||r.binding.observationId!==e.observationId||r.binding.packetSha256!==sha(packetBytes)||
   r.experimentHash!==report.experimentHash)throw Error('Assessment binding mismatch');
 if(r.binding.inputs.length!==e.images.length||r.binding.inputs.some((input:any,i:number)=>input.kind!==e.images[i].kind||input.sourceSha256!==e.images[i].sha256))throw Error('Assessment images changed');
 if(assessments.has(e.index))throw Error('Duplicate assessment');
 assessments.set(e.index,r);
}
const entries=[];
for(const e of packet.entries){
 for(const image of e.images)if(sha(await fs.readFile(image.path))!==image.sha256)throw Error('Source hash mismatch');
 const r=assessments.get(e.index),valid=r?.status==='ok'&&validateFacadeAssessment(r.assessment).valid;
 entries.push({...e,images:e.images.map(({path,...image}:any)=>image),assessment:valid?r.assessment:null,
  status:r?(valid?'model-proposal':r.status):'not-assessed',latencyMs:r?.clientLatencyMs??null,
  receiptKey:r?.key??null,validation:r?.validation??null});
}
const out='public/data/facade-review-galleries/assessment';await fs.mkdir(out,{recursive:true});
const target=path.join(out,'report.json'),temporary=`${target}.${randomUUID()}.tmp`;
await fs.writeFile(temporary,JSON.stringify({version:1,generatedAt:new Date().toISOString(),experimentHash:report.experimentHash,
 packetSha256:sha(packetBytes),summary:packet.summary,entries,policy:'Model proposals only; no accepted openings, roof geometry, material bands or sign text.'},null,2)+'\n');await fs.rename(temporary,target);
console.log(JSON.stringify({owners:entries.length,assessed:assessments.size,valid:entries.filter(e=>e.status==='model-proposal').length}));
