import assert from 'node:assert/strict';
import fs from 'node:fs';
import {applyRetailSourceCorrections} from './retail-source-corrections.ts';
import {compileSourceShapePreview} from './source-shape-preview.ts';
import {applySourceAssemblies} from './apply-source-assemblies.ts';
const review=JSON.parse(fs.readFileSync('scripts/review/retail-priority-source-review.json','utf8'));
const cases=JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json','utf8')).cases;
const spatial=JSON.parse(fs.readFileSync('scripts/review/spatial-source-corrections.json','utf8'));
for(const id of ['case-03','case-21','case-29']){
 const c=cases.find((c:any)=>c.caseId===id),input=c.shapeFeatures.ground;
 const before=JSON.stringify(input),out=applyRetailSourceCorrections(id,'ground',input,review);
 assert.equal(JSON.stringify(input),before,'Do not mutate cached evidence');
 assert.deepEqual(applyRetailSourceCorrections(id,'ground',out,review),out,'Idempotent rebuild');
 assert.equal(applyRetailSourceCorrections(id,'full',input,review),input,'No tenant transfer between dates/tiers');
 for(const update of [{cropSha256:'0'.repeat(64)},{captureDate:'1999-01-01'},{width:1}])assert.throws(()=>applyRetailSourceCorrections(id,'ground',{...input,...update},review),/Stale/);
 const study=applySourceAssemblies(compileSourceShapePreview(out),out,spatial.cases[id]?.ground?.entranceAssemblies);
 const signs=study.patches.filter((p:any)=>p.sign);
 assert.ok(signs.length>=2,`${id}: visible physical signs`);
 for(const sign of signs){assert.equal(sign.sign.uv.length,sign.triangles.length/3*2);assert.ok(sign.triangles.every(Number.isFinite));}
 if(id==='case-29'){
  assert.equal(out.features.filter((f:any)=>f.kind==='door').length,2);
  assert.equal(signs.filter((p:any)=>p.sign.text==='DORUS').length,2,'Separate valance and display signs only');
  assert.ok(!out.features.some((f:any)=>f.id==='ground:fascia-main'),'No invented housing lettering');
 }
 if(id==='case-21')assert.equal(out.features.filter((f:any)=>f.kind==='awning').length,0);
}
console.log('Retail source bindings, date isolation, persistent signs, no awning invention and separate entrances passed');
