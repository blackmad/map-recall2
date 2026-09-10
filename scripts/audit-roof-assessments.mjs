/** Read-only policy comparison against a frozen pre-publication snapshot. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assessRoofEvidence} from '../public/canal-drive/da-costa-block/roof-assessment.js';
import {roofFrontageComponents} from './da-costa-block/roof-components.mjs';
const root='.cache/da-costa-neighbourhood/roof-assessment-2026-09-09';
await fs.mkdir(root,{recursive:true});
const before=root+'/before.json';
try{await fs.copyFile('public/data/da-costa-block/neighbourhood.json',before,fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='EEXIST')throw e;}
const bytes=await fs.readFile(before),data=JSON.parse(bytes),block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
const counts={},records=data.records.map(r=>{
  const building=block.buildings.find(b=>b.id===r.buildingId),components=roofFrontageComponents(building,r),after=assessRoofEvidence({...r,roofComponents:components});
  counts[after.status]=(counts[after.status]||0)+1;
  return {id:r.id,address:r.address,legacyConflict:r.roofConflict,assessment:after};
});
assert.equal(records.length,103);
const result={version:1,sourceSha256:createHash('sha256').update(bytes).digest('hex'),counts,legacyConflicts:records.filter(r=>r.legacyConflict).length,newImageDisagreements:records.filter(r=>r.assessment.imageDisagreement).length,changed:records.filter(r=>r.legacyConflict!==r.assessment.imageDisagreement),records,labelsChanged:false,costUsd:0};
await fs.writeFile(root+'/comparison.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({counts,legacyConflicts:result.legacyConflicts,imageDisagreements:result.newImageDisagreements,changed:result.changed.map(r=>({address:r.address,status:r.assessment.status}))}));
