import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {WALL_MATERIALS} from '../../src/canalRecall/facade/wallMaterialLibrary.js';
const sha=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const cohort=JSON.parse(await fs.readFile('review-data/wall-colour/visual-loop/cohort.json','utf8'));
const reviews=[];const reviewHashes:Record<string,string>={};
for(const name of ['terra','luna']){const bytes=await fs.readFile(`review-data/wall-colour/visual-loop/reference-${name}.json`);reviewHashes[name]=sha(bytes);const doc=JSON.parse(bytes.toString());reviews.push(...doc.entries.map((e:any)=>({...e,reviewer:doc.reviewer??(name==='terra'?'gpt-5.6-terra':'gpt-6-luna')})));}
const aliases:Record<string,string>={'cream-painted-brick':'paintedcreambrick','white-painted-brick':'paintedwhitebrick'};
const gate=[0,1,3,4,10,11,15,17,30,64];
const seen=new Set();
const entries=cohort.entries.map((c:any)=>{const r=reviews.find((r:any)=>r.index===c.index);if(!r||r.buildingId!==c.buildingId||r.sourceSha256!==c.sourceSha256||r.observationId!==c.observationId||seen.has(r.buildingId))throw Error(`Review identity mismatch ${c.index}`);seen.add(r.buildingId);const materialId=aliases[r.materialId]??r.materialId.replaceAll('-','');if(!WALL_MATERIALS.some(m=>m.id===materialId))throw Error(`Unknown material ${r.materialId}`);return {...c,assessment:r,materialId,stage:gate.includes(c.index)?'ten-building-preview':'reference-assessed',visualVerdict:'pending',materialSource:'model-visual-inference',textureSource:'shared-procedural-approximation-not-measured'};});
if(entries.length!==100||seen.size!==100)throw Error('Expected100 distinct buildings');
for(const e of entries){if(sha(await fs.readFile(`public${e.crop}`))!==e.sourceSha256)throw Error(`Stale crop ${e.index}`);}
const out={version:1,baselineReleaseId:cohort.baselineReleaseId,sampleSha256:cohort.sampleSha256,reviewHashes,gate,publication:'opt-in-experiment-not-visually-accepted',entries};
await fs.mkdir('public/data/wall-materials',{recursive:true});await fs.writeFile('public/data/wall-materials/assignments.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({owners:entries.length,gate,materials:Object.fromEntries(WALL_MATERIALS.map(m=>[m.id,entries.filter((e:any)=>e.materialId===m.id).length])),unresolved:entries.filter((e:any)=>e.materialId==='unknownneutral').length}));
