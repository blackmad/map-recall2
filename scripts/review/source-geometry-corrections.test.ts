import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import corrections from './source-geometry-corrections.json' with {type:'json'};
import {prepareSourceGeometryCorrection,stageSourceGeometryPacket} from './source-geometry-corrections.ts';

const packet=JSON.parse(readFileSync('public/data/facade-repair-preview/cases.json','utf8'));
const before=packet.cases.find((c:any)=>c.caseId==='case-24');
const staged=stageSourceGeometryPacket(packet,corrections.cases as any);
const after=staged.cases.find((c:any)=>c.caseId==='case-24');
assert.equal(packet.createdAt,staged.createdAt);
assert.deepEqual(packet.cases.filter((c:any)=>c.caseId!=='case-24'),staged.cases.filter((c:any)=>c.caseId!=='case-24'));
assert.deepEqual(before.shapeFeatures.ground,after.shapeFeatures.ground,'dated ground features are untouched');
assert.deepEqual(before.patches,after.patches,'metric-domain patches are untouched');
assert.deepEqual(before.owner,after.owner,'3D owner geometry is untouched');
assert.deepEqual(after.shapeFeatures.full.features.find((f:any)=>f.id==='full:door-1').bounds,[27,606,59,705]);
assert.deepEqual(after.shapeFeatures.full.features.find((f:any)=>f.id==='full:door-2').bounds,[157,606,188,705]);
assert.deepEqual(after.shapeFeatures.full.features.find((f:any)=>f.id==='full:review:shop-display').bounds,[60,606,156,705]);
assert.equal(after.shapeFeatures.full.features.find((f:any)=>f.id==='full:window-1').transom,0.24);
for(const id of ['full:window-4','full:window-5','full:window-6','full:window-7'])assert.equal(after.shapeFeatures.full.features.find((f:any)=>f.id===id).lintelHead,undefined,'unreviewed pale lintels are omitted');
for(const id of ['full:window-4','full:window-5','full:window-6','full:window-7']){
 const feature=after.shapeFeatures.full.features.find((f:any)=>f.id===id);
 assert.deepEqual(feature.mullions,[],'curtain edges are not asserted as window mullions');
 assert.equal(feature.paired,false,'lower windows are not forced into two leaves');
}
for(const id of ['full:window-1','full:window-2','full:window-3']){
 const feature=after.shapeFeatures.full.features.find((f:any)=>f.id===id);
 assert.equal(feature.mullionScope,'below-transom','upper mullions meet the transom rather than crossing its upper pane');
 assert.equal(feature.sourceFrameWidthPx,4,'inspected source window uses source-pixel surround width');
}
assert.equal(after.roofReview.status,'source-outline-reviewed');
assert.equal(after.shapeStudy.full.sourceSilhouette.mode,'source-pixel-approximate');
assert.equal(after.shapeStudy.full.sourceSilhouette.polygonPx[7][1],60,'the building crown, rather than the projecting pole, defines the top');
assert.ok(after.shapeStudy.full.sourceSilhouette.polygonPx.every((p:number[])=>p[1]>=60),'no wall geometry reaches the pole at y=34');
assert.equal(after.shapeFeatures.full.features.find((f:any)=>f.id==='full:window-2').head,'rectangular');
assert.deepEqual(after.shapeFeatures.full.features.find((f:any)=>f.id==='full:window-2').bounds,[36,249,91,339]);
assert.equal(after.shapeFeatures.full.features.filter((f:any)=>f.id==='full:review:crown-vent').length,1);
assert.deepEqual(stageSourceGeometryPacket(staged,corrections.cases as any),staged,'staging is idempotent');
const withAssembly=structuredClone(packet);
withAssembly.cases.find((c:any)=>c.caseId==='case-24').shapeStudy.full.patches.push({featureId:'source-assembly:full:door-1',sourceStudyOnly:true});
assert.throws(()=>stageSourceGeometryPacket(withAssembly,corrections.cases as any),/assemblies or unsupported metadata/);
assert.throws(()=>prepareSourceGeometryCorrection('case-24','full',{...before.shapeFeatures.full,width:214},corrections.cases as any),/Stale source geometry correction/);
assert.throws(()=>prepareSourceGeometryCorrection('case-24','full',{...before.shapeFeatures.full,cropSha256:'0'.repeat(64)},corrections.cases as any),/Stale source geometry correction/);
console.log('source geometry corrections passed');
