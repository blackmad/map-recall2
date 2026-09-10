/** Promote a frozen roof-only agent packet; never writes human decisions or source pixels. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {matchingVisualReview,applyVisualProposal} from './visual-review.mjs';
const root='.cache/da-costa-neighbourhood',source='.cache/da-costa-storefront-roofs-2026-09-09/frozen-image-findings.json',target=root+'/self-review-2026-09-09/storefront-roof-findings.json';
const sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=await fs.readFile(source);assert.equal(sha(bytes),'fe0d79b54fe84cc8b50266177a16645b7ec3494370a97a4526a57dbf7b1cf3c2','Frozen opinions changed: fresh explicit inspection required');
const rows=JSON.parse(bytes).records,manifest=JSON.parse(await fs.readFile(root+'/manifest.json')),aerial=JSON.parse(await fs.readFile(root+'/aerial.json')).records;
assert.equal(rows.length,6);
let verified=0;
for(const row of rows){
  assert.ok(Object.keys(row.proposal).every(k=>['roofShape','facadeTop'].includes(k)),'No ground-field promotion');
  const record=manifest.records.find(r=>r.id===row.id),air=aerial.find(a=>a.buildingId===record.buildingId);assert.ok(matchingVisualReview([row],record,air));assert.equal(air.coverageComplete,true);
  for(const m of row.images){assert.equal(sha(await fs.readFile(path.join(root,'images',m.file))),m.sha256);assert.equal(sha(await fs.readFile(m.absolutePath)),m.sha256);verified++;}
  const ground={wholeUsable:'yes',shopfront:'yes',awning:'unknown',visibleSignText:'TEST GROUND SENTINEL'};
  const applied=applyVisualProposal(ground,row).proposal;
  for(const k of Object.keys(ground))assert.equal(applied[k],ground[k],'Roof review leaves existing ground field unchanged');
}
let alreadyPresent=false;try{const prior=await fs.readFile(target);assert.equal(sha(prior),sha(bytes),'Refuse to overwrite a different promoted review');alreadyPresent=true;}catch(e){if(e.code!=='ENOENT')throw e;}
if(process.argv.includes('--apply')&&!alreadyPresent){await fs.writeFile(target+'.tmp',bytes,{flag:'wx'});await fs.rename(target+'.tmp',target);}
console.log(JSON.stringify({apply:process.argv.includes('--apply'),alreadyPresent,records:rows.length,verifiedImagePairs:verified,eligibleRoofShapes:rows.filter(r=>r.fieldEligibility.roofShape).length,eligibleFacadeTops:rows.filter(r=>r.fieldEligibility.facadeTop).length,groundFieldsChanged:0,humanWrites:0,costUsd:0,target}));
