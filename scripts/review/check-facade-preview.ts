import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const data=await read('public/data/facade-repair-preview/cases.json');
const refs=await read('scripts/review/window-shape-reference.json');
const regressions=await read('scripts/review/facade-regressions.json');
assert.equal(data.cases.length,28);assert.equal(data.previewOnly,true);
const results=[];
for(const c of data.cases){
 const r=regressions.cases.find((r:any)=>r.caseId===c.caseId);assert.equal(c.note,r.userNote.text);
 if(c.caseId==='case-26'){assert.equal(c.patches.length,0);assert.equal(Object.keys(c.shapeStudy).length,0);continue;}
 for(const tier of ['full','ground']){
  assert.ok(c.shapeStudy[tier],`${c.caseId}/${tier}: missing study`);
  assert.ok(c.shapeStudy[tier].patches.every((p:any)=>p.previewOnly&&p.triangles.every(Number.isFinite)));
 }
 for(const ref of refs.entries.filter((r:any)=>r.caseId===c.caseId))for(const expected of ref.features){
  const feature=c.shapeFeatures[ref.tier].features.find((f:any)=>f.id===`${ref.tier}:review:${expected.id}`);
  if(c.caseId==='case-22'&&!feature){
   const group=c.shapeFeatures[ref.tier].features.filter((f:any)=>f.componentGroup===expected.id);
   assert.equal(group.length,expected.kind==='window'?3:1,'Source-reviewed split group must remain complete');
   for(const f of group){assert.equal(f.kind,expected.kind);assert.equal(f.head,expected.head);assert.ok(c.shapeStudy[ref.tier].patches.some((p:any)=>p.featureId.endsWith(f.id)));}
   if(expected.kind==='door')assert.equal(group[0].paired,true);
   continue;
  }
  assert.ok(feature);assert.equal(feature.head,expected.head);assert.equal(feature.kind,expected.kind);
  for(const field of ['archRise','topCornerRadius','transom'])if(expected[`${field}Range`])assert.ok(feature[field]>=expected[`${field}Range`][0]&&feature[field]<=expected[`${field}Range`][1]);
  assert.ok(c.shapeStudy[ref.tier].patches.some((p:any)=>p.featureId.endsWith(feature.id)),`${c.caseId}: reference shape disappeared`);
 }
 for(const [tier,input] of Object.entries(c.shapeFeatures) as [string,any][]){
  for(const feature of input.features)assert.ok(['agent-inspected','machine-observed-unreviewed','human-reviewed','revoked','unknown'].includes(feature.disposition),`${c.caseId}/${feature.id}: invalid disposition would silently hide geometry`);
  if(['case-14','case-18','case-19','case-24'].includes(c.caseId)&&tier==='ground')for(const feature of input.features.filter((f:any)=>f.kind==='door'))assert.ok(c.shapeStudy[tier].patches.some((p:any)=>p.featureId.endsWith(feature.id)),`${c.caseId}: corrected door lost`);
 }
 const sourceCount=(kind:string)=>new Set(Object.values(c.shapeFeatures).flatMap((s:any)=>s.features.filter((f:any)=>f.kind===kind&&(!['awning'].includes(kind)||['extended','retracted'].includes(f.state))).map((f:any)=>f.id))).size;
 results.push({caseId:c.caseId,sourceFeatures:Object.fromEntries(['door','window','awning','material'].map(k=>[k,sourceCount(k)])),compiledBuildingFeatures:c.counts,partialBuildingFeatures:[...new Set(c.patches.filter((p:any)=>p.partialAtFace).map((p:any)=>p.featureId))],placementOmissions:c.omissions,requiredCurvatureAudit:true,curvatureReferenceApplied:!!c.shapeReferenceUsedForDevelopmentRepair,photographicAcceptance:'pending-inspection-and-registration'});
}
const bytes=await fs.readFile('public/data/facade-repair-preview/cases.json');
await fs.writeFile('public/data/facade-repair-preview/checks.json',JSON.stringify({version:1,candidateDataSha256:crypto.createHash('sha256').update(bytes).digest('hex'),engineeringChecks:'passed',photographicGate:'not-passed',runtimeReleaseGate:'not-run',originalTwelveOutstanding:true,processingCoverage:{reviewedCases:28,analyzedCases:27,analyzedCrops:54,sourceIdentityAbstentions:['case-26']},cases:results},null,2));
console.log('28 note bindings, 54 source studies, six corrected curvature references, finite preview geometry and source abstention passed. Photographic acceptance remains pending.');
const provenanceFiles=['scripts/review/roof-coverage-corrections.ts','scripts/review/roof-coverage-corrections.json','scripts/review/retail-source-corrections.ts','scripts/review/retail-priority-source-review.json','scripts/review/next-stage-source-review.json','scripts/review/next-stage-roofs.ts','scripts/review/apply-source-silhouette.ts','scripts/review/next-stage-temporal.ts','scripts/review/facade-regressions.json','scripts/review/window-shape-reference.json','scripts/review/development-photo-corrections.json','.cache/city-appearance/fidelity-extraction/development-analysis-index.json','.cache/city-appearance/fidelity-extraction/analysis-results.json','src/canalRecall/facadeDescription.ts','src/canalRecall/facadeDoorHeuristics.ts','src/canalRecall/cityAppearanceFacadeRecipes.ts','scripts/review/build-facade-preview.ts','scripts/review/source-shape-preview.ts','scripts/review/preview-browser.ts','scripts/review/roof-sign-corrections.json','src/canalRecall/facadeSignMaterial.ts','src/canalRecall/facadeEntranceAssemblies.ts','scripts/review/temporal-preview-evidence.ts','scripts/review/temporal-evidence-inventory.json','src/canalRecall/facadeTemporalEvidence.ts','scripts/review/spatial-source-corrections.json','scripts/review/apply-source-assemblies.ts','public/canal-drive/js/facade-repair-preview.bundle.js','public/data/facade-repair-preview/cases.json','public/data/facade-repair-preview/checks.json'];
await fs.writeFile('public/data/facade-repair-preview/provenance.json',JSON.stringify({version:1,scope:'development-preview-only; not release gate evidence',files:await Promise.all(provenanceFiles.map(async path=>({path,sha256:crypto.createHash('sha256').update(await fs.readFile(path)).digest('hex')})))},null,2));
