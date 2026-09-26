import assert from 'node:assert/strict';
import reviewData from './next-stage-source-review.json' with {type:'json'};
import {prepareRoofStudy} from './next-stage-roofs.ts';
const review=(id:string)=>(reviewData as any).cases.find((entry:any)=>entry.caseId===id);
const full=(r:any,features:any[]=[{id:'full:brick',kind:'material',material:'brick',colour:'#a25d42',bounds:[0,0,r.sources.full.width,r.sources.full.height]},{id:'full:old-window',kind:'window',bounds:[1,1,2,2]}])=>({cropSha256:r.sources.full.sha256,captureDate:r.sources.full.captureDate,width:r.sources.full.width,height:r.sources.full.height,features});
const twenty=review('case-20'),case20=prepareRoofStudy(full(twenty),twenty);
const dormer=case20.input.features.find((feature:any)=>feature.id==='full:review:dormer');
assert.deepEqual(dormer.bounds,twenty.roofStudy.dormerOpeningBoundsPxApprox);assert.deepEqual(dormer.mullions,[.5]);
assert.equal(case20.input.features.find((feature:any)=>feature.id==='full:brick').colour,'#4d4840','case 20 inspected dark brick replaces the unreviewed material colour');
assert.ok(case20.input.features.some((feature:any)=>feature.id==='full:review:roof-slate'),'case 20 adds the source-bound roof fill');
assert.equal(case20.polygon.length,twenty.roofStudy.frontSilhouettePxApprox.length+2,'case 20 silhouette closes only to the synthetic study ground');
const twentyTwo=review('case-22'),case22=prepareRoofStudy(full(twentyTwo,[{id:'old-door',kind:'door'},{id:'old-window',kind:'window'},{id:'old-material',kind:'material',material:'brick'}]),twentyTwo);
assert.equal(case22.input.features.filter((feature:any)=>['door','window'].includes(feature.kind)).length,17,'case 22 has its source-reviewed gable opening plus four rows of four openings');
for(let row=0;row<4;row++){const left=case22.input.features.filter((feature:any)=>feature.id.startsWith(`full:review:row-${row}-bay-`));assert.equal(left.length,3,`case 22 row ${row} retains all three left openings`);assert.ok(case22.input.features.some((feature:any)=>feature.id===`full:review:row-${row}-right`),`case 22 row ${row} retains right opening`);}
assert.equal(case22.input.features.find((feature:any)=>feature.id==='full:review:row-3-right').kind,'door','case 22 lower right is kept as the inspected door');
assert.equal(case22.polygon.length,twentyTwo.roofStudy.stepOutlinePxApprox.length+2,'case 22 retains every stepped silhouette coordinate');
assert.throws(()=>prepareRoofStudy({...full(twenty),cropSha256:'0'.repeat(64)},twenty),/Stale roof source review/);
assert.throws(()=>prepareRoofStudy({...full(twenty),captureDate:'1999-01-01'},twenty),/Stale roof source review/);
console.log('next-stage roof studies passed');
