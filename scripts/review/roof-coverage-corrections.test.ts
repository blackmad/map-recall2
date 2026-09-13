import assert from 'node:assert/strict';
import reviewData from './roof-coverage-corrections.json' with {type:'json'};
import {prepareRoofCoverageStudy,applyRoofCoverageStudy} from './roof-coverage-corrections.ts';
import {compileSourceShapePreview} from './source-shape-preview.ts';
const review=(caseId:string)=>(reviewData as any).cases.find((entry:any)=>entry.caseId===caseId);
const input=(entry:any)=>({cropSha256:entry.source.sha256,captureDate:entry.source.captureDate,width:entry.source.width,height:entry.source.height,features:[...(entry.remove??[]).map((id:string)=>({id,kind:'window'})),{id:'retained',kind:'material',material:'brick'}]});
for(const caseId of ['case-01','case-04','case-09']){
 const entry=review(caseId),prepared=prepareRoofCoverageStudy(caseId,input(entry));
 assert.equal(prepared.mode,'source-space-roof-coverage-study');
 assert.deepEqual(prepared.source,entry.source,'the exact dated hash and dimensions bind the study');
 assert.equal(prepared.polygon.length,entry.silhouettePolygonPx.length+2,'only the source silhouette is closed to the synthetic study base');
 assert.ok(prepared.polygon.every((point:number[])=>point[0]>=0&&point[0]<=entry.source.width&&point[1]>=0&&point[1]<=entry.source.height),'silhouette remains in source pixel edges');
 assert.ok(prepared.occlusionUncertainty.length>20,'occlusions remain explicit');
 assert.ok(prepared.input.features.some((feature:any)=>feature.id.startsWith('full:review:')&&feature.kind==='material'),'each study carries a broad source-inspected roof field');
 assert.ok(prepared.input.features.some((feature:any)=>feature.id.startsWith('full:review:')&&feature.kind==='window'),'each study carries one inspected roof opening');
 assert.ok(prepared.input.features.every((feature:any)=>!('registration' in feature)&&!('uncertaintyM' in feature)),'source annotations do not invent metric registration');
 for(const id of entry.remove??[])assert.ok(!prepared.input.features.some((feature:any)=>feature.id===id),'replaced machine roof opening is removed');
 assert.throws(()=>prepareRoofCoverageStudy(caseId,{...input(entry),cropSha256:'0'.repeat(64)}),/Stale roof coverage source review/);
 assert.throws(()=>prepareRoofCoverageStudy(caseId,{...input(entry),width:entry.source.width+1}),/Stale roof coverage source review/);
}
const applied=prepareRoofCoverageStudy('case-04',input(review('case-04')));
const study=applyRoofCoverageStudy(compileSourceShapePreview(applied.input),applied);
assert.equal(study.sourceSilhouette.mode,'source-pixel-approximate','the existing silhouette adapter clips only the synthetic source study');
assert.deepEqual(study.sourceSilhouette.polygonPx,applied.polygon,'adapter receives the reviewed pixel-edge outline');
assert.throws(()=>prepareRoofCoverageStudy('case-99',input(review('case-01'))),/No roof coverage review/);
console.log('source-bound roof coverage corrections passed');
